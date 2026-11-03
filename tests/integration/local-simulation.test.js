import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { addCard, nextWakeAt, reconcile } from '@stackfriends/shared/game.js';
import { LocalGame } from '../../src/lib/local-game.js';
import { createApiProxy } from '../../api/proxy.js';

async function fixture(t) {
  const apiDirectory = process.env.API_DIR ? path.resolve(process.env.API_DIR) : fileURLToPath(new URL('../../../backend/', import.meta.url));
  const { createGameServer } = await import(pathToFileURL(path.join(apiDirectory, 'server/app.js')).href);
  const directory = await mkdtemp(path.join(tmpdir(), 'stackfriends-browser-'));
  let timestamp = 1_000_000;
  const origin = 'https://browser-game.example.test';
  const api = await createGameServer({ config: { mode: 'local', worldFile: path.join(directory, 'personal-worlds.json'), legacyWorldFile: path.join(directory, 'legacy.json'), secureCookie: false, publicOrigin: origin }, now: () => timestamp });
  await new Promise((resolve) => api.server.listen(0, '127.0.0.1', resolve));
  const frontend = http.createServer(createApiProxy({ backendUrl: `http://127.0.0.1:${api.server.address().port}` }));
  await new Promise((resolve) => frontend.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${frontend.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => { frontend.close(resolve); frontend.closeIdleConnections(); });
    await api.close();
    if (path.dirname(directory) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('stackfriends-browser-')) throw new Error('Unexpected fixture path');
    await rm(directory, { recursive: true, force: true });
  });
  const calls = [];
  async function request(route, body, account) {
    calls.push(route);
    const response = await fetch(`${address}/api/${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, ...(account ? { Cookie: account.cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify({ simulation: 'local', clientId: account?.clientId || 'new-client', ...body }) });
    return { response, result: await response.json() };
  }
  async function join(name) {
    const joined = await request('join', { name });
    assert.equal(joined.response.status, 200);
    return { ...joined.result, cookie: joined.response.headers.getSetCookie()[0].split(';')[0], clientId: `browser-${name}` };
  }
  async function seed(account, operation) {
    return api.service.repository.transaction(async (context) => {
      const player = await context.playerById(account.player.id);
      const value = operation(player.world);
      player.world.revision++; player.revision++;
      await context.savePlayer(player);
      return value;
    });
  }
  async function save(game, account, saveId) {
    const packet = game.prepareSave(saveId);
    const saved = await request('save', packet, account);
    assert.equal(saved.response.status, 200, saved.result.message);
    assert.equal(Object.hasOwn(saved.result, 'world'), false);
    game.acknowledge(saved.result);
    return saved.result;
  }
  return { api, calls, request, join, seed, save, now: () => timestamp, at: (value) => timestamp = value };
}

test('a minute of local work and animal movement uses no event HTTP calls and saves as one batch', async (t) => {
  const f = await fixture(t), account = await f.join('Alice');
  const treeId = await f.seed(account, (world) => {
    const tree = addCard(world, 'tree', 1000, 500);
    addCard(world, 'cow', 1600, 900);
    reconcile(world, f.now());
    return tree.id;
  });
  const loaded = await f.request('load', {}, account);
  const game = new LocalGame(); game.adopt(loaded.result); game.resume(f.now());
  game.command({ type: 'move', cardId: account.player.cardId, targetId: treeId, x: 1000, y: 500, split: true, takeAbove: true }, f.now());
  const before = f.calls.length, end = f.now() + 60_000;
  let ticks = 0;
  while (true) {
    const deadline = nextWakeAt(game.world, f.now());
    if (deadline === null || deadline > end) break;
    // Browser timers run on integer wall-clock ticks, after a fractional deadline.
    f.at(Math.max(f.now() + 1, Math.ceil(deadline))); game.advance(f.now());
    assert.ok(++ticks < 100);
  }
  f.at(end); game.advance(f.now());
  assert.ok(ticks >= 5);
  assert.equal(f.calls.length, before);
  assert.equal(game.world.cards.some((card) => card.id === treeId), false);
  assert.equal(game.world.cards.filter((card) => ['wood', 'stick'].includes(card.type)).length, 5);

  const packet = game.prepareSave('browser-save-first');
  const coin = game.world.cards.find((card) => card.type === 'gold');
  f.at(f.now() + 100);
  game.command({ type: 'move', cardId: coin.id, x: 1300, y: 650, split: true, takeAbove: false }, f.now());
  const first = await f.request('save', packet, account);
  assert.equal(first.response.status, 200, first.result.message);
  game.acknowledge(first.result);
  assert.equal(game.world.cards.find((card) => card.id === coin.id).x, 1300);
  assert.equal(game.isDirty, true);
  await f.save(game, account, 'browser-save-second');
  const stored = await f.api.service.repository.read(async (context) => (await context.playerById(account.player.id)).world);
  assert.deepEqual(stored, game.world);
  assert.equal(f.calls.filter((route) => route === 'save').length, 2);
  assert.equal(f.calls.filter((route) => ['command', 'sync'].includes(route)).length, 0);
});

test('lost save responses recover the unsent suffix and local gifts remain atomic through the proxy', async (t) => {
  const f = await fixture(t), alice = await f.join('Alice'), bob = await f.join('Bob');
  await f.seed(alice, (world) => { addCard(world, 'town_hall', 1500, 800); addCard(world, 'wood', 1100, 700); });
  const loaded = await f.request('load', {}, alice);
  const game = new LocalGame(); game.adopt(loaded.result); game.resume(f.now());
  const first = game.prepareSave('lost-browser-save');
  const committed = await f.request('save', first, alice);
  assert.equal(committed.response.status, 200);
  f.at(f.now() + 100);
  game.command({ type: 'move', cardId: alice.player.cardId, x: 900, y: 600, split: true }, f.now());
  const recovery = game.serialize();
  const afterReload = await f.request('load', {}, alice);
  const restored = new LocalGame();
  assert.equal(restored.restore(afterReload.result, recovery).acknowledged, true);
  assert.equal(restored.pendingCount, 1);
  await f.save(restored, alice, 'suffix-browser-save');

  const wood = restored.world.cards.find((card) => card.type === 'wood');
  const giftBody = { baseRevision: restored.baseRevision, commandId: 'browser-gift-once', recipientId: bob.player.id, cardId: wood.id, split: true, takeAbove: false };
  const gift = await f.request('gift', giftBody, alice);
  assert.equal(gift.response.status, 200, gift.result.message);
  assert.equal(gift.result.world.cards.some((card) => card.id === wood.id), false);
  const duplicate = await f.request('gift', giftBody, alice);
  assert.equal(duplicate.result.giftId, gift.result.giftId);
  assert.equal(duplicate.result.duplicate, true);

  const bobLoad = await f.request('load', {}, bob);
  const recipient = new LocalGame(); recipient.adopt(bobLoad.result); recipient.resume(f.now());
  const saved = await f.save(recipient, bob, 'recipient-browser-save');
  assert.equal(saved.hasPendingGifts, true);
  const incoming = await f.request('sync', { baseRevision: recipient.baseRevision }, bob);
  assert.equal(incoming.response.status, 200, incoming.result.message);
  assert.equal(incoming.result.world.cards.filter((card) => card.type === 'wood').length, 1);
  recipient.adopt(incoming.result); recipient.resume(f.now(), f.now());
  await f.save(recipient, bob, 'recipient-after-gift');
  const noDuplicate = await f.request('sync', { baseRevision: recipient.baseRevision }, bob);
  assert.equal(noDuplicate.result.world.cards.filter((card) => card.type === 'wood').length, 1);
  assert.deepEqual(noDuplicate.result.giftMessages, []);
});

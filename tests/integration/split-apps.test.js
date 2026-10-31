import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApiProxy } from '../../api/proxy.js';

async function apiServerFactory() {
  const apiDirectory = process.env.API_DIR
    ? path.resolve(process.env.API_DIR)
    : fileURLToPath(new URL('../../../backend/', import.meta.url));
  try {
    return (await import(pathToFileURL(path.join(apiDirectory, 'server/app.js')).href)).createGameServer;
  } catch (cause) {
    throw new Error(`Der optionale Integrationstest benötigt einen installierten API-Checkout unter ${apiDirectory}. Im API-Repository zuerst npm ci ausführen oder API_DIR auf dessen Ordner setzen.`, { cause });
  }
}

test('separate frontend and API keep first-party personal worlds private and deliver gifts through HTTP', async (t) => {
  const createGameServer = await apiServerFactory();
  const directory = await mkdtemp(path.join(tmpdir(), 'stackfriends-split-'));
  let frontend, api;
  t.after(async () => {
    if (frontend?.listening) await new Promise((resolve) => { frontend.close(resolve); frontend.closeIdleConnections(); });
    await api?.close();
    if (path.dirname(directory) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('stackfriends-split-')) throw new Error('Ungültiger Test-Verzeichnispfad.');
    await rm(directory, { recursive: true, force: true });
  });
  const frontendOrigin = 'https://game.example.test';
  const config = { mode: 'local', worldFile: path.join(directory, 'personal-worlds.json'), legacyWorldFile: path.join(directory, 'legacy-world.json'), secureCookie: false, publicOrigin: frontendOrigin };
  api = await createGameServer({ config });
  await new Promise((resolve) => api.server.listen(0, '127.0.0.1', resolve));
  const apiOrigin = `http://127.0.0.1:${api.server.address().port}`;
  frontend = http.createServer(createApiProxy({ backendUrl: apiOrigin }));
  await new Promise((resolve) => frontend.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${frontend.address().port}`;
  async function request(endpoint, body, cookie) {
    return fetch(`${address}/api/${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: frontendOrigin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function join(name, clientId) {
    const response = await request('join', { name, clientId });
    assert.equal(response.status, 200);
    const header = response.headers.get('set-cookie');
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Lax/i);
    assert.match(header, /Path=\//i);
    assert.ok(!/Domain=/i.test(header));
    assert.match(response.headers.get('cache-control'), /no-store/);
    return { cookie: header.split(';')[0], state: await response.json(), clientId };
  }
  const anonymous = await (await request('session')).json();
  assert.equal(anonymous.player, null);
  assert.equal(anonymous.world, null);
  const alice = await join('Alice', 'integration-alice');
  const bob = await join('Bob', 'integration-bob');
  assert.notEqual(alice.cookie, bob.cookie);
  assert.notEqual(alice.state.player.id, bob.state.player.id);
  for (const account of [alice, bob]) {
    const { world, player } = account.state;
    assert.equal(world.id, player.id);
    assert.equal(world.cards.length, 10);
    assert.equal(world.cards.filter((card) => card.type === 'gold').length, 9);
    assert.deepEqual(world.players.map((person) => person.id), [player.id]);
    assert.deepEqual(world.cards.filter((card) => card.type === 'human').map((card) => card.ownerId), [player.id]);
    const restored = await (await request('session', undefined, account.cookie)).json();
    assert.equal(restored.player.id, player.id);
    assert.equal(restored.world.id, player.id);
  }
  const returningAlice = await join('alice', 'integration-alice-return');
  assert.equal(returningAlice.state.player.id, alice.state.player.id);
  assert.equal(returningAlice.state.world.cards.filter((card) => card.type === 'human').length, 1);
  const privateSession = await (await request(`session?playerId=${bob.state.player.id}`, undefined, alice.cookie)).json();
  assert.equal(privateSession.world.id, alice.state.player.id);
  assert.equal(privateSession.world.cards.some((card) => card.ownerId === bob.state.player.id), false);
  assert.equal((await request(`world/${bob.state.player.id}`, undefined, alice.cookie)).status, 404);
  assert.equal((await request('socket-ticket', {}, alice.cookie)).status, 404);

  const moved = await request('command', { clientId: alice.clientId, commandId: 'integration-move-1', command: { type: 'move', cardId: alice.state.player.cardId, x: 650, y: 350, split: true } }, alice.cookie);
  assert.equal(moved.status, 200);
  const movedState = await moved.json();
  assert.equal(movedState.world.cards.find((card) => card.id === alice.state.player.cardId).x, 650);
  const unchangedBob = await (await request('session', undefined, bob.cookie)).json();
  assert.equal(unchangedBob.world.cards.find((card) => card.id === bob.state.player.cardId).x, 340);
  assert.equal(unchangedBob.world.cards.filter((card) => card.type === 'gold').length, 9);

  const coin = movedState.world.cards.find((card) => card.type === 'gold');
  assert.equal((await request('players', undefined, alice.cookie)).status, 403);
  assert.equal((await request('materials', { playerId: bob.state.player.id }, alice.cookie)).status, 403);
  assert.equal((await request('gift', { recipientId: bob.state.player.id, cardId: coin.id, split: true, takeAbove: false, commandId: 'integration-gift-gated', clientId: alice.clientId }, alice.cookie)).status, 403);
  assert.equal((await request('players')).status, 401);

  // Only this isolated test fixture bypasses crafting; production requests still enforce the gate.
  await api.service.repository.transaction(async (context) => {
    const player = await context.playerById(alice.state.player.id);
    player.world.cards.push({ id: 'fixture-town-hall', type: 'town_hall', stackId: 'fixture-town-hall', order: 0, x: 1100, y: 300 });
    await context.savePlayer(player);
  });
  const listedResponse = await request('players', undefined, alice.cookie);
  assert.equal(listedResponse.status, 200);
  const listed = await listedResponse.json();
  assert.deepEqual(new Set(listed.players.map((person) => person.id)), new Set([alice.state.player.id, bob.state.player.id]));
  assert.ok(listed.players.every((person) => !Object.hasOwn(person, 'world') && !Object.hasOwn(person, 'tokenHashes')));
  const materialsResponse = await request('materials', { playerId: bob.state.player.id }, alice.cookie);
  assert.equal(materialsResponse.status, 200);
  const materials = await materialsResponse.json();
  assert.deepEqual(materials.materials, [{ type: 'gold', count: 9 }]);
  assert.equal(materials.player.id, bob.state.player.id);
  assert.equal(Object.hasOwn(materials, 'world'), false);
  assert.equal(Object.hasOwn(materials, 'cards'), false);

  const giftBody = { recipientId: bob.state.player.id, cardId: coin.id, split: true, takeAbove: false, commandId: 'integration-gift-1', clientId: alice.clientId };
  const sentResponse = await request('gift', giftBody, alice.cookie);
  assert.equal(sentResponse.status, 200);
  const sent = await sentResponse.json();
  assert.equal(sent.world.id, alice.state.player.id);
  assert.equal(sent.world.cards.filter((card) => card.type === 'gold').length, 8);
  assert.equal(sent.world.cards.some((card) => card.id === coin.id), false);
  const duplicate = await (await request('gift', giftBody, alice.cookie)).json();
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.giftId, sent.giftId);
  assert.equal(duplicate.world.cards.filter((card) => card.type === 'gold').length, 8);
  const beforeSync = await (await request('session', undefined, bob.cookie)).json();
  assert.equal(beforeSync.world.cards.filter((card) => card.type === 'gold').length, 9);
  assert.equal(beforeSync.hasPendingGifts, true);
  const presenceResponse = await request('presence', { active: true, clientId: bob.clientId }, bob.cookie);
  assert.equal(presenceResponse.status, 200);
  const presence = await presenceResponse.json();
  assert.equal(presence.hasPendingGifts, true);
  assert.equal(Object.hasOwn(presence, 'world'), false);
  const deliveredResponse = await request('sync', { active: true, clientId: bob.clientId }, bob.cookie);
  assert.equal(deliveredResponse.status, 200);
  const delivered = await deliveredResponse.json();
  assert.equal(delivered.world.id, bob.state.player.id);
  assert.equal(delivered.world.cards.filter((card) => card.type === 'gold').length, 10);
  assert.equal(delivered.world.cards.filter((card) => card.type === 'human').length, 1);
  assert.equal(delivered.hasPendingGifts, false);
  assert.equal(delivered.giftMessages.length, 1);
  assert.equal(delivered.giftMessages[0].giftId, sent.giftId);
  const repeated = await (await request('sync', { active: true, clientId: bob.clientId }, bob.cookie)).json();
  assert.equal(repeated.world.cards.filter((card) => card.type === 'gold').length, 10);
  assert.deepEqual(repeated.giftMessages, []);
  const health = await (await request('health')).json();
  assert.equal(health.transport, 'http');
  assert.equal(health.personalWorlds, true);
  assert.equal((await fetch(`${apiOrigin}/`)).headers.get('content-type')?.includes('application/json'), true);
});

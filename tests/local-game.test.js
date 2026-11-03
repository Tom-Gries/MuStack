import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from '@stackfriends/shared/catalog.js';
import { addCard, applyCommand, reconcile } from '@stackfriends/shared/game.js';
import { createPersonalWorld } from '@stackfriends/shared/personal-world.js';
import { replaySimulationBatch } from '@stackfriends/shared/local-simulation.js';
import { LocalGame } from '../src/lib/local-game.js';

const make = (id = 'tom') => createPersonalWorld({ id, name: id }, getCatalog(), 1000);
const human = (world) => world.cards.find((card) => card.type === 'human');
const move = (cardId, x = 650, y = 350, extra = {}) => ({ type: 'move', cardId, x, y, split: true, takeAbove: true, ...extra });
const load = (world, extra = {}) => ({ player: { id: world.id }, world: structuredClone(world), resumeActiveUntil: world.clock.lastAt, ...extra });
function create(world = make(), options) {
  const game = new LocalGame(options);
  game.adopt(load(world));
  return game;
}
function commit(base, packet) {
  const world = structuredClone(base);
  replaySimulationBatch(world, packet.operations, { playerId: world.id });
  world.revision++;
  return { world, result: { saveId: packet.saveId, revision: world.revision, currentRevision: world.revision, savedAt: world.clock.lastAt } };
}
function sourceWorld() {
  const world = make(), tree = addCard(world, 'tree', 1000, 500);
  applyCommand(world, move(human(world).id, tree.x, tree.y, { targetId: tree.id }), { playerId: world.id, now: 1000 });
  return { world, treeId: tree.id };
}

test('commands and due events run immediately without any network request', () => {
  const game = create();
  game.resume(1000);
  game.command(move(human(game.world).id), 1100);
  assert.equal(human(game.world).x, 650);
  const gold = game.world.cards.find((card) => card.type === 'gold');
  game.command(move(gold.id, 500, 500, { zone: 'shop', split: false, takeAbove: false }), 1200);
  const pack = game.world.cards.find((card) => card.type === 'pack');
  assert.ok(pack);
  const count = game.world.cards.length;
  const opened = game.command({ type: 'open-pack', cardId: pack.id }, 1300);
  assert.match(opened.message, /entdeckt/);
  assert.equal(game.world.cards.length, count + 1);
  assert.equal(game.pendingCount, 4);
  assert.equal(game.baseRevision, 0);
  assert.equal(game.isDirty, true);
});

test('a save ACK commits only its captured prefix and keeps newer movement visible', () => {
  const saved = make(), game = create(saved);
  game.resume(1000);
  const cardId = human(game.world).id;
  game.command(move(cardId), 1100);
  const packet = game.prepareSave('save-first-001');
  game.command(move(cardId, 900, 450), 1200);
  const newest = structuredClone(game.world);
  const committed = commit(saved, packet);
  game.acknowledge(committed.result);
  assert.equal(game.pendingCount, 1);
  assert.equal(game.baseRevision, 1);
  assert.equal(human(game.world).x, 900);
  assert.equal(game.world.randomState, newest.randomState);
  assert.deepEqual(game.world, { ...newest, revision: 1 });
  assert.deepEqual(game.baseWorld, committed.world);
  const second = game.prepareSave('save-second-002');
  const final = commit(committed.world, second);
  game.acknowledge(final.result);
  assert.equal(game.isDirty, false);
  assert.deepEqual(game.world, final.world);
});

test('uncertain saves retry exactly the same packet even after more local actions', () => {
  const game = create(); game.resume(1000);
  const first = game.prepareSave('uncertain-save-1');
  game.command(move(human(game.world).id), 1200);
  assert.deepEqual(game.prepareSave('different-id-02'), first);
  const exposed = game.pendingSave;
  exposed.operations.length = 0;
  assert.equal(game.pendingSave.operations.length, 1);
  assert.equal(game.pendingCount, 2);
});

test('large outboxes save bounded prefixes without dropping later operations', () => {
  const original = make(), game = create(original, { maxBatchSize: 2 });
  game.resume(1000);
  for (let index = 1; index <= 4; index++) game.command(move(human(game.world).id, 600 + index, 350), 1000 + index);
  let saved = original, batches = 0;
  while (game.isDirty) {
    const packet = game.prepareSave(`bounded-save-${batches}`);
    assert.ok(packet.operations.length <= 2);
    const committed = commit(saved, packet); saved = committed.world;
    game.acknowledge(committed.result); batches++;
  }
  assert.equal(batches, 3);
  assert.equal(human(game.world).x, 604);
  assert.deepEqual(game.world, saved);
});

test('recovery replays an uncommitted packet with unchanged IDs and random results', () => {
  const original = make(), game = create(original);
  game.resume(1000);
  const gold = game.world.cards.find((card) => card.type === 'gold');
  game.command(move(gold.id, 500, 500, { zone: 'shop', split: false, takeAbove: false }), 1100);
  const pack = game.world.cards.find((card) => card.type === 'pack');
  game.command({ type: 'open-pack', cardId: pack.id }, 1200);
  const packet = game.prepareSave('recover-save-001');
  const backup = JSON.parse(JSON.stringify(game.serialize()));
  const restored = new LocalGame();
  assert.equal(restored.restore(load(original), backup).restored, true);
  assert.deepEqual(restored.world, game.world);
  assert.deepEqual(restored.prepareSave('ignored-new-id'), packet);
  assert.equal(restored.world.randomState, game.world.randomState);
  const restoredAgain = new LocalGame();
  restoredAgain.restore(load(original), JSON.parse(JSON.stringify(restored.serialize())));
  assert.deepEqual(restoredAgain.world, restored.world);
});

test('lost ACK recovery discards the committed prefix and replays only its later suffix', () => {
  const original = make(), game = create(original);
  game.resume(1000);
  game.command(move(human(game.world).id), 1100);
  const packet = game.prepareSave('lost-ack-save-01');
  const committed = commit(original, packet);
  game.command(move(human(game.world).id, 900, 450), 1200);
  const expected = { ...structuredClone(game.world), revision: committed.world.revision };
  const restored = new LocalGame();
  const status = restored.restore(load(committed.world, { lastSave: { id: packet.saveId, revision: committed.world.revision } }), game.serialize());
  assert.equal(status.acknowledged, true);
  assert.equal(restored.pendingCount, 1);
  assert.equal(restored.pendingSave, null);
  assert.deepEqual(restored.world, expected);
});

test('conflicting server versions preserve the recovery payload and never replay stale IDs', () => {
  const original = make(), game = create(original); game.resume(1000);
  game.command(move(human(game.world).id), 1100);
  const recovery = game.serialize();
  const changed = structuredClone(original); changed.revision = 1; human(changed).x = 1000;
  const restored = new LocalGame();
  assert.throws(() => restored.restore(load(changed, { lastSave: { id: 'other-browser-01', revision: 1 } }), recovery), (error) => {
    assert.equal(error.code, 'LOCAL_WORLD_CONFLICT');
    assert.deepEqual(error.recovery, recovery);
    return true;
  });
  assert.equal(restored.world, null);
  assert.equal(human(game.world).x, 650);
  assert.equal(game.pendingCount, 2);
});

test('remote adoption refuses to erase dirty local work', () => {
  const game = create(); game.resume(1000);
  const before = game.serialize();
  assert.throws(() => game.adopt(load(make())), { code: 'LOCAL_WORLD_CONFLICT' });
  assert.deepEqual(game.serialize(), before);
});

test('offline return completes a tree once, retaining partial progress before exhaustion', () => {
  const { world, treeId } = sourceWorld(), game = create(world);
  game.resume(26_000);
  assert.equal(game.world.cards.find((card) => card.id === treeId).remaining, 3);
  assert.equal(game.world.cards.filter((card) => ['wood', 'stick'].includes(card.type)).length, 2);
  game.pause(26_000);
  game.resume(61_000);
  assert.equal(game.world.cards.some((card) => card.id === treeId), false);
  assert.equal(game.world.cards.filter((card) => ['wood', 'stick'].includes(card.type)).length, 5);
  game.pause(61_000); game.resume(500_000);
  assert.equal(game.world.cards.filter((card) => ['wood', 'stick'].includes(card.type)).length, 5);
  const packet = game.prepareSave('tree-offline-01');
  assert.deepEqual(commit(world, packet).world, { ...game.world, revision: 1 });
});

test('a known hidden pause remains a pause after recovery even if the old server lease was longer', () => {
  const world = make(), worker = human(world);
  const rat = addCard(world, 'rat', worker.x + 10, worker.y);
  rat.x = worker.x + 10; rat.y = worker.y;
  reconcile(world, 1000);
  assert.equal(world.combats.length, 1);
  const game = create(world); game.resume(1000); game.pause(1500);
  const hp = human(game.world).hp;
  const restored = new LocalGame();
  restored.restore(load(world, { resumeActiveUntil: 66_000 }), game.serialize());
  restored.resume(100_000);
  assert.equal(human(restored.world).hp, hp);
  assert.equal(restored.active, true);
  restored.advance(102_000);
  assert.ok(human(restored.world).hp < hp);
});

test('a rejected command records neither partial time progression nor RNG consumption', () => {
  const { world } = sourceWorld(), game = create(world); game.resume(1000);
  const before = game.serialize(), state = structuredClone(game.world);
  assert.throws(() => game.command({ type: 'move', cardId: 'missing', x: 500, y: 500 }, 21_000));
  assert.deepEqual(game.world, state);
  assert.deepEqual(game.serialize(), before);
  game.advance(21_000);
  const packet = game.prepareSave('rejected-save-01');
  assert.deepEqual(commit(world, packet).world, { ...game.world, revision: 1 });
});

test('old duplicate ACKs cannot acknowledge a newer packet', () => {
  const original = make(), game = create(original); game.resume(1000);
  const first = game.prepareSave('first-duplicate-1'), one = commit(original, first);
  game.acknowledge(one.result);
  game.command(move(human(game.world).id), 1100);
  const second = game.prepareSave('second-duplicate');
  game.acknowledge(one.result);
  assert.deepEqual(game.pendingSave, second);
  assert.equal(game.pendingCount, 1);
});

test('clock corrections stay monotone and foreign or malformed caches are never applied', () => {
  const game = create(); game.resume(1000);
  game.command(move(human(game.world).id), 900);
  assert.equal(game.world.clock.lastAt, 1000);
  const other = new LocalGame();
  assert.equal(other.restore(load(make('anna')), game.serialize()).restored, false);
  assert.equal(other.world.id, 'anna');
  const bad = game.serialize(); bad.operations[0].kind = 'unknown';
  const invalid = new LocalGame();
  assert.throws(() => invalid.restore(load(make()), bad), { code: 'INVALID_RECOVERY' });
  assert.equal(invalid.world, null);
});

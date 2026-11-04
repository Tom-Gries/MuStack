import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from '@stackfriends/shared/catalog.js';
import { addCard } from '@stackfriends/shared/game.js';
import { createPersonalWorld } from '@stackfriends/shared/personal-world.js';
import { replaySimulationBatch } from '@stackfriends/shared/local-simulation.js';
import { LocalGame } from '../src/lib/local-game.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const makeWorld = () => createPersonalWorld({ id: 'local-chest', name: 'Kistentest' }, getCatalog(), 1000);
const load = (world) => ({ player: { id: world.id }, world: clone(world), resumeActiveUntil: world.clock.lastAt });
function commit(base, packet) {
  const world = clone(base);
  replaySimulationBatch(world, packet.operations, { playerId: world.id });
  world.revision++;
  return { world, ack: { saveId: packet.saveId, revision: world.revision, currentRevision: world.revision } };
}

test('crafted chest inventory survives recovery and a late save ACK retains newer retrievals', () => {
  const base = makeWorld();
  const woods = Array.from({ length: 10 }, () => addCard(base, 'wood', 600, 400));
  const stones = [addCard(base, 'stone', 1000, 700), addCard(base, 'stone', 1000, 700)];
  const berry = addCard(base, 'berry', 1000, 700);
  for (const [order, card] of [stones[0], berry, stones[1]].entries()) {
    Object.assign(card, { stackId: stones[0].id, order, x: 1000, y: 700 });
  }
  const game = new LocalGame(); game.adopt(load(base)); game.resume(1000);
  for (const [index, wood] of woods.slice(1).entries()) {
    game.command({ type: 'move', cardId: wood.id, targetId: woods[0].id, x: 600, y: 400, split: true, takeAbove: true }, 1001 + index);
  }
  const craft = game.world.jobs.find((job) => job.recipeId === 'chest');
  assert.ok(craft);
  assert.equal(craft.duration, 10_000);
  const craftAt = game.world.clock.lastAt + craft.dueAt - game.world.clock.elapsed;
  game.advance(craftAt - 1);
  assert.equal(game.world.cards.filter((card) => card.type === 'wood').length, 10);
  game.advance(craftAt);
  const chest = game.world.cards.find((card) => card.type === 'chest');
  assert.ok(chest);
  assert.equal(game.world.cards.some((card) => woods.some((wood) => wood.id === card.id)), false);
  const at = game.world.clock.lastAt + 1;
  game.command({ type: 'store', cardId: chest.id, itemId: stones[0].id, split: true, takeAbove: true }, at);
  assert.deepEqual(game.world.cards.find((card) => card.id === chest.id).contents.map((card) => card.id), [stones[0].id, berry.id, stones[1].id]);
  assert.equal(game.world.cards.some((card) => [...stones, berry].some((stored) => stored.id === card.id)), false);
  const packet = game.prepareSave('chest-storage-save-01');
  assert.equal(packet.catalogContentVersion, getCatalog(game.baseWorld).contentVersion);

  const restored = new LocalGame();
  assert.equal(restored.restore(load(base), clone(game.serialize())).restored, true);
  assert.deepEqual(restored.world, game.world);
  assert.deepEqual(restored.prepareSave('ignored-frozen-save'), packet);
  restored.command({ type: 'retrieve', cardId: chest.id, itemId: stones[1].id, allOfType: true, x: 200, y: 300 }, at + 1);
  const newest = clone(restored.world);
  const saved = commit(base, packet);
  assert.equal(saved.world.cards.find((card) => card.id === chest.id).contents.length, 3);
  restored.acknowledge(saved.ack);
  assert.equal(restored.pendingCount, 1);
  assert.deepEqual(restored.world, { ...newest, revision: saved.world.revision });
  assert.deepEqual(restored.world.cards.find((card) => card.id === chest.id).contents.map((card) => card.id), [berry.id]);
  const retrieved = stones.map((stone) => restored.world.cards.find((card) => card.id === stone.id));
  assert.deepEqual(retrieved.map((card) => card.order), [0, 1]);
  assert.equal(retrieved[0].stackId, retrieved[1].stackId);
  assert.equal(retrieved[0].x, 200);
  assert.equal(retrieved[0].y, 300);

  const recoveredSuffix = new LocalGame();
  recoveredSuffix.restore(load(saved.world), clone(restored.serialize()));
  assert.deepEqual(recoveredSuffix.world, restored.world);
  const remaining = recoveredSuffix.prepareSave('chest-retrieval-save-02');
  assert.equal(remaining.operations.length, 1);
  assert.equal(remaining.catalogContentVersion, getCatalog(saved.world).contentVersion);
  const final = commit(saved.world, remaining);
  recoveredSuffix.acknowledge(final.ack);
  assert.deepEqual(recoveredSuffix.world, final.world);
  assert.equal(recoveredSuffix.isDirty, false);
});

test('recovery retries an older pending packet verbatim instead of upgrading its catalog version', () => {
  const base = makeWorld();
  base.catalog.contentVersion = 3;
  delete base.catalog.cardTypes.chest;
  base.catalog.recipes = base.catalog.recipes.filter((recipe) => recipe.id !== 'chest');
  const game = new LocalGame(); game.adopt(load(base)); game.resume(1000);
  game.prepareSave('old-catalog-save-01');
  for (const legacyVersion of [undefined, 3]) {
    const recovery = clone(game.serialize());
    if (legacyVersion === undefined) delete recovery.pendingSave.catalogContentVersion;
    else recovery.pendingSave.catalogContentVersion = legacyVersion;
    const expected = clone(recovery.pendingSave);
    const restored = new LocalGame();
    assert.equal(restored.restore(load(base), recovery).restored, true);
    assert.deepEqual(restored.prepareSave('ignored-new-save-id'), expected);
    assert.deepEqual(restored.pendingSave, expected);
    assert.deepEqual(restored.serialize().pendingSave, expected);
  }
});

test('a changed catalog at the same world revision keeps recovery intact and requires conflict resolution', () => {
  const base = makeWorld(), chest = addCard(base, 'chest', 1000, 700), wood = addCard(base, 'wood', 700, 500);
  const game = new LocalGame(); game.adopt(load(base)); game.resume(1000);
  game.command({ type: 'store', cardId: chest.id, itemId: wood.id, split: true }, 1001);
  game.prepareSave('catalog-conflict-save');
  const recovery = clone(game.serialize());
  const changed = clone(base);
  changed.catalog.contentVersion++;
  changed.catalog.cardTypes.wood.name = 'Neues Bauholz';
  const restored = new LocalGame();
  assert.throws(() => restored.restore(load(changed), recovery), (error) => {
    assert.equal(error.code, 'LOCAL_WORLD_CONFLICT');
    assert.equal(error.status, 409);
    assert.deepEqual(error.recovery, recovery);
    return true;
  });
  assert.equal(restored.world, null);
  assert.deepEqual(game.serialize(), recovery);
  assert.equal(game.world.cards.find((card) => card.id === chest.id).contents[0].id, wood.id);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from '@stackfriends/shared/catalog.js';
import { addCard, reconcile } from '@stackfriends/shared/game.js';
import { createPersonalWorld } from '@stackfriends/shared/personal-world.js';
import { replaySimulationBatch } from '@stackfriends/shared/local-simulation.js';
import { LocalGame } from '../src/lib/local-game.js';
import { createBarrierRecovery } from '../src/lib/barrier-recovery.js';

const copy = (value) => structuredClone(value);
const human = (world) => world.cards.find((card) => card.type === 'human');
const load = (world, extra = {}) => ({ world: copy(world), player: { id: world.id }, resumeActiveUntil: world.clock.lastAt, ...extra });
const phases = [{ active: false, at: 1000 }, { active: true, at: 5000 }, { active: false, at: 6000 }];
function create() {
  const world = createPersonalWorld({ id: 'barrier', name: 'Barrier' }, getCatalog(), 0);
  const worker = human(world);
  addCard(world, 'rat', worker.x + 10, worker.y, { stackId: 'rat', order: 0 });
  reconcile(world, 0);
  const game = new LocalGame();
  game.adopt(load(world)); game.resume(0); game.advance(0);
  return { world, game };
}
function livePhases(game, sequence) {
  game.resume(game.world.clock.lastAt, game.world.clock.lastAt);
  for (const phase of sequence) {
    if (phase.active) game.resume(phase.at);
    else if (game.active) game.pause(phase.at);
  }
}

test('without visibility phases the existing recovery payload is reused untouched', () => {
  const { game } = create(), recovery = game.serialize();
  assert.equal(createBarrierRecovery(recovery, { active: true }, []), recovery);
  assert.equal(createBarrierRecovery(null, { active: true }, phases), null);
});

test('recovery retains every hidden interval during a slow RPC instead of extra combat', () => {
  const { world, game } = create(), initial = game.serialize();
  const saved = createBarrierRecovery(initial, { active: true }, phases);
  const returned = new LocalGame(); returned.restore(load(world), saved); returned.resume(10_000);
  const live = new LocalGame(); live.restore(load(world), initial); livePhases(live, phases); live.resume(10_000);
  assert.deepEqual(returned.world, live.world);
  assert.equal(human(returned.world).hp, 74);
  assert.equal(returned.world.cards.filter((card) => card.type === 'rat').length, 1);
  assert.deepEqual(game.serialize(), initial);
});

test('each repeated snapshot materializes phases once without changing RNG or live input', () => {
  const { world, game } = create(), recovery = game.serialize(), beforePhases = copy(phases);
  for (let length = 1; length <= phases.length; length++) {
    const sequence = phases.slice(0, length);
    const once = createBarrierRecovery(recovery, { active: true }, sequence);
    const again = createBarrierRecovery(recovery, { active: true }, sequence);
    assert.deepEqual(again, once);
    assert.equal(once.operations.length, recovery.operations.length + 1 + length);
    const restored = new LocalGame(); restored.restore(load(world), once);
    const live = new LocalGame(); live.restore(load(world), recovery); livePhases(live, sequence);
    assert.deepEqual(restored.world, live.world);
    assert.equal(restored.world.randomState, live.world.randomState);
    assert.deepEqual(game.serialize(), recovery);
  }
  assert.deepEqual(phases, beforePhases);
});

test('a frozen save prefix stays retryable while visibility phases remain in its suffix', () => {
  const { world, game } = create();
  const packet = game.prepareSave('barrier-save-001');
  const recovery = game.serialize();
  const saved = createBarrierRecovery(recovery, { active: true }, phases);
  assert.deepEqual(saved.pendingSave, packet);
  assert.deepEqual(saved.operations.slice(0, packet.operations.length), packet.operations);
  const server = copy(world); replaySimulationBatch(server, packet.operations); server.revision++;
  const restored = new LocalGame();
  restored.restore(load(server, { lastSave: { id: packet.saveId, revision: server.revision } }), saved);
  assert.equal(restored.pendingSave, null);
  assert.equal(restored.pendingCount, saved.operations.length - packet.operations.length);
  restored.resume(10_000);
  assert.equal(human(restored.world).hp, 74);
  assert.equal(restored.world.cards.filter((card) => card.type === 'rat').length, 1);
  assert.deepEqual(game.serialize(), recovery);
});

test('an adopted inactive RPC response still restores an originally active barrier', () => {
  const { world } = create(), adopted = new LocalGame();
  adopted.adopt(load(world));
  assert.equal(adopted.active, false);
  const recovery = createBarrierRecovery(adopted.serialize(), { active: true }, phases);
  const restored = new LocalGame(); restored.restore(load(world), recovery); restored.resume(10_000);
  assert.equal(human(restored.world).hp, 74);
  assert.equal(restored.world.cards.filter((card) => card.type === 'rat').length, 1);
});

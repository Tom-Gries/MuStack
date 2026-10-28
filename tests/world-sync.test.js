import test from 'node:test';
import assert from 'node:assert/strict';
import { newestWorld, applyWorldPatch } from '../src/lib/world-sync.js';

test('a delayed full snapshot cannot undo a newer patch', () => {
  const initial = { revision: 2, cards: [{ id: 'human', x: 10 }] };
  const current = applyWorldPatch(initial, { baseRevision: 2, revision: 3, upsert: [{ id: 'human', x: 50 }] });
  const afterDelayedSnapshot = newestWorld(current, structuredClone(initial));
  assert.equal(afterDelayedSnapshot.revision, 3);
  assert.equal(afterDelayedSnapshot.cards[0].x, 50);
  assert.equal(newestWorld(null, initial), initial);
});

test('duplicates and reordered old patches do not trigger a full resync', () => {
  const world = { revision: 4, cards: [{ id: 'a' }, { id: 'b' }], jobs: [] };
  assert.equal(applyWorldPatch(world, { baseRevision: 2, revision: 3 }), world);
  assert.equal(applyWorldPatch(world, { baseRevision: 3, revision: 4 }), world);
  assert.equal(applyWorldPatch(world, { baseRevision: 5, revision: 6 }), null);
  assert.equal(applyWorldPatch(null, { baseRevision: 4, revision: 5 }), null);
  const next = applyWorldPatch(world, { baseRevision: 4, revision: 5, remove: ['b'], upsert: [{ id: 'a', hp: 74 }, { id: 'c' }], changes: { jobs: [{ id: 'work' }] } });
  assert.deepEqual(next.cards, [{ id: 'a', hp: 74 }, { id: 'c' }]);
  assert.deepEqual(next.jobs, [{ id: 'work' }]);
  assert.equal(next.revision, 5);
  assert.equal(world.cards.length, 2);
});

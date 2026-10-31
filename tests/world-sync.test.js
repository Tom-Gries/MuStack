import test from 'node:test';
import assert from 'node:assert/strict';
import { newestWorld } from '../src/lib/world-sync.js';

test('delayed snapshots cannot undo a newer revision of the same world', () => {
  const current = { id: 'tom', revision: 4, cards: [{ id: 'a', x: 50 }] };
  assert.equal(newestWorld(current, { id: 'tom', revision: 3 }), current);
  assert.equal(newestWorld(current, null), current);
  assert.equal(newestWorld(null, current), current);
});

test('switching players accepts a fresh world even when its revision is lower', () => {
  const previous = { id: 'tom', revision: 12 };
  const next = { id: 'anna', revision: 1 };
  assert.equal(newestWorld(previous, next), next);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPersistenceRequest } from '../src/lib/local-persistence.js';

test('dirty play saves once a minute regardless of combat and creature deadlines', () => {
  assert.deepEqual(nextPersistenceRequest({ now: 12_000, lastContact: 0, dirty: true, pendingCount: 20 }), { kind: 'save', delay: 48_000 });
});
test('an idle player sends only a small presence heartbeat', () => {
  assert.deepEqual(nextPersistenceRequest({ now: 12_000, lastContact: 0 }), { kind: 'presence', delay: 48_000 });
});
test('large journals flush in a batch and network failures back off', () => {
  assert.deepEqual(nextPersistenceRequest({ now: 12_000, lastContact: 0, dirty: true, pendingCount: 500 }), { kind: 'save', delay: 250 });
  assert.equal(nextPersistenceRequest({ now: 12_000, lastContact: 0, dirty: true, pendingCount: 500, retryAt: 25_000 }).delay, 13_000);
});

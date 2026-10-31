import test from 'node:test';
import assert from 'node:assert/strict';
import { newlyOnlinePlayers, nextBackgroundRequest } from '../src/lib/personal-sync.js';

test('an idle solo world renews presence without requesting a world update', () => {
  assert.deepEqual(nextBackgroundRequest({ now: 10_000, lastSync: 0, lastPresence: 0 }), { kind: 'presence', delay: 50_000 });
});

test('other online players enable the minute gift/update check', () => {
  assert.deepEqual(nextBackgroundRequest({ now: 10_000, lastSync: 0, lastPresence: 5_000, hasOthers: true }), { kind: 'sync', delay: 50_000 });
});

test('a solo game still resolves its own work and combat deadlines', () => {
  assert.deepEqual(nextBackgroundRequest({ now: 10_000, lastSync: 0, lastPresence: 0, gameDeadline: 12_000 }), { kind: 'sync', delay: 2_000 });
});

test('failed requests back off and elapsed deadlines never spin synchronously', () => {
  assert.equal(nextBackgroundRequest({ now: 20_000, lastSync: 0, lastPresence: 0, gameDeadline: 19_000, retryAt: 35_000 }).delay, 15_000);
  assert.equal(nextBackgroundRequest({ now: 20_000, lastSync: 0, lastPresence: 0, gameDeadline: 19_000 }).delay, 250);
});

test('announced gifts are collected even if their sender is already offline', () => {
  assert.deepEqual(nextBackgroundRequest({ now: 10_000, lastSync: 0, lastPresence: 10_000, hasPendingGifts: true }), { kind: 'sync', delay: 250 });
});

test('online messages need a town hall, an open game and a newly online other player', () => {
  const previous = new Set(['old']);
  const incoming = [{ id: 'self' }, { id: 'old' }, { id: 'new' }];
  const options = { playerId: 'self', hasTownHall: true, visible: true };
  assert.deepEqual(newlyOnlinePlayers(previous, incoming, options), [{ id: 'new' }]);
  assert.deepEqual(newlyOnlinePlayers(previous, incoming, { ...options, hasTownHall: false }), []);
  assert.deepEqual(newlyOnlinePlayers(previous, incoming, { ...options, visible: false }), []);
  assert.deepEqual(newlyOnlinePlayers(null, incoming, options), []);
});

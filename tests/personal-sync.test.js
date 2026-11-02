import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundSyncDue, createSyncCoordinator, newlyOnlinePlayers, nextBackgroundRequest } from '../src/lib/personal-sync.js';

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

test('background sync remains due for actual job deadlines, gifts and other-player checks', () => {
  const state = { now: 60_000, lastSync: 0 };
  assert.equal(backgroundSyncDue(state), false);
  assert.equal(backgroundSyncDue({ ...state, hasOthers: true }), true);
  assert.equal(backgroundSyncDue({ ...state, hasPendingGifts: true }), true);
  assert.equal(backgroundSyncDue({ ...state, gameDeadline: 60_000 }), true);
  assert.equal(backgroundSyncDue({ ...state, gameDeadline: 60_001 }), false);
  assert.equal(backgroundSyncDue({ ...state, hasOthers: true, lastSync: 1 }), false);
});

test('concurrent sync requests share one pending operation', async () => {
  let release, calls = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const sync = createSyncCoordinator(async (shouldRequest) => { await gate; if (shouldRequest()) calls++; return 'done'; }, () => true);
  const first = sync({ background: true });
  const second = sync({ background: true });
  assert.equal(first, second);
  release();
  assert.deepEqual(await Promise.all([first, second]), ['done', 'done']);
  assert.equal(calls, 1);
});

test('a queued background request skips an event already completed by an earlier command', async () => {
  let release, due = true, calls = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const sync = createSyncCoordinator(async (shouldRequest) => { await gate; if (shouldRequest()) calls++; }, () => due);
  const pending = sync({ background: true });
  // The command response accepted before this queued operation updates the next deadline.
  due = false;
  release();
  await pending;
  assert.equal(calls, 0);
});

test('an explicit refresh promotes a waiting background check to a required request', async () => {
  let release, calls = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const sync = createSyncCoordinator(async (shouldRequest) => { await gate; if (shouldRequest()) calls++; }, () => false);
  const background = sync({ background: true });
  const refresh = sync();
  assert.equal(background, refresh);
  release();
  await refresh;
  assert.equal(calls, 1);
});

test('a failed sync releases the coordinator for a later retry', async () => {
  let calls = 0;
  const sync = createSyncCoordinator(async () => { if (++calls === 1) throw new Error('temporary'); return 'retried'; }, () => true);
  await assert.rejects(sync(), /temporary/);
  assert.equal(await sync(), 'retried');
  assert.equal(calls, 2);
});

test('a resumed tab does not share the older hidden-tab activation request', async () => {
  let epoch = 1, calls = 0, release;
  const gate = new Promise((resolve) => { release = resolve; });
  const sync = createSyncCoordinator(async (shouldRequest) => { await gate; if (shouldRequest()) calls++; }, () => true, () => epoch);
  const hidden = sync();
  epoch = 2;
  const resumed = sync();
  assert.notEqual(hidden, resumed);
  release();
  await Promise.all([hidden, resumed]);
  assert.equal(calls, 2);
});

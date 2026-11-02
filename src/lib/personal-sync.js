export const SYNC_INTERVAL_MS = 60_000;

/** A solo idle world only renews presence; actual game deadlines still advance. */
export function nextBackgroundRequest({ now, lastSync, lastPresence, gameDeadline = null, hasOthers = false, hasPendingGifts = false, interval = SYNC_INTERVAL_MS, retryAt = 0 }) {
  const presenceAt = lastPresence + interval;
  const syncAt = Math.min(hasOthers ? lastSync + SYNC_INTERVAL_MS : Infinity, hasPendingGifts ? now : Infinity, gameDeadline ?? Infinity);
  const kind = syncAt <= presenceAt ? 'sync' : 'presence';
  return { kind, delay: Math.max(250, Math.max(Math.min(syncAt, presenceAt), retryAt) - now) };
}

export function newlyOnlinePlayers(previous, incoming, { playerId, hasTownHall, visible }) {
  if (!previous || !hasTownHall || !visible) return [];
  return incoming.filter((person) => person.id !== playerId && !previous.has(person.id));
}

/** Recheck after earlier commands have advanced the authoritative world. */
export function backgroundSyncDue({ now, lastSync, gameDeadline = null, hasOthers = false, hasPendingGifts = false }) {
  return hasPendingGifts || hasOthers && now >= lastSync + SYNC_INTERVAL_MS || gameDeadline !== null && gameDeadline <= now;
}

/** A manual refresh can promote a queued background request before it starts. */
export function createSyncCoordinator(run, isDue, contextKey = () => 0) {
  const pending = new Map();
  return function sync({ background = false } = {}) {
    const key = contextKey();
    const existing = pending.get(key);
    if (existing) {
      if (!background) existing.force = true;
      return existing.promise;
    }
    const group = { force: !background };
    group.promise = Promise.resolve().then(() => run(() => group.force || isDue())).finally(() => { pending.delete(key); });
    pending.set(key, group);
    return group.promise;
  };
}

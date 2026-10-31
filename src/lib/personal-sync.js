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

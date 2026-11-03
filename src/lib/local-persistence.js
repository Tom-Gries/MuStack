export const SAVE_INTERVAL_MS = 60_000;

/** Game deadlines belong to the local timer, never to HTTP scheduling. */
export function nextPersistenceRequest({ now, lastContact, retryAt = 0, dirty = false, pendingCount = 0 }) {
  const dueAt = pendingCount >= 500 ? now : lastContact + SAVE_INTERVAL_MS;
  return { kind: dirty ? 'save' : 'presence', delay: Math.max(250, Math.max(dueAt, retryAt) - now) };
}

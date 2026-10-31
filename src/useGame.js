import { useCallback, useEffect, useRef, useState } from 'react';
import { nextWakeAt } from '@stackfriends/shared/game.js';
import { newestWorld } from './lib/world-sync.js';
import { newlyOnlinePlayers, nextBackgroundRequest } from './lib/personal-sync.js';

async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', signal: AbortSignal.timeout(15_000), ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.message || (typeof result.error === 'string' ? result.error : null) || 'Der Spielstand konnte gerade nicht abgeglichen werden.'), { status: response.status });
  return result;
}

function tabId() {
  try {
    const key = 'stackfriends-client';
    const value = sessionStorage.getItem(key) || crypto.randomUUID();
    sessionStorage.setItem(key, value);
    return value;
  } catch { return crypto.randomUUID(); }
}

export function useGame() {
  const [world, setWorld] = useState(null);
  const [player, setPlayer] = useState(null);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [hasOtherPlayersOnline, setHasOthers] = useState(false);
  const [hasPendingGifts, setHasPendingGifts] = useState(false);
  const [mode, setMode] = useState('local');
  const [status, setStatus] = useState('loading');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [toasts, setToasts] = useState([]);
  const clientId = useRef(null);
  if (!clientId.current) clientId.current = tabId();
  const clientEpoch = useRef(Date.now());
  const offset = useRef(0);
  const worldRef = useRef(null);
  const queue = useRef(Promise.resolve());
  const mounted = useRef(true);
  const toastTimers = useRef(new Set());
  const timing = useRef({ lastSync: Date.now(), lastPresence: Date.now(), retryAt: 0, interval: 60_000 });
  const previousOnline = useRef(null);
  const notify = useCallback((message, kind = 'info') => {
    if (!message || !mounted.current) return;
    const id = crypto.randomUUID();
    setToasts((items) => [...items.slice(-2), { id, message, kind }]);
    const timer = setTimeout(() => { setToasts((items) => items.filter((item) => item.id !== id)); toastTimers.current.delete(timer); }, 4500);
    toastTimers.current.add(timer);
  }, []);
  const acceptResult = useCallback((result, kind = 'sync') => {
    if (!mounted.current) return;
    if (result.serverTime) offset.current = result.serverTime - Date.now();
    if (Object.hasOwn(result, 'world')) {
      const next = newestWorld(worldRef.current, result.world);
      if (next !== worldRef.current) { worldRef.current = next; setWorld(next); }
      if (result.world) setLastSavedAt(result.savedAt || result.lastSavedAt || result.serverTime || Date.now());
    }
    if (Object.hasOwn(result, 'player')) setPlayer((current) => current?.id === result.player?.id && result.player ? { ...current, ...result.player } : result.player);
    if (result.mode) setMode(result.mode);
    if (Object.hasOwn(result, 'hasOtherPlayersOnline')) setHasOthers(result.hasOtherPlayersOnline);
    setHasPendingGifts(Boolean(result.hasPendingGifts));
    if (Array.isArray(result.onlinePlayers)) {
      const hasTownHall = worldRef.current?.cards.some((card) => card.type === 'town_hall');
      for (const person of newlyOnlinePlayers(previousOnline.current, result.onlinePlayers, { playerId: worldRef.current?.id, hasTownHall, visible: document.visibilityState !== 'hidden' })) notify(`${person.name} ist jetzt online.`);
      previousOnline.current = new Set(result.onlinePlayers.map((person) => person.id));
      setOnlinePlayers(result.onlinePlayers);
    }
    for (const message of result.giftMessages || []) notify(typeof message === 'string' ? message : message.message);
    timing.current.lastPresence = Date.now();
    if (kind !== 'presence') timing.current.lastSync = Date.now();
    timing.current.interval = result.presenceIntervalMs || timing.current.interval;
    timing.current.retryAt = 0;
    setError(''); setSaveStatus('saved');
    if (worldRef.current) setStatus('connected');
    setScheduleVersion((value) => value + 1);
  }, [notify]);
  const enqueue = useCallback((operation) => {
    const task = queue.current.then(operation, operation);
    queue.current = task.catch(() => {});
    return task;
  }, []);
  const post = useCallback((path, body, { kind = 'sync', idempotent = false } = {}) => enqueue(async () => {
    if (mounted.current && kind !== 'presence') setSaveStatus('saving');
    try {
      let result;
      const payload = JSON.stringify({ ...body, clientId: clientId.current, clientEpoch: clientEpoch.current, active: document.visibilityState !== 'hidden' });
      try { result = await request(path, { method: 'POST', body: payload }); }
      catch (err) {
        if (!idempotent || err.status && err.status < 500) throw err;
        // Retry the same operation ID: an already committed gift/action is never applied twice.
        result = await request(path, { method: 'POST', body: payload });
      }
      acceptResult(result, kind);
      return result;
    } catch (err) {
      timing.current.retryAt = Date.now() + 15_000;
      if (mounted.current) { setError(err.message); setSaveStatus('error'); setScheduleVersion((value) => value + 1); }
      throw err;
    }
  }), [acceptResult, enqueue]);
  const sync = useCallback(() => post('/api/sync', { active: document.visibilityState !== 'hidden' }), [post]);
  const load = useCallback(async () => {
    setStatus('loading'); setError('');
    try {
      const result = await request('/api/session');
      acceptResult(result);
      setStatus(result.player ? 'connected' : 'welcome');
    } catch (err) { setError(err.message); setStatus('error'); }
    finally { setLoaded(true); }
  }, [acceptResult]);
  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; for (const timer of toastTimers.current) clearTimeout(timer); };
  }, [load]);
  useEffect(() => {
    if (!player?.id) return;
    const pause = () => {
      if (navigator.onLine === false) return;
      clientEpoch.current++;
      fetch('/api/sync', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false, clientId: clientId.current, clientEpoch: clientEpoch.current }) }).catch(() => {});
    };
    const visibility = () => {
      clientEpoch.current++;
      setScheduleVersion((value) => value + 1);
      sync().catch(() => {});
    };
    const online = () => { sync().catch(() => {}); };
    const offline = () => { setStatus('offline'); setSaveStatus('error'); setError('Du bist offline. Der gespeicherte Stand bleibt erhalten.'); setScheduleVersion((value) => value + 1); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pause);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    if (document.visibilityState !== 'hidden') sync().catch(() => {});
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [player?.id, sync]);
  useEffect(() => {
    if (!player?.id || !world || document.visibilityState === 'hidden' || navigator.onLine === false) return;
    const now = Date.now();
    const deadline = nextWakeAt(world, now + offset.current);
    const next = nextBackgroundRequest({ now, ...timing.current, hasOthers: hasOtherPlayersOnline, hasPendingGifts, gameDeadline: deadline === null ? null : deadline - offset.current });
    const timer = setTimeout(() => {
      (next.kind === 'sync' ? sync() : post('/api/presence', { active: true }, { kind: 'presence' })).catch(() => {});
    }, next.delay);
    return () => clearTimeout(timer);
  }, [player?.id, world, hasOtherPlayersOnline, hasPendingGifts, post, sync, scheduleVersion]);
  const join = useCallback(async (name) => {
    const result = await post('/api/join', { name });
    setStatus('connected');
    return result;
  }, [post]);
  const command = useCallback((value) => post('/api/command', { command: value, commandId: crypto.randomUUID() }, { idempotent: true }), [post]);
  const sendGift = useCallback((recipientId, selection) => post('/api/gift', { recipientId, ...selection, commandId: crypto.randomUUID() }, { idempotent: true }), [post]);
  const listPlayers = useCallback(() => request('/api/players'), []);
  const inspectPlayer = useCallback((playerId) => request('/api/materials', { method: 'POST', body: JSON.stringify({ playerId }) }), []);
  const noop = useCallback(() => false, []);
  return { world, worldRef, player, online: onlinePlayers, onlinePlayers, hasOtherPlayersOnline, mode, status, loaded, error, saveStatus, lastSavedAt, previews: {}, locks: {}, toasts, offset, join, command, sendGift, listPlayers, inspectPlayer, refresh: sync, sync, send: noop, dragPreview: noop, notify, reload: load };
}

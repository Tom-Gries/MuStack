import { useCallback, useEffect, useRef, useState } from 'react';
import { newestWorld, applyWorldPatch } from './lib/world-sync.js';
import { createGameConnection } from './lib/game-connection.js';
export { socketTicketOptions } from './lib/game-connection.js';

async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || 'Die Verbindung zur Welt ist gerade nicht möglich.');
  return result;
}

export function useGame() {
  const [world, setWorld] = useState(null);
  const [player, setPlayer] = useState(null);
  const [online, setOnline] = useState([]);
  const [mode, setMode] = useState('local');
  const [status, setStatus] = useState('loading');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState({});
  const [locks, setLocks] = useState({});
  const [toasts, setToasts] = useState([]);
  const socket = useRef(null);
  const pending = useRef(new Map());
  const offset = useRef(0);
  const worldRef = useRef(null);
  const lastDrag = useRef(0);
  const toastTimers = useRef(new Set());
  const notify = useCallback((message, kind = 'info') => {
    if (!message) return;
    const id = crypto.randomUUID();
    setToasts((items) => [...items.slice(-2), { id, message, kind }]);
    const timer = setTimeout(() => { setToasts((items) => items.filter((item) => item.id !== id)); toastTimers.current.delete(timer); }, 4500);
    toastTimers.current.add(timer);
  }, []);
  const acceptWorld = useCallback((next) => {
    const accepted = newestWorld(worldRef.current, next);
    if (!accepted || accepted === worldRef.current) return;
    worldRef.current = accepted;
    setWorld(accepted);
  }, []);
  const load = useCallback(async () => {
    setStatus('loading'); setError('');
    try {
      const result = await request('/api/session');
      acceptWorld(result.world); setPlayer(result.player || null); setMode(result.mode || 'local');
      setStatus(result.player ? 'connecting' : 'welcome');
    } catch (err) { setError(err.message); setStatus('error'); }
    finally { setLoaded(true); }
  }, [acceptWorld]);
  useEffect(() => { load(); return () => { for (const timer of toastTimers.current) clearTimeout(timer); }; }, [load]);

  useEffect(() => {
    if (!player?.id) return;
    function rejectPending() {
      for (const [id, callback] of pending.current) { clearTimeout(callback.timeout); callback.reject(new Error('Die Verbindung wurde unterbrochen. Bitte erneut versuchen.')); pending.current.delete(id); }
    }
    const connection = createGameConnection({
      requestTicket: (signal) => request('/api/socket-ticket', { method: 'POST', body: '{}', signal }),
      onSocket: (ws) => { socket.current = ws; },
      onStatus: setStatus,
      onError: setError,
      onDisconnect: () => { setLocks({}); setPreviews({}); rejectPending(); },
      onEvent: (event, ws) => {
        if (event.serverTime) offset.current = event.serverTime - Date.now();
        if (event.online) setOnline(event.online);
        if (event.mode) setMode(event.mode);
        if (event.type === 'state') {
          acceptWorld(event.world);
          setError('');
        }
        if (event.type === 'patch') {
          const next = applyWorldPatch(worldRef.current, event);
          if (!next) { ws.send(JSON.stringify({ type: 'resync' })); return; }
          acceptWorld(next);
        }
        if (event.type === 'lock') {
          setLocks((old) => event.playerId ? { ...old, [event.cardId]: event } : Object.fromEntries(Object.entries(old).filter(([id]) => id !== event.cardId)));
        }
        if (event.type === 'drag') setPreviews((old) => ({ ...old, [event.cardId]: { ...event, receivedAt: Date.now() } }));
        if (event.type === 'drag-end') {
          setPreviews((old) => Object.fromEntries(Object.entries(old).filter(([id]) => id !== event.cardId)));
          setLocks((old) => Object.fromEntries(Object.entries(old).filter(([id]) => id !== event.cardId)));
        }
        if (event.type === 'ack') {
          const callback = pending.current.get(event.commandId);
          if (callback) { clearTimeout(callback.timeout); callback.resolve(event); pending.current.delete(event.commandId); }
        }
        if (event.type === 'error') {
          const callback = pending.current.get(event.commandId);
          if (callback) { clearTimeout(callback.timeout); callback.reject(new Error(event.message)); pending.current.delete(event.commandId); }
          else notify(event.message, 'error');
        }
      },
    });
    connection.start();
    return () => connection.stop();
  }, [player?.id, acceptWorld, notify]);

  const join = useCallback(async (name) => {
    const result = await request('/api/join', { method: 'POST', body: JSON.stringify({ name }) });
    acceptWorld(result.world); setPlayer(result.player); setMode(result.mode || 'local');
    return result;
  }, [acceptWorld]);
  const send = useCallback((event) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify(event)); return true;
  }, []);
  const command = useCallback(async (value) => {
    const commandId = crypto.randomUUID();
    if (socket.current?.readyState !== WebSocket.OPEN) throw new Error('Warte kurz, bis die Verbindung wieder steht.');
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { pending.current.delete(commandId); reject(new Error('Keine Bestätigung erhalten. Die Welt wird erneut abgeglichen.')); send({ type: 'resync' }); }, 12000);
      pending.current.set(commandId, { resolve, reject, timeout });
      send({ type: 'command', commandId, command: value });
    });
  }, [send]);
  const dragPreview = useCallback((value) => {
    const now = performance.now();
    if (now - lastDrag.current < 105) return;
    lastDrag.current = now; send({ type: 'drag', ...value });
  }, [send]);
  return { world, worldRef, player, online, mode, status, loaded, error, previews, locks, toasts, offset, join, command, send, dragPreview, notify, reload: load };
}

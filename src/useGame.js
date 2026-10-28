import { useCallback, useEffect, useRef, useState } from 'react';
import { newestWorld, applyWorldPatch } from './lib/world-sync.js';

async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || 'Die Verbindung zur Welt ist gerade nicht möglich.');
  return result;
}

export function socketTicketOptions(result, pageProtocol = location.protocol) {
  const url = new URL(result.socketUrl);
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(result.ticket || '') || url.username || url.password || url.pathname !== '/api/socket' || url.search || url.hash
    || !(url.protocol === 'wss:' || url.protocol === 'ws:' && pageProtocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Die Echtzeitverbindung konnte nicht vorbereitet werden.');
  return { url: url.href, protocols: ['stackfriends', `ticket.${result.ticket}`] };
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
  const playerRef = useRef(null);
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
  useEffect(() => { playerRef.current = player; }, [player]);

  useEffect(() => {
    if (!player?.id) return;
    let stopped = false;
    let reconnectTimer;
    let ticketRequest;
    let connectionAttempt = 0;
    let attempt = 0;
    function reconnect() {
      if (stopped) return;
      setStatus('reconnecting');
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, Math.min(15000, 700 * 2 ** attempt++) + Math.random() * 500);
    }
    function rejectPending() {
      for (const [id, callback] of pending.current) { clearTimeout(callback.timeout); callback.reject(new Error('Die Verbindung wurde unterbrochen. Bitte erneut versuchen.')); pending.current.delete(id); }
    }
    async function connect() {
      if (stopped) return;
      const currentAttempt = ++connectionAttempt;
      setStatus('connecting');
      const controller = new AbortController();
      ticketRequest = controller;
      const ticketTimeout = setTimeout(() => controller.abort(), 12000);
      let ws;
      try {
        const ticket = await request('/api/socket-ticket', { method: 'POST', body: '{}', signal: controller.signal });
        if (stopped || currentAttempt !== connectionAttempt) return;
        const options = socketTicketOptions(ticket);
        ws = new WebSocket(options.url, options.protocols);
      } catch (err) {
        if (!stopped && currentAttempt === connectionAttempt) { setError(err.name === 'AbortError' ? 'Die Echtzeitverbindung ist gerade nicht erreichbar.' : err.message); reconnect(); }
        return;
      } finally { clearTimeout(ticketTimeout); if (ticketRequest === controller) ticketRequest = null; }
      socket.current = ws;
      ws.onopen = () => {
        if (stopped || socket.current !== ws) return ws.close();
        // Browsers answer the server's WebSocket control pings automatically.
        // A second JSON heartbeat would duplicate presence writes in Redis.
      };
      ws.onmessage = ({ data }) => {
        if (stopped || socket.current !== ws) return;
        let event;
        try { event = JSON.parse(data); } catch { return; }
        if (event.serverTime) offset.current = event.serverTime - Date.now();
        if (event.online) setOnline(event.online);
        if (event.mode) setMode(event.mode);
        if (event.type === 'state') {
          acceptWorld(event.world);
          attempt = 0; setStatus('connected'); setError('');
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
      };
      ws.onclose = () => {
        const current = socket.current === ws;
        if (current) socket.current = null;
        if (stopped || !current) return;
        setLocks({}); setPreviews({});
        rejectPending(); reconnect();
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { stopped = true; connectionAttempt++; ticketRequest?.abort(); clearTimeout(reconnectTimer); rejectPending(); socket.current?.close(); };
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { nextWakeAt } from '@stackfriends/shared/game.js';
import { LocalGame } from './lib/local-game.js';
import { nextPersistenceRequest } from './lib/local-persistence.js';
import { createBarrierRecovery } from './lib/barrier-recovery.js';

async function request(path, body, options = {}) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(15_000),
    ...options, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.message || 'Der Spielstand konnte gerade nicht gespeichert werden.'), { status: response.status, details: result, code: result.code });
  return result;
}
const visible = () => document.visibilityState !== 'hidden';
const online = () => navigator.onLine !== false;
const recoveryKey = (id) => `stackfriends-local-game:${id}`;
function tabId() {
  try { const key = 'stackfriends-client'; const id = sessionStorage.getItem(key) || crypto.randomUUID(); sessionStorage.setItem(key, id); return id; }
  catch { return crypto.randomUUID(); }
}

export function useGame() {
  const [world, setWorld] = useState(null), [player, setPlayer] = useState(null);
  const [onlinePlayers, setOnlinePlayers] = useState([]), [hasOtherPlayersOnline, setHasOthers] = useState(false);
  const [mode, setMode] = useState('local'), [status, setStatus] = useState('loading'), [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(''), [saveStatus, setSaveStatus] = useState('saved'), [lastSavedAt, setLastSavedAt] = useState(null);
  const [version, setVersion] = useState(0), [toasts, setToasts] = useState([]);
  const model = useRef(new LocalGame()), worldRef = useRef(null), offset = useRef(0);
  const clientId = useRef(null); if (!clientId.current) clientId.current = tabId();
  const clientEpoch = useRef(Date.now()), mounted = useRef(true), toastTimers = useRef(new Set());
  const queue = useRef(Promise.resolve()), remoteCount = useRef(0), saveFlight = useRef(null), syncFlight = useRef(null), saving = useRef(false);
  const barriers = useRef(0), barrierInitial = useRef(null), barrierPhases = useRef([]), queuedCommands = useRef([]);
  const conflict = useRef(false), simulationFailed = useRef(false), conflictRecovery = useRef(null), storageWarning = useRef(false), transportError = useRef('');
  const contact = useRef({ at: Date.now(), epoch: 0, retryAt: 0, hasPendingGifts: false, catalogRevision: null });
  const previousOnline = useRef(null), handlers = useRef({}), exitTimer = useRef(null), exitEpoch = useRef(null), visibility = useRef(visible());
  const now = useCallback(() => Math.max(0, Date.now() + offset.current), []);
  const notify = useCallback((message, kind = 'info') => {
    if (!message || !mounted.current) return;
    const id = crypto.randomUUID(); setToasts((items) => [...items.slice(-2), { id, message, kind }]);
    const timer = setTimeout(() => { if (mounted.current) setToasts((items) => items.filter((item) => item.id !== id)); toastTimers.current.delete(timer); }, 4500);
    toastTimers.current.add(timer);
  }, []);
  const payload = useCallback((body = {}, active = visible()) => ({ ...body, simulation: 'local', clientId: clientId.current, clientEpoch: clientEpoch.current, active }), []);
  const bump = useCallback(() => { if (mounted.current) setVersion((value) => value + 1); }, []);
  const publish = useCallback(() => {
    worldRef.current = model.current.world;
    if (!mounted.current) return;
    setWorld(model.current.world);
    setSaveStatus(conflict.current || simulationFailed.current || transportError.current ? 'error' : saving.current ? 'saving' : model.current.isDirty ? 'unsaved' : 'saved');
    bump();
  }, [bump]);
  const snapshot = useCallback(() => {
    const recovery = model.current.serialize();
    return recovery && barriers.current ? createBarrierRecovery(recovery, barrierInitial.current, barrierPhases.current) : recovery;
  }, []);
  const persist = useCallback(() => {
    const recovery = snapshot();
    if (!recovery) return true;
    try { localStorage.setItem(recoveryKey(recovery.worldId), JSON.stringify(recovery)); return true; }
    catch {
      if (!storageWarning.current) { notify('Die lokale Sicherung ist gerade nicht verfügbar. Lass das Spiel bis zur Server-Speicherung geöffnet.', 'error'); storageWarning.current = true; }
      return false;
    }
  }, [notify, snapshot]);
  const backup = useCallback((recovery = snapshot()) => {
    if (!recovery) return true;
    const id = recovery.worldId || model.current.world?.id;
    if (!id) return false;
    try { localStorage.setItem(`stackfriends-recovery-backup:${id}:${Date.now()}:${crypto.randomUUID()}`, typeof recovery === 'string' ? recovery : JSON.stringify(recovery)); return true; }
    catch { return false; }
  }, [snapshot]);
  const handleFailure = useCallback((err) => {
    transportError.current = err.message;
    contact.current.retryAt = Date.now() + 15_000;
    if (err.status === 409 || err.code === 'LOCAL_WORLD_CONFLICT' || err.code === 'INVALID_RECOVERY') {
      conflict.current = true; conflictRecovery.current = err.recovery || snapshot();
      backup(conflictRecovery.current);
      if (mounted.current) setStatus('conflict');
      for (const queued of queuedCommands.current.splice(0)) queued.reject(err);
    }
    if (mounted.current) { setError(err.message); setSaveStatus('error'); }
    bump();
  }, [backup, bump, snapshot]);
  const failSimulation = useCallback((err) => {
    simulationFailed.current = true; handleFailure(err);
    for (const queued of queuedCommands.current.splice(0)) queued.reject(err);
    if (mounted.current) setStatus('error');
  }, [handleFailure]);
  const metadata = useCallback((result, epoch = clientEpoch.current) => {
    if (result.serverTime) offset.current = result.serverTime - Date.now();
    contact.current.at = Date.now(); contact.current.epoch = Math.max(contact.current.epoch, epoch); contact.current.retryAt = 0;
    contact.current.hasPendingGifts = Boolean(result.hasPendingGifts);
    if (result.catalogRevision !== undefined) contact.current.catalogRevision = result.catalogRevision;
    if (result.mode && mounted.current) setMode(result.mode);
    if (Object.hasOwn(result, 'player') && mounted.current && (!result.player || !model.current.world || result.player.id === model.current.world.id)) {
      setPlayer((current) => current?.id === result.player?.id && result.player ? { ...current, ...result.player } : result.player);
    }
    if (Object.hasOwn(result, 'hasOtherPlayersOnline') && mounted.current) setHasOthers(result.hasOtherPlayersOnline);
    if (Array.isArray(result.onlinePlayers)) {
      if (previousOnline.current && visible() && model.current.world?.cards.some((card) => card.type === 'town_hall')) {
        for (const person of result.onlinePlayers) if (person.id !== model.current.world.id && !previousOnline.current.has(person.id)) notify(`${person.name} ist jetzt online.`);
      }
      previousOnline.current = new Set(result.onlinePlayers.map((person) => person.id));
      if (mounted.current) setOnlinePlayers(result.onlinePlayers);
    }
    for (const message of result.giftMessages || []) notify(typeof message === 'string' ? message : message.message);
    if (result.savedAt || result.world?.clock?.lastAt) {
      if (mounted.current) setLastSavedAt(result.savedAt || result.world.clock.lastAt);
    }
    if (!conflict.current && !simulationFailed.current) {
      transportError.current = '';
      if (mounted.current) { setError(''); if (model.current.world) setStatus(online() ? 'connected' : 'offline'); }
    }
    bump();
  }, [bump, notify]);
  const enqueue = useCallback((operation) => {
    remoteCount.current++;
    const task = queue.current.then(operation, operation);
    const settled = task.finally(() => { remoteCount.current--; });
    queue.current = settled.catch(() => {});
    return settled;
  }, []);
  const executeLocal = useCallback((value) => {
    if (conflict.current) throw Object.assign(new Error('Lade zuerst den gespeicherten Stand. Deine lokale Sicherung bleibt erhalten.'), { code: 'LOCAL_WORLD_CONFLICT', status: 409 });
    if (simulationFailed.current) throw new Error('Die Spielberechnung ist angehalten. Lade den gespeicherten Stand erneut.');
    const result = model.current.command(value, now());
    persist(); publish();
    return { ...result, world: model.current.world };
  }, [now, persist, publish]);

  const performSaveNow = useCallback(async ({ keepalive = false, active = visible(), checkpoint = true } = {}) => {
    if (!model.current.world || !model.current.isDirty || conflict.current) return null;
    if (!online()) throw new Error('Du bist offline. Deine Änderungen bleiben lokal gespeichert.');
    const instance = model.current;
    if (!instance.pendingSave && checkpoint && !barriers.current) { instance.advance(now()); persist(); publish(); }
    const packet = instance.prepareSave(crypto.randomUUID());
    if (!packet) return null;
    persist();
    const body = payload(packet, active), epoch = body.clientEpoch;
    if (keepalive && new TextEncoder().encode(JSON.stringify(body)).byteLength > 60_000) return { skipped: true };
    saving.current = true; publish();
    try {
      let result;
      try { result = await request('/api/save', body, { keepalive }); }
      catch (err) {
        if (keepalive || err.status && err.status < 500) throw err;
        result = await request('/api/save', body);
      }
      if (model.current === instance && instance.pendingSave?.saveId === result.saveId) {
        instance.acknowledge(result); persist();
      }
      if (model.current === instance) metadata(result, epoch);
      return result;
    } catch (err) { if (model.current === instance) handleFailure(err); throw err; }
    finally { saving.current = false; publish(); }
  }, [handleFailure, metadata, now, payload, persist, publish]);
  const saveOnce = useCallback(() => {
    if (saveFlight.current) return saveFlight.current;
    let task;
    task = enqueue(() => performSaveNow()).finally(() => { if (saveFlight.current === task) saveFlight.current = null; });
    saveFlight.current = task;
    return task;
  }, [enqueue, performSaveNow]);
  const presence = useCallback((active = visible()) => enqueue(async () => {
    if (!model.current.world || conflict.current || !online()) return null;
    const body = payload({}, active);
    try { const result = await request('/api/presence', body); metadata(result, body.clientEpoch); publish(); return result; }
    catch (err) { handleFailure(err); throw err; }
  }), [enqueue, handleFailure, metadata, payload, publish]);

  const barrier = useCallback((path, body, { method = 'POST' } = {}) => {
    if (!model.current.world || conflict.current || simulationFailed.current) return Promise.reject(new Error('Lade zuerst deine gespeicherte Welt.'));
    if (!online()) return Promise.reject(new Error('Dafür brauchst du eine Internetverbindung. Dein Spiel läuft lokal weiter.'));
    if (!barriers.current) {
      barrierInitial.current = { active: model.current.active, pausedAt: snapshot()?.pausedAt };
      barrierPhases.current = [];
      try { model.current.advance(now()); persist(); publish(); }
      catch (err) { failSimulation(err); return Promise.reject(err); }
    }
    barriers.current++; bump();
    return enqueue(async () => {
      try {
        while (model.current.isDirty) await performSaveNow({ checkpoint: false });
        const requestBody = payload({ ...body, baseRevision: model.current.baseRevision });
        let result;
        try { result = await request(path, method === 'GET' ? undefined : requestBody); }
        catch (err) {
          if (!requestBody.commandId || err.status && err.status < 500) throw err;
          result = await request(path, requestBody);
        }
        if (Object.hasOwn(result, 'world')) {
          model.current.adopt(result); persist(); publish();
          metadata(result, requestBody.clientEpoch);
        }
        return result;
      } catch (err) { handleFailure(err); throw err; }
      finally {
        barriers.current--;
        if (!barriers.current && model.current.world && !conflict.current && !simulationFailed.current) {
          try {
            const start = model.current.world.clock.lastAt;
            if (barrierInitial.current?.active) model.current.resume(start, start);
            for (const phase of barrierPhases.current) {
              if (phase.active) model.current.resume(phase.at);
              else if (model.current.active) model.current.pause(phase.at);
            }
            if (visible()) model.current.resume(now(), model.current.active ? now() : undefined);
            else { if (model.current.active) model.current.pause(now()); model.current.advance(now()); }
            barrierPhases.current = []; persist(); publish();
            for (const queued of queuedCommands.current.splice(0)) {
              try { queued.resolve(executeLocal(queued.value)); } catch (err) { queued.reject(err); }
            }
          } catch (err) { failSimulation(err); }
        }
        bump();
      }
    });
  }, [bump, enqueue, executeLocal, failSimulation, handleFailure, metadata, now, payload, performSaveNow, persist, publish, snapshot]);
  const refresh = useCallback(() => {
    if (syncFlight.current) return syncFlight.current;
    let task;
    task = barrier('/api/sync', {}).finally(() => { if (syncFlight.current === task) syncFlight.current = null; });
    syncFlight.current = task;
    return task;
  }, [barrier]);
  const command = useCallback((value) => {
    if (value?.type === 'catalog-save') return barrier('/api/command', { command: value, commandId: crypto.randomUUID() });
    if (barriers.current) return new Promise((resolve, reject) => queuedCommands.current.push({ value, resolve, reject }));
    try { return Promise.resolve(executeLocal(value)); } catch (err) { return Promise.reject(err); }
  }, [barrier, executeLocal]);
  const sendGift = useCallback((recipientId, selection) => barrier('/api/gift', { recipientId, ...selection, commandId: crypto.randomUUID() }), [barrier]);
  const listPlayers = useCallback(() => barrier('/api/players', undefined, { method: 'GET' }), [barrier]);
  const inspectPlayer = useCallback((playerId) => request('/api/materials', payload({ playerId })), [payload]);

  const adoptLoaded = useCallback((result, ignoreRecovery = false) => {
    const next = new LocalGame();
    if (!result.world) { model.current = next; next.adopt(result); metadata(result); publish(); return; }
    let recovered, recoveryText;
    if (!ignoreRecovery) {
      try { recoveryText = localStorage.getItem(recoveryKey(result.world.id)); recovered = recoveryText ? JSON.parse(recoveryText) : null; }
      catch { recovered = { worldId: result.world.id, invalid: true, raw: recoveryText }; }
    }
    try {
      if (recovered) next.restore(result, recovered); else next.adopt(result);
      model.current = next;
      conflict.current = false; simulationFailed.current = false; conflictRecovery.current = null;
      try { if (visible()) next.resume(now()); }
      catch (err) { failSimulation(err); }
      persist(); metadata(result); publish();
    } catch (err) {
      model.current = new LocalGame(); model.current.adopt(result);
      handleFailure(Object.assign(err, { recovery: recovered }));
      metadata(result); publish();
    }
  }, [failSimulation, handleFailure, metadata, now, persist, publish]);
  const load = useCallback(async () => {
    if (mounted.current) { setStatus('loading'); setError(''); }
    try {
      const body = payload(); const result = await request('/api/load', body);
      if (result.serverTime) offset.current = result.serverTime - Date.now();
      adoptLoaded(result);
      if (mounted.current && !conflict.current && !simulationFailed.current) setStatus(result.player ? online() ? 'connected' : 'offline' : 'welcome');
    } catch (err) { if (mounted.current) { setError(err.message); setStatus('error'); } }
    finally { if (mounted.current) setLoaded(true); }
  }, [adoptLoaded, payload]);
  const join = useCallback(async (name) => {
    const body = payload({ name });
    const result = await enqueue(() => request('/api/join', body));
    if (result.serverTime) offset.current = result.serverTime - Date.now();
    adoptLoaded(result);
    if (!conflict.current && !simulationFailed.current) setStatus('connected');
    return result;
  }, [adoptLoaded, enqueue, payload]);
  const resolveConflict = useCallback(async () => {
    if (!backup(conflictRecovery.current || snapshot())) { notify('Die lokale Sicherung konnte nicht abgelegt werden. Der gespeicherte Stand wurde deshalb noch nicht geladen.', 'error'); return; }
    try {
      const body = payload(), result = await enqueue(() => request('/api/load', body));
      conflict.current = false; transportError.current = ''; conflictRecovery.current = null;
      if (result.serverTime) offset.current = result.serverTime - Date.now();
      adoptLoaded(result, true);
      notify('Gespeicherter Stand geladen. Die vorherige lokale Sicherung bleibt erhalten.');
    } catch (err) { handleFailure(err); throw err; }
  }, [adoptLoaded, backup, enqueue, handleFailure, notify, payload, snapshot]);

  const sendExit = useCallback(() => {
    if (!model.current.world || !online() || conflict.current || exitEpoch.current === clientEpoch.current) return;
    exitEpoch.current = clientEpoch.current;
    if (!barriers.current && !saveFlight.current && !remoteCount.current && model.current.isDirty) {
      let task;
      task = performSaveNow({ keepalive: true, active: false, checkpoint: false }).then((result) => {
        if (result?.skipped) return request('/api/presence', payload({}, false), { keepalive: true });
        return result;
      }).catch(() => {}).finally(() => { if (saveFlight.current === task) saveFlight.current = null; });
      saveFlight.current = task;
    } else request('/api/presence', payload({}, false), { keepalive: true }).catch(() => {});
  }, [payload, performSaveNow]);
  const setVisibility = useCallback((active) => {
    if (!model.current.world || active === visibility.current) return;
    visibility.current = active; clientEpoch.current++; exitEpoch.current = null;
    if (barriers.current) barrierPhases.current.push({ active, at: now() });
    else if (!conflict.current && !simulationFailed.current) {
      try { if (active) model.current.resume(now()); else model.current.pause(now()); }
      catch (err) { failSimulation(err); }
    }
    persist(); publish();
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = null;
    if (!active) exitTimer.current = setTimeout(() => { exitTimer.current = null; handlers.current.sendExit?.(); }, 150);
    else if (!conflict.current && !simulationFailed.current && online()) {
      handlers.current.saveOnce?.().catch(() => {}).finally(() => {
        if (visible() && contact.current.epoch < clientEpoch.current) handlers.current.presence?.(true).catch(() => {});
      });
    }
  }, [failSimulation, now, persist, publish]);
  handlers.current = { saveOnce, presence, sendExit, setVisibility };

  useEffect(() => {
    mounted.current = true; load();
    return () => { mounted.current = false; if (exitTimer.current) clearTimeout(exitTimer.current); for (const timer of toastTimers.current) clearTimeout(timer); };
  }, [load]);
  useEffect(() => {
    if (!player?.id) return;
    const changed = () => handlers.current.setVisibility(visible());
    const hide = () => { handlers.current.setVisibility(false); if (exitTimer.current) clearTimeout(exitTimer.current); exitTimer.current = null; handlers.current.sendExit(); };
    const wentOnline = () => {
      if (mounted.current && !conflict.current && !simulationFailed.current) setStatus('connected');
      if (visible()) handlers.current.saveOnce().catch(() => {}).finally(() => { if (visible() && contact.current.epoch < clientEpoch.current) handlers.current.presence(true).catch(() => {}); });
      bump();
    };
    const wentOffline = () => { if (!conflict.current) { setStatus('offline'); setSaveStatus(model.current.isDirty ? 'unsaved' : 'saved'); } bump(); };
    document.addEventListener('visibilitychange', changed); window.addEventListener('pagehide', hide);
    window.addEventListener('online', wentOnline); window.addEventListener('offline', wentOffline);
    return () => { document.removeEventListener('visibilitychange', changed); window.removeEventListener('pagehide', hide); window.removeEventListener('online', wentOnline); window.removeEventListener('offline', wentOffline); };
  }, [player?.id, bump]);
  useEffect(() => {
    if (!world || !player || !visible() || barriers.current || conflict.current || simulationFailed.current) return;
    const deadline = nextWakeAt(model.current.world, now());
    if (deadline === null) return;
    const timer = setTimeout(() => {
      if (barriers.current || conflict.current || simulationFailed.current || !visible()) return;
      try { model.current.advance(now()); persist(); publish(); }
      catch (err) { failSimulation(err); }
    }, Math.max(50, deadline - now()));
    return () => clearTimeout(timer);
  }, [world, player, version, now, persist, publish, failSimulation]);
  useEffect(() => {
    if (!world || !player || !visible() || !online() || barriers.current || conflict.current) return;
    const next = nextPersistenceRequest({ now: Date.now(), lastContact: contact.current.at, retryAt: contact.current.retryAt, dirty: model.current.isDirty, pendingCount: model.current.pendingCount });
    const timer = setTimeout(() => {
      if (barriers.current || conflict.current || !visible() || !online()) return;
      (model.current.isDirty ? saveOnce() : presence()).catch(() => {});
    }, next.delay);
    return () => clearTimeout(timer);
  }, [world, player, version, saveOnce, presence]);
  useEffect(() => {
    if (!world || !player || !visible() || !online() || barriers.current || conflict.current || simulationFailed.current || syncFlight.current || Date.now() < contact.current.retryAt) return;
    const newerCatalog = contact.current.catalogRevision !== null && contact.current.catalogRevision !== world.catalog?.revision;
    if (contact.current.hasPendingGifts || newerCatalog && !model.current.isDirty) refresh().catch(() => {});
  }, [world, player, version, refresh]);

  const noop = useCallback(() => false, []);
  const isRemoteBusy = useCallback(() => barriers.current > 0, []);
  return { world, worldRef, player, online: onlinePlayers, onlinePlayers, hasOtherPlayersOnline, mode, status, loaded, error, saveStatus, lastSavedAt,
    previews: {}, locks: {}, toasts, offset, join, command, sendGift, listPlayers, inspectPlayer, refresh, sync: refresh, save: saveOnce,
    send: noop, dragPreview: noop, notify, reload: load, resolveConflict, isRemoteBusy };
}

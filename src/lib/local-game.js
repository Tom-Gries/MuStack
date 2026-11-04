import { initializeLocalSimulation, applySimulationOperation, replaySimulationBatch, MAX_SIMULATION_OPERATIONS } from '@stackfriends/shared/local-simulation.js';
import { getCatalog } from '@stackfriends/shared/catalog.js';

const clone = (value) => structuredClone(value);
const validRevision = (value) => Number.isSafeInteger(value) && value >= 0;
const validTime = (value) => Number.isFinite(value) && value >= 0;
const saveIdValid = (value) => typeof value === 'string' && /^[a-zA-Z0-9_:-]{8,128}$/.test(value);
function fail(message, code = 'INVALID_LOCAL_STATE', details = {}) {
  throw Object.assign(new Error(message), { code, status: code === 'LOCAL_WORLD_CONFLICT' ? 409 : 400, ...details });
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
}
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function replayAll(world, operations) {
  for (let start = 0; start < operations.length; start += MAX_SIMULATION_OPERATIONS) {
    replaySimulationBatch(world, operations.slice(start, start + MAX_SIMULATION_OPERATIONS), { playerId: world.id });
  }
}

/** Browser-owned simulation and durable outbox. This class performs no I/O. */
export class LocalGame {
  constructor({ maxBatchSize = MAX_SIMULATION_OPERATIONS } = {}) {
    if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1 || maxBatchSize > MAX_SIMULATION_OPERATIONS) fail('Die Speicherpaketgröße ist ungültig.');
    this._maxBatchSize = maxBatchSize;
    this._world = null;
    this._baseWorld = null;
    this._baseRevision = null;
    this._operations = [];
    this._pendingSave = null;
    this._active = false;
    this._pausedAt = null;
    this._resumeActiveUntil = null;
    this._lastAcknowledgedSaveId = null;
  }

  get world() { return this._world; }
  get baseWorld() { return this._baseWorld ? clone(this._baseWorld) : null; }
  get baseRevision() { return this._baseRevision; }
  get pendingSave() { return this._pendingSave ? clone(this._pendingSave) : null; }
  get pendingCount() { return this._operations.length; }
  get isDirty() { return this.pendingCount > 0; }
  get active() { return this._active; }

  _requireWorld() {
    if (!this._world) fail('Öffne zuerst deine Welt.');
  }
  _at(now) {
    this._requireWorld();
    if (!validTime(now)) fail('Der lokale Spielzeitpunkt ist ungültig.');
    // A corrected clock offset must never move an already simulated world back.
    return Math.max(now, this._world.clock.lastAt);
  }
  _inactiveBoundary() {
    return this._pausedAt ?? this._resumeActiveUntil ?? this._world.clock.lastAt;
  }
  _apply(operation) {
    const next = clone(this._world);
    const result = applySimulationOperation(next, operation, { playerId: next.id });
    this._world = next;
    this._operations.push(clone(operation));
    return result;
  }
  _conflict(message, details = {}) {
    fail(message, 'LOCAL_WORLD_CONFLICT', { recovery: this.serialize(), ...details });
  }

  /** Adopt only at a clean remote barrier; never erase unconfirmed local work. */
  adopt(result) {
    if (this.isDirty || this._pendingSave) this._conflict('Deine ungespeicherten Änderungen müssen zuerst gespeichert werden.');
    if (!result?.world) {
      this._world = this._baseWorld = null;
      this._baseRevision = null;
      this._active = false;
      this._pausedAt = this._resumeActiveUntil = null;
      return null;
    }
    const world = initializeLocalSimulation(clone(result.world));
    if (!validRevision(world.revision)) fail('Die Version des Spielstands ist ungültig.');
    if (result.player?.id && result.player.id !== world.id) fail('Die Welt gehört zu einem anderen Spieler.');
    this._baseWorld = clone(world);
    this._world = world;
    this._baseRevision = world.revision;
    this._operations = [];
    this._pendingSave = null;
    this._active = false;
    this._pausedAt = null;
    this._resumeActiveUntil = validTime(result.resumeActiveUntil) ? result.resumeActiveUntil : world.clock.lastAt;
    this._lastAcknowledgedSaveId = result.lastSave?.id || null;
    return this._world;
  }

  /** Initial/recovery resume uses its saved lease; a short RPC barrier can pass now. */
  resume(now, activeUntil) {
    const at = this._at(now);
    const boundary = activeUntil ?? (this._active ? at : this._inactiveBoundary());
    if (!validTime(boundary)) fail('Die aktive Spielzeit ist ungültig.');
    const outcome = this._apply({ kind: 'advance', at, activeUntil: Math.min(at, boundary) });
    this._active = true;
    this._pausedAt = this._resumeActiveUntil = null;
    return outcome;
  }

  pause(now) {
    this._requireWorld();
    if (!this._active) return { changed: false };
    const at = this._at(now);
    const outcome = this._apply({ kind: 'advance', at, activeUntil: at });
    this._active = false;
    this._pausedAt = at;
    return outcome;
  }

  /** Call only for an engine deadline or checkpoint, never for visual frames. */
  advance(now) {
    const at = this._at(now);
    return this._apply({ kind: 'advance', at, activeUntil: this._active ? at : Math.min(at, this._inactiveBoundary()) });
  }

  command(value, now) {
    const at = this._at(now);
    return this._apply({ kind: 'command', at, activeUntil: this._active ? at : Math.min(at, this._inactiveBoundary()), command: clone(value) });
  }

  /** An uncertain save is retried verbatim, even if more local actions happened. */
  prepareSave(saveId) {
    this._requireWorld();
    if (this._pendingSave) return clone(this._pendingSave);
    if (!this.isDirty) return null;
    if (!saveIdValid(saveId)) fail('Das Speicherpaket benötigt eine eindeutige ID.');
    this._pendingSave = { saveId, baseRevision: this._baseRevision, catalogContentVersion: getCatalog(this._baseWorld).contentVersion, operations: clone(this._operations.slice(0, this._maxBatchSize)) };
    return clone(this._pendingSave);
  }

  /** Commit only the frozen prefix. Newer local outcomes and RNG are retained. */
  acknowledge(result) {
    this._requireWorld();
    if (result?.saveId === this._lastAcknowledgedSaveId) return this._world;
    const packet = this._pendingSave;
    if (!packet || result?.saveId !== packet.saveId) fail('Die Speicherbestätigung gehört nicht zum aktuellen Paket.');
    if (!validRevision(result.revision) || result.revision !== packet.baseRevision + 1) this._conflict('Der Server hat inzwischen eine andere Version deiner Welt.', { serverRevision: result.revision });
    if (validRevision(result.currentRevision) && result.currentRevision !== result.revision) this._conflict('Deine Welt wurde inzwischen in einer anderen Sitzung geändert.', { serverRevision: result.currentRevision });
    const length = packet.operations.length;
    if (!same(this._operations.slice(0, length), packet.operations)) fail('Das lokale Speicherpaket wurde verändert.');
    const committed = clone(this._baseWorld);
    replaySimulationBatch(committed, packet.operations, { playerId: committed.id });
    committed.revision = result.revision;
    this._baseWorld = committed;
    this._baseRevision = result.revision;
    this._operations = this._operations.slice(length);
    this._world = { ...this._world, revision: result.revision };
    this._pendingSave = null;
    this._lastAcknowledgedSaveId = result.saveId;
    return this._world;
  }

  serialize() {
    if (!this._world) return null;
    return clone({ version: 1, worldId: this._world.id, baseRevision: this._baseRevision, baseWorld: this._baseWorld,
      operations: this._operations, pendingSave: this._pendingSave, active: this._active, pausedAt: this._pausedAt,
      resumeActiveUntil: this._resumeActiveUntil, lastAcknowledgedSaveId: this._lastAcknowledgedSaveId });
  }

  /** Recover either an uncommitted packet or the suffix after a lost save ACK. */
  restore(result, recovery) {
    if (this.isDirty || this._pendingSave) this._conflict('Deine ungespeicherten Änderungen müssen zuerst gesichert werden.');
    const candidate = new LocalGame({ maxBatchSize: this._maxBatchSize });
    candidate.adopt(result);
    if (!recovery || !candidate.world || recovery.worldId !== candidate.world.id) {
      Object.assign(this, candidate);
      return { restored: false, acknowledged: false, world: this._world };
    }
    if (recovery.version !== 1 || !validRevision(recovery.baseRevision) || !recovery.baseWorld || !Array.isArray(recovery.operations)
      || recovery.operations.length > 100_000 || recovery.baseWorld.id !== recovery.worldId || recovery.baseWorld.revision !== recovery.baseRevision) fail('Die lokale Sicherung ist ungültig.', 'INVALID_RECOVERY', { recovery: clone(recovery) });
    const recoveredBase = initializeLocalSimulation(clone(recovery.baseWorld));
    const pending = recovery.pendingSave;
    if (pending && (!saveIdValid(pending.saveId) || pending.baseRevision !== recovery.baseRevision || !Array.isArray(pending.operations)
      || pending.operations.length < 1 || pending.operations.length > this._maxBatchSize || !same(recovery.operations.slice(0, pending.operations.length), pending.operations))) fail('Das gesicherte Speicherpaket ist ungültig.', 'INVALID_RECOVERY', { recovery: clone(recovery) });
    let operations = clone(recovery.operations), acknowledged = false;
    if (candidate.baseRevision === recovery.baseRevision) {
      if (!same(candidate._baseWorld, recoveredBase)) fail('Der gespeicherte Stand wurde außerhalb dieser Sitzung verändert.', 'LOCAL_WORLD_CONFLICT', { status: 409, recovery: clone(recovery), serverRevision: candidate.baseRevision });
      candidate._pendingSave = pending ? clone(pending) : null;
    } else if (pending && result.lastSave?.id === pending.saveId && result.lastSave.revision === candidate.baseRevision && candidate.baseRevision === recovery.baseRevision + 1) {
      const committed = clone(recoveredBase);
      replaySimulationBatch(committed, pending.operations, { playerId: committed.id });
      committed.revision = candidate.baseRevision;
      if (!same(candidate._baseWorld, committed)) fail('Die bestätigte Sicherung passt nicht mehr zu dieser Sitzung.', 'LOCAL_WORLD_CONFLICT', { recovery: clone(recovery), serverRevision: candidate.baseRevision });
      operations = operations.slice(pending.operations.length);
      acknowledged = true;
      candidate._lastAcknowledgedSaveId = pending.saveId;
    } else {
      fail('Deine Welt wurde inzwischen in einer anderen Sitzung gespeichert. Deine lokale Sicherung bleibt erhalten.', 'LOCAL_WORLD_CONFLICT', { recovery: clone(recovery), serverRevision: candidate.baseRevision });
    }
    const replayed = clone(candidate._baseWorld);
    try { replayAll(replayed, operations); }
    catch (cause) { fail('Die lokale Sicherung konnte nicht wiederhergestellt werden.', 'INVALID_RECOVERY', { recovery: clone(recovery), cause }); }
    candidate._world = replayed;
    candidate._operations = operations;
    candidate._active = false;
    candidate._pausedAt = recovery.active === false && validTime(recovery.pausedAt) ? recovery.pausedAt : null;
    candidate._resumeActiveUntil = candidate._pausedAt ?? (validTime(result.resumeActiveUntil) ? result.resumeActiveUntil : candidate._world.clock.lastAt);
    Object.assign(this, candidate);
    return { restored: true, acknowledged, world: this._world };
  }
}

import { LocalGame } from './local-game.js';

/** Persist paused/resumed phases without changing the live RPC barrier. */
export function createBarrierRecovery(recovery, initial, phases) {
  if (!recovery || !phases?.length) return recovery;
  const shadow = new LocalGame();
  shadow.restore({
    world: recovery.baseWorld,
    player: { id: recovery.worldId },
    resumeActiveUntil: recovery.resumeActiveUntil,
    lastSave: recovery.lastAcknowledgedSaveId ? { id: recovery.lastAcknowledgedSaveId, revision: recovery.baseRevision } : null,
  }, recovery);
  // A response may already have been adopted while another RPC is waiting.
  // Restore the barrier's original mode before applying its recorded phases.
  if (initial?.active) shadow.resume(shadow.world.clock.lastAt, shadow.world.clock.lastAt);
  for (const phase of phases) {
    if (phase.active) shadow.resume(phase.at);
    else if (shadow.active) shadow.pause(phase.at);
  }
  return shadow.serialize();
}

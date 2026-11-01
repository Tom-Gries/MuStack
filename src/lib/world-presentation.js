import { CONFIG, getCardTypes } from '@stackfriends/shared/catalog.js';
import { creatureProfile } from '@stackfriends/shared/creatures.js';
import { newestWorld } from './world-sync.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Position/stack preview only. Inventories, random draws and jobs stay authoritative. */
export function previewMove(world, command, now, previewId) {
  if (!world || command.type !== 'move' || command.zone || !Number.isFinite(command.x) || !Number.isFinite(command.y)) return world;
  const selected = world.cards.find((card) => card.id === command.cardId);
  if (!selected || creatureProfile(world, selected)?.aggressive) return world;
  const cards = world.cards.map((card) => ({ ...card }));
  const byId = new Map(cards.map((card) => [card.id, card]));
  const card = byId.get(selected.id);
  const wasEquipped = Boolean(card.equippedTo);
  const normal = cards.filter((item) => item.stackId === card.stackId && !item.equippedTo).sort((a, b) => a.order - b.order);
  const material = wasEquipped ? [card] : command.takeAbove ? normal.filter((item) => item.order >= card.order) : command.split ? [card] : normal;
  const materialIds = new Set(material.map((item) => item.id));
  const moving = [...material, ...cards.filter((item) => item.equippedTo && materialIds.has(item.equippedTo))];
  if (!moving.length || moving.some((item) => creatureProfile(world, item)?.aggressive)) return world;
  const movingIds = new Set(moving.map((item) => item.id));
  let target = byId.get(command.targetId);
  if (target?.equippedTo) target = byId.get(target.equippedTo);
  if (target && movingIds.has(target.id)) target = null;
  // A missing drop target is left for the server to reject, without a false preview.
  if (command.targetId && !byId.has(command.targetId)) return world;
  const affected = new Set([card.stackId]);
  if (target?.motion) {
    const motion = target.motion;
    const elapsed = world.clock.elapsed + Math.max(0, now - world.clock.lastAt);
    const fraction = clamp((elapsed - motion.startedAt) / motion.duration, 0, 1);
    const x = motion.fromX + (motion.toX - motion.fromX) * fraction;
    const y = motion.fromY + (motion.toY - motion.fromY) * fraction;
    for (const item of cards.filter((item) => item.stackId === target.stackId)) Object.assign(item, { x, y });
  }
  const destination = target || { x: clamp(command.x, 24, CONFIG.worldWidth - CONFIG.cardWidth - 24), y: clamp(command.y, 24, CONFIG.worldHeight - CONFIG.cardHeight - 24) };
  const definitions = getCardTypes(world);
  if (target?.type === 'human' && target.hp > 0 && material.length === 1 && definitions[material[0].type]?.category === 'tool') {
    if (target.toolId && target.toolId !== card.id) return world;
    const previous = byId.get(card.equippedTo);
    if (previous) delete previous.toolId;
    Object.assign(card, { equippedTo: target.id, stackId: target.stackId, order: target.order, x: target.x, y: target.y });
    target.toolId = card.id;
  } else {
    if (wasEquipped) {
      const human = byId.get(card.equippedTo);
      if (human) delete human.toolId;
      delete card.equippedTo;
    }
    const stackId = target?.stackId || (command.takeAbove || command.split || wasEquipped ? `preview:${previewId}` : card.stackId);
    let order = target ? cards.filter((item) => item.stackId === target.stackId && !item.equippedTo && !movingIds.has(item.id)).length : 0;
    for (const item of moving) {
      Object.assign(item, { stackId, x: destination.x, y: destination.y });
      delete item.motion;
      if (!item.equippedTo) item.order = order++;
    }
    affected.add(stackId);
  }
  for (const stackId of affected) {
    const stack = cards.filter((item) => item.stackId === stackId && !item.equippedTo).sort((a, b) => a.order - b.order);
    stack.forEach((item, order) => { item.order = order; });
  }
  for (const tool of cards.filter((item) => item.equippedTo)) {
    const human = byId.get(tool.equippedTo);
    if (human) Object.assign(tool, { stackId: human.stackId, order: human.order, x: human.x, y: human.y });
  }
  return { ...world, cards };
}

/** Rebase every unconfirmed move, so an older reply never undoes a newer drop. */
export class WorldPresentation {
  constructor() { this.confirmed = null; this.pending = new Map(); }
  accept(world) {
    if (world && this.confirmed && world.id !== this.confirmed.id) this.pending.clear();
    this.confirmed = newestWorld(this.confirmed, world);
    return this.view();
  }
  preview(id, command, now) {
    if (command.type === 'move' && !command.zone) this.pending.set(id, { command, now });
    return this.view();
  }
  remove(id) { this.pending.delete(id); }
  view() {
    let world = this.confirmed;
    for (const [id, pending] of this.pending) world = previewMove(world, pending.command, pending.now, id);
    return world;
  }
}

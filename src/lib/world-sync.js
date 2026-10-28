// A delayed HTTP response or resync must not undo a newer WebSocket update.
export function newestWorld(current, incoming) {
  if (!incoming || current && incoming.revision < current.revision) return current;
  return incoming;
}

export function applyWorldPatch(world, event) {
  if (world && event.revision <= world.revision) return world;
  if (!world || world.revision !== event.baseRevision) return null;
  const remove = new Set(event.remove || []);
  const changed = new Map((event.upsert || []).map((card) => [card.id, card]));
  const cards = world.cards.filter((card) => !remove.has(card.id)).map((card) => {
    const next = changed.get(card.id);
    changed.delete(card.id);
    return next || card;
  });
  cards.push(...changed.values());
  return { ...world, ...event.changes, cards, revision: event.revision };
}

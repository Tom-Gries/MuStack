/** Picking a level carries that card and every card stacked above it. */
export function dragSelection(cards, cardId, split = true, takeAbove = true) {
  const selected = cards.find((card) => card.id === cardId);
  if (!selected) return [];
  if (takeAbove) return cards.filter((card) => card.stackId === selected.stackId && card.order >= selected.order).map((card) => card.id);
  return cards.filter((card) => split ? card.id === cardId : card.stackId === selected.stackId).map((card) => card.id);
}

/** A card dropped substantially on another card stacks even if the cursor misses it. */
export function overlappingTarget(rect, candidates, excludedIds = [], minimum = 0.25) {
  const excluded = new Set(excludedIds);
  return candidates.filter((item) => !excluded.has(item.id)).map((item) => {
    const width = Math.max(0, Math.min(rect.left + rect.width, item.left + item.width) - Math.max(rect.left, item.left));
    const height = Math.max(0, Math.min(rect.top + rect.height, item.top + item.height) - Math.max(rect.top, item.top));
    return { ...item, overlap: width * height / (rect.width * rect.height) };
  }).filter((item) => item.overlap >= minimum).sort((a, b) => b.overlap - a.overlap || (b.order || 0) - (a.order || 0))[0]?.id;
}

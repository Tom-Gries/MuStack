import { CONFIG, DEFAULT_RAT_DROPS } from '@stackfriends/shared/catalog.js';

export const graphKey = (kind, id) => `${kind}:${id}`;
const percent = (weight, total) => `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(total ? weight / total * 100 : 0)} %`;
export const graphDuration = (ms) => ms >= 3_600_000 ? `${ms / 3_600_000} Std.` : ms >= 60_000 ? `${ms / 60_000} Min.` : `${ms / 1000} Sek.`;

/** A read-only projection of the actual catalog, including the game's fixed production rules. */
export function buildCatalogGraph(catalog) {
  const nodes = [
    ...catalog.packs.map((pack) => ({ key: graphKey('packs', pack.id), id: pack.id, kind: 'packs', name: pack.name, color: pack.color, art: pack.contents[0]?.type || 'pack', detail: `${pack.price} Gold · ${pack.size} Karten`, value: pack })),
    ...Object.entries(catalog.cardTypes).map(([id, card]) => ({ key: graphKey('cards', id), id, kind: 'cards', name: card.name, color: card.color, art: id, detail: card.category, value: card })),
    ...catalog.recipes.map((recipe) => ({ key: graphKey('recipes', recipe.id), id: recipe.id, kind: 'recipes', name: recipe.name, color: catalog.cardTypes[recipe.result]?.color, art: recipe.result, detail: `${graphDuration(recipe.duration)}${recipe.requiresHuman ? ' · mit Mensch' : ''}`, value: recipe })),
  ];
  const index = new Map(nodes.map((node) => [node.key, node]));
  const edges = [];
  function connect(from, to, label, kind) {
    if (index.has(from) && index.has(to)) edges.push({ id: `${from}>${to}:${kind}:${edges.length}`, from, to, label, kind });
  }
  for (const pack of catalog.packs) {
    const total = pack.contents.reduce((sum, row) => sum + row.weight, 0);
    for (const row of pack.contents) connect(graphKey('packs', pack.id), graphKey('cards', row.type), `${percent(row.weight, total)} pro Ziehung`, 'pack');
  }
  for (const recipe of catalog.recipes) {
    for (const [type, count] of Object.entries(recipe.ingredients)) connect(graphKey('cards', type), graphKey('recipes', recipe.id), `${count} × Zutat${recipe.keepIngredients?.includes(type) ? ' · bleibt erhalten' : ''}`, 'ingredient');
    if (recipe.requiresHuman) connect('cards:human', graphKey('recipes', recipe.id), 'Arbeitet mit · bleibt erhalten', 'worker');
    connect(graphKey('recipes', recipe.id), graphKey('cards', recipe.result), `${recipe.resultCount ?? 1} × Ergebnis`, 'result');
  }
  for (const [id, card] of Object.entries(catalog.cardTypes)) {
    const drops = card.deathDrops ?? (id === 'rat' ? DEFAULT_RAT_DROPS : null);
    if (drops?.chance > 0) {
      const total = drops.outputs.reduce((sum, row) => sum + row.weight, 0);
      for (const row of drops.outputs) connect(graphKey('cards', id), graphKey('cards', row.type), `${row.count} × · ${percent(row.weight * drops.chance / 100, total)} nach dem Kampf`, 'loot');
    }
    for (const effect of card.effects || []) {
      if (effect.kind === 'source') {
        const total = effect.outputs.reduce((sum, row) => sum + row.weight, 0);
        for (const row of effect.outputs) connect(graphKey('cards', id), graphKey('cards', row.type), `${row.count} × · ${percent(row.weight, total)} · ${graphDuration(effect.duration)}`, 'source');
      }
      if (effect.kind === 'tool') for (const source of effect.sourceTypes) connect(graphKey('cards', id), graphKey('cards', source), `Abbauzeit × ${effect.multiplier}`, 'tool');
      if (effect.kind === 'heal') connect(graphKey('cards', id), 'cards:human', `Heilt ${effect.amount} Leben`, 'heal');
      if (effect.kind === 'weapon') connect(graphKey('cards', id), 'cards:human', `+${effect.damage} Kampfschaden`, 'weapon');
    }
  }
  connect('cards:field', 'cards:berry', `${CONFIG.fieldHarvestCount} × · alle ${graphDuration(CONFIG.fieldHarvestInterval)}`, 'harvest');
  connect('cards:human', 'cards:corpse', 'Bei 0 Leben', 'death');
  // A purchased package is already represented by its shop node. Only show
  // the generic package-card definition separately if a recipe uses it.
  const visibleNodes = nodes.filter((node) => node.key !== 'cards:pack' || edges.some((edge) => edge.from === node.key || edge.to === node.key));

  // Earliest production stage: every ingredient must be obtainable. Relaxation
  // handles alternative paths and cycles (e.g. chicken -> egg -> chicken).
  const stages = new Map(nodes.map((node) => [node.key, node.kind === 'packs' || ['cards:human', 'cards:gold'].includes(node.key) ? 0 : Infinity]));
  const lower = (key, next) => {
    if (next >= stages.get(key)) return false;
    stages.set(key, next); return true;
  };
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const edge of edges) {
      if (['pack', 'source', 'harvest', 'loot', 'death'].includes(edge.kind)) changed = lower(edge.to, stages.get(edge.from) + 1) || changed;
    }
    for (const recipe of catalog.recipes) {
      const inputs = [...Object.keys(recipe.ingredients), ...(recipe.requiresHuman ? ['human'] : [])];
      const stage = Math.max(...inputs.map((id) => stages.get(graphKey('cards', id)) ?? Infinity)) + 1;
      changed = lower(graphKey('recipes', recipe.id), stage) || changed;
      changed = lower(graphKey('cards', recipe.result), stage + 1) || changed;
    }
    if (!changed) break;
  }
  return { nodes: visibleNodes.map((node) => ({ ...node, stage: Number.isFinite(stages.get(node.key)) ? stages.get(node.key) : null })), edges };
}

export function layoutCatalogGraph(graph, { mode = 'progress', focus } = {}) {
  const selected = graph.nodes.find((node) => node.key === focus) || graph.nodes[0];
  let columns;
  if (mode === 'relations' && selected) {
    const incoming = new Set(graph.edges.filter((edge) => edge.to === selected.key && edge.from !== selected.key).map((edge) => edge.from));
    const outgoing = new Set(graph.edges.filter((edge) => edge.from === selected.key && edge.to !== selected.key).map((edge) => edge.to));
    columns = [
      { name: 'KOMMT AUS / BENÖTIGT', nodes: graph.nodes.filter((node) => incoming.has(node.key)).map((node) => ({ ...node, slot: `${node.key}:in` })) },
      { name: 'DEINE AUSWAHL', nodes: [{ ...selected, slot: `${selected.key}:focus` }] },
      { name: 'FÜHRT ZU / WIRD VERWENDET', nodes: graph.nodes.filter((node) => outgoing.has(node.key)).map((node) => ({ ...node, slot: `${node.key}:out` })) },
    ];
  } else {
    const max = Math.max(0, ...graph.nodes.map((node) => node.stage ?? 0));
    columns = Array.from({ length: max + 1 }, (_, stage) => ({ name: stage === 0 ? 'START & PAKETE' : `STUFE ${stage}`, nodes: graph.nodes.filter((node) => node.stage === stage) }));
    const unlinked = graph.nodes.filter((node) => node.stage === null);
    if (unlinked.length) columns.push({ name: 'OHNE HERSTELLUNGSWEG', nodes: unlinked });
  }
  const width = Math.max(760, columns.length * 250 + 40);
  const height = Math.max(420, ...columns.map((column) => column.nodes.length * 96 + 90));
  const nodes = columns.flatMap((column, i) => column.nodes.map((node, row) => ({ ...node, slot: node.slot || node.key, x: 25 + i * 250, y: 65 + row * 96, width: 206, height: 76 })));
  const edges = graph.edges.flatMap((edge) => {
    if (mode === 'relations' && edge.from !== selected?.key && edge.to !== selected?.key) return [];
    const from = nodes.find((node) => node.key === edge.from && (mode !== 'relations' || node.slot.endsWith(edge.from === selected?.key ? ':focus' : ':in')));
    const to = nodes.find((node) => node.key === edge.to && (mode !== 'relations' || node.slot.endsWith(edge.to === selected?.key ? ':focus' : ':out')));
    return from && to ? [{ ...edge, start: from, end: to }] : [];
  });
  return { width, height, nodes, edges, columns };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CATALOG } from '@stackfriends/shared/catalog.js';
import { buildCatalogGraph, layoutCatalogGraph } from '../src/lib/catalog-graph.js';
import { serializeCatalog } from '../src/lib/catalog-export.js';

test('the graph reads live package weights, counted ingredients, source outputs and recipe results', () => {
  const catalog = structuredClone(DEFAULT_CATALOG);
  catalog.packs.find((pack) => pack.id === 'farm').contents = [{ type: 'cow', weight: 1 }, { type: 'chicken', weight: 3 }];
  const graph = buildCatalogGraph(catalog);
  assert.ok(graph.edges.some((edge) => edge.from === 'packs:farm' && edge.to === 'cards:cow' && edge.label === '25 % pro Ziehung'));
  assert.ok(graph.edges.some((edge) => edge.from === 'cards:wood' && edge.to === 'recipes:axe' && edge.label === '5 × Zutat'));
  assert.ok(graph.edges.some((edge) => edge.from === 'recipes:axe' && edge.to === 'cards:axe'));
  assert.ok(graph.edges.some((edge) => edge.from === 'cards:tree' && edge.to === 'cards:wood' && edge.kind === 'source'));
});

test('progression requires every ingredient and cycles cannot bootstrap an unobtainable card', () => {
  const catalog = structuredClone(DEFAULT_CATALOG);
  catalog.packs = catalog.packs.filter((pack) => pack.id === 'basic');
  let graph = buildCatalogGraph(catalog);
  for (const key of ['cards:chicken', 'cards:egg', 'recipes:huhn', 'recipes:ei']) assert.equal(graph.nodes.find((node) => node.key === key).stage, null);
  assert.ok(graph.nodes.find((node) => node.key === 'cards:axe').stage > graph.nodes.find((node) => node.key === 'cards:wood').stage);
  catalog.packs.push(structuredClone(DEFAULT_CATALOG.packs.find((pack) => pack.id === 'farm')));
  graph = buildCatalogGraph(catalog);
  assert.equal(graph.nodes.find((node) => node.key === 'cards:chicken').stage, 1);
  assert.equal(graph.nodes.find((node) => node.key === 'cards:egg').stage, 2);
  const layout = layoutCatalogGraph(graph);
  assert.equal(layout.nodes.length, graph.nodes.length);
  assert.ok(layout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
});

test('relationships preserve both sides of cycles with distinct visual slots and dynamic loot chances', () => {
  const catalog = structuredClone(DEFAULT_CATALOG);
  catalog.cardTypes.cow.deathDrops = { chance: 50, outputs: [{ type: 'meat', count: 2, weight: 1 }] };
  const graph = buildCatalogGraph(catalog);
  assert.ok(graph.edges.some((edge) => edge.from === 'cards:cow' && edge.to === 'cards:meat' && edge.label === '2 × · 50 % nach dem Kampf'));
  const layout = layoutCatalogGraph(graph, { mode: 'relations', focus: 'cards:chicken' });
  assert.ok(layout.edges.some((edge) => edge.from === 'recipes:huhn' && edge.to === 'cards:chicken'));
  assert.ok(layout.edges.some((edge) => edge.from === 'cards:chicken' && edge.to === 'recipes:huhn'));
  assert.equal(new Set(layout.nodes.map((node) => node.slot)).size, layout.nodes.length);
});

test('JSON exports include the current complete draft but omit non-catalog state', () => {
  const catalog = structuredClone(DEFAULT_CATALOG);
  catalog.cardTypes.wood.name = 'Geänderter Entwurf';
  const output = JSON.parse(serializeCatalog({ ...catalog, sessions: { private: 'must-not-export' }, players: ['private'] }, new Date('2026-10-27T12:00:00Z')));
  assert.deepEqual(output.catalog, catalog);
  assert.equal(output.format, 'stackfriends-catalog');
  assert.equal(JSON.stringify(output).includes('must-not-export'), false);
});

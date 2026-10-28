import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Expand, GitBranch, Layers3, Minus, Package, Plus, Search, Settings2 } from 'lucide-react';
import GameArt from './GameArt.jsx';
import { buildCatalogGraph, layoutCatalogGraph } from '../lib/catalog-graph.js';
import '../catalog-tree.css';

const KINDS = { packs: 'Paket', cards: 'Karte', recipes: 'Kombination' };
const CATEGORIES = { resource: 'Rohstoff', food: 'Nahrung', source: 'Quelle', building: 'Gebäude', tool: 'Werkzeug', creature: 'Lebewesen', human: 'Mensch', enemy: 'Gegner', pack: 'Paket' };
const Icons = { packs: Package, cards: Layers3, recipes: Settings2 };

function edgePath({ start, end }) {
  const forward = end.x > start.x;
  const x1 = start.x + start.width, y1 = start.y + start.height / 2;
  const x2 = end.x, y2 = end.y + end.height / 2;
  if (forward) return `M ${x1} ${y1} C ${x1 + 65} ${y1}, ${x2 - 65} ${y2}, ${x2} ${y2}`;
  const bend = Math.min(start.y, end.y) - 18;
  return `M ${x1} ${y1} C ${x1 + 36} ${y1}, ${x1 + 36} ${bend}, ${x1} ${bend} L ${x2} ${bend} C ${x2 - 20} ${bend}, ${x2 - 20} ${y2}, ${x2} ${y2}`;
}

export default function CatalogTree({ catalog, focus, onFocus, view, onView, onEdit }) {
  const graph = useMemo(() => buildCatalogGraph(catalog), [catalog]);
  const selected = graph.nodes.find((node) => node.key === focus) || graph.nodes[0];
  const layout = useMemo(() => layoutCatalogGraph(graph, { mode: view, focus: selected?.key }), [graph, view, selected?.key]);
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(.7);
  const viewport = useRef(null);
  const panning = useRef(null);
  const history = useRef([]);
  const marker = `tree-arrow-${useId().replaceAll(':', '')}`;
  const connected = new Set([selected?.key, ...graph.edges.filter((edge) => edge.from === selected?.key || edge.to === selected?.key).flatMap((edge) => [edge.from, edge.to])]);
  const incoming = graph.edges.filter((edge) => edge.to === selected?.key);
  const outgoing = graph.edges.filter((edge) => edge.from === selected?.key);
  const matches = query.trim() ? graph.nodes.filter((node) => `${node.name} ${node.id}`.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de'))) : [];
  const index = new Map(graph.nodes.map((node) => [node.key, node]));
  function fit() {
    if (viewport.current) setZoom(Math.min(1, Math.max(.45, (viewport.current.clientWidth - 30) / layout.width)));
  }
  useEffect(() => { fit(); viewport.current?.scrollTo({ left: 0, top: 0 }); }, [view, layout.width]);
  function select(key) {
    if (selected?.key !== key) history.current.push(selected?.key);
    onFocus(key); setQuery('');
  }
  function show(key) {
    select(key);
    const node = layout.nodes.find((entry) => entry.key === key);
    if (node && view === 'progress') viewport.current?.scrollTo({ left: Math.max(0, node.x * zoom - 80), top: Math.max(0, node.y * zoom - 100), behavior: 'smooth' });
  }
  function relations(edges, direction) {
    return edges.length ? edges.map((edge) => {
      const node = index.get(direction === 'in' ? edge.from : edge.to);
      return <button type="button" key={edge.id} className="tree-relation" onClick={() => show(node.key)}><span className="tree-relation-art"><GameArt type={node.art} definition={catalog.cardTypes[node.art]} /></span><span><strong>{node.name}</strong><small>{edge.label}</small></span><ArrowRight size={14} /></button>;
    }) : <p className="tree-empty-relations">{direction === 'in' ? selected?.stage === 0 ? 'Am Spielstart oder direkt im Shop verfügbar.' : 'Kein Bezugs- oder Herstellungsweg hinterlegt.' : 'Keine weiteren Verbindungen hinterlegt.'}</p>;
  }
  return <section className="catalog-tree" aria-label="Spielbaum">
    <div className="tree-toolbar"><div><span className="settings-eyebrow">Eure Spielwelt im Zusammenhang</span><h2>Von der ersten Karte zur nächsten Idee.</h2><p>Wähle einen Eintrag, um Herkunft, Zutaten und Ergebnisse zu sehen.</p></div><div className="tree-view-switch" role="group" aria-label="Baumansicht"><button type="button" aria-pressed={view === 'progress'} onClick={() => onView('progress')}><GitBranch size={16} /> Fortschritt</button><button type="button" aria-pressed={view === 'relations'} onClick={() => onView('relations')}><Layers3 size={16} /> Zusammenhänge</button></div></div>
    <div className="tree-workspace"><div className="tree-map-panel">
      <div className="tree-map-toolbar"><label className="tree-search"><Search size={16} /><input aria-label="Im Spielbaum suchen" placeholder="Karte, Kombination oder Paket suchen …" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="tree-zoom"><button type="button" aria-label="Baum verkleinern" onClick={() => setZoom((value) => Math.max(.3, value - .1))}><Minus size={15} /></button><span>{Math.round(zoom * 100)} %</span><button type="button" aria-label="Baum vergrößern" onClick={() => setZoom((value) => Math.min(1.5, value + .1))}><Plus size={15} /></button><button type="button" aria-label="Baum einpassen" onClick={fit}><Expand size={15} /></button></div></div>
      {query.trim() && <div className="tree-search-results" aria-live="polite">{matches.length ? matches.map((node) => <button type="button" key={node.key} onClick={() => show(node.key)}>{node.name}<small>{KINDS[node.kind]}</small></button>) : <p>Kein passender Eintrag.</p>}</div>}
      <div className="tree-map-viewport" ref={viewport} role="region" aria-label="Verschiebbarer Kartenbaum" tabIndex={0}
        onPointerDown={(event) => { if (event.button !== 0 || event.target.closest('button')) return; panning.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (!panning.current) return; event.currentTarget.scrollLeft = panning.current.left - event.clientX + panning.current.x; event.currentTarget.scrollTop = panning.current.top - event.clientY + panning.current.y; }}
        onPointerUp={() => { panning.current = null; }} onPointerCancel={() => { panning.current = null; }} onLostPointerCapture={() => { panning.current = null; }}>
        <div style={{ width: layout.width * zoom, height: layout.height * zoom }}><div className="tree-map" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
          <svg className="tree-connections" width={layout.width} height={layout.height} aria-hidden="true"><defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M 0 0 L 7 3.5 L 0 7 Z" fill="context-stroke" /></marker></defs>{layout.edges.map((edge) => <path key={edge.id} d={edgePath(edge)} className={`${edge.from === selected?.key || edge.to === selected?.key ? 'is-connected' : ''} edge-${edge.kind}`} markerEnd={`url(#${marker})`}><title>{index.get(edge.from)?.name} → {index.get(edge.to)?.name}: {edge.label}</title></path>)}</svg>
          {layout.columns.map((column, i) => <span key={i} className="tree-column-title" style={{ left: 25 + i * 250 }}>{column.name}</span>)}
          {layout.nodes.map((node) => { const Icon = Icons[node.kind]; return <button type="button" key={node.slot} className={`tree-node tree-node--${node.kind} ${selected?.key === node.key ? 'is-selected' : ''} ${!connected.has(node.key) ? 'is-muted' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height, '--node-color': node.color || '#b4ceaa' }} aria-label={`${node.name}, ${KINDS[node.kind]}, Verbindungen anzeigen`} aria-pressed={selected?.key === node.key} onClick={() => select(node.key)}>
            <span className="tree-node-art"><GameArt type={node.art} definition={catalog.cardTypes[node.art]} /></span><span className="tree-node-copy"><small><Icon size={11} />{KINDS[node.kind]}</small><strong>{node.name}</strong><span>{node.kind === 'cards' ? CATEGORIES[node.detail] || node.detail : node.detail}</span></span>
          </button>; })}
        </div></div>
      </div>
      <div className="tree-map-footer"><span><i className="tree-legend-pack" /> Paket</span><span><i className="tree-legend-card" /> Karte</span><span><i className="tree-legend-recipe" /> Kombination</span><small>Freifläche ziehen · mit +/− zoomen</small></div>
      <p className="tree-explanation">{view === 'progress' ? 'Stufen zeigen den frühesten Herstellungsweg. Sie sind keine Freischaltsperren. Rückverbindungen bleiben bei Kreisläufen sichtbar.' : 'Links siehst du die Herkunft oder benötigte Karten, rechts die möglichen Ergebnisse und Verwendungen. Klicke dich durch die Verbindungen.'}</p>
    </div>
    {selected && <aside className="tree-inspector"><div className="tree-inspector-top"><button type="button" className="tree-history" disabled={!history.current.length} onClick={() => onFocus(history.current.pop())}><ArrowLeft size={14} /> Zurück</button><span className="settings-tag">{KINDS[selected.kind]}</span></div><div className="tree-inspector-art" style={{ background: `${selected.color || '#b4ceaa'}44` }}><GameArt type={selected.art} definition={catalog.cardTypes[selected.art]} /></div><h3>{selected.name}</h3><p className="tree-inspector-description">{selected.value.description || (selected.kind === 'recipes' ? `${selected.detail}. ${selected.value.keepIngredients?.length ? `${selected.value.keepIngredients.map((id) => catalog.cardTypes[id]?.name || id).join(', ')} bleibt erhalten; andere Zutaten werden verbraucht.` : 'Die Zutaten werden verbraucht.'}${selected.value.requiresHuman ? ' Der Mensch bleibt erhalten.' : ''}` : selected.detail)}</p><button type="button" className="settings-primary tree-edit" onClick={() => onEdit(selected.kind, selected.id)}><Settings2 size={15} /> {KINDS[selected.kind]} bearbeiten</button>
      <h4>Kommt aus / benötigt</h4>{relations(incoming, 'in')}
      <h4>Führt zu / wird verwendet</h4>{relations(outgoing, 'out')}
    </aside>}
    </div>
  </section>;
}

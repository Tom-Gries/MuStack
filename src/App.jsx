import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronRight, Coins, Hand, Heart, Leaf, Maximize2, Minus, MousePointer2, PackageOpen, Plus, RefreshCw, Settings, Sprout, Users, Wifi, WifiOff, X } from 'lucide-react';
import { CONFIG, getCardTypes, getCatalog, getPacks, getRecipes } from '@stackfriends/shared/catalog.js';
import { combatEnemyIds, combatHumanIds } from '@stackfriends/shared/combat.js';
import CardArt, { CatalogArtProvider } from './components/GameArt.jsx';
import CombatOverlay from './components/CombatOverlay.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import PackShop from './components/PackShop.jsx';
import RecipeBook from './components/RecipeBook.jsx';
import { useGame } from './useGame.js';
import { dragSelection, overlappingTarget } from './board.js';
import { creatureProfile } from '@stackfriends/shared/creatures.js';

const W = CONFIG.cardWidth;
const H = CONFIG.cardHeight;
const STACK = CONFIG.stackOffset;
const shortTime = (ms) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
  return `${seconds}s`;
};
function useNow(enabled, smooth = false) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    let frame;
    const update = () => { if (!document.hidden) setNow(Date.now()); if (smooth) frame = requestAnimationFrame(update); };
    if (smooth) frame = requestAnimationFrame(update);
    const interval = smooth ? null : setInterval(update, 1000);
    return () => { cancelAnimationFrame(frame); clearInterval(interval); };
  }, [enabled, smooth]);
  return enabled ? now : Date.now();
}
function clockAt(world, now, offset = 0) { return world.clock.elapsed + Math.max(0, now + offset - world.clock.lastAt); }
function realPosition(card, world, now, offset) {
  if (!card.motion) return { x: card.x, y: card.y };
  const m = card.motion;
  const amount = Math.max(0, Math.min(1, (clockAt(world, now, offset) - m.startedAt) / m.duration));
  return { x: m.fromX + (m.toX - m.fromX) * amount, y: m.fromY + (m.toY - m.fromY) * amount };
}

const GameCard = memo(function GameCard({ card, world, job, combat, own, index, count, preview, dragging, locked, offset, onPointerDown, onInspect, onActivate, tool }) {
  const CARD_TYPES = getCardTypes(world);
  const motionAnchor = world.cards.find((item) => item.stackId === card.stackId && item.motion);
  const now = useNow(Boolean(motionAnchor || job || card.type === 'field'), Boolean(motionAnchor));
  const definition = CARD_TYPES[card.type];
  const creature = creatureProfile(world, card);
  const position = preview || realPosition(motionAnchor || card, world, now, offset);
  const progressTime = job ? (job.timeBase === 'real' ? now + offset : clockAt(world, now, offset)) : 0;
  const progress = job ? Math.min(1, Math.max(0, (progressTime - job.startedAt) / job.duration)) : 0;
  const fieldReady = card.type === 'field' && now + offset >= card.readyAt;
  const name = card.name || card.packName || definition.name;
  const weaponBonus = tool && CARD_TYPES[tool.type]?.effects?.find((effect) => effect.kind === 'weapon')?.damage;
  let subtitle = definition.category === 'source' ? 'Rohstoffquelle' : ({ resource: 'Material', food: 'Nahrung', tool: 'Werkzeug', building: 'Gebäude', enemy: 'Gegner', human: 'Bewohner', pack: '3 Karten · zufällig' }[definition.category] || 'Karte');
  if (card.type === 'gold') subtitle = '1 Gold';
  if (card.type === 'pack') subtitle = `${card.cardsLeft ?? CONFIG.packSize} ${(card.cardsLeft ?? CONFIG.packSize) === 1 ? 'Karte' : 'Karten'} · anklicken`;
  if (card.type === 'piggyBank') subtitle = `${card.gold || 0} Gold gespeichert`;
  if (card.type === 'field') subtitle = fieldReady ? '10 Beeren · erntereif' : `Ernte in ${shortTime(card.readyAt - now - offset)}`;
  if (card.type === 'corpse') subtitle = 'Leiche · Totem folgt später';
  if (creature) subtitle = `${creature.aggressive ? 'Angreifend' : 'Friedlich'} · ${{ wander: 'rumlaufend', stationary: 'stehend', seek: 'zielsuchend' }[creature.behavior]}`;
  if (definition.effects?.some((effect) => effect.kind === 'weapon')) subtitle = `+${definition.effects.find((effect) => effect.kind === 'weapon').damage} Kampfschaden`;
  if (job) subtitle = job.kind === 'grow' ? 'Wächst zum Erdbeerfeld' : job.kind === 'craft' ? `${getRecipes(world).find((recipe) => recipe.id === job.recipeId)?.name || 'Bau'} entsteht` : 'Sammelt Rohstoffe';
  if (job?.kind === 'source') {
    const source = world.cards.find((item) => item.id === job.sourceId);
    const sources = world.cards.filter((item) => item.stackId === card.stackId && CARD_TYPES[item.type].category === 'source');
    if (sources.length > 1 && source) subtitle = `${CARD_TYPES[source.type].name} · ${sources.length} Quellen`;
  }
  return <div
    className={`card card--${definition.category} card-type-${card.type} ${dragging ? 'is-dragging' : ''} ${locked ? 'is-locked' : ''} ${own ? 'is-own' : ''} ${combat ? 'in-combat' : ''}`}
    style={{ '--card-color': card.packColor || definition.color, transform: `translate(${position.x}px, ${position.y + (preview ? (preview.itemOffset ?? (index - (preview.baseOrder || 0))) * STACK : index * STACK)}px)`, zIndex: dragging ? 10000 + index : preview ? 9000 + index : 10 + index }}
    data-card-id={card.id}
    onPointerDown={(event) => onPointerDown(event, card)}
    onDoubleClick={(event) => { event.stopPropagation(); if (!['piggyBank', 'pack'].includes(card.type)) onInspect(card); }}
    role={['pack', 'piggyBank'].includes(card.type) ? 'button' : 'group'} tabIndex={['pack', 'piggyBank'].includes(card.type) ? 0 : undefined}
    onKeyDown={(event) => { if (event.target === event.currentTarget && ['pack', 'piggyBank'].includes(card.type) && ['Enter', ' '].includes(event.key) && !event.repeat) { event.preventDefault(); onActivate(card); } }}
    aria-label={`${name}${card.type === 'human' ? `, ${card.hp} von 75 Leben` : creature ? `, ${card.hp ?? creature.hp} von ${creature.hp} Leben` : card.type === 'pack' ? `, ${card.cardsLeft ?? CONFIG.packSize} ${(card.cardsLeft ?? CONFIG.packSize) === 1 ? 'Karte' : 'Karten'}, anklicken zum Öffnen` : ''}`}
  >
    <div className="card-header"><span className="card-name" data-split="true" title="Hier teilen: diese Karte und alle darüber ziehen">{name}</span><span className="card-grip" title="Diese Karte und alle darüber bewegen" aria-label="Diese Karte und alle darüber bewegen">⠿</span></div>
    <button className="card-inspect" title={`${name} ansehen`} aria-label={`${name} ansehen`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onInspect(card)}><span>i</span></button>
    {count > 1 && index === 0 && <span className="stack-count">{count}</span>}
    {own && card.type === 'human' && <span className="own-label">DU</span>}
    <div className="card-art"><CardArt type={card.type} /></div>
    <div className="card-bottom">
      <span className="card-tag">{subtitle}</span>
      {card.type === 'human' && <div className="card-hp"><Heart size={11} fill="currentColor" /><span>{card.hp}<span className="muted"> / 75</span></span><div className="hp-track"><i style={{ width: `${card.hp / 75 * 100}%` }} /></div></div>}
      {creature && <div className="rat-hits">{Array.from({ length: Math.min(10, creature.hp) }, (_, i) => <span key={i} className={i < (card.hp ?? creature.hp) ? 'filled' : ''} />)}<span>{card.hp ?? creature.hp} / {creature.hp} Leben</span></div>}
      {card.remaining !== undefined && <div className="source-dots" title={`${card.remaining} Erträge übrig`}>{Array.from({ length: Math.min(20, Math.max(card.remaining, definition.effects?.find((effect) => effect.kind === 'source')?.uses || CONFIG.sourceUses)) }, (_, i) => <i key={i} className={i < card.remaining ? 'filled' : ''} />)}{card.remaining > 20 && <small>{card.remaining}</small>}</div>}
      {job && <div className="card-progress"><div className="progress-track"><i className="progress-fill" style={{ width: `${progress * 100}%` }} /></div><span>{shortTime(job.dueAt - progressTime)}</span></div>}
      {fieldReady && <div className="crop-ready" data-harvest={card.id} title="Beeren zum Ernten herausziehen"><Sprout size={12} /> Ernte herausziehen <ArrowUpRight size={11} /></div>}
    </div>
    {card.type === 'piggyBank' && <span className="piggy-hint">Klicken zum Entnehmen</span>}
    {tool && <div className="equipped-tool" data-tool-id={tool.id} title={`${CARD_TYPES[tool.type].name}${weaponBonus ? ` · +${weaponBonus} Schaden` : ''} · zum Ablegen ziehen`}><CardArt type={tool.type} /><span>{weaponBonus ? `+${weaponBonus}` : '×2'}</span></div>}
    {locked && <span className="lock-label"><Hand size={11} /> Wird bewegt</span>}
  </div>;
});

function Welcome({ onJoin, status, error, onRetry }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (event) => {
    event.preventDefault(); if (!name.trim() || busy) return;
    setBusy(true); setMessage('');
    try { await onJoin(name.trim()); } catch (err) { setMessage(err.message); } finally { setBusy(false); }
  };
  return <div className="welcome-backdrop"><section className="welcome-modal" aria-labelledby="welcome-title">
    <div className="welcome-art"><span className="welcome-stamp"><Leaf size={15} /> Ein gemeinsames Kartenabenteuer</span><div className="hero-card hero-card-tree"><div>Baum</div><CardArt type="tree" /></div><div className="hero-card hero-card-human"><div>Deine Geschichte</div><CardArt type="human" /></div><div className="hero-card hero-card-gold"><CardArt type="gold" /></div><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span><span className="welcome-art-caption">Aus kleinen Karten<br />wachsen große Geschichten.</span></div>
    <div className="welcome-copy"><span className="eyebrow">WILLKOMMEN BEI STACKFRIENDS</span><h1 id="welcome-title">Am Tisch ist<br />noch ein Platz.</h1><p>Sammelt, baut und entdeckt zusammen. Eine Welt, viele Hände – und deine eigene Karte mittendrin.</p>
      {error ? <div className="welcome-error"><WifiOff size={20} /><p>{error}</p><button className="primary-button" onClick={onRetry}><RefreshCw size={16} /> Erneut verbinden</button></div> : <form onSubmit={submit}>
        <label htmlFor="player-name">Wie heißt du?</label><input className="name-input" id="player-name" name="name" value={name} maxLength={24} autoComplete="nickname" autoFocus placeholder="Dein Name" onChange={(e) => setName(e.target.value)} disabled={busy || status === 'loading'} />
        {message && <span className="form-error" role="alert">{message}</span>}
        <button className="primary-button" type="submit" disabled={!name.trim() || busy || status === 'loading'}>{busy ? 'Deine Karte wird vorbereitet …' : 'An den Tisch setzen'}<ArrowUpRight size={17} /></button>
      </form>}
      <div className="welcome-note"><Users size={15} /><span>Alle spielen in derselben Welt.<br />Dein Name bleibt in diesem Browser gespeichert.</span></div>
    </div>
  </section></div>;
}

function Dialog({ title, onClose, children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const listener = (event) => { if (event.key === 'Escape') onClose(); if (event.key === 'Tab') { const nodes = [...ref.current.querySelectorAll('button, input, [tabindex="0"]')]; const first = nodes[0]; const last = nodes.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } };
    window.addEventListener('keydown', listener);
    return () => { window.removeEventListener('keydown', listener); previous?.focus(); };
  }, [onClose]);
  return <div className="dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={ref} tabIndex={-1} className={`dialog ${className}`} role="dialog" aria-modal="true" aria-label={title}><div className="dialog-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Schließen"><X size={20} /></button></div>{children}</section></div>;
}

function Help({ onClose }) {
  return <Dialog title="Ein kleiner Wegweiser" onClose={onClose}><p className="dialog-intro">Hier entsteht eure Welt. Alles beginnt mit einem Menschen und ein paar Goldkarten.</p><div className="help-grid">
    <div className="help-step"><MousePointer2 /><h3>Greifen & stapeln</h3><p>Die gegriffene Karte nimmt alle Karten mit, die auf ihr liegen. Am Namen wählst du, an welcher Stelle du den Stapel teilst.</p></div>
    <div className="help-step"><Coins /><h3>Neues entdecken</h3><p>Ziehe Goldkarten oder ein gefülltes Sparschwein zum gewünschten Paket rechts. Beim Schwein wird der offene Preis aus dem Guthaben bezahlt. Klickt das gekaufte Paket an – jeder Klick entdeckt eine Karte.</p></div>
    <div className="help-step"><Hand /><h3>Arbeit beginnt von selbst</h3><p>Lege einen Menschen auf einen Baum, Fels oder Beerenbusch. Mehrere Quellen im Stapel werden nacheinander abgearbeitet. Zutaten und Mensch ergeben neue Dinge.</p></div>
    <div className="help-step"><Heart /><h3>Aufeinander aufpassen</h3><p>Eine Beere heilt ein Leben. Ratten brauchen zwei Treffer. Bei null Leben bleibt eine Leiche zurück.</p></div>
  </div><div className="help-tip"><Sprout size={19} /><p>Boden + Beere wächst in einer Stunde zum Erdbeerfeld – auch offline. Es wartet höchstens eine Ernte mit zehn Beeren.</p></div><button className="primary-button" onClick={onClose}>Alles klar, los geht’s <Check size={17} /></button></Dialog>;
}

export default function App() {
  const game = useGame();
  const [settingsOpen, setSettingsOpen] = useState(() => location.hash === '#settings');
  const [settingsVisited, setSettingsVisited] = useState(() => location.hash === '#settings');
  useEffect(() => { if (settingsOpen) setSettingsVisited(true); }, [settingsOpen]);
  useEffect(() => {
    const change = () => setSettingsOpen(location.hash === '#settings');
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const [dialog, setDialog] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [expandedRecipe, setExpandedRecipe] = useState(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const viewport = useRef(null);
  const canvas = useRef(null);
  const cameraInitialized = useRef(false);
  const suppressClick = useRef(0);
  const { world, player } = game;
  const CARD_TYPES = getCardTypes(world);
  const RECIPES = getRecipes(world);
  const packs = getPacks(world);
  const connected = game.status === 'connected';
  const [showReconnect, setShowReconnect] = useState(false);
  useEffect(() => {
    if (!player || connected || game.status === 'paused' || game.status === 'offline') { setShowReconnect(false); return; }
    const timer = setTimeout(() => setShowReconnect(true), 2000);
    return () => clearTimeout(timer);
  }, [player?.id, connected, game.status]);
  const cards = world?.cards || [];
  const gold = cards.filter((c) => c.type === 'gold').length;
  const storedGold = cards.filter((c) => c.type === 'piggyBank').reduce((sum, c) => sum + (c.gold || 0), 0);
  const humanCount = cards.filter((c) => c.type === 'human').length;
  const inspect = typeof dialog === 'object' && dialog ? cards.find((c) => c.id === dialog.id) || dialog : null;
  const execute = useCallback(async (command, success) => {
    const knownIds = new Set(game.worldRef.current?.cards.map((card) => card.id) || []);
    try {
      const result = await game.command(command);
      if (success) game.notify(result.message || success);
      if (command.type === 'open-pack' || command.zone) {
        const discovered = game.worldRef.current?.cards.filter((card) => !knownIds.has(card.id)).at(-1);
        if (discovered) requestAnimationFrame(() => {
          const view = viewport.current;
          if (!view) return;
          const x = discovered.x * zoom, y = (discovered.y + discovered.order * STACK) * zoom;
          let left = view.scrollLeft, top = view.scrollTop;
          if (x < left + 20) left = Math.max(0, x - 20);
          if (x + W * zoom > left + view.clientWidth - 20) left = x + W * zoom - view.clientWidth + 20;
          if (y < top + 90) top = Math.max(0, y - 90);
          if (y + H * zoom > top + view.clientHeight - 90) top = y + H * zoom - view.clientHeight + 90;
          view.scrollTo({ left, top, behavior: 'smooth' });
        });
      }
      return result;
    }
    catch (err) { game.notify(err.message, 'error'); throw err; }
  }, [game.command, game.notify, game.worldRef, zoom]);
  const activateCard = useCallback((card) => {
    if (card.type === 'piggyBank') execute({ type: 'withdraw', cardId: card.id }).catch(() => {});
    if (card.type === 'pack') execute({ type: 'open-pack', cardId: card.id }).catch(() => {});
  }, [execute]);
  useEffect(() => {
    if (settingsOpen || cameraInitialized.current || !world || !player || !viewport.current) return;
    const width = viewport.current.clientWidth;
    if (!width) return;
    cameraInitialized.current = true;
    const nextZoom = Math.max(0.55, Math.min(1, (width - 40) / 900));
    setZoom(nextZoom);
    if (nextZoom < 1) {
      const own = world.cards.find((card) => card.ownerId === player.id);
      const goldCard = world.cards.find((card) => card.type === 'gold');
      const middle = own && goldCard ? (own.x + goldCard.x) / 2 + W / 2 : (own?.x || 400) + W / 2;
      viewport.current.scrollLeft = Math.max(0, middle * nextZoom - width / 2);
    }
  }, [world, player, settingsOpen]);
  const point = useCallback((event) => { const rect = canvas.current.getBoundingClientRect(); return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom }; }, [zoom]);

  const startDrag = useCallback((event, card) => {
    if (event.button !== 0 || creatureProfile(world, card)?.aggressive || !connected) return;
    const toolId = event.target.closest('[data-tool-id]')?.dataset.toolId;
    if (toolId) card = cards.find((item) => item.id === toolId) || card;
    const split = true;
    const takeAbove = !toolId;
    const existingLock = Object.values(game.locks).find((lock) => (lock.cardId === card.id || lock.cardIds?.includes(card.id)) && lock.playerId !== player?.id && lock.expiresAt > Date.now() + game.offset.current);
    if (existingLock) { game.notify('Diese Karte wird gerade von jemand anderem bewegt.'); return; }
    event.preventDefault(); event.stopPropagation();
    const origin = point(event);
    let position = realPosition(card, world, Date.now(), game.offset.current);
    if (toolId) { const rect = event.target.closest('[data-tool-id]').getBoundingClientRect(); const board = canvas.current.getBoundingClientRect(); position = { x: (rect.left - board.left) / zoom, y: (rect.top - board.top) / zoom }; }
    const ids = dragSelection(cards, card.id, split, takeAbove);
    const itemOffsets = Object.fromEntries(cards.filter((item) => ids.includes(item.id)).map((item) => [item.id, card.equippedTo ? 0 : item.order - card.order]));
    const value = { cardId: card.id, card, split, takeAbove, ids, itemOffsets, x: position.x, y: position.y + (split && !card.equippedTo ? card.order * STACK : 0), originX: position.x, originY: position.y + (split && !card.equippedTo ? card.order * STACK : 0), start: origin, clientX: event.clientX, clientY: event.clientY, moved: false, harvest: Boolean(event.target.closest('[data-harvest]')) };
    dragRef.current = value;
    game.send({ type: 'drag-start', cardId: card.id, split, takeAbove });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [connected, cards, world, player?.id, game.locks, game.send, game.notify, point]);

  useEffect(() => {
    const move = (event) => {
      if (panRef.current) {
        viewport.current.scrollLeft = panRef.current.scrollLeft - (event.clientX - panRef.current.x);
        viewport.current.scrollTop = panRef.current.scrollTop - (event.clientY - panRef.current.y);
      }
      const value = dragRef.current;
      if (!value) return;
      const next = point(event);
      if (!value.moved && Math.hypot(event.clientX - value.clientX, event.clientY - value.clientY) < 5) return;
      value.moved = true;
      value.x = Math.max(24, Math.min(CONFIG.worldWidth - W - 24, value.originX + next.x - value.start.x));
      value.y = Math.max(24, Math.min(CONFIG.worldHeight - H - 24, value.originY + next.y - value.start.y));
      setDrag({ ...value });
      game.dragPreview({ cardId: value.cardId, x: value.x, y: value.y, split: value.split, takeAbove: value.takeAbove });
      const target = document.elementsFromPoint(event.clientX, event.clientY).map((element) => element.closest('[data-drop-zone]')).find(Boolean);
      setHighlight(target?.dataset.dropZone === 'shop' ? `shop:${target.dataset.packId}` : target?.dataset.dropZone || null);
    };
    const finish = async (event) => {
      panRef.current = null;
      const value = dragRef.current;
      if (!value) return;
      dragRef.current = null; setHighlight(null);
      if (!value.moved) {
        setDrag(null); game.send({ type: 'drag-end', cardId: value.cardId });
        activateCard(value.card);
        return;
      }
      suppressClick.current = Date.now();
      const elements = document.elementsFromPoint(event.clientX, event.clientY);
      const zoneElement = elements.map((element) => element.closest('[data-drop-zone]')).find(Boolean);
      const zone = zoneElement?.dataset.dropZone;
      let targetId = elements.map((element) => element.closest('[data-card-id]')?.dataset.cardId).find((id) => id && !value.ids.includes(id));
      if (!zone && !targetId) {
        const bounds = canvas.current.getBoundingClientRect();
        const rect = { left: bounds.left + value.x * zoom, top: bounds.top + (value.y + (value.split ? 0 : value.card.order * STACK)) * zoom, width: W * zoom, height: H * zoom };
        const targets = [...canvas.current.querySelectorAll('[data-card-id]')].map((element) => ({ id: element.dataset.cardId, ...(() => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })() }));
        targetId = overlappingTarget(rect, targets, value.ids);
      }
      try {
        if (value.harvest) await execute({ type: 'harvest', cardId: value.cardId, x: value.x, y: value.y }, 'Zehn frische Beeren geerntet.');
        else await execute({ type: 'move', cardId: value.cardId, x: value.x, y: value.y, split: value.split, takeAbove: value.takeAbove, ...(targetId ? { targetId } : {}), ...(zone ? { zone, ...(zone === 'shop' ? { packId: zoneElement.dataset.packId } : {}) } : {}) }, zone === 'shop' ? 'Gold eingezahlt.' : zone === 'open' ? 'Neue Karten entdeckt.' : zone === 'sell' ? 'Karten gegen Gold verkauft.' : null);
      } catch { /* Error is displayed by execute. */ }
      finally { game.send({ type: 'drag-end', cardId: value.cardId }); setDrag(null); }
    };
    const cancel = () => { const value = dragRef.current; if (value) game.send({ type: 'drag-end', cardId: value.cardId }); dragRef.current = null; panRef.current = null; setDrag(null); setHighlight(null); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', cancel); window.addEventListener('blur', cancel);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); };
  }, [point, execute, activateCard, game.dragPreview, game.send, zoom]);

  const center = () => {
    const human = cards.find((c) => c.ownerId === player?.id) || cards[0];
    if (human && viewport.current) viewport.current.scrollTo({ left: Math.max(0, human.x * zoom - viewport.current.clientWidth / 2 + W / 2), top: Math.max(0, human.y * zoom - viewport.current.clientHeight / 2 + H / 2), behavior: 'smooth' });
  };
  const pan = (event) => { if (event.pointerType !== 'touch' && event.button === 0 && !event.target.closest('[data-card-id]')) { panRef.current = { x: event.clientX, y: event.clientY, scrollLeft: viewport.current.scrollLeft, scrollTop: viewport.current.scrollTop }; event.currentTarget.setPointerCapture?.(event.pointerId); } };
  const closeDialog = useCallback(() => setDialog(null), []);
  const showInspect = useCallback((card) => { if (Date.now() - suppressClick.current > 200) setDialog(card); }, []);
  const previewFor = (card) => {
    if (drag?.ids.includes(card.id)) return { x: drag.x, y: drag.y, itemOffset: drag.itemOffsets[card.id] || 0 };
    const remote = Object.values(game.previews).find((entry) => entry.cardId === card.id || entry.cardIds?.includes(card.id) || (!entry.split && cards.find((item) => item.id === entry.cardId)?.stackId === card.stackId));
    const selected = remote && cards.find((item) => item.id === remote.cardId);
    return remote && Date.now() - remote.receivedAt < 12000 ? { ...remote, baseOrder: card.equippedTo ? 0 : remote.split ? selected?.order || 0 : 0 } : null;
  };

  return <CatalogArtProvider value={CARD_TYPES}><div className="app">
    <header className="topbar"><a className="brand" href="#" onClick={(event) => { event.preventDefault(); if (!settingsOpen) center(); }} aria-label="StackFriends – zur eigenen Karte"><span className="brand-mark"><Leaf size={25} strokeWidth={1.5} /></span><span><strong>Stack<span>Friends</span></strong><small>GEMEINSAM WÄCHST ETWAS</small></span></a>
      <div className="header-right"><span className={`connection-status ${connected ? 'is-online' : ''}`} title={game.mode === 'cloud' ? 'Mit MongoDB verbunden' : 'Gemeinsame lokale Testwelt'}><i />{connected ? 'Welt verbunden' : game.status === 'paused' ? 'Verbindung pausiert' : game.status === 'offline' ? 'Offline' : game.status === 'reconnecting' ? 'Verbinde erneut …' : player ? 'Verbinde …' : 'Eine gemeinsame Welt'}</span><div className="header-divider" /><div className="online-badge"><div className="avatar-group">{game.online.slice(0, 3).map((person, i) => <span className="avatar" key={person.id || i} title={person.name}>{person.name?.slice(0, 1).toUpperCase() || '?'}</span>)}</div><Users size={16} /><span>{game.online.length || (player ? 1 : 0)} am Tisch</span></div>{player && <a className={`help-button settings-link ${settingsOpen ? 'is-active' : ''}`} href="#settings" aria-current={settingsOpen ? 'page' : undefined}><Settings size={17} /><span>Einstellungen</span></a>}<button className="help-button" onClick={() => setDialog('help')}><BookOpen size={17} /><span>Spielhilfe</span></button>{player && <span className="player-chip">{player.name}</span>}</div>
    </header>
    {player && settingsVisited && <div style={settingsOpen ? { display: 'contents' } : { display: 'none' }}><SettingsPage world={world} onSave={async (catalog, baseCatalogRevision) => { await execute({ type: 'catalog-save', catalog, baseCatalogRevision }, 'Einstellungen für alle gespeichert.'); return getCatalog(game.worldRef.current); }} onClose={() => { location.hash = ''; }} /></div>}
    <main className="workspace" style={settingsOpen && player ? { display: 'none' } : undefined}>
      <section className="board-shell" aria-label="Gemeinsames Spielfeld">
        <div className="board-toolbar"><div><span className="eyebrow">UNSERE WELT</span><h1>Die Lichtung <span>V.01</span></h1></div><div className="world-stats"><span><Coins size={16} />{gold + storedGold}<small>Gold</small></span><span><Users size={16} />{humanCount}<small>Bewohner</small></span><div className="zoom-controls"><button onClick={() => setZoom((z) => Math.max(0.55, +(z - 0.15).toFixed(2)))} title="Verkleinern" aria-label="Verkleinern"><Minus size={15} /></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((z) => Math.min(1.45, +(z + 0.15).toFixed(2)))} title="Vergrößern" aria-label="Vergrößern"><Plus size={15} /></button><button onClick={center} title="Zu meiner Karte" aria-label="Zu meiner Karte"><Maximize2 size={15} /></button></div></div></div>
        {showReconnect && <div className="connection-banner"><WifiOff size={15} /> Verbindung wird wiederhergestellt. Dein Spielstand bleibt erhalten.</div>}
        <div className="viewport" ref={viewport} onPointerDown={pan} aria-label="Spielwelt, Freifläche zum Verschieben ziehen"><div style={{ width: CONFIG.worldWidth * zoom, height: CONFIG.worldHeight * zoom }}><div className="world" ref={canvas} style={{ width: CONFIG.worldWidth, height: CONFIG.worldHeight, transform: `scale(${zoom})` }}>
          <div className="table-watermark"><Leaf size={24} /><span>Platz für neue Geschichten.</span></div>
          <CombatOverlay world={world} offset={game.offset.current} />
          {cards.filter((card) => !card.equippedTo || drag?.cardId === card.id || Object.values(game.previews).some((preview) => preview.cardId === card.id)).map((card) => {
            const stack = card.equippedTo ? [card] : cards.filter((c) => c.stackId === card.stackId && !c.equippedTo).sort((a, b) => a.order - b.order);
            const index = stack.findIndex((c) => c.id === card.id);
            const job = world.jobs.find((item) => item.cardIds?.includes(card.id)) || (index === stack.length - 1 ? world.jobs.find((item) => item.kind === 'source' && cards.find((source) => source.id === item.sourceId)?.stackId === card.stackId) : null);
            const combat = world.combats.find((item) => combatHumanIds(item).includes(card.id) || combatEnemyIds(item).includes(card.id));
            const lock = Object.values(game.locks).find((item) => (item.cardId === card.id || item.cardIds?.includes(card.id)) && item.playerId !== player?.id);
            const tool = cards.find((c) => c.id === card.toolId && drag?.cardId !== c.id && !Object.values(game.previews).some((entry) => entry.cardId === c.id));
            return <GameCard key={card.id} card={card} world={world} job={job} combat={combat} own={card.ownerId === player?.id} index={index} count={stack.length} preview={previewFor(card)} dragging={Boolean(drag?.ids.includes(card.id))} locked={Boolean(lock)} offset={game.offset.current} onPointerDown={startDrag} onInspect={showInspect} onActivate={activateCard} tool={tool} />;
          })}
        </div></div></div>
        {player && cards.length <= 10 && <div className="empty-note"><span className="note-number">01</span><p>Ein Anfang voller Möglichkeiten.<br /><strong>Ziehe Gold zum Basicpaket – einzeln oder als Stapel.</strong></p><ArrowUpRight size={21} /></div>}
        <div className="board-footer"><div className="board-caption"><MousePointer2 size={15} /><span>Karte + alle darüber ziehen <i>·</i> Am Namen teilen</span></div><div className="board-dropzones"><div className={`drop-zone open-zone ${highlight === 'open' ? 'zone-highlight' : ''}`} data-drop-zone="open"><PackageOpen size={22} /><span>Paket öffnen<small>Ablegen: alle übrigen Karten</small></span><ArrowDownToLine size={16} /></div><div className={`drop-zone sell-zone ${highlight === 'sell' ? 'zone-highlight' : ''}`} data-drop-zone="sell"><Coins size={22} /><span>Verkaufen<small>Karten gegen Gold</small></span><ArrowDownToLine size={16} /></div></div></div>
      </section>
      <aside className="sidebar" aria-label="Pakete und Rezepte">
        <PackShop packs={packs} definitions={CARD_TYPES} payments={world?.shopPayments} legacyPaid={world?.shopPaid} highlightedPackId={highlight?.startsWith('shop:') ? highlight.slice(5) : null} />
        <RecipeBook recipes={RECIPES} definitions={CARD_TYPES} expanded={expandedRecipe} onExpand={setExpandedRecipe} />
        <footer className="sidebar-footer"><span><Leaf size={13} /> Zusammen geht mehr.</span><small>STACKFRIENDS · V1</small></footer>
      </aside>
    </main>
    {game.status === 'offline' && <div className="connection-banner"><WifiOff size={15} /> Du bist offline. Sobald dein Internet zurück ist, geht es weiter.</div>}
    {(!game.loaded || !player) && <Welcome onJoin={game.join} status={game.status} error={game.error} onRetry={game.reload} />}
    {dialog === 'help' && <Help onClose={closeDialog} />}
    {inspect && <Dialog title={inspect.name || CARD_TYPES[inspect.type].name} onClose={closeDialog} className="card-detail"><div className="detail-art" style={{ background: CARD_TYPES[inspect.type].color }}><CardArt type={inspect.type} /></div><p>{CARD_TYPES[inspect.type].description}</p><div className="detail-stats">{inspect.hp !== undefined && <span><Heart size={16} />{inspect.hp} / {creatureProfile(world, inspect)?.hp ?? CONFIG.humanHp} Leben</span>}<span><Coins size={16} />{CARD_TYPES[inspect.type].sellPrice ? `${CARD_TYPES[inspect.type].sellPrice} Gold Verkaufswert` : 'Nicht verkaufbar'}</span></div>{inspect.toolId && <button className="secondary-button" onClick={() => execute({ type: 'unequip', cardId: inspect.id }, 'Werkzeug abgelegt.').catch(() => {})}>Werkzeug ablegen <ArrowUpRight size={15} /></button>}</Dialog>}
    <div className="toast-stack" aria-live="polite">{game.toasts.map((toast) => <div className={`toast toast--${toast.kind}`} key={toast.id}>{toast.kind === 'error' ? <X size={17} /> : <Check size={17} />}<span>{toast.message}</span></div>)}</div>
  </div></CatalogArtProvider>;
}

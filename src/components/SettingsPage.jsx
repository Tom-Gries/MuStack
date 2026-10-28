import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, CircleHelp, Download, GitBranch, Layers3, Package, Plus, Save, Search, Settings2, Trash2, X } from 'lucide-react';
import { DEFAULT_CREATURE, DEFAULT_RAT_DROPS, getCatalog, getCardTypes, getRecipes, getPacks } from '@stackfriends/shared/catalog.js';
import { ART_LIBRARY } from '@stackfriends/shared/art-library.js';
import GameArt from './GameArt.jsx';
import CatalogTree from './CatalogTree.jsx';
import { downloadCatalog } from '../lib/catalog-export.js';
import '../settings.css';

const PROTECTED = new Set(['human', 'gold', 'pack', 'rat', 'soil', 'field', 'piggyBank', 'corpse']);
const CATEGORIES = { resource: 'Rohstoff', food: 'Nahrung', source: 'Quelle', building: 'Gebäude', tool: 'Werkzeug', creature: 'Lebewesen', human: 'Mensch', enemy: 'Gegner', pack: 'Paket' };
const EDITABLE_CATEGORIES = ['resource', 'food', 'source', 'building', 'tool', 'creature'];
const ART = ['human', 'gold', 'pack', 'tree', 'rock', 'berryBush', 'wood', 'stick', 'stone', 'flint', 'berry', 'rat', 'soil', 'field', 'piggyBank', 'warehouse', 'axe', 'pickaxe', 'bone', 'meat', 'corpse'];
const TABS = [{ id: 'tree', label: 'Spielbaum', icon: GitBranch }, { id: 'cards', label: 'Karten', icon: Layers3 }, { id: 'recipes', label: 'Kombinationen', icon: Settings2 }, { id: 'packs', label: 'Pakete', icon: Package }];
const copy = (value) => JSON.parse(JSON.stringify(value));
const fingerprint = (value) => JSON.stringify({ cardTypes: value.cardTypes, recipes: value.recipes, packs: value.packs });
const slug = (value) => value.toLowerCase().replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
const entriesOf = (catalog, tab) => tab === 'cards' ? Object.entries(catalog.cardTypes).map(([id, entry]) => ({ ...entry, id })) : catalog[tab] || [];
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const percent = (weight, total) => `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(total > 0 ? number(weight) / total * 100 : 0)} %`;
const durationText = (ms) => number(ms) >= 60_000 ? `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(number(ms) / 60_000)} Min.` : `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(number(ms) / 1000)} Sek.`;

function catalogFrom(world) {
  const catalog = getCatalog(world);
  const result = copy({ ...catalog, cardTypes: catalog.cardTypes || getCardTypes(world), recipes: catalog.recipes || getRecipes(world), packs: catalog.packs || getPacks(world) });
  if (result.cardTypes.rat && result.cardTypes.rat.deathDrops === undefined) result.cardTypes.rat.deathDrops = copy(DEFAULT_RAT_DROPS);
  return result;
}

function CardSelect({ value, onChange, cards, label, disabled = false, allowEmpty = false }) {
  return <select aria-label={label} value={value || ''} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
    {allowEmpty && <option value="">Bitte auswählen</option>}
    {Object.entries(cards).map(([id, card]) => <option key={id} value={id}>{card.name}</option>)}
  </select>;
}

function Field({ label, hint, children, className = '' }) {
  return <label className={`settings-field ${className}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function NumberInput({ value, onChange, label, min = 0, max, step = 1, disabled = false }) {
  return <input type="number" aria-label={label} min={min} max={max} step={step} disabled={disabled} value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))} />;
}

function validate(catalog) {
  const cards = catalog.cardTypes;
  const positive = (value) => Number.isFinite(value) && value > 0;
  for (const [id, card] of Object.entries(cards)) {
    if (!card.name?.trim()) return `Die Karte „${id}“ braucht einen Namen.`;
    if (!Number.isInteger(card.sellPrice) || card.sellPrice < 0 || card.sellPrice > 1000) return `Der Verkaufspreis von „${card.name}“ muss eine ganze Zahl zwischen 0 und 1000 sein.`;
    if (!/^#[a-f\d]{6}$/i.test(card.color || '')) return `Bitte wähle eine gültige Farbe für „${card.name}“.`;
    if (card.deathDrops && (!Number.isFinite(card.deathDrops.chance) || card.deathDrops.chance < 0 || card.deathDrops.chance > 100 || card.deathDrops.chance > 0 && !card.deathDrops.outputs?.length || card.deathDrops.outputs?.some((row) => !cards[row.type] || row.type === 'human' || !positive(row.weight) || !Number.isInteger(row.count) || row.count < 1 || row.count > 30))) return `Prüfe die Beute von „${card.name}“: 0 bis 100 % Chance, vorhandene Karte, Anzahl von 1 bis 30 und Gewicht größer als 0.`;
    for (const effect of card.effects || []) {
      if (effect.kind === 'source') {
        if (card.category !== 'source' || PROTECTED.has(id)) return `„${card.name}“ braucht für den Abbaueffekt die Kategorie „Quelle“. Entferne den Effekt, um eine andere Kategorie zu verwenden.`;
        if (!Number.isInteger(effect.duration) || effect.duration < 1000 || effect.duration > 604_800_000 || !Number.isInteger(effect.uses) || effect.uses < 1 || effect.uses > 1000) return `„${card.name}“ braucht eine Arbeitsdauer zwischen 1 Sekunde und 7 Tagen sowie 1 bis 1000 Durchläufe.`;
        if (!effect.outputs?.length || effect.outputs.some((row) => !cards[row.type] || !positive(row.weight) || !Number.isInteger(row.count) || row.count < 1 || row.count > 30)) return `Prüfe die Beute von „${card.name}“: vorhandene Karte, Anzahl von 1 bis 30 und Gewicht größer als 0.`;
      }
      if (effect.kind === 'heal' && (!Number.isInteger(effect.amount) || effect.amount < 1 || effect.amount > 75)) return `Die Heilung von „${card.name}“ muss zwischen 1 und 75 Lebenspunkten liegen.`;
      if (effect.kind === 'tool' && (!positive(effect.multiplier) || effect.multiplier < 0.05 || effect.multiplier > 10 || !effect.sourceTypes?.length || effect.sourceTypes.some((type) => !cards[type]))) return `„${card.name}“ braucht mindestens eine Quelle und einen Zeitfaktor zwischen 0,05 und 10.`;
      if (effect.kind === 'tool' && card.category !== 'tool') return `„${card.name}“ braucht für den Werkzeugeffekt die Kategorie „Werkzeug“. Entferne den Effekt, um eine andere Kategorie zu verwenden.`;
      if (effect.kind === 'weapon' && (card.category !== 'tool' || !Number.isInteger(effect.damage) || effect.damage < 1 || effect.damage > 100)) return `„${card.name}“ braucht für den Waffeneffekt die Kategorie „Werkzeug“ und 1 bis 100 zusätzlichen Schaden.`;
    }
  }
  for (const recipe of catalog.recipes) {
    if (!recipe.name?.trim()) return `Die Kombination „${recipe.id}“ braucht einen Namen.`;
    if (!Object.keys(recipe.ingredients || {}).length || Object.entries(recipe.ingredients).some(([type, count]) => !cards[type] || type === 'human' || !Number.isInteger(count) || count < 1 || count > 100)) return `Prüfe die Zutaten von „${recipe.name}“: vorhandene Karte mit ganzer Anzahl von 1 bis 100. Nutze für Menschen das Feld „Mensch arbeitet mit“.`;
    if (!cards[recipe.result] || !Number.isInteger(recipe.resultCount ?? 1) || (recipe.resultCount ?? 1) < 1 || (recipe.resultCount ?? 1) > 30) return `Prüfe das Ergebnis von „${recipe.name}“: 1 bis 30 Karten sind möglich.`;
    if (!Number.isInteger(recipe.duration) || recipe.duration < 1000 || recipe.duration > 604_800_000) return `Die Dauer von „${recipe.name}“ muss zwischen 1 Sekunde und 7 Tagen liegen.`;
  }
  for (const pack of catalog.packs) {
    if (!pack.name?.trim()) return `Das Paket „${pack.id}“ braucht einen Namen.`;
    if (!Number.isInteger(pack.price) || pack.price < 1 || pack.price > 1000 || !Number.isInteger(pack.size) || pack.size < 1 || pack.size > 30) return `„${pack.name}“ braucht einen Goldpreis von 1 bis 1000 und 1 bis 30 Karten.`;
    if (!/^#[a-f\d]{6}$/i.test(pack.color || '')) return `Bitte wähle eine gültige Farbe für „${pack.name}“.`;
    if (!pack.contents?.length || pack.contents.some((row) => !cards[row.type] || !positive(row.weight))) return `Prüfe den Inhalt von „${pack.name}“: vorhandene Karte und Gewicht größer als 0.`;
  }
  return '';
}

function referenceReason(id, catalog, world) {
  if (PROTECTED.has(id)) return 'Diese Karte gehört zu einer festen Spielmechanik und kann nicht gelöscht werden.';
  if (world?.cards?.some((card) => card.type === id)) return 'Diese Karte liegt noch in der gemeinsamen Welt.';
  const recipe = catalog.recipes.find((item) => item.result === id || Object.hasOwn(item.ingredients || {}, id));
  if (recipe) return `Wird in der Kombination „${recipe.name}“ verwendet.`;
  const pack = catalog.packs.find((item) => item.contents?.some((row) => row.type === id));
  if (pack) return `Ist im Paket „${pack.name}“ enthalten.`;
  if (['berry', 'bone', 'meat'].includes(id)) return 'Diese Karte wird für die bestehende Ernte- oder Kampfmechanik gebraucht.';
  if (world?.cards?.some((card) => card.packContents?.some((row) => row.type === id))) return 'Diese Karte kann noch in einem bereits gekauften Paket liegen.';
  const other = Object.entries(catalog.cardTypes).find(([key, card]) => key !== id && (card.creature?.target === id || card.deathDrops?.outputs?.some((row) => row.type === id) || card.effects?.some((effect) => effect.outputs?.some((row) => row.type === id) || effect.sourceTypes?.includes(id))));
  return other ? `Wird vom Effekt der Karte „${other[1].name}“ verwendet.` : '';
}

function WeightedRows({ rows, onChange, cards: allCards, counts = false }) {
  const cards = Object.fromEntries(Object.entries(allCards).filter(([id]) => id !== 'human'));
  const total = rows.reduce((sum, row) => sum + Math.max(0, number(row.weight)), 0);
  const unused = Object.keys(cards).find((id) => !rows.some((row) => row.type === id));
  return <div className="settings-weighted">
    <div className={`settings-row-labels ${counts ? 'has-count' : ''}`}><span>Karte</span>{counts && <span>Anzahl</span>}<span>Gewicht</span><span>Chance</span><span /></div>
    {rows.map((row, index) => <div className={`settings-weight-row ${counts ? 'has-count' : ''}`} key={index}>
      <CardSelect cards={Object.fromEntries(Object.entries(cards).filter(([id]) => id === row.type || !rows.some((item) => item.type === id)))} value={row.type} label={`Karte für Eintrag ${index + 1}`} onChange={(type) => onChange(rows.map((item, i) => i === index ? { ...item, type } : item))} />
      {counts && <NumberInput label={`Anzahl für Eintrag ${index + 1}`} min={1} max={30} value={row.count} onChange={(count) => onChange(rows.map((item, i) => i === index ? { ...item, count } : item))} />}
      <NumberInput label={`Gewicht für Eintrag ${index + 1}`} min={0.01} step="any" value={row.weight} onChange={(weight) => onChange(rows.map((item, i) => i === index ? { ...item, weight } : item))} />
      <span className="settings-chance">{percent(row.weight, total)}</span>
      <button className="settings-remove-row" type="button" aria-label={`Eintrag ${index + 1} entfernen`} onClick={() => onChange(rows.filter((_, i) => i !== index))}><X size={15} /></button>
    </div>)}
    <button type="button" className="settings-text-button" disabled={!unused || rows.length >= (counts ? 30 : 200)} onClick={() => onChange([...rows, { type: unused, weight: 1, ...(counts ? { count: 1 } : {}) }])}><Plus size={15} /> Karte hinzufügen</button>
    <p className="settings-hint">Gewichte bestimmen die Chance. 1 und 3 entsprechen zum Beispiel 25 % und 75 %.</p>
  </div>;
}

function EffectEditor({ card, onChange, cards }) {
  const effects = card.effects || [];
  const labels = { source: 'Quelle abbauen', heal: 'Menschen heilen', tool: 'Abbauzeit verändern', weapon: 'Kampfschaden erhöhen' };
  const available = Object.keys(labels).filter((kind) => !effects.some((effect) => effect.kind === kind) && (kind !== 'source' || card.category === 'source' && !PROTECTED.has(card.id)) && (!['tool', 'weapon'].includes(kind) || card.category === 'tool') && (kind !== 'heal' || !['human', 'corpse'].includes(card.id)));
  const sources = Object.entries(cards).filter(([, entry]) => entry.effects?.some((effect) => effect.kind === 'source'));
  function add(kind) {
    const effect = kind === 'source' ? { kind, duration: 10_000, uses: 5, outputs: [{ type: cards.wood ? 'wood' : Object.keys(cards)[0], count: 1, weight: 1 }] } : kind === 'heal' ? { kind, amount: 1 } : kind === 'weapon' ? { kind, damage: 1 } : { kind, sourceTypes: sources.slice(0, 1).map(([id]) => id), multiplier: 0.5 };
    onChange({ effects: [...effects, effect] });
  }
  return <section className="settings-section">
    <div className="settings-section-title"><h3>Was kann diese Karte?</h3><span className="settings-tag">{effects.length ? `${effects.length} Effekte` : 'Kein zusätzlicher Effekt'}</span></div>
    {effects.map((effect, index) => {
      const setEffect = (changes) => onChange({ effects: effects.map((entry, i) => i === index ? { ...entry, ...changes } : entry) });
      const known = Object.hasOwn(labels, effect.kind);
      return <div className="settings-effect" key={`${effect.kind}-${index}`}>
        <div className="settings-effect-heading"><h4>{labels[effect.kind] || 'Bestehende Spielmechanik'}</h4>{known && <button type="button" className="settings-remove-row" aria-label={`${labels[effect.kind]} entfernen`} onClick={() => onChange({ effects: effects.filter((_, i) => i !== index) })}><X size={15} /></button>}</div>
        {!known && <p className="settings-hint">Diese besondere Spielmechanik bleibt unverändert erhalten.</p>}
        {effect.kind === 'source' && <><div className="settings-fields two"><Field label="Dauer je Durchlauf (Sekunden)" hint="1 Sekunde bis 7 Tage (604800 Sekunden)."><NumberInput label="Dauer je Durchlauf in Sekunden" min={1} max={604800} step="any" value={effect.duration / 1000} onChange={(value) => setEffect({ duration: value === '' ? '' : value * 1000 })} /></Field><Field label="Durchläufe bis zum Verschwinden" hint="1 bis 1000 Durchläufe."><NumberInput label="Durchläufe bis zum Verschwinden" min={1} max={1000} value={effect.uses} onChange={(uses) => setEffect({ uses })} /></Field></div><h4 className="settings-subheading">Mögliche Beute pro Durchlauf</h4><WeightedRows cards={cards} rows={effect.outputs || []} counts onChange={(outputs) => setEffect({ outputs })} /></>}
        {effect.kind === 'heal' && <Field label="Geheilte Lebenspunkte" hint="1 bis 75 Leben. Die Karte wird auf einen lebenden Menschen gezogen und dabei verbraucht."><NumberInput label="Geheilte Lebenspunkte" min={1} max={75} value={effect.amount} onChange={(amount) => setEffect({ amount })} /></Field>}
        {effect.kind === 'weapon' && <Field label="Zusätzlicher Kampfschaden" hint="Ein Mensch verursacht ohne Waffe 1 Schaden. Das ausgerüstete Werkzeug erhöht diesen Wert."><NumberInput label="Zusätzlicher Kampfschaden" min={1} max={100} value={effect.damage} onChange={(damage) => setEffect({ damage })} /></Field>}
        {effect.kind === 'tool' && <><Field label="Zeitfaktor" hint="0,5 halbiert die Abbauzeit, 2 verdoppelt sie. Erlaubt sind 0,05 bis 10."><NumberInput label="Zeitfaktor" min={0.05} max={10} step="any" value={effect.multiplier} onChange={(multiplier) => setEffect({ multiplier })} /></Field><fieldset className="settings-checkbox-list"><legend>Wirkt auf diese Quellen</legend>{sources.map(([id, entry]) => <label key={id}><input type="checkbox" checked={effect.sourceTypes?.includes(id) || false} onChange={(event) => setEffect({ sourceTypes: event.target.checked ? [...(effect.sourceTypes || []), id] : (effect.sourceTypes || []).filter((item) => item !== id) })} /><span>{entry.name}</span></label>)}{!sources.length && <p className="settings-hint">Lege zuerst eine Karte mit einem Quelle-Effekt an.</p>}</fieldset></>}
      </div>;
    })}
    {available.length > 0 && <Field label="Weiteren Effekt hinzufügen"><select value="" onChange={(event) => event.target.value && add(event.target.value)}><option value="">Effekt auswählen …</option>{available.map((kind) => <option value={kind} key={kind}>{labels[kind]}</option>)}</select></Field>}
    {!effects.length && <p className="settings-hint">Diese Karte hat noch keinen zusätzlichen Effekt. Weitere Möglichkeiten können später ergänzt werden.</p>}
    {PROTECTED.has(card.id) && <p className="settings-note"><CircleHelp size={15} /> Einige Funktionen dieser Karte sind im Spiel fest verankert. Diese Grundfunktionen sind hier noch nicht einstellbar.</p>}
  </section>;
}

function ArtPicker({ card, cards, onChange }) {
  const selectedImage = ART_LIBRARY.find((image) => image.id === card.art);
  const otherIllustrations = ART.filter((id) => !ART_LIBRARY.some((image) => image.id === id));
  const selectedOther = card.art && !selectedImage;
  return <fieldset className="settings-art-picker">
    <legend>Vorhandene Kartenbilder</legend>
    <p className="settings-hint">Wähle eines der vorhandenen Bilder für diese Karte.</p>
    <div className="settings-art-library">
      {ART_LIBRARY.map((image) => <label className={`settings-art-option ${card.art === image.id ? 'is-selected' : ''}`} key={image.id}>
        <input type="radio" name={`card-image-${card.id}`} value={image.id} checked={card.art === image.id} onChange={() => onChange({ art: image.id })} />
        <span className="settings-art-thumbnail"><GameArt type={image.id} definition={{ art: image.id }} /></span>
        <span className="settings-art-caption"><strong>{image.name}</strong>{card.art === image.id && <Check size={14} aria-label="Ausgewählt" />}</span>
      </label>)}
      <label className={`settings-art-option settings-art-symbol ${!card.art ? 'is-selected' : ''}`}>
        <input type="radio" name={`card-image-${card.id}`} value="" checked={!card.art} onChange={() => onChange({ art: '' })} />
        <span className="settings-art-thumbnail"><span>{card.icon || '✦'}</span></span>
        <span className="settings-art-caption"><strong>Nur Symbol</strong>{!card.art && <Check size={14} aria-label="Ausgewählt" />}</span>
      </label>
    </div>
    <p className="settings-art-current" aria-live="polite">{selectedImage ? `Ausgewählt: ${selectedImage.name}` : !card.art ? 'Ausgewählt: Nur Symbol' : `Ausgewählt: ${cards[card.art]?.name || card.art} (Illustration)`}</p>
    {otherIllustrations.length > 0 && <details className="settings-art-more" open={Boolean(selectedOther)}><summary>Weitere Illustrationen</summary><Field label="Illustration auswählen"><select value={selectedOther ? card.art : ''} onChange={(event) => event.target.value && onChange({ art: event.target.value })}><option value="" disabled>Andere Illustration auswählen …</option>{otherIllustrations.map((id) => <option key={id} value={id}>{cards[id]?.name || id}</option>)}</select></Field></details>}
  </fieldset>;
}

function CreatureEditor({ card, cards, onChange }) {
  const creature = card.creature || (card.id === 'rat' ? { ...DEFAULT_CREATURE, aggressive: true, behavior: 'seek', speed: 35 } : DEFAULT_CREATURE);
  const change = (values) => onChange({ creature: { ...creature, ...values } });
  return <section className="settings-section"><div className="settings-section-title"><h3>Lebewesen</h3><span className="settings-tag">Verhalten</span></div>
    <label className="settings-toggle"><input type="checkbox" checked={creature.aggressive} onChange={(event) => change({ aggressive: event.target.checked })} /><span><strong>Angreifend</strong><small>{creature.aggressive ? 'Beginnt in Reichweite eines Menschen von selbst einen Kampf.' : 'Friedlich: beginnt von selbst keinen Kampf. Ein Mensch auf dieser Karte provoziert einen Kampf.'}</small></span></label>
    <div className="settings-fields two"><Field label="Bewegung"><select value={creature.behavior} onChange={(event) => change({ behavior: event.target.value })}><option value="wander">Rumlaufend</option><option value="stationary">Stehend</option><option value="seek">Zielsuchend</option></select></Field><Field label="Laufgeschwindigkeit" hint="Pixel pro aktiver Spielsekunde."><NumberInput label="Laufgeschwindigkeit" min={1} max={100} value={creature.speed} onChange={(speed) => change({ speed })} /></Field></div>
    {creature.behavior === 'seek' && <Field label="Gesuchte Karte"><CardSelect value={creature.target} label="Gesuchte Karte" cards={cards} onChange={(target) => change({ target })} /></Field>}
    <div className="settings-fields two"><Field label="Lebenspunkte"><NumberInput label="Lebenspunkte des Lebewesens" min={1} max={1000} value={creature.hp} onChange={(hp) => change({ hp })} /></Field><Field label="Schaden pro Angriff"><NumberInput label="Schaden pro Angriff" min={0} max={100} value={creature.damage} onChange={(damage) => change({ damage })} /></Field></div>
    <Field label="Abstand zwischen Angriffen (Sekunden)"><NumberInput label="Abstand zwischen Angriffen in Sekunden" min={.5} max={60} step={.5} value={creature.attackInterval / 1000} onChange={(value) => change({ attackInterval: value * 1000 })} /></Field>
  </section>;
}

function DeathDropEditor({ card, cards, onChange }) {
  const drops = card.deathDrops ?? (card.id === 'rat' ? DEFAULT_RAT_DROPS : { chance: 0, outputs: [] });
  const change = (values) => onChange({ deathDrops: { ...drops, ...values } });
  return <section className="settings-section"><div className="settings-section-title"><h3>Beute beim Tod</h3><span className="settings-tag">Nach dem Kampf</span></div>
    <Field label="Chance auf Beute (%)" hint="0 %: keine Beute. 100 %: immer Beute. Bei Erfolg wird ein Eintrag nach seinen Gewichten ausgewählt."><NumberInput label="Chance auf Beute in Prozent" min={0} max={100} step="any" value={drops.chance} onChange={(chance) => change({ chance })} /></Field>
    <WeightedRows cards={cards} rows={drops.outputs} counts onChange={(outputs) => change({ outputs })} />
    <p className="settings-hint">Die Anzahl gilt für die ausgewählte Karte. Die angezeigten Gewichte verteilen sich auf erfolgreiche Beuteziehungen. Das Lebewesen verschwindet beim Tod; die Beute entsteht einmal pro besiegtem Gegner.</p>
  </section>;
}

function CardEditor({ card, cards, onChange }) {
  const lockedCategory = PROTECTED.has(card.id) || !EDITABLE_CATEGORIES.includes(card.category);
  const unsellable = ['human', 'gold', 'rat', 'corpse'].includes(card.id);
  return <>
    <section className="settings-section"><div className="settings-section-title"><h3>Die Karte</h3><span className="settings-tag">{card.id}</span></div>
      <Field label="Name"><input value={card.name} maxLength={60} onChange={(event) => onChange({ name: event.target.value })} /></Field>
      <Field label="Beschreibung"><textarea rows={3} value={card.description || ''} maxLength={600} onChange={(event) => onChange({ description: event.target.value })} placeholder="Was sollen die Mitspieler über diese Karte wissen?" /></Field>
      <div className="settings-fields two"><Field label="Kategorie" hint={lockedCategory ? 'Für diese Spielmechanik festgelegt.' : undefined}><select disabled={lockedCategory} value={card.category} onChange={(event) => onChange({ category: event.target.value, ...(event.target.value === 'creature' ? { creature: { ...DEFAULT_CREATURE, ...card.creature } } : { deathDrops: undefined }) })}>{Object.entries(CATEGORIES).filter(([id]) => EDITABLE_CATEGORIES.includes(id) || id === card.category).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field><Field label="Verkaufspreis (Gold)" hint={unsellable ? 'Diese Karte bleibt unverkäuflich.' : '0 bis 1000 Gold.'}><NumberInput label="Verkaufspreis in Gold" max={1000} disabled={unsellable} value={card.sellPrice} onChange={(sellPrice) => onChange({ sellPrice })} /></Field></div>
    </section>
    {(card.category === 'creature' || card.id === 'rat') && <CreatureEditor card={card} cards={cards} onChange={onChange} />}
    {(card.category === 'creature' || card.id === 'rat') && <DeathDropEditor card={card} cards={cards} onChange={onChange} />}
    <section className="settings-section"><div className="settings-section-title"><h3>Aussehen</h3></div>
      <div className="settings-fields two"><Field label="Kartenfarbe"><div className="settings-color"><input type="color" aria-label="Kartenfarbe auswählen" value={card.color || '#b4ceaa'} onChange={(event) => onChange({ color: event.target.value })} /><input aria-label="Kartenfarbe als Hexwert" value={card.color || ''} maxLength={7} onChange={(event) => onChange({ color: event.target.value })} /></div></Field><Field label="Symbol"><input value={card.icon || ''} maxLength={12} onChange={(event) => onChange({ icon: event.target.value })} placeholder="✦" /></Field></div>
      <ArtPicker card={card} cards={cards} onChange={onChange} />
    </section>
    <EffectEditor card={card} cards={cards} onChange={onChange} />
  </>;
}

function RecipeEditor({ recipe, cards, onChange }) {
  const rows = Object.entries(recipe.ingredients || {});
  const updateRow = (index, type, count) => {
    const next = rows.map(([oldType, oldCount], i) => i === index ? [type ?? oldType, count ?? oldCount] : [oldType, oldCount]);
    onChange({ ingredients: Object.fromEntries(next), ...(recipe.keepIngredients ? { keepIngredients: recipe.keepIngredients.map((id) => id === rows[index][0] ? type ?? id : id) } : {}) });
  };
  const ingredientCards = Object.fromEntries(Object.entries(cards).filter(([id]) => id !== 'human'));
  const unused = Object.keys(ingredientCards).find((id) => !Object.hasOwn(recipe.ingredients || {}, id));
  return <>
    <section className="settings-section"><div className="settings-section-title"><h3>Die Kombination</h3><span className="settings-tag">{recipe.id}</span></div><Field label="Name"><input value={recipe.name} maxLength={60} onChange={(event) => onChange({ name: event.target.value })} /></Field></section>
    <section className="settings-section"><div className="settings-section-title"><h3>Zutaten auf dem Stapel</h3></div>
      <div className="settings-ingredients">{rows.map(([type, count], index) => <div className="settings-ingredient-row" key={index}>
        <CardSelect cards={Object.fromEntries(Object.entries(ingredientCards).filter(([id]) => id === type || !Object.hasOwn(recipe.ingredients || {}, id)))} value={type} label={`Zutat ${index + 1}`} onChange={(next) => updateRow(index, next, count)} />
        <NumberInput label={`Anzahl der Zutat ${index + 1}`} min={1} max={100} value={count} onChange={(next) => updateRow(index, type, next)} />
        <button type="button" className="settings-remove-row" aria-label={`Zutat ${index + 1} entfernen`} onClick={() => onChange({ ingredients: Object.fromEntries(rows.filter((_, i) => i !== index)), ...(recipe.keepIngredients ? { keepIngredients: recipe.keepIngredients.filter((id) => id !== type) } : {}) })}><X size={15} /></button>
      </div>)}</div>
      <button type="button" className="settings-text-button" disabled={!unused} onClick={() => onChange({ ingredients: { ...recipe.ingredients, [unused]: 1 } })}><Plus size={15} /> Zutat hinzufügen</button>
      <fieldset className="settings-checkbox-list"><legend>Zutaten, die erhalten bleiben</legend>{rows.map(([type]) => <label key={type}><input type="checkbox" checked={recipe.keepIngredients?.includes(type) || false} onChange={(event) => onChange({ keepIngredients: event.target.checked ? [...(recipe.keepIngredients || []), type] : (recipe.keepIngredients || []).filter((id) => id !== type) })} /><span>{cards[type]?.name || type} bleibt erhalten</span></label>)}</fieldset>
      <label className="settings-toggle"><input type="checkbox" checked={recipe.requiresHuman !== false} onChange={(event) => onChange({ requiresHuman: event.target.checked })} /><span><strong>Mensch arbeitet mit</strong><small>Der Mensch wird für die Kombination gebraucht und bleibt erhalten.</small></span></label>
    </section>
    <section className="settings-section"><div className="settings-section-title"><h3>Ergebnis & Zeit</h3></div>
      <div className="settings-fields result"><Field label="Ergebniskarte"><CardSelect cards={ingredientCards} value={recipe.result} label="Ergebniskarte" onChange={(result) => onChange({ result })} /></Field><Field label="Anzahl"><NumberInput min={1} max={30} label="Anzahl der Ergebniskarten" value={recipe.resultCount ?? 1} onChange={(resultCount) => onChange({ resultCount })} /></Field></div>
      <div className="settings-fields two"><Field label="Dauer (Sekunden)" hint="1 bis 604800 Sekunden (7 Tage)."><NumberInput min={1} max={604800} step="any" label="Kombinationsdauer in Sekunden" value={recipe.duration / 1000} onChange={(value) => onChange({ duration: value === '' ? '' : value * 1000 })} /></Field><Field label="Zeit zählt"><select value={recipe.timeBase || 'world'} onChange={(event) => onChange({ timeBase: event.target.value })}><option value="world">Während jemand mitspielt</option><option value="real">Auch wenn niemand online ist</option></select></Field></div>
      <p className="settings-hint">Nicht markierte Zutaten werden beim Abschluss verbraucht. Alle Zutaten müssen gemeinsam gestapelt sein.</p>
    </section>
  </>;
}

function PackEditor({ pack, cards, onChange }) {
  return <>
    <section className="settings-section"><div className="settings-section-title"><h3>Das Paket</h3><span className="settings-tag">{pack.id}</span></div>
      <Field label="Name"><input value={pack.name} maxLength={60} onChange={(event) => onChange({ name: event.target.value })} /></Field><Field label="Beschreibung"><textarea rows={3} value={pack.description || ''} maxLength={600} onChange={(event) => onChange({ description: event.target.value })} /></Field>
      <div className="settings-fields two"><Field label="Preis (Gold)" hint="1 bis 1000 Gold."><NumberInput label="Paketpreis in Gold" min={1} max={1000} value={pack.price} onChange={(price) => onChange({ price })} /></Field><Field label="Karten je Paket" hint="1 bis 30 Karten."><NumberInput label="Karten je Paket" min={1} max={30} value={pack.size} onChange={(size) => onChange({ size })} /></Field></div>
      <Field label="Paketfarbe"><div className="settings-color"><input type="color" aria-label="Paketfarbe auswählen" value={pack.color || '#b4ceaa'} onChange={(event) => onChange({ color: event.target.value })} /><input aria-label="Paketfarbe als Hexwert" value={pack.color || ''} maxLength={7} onChange={(event) => onChange({ color: event.target.value })} /></div></Field>
    </section>
    <section className="settings-section"><div className="settings-section-title"><h3>Mögliche Karten</h3><span className="settings-tag">Zufällige Ziehung</span></div><WeightedRows rows={pack.contents || []} cards={cards} onChange={(contents) => onChange({ contents })} /><p className="settings-hint">Jeder Klick auf ein gekauftes Paket zieht eine Karte. Dieselbe Karte kann in einem Paket mehrfach vorkommen.</p></section>
  </>;
}

function Preview({ tab, item, cards }) {
  if (!item) return null;
  const isCard = tab === 'cards';
  const visual = isCard ? item : tab === 'packs' ? { ...item, art: 'pack', icon: '▣' } : cards[item.result];
  const ingredients = tab === 'recipes' ? Object.entries(item.ingredients || {}) : [];
  const total = item.contents?.reduce((sum, row) => sum + Math.max(0, number(row.weight)), 0);
  return <aside className="settings-preview"><span className="settings-eyebrow">Vorschau</span>
    <div className="settings-preview-card" style={{ '--preview-color': visual?.color || '#b4ceaa' }}><div className="settings-preview-card-head"><span>{isCard ? CATEGORIES[item.category] : tab === 'packs' ? 'Paket' : 'Ergebnis'}</span><span>{visual?.icon || '✦'}</span></div><div className="settings-preview-art"><GameArt type={isCard ? item.id : tab === 'packs' ? 'pack' : item.result} definition={visual} /></div><strong>{visual?.name || item.name}</strong><span className="settings-preview-bottom">{tab === 'packs' ? `${item.size} Karten` : isCard ? `${item.sellPrice} Gold · Verkauf` : `${item.resultCount ?? 1} × Ergebnis`}</span></div>
    <h3>{item.name || 'Ohne Namen'}</h3>{item.description && <p>{item.description}</p>}
    {tab === 'recipes' && <div className="settings-preview-recipe">{ingredients.map(([type, count]) => <span key={type}>{count} × {cards[type]?.name || type}{item.keepIngredients?.includes(type) ? ' (bleibt)' : ''}</span>)}{item.requiresHuman !== false && <span>+ Mensch</span>}<i><ChevronRight size={17} /> {durationText(item.duration)}</i><strong>{item.resultCount ?? 1} × {cards[item.result]?.name || item.result}</strong><small>{item.timeBase === 'real' ? 'Läuft auch offline weiter' : 'Pausiert ohne Mitspieler'}</small></div>}
    {tab === 'packs' && <div className="settings-preview-contents"><strong>{item.price} Gold pro Paket</strong>{(item.contents || []).map((row, index) => <div key={index}><span>{cards[row.type]?.icon} {cards[row.type]?.name || row.type}</span><b>{percent(row.weight, total)}</b></div>)}</div>}
    {isCard && (item.effects || []).map((effect, index) => effect.kind === 'source' ? <div className="settings-preview-fact" key={index}><Layers3 size={17} /><span>{effect.uses} Durchläufe mit je {durationText(effect.duration)}</span></div> : effect.kind === 'heal' ? <div className="settings-preview-fact" key={index}><span>♥</span><span>Heilt {effect.amount} Lebenspunkte</span></div> : effect.kind === 'tool' ? <div className="settings-preview-fact" key={index}><Settings2 size={17} /><span>Zeitfaktor {effect.multiplier} für {effect.sourceTypes?.length || 0} Quellen</span></div> : null)}
    {isCard && (item.effects || []).filter((effect) => effect.kind === 'weapon').map((effect) => <div className="settings-preview-fact" key="weapon"><Settings2 size={17} /><span>+{effect.damage} Kampfschaden bei ausgerüstetem Menschen</span></div>)}
    <div className="settings-preview-note"><CircleHelp size={17} /><p>Gespeicherte Einstellungen gelten für die gemeinsame Welt und alle Mitspieler.</p></div>
  </aside>;
}

export default function SettingsPage({ world, onSave, onClose, onDirtyChange }) {
  const latest = useMemo(() => catalogFrom(world), [world?.catalog]);
  const [draft, setDraft] = useState(() => copy(latest));
  const [baseline, setBaseline] = useState(() => fingerprint(latest));
  const [baseRevision, setBaseRevision] = useState(latest.revision || 0);
  const [tab, setTab] = useState('tree');
  const [treeFocus, setTreeFocus] = useState(`packs:${latest.packs[0]?.id || 'basic'}`);
  const [treeView, setTreeView] = useState('progress');
  const [returnToTree, setReturnToTree] = useState(false);
  const [cardOverview, setCardOverview] = useState(true);
  const [selection, setSelection] = useState({ cards: Object.keys(latest.cardTypes)[0], recipes: latest.recipes[0]?.id, packs: latest.packs[0]?.id });
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(null);
  const [removeId, setRemoveId] = useState(null);
  const [closePrompt, setClosePrompt] = useState(false);
  const isDirty = fingerprint(draft) !== baseline;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const entries = entriesOf(draft, tab);
  const selected = entries.find((item) => item.id === selection[tab]) || entries[0];
  const visible = entries.filter((item) => `${item.name} ${item.id}`.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')));
  const stale = (latest.revision || 0) !== baseRevision;
  const paid = selected && tab === 'packs' ? world?.shopPayments?.[selected.id] ?? (selected.id === 'basic' ? world?.shopPaid : 0) ?? 0 : 0;
  const deleteReason = selected && tab === 'cards' ? referenceReason(selected.id, draft, world) : selected && tab === 'packs' && selected.id === 'basic' ? 'Das Basicpaket ist das Standardpaket der gemeinsamen Welt.' : paid > 0 ? 'Dieses Paket ist bereits angezahlt. Schließe den Kauf ab, bevor du es löschst.' : '';

  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!dirtyRef.current) {
      setDraft(copy(latest)); setBaseline(fingerprint(latest)); setBaseRevision(latest.revision || 0);
    }
  }, [latest]);
  useEffect(() => {
    function guard(event) { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } }
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  function update(changes) {
    setNotice(null);
    setDraft((current) => tab === 'cards' ? { ...current, cardTypes: { ...current.cardTypes, [selected.id]: { ...current.cardTypes[selected.id], ...changes } } } : { ...current, [tab]: current[tab].map((item) => item.id === selected.id ? { ...item, ...changes } : item) });
  }
  function reset() { setDraft(copy(latest)); setBaseline(fingerprint(latest)); setBaseRevision(latest.revision || 0); setNotice(null); setClosePrompt(false); }
  async function save() {
    const error = validate(draft);
    if (error) { setNotice({ kind: 'error', text: error }); return; }
    setSaving(true); setNotice(null);
    try {
      const result = await onSave(copy(draft), baseRevision);
      const saved = result?.cardTypes ? result : result?.catalog?.cardTypes ? result.catalog : { ...draft, revision: baseRevision + 1 };
      setDraft(copy(saved)); setBaseline(fingerprint(saved)); setBaseRevision(saved.revision ?? baseRevision + 1);
      setNotice({ kind: 'success', text: 'Gespeichert. Die gemeinsame Welt verwendet jetzt diese Einstellungen.' });
    } catch (error) { setNotice({ kind: 'error', text: error?.message || 'Die Einstellungen konnten nicht gespeichert werden. Dein Entwurf bleibt erhalten.' }); }
    finally { setSaving(false); }
  }
  function addItem() {
    const id = creating.id.trim();
    if (!/^[a-z][A-Za-z0-9_-]{0,47}$/.test(id) || ['constructor', 'prototype', '__proto__'].includes(id)) { setCreating({ ...creating, error: 'Die Kennung muss mit einem kleinen Buchstaben beginnen und darf nur Buchstaben, Zahlen, _ und - enthalten. Reservierte Kennungen sind nicht möglich.' }); return; }
    if (!creating.name.trim()) { setCreating({ ...creating, error: 'Bitte gib einen Namen ein.' }); return; }
    if (entriesOf(draft, tab).some((item) => item.id === id)) { setCreating({ ...creating, error: 'Diese Kennung ist bereits vergeben.' }); return; }
    const name = creating.name.trim();
    const first = draft.cardTypes.wood ? 'wood' : Object.keys(draft.cardTypes).find((id) => !PROTECTED.has(id)) || Object.keys(draft.cardTypes)[0];
    const item = tab === 'cards' ? { name, category: creating.category, description: '', color: '#b4ceaa', icon: '✦', art: '', sellPrice: 1, effects: [] } : tab === 'recipes' ? { id, name, ingredients: { [draft.cardTypes.wood ? 'wood' : first]: 1 }, duration: 10_000, result: first, resultCount: 1, requiresHuman: true, timeBase: 'world' } : { id, name, description: '', color: '#b4ceaa', price: 3, size: 3, contents: [{ type: first, weight: 1 }] };
    setDraft((current) => tab === 'cards' ? { ...current, cardTypes: { ...current.cardTypes, [id]: item } } : { ...current, [tab]: [...current[tab], item] });
    setSelection((current) => ({ ...current, [tab]: id })); setCreating(null); setNotice(null); setQuery('');
    if (tab === 'cards') setCardOverview(false);
  }
  function remove() {
    if (!selected || deleteReason) return;
    const remaining = entries.filter((item) => item.id !== selected.id);
    setDraft((current) => {
      if (tab !== 'cards') return { ...current, [tab]: current[tab].filter((item) => item.id !== selected.id) };
      const next = { ...current.cardTypes }; delete next[selected.id]; return { ...current, cardTypes: next };
    });
    setSelection((current) => ({ ...current, [tab]: remaining[0]?.id })); setRemoveId(null); setNotice(null);
    if (tab === 'cards') setCardOverview(true);
  }
  function switchTab(next) { setTab(next); setQuery(''); setRemoveId(null); setCreating(null); setReturnToTree(false); if (next === 'cards') setCardOverview(true); }
  function editFromTree(kind, id) { switchTab(kind); setSelection((current) => ({ ...current, [kind]: id })); setCardOverview(false); setReturnToTree(true); }

  return <main className="settings-page">
    <header className="settings-header"><div className="settings-heading"><button type="button" className="settings-back" aria-label="Zurück zum Spiel" onClick={() => isDirty ? setClosePrompt(true) : onClose()}><ArrowLeft size={19} /></button><div><span className="settings-eyebrow">StackFriends · Gemeinsam gestalten</span><h1>Werkstatt-Einstellungen</h1></div></div><div className="settings-save-area"><span className={`settings-save-status ${isDirty ? 'is-dirty' : ''}`}><i />{saving ? 'Wird gespeichert …' : isDirty ? 'Ungespeicherter Entwurf' : 'Alle Änderungen gespeichert'}</span><button type="button" className="settings-secondary" disabled={saving} title="Exportiert den aktuellen Entwurf einschließlich ungespeicherter Änderungen als JSON." onClick={() => downloadCatalog(copy(draft))}><Download size={17} /> Katalog exportieren</button><button type="button" className="settings-primary" disabled={!isDirty || saving} onClick={save}><Save size={17} /> {saving ? 'Speichert …' : 'Änderungen speichern'}</button></div></header>
    <div className="settings-intro"><p>Neue Karten, neue Möglichkeiten.</p><span>Gestalte Karten, Stapelrezepte und die Pakete im Shop. Änderungen werden mit dem Speichern für alle übernommen.</span></div>
    <nav className="settings-tabs" aria-label="Einstellungsbereiche">{TABS.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={tab === id ? 'is-active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => switchTab(id)}><Icon size={17} />{label}{id !== 'tree' && <span>{id === 'cards' ? Object.keys(draft.cardTypes).length : draft[id].length}</span>}</button>)}</nav>
    {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`settings-notice ${notice.kind}`}>{notice.kind === 'success' ? <Check size={17} /> : <CircleHelp size={17} />}<span>{notice.text}</span><button aria-label="Meldung schließen" type="button" onClick={() => setNotice(null)}><X size={16} /></button></div>}
    {stale && isDirty && <div className="settings-notice warning"><CircleHelp size={17} /><span>Die Einstellungen wurden inzwischen geändert. Lade den aktuellen Stand, bevor du deinen Entwurf speicherst.</span><button type="button" onClick={reset}>Aktuellen Stand laden</button></div>}
    {tab === 'tree' ? <CatalogTree catalog={draft} focus={treeFocus} onFocus={setTreeFocus} view={treeView} onView={setTreeView} onEdit={editFromTree} /> : tab === 'cards' && cardOverview ? <section className="settings-card-overview">
      <div className="settings-overview-toolbar"><div><h2>Eure Karten</h2><p>Karte auswählen, um sie zu bearbeiten.</p></div><label className="settings-search"><Search size={16} /><input aria-label="Karten durchsuchen" placeholder="Name oder Kennung suchen …" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button type="button" className="settings-primary" onClick={() => setCreating({ name: '', id: '', category: 'resource', touchedId: false })}><Plus size={16} /> Neue Karte</button></div>
      <div className="settings-card-grid">{visible.map((card) => <button type="button" className="settings-card-tile" key={card.id} aria-label={`${card.name} bearbeiten`} onClick={() => { setSelection((current) => ({ ...current, cards: card.id })); setRemoveId(null); setCardOverview(false); }}>
        <span className="settings-card-tile-header" style={{ background: card.color }}>{CATEGORIES[card.category] || card.category}<ChevronRight size={14} /></span><span className="settings-card-tile-art"><GameArt type={card.id} definition={card} /></span><strong>{card.name}</strong><small>{card.sellPrice ? `${card.sellPrice} Gold` : 'Unverkäuflich'}{card.creature ? ` · ${card.creature.aggressive ? 'Angreifend' : 'Friedlich'}` : ''}</small>
      </button>)}</div>{!visible.length && <p className="settings-list-empty">Keine passende Karte gefunden.</p>}
    </section> : <div className={`settings-layout ${tab === 'cards' ? 'is-card-edit' : ''}`}>
      {tab !== 'cards' && <aside className="settings-library"><div className="settings-library-top"><h2>{TABS.find((item) => item.id === tab).label}</h2><button type="button" className="settings-add" onClick={() => setCreating({ name: '', id: '', category: 'resource', touchedId: false })}><Plus size={16} /> Neu</button></div><label className="settings-search"><Search size={16} /><input aria-label={`${TABS.find((item) => item.id === tab).label} durchsuchen`} placeholder="Suchen …" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="settings-library-list">{visible.map((item) => <button type="button" key={item.id} className={`settings-library-item ${selected?.id === item.id ? 'is-active' : ''}`} onClick={() => { setSelection((current) => ({ ...current, [tab]: item.id })); setRemoveId(null); }}><span className="settings-mini-card" style={{ backgroundColor: item.color || draft.cardTypes[item.result]?.color || '#e2e6d7' }}>{item.icon || (tab === 'recipes' ? '⚒' : '▣')}</span><span><strong>{item.name || 'Ohne Namen'}</strong><small>{tab === 'recipes' ? durationText(item.duration) : `${item.price} Gold · ${item.size} Karten`}</small></span><ChevronRight size={15} /></button>)}{!visible.length && <p className="settings-list-empty">{query ? 'Kein passender Eintrag.' : 'Hier ist noch Platz für deine erste Idee.'}</p>}</div><p className="settings-library-foot">Ein Entwurf für die ganze Welt.</p></aside>}
      <div className="settings-editor" key={`${tab}-${selected?.id}`}>
        {returnToTree && <button type="button" className="settings-overview-back" onClick={() => setTab('tree')}><GitBranch size={16} /> Zum Spielbaum</button>}
        {tab === 'cards' && <button type="button" className="settings-overview-back" onClick={() => setCardOverview(true)}><ArrowLeft size={16} /> Alle Karten</button>}
        {selected ? <><div className="settings-editor-heading"><div><span className="settings-eyebrow">{tab === 'cards' ? 'Karte bearbeiten' : tab === 'recipes' ? 'Kombination bearbeiten' : 'Paket bearbeiten'}</span><h2>{selected.name || 'Ohne Namen'}</h2></div><button type="button" className="settings-delete" disabled={Boolean(deleteReason) || saving} title={deleteReason || 'Eintrag löschen'} aria-label={`${selected.name} löschen`} onClick={() => setRemoveId(selected.id)}><Trash2 size={17} /></button></div>
          {removeId === selected.id && <div className="settings-delete-confirm" role="alert"><p>„{selected.name}“ aus dem Entwurf löschen?</p><div><button type="button" onClick={() => setRemoveId(null)}>Behalten</button><button type="button" onClick={remove}>Löschen</button></div></div>}
          {deleteReason && <p className="settings-protected"><CircleHelp size={14} /> {deleteReason}</p>}
          <fieldset className="settings-editor-fields" disabled={saving}>{tab === 'cards' ? <CardEditor card={selected} cards={draft.cardTypes} onChange={update} /> : tab === 'recipes' ? <RecipeEditor recipe={selected} cards={draft.cardTypes} onChange={update} /> : <PackEditor pack={selected} cards={draft.cardTypes} onChange={update} />}</fieldset>
        </> : <div className="settings-empty"><Plus size={29} /><h2>Die nächste Idee beginnt hier.</h2><p>Erstelle einen Eintrag, um ihn zu gestalten.</p><button type="button" className="settings-primary" onClick={() => setCreating({ name: '', id: '', category: 'resource', touchedId: false })}><Plus size={17} /> Neu erstellen</button></div>}
      </div>
      <Preview tab={tab} item={selected} cards={draft.cardTypes} />
    </div>}
    {(creating || closePrompt) && <div className="settings-dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title" className="settings-dialog">{creating ? <><button type="button" className="settings-dialog-close" aria-label="Erstellen abbrechen" onClick={() => setCreating(null)}><X size={18} /></button><span className="settings-eyebrow">Etwas Neues für StackFriends</span><h2 id="settings-dialog-title">{tab === 'cards' ? 'Neue Karte' : tab === 'recipes' ? 'Neue Kombination' : 'Neues Paket'}</h2><form onSubmit={(event) => { event.preventDefault(); addItem(); }}><Field label="Name"><input autoFocus value={creating.name} maxLength={60} onChange={(event) => setCreating({ ...creating, name: event.target.value, id: creating.touchedId ? creating.id : slug(event.target.value) })} placeholder={tab === 'cards' ? 'Zum Beispiel: Apfelbaum' : tab === 'recipes' ? 'Zum Beispiel: Holzbank' : 'Zum Beispiel: Waldgeflüster'} /></Field><Field label="Kennung" hint="Die Kennung bleibt nach dem Erstellen fest. Sie wird intern für Verknüpfungen verwendet."><input value={creating.id} maxLength={48} onChange={(event) => setCreating({ ...creating, id: event.target.value, touchedId: true })} placeholder="apfelbaum" /></Field>{tab === 'cards' && <Field label="Kategorie"><select value={creating.category} onChange={(event) => setCreating({ ...creating, category: event.target.value })}>{EDITABLE_CATEGORIES.map((id) => <option key={id} value={id}>{CATEGORIES[id]}</option>)}</select></Field>}{creating.error && <p role="alert" className="settings-inline-error">{creating.error}</p>}<div className="settings-dialog-actions"><button type="button" className="settings-secondary" onClick={() => setCreating(null)}>Abbrechen</button><button type="submit" className="settings-primary"><Plus size={16} /> Erstellen</button></div></form></> : <><span className="settings-eyebrow">Dein Entwurf ist noch offen</span><h2 id="settings-dialog-title">Zurück zum Spiel?</h2><p>Die Änderungen sind noch nicht gespeichert. Du kannst weiterarbeiten oder den Entwurf verwerfen.</p><div className="settings-dialog-actions"><button type="button" className="settings-secondary" onClick={() => setClosePrompt(false)}>Weiter bearbeiten</button><button type="button" className="settings-primary" onClick={() => { reset(); onClose(); }}>Entwurf verwerfen</button></div></>}</section></div>}
  </main>;
}

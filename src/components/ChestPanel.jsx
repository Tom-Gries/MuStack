import React, { memo, useEffect, useMemo, useRef } from 'react';
import { ArrowDownToLine, ArrowUpRight, Box, X } from 'lucide-react';
import CardArt from './GameArt.jsx';

/** A nonmodal window leaves the board available for dragging materials in. */
export default memo(function ChestPanel({ chest, definitions, highlighted, enabled, onClose, onRetrieve, onDragItem }) {
  const closeButton = useRef(null);
  useEffect(() => {
    closeButton.current?.focus();
    const escape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [chest.id, onClose]);
  const groups = useMemo(() => {
    const result = new Map();
    for (const item of chest.contents || []) {
      const group = result.get(item.type) || { item, count: 0 };
      group.count++; result.set(item.type, group);
    }
    return [...result.values()];
  }, [chest.contents]);
  const count = chest.contents?.length || 0;
  return <section className={`chest-panel ${highlighted ? 'is-drop-target' : ''}`} role="region" aria-label="Kisteninventar" data-drop-zone="chest" data-chest-id={chest.id}>
    <div className="chest-panel-heading"><span className="chest-panel-art"><CardArt type="chest" /></span><div><span className="eyebrow">DEIN VORRAT</span><h2>{chest.name || definitions.chest?.name || 'Kiste'}</h2><p aria-live="polite">{count} {count === 1 ? 'Karte eingelagert' : 'Karten eingelagert'}</p></div><button ref={closeButton} className="icon-button" onClick={onClose} aria-label="Kiste schließen"><X size={18} /></button></div>
    <div className="chest-drop-hint"><ArrowDownToLine size={18} /><p>Ressourcen und Nahrung hier hineinziehen.<small>Auch ganze Stapel passen hinein.</small></p></div>
    {groups.length ? <ul className="chest-inventory">{groups.map(({ item, count: amount }) => {
      const name = definitions[item.type]?.name || item.type;
      return <li key={item.type}>
        <div className="chest-item-handle" onPointerDown={(event) => enabled && onDragItem(event, chest, item)} title={`${name} auf das Spielfeld ziehen`}><span className="chest-item-art"><CardArt type={item.type} /></span><span className="chest-item-name">{name}<small>Zum Herausziehen greifen</small></span><strong aria-label={`${amount} ${name}`}>{amount}</strong></div>
        <div className="chest-item-actions"><button disabled={!enabled} onClick={() => onRetrieve(chest.id, item.id, false)} aria-label={`1 ${name} herausnehmen`}>1 herausnehmen <ArrowUpRight size={12} /></button>{amount > 1 && <button disabled={!enabled} onClick={() => onRetrieve(chest.id, item.id, true)} aria-label={`Alle ${amount} ${name} herausnehmen`}>Alle</button>}</div>
      </li>;
    })}</ul> : <div className="chest-empty"><Box size={30} /><strong>Hier ist noch Platz.</strong><p>Ziehe zum Beispiel Holz, Steine oder Beeren in die Kiste.</p></div>}
    <p className="chest-panel-note">Zum Entnehmen auf das Spielfeld ziehen oder „herausnehmen“ klicken. Zum Verkaufen oder Verschenken die Kiste zuerst leeren.</p>
  </section>;
});

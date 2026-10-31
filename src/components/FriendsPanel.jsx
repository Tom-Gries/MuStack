import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Gift, RefreshCw, Users, X } from 'lucide-react';
import CardArt from './GameArt.jsx';

const savedTime = (value) => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : 'Noch kein gespeicherter Stand';
};

export default function FriendsPanel({ playerId, definitions, listPlayers, inspectPlayer, highlightedPlayerId, dragging, onlinePlayers, notificationControl, onClose }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const listRequest = useRef(0);
  const inventoryRequest = useRef(0);

  const loadPlayers = useCallback(async () => {
    const request = ++listRequest.current;
    setLoading(true); setError('');
    try {
      const result = await listPlayers();
      if (request !== listRequest.current) return;
      const others = (result.players || []).filter((person) => person.id !== playerId);
      setPlayers(others);
      setSelectedId((current) => others.some((person) => person.id === current) ? current : null);
    } catch (err) {
      if (request === listRequest.current) setError(err.message || 'Die Spielerliste konnte nicht geladen werden.');
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  }, [listPlayers, playerId]);

  const loadInventory = useCallback(async (id) => {
    const request = ++inventoryRequest.current;
    setInventory(null); setInventoryLoading(true); setInventoryError('');
    try {
      const result = await inspectPlayer(id);
      if (request === inventoryRequest.current) setInventory(result);
    } catch (err) {
      if (request === inventoryRequest.current) setInventoryError(err.message || 'Die Materialien konnten nicht geladen werden.');
    } finally {
      if (request === inventoryRequest.current) setInventoryLoading(false);
    }
  }, [inspectPlayer]);

  useEffect(() => {
    loadPlayers();
    return () => { listRequest.current += 1; };
  }, [loadPlayers]);

  useEffect(() => {
    if (selectedId) loadInventory(selectedId);
    else { setInventory(null); setInventoryError(''); setInventoryLoading(false); }
    return () => { inventoryRequest.current += 1; };
  }, [selectedId, loadInventory]);

  const selected = players.find((person) => person.id === selectedId);
  const onlineIds = onlinePlayers ? new Set(onlinePlayers.map((person) => person.id)) : null;
  const refresh = () => {
    loadPlayers();
    if (selectedId) loadInventory(selectedId);
  };

  return <section className={`friends-panel is-open ${dragging ? 'is-dragging' : ''}`} aria-label="Rathaus: Mitspieler und Geschenke">
    <div className="friends-heading">
      <div className="friends-title"><Users size={17} /><h2>Mitspieler<small>Dein Rathaus</small></h2></div>
      <button className={`icon-button friends-refresh ${loading ? 'is-loading' : ''}`} onClick={refresh} disabled={loading || inventoryLoading} title="Spieler und Materialien aktualisieren" aria-label="Spieler und Materialien aktualisieren"><RefreshCw size={14} /></button>
      <button className="icon-button friends-close" onClick={onClose} title="Rathaus schließen" aria-label="Rathaus schließen"><X size={14} /></button>
    </div>
    <div className="friends-content">
      <p className="friends-intro"><Gift size={14} /><span>Ziehe Karten auf einen Namen. Geschenke kommen spätestens beim nächsten Abgleich nach etwa 60 Sekunden an.</span></p>
      {notificationControl && <div className="friends-notifications">{notificationControl}</div>}
      {loading && !players.length && <p className="friends-message" role="status">Spieler werden geladen …</p>}
      {error && <p className="friends-error" role="alert">{error}</p>}
      {!loading && !error && !players.length && <p className="friends-message">Noch keine anderen Spieler. Sobald jemand eine Welt anlegt, findest du den Namen hier.</p>}
      {!!players.length && <div className="friends-list" aria-label="Spieler auswählen oder Karten ablegen">{players.map((person) => {
        const online = onlineIds ? onlineIds.has(person.id) : person.online;
        return <button
        key={person.id}
        className={`friend-row ${selectedId === person.id ? 'is-selected' : ''} ${highlightedPlayerId === person.id ? 'is-gift-target' : ''}`}
        data-drop-zone="gift"
        data-player-id={person.id}
        onClick={() => setSelectedId((current) => current === person.id ? null : person.id)}
        aria-expanded={selectedId === person.id}
        title={`Materialien von ${person.name} ansehen · Karten hier ablegen zum Verschenken`}
      ><span className={`friend-avatar ${online ? 'is-online' : ''}`} aria-hidden="true">{person.name?.slice(0, 1).toUpperCase() || '?'}</span><span className="friend-name">{person.name}<small>{highlightedPlayerId === person.id ? 'Loslassen zum Verschenken' : online ? 'Online · Materialien ansehen' : 'Materialien ansehen'}</small></span><ArrowDownToLine className="friend-drop-icon" size={16} /></button>;
      })}</div>}
      {selected && <section className="friend-materials" aria-label={`Materialien von ${selected.name}`}>
        <div className="friend-materials-heading"><strong>Materialien von {selected.name}</strong><small>Stand: zuletzt gespeichert{inventory && <time>{savedTime(inventory.savedAt)}</time>}</small></div>
        {inventoryLoading && <p className="friends-message" role="status">Materialien werden geladen …</p>}
        {inventoryError && <p className="friends-error" role="alert">{inventoryError}</p>}
        {inventory && (inventory.materials?.length ? <ul className="friend-materials-list">{inventory.materials.map((item) => <li key={item.type}><span className="friend-material-art"><CardArt type={item.type} /></span><span>{definitions[item.type]?.name || item.type}</span><strong>{item.count}</strong></li>)}</ul> : <p className="friends-message">Noch keine Materialien vorhanden.</p>)}
      </section>}
    </div>
  </section>;
}

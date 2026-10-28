import React from 'react';
import { ArrowDownToLine, Coins, Package } from 'lucide-react';
import CardArt from './GameArt.jsx';

function PackOffer({ pack, definitions, paid, highlighted }) {
  const remaining = pack.price - paid;
  const contents = [...pack.contents].sort((a, b) => b.weight - a.weight);
  const weight = contents.reduce((sum, entry) => sum + entry.weight, 0);
  const colour = pack.color || '#3d5840';
  const rgb = colour.match(/[\da-f]{2}/gi)?.map((value) => parseInt(value, 16)) || [61, 88, 64];
  const light = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 155;
  return <section className={`shop-panel pack-offer ${highlighted ? 'zone-highlight' : ''}`} data-drop-zone="shop" data-pack-id={pack.id} aria-label={`${pack.name} kaufen`}>
    <div className="pack-offer-summary">
    <div className={`shop-pack shop-pack--configured ${light ? 'shop-pack--light' : ''}`} style={{ backgroundColor: colour }}>
      <div className="pack-lines" />
      <div className="pack-illustration"><CardArt type={contents[0]?.type || 'pack'} /></div>
      <div className="pack-seal"><Package size={15} /></div>
    </div>
    <div className="pack-offer-details">
      <h2>{pack.name}</h2>
      <p>{pack.size} {pack.size === 1 ? 'Karte' : 'Karten'} pro Paket</p>
      <span className="price"><Coins size={15} />{remaining}<small>Gold</small></span>
    </div>
    </div>
    <p className="shop-description">{pack.description || `${pack.size} zufällige Karten für eure gemeinsame Welt.`}</p>
    <div className="pack-contents">{contents.slice(0, 4).map((entry) => <span key={entry.type} title={`${definitions[entry.type]?.name}: ${Number((entry.weight / weight * 100).toFixed(2))} %`}><CardArt type={entry.type} /></span>)}{contents.length > 4 && <span className="rare-badge">+ {contents.length - 4}<br />weitere</span>}</div>
    <div className="shop-drop-hint"><Coins size={16} /><span><strong>Noch {remaining} Gold · hier bezahlen</strong><small>{paid > 0 ? `${paid} von ${pack.price} Gold eingezahlt · Gold oder Sparschwein` : 'Goldkarten oder gefülltes Sparschwein hierher ziehen'}</small></span><ArrowDownToLine size={17} /></div>
  </section>;
}

export default function PackShop({ packs, definitions, payments, legacyPaid, highlightedPackId }) {
  return <section className="pack-shop" aria-label="Paketshop">
    <div className="section-label pack-shop-heading"><span>DIE NÄCHSTE ENTDECKUNG</span><span>{packs.length} {packs.length === 1 ? 'PAKET' : 'PAKETE'}</span></div>
    <div className="pack-shop-list">
      {packs.map((pack) => <PackOffer key={pack.id} pack={pack} definitions={definitions}
        paid={payments?.[pack.id] ?? (pack.id === 'basic' ? legacyPaid || 0 : 0)}
        highlighted={highlightedPackId === pack.id} />)}
    </div>
    {packs.length === 0 && <p className="shop-description pack-shop-empty">Noch keine Pakete verfügbar.</p>}
  </section>;
}

import React, { useEffect, useState } from 'react';
import { Heart, Swords } from 'lucide-react';
import { CONFIG, getCardDefinition } from '@stackfriends/shared/catalog.js';
import { creatureProfile } from '@stackfriends/shared/creatures.js';
import { combatEnemyIds, combatHumanIds } from '@stackfriends/shared/combat.js';
import '../combat.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function visiblePosition(card, cards, elapsed) {
  const anchor = cards.find((item) => item.stackId === card.stackId && item.motion) || card;
  const motion = anchor.motion;
  const amount = motion ? clamp((elapsed - motion.startedAt) / motion.duration, 0, 1) : 0;
  return {
    x: motion ? motion.fromX + (motion.toX - motion.fromX) * amount : card.x,
    y: (motion ? motion.fromY + (motion.toY - motion.fromY) * amount : card.y)
      + (card.order || 0) * CONFIG.stackOffset,
  };
}

function Fight({ combat, world, elapsed }) {
  const humans = combatHumanIds(combat).map((id) => world.cards.find((card) => card.id === id)).filter(Boolean);
  const human = world.cards.find((card) => card.id === (combat.lastTargetId || combat.humanId)) || humans[0];
  const enemies = combatEnemyIds(combat).map((id) => world.cards.find((card) => card.id === id)).filter(Boolean);
  const rat = enemies[0];
  if (!human || !rat) return null;
  const profile = creatureProfile(world, rat);
  if (!profile) return null;
  const enemyName = enemies.length > 1 && enemies.every((enemy) => enemy.type === 'rat') ? `${enemies.length} Ratten` : getCardDefinition(world, rat.type)?.name || 'Lebewesen';

  const points = [...humans, ...enemies].map((fighter) => visiblePosition(fighter, world.cards, elapsed));
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x)) + CONFIG.cardWidth;
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y)) + CONFIG.cardHeight;
  // A battle remains conspicuous even when its two cards overlap completely.
  const width = Math.max(CONFIG.cardWidth * 2 + 40, right - left + 34);
  const height = bottom - top + 34;
  const x = clamp((left + right - width) / 2, 6, Math.max(6, CONFIG.worldWidth - width - 6));
  const y = Math.max(6, top - 17);
  const bannerHeight = 82 + (Math.max(humans.length, enemies.length) - 1) * 18;
  const bannerTop = y >= bannerHeight + 10 ? y - bannerHeight : y + height + 8;
  const remaining = Math.max(0, (combat.nextAttackAt || elapsed) - elapsed);
  const progress = clamp(1 - remaining / profile.attackInterval, 0, 1);
  const impactAge = elapsed - combat.lastAttackAt;
  const showImpact = Number.isFinite(combat.lastAttackAt) && impactAge >= 0 && impactAge < 950;
  const hit = combat.hits || 0;
  const name = humans.map((fighter) => fighter.name || 'Mensch').join(' + ');
  const damageByHuman = new Map();
  for (const entry of combat.lastDamage || [{ humanId: human.id, amount: profile.damage }]) damageByHuman.set(entry.humanId, (damageByHuman.get(entry.humanId) || 0) + entry.amount);
  const hitsByEnemy = new Map();
  for (const entry of combat.lastHits || [{ enemyId: rat.id, damage: combat.lastHitDamage || 1 }]) {
    const previous = hitsByEnemy.get(entry.enemyId);
    hitsByEnemy.set(entry.enemyId, { ...entry, damage: (previous?.damage || 0) + entry.damage });
  }

  return <React.Fragment>
    <div
      className={`combat-arena ${showImpact ? 'combat-arena--impact' : ''}`}
      style={{ left: x, top: y, width, height }}
      aria-hidden="true"
    >
      <i className="combat-corner combat-corner--tl" />
      <i className="combat-corner combat-corner--tr" />
      <i className="combat-corner combat-corner--bl" />
      <i className="combat-corner combat-corner--br" />
    </div>
    <section
      className="combat-banner"
      style={{ left: x, top: bannerTop, width }}
      aria-label={`Kampf: ${name} gegen ${enemyName}. ${hit} Treffer.`}
    >
      <div className="combat-banner-title">
        <span><Swords size={15} strokeWidth={1.9} /> Kampf</span>
        <span className="combat-round">{humans.length} {humans.length === 1 ? 'Mensch' : 'Menschen'} · {enemies.length} Gegner</span>
      </div>
      <div className="combat-contenders">
        <span className="combat-party">{humans.map((fighter) => <span className="combat-fighter combat-fighter--human" key={fighter.id}>
          <span className="combat-fighter-name">{fighter.name || 'Mensch'}</span>
          <span className="combat-fighter-health"><Heart size={10} fill="currentColor" />{fighter.hp}<small> / {CONFIG.humanHp}</small></span>
        </span>)}</span>
        <span className="combat-versus">vs.</span>
        <span className="combat-party">{enemies.map((enemy, i) => <span className="combat-fighter combat-fighter--rat" key={enemy.id}>
          <span className="combat-fighter-name">{getCardDefinition(world, enemy.type)?.name || 'Lebewesen'}{enemies.length > 1 ? ` ${i + 1}` : ''}</span>
          <span className="combat-fighter-health"><Heart size={10} fill="currentColor" />{Math.max(0, enemy.hp)}<small> / {creatureProfile(world, enemy)?.hp}</small></span>
        </span>)}</span>
      </div>
      <div className="combat-attack-timer" aria-hidden="true">
        <span>Nächster Schlag</span>
        <span className="combat-attack-track"><i style={{ width: `${progress * 100}%` }} /></span>
        <strong>{(Math.ceil(remaining / 100) / 10).toFixed(1).replace('.', ',')} s</strong>
      </div>
    </section>
    {showImpact && <React.Fragment key={`${combat.id}-${combat.lastAttackAt}`}>
      {[...damageByHuman].map(([humanId, amount]) => {
        const target = world.cards.find((card) => card.id === humanId);
        if (!target) return null;
        const point = visiblePosition(target, world.cards, elapsed);
        return <div key={humanId}
        className="combat-impact combat-impact--damage"
        style={{ left: point.x + 24, top: point.y + 64 }}
        aria-hidden="true"
      ><Heart size={13} fill="currentColor" /><strong>−{amount}</strong><span>Leben</span></div>;
      })}
      {[...hitsByEnemy.values()].map((entry) => {
        const enemy = world.cards.find((card) => card.id === entry.enemyId);
        const point = enemy ? visiblePosition(enemy, world.cards, elapsed) : Number.isFinite(entry.x) ? { x: entry.x, y: entry.y + (entry.order || 0) * CONFIG.stackOffset } : null;
        if (!point) return null;
        return <div key={entry.enemyId}
        className="combat-impact combat-impact--hit"
        style={{ left: point.x + CONFIG.cardWidth - 14, top: point.y + 110 }}
        aria-hidden="true"
      ><Swords size={13} /><strong>−{entry.damage} Leben</strong></div>;
      })}
    </React.Fragment>}
  </React.Fragment>;
}

/** Local battle animation; the server alone decides attacks and damage. */
export default function CombatOverlay({ world, offset = 0 }) {
  const [now, setNow] = useState(Date.now);
  const active = Boolean(world?.combats?.length);

  useEffect(() => {
    if (!active) return;
    const update = () => { if (!document.hidden) setNow(Date.now()); };
    update();
    const timer = setInterval(update, 100);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [active]);

  if (!active) return null;
  const elapsed = world.clock.elapsed + Math.max(0, now + offset - world.clock.lastAt);
  return world.combats.map((combat) => <Fight key={combat.id} combat={combat} world={world} elapsed={elapsed} />);
}

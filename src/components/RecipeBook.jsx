import React from 'react';
import { BookOpen, ChevronRight, Clock3, Users } from 'lucide-react';
import CardArt from './GameArt.jsx';

const duration = (ms) => ms >= 3600000 ? `${Number((ms / 3600000).toFixed(1))} Stunden` : ms >= 60000 ? `${Number((ms / 60000).toFixed(1))} Minuten` : `${ms / 1000} Sekunden`;

export default function RecipeBook({ recipes, definitions, expanded, onExpand }) {
  return <section className="recipes-panel">
    <div className="section-label"><span>ETWAS ERSCHAFFEN</span><BookOpen size={14} /></div>
    <h2>Aus Karten wird mehr.</h2><p className="recipes-intro">Passende Karten stapeln. Los geht’s.</p>
    <div className="recipe-list">{recipes.map((recipe) => <div key={recipe.id} className={`recipe-row ${expanded === recipe.id ? 'is-expanded' : ''}`}>
      <button className="recipe-toggle" onClick={() => onExpand(expanded === recipe.id ? null : recipe.id)} aria-expanded={expanded === recipe.id}>
        <span className="recipe-art"><CardArt type={recipe.result} /></span><span className="recipe-main"><strong>{recipe.name}</strong>
          <span className="recipe-ingredients">{Object.entries(recipe.ingredients).map(([type, amount]) => <span className="ingredient" key={type}><span>{amount}</span> {definitions[type]?.name || type}</span>)}</span>
        </span><ChevronRight size={15} />
      </button>
      {expanded === recipe.id && <div className="recipe-expanded">
        <span><Users size={12} />{recipe.requiresHuman === false ? 'Ohne Mensch' : '+ 1 Mensch'}</span>
        <span><Clock3 size={12} />{duration(recipe.duration)} · {recipe.timeBase === 'real' ? 'auch offline' : 'aktive Spielzeit'}</span>
        {recipe.keepIngredients?.length > 0 && <span>Bleibt erhalten: {recipe.keepIngredients.map((type) => definitions[type]?.name || type).join(', ')}</span>}
        <p>{recipe.resultCount > 1 ? `${recipe.resultCount} × ` : ''}{definitions[recipe.result]?.description}</p>
      </div>}
    </div>)}</div>
    {!recipes.length && <p className="recipes-intro">In den Einstellungen könnt ihr eure erste Kombination anlegen.</p>}
  </section>;
}

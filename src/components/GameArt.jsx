import React, { createContext, useContext } from 'react';
import CardArt from './CardArt.jsx';
import { CARD_TYPES } from '@stackfriends/shared/catalog.js';
import { ART_LIBRARY } from '@stackfriends/shared/art-library.js';

const ArtCatalog = createContext(CARD_TYPES);
export const CatalogArtProvider = ArtCatalog.Provider;

export default function GameArt({ type, definition: override, ...props }) {
  const definitions = useContext(ArtCatalog);
  const definition = override || definitions[type] || CARD_TYPES[type];
  const illustration = definition?.art ?? (CARD_TYPES[type] ? type : '');
  const image = ART_LIBRARY.find((entry) => entry.id === illustration);
  if (image?.src) return <img className="generated-card-art" src={image.src} alt="" draggable={false} decoding="async" {...props} />;
  if (illustration) return <CardArt type={illustration} {...props} />;
  return <svg viewBox="0 0 120 100" width="100%" height="100%" aria-hidden="true" focusable="false" {...props}>
    <ellipse cx="60" cy="87" rx="30" ry="4" fill="#3b56351a" />
    <text x="60" y="53" textAnchor="middle" dominantBaseline="central" fontSize="52">{definition?.icon || '✦'}</text>
  </svg>;
}

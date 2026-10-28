/** Export content only; no players, cookies, credentials or live world state. */
export function serializeCatalog(catalog, now = new Date()) {
  const content = { revision: catalog.revision, contentVersion: catalog.contentVersion, cardTypes: catalog.cardTypes, recipes: catalog.recipes, packs: catalog.packs };
  return JSON.stringify({ format: 'stackfriends-catalog', version: 1, exportedAt: now.toISOString(), catalog: content }, null, 2);
}

export function downloadCatalog(catalog) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([serializeCatalog(catalog)], { type: 'application/json;charset=utf-8' }));
  link.href = url;
  link.download = `stackfriends-katalog-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Compatibilité avec d'anciens caches de l'application.
// Depuis Nour v12, aucune recherche religieuse n'appelle de modèle externe :
// le pipeline RAG extractif vit dans engine.js et views-search.js.
export async function aiAnswer() {
  throw new Error('La génération externe est désactivée : utilisez la réponse locale sourcée.');
}

export async function aiPing() {
  return { ok: true, mode: 'local-only' };
}

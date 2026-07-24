// Configuration publique du client. L'URL du Worker n'est pas un secret.
// Ne placez jamais LLM_API_KEY ni une autre clé de fournisseur dans ce fichier.
export const ASSISTANT_CONFIG = Object.freeze({
  endpoint: '',
  timeoutMs: 40_000,
});

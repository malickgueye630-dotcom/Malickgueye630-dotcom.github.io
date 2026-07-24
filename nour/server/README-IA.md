# Ancien prototype d’assistant externe — non utilisé

Depuis Nour v12, la recherche religieuse publique est entièrement locale :

- aucun appel à un modèle génératif externe ;
- aucune clé API dans l’application ;
- aucune question ni aucun passage envoyé à un service d’IA ;
- réponses extractives limitées aux textes et synthèses éditoriales présents dans la base.

Les fichiers `cloudflare-worker.js` et `wrangler.toml` restent uniquement comme
archives de l’ancien prototype. Ils ne sont importés, configurés ni appelés par
l’application et ne font pas partie du cache hors ligne.

Cette décision évite de présenter une génération externe comme garantie contre
les hallucinations. Une réactivation future devrait faire l’objet d’un travail
séparé : consentement explicite, audit de confidentialité, validation humaine des
réponses et interface indiquant clairement que le texte est généré.

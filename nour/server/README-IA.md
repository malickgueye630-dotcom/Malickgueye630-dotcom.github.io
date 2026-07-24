# Backend conversationnel de Nour

Ce dossier contient la passerelle sécurisée qui permet à Nour d’utiliser un vrai
modèle de langage sans exposer sa clé dans le navigateur ou dans GitHub Pages.

## Ce qui se passe réellement

1. Le Worker envoie au modèle la question et l’historique récent pour obtenir une
   requête de recherche autonome.
2. Le navigateur exécute cette requête dans les données locales vérifiées de Nour
   (Coran, hadiths français authentifiés et invocations).
3. Le navigateur transmet au Worker uniquement les meilleurs passages et leurs
   identifiants exacts.
4. Le modèle rédige une réponse en français, avec obligation d’utiliser ces seuls
   passages et de citer leurs identifiants.
5. Le Worker compare l’empreinte SHA-256 de chaque passage avec la base Nour, puis
   vérifie les identifiants, les références littérales et les liens. Une source
   altérée ou une citation inconnue provoque le rejet de toute la réponse.

BM25, TF-IDF, correction, synonymes et phonétique servent donc à la récupération.
La compréhension, la reformulation et la rédaction sont faites par le LLM distant.

## Variables

Secret obligatoire, à ne jamais placer dans le dépôt :

| Nom | Rôle |
|---|---|
| `LLM_API_KEY` | clé du fournisseur OpenAI-compatible |

Configuration serveur :

| Nom | Exemple ou rôle |
|---|---|
| `LLM_BASE_URL` | URL HTTPS terminant par `/v1` ou `/chat/completions` |
| `LLM_MODEL` | identifiant exact du modèle réellement choisi |
| `LLM_PROVIDER_NAME` | nom affiché dans l’interface |
| `LLM_API_KEY_HEADER` | facultatif, `Authorization` par défaut |
| `LLM_API_KEY_PREFIX` | facultatif, `Bearer ` par défaut |
| `LLM_TIMEOUT_MS` | délai du fournisseur, 30 s par défaut |
| `NOUR_ALLOWED_ORIGINS` | origines autorisées, séparées par des virgules |

Le fichier `wrangler.jsonc` contient uniquement des valeurs publiques. Il faut y
remplacer `A_CONFIGURER` par le modèle choisi avant le déploiement.

## Développement et déploiement

```powershell
cd nour/server
npm install
npx wrangler login
npx wrangler secret put LLM_API_KEY
npm test
npm run deploy
```

Après le déploiement, renseigner l’URL publique du Worker dans
`nour/js/assistant-config.js`, ou temporairement dans les réglages de
l’application. Cette URL n’est pas un secret.

Pour travailler localement, copier `.dev.vars.example` vers `.dev.vars`, puis
remplir uniquement la copie ignorée par Git.

## Protections

- CORS limité au domaine déclaré ;
- clé disponible uniquement dans les secrets Cloudflare ;
- limitation par adresse via le binding `RATE_LIMITER` ;
- taille des requêtes, historique et nombre de sources bornés ;
- URLs et identifiants de source mis sur liste blanche ;
- empreintes du corpus générées par `npm run sources:generate` et contrôlées au build ;
- consigne stricte de génération à partir des seules sources ;
- validation automatique avant affichage ;
- réponse d’insuffisance si la sortie du modèle est invalide.

La validation réduit fortement le risque de fausse référence, mais aucun LLM ne
garantit l’absence totale d’erreur d’interprétation. Nour ne doit pas être présenté
comme une autorité religieuse ni comme un service de fatwa.

## Mode de secours

Si le Worker, la clé ou le modèle est indisponible, l’application reste utilisable.
Elle affiche explicitement **Recherche locale** et produit uniquement la synthèse
extractive déjà présente dans la base. Ce mode ne prétend pas être comparable à
ChatGPT.

# Assistant IA en ligne pour Nour — déploiement (gratuit)

Cette option **facultative** ajoute une « Réponse IA » qui rédige une synthèse
en français **à partir des versets, hadiths et invocations déjà trouvés** par le
moteur de recherche de l'app. Elle est **désactivée par défaut**.

## Ce qui est garanti

- **Aucune clé n'est jamais dans l'application.** L'app envoie seulement votre
  question + les passages déjà trouvés à **une URL de proxy que vous déployez**.
- **L'IA n'invente rien.** Le proxy lui interdit de citer autre chose que les
  passages fournis. Le texte religieux affiché dans l'app reste toujours celui
  de la base vérifiée ; l'IA ne fait qu'une synthèse, clairement étiquetée.
- **Option 100 % gratuite** : Cloudflare Workers AI (modèle open-source),
  **sans aucune clé API** à gérer ni à risquer de divulguer.

---

## Méthode A — Sans terminal, tout dans le navigateur (recommandée)

La plus simple si vous n'êtes pas développeur. Aucune installation.

### 1. Créez un compte Cloudflare (gratuit)
https://dash.cloudflare.com/sign-up

### 2. Créez un Worker
Tableau de bord → menu **Compute (Workers)** → **Create** → **Start from Hello World**
→ donnez-lui un nom (ex. `nour-ia`) → **Deploy**.

### 3. Collez le code du proxy
Ouvrez le Worker → **Edit code**. Effacez tout le contenu de l'éditeur et
collez à la place l'intégralité du fichier `nour/server/cloudflare-worker.js`
(bouton **Copier** en haut du fichier sur GitHub). Puis **Deploy**.

### 4. Activez l'IA gratuite (liaison Workers AI)
Dans le Worker → **Settings** → **Bindings** → **Add binding** →
choisissez **Workers AI** → dans « Variable name » écrivez exactement `AI` →
**Save and deploy**.

> C'est cette liaison `AI` qui donne accès au modèle gratuit. Aucune clé.

### 5. Récupérez l'adresse du Worker
En haut du Worker, une URL du type :
```
https://nour-ia.VOTRE-SOUS-DOMAINE.workers.dev
```
Copiez-la : c'est elle que vous collerez dans l'app (voir « Branchez l'app »).

### 6. (Recommandé) Limitez l'accès à votre site
Worker → **Settings** → **Variables and Secrets** → **Add** →
Type *Plaintext*, nom `NOUR_ORIGIN`, valeur
`https://malickgueye630-dotcom.github.io` → **Deploy**.
Ainsi seul votre site peut utiliser votre proxy.

Passez ensuite directement à la section **« Branchez l'app »** plus bas.

---

## Méthode B — Avec le terminal (wrangler), pour développeurs

### 1. Créez un compte Cloudflare (gratuit)
https://dash.cloudflare.com/sign-up

### 2. Installez wrangler (l'outil Cloudflare)
```bash
npm install -g wrangler
wrangler login
```

### 3. Déployez le proxy
Depuis le dossier `nour/server/` :
```bash
wrangler deploy
```
Wrangler affiche une URL du type :
```
https://nour-ia.VOTRE-SOUS-DOMAINE.workers.dev
```
C'est **cette URL** que vous collerez dans l'app.

> Le fichier `wrangler.toml` contient déjà `[ai]` → `binding = "AI"`, ce qui
> active Workers AI. Aucune clé n'est nécessaire pour le mode gratuit.

### 4. (Recommandé) Restreignez le CORS à votre site
Dans `wrangler.toml`, décommentez et adaptez :
```toml
[vars]
NOUR_ORIGIN = "https://malickgueye630-dotcom.github.io"
```
puis redéployez (`wrangler deploy`). Ainsi seul votre site peut appeler le proxy.

### 5. (Optionnel) Ajoutez un jeton anti-abus
```bash
wrangler secret put NOUR_TOKEN
# saisissez une phrase secrète
```
Reportez la même phrase dans l'app (champ « Jeton »).

---

## Branchez l'app (les deux méthodes finissent ici)
Dans Nour → **Plus → Réglages → Recherche → Assistant IA en ligne** :
1. Activez l'interrupteur.
2. Collez l'URL du Worker dans « Adresse du proxy ».
3. (si utilisé) collez le jeton.
4. Touchez **Tester la connexion** → « Connexion réussie ✓ ».

C'est terminé. 🎉 Posez une question dans Recherche : une carte « ✨ Réponse IA »
apparaît en haut, rédigée à partir des sources vérifiées.

---

## Passer au mode payant (qualité supérieure, facultatif)

Le mode gratuit suffit largement. Si un jour vous voulez des réponses encore
plus fines via l'API Claude :

```bash
wrangler secret put ANTHROPIC_API_KEY
# collez votre clé sk-ant-...
```
Dès qu'`ANTHROPIC_API_KEY` est présent, le proxy utilise Claude
(`claude-haiku-4-5` par défaut, le moins cher). Pour choisir un autre modèle :
```toml
[vars]
NOUR_MODEL = "claude-haiku-4-5"
```
La clé reste **sur le serveur Cloudflare**, jamais dans l'app. Facturation gérée
par votre compte Anthropic (https://console.anthropic.com).

---

## Coûts

- **Workers AI** : quota quotidien gratuit (« Neurons ») largement suffisant
  pour un usage personnel. Voir la tarification Cloudflare pour les détails.
- **Claude (option payante)** : à l'usage, quelques centimes pour des milliers
  de questions avec `claude-haiku-4-5`.

## Confidentialité

Quand l'assistant IA est activé, **votre question et les passages trouvés
quittent l'appareil** vers votre proxy (puis vers Cloudflare ou Anthropic).
Désactivé, tout reste 100 % local. À vous de choisir.

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| « HTTP 401 » | jeton manquant/incorrect | vérifiez `NOUR_TOKEN` et le champ Jeton |
| « HTTP 403 » CORS | origine bloquée | mettez `NOUR_ORIGIN` à l'URL exacte du site |
| « IA indisponible » | quota Workers AI atteint | réessayez plus tard, ou ajoutez une clé Claude |
| « réponse vide » | modèle sans réponse | reformulez la question |

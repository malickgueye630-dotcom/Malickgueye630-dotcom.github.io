# Nour — Coran, Hadiths & Invocations

Application web progressive (PWA) en français, pensée pour l'iPhone : le Coran complet
(arabe Uthmani, traduction française, translittération), les six grands recueils de hadiths,
les invocations authentiques de la Sunna, une recherche globale tolérante aux fautes,
des favoris, l'audio du Coran et un mode sombre.

**URL une fois déployée :** `https://<votre-domaine>/nour/`

## Fonctionnalités

- 📖 **Coran** : 114 sourates, texte arabe Uthmani jamais modifié, traduction Hamidullah,
  translittération Tanzil, navigation par sourate / juz' / hizb / verset, recherche,
  favoris, marque-pages, reprise automatique de lecture, taille de texte réglable,
  affichage arabe / français / phonétique activable séparément, récitation audio
  (5 récitateurs, verset par verset ou sourate entière).
- 📚 **Hadiths** : Sahih al-Bukhari, Sahih Muslim, Sunan Abi Dawud, Jami' at-Tirmidhi,
  Sunan an-Nasa'i, Sunan Ibn Majah (arabe + anglais, ~34 000 hadiths), plus une
  sélection thématique traduite en français avec degré d'authenticité et référence vérifiée.
- 🤲 **Invocations** : 44 du'â du Coran et de la Sunna (type Hisn al-Muslim), classées
  par situation, avec arabe, phonétique, français, source et nombre de répétitions.
- 💬 **Assistant islamique conversationnel RAG** :
  - interface de discussion avec historique, contexte multi-tour, suggestions, arrêt,
    régénération, copie, partage et références ouvertes directement dans l’application ;
  - un **vrai LLM distant configurable** comprend et reformule la question, puis rédige
    une réponse naturelle en français à partir des seuls passages récupérés ;
  - passerelle Cloudflare Worker : clé secrète côté serveur, fournisseur
    OpenAI-compatible, CORS strict, limite de requêtes et validation des citations ;
  - réponse structurée distinguant réponse directe, explication, nuances, versets,
    hadiths authentiques et références cliquables ;
  - contrôle SHA-256 des passages contre la base locale, puis rejet automatique d’une
    sortie qui cite un identifiant inconnu ou une référence littérale absente ;
  - mode de secours honnêtement intitulé **Recherche locale** si aucun modèle distant
    n’est configuré ou disponible. Ce mode reste extractif et ne prétend pas être ChatGPT.
- 🔍 **Récupération religieuse locale** multicouche, utilisée par le RAG :
  - plein texte français avec racines légères, synonymes et tolérance aux fautes ;
  - **recherche phonétique** de versets : « lakhadjaakoul » retrouve *Laqad jâakum* (9:128),
    avec normalisation des variantes (kh/7, gh/3, q/k/9, ou/oo, dj/j…) et alignement
    semi-global à distance d'édition bornée ;
  - **recherche sémantique locale** par thésaurus vérifié et index vectoriel creux
    (TF-IDF conceptuel + BM25, sans embeddings neuronaux) :
    « le peuple entre les deux montagnes » → Dhul-Qarnayn (Coran 18:83-98) ;
  - recherche dans le **texte arabe** (index sans diacritiques) et suggestions en temps réel ;
  - badges « Correspondance exacte » / « Lié au sujet » / « Correspondance phonétique ».
  Ces techniques sélectionnent les documents ; elles ne sont jamais présentées comme le
  modèle de langage.
- 🖼️ **Accueil photographique** : six photographies HD libres embarquées (Masjid al-Harâm,
  Mosquée du Prophète ﷺ, Al-Aqsa, Cheikh Zayed, Hassan II et Sultan Ahmed), carrousel de
  5,5 minutes, fondu, mouvement cinématographique lent et ambiance selon l'heure locale.
- 🎓 **Mode Apprendre** : parcours interactifs wudû’ et salât, progression mémorisée,
  illustrations pédagogiques non photographiques, arabe, phonétique française, traduction,
  prononciation par la voix arabe de l'appareil, erreurs fréquentes et preuves exactes.
- 🕌 **Horaires de prière** : calcul local (bibliothèque `adhan`, MIT) par géolocalisation ou
  ville (base hors-ligne), méthodes configurables (12° Musulmans de France, 15°, 18°, MWL,
  Umm al-Qura, ISNA, Diyanet…), madhhab pour l'Asr, ajustements manuels par prière,
  prochaine prière + compte à rebours sur l'accueil.
- 🔔 **Notifications** : rappels par prière (à l'heure, −5/−10/−15 min), adhkar matin/soir,
  Al-Kahf le vendredi — notifications locales quand l'app est ouverte (limite iOS des PWA
  sans serveur push, expliquée dans l'interface) + **export calendrier .ics avec alarmes**
  pour des rappels fiables même app fermée.
- 🔤 **Translittération partout** : versets (Tanzil), invocations (rédigée), et hadiths
  (générée automatiquement depuis l'arabe vocalisé par `js/translit.js`), chaque couche
  (arabe / phonétique / français) activable séparément dans les réglages.
- 📱 **PWA iOS** : installable depuis Safari (Partager → Sur l'écran d'accueil),
  fonctionne hors-ligne (app + données visitées ; téléchargement complet du Coran
  possible dans les réglages), icône et écran adaptés, safe-areas iPhone.

## Architecture

```
nour/
├── index.html            # coquille de l'application (SPA)
├── manifest.webmanifest  # manifeste PWA
├── sw.js                 # service worker (pré-cache + cache des données)
├── css/app.css           # styles (thème clair/sombre, composants)
├── js/
│   ├── app.js            # routeur, lecteur audio, réglages, utilitaires
│   ├── state.js          # état persistant (localStorage)
│   ├── data.js           # accès aux données + métadonnées Coran + récitateurs
│   ├── engine.js         # récupération hybride locale
│   ├── rag.js            # paquets de sources et secours local
│   ├── ai.js             # client sans secret du backend conversationnel
│   └── views-*.js        # vues (accueil, coran, recherche, hadiths, duas, favoris…)
├── server/
│   ├── cloudflare-worker.js # planification LLM, génération et validation
│   └── wrangler.jsonc       # configuration publique et limite de requêtes
├── data/
│   ├── quran/index.json  # 114 sourates + tables juz'/hizb/sajda
│   ├── quran/s/N.json    # une sourate = [arabe, français, translittération] par verset
│   ├── quran/search-fr.json
│   ├── hadith/index.json # catalogue des recueils + chapitres
│   ├── hadith/<recueil>/<chapitre>.json
│   ├── duas.json         # invocations rédigées et sourcées
│   └── hadiths_fr.json   # sélection FR (refId vérifié par script contre la base arabe)
├── fonts/                # Amiri (arabe), embarquée pour le hors-ligne
├── assets/
│   ├── mosques/          # photographies libres du carrousel
│   └── learn/            # illustrations pédagogiques non photographiques
├── icons/                # icônes générées par scripts/gen_icons.py
└── scripts/
    ├── build_data.py     # régénère data/ depuis les paquets npm sources
    └── gen_icons.py      # régénère les icônes (Pillow)
```

Pour ajouter une traduction, un récitateur ou un recueil : voir `scripts/build_data.py`
(sources npm), `js/data.js` (RECITERS) — l'architecture des données est prévue pour ça.

## Sources et licences

| Contenu | Source | Licence |
|---|---|---|
| Texte arabe du Coran (Uthmani) | The Noble Qur'an Encyclopedia via `quran-json` v3.1.2 | CC BY-SA 4.0 |
| Traduction française | Muhammad Hamidullah via `quran-json` | CC BY-SA 4.0 |
| Translittération | Tanzil.net via `quran-json` | CC BY-SA 4.0 |
| Découpage juz'/hizb/sajda | `quran-meta` v6 | MIT |
| Hadiths (6 recueils, AR+EN) | paquets npm `sahih-al-bukhari`, `sahih-muslim`, `sunan-abi-dawud`, `jami-al-tirmidhi`, `sunan-al-nasai`, `sunan-ibn-majah` (écosystème « sunnah », données type sunnah.com) | AGPL-3.0 |
| Police arabe Amiri | @fontsource/amiri | SIL OFL 1.1 |
| Audio Coran | cdn.islamic.network (Islamic Network) | usage libre, en ligne |
| Sélection hadiths FR & invocations | rédigées pour Nour, références vérifiées | — |
| Photos de mosquées | Wikimedia Commons — crédits détaillés dans l'écran « À propos » | CC0, domaine public, CC BY 3.0, CC BY-SA 3.0/4.0 selon l'image |
| Illustrations « Apprendre » | créations numériques originales pour Nour (2026), explicitement non photographiques | usage du projet Nour |
| Référence des positions de prière | « Salat positions », Sureyya Aydin, Wikimedia Commons | CC BY-SA 3.0 / GFDL |

⚠️ La numérotation interne des recueils de hadiths est celle de la base (elle peut différer
légèrement de la numérotation imprimée). La sélection française cite, elle, la numérotation
standard (type sunnah.com) et chaque `refId` a été vérifié par script en comparant le texte
arabe normalisé à celui de la base.

## Développement

Servir localement : `python3 -m http.server` puis ouvrir `http://localhost:8000/nour/`.
Le frontend reste en HTML/CSS/JS natifs. `npm test` contrôle le RAG et les citations ;
`npm run build` valide les scripts, les JSON, les médias et le précache PWA.

Le backend et ses variables sont documentés dans
[`server/README-IA.md`](server/README-IA.md). GitHub Pages ne peut pas conserver une
clé de modèle : un Worker (ou une fonction serverless équivalente) est nécessaire
pour activer la génération distante.

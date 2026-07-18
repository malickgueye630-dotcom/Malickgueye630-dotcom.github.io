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
- 🔍 **Recherche globale** : langage naturel (« doua avant de dormir »), tolérance aux
  fautes (dua/doua/du'â, sourate/surat, hadith/hadis…), résultats par catégorie,
  toujours sourcés. Aucun contenu religieux n'est généré : si rien n'est trouvé,
  l'application le dit.
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
│   ├── search.js         # recherche (normalisation, variantes, distance d'édition)
│   └── views-*.js        # vues (accueil, coran, recherche, hadiths, duas, favoris…)
├── data/
│   ├── quran/index.json  # 114 sourates + tables juz'/hizb/sajda
│   ├── quran/s/N.json    # une sourate = [arabe, français, translittération] par verset
│   ├── quran/search-fr.json
│   ├── hadith/index.json # catalogue des recueils + chapitres
│   ├── hadith/<recueil>/<chapitre>.json
│   ├── duas.json         # invocations rédigées et sourcées
│   └── hadiths_fr.json   # sélection FR (refId vérifié par script contre la base arabe)
├── fonts/                # Amiri (arabe), embarquée pour le hors-ligne
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

⚠️ La numérotation interne des recueils de hadiths est celle de la base (elle peut différer
légèrement de la numérotation imprimée). La sélection française cite, elle, la numérotation
standard (type sunnah.com) et chaque `refId` a été vérifié par script en comparant le texte
arabe normalisé à celui de la base.

## Développement

Servir localement : `python3 -m http.server` puis ouvrir `http://localhost:8000/nour/`.
Aucune étape de build : HTML/CSS/JS natifs (ES modules), données JSON statiques.

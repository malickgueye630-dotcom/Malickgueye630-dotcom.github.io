// À propos : sources, licences, avertissements.
import { $view } from './app.js';

export function viewAbout() {
  $view.innerHTML = `
    <a class="backlink" href="#/home">← Accueil</a>
    <h1>À propos de Nour</h1>
    <div class="card">
      <p><b>Nour</b> réunit le Coran, les hadiths authentiques et les invocations de la Sunna,
      avec une recherche qui interroge uniquement ces textes. L'application ne génère jamais
      de contenu religieux : chaque résultat est accompagné de sa source.</p>
    </div>

    <h2>Sources des textes</h2>
    <div class="card">
      <p><b>📖 Coran</b></p>
      <ul class="muted" style="padding-left:18px;margin:6px 0">
        <li>Texte arabe (Uthmani) : The Noble Qur'an Encyclopedia (quranenc.com) — le texte arabe n'est jamais modifié.</li>
        <li>Traduction française : Muhammad Hamidullah.</li>
        <li>Translittération : Tanzil.net.</li>
        <li>Données assemblées via le projet open source <i>quran-json</i> (licence CC BY-SA 4.0).</li>
        <li>Découpage juz'/hizb : projet <i>quran-meta</i> (MIT).</li>
        <li>Récitations audio : Islamic Network (cdn.islamic.network) — en ligne uniquement.</li>
      </ul>
      <p><b>📚 Hadiths</b></p>
      <ul class="muted" style="padding-left:18px;margin:6px 0">
        <li>Sahih al-Bukhari, Sahih Muslim, Sunan Abi Dawud, Jami' at-Tirmidhi, Sunan an-Nasa'i,
          Sunan Ibn Majah — texte arabe et traduction anglaise, via les paquets open source
          de l'écosystème <i>sunnah</i> (AGPL-3.0). La numérotation affichée dans les recueils est celle
          de cette base ; elle peut différer légèrement de la numérotation imprimée classique.</li>
        <li>Sélection thématique française : traductions du sens rédigées pour Nour, chacune avec
          recueil, numéro standard et degré d'authenticité (Sahih / Hasan).</li>
      </ul>
      <p><b>🤲 Invocations</b></p>
      <ul class="muted" style="padding-left:18px;margin:6px 0">
        <li>Invocations du Coran et de la Sunna authentique (répertoire type <i>Hisn al-Muslim</i>),
          chacune avec sa référence (Bukhari, Muslim, Abu Dawud, Tirmidhi…).</li>
      </ul>
      <p><b>🕌 Horaires de prière</b></p>
      <ul class="muted" style="padding-left:18px;margin:6px 0">
        <li>Calcul local par la bibliothèque open source <i>adhan</i> (MIT), selon la position,
          la méthode de calcul et le madhhab choisis. Les horaires sont indicatifs : ils varient
          selon la méthode — choisissez celle de votre mosquée et ajustez si besoin.</li>
      </ul>
      <p><b>🔤 Phonétique française</b></p>
      <ul class="muted" style="padding-left:18px;margin:6px 0">
        <li>La transcription phonétique du Coran et des hadiths est <b>générée par règles</b> depuis
          le texte arabe entièrement vocalisé (harakat), avec des conventions pour francophones
          (ou, â/î/oû, ch, kh, gh, article assimilé « r-r »). C'est une aide à la lecture,
          vérifiée sur des sourates témoins ; elle ne remplace jamais le texte arabe, qui n'est
          jamais modifié. La phonétique des invocations est rédigée à la main.</li>
        <li>Les titres des livres (chapitres) des recueils de hadiths sont traduits en français
          pour l'interface ; le titre arabe original est toujours affiché.</li>
      </ul>
      <p><b>🔎 Recherche</b></p>
      <ul class="muted" style="padding-left:18px;margin:6px 0">
        <li>Le moteur local combine plein texte, correction orthographique, synonymes,
          phonétique arabe/française, thésaurus vérifié, vecteurs TF-IDF conceptuels et classement
          BM25. Les questions et les passages ne quittent pas l’appareil.</li>
        <li>Il ne s’agit pas d’un grand modèle neuronal embarqué. La réponse est extractive :
          elle assemble des textes et synthèses éditoriales déjà présents dans Nour, puis refuse
          de conclure lorsque les sources locales sont insuffisantes.</li>
      </ul>
      <p><b>🎨 Interface & localisation</b></p>
      <ul class="muted" style="padding-left:18px;margin:6px 0">
        <li>Icônes : <i>Lucide</i> (licence ISC), complétées de quelques tracés originaux
          (mosquée, Kaaba, tasbih).</li>
        <li>En-tête de recherche : photographies embarquées depuis Wikimedia Commons —
          <a href="https://commons.wikimedia.org/wiki/File:Kaaba,_Makkah3.jpg" target="_blank" rel="noopener">Kaaba</a>
          (Moataz Egbaria, CC BY-SA 3.0),
          <a href="https://commons.wikimedia.org/wiki/File:Al-Masjid_an-Nabawi.jpg" target="_blank" rel="noopener">Mosquée du Prophète ﷺ</a>
          (Fawaz Mohammed, CC BY-SA 4.0),
          <a href="https://commons.wikimedia.org/wiki/File:Al_Aqsa.jpg" target="_blank" rel="noopener">Al-Aqsa</a>
          (Nikeman916, domaine public),
          <a href="https://commons.wikimedia.org/wiki/File:Sheikh_Zayed_Grand_Mosque_in_Abu_Dhabi_-_panoramio_(8).jpg" target="_blank" rel="noopener">Cheikh Zayed</a>
          (Jaseem Hamza, CC BY 3.0),
          <a href="https://commons.wikimedia.org/wiki/File:Hassan_II_Mosque_Plaza.jpg" target="_blank" rel="noopener">Hassan II</a>
          (FuriousYogi, CC BY-SA 4.0) et
          <a href="https://commons.wikimedia.org/wiki/File:The_Blue_Mosque_-_Istanbul,_Turkey._(24113491979).jpg" target="_blank" rel="noopener">Sultan Ahmed</a>
          (Leandro Centomo, CC0).</li>
        <li>Mode « Apprendre » : illustrations numériques originales créées pour Nour en 2026.
          Elles sont volontairement indiquées comme <b>illustrations non photographiques</b>.
          Référence gestuelle complémentaire :
          <a href="https://commons.wikimedia.org/wiki/File:Salat_positions.jpg" target="_blank" rel="noopener">Salat positions</a>,
          Sureyya Aydin, CC BY-SA 3.0 / GFDL.</li>
        <li>Localité précise et mosquée la plus proche : services ouverts d'<i>OpenStreetMap</i>
          (Nominatim, Overpass — données © contributeurs OSM, licence ODbL), utilisés seulement
          lorsque vous activez la localisation.</li>
      </ul>
      <p><b>🌐 Traduction automatique de secours</b></p>
      <ul class="muted" style="padding-left:18px;margin:6px 0">
        <li>Pour les hadiths sans traduction française fiable, une traduction automatique
          (anglais → français, via l'API <i>MyMemory</i>) peut être demandée. Elle est
          <b>toujours étiquetée « Traduction automatique depuis l'anglais »</b>, n'est pas une
          traduction religieuse officielle, et le texte arabe d'origine ainsi que la source
          restent affichés.</li>
      </ul>
    </div>

    <h2>Avertissement</h2>
    <div class="card">
      <p class="muted">Les traductions sont des traductions du sens et ne remplacent pas le texte arabe.
      Malgré tout le soin apporté, une erreur reste possible : pour toute question religieuse,
      rapprochez-vous d'un savant ou d'un imam qualifié. Si vous constatez une erreur,
      signalez-la pour qu'elle soit corrigée.</p>
    </div>

    <h2>Vie privée</h2>
    <div class="card">
      <p class="muted">Vos favoris, marque-pages, réglages et historique restent uniquement
      sur votre appareil (stockage local du navigateur). La recherche religieuse est entièrement
      locale. Seules les fonctions explicitement en ligne — géocodage OpenStreetMap, traduction
      de secours à la demande et audio du Coran — contactent leurs services respectifs.</p>
    </div>
  `;
}

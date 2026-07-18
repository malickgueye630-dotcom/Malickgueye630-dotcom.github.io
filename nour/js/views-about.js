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
      sur votre appareil (stockage local du navigateur). Aucune donnée n'est envoyée à un serveur.</p>
    </div>
  `;
}

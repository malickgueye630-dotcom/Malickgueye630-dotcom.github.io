// Favoris : versets, invocations, hadiths (sélection FR + recueils).
import { $view, esc } from './app.js';
import { state } from './state.js';
import * as data from './data.js';
import { duaCard, bindDuaCards } from './views-duas.js';
import { hadithFrCard, bindFrCards } from './views-hadith.js';

export async function viewFavorites() {
  const f = state.favorites;
  const [idx, duasDb, hfr] = await Promise.all([data.quranIndex(), data.duas(), data.hadithsFr()]);
  const allDuas = duasDb.categories.flatMap(c => c.duas);

  const parts = [`<a class="backlink" href="#/home">← Accueil</a><h1>⭐ Mes favoris</h1>`];
  let any = false;

  if (f.verses.length) {
    any = true;
    parts.push(`<h2>Versets (${f.verses.length})</h2>`);
    for (const ref of f.verses) {
      const [s, v] = ref.split(':').map(Number);
      const m = idx.surahs[s - 1];
      try {
        const sd = await data.surah(s);
        const verse = sd.verses[v - 1];
        parts.push(`<a class="card card-plain" style="display:block;text-decoration:none;color:inherit" href="#/quran/s/${s}?v=${v}">
          <div class="ar" style="font-size:calc(var(--ar-size)*.75)">${esc(verse[0])}</div>
          <p class="fr" style="margin:6px 0 4px">${esc(verse[1])}</p>
          <div class="tiny">Coran — ${esc(m.phonetic)} (${s}), verset ${v}</div>
        </a>`);
      } catch {
        parts.push(`<a class="list-item" href="#/quran/s/${s}?v=${v}"><div class="num">${s}</div>
          <div class="t"><b>${esc(m.phonetic)} — verset ${v}</b></div></a>`);
      }
    }
  }

  const favDuas = allDuas.filter(d => f.duas.includes(d.id));
  if (favDuas.length) {
    any = true;
    parts.push(`<h2>Invocations (${favDuas.length})</h2><div id="favDuas">${favDuas.map(duaCard).join('')}</div>`);
  }

  const favHfr = hfr.hadiths.filter(h => f.hadithsFr.includes(h.id));
  if (favHfr.length) {
    any = true;
    parts.push(`<h2>Hadiths — sélection française (${favHfr.length})</h2><div id="favHfr">${favHfr.map(h => hadithFrCard(h, hfr.themes)).join('')}</div>`);
  }

  if (f.hadiths.length) {
    any = true;
    const cat = await data.hadithIndex();
    parts.push(`<h2>Hadiths — recueils (${f.hadiths.length})</h2>`);
    for (const ref of f.hadiths.slice(0, 50)) {
      const [key, id] = ref.split(':');
      const col = cat.find(c => c.key === key);
      const ch = col?.chapters.find(c => c.first <= +id && +id <= c.last);
      parts.push(`<a class="list-item" href="#/hadith/${key}/${ch?.id || 1}?h=${id}">
        <div class="num">📚</div>
        <div class="t"><b>${esc(col?.name || key)} · n° ${esc(id)}</b><small>${esc(ch?.en || '')}</small></div>
      </a>`);
    }
  }

  if (!any) {
    parts.push(`<div class="empty"><span class="em">⭐</span>Aucun favori pour l'instant.<br>
      Touchez ☆ sur un verset, un hadith ou une invocation pour le retrouver ici.</div>`);
  }

  $view.innerHTML = parts.join('');
  if (favDuas.length) bindDuaCards(document.getElementById('favDuas'), favDuas);
  if (favHfr.length) bindFrCards(document.getElementById('favHfr'), favHfr);
}

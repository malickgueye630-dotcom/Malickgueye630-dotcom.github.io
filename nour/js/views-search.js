// Recherche globale : Coran, invocations, hadiths — résultats sourcés uniquement.
import { $view, esc, bindTopbar, topbar } from './app.js';
import { state, pushHistory } from './state.js';
import { globalSearch, highlight } from './search.js';
import * as data from './data.js';

const SUGGESTIONS = [
  'doua avant de dormir', 'verset sur la patience', 'hadith sur les parents',
  'que dire avant d\'entrer aux toilettes', 'sourate Al-Kahf', 'invocation en sortant de chez moi',
  'hadith sur le mariage', 'que dit l\'islam sur la colère', 'adhkar du matin', 'aumône',
];

let debounce;

export async function viewSearch(initial = '') {
  $view.innerHTML = `
    ${topbar('Recherche')}
    <div class="search-input">
      <span>🔍</span>
      <input id="qInput" type="search" placeholder="Écrivez naturellement : « doua pour dormir »…"
        autocomplete="off" autocapitalize="off" value="${esc(initial)}">
      <button class="btn-icon" id="qClear" aria-label="Effacer">✕</button>
    </div>
    <div id="qResults"></div>
  `;
  bindTopbar();

  const input = document.getElementById('qInput');
  const results = document.getElementById('qResults');

  function renderIdle() {
    const hist = state.searchHistory;
    results.innerHTML = `
      ${hist.length ? `<h2>Recherches récentes</h2>
        <div class="chiprow">${hist.map(h => `<button class="chip" data-q="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : ''}
      <h2>Essayez par exemple</h2>
      <div class="chiprow" style="flex-wrap:wrap">${SUGGESTIONS.map(sq => `<button class="chip" data-q="${esc(sq)}">${esc(sq)}</button>`).join('')}</div>
      <div class="notice">La recherche interroge uniquement le Coran, les recueils de hadiths et les invocations
      présents dans l'application, avec leurs sources. Rien n'est généré automatiquement.</div>
    `;
    results.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { input.value = b.dataset.q; run(b.dataset.q); });
  }

  async function run(q) {
    if (!q.trim()) { renderIdle(); return; }
    results.innerHTML = `<div class="spinner"></div>`;
    const r = await globalSearch(q);
    const total = r.surahs.length + r.verses.length + r.duas.length + r.hadiths.length;
    pushHistory(q.trim());
    if (!total) {
      results.innerHTML = `<div class="empty"><span class="em">🕊️</span>
        Aucun résultat fiable trouvé pour « ${esc(q)} » dans nos sources.<br><br>
        <small>Essayez d'autres mots (ex. « patience », « pardon », « voyage »).<br>
        Nour ne propose jamais de contenu religieux sans source.</small></div>`;
      return;
    }

    const idx = await data.quranIndex();
    const parts = [];

    // ordre des catégories selon l'intention détectée
    const cats = [];
    if (r.intent.dua) cats.push('duas', 'verses', 'hadiths');
    else if (r.intent.hadith) cats.push('hadiths', 'verses', 'duas');
    else if (r.intent.quran) cats.push('verses', 'duas', 'hadiths');
    else cats.push('duas', 'verses', 'hadiths');

    if (r.surahs.length) {
      parts.push(`<div class="result-cat">📖 Sourates <span class="cnt">${r.surahs.length}</span></div>`);
      parts.push(r.surahs.map(s => `
        <a class="list-item" href="#/quran/s/${s.n}">
          <div class="num">${s.n}</div>
          <div class="t"><b>${esc(s.phonetic)}</b><small>${esc(s.fr)} · ${s.verses} versets</small></div>
          <div class="arname">${esc(s.name)}</div>
        </a>`).join(''));
    }

    for (const cat of cats) {
      if (cat === 'verses' && r.verses.length) {
        parts.push(`<div class="result-cat">🕋 Versets du Coran <span class="cnt">${r.verses.length}</span></div>`);
        parts.push(r.verses.slice(0, 12).map(v => {
          const m = idx.surahs[v.s - 1];
          return `<a class="card card-plain" style="display:block;text-decoration:none;color:inherit" href="#/quran/s/${v.s}?v=${v.v}">
            <p class="fr" style="margin:0 0 6px">${highlight(esc(v.fr), q)}</p>
            <div class="tiny">Coran — ${esc(m.phonetic)} (${v.s}), verset ${v.v}</div>
          </a>`;
        }).join(''));
      }
      if (cat === 'duas' && r.duas.length) {
        parts.push(`<div class="result-cat">🤲 Invocations <span class="cnt">${r.duas.length}</span></div>`);
        parts.push(r.duas.slice(0, 8).map(d => `
          <a class="card card-plain" style="display:block;text-decoration:none;color:inherit" href="#/duas/${d.cat}?d=${esc(d.id)}">
            <div class="dua-title">${d.icon || '🤲'} ${highlight(esc(d.title), q)}${d.repeat ? `<span class="repeat-pill">× ${d.repeat}</span>` : ''}</div>
            <p class="fr" style="margin:4px 0 6px">${highlight(esc(d.fr), q)}</p>
            <div class="tiny">${esc(d.source)} · ${esc(d.catName)}</div>
          </a>`).join(''));
      }
      if (cat === 'hadiths' && r.hadiths.length) {
        parts.push(`<div class="result-cat">📚 Hadiths <span class="cnt">${r.hadiths.length}</span></div>`);
        parts.push(r.hadiths.slice(0, 8).map(h => `
          <a class="card card-plain" style="display:block;text-decoration:none;color:inherit" href="#/hadith/theme/${h.themes[0]}">
            <p class="fr" style="margin:0 0 6px">${highlight(esc(h.fr), q)}</p>
            <div class="src"><span class="badge ${h.grade.toLowerCase().startsWith('sahih') ? 'sahih' : 'hasan'}">${esc(h.grade)}</span>
            <span class="s">${esc(h.source)}</span></div>
          </a>`).join(''));
      }
    }

    parts.push(`<div class="notice">Résultats issus exclusivement des textes de l'application (Coran — traduction Hamidullah,
      recueils de hadiths, invocations sourcées). En cas de doute sur un point religieux, consultez un savant ou un imam.</div>`);
    results.innerHTML = parts.join('');
  }

  input.oninput = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => run(input.value), 260);
  };
  document.getElementById('qClear').onclick = () => { input.value = ''; renderIdle(); input.focus(); };

  if (initial) run(initial); else { renderIdle(); setTimeout(() => input.focus(), 80); }
}

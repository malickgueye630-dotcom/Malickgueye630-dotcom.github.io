// Recherche globale : moteur unifié (exact + flou + phonétique + sujets + questions).
// Tous les résultats proviennent de la base locale et affichent leur source.
import { $view, esc, bindTopbar, topbar } from './app.js';
import { state, pushHistory } from './state.js';
import { searchAll, buildAnswer, suggest, tokens, fold, stem } from './engine.js';
import { arToLatin } from './translit.js';
import * as data from './data.js';

const SUGGESTIONS = [
  'doua avant de dormir', 'laqad jaakoum', 'verset sur la patience', 'médisance',
  'que dire avant d\'entrer aux toilettes', 'le voyage nocturne du Prophète ﷺ',
  'les voyages de Dhul-Qarnayn', 'comment faire salat al-istikhara',
  'hadith sur la trahison', 'que dit l\'islam sur la colère', 'adhkar du matin',
];

let debounce, sugDebounce, lastQuery = '';

// ---------- surlignage ----------
function highlight(text, q, found = []) {
  const words = new Set([...tokens(q), ...found.map(f => fold(f))].filter(w => w.length > 2));
  const stems = new Set([...words].map(stem));
  if (!words.size) return esc(text);
  return esc(text).replace(/[A-Za-zÀ-ÿœ']+/g, m => {
    const fm = fold(m), sm = stem(fm);
    if (sm.length < 3) return m;
    return (words.has(fm) || stems.has(sm) || [...stems].some(s => s.length > 3 && sm.length > 3 && (sm.startsWith(s) || s.startsWith(sm))))
      ? `<mark>${m}</mark>` : m;
  });
}

const badgeExact = `<span class="badge sahih" style="font-size:.62rem">Correspondance exacte</span>`;
const badgeTopic = t => `<span class="badge" style="font-size:.62rem">Lié au sujet : ${esc(t)}</span>`;
const badgePhon = `<span class="badge hasan" style="font-size:.62rem">Correspondance phonétique</span>`;

// ---------- cartes ----------
const clamp = (t, n) => t && t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;

function verseCard(v, meta, q, enriched) {
  const cfg = state.settings;
  const label = v.topic ? badgeTopic(v.topic) : v.phon ? badgePhon : badgeExact;
  const ref = v.range
    ? `${esc(meta.phonetic)} (${v.s}), versets ${v.range[1]}-${v.range[2]}`
    : `${esc(meta.phonetic)} (${v.s}), verset ${v.v}`;
  const arShort = enriched && enriched[0].length <= 260;
  return `<a class="card card-plain" style="display:block;text-decoration:none;color:inherit" href="#/quran/s/${v.s}?v=${v.v}">
    ${arShort && cfg.showAr ? `<div class="ar" style="font-size:calc(var(--ar-size)*.72)">${esc(enriched[0])}</div>` : ''}
    ${arShort && cfg.showTl ? `<div class="tl" style="color:var(--ink-2);font-style:italic;font-size:.84rem;margin:4px 0">${esc(clamp(enriched[2], 220))}</div>` : ''}
    ${v.phon && !arShort ? `<div class="tl" style="font-style:italic;font-size:.9rem;margin:2px 0"><mark>${esc(clamp(v.translit, 180))}</mark></div>` : ''}
    ${(enriched || v.fr) && cfg.showFr !== false ? `<p class="fr" style="margin:6px 0 6px">${highlight(clamp(enriched ? enriched[1] : v.fr, 320), q, v.found || [])}</p>` : ''}
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
      <span class="tiny">📖 Coran — ${ref}</span>${label}
    </div>
  </a>`;
}

function hadithCard(h, q) {
  const cfg = state.settings;
  const label = h.topic ? badgeTopic(h.topic) : badgeExact;
  const grade = h.grade ? `<span class="badge ${h.grade.toLowerCase().startsWith('sahih') ? 'sahih' : 'hasan'}">${esc(h.grade)}</span>` : '';
  const link = h.collection && h.refId ? `#/hadith/${h.collection}/find/${h.refId}` : `#/hadith/theme/${h.themes?.[0] || ''}`;
  return `<a class="card card-plain hcard" style="display:block;text-decoration:none;color:inherit" href="${esc(link)}" data-hfr="${h.id}">
    ${cfg.showAr ? `<div class="ar" style="font-size:calc(var(--ar-size)*.72)">${esc(h.ar)}</div>` : ''}
    ${cfg.showTl ? `<div class="tl" style="color:var(--ink-2);font-style:italic;font-size:.84rem;margin:4px 0">${esc(arToLatin(h.ar))}</div>` : ''}
    <p class="fr" style="margin:6px 0">${highlight(h.fr, q, h.found || [])}</p>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
      <span class="s tiny">📜 ${esc(h.source)}${h.narrator ? ' — ' + esc(h.narrator) : ''}</span>
      <span>${grade} ${label}</span>
    </div>
  </a>`;
}

function duaCardMini(d, q) {
  const cfg = state.settings;
  const label = d.topic ? badgeTopic(d.topic) : badgeExact;
  return `<a class="card card-plain hcard" style="display:block;text-decoration:none;color:inherit" href="#/duas/${esc(d.cat)}?d=${esc(d.id)}">
    <div class="dua-title">${d.icon || '🤲'} ${highlight(d.title, q, d.found || [])}${d.repeat ? `<span class="repeat-pill">× ${d.repeat}</span>` : ''}</div>
    ${cfg.showAr ? `<div class="ar" style="font-size:calc(var(--ar-size)*.72)">${esc(d.ar)}</div>` : ''}
    ${cfg.showTl !== false ? `<div class="tl" style="color:var(--ink-2);font-style:italic;font-size:.84rem;margin:4px 0">${esc(d.translit)}</div>` : ''}
    <p class="fr" style="margin:6px 0">${highlight(d.fr, q, d.found || [])}</p>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
      <span class="tiny">🤲 ${esc(d.source)} · ${esc(d.catName)}</span>${label}
    </div>
  </a>`;
}

function topicCard(t) {
  return `<div class="card" style="border-left:4px solid var(--gold)">
    <b>💡 ${esc(t.label)}</b>
    <p class="muted" style="margin:6px 0 0">${esc(t.desc)}</p>
  </div>`;
}

// enrichit les meilleurs versets avec arabe + phonétique + français
async function enrich(list, n = 8) {
  const map = new Map();
  await Promise.all([...new Set(list.slice(0, n).map(v => v.s))].map(async s => {
    try { map.set(s, await data.surah(s)); } catch {}
  }));
  return v => {
    const sd = map.get(v.s);
    return sd ? sd.verses[v.v - 1] : null;
  };
}

// ---------- vue ----------
export async function viewSearch(initial = '') {
  $view.innerHTML = `
    ${topbar('Recherche')}
    <div class="search-input" style="position:relative">
      <span>🔍</span>
      <input id="qInput" type="search" placeholder="Mot, question, phonétique arabe…"
        autocomplete="off" autocapitalize="off" value="${esc(initial)}">
      <button class="btn-icon" id="qClear" aria-label="Effacer">✕</button>
    </div>
    <div id="qSuggest" class="card card-plain" style="display:none;padding:4px;margin:-6px 0 10px"></div>
    <div id="qResults"></div>
  `;
  bindTopbar();

  const input = document.getElementById('qInput');
  const results = document.getElementById('qResults');
  const sugEl = document.getElementById('qSuggest');

  function renderIdle() {
    const hist = state.searchHistory;
    results.innerHTML = `
      ${hist.length ? `<h2>Recherches récentes</h2>
        <div class="chiprow">${hist.map(h => `<button class="chip" data-q="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : ''}
      <h2>Essayez par exemple</h2>
      <div class="chiprow" style="flex-wrap:wrap">${SUGGESTIONS.map(sq => `<button class="chip" data-q="${esc(sq)}">${esc(sq)}</button>`).join('')}</div>
      <div class="notice">Vous pouvez chercher un <b>mot</b> (« patience »), poser une <b>question</b>
      (« que dit l'islam sur la médisance ? »), décrire un <b>souvenir</b> (« l'homme qui a voyagé jusqu'au
      coucher du soleil ») ou écrire de l'<b>arabe en phonétique</b>, même approximative (« laqad jaakoum »).
      La recherche n'utilise que le Coran, les hadiths et les invocations de l'application, avec leurs sources —
      rien n'est inventé.</div>
    `;
    results.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { input.value = b.dataset.q; hideSug(); run(b.dataset.q); });
  }

  function hideSug() { sugEl.style.display = 'none'; sugEl.innerHTML = ''; }

  async function showSuggestions(q) {
    if (!q.trim() || q.trim().length < 2) { hideSug(); return; }
    const sugs = await suggest(q);
    if (!sugs.length || input.value !== q) { hideSug(); return; }
    sugEl.innerHTML = sugs.map((s, i) => `
      <div class="row" data-i="${i}" style="padding:9px 10px;border-radius:10px;cursor:pointer">
        <span>${s.type === 'surah' ? '📖' : s.type === 'dua' ? '🤲' : '💡'}</span>
        <div class="grow"><b style="font-size:.9rem">${esc(s.label)}</b>
        <span class="tiny" style="margin-left:6px">${esc(s.sub || '')}</span></div>
      </div>`).join('');
    sugEl.style.display = '';
    sugEl.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
      const s = sugs[+el.dataset.i];
      hideSug();
      if (s.hash) location.hash = s.hash;
      else { input.value = s.label; run(s.label); }
    });
  }

  async function run(q) {
    if (!q.trim()) { renderIdle(); return; }
    hideSug();
    lastQuery = q;
    results.innerHTML = `<div class="spinner"></div>`;
    const r = await searchAll(q);
    if (lastQuery !== q) return; // une requête plus récente est partie
    const answer = buildAnswer(r);
    pushHistory(q.trim());

    const total = r.verses.length + r.hadiths.length + r.duas.length +
      r.versesTopic.length + r.hadithsTopic.length + r.duasTopic.length +
      r.phonetic.length + r.surahs.length;

    if (!total) {
      results.innerHTML = `<div class="empty"><span class="em">🕊️</span>
        ${r.question
          ? `Je n'ai pas trouvé de source suffisamment fiable dans la base de données pour répondre avec certitude à cette question.`
          : `Aucun résultat fiable trouvé pour « ${esc(q)} » dans nos sources.`}<br><br>
        <small>Essayez d'autres mots, une orthographe différente, ou décrivez le passage dont vous vous souvenez.<br>
        Nour ne propose jamais de contenu religieux sans source.</small></div>`;
      return;
    }

    const idx = await data.quranIndex();
    const meta = s => idx.surahs[s - 1];
    const parts = [];

    // ---------- RÉPONSE structurée (questions) ----------
    if (answer) {
      parts.push(`<div class="result-cat" style="font-size:1.05rem">🕌 Réponse</div>`);
      if (answer.topic) parts.push(topicCard(answer.topic));
      const getV = await enrich([...answer.verses], 3);
      if (answer.duas.length) {
        parts.push(`<div class="tiny" style="margin:10px 2px 2px;font-weight:700">🤲 INVOCATION${answer.duas.length > 1 ? 'S' : ''}</div>`);
        parts.push(answer.duas.map(d => duaCardMini(d, q)).join(''));
      }
      if (answer.hadiths.length) {
        parts.push(`<div class="tiny" style="margin:10px 2px 2px;font-weight:700">📜 HADITHS AUTHENTIQUES</div>`);
        parts.push(answer.hadiths.map(h => hadithCard(h, q)).join(''));
      }
      if (answer.verses.length) {
        parts.push(`<div class="tiny" style="margin:10px 2px 2px;font-weight:700">📖 CORAN</div>`);
        parts.push(answer.verses.map(v => verseCard(v, meta(v.s), q, getV(v))).join(''));
      }
      parts.push(`<div class="notice">📚 Réponse assemblée uniquement à partir des sources citées ci-dessus,
        présentes dans la base de Nour. Pour un avis religieux, consultez un savant ou un imam.</div>`);
    }

    // ---------- résultat le plus probable (hors mode question) ----------
    if (!answer && r.topics.length) {
      parts.push(`<div class="result-cat">💡 Sujet détecté</div>`);
      parts.push(topicCard(r.topics[0].topic));
    }

    // ---------- sourates ----------
    if (r.surahs.length) {
      parts.push(`<div class="result-cat">📖 Sourates <span class="cnt">${r.surahs.length}</span></div>`);
      parts.push(r.surahs.map(s => `
        <a class="list-item" href="#/quran/s/${s.n}">
          <div class="num">${s.n}</div>
          <div class="t"><b>${esc(s.phonetic)}</b><small>${esc(s.fr)} · ${s.verses} versets</small></div>
          <div class="arname">${esc(s.name)}</div>
        </a>`).join(''));
    }

    // ---------- phonétique ----------
    if (r.phonetic.length) {
      parts.push(`<div class="result-cat">🗣️ Versets proches de votre phonétique <span class="cnt">${r.phonetic.length}</span></div>`);
      const getP = await enrich(r.phonetic.map(p => ({ s: p.s, v: p.v })), 6);
      parts.push(r.phonetic.map(p => verseCard({ ...p, phon: true }, meta(p.s), q, getP(p))).join(''));
    }

    // ---------- sections par catégorie, ordonnées selon l'intention ----------
    const versesAll = [...r.verses, ...r.versesTopic];
    const hadithsAll = [...r.hadiths, ...r.hadithsTopic];
    const duasAll = [...r.duas, ...r.duasTopic];
    const sections = {
      quran: async () => {
        if (!versesAll.length || r.phonetic.length) return '';
        const getV2 = await enrich(versesAll, 8);
        return `<div class="result-cat">📖 Coran <span class="cnt">${versesAll.length} résultat${versesAll.length > 1 ? 's' : ''}</span></div>`
          + versesAll.slice(0, 12).map(v => verseCard(v, meta(v.s), q, getV2(v))).join('');
      },
      hadith: async () => hadithsAll.length
        ? `<div class="result-cat">📜 Hadiths <span class="cnt">${hadithsAll.length} résultat${hadithsAll.length > 1 ? 's' : ''}</span></div>`
          + hadithsAll.slice(0, 10).map(h => hadithCard(h, q)).join('')
        : '',
      dua: async () => duasAll.length
        ? `<div class="result-cat">🤲 Invocations <span class="cnt">${duasAll.length}</span></div>`
          + duasAll.slice(0, 8).map(d => duaCardMini(d, q)).join('')
        : '',
    };
    const order = r.hints.dua ? ['dua', 'quran', 'hadith']
      : r.hints.hadith ? ['hadith', 'quran', 'dua']
      : r.hints.quran ? ['quran', 'dua', 'hadith']
      : ['quran', 'hadith', 'dua'];
    for (const key of order) parts.push(await sections[key]());

    if (!answer) {
      parts.push(`<div class="notice">Résultats issus exclusivement des textes de l'application, avec leurs sources.
        « Correspondance exacte » = vos mots apparaissent dans le texte ;
        « Lié au sujet » = passage référencé pour ce thème dans notre base vérifiée.</div>`);
    }
    results.innerHTML = parts.join('');
    window.scrollTo({ top: 0 });
  }

  input.oninput = () => {
    clearTimeout(debounce); clearTimeout(sugDebounce);
    const v = input.value;
    sugDebounce = setTimeout(() => showSuggestions(v), 120);
    debounce = setTimeout(() => run(v), 350);
  };
  input.onkeydown = e => { if (e.key === 'Enter') { clearTimeout(debounce); hideSug(); run(input.value); } };
  document.getElementById('qClear').onclick = () => { input.value = ''; hideSug(); renderIdle(); input.focus(); };

  if (initial) run(initial); else { renderIdle(); setTimeout(() => input.focus(), 80); }
}

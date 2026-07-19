// Recherche globale : moteur unifié (exact + flou + phonétique + sujets + questions).
// Tous les résultats proviennent de la base locale et affichent leur source.
import { $view, esc, bindTopbar, topbar } from './app.js';
import { state, pushHistory } from './state.js';
import { searchAll, buildAnswer, suggest, tokens, fold, stem } from './engine.js';
import { arToLatin } from './translit.js';
import * as data from './data.js';

const SUGGESTIONS = [
  'quelle doua quand j\'ai peur ?', 'laqad jaakoum', 'verset sur quelqu\'un qui ment',
  'quelqu\'un qui parle dans le dos des autres', 'que dit le prophète ﷺ sur la trahison ?',
  'comment faire la prière de consultation ?', 'histoire de Dhul-Qarnayn',
  'doua avant de dormir', 'que dit l\'islam sur la colère', 'adhkar du matin',
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
const badgeApprox = `<span class="badge badge-en" style="font-size:.62rem">Correspondance approximative</span>`;
const badgeTopic = t => `<span class="badge" style="font-size:.62rem">Par le sens : ${esc(t)}</span>`;
const badgePhon = `<span class="badge hasan" style="font-size:.62rem">Correspondance phonétique</span>`;
const matchBadge = x => x.topic ? badgeTopic(x.topic) : x.phon ? badgePhon : x.approx ? badgeApprox : badgeExact;

// ---------- cartes ----------
const clamp = (t, n) => t && t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;

function verseCard(v, meta, q, enriched) {
  const cfg = state.settings;
  const label = matchBadge(v);
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
  const label = matchBadge(h);
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
  const label = matchBadge(d);
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
    <div class="search-input big" style="position:relative">
      <span>🔍</span>
      <input id="qInput" type="search" placeholder="Posez votre question…"
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
    const hist = state.settings.searchHistoryOn ? state.searchHistory : [];
    results.innerHTML = `
      <div class="ai-hero">
        <b>🕌 Votre assistant de recherche</b>
        <p>Posez une question naturelle, même avec des fautes — je comprends l'intention,
        je cherche dans le Coran, les hadiths et les invocations, et je réponds en français
        avec les sources. Jamais rien d'inventé.</p>
      </div>
      ${hist.length ? `<h2>Recherches récentes</h2>
        <div class="chiprow">${hist.map(h => `<button class="chip" data-q="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : ''}
      <h2>Essayez par exemple</h2>
      <div class="chiprow" style="flex-wrap:wrap">${SUGGESTIONS.map(sq => `<button class="chip" data-q="${esc(sq)}">${esc(sq)}</button>`).join('')}</div>
      <div class="notice">Posez n'importe quelle <b>question naturelle</b>, même avec des fautes de frappe :
      le moteur comprend votre intention, corrige l'orthographe, reconnaît l'<b>arabe écrit en phonétique</b>
      approximative (« lakhadjaakoul ») et cherche par le <b>sens</b> (« quelqu'un qui parle dans le dos des
      autres » → médisance). Il cherche ensuite dans le Coran, les hadiths et les invocations de l'application,
      sélectionne les meilleurs passages et assemble une <b>réponse directe sourcée</b>.
      Rien n'est jamais inventé : chaque résultat affiche sa source, et s'il n'y a pas de source fiable,
      l'application vous le dit.</div>
    `;
    results.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { input.value = b.dataset.q; hideSug(); run(b.dataset.q); });
  }

  function hideSug() { sugEl.style.display = 'none'; sugEl.innerHTML = ''; }

  async function showSuggestions(q) {
    if (!state.settings.searchSuggest) { hideSug(); return; }
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
    results.innerHTML = `
      <div class="skel" style="height:64px;margin:10px 0"></div>
      <div class="skel" style="height:120px;margin:10px 0"></div>
      <div class="skel" style="height:120px;margin:10px 0"></div>`;
    const r = await searchAll(q, {
      smart: state.settings.searchSmart,
      phonetic: state.settings.searchPhonetic,
    });
    if (lastQuery !== q) return; // une requête plus récente est partie
    const answer = buildAnswer(r);
    if (state.settings.searchHistoryOn) pushHistory(q.trim());

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

    // ---------- compréhension de la requête (corrections affichées) ----------
    if (r.corrections?.length) {
      parts.push(`<div class="notice" style="padding:9px 12px;margin-bottom:10px">🧠 Recherche comprise comme
        « <b>${esc(r.understood)}</b> »
        <span class="tiny" style="display:block;margin-top:2px">${r.corrections.map(([a, b]) => `${esc(a)} → ${esc(b)}`).join(' · ')}</span></div>`);
    }

    // éléments déjà montrés dans la réponse directe (pour ne pas les répéter)
    const shownV = new Set(), shownH = new Set(), shownD = new Set();

    // ---------- 1. RÉPONSE DIRECTE ----------
    if (answer) {
      parts.push(`<div class="result-cat" style="font-size:1.05rem">🕌 Réponse directe</div>`);
      if (answer.topic) parts.push(topicCard(answer.topic));
      const getV = await enrich([...answer.verses], 3);
      if (answer.duas.length) {
        parts.push(`<div class="tiny" style="margin:10px 2px 2px;font-weight:700">🤲 INVOCATION${answer.duas.length > 1 ? 'S' : ''}</div>`);
        parts.push(answer.duas.map(d => duaCardMini(d, q)).join(''));
        answer.duas.forEach(d => shownD.add(d.id));
      }
      if (answer.hadiths.length) {
        parts.push(`<div class="tiny" style="margin:10px 2px 2px;font-weight:700">📜 HADITHS AUTHENTIQUES</div>`);
        parts.push(answer.hadiths.map(h => hadithCard(h, q)).join(''));
        answer.hadiths.forEach(h => shownH.add(h.id));
      }
      if (answer.verses.length) {
        parts.push(`<div class="tiny" style="margin:10px 2px 2px;font-weight:700">📖 CORAN</div>`);
        parts.push(answer.verses.map(v => verseCard(v, meta(v.s), q, getV(v))).join(''));
        answer.verses.forEach(v => shownV.add(`${v.s}:${v.v}`));
      }
      parts.push(`<div class="notice">📚 Réponse assemblée uniquement à partir des sources citées ci-dessus,
        présentes dans la base vérifiée de Nour — rien n'est généré ni inventé.
        Pour un avis religieux, consultez un savant ou un imam.</div>`);
    }

    // ---------- 2-4. Coran / Hadiths / Invocations ----------
    const versesEx = r.verses.filter(v => !shownV.has(`${v.s}:${v.v}`));
    const phonEx = r.phonetic.filter(p => !shownV.has(`${p.s}:${p.v}`));
    const hadithsEx = r.hadiths.filter(h => !shownH.has(h.id));
    const duasEx = r.duas.filter(d => !shownD.has(d.id));
    const sections = {
      quran: async () => {
        const total = versesEx.length + phonEx.length;
        if (!total) return '';
        let html = `<div class="result-cat">📖 Coran <span class="cnt">${total} résultat${total > 1 ? 's' : ''}</span></div>`;
        if (phonEx.length) {
          const getP = await enrich(phonEx.map(p => ({ s: p.s, v: p.v })), 6);
          html += phonEx.map(p => verseCard({ ...p, phon: true }, meta(p.s), q, getP(p))).join('');
        }
        if (versesEx.length && !phonEx.length) {
          const getV2 = await enrich(versesEx, 8);
          html += versesEx.slice(0, 12).map(v => verseCard(v, meta(v.s), q, getV2(v))).join('');
        }
        return html;
      },
      hadith: async () => hadithsEx.length
        ? `<div class="result-cat">📜 Hadiths <span class="cnt">${hadithsEx.length} résultat${hadithsEx.length > 1 ? 's' : ''}</span></div>`
          + hadithsEx.slice(0, 10).map(h => hadithCard(h, q)).join('')
        : '',
      dua: async () => duasEx.length
        ? `<div class="result-cat">🤲 Invocations <span class="cnt">${duasEx.length}</span></div>`
          + duasEx.slice(0, 8).map(d => duaCardMini(d, q)).join('')
        : '',
    };
    const order = r.hints.dua ? ['dua', 'quran', 'hadith']
      : r.hints.hadith ? ['hadith', 'quran', 'dua']
      : r.hints.quran ? ['quran', 'dua', 'hadith']
      : ['quran', 'hadith', 'dua'];
    for (const key of order) parts.push(await sections[key]());

    // ---------- 5. RÉSULTATS LIÉS ----------
    // sujets détectés + contenus référencés pour ces sujets non encore affichés + sourates
    const linkedV = r.versesTopic.filter(v => !shownV.has(`${v.s}:${v.v}`)).slice(0, 5);
    const linkedH = r.hadithsTopic.filter(h => !shownH.has(h.id)).slice(0, 4);
    const linkedD = r.duasTopic.filter(d => !shownD.has(d.id)).slice(0, 3);
    const otherTopics = r.topics.filter(t => !answer || !answer.topic || t.topic.id !== answer.topic.id).slice(0, answer ? 2 : 1);
    if (linkedV.length + linkedH.length + linkedD.length + r.surahs.length + (answer ? otherTopics.length : 0) > 0) {
      parts.push(`<div class="result-cat">🔗 Résultats liés</div>`);
      if (!answer && otherTopics.length) parts.push(otherTopics.map(t => topicCard(t.topic)).join(''));
      if (r.surahs.length) {
        parts.push(r.surahs.map(s => `
          <a class="list-item" href="#/quran/s/${s.n}">
            <div class="num">${s.n}</div>
            <div class="t"><b>${esc(s.phonetic)}</b><small>${esc(s.fr)} · ${s.verses} versets</small></div>
            <div class="arname">${esc(s.name)}</div>
          </a>`).join(''));
      }
      if (linkedV.length) {
        const getT = await enrich(linkedV, 5);
        parts.push(linkedV.map(v => verseCard(v, meta(v.s), q, getT(v))).join(''));
      }
      if (linkedH.length) parts.push(linkedH.map(h => hadithCard(h, q)).join(''));
      if (linkedD.length) parts.push(linkedD.map(d => duaCardMini(d, q)).join(''));
      if (answer && otherTopics.length) parts.push(otherTopics.map(t => topicCard(t.topic)).join(''));
    }

    if (!answer) {
      parts.push(`<div class="notice">Résultats issus exclusivement des textes de l'application, avec leurs sources.
        « Correspondance exacte » = vos mots apparaissent dans le texte ·
        « Correspondance phonétique » = proche de l'arabe que vous avez écrit en lettres latines ·
        « Par le sens » = passage référencé pour ce thème dans notre base vérifiée.</div>`);
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

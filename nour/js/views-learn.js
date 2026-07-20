// Apprendre : guides visuels pour débuter — les ablutions (wudû’) et la prière
// (salât). Étapes numérotées avec illustration originale, arabe, phonétique
// française, traduction et explication. Audio du takbîr/formules non fourni :
// on privilégie la clarté visuelle. Contenu présenté de façon simplifiée, avec
// ses sources ; il ne remplace pas l'apprentissage auprès d'un enseignant.
import { $view, esc } from './app.js';
import { icon } from './icons.js';
import { state } from './state.js';

let CACHE = null;
async function load() {
  if (!CACHE) CACHE = await fetch('data/learn.json').then(r => r.json());
  return CACHE;
}

// ---- figures : silhouettes claires (postures de prière + gestes de wudû') ----
const FIG = {
  // gestes d'ablutions
  heart: `<path d="M32 47s-15-9-15-21a8 8 0 0 1 15-3 8 8 0 0 1 15 3c0 12-15 21-15 21Z"/>`,
  hands: `<path d="M20 44V30a3 3 0 0 1 6 0M26 30v-4a3 3 0 0 1 6 0v4M32 27a3 3 0 0 1 6 0v6M38 31a3 3 0 0 1 5 0v10c0 6-4 11-11 11s-12-4-12-11"/>`,
  mouth: `<circle cx="32" cy="30" r="15"/><path d="M24 34c2 3 5 4 8 4s6-1 8-4"/><path d="M28 26h1M35 26h1"/>`,
  nose: `<circle cx="32" cy="30" r="15"/><path d="M32 22v9l-3 3h6l-3-3"/><path d="M27 39c2 1.5 8 1.5 10 0"/>`,
  face: `<path d="M32 15c8 0 13 6 13 15s-6 19-13 19-13-10-13-19S24 15 32 15Z"/><path d="M27 29h2M35 29h2M28 39c2 2 6 2 8 0"/>`,
  arm: `<path d="M18 24h10l14 14a4 4 0 0 1-6 6L24 32"/><path d="M18 21v6"/>`,
  head: `<path d="M20 32a12 12 0 0 1 24 0"/><path d="M17 32h30"/><path d="M22 36c-2 3-2 6-2 6M42 36c2 3 2 6 2 6"/>`,
  foot: `<path d="M24 18c4 0 6 4 6 10s2 18-4 18-8-8-8-14 2-14 6-14Z"/><path d="M30 40h10a3 3 0 0 0 0-6h-8"/>`,
  sparkle: `<path d="M32 14l3 11 11 3-11 3-3 11-3-11-11-3 11-3Z"/>`,
  // postures de prière (personnage stylisé)
  stand: `<circle cx="32" cy="15" r="5"/><path d="M32 21v20"/><path d="M24 26h16"/><path d="M32 41l-5 12M32 41l5 12"/>`,
  ruku: `<circle cx="21" cy="19" r="5"/><path d="M24 22c8 2 18 3 24 4"/><path d="M30 25l-1 12M46 27l1 10"/><path d="M22 24l-1 29"/>`,
  sujud: `<circle cx="16" cy="40" r="5"/><path d="M20 42h20l8-4"/><path d="M24 42l4-10 8-2"/><path d="M40 42v11M28 42v11"/>`,
  sit: `<circle cx="32" cy="17" r="5"/><path d="M32 23v14"/><path d="M25 30h14"/><path d="M32 37c-6 0-9 4-13 5h26c-4-1-7-5-13-5Z"/>`,
  salam: `<circle cx="32" cy="15" r="5"/><path d="M32 21v18"/><path d="M32 26l10 3M32 28l-10 3"/><path d="M32 39l-5 14M32 39l5 14"/>`,
};
const figure = k => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FIG[k] || FIG.sparkle}</svg>`;

// ---------- accueil « Apprendre » ----------
export async function viewLearn() {
  const d = await load();
  $view.innerHTML = `
    <a class="backlink" href="#/more">${icon('chevL', 15)} Plus</a>
    <h1 style="margin:6px 2px 2px">${icon('learn', 24)} Apprendre</h1>
    <p class="muted" style="margin:2px 2px 14px">Des guides visuels, pas à pas, pour bien débuter.</p>
    ${d.guides.map(g => `
      <a class="card learn-card" href="#/learn/${g.id}">
        <span class="learn-ic">${icon(g.icon, 26)}</span>
        <span class="grow"><b>${esc(g.title)}</b><small>${esc(g.subtitle)}</small></span>
        ${icon('chevR', 18)}
      </a>`).join('')}
    <div class="notice">Ces guides sont volontairement simplifiés pour les débutants et indiquent leurs sources.
      Ils ne remplacent pas l’apprentissage auprès d’un imam ou d’un enseignant qualifié, notamment pour
      les détails propres à chaque école juridique.</div>
  `;
}

// ---------- guide détaillé ----------
export async function viewLearnGuide(id) {
  const d = await load();
  const g = d.guides.find(x => x.id === id);
  if (!g) { location.hash = '#/learn'; return; }
  const cfg = state.settings;
  $view.innerHTML = `
    <a class="backlink" href="#/learn">${icon('chevL', 15)} Apprendre</a>
    <div class="surah-head" style="padding:20px 16px">
      <div style="font-size:1.5rem;font-weight:800">${esc(g.title)}</div>
      <div class="frname">${esc(g.subtitle)}</div>
    </div>
    <div class="notice" style="margin-top:0">${esc(g.intro)}</div>
    ${g.steps.map((st, i) => `
      <div class="card learn-step">
        <div class="learn-step-head">
          <span class="learn-num">${i + 1}</span>
          <span class="learn-fig">${figure(st.fig)}</span>
          <b class="grow">${esc(st.title)}</b>
        </div>
        <p class="fr" style="margin:4px 0 8px">${esc(st.fr)}</p>
        ${st.ar && cfg.showAr ? `<div class="ar" style="font-size:calc(var(--ar-size)*.82)">${esc(st.ar)}</div>` : ''}
        ${st.tl && cfg.showTl ? `<div class="tl" style="color:var(--ink-2);font-style:italic;margin:5px 0">${esc(st.tl)}</div>` : ''}
        ${st.trad ? `<p class="fr" style="margin:4px 0 0"><span class="muted">« ${esc(st.trad)} »</span></p>` : ''}
        ${st.note ? `<div class="notice" style="margin:8px 0 0">${esc(st.note)}</div>` : ''}
      </div>`).join('')}
    <div class="notice">${icon('info', 14)} ${esc(g.source)}</div>
    <p class="signature">Conçu par Malick Gueye, alias Lecce</p>
  `;
}

// Tasbih : compteur de dhikr avec formules authentiques (arabe + phonétique
// française + traduction), objectifs 33/100, dhikr personnalisé, vibration,
// totaux sauvegardés.
import { $view, esc, toast, sheet, closeSheet, vibrate } from './app.js';
import { icon } from './icons.js';
import { state, save } from './state.js';

const DHIKRS = [
  { ar: 'سُبْحَانَ اللَّهِ', tl: 'Soubhâna Llâh', fr: 'Gloire et pureté à Allah' },
  { ar: 'الْحَمْدُ لِلَّهِ', tl: 'Al-hamdou lillâh', fr: 'Louange à Allah' },
  { ar: 'اللَّهُ أَكْبَرُ', tl: 'Allâhou akbar', fr: 'Allah est le plus Grand' },
  { ar: 'لَا إِلَٰهَ إِلَّا اللَّهُ', tl: 'Lâ ilâha illa Llâh', fr: "Il n'y a de divinité digne d'adoration qu'Allah" },
  { ar: 'أَسْتَغْفِرُ اللَّهَ', tl: 'Astaghfirou Llâh', fr: 'Je demande pardon à Allah' },
  { ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', tl: 'Soubhâna Llâhi wa bi-hamdih', fr: 'Gloire à Allah et louange à Lui' },
  { ar: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', tl: 'Lâ hawla wa lâ qouwwata illâ bi-Llâh', fr: "Il n'y a de force ni de puissance que par Allah" },
];

export function viewTasbih() {
  const t = state.tasbih;
  const all = [...DHIKRS, ...t.custom];
  const cur = all[Math.min(t.dhikrId, all.length - 1)] || DHIKRS[0];
  const pct = Math.min(1, t.current / t.target);
  const R = 46;
  const circ = 2 * Math.PI * R;

  $view.innerHTML = `
    <a class="backlink" href="#/home">${icon('chevL', 15)} Accueil</a>
    <h1>${icon('beads', 24)} Tasbih</h1>

    <div class="chiprow">
      ${all.map((d, i) => `<button class="chip ${i === Math.min(t.dhikrId, all.length - 1) ? 'on' : ''}" data-d="${i}">${esc(d.tl)}</button>`).join('')}
      <button class="chip" id="addDhikr">${icon('note', 13)} Personnalisé</button>
    </div>

    <div class="card center" style="padding:14px">
      <div class="ar" style="text-align:center;font-size:calc(var(--ar-size)*.95)">${esc(cur.ar)}</div>
      <div class="tl" style="color:var(--ink-2);font-style:italic">${esc(cur.tl)}</div>
      <div class="fr muted">${esc(cur.fr)}</div>
    </div>

    <div class="tasbih-count" id="counter" role="button" aria-label="Compter">
      <svg class="ring" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="${R}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="5"/>
        <circle id="ringFg" cx="50" cy="50" r="${R}" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="5"
          stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct)}"/>
      </svg>
      <div class="center">
        <div class="big" id="cnt">${t.current}</div>
        <div class="tgt">/ ${t.target}</div>
      </div>
    </div>

    <div class="row" style="justify-content:center;gap:10px">
      <div class="seg" id="tgtSeg">
        ${[33, 100, 1000].map(x => `<button data-v="${x}" class="${t.target === x ? 'on' : ''}">${x}</button>`).join('')}
      </div>
      <button class="btn btn-ghost" id="resetBtn">Réinitialiser</button>
    </div>

    <div class="card" style="padding:10px 16px">
      <b style="font-size:.9rem">Totaux</b>
      <p class="tiny" style="margin:6px 0 0">
        Aujourd'hui : <b>${(t.totals[new Date().toISOString().slice(0, 10)] || 0).toLocaleString('fr-FR')}</b>
        &nbsp;·&nbsp; Total : <b>${Object.values(t.totals).reduce((a, b) => a + b, 0).toLocaleString('fr-FR')}</b>
      </p>
    </div>
  `;

  const cntEl = document.getElementById('cnt');
  const ring = document.getElementById('ringFg');

  document.getElementById('counter').onclick = () => {
    t.current++;
    const day = new Date().toISOString().slice(0, 10);
    t.totals[day] = (t.totals[day] || 0) + 1;
    vibrate(8);
    if (t.current >= t.target) {
      vibrate(60);
      toast(`${t.target} atteints — qu'Allah accepte`);
      t.current = 0;
    }
    cntEl.textContent = t.current;
    ring.style.strokeDashoffset = circ * (1 - Math.min(1, t.current / t.target));
    save();
  };

  document.getElementById('tgtSeg').onclick = e => {
    const v = +e.target.dataset?.v; if (!v) return;
    t.target = v; t.current = Math.min(t.current, v - 1); save(); viewTasbih();
  };
  document.getElementById('resetBtn').onclick = () => { t.current = 0; save(); viewTasbih(); };

  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
    t.dhikrId = +b.dataset.d; t.current = 0; save(); viewTasbih();
  });

  document.getElementById('addDhikr').onclick = () => {
    sheet(`<h3>Dhikr personnalisé</h3>
      <input id="cAr" placeholder="Texte arabe (optionnel)" style="width:100%;font:inherit;padding:11px;border-radius:11px;border:1.5px solid var(--line);background:var(--bg-soft);color:var(--ink);margin-bottom:8px" dir="rtl">
      <input id="cTl" placeholder="Phonétique (ex : Soubhâna Llâh)" style="width:100%;font:inherit;padding:11px;border-radius:11px;border:1.5px solid var(--line);background:var(--bg-soft);color:var(--ink);margin-bottom:8px">
      <input id="cFr" placeholder="Sens en français (optionnel)" style="width:100%;font:inherit;padding:11px;border-radius:11px;border:1.5px solid var(--line);background:var(--bg-soft);color:var(--ink);margin-bottom:12px">
      <button class="btn" id="cAdd" style="width:100%">Ajouter</button>`, el => {
      el.querySelector('#cAdd').onclick = () => {
        const tl = el.querySelector('#cTl').value.trim();
        if (!tl) { toast('Écrivez au moins la phonétique'); return; }
        state.tasbih.custom.push({
          ar: el.querySelector('#cAr').value.trim(),
          tl, fr: el.querySelector('#cFr').value.trim(),
        });
        state.tasbih.dhikrId = DHIKRS.length + state.tasbih.custom.length - 1;
        state.tasbih.current = 0;
        save(); closeSheet(); viewTasbih();
      };
    });
  };
}

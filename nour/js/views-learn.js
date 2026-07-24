// Mode Apprendre interactif : illustrations explicites, progression locale,
// arabe, phonétique française, traduction, erreurs fréquentes et preuves.
import { $view, esc, toast } from './app.js';
import { icon } from './icons.js';
import { state, save } from './state.js';

let CACHE = null;
async function load() {
  if (!CACHE) CACHE = await fetch('data/learn.json').then(r => r.json());
  return CACHE;
}

const doneFor = id => new Set(state.learnProgress?.[id] || []);
const percent = (guide, done) => Math.round(done.size / guide.steps.length * 100);
const lines = text => esc(text || '').replace(/\n/g, '<br>');

function stopVoice() {
  try { speechSynthesis.cancel(); } catch {}
}

function speakArabic(text) {
  if (!text || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    toast('La lecture vocale n’est pas disponible sur cet appareil');
    return;
  }
  stopVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-SA';
  utterance.rate = 0.72;
  utterance.pitch = 1;
  speechSynthesis.speak(utterance);
}

export async function viewLearn() {
  stopVoice();
  const data = await load();
  $view.innerHTML = `
    <a class="backlink" href="#/more">${icon('chevL', 15)} Plus</a>
    <h1 class="learn-title">${icon('learn', 25)} Apprendre</h1>
    <p class="muted learn-intro">Deux parcours guidés pour apprendre seul, progresser à son rythme et retrouver les preuves.</p>
    <div class="learn-grid">
      ${data.guides.map(guide => {
        const done = doneFor(guide.id);
        const pct = percent(guide, done);
        return `<a class="card learn-card" href="#/learn/${guide.id}">
          <img class="learn-card-image" src="${esc(guide.cover)}" alt="" loading="lazy">
          <span class="learn-card-body">
            <span class="learn-card-icon">${icon(guide.icon, 18)}</span>
            <b>${esc(guide.title)}</b>
            <small>${esc(guide.subtitle)}</small>
            <span class="learn-progress" aria-label="${pct} pour cent terminé">
              <span style="width:${pct}%"></span>
            </span>
            <small>${done.size} étape${done.size > 1 ? 's' : ''} comprise${done.size > 1 ? 's' : ''} sur ${guide.steps.length}</small>
          </span>
          <span class="learn-card-arrow">${icon('chevR', 18)}</span>
        </a>`;
      }).join('')}
    </div>
    <div class="notice learn-safety">${icon('info', 16)}
      <span>Les illustrations servent de repères pédagogiques. Les détails reconnus entre écoles sont signalés ;
      pour corriger une récitation ou une posture, faites-vous observer par un imam ou une personne qualifiée.</span>
    </div>
    <p class="signature">Conçu par Malick Gueye, alias Lecce</p>
  `;
}

export async function viewLearnGuide(id) {
  stopVoice();
  const data = await load();
  const guide = data.guides.find(item => item.id === id);
  if (!guide) {
    location.hash = '#/learn';
    return;
  }
  if (!state.learnProgress) state.learnProgress = { wudu: [], salat: [] };
  if (!Array.isArray(state.learnProgress[id])) state.learnProgress[id] = [];

  let current = guide.steps.findIndex((_, index) => !state.learnProgress[id].includes(index));
  if (current < 0) current = 0;

  const render = () => {
    const step = guide.steps[current];
    const done = doneFor(id);
    const pct = percent(guide, done);
    const isDone = done.has(current);
    const cfg = state.settings;

    $view.innerHTML = `
      <a class="backlink" href="#/learn">${icon('chevL', 15)} Apprendre</a>
      <header class="learn-guide-head">
        <div>
          <h1>${esc(guide.title)}</h1>
          <p>${esc(guide.subtitle)}</p>
        </div>
        <span class="learn-pct">${pct} %</span>
      </header>
      <div class="learn-progress learn-progress-wide" aria-label="${pct} pour cent terminé">
        <span style="width:${pct}%"></span>
      </div>
      <p class="notice learn-guide-intro">${esc(guide.intro)}</p>

      <nav class="learn-step-nav" aria-label="Étapes du parcours">
        ${guide.steps.map((item, index) => `
          <button class="learn-step-dot ${index === current ? 'active' : ''} ${done.has(index) ? 'done' : ''}"
            data-step="${index}" aria-label="Étape ${index + 1} : ${esc(item.title)}" aria-current="${index === current ? 'step' : 'false'}">
            ${done.has(index) ? icon('check', 14) : index + 1}
          </button>`).join('')}
      </nav>

      <article class="card learn-stage">
        <div class="learn-stage-heading">
          <span class="learn-num">${current + 1}</span>
          <div><span class="tiny">ÉTAPE ${current + 1} SUR ${guide.steps.length}</span><h2>${esc(step.title)}</h2></div>
        </div>

        <figure class="learn-media">
          <img src="${esc(step.image)}" alt="${esc(step.imageAlt)}">
          <figcaption>${esc(guide.mediaLabel)} — non photographiques</figcaption>
        </figure>

        <section class="learn-block">
          <h3>Comment faire</h3>
          <p>${esc(step.fr)}</p>
          ${step.detail ? `<p class="muted">${esc(step.detail)}</p>` : ''}
        </section>

        ${step.ar && cfg.showAr ? `<section class="learn-recitation">
          <div class="learn-recitation-head">
            <h3>Texte à réciter</h3>
            <button class="btn btn-ghost learn-audio" type="button">${icon('audio', 16)} Écouter</button>
          </div>
          <div class="ar learn-ar">${lines(step.ar)}</div>
          ${cfg.showTl && step.tl ? `<div class="learn-translit"><b>Phonétique française</b><p>${lines(step.tl)}</p></div>` : ''}
          ${step.trad ? `<div class="learn-translation"><b>Traduction française</b><p>${esc(step.trad)}</p></div>` : ''}
          <div class="tiny learn-audio-note">Audio de prononciation produit localement par la voix arabe de l’appareil ;
          sa disponibilité et sa qualité dépendent du navigateur. Il ne remplace pas un récitant.</div>
        </section>` : ''}

        ${step.errors?.length ? `<section class="learn-block learn-errors">
          <h3>Erreurs fréquentes à éviter</h3>
          <ul>${step.errors.map(error => `<li>${esc(error)}</li>`).join('')}</ul>
        </section>` : ''}

        <section class="learn-proof">
          <h3>${icon('book', 16)} Preuve et référence</h3>
          <p>${esc(step.proof)}</p>
        </section>
      </article>

      <div class="learn-actions">
        <button class="btn btn-ghost" id="learnPrev" ${current === 0 ? 'disabled' : ''}>${icon('chevL', 16)} Précédent</button>
        <button class="btn ${isDone ? 'btn-ghost' : ''}" id="learnDone">
          ${icon('check', 16)} ${isDone ? 'Étape comprise' : 'Marquer comme comprise'}
        </button>
        <button class="btn btn-ghost" id="learnNext" ${current === guide.steps.length - 1 ? 'disabled' : ''}>Suivant ${icon('chevR', 16)}</button>
      </div>

      <div class="notice learn-source">${icon('info', 15)}
        <span><b>Sources du parcours :</b> ${esc(guide.source)}<br>${esc(guide.mediaCredit)}</span>
      </div>
      <p class="signature">Conçu par Malick Gueye, alias Lecce</p>
    `;

    $view.querySelectorAll('[data-step]').forEach(button => {
      button.onclick = () => {
        stopVoice();
        current = Number(button.dataset.step);
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });
    $view.querySelector('.learn-audio')?.addEventListener('click', () => speakArabic(step.audioText || step.ar));
    document.getElementById('learnPrev').onclick = () => {
      stopVoice();
      current = Math.max(0, current - 1);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    document.getElementById('learnNext').onclick = () => {
      stopVoice();
      current = Math.min(guide.steps.length - 1, current + 1);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    document.getElementById('learnDone').onclick = () => {
      const arr = state.learnProgress[id];
      const pos = arr.indexOf(current);
      if (pos >= 0) {
        arr.splice(pos, 1);
        toast('Étape remise à faire');
      } else {
        arr.push(current);
        arr.sort((a, b) => a - b);
        toast('Progression enregistrée sur cet appareil');
      }
      save();
      render();
    };
  };

  render();
}

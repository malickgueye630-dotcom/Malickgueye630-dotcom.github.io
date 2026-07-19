// Page « Plus » : toutes les fonctionnalités hors barre d'onglets,
// présentées en groupes façon iOS.
import { $view, esc, hijriDate, frDate } from './app.js';
import { icon } from './icons.js';

const GROUPS = [
  ['Bibliothèque', [
    ['library', '#101F3E,#23456E', 'Hadiths', 'Les 6 grands recueils, thèmes et filtres', '#/hadith'],
    ['hands', '#0F8B6D,#39C6A3', 'Douas', 'Invocations authentiques par situation', '#/duas'],
    ['sunrise', '#B07818,#D4AF6A', 'Adhkar matin & soir', 'Le rappel quotidien du matin et du soir', '#/duas/matin-soir'],
    ['star', '#8A2F42,#C05C6B', 'Favoris', 'Versets, hadiths et douas enregistrés', '#/favorites'],
  ]],
  ['Pratique', [
    ['kaaba', '#073B3A,#0F8B6D', 'Qibla', 'Boussole vers la Kaaba', '#/qibla'],
    ['beads', '#372060,#6D4A9E', 'Tasbih', 'Compteur de dhikr avec objectifs', '#/tasbih'],
    ['bell', '#6E3F2B,#B3654A', 'Notifications', 'Rappels de prière et adhkar', '#/prayer'],
  ]],
  ['Application', [
    ['settings', '#52617C,#8592A4', 'Paramètres', 'Apparence, Coran, prières, Qibla, recherche', '#/settings'],
    ['book', '#145A52,#2AAE8C', 'Sources & à propos', 'Textes, traductions et licences utilisés', '#/about'],
  ]],
];

export function viewMore() {
  $view.innerHTML = `
    <h1 style="margin:12px 2px 2px">Plus</h1>
    <p class="tiny" style="margin:0 2px 4px">${esc(frDate())} · ${esc(hijriDate())}</p>
    ${GROUPS.map(([title, items]) => `
      <div class="setgroup" style="padding:4px 16px 6px">
        <h2>${esc(title)}</h2>
        ${items.map(([ic, grad, label, sub, href]) => `
          <a class="more-item" href="${href}">
            <span class="mic" style="background:linear-gradient(135deg,${grad})">${icon(ic, 19)}</span>
            <span class="grow"><b>${esc(label)}</b><small>${esc(sub)}</small></span>
            ${icon('chevR', 16)}
          </a>`).join('')}
      </div>`).join('')}
  `;
}

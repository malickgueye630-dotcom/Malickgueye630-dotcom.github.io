// Page Prières : dates (grégorienne + hégirienne), horaires du jour avec
// prière actuelle et prochaine en évidence, cloche de rappel par prière,
// localisation, méthode de calcul, madhhab, ajustements, format 12/24 h,
// centre de notifications et export calendrier.
import { $view, esc, toast, sheet, closeSheet, hijriDate, frDate, fmtClock } from './app.js';
import { icon, iconFilled } from './icons.js';
import { state, save } from './state.js';
import { PRAYERS, METHODS, prayerSettings, hasLocation, timesFor, nextPrayer, fmtCountdown, setLocation, geolocate, buildICS } from './prayer.js';
import { notifySettings, notifSupported, notifGranted, requestPermission, startScheduler, saveNotify } from './notify.js';
import { fold } from './engine.js';

let tick = null;

// prière « actuelle » : la dernière dont l'heure est passée
function currentPrayer(t, now) {
  let cur = null;
  for (const [key] of PRAYERS) {
    if (key === 'sunrise') continue;
    if (t[key] <= now) cur = key;
  }
  return cur;
}

export async function viewPrayer() {
  clearInterval(tick);
  const p = prayerSettings();
  let mosque; // undefined = non cherchée, null = échec, objet = trouvée
  let mosqueKey = null; // coordonnées pour lesquelles la recherche a été faite

  const render = () => {
    const now = new Date();
    const t = hasLocation() ? timesFor(now) : null;
    const np = hasLocation() ? nextPrayer(now) : null;
    const cur = t ? currentPrayer(t, now) : null;
    const n = notifySettings();

    $view.innerHTML = `
      <a class="backlink" href="#/home">${icon('chevL', 15)} Accueil</a>
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h1 style="margin:4px 0">${icon('mosque', 24)} Prières</h1>
          <p class="muted" style="margin:0">${esc(frDate(now))}<br><span class="tiny">${esc(hijriDate(now))}</span></p>
        </div>
        <a class="chip" href="#/qibla">${icon('kaaba', 14)} Qibla</a>
      </div>

      ${!hasLocation() ? `
      <div class="card center" style="padding:26px 18px">
        <p style="margin:0 0 14px"><b>Choisissez votre localisation</b><br>
        <span class="muted">pour calculer les horaires de vos cinq prières</span></p>
        <div class="row" style="justify-content:center;gap:10px">
          <button class="btn" id="btnGeo">${icon('location', 16)} Ma position</button>
          <button class="btn btn-ghost" id="btnCity">Choisir une ville</button>
        </div>
      </div>` : `
      <div class="surah-head" style="padding:18px 16px">
        <div style="font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;opacity:.75">Prochaine prière</div>
        <div style="font-size:1.9rem;font-weight:800;margin:4px 0">${esc(np.name)} — ${fmtClock(np.time)}</div>
        <div style="opacity:.85">Dans ${fmtCountdown(np.time - now)}</div>
        <div class="meta" style="margin-top:8px">${esc(p.city || `${p.lat}, ${p.lon}`)} · ${esc((METHODS.find(m => m.id === p.method) || {}).name || '')}${p.madhab === 'hanafi' ? ' · Asr hanafite' : ''}</div>
      </div>

      <div class="card" style="padding:6px 14px">
        ${PRAYERS.map(([key, name]) => {
          const isNext = np && np.key === key && t[key] > now;
          const isCur = cur === key && !isNext;
          const bellOn = key !== 'sunrise' && n.enabled[key];
          return `<div class="prayer-row ${isCur ? 'now' : ''} ${isNext ? 'next-p' : ''}">
            <div class="pn">${key === 'sunrise' ? icon('sunrise', 18) : icon('mosque', 18)} ${name}
              ${isCur ? '<span class="pill">Prière actuelle</span>' : ''}
              ${isNext ? '<span class="pill" style="background:var(--gold);color:#4a3a08">Prochaine</span>' : ''}
              ${key === 'sunrise' ? '<span class="tiny">(pas une prière)</span>' : ''}
            </div>
            <b>${fmtClock(t[key])}</b>
            ${key !== 'sunrise' ? `<button class="btn-icon ${bellOn ? 'on' : ''}" data-bell="${key}" aria-label="Rappel ${name}">
              ${bellOn ? iconFilled('bell', 18) : icon('bell', 18)}</button>` : '<span style="width:34px"></span>'}
          </div>`;
        }).join('')}
      </div>

      <div class="card" id="nearMosque" style="padding:12px 16px">
        <div class="row"><span style="color:var(--brand)">${icon('mosque', 22)}</span>
        <div class="grow"><b>Mosquée la plus proche</b><br>
          <span class="tiny" id="nmText">${mosque === undefined ? 'Recherche en cours…' : mosque ? `${esc(mosque.name)} — ${mosque.dist < 1 ? Math.round(mosque.dist * 1000) + ' m' : mosque.dist.toFixed(1) + ' km'}` : 'Non trouvée à proximité (ou hors-ligne)'}</span></div>
        ${mosque ? `<a class="btn-icon" href="https://www.openstreetmap.org/?mlat=${mosque.lat}&mlon=${mosque.lon}#map=17/${mosque.lat}/${mosque.lon}" target="_blank" rel="noopener" aria-label="Voir sur la carte">${icon('navigation', 18)}</a>` : ''}
        </div>
      </div>`}

      <h2>Localisation &amp; calcul</h2>
      <div class="card" style="padding:8px 16px">
        <div class="setrow">
          <div class="lab">Position<small>${esc(p.city || (hasLocation() ? `${p.lat}, ${p.lon}` : 'Non définie'))}</small></div>
          <div class="row"><button class="btn btn-ghost" id="btnGeo2" style="padding:8px 12px">${icon('location', 15)} GPS</button>
          <button class="btn btn-ghost" id="btnCity2" style="padding:8px 12px">Ville</button></div>
        </div>
        <div class="setrow">
          <div class="lab">Méthode de calcul<small>Choisissez celle de votre mosquée</small></div>
          <select id="selMethod" style="font:inherit;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--bg-soft);color:var(--ink);max-width:165px">
            ${METHODS.map(m => `<option value="${m.id}" ${m.id === p.method ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
          </select>
        </div>
        <div class="setrow">
          <div class="lab">Asr (madhhab)<small>Hanafite : Asr plus tardif</small></div>
          <div class="seg" id="segMadhab">
            <button data-v="shafi" class="${p.madhab !== 'hanafi' ? 'on' : ''}">Majorité</button>
            <button data-v="hanafi" class="${p.madhab === 'hanafi' ? 'on' : ''}">Hanafite</button>
          </div>
        </div>
        <div class="setrow">
          <div class="lab">Format de l'heure</div>
          <div class="seg" id="segFmt">
            <button data-v="24" class="${state.settings.timeFmt !== '12' ? 'on' : ''}">24 h</button>
            <button data-v="12" class="${state.settings.timeFmt === '12' ? 'on' : ''}">12 h</button>
          </div>
        </div>
        <div class="setrow">
          <div class="lab">Ajustements manuels<small>Minutes ± par prière</small></div>
          <button class="btn btn-ghost" id="btnAdjust" style="padding:8px 12px">Régler</button>
        </div>
      </div>
      <div class="notice">Les horaires dépendent de la méthode de calcul et de la localisation : ils sont indicatifs.
      En cas de doute, fiez-vous à votre mosquée locale.</div>

      <h2>${icon('bell', 18)} Centre de notifications</h2>
      <div class="card" style="padding:8px 16px">
        ${!notifSupported() ? `<p class="muted" style="padding:8px 0">Les notifications ne sont pas disponibles dans ce navigateur.</p>` : `
        ${!notifGranted() ? `<div class="setrow"><div class="lab">Autoriser les notifications</div>
          <button class="btn" id="btnPerm" style="padding:8px 14px">Autoriser</button></div>` : ''}
        <div class="setrow">
          <div class="lab">Moment du rappel<small>S'applique aux prières activées (cloches ci-dessus)</small></div>
          <select id="selOffset" style="font:inherit;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--bg-soft);color:var(--ink)">
            <option value="0" ${!n.offset ? 'selected' : ''}>À l'heure exacte</option>
            <option value="-5" ${n.offset === -5 ? 'selected' : ''}>5 minutes avant</option>
            <option value="-10" ${n.offset === -10 ? 'selected' : ''}>10 minutes avant</option>
            <option value="-15" ${n.offset === -15 ? 'selected' : ''}>15 minutes avant</option>
            <option value="-30" ${n.offset === -30 ? 'selected' : ''}>30 minutes avant</option>
          </select>
        </div>
        <div class="setrow"><div class="lab">${icon('sunrise', 16)} Adhkar du matin (7 h)</div>
          <label class="switch"><input type="checkbox" data-ex="adhkarMatin" ${n.extras.adhkarMatin ? 'checked' : ''}><span class="tr"></span></label></div>
        <div class="setrow"><div class="lab">${icon('moon', 16)} Adhkar du soir (18 h 30)</div>
          <label class="switch"><input type="checkbox" data-ex="adhkarSoir" ${n.extras.adhkarSoir ? 'checked' : ''}><span class="tr"></span></label></div>
        <div class="setrow"><div class="lab">${icon('book', 16)} Al-Kahf le vendredi (10 h)</div>
          <label class="switch"><input type="checkbox" data-ex="kahf" ${n.extras.kahf ? 'checked' : ''}><span class="tr"></span></label></div>
        <div class="setrow"><div class="lab">${icon('mosque', 16)} Rappel Salat al-Jumu'ah<small>45 min avant Dhuhr le vendredi</small></div>
          <label class="switch"><input type="checkbox" data-ex="jumua" ${n.extras.jumua ? 'checked' : ''}><span class="tr"></span></label></div>
        <div class="setrow"><div class="lab">${icon('star', 16)} Verset, hadith &amp; invocation du jour (9 h)</div>
          <label class="switch"><input type="checkbox" data-ex="duJour" ${n.extras.duJour ? 'checked' : ''}><span class="tr"></span></label></div>
        `}
      </div>
      <div class="notice">⚠️ <b>Limite d'iOS :</b> une application web sans serveur ne peut afficher ces notifications
      que lorsqu'elle est <b>ouverte</b>. Pour des rappels garantis même application fermée, utilisez l'export
      calendrier : les alarmes sonneront comme tout événement du calendrier iPhone.</div>

      <div class="card">
        <div class="row" style="justify-content:space-between">
          <div><b>${icon('calendar', 17)} Export calendrier (30 jours)</b><br>
          <span class="tiny">Horaires + alarmes dans l'app Calendrier — fiable même app fermée</span></div>
          <button class="btn" id="btnICS" ${!hasLocation() ? 'disabled style="opacity:.5"' : ''}>Exporter</button>
        </div>
      </div>
    `;
    bind();
  };

  const cityPicker = () => {
    sheet(`<h3>Choisir une ville</h3>
      <div class="search-input" style="margin-top:0"><span>${icon('search', 16)}</span>
      <input id="cityQ" type="search" placeholder="Paris, Dakar, Bruxelles…" autocomplete="off"></div>
      <div id="cityList" style="max-height:46vh;overflow-y:auto"></div>`, async el => {
      const cities = await fetch('data/cities.json').then(r => r.json());
      const list = el.querySelector('#cityList');
      const inp = el.querySelector('#cityQ');
      const draw = q => {
        const f = fold(q || '');
        const found = cities.filter(c => !f || fold(c[0]).includes(f) || fold(c[1]).includes(f)).slice(0, 30);
        list.innerHTML = found.map(c => `
          <div class="setrow" data-i="${cities.indexOf(c)}" style="cursor:pointer">
            <div class="lab">${esc(c[0])}<small>${esc(c[1])}</small></div>${icon('chevR', 15)}
          </div>`).join('') || `<p class="muted">Aucune ville trouvée — utilisez le GPS.</p>`;
        list.querySelectorAll('[data-i]').forEach(rowEl => rowEl.onclick = () => {
          const c = cities[+rowEl.dataset.i];
          setLocation(c[2], c[3], `${c[0]} (${c[1]})`);
          closeSheet(); toast(`Ville : ${c[0]}`); render();
        });
      };
      draw(''); inp.oninput = () => draw(inp.value); inp.focus();
    });
  };

  const doGeo = async (btn) => {
    btn.textContent = '…';
    try { await geolocate(); toast('Position enregistrée'); render(); }
    catch { toast('Géolocalisation refusée — choisissez une ville'); cityPicker(); }
  };

  // recherche de la mosquée la plus proche (une seule fois par position)
  async function findMosque() {
    if (!hasLocation()) return;
    const key = `${p.lat},${p.lon}`;
    if (mosqueKey === key) return; // déjà cherchée pour cette position
    mosqueKey = key;
    try {
      const { nearestMosque } = await import('./geo.js');
      mosque = await nearestMosque(p.lat, p.lon);
    } catch { mosque = null; }
    const el = document.getElementById('nmText');
    if (el && mosque) {
      el.textContent = `${mosque.name} — ${mosque.dist < 1 ? Math.round(mosque.dist * 1000) + ' m' : mosque.dist.toFixed(1) + ' km'}`;
      const link = document.querySelector('#nearMosque a');
      // le lien apparaîtra au prochain rendu ; on met simplement le texte à jour ici
    } else if (el) {
      el.textContent = 'Non trouvée à proximité (ou hors-ligne)';
    }
  }

  function bind() {
    const $ = id => document.getElementById(id);
    if (hasLocation() && mosque === undefined) findMosque();
    $('btnGeo')?.addEventListener('click', e => doGeo(e.target));
    $('btnGeo2')?.addEventListener('click', e => doGeo(e.target));
    $('btnCity')?.addEventListener('click', cityPicker);
    $('btnCity2')?.addEventListener('click', cityPicker);
    $('selMethod')?.addEventListener('change', e => { p.method = e.target.value; save(); render(); });
    document.getElementById('segMadhab')?.addEventListener('click', e => {
      const v = e.target.dataset?.v; if (!v) return;
      p.madhab = v; save(); render();
    });
    document.getElementById('segFmt')?.addEventListener('click', e => {
      const v = e.target.dataset?.v; if (!v) return;
      state.settings.timeFmt = v; save(); render();
    });
    $('btnAdjust')?.addEventListener('click', () => {
      sheet(`<h3>Ajustements (minutes)</h3>
        ${PRAYERS.map(([key, name]) => `
          <div class="setrow"><div class="lab">${name}</div>
          <div class="row"><button class="btn btn-ghost" data-adj="${key}:-1" style="padding:6px 12px">−</button>
          <b id="adj-${key}" style="min-width:34px;text-align:center">${p.adjust[key] > 0 ? '+' : ''}${p.adjust[key]}</b>
          <button class="btn btn-ghost" data-adj="${key}:1" style="padding:6px 12px">+</button></div></div>`).join('')}
        <button class="btn" style="width:100%;margin-top:12px" id="adjDone">Terminé</button>`, el => {
        el.querySelectorAll('[data-adj]').forEach(b => b.onclick = () => {
          const [key, d] = b.dataset.adj.split(':');
          p.adjust[key] = Math.max(-30, Math.min(30, p.adjust[key] + (+d)));
          el.querySelector('#adj-' + key).textContent = (p.adjust[key] > 0 ? '+' : '') + p.adjust[key];
          save();
        });
        el.querySelector('#adjDone').onclick = () => { closeSheet(); render(); };
      });
    });
    $('btnPerm')?.addEventListener('click', async () => {
      const r = await requestPermission();
      if (r === 'granted') { toast('Notifications autorisées'); startScheduler(); }
      else toast('Autorisation refusée');
      render();
    });
    const n = notifySettings();
    // cloches par prière
    document.querySelectorAll('[data-bell]').forEach(b => b.onclick = async () => {
      const key = b.dataset.bell;
      if (!n.enabled[key] && !notifGranted()) {
        const r = await requestPermission();
        if (r !== 'granted') { toast('Autorisez d\'abord les notifications'); return; }
      }
      n.enabled[key] = !n.enabled[key];
      saveNotify(); startScheduler(); render();
    });
    document.querySelectorAll('input[data-ex]').forEach(i => i.onchange = async () => {
      if (i.checked && !notifGranted()) {
        const r = await requestPermission();
        if (r !== 'granted') { i.checked = false; toast('Autorisez d\'abord les notifications'); return; }
      }
      n.extras[i.dataset.ex] = i.checked; saveNotify(); startScheduler();
    });
    $('selOffset')?.addEventListener('change', e => { n.offset = +e.target.value; saveNotify(); });
    $('btnICS')?.addEventListener('click', () => {
      const ics = buildICS(30);
      if (!ics) return;
      const blob = new Blob([ics], { type: 'text/calendar' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'nour-horaires-priere.ics';
      a.click();
      toast('Calendrier exporté — ouvrez le fichier pour l\'ajouter');
    });
  }

  render();
  tick = setInterval(() => {
    if (!location.hash.startsWith('#/prayer')) { clearInterval(tick); return; }
    render();
  }, 30000);
}

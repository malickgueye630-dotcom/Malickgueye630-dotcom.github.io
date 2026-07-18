// Page « Horaires de prière » : prochaine prière + compte à rebours,
// horaires du jour, localisation (GPS ou ville), méthode de calcul,
// madhhab pour l'Asr, ajustements manuels, notifications et export calendrier.
import { $view, esc, toast, sheet, closeSheet } from './app.js';
import { state, save } from './state.js';
import { PRAYERS, METHODS, prayerSettings, hasLocation, timesFor, nextPrayer, fmtTime, fmtCountdown, setLocation, geolocate, buildICS } from './prayer.js';
import { notifySettings, notifSupported, notifGranted, requestPermission, startScheduler, saveNotify } from './notify.js';
import { fold } from './engine.js';

let tick = null;

export async function viewPrayer() {
  clearInterval(tick);
  const p = prayerSettings();

  const render = () => {
    const now = new Date();
    const t = hasLocation() ? timesFor(now) : null;
    const np = hasLocation() ? nextPrayer(now) : null;
    const n = notifySettings();

    $view.innerHTML = `
      <a class="backlink" href="#/home">← Accueil</a>
      <h1>🕌 Horaires de prière</h1>

      ${!hasLocation() ? `
      <div class="card center" style="padding:26px 18px">
        <p style="margin:0 0 14px"><b>Choisissez votre localisation</b><br>
        <span class="muted">pour calculer les horaires de vos cinq prières</span></p>
        <div class="row" style="justify-content:center;gap:10px">
          <button class="btn" id="btnGeo">📍 Ma position</button>
          <button class="btn btn-ghost" id="btnCity">🏙️ Choisir une ville</button>
        </div>
      </div>` : `
      <div class="surah-head" style="padding:18px 16px">
        <div style="font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;opacity:.75">Prochaine prière</div>
        <div style="font-size:1.9rem;font-weight:800;margin:4px 0">${esc(np.name)} — ${fmtTime(np.time)}</div>
        <div style="opacity:.85">Dans ${fmtCountdown(np.time - now)}</div>
        <div class="meta" style="margin-top:8px">${esc(p.city || `${p.lat}, ${p.lon}`)} · ${esc((METHODS.find(m => m.id === p.method) || {}).name || '')}${p.madhab === 'hanafi' ? ' · Asr hanafite' : ''}</div>
      </div>

      <div class="card" style="padding:8px 16px">
        ${PRAYERS.map(([key, name]) => {
          const active = np && np.key === key && t[key] > now;
          return `<div class="setrow" style="${active ? 'font-weight:700;color:var(--brand)' : ''}">
            <div class="lab" style="${active ? 'color:var(--brand)' : ''}">${key === 'sunrise' ? '🌅' : '🕌'} ${name}${key === 'sunrise' ? ' <small style="display:inline">(lever du soleil — pas une prière)</small>' : ''}</div>
            <b>${fmtTime(t[key])}</b>
          </div>`;
        }).join('')}
      </div>`}

      <h2>Localisation & calcul</h2>
      <div class="card" style="padding:8px 16px">
        <div class="setrow">
          <div class="lab">Position<small>${esc(p.city || (hasLocation() ? `${p.lat}, ${p.lon}` : 'Non définie'))}</small></div>
          <div class="row"><button class="btn btn-ghost" id="btnGeo2" style="padding:8px 12px">📍 GPS</button>
          <button class="btn btn-ghost" id="btnCity2" style="padding:8px 12px">🏙️ Ville</button></div>
        </div>
        <div class="setrow">
          <div class="lab">Méthode de calcul<small>Choisissez celle de votre mosquée ou organisation</small></div>
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
          <div class="lab">Ajustements manuels<small>Minutes ± par prière, pour coller à votre mosquée</small></div>
          <button class="btn btn-ghost" id="btnAdjust" style="padding:8px 12px">Régler</button>
        </div>
      </div>
      <div class="notice">Les horaires dépendent de la méthode de calcul et de la localisation : ils sont donnés à titre
      indicatif et peuvent différer légèrement de ceux de votre mosquée. En cas de doute, fiez-vous à votre mosquée locale.</div>

      <h2>🔔 Notifications</h2>
      <div class="card" style="padding:8px 16px">
        ${!notifSupported() ? `<p class="muted" style="padding:8px 0">Les notifications ne sont pas disponibles dans ce navigateur.</p>` : `
        ${!notifGranted() ? `<div class="setrow"><div class="lab">Autoriser les notifications</div>
          <button class="btn" id="btnPerm" style="padding:8px 14px">Autoriser</button></div>` : ''}
        ${PRAYERS.filter(([k]) => k !== 'sunrise').map(([key, name]) => `
          <div class="setrow"><div class="lab">🔔 ${name}</div>
            <label class="switch"><input type="checkbox" data-np="${key}" ${n.enabled[key] ? 'checked' : ''}><span class="tr"></span></label>
          </div>`).join('')}
        <div class="setrow">
          <div class="lab">Moment du rappel</div>
          <select id="selOffset" style="font:inherit;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--bg-soft);color:var(--ink)">
            <option value="0" ${!n.offset ? 'selected' : ''}>À l'heure de la prière</option>
            <option value="-5" ${n.offset === -5 ? 'selected' : ''}>5 minutes avant</option>
            <option value="-10" ${n.offset === -10 ? 'selected' : ''}>10 minutes avant</option>
            <option value="-15" ${n.offset === -15 ? 'selected' : ''}>15 minutes avant</option>
          </select>
        </div>
        <div class="setrow"><div class="lab">🌅 Adhkar du matin (7 h)</div>
          <label class="switch"><input type="checkbox" data-ex="adhkarMatin" ${n.extras.adhkarMatin ? 'checked' : ''}><span class="tr"></span></label></div>
        <div class="setrow"><div class="lab">🌙 Adhkar du soir (18 h 30)</div>
          <label class="switch"><input type="checkbox" data-ex="adhkarSoir" ${n.extras.adhkarSoir ? 'checked' : ''}><span class="tr"></span></label></div>
        <div class="setrow"><div class="lab">📖 Al-Kahf le vendredi (10 h)</div>
          <label class="switch"><input type="checkbox" data-ex="kahf" ${n.extras.kahf ? 'checked' : ''}><span class="tr"></span></label></div>
        `}
      </div>
      <div class="notice">⚠️ <b>Limite d'iOS :</b> une application web ne peut afficher ces notifications de façon fiable que
      lorsqu'elle est <b>ouverte</b> (ou installée sur l'écran d'accueil et récemment utilisée). Pour des rappels
      garantis même application fermée, utilisez l'export calendrier ci-dessous : les alarmes sonneront comme
      n'importe quel événement de votre calendrier iPhone.</div>

      <div class="card">
        <div class="row" style="justify-content:space-between">
          <div><b>📅 Export calendrier (30 jours)</b><br>
          <span class="tiny">Ajoute les horaires avec alarmes dans l'app Calendrier</span></div>
          <button class="btn" id="btnICS" ${!hasLocation() ? 'disabled style="opacity:.5"' : ''}>Exporter</button>
        </div>
      </div>
    `;
    bind();
  };

  const cityPicker = () => {
    sheet(`<h3>Choisir une ville</h3>
      <div class="search-input" style="margin-top:0"><span>🔍</span>
      <input id="cityQ" type="search" placeholder="Paris, Dakar, Bruxelles…" autocomplete="off"></div>
      <div id="cityList" style="max-height:46vh;overflow-y:auto"></div>`, async el => {
      const cities = await fetch('data/cities.json').then(r => r.json());
      const list = el.querySelector('#cityList');
      const inp = el.querySelector('#cityQ');
      const draw = q => {
        const f = fold(q || '');
        const found = cities.filter(c => !f || fold(c[0]).includes(f) || fold(c[1]).includes(f)).slice(0, 30);
        list.innerHTML = found.map((c, i) => `
          <div class="setrow" data-i="${cities.indexOf(c)}" style="cursor:pointer">
            <div class="lab">${esc(c[0])}<small>${esc(c[1])}</small></div><span>→</span>
          </div>`).join('') || `<p class="muted">Aucune ville trouvée — utilisez le GPS 📍</p>`;
        list.querySelectorAll('[data-i]').forEach(row => row.onclick = () => {
          const c = cities[+row.dataset.i];
          setLocation(c[2], c[3], `${c[0]} (${c[1]})`);
          closeSheet(); toast(`Ville : ${c[0]} ✓`); render();
        });
      };
      draw(''); inp.oninput = () => draw(inp.value); inp.focus();
    });
  };

  const doGeo = async (btn) => {
    btn.textContent = '…';
    try {
      await geolocate();
      toast('Position enregistrée ✓');
      render();
    } catch {
      toast('Géolocalisation refusée — choisissez une ville');
      cityPicker();
    }
  };

  function bind() {
    const $ = id => document.getElementById(id);
    $('btnGeo')?.addEventListener('click', e => doGeo(e.target));
    $('btnGeo2')?.addEventListener('click', e => doGeo(e.target));
    $('btnCity')?.addEventListener('click', cityPicker);
    $('btnCity2')?.addEventListener('click', cityPicker);
    $('selMethod')?.addEventListener('change', e => { p.method = e.target.value; save(); render(); });
    document.getElementById('segMadhab')?.addEventListener('click', e => {
      const v = e.target.dataset?.v; if (!v) return;
      p.madhab = v; save(); render();
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
      if (r === 'granted') { toast('Notifications autorisées ✓'); startScheduler(); }
      else toast('Autorisation refusée');
      render();
    });
    const n = notifySettings();
    document.querySelectorAll('input[data-np]').forEach(i => i.onchange = async () => {
      if (i.checked && !notifGranted()) {
        const r = await requestPermission();
        if (r !== 'granted') { i.checked = false; toast('Autorisez d\'abord les notifications'); return; }
      }
      n.enabled[i.dataset.np] = i.checked; saveNotify(); startScheduler();
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
  // compte à rebours vivant
  tick = setInterval(() => {
    if (!location.hash.startsWith('#/prayer')) { clearInterval(tick); return; }
    if (hasLocation()) {
      const np = nextPrayer(new Date());
      const head = $view.querySelector('.surah-head div:nth-child(3)');
      if (head && np) head.textContent = 'Dans ' + fmtCountdown(np.time - new Date());
    }
  }, 20000);
}

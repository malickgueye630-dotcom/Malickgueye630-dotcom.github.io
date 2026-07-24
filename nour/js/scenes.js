// Carrousel photographique de l'accueil.
// Les six images sont embarquées dans l'application et proviennent de Wikimedia
// Commons avec une licence autorisant leur réutilisation. Les crédits détaillés
// figurent dans la vue « À propos ». Aucun appel réseau n'est nécessaire ici.
const MOSQUES = [
  {
    id: 'haram',
    name: 'Masjid al-Harâm — La Mecque',
    src: 'assets/mosques/haram.webp',
    license: 'CC BY-SA 3.0',
  },
  {
    id: 'nabawi',
    name: 'Mosquée du Prophète ﷺ — Médine',
    src: 'assets/mosques/nabawi.webp',
    license: 'CC BY-SA 4.0',
  },
  {
    id: 'aqsa',
    name: 'Al-Aqsa — Jérusalem',
    src: 'assets/mosques/aqsa.webp',
    license: 'Domaine public',
  },
  {
    id: 'zayed',
    name: 'Mosquée Cheikh Zayed — Abou Dhabi',
    src: 'assets/mosques/zayed.webp',
    license: 'CC BY 3.0',
  },
  {
    id: 'hassan2',
    name: 'Mosquée Hassan II — Casablanca',
    src: 'assets/mosques/hassan2.webp',
    license: 'CC BY-SA 4.0',
  },
  {
    id: 'sultanahmet',
    name: 'Mosquée Sultan Ahmed — Istanbul',
    src: 'assets/mosques/sultanahmet.webp',
    license: 'CC0',
  },
];

// Période depuis les horaires de prière si disponibles, sinon depuis l'heure
// réelle de l'appareil. Elle pilote uniquement l'ambiance colorimétrique.
export function scenePeriod(times, now = new Date()) {
  if (times && times.fajr) {
    if (now >= times.fajr && now < times.sunrise) return 'dawn';
    if (now >= times.sunrise && now < new Date(times.maghrib - 50 * 60000)) return 'day';
    if (now >= new Date(times.maghrib - 50 * 60000) && now < times.isha) return 'sunset';
    return 'night';
  }
  const h = now.getHours();
  return h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 18 ? 'day' : h >= 18 && h < 21 ? 'sunset' : 'night';
}

let sceneTimer = null;

export function mountHeroScene(hero, period) {
  clearInterval(sceneTimer);
  hero.querySelector('.hero-scene')?.remove();
  hero.querySelector('.scene-caption')?.remove();

  const layer = document.createElement('div');
  layer.className = 'hero-scene';
  layer.dataset.period = period || 'day';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `
    <figure class="scene-frame"></figure>
    <figure class="scene-frame"></figure>
    <div class="scene-scrim"></div>`;
  hero.insertBefore(layer, hero.firstChild);

  const caption = document.createElement('div');
  caption.className = 'scene-caption';
  hero.appendChild(caption);

  const frames = [...layer.querySelectorAll('.scene-frame')];
  let index = Math.floor(Date.now() / (5.5 * 60000)) % MOSQUES.length;
  let active = 0;

  const fill = (frame, mosque) => {
    frame.innerHTML = '';
    const img = document.createElement('img');
    img.src = mosque.src;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    frame.appendChild(img);
  };

  const show = (nextIndex, first = false) => {
    const mosque = MOSQUES[nextIndex];
    const target = first ? frames[0] : frames[1 - active];
    fill(target, mosque);
    requestAnimationFrame(() => {
      frames.forEach(frame => frame.classList.toggle('on', frame === target));
      active = frames.indexOf(target);
    });
    caption.textContent = `${mosque.name} · ${mosque.license}`;

    // Précharge l'image suivante sans l'afficher.
    const preload = new Image();
    preload.src = MOSQUES[(nextIndex + 1) % MOSQUES.length].src;
  };

  show(index, true);
  sceneTimer = setInterval(() => {
    if (!document.body.contains(hero)) {
      clearInterval(sceneTimer);
      return;
    }
    index = (index + 1) % MOSQUES.length;
    show(index);
  }, 5.5 * 60000);

  return MOSQUES[index].name;
}

export function stopHeroScene() {
  clearInterval(sceneTimer);
}

// Localisation précise & mosquée la plus proche.
// Utilise les services ouverts d'OpenStreetMap (données © contributeurs OSM,
// licence ODbL) : Nominatim pour le nom exact de la localité (ex. « Villejuif »
// et non « Paris ») et Overpass pour la mosquée la plus proche.
// Ces appels nécessitent une connexion ; en cas d'échec/refus, l'application
// retombe proprement sur les coordonnées ou le mode manuel.
const rad = d => d * Math.PI / 180;
export function distanceKm(aLat, aLon, bLat, bLon) {
  const R = 6371, dφ = rad(bLat - aLat), dλ = rad(bLon - aLon);
  const s = Math.sin(dφ / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function withTimeout(url, opts = {}, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// nom précis de la localité (village / quartier / ville)
export async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&accept-language=fr`;
  const r = await withTimeout(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('reverse');
  const j = await r.json();
  const a = j.address || {};
  const name = a.village || a.town || a.suburb || a.city_district || a.municipality || a.city || a.county || j.name;
  if (!name) throw new Error('no-name');
  return name;
}

// mosquée la plus proche via Overpass (dans un rayon donné, en mètres)
export async function nearestMosque(lat, lon, radius = 6000) {
  const q = `[out:json][timeout:12];nwr(around:${radius},${lat},${lon})[amenity=place_of_worship][religion=muslim];out center 40;`;
  const r = await withTimeout('https://overpass-api.de/api/interpreter', {
    method: 'POST', body: 'data=' + encodeURIComponent(q),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }, 14000);
  if (!r.ok) throw new Error('overpass');
  const j = await r.json();
  const items = (j.elements || []).map(e => {
    const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
    if (la == null || lo == null) return null;
    return { name: e.tags?.name || 'Mosquée (sans nom)', lat: la, lon: lo, dist: distanceKm(lat, lon, la, lo) };
  }).filter(Boolean).sort((a, b) => a.dist - b.dist);
  if (!items.length) throw new Error('none');
  return items[0];
}

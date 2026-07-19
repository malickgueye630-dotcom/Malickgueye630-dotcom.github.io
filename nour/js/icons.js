// Jeu d'icônes SVG de Nour — tracés originaux, style trait arrondi cohérent.
// Usage : icon('book') → chaîne SVG inline (currentColor).
const P = {
  home: '<path d="M3.5 10.8 12 3.6l8.5 7.2"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5"/><path d="M9.8 21v-6h4.4v6"/>',
  book: '<path d="M12 5.6C10.6 4.3 8.6 3.6 6 3.6c-1.1 0-2.1.1-3 .4v14.6c.9-.3 1.9-.4 3-.4 2.6 0 4.6.7 6 2 1.4-1.3 3.4-2 6-2 1.1 0 2.1.1 3 .4V4c-.9-.3-1.9-.4-3-.4-2.6 0-4.6.7-6 2Z"/><path d="M12 5.6v14.6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/>',
  library: '<path d="M4 4.5h3.4V20H4z"/><path d="M9.4 4.5h3.4V20H9.4z"/><path d="m14.6 5.6 3.3-.9 3.6 14.4-3.3.9z"/>',
  hands: '<path d="M12 21c-3.6 0-6.1-1.6-6.1-4.6V12c0-.9.7-1.6 1.6-1.6.9 0 1.6.7 1.6 1.6v1.4"/><path d="M12 21c3.6 0 6.1-1.6 6.1-4.6V12c0-.9-.7-1.6-1.6-1.6-.9 0-1.6.7-1.6 1.6v1.4"/><path d="M9.1 13V5.9c0-.8.6-1.4 1.4-1.4.8 0 1.4.6 1.4 1.4V11"/><path d="M14.9 13V5.9c0-.8-.6-1.4-1.4-1.4-.8 0-1.4.6-1.4 1.4V11"/>',
  mosque: '<path d="M12 3.2c.4 1.7 1.6 3 3.4 4.1H8.6C10.4 6.2 11.6 4.9 12 3.2Z"/><path d="M5.5 11.5c0-2.2 2.9-4.2 6.5-4.2s6.5 2 6.5 4.2"/><path d="M4 11.5h16V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8.5Z"/><path d="M10 21v-3.4a2 2 0 0 1 4 0V21"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  beads: '<circle cx="12" cy="4.5" r="1.7"/><circle cx="17.8" cy="7" r="1.7"/><circle cx="19.5" cy="13" r="1.7"/><circle cx="16" cy="18" r="1.7"/><circle cx="8" cy="18" r="1.7"/><circle cx="4.5" cy="13" r="1.7"/><circle cx="6.2" cy="7" r="1.7"/><path d="M12 20.5v1"/>',
  star: '<path d="m12 3.4 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.4 6.9 19l1-5.6-4.1-4 5.7-.8Z"/>',
  bookmark: '<path d="M6.5 3.5h11a0 0 0 0 1 0 0V21l-5.5-3.6L6.5 21V3.5Z"/>',
  copy: '<rect x="9" y="9" width="11" height="12" rx="2"/><path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5"/>',
  share: '<path d="M12 3.5v11"/><path d="m8 7 4-3.6L16 7"/><path d="M5 11.5v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  play: '<path d="M7.5 4.8v14.4L19 12Z"/>',
  pause: '<path d="M7 4.5h3.2V20H7z"/><path d="M13.8 4.5H17V20h-3.2z"/>',
  prev: '<path d="M17.5 5v14L8.6 12Z"/><path d="M6 5v14"/>',
  next: '<path d="M6.5 5v14l8.9-7Z"/><path d="M18 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/>',
  bell: '<path d="M12 3.5a5.5 5.5 0 0 1 5.5 5.5c0 4 1.2 5.4 2 6.2H4.5c.8-.8 2-2.2 2-6.2A5.5 5.5 0 0 1 12 3.5Z"/><path d="M10 18.8a2 2 0 0 0 4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  location: '<path d="M12 21s-6.5-5.6-6.5-10.4a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z"/><circle cx="12" cy="10.4" r="2.3"/>',
  note: '<path d="M4 5.5a2 2 0 0 1 2-2h9L20 8v10.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13Z"/><path d="M14.5 3.5V8H20M8 12.5h8M8 16h5"/>',
  repeat: '<path d="M17.5 4 21 7.5 17.5 11"/><path d="M21 7.5H7.5a4 4 0 0 0-4 4v.5"/><path d="M6.5 20 3 16.5 6.5 13"/><path d="M3 16.5h13.5a4 4 0 0 0 4-4V12"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevR: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
  chevL: '<path d="M15 5.5 8.5 12 15 18.5"/>',
  more: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
  grid: '<rect x="4" y="4" width="6.6" height="6.6" rx="1.6"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.6"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.6"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.4 2"/>',
  download: '<path d="M12 3.5V15"/><path d="m7.8 11 4.2 4 4.2-4"/><path d="M4.5 18.5h15"/>',
  sunrise: '<path d="M4 17h16M7 13.5a5 5 0 0 1 10 0"/><path d="M12 4.5v3M5 8.5l1.6 1.6M19 8.5l-1.6 1.6M2.5 20.5h19"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  gauge: '<path d="M4.5 17.5a8.5 8.5 0 1 1 15 0"/><path d="M12 13.8 16 9"/><circle cx="12" cy="14.5" r="1.4"/>',
  kaaba: '<path d="m12 2.8 8 3.4v11.6l-8 3.4-8-3.4V6.2Z"/><path d="M4 6.2l8 3.4 8-3.4"/><path d="M12 9.6v11.6"/><path d="M4 9.5l8 3.3 8-3.3"/>',
  heart: '<path d="M12 20s-7.5-4.7-7.5-10A4.2 4.2 0 0 1 12 7.2 4.2 4.2 0 0 1 19.5 10c0 5.3-7.5 10-7.5 10Z"/>',
};

export function icon(name, size = 22, cls = '') {
  const p = P[name] || P.more;
  return `<svg class="svgi ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
export function iconFilled(name, size = 22, cls = '') {
  const p = P[name] || P.star;
  return `<svg class="svgi ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

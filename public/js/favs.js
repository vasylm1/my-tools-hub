// Favourite and recently used tools, kept in this browser only (localStorage, with an in-memory fallback when storage is blocked).
import { byId } from './registry.js';

const FAVS = 'mth-favs';
const RECENT = 'mth-recent';
export const MAX_RECENT = 8;
const memory = {};
const target = new EventTarget();

function read(key) {
  let raw = memory[key];
  try { raw = localStorage.getItem(key) ?? raw; } catch { /* storage blocked */ }
  try {
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? [...new Set(list)].filter((id) => byId[id]) : [];
  } catch { return []; }
}

function write(key, list) {
  const raw = JSON.stringify(list);
  memory[key] = raw;
  try { localStorage.setItem(key, raw); } catch { /* storage blocked */ }
  target.dispatchEvent(new Event('change'));
}

export const favourites = () => read(FAVS);
export const recents = () => read(RECENT);
export const isFavourite = (id) => favourites().includes(id);

export function toggleFavourite(id) {
  if (!byId[id]) return false;
  const list = favourites();
  const on = !list.includes(id);
  write(FAVS, on ? [...list, id] : list.filter((x) => x !== id));
  return on;
}

export function noteRecent(id) {
  if (!byId[id]) return;
  write(RECENT, [id, ...recents().filter((x) => x !== id)].slice(0, MAX_RECENT));
}

export const clearRecents = () => write(RECENT, []);
export const onFavsChange = (fn) => target.addEventListener('change', fn);

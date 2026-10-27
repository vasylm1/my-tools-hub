// App shell: hash router, views (landing, catalogue, tool, about, privacy), command palette, theme.
import { h, $ } from './core/dom.js';
import { icon } from './core/icons.js';
import { mountTool } from './core/runner.js';
import { CATEGORIES, TOOLS, byId, searchTools } from './registry.js';
import { profile } from './profile.js';
import { encodeQr, drawQr } from './lib/qr.js';

const main = $('#main');
const sidebar = $('#sidebar');
const menuBtn = $('#menu-btn');
const scrim = $('#scrim');
const themeBtn = $('#theme-btn');
const BASE_TITLE = 'My Tools Hub';
const GITHUB = 'https://github.com/vasylm1/my-tools-hub';
const moduleCache = new Map();
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
let teardown = null;

const catName = (id) => CATEGORIES.find((c) => c.id === id)?.name || '';
const count = (cat) => TOOLS.filter((t) => t.cat === cat).length;

/* ------------------------------------------------------------- chrome */

$('.st-icon').append(icon('search', 15));
menuBtn.append(icon('menu', 18));
$('#palette-kbd').textContent = isMac ? 'Cmd K' : 'Ctrl K';

function paintThemeIcon() {
  themeBtn.replaceChildren(icon(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun', 17));
}
paintThemeIcon();
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('mth-theme', next); } catch { /* storage blocked */ }
  paintThemeIcon();
  if (parseRoute().view === 'landing') paintHeroQr();
});

function openMenu(open) {
  document.body.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  scrim.hidden = !open;
}
menuBtn.addEventListener('click', () => openMenu(!document.body.classList.contains('menu-open')));
scrim.addEventListener('click', () => openMenu(false));
sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) openMenu(false); });

/* ------------------------------------------------------------- routing */

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const id = decodeURIComponent(path);
  const params = new URLSearchParams(query);
  let view = 'tool';
  if (id === '') view = 'landing';
  else if (id === 'tools') view = 'tools';
  else if (id === 'about' || id === 'privacy') view = 'page';
  return { id, params, view };
}

const setTitle = (t) => { document.title = t ? `${t} · ${BASE_TITLE}` : BASE_TITLE; };

function markNav(id) {
  document.querySelectorAll('.topnav a').forEach((a) => {
    const on = a.dataset.nav === id || (a.dataset.nav === 'tools' && byId[id]);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function renderSidebar(current) {
  sidebar.replaceChildren(
    ...CATEGORIES.map((c) => h('section', { class: 'nav-group' },
      h('h2', { class: 'nav-heading' }, c.name),
      h('div', { class: 'nav-list' }, ...TOOLS.filter((t) => t.cat === c.id).map((t) => h('a', {
        href: `#/${t.id}`, class: 'nav-link', 'aria-current': t.id === current ? 'page' : null,
      }, icon(t.icon, 16), h('span', {}, t.name)))))));
}

const toolCard = (t) => h('a', { class: 'tool-card', href: `#/${t.id}` },
  h('span', { class: 'tile' }, icon(t.icon, 18)),
  h('span', { class: 'tool-card-body' }, h('strong', {}, t.name), h('span', {}, t.desc)));

/* ------------------------------------------------------------ landing */

let heroQr = null;
function paintHeroQr() {
  if (!heroQr || !heroQr.isConnected) return;
  const css = getComputedStyle(document.documentElement);
  drawQr(heroQr, encodeQr(GITHUB, 'M'), { scale: 4, quietZone: 2, fg: css.getPropertyValue('--ink').trim() || '#fff', bg: css.getPropertyValue('--surface').trim() || '#111' });
}

function heroWindow() {
  const tok = (cls, text) => h('span', { class: cls }, text);
  const line = (...kids) => h('div', { class: 'code-line' }, ...kids);
  heroQr = h('canvas', { class: 'mock-qr', width: 10, height: 10, 'aria-hidden': 'true' });
  queueMicrotask(paintHeroQr);
  const picks = ['qr-code', 'json-formatter', 'image-resizer', 'spreadsheet-cleaner', 'resume-builder', 'text-diff'].map((id) => byId[id]);
  return h('div', { class: 'mock', 'aria-hidden': 'true' },
    h('div', { class: 'mock-bar' }, h('i'), h('i'), h('i'), h('span', {}, 'My Tools Hub')),
    h('div', { class: 'mock-body' },
      h('div', { class: 'mock-side' }, ...picks.map((t, i) => h('div', { class: `mock-item${i === 1 ? ' on' : ''}` }, icon(t.icon, 15), h('span', {}, t.name)))),
      h('div', { class: 'mock-main' },
        h('div', { class: 'mock-head' }, h('strong', {}, 'JSON formatter'), h('span', {}, 'Format, minify and validate')),
        h('div', { class: 'mock-code' },
          line(tok('p', '{')),
          line('  ', tok('k', '"tool"'), tok('p', ': '), tok('s', '"qr-code"'), tok('p', ',')),
          line('  ', tok('k', '"private"'), tok('p', ': '), tok('b', 'true'), tok('p', ',')),
          line('  ', tok('k', '"uploads"'), tok('p', ': '), tok('n', '0'), tok('p', ',')),
          line('  ', tok('k', '"works_offline"'), tok('p', ': '), tok('b', 'true')),
          line(tok('p', '}'))),
        h('div', { class: 'mock-valid' }, icon('check', 14), 'Valid JSON')),
      h('div', { class: 'mock-aside' }, heroQr, h('span', {}, 'QR code'))));
}

function renderLanding() {
  setTitle('');
  const featured = ['qr-code', 'json-formatter', 'image-resizer', 'spreadsheet-cleaner', 'resume-builder', 'images-to-pdf'].map((id) => byId[id]);
  const principles = [
    ['lock', 'Private by design', 'Files and text stay on your device. Self-hosted Umami counts page visits; there are no uploads or accounts.'],
    ['wifioff', 'Works offline', 'Open it once and every tool keeps working without a connection.'],
    ['zap', 'Fast and plain', 'No frameworks and no build step. Tools load on demand and open instantly.'],
    ['code', 'Open source', 'Plain HTML, CSS and JavaScript that you can read, audit and run yourself.'],
  ];
  main.replaceChildren(
    h('section', { class: 'hero' },
      h('div', { class: 'wrap hero-in' },
        h('h1', {}, 'Small tools, built with care.'),
        h('p', { class: 'lead' }, 'Format, convert, generate and clean without uploading a single file. A private toolbox for writing, data, documents and images.'),
        h('div', { class: 'cta-row' },
          h('a', { class: 'btn primary lg', href: '#/tools' }, 'Browse all tools'),
          h('a', { class: 'btn lg', href: '#/about' }, 'About me'),
          h('span', { class: 'hint-keys' }, 'or press ', h('kbd', {}, isMac ? 'Cmd K' : 'Ctrl K'), ' to search')),
        heroWindow())),
    h('section', { class: 'wrap section' },
      h('div', { class: 'principles' }, ...principles.map(([ic, title, text]) => h('div', { class: 'principle' }, icon(ic, 20), h('h3', {}, title), h('p', {}, text))))),
    h('section', { class: 'wrap section' },
      h('div', { class: 'section-head' }, h('h2', {}, 'Everything in one place'), h('p', {}, `${TOOLS.length} tools in ${CATEGORIES.length} groups.`)),
      h('div', { class: 'cat-list' }, ...CATEGORIES.map((c) => h('a', { class: 'cat-row', href: `#/tools?cat=${c.id}` },
        h('span', { class: 'tile' }, icon(c.icon, 18)),
        h('span', { class: 'cat-text' }, h('strong', {}, c.name), h('span', {}, c.blurb)),
        h('span', { class: 'cat-count' }, `${count(c.id)} tools`),
        icon('chevron', 16, 'cat-go'))))),
    h('section', { class: 'wrap section' },
      h('div', { class: 'section-head' }, h('h2', {}, 'Good places to start'), h('a', { class: 'link', href: '#/tools' }, 'See all tools')),
      h('div', { class: 'card-grid' }, ...featured.map(toolCard))),
    h('section', { class: 'wrap section' },
      h('div', { class: 'maker' },
        h('div', { class: 'avatar', 'aria-hidden': 'true' }, profile.initials),
        h('div', { class: 'maker-text' }, h('h2', {}, `Made by ${profile.name}`), h('p', {}, profile.headline)),
        h('a', { class: 'btn', href: '#/about' }, 'About me'))));
}

/* ----------------------------------------------------------- catalogue */

function renderCatalogue(params) {
  setTitle('All tools');
  let cat = params.get('cat') || '';
  if (!CATEGORIES.some((c) => c.id === cat)) cat = '';
  let query = '';
  const grid = h('div', { class: 'card-grid' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by group' });
  const status = h('p', { class: 'muted small-text', role: 'status' });
  const input = h('input', { type: 'search', class: 'field-input', placeholder: 'Filter tools', 'aria-label': 'Filter tools', autocomplete: 'off', spellcheck: false });
  const paint = () => {
    const list = searchTools(query).filter((t) => !cat || t.cat === cat);
    grid.replaceChildren(...list.map(toolCard));
    status.textContent = list.length ? `${list.length} ${list.length === 1 ? 'tool' : 'tools'}` : 'No tool matches. Try fewer words.';
    chips.replaceChildren(...[{ id: '', name: 'All' }, ...CATEGORIES].map((c) => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(cat === c.id), onclick: () => { cat = c.id; paint(); },
    }, c.name)));
  };
  input.addEventListener('input', () => { query = input.value; paint(); });
  main.replaceChildren(h('div', { class: 'wrap section pt' },
    h('header', { class: 'page-head' }, h('h1', { tabindex: -1 }, 'All tools'), h('p', {}, 'Everything runs in your browser. Pick a tool, or search with the filter below.')),
    h('div', { class: 'catalogue-bar' }, input, chips), status, grid));
  paint();
}

/* ------------------------------------------------------------- tool page */

async function loadModule(name) {
  if (!moduleCache.has(name)) moduleCache.set(name, import(`./tools/${name}.js`));
  try { return await moduleCache.get(name); } catch (e) { moduleCache.delete(name); throw e; }
}

async function renderTool(id) {
  const meta = byId[id];
  if (!meta) { renderNotFound(id); return; }
  setTitle(meta.name);
  renderSidebar(id);
  const body = h('div', { class: 'tool-body' }, h('p', { class: 'muted pad' }, 'Loading tool…'));
  main.replaceChildren(
    h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('a', { href: '#/tools' }, 'Tools'), icon('chevron', 13), h('a', { href: `#/tools?cat=${meta.cat}` }, catName(meta.cat))),
    h('header', { class: 'tool-head' },
      h('span', { class: 'tile lg' }, icon(meta.icon, 22)),
      h('div', {}, h('h1', { tabindex: -1 }, meta.name), h('p', {}, meta.desc))),
    body);
  try {
    const mod = await loadModule(meta.module);
    if (parseRoute().id !== id) return;
    const def = mod.tools[id];
    if (!def) throw new Error(`Tool “${id}” is missing from js/tools/${meta.module}.js`);
    teardown = mountTool(body, def);
  } catch (e) {
    console.error(e);
    if (parseRoute().id !== id) return;
    body.replaceChildren(h('div', { class: 'msg error', role: 'alert' }, 'This tool could not be loaded. Check your connection and try again.'),
      h('button', { class: 'btn', type: 'button', onclick: route }, 'Retry'));
  }
}

/* ------------------------------------------------------------ about etc. */

function renderAbout() {
  setTitle('About');
  const p = profile;
  main.replaceChildren(h('div', { class: 'wrap section pt' },
    h('header', { class: 'about-hero' },
      h('div', { class: 'avatar xl', 'aria-hidden': 'true' }, p.initials),
      h('div', {},
        h('h1', { tabindex: -1 }, p.name),
        h('p', { class: 'about-meta' }, p.role),
        h('p', { class: 'about-meta' }, icon('mapPin', 14), p.location),
        h('div', { class: 'cta-row tight' }, ...p.links.map((l) => h('a', { class: 'btn', href: l.href, rel: 'noopener noreferrer', target: '_blank' }, icon(l.icon, 16), l.label))))),
    h('p', { class: 'about-lead' }, p.headline),
    h('div', { class: 'about-cols' },
      h('div', { class: 'prose' }, ...p.summary.map((t) => h('p', {}, t))),
      h('aside', { class: 'glance', 'aria-label': 'At a glance' },
        h('h2', {}, 'Languages'),
        h('dl', {}, ...p.languages.flatMap((l) => [h('dt', {}, l.name), h('dd', {}, l.level)])))),
    h('section', { class: 'about-section' },
      h('h2', {}, 'What I do'),
      h('div', { class: 'focus-grid' }, ...p.focus.map((f) => h('div', { class: 'focus' }, h('span', { class: 'tile' }, icon(f.icon, 18)), h('h3', {}, f.title), h('p', {}, f.text))))),
    h('section', { class: 'about-section' },
      h('h2', {}, 'Skills'),
      h('div', { class: 'skills' }, ...p.skills.map((g) => h('div', {}, h('h3', {}, g.group), h('div', { class: 'tags' }, ...g.items.map((i) => h('span', { class: 'tag' }, i))))))),
    h('section', { class: 'about-section' },
      h('h2', {}, 'Things I have built'),
      h('ul', { class: 'project-list' }, ...p.projects.map((pr) => h('li', {},
        h('div', {}, h('strong', {}, pr.name), h('span', {}, pr.text)),
        pr.href && h('a', { class: 'link', href: pr.href, rel: 'noopener noreferrer', target: '_blank' }, 'View')))))));
}

function renderPrivacy() {
  setTitle('Privacy');
  main.replaceChildren(h('div', { class: 'wrap section pt' }, h('article', { class: 'prose narrow' },
    h('h1', { tabindex: -1 }, 'Privacy'),
    h('p', { class: 'lead-sm' }, 'The tools run in your browser without an account. Self-hosted Umami records page views for this site.'),
    h('h2', {}, 'What stays on your device'),
    h('p', {}, 'Text you type, files you open and images you drop in are processed by your browser only. They are never uploaded. Closing the tab discards them.'),
    h('h2', {}, 'Network requests'),
    h('p', {}, 'The currency converter downloads a public table of daily exchange rates from open.er-api.com. Only the base currency code is part of that request; your amounts are never sent.'),
    h('p', {}, 'Self-hosted Umami at static.vasylautomation.org receives page views, page titles, referrers, browser and device details, language, and approximate location. It does not receive text you enter or files you open. The tracker does not use cookies.'),
    h('h2', {}, 'Stored in your browser'),
    h('p', {}, 'Your light or dark theme choice is saved in local storage. A service worker caches the app files so the hub works offline.'),
    h('h2', {}, 'Good to know'),
    h('ul', {},
      h('li', {}, 'PDF output uses your browser’s Print / Save as PDF, which supports every language and alphabet.'),
      h('li', {}, 'Excel files are read as .xlsx (first sheet). Dates stored as Excel serial numbers are converted where a tool expects a date.'),
      h('li', {}, 'Exchange rates are reference rates, not trading quotes.')))));
}

function renderNotFound(id) {
  setTitle('Not found');
  main.replaceChildren(h('div', { class: 'wrap section pt' },
    h('div', { class: 'msg error' }, `There is no page or tool called “${id}”.`),
    h('p', {}, h('a', { class: 'btn', href: '#/tools' }, 'Browse all tools'))));
}

async function route() {
  const { id, params, view } = parseRoute();
  teardown?.(); teardown = null;
  openMenu(false);
  document.body.dataset.view = view;
  markNav(view === 'tool' || view === 'tools' ? 'tools' : id);
  window.scrollTo(0, 0);
  if (view === 'landing') renderLanding();
  else if (view === 'tools') renderCatalogue(params);
  else if (view === 'page') (id === 'about' ? renderAbout : renderPrivacy)();
  else await renderTool(id);
  if (view !== 'landing') $('h1', main)?.focus({ preventScroll: true });
}
addEventListener('hashchange', route);

/* ------------------------------------------------------ command palette */

let palette = null;
function buildPalette() {
  const input = h('input', { type: 'text', class: 'pal-input', placeholder: 'Search tools and pages', 'aria-label': 'Search tools and pages', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', autocomplete: 'off', spellcheck: false });
  const list = h('div', { class: 'pal-list', id: 'pal-list', role: 'listbox' });
  const dialog = h('div', { class: 'pal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Search' },
    h('div', { class: 'pal-top' }, icon('search', 16), input, h('kbd', {}, 'Esc')), list,
    h('div', { class: 'pal-foot' }, h('span', {}, h('kbd', {}, 'Up'), h('kbd', {}, 'Down'), ' to move'), h('span', {}, h('kbd', {}, 'Enter'), ' to open')));
  const overlay = h('div', { class: 'pal-overlay', hidden: true }, dialog);
  document.body.append(overlay);
  let items = [];
  let active = 0;
  const paint = () => {
    const q = input.value.trim().toLowerCase();
    const pages = [['', 'Home', 'home'], ['tools', 'All tools', 'layers'], ['about', 'About me', 'user'], ['privacy', 'Privacy', 'lock']]
      .filter(([, name]) => !q || name.toLowerCase().includes(q)).map(([to, name, ic]) => ({ to: `#/${to}`, name, ic, sub: 'Page' }));
    const tools = searchTools(q).map((t) => ({ to: `#/${t.id}`, name: t.name, ic: t.icon, sub: catName(t.cat) }));
    items = [...pages, ...tools].slice(0, 30);
    active = Math.min(active, Math.max(0, items.length - 1));
    list.replaceChildren(...(items.length ? items.map((it, i) => h('a', {
      href: it.to, role: 'option', class: `pal-item${i === active ? ' on' : ''}`, 'aria-selected': String(i === active),
      onmousemove: () => { if (active !== i) { active = i; paint(); } }, onclick: () => close(),
    }, icon(it.ic, 16), h('span', { class: 'pal-name' }, it.name), h('span', { class: 'pal-sub' }, it.sub))) : [h('p', { class: 'pal-empty' }, 'No results. Try a different word.')]));
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  const close = () => { overlay.hidden = true; document.body.classList.remove('pal-open'); palette.lastFocus?.focus?.(); };
  input.addEventListener('input', () => { active = 0; paint(); });
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
    else if (e.key === 'Enter' && items[active]) { e.preventDefault(); location.hash = items[active].to; close(); }
    else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
  });
  return { overlay, input, paint, close, lastFocus: null };
}
function openPalette() {
  palette ||= buildPalette();
  palette.lastFocus = document.activeElement;
  palette.input.value = '';
  palette.overlay.hidden = false;
  document.body.classList.add('pal-open');
  palette.paint();
  palette.input.focus();
}
$('#palette-btn').addEventListener('click', openPalette);
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  else if (e.key === '/' && !typing && !document.activeElement?.isContentEditable) { e.preventDefault(); openPalette(); }
  else if (e.key === 'Escape') openMenu(false);
});

route();

/* ------------------------------------------------------- offline cache */

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support is optional */ });
    // Warm the cache with every tool module while idle so the whole hub works offline.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
    idle(() => [...new Set(TOOLS.map((t) => t.module))].forEach((m) => loadModule(m).catch(() => {})));
  });
}

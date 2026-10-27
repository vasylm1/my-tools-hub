// App shell: hash router, sidebar, search, theme, lazy tool loading.
import { h, $ } from './core/dom.js';
import { mountTool } from './core/runner.js';
import { CATEGORIES, TOOLS, byId, searchTools } from './registry.js';

const main = $('#main');
const sidebar = $('#sidebar');
const search = $('#search');
const menuBtn = $('#menu-btn');
const scrim = $('#scrim');
const BASE_TITLE = 'My Tools Hub';
const moduleCache = new Map();
let teardown = null;

/* ----------------------------------------------------------------- nav */

function toolLink(t, current) {
  return h('a', { href: `#/${t.id}`, class: 'nav-link', 'aria-current': t.id === current ? 'page' : null },
    h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, t.icon), h('span', {}, t.name));
}

function renderSidebar(current, query = '') {
  const matches = new Set(searchTools(query).map((t) => t.id));
  const groups = CATEGORIES.map((c) => {
    const tools = TOOLS.filter((t) => t.cat === c.id && matches.has(t.id));
    return tools.length && h('section', { class: 'nav-group' },
      h('h2', { class: 'nav-heading' }, h('span', { 'aria-hidden': 'true' }, c.icon), ' ', c.name),
      h('div', { class: 'nav-list' }, ...tools.map((t) => toolLink(t, current))));
  });
  sidebar.replaceChildren(
    h('a', { href: '#/', class: 'nav-link home-link', 'aria-current': current === '' ? 'page' : null }, h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, '🏠'), h('span', {}, 'All tools')),
    ...groups.filter(Boolean),
    !matches.size && h('p', { class: 'muted pad' }, 'No tools match.'));
}

function openMenu(open) {
  document.body.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  scrim.hidden = !open;
}
menuBtn.addEventListener('click', () => openMenu(!document.body.classList.contains('menu-open')));
scrim.addEventListener('click', () => openMenu(false));
sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) openMenu(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') openMenu(false);
  if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
    e.preventDefault(); search.focus(); search.select();
  }
});

search.addEventListener('input', () => {
  renderSidebar(currentId(), search.value);
  if (!currentId()) renderHome(search.value);
});
search.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const first = searchTools(search.value)[0];
  if (first) { location.hash = `#/${first.id}`; search.blur(); }
});

/* --------------------------------------------------------------- theme */

const themeBtn = $('#theme-btn');
themeBtn.addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('mth-theme', next); } catch { /* storage blocked */ }
});

/* -------------------------------------------------------------- routes */

const currentId = () => decodeURIComponent(location.hash.replace(/^#\/?/, '').split('?')[0]);

function setTitle(title) { document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE; }

function renderHome(query = '') {
  const matches = searchTools(query);
  const sections = CATEGORIES.map((c) => {
    const tools = matches.filter((t) => t.cat === c.id);
    return tools.length && h('section', { class: 'home-group' },
      h('h2', {}, h('span', { 'aria-hidden': 'true' }, c.icon), ' ', c.name),
      h('div', { class: 'card-grid' }, ...tools.map((t) => h('a', { class: 'card', href: `#/${t.id}` },
        h('span', { class: 'card-icon', 'aria-hidden': 'true' }, t.icon),
        h('span', { class: 'card-body' }, h('strong', {}, t.name), h('span', {}, t.desc))))));
  });
  main.replaceChildren(
    h('div', { class: 'hero' },
      h('h1', {}, 'Small tools. Big relief.'),
      h('p', {}, `${TOOLS.length} private utilities for writing, data, documents and images. Everything runs in your browser, so nothing is uploaded and nothing needs an account.`)),
    ...sections.filter(Boolean),
    !matches.length && h('p', { class: 'empty' }, `No tool matches “${query}”.`));
}

function renderAbout() {
  setTitle('About & privacy');
  main.replaceChildren(h('article', { class: 'prose' },
    h('h1', {}, 'About & privacy'),
    h('p', {}, 'My Tools Hub is a collection of small utilities written in plain HTML, CSS and JavaScript. There is no server, no account, no analytics and no tracking.'),
    h('h2', {}, 'What stays on your device'),
    h('p', {}, 'Text you type, files you open and images you drop in are processed by your browser only. They are never uploaded. Closing the tab discards them. The site works offline once it has loaded.'),
    h('h2', {}, 'The one network request'),
    h('p', {}, 'The Currency converter downloads a public table of daily exchange rates from open.er-api.com. Only the base currency code is part of that request; none of your amounts are sent.'),
    h('h2', {}, 'Stored in your browser'),
    h('p', {}, 'Only your light/dark theme choice is saved in local storage, and a service worker caches the app files so it can run offline.'),
    h('h2', {}, 'Good to know'),
    h('ul', {},
      h('li', {}, 'PDF output uses your browser’s “Print / Save as PDF”, which supports every language and alphabet.'),
      h('li', {}, 'Excel files are read as .xlsx (first sheet). Dates stored as Excel serial numbers are converted where a tool expects a date.'),
      h('li', {}, 'Exchange rates are reference rates, not trading quotes.')),
    h('p', {}, h('a', { href: '#/' }, '← Back to all tools'))));
}

async function loadModule(name) {
  if (!moduleCache.has(name)) moduleCache.set(name, import(`./tools/${name}.js`));
  try { return await moduleCache.get(name); } catch (e) { moduleCache.delete(name); throw e; }
}

async function route() {
  const id = currentId();
  teardown?.(); teardown = null;
  renderSidebar(id, search.value);
  window.scrollTo(0, 0);
  if (id === '') { setTitle(''); renderHome(search.value); return; }
  if (id === 'about') { renderAbout(); main.focus({ preventScroll: true }); return; }
  const meta = byId[id];
  if (!meta) {
    setTitle('Not found');
    main.replaceChildren(h('div', { class: 'msg error' }, `There is no tool called “${id}”.`), h('p', {}, h('a', { href: '#/' }, '← Back to all tools')));
    return;
  }
  setTitle(meta.name);
  const heading = h('header', { class: 'tool-head' },
    h('span', { class: 'tool-icon', 'aria-hidden': 'true' }, meta.icon),
    h('div', {}, h('h1', { tabindex: -1 }, meta.name), h('p', {}, meta.desc)));
  const body = h('div', { class: 'tool-body' }, h('p', { class: 'muted pad' }, 'Loading…'));
  main.replaceChildren(heading, body);
  try {
    const mod = await loadModule(meta.module);
    if (currentId() !== id) return;
    const def = mod.tools[id];
    if (!def) throw new Error(`Tool “${id}” is missing from js/tools/${meta.module}.js`);
    teardown = mountTool(body, def);
    $('h1', heading).focus({ preventScroll: true });
  } catch (e) {
    console.error(e);
    if (currentId() !== id) return;
    body.replaceChildren(h('div', { class: 'msg error', role: 'alert' }, 'This tool could not be loaded. Check your connection and try again.'),
      h('button', { class: 'btn', type: 'button', onclick: route }, 'Retry'));
  }
}

addEventListener('hashchange', route);
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

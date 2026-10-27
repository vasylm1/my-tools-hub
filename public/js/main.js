// App shell: hash router, views (landing, catalogue, tool, about, privacy), command palette, theme.
import { h, $ } from './core/dom.js';
import { icon } from './core/icons.js';
import { mountTool } from './core/runner.js';
import { CATEGORIES, TOOLS, byId, searchTools } from './registry.js';
import { profile, legal } from './profile.js';
import { encodeQr, drawQr } from './lib/qr.js';
import { applyStaticTranslations, countText, initLocale, setLocale, t as tr } from './i18n.js';

const main = $('#main');
const sidebar = $('#sidebar');
const menuBtn = $('#menu-btn');
const scrim = $('#scrim');
const themeBtn = $('#theme-btn');
const localeSelect = $('#locale-select');
const BASE_TITLE = 'My Tools Hub';
const NETLIFY_PRIVACY = 'https://www.netlify.com/privacy/';
const GITHUB = 'https://github.com/vasylm1/my-tools-hub';
const moduleCache = new Map();
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
let teardown = null;

const portrait = (cls = '') => h('span', { class: `avatar ${cls}` }, h('img', { src: profile.photo, alt: tr('Portrait of {name}', { name: profile.name }), width: 640, height: 640, decoding: 'async' }));
const catName = (id) => tr(CATEGORIES.find((c) => c.id === id)?.name || '');
const count = (cat) => TOOLS.filter((t) => t.cat === cat).length;

localeSelect.value = initLocale();
applyStaticTranslations();
localeSelect.addEventListener('change', () => {
  setLocale(localeSelect.value);
  applyStaticTranslations();
  closeSearch();
  route();
});

/* ------------------------------------------------------------- chrome */

menuBtn.append(icon('menu', 18));

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
  else if (id === 'about' || id === 'privacy' || id === 'legal') view = 'page';
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
  const groups = CATEGORIES.map((category) => {
    const links = TOOLS.filter((tool) => tool.cat === category.id).map((tool) => h('a', {
      href: `#/${tool.id}`, class: 'nav-link', 'aria-current': tool.id === current ? 'page' : null,
    }, icon(tool.icon, 16), h('span', {}, tr(tool.name))));
    return h('section', { class: 'nav-group' },
      h('h2', { class: 'nav-heading' }, tr(category.name)), h('div', { class: 'nav-list' }, ...links));
  });
  sidebar.replaceChildren(...groups);
}

const toolCard = (t) => h('a', { class: 'tool-card', href: `#/${t.id}` },
  h('span', { class: 'tile' }, icon(t.icon, 18)),
  h('span', { class: 'tool-card-body' }, h('strong', {}, tr(t.name)), h('span', {}, tr(t.desc))));

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
        h('div', { class: 'mock-head' }, h('strong', {}, tr('JSON formatter')), h('span', {}, tr('Format, minify and validate'))),
        h('div', { class: 'mock-code' },
          line(tok('p', '{')),
          line('  ', tok('k', '"tool"'), tok('p', ': '), tok('s', '"qr-code"'), tok('p', ',')),
          line('  ', tok('k', '"private"'), tok('p', ': '), tok('b', 'true'), tok('p', ',')),
          line('  ', tok('k', '"uploads"'), tok('p', ': '), tok('n', '0'), tok('p', ',')),
          line('  ', tok('k', '"works_offline"'), tok('p', ': '), tok('b', 'true')),
          line(tok('p', '}'))),
        h('div', { class: 'mock-valid' }, icon('check', 14), tr('Valid JSON.'))),
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
        h('h1', {}, tr('Small tools, built with care.')),
        h('p', { class: 'lead' }, tr('Format, convert, generate and clean without uploading a single file. A private toolbox for writing, data, documents and images.')),
        h('div', { class: 'cta-row' },
          h('a', { class: 'btn primary lg', href: '#/tools' }, tr('Browse all tools')),
          h('a', { class: 'btn lg', href: '#/about' }, tr('About me')),
          h('span', { class: 'hint-keys' }, tr('or press '), h('kbd', {}, isMac ? 'Cmd K' : 'Ctrl K'), tr(' to search'))),
        heroWindow())),
    h('section', { class: 'wrap section' },
      h('div', { class: 'principles' }, ...principles.map(([ic, title, text]) => h('div', { class: 'principle' }, icon(ic, 20), h('h2', {}, tr(title)), h('p', {}, tr(text))))),
    h('section', { class: 'wrap section' },
      h('div', { class: 'section-head' }, h('h2', {}, tr('Everything in one place')), h('p', {}, `${countText('tool', TOOLS.length)} · ${countText('group', CATEGORIES.length)}`)),
      h('div', { class: 'cat-list' }, ...CATEGORIES.map((c) => h('a', { class: 'cat-row', href: `#/tools?cat=${c.id}` },
        h('span', { class: 'tile' }, icon(c.icon, 18)),
        h('span', { class: 'cat-text' }, h('strong', {}, tr(c.name)), h('span', {}, tr(c.blurb))),
        h('span', { class: 'cat-count' }, countText('tool', count(c.id))),
        icon('chevron', 16, 'cat-go'))))),
    h('section', { class: 'wrap section' },
      h('div', { class: 'section-head' }, h('h2', {}, tr('Good places to start')), h('a', { class: 'link', href: '#/tools' }, tr('See all tools'))),
      h('div', { class: 'card-grid' }, ...featured.map(toolCard))),
    h('section', { class: 'wrap section' },
      h('div', { class: 'maker' },
        portrait(),
        h('div', { class: 'maker-text' }, h('h2', {}, tr('Made by {name}', { name: profile.name })), h('p', {}, tr(profile.headline))),
        h('a', { class: 'btn', href: '#/about' }, tr('About me'))))));
}

/* ----------------------------------------------------------- catalogue */

function renderCatalogue(params) {
  setTitle(tr('All tools'));
  let cat = params.get('cat') || '';
  if (!CATEGORIES.some((c) => c.id === cat)) cat = '';
  let query = '';
  const grid = h('div', { class: 'card-grid' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': tr('Filter by group') });
  const status = h('p', { class: 'muted small-text', role: 'status' });
  const input = h('input', { type: 'search', class: 'field-input', placeholder: tr('Filter tools'), 'aria-label': tr('Filter tools'), autocomplete: 'off', spellcheck: false });
  const paint = () => {
    const list = searchTools(query, tr).filter((t) => !cat || t.cat === cat);
    grid.replaceChildren(...list.map(toolCard));
    status.textContent = list.length ? countText('tool', list.length) : tr('No tool matches. Try fewer words.');
    chips.replaceChildren(...[{ id: '', name: tr('All') }, ...CATEGORIES].map((c) => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(cat === c.id), onclick: () => { cat = c.id; paint(); },
    }, c.id ? tr(c.name) : c.name)));
  };
  input.addEventListener('input', () => { query = input.value; paint(); });
  main.replaceChildren(h('div', { class: 'wrap section pt' },
    h('header', { class: 'page-head' }, h('h1', { tabindex: -1 }, tr('All tools')), h('p', {}, tr('Everything runs in your browser. Pick a tool, or search with the filter below.'))),
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
  setTitle(tr(meta.name));
  renderSidebar(id);
  const body = h('div', { class: 'tool-body' }, h('p', { class: 'muted pad' }, tr('Loading tool…')));
  main.replaceChildren(
    h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('a', { href: '#/tools' }, tr('Tools')), icon('chevron', 13), h('a', { href: `#/tools?cat=${meta.cat}` }, catName(meta.cat))),
    h('header', { class: 'tool-head' },
      h('span', { class: 'tile lg' }, icon(meta.icon, 22)),
      h('div', {}, h('h1', { tabindex: -1 }, tr(meta.name)), h('p', {}, tr(meta.desc)))),
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
    body.replaceChildren(h('div', { class: 'msg error', role: 'alert' }, tr('This tool could not be loaded. Check your connection and try again.')),
      h('button', { class: 'btn', type: 'button', onclick: route }, tr('Retry')));
  }
}

/* ------------------------------------------------------------ about etc. */

function renderAbout() {
  setTitle(tr('About'));
  const p = profile;
  const mail = { label: 'Email', icon: 'mail', href: `mailto:${p.email}` };
  const links = [...p.links, mail].map((link) => h('a', {
    class: 'btn', href: link.href, ...(link.href.startsWith('http') ? { rel: 'noopener noreferrer', target: '_blank' } : {}),
  }, icon(link.icon, 16), tr(link.label)));
  const experience = p.experience.map((item) => h('li', {},
    h('span', { class: 'when' }, tr(item.period)),
    h('div', {}, h('h3', {}, tr(item.role)), h('p', { class: 'where' }, `${item.org}, ${tr(item.place)}`),
      item.points.length ? h('ul', {}, ...item.points.map((text) => h('li', {}, tr(text)))) : null)));
  const education = p.education.map((item) => h('li', {},
    h('span', { class: 'when' }, tr(item.period)),
    h('div', {}, h('h3', {}, tr(item.title)), h('p', { class: 'where' }, item.org))));
  const skills = p.skills.map((group) => h('div', {},
    h('h3', {}, tr(group.group)), h('div', { class: 'tags' }, ...group.items.map((item) => h('span', { class: 'tag' }, tr(item))))));
  const projects = p.projects.map((project) => h('li', {},
    h('div', {}, h('strong', {}, project.name), h('span', {}, tr(project.text))),
    project.href && h('a', { class: 'link', href: project.href, rel: 'noopener noreferrer', target: '_blank' }, tr('View'))));

  main.replaceChildren(h('div', { class: 'wrap section pt' },
    h('header', { class: 'about-hero' }, portrait('xl'), h('div', {},
      h('h1', { tabindex: -1 }, p.name), h('p', { class: 'about-meta' }, tr(p.role)),
      h('p', { class: 'about-meta' }, icon('mapPin', 14), tr(p.location)), h('div', { class: 'cta-row tight' }, ...links))),
    h('p', { class: 'about-lead' }, tr(p.headline)),
    h('div', { class: 'about-cols' },
      h('div', { class: 'prose' }, ...p.summary.map((text) => h('p', {}, tr(text)))),
      h('aside', { class: 'glance', 'aria-label': tr('Languages') }, h('h2', {}, tr('Languages')),
        h('dl', {}, ...p.languages.flatMap((language) => [h('dt', {}, tr(language.name)), h('dd', {}, language.level)])))),
    h('section', { class: 'about-section' }, h('h2', {}, tr('What I do')),
      h('div', { class: 'focus-grid' }, ...p.focus.map((item) => h('div', { class: 'focus' },
        h('span', { class: 'tile' }, icon(item.icon, 18)), h('h3', {}, tr(item.title)), h('p', {}, tr(item.text)))))),
    h('section', { class: 'about-section' }, h('h2', {}, tr('Experience')), h('ol', { class: 'timeline' }, ...experience)),
    h('section', { class: 'about-section' }, h('h2', {}, tr('Education')), h('ol', { class: 'timeline' }, ...education)),
    h('section', { class: 'about-section' }, h('h2', {}, tr('Skills')), h('div', { class: 'skills' }, ...skills)),
    h('section', { class: 'about-section' }, h('h2', {}, tr('Selected certifications')),
      h('div', { class: 'tags' }, ...p.certifications.map((cert) => h('span', { class: 'tag' }, cert)))),
    h('section', { class: 'about-section' }, h('h2', {}, tr('Things I have built')), h('ul', { class: 'project-list' }, ...projects))));
}

const ext = (href, text) => h('a', { href, rel: 'noopener noreferrer', target: '_blank' }, text);
const mailto = () => h('a', { href: `mailto:${legal.email}` }, legal.email);

function renderPrivacy() {
  setTitle(tr('Privacy'));
  main.replaceChildren(h('div', { class: 'wrap section pt' }, h('article', { class: 'prose narrow' },
    h('h1', { tabindex: -1 }, tr('Privacy')),
    h('p', { class: 'lead-sm' }, tr('The tools run in your browser, so your files and text never reach me. This page explains the little data that does exist, as required by Articles 13 and 14 of the GDPR.')),
    h('h2', {}, tr('Who is responsible')),
    h('p', {}, `${legal.controller}, ${tr(legal.country)}. ${tr('Contact:')} `, mailto(), '.'),
    h('h2', {}, tr('Your files and text')),
    h('p', {}, tr('Everything you type, open or drop into a tool is processed locally by your browser. It is not uploaded, stored or shared. Closing the tab discards it.')),
    h('h2', {}, tr('Visiting the site')),
    h('p', {}, tr('The site is hosted by Netlify, Inc. (USA). When you load a page, Netlify’s servers process technical data such as your IP address, the time, the requested file, your browser and the referring page, in server logs. This is needed to deliver and secure the site (legitimate interest, Art. 6(1)(f) GDPR). See '), ext(NETLIFY_PRIVACY, tr('Netlify’s privacy policy')), tr(' for how it handles this data and for international transfer safeguards.')),
    h('h2', {}, tr('Page statistics')),
    h('p', {}, tr('I use Umami, a privacy-focused analytics tool that I host myself ({host}), to see which pages and tools are used. It counts page views and records the referring site, browser, operating system, device type and country. It sets no cookies, follows no one across other sites, and honours your browser’s Do Not Track setting. The legal basis is legitimate interest (Art. 6(1)(f) GDPR). You can object at any time by emailing me or by enabling Do Not Track.', { host: legal.analyticsHost })),
    h('h2', {}, tr('Currency converter')),
    h('p', {}, tr('Only this tool contacts another service. To show exchange rates it requests a public rate table from open.er-api.com ('), ext('https://www.exchangerate-api.com', 'Exchange Rate API'), tr('), which therefore sees your IP address and the base currency code. Your amounts are never sent.')),
    h('h2', {}, tr('Cookies and browser storage')),
    h('p', {}, tr('There are no cookies. Your light or dark theme choice is kept in your browser’s local storage, and a service worker caches the app files so the site works offline. Both exist only to provide the features you use, so no consent banner is needed under the ePrivacy rules. You can clear them in your browser settings.')),
    h('h2', {}, tr('Your rights')),
    h('p', {}, tr('You have the right to access, correct or erase your data, to restrict or object to its processing, and to data portability (Articles 15 to 21 GDPR). Email '), mailto(), tr(' and I will respond promptly. You may also complain to a supervisory authority, for example '), ext(legal.authority.href, tr(legal.authority.name)), tr('. There is no automated decision-making, and you are not required to give any data to use the tools.')),
    h('h2', {}, tr('Changes')),
    h('p', {}, tr('Last updated {date}. If the way the site handles data changes, this page changes first.', { date: legal.updated })))));
}

function renderLegal() {
  setTitle(tr('Legal notice'));
  main.replaceChildren(h('div', { class: 'wrap section pt' }, h('article', { class: 'prose narrow' },
    h('h1', { tabindex: -1 }, tr('Legal notice')),
    h('h2', {}, tr('Provider')),
    h('p', {}, `${legal.controller}, ${tr(legal.country)}.`),
    h('p', {}, `${tr('Email')}: `, mailto()),
    h('h2', {}, tr('About this site')),
    h('p', {}, tr('My Tools Hub is a free, non-commercial personal project. It has no advertising, no accounts and no paid features.')),
    h('h2', {}, tr('Copyright and licence')),
    h('p', {}, tr('The source code is published under the MIT licence at '), ext('https://github.com/vasylm1/my-tools-hub', 'github.com/vasylm1/my-tools-hub'), tr('. The portrait and the text on the About page are © '), profile.name, tr('. All rights reserved.')),
    h('h2', {}, tr('Third-party data')),
    h('p', {}, tr('Exchange rates in the currency converter are provided by '), ext('https://www.exchangerate-api.com', 'Exchange Rate API'), tr('. They are reference rates, not trading quotes, and carry no guarantee.')),
    h('h2', {}, tr('Liability')),
    h('p', {}, tr('The tools are provided as they are. Check important results, such as converted figures, generated documents and anonymised data, before relying on them. I am not responsible for the content of external sites that I link to.')),
    h('h2', {}, tr('Accessibility')),
    h('p', {}, tr('I aim to meet WCAG 2.1 level AA. Every page and a sample of tools passes automated checks (axe-core) in the light and dark themes. The site works with a keyboard alone, shows a visible focus indicator, stays readable at 400% zoom without sideways scrolling, and respects the reduced-motion setting. I have not had an independent audit.')),
    h('p', {}, tr('Known limits: image previews describe their size but not their content, and the HTML viewer shows whatever HTML you give it, so its accessibility is that of your content.')),
    h('p', {}, tr('If something blocks you, please email '), mailto(), tr(' and I will fix it.')),
    h('p', {}, h('a', { href: '#/privacy' }, tr('Read the privacy information'))))));
}

function renderNotFound(id) {
  setTitle(tr('Not found'));
  main.replaceChildren(h('div', { class: 'wrap section pt' },
    h('div', { class: 'msg error' }, tr('There is no page or tool called “{id}”.', { id })),
    h('p', {}, h('a', { class: 'btn', href: '#/tools' }, tr('Browse all tools')))));
}

async function route() {
  closeSearch();
  const { id, params, view } = parseRoute();
  teardown?.(); teardown = null;
  openMenu(false);
  document.body.dataset.view = view;
  markNav(view === 'tool' || view === 'tools' ? 'tools' : id);
  window.scrollTo(0, 0);
  if (view === 'landing') renderLanding();
  else if (view === 'tools') renderCatalogue(params);
  else if (view === 'page') ({ about: renderAbout, privacy: renderPrivacy, legal: renderLegal })[id]();
  else await renderTool(id);
  if (view !== 'landing') $('h1', main)?.focus({ preventScroll: true });
}
addEventListener('hashchange', route);

/* ------------------------------------------------------- toolbar search */

const searchInput = $('#search');
const searchList = $('#search-results');
$('#search-kbd').textContent = isMac ? 'Cmd K' : 'Ctrl K';
$('#search-icon').append(icon('search', 15));
let hits = [];
let active = -1;

function searchHits(q) {
  const pages = [['tools', 'All tools', 'layers'], ['about', 'About', 'user'], ['privacy', 'Privacy', 'lock'], ['legal', 'Legal notice', 'info']]
    .filter(([, name]) => q && `${name} ${tr(name)}`.toLowerCase().includes(q)).map(([to, name, ic]) => ({ to: `#/${to}`, name: tr(name), ic, sub: tr('Page') }));
  const tools = searchTools(q, tr).map((tool) => ({ to: `#/${tool.id}`, name: tr(tool.name), ic: tool.icon, sub: catName(tool.cat) }));
  return [...tools, ...pages].slice(0, 8);
}

function closeSearch() {
  searchList.hidden = true;
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.removeAttribute('aria-activedescendant');
  active = -1;
}

function paintSearch() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { closeSearch(); return; } // results appear only while typing: no suggestion list on focus, load or language change
  hits = searchHits(q);
  active = hits.length ? 0 : -1;
  searchList.replaceChildren(...[
    ...(hits.length ? hits.map((it, i) => h('a', {
      href: it.to, id: `hit-${i}`, role: 'option', class: `hit${i === active ? ' on' : ''}`, 'aria-selected': String(i === active),
      onmousedown: (e) => e.preventDefault(), onclick: () => { closeSearch(); searchInput.blur(); },
      onmousemove: () => setActive(i),
    }, icon(it.ic, 16), h('span', { class: 'hit-name' }, it.name), h('span', { class: 'hit-sub' }, it.sub))) : [h('p', { class: 'search-empty' }, tr('No tool matches. Try fewer words.'))]),
  ].filter(Boolean));
  searchList.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
  if (active >= 0) searchInput.setAttribute('aria-activedescendant', `hit-${active}`);
}

function setActive(i) {
  active = i;
  searchList.querySelectorAll('.hit').forEach((el, k) => { el.classList.toggle('on', k === i); el.setAttribute('aria-selected', String(k === i)); });
  if (i >= 0) { searchInput.setAttribute('aria-activedescendant', `hit-${i}`); $(`#hit-${i}`)?.scrollIntoView({ block: 'nearest' }); }
}

searchInput.addEventListener('focus', paintSearch);
searchInput.addEventListener('input', paintSearch);
searchInput.addEventListener('blur', () => setTimeout(closeSearch, 120));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); if (searchList.hidden) paintSearch(); else setActive(Math.min(hits.length - 1, active + 1)); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, active - 1)); }
  else if (e.key === 'Enter') { const hit = hits[active >= 0 ? active : 0]; if (hit) { e.preventDefault(); location.hash = hit.to; searchInput.value = ''; closeSearch(); searchInput.blur(); } }
  else if (e.key === 'Escape') { searchInput.value = ''; closeSearch(); searchInput.blur(); }
});
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
  else if (e.key === '/' && !typing && !document.activeElement?.isContentEditable) { e.preventDefault(); searchInput.focus(); searchInput.select(); }
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

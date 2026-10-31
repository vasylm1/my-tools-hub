// App shell: hash router, views (landing, catalogue, tool, about, privacy), command palette, theme.
import { h, $ } from './core/dom.js';
import { icon } from './core/icons.js';
import { mountTool } from './core/runner.js';
import { CATEGORIES, TOOLS, byId, searchTools } from './registry.js';
import { profile, legal } from './profile.js';
import { heroWindow as buildHero } from './hero.js';
import { favourites, recents, isFavourite, toggleFavourite, noteRecent, clearRecents, onFavsChange } from './favs.js';
import { createPalette } from './palette.js';
import { applyStaticTranslations, countText, initLocale, setLocale, t as tr } from './i18n.js';

const main = $('#main');
const sidebar = $('#sidebar');
const menuBtn = $('#menu-btn');
const scrim = $('#scrim');
const themeBtn = $('#theme-btn');
const localeSelect = $('#locale-select');
const BASE_TITLE = 'My Tools Hub';
const NETLIFY_PRIVACY = 'https://www.netlify.com/privacy/';
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
  document.querySelector('dialog.palette')?.remove();
  palette = createPalette({ tr, getGroups: paletteGroups });
  route();
  renderStatsNotice();
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
  const mine = favourites().map((id) => byId[id]);
  const groups = [...(mine.length ? [{ id: 'favourites', name: 'Favourites', fav: true }] : []), ...CATEGORIES].map((category) => {
    const links = (category.fav ? mine : TOOLS.filter((tool) => tool.cat === category.id)).map((tool) => h('a', {
      href: `#/${tool.id}`, class: 'nav-link', 'aria-current': tool.id === current ? 'page' : null,
    }, icon(tool.icon, 16), h('span', {}, tr(tool.name))));
    return h('section', { class: 'nav-group' },
      h('h2', { class: 'nav-heading' }, tr(category.name)), h('div', { class: 'nav-list' }, ...links));
  });
  sidebar.replaceChildren(...groups);
}

// Views register a repaint here; they are dropped on every navigation and run when favourites or recent tools change.
const favHooks = new Set();
onFavsChange(() => favHooks.forEach((fn) => fn()));

function paintFavButtons() {
  document.querySelectorAll('[data-fav]').forEach((b) => b.setAttribute('aria-pressed', String(isFavourite(b.dataset.fav))));
}
favHooks.add(paintFavButtons);

const favButton = (t, { text = false } = {}) => {
  const btn = h('button', {
    type: 'button', class: text ? 'btn small fav-toggle' : 'fav-btn', 'data-fav': t.id, 'aria-pressed': String(isFavourite(t.id)),
    'aria-label': text ? null : tr('Favourite: {name}', { name: tr(t.name) }), title: tr('Favourite'),
  }, icon('star', text ? 15 : 17), text && h('span', {}, tr('Favourite')));
  btn.addEventListener('click', () => { toggleFavourite(t.id); });
  return btn;
};

const toolCard = (t) => h('div', { class: 'tool-card-wrap' },
  h('a', { class: 'tool-card', href: `#/${t.id}` },
    h('span', { class: 'tile' }, icon(t.icon, 18)),
    h('span', { class: 'tool-card-body' }, h('strong', {}, tr(t.name)), h('span', {}, tr(t.desc)))),
  favButton(t));

/* ------------------------------------------------------------ landing */

const heroWindow = () => buildHero({ tr, byId });

// "Your tools": recently used and favourite tools, shown on the home page only once there is something to show.
function yourTools() {
  const box = h('section', { class: 'wrap section your-tools', 'aria-label': tr('Your tools') });
  const row = (title, ids) => ids.length && h('div', { class: 'case' },
    h('div', { class: 'case-text' }, h('h3', {}, tr(title))),
    h('div', { class: 'case-tools' }, ...ids.map((id) => h('a', { class: 'pill', href: `#/${id}` }, icon(byId[id].icon, 15), tr(byId[id].name)))));
  const paint = () => {
    const rec = recents().slice(0, 4);
    const fav = favourites();
    box.hidden = !rec.length && !fav.length;
    box.replaceChildren(h('div', { class: 'section-head' }, h('h2', {}, tr('Your tools')), h('p', {}, tr('Saved in this browser only.'))),
      h('div', { class: 'cases' }, row('Recently used', rec), row('Favourites', fav)));
  };
  paint();
  favHooks.add(paint);
  return box;
}

function renderLanding() {
  setTitle('');
  const principles = [
    ['lock', 'Private by design', 'Files and text stay on your device. Self-hosted Umami counts page visits; there are no uploads or accounts.'],
    ['wifioff', 'Works offline', 'Open it once and every tool keeps working without a connection.'],
    ['zap', 'Fast and plain', 'No frameworks and no build step. Tools load on demand and open instantly.'],
    ['code', 'Open source', 'Plain HTML, CSS and JavaScript that you can read, audit and run yourself.'],
  ];
  const cases = [
    ['Marketing and sales', 'Launch faster with assets you can build yourself.', ['qr-code', 'newsletter-builder', 'email-signature', 'sell-sheet']],
    ['Data and reporting', 'Turn messy tables into something you can trust.', ['spreadsheet-cleaner', 'chart-maker', 'data-anonymizer', 'excel-to-calendar']],
    ['Developers and admins', 'Check, format and compare without opening an IDE.', ['json-formatter', 'sql-formatter', 'text-diff', 'power-automate-checker']],
    ['Everyday documents', 'Handle files without uploading them anywhere.', ['images-to-pdf', 'image-resizer', 'resume-builder', 'office-to-markdown']],
  ];
  const steps = [
    ['Pick a tool', 'Use the search in the toolbar or browse the groups. Every tool has an example you can load in one click.'],
    ['Add your text or files', 'Everything is processed in your browser, so nothing leaves your device.'],
    ['Copy or download the result', 'Save a file, copy the text, or print to PDF. No account, and nothing added to your files.'],
  ];
  const trust = ['No sign-up', 'Nothing is uploaded', 'Works offline', 'Five languages'];
  main.replaceChildren(
    h('section', { class: 'hero' },
      h('div', { class: 'wrap hero-in' },
        h('h1', {}, tr('Get the small jobs done. Keep your files private.')),
        h('p', { class: 'lead' }, tr('Tools for the everyday jobs that eat your afternoon: cleaning a spreadsheet, shrinking a logo, building a QR code, formatting JSON. Nothing is uploaded and nothing needs an account.')),
        h('div', { class: 'cta-row' },
          h('a', { class: 'btn primary lg', href: '#/tools' }, tr('Open the toolbox')),
          h('a', { class: 'btn lg', href: '#/about' }, tr('About me')),
          h('span', { class: 'hint-keys' }, tr('or press '), h('kbd', {}, isMac ? 'Cmd K' : 'Ctrl K'), tr(' to search'))),
        h('ul', { class: 'trust' }, ...trust.map((label) => h('li', {}, icon('check', 15), tr(label)))),
        heroWindow())),
    yourTools(),
    h('section', { class: 'wrap section' },
      h('div', { class: 'section-head' }, h('h2', {}, tr('Built for the jobs you actually have')), h('p', {}, tr('Pick a starting point. Each tool has a one-click example.'))),
      h('div', { class: 'cases' }, ...cases.map(([title, blurb, ids]) => h('div', { class: 'case' },
        h('div', { class: 'case-text' }, h('h3', {}, tr(title)), h('p', {}, tr(blurb))),
        h('div', { class: 'case-tools' }, ...ids.map((id) => h('a', { class: 'pill', href: `#/${id}` }, icon(byId[id].icon, 15), tr(byId[id].name)))))))),
    h('section', { class: 'wrap section' },
      h('div', { class: 'section-head' }, h('h2', {}, tr('How it works'))),
      h('ol', { class: 'steps' }, ...steps.map(([title, text], i) => h('li', {}, h('span', { class: 'step-n', 'aria-hidden': 'true' }, String(i + 1)), h('h3', {}, tr(title)), h('p', {}, tr(text)))))),
    h('section', { class: 'wrap section' },
      h('div', { class: 'principles' }, ...principles.map(([ic, title, text]) => h('div', { class: 'principle' }, icon(ic, 20), h('h2', {}, tr(title)), h('p', {}, tr(text)))))),
    h('section', { class: 'wrap section' },
      h('div', { class: 'section-head' }, h('h2', {}, tr('Everything in one place')), h('p', {}, `${countText('tool', TOOLS.length)} · ${countText('group', CATEGORIES.length)}`)),
      h('div', { class: 'cat-list' }, ...CATEGORIES.map((c) => h('a', { class: 'cat-row', href: `#/tools?cat=${c.id}` },
        h('span', { class: 'tile' }, icon(c.icon, 18)),
        h('span', { class: 'cat-text' }, h('strong', {}, tr(c.name)), h('span', {}, tr(c.blurb))),
        h('span', { class: 'cat-count' }, countText('tool', count(c.id))),
        icon('chevron', 16, 'cat-go'))))),
    h('section', { class: 'wrap section' },
      h('div', { class: 'maker' },
        portrait(),
        h('div', { class: 'maker-text' }, h('h2', {}, tr('Made by {name}', { name: profile.name })), h('p', {}, tr(profile.headline))),
        h('a', { class: 'btn', href: '#/about' }, tr('About me')))),
    h('section', { class: 'wrap section' },
      h('div', { class: 'cta-band' },
        h('div', {}, h('h2', {}, tr('Your next small job takes seconds.')), h('p', {}, tr('Open the toolbox and try any tool with its built-in example.'))),
        h('a', { class: 'btn primary lg', href: '#/tools' }, tr('Browse all {count} tools', { count: TOOLS.length })))));
}

/* ----------------------------------------------------------- catalogue */

function renderCatalogue(params) {
  setTitle(tr('All tools'));
  let cat = params.get('cat') || '';
  if (!CATEGORIES.some((c) => c.id === cat) && cat !== 'favourites') cat = '';
  let query = '';
  const grid = h('div', { class: 'card-grid' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': tr('Filter by group') });
  const status = h('p', { class: 'muted small-text', role: 'status' });
  const input = h('input', { type: 'search', class: 'field-input', placeholder: tr('Filter tools'), 'aria-label': tr('Filter tools'), autocomplete: 'off', spellcheck: false });
  const paint = () => {
    const mine = favourites();
    if (cat === 'favourites' && !mine.length) cat = '';
    const list = searchTools(query, tr).filter((t) => !cat || (cat === 'favourites' ? mine.includes(t.id) : t.cat === cat));
    grid.replaceChildren(...list.map(toolCard));
    status.textContent = list.length ? countText('tool', list.length) : tr('No tool matches. Try fewer words.');
    chips.replaceChildren(...[{ id: '', name: tr('All') }, ...(mine.length ? [{ id: 'favourites', name: 'Favourites' }] : []), ...CATEGORIES].map((c) => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(cat === c.id), onclick: () => { cat = c.id; paint(); },
    }, c.id ? tr(c.name) : c.name)));
  };
  input.addEventListener('input', () => { query = input.value; paint(); });
  main.replaceChildren(h('div', { class: 'wrap section pt' },
    h('header', { class: 'page-head' }, h('h1', { tabindex: -1 }, tr('All tools')), h('p', {}, tr('Everything runs in your browser. Pick a tool, or search with the filter below.'))),
    h('div', { class: 'catalogue-bar' }, input, chips), status, grid));
  paint();
  favHooks.add(paint);
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
      h('div', {}, h('h1', { tabindex: -1 }, tr(meta.name)), h('p', {}, tr(meta.desc))),
      favButton(meta, { text: true })),
    body);
  favHooks.add(() => renderSidebar(id));
  try {
    const mod = await loadModule(meta.module);
    if (parseRoute().id !== id) return;
    noteRecent(id);
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
  setTitle(tr('About me'));
  const p = profile;
  const mail = { label: 'Email', icon: 'mail', href: `mailto:${p.email}` };
  const links = [...p.links, mail].map((link) => h('a', {
    class: 'btn', href: link.href, ...(link.href.startsWith('http') ? { rel: 'noopener noreferrer', target: '_blank' } : {}),
  }, icon(link.icon, 16), tr(link.label)));
  const experience = p.experience.map((item) => h('li', {},
    h('span', { class: 'when' }, tr(item.period)),
    h('div', {}, h('h3', {}, tr(item.role)), h('p', { class: 'where' }, [item.org, tr(item.place)].filter(Boolean).join(', ')), item.note ? h('p', { class: 'where note' }, tr(item.note)) : null,
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
    h('section', { class: 'about-section' }, h('h2', {}, tr('Impact at a glance')),
      h('dl', { class: 'impact' }, ...p.impact.map((stat) => h('div', {}, h('dt', {}, tr(stat.label)), h('dd', {}, stat.value))))),
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

// Umami skips tracking while localStorage holds umami.disabled, so the switch takes effect immediately.
function statsSwitch() {
  const KEY = 'umami.disabled';
  let off = false;
  try { off = !!localStorage.getItem(KEY); } catch { /* storage blocked */ }
  const status = h('p', { class: 'muted', role: 'status' }, off ? tr('Your visits are not counted.') : tr('Your visits are counted.'));
  const box = h('input', { type: 'checkbox', checked: !off });
  box.addEventListener('change', () => {
    try {
      if (box.checked) localStorage.removeItem(KEY); else localStorage.setItem(KEY, '1');
      status.textContent = box.checked ? tr('Your visits are counted.') : tr('Your visits are not counted.');
    } catch { status.textContent = tr('Your browser blocks local storage, so this choice cannot be saved.'); }
  });
  return h('div', {}, h('label', { class: 'check' }, box, h('span', {}, tr('Count my visits in the page statistics'))), status);
}

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
    h('p', {}, tr('I use Umami, a privacy-focused analytics tool that I run on my own server, to see which pages and tools are used. It counts page views and records the referring site, browser, operating system, device type and country. It sets no cookies, follows no one across other sites, and honours your browser’s Do Not Track setting. The legal basis is legitimate interest (Art. 6(1)(f) GDPR). You can object at any time with the switch below, by enabling Do Not Track, or by emailing me.')),
    statsSwitch(),
    h('h2', {}, tr('Currency converter')),
    h('p', {}, tr('Only this tool contacts another service. To show exchange rates it requests a public rate table from open.er-api.com ('), ext('https://www.exchangerate-api.com', 'Exchange Rate API'), tr('), which therefore sees your IP address and the base currency code. Your amounts are never sent.')),
    h('h2', {}, tr('Cookies and browser storage')),
    h('p', {}, tr('There are no cookies. Your light or dark theme choice and your page-statistics preference are kept in your browser’s local storage, and a service worker caches the app files so the site works offline. Both exist only to provide the features you use, so no consent banner is needed under the ePrivacy rules. You can clear them in your browser settings.')),
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

// First-visit notice with the statistics switch. It informs rather than asks: the counting sets no cookies.
const NOTICE_KEY = 'mth-stats-notice';
function renderStatsNotice() {
  $('#stats-notice')?.remove();
  try { if (localStorage.getItem(NOTICE_KEY)) return; } catch { /* storage blocked: show it each visit */ }
  const close = h('button', { class: 'btn primary', type: 'button' }, tr('Got it'));
  const box = h('section', { id: 'stats-notice', class: 'notice', 'aria-label': tr('Page statistics') },
    h('p', {}, tr('This site counts page visits with Umami, without cookies. Your files never leave your device.'), ' ', h('a', { href: '#/privacy' }, tr('Privacy'))),
    statsSwitch(),
    h('div', { class: 'notice-actions' }, close));
  close.addEventListener('click', () => {
    try { localStorage.setItem(NOTICE_KEY, '1'); } catch { /* storage blocked */ }
    box.remove();
  });
  document.body.append(box);
}

async function route() {
  closeSearch();
  const { id, params, view } = parseRoute();
  teardown?.(); teardown = null;
  favHooks.clear(); favHooks.add(paintFavButtons);
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

/* ----------------------------------------------------- command palette */

const REPO_URL = 'https://github.com/vasylm1/my-tools-hub';

function paletteGroups(q) {
  const go = (hash) => () => { location.hash = hash; };
  const toolItem = (t) => ({ name: tr(t.name), sub: catName(t.cat), ic: t.icon, run: go(`#/${t.id}`) });
  const pages = [['', 'Home', 'grid'], ['tools', 'All tools', 'layers'], ['about', 'About me', 'user'], ['privacy', 'Privacy', 'lock'], ['legal', 'Legal notice', 'info']]
    .map(([to, name, ic]) => ({ name: tr(name), ic, sub: tr('Page'), kw: name, run: go(`#/${to}`) }));
  const current = parseRoute();
  const actions = [];
  if (current.view === 'tool' && byId[current.id]) {
    const on = isFavourite(current.id);
    actions.push({ name: tr(on ? 'Remove this tool from favourites' : 'Add this tool to favourites'), ic: 'star', kw: 'favourite favorite star save', run: () => toggleFavourite(current.id) });
  }
  actions.push({ name: tr(document.documentElement.dataset.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'), ic: document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun', kw: 'theme dark light mode appearance', run: () => themeBtn.click() });
  for (const opt of localeSelect.options) {
    if (opt.value === localeSelect.value) continue;
    actions.push({ name: tr('Language: {name}', { name: opt.textContent }), ic: 'globe', kw: `language ${opt.value}`, run: () => { localeSelect.value = opt.value; localeSelect.dispatchEvent(new Event('change')); } });
  }
  if (recents().length) actions.push({ name: tr('Clear recently used tools'), ic: 'x', kw: 'history recent reset', run: clearRecents });
  actions.push({ name: tr('View the source on GitHub'), ic: 'github', kw: 'code repository open source', run: () => window.open(REPO_URL, '_blank', 'noopener') });
  if (!q) {
    return [
      { title: tr('Recently used'), items: recents().slice(0, 4).map((id) => toolItem(byId[id])) },
      { title: tr('Favourites'), items: favourites().slice(0, 6).map((id) => toolItem(byId[id])) },
      { title: tr('Pages'), items: pages },
      { title: tr('Actions'), items: actions },
    ];
  }
  const words = q.split(/\s+/);
  const match = (it) => { const hay = `${it.name} ${it.kw || ''}`.toLowerCase(); return words.every((w) => hay.includes(w)); };
  return [
    { title: tr('Tools'), items: searchTools(q, tr).slice(0, 8).map(toolItem) },
    { title: tr('Pages'), items: pages.filter(match) },
    { title: tr('Actions'), items: actions.filter(match).slice(0, 6) },
  ];
}

let palette = createPalette({ tr, getGroups: paletteGroups });

/* ------------------------------------------------------- toolbar search */

const searchInput = $('#search');
const searchList = $('#search-results');
$('#search-kbd').textContent = isMac ? 'Cmd K' : 'Ctrl K';
$('#search-icon').append(icon('search', 15));
let hits = [];
let active = -1;

function searchHits(q) {
  const pages = [['tools', 'All tools', 'layers'], ['about', 'About me', 'user'], ['privacy', 'Privacy', 'lock'], ['legal', 'Legal notice', 'info']]
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
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.toggle(); }
  else if (e.key === '/' && !typing && !document.activeElement?.isContentEditable) { e.preventDefault(); searchInput.focus(); searchInput.select(); }
  else if (e.key === 'Escape') openMenu(false);
});

route();
renderStatsNotice();

/* ------------------------------------------------------- offline cache */

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support is optional */ });
    // Warm the cache with every tool module while idle so the whole hub works offline.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
    idle(() => [...new Set(TOOLS.map((t) => t.module))].forEach((m) => loadModule(m).catch(() => {})));
  });
}

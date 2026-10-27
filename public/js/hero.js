// Animated product window for the landing page: three short, looping demos of real tools.
// Purely decorative (aria-hidden). Pauses when off-screen or when the tab is hidden, and shows a still frame
// when the visitor prefers reduced motion.
import { h } from './core/dom.js';
import { icon } from './core/icons.js';
import { encodeQr } from './lib/qr.js';

const RAW_JSON = '{"tool":"qr-code","private":true,"uploads":0,"works_offline":true}';
const QR_URL = 'https://my-tools-hub-app.netlify.app';
const SHEET = [['Anna K.', 'anna@mail.com'], ['Jan N.', 'jan@mail.com'], ['Anna K.', 'anna@mail.com'], ['', ''], ['Piotr Z.', 'piotr@mail.com']];
const BAD_ROWS = [2, 3]; // the duplicate and the empty row
const CANCELLED = Symbol('cancelled');

export function heroWindow({ tr, byId }) {
  const tok = (cls, text) => h('span', { class: cls }, text);
  const head = (tool) => h('div', { class: 'mock-head' }, h('strong', {}, tr(tool.name)), h('span', {}, tr(tool.desc)));

  /* ---- scene 1: JSON formatter ------------------------------------------------ */
  const jsonBox = h('div', { class: 'mock-code' });
  const jsonBtn = h('span', { class: 'mock-btn' }, tr('Format'));
  const jsonOk = h('span', { class: 'mock-valid' }, icon('check', 14), tr('Valid JSON.'));
  const formatted = [
    [tok('p', '{')],
    ['  ', tok('k', '"tool"'), tok('p', ': '), tok('s', '"qr-code"'), tok('p', ',')],
    ['  ', tok('k', '"private"'), tok('p', ': '), tok('b', 'true'), tok('p', ',')],
    ['  ', tok('k', '"uploads"'), tok('p', ': '), tok('n', '0'), tok('p', ',')],
    ['  ', tok('k', '"works_offline"'), tok('p', ': '), tok('b', 'true')],
    [tok('p', '}')],
  ].map((kids) => h('div', { class: 'code-line' }, ...kids));
  const jsonScene = {
    tool: 'json-formatter',
    el: h('div', { class: 'scene' }, head(byId['json-formatter']), jsonBox, h('div', { class: 'mock-row' }, jsonBtn, jsonOk)),
    final() { jsonBox.replaceChildren(...formatted.map((l) => { l.classList.add('in'); return l; })); jsonOk.classList.add('on'); jsonBtn.classList.remove('press'); },
    async play(w) {
      jsonBox.replaceChildren(); jsonOk.classList.remove('on'); jsonBtn.classList.remove('press'); formatted.forEach((l) => l.classList.remove('in'));
      const raw = h('span', { class: 'raw' }); const caret = h('i', { class: 'caret' }); jsonBox.append(raw, caret);
      for (const ch of RAW_JSON) { raw.textContent += ch; await w(16); }
      await w(450); jsonBtn.classList.add('press'); await w(260);
      jsonBox.replaceChildren(...formatted);
      for (const l of formatted) { l.classList.add('in'); await w(95); }
      jsonBtn.classList.remove('press'); await w(180); jsonOk.classList.add('on'); await w(2300);
    },
  };

  /* ---- scene 2: QR code ------------------------------------------------------- */
  const qr = encodeQr(QR_URL, 'M');
  const SCALE = 5; const QUIET = 2;
  const qrCanvas = h('canvas', { class: 'mock-qr', width: (qr.size + QUIET * 2) * SCALE, height: (qr.size + QUIET * 2) * SCALE });
  const colors = () => { const css = getComputedStyle(document.documentElement); return { fg: css.getPropertyValue('--ink').trim() || '#fff', bg: css.getPropertyValue('--bg-2').trim() || '#111' }; };
  const paintQr = (rows) => {
    const c = qrCanvas.getContext('2d'); const { fg, bg } = colors();
    c.fillStyle = bg; c.fillRect(0, 0, qrCanvas.width, qrCanvas.height); c.fillStyle = fg;
    for (let y = 0; y < rows; y++) for (let x = 0; x < qr.size; x++) if (qr.modules[y][x]) c.fillRect((x + QUIET) * SCALE, (y + QUIET) * SCALE, SCALE, SCALE);
    if (rows < qr.size) { c.fillStyle = 'rgba(76,195,138,.55)'; c.fillRect(0, (rows + QUIET) * SCALE, qrCanvas.width, 2); } // scan line
  };
  const urlText = h('span', { class: 'typed' }); const urlCaret = h('i', { class: 'caret' });
  const qrChips = h('div', { class: 'mock-chips' }, h('span', { class: 'mock-btn' }, 'PNG'), h('span', { class: 'mock-btn' }, 'SVG'));
  const qrScene = {
    tool: 'qr-code',
    el: h('div', { class: 'scene' }, head(byId['qr-code']),
      h('div', { class: 'mock-split' },
        h('div', { class: 'mock-fields' }, h('label', {}, tr('Text or URL')), h('div', { class: 'mock-input' }, urlText, urlCaret), qrChips),
        h('div', { class: 'mock-qrbox' }, qrCanvas))),
    final() { urlText.textContent = QR_URL; urlCaret.hidden = true; paintQr(qr.size); qrChips.classList.add('on'); },
    async play(w) {
      urlText.textContent = ''; urlCaret.hidden = false; qrChips.classList.remove('on'); paintQr(0);
      for (const ch of QR_URL) { urlText.textContent += ch; await w(22); }
      urlCaret.hidden = true; await w(300);
      for (let y = 1; y <= qr.size; y++) { paintQr(y); await w(30); }
      qrChips.classList.add('on'); await w(2400);
    },
  };

  /* ---- scene 3: spreadsheet cleaner ------------------------------------------ */
  const rows = SHEET.map(([a, b]) => h('div', { class: 'srow' }, h('span', {}, a || ' '), h('span', {}, b || ' ')));
  const sheetOk = h('span', { class: 'mock-valid' }, icon('check', 14), tr('Removed {n} rows', { n: BAD_ROWS.length }));
  const sheetScene = {
    tool: 'spreadsheet-cleaner',
    el: h('div', { class: 'scene' }, head(byId['spreadsheet-cleaner']),
      h('div', { class: 'sheet' }, h('div', { class: 'srow shead' }, h('span', {}, tr('Name')), h('span', {}, 'Email')), ...rows),
      h('div', { class: 'mock-row' }, sheetOk)),
    final() { rows.forEach((r, i) => { r.className = `srow in${BAD_ROWS.includes(i) ? ' gone' : ''}`; }); sheetOk.classList.add('on'); },
    async play(w) {
      rows.forEach((r) => { r.className = 'srow'; }); sheetOk.classList.remove('on');
      await w(200);
      for (const r of rows) { r.classList.add('in'); await w(110); }
      await w(700); BAD_ROWS.forEach((i) => rows[i].classList.add('bad')); await w(900);
      BAD_ROWS.forEach((i) => rows[i].classList.add('gone')); await w(550); sheetOk.classList.add('on'); await w(2400);
    },
  };

  /* ---- window chrome and playback -------------------------------------------- */
  const scenes = [jsonScene, qrScene, sheetScene];
  const picks = ['qr-code', 'json-formatter', 'spreadsheet-cleaner', 'image-resizer', 'resume-builder', 'text-diff'];
  const items = picks.map((id) => h('div', { class: 'mock-item' }, icon(byId[id].icon, 15), h('span', {}, tr(byId[id].name))));
  const dots = scenes.map(() => h('i'));
  const stage = h('div', { class: 'mock-stage' }, ...scenes.map((s) => s.el));
  const root = h('div', { class: 'mock', 'aria-hidden': 'true' },
    h('div', { class: 'mock-bar' }, h('i'), h('i'), h('i'), h('span', {}, 'My Tools Hub'), h('div', { class: 'mock-prog' }, ...dots)),
    h('div', { class: 'mock-body' }, h('div', { class: 'mock-side' }, ...items), stage));

  const show = (i) => {
    scenes.forEach((s, k) => s.el.classList.toggle('on', k === i));
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    picks.forEach((id, k) => items[k].classList.toggle('on', id === scenes[i].tool));
  };

  let token = 0;
  const wait = (ms, id) => new Promise((resolve) => setTimeout(() => resolve(id === token && root.isConnected), ms));
  async function loop(id) {
    let i = 0;
    try {
      while (id === token && root.isConnected) {
        show(i % scenes.length);
        await scenes[i % scenes.length].play(async (ms) => { if (!(await wait(ms, id))) throw CANCELLED; });
        i++;
      }
    } catch (e) { if (e !== CANCELLED) throw e; }
  }
  const still = () => { show(0); scenes[0].final(); };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  const update = () => {
    token++;
    if (reduced.matches) { still(); return; }
    if (visible && !document.hidden) loop(token);
  };
  still(); // first paint is a finished frame, so there is never an empty window
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: 0.2 }).observe(root);
  document.addEventListener('visibilitychange', () => { if (root.isConnected) update(); });
  reduced.addEventListener?.('change', () => { if (root.isConnected) update(); });
  return root;
}

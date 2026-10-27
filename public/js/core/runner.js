// Tool runner: builds the form, re-runs the tool on input and renders whatever the tool returns.
//
// A tool definition is:
//   { fields: [spec...], run(values, ctx) -> result | Promise<result>,
//     live = true,            // re-run on every change (false: only via the button)
//     runLabel = 'Generate',  // button label when live = false
//     example?: { fieldId: value } }
//
// A result may contain any of these keys (rendered in this order):
//   error: string                       red message
//   empty: string                       neutral "nothing to show yet" hint
//   notice: string | {kind, text}       info / warning line
//   stats: [[label, value], ...]        metric tiles
//   table: { head: [], rows: [[]], caption? }
//   node: Element                       a DOM node built by the tool (use textContent, never innerHTML with user data)
//   canvas: { canvas, filename, formats?, quality? }  raster preview with PNG/JPEG/WebP download + copy
//   html: { value, filename, pageWidth?, print?, title? }   sandboxed preview, source download
//   text: { value, filename, mime, label, rows } | [ ... ]  read-only text with copy/download
//   downloads: [{ name, data, mime, label? }]               file buttons (+ ZIP when several)
//   sections: [ result, ... ]           several of the above, stacked
import { h, append, debounce, download, copyText, toast, escapeHtml } from './dom.js';
import { buildField } from './form.js';
import { icon } from './icons.js';
import { canvasToBlob, EXT } from './image.js';
import { createZip } from '../lib/zip.js';
import { formatNumber, t as tr } from '../i18n.js';

export function mountTool(root, def) {
  const built = def.fields.map(buildField);
  const byId = Object.fromEntries(built.map((f) => [f.spec.id, f]));
  const live = def.live !== false;
  const out = h('div', { class: 'results', 'aria-live': 'polite' });
  const runBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => execute() }, tr(def.runLabel || 'Generate'));
  const actions = h('div', { class: 'actions' },
    !live && runBtn,
    def.example && h('button', { type: 'button', class: 'btn', onclick: () => { for (const [k, v] of Object.entries(def.example)) { byId[k]?.set(v); sync(); } execute(); } }, tr('Load example')),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => { for (const f of built) f.reset(); sync(); out.replaceChildren(); if (live) execute(); } }, tr('Reset')));
  const inputs = h('section', { class: 'panel inputs', 'aria-label': tr('Input') }, h('div', { class: 'fields' }, ...built.map((f) => f.el)), actions);
  const results = h('section', { class: 'panel output', 'aria-label': tr('Result') }, out);
  root.replaceChildren(h('div', { class: 'tool' }, inputs, results));

  const values = () => Object.fromEntries(built.map((f) => [f.spec.id, f.get()]));
  function sync() {
    // Dependent option lists first (e.g. units per category), then visibility.
    for (const f of built) {
      if (!f.spec.optionsFor) continue;
      const options = f.spec.optionsFor(values());
      const key = JSON.stringify(options);
      if (f.optionsKey !== key) { f.setOptions(options); f.optionsKey = key; }
    }
    const v = values();
    for (const f of built) if (f.spec.show) f.el.hidden = !f.spec.show(v);
  }

  let seq = 0;
  async function execute() {
    const mine = ++seq;
    sync();
    root.classList.add('busy');
    try {
      const result = await def.run(values(), { root });
      if (mine !== seq) return;
      await renderResult(out, result || {});
    } catch (e) {
      if (mine !== seq) return;
      console.error(e);
      await renderResult(out, { error: e?.message || String(e) });
    } finally {
      if (mine === seq) root.classList.remove('busy');
    }
  }

  const rerun = debounce(execute, 260);
  inputs.addEventListener('input', (e) => { sync(); if (live) (e.target.matches('select,input[type=checkbox],input[type=color],.image-field *') ? execute() : rerun()); });
  inputs.addEventListener('change', (e) => { sync(); if (live && e.target.matches('select,input[type=checkbox],input[type=color]')) execute(); });
  sync();
  if (live) execute(); else out.replaceChildren(h('p', { class: 'empty' }, tr(def.idle || 'Fill in the form and press the button.')));

  return () => { rerun.cancel(); seq++; };
}

/* ---------------------------------------------------------------- rendering */

export async function renderResult(container, result) {
  const frag = document.createDocumentFragment();
  const parts = result.sections ? result.sections : [result];
  for (const part of parts) await renderPart(frag, part);
  container.replaceChildren(frag);
}

const withIcon = (name, text) => [icon(name, 15), h('span', {}, text)];

function copyBtn(getText, label = tr('Copy')) {
  return h('button', { type: 'button', class: 'btn small', onclick: () => copyText(getText()) }, ...withIcon('copy', label));
}

function fileBtn(label, name, data, mime) {
  return h('button', { type: 'button', class: 'btn small', onclick: () => download(name, data, mime) }, ...withIcon('download', label));
}

async function renderPart(into, r) {
  if (r.error) into.append(h('div', { class: 'msg error', role: 'alert' }, icon('xcircle', 16), h('span', {}, tr(r.error, r.values))));
  if (r.empty) into.append(h('p', { class: 'empty' }, tr(r.empty, r.values)));
  if (r.notice) {
    const n = typeof r.notice === 'string' ? { kind: 'info', text: r.notice } : r.notice;
    const ic = { ok: 'checkcircle', warn: 'alert', info: 'info', error: 'xcircle' }[n.kind || 'info'] || 'info';
    into.append(h('div', { class: `msg ${n.kind || 'info'}` }, icon(ic, 16), h('span', {}, tr(n.text, n.values || r.values))));
  }
  if (r.stats) {
    into.append(h('dl', { class: 'stats' }, ...r.stats.map(([k, v]) => h('div', {}, h('dt', {}, tr(k)), h('dd', {}, String(v))))));
  }
  if (r.table) into.append(tableEl(r.table));
  if (r.node) into.append(r.node);
  if (r.canvas) into.append(await canvasBlock(r.canvas));
  if (r.html) into.append(htmlBlock(r.html));
  for (const t of [].concat(r.text || [])) into.append(textBlock(t));
  if (r.downloads?.length) into.append(downloadsBlock(r.downloads));
}

function tableEl({ head, rows, caption }) {
  const MAX = 200;
  return h('div', { class: 'table-wrap', tabindex: 0 },
    h('table', {},
      caption && h('caption', {}, caption),
      head && h('thead', {}, h('tr', {}, ...head.map((c) => h('th', { scope: 'col' }, c)))),
      h('tbody', {}, ...rows.slice(0, MAX).map((r) => h('tr', {}, ...r.map((c) => h('td', {}, c == null ? '' : String(c))))))),
    rows.length > MAX && h('p', { class: 'muted small-text' }, tr('Showing the first {shown} of {total} rows.', { shown: formatNumber(MAX), total: formatNumber(rows.length) })));
}

function textBlock(t) {
  const area = h('textarea', { readOnly: true, rows: t.rows || 10, spellcheck: false, 'aria-label': t.label ? windowText(t.label) : windowText('Output') });
  area.value = t.value;
  return h('div', { class: 'block' },
    t.label && h('div', { class: 'block-head' }, h('strong', {}, windowText(t.label))),
    area,
    h('div', { class: 'actions' }, copyBtn(() => t.value), t.filename && fileBtn(tr('Download {name}', { name: t.filename }), t.filename, t.value, t.mime || 'text/plain;charset=utf-8')));
}

function windowText(value) { return tr(value); }

async function canvasBlock({ canvas, filename = 'image', formats = ['png', 'jpeg', 'webp'], quality = 0.92 }) {
  const types = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
  const base = filename.replace(/\.[a-z0-9]+$/i, '');
  const save = async (fmt) => {
    try {
      const mime = types[fmt];
      let source = canvas;
      if (fmt === 'jpeg') { // JPEG has no alpha: flatten onto white
        source = document.createElement('canvas');
        source.width = canvas.width; source.height = canvas.height;
        const c = source.getContext('2d');
        c.fillStyle = '#fff'; c.fillRect(0, 0, source.width, source.height); c.drawImage(canvas, 0, 0);
      }
      download(`${base}.${EXT[mime]}`, await canvasToBlob(source, mime, quality), mime);
    } catch (e) { toast(e.message, 'error'); }
  };
  const copyImage = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(canvas) })]);
      toast('Image copied');
    } catch { toast('Copying images is not supported here; use Download.', 'error'); }
  };
  canvas.classList.add('preview-canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Image preview, ${canvas.width} by ${canvas.height} pixels. Use the download buttons to save it.`);
  return h('div', { class: 'block' },
    h('div', { class: 'canvas-wrap' }, canvas),
    h('p', { class: 'muted small-text' }, `${canvas.width} × ${canvas.height} px`),
    h('div', { class: 'actions' },
      ...formats.map((f) => h('button', { type: 'button', class: 'btn small', onclick: () => save(f) }, ...withIcon('download', f.toUpperCase()))),
      h('button', { type: 'button', class: 'btn small', onclick: copyImage }, ...withIcon('copy', tr('Copy image')))));
}

function htmlBlock({ value, filename = 'document.html', pageWidth, print, rich, title = 'Preview', width }) {
  const frame = h('iframe', { title: tr(title), sandbox: 'allow-same-origin', class: 'preview-frame', referrerPolicy: 'no-referrer' });
  const holder = h('div', { class: `frame-holder${pageWidth ? ' paged' : ''}` }, frame);
  const fit = () => {
    const doc = frame.contentDocument;
    if (!doc?.documentElement) return;
    const natural = pageWidth || width || holder.clientWidth;
    const scale = pageWidth ? Math.min(1, holder.clientWidth / pageWidth) : 1;
    frame.style.width = `${width || natural}px`;
    const contentH = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0);
    frame.style.height = `${pageWidth ? contentH : Math.min(Math.max(contentH, 260), 720)}px`;
    frame.style.transform = scale < 1 ? `scale(${scale})` : '';
    holder.style.height = pageWidth ? `${contentH * scale}px` : '';
  };
  frame.addEventListener('load', fit);
  frame.srcdoc = value;
  const ro = new ResizeObserver(() => fit());
  ro.observe(holder);
  return h('div', { class: 'block' }, holder,
    h('div', { class: 'actions' },
      print && h('button', { type: 'button', class: 'btn small primary', onclick: () => { frame.contentWindow.focus(); frame.contentWindow.print(); } }, ...withIcon('printer', tr('Print / Save as PDF'))),
      rich && h('button', {
        type: 'button', class: 'btn small primary', onclick: async () => {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([rich === true ? value : rich], { type: 'text/html' }), 'text/plain': new Blob([value], { type: 'text/plain' }) })]);
            toast('Copied. Paste it into your email settings.');
          } catch { toast('Rich copy is not available here. Use Copy HTML instead.', 'error'); }
        },
      }, ...withIcon('copy', tr('Copy formatted'))),
      copyBtn(() => value, tr('Copy HTML')),
      fileBtn(tr('Download {name}', { name: filename }), filename, value, 'text/html;charset=utf-8')));
}

function downloadsBlock(files) {
  const toBlob = (f) => (f.data instanceof Blob ? f.data : new Blob([f.data], { type: f.mime || 'application/octet-stream' }));
  const buttons = files.map((f) => h('button', { type: 'button', class: 'btn small', onclick: () => download(f.name, toBlob(f), f.mime) }, ...withIcon('download', f.label ? tr(f.label) : f.name)));
  const zipBtn = files.length > 1 && h('button', {
    type: 'button', class: 'btn small primary', onclick: async () => {
      const entries = [];
      for (const f of files) entries.push({ name: f.name, data: new Uint8Array(await toBlob(f).arrayBuffer()) });
      download('files.zip', createZip(entries), 'application/zip');
    },
  }, ...withIcon('download', tr('All {count} files (ZIP)', { count: formatNumber(files.length) })));
  return h('div', { class: 'block' }, h('div', { class: 'actions wrap' }, zipBtn, ...buttons));
}

export { append, escapeHtml };

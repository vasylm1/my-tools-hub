// Declarative form fields. `buildField(spec)` -> { el, get(), set(v), spec }.
//
// spec.type: text | textarea | number | range | select | checkbox | color | date | datetime-local |
//            image | images | textfile | file | email | url
// Common: id, label, value, hint, placeholder, half (two-per-row), show(values) -> bool
import { h, formatBytes, toast } from './dom.js';
import { icon } from './icons.js';
import { loadImageFile } from './image.js';
import { parseCSV, toCSV } from '../lib/csv.js';

const optionList = (options) => options.map((o) => (Array.isArray(o) ? o : [o, o]));

function fillSelect(select, options) {
  for (const o of options) {
    if (o && o.group) {
      select.append(h('optgroup', { label: o.group }, ...optionList(o.options).map(([v, l]) => h('option', { value: v }, l))));
    } else {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      select.append(h('option', { value: v }, l));
    }
  }
}

function dropzone({ multiple, accept, onFiles, label }) {
  const input = h('input', { type: 'file', accept, multiple, class: 'sr-only', tabindex: -1 });
  const zone = h('div', { class: 'dropzone', tabindex: 0, role: 'button', 'aria-label': label },
    h('span', { class: 'dz-icon', 'aria-hidden': 'true' }, icon('upload', 20)),
    h('span', { class: 'dz-text' }, label),
    input);
  const open = () => input.click();
  zone.addEventListener('click', (e) => { if (e.target !== input) open(); });
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('over'); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); });
  zone.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); onFiles(files); }
  });
  input.addEventListener('change', () => { if (input.files.length) onFiles([...input.files]); input.value = ''; });
  return zone;
}

export function buildField(spec) {
  const type = spec.type || 'text';
  const id = `f-${spec.id}`;
  let control;
  let get;
  let set;
  let extra = null;
  let setOptions = null;
  const emit = (target) => target.dispatchEvent(new Event('input', { bubbles: true }));

  switch (type) {
    case 'textarea':
      control = h('textarea', { id, rows: spec.rows || 8, placeholder: spec.placeholder || '', spellcheck: spec.spellcheck ?? false });
      control.value = spec.value ?? '';
      get = () => control.value;
      set = (v) => { control.value = v ?? ''; };
      break;
    case 'number':
      control = h('input', { id, type: 'number', min: spec.min, max: spec.max, step: spec.step ?? 'any', placeholder: spec.placeholder || '' });
      control.value = spec.value ?? '';
      get = () => (control.value === '' || !Number.isFinite(control.valueAsNumber) ? null : control.valueAsNumber);
      set = (v) => { control.value = v ?? ''; };
      break;
    case 'range': {
      control = h('input', { id, type: 'range', min: spec.min ?? 0, max: spec.max ?? 100, step: spec.step ?? 1 });
      control.value = spec.value ?? spec.min ?? 0;
      const out = h('output', { class: 'range-out', for: id }, `${control.value}${spec.unit || ''}`);
      control.addEventListener('input', () => { out.textContent = `${control.value}${spec.unit || ''}`; });
      extra = out;
      get = () => Number(control.value);
      set = (v) => { control.value = v; out.textContent = `${v}${spec.unit || ''}`; };
      break;
    }
    case 'select':
      control = h('select', { id });
      fillSelect(control, spec.options || []);
      if (spec.value != null) control.value = spec.value;
      get = () => control.value;
      set = (v) => { control.value = v; };
      setOptions = (options, keep = true) => {
        const prev = control.value;
        control.replaceChildren();
        fillSelect(control, options);
        if (keep && [...control.options].some((o) => o.value === prev)) control.value = prev;
      };
      break;
    case 'checkbox':
      control = h('input', { id, type: 'checkbox', checked: !!spec.value });
      get = () => control.checked;
      set = (v) => { control.checked = !!v; };
      break;
    case 'color':
      control = h('input', { id, type: 'color' });
      control.value = spec.value || '#0f766e';
      get = () => control.value;
      set = (v) => { control.value = v; };
      break;
    case 'image':
    case 'images': {
      const multiple = type === 'images';
      let items = [];
      const list = h('ul', { class: 'file-list' });
      const status = h('div', { class: 'dz-status', role: 'status' });
      const render = () => {
        list.replaceChildren(...items.map((it, i) => h('li', {},
          h('img', { src: it.thumb, alt: '', width: 36, height: 36 }),
          h('span', { class: 'fl-name' }, it.name),
          h('span', { class: 'fl-size muted' }, `${it.width}×${it.height}`),
          multiple && h('button', { type: 'button', class: 'mini', 'aria-label': `Move ${it.name} up`, disabled: i === 0, onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; render(); emit(root); } }, icon('arrowup', 14)),
          h('button', { type: 'button', class: 'mini', 'aria-label': `Remove ${it.name}`, onclick: () => { items.splice(i, 1); render(); emit(root); } }, icon('x', 14)))));
      };
      const root = h('div', { class: 'image-field', id });
      const zone = dropzone({
        multiple,
        accept: 'image/*',
        label: multiple ? 'Drop images here, paste, or click to choose' : 'Drop an image here, paste, or click to choose',
        onFiles: async (files) => {
          status.textContent = 'Loading…';
          const loaded = [];
          for (const f of files) {
            try {
              const it = await loadImageFile(f);
              it.thumb = it.img.src;
              loaded.push(it);
            } catch (e) { toast(e.message, 'error'); }
          }
          status.textContent = '';
          if (!loaded.length) return;
          items = multiple ? [...items, ...loaded] : [loaded[0]];
          render();
          emit(root);
        },
      });
      root.append(zone, status, list);
      control = root;
      get = () => (multiple ? items : items[0] || null);
      set = () => { items = []; render(); };
      break;
    }
    case 'file': {
      const input = h('input', { id, type: 'file', accept: spec.accept || '' });
      control = input;
      get = () => input.files[0] || null;
      set = () => { input.value = ''; };
      break;
    }
    case 'textfile': {
      const area = h('textarea', { id, rows: spec.rows || 8, placeholder: spec.placeholder || '', spellcheck: false });
      area.value = spec.value ?? '';
      const input = h('input', { type: 'file', accept: spec.accept || '.csv,.tsv,.txt,.xlsx', class: 'sr-only', tabindex: -1 });
      const btn = h('button', { type: 'button', class: 'btn small', onclick: () => input.click() }, icon('folderopen', 15), h('span', {}, 'Open file'));
      const note = h('span', { class: 'muted small-text' });
      input.addEventListener('change', async () => {
        const file = input.files[0];
        input.value = '';
        if (!file) return;
        if (file.size > 25 * 1024 * 1024) { toast('That file is larger than 25 MB.', 'error'); return; }
        try {
          if (/\.xlsx$/i.test(file.name)) {
            const { readXlsx } = await import('../lib/xlsx.js');
            const { sheetName, rows } = await readXlsx(await file.arrayBuffer());
            area.value = toCSV(rows);
            note.textContent = `${file.name} · sheet “${sheetName}” · ${rows.length} rows`;
          } else if (/\.xls$/i.test(file.name)) {
            throw new Error('Old .xls files are not supported. Save the sheet as .xlsx or .csv first.');
          } else {
            area.value = await file.text();
            note.textContent = `${file.name} · ${formatBytes(file.size)}`;
          }
          emit(area);
        } catch (e) { toast(e.message, 'error'); }
      });
      control = h('div', { class: 'textfile' }, area, h('div', { class: 'tf-bar' }, btn, note, input));
      get = () => area.value;
      set = (v) => { area.value = v ?? ''; note.textContent = ''; };
      break;
    }
    default:
      control = h('input', { id, type, placeholder: spec.placeholder || '', autocomplete: 'off', spellcheck: false, maxLength: spec.maxLength });
      control.value = spec.value ?? '';
      get = () => control.value;
      set = (v) => { control.value = v ?? ''; };
  }

  const isCheck = type === 'checkbox';
  const label = spec.label && (isCheck
    ? h('label', { class: 'check', for: id }, control, h('span', {}, spec.label))
    : h('label', { class: 'label', for: type === 'textfile' ? id : id }, spec.label));
  const el = h('div', { class: `field${spec.half ? ' half' : ''}${isCheck ? ' is-check' : ''}`, dataset: { id: spec.id } },
    label,
    !isCheck && (extra ? h('div', { class: 'range-wrap' }, control, extra) : control),
    spec.hint && h('p', { class: 'hint' }, spec.hint));
  const initial = get();
  return { el, get, set, setOptions, reset: () => set(initial), spec };
}

/** Parse the contents of a `textfile` field into { head, body } (first row is the header). */
export function readTable(text) {
  const rows = parseCSV(text).filter((r) => r.some((c) => c !== ''));
  if (!rows.length) return { head: [], body: [] };
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r) => Array.from({ length: width }, (_, i) => r[i] ?? '');
  const [head, ...body] = rows.map(pad);
  return { head: head.map((c, i) => c.trim() || `Column ${i + 1}`), body };
}

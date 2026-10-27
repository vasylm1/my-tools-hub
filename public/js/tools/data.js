// Spreadsheet & data tools. All of them work on CSV text; .xlsx files are converted when opened.
import { h } from '../core/dom.js';
import { readTable } from '../core/form.js';
import { makeCanvas, ctx2d, FONT } from '../core/image.js';
import { toCSV } from '../lib/csv.js';
import { buildXlsx } from '../lib/xlsx.js';
import { buildIcs } from '../lib/ics.js';
import { LOCALES, FIELDS, generateRows } from '../lib/fake.js';

const SAMPLE_PEOPLE = 'Name,Email,Phone,City\nAnna Kowalska,anna.k@example.com,+48 600 123 456,Warszawa\n  Jan Nowak ,JAN@example.com,500-222-333,Kraków\nAnna Kowalska,anna.k@example.com,+48 600 123 456,Warszawa\n,,,\nPiotr Zieliński,not-an-email,22 555 66 77,Gdańsk\n';

const columnOptions = (key = 'data') => (v) => {
  const { head } = readTable(v[key] || '');
  return head.length ? head.map((c, i) => [String(i), c]) : [['0', '(no data yet)']];
};

const snake = (name) => String(name).trim().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase() || 'column';

function preview(head, body, caption) {
  return { head, rows: body, caption };
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const dataField = (extra = {}) => ({ id: 'data', type: 'textfile', label: 'Data (CSV, or open a CSV / .xlsx file)', rows: 8, placeholder: 'Name,Email\nAnna,anna@example.com', ...extra });

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/* ---------------------------------------------------------------- charts */

const PALETTE = ['#0f766e', '#e4572e', '#4361ee', '#f2a900', '#8e44ad', '#2a9d8f', '#d1495b', '#3d5a80', '#6a994e', '#bc6c25'];
const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};
const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function drawChart({ type, title, labels, values, color, seriesName }) {
  const W = 1000;
  const H = 620;
  const canvas = makeCanvas(W, H);
  const c = ctx2d(canvas);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#1d2327';
  c.font = `700 28px ${FONT}`;
  c.textAlign = 'center';
  c.fillText(title || seriesName || 'Chart', W / 2, 44);
  const fmt = (n) => new Intl.NumberFormat('en', { maximumFractionDigits: 2, notation: Math.abs(n) >= 1e6 ? 'compact' : 'standard' }).format(n);
  if (type === 'pie') {
    const total = values.reduce((a, b) => a + Math.max(0, b), 0);
    if (!total) throw new Error('Pie charts need at least one positive value.');
    const cx = 330;
    const cy = 340;
    const r = 220;
    let a0 = -Math.PI / 2;
    values.forEach((v, i) => {
      const a1 = a0 + (Math.max(0, v) / total) * Math.PI * 2;
      c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, a0, a1); c.closePath();
      c.fillStyle = PALETTE[i % PALETTE.length]; c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      a0 = a1;
    });
    c.textAlign = 'left';
    c.font = `20px ${FONT}`;
    labels.slice(0, 14).forEach((l, i) => {
      const y = 110 + i * 34;
      c.fillStyle = PALETTE[i % PALETTE.length]; c.fillRect(620, y - 16, 20, 20);
      c.fillStyle = '#1d2327';
      c.fillText(`${short(l, 22)}  ·  ${fmt(values[i])} (${Math.round((Math.max(0, values[i]) / total) * 100)}%)`, 652, y);
    });
    return canvas;
  }
  const left = 90;
  const right = W - 30;
  const top = 80;
  const bottom = H - 130;
  const min = Math.min(0, ...values);
  const max = niceMax(Math.max(0, ...values));
  const span = max - min || 1;
  const yOf = (v) => bottom - ((v - min) / span) * (bottom - top);
  c.font = `16px ${FONT}`;
  c.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const v = min + (span * i) / 5;
    const y = yOf(v);
    c.strokeStyle = '#e5e1d8'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(left, y); c.lineTo(right, y); c.stroke();
    c.fillStyle = '#5a6168'; c.fillText(fmt(v), left - 10, y + 5);
  }
  const step = (right - left) / values.length;
  const every = Math.ceil(values.length / 24);
  const xs = values.map((_, i) => left + step * (i + 0.5));
  if (type === 'bar') {
    c.fillStyle = color;
    values.forEach((v, i) => {
      const bw = Math.min(70, step * 0.7);
      const y0 = yOf(0);
      const y1 = yOf(v);
      c.fillRect(xs[i] - bw / 2, Math.min(y0, y1), bw, Math.abs(y0 - y1));
    });
  } else {
    c.strokeStyle = color; c.lineWidth = 3; c.lineJoin = 'round';
    c.beginPath();
    values.forEach((v, i) => (i ? c.lineTo(xs[i], yOf(v)) : c.moveTo(xs[i], yOf(v))));
    c.stroke();
    c.fillStyle = color;
    values.forEach((v, i) => { c.beginPath(); c.arc(xs[i], yOf(v), 4.5, 0, Math.PI * 2); c.fill(); });
  }
  c.fillStyle = '#5a6168'; c.textAlign = 'right'; c.font = `15px ${FONT}`;
  labels.forEach((l, i) => {
    if (i % every) return;
    c.save(); c.translate(xs[i], bottom + 18); c.rotate(-Math.PI / 4); c.fillText(short(l, 18), 0, 0); c.restore();
  });
  c.strokeStyle = '#1d2327'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(left, top - 6); c.lineTo(left, bottom); c.lineTo(right, bottom); c.stroke();
  return canvas;
}

/* ----------------------------------------------------------------- tools */

export const tools = {
  'spreadsheet-cleaner': {
    live: false,
    runLabel: 'Clean',
    fields: [
      dataField({ id: 'data', rows: 10 }),
      { id: 'trim', type: 'checkbox', label: 'Trim whitespace in cells', value: true },
      { id: 'empty', type: 'checkbox', label: 'Remove empty rows and columns', value: true },
      { id: 'dedupe', type: 'checkbox', label: 'Remove duplicate rows', value: true },
      { id: 'headers', type: 'checkbox', label: 'Standardise headers (snake_case)' },
    ],
    example: { data: SAMPLE_PEOPLE },
    run({ data, trim, empty, dedupe, headers }) {
      const t = readTable(data);
      if (!t.head.length) return { empty: 'Add some CSV data first.' };
      let { head } = t;
      let rows = t.body.map((r) => (trim ? r.map((c) => c.trim()) : r.slice()));
      if (trim) head = head.map((c) => c.trim());
      if (empty) {
        rows = rows.filter((r) => r.some((c) => c !== ''));
        const keep = head.map((_, i) => rows.some((r) => r[i] !== ''));
        head = head.filter((_, i) => keep[i]);
        rows = rows.map((r) => r.filter((_, i) => keep[i]));
      }
      if (dedupe) {
        const seen = new Set();
        rows = rows.filter((r) => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; });
      }
      if (headers) head = head.map(snake);
      const csv = toCSV([head, ...rows]);
      return {
        stats: [['Rows before', t.body.length], ['Rows after', rows.length], ['Removed', t.body.length - rows.length], ['Columns', head.length]],
        table: preview(head, rows, 'Cleaned data'),
        downloads: [
          { name: 'cleaned.csv', data: csv, mime: 'text/csv;charset=utf-8', label: 'cleaned.csv' },
          { name: 'cleaned.xlsx', data: buildXlsx([head, ...rows], 'Cleaned'), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'cleaned.xlsx' },
        ],
      };
    },
  },

  'email-list-validator': {
    live: false,
    runLabel: 'Validate',
    fields: [
      dataField(),
      { id: 'col', type: 'select', label: 'Column with email addresses', options: [['0', '(no data yet)']], optionsFor: columnOptions() },
    ],
    example: { data: SAMPLE_PEOPLE, col: '1' },
    run({ data, col }) {
      const t = readTable(data);
      if (!t.head.length) return { empty: 'Add some CSV data first.' };
      const i = Number(col) || 0;
      const emails = t.body.map((r) => r[i].trim().toLowerCase()).filter(Boolean);
      const valid = emails.filter((e) => EMAIL_RE.test(e));
      const invalid = emails.filter((e) => !EMAIL_RE.test(e));
      const unique = [...new Set(valid)];
      const domains = new Map();
      for (const e of unique) { const d = e.split('@')[1]; domains.set(d, (domains.get(d) || 0) + 1); }
      return {
        stats: [['Valid (unique)', unique.length], ['Invalid', invalid.length], ['Duplicates', valid.length - unique.length], ['Checked', emails.length]],
        table: domains.size ? { caption: 'Top domains', head: ['Domain', 'Addresses'], rows: [...domains].sort((a, b) => b[1] - a[1]).slice(0, 8) } : null,
        text: invalid.length ? { label: 'Invalid entries', value: invalid.join('\n'), rows: 5 } : null,
        downloads: [{ name: 'valid_emails.csv', data: toCSV([[t.head[i]], ...unique.map((e) => [e])]), mime: 'text/csv;charset=utf-8' }],
        notice: 'Checks the address format only. It does not confirm that a mailbox exists.',
      };
    },
  },

  'data-anonymizer': {
    live: false,
    runLabel: 'Anonymise',
    fields: [
      dataField(),
      { id: 'emails', type: 'checkbox', label: 'Mask email addresses (a***@domain)', value: true },
      { id: 'phones', type: 'checkbox', label: 'Mask phone numbers (keep last 2 digits)', value: true },
      { id: 'col', type: 'select', label: 'Replace a column with a hash (e.g. names)', options: [['-1', '— none —']], optionsFor: (v) => [['-1', '— none —'], ...columnOptions()(v)] },
      { id: 'salt', type: 'text', label: 'Salt for hashing (optional)', placeholder: 'Same salt → same hash', show: (v) => v.col !== '-1' },
    ],
    example: { data: SAMPLE_PEOPLE, col: '0' },
    async run({ data, emails, phones, col, salt }) {
      const t = readTable(data);
      if (!t.head.length) return { empty: 'Add some CSV data first.' };
      if (!emails && !phones && col === '-1') return { error: 'Choose at least one option.' };
      const maskEmail = (s) => s.replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+)/g, '$1***$2');
      const maskPhone = (s) => s.replace(/(\+?\d[\d\s().-]{6,}\d)/g, (m) => {
        const d = m.replace(/\D/g, '');
        return '*'.repeat(Math.max(0, d.length - 2)) + d.slice(-2);
      });
      const hashIdx = Number(col);
      const rows = [];
      for (const r of t.body) {
        const out = r.map((cell) => {
          let v = cell;
          if (emails) v = maskEmail(v);
          if (phones) v = maskPhone(v);
          return v;
        });
        if (hashIdx >= 0 && r[hashIdx] !== '') out[hashIdx] = (await sha256Hex(`${salt || ''}${r[hashIdx]}`)).slice(0, 12);
        rows.push(out);
      }
      return {
        table: preview(t.head, rows, 'Anonymised data'),
        downloads: [{ name: 'anonymized.csv', data: toCSV([t.head, ...rows]), mime: 'text/csv;charset=utf-8' }],
        notice: 'Masking and hashing reduce exposure but are not a guarantee of anonymity: free-text columns and rare value combinations can still identify people.',
      };
    },
  },

  'fake-data-generator': (() => {
    const fieldChecks = Object.entries(FIELDS).map(([id, label]) => ({ id: `f_${id}`, type: 'checkbox', label, half: true, value: ['name', 'email', 'company'].includes(id) }));
    return {
      live: false,
      runLabel: 'Generate',
      fields: [
        { id: 'locale', type: 'select', label: 'Locale', options: Object.entries(LOCALES).map(([k, v]) => [k, v.label]) },
        { id: 'rows', type: 'range', label: 'Rows', min: 5, max: 500, value: 50 },
        ...fieldChecks,
      ],
      run(v) {
        const ids = Object.keys(FIELDS).filter((id) => v[`f_${id}`]);
        if (!ids.length) return { error: 'Pick at least one field.' };
        const rows = generateRows(v.locale, ids, v.rows);
        const head = ids.map((id) => FIELDS[id]);
        return {
          table: preview(head, rows, `${rows.length} generated rows`),
          downloads: [{ name: 'sample_data.csv', data: toCSV([head, ...rows]), mime: 'text/csv;charset=utf-8' }],
          notice: 'All values are random and fictional. Email addresses use reserved example domains.',
        };
      },
    };
  })(),

  'chart-maker': {
    fields: [
      dataField({ rows: 8 }),
      { id: 'type', type: 'select', label: 'Chart type', half: true, options: [['bar', 'Bar'], ['line', 'Line'], ['pie', 'Pie']] },
      { id: 'color', type: 'color', label: 'Colour', value: '#0f766e', half: true, show: (v) => v.type !== 'pie' },
      { id: 'labels', type: 'select', label: 'Label column', half: true, options: [['0', '(no data yet)']], optionsFor: columnOptions() },
      { id: 'vals', type: 'select', label: 'Value column', half: true, options: [['1', '(no data yet)']], optionsFor: columnOptions(), value: '1' },
      { id: 'title', type: 'text', label: 'Chart title', placeholder: 'Optional' },
    ],
    example: { data: 'Month,Revenue\nJan,12000\nFeb,15500\nMar,14200\nApr,18900\nMay,21300\nJun,19800', labels: '0', vals: '1', title: 'Revenue, first half' },
    run({ data, type, color, labels, vals, title }) {
      const t = readTable(data);
      if (!t.body.length) return { empty: 'Add a table with a label column and a number column.' };
      const li = Number(labels);
      const vi = Number(vals);
      const parse = (s) => Number(String(s).replace(/\s/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
      const points = t.body.map((r) => [r[li], parse(r[vi])]).filter(([, v]) => Number.isFinite(v));
      if (!points.length) return { error: `The column “${t.head[vi]}” has no numbers. Pick another value column.` };
      if (points.length > 200) return { error: 'Charts support up to 200 rows. Aggregate your data first.' };
      const canvas = drawChart({ type, title, color, seriesName: t.head[vi], labels: points.map((p) => p[0]), values: points.map((p) => p[1]) });
      const skipped = t.body.length - points.length;
      return { canvas: { canvas, filename: 'chart', formats: ['png', 'jpeg', 'webp'] }, notice: skipped ? `${skipped} row(s) without a numeric value were skipped.` : null };
    },
  },

  'excel-to-calendar': {
    fields: [
      dataField({ label: 'Events (CSV, or open a CSV / .xlsx file)', rows: 9, placeholder: 'Start,End,Title,Description,Location' }),
    ],
    example: { data: 'Start,End,Title,Description,Location\n2026-11-03 09:00,2026-11-03 10:00,Team meeting,Weekly sync,Room A\n2026-11-05 14:00,2026-11-05 15:30,Client call,Project discussion,Zoom\n2026-11-10,2026-11-12,Training,Three-day workshop,Warsaw\n' },
    run({ data }) {
      const t = readTable(data);
      const template = [
        { name: 'calendar_template.csv', data: toCSV([['Start', 'End', 'Title', 'Description', 'Location'], ['2026-11-03 09:00', '2026-11-03 10:00', 'Team meeting', 'Weekly sync', 'Room A'], ['2026-11-10', '2026-11-12', 'Training', 'All-day event', 'Warsaw']]), mime: 'text/csv;charset=utf-8', label: 'Template (CSV)' },
      ];
      const intro = h('div', { class: 'msg info' }, 'Columns, in order: Start, End, Title, Description, Location. The first row is a header. Dates like 2026-11-03 09:00, 03.11.2026 09:00 or Excel date cells all work. Date-only rows become all-day events.');
      if (!t.body.length) return { node: intro, downloads: template };
      const { ics, count, skipped } = buildIcs(t.body);
      if (!count) return { error: 'No row had a readable start date.', node: intro, downloads: template };
      return {
        stats: [['Events', count], ['Skipped', skipped.length]],
        notice: skipped.length ? { kind: 'warn', text: `Skipped rows: ${skipped.map((s) => `${s.row} (${s.reason})`).join('; ')}` } : null,
        table: preview(t.head, t.body.slice(0, 50), 'Source rows'),
        downloads: [{ name: 'calendar.ics', data: ics, mime: 'text/calendar;charset=utf-8', label: 'calendar.ics' }, ...template],
      };
    },
  },
};

// Developer & utility tools.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { validateJson, JsonError, sortKeysDeep, jsonToRows } from '../lib/json.js';
import { toCSV } from '../lib/csv.js';
import { checkFlow } from '../lib/pa.js';
import { formatSql } from '../lib/sql.js';
import { UNITS, convert, fmtNumber } from '../lib/units.js';
import { daysBetween, ymd, workdaysBetween, addDays, zonedToInstant, formatInZone, COMMON_ZONES, allZones } from '../lib/datetime.js';

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Source listing with one highlighted line and a few lines of context. */
function sourceView(raw, line, column) {
  const lines = raw.split('\n');
  const from = Math.max(0, line - 4);
  const to = Math.min(lines.length, line + 3);
  const box = h('div', { class: 'diff', role: 'region', 'aria-label': 'Source around the error', tabindex: 0 });
  for (let n = from; n < to; n++) {
    const text = lines[n].length > 240 ? `${lines[n].slice(0, 240)}…` : lines[n];
    box.append(h('div', { class: n + 1 === line ? 'del' : '' }, h('span', { class: 'ln' }, String(n + 1)), ' ', text || ' '));
    if (n + 1 === line && column) box.append(h('div', { class: 'muted' }, h('span', { class: 'ln' }, ''), ' ', `${' '.repeat(Math.min(column - 1, 240))}^`));
  }
  return box;
}

export const tools = {
  'json-formatter': {
    fields: [
      { id: 'json', type: 'textfile', label: 'JSON', rows: 14, accept: '.json,.txt', placeholder: '{"hello":"world"}' },
      { id: 'mode', type: 'select', label: 'Action', half: true, options: [['format', 'Format (pretty-print)'], ['minify', 'Minify'], ['validate', 'Validate only'], ['csv', 'Array of objects → CSV']] },
      { id: 'indent', type: 'select', label: 'Indent', half: true, options: [['2', '2 spaces'], ['4', '4 spaces'], ['tab', 'Tab']], show: (v) => v.mode === 'format' },
      { id: 'sort', type: 'checkbox', label: 'Sort keys alphabetically', show: (v) => v.mode === 'format' || v.mode === 'minify' },
    ],
    example: { json: '{"name":"Ada","skills":["math","code"],"address":{"city":"London","zip":"N1"},"active":true}' },
    run({ json, mode, indent, sort }) {
      if (!json.trim()) return { empty: 'Paste JSON to format, minify or validate it.' };
      let parsed;
      try {
        parsed = validateJson(json);
      } catch (e) {
        if (!(e instanceof JsonError)) throw e;
        return { error: `Invalid JSON: ${e.message} (line ${e.line}, column ${e.column})`, node: sourceView(json, e.line, e.column) };
      }
      let value = parsed.value;
      const warn = parsed.duplicates.length ? { notice: { kind: 'warn', text: `Duplicate keys found: ${parsed.duplicates.join(', ')}. Only the last value of each is kept.` } } : {};
      if (mode === 'validate') return { notice: { kind: 'ok', text: 'Valid JSON.' }, ...warn };
      if (mode === 'csv') {
        const csv = toCSV(jsonToRows(value));
        return { ...warn, text: { label: 'CSV', value: csv, filename: 'data.csv', mime: 'text/csv;charset=utf-8', rows: 14 } };
      }
      if (sort) value = sortKeysDeep(value);
      const out = mode === 'minify' ? JSON.stringify(value) : JSON.stringify(value, null, indent === 'tab' ? '\t' : Number(indent));
      return { ...warn, text: { label: mode === 'minify' ? 'Minified JSON' : 'Formatted JSON', value: out, filename: 'data.json', mime: 'application/json', rows: 14 } };
    },
  },

  'power-automate-checker': {
    fields: [{ id: 'json', type: 'textfile', label: 'Flow definition (JSON)', rows: 14, accept: '.json,.txt', placeholder: '{"properties":{"definition":{"triggers":{},"actions":{}}}}' }],
    example: {
      json: JSON.stringify({
        properties: {
          definition: {
            triggers: { manual: { type: 'Request', kind: 'Button' } },
            actions: {
              Compose: { type: 'Compose', inputs: "@{concat('Hello ', triggerBody()?['name'])}", runAfter: {} },
              Send: { type: 'Http', inputs: { uri: 'https://example.com' }, runAfter: { Compose: ['Succeeded'], Missing: ['Failed'] } },
              Broken: { type: 'Compose', inputs: "@{concat('a', 'b'}", runAfter: { Send: ['Skipped'] } },
            },
          },
        },
      }, null, 2),
    },
    run({ json }) {
      if (!json.trim()) return { empty: 'Paste a Power Automate / Logic Apps flow definition to check it.' };
      const { value, findings, errorLine } = checkFlow(json);
      const errors = findings.filter((f) => f.level === 'error');
      const warnings = findings.filter((f) => f.level === 'warning');
      const list = h('div', { class: 'results' }, ...findings.map((f) => h('div', { class: `finding ${f.level}` },
        icon(f.level === 'error' ? 'xcircle' : 'alert', 16), h('span', {}, f.message),
        h('code', {}, f.line ? `${f.path} · line ${f.line}, column ${f.column}` : f.path))));
      const res = {
        stats: [['Errors', errors.length], ['Warnings', warnings.length]],
        notice: errors.length ? { kind: 'warn', text: 'The definition has problems.' } : warnings.length ? { kind: 'warn', text: 'Valid, with warnings.' } : { kind: 'ok', text: 'The definition looks valid.' },
      };
      if (findings.length) res.node = list;
      if (errorLine) return { sections: [res, { node: sourceView(json, errorLine, findings[0].column) }] };
      if (value !== null) return { sections: [res, { text: { label: 'Formatted JSON', value: JSON.stringify(value, null, 2), filename: 'power-automate-flow.json', mime: 'application/json', rows: 12 } }] };
      return res;
    },
  },

  'sql-formatter': {
    fields: [
      { id: 'sql', type: 'textfile', label: 'SQL', rows: 12, accept: '.sql,.txt', placeholder: 'select * from users where id = 1' },
      { id: 'upper', type: 'checkbox', label: 'Uppercase keywords', value: true, half: true },
      { id: 'indent', type: 'select', label: 'Indent', half: true, options: [['2', '2 spaces'], ['4', '4 spaces'], ['tab', 'Tab']] },
    ],
    example: { sql: "select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id and o.status = 'paid' where u.created_at > '2024-01-01' group by u.id, u.name having count(o.id) > 2 order by orders desc limit 20" },
    run({ sql, upper, indent }) {
      if (!sql.trim()) return { empty: 'Paste a SQL query to format it.' };
      const unit = indent === 'tab' ? '\t' : ' '.repeat(Number(indent));
      return { text: { label: 'Formatted SQL', value: formatSql(sql, { indent: unit, uppercase: upper }), filename: 'query.sql', mime: 'text/plain;charset=utf-8', rows: 16 } };
    },
  },

  'html-viewer': {
    fields: [
      { id: 'html', type: 'textfile', label: 'HTML', rows: 12, accept: '.html,.htm,.txt', placeholder: '<h1>Hello</h1>' },
      { id: 'width', type: 'select', label: 'Preview width', options: [['', 'Fit to panel'], ['375', 'Phone · 375 px'], ['768', 'Tablet · 768 px'], ['1280', 'Desktop · 1280 px']] },
    ],
    example: { html: '<!doctype html><html><body style="font-family:sans-serif;padding:1rem"><h1>Hello</h1><p>This is a <b>sandboxed</b> preview.</p><script>alert("never runs")</script></body></html>' },
    run({ html, width }) {
      if (!html.trim()) return { empty: 'Paste or open some HTML to preview it.' };
      return {
        html: { value: html, filename: 'page.html', title: 'HTML preview', width: width ? Number(width) : undefined },
        notice: 'The preview is sandboxed: scripts, forms and external resources are blocked, so it is safe to inspect untrusted HTML.',
      };
    },
  },

  'unit-converter': {
    fields: [
      { id: 'cat', type: 'select', label: 'Category', options: Object.entries(UNITS).map(([k, v]) => [k, v.label]) },
      { id: 'value', type: 'number', label: 'Value', value: 1 },
      { id: 'from', type: 'select', label: 'From', half: true, options: Object.keys(UNITS.length.units), optionsFor: (v) => Object.keys(UNITS[v.cat || 'length'].units) },
      { id: 'to', type: 'select', label: 'To', half: true, options: Object.keys(UNITS.length.units), optionsFor: (v) => Object.keys(UNITS[v.cat || 'length'].units), value: 'km' },
    ],
    example: { cat: 'length', value: 26.2, from: 'mi', to: 'km' },
    run({ cat, value, from, to }) {
      if (value == null) return { empty: 'Enter a value to convert.' };
      const result = convert(cat, value, from, to);
      const others = Object.keys(UNITS[cat].units).filter((u) => u !== from).map((u) => [u, fmtNumber(convert(cat, value, from, u))]);
      return {
        stats: [['Result', `${fmtNumber(result)} ${to}`]],
        table: { caption: `${fmtNumber(value)} ${from} in other units`, head: ['Unit', 'Value'], rows: others },
      };
    },
  },

  'datetime-toolkit': {
    fields: [
      { id: 'mode', type: 'select', label: 'What do you need?', options: [['diff', 'Days between two dates'], ['work', 'Working days between two dates'], ['add', 'Add or subtract days'], ['tz', 'Convert between time zones']] },
      { id: 'start', type: 'date', label: 'Start date', value: today(), half: true, show: (v) => v.mode === 'diff' || v.mode === 'work' || v.mode === 'add' },
      { id: 'end', type: 'date', label: 'End date', value: addDays(today(), 7), half: true, show: (v) => v.mode === 'diff' || v.mode === 'work' },
      { id: 'n', type: 'number', label: 'Days to add (negative to subtract)', value: 30, half: true, step: 1, show: (v) => v.mode === 'add' },
      { id: 'ends', type: 'checkbox', label: 'Count the start and end dates', value: true, show: (v) => v.mode === 'work' },
      { id: 'date', type: 'date', label: 'Date', value: today(), half: true, show: (v) => v.mode === 'tz' },
      { id: 'time', type: 'text', label: 'Time (24 h)', value: '12:00', half: true, placeholder: 'HH:MM', show: (v) => v.mode === 'tz' },
      { id: 'from', type: 'select', label: 'From zone', value: 'Europe/Warsaw', half: true, options: [{ group: 'Common', options: COMMON_ZONES }, { group: 'All zones', options: allZones() }], show: (v) => v.mode === 'tz' },
      { id: 'to', type: 'select', label: 'To zone', value: 'America/New_York', half: true, options: [{ group: 'Common', options: COMMON_ZONES }, { group: 'All zones', options: allZones() }], show: (v) => v.mode === 'tz' },
    ],
    run(v) {
      if (v.mode === 'diff') {
        if (!v.start || !v.end) return { empty: 'Pick two dates.' };
        const d = daysBetween(v.start, v.end);
        const p = ymd(v.start, v.end);
        return { stats: [['Days', d], ['Weeks', `${Math.trunc(Math.abs(d) / 7)} wk ${Math.abs(d) % 7} d`], ['Years / months / days', `${p.years}y ${p.months}m ${p.days}d`]] };
      }
      if (v.mode === 'work') {
        if (!v.start || !v.end) return { empty: 'Pick two dates.' };
        return { stats: [['Working days', workdaysBetween(v.start, v.end, { includeEnds: v.ends })]], notice: 'Counts Monday–Friday only; public holidays are not subtracted.' };
      }
      if (v.mode === 'add') {
        if (!v.start || v.n == null) return { empty: 'Pick a date and a number of days.' };
        const r = addDays(v.start, Math.trunc(v.n));
        return { stats: [['Result', r], ['Weekday', new Date(`${r}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })]] };
      }
      if (!v.date || !v.time) return { empty: 'Enter a date and time.' };
      const instant = zonedToInstant(v.date, v.time, v.from);
      return { stats: [['Converted', formatInZone(instant, v.to)], ['Original', formatInZone(instant, v.from)], ['UTC', formatInZone(instant, 'UTC')]] };
    },
  },

  'currency-converter': (() => {
    const cache = new Map();
    async function rates(base) {
      if (cache.has(base)) return cache.get(base);
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 9000);
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, { signal: ctl.signal, referrerPolicy: 'no-referrer', credentials: 'omit' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.result !== 'success') throw new Error(data['error-type'] || 'The rate service returned an error');
        cache.set(base, data);
        return data;
      } catch (e) {
        throw new Error(`Could not load exchange rates (${e.name === 'AbortError' ? 'timed out' : e.message}). Check your connection and try again.`);
      } finally { clearTimeout(timer); }
    }
    const codes = ['EUR', 'USD', 'GBP', 'PLN', 'CHF', 'UAH', 'CZK', 'SEK', 'NOK', 'DKK', 'HUF', 'JPY', 'CNY', 'CAD', 'AUD', 'INR', 'TRY', 'AED', 'BRL', 'MXN'];
    let names;
    try { names = new Intl.DisplayNames(['en'], { type: 'currency' }); } catch { names = { of: (c) => c }; }
    const options = codes.map((c) => [c, `${c} · ${names.of(c)}`]);
    return {
      fields: [
        { id: 'amount', type: 'number', label: 'Amount', value: 100, min: 0 },
        { id: 'from', type: 'select', label: 'From', value: 'EUR', half: true, options },
        { id: 'to', type: 'select', label: 'To', value: 'PLN', half: true, options },
      ],
      async run({ amount, from, to }) {
        if (amount == null) return { empty: 'Enter an amount.' };
        const data = await rates(from);
        const rate = data.rates[to];
        if (rate == null) throw new Error(`No rate available for ${to}.`);
        const fmt = (n, c) => new Intl.NumberFormat('en', { style: 'currency', currency: c, maximumFractionDigits: 4 }).format(n);
        return {
          stats: [['Result', fmt(amount * rate, to)], ['Rate', `1 ${from} = ${Number(rate.toPrecision(6))} ${to}`]],
          table: { caption: `${fmt(amount, from)} in other currencies`, head: ['Currency', 'Amount'], rows: codes.filter((c) => c !== from && data.rates[c]).map((c) => [c, fmt(amount * data.rates[c], c)]) },
          notice: `Reference rates updated ${data.time_last_update_utc?.replace(/ \+0000$/, ' UTC') || 'recently'}. Not a trading quote.`,
          node: h('p', { class: 'muted small-text' }, 'Rates by ', h('a', { href: 'https://www.exchangerate-api.com', rel: 'noopener noreferrer', target: '_blank' }, 'Exchange Rate API'), '.'),
        };
      },
    };
  })(),
};

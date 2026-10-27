import test from 'node:test';
import assert from 'node:assert/strict';
import { validateJson, JsonError, sortKeysDeep, jsonToRows } from '../public/js/lib/json.js';
import { checkFlow } from '../public/js/lib/pa.js';
import { markdownToHtml } from '../public/js/lib/md.js';
import { formatSql } from '../public/js/lib/sql.js';
import { convert, fmtNumber } from '../public/js/lib/units.js';
import { daysBetween, ymd, workdaysBetween, addDays, zonedToInstant, formatInZone } from '../public/js/lib/datetime.js';
import { analyzeCopy, scoreHeadline, extractKeywords, diffTokens } from '../public/js/lib/text.js';
import { generateRows, ascii } from '../public/js/lib/fake.js';
import { extractPalette } from '../public/js/lib/palette.js';

test('json: errors carry line and column, duplicates are reported', () => {
  assert.throws(() => validateJson('{\n  "a": 1,\n  "b": }'), (e) => e instanceof JsonError && e.line === 3 && e.column === 8);
  assert.throws(() => validateJson("{'a':1}"), /property name/);
  assert.throws(() => validateJson('[1,]'), JsonError);
  assert.throws(() => validateJson('{"a":1} x'), /Extra data/);
  assert.deepEqual(validateJson('{"a":1,"a":2,"b":{"c":1,"c":2}}').duplicates.sort(), ['a', 'c']);
  assert.equal(validateJson(' [1, 2.5e3, "x\\u00e9", true, null] ').value.length, 5);
  assert.throws(() => validateJson('['.repeat(1000)), /nesting/);
  assert.deepEqual(Object.keys(sortKeysDeep({ b: { z: 1, a: 2 }, a: 1 })), ['a', 'b']);
  assert.deepEqual(jsonToRows([{ a: 1, b: { x: 1 } }, { a: 2, c: 3 }]), [['a', 'b', 'c'], [1, '{"x":1}', ''], [2, '', 3]]);
  assert.throws(() => jsonToRows([1, 2]), /array of objects/);
});

test('power automate: unknown runAfter, cycles, expression parentheses', () => {
  const flow = { properties: { definition: { triggers: { t: { type: 'Request' } }, actions: {
    A: { type: 'Compose', inputs: "@{concat('a', 'b'}", runAfter: {} },
    B: { type: 'Compose', runAfter: { A: ['Succeeded'], Ghost: ['Failed'] } },
    C: { type: 'Compose', runAfter: { D: ['Succeeded'] } }, D: { type: 'Compose', runAfter: { C: ['Succeeded'] } },
  } } } };
  const { findings } = checkFlow(JSON.stringify(flow));
  const msgs = findings.map((f) => f.message).join('\n');
  assert.match(msgs, /unknown action 'Ghost'/);
  assert.match(msgs, /Circular runAfter/);
  assert.match(msgs, /unbalanced/i);
  const good = checkFlow('{"definition":{"triggers":{"t":{"type":"Request"}},"actions":{"A":{"type":"Compose","runAfter":{}}}}}');
  assert.equal(good.findings.length, 0);
  assert.equal(checkFlow('{"a":').errorLine, 1);
  assert.equal(checkFlow('{"x":1}').findings[0].level, 'warning');
});

test('markdown: structure and XSS safety', () => {
  const html = markdownToHtml('# T\n\n- a\n  - b\n- c\n\n1. x\n\n| h |\n|---|\n| v |\n\n`<b>`');
  assert.match(html, /<h1>T<\/h1>/);
  assert.match(html, /<ul><li>a<ul><li>b<\/li><\/ul><\/li><li>c<\/li><\/ul>/);
  assert.match(html, /<table>/);
  const evil = markdownToHtml('<script>alert(1)</script> [x](javascript:alert(1)) ![i](data:text/html;base64,AAA) <img src=x onerror=alert(1)>');
  assert.ok(!/<script|href="javascript|onerror=alert/i.test(evil.replace(/&lt;[^&]*&gt;/g, '')));
  assert.match(evil, /href="#"/);
});

test('sql formatter: clauses, joins, subqueries, strings untouched', () => {
  const out = formatSql("select a, b from t join u on t.id = u.id and u.x = 'select from' where a in (select 1) and b between 1 and 2 order by a");
  assert.match(out, /^SELECT\n {2}a,\n {2}b\nFROM t\nJOIN u ON t\.id = u\.id\n {2}AND u\.x = 'select from'\nWHERE a IN \(\n {2}SELECT\n {4}1\n\)\n {2}AND b BETWEEN 1 AND 2\nORDER BY\n {2}a\n$/);
  assert.match(formatSql('select 1; select 2'), /;\n\nSELECT/);
});

test('units and dates', () => {
  assert.ok(Math.abs(convert('length', 26.2, 'mi', 'km') - 42.1648) < 1e-3);
  assert.equal(convert('temp', 100, '°C', '°F'), 212);
  assert.ok(Math.abs(convert('temp', 0, 'K', '°C') + 273.15) < 1e-9);
  assert.equal(convert('data', 1, 'GB', 'MB'), 1024);
  assert.equal(fmtNumber(0.1 + 0.2), '0.3');
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
  assert.throws(() => daysBetween('2024-02-31', '2024-03-01'), /valid/);
  assert.deepEqual(ymd('2020-01-31', '2021-03-01'), { years: 1, months: 1, days: 1 });
  assert.equal(workdaysBetween('2026-11-02', '2026-11-08'), 5);
  assert.equal(workdaysBetween('2026-11-02', '2026-11-06', { includeEnds: false }), 3);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  // 12:00 Warsaw in winter is 06:00 in New York; across the DST gap weeks it is 07:00.
  assert.equal(formatInZone(zonedToInstant('2026-01-15', '12:00', 'Europe/Warsaw'), 'America/New_York', { withZone: false }), '2026-01-15 06:00');
  assert.equal(formatInZone(zonedToInstant('2026-03-20', '12:00', 'Europe/Warsaw'), 'America/New_York', { withZone: false }), '2026-03-20 07:00');
});

test('text analysis, headline score, keywords, diff', () => {
  const a = analyzeCopy('One two three. Four five six! Seven?');
  assert.equal(a.words, 7);
  assert.equal(a.sentences, 3);
  assert.ok(a.flesch >= 0 && a.flesch <= 100);
  assert.equal(scoreHeadline('7 proven ways to write headlines people click').score, 100);
  assert.ok(scoreHeadline('Hi').score < 60);
  const k = extractKeywords('Lighting lighting LIGHTING design design #Smart #smart tips');
  assert.deepEqual(k.top[0], ['lighting', 3]);
  assert.deepEqual(k.found, ['Smart', 'smart']);
  const ops = diffTokens(['a', 'b', 'c', 'd'], ['a', 'c', 'x', 'd']);
  assert.deepEqual(ops.map((o) => o.type[0] + o.value).join(' '), 'ea db ec ax ed');
  assert.deepEqual(diffTokens([], ['x']).map((o) => o.type), ['add']);
});

test('fake data and palette', () => {
  const rows = generateRows('pl', ['name', 'email', 'phone', 'uuid'], 20);
  assert.equal(rows.length, 20);
  assert.ok(rows.every((r) => /^[a-z0-9.]+@example\.(com|org|net)$/.test(r[1]) && r[2].startsWith('+48')));
  assert.equal(ascii('Łukasz Wiśniewski'), 'lukasz.wisniewski');
  const px = new Uint8ClampedArray(400 * 4);
  for (let i = 0; i < 400; i++) { const red = i < 300; px.set(red ? [220, 20, 20, 255] : [20, 20, 220, 255], i * 4); }
  const pal = extractPalette(px, 2);
  assert.equal(pal.length, 2);
  assert.equal(pal[0].hex, '#dc1414');
  assert.ok(Math.abs(pal[0].share - 0.75) < 1e-9);
  assert.deepEqual(extractPalette(new Uint8ClampedArray([0, 0, 0, 0]), 3), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TOOLS } from '../public/js/registry.js';
import { PAGES } from '../public/js/pages.js';

const pub = new URL('../public/', import.meta.url);
const read = (name) => readFile(new URL(name, pub), 'utf8');
const pick = (html, re) => re.exec(html)?.[1];

test('every tool and fixed page has its own static HTML page with a unique title, description and canonical address', async () => {
  const titles = new Set();
  const descriptions = new Set();
  const canonicals = new Set();
  const ids = [...Object.keys(PAGES), ...TOOLS.map((t) => t.id)];
  for (const id of ids) {
    const html = await read(`${id}.html`);
    const title = pick(html, /<title>([^<]*)<\/title>/);
    const desc = pick(html, /<meta name="description" content="([^"]*)"/);
    const canonical = pick(html, /<link rel="canonical" href="([^"]*)"/);
    assert.ok(title.endsWith(' · My Tools Hub'), `${id}: title`);
    assert.ok(desc.length > 30 && desc.length <= 200, `${id}: description length ${desc.length}`);
    assert.ok(canonical.endsWith(`/${id}`), `${id}: canonical ${canonical}`);
    assert.ok(html.includes(`<h1>`), `${id}: has a heading before scripts run`);
    for (const [set, v] of [[titles, title], [descriptions, desc], [canonicals, canonical]]) { assert.ok(!set.has(v), `${id}: duplicate ${v}`); set.add(v); }
  }
});

test('the sitemap lists the home page, the fixed pages and every tool, and robots.txt points at it', async () => {
  const map = await read('sitemap.xml');
  const locs = [...map.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, 1 + Object.keys(PAGES).length + TOOLS.length);
  for (const t of TOOLS) assert.ok(locs.some((l) => l.endsWith(`/${t.id}`)), `sitemap misses ${t.id}`);
  assert.ok(!map.includes('#'));
  assert.match(await read('robots.txt'), /Sitemap: https:\/\/[^/]+\/sitemap\.xml/);
});

test('Netlify rewrites cover every page', async () => {
  const rules = await read('_redirects');
  for (const id of [...Object.keys(PAGES), ...TOOLS.map((t) => t.id)]) assert.ok(rules.includes(`/${id}  /${id}.html  200`), id);
});

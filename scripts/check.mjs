// Consistency checks that need no browser: registry <-> tool modules, unique field ids, no stray network calls.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const problems = [];
const fail = (m) => problems.push(m);

// Tool modules touch `document` only inside functions, but a few lib files are imported by the registry check.
globalThis.document ??= undefined;
const { TOOLS, CATEGORIES } = await import(pathToFileURL(path.join(pub, 'js/registry.js')));
const ids = new Set();
const cats = new Set(CATEGORIES.map((c) => c.id));
const modules = new Map();
for (const t of TOOLS) {
  if (ids.has(t.id)) fail(`duplicate tool id: ${t.id}`);
  ids.add(t.id);
  if (!cats.has(t.cat)) fail(`${t.id}: unknown category ${t.cat}`);
  if (!/^[a-z0-9-]+$/.test(t.id)) fail(`${t.id}: id must be kebab-case`);
  if (!t.name || !t.desc || !t.icon) fail(`${t.id}: name, desc and icon are required`);
  if (!modules.has(t.module)) {
    try { modules.set(t.module, await import(pathToFileURL(path.join(pub, `js/tools/${t.module}.js`)))); } catch (e) { fail(`${t.module}.js failed to load: ${e.message}`); modules.set(t.module, null); }
  }
  const def = modules.get(t.module)?.tools?.[t.id];
  if (!def) { fail(`${t.id}: missing from js/tools/${t.module}.js`); continue; }
  if (typeof def.run !== 'function') fail(`${t.id}: run() missing`);
  const fieldIds = new Set();
  for (const f of def.fields || []) {
    if (fieldIds.has(f.id)) fail(`${t.id}: duplicate field id ${f.id}`);
    fieldIds.add(f.id);
  }
  for (const k of Object.keys(def.example || {})) if (!fieldIds.has(k)) fail(`${t.id}: example key ${k} is not a field`);
}
for (const [name, mod] of modules) {
  for (const id of Object.keys(mod?.tools || {})) if (!ids.has(id)) fail(`js/tools/${name}.js defines unregistered tool ${id}`);
}

// Only open-er-api.com may be contacted (github.com appears only in outbound links); no inline handlers or remote scripts in the HTML.
async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}
for await (const file of walk(pub)) {
  if (!/\.(js|html|css)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  const rel = path.relative(pub, file);
  for (const m of text.matchAll(/https?:\/\/[^\s'"`)<>;,]+/g)) {
    const host = new URL(m[0]).hostname;
    const ok = ['open.er-api.com', 'www.w3.org', 'purl.org', 'www.idpf.org', 'www.daisy.org', 'example.com', 'example.org', 'example.net', 'schemas.openxmlformats.org', 'github.com', 'static.vasylautomation.org', 'my-tools-hub-app.netlify.app', 'markdown-reader-editor.netlify.app', 'custom-card-generator-1.netlify.app', 'www.linkedin.com', 'www.netlify.com', 'www.exchangerate-api.com', 'uodo.gov.pl'].includes(host)
      || host.endsWith('.example.com') || host === 'localhost';
    if (!ok) fail(`${rel}: unexpected external URL ${m[0]}`);
  }
  // Design rule: icons are SVG. No emoji or pictographic symbols in the interface (copyright and trademark signs are fine).
  const glyph = text.replace(/[\u00A9\u00AE\u2122]/g, '').match(/[\p{Extended_Pictographic}\uFE0F]/u);
  if (glyph && !/icons\.js$/.test(file)) fail(`${rel}: emoji or pictographic symbol ${glyph[0]} (use an SVG icon)`);
  if (/\.html$/.test(file) && /\son[a-z]+\s*=\s*["']/.test(text)) fail(`${rel}: inline event handler (blocked by CSP)`);
  if (/\.js$/.test(file) && /\beval\s*\(|new Function\s*\(|\.innerHTML\s*=/.test(text)) fail(`${rel}: eval / new Function / innerHTML assignment`);
}

// The service worker must precache every JS/CSS file, otherwise unvisited tools break offline.
const sw = await readFile(path.join(pub, 'sw.js'), 'utf8');
const precached = new Set([...sw.matchAll(/'(\/[^']*)'/g)].map((m) => m[1]));
for await (const file of walk(pub)) {
  const rel = `/${path.relative(pub, file)}`;
  if (/\.(js|css)$/.test(rel) && rel !== '/sw.js' && !precached.has(rel)) fail(`sw.js SHELL is missing ${rel}`);
}
for (const entry of precached) {
  if (entry !== '/' && !(await readFile(path.join(pub, entry)).then(() => true, () => false))) fail(`sw.js SHELL lists missing file ${entry}`);
}

if (problems.length) { console.error(`✖ ${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`✔ ${TOOLS.length} tools in ${modules.size} modules are consistent`);

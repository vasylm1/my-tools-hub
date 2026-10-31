// Rewrites the SHELL list in public/sw.js so every JS and CSS file is precached for offline use.
// Run after adding or removing files in public/: npm run precache  (npm run check fails if the list is stale)
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}
const assets = [];
for await (const file of walk(pub)) {
  const rel = `/${path.relative(pub, file)}`;
  if (/\.(js|css)$/.test(rel) && rel !== '/sw.js') assets.push(rel);
}
const shell = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest', '/img/vasyl-madei.jpg', ...assets.sort()];
const swPath = path.join(pub, 'sw.js');
const sw = await readFile(swPath, 'utf8');
const start = sw.indexOf('const SHELL = [');
const end = sw.indexOf('];', start) + 2;
await writeFile(swPath, `${sw.slice(0, start)}const SHELL = [\n${shell.map((x) => `  '${x}',`).join('\n')}\n];${sw.slice(end)}`);
console.log(`precache list updated: ${shell.length} files`);

// The site uses #/ routes, which search engines treat as one page, so the sitemap lists the home page with the date of the last commit.
try {
  const date = execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: path.dirname(pub), encoding: 'utf8' }).trim();
  const mapPath = path.join(pub, 'sitemap.xml');
  const xml = await readFile(mapPath, 'utf8');
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) await writeFile(mapPath, xml.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${date}</lastmod>`));
} catch { /* not a git checkout: keep the date that is there */ }

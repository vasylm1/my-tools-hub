// Writes one static HTML page per tool and per fixed page, plus sitemap.xml and the Netlify rewrites, from public/index.html and the registry.
// Why: the app is a single-page app, but search engines and link previews read the HTML they are served. Each page below carries its own
// title, description, canonical address and Open Graph tags, and loads the same app, which then takes over.
// Run after changing the registry or index.html: npm run prerender  (npm run check fails if the files are stale)
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function replaceOnce(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`index.html: cannot find ${label}`);
  return html.replace(pattern, () => replacement);
}

export async function buildSite({ lastmod } = {}) {
  const { TOOLS, CATEGORIES } = await import(pathToFileURL(path.join(pub, 'js/registry.js')));
  const { PAGES } = await import(pathToFileURL(path.join(pub, 'js/pages.js')));
  const { buildSitemap } = await import(pathToFileURL(path.join(pub, 'js/lib/seo-files.js')));
  const template = await readFile(path.join(pub, 'index.html'), 'utf8');
  const site = /<link rel="canonical" href="(https?:\/\/[^/"]+)\/">/.exec(template)?.[1];
  if (!site) throw new Error('index.html: missing canonical link');

  const pages = [
    ...Object.entries(PAGES).map(([id, p]) => ({ id, title: p.title, desc: p.desc })),
    ...TOOLS.map((t) => ({ id: t.id, title: t.name, desc: t.desc, tool: t })),
  ];
  const taken = new Set(['index', 'css', 'js', 'img', 'icons', 'sw', 'robots', 'sitemap', 'manifest', '404', 'favicon']);
  const files = new Map();
  for (const p of pages) {
    if (taken.has(p.id)) throw new Error(`"${p.id}" clashes with a file or folder in public/`);
    taken.add(p.id);
    const title = `${p.title} · My Tools Hub`;
    const url = `${site}/${p.id}`;
    let html = template;
    html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`, '<title>');
    html = replaceOnce(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(p.desc)}">`, 'meta description');
    html = replaceOnce(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`, 'og:title');
    html = replaceOnce(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(p.desc)}">`, 'og:description');
    html = replaceOnce(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}">`, 'og:url');
    html = replaceOnce(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}">`, 'canonical');
    if (p.tool) {
      const ld = {
        '@context': 'https://schema.org', '@type': 'WebApplication', name: p.title, description: p.desc, url,
        applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, isPartOf: { '@type': 'WebSite', name: 'My Tools Hub', url: `${site}/` },
      };
      html = replaceOnce(html, /<\/head>/, `  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`, '</head>');
    }
    // Text that is there before the script runs: what crawlers and link previews see, and a first paint for slow connections.
    html = replaceOnce(html, /<main id="main" tabindex="-1"><\/main>/,
      `<main id="main" tabindex="-1"><div class="wrap section pt"><h1>${esc(p.title)}</h1><p class="muted">${esc(p.desc)}</p></div></main>`, '<main>');
    files.set(`${p.id}.html`, html);
  }

  const listed = ['/', ...pages.map((p) => `/${p.id}`)];
  const map = buildSitemap({ site, pages: listed.join('\n'), lastmod });
  files.set('sitemap.xml', map.xml);
  // Netlify already serves /name from name.html; the explicit rewrites remove any doubt and document the contract.
  files.set('_redirects', `${pages.map((p) => `/${p.id}  /${p.id}.html  200`).join('\n')}\n`);
  return { files, count: pages.length, categories: CATEGORIES.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let lastmod;
  try { lastmod = execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* not a git checkout */ }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod || '')) lastmod = (await readFile(path.join(pub, 'sitemap.xml'), 'utf8').catch(() => '')).match(/<lastmod>([^<]+)</)?.[1];
  const { files, count } = await buildSite({ lastmod });
  for (const [name, body] of files) await writeFile(path.join(pub, name), body);
  console.log(`prerendered ${count} pages, sitemap.xml and _redirects`);
}

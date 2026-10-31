// robots.txt and sitemap.xml builders. Pure functions: they return text plus warnings, and throw only for unusable input.

// Crawlers that collect text for AI training. robots.txt is a request, not enforcement: well-behaved bots honour it.
export const AI_CRAWLERS = ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'CCBot', 'Google-Extended', 'Applebot-Extended', 'Bytespider', 'Meta-ExternalAgent', 'cohere-ai'];

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
// Messages are templates with {placeholders}; the tool translates the template and fills the values.
const msg = (text, values = {}) => ({ text, values });
export class SeoError extends Error {
  constructor(text, values = {}) { super(text); this.values = values; }
}
const lines = (t) => String(t || '').split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#'));

export function parseSite(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new SeoError('Enter the address of your site, for example example.com.');
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`); } catch { throw new SeoError('That does not look like a web address. Try example.com.'); }
  if (!/^https?:$/.test(url.protocol)) throw new SeoError('Use an http or https address.');
  if (!url.hostname.includes('.') && url.hostname !== 'localhost') throw new SeoError('That does not look like a public domain name.');
  return url.origin;
}

function pathRule(line, warnings, kind) {
  let p = line.replace(/^(?:allow|disallow)\s*:\s*/i, '').trim();
  if (/^https?:\/\//i.test(p)) { try { const u = new URL(p); p = u.pathname + u.search; warnings.push(msg('{kind} rules take a path, so “{line}” became “{path}”.', { kind, line, path: p })); } catch { /* keep as typed */ } }
  if (!p.startsWith('/') && !p.startsWith('*')) { warnings.push(msg('“{line}” should start with “/”, so a “/” was added.', { line })); p = `/${p}`; }
  return p;
}

export function buildRobots({ site, disallow = '', allow = '', blockAi = false, sitemapPath = '/sitemap.xml' } = {}) {
  const warnings = [];
  let origin = '';
  if (String(site || '').trim()) origin = parseSite(site);
  else warnings.push(msg('Without a site address the Sitemap line is left out. Add it so search engines find your sitemap.'));
  const dis = [...new Set(lines(disallow).map((l) => pathRule(l, warnings, 'Disallow')))];
  const alw = [...new Set(lines(allow).map((l) => pathRule(l, warnings, 'Allow')))];
  if (dis.includes('/')) warnings.push(msg('“Disallow: /” blocks your whole site from search engines. Remove it unless the site is not meant to be public.'));
  if (dis.some((p) => /\.(css|js)$|\/(assets|static|css|js)\//i.test(p))) warnings.push(msg('Blocking CSS or JavaScript can stop Google from rendering your pages correctly.'));
  const out = ['User-agent: *'];
  for (const p of alw) out.push(`Allow: ${p}`);
  if (dis.length) for (const p of dis) out.push(`Disallow: ${p}`); else out.push('Disallow:');
  if (blockAi) {
    for (const bot of AI_CRAWLERS) out.push('', `User-agent: ${bot}`, 'Disallow: /');
  }
  if (origin) out.push('', `Sitemap: ${origin}${sitemapPath.startsWith('/') ? sitemapPath : `/${sitemapPath}`}`);
  return { text: `${out.join('\n')}\n`, warnings };
}

export const SITEMAP_LIMIT = 50000;
export const CHANGEFREQ = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

export function buildSitemap({ site, pages = '', lastmod = '', changefreq = '', priority = '' } = {}) {
  const warnings = [];
  const origin = parseSite(site);
  const host = new URL(origin).host;
  if (lastmod && !/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) throw new SeoError('Use the date format YYYY-MM-DD for the last-modified date.');
  if (lastmod && Number.isNaN(Date.parse(lastmod))) throw new SeoError('That last-modified date does not exist.');
  if (changefreq && !CHANGEFREQ.includes(changefreq)) throw new SeoError('Unknown change frequency.');
  if (priority !== '' && (Number.isNaN(Number(priority)) || Number(priority) < 0 || Number(priority) > 1)) throw new SeoError('Priority must be a number from 0.0 to 1.0.');
  const urls = [];
  const seen = new Set();
  let skipped = 0;
  let fragments = 0;
  for (const line of lines(pages)) {
    let u;
    try { u = new URL(/^https?:\/\//i.test(line) ? line : `${origin}/${line.replace(/^\/+/, '')}`); } catch { skipped += 1; warnings.push(msg('“{line}” is not a valid address and was skipped.', { line })); continue; }
    if (u.host !== host) { skipped += 1; warnings.push(msg('“{line}” is on another host. A sitemap may only list pages from {host}.', { line, host })); continue; }
    if (u.hash) { fragments += 1; u.hash = ''; }
    const href = u.href;
    if (seen.has(href)) continue;
    seen.add(href);
    urls.push(href);
  }
  if (fragments) warnings.push(msg('Addresses with a #fragment: {count}. Search engines ignore fragments, so they were removed. Pages that only differ after the # count as one page.', { count: fragments }));
  if (!urls.length) urls.push(`${origin}/`);
  if (urls.length > SITEMAP_LIMIT) throw new SeoError('A sitemap can list at most {max} pages. Split it into several files.', { max: SITEMAP_LIMIT.toLocaleString('en') });
  const prio = priority === '' ? '' : Number(priority).toFixed(1);
  const body = urls.map((loc) => {
    const parts = [`    <loc>${xmlEscape(loc)}</loc>`];
    if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
    if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
    if (prio) parts.push(`    <priority>${prio}</priority>`);
    return `  <url>\n${parts.join('\n')}\n  </url>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  return { xml, count: urls.length, skipped, warnings };
}

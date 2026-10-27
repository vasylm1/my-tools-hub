// Campaign (UTM) link building. Pure functions, no DOM.
import { parseCSV } from './csv.js';

const FIELDS = [['utm_source', 'source'], ['utm_medium', 'medium'], ['utm_campaign', 'campaign'], ['utm_id', 'id'], ['utm_term', 'term'], ['utm_content', 'content']];
const REQUIRED = ['source', 'medium', 'campaign'];
export const COMMON_MEDIUMS = ['cpc', 'email', 'social', 'display', 'affiliate', 'referral', 'organic', 'video', 'qr', 'sms'];

/**
 * @param {string} base  the landing page link
 * @param {{source,medium,campaign,id?,term?,content?}} params
 * @param {{ lowercase?: boolean, space?: '-'|'_' }} opts
 * @returns {{ url: string, params: [string, string][], warnings: string[] }}
 * @throws {Error} with a message the user can act on
 */
export function buildUtmUrl(base, params, { lowercase = true, space = '-' } = {}) {
  let u;
  try { u = new URL(String(base || '').trim()); } catch { u = null; }
  if (!u || !/^https?:$/.test(u.protocol)) throw new Error('Enter a full link that starts with http:// or https://');
  const warnings = [];
  const clean = (v) => {
    let s = String(v ?? '').trim();
    if (lowercase) s = s.toLowerCase();
    if (space) s = s.replace(/\s+/g, space);
    return s;
  };
  const values = Object.fromEntries(FIELDS.map(([, name]) => [name, clean(params[name])]));
  if (REQUIRED.some((name) => !values[name])) throw new Error('Add a source, a medium and a campaign name. All three are needed for campaign reports.');

  const kept = [];
  for (const [k, v] of u.searchParams) {
    if (/^utm_/i.test(k)) warnings.push('The link already had campaign tags. They were replaced.'); else kept.push([k, v]);
  }
  const added = FIELDS.map(([key, name]) => [key, values[name]]).filter(([, v]) => v);
  const enc = encodeURIComponent;
  const query = [...kept, ...added].map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&');
  const url = `${u.origin}${u.pathname}?${query}${u.hash}`;

  if (!lowercase && FIELDS.some(([, name]) => values[name] !== values[name].toLowerCase())) warnings.push('Capital letters create separate rows in reports (“Email” and “email” are different). Lowercase is safer.');
  if (u.protocol === 'http:') warnings.push('This link uses http. Use https if the page supports it.');
  if (url.length > 2000) warnings.push('This link is longer than 2,000 characters, which some systems cut off.');
  if (!COMMON_MEDIUMS.includes(values.medium)) warnings.push('This medium is not a standard one. Analytics tools group traffic best with common ones such as email, social, cpc, display and referral.');
  if (/[^\w\-.~]/.test(values.campaign.replace(/%20/g, ''))) warnings.push('The campaign name has special characters. Letters, numbers, hyphens and underscores keep reports tidy.');
  return { url, params: added, warnings };
}

/** Build one link per spreadsheet row. Columns (any order, any case): link/url, source, medium, campaign, id, term, content. */
export function buildBatch(csvText, opts) {
  const rows = parseCSV(csvText).filter((r) => r.some((c) => c.trim() !== ''));
  if (rows.length < 2) throw new Error('Add a header row and at least one data row.');
  const head = rows[0].map((c) => c.trim().toLowerCase().replace(/^utm_/, ''));
  const col = (...names) => head.findIndex((c) => names.includes(c));
  const idx = { base: col('link', 'url', 'base url', 'landing page'), source: col('source'), medium: col('medium'), campaign: col('campaign'), id: col('id'), term: col('term'), content: col('content') };
  if ([idx.base, idx.source, idx.medium, idx.campaign].some((i) => i < 0)) throw new Error('The header row needs the columns link, source, medium and campaign.');
  const results = rows.slice(1).map((r, n) => {
    const get = (i) => (i >= 0 ? r[i] ?? '' : '');
    try {
      const out = buildUtmUrl(get(idx.base), { source: get(idx.source), medium: get(idx.medium), campaign: get(idx.campaign), id: get(idx.id), term: get(idx.term), content: get(idx.content) }, opts);
      return { row: n + 2, url: out.url, warnings: out.warnings };
    } catch (e) { return { row: n + 2, url: '', error: e.message, warnings: [] }; }
  });
  return results;
}

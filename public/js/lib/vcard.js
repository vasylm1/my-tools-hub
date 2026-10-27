// vCard 3.0 generation.
import { fold } from './ics.js';

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

export function splitName(full) {
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { given: parts[0] || '', family: '' };
  return { given: parts.slice(0, -1).join(' '), family: parts[parts.length - 1] };
}

/** @param {{name, phone, email, company, title, website, address, note}} c */
export function buildVcard(c) {
  const { given, family } = splitName(c.name || '');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${esc(family)};${esc(given)};;;`, `FN:${esc(c.name || '')}`];
  if (c.company) lines.push(`ORG:${esc(c.company)}`);
  if (c.title) lines.push(`TITLE:${esc(c.title)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${esc(c.phone)}`);
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(c.email)}`);
  if (c.website) lines.push(`URL:${esc(c.website)}`);
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${esc(c.address)};;;;`);
  if (c.note) lines.push(`NOTE:${esc(c.note)}`);
  lines.push('END:VCARD');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

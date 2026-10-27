// iCalendar (RFC 5545) generation from spreadsheet rows.

/** Parse a spreadsheet cell into { y, mo, d, h, mi, s, hasTime } or null. */
export function parseDateCell(cell) {
  if (cell == null) return null;
  const raw = String(cell).trim();
  if (!raw) return null;
  let m;
  if (/^\d+(\.\d+)?$/.test(raw) && +raw > 20000 && +raw < 80000) { // Excel serial date
    const ms = Math.round((+raw - 25569) * 86400000);
    const d = new Date(ms);
    const hasTime = !Number.isInteger(+raw);
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), hasTime };
  }
  const time = (h, mi, s) => ({ h: h == null ? 0 : +h, mi: mi == null ? 0 : +mi, s: s == null ? 0 : +s, hasTime: h != null });
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(raw))) {
    return valid({ y: +m[1], mo: +m[2], d: +m[3], ...time(m[4], m[5], m[6]) });
  }
  if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw))) {
    return valid({ y: +m[3], mo: +m[2], d: +m[1], ...time(m[4], m[5], m[6]) });
  }
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?)?$/i.exec(raw))) {
    let [a, b] = [+m[1], +m[2]];
    if (a > 12) [a, b] = [b, a]; // clearly day/month
    let h = m[4];
    if (m[7] && h != null) h = (+h % 12) + (/pm/i.test(m[7]) ? 12 : 0);
    return valid({ y: +m[3], mo: a, d: b, ...time(h, m[5], m[6]) });
  }
  return null;
}

function valid(p) {
  const d = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  if (d.getUTCMonth() !== p.mo - 1 || p.h > 23 || p.mi > 59) return null;
  return p;
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
export const stamp = (p) => `${pad(p.y, 4)}${pad(p.mo)}${pad(p.d)}T${pad(p.h)}${pad(p.mi)}${pad(p.s)}`;
export const dateOnly = (p) => `${pad(p.y, 4)}${pad(p.mo)}${pad(p.d)}`;

export function escapeIcs(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r\n|\r|\n/g, '\\n');
}

/** Fold a content line to 75 octets as required by the RFC. */
export function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let cur = '';
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > (parts.length ? 74 : 75)) { parts.push(cur); cur = ''; size = 0; }
    cur += ch; size += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

function uid(i) {
  const rnd = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${i}-${Math.random().toString(16).slice(2)}`);
  return `${rnd}@my-tools-hub`;
}

/**
 * @param {string[][]} rows  data rows: start, end, title, description, location
 * @returns {{ ics: string, count: number, skipped: { row: number, reason: string }[] }}
 */
export function buildIcs(rows, { now = new Date() } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//My Tools Hub//Excel to Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const dtstamp = `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`;
  const skipped = [];
  let count = 0;
  rows.forEach((r, idx) => {
    const start = parseDateCell(r[0]);
    const end = parseDateCell(r[1]) || (start && { ...start });
    if (!start || !end) { skipped.push({ row: idx + 2, reason: 'Start or end date could not be read' }); return; }
    const allDay = !start.hasTime && !end.hasTime;
    lines.push('BEGIN:VEVENT', `UID:${uid(idx)}`, `DTSTAMP:${dtstamp}`);
    if (allDay) {
      const endExclusive = new Date(Date.UTC(end.y, end.mo - 1, end.d + 1));
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(start)}`, `DTEND;VALUE=DATE:${dateOnly({ y: endExclusive.getUTCFullYear(), mo: endExclusive.getUTCMonth() + 1, d: endExclusive.getUTCDate() })}`);
    } else {
      lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`);
    }
    lines.push(`SUMMARY:${escapeIcs(r[2]?.trim() || 'Event')}`);
    if (r[3]?.trim()) lines.push(`DESCRIPTION:${escapeIcs(r[3])}`);
    if (r[4]?.trim()) lines.push(`LOCATION:${escapeIcs(r[4])}`);
    lines.push('END:VEVENT');
    count++;
  });
  lines.push('END:VCALENDAR');
  return { ics: `${lines.map(fold).join('\r\n')}\r\n`, count, skipped };
}

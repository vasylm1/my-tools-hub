// Date arithmetic and time zone conversion built on Intl (no libraries).

const DAY = 86400000;
const utc = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  return d.getUTCMonth() === +m[2] - 1 ? t : null; // rejects 2024-02-31
};

export function daysBetween(startIso, endIso) {
  const a = utc(startIso);
  const b = utc(endIso);
  if (a == null || b == null) throw new Error('Enter two valid dates.');
  return Math.round((b - a) / DAY);
}

/** Years, months and days between two dates (earlier first). Months are whole calendar months, clamped to month end. */
export function ymd(startIso, endIso) {
  let [a, b] = [startIso, endIso];
  if (a > b) [a, b] = [b, a];
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months--;
  const total = m1 - 1 + months;
  const ay = y1 + Math.floor(total / 12);
  const am = ((total % 12) + 12) % 12;
  const ad = Math.min(d1, new Date(Date.UTC(ay, am + 1, 0)).getUTCDate());
  const days = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(ay, am, ad)) / DAY);
  return { years: Math.floor(months / 12), months: months % 12, days };
}

/** Monday–Friday days between two dates, both ends included. */
export function workdaysBetween(startIso, endIso, { includeEnds = true } = {}) {
  let a = utc(startIso);
  let b = utc(endIso);
  if (a == null || b == null) throw new Error('Enter two valid dates.');
  if (a > b) [a, b] = [b, a];
  if (!includeEnds) { a += DAY; b -= DAY; }
  let count = 0;
  for (let t = a; t <= b; t += DAY) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export function addDays(iso, n) {
  const t = utc(iso);
  if (t == null) throw new Error('Enter a valid date.');
  return new Date(t + n * DAY).toISOString().slice(0, 10);
}

function offsetMinutes(instant, zone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instant)).reduce((o, p) => ({ ...o, [p.type]: +p.value }), {});
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60000);
}

/** Interpret a wall-clock time ("YYYY-MM-DD", "HH:MM") in `zone` and return the UTC instant in ms. */
export function zonedToInstant(dateIso, time, zone) {
  const d = utc(dateIso);
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || '');
  if (d == null || !m) throw new Error('Enter a valid date and time.');
  const wall = d + (+m[1] * 60 + +m[2]) * 60000;
  let guess = wall - offsetMinutes(wall, zone) * 60000;
  guess = wall - offsetMinutes(guess, zone) * 60000; // second pass handles DST edges
  return guess;
}

export function formatInZone(instant, zone, { withZone = true } = {}) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    timeZoneName: withZone ? 'short' : undefined,
  });
  const p = Object.fromEntries(f.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}${withZone ? ` ${p.timeZoneName}` : ''}`;
}

export const COMMON_ZONES = ['UTC', 'Europe/Warsaw', 'Europe/Berlin', 'Europe/London', 'Europe/Kyiv', 'Europe/Paris', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'America/Sao_Paulo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];

export function allZones() {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return COMMON_ZONES; }
}

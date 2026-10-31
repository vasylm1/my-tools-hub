// Photo metadata: read EXIF (camera, time, GPS) from JPEG, PNG and WebP, and strip it without re-encoding the pixels.
// Stripping works on the file's own structure (segments, chunks), so image quality is untouched.

const u16 = (b, o, le) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
const u32 = (b, o, le) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
const ascii = (b, s, e) => String.fromCharCode(...b.subarray(s, e));
const same = (b, o, text) => o + text.length <= b.length && [...text].every((c, i) => b[o + i] === c.charCodeAt(0));

export function detectFormat(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b.length > 8 && b[0] === 0x89 && same(b, 1, 'PNG')) return 'png';
  if (b.length > 12 && same(b, 0, 'RIFF') && same(b, 8, 'WEBP')) return 'webp';
  return null;
}

/* --------------------------------------------------------------- TIFF / EXIF */

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readValue(b, tiff, le, type, count, valueOffset) {
  const size = (TYPE_SIZE[type] || 0) * count;
  if (!size || count > 4096) return null;
  const at = size <= 4 ? valueOffset : tiff + u32(b, valueOffset, le);
  if (at < 0 || at + size > b.length) return null;
  if (type === 2) return ascii(b, at, at + count).replace(/\0.*$/s, '').trim();
  const out = [];
  for (let i = 0; i < count; i += 1) {
    if (type === 3) out.push(u16(b, at + i * 2, le));
    else if (type === 4) out.push(u32(b, at + i * 4, le));
    else if (type === 5 || type === 10) {
      const den = u32(b, at + i * 8 + 4, le);
      const num = type === 10 ? (u32(b, at + i * 8, le) | 0) : u32(b, at + i * 8, le);
      out.push(den ? num / den : 0);
    } else if (type === 9) out.push(u32(b, at + i * 4, le) | 0);
    else out.push(b[at + i]);
  }
  return count === 1 ? out[0] : out;
}

function readIfd(b, tiff, le, offset, into, seen) {
  if (offset < 8 || tiff + offset + 2 > b.length || seen.has(offset)) return 0;
  seen.add(offset);
  const n = u16(b, tiff + offset, le);
  for (let i = 0; i < Math.min(n, 512); i += 1) {
    const e = tiff + offset + 2 + i * 12;
    if (e + 12 > b.length) break;
    const tag = u16(b, e, le);
    const value = readValue(b, tiff, le, u16(b, e + 2, le), u32(b, e + 4, le), e + 8);
    if (value !== null) into[tag] = value;
  }
  const next = tiff + offset + 2 + n * 12;
  return next + 4 <= b.length ? u32(b, next, le) : 0;
}

// Returns { ifd0, exif, gps, hasThumbnail } from a TIFF block (the bytes after "Exif\0\0"), or null when it is not valid.
export function parseTiff(b, tiff = 0) {
  if (tiff + 8 > b.length) return null;
  const le = ascii(b, tiff, tiff + 2) === 'II';
  if (!le && ascii(b, tiff, tiff + 2) !== 'MM') return null;
  if (u16(b, tiff + 2, le) !== 42) return null;
  const seen = new Set();
  const ifd0 = {}; const exif = {}; const gps = {};
  const next = readIfd(b, tiff, le, u32(b, tiff + 4, le), ifd0, seen);
  if (typeof ifd0[0x8769] === 'number') readIfd(b, tiff, le, ifd0[0x8769], exif, seen);
  if (typeof ifd0[0x8825] === 'number') readIfd(b, tiff, le, ifd0[0x8825], gps, seen);
  return { ifd0, exif, gps, hasThumbnail: next > 0 };
}

const dms = (v, ref) => {
  if (!Array.isArray(v) || v.length < 3) return null;
  const deg = v[0] + v[1] / 60 + v[2] / 3600;
  return /^[SW]/i.test(ref || '') ? -deg : deg;
};

const ORIENTATION = { 1: 'Normal', 2: 'Mirrored', 3: 'Rotated 180°', 4: 'Mirrored vertically', 5: 'Mirrored, rotated 90°', 6: 'Rotated 90°', 7: 'Mirrored, rotated 270°', 8: 'Rotated 270°' };
const fix = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d);

function summarise(tiff) {
  const { ifd0, exif, gps } = tiff;
  const fields = [];
  const add = (label, value) => { if (value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length)) fields.push([label, String(value)]); };
  add('Camera', [ifd0[0x010f], ifd0[0x0110]].filter(Boolean).join(' ') || undefined);
  add('Lens', exif[0xa434]);
  add('Software', ifd0[0x0131]);
  add('Taken', exif[0x9003] || ifd0[0x0132]);
  if (typeof exif[0x829a] === 'number') add('Exposure', exif[0x829a] >= 1 ? `${fix(exif[0x829a])} s` : `1/${Math.round(1 / exif[0x829a])} s`);
  if (typeof exif[0x829d] === 'number') add('Aperture', `f/${fix(exif[0x829d])}`);
  add('ISO', Array.isArray(exif[0x8827]) ? exif[0x8827][0] : exif[0x8827]);
  if (typeof exif[0x920a] === 'number') add('Focal length', `${fix(exif[0x920a])} mm`);
  add('Orientation', ORIENTATION[ifd0[0x0112]] || undefined);
  add('Artist', ifd0[0x013b]);
  add('Copyright', ifd0[0x8298]);
  add('Owner', exif[0xa430]);
  add('Camera serial number', exif[0xa431]);
  add('Unique image ID', exif[0xa420]);
  let location = null;
  const lat = dms(gps[2], gps[1]);
  const lon = dms(gps[4], gps[3]);
  if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    location = { lat, lon };
    add('GPS position', `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    if (typeof gps[6] === 'number') add('GPS altitude', `${fix(gps[5] === 1 ? -gps[6] : gps[6], 0)} m`);
  }
  const risks = [];
  if (location) risks.push('GPS location');
  if (exif[0xa431] || exif[0xa430]) risks.push('Camera serial number or owner name');
  if (ifd0[0x013b]) risks.push('Author name');
  if (tiff.hasThumbnail) risks.push('Embedded preview image');
  if (exif[0x927c]) risks.push('Manufacturer notes');
  return { fields, location, risks, orientation: typeof ifd0[0x0112] === 'number' ? ifd0[0x0112] : 1 };
}

/* -------------------------------------------------------------------- JPEG */

// Walks the JPEG and returns its segments plus where the image data ends. Anything after the first EOI is "trailing".
function jpegSegments(b) {
  const segs = [];
  let i = 2;
  let end = b.length;
  while (i + 2 <= b.length) {
    if (b[i] !== 0xff) throw new Error('This JPEG file is damaged.');
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; } // fill byte
    if (marker === 0xd9) { end = i + 2; segs.push({ marker, start: i, end }); break; }
    if (marker >= 0xd0 && marker <= 0xd7) { i += 2; continue; }
    if (i + 4 > b.length) throw new Error('This JPEG file is damaged.');
    const len = u16(b, i + 2, false);
    if (len < 2 || i + 2 + len > b.length) throw new Error('This JPEG file is damaged.');
    const seg = { marker, start: i, end: i + 2 + len, data: i + 4 };
    segs.push(seg);
    i = seg.end;
    if (marker === 0xda) {
      // Entropy-coded data runs until the next real marker (not 00 stuffing, not RSTn, not fill).
      while (i + 1 < b.length) {
        if (b[i] === 0xff && b[i + 1] !== 0 && !(b[i + 1] >= 0xd0 && b[i + 1] <= 0xd7) && b[i + 1] !== 0xff) break;
        i += 1;
      }
      seg.scanEnd = i;
      if (i + 1 >= b.length) { end = b.length; break; }
    }
  }
  return { segs, end };
}

const isExif = (b, s) => s.marker === 0xe1 && same(b, s.data, 'Exif\0\0');
const isXmp = (b, s) => s.marker === 0xe1 && same(b, s.data, 'http://ns.adobe.com/xap/');
const kindOf = (b, s) => {
  if (isExif(b, s)) return 'EXIF';
  if (isXmp(b, s)) return 'XMP';
  if (s.marker === 0xed) return 'IPTC / Photoshop';
  if (s.marker === 0xfe) return 'Comment';
  if (s.marker === 0xe2 && same(b, s.data, 'MPF\0')) return 'Multi-picture data';
  if (s.marker >= 0xe1 && s.marker <= 0xef && !(s.marker === 0xe2 && same(b, s.data, 'ICC_PROFILE')) && s.marker !== 0xee) return 'Application data';
  return null;
};

function minimalOrientation(orientation) {
  // Big-endian TIFF with a single Orientation tag, wrapped in an APP1 segment.
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0];
  const body = [...'Exif\0\0'].map((c) => c.charCodeAt(0)).concat(tiff);
  const len = body.length + 2;
  return Uint8Array.from([0xff, 0xe1, len >> 8, len & 0xff, ...body]);
}

function inspectJpeg(b) {
  const { segs, end } = jpegSegments(b);
  const found = [];
  let tiff = null;
  for (const s of segs) {
    const k = kindOf(b, s);
    if (k && !found.includes(k)) found.push(k);
    if (isExif(b, s) && !tiff) tiff = parseTiff(b, s.data + 6);
  }
  if (end < b.length) found.push('Data after the image');
  return { found, tiff };
}

function stripJpeg(b, keepOrientation) {
  const { segs, end } = jpegSegments(b);
  const removed = [];
  const parts = [b.subarray(0, 2)];
  let orientation = 1;
  for (const s of segs) {
    const k = kindOf(b, s);
    if (isExif(b, s)) { const t = parseTiff(b, s.data + 6); if (t && typeof t.ifd0[0x0112] === 'number') orientation = t.ifd0[0x0112]; }
    if (k) { if (!removed.includes(k)) removed.push(k); continue; }
    parts.push(b.subarray(s.start, s.scanEnd ?? s.end));
  }
  if (end < b.length) removed.push('Data after the image');
  if (keepOrientation && orientation >= 2 && orientation <= 8) {
    // Keep the rotation hint or the photo would display sideways; it identifies no one.
    const at = parts.findIndex((p, i) => i > 0 && p[1] !== 0xe0);
    parts.splice(at < 0 ? parts.length : at, 0, minimalOrientation(orientation));
  }
  return { parts, removed };
}

/* --------------------------------------------------------------------- PNG */

const PNG_TEXT = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function pngChunks(b) {
  const chunks = [];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = u32(b, i, false);
    if (i + 12 + len > b.length) throw new Error('This PNG file is damaged.');
    chunks.push({ type: ascii(b, i + 4, i + 8), start: i, end: i + 12 + len, data: i + 8, len });
    i += 12 + len;
    if (chunks[chunks.length - 1].type === 'IEND') break;
  }
  return chunks;
}

function inspectPng(b) {
  const found = [];
  let tiff = null;
  const notes = [];
  for (const c of pngChunks(b)) {
    if (c.type === 'eXIf') { tiff = parseTiff(b, c.data); if (!found.includes('EXIF')) found.push('EXIF'); }
    else if (c.type === 'iTXt' && same(b, c.data, 'XML:com.adobe.xmp')) { if (!found.includes('XMP')) found.push('XMP'); }
    else if (c.type === 'tEXt' || c.type === 'iTXt' || c.type === 'zTXt') {
      if (!found.includes('Text notes')) found.push('Text notes');
      if (c.type === 'tEXt') {
        const raw = ascii(b, c.data, c.data + c.len);
        const nul = raw.indexOf('\0');
        if (nul > 0 && nul < 80) notes.push([raw.slice(0, nul), raw.slice(nul + 1, nul + 160)]);
      }
    } else if (c.type === 'tIME' && !found.includes('Modification time')) found.push('Modification time');
  }
  return { found, tiff, notes };
}

function stripPng(b) {
  const removed = [];
  const parts = [b.subarray(0, 8)];
  for (const c of pngChunks(b)) {
    if (PNG_TEXT.has(c.type)) {
      const label = c.type === 'eXIf' ? 'EXIF' : c.type === 'tIME' ? 'Modification time' : (c.type === 'iTXt' && same(b, c.data, 'XML:com.adobe.xmp')) ? 'XMP' : 'Text notes';
      if (!removed.includes(label)) removed.push(label);
      continue;
    }
    parts.push(b.subarray(c.start, c.end));
  }
  return { parts, removed };
}

/* -------------------------------------------------------------------- WebP */

function webpChunks(b) {
  const chunks = [];
  let i = 12;
  const limit = Math.min(b.length, 8 + u32(b, 4, true));
  while (i + 8 <= limit) {
    const len = u32(b, i + 4, true);
    const end = i + 8 + len + (len & 1);
    if (i + 8 + len > b.length) throw new Error('This WebP file is damaged.');
    chunks.push({ type: ascii(b, i, i + 4), start: i, end: Math.min(end, b.length), data: i + 8, len });
    i = end;
  }
  return chunks;
}

function inspectWebp(b) {
  const found = [];
  let tiff = null;
  for (const c of webpChunks(b)) {
    if (c.type === 'EXIF') {
      const at = same(b, c.data, 'Exif\0\0') ? c.data + 6 : c.data;
      tiff = parseTiff(b, at); found.push('EXIF');
    } else if (c.type === 'XMP ') found.push('XMP');
  }
  return { found, tiff };
}

function stripWebp(b) {
  const removed = [];
  const parts = [];
  let total = 4;
  for (const c of webpChunks(b)) {
    if (c.type === 'EXIF' || c.type === 'XMP ') { removed.push(c.type === 'EXIF' ? 'EXIF' : 'XMP'); continue; }
    let chunk = b.subarray(c.start, c.end);
    if (c.type === 'VP8X') { chunk = chunk.slice(); chunk[8] &= ~(0x08 | 0x04); } // clear the "has EXIF" and "has XMP" flags
    parts.push(chunk);
    total += chunk.length;
  }
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 12));
  head[4] = total & 0xff; head[5] = (total >> 8) & 0xff; head[6] = (total >> 16) & 0xff; head[7] = (total >> 24) & 0xff;
  return { parts: [head, ...parts], removed };
}

/* ------------------------------------------------------------------ public */

const join = (parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

export function inspect(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const format = detectFormat(b);
  if (!format) throw new Error('Only JPEG, PNG and WebP photos are supported.');
  const raw = format === 'jpeg' ? inspectJpeg(b) : format === 'png' ? inspectPng(b) : inspectWebp(b);
  const summary = raw.tiff ? summarise(raw.tiff) : { fields: [], location: null, risks: [], orientation: 1 };
  for (const [k, v] of raw.notes || []) summary.fields.push([k, v]);
  if (raw.found.includes('XMP')) summary.risks.push('XMP metadata (can hold names and edit history)');
  if (raw.found.includes('IPTC / Photoshop')) summary.risks.push('IPTC data (captions, credits, keywords)');
  return { format, found: raw.found, ...summary, hasMetadata: raw.found.some((f) => f !== 'Multi-picture data') || summary.fields.length > 0 };
}

export function strip(input, { keepOrientation = true } = {}) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const format = detectFormat(b);
  if (!format) throw new Error('Only JPEG, PNG and WebP photos are supported.');
  const r = format === 'jpeg' ? stripJpeg(b, keepOrientation) : format === 'png' ? stripPng(b) : stripWebp(b);
  return { bytes: join(r.parts), removed: r.removed, format };
}

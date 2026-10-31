import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSentences, findPassive, analyzeReadability, lixLabel } from '../public/js/lib/readability.js';
import { buildRobots, buildSitemap, parseSite, AI_CRAWLERS } from '../public/js/lib/seo-files.js';
import { inspect, strip, detectFormat } from '../public/js/lib/exif.js';

/* ----------------------------------------------------------- readability */

test('sentences: abbreviations, decimals and initials do not split', () => {
  const s = splitSentences('Dr. Smith paid 3.5 euros. Visit example.com today! Is it e.g. cheap? J. Doe agreed.');
  assert.deepEqual(s.map((x) => x.text), ['Dr. Smith paid 3.5 euros.', 'Visit example.com today!', 'Is it e.g. cheap?', 'J. Doe agreed.']);
  assert.equal(splitSentences('A first line.\n\nA second paragraph without a stop').length, 3 - 1);
  assert.deepEqual(splitSentences('   '), []);
});

test('passive voice: finds real passives and ignores adjectives', () => {
  assert.equal(findPassive('The report was written by the team.').length, 1);
  assert.equal(findPassive('Mistakes were quickly corrected.').length, 1);
  assert.equal(findPassive('The files are not stored anywhere.').length, 1);
  assert.equal(findPassive('She is tired and excited.').length, 0);
  assert.equal(findPassive('The team wrote the report.').length, 0);
  assert.equal(findPassive('It is red.').length, 0);
});

test('readability: long sentences, passives and repeated openings are flagged', () => {
  const long = `Start ${Array.from({ length: 26 }, (_, i) => `word${i}`).join(' ')}`;
  const veryLong = `Begin ${Array.from({ length: 37 }, (_, i) => `term${i}`).join(' ')}`;
  const r = analyzeReadability(`${long}. ${veryLong}. The cake was eaten. We run. We win. We celebrate. We rest.`);
  assert.deepEqual(r.list[0].flags, ['long']);
  assert.deepEqual(r.list[1].flags, ['very-long']);
  assert.ok(r.list[2].flags.includes('passive'));
  assert.equal(r.counts.long, 1); assert.equal(r.counts.veryLong, 1); assert.equal(r.counts.passive, 1);
  assert.equal(r.counts.sameStart, 4);
  assert.equal(r.sentences, 7);
});

test('readability: LIX and grade behave sensibly and non-English skips English-only checks', () => {
  const easy = analyzeReadability('The cat sat. The dog ran. We had fun.');
  const hard = analyzeReadability('Notwithstanding considerable administrative complications, organisations frequently implemented comprehensive reorganisation programmes.');
  assert.ok(easy.lix < 30 && lixLabel(easy.lix) === 'Very easy');
  assert.ok(hard.lix > 60 && hard.grade > easy.grade);
  const pl = analyzeReadability('Zespół został wybrany przez radę. Raport został napisany wczoraj.', { lang: 'other' });
  assert.equal(pl.grade, null); assert.equal(pl.counts.passive, 0);
  assert.equal(analyzeReadability('').words, 0);
});

/* ------------------------------------------------------------ robots/sitemap */

test('robots.txt: defaults, normalised rules, AI crawlers and sitemap line', () => {
  const plain = buildRobots({ site: 'example.com' });
  assert.equal(plain.text, 'User-agent: *\nDisallow:\n\nSitemap: https://example.com/sitemap.xml\n');
  const r = buildRobots({ site: 'https://example.com/shop', disallow: 'admin\n/tmp/\n# comment\nhttps://example.com/private?x=1\n/tmp/', allow: '/tmp/public/', blockAi: true });
  assert.match(r.text, /^User-agent: \*\nAllow: \/tmp\/public\/\nDisallow: \/admin\nDisallow: \/tmp\/\nDisallow: \/private\?x=1\n/);
  for (const bot of AI_CRAWLERS) assert.match(r.text, new RegExp(`User-agent: ${bot}\\nDisallow: /\\n`));
  assert.match(r.text, /Sitemap: https:\/\/example\.com\/sitemap\.xml\n$/);
  assert.equal(r.warnings.length, 2); // "admin" gained a slash, the full URL became a path
});

test('robots.txt: dangerous or incomplete setups produce warnings', () => {
  assert.ok(buildRobots({ site: 'example.com', disallow: '/' }).warnings.some((w) => /whole site/.test(w.text)));
  assert.ok(buildRobots({ site: 'example.com', disallow: '/assets/app.js' }).warnings.some((w) => /CSS or JavaScript/.test(w.text)));
  const none = buildRobots({});
  assert.ok(!/Sitemap/.test(none.text)); assert.ok(none.warnings.some((w) => /Sitemap line/.test(w.text)));
  assert.throws(() => buildRobots({ site: 'ftp://example.com' }), /http/);
});

test('sitemap.xml: resolves paths, drops fragments and duplicates, escapes XML', () => {
  const r = buildSitemap({ site: 'https://example.com', pages: '/\nabout\n/about\nhttps://example.com/a?x=1&y=2\nhttps://example.com/#/tools\nhttps://other.org/x\nnot a url but a path with spaces', lastmod: '2026-10-31', changefreq: 'weekly', priority: '0.8' });
  assert.match(r.xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  assert.match(r.xml, /<loc>https:\/\/example\.com\/<\/loc>\n    <lastmod>2026-10-31<\/lastmod>\n    <changefreq>weekly<\/changefreq>\n    <priority>0\.8<\/priority>/);
  assert.match(r.xml, /<loc>https:\/\/example\.com\/a\?x=1&amp;y=2<\/loc>/);
  assert.match(r.xml, /not%20a%20url/);
  assert.equal((r.xml.match(/<loc>/g) || []).length, r.count);
  assert.equal(r.count, 4); // /, /about, /a?x=1&y=2, "/ #/tools" folds into /, spaces path
  assert.ok(r.warnings.some((w) => /another host/.test(w.text)));
  assert.ok(r.warnings.some((w) => /fragment/.test(w.text)));
});

test('sitemap.xml: empty list lists the home page and bad options are rejected', () => {
  assert.match(buildSitemap({ site: 'example.com' }).xml, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.throws(() => buildSitemap({ site: 'example.com', lastmod: '31/10/2026' }), /YYYY-MM-DD/);
  assert.throws(() => buildSitemap({ site: 'example.com', lastmod: '2026-02-31x' }), /YYYY-MM-DD/);
  assert.throws(() => buildSitemap({ site: 'example.com', priority: '2' }), /0.0 to 1.0/);
  assert.throws(() => buildSitemap({ site: '' }), /address of your site/);
  assert.equal(parseSite('Example.com/path?x'), 'https://example.com');
});

/* ------------------------------------------------------------------- EXIF */

const flatten = (p) => (ArrayBuffer.isView(p) ? [...p] : Array.isArray(p) ? p.flatMap(flatten) : [p]);
const bytes = (...parts) => Uint8Array.from(parts.flatMap(flatten));
const be16 = (n) => [n >> 8, n & 255];
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const text = (s) => [...s].map((c) => c.charCodeAt(0));

// Builds a TIFF block. entries: { ifd0: [[tag,type,values]], exif: [...], gps: [...] }. Values: string | number[] | [[num,den]...].
function tiff({ ifd0 = [], exif = [], gps = [], thumbnail = false, little = false }) {
  const w16 = (n) => (little ? [n & 255, n >> 8] : be16(n));
  const w32 = (n) => (little ? [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255] : be32(n));
  const SIZE = { 2: 1, 3: 2, 4: 4, 5: 8 };
  const blocks = [];
  const build = (entries, base) => {
    const sorted = [...entries].sort((a, b) => a[0] - b[0]);
    const head = 2 + sorted.length * 12 + 4;
    let extra = [];
    const rows = sorted.map(([tag, type, value]) => {
      let data;
      if (type === 2) data = [...text(value), 0];
      else if (type === 3) data = [].concat(value).flatMap(w16);
      else if (type === 4) data = [].concat(value).flatMap(w32);
      else data = value.flatMap(([n, d]) => [...w32(n), ...w32(d)]);
      const count = type === 2 ? data.length : data.length / SIZE[type];
      let field;
      if (data.length <= 4) field = [...data, 0, 0, 0, 0].slice(0, 4);
      else { field = w32(base + head + extra.length); extra = extra.concat(data); if (extra.length & 1) extra.push(0); }
      return [...w16(tag), ...w16(type), ...w32(count), ...field];
    });
    return { head, rows, extra };
  };
  // Layout: header(8) | IFD0 | exif IFD | gps IFD | [IFD1]. Pointers are patched in by building IFD0 last.
  let offset = 8;
  const plan = {};
  const ifds = { ifd0, exif, gps };
  const ptr = { exif: exif.length ? 0x8769 : 0, gps: gps.length ? 0x8825 : 0 };
  const ifd0All = [...ifd0, ...(ptr.exif ? [[0x8769, 4, 0]] : []), ...(ptr.gps ? [[0x8825, 4, 0]] : [])];
  const sizeOf = (entries) => { const b = build(entries, 0); return b.head + b.extra.length; };
  plan.ifd0 = offset; offset += sizeOf(ifd0All);
  plan.exif = offset; if (exif.length) offset += sizeOf(exif);
  plan.gps = offset; if (gps.length) offset += sizeOf(gps);
  plan.ifd1 = offset;
  const patched = ifd0All.map((e) => (e[0] === 0x8769 ? [0x8769, 4, plan.exif] : e[0] === 0x8825 ? [0x8825, 4, plan.gps] : e));
  const out = [...(little ? text('II') : text('MM')), ...w16(42), ...w32(plan.ifd0)];
  for (const [key, entries] of [['ifd0', patched], ['exif', exif], ['gps', gps]]) {
    if (key !== 'ifd0' && !ifds[key].length) continue;
    const b = build(entries, plan[key]);
    out.push(...w16(entries.length), ...b.rows.flat(), ...w32(key === 'ifd0' && thumbnail ? plan.ifd1 : 0), ...b.extra);
  }
  if (thumbnail) out.push(...w16(0), ...w32(0));
  return out;
}

const app1 = (tiffBytes) => { const body = [...text('Exif'), 0, 0, ...tiffBytes]; return [0xff, 0xe1, ...be16(body.length + 2), ...body]; };
const segment = (marker, body) => [0xff, marker, ...be16(body.length + 2), ...body];

function fakeJpeg({ exifBlock, extra = [], trailing = [] } = {}) {
  return bytes(
    [0xff, 0xd8],
    segment(0xe0, [...text('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    exifBlock ? app1(exifBlock) : [],
    extra,
    segment(0xdb, [0, ...Array(64).fill(8)]),
    segment(0xc0, [8, 0, 8, 0, 8, 1, 1, 0x11, 0]),
    segment(0xc4, [0, 1, ...Array(16).fill(0).map((_, i) => (i === 0 ? 1 : 0)), 0]),
    segment(0xda, [1, 1, 0, 0, 63, 0]),
    [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56],
    [0xff, 0xd9],
    trailing,
  );
}

const GPS = [
  [1, 2, 'N'], [2, 5, [[52, 1], [13, 1], [5600, 100]]], [3, 2, 'E'], [4, 5, [[21, 1], [0, 1], [4300, 100]]], [5, 3, 0], [6, 5, [[110, 1]]],
];
const CAMERA = {
  ifd0: [[0x010f, 2, 'Canon'], [0x0110, 2, 'EOS R6'], [0x0112, 3, 6], [0x0131, 2, 'Photo Suite 9'], [0x013b, 2, 'Jane Doe']],
  exif: [[0x829a, 5, [[1, 250]]], [0x829d, 5, [[28, 10]]], [0x8827, 3, 400], [0x9003, 2, '2026:05:01 12:30:00'], [0x920a, 5, [[50, 1]]], [0xa431, 2, 'SN123456']],
  gps: GPS,
};

test('exif: reads camera, time, location and privacy risks (both byte orders)', () => {
  for (const little of [false, true]) {
    const r = inspect(fakeJpeg({ exifBlock: tiff({ ...CAMERA, little, thumbnail: true }) }));
    const f = Object.fromEntries(r.fields);
    assert.equal(r.format, 'jpeg');
    assert.equal(f.Camera, 'Canon EOS R6');
    assert.equal(f.Taken, '2026:05:01 12:30:00');
    assert.equal(f.Exposure, '1/250 s'); assert.equal(f.Aperture, 'f/2.8'); assert.equal(f.ISO, '400'); assert.equal(f['Focal length'], '50 mm');
    assert.equal(f.Orientation, 'Rotated 90°'); assert.equal(f['Camera serial number'], 'SN123456');
    assert.ok(Math.abs(r.location.lat - (52 + 13 / 60 + 56 / 3600)) < 1e-9);
    assert.ok(Math.abs(r.location.lon - (21 + 43 / 3600)) < 1e-9);
    assert.deepEqual(r.risks, ['GPS location', 'Camera serial number or owner name', 'Author name', 'Embedded preview image']);
    assert.equal(r.hasMetadata, true);
  }
});

test('exif: southern and western hemispheres are negative', () => {
  const gps = [[1, 2, 'S'], [2, 5, [[33, 1], [52, 1], [0, 1]]], [3, 2, 'W'], [4, 5, [[151, 1], [12, 1], [0, 1]]]];
  const r = inspect(fakeJpeg({ exifBlock: tiff({ gps }) }));
  assert.ok(r.location.lat < 0 && r.location.lon < 0);
});

test('exif: stripping removes metadata, keeps pixels and the segment structure', () => {
  const src = fakeJpeg({ exifBlock: tiff(CAMERA), extra: [segment(0xfe, text('hello')), segment(0xed, text('Photoshop 3.0\0')), segment(0xe1, [...text('http://ns.adobe.com/xap/1.0/\0'), ...text('<x/>')])], trailing: [1, 2, 3, 4] });
  const r = strip(src, { keepOrientation: false });
  assert.deepEqual(r.removed, ['EXIF', 'Comment', 'IPTC / Photoshop', 'XMP', 'Data after the image']);
  const after = inspect(r.bytes);
  assert.deepEqual(after.found, []); assert.equal(after.fields.length, 0); assert.equal(after.hasMetadata, false);
  // JFIF header, tables, frame, scan data (with its FF00 stuffing and RST marker) and EOI survive byte for byte.
  const tail = src.subarray(src.indexOf(0xdb, 20) - 1, src.length - 4);
  assert.ok(Buffer.from(r.bytes).includes(Buffer.from(tail)));
  assert.deepEqual([...r.bytes.slice(-2)], [0xff, 0xd9]);
  assert.deepEqual([...r.bytes.slice(0, 2)], [0xff, 0xd8]);
  assert.ok(r.bytes.length < src.length);
});

test('exif: keeping orientation leaves only that tag', () => {
  const src = fakeJpeg({ exifBlock: tiff(CAMERA) });
  const kept = inspect(strip(src).bytes);
  assert.deepEqual(kept.fields, [['Orientation', 'Rotated 90°']]);
  assert.equal(kept.location, null);
  const upright = tiff({ ifd0: [[0x0112, 3, 1], [0x010f, 2, 'Canon']] });
  assert.deepEqual(inspect(strip(fakeJpeg({ exifBlock: upright })).bytes).found, []);
});

test('exif: a JPEG without metadata comes back unchanged', () => {
  const src = fakeJpeg();
  assert.equal(inspect(src).hasMetadata, false);
  assert.deepEqual(strip(src).bytes, src);
});

const crc32 = (buf) => { let c; let crc = 0xffffffff; for (const byte of buf) { c = (crc ^ byte) & 255; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; };
const pngChunk = (type, data) => bytes(be32(data.length), text(type), data, be32(crc32(bytes(text(type), data))));

test('exif: PNG text, EXIF and time chunks are removed, image chunks are kept', () => {
  const png = bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    pngChunk('IHDR', [...be32(1), ...be32(1), 8, 2, 0, 0, 0]),
    pngChunk('tEXt', [...text('Author'), 0, ...text('Jane Doe')]),
    pngChunk('eXIf', tiff({ ifd0: [[0x010f, 2, 'Canon']], gps: GPS })),
    pngChunk('tIME', [7, 234, 5, 1, 12, 30, 0]),
    pngChunk('iTXt', [...text('XML:com.adobe.xmp'), 0, 0, 0, 0, 0, ...text('<x/>')]),
    pngChunk('IDAT', [8, 0xd7, 0x63, 0x60, 0x60, 0x60, 0, 0, 0, 4, 0, 1]),
    pngChunk('IEND', []),
  );
  const before = inspect(png);
  assert.equal(detectFormat(png), 'png');
  assert.deepEqual(before.found, ['Text notes', 'EXIF', 'Modification time', 'XMP']);
  assert.ok(before.location); assert.deepEqual(before.fields.find((f) => f[0] === 'Author'), ['Author', 'Jane Doe']);
  const r = strip(png);
  assert.deepEqual(r.removed.sort(), ['EXIF', 'Modification time', 'Text notes', 'XMP']);
  assert.equal(inspect(r.bytes).hasMetadata, false);
  const types = []; for (let i = 8; i < r.bytes.length;) { const len = new DataView(r.bytes.buffer, r.bytes.byteOffset + i).getUint32(0); types.push(String.fromCharCode(...r.bytes.subarray(i + 4, i + 8))); i += 12 + len; }
  assert.deepEqual(types, ['IHDR', 'IDAT', 'IEND']);
});

test('exif: WebP EXIF and XMP chunks are removed and the header is fixed up', () => {
  const chunk = (type, data) => bytes(text(type), [data.length & 255, (data.length >> 8) & 255, 0, 0], data, data.length & 1 ? [0] : []);
  const body = bytes(text('WEBP'), chunk('VP8X', [0x0c, 0, 0, 0, 1, 0, 0, 1, 0, 0]), chunk('VP8 ', Array(11).fill(7)), chunk('EXIF', [...text('Exif\0\0'), ...tiff({ gps: GPS })]), chunk('XMP ', text('<x/>')));
  const webp = bytes(text('RIFF'), [body.length & 255, (body.length >> 8) & 255, 0, 0], body);
  const before = inspect(webp);
  assert.equal(before.format, 'webp'); assert.ok(before.location); assert.deepEqual(before.found, ['EXIF', 'XMP']);
  const r = strip(webp);
  assert.deepEqual(r.removed, ['EXIF', 'XMP']);
  assert.equal(inspect(r.bytes).hasMetadata, false);
  assert.equal(r.bytes[12 + 8], 0x00); // VP8X flags cleared
  const riff = r.bytes[4] | (r.bytes[5] << 8);
  assert.equal(riff, r.bytes.length - 8);
});

test('exif: unsupported or damaged files give clear errors', () => {
  assert.throws(() => inspect(bytes(text('GIF89a'))), /JPEG, PNG and WebP/);
  assert.throws(() => strip(bytes([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1])), /damaged/);
  assert.throws(() => inspect(bytes([0xff, 0xd8, 0x00, 0x00])), /damaged/);
  // Garbage inside an EXIF block must not throw: the photo just shows no details.
  const r = inspect(bytes([0xff, 0xd8], app1([0x4d, 0x4d, 0, 42, 0, 0, 0xff, 0xff, 1, 2]), [0xff, 0xd9]));
  assert.equal(r.fields.length, 0);
});

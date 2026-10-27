import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, toCSV, detectDelimiter } from '../public/js/lib/csv.js';
import { createZip, readZip, crc32 } from '../public/js/lib/zip.js';
import { buildXlsx, readXlsx } from '../public/js/lib/xlsx.js';
import { docxToMarkdown, pptxToMarkdown } from '../public/js/lib/office.js';
import { buildEpub, splitChapters } from '../public/js/lib/epub.js';
import { buildVcard } from '../public/js/lib/vcard.js';
import { buildIcs, parseDateCell, escapeIcs, fold } from '../public/js/lib/ics.js';
import { encodeBmp, encodeIco } from '../public/js/lib/bmp.js';

test('csv: quotes, embedded newlines, delimiter detection and round trip', () => {
  const rows = [['a', 'b,c', 'd"e'], ['line\nbreak', '', ' padded ']];
  assert.deepEqual(parseCSV(toCSV(rows)), rows);
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.deepEqual(parseCSV('﻿x\ty\n1\t2\r\n'), [['x', 'y'], ['1', '2']]);
});

test('zip: crc32 known value and write/read round trip', async () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const zip = readZip(createZip([{ name: 'a.txt', data: 'héllo' }, { name: 'dir/b.bin', data: new Uint8Array([1, 2, 3]) }]));
  assert.deepEqual(zip.names, ['a.txt', 'dir/b.bin']);
  assert.equal(await zip.text('a.txt'), 'héllo');
  assert.deepEqual([...await zip.read('dir/b.bin')], [1, 2, 3]);
  assert.throws(() => readZip(new Uint8Array(40)), /ZIP/);
});

test('zip: reads deflate-compressed entries (as produced by Office)', async () => {
  // "hello hello hello" deflated with raw DEFLATE, wrapped by hand in a one-entry zip.
  const data = new TextEncoder().encode('hello hello hello hello');
  const compressed = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  const stored = createZip([{ name: 'x.txt', data }]);
  // Patch the stored archive into a deflated one.
  const name = new TextEncoder().encode('x.txt');
  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true); local.setUint16(8, 8, true); local.setUint32(14, crc32(data), true);
  local.setUint32(18, compressed.length, true); local.setUint32(22, data.length, true); local.setUint16(26, name.length, true);
  const cd = new DataView(new ArrayBuffer(46));
  cd.setUint32(0, 0x02014b50, true); cd.setUint16(10, 8, true); cd.setUint32(16, crc32(data), true);
  cd.setUint32(20, compressed.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, name.length, true);
  const end = new DataView(new ArrayBuffer(22));
  const cdOffset = 30 + name.length + compressed.length;
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, 1, true); end.setUint16(10, 1, true); end.setUint32(12, 46 + name.length, true); end.setUint32(16, cdOffset, true);
  const parts = [new Uint8Array(local.buffer), name, compressed, new Uint8Array(cd.buffer), name, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let p = 0; for (const part of parts) { out.set(part, p); p += part.length; }
  assert.ok(stored.length > 0);
  assert.equal(await readZip(out).text('x.txt'), 'hello hello hello hello');
});

test('xlsx: build then read, including sparse cells and XML escaping', async () => {
  const rows = [['Name', 'Note'], ['A & B', '<x>'], ['', 'last']];
  const read = await readXlsx(buildXlsx(rows, 'Data'));
  assert.equal(read.sheetName, 'Data');
  assert.deepEqual(read.rows, rows);
  await assert.rejects(() => readXlsx(createZip([{ name: 'x', data: 'y' }])), /xlsx/);
});

test('docx and pptx: text, headings, bold, lists, tables, slides', async () => {
  const body = '<w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t xml:space="preserve">Plain </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r></w:p>'
    + '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>item</w:t></w:r></w:p>'
    + '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>H1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>H2</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>a</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>b</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body>';
  const md = await docxToMarkdown(createZip([{ name: 'word/document.xml', data: `<w:document>${body}</w:document>` }]));
  assert.match(md, /^# Title/);
  assert.match(md, /Plain \*\*bold\*\*/);
  assert.match(md, /- item/);
  assert.match(md, /\| H1 \| H2 \|\n\| --- \| --- \|\n\| a \| b \|/);
  const pptx = await pptxToMarkdown(createZip([{ name: 'ppt/slides/slide1.xml', data: '<p:sld><a:p><a:r><a:t>Intro</a:t></a:r></a:p><a:p><a:r><a:t>Point &amp; more</a:t></a:r></a:p></p:sld>' }]));
  assert.match(pptx, /## Slide 1: Intro\n\n- Point & more/);
});

test('epub: chapters, structure and mimetype stored first', async () => {
  assert.deepEqual(splitChapters('# One\ntext\n```\n# not a chapter\n```\n# Two\nmore').map((c) => c.title), ['One', 'Two']);
  const { bytes, chapters } = buildEpub({ title: 'T & Co', author: 'A', markdown: '# One\nhi\n\n# Two\nthere', id: 'id-1' });
  assert.equal(chapters, 2);
  assert.equal(new TextDecoder().decode(bytes.subarray(30, 38)), 'mimetype');
  const zip = readZip(bytes);
  assert.ok(['META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/nav.xhtml', 'OEBPS/chapter2.xhtml'].every((n) => zip.names.includes(n)));
  assert.match(await zip.text('OEBPS/content.opf'), /<dc:title>T &amp; Co<\/dc:title>/);
  assert.throws(() => buildEpub({ title: 'x', markdown: '   ' }), /chapter/i);
});

test('vcard and ics: escaping, folding, dates, all-day events', () => {
  const v = buildVcard({ name: 'Anna Maria Kowalska', email: 'a@x.pl', company: 'ACME; Inc', address: 'Street 1, City' });
  assert.match(v, /N:Kowalska;Anna Maria;;;/);
  assert.match(v, /ORG:ACME\\; Inc/);
  assert.ok(v.endsWith('END:VCARD\r\n'));
  assert.equal(escapeIcs('a,b;c\nd\\'), 'a\\,b\\;c\\nd\\\\');
  assert.ok(fold('x'.repeat(200)).split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75));
  assert.deepEqual(parseDateCell('03.11.2026 09:30'), { y: 2026, mo: 11, d: 3, h: 9, mi: 30, s: 0, hasTime: true });
  assert.equal(parseDateCell('2026-02-31'), null);
  assert.equal(parseDateCell('45000').y, 2023); // Excel serial
  assert.equal(parseDateCell('13/02/2026').mo, 2); // day-first when unambiguous
  const { ics, count, skipped } = buildIcs([['2026-11-03 09:00', '2026-11-03 10:00', 'Meet, team', 'x', 'Room'], ['2026-11-10', '2026-11-12', 'Workshop'], ['bad', '', 'Nope']], { now: new Date('2026-01-01T00:00:00Z') });
  assert.equal(count, 2);
  assert.equal(skipped.length, 1);
  assert.match(ics, /DTSTART:20261103T090000/);
  assert.match(ics, /SUMMARY:Meet\\, team/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261110\r\nDTEND;VALUE=DATE:20261113/);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
});

test('bmp and ico headers', () => {
  const px = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255]);
  const bmp = encodeBmp(px, 2, 2);
  assert.equal(String.fromCharCode(bmp[0], bmp[1]), 'BM');
  assert.equal(bmp.length, 54 + 8 * 2);
  assert.deepEqual([...bmp.subarray(54, 60)], [255, 0, 0, 255, 255, 255]); // bottom row first, BGR: blue then white
  const ico = encodeIco([{ size: 16, png: new Uint8Array([1, 2]) }, { size: 256, png: new Uint8Array([3]) }]);
  assert.equal(ico[4], 2);
  assert.equal(ico[6 + 16], 0); // 256 is stored as 0
});

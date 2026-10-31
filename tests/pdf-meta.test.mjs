import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, clean, PdfError } from '../public/js/lib/pdf-meta.js';
import { enc, dec, CONTENT, classic, compressed } from './pdf-fixtures.mjs';

test('reads the Info dictionary and XMP, and reports risks', async () => {
  const info = await inspect(classic());
  const get = (k) => info.fields.find(([n]) => n === k)?.[1];
  assert.equal(get('Author'), 'Alice Example');
  assert.equal(get('Created with'), 'Word 16');
  assert.equal(get('PDF software'), 'Acme PDF 3');
  assert.equal(get('Created'), '2025-01-02 03:04 (UTC+01:00)');
  assert.equal(info.pages, 1);
  assert.equal(info.xmp, true);
  assert.ok(info.risks.includes('author name') && info.risks.includes('software used') && info.risks.includes('dates'));
});

test('clean removes Info and XMP but keeps the page content byte for byte', async () => {
  const out = await clean(classic());
  const text = dec(out.bytes);
  for (const gone of ['Alice Example', 'Word 16', 'Acme PDF', '/Metadata', '/Info', 'xpacket', 'Budget']) assert.ok(!text.includes(gone), `still contains ${gone}`);
  assert.ok(text.includes(CONTENT));
  const after = await inspect(out.bytes);
  assert.equal(after.pages, 1);
  assert.equal(after.fields.length, 0);
  assert.equal(after.hasMetadata, false);
  assert.deepEqual(out.removed, ['Document properties', 'XMP metadata']);
});

test('every xref offset of the cleaned file points at its object', async () => {
  const text = dec((await clean(classic())).bytes);
  const x = text.lastIndexOf('\nxref\n') + 1;
  const lines = text.slice(x).split('\n');
  const count = Number(lines[1].split(' ')[1]);
  for (let n = 1; n < count; n += 1) {
    const [offset, , flag] = lines[2 + n].split(' ');
    if (flag === 'n') assert.equal(text.slice(Number(offset), Number(offset) + String(n).length + 6), `${n} 0 obj`);
  }
  assert.equal(Number(text.slice(text.lastIndexOf('startxref') + 10).split('\n')[0]), x);
  assert.ok(text.trimEnd().endsWith('%%EOF'));
});

test('earlier saved versions disappear: the old author survives in the input, not in the output', async () => {
  const input = classic({ author: 'Old Name', update: 'New Name' });
  assert.ok(dec(input).includes('Old Name'));
  const info = await inspect(input);
  assert.ok(info.revisions >= 2 && info.olderObjects >= 1);
  assert.ok(info.risks.includes('earlier versions of the document'));
  const out = await clean(input);
  const text = dec(out.bytes);
  assert.ok(!text.includes('Old Name') && !text.includes('New Name'));
  assert.ok(out.removed.includes('Earlier saved versions'));
});

test('object streams and cross-reference streams are unpacked', async () => {
  const input = compressed();
  assert.ok(!dec(input).includes('Bob Builder'));
  const info = await inspect(input);
  assert.equal(info.fields.find(([n]) => n === 'Author')?.[1], 'Bob Builder');
  assert.equal(info.pages, 1);
  const out = await clean(input);
  const text = dec(out.bytes);
  assert.ok(!text.includes('Bob Builder') && !text.includes('LaTeX') && !text.includes('ObjStm') && !text.includes('/XRef'));
  assert.ok(text.includes('/Type /Catalog') && text.includes(CONTENT));
  assert.equal((await inspect(out.bytes)).pages, 1);
});

test('a file without metadata is reported as clean and still rewritten safely', async () => {
  const bare = classic({ xmp: false }).slice();
  const text = dec(bare).replace(/5 0 obj[\s\S]*?endobj\n/, '').replace(' /Info 5 0 R', '');
  const info = await inspect(enc.encode(text));
  assert.equal(info.fields.length, 0);
  assert.equal(info.hasMetadata, false);
});

test('reports comment authors, signatures and PDF/A without changing them', async () => {
  const withAnnot = dec(classic()).replace('/Contents 4 0 R', '/Contents 4 0 R /Annots [7 0 R]').replace('trailer\n<< /Size 7', '7 0 obj\n<< /Type /Annot /Subtype /Text /Rect [0 0 10 10] /T (Reviewer Rae) /Contents (check) >>\nendobj\ntrailer\n<< /Size 8');
  const info = await inspect(enc.encode(withAnnot));
  assert.deepEqual(info.annotAuthors, ['Reviewer Rae']);
  assert.ok(info.risks.includes('comment authors'));
  const signed = dec(classic()).replace('/Type /Page ', '/Type /Page /Sig << /ByteRange [0 1 2 3] >> ');
  assert.equal((await inspect(enc.encode(signed))).signed, true);
  const pdfa = dec(classic()).replace('<xmp:CreatorTool>', '<pdfaid:part>1</pdfaid:part><xmp:CreatorTool>');
  assert.equal((await inspect(enc.encode(pdfa))).pdfa, true);
});

test('refuses encrypted files and things that are not PDFs', async () => {
  const locked = enc.encode(dec(classic()).replace('/Info 5 0 R', '/Info 5 0 R /Encrypt 9 0 R'));
  await assert.rejects(clean(locked), (e) => e instanceof PdfError && /password/i.test(e.message));
  await assert.rejects(inspect(enc.encode('hello world, not a pdf')), PdfError);
  await assert.rejects(inspect(enc.encode('%PDF-1.4\nnothing else here')), PdfError);
});

test('UTF-16 and escaped strings in the Info dictionary are decoded', async () => {
  const hex = 'FEFF' + [...'Zoë Łukasz'].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const src = dec(classic({ xmp: false })).replace('/Author (Alice Example)', `/Author <${hex}> /Subject (Line\\050one\\051 \\(two\\))`).replace(/\/Metadata 6 0 R/, '');
  const info = await inspect(enc.encode(src));
  assert.equal(info.fields.find(([n]) => n === 'Author')[1], 'Zoë Łukasz');
  assert.equal(info.fields.find(([n]) => n === 'Subject')[1], 'Line(one) (two)');
});

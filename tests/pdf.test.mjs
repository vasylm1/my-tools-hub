import test from 'node:test';
import assert from 'node:assert/strict';
import { imagesToPdf } from '../public/js/lib/pdf.js';

test('writes a PDF whose every xref offset points to its object header', () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const bytes = imagesToPdf([{ jpeg, width: 20, height: 10 }], { pageSize: 'fit', margin: 0 });
  const pdf = new TextDecoder('latin1').decode(bytes);
  assert.ok(pdf.startsWith('%PDF-1.4'));
  const xrefAt = pdf.indexOf('xref\n');
  assert.notEqual(xrefAt, -1);
  const lines = pdf.slice(xrefAt).split('\n');
  const [, countText] = lines;
  const count = Number(countText.trim().split(' ')[1]);
  assert.ok(count > 1);
  for (let id = 1; id < count; id++) {
    const offset = Number(lines[2 + id].slice(0, 10));
    assert.equal(pdf.slice(offset, offset + String(id).length + 6), `${id} 0 obj`);
  }
});

test('rejects empty or malformed input pages', () => {
  assert.throws(() => imagesToPdf([]), /page|image/i);
  assert.throws(() => imagesToPdf([{ jpeg: new Uint8Array(), width: 0, height: 2 }]), /page|image|dimension/i);
});

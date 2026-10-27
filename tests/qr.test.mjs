import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeQr } from '../public/js/lib/qr.js';

test('encodes UTF-8 byte mode into a square matrix with finder patterns', () => {
  const { size, modules } = encodeQr('Hello, QR!', 'M');
  assert.equal(size, 21);
  assert.equal(modules.length, size);
  assert.ok(modules.every((row) => Array.isArray(row) && row.length === size));
  assert.deepEqual(modules.slice(0, 7).map((row) => row.slice(0, 7)), [
    [true, true, true, true, true, true, true],
    [true, false, false, false, false, false, true],
    [true, false, true, true, true, false, true],
    [true, false, true, true, true, false, true],
    [true, false, true, true, true, false, true],
    [true, false, false, false, false, false, true],
    [true, true, true, true, true, true, true],
  ]);
});

test('supports a requested ECC level and rejects invalid levels', () => {
  assert.equal(encodeQr('a'.repeat(50), 'H').size, 41);
  assert.throws(() => encodeQr('text', 'X'), /ECC|error correction/i);
});

test('provides SVG and canvas drawing helpers', async () => {
  const qr = await import('../public/js/lib/qr.js');
  const matrix = encodeQr('Hi', 'L');
  assert.match(qr.qrToSvg(matrix, { quietZone: 4 }), /^<svg\b/);
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, beginPath() {}, rect() {}, fill() {}, set fillStyle(_) {} }) };
  assert.equal(qr.drawQr(canvas, matrix, { scale: 3, quietZone: 2 }), canvas);
  assert.ok(canvas.width > matrix.size);
});

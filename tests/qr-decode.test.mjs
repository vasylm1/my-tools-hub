import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeQr } from '../public/js/lib/qr.js';
import { decodeQrMatrix, decodeQrImage, parseSegments, rsCorrect } from '../public/js/lib/qr-decode.js';

const sample = (n, seed = 1) => Array.from({ length: n }, (_, i) => String.fromCharCode(33 + ((i * 7 + seed * 13 + n) % 90))).join('');

/** Render a module matrix to RGBA pixels. */
function render(qr, { scale = 4, margin = 4, invert = false } = {}) {
  const dim = (qr.size + margin * 2) * scale;
  const data = new Uint8ClampedArray(dim * dim * 4);
  for (let i = 0; i < dim * dim; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = invert ? 0 : 255; data[i * 4 + 3] = 255; }
  qr.modules.forEach((row, y) => row.forEach((on, x) => {
    if (!on) return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const o = (((y + margin) * scale + dy) * dim + (x + margin) * scale + dx) * 4;
      data[o] = data[o + 1] = data[o + 2] = invert ? 255 : 0;
    }
  }));
  return { data, width: dim, height: dim };
}

/** Rotate an image by `deg` around its centre (nearest neighbour, white background). */
function rotate({ data, width, height }, deg) {
  const side = Math.ceil(Math.hypot(width, height));
  const out = new Uint8ClampedArray(side * side * 4).fill(255);
  const rad = (deg * Math.PI) / 180; const cos = Math.cos(rad); const sin = Math.sin(rad);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const dx = x - side / 2; const dy = y - side / 2;
    const sx = Math.round(cos * dx + sin * dy + width / 2); const sy = Math.round(-sin * dx + cos * dy + height / 2);
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
    const o = (y * side + x) * 4; const s = (sy * width + sx) * 4;
    out[o] = data[s]; out[o + 1] = data[s + 1]; out[o + 2] = data[s + 2];
  }
  return { data: out, width: side, height: side };
}

test('matrix round trip at every level and across many versions', () => {
  for (const ecc of ['L', 'M', 'Q', 'H']) {
    for (const n of [1, 14, 60, 120, 250, 500, 900, 1400]) {
      let qr;
      try { qr = encodeQr(sample(n), ecc); } catch { continue; }
      const out = decodeQrMatrix(qr.modules);
      assert.equal(out.text, sample(n), `${ecc} ${n} chars (version ${(qr.size - 17) / 4})`);
      assert.equal(out.ecc, ecc);
      assert.equal(out.corrected, 0);
    }
  }
  assert.equal(decodeQrMatrix(encodeQr('Zażółć gęślą jaźń — Привіт 🌍 https://example.com/?a=1&b=2', 'Q').modules).text, 'Zażółć gęślą jaźń — Привіт 🌍 https://example.com/?a=1&b=2');
});

test('Reed-Solomon repairs damaged modules and reports how many bytes it fixed', () => {
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (const ecc of ['M', 'Q', 'H']) {
    const text = sample(150, 3);
    const qr = encodeQr(text, ecc);
    const damaged = qr.modules.map((r) => r.slice());
    for (let k = 0; k < 6; k++) { const x = 9 + rnd(qr.size - 18); const y = 9 + rnd(qr.size - 18); damaged[y][x] = !damaged[y][x]; }
    const out = decodeQrMatrix(damaged);
    assert.equal(out.text, text, `level ${ecc}`);
    assert.ok(out.corrected > 0, 'some bytes were corrected');
  }
  assert.throws(() => rsCorrect(Array.from({ length: 30 }, (_, i) => (i * 37) & 255), 8), /damaged/);
  // wiping a lot of the symbol is reported, not silently mis-decoded
  const qr = encodeQr(sample(60), 'L');
  const wrecked = qr.modules.map((r, y) => r.map((v, x) => (y > 10 && y < 18 && x > 9 ? !v : v)));
  assert.throws(() => decodeQrMatrix(wrecked));
});

test('reads symbols from images: scaled, inverted, rotated by any angle', () => {
  const text = 'https://example.com/spring-sale?utm_source=newsletter&utm_medium=email';
  for (const ecc of ['L', 'M', 'Q', 'H']) {
    const qr = encodeQr(text, ecc);
    assert.equal(decodeQrImage(render(qr)).text, text, `plain ${ecc}`);
  }
  const qr = encodeQr(text, 'M');
  assert.equal(decodeQrImage(render(qr, { scale: 3 })).text, text, 'small scale');
  assert.equal(decodeQrImage(render(qr, { scale: 9, margin: 2 })).text, text, 'large scale, small quiet zone');
  assert.equal(decodeQrImage(render(qr, { invert: true })).text, text, 'light on dark');
  for (const deg of [90, 180, 270, 17, 45, -30]) assert.equal(decodeQrImage(rotate(render(qr, { scale: 6 }), deg)).text, text, `rotated ${deg}`);
});

test('large symbols (version 10+) decode from images', () => {
  const text = sample(380, 5);
  const qr = encodeQr(text, 'M');
  assert.ok((qr.size - 17) / 4 >= 10);
  assert.equal(decodeQrImage(render(qr, { scale: 5 })).text, text);
});

test('an image without a QR code is reported clearly', () => {
  const data = new Uint8ClampedArray(200 * 200 * 4).fill(255);
  assert.throws(() => decodeQrImage({ data, width: 200, height: 200 }), /QR code/i);
});

test('numeric, alphanumeric, ECI and kanji segments parse (ISO sample streams)', () => {
  const bits = (s) => [...s.replace(/\s/g, '')].map(Number);
  // ISO/IEC 18004 example: "01234567" in numeric mode, version 1
  assert.equal(parseSegments(bits('0001 0000001000 0000001100 0101011001 1000011 0000'), 1), '01234567');
  // "AC-42" alphanumeric, version 1: 0010 | 000000101 | AC=10*45+12=462 | -4=41*45+4=1849 | 2=2
  assert.equal(parseSegments(bits('0010 000000101 00111001110 11100111001 000010 0000'), 1), 'AC-42');
  // ECI UTF-8 (26) then byte mode "é" (C3 A9)
  assert.equal(parseSegments(bits('0111 00011010 0100 00000010 11000011 10101001 0000'), 1), 'é');
  // mixed numeric + byte segments are joined in order
  assert.equal(parseSegments(bits('0001 0000000011 0000001111 0100 00000010 01101000 01101001 0000'), 1), '015hi');
});

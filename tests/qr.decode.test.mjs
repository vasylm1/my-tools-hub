// Decodes generated QR symbols with an independent decoder (jsQR). jsQR is deliberately NOT a dependency of this repo:
// install it in a scratch directory and point JSQR_PATH at its entry file, e.g.
//   JSQR_PATH=/tmp/scratch/node_modules/jsqr/dist/jsQR.js npm test
// Without JSQR_PATH these tests are skipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { encodeQr } from '../public/js/lib/qr.js';

let jsQR = null;
if (process.env.JSQR_PATH) {
  try { jsQR = (await import(pathToFileURL(process.env.JSQR_PATH).href)).default; } catch { /* unreadable path: tests are skipped */ }
}

function render(qr, scale = 4, margin = 4) {
  const dim = (qr.size + margin * 2) * scale;
  const px = new Uint8ClampedArray(dim * dim * 4).fill(255);
  qr.modules.forEach((row, y) => row.forEach((on, x) => {
    if (!on) return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const o = (((y + margin) * scale + dy) * dim + (x + margin) * scale + dx) * 4;
      px[o] = px[o + 1] = px[o + 2] = 0;
    }
  }));
  return { px, dim };
}

test('jsQR decodes every level at sizes spanning many QR versions', { skip: !jsQR }, () => {
  for (const ecl of ['L', 'M', 'Q', 'H']) {
    for (const n of [1, 14, 60, 120, 250, 400, 700, 1000, 1500, 2000]) {
      const text = Array.from({ length: n }, (_, i) => String.fromCharCode(33 + ((i * 7 + n) % 90))).join('');
      let qr;
      try { qr = encodeQr(text, ecl); } catch { continue; } // too long for this level
      const { px, dim } = render(qr);
      assert.equal(jsQR(px, dim, dim)?.data, text, `level ${ecl}, ${n} chars, ${qr.size}x${qr.size}`);
    }
  }
});

test('jsQR decodes unicode and URLs', { skip: !jsQR }, () => {
  const text = 'Zażółć gęślą jaźń — Привіт 🌍 https://example.com/?a=1&b=2';
  const { px, dim } = render(encodeQr(text, 'Q'));
  assert.equal(jsQR(px, dim, dim)?.data, text);
});

// QR code reader (ISO/IEC 18004): locates the symbol in an image, samples the module grid, corrects errors
// with Reed-Solomon and decodes numeric, alphanumeric, byte, kanji and ECI segments. No dependencies.
// It handles clean, roughly square-on symbols (screenshots, exports, flat scans, rotated codes). For difficult
// photos the tool tries the browser's own scanner first.

/* ---------------------------------------------------------------- GF(256) + Reed-Solomon */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
const div = (a, b) => (a ? EXP[LOG[a] + 255 - LOG[b]] : 0);
const inv = (a) => EXP[255 - LOG[a]];

/** Correct a Reed-Solomon codeword (data bytes then `nEcc` check bytes). Throws if it cannot be repaired. */
export function rsCorrect(cw, nEcc) {
  const n = cw.length;
  const syndromes = (word) => Array.from({ length: nEcc }, (_, j) => { let acc = 0; for (let i = 0; i < n; i++) acc = mul(acc, EXP[j]) ^ word[i]; return acc; });
  const S = syndromes(cw);
  if (S.every((v) => v === 0)) return cw.slice();

  // Berlekamp-Massey: error locator polynomial C (lowest degree first)
  let C = [1]; let B = [1]; let L = 0; let m = 1; let b = 1;
  for (let k = 0; k < nEcc; k++) {
    let d = S[k];
    for (let i = 1; i <= L; i++) d ^= mul(C[i] || 0, S[k - i]);
    if (d === 0) { m++; continue; }
    const T = C.slice();
    const coef = mul(d, inv(b));
    while (C.length < B.length + m) C.push(0);
    for (let i = 0; i < B.length; i++) C[i + m] ^= mul(coef, B[i]);
    if (2 * L <= k) { L = k + 1 - L; B = T; b = d; m = 1; } else m++;
  }
  while (C.length > 1 && C[C.length - 1] === 0) C.pop();
  if (L * 2 > nEcc || C.length - 1 !== L) throw new Error('Too many damaged modules to repair.');

  // Chien search: a coefficient at power p is wrong when C(alpha^-p) = 0
  const positions = [];
  for (let p = 0; p < n; p++) {
    const x = EXP[(255 - (p % 255)) % 255];
    let acc = 0;
    for (let i = C.length - 1; i >= 0; i--) acc = mul(acc, x) ^ C[i];
    if (acc === 0) positions.push(p);
  }
  if (positions.length !== L) throw new Error('Too many damaged modules to repair.');

  // Forney: error magnitudes from the evaluator polynomial
  const omega = new Array(nEcc).fill(0);
  for (let i = 0; i < nEcc; i++) for (let j = 0; j < C.length && i + j < nEcc; j++) omega[i + j] ^= mul(S[i], C[j]);
  const out = cw.slice();
  for (const p of positions) {
    const xInv = EXP[(255 - (p % 255)) % 255];
    let num = 0;
    for (let i = omega.length - 1; i >= 0; i--) num = mul(num, xInv) ^ omega[i];
    let den = 0;
    for (let i = 1; i < C.length; i += 2) den ^= mul(C[i], EXP[(LOG[xInv] * (i - 1)) % 255]);
    if (!den) throw new Error('Too many damaged modules to repair.');
    out[n - 1 - p] ^= mul(EXP[p % 255], div(num, den));
  }
  if (!syndromes(out).every((v) => v === 0)) throw new Error('Too many damaged modules to repair.');
  return out;
}

/* ---------------------------------------------------------------- symbol structure tables */

const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];
const LEVELS = ['L', 'M', 'Q', 'H'];
const FORMAT_TO_LEVEL = { 1: 0, 0: 1, 3: 2, 2: 3 }; // 2 format bits -> index into LEVELS

function rawDataModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) { const na = Math.floor(ver / 7) + 2; r -= (25 * na - 10) * na - 55; if (ver >= 7) r -= 36; }
  return r;
}

function alignmentPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 10; result.length < n; pos -= step) result.splice(1, 0, pos);
  return result;
}

/** Which modules are function patterns (finders, timing, alignment, format, version) rather than data. */
function functionMask(ver) {
  const size = ver * 4 + 17;
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y) => { if (x >= 0 && x < size && y >= 0 && y < size) fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i); set(i, 6); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) set(cx + dx, cy + dy);
  const ap = alignmentPositions(ver);
  ap.forEach((ax, i) => ap.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy);
  }));
  for (let i = 0; i < 9; i++) { set(8, i); set(i, 8); }
  for (let i = 0; i < 8; i++) { set(size - 1 - i, 8); set(8, size - 1 - i); }
  if (ver >= 7) for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3); const b = Math.floor(i / 3); set(a, b); set(b, a); }
  return fn;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

const FORMAT_CODES = (() => {
  const codes = [];
  for (let d = 0; d < 32; d++) {
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    codes.push({ data: d, bits: ((d << 10) | rem) ^ 0x5412 });
  }
  return codes;
})();
const popcount = (n) => { let c = 0; for (let x = n; x; x &= x - 1) c++; return c; };

function readFormat(m, size) {
  const bit = (x, y) => (m[y][x] ? 1 : 0);
  let a = 0;
  for (let i = 0; i <= 5; i++) a |= bit(8, i) << i;
  a |= bit(8, 7) << 6; a |= bit(8, 8) << 7; a |= bit(7, 8) << 8;
  for (let i = 9; i < 15; i++) a |= bit(14 - i, 8) << i;
  let b = 0;
  for (let i = 0; i < 8; i++) b |= bit(size - 1 - i, 8) << i;
  for (let i = 8; i < 15; i++) b |= bit(8, size - 15 + i) << i;
  let best = null;
  for (const c of FORMAT_CODES) {
    const dist = Math.min(popcount(c.bits ^ a), popcount(c.bits ^ b));
    if (dist <= 3 && (!best || dist < best.dist)) best = { dist, data: c.data };
  }
  if (!best) throw new Error('Format information is unreadable.');
  return { ecc: FORMAT_TO_LEVEL[best.data >> 3], mask: best.data & 7 };
}

/* ---------------------------------------------------------------- data segments */

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const decodeBytes = (bytes, charset) => {
  if (charset) { try { return new TextDecoder(charset).decode(bytes); } catch { /* fall through */ } }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new TextDecoder('iso-8859-1').decode(bytes); }
};

/** Parse the data bit stream (array of 0/1) into text. */
export function parseSegments(bits, version) {
  let pos = 0;
  const read = (n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | (bits[pos++] ?? 0); return v; };
  const countBits = (mode) => {
    const table = { 1: [10, 12, 14], 2: [9, 11, 13], 4: [8, 16, 16], 8: [8, 10, 12] }[mode];
    return table[version <= 9 ? 0 : version <= 26 ? 1 : 2];
  };
  let text = '';
  let charset = null;
  while (pos + 4 <= bits.length) {
    const mode = read(4);
    if (mode === 0) break;
    if (mode === 7) { // ECI
      let d = read(8);
      if ((d & 0x80) === 0) { /* one byte */ } else if ((d & 0xc0) === 0x80) d = ((d & 0x3f) << 8) | read(8); else d = ((d & 0x1f) << 16) | read(16);
      charset = { 26: 'utf-8', 3: 'iso-8859-1', 20: 'shift_jis', 4: 'iso-8859-2', 22: 'windows-1251', 23: 'windows-1252' }[d] || null;
      continue;
    }
    if (![1, 2, 4, 8].includes(mode)) throw new Error('Unsupported data mode in this QR code.');
    const count = read(countBits(mode));
    if (mode === 1) {
      let left = count;
      while (left >= 3) { text += String(read(10)).padStart(3, '0'); left -= 3; }
      if (left === 2) text += String(read(7)).padStart(2, '0'); else if (left === 1) text += String(read(4));
    } else if (mode === 2) {
      let left = count;
      while (left >= 2) { const v = read(11); text += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45]; left -= 2; }
      if (left === 1) text += ALNUM[read(6)];
    } else if (mode === 4) {
      const bytes = new Uint8Array(count);
      for (let i = 0; i < count; i++) bytes[i] = read(8);
      text += decodeBytes(bytes, charset);
    } else {
      const bytes = new Uint8Array(count * 2);
      for (let i = 0; i < count; i++) {
        const v = read(13);
        let sj = (Math.floor(v / 0xc0) << 8) | (v % 0xc0);
        sj += sj < 0x1f00 ? 0x8140 : 0xc140;
        bytes[2 * i] = sj >> 8; bytes[2 * i + 1] = sj & 0xff;
      }
      text += decodeBytes(bytes, 'shift_jis');
    }
  }
  return text;
}

/* ---------------------------------------------------------------- matrix -> text */

/**
 * Decode a sampled module grid.
 * @param {boolean[][]} modules  square matrix, true = dark
 * @returns {{ text: string, version: number, ecc: 'L'|'M'|'Q'|'H', mask: number, corrected: number }}
 */
export function decodeQrMatrix(modules) {
  const size = modules.length;
  if (size < 21 || size > 177 || (size - 17) % 4 !== 0 || modules.some((r) => r.length !== size)) throw new Error('This is not a valid QR code size.');
  const version = (size - 17) / 4;
  const { ecc, mask } = readFormat(modules, size);
  const fn = functionMask(version);
  const total = Math.floor(rawDataModules(version) / 8);
  const raw = new Array(total).fill(0);
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fn[y][x] && i < total * 8) {
          const bit = (modules[y][x] ? 1 : 0) ^ (MASKS[mask](x, y) ? 1 : 0);
          raw[i >>> 3] |= bit << (7 - (i & 7));
          i++;
        }
      }
    }
  }
  // undo the block interleaving
  const nBlocks = NUM_BLOCKS[ecc][version];
  const eccLen = ECC_PER_BLOCK[ecc][version];
  const numShort = nBlocks - (total % nBlocks);
  const shortLen = Math.floor(total / nBlocks);
  const blocks = Array.from({ length: nBlocks }, () => new Array(shortLen + 1));
  let idx = 0;
  for (let k = 0; k <= shortLen; k++) {
    for (let j = 0; j < nBlocks; j++) {
      if (k === shortLen - eccLen && j < numShort) continue;
      blocks[j][k] = raw[idx++];
    }
  }
  const data = [];
  let corrected = 0;
  blocks.forEach((blk, j) => {
    const dataLen = shortLen - eccLen + (j < numShort ? 0 : 1);
    const cw = [...blk.slice(0, dataLen), ...blk.slice(shortLen - eccLen + 1, shortLen + 1)];
    const fixed = rsCorrect(cw, eccLen);
    corrected += fixed.reduce((n, v, k) => n + (v !== cw[k] ? 1 : 0), 0);
    data.push(...fixed.slice(0, dataLen));
  });
  const bits = [];
  for (const byte of data) for (let b = 7; b >= 0; b--) bits.push((byte >> b) & 1);
  return { text: parseSegments(bits, version), version, ecc: LEVELS[ecc], mask, corrected };
}

/* ---------------------------------------------------------------- image -> module grid */

export function toGray({ data, width, height }) {
  const g = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    const a = data[p + 3] / 255;
    g[i] = Math.round((0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) * a + 255 * (1 - a));
  }
  return g;
}

function otsu(gray) {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0; let wB = 0; let best = 0; let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) { best = between; threshold = t; }
  }
  return threshold;
}

/** Binary image (1 = dark) by a global threshold, or by comparing each pixel with its local average. */
export function binarize(gray, width, height, mode) {
  const out = new Uint8Array(gray.length);
  if (mode === 'global') {
    const t = otsu(gray);
    for (let i = 0; i < gray.length; i++) out[i] = gray[i] <= t ? 1 : 0;
    return out;
  }
  const win = Math.max(15, Math.round(Math.min(width, height) / 8)) | 1;
  const half = win >> 1;
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) { row += gray[y * width + x]; integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row; }
  }
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half); const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half); const x1 = Math.min(width, x + half + 1);
      const sum = integral[y1 * (width + 1) + x1] - integral[y0 * (width + 1) + x1] - integral[y1 * (width + 1) + x0] + integral[y0 * (width + 1) + x0];
      out[y * width + x] = gray[y * width + x] < (sum / ((x1 - x0) * (y1 - y0))) * 0.92 ? 1 : 0;
    }
  }
  return out;
}

/** Does a 5-run sequence of lengths look like the 1:1:3:1:1 finder pattern? Returns the module size or 0. */
function finderRatio(l) {
  const total = l[0] + l[1] + l[2] + l[3] + l[4];
  if (total < 7) return 0;
  const ms = total / 7;
  const tol = ms * 0.55;
  const ok = Math.abs(l[0] - ms) < tol && Math.abs(l[1] - ms) < tol && Math.abs(l[2] - 3 * ms) < tol * 3 && Math.abs(l[3] - ms) < tol && Math.abs(l[4] - ms) < tol;
  return ok ? ms : 0;
}

function verticalCheck(bw, w, h, cx, y, ms) {
  const at = (yy) => bw[yy * w + cx];
  const walk = (start, dir, color) => { let n = 0; for (let yy = start; yy >= 0 && yy < h && at(yy) === color; yy += dir) n++; return n; };
  const upC = walk(y, -1, 1);
  const upL = walk(y - upC, -1, 0);
  const upD = walk(y - upC - upL, -1, 1);
  const downC = walk(y + 1, 1, 1);
  const downL = walk(y + 1 + downC, 1, 0);
  const downD = walk(y + 1 + downC + downL, 1, 1);
  const lens = [upD, upL, upC + downC, downL, downD];
  if (lens.some((v) => v === 0)) return null;
  const vms = finderRatio(lens);
  if (!vms || Math.abs(vms - ms) > ms * 0.6) return null;
  return { cy: y - upC + 1 + (upC + downC) / 2, ms: vms };
}

export function findFinderPatterns(bw, w, h) {
  const found = [];
  for (let y = 0; y < h; y++) {
    const runs = [];
    let x = 0;
    while (x < w) {
      const color = bw[y * w + x];
      let n = 0;
      const start = x;
      while (x < w && bw[y * w + x] === color) { x++; n++; }
      runs.push({ color, start, n });
    }
    for (let i = 0; i + 4 < runs.length; i++) {
      if (runs[i].color !== 1) continue;
      const lens = [runs[i].n, runs[i + 1].n, runs[i + 2].n, runs[i + 3].n, runs[i + 4].n];
      const ms = finderRatio(lens);
      if (!ms) continue;
      const cx = Math.round(runs[i].start + lens.reduce((a, b) => a + b, 0) / 2);
      const v = verticalCheck(bw, w, h, Math.min(w - 1, cx), y, ms);
      if (!v) continue;
      const hit = found.find((f) => Math.hypot(f.x - cx, f.y - v.cy) < Math.max(ms, f.ms) * 3);
      if (hit) { hit.x = (hit.x * hit.count + cx) / (hit.count + 1); hit.y = (hit.y * hit.count + v.cy) / (hit.count + 1); hit.ms = (hit.ms * hit.count + ms) / (hit.count + 1); hit.count++; } else found.push({ x: cx, y: v.cy, ms, count: 1 });
    }
  }
  return found.filter((f) => f.count >= 2).sort((a, b) => b.count - a.count).slice(0, 9);
}

/** Pick three finder patterns that form the corners of one symbol and name them. */
export function rankCorners(finders) {
  const ranked = [];
  for (let a = 0; a < finders.length; a++) {
    for (let b = a + 1; b < finders.length; b++) {
      for (let c = b + 1; c < finders.length; c++) {
        const trio = [finders[a], finders[b], finders[c]];
        const sizes = trio.map((f) => f.ms);
        if (Math.max(...sizes) > Math.min(...sizes) * 1.6) continue;
        for (let k = 0; k < 3; k++) {
          const tl = trio[k]; const p = trio[(k + 1) % 3]; const q = trio[(k + 2) % 3];
          const v1 = [p.x - tl.x, p.y - tl.y]; const v2 = [q.x - tl.x, q.y - tl.y];
          const l1 = Math.hypot(...v1); const l2 = Math.hypot(...v2);
          if (!l1 || !l2) continue;
          const cos = Math.abs((v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2));
          const legs = Math.abs(l1 - l2) / Math.max(l1, l2);
          if (cos > 0.3 || legs > 0.35) continue;
          const cross = v1[0] * v2[1] - v1[1] * v2[0];
          ranked.push({ score: cos + legs - (trio[0].count + trio[1].count + trio[2].count) / 5000, tl, tr: cross > 0 ? p : q, bl: cross > 0 ? q : p });
        }
      }
    }
  }
  return ranked.sort((a, b) => a.score - b.score);
}

export const chooseCorners = (finders) => rankCorners(finders)[0] || null;

/** Distance from a finder centre, along (dx, dy), to the outer edge of its 7-module pattern (3.5 modules), or null. */
function walkToEdge(bw, w, h, cx, cy, dx, dy, maxDist) {
  const at = (x, y) => { const px = Math.round(x); const py = Math.round(y); return px < 0 || py < 0 || px >= w || py >= h ? 0 : bw[py * w + px]; };
  if (at(cx, cy) !== 1) return null;
  let prev = 1; let transitions = 0;
  for (let t = 0.25; t <= maxDist; t += 0.25) {
    const v = at(cx + dx * t, cy + dy * t);
    if (v !== prev) { transitions++; if (transitions === 3) return t; prev = v; }
  }
  return null;
}

/**
 * Sharpen the three finder centres and measure the module size along the symbol's own axes. A finder is exactly
 * 7 modules wide in that direction, whatever the rotation, which row scans cannot tell us.
 */
function refineCorners(bw, w, h, corners) {
  const unitVec = (a, b) => { const l = Math.hypot(b.x - a.x, b.y - a.y); return [(b.x - a.x) / l, (b.y - a.y) / l]; };
  const u = unitVec(corners.tl, corners.tr);
  const v = unitVec(corners.tl, corners.bl);
  const reach = ((corners.tl.ms + corners.tr.ms + corners.bl.ms) / 3) * 5;
  const centres = ['tl', 'tr', 'bl'].map((k) => ({ x: corners[k].x, y: corners[k].y }));
  const units = [];
  for (const c of centres) {
    for (let pass = 0; pass < 2; pass++) {
      for (const [dx, dy] of [u, v]) {
        const fwd = walkToEdge(bw, w, h, c.x, c.y, dx, dy, reach);
        const bwd = walkToEdge(bw, w, h, c.x, c.y, -dx, -dy, reach);
        if (fwd && bwd) { c.x += (dx * (fwd - bwd)) / 2; c.y += (dy * (fwd - bwd)) / 2; }
      }
    }
    for (const [dx, dy] of [u, v, [-u[0], -u[1]], [-v[0], -v[1]]]) {
      const d = walkToEdge(bw, w, h, c.x, c.y, dx, dy, reach);
      if (d) units.push(d / 3.5);
    }
  }
  if (units.length < 4) return null;
  units.sort((a, b) => a - b);
  return { tl: { ...corners.tl, ...centres[0] }, tr: { ...corners.tr, ...centres[1] }, bl: { ...corners.bl, ...centres[2] }, unit: units[units.length >> 1] };
}

export function sampleGrid(bw, w, h, corners) {
  const refined = refineCorners(bw, w, h, corners);
  const { tl, tr, bl } = refined || corners;
  const dist = (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(bl.x - tl.x, bl.y - tl.y)) / 2;
  const unitPx = refined ? refined.unit : ((tl.ms + tr.ms + bl.ms) / 3);
  const version = Math.round((dist / unitPx + 7 - 17) / 4);
  if (version < 1 || version > 40) throw new Error('Could not work out the size of the QR code.');
  const dim = version * 4 + 17;
  const span = dim - 7;
  const at = (px, py) => {
    const x = Math.round(px); const y = Math.round(py);
    return x < 0 || y < 0 || x >= w || y >= h ? 0 : bw[y * w + x];
  };
  const grid = Array.from({ length: dim }, () => new Array(dim).fill(false));
  const unit = dist / span; // pixels per module
  const off = unit >= 4 ? unit / 4 : 0;
  for (let v = 0; v < dim; v++) {
    for (let u = 0; u < dim; u++) {
      const fx = (u + 0.5 - 3.5) / span; const fy = (v + 0.5 - 3.5) / span;
      const px = tl.x + fx * (tr.x - tl.x) + fy * (bl.x - tl.x);
      const py = tl.y + fx * (tr.y - tl.y) + fy * (bl.y - tl.y);
      let dark = at(px, py);
      if (off) {
        // majority of five samples is steadier on blurry or scaled images
        const ax = (tr.x - tl.x) / span * 0.25; const ay = (tr.y - tl.y) / span * 0.25;
        const bx = (bl.x - tl.x) / span * 0.25; const by = (bl.y - tl.y) / span * 0.25;
        dark += at(px + ax, py + ay) + at(px - ax, py - ay) + at(px + bx, py + by) + at(px - bx, py - by);
        grid[v][u] = dark >= 3;
      } else grid[v][u] = dark === 1;
    }
  }
  return grid;
}

/**
 * Find and decode a QR code in an image.
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} image  RGBA pixels (e.g. ImageData)
 */
export function decodeQrImage(image) {
  const { width, height } = image;
  const gray = toGray(image);
  let lastError = new Error('No QR code was found in this image.');
  for (const mode of ['global', 'local']) {
    for (const invert of [false, true]) {
      let bw = binarize(gray, width, height, mode);
      if (invert) bw = bw.map((v) => 1 - v);
      try {
        const finders = findFinderPatterns(bw, width, height);
        for (const candidate of rankCorners(finders).slice(0, 8)) {
          try { return decodeQrMatrix(sampleGrid(bw, width, height, candidate)); } catch (e) { lastError = e; }
        }
      } catch (e) { lastError = e; }
    }
  }
  throw lastError;
}

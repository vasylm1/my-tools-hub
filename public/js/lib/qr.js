const ECC_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT = { L: 1, M: 0, Q: 3, H: 2 };
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

function rawModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version, ecc) {
  return Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK[ecc][version] * BLOCKS[ecc][version];
}

function appendBits(out, value, length) {
  for (let i = length - 1; i >= 0; i--) out.push((value >>> i) & 1);
}

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  const result = Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 2);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = Array(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let i = 0; i < result.length; i++) result[i] ^= gfMultiply(divisor[i], factor);
  }
  return result;
}

function addEcc(data, version, ecc) {
  const blocks = BLOCKS[ecc][version];
  const eccLen = ECC_PER_BLOCK[ecc][version];
  const raw = Math.floor(rawModules(version) / 8);
  const shortCount = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const divisor = rsDivisor(eccLen);
  const groups = [];
  let cursor = 0;
  for (let i = 0; i < blocks; i++) {
    const part = data.slice(cursor, cursor + shortLen - eccLen + (i < shortCount ? 0 : 1));
    cursor += part.length;
    const check = rsRemainder(part, divisor);
    if (i < shortCount) part.push(0);
    groups.push(part.concat(check));
  }
  const interleaved = [];
  for (let i = 0; i < groups[0].length; i++) {
    for (let j = 0; j < groups.length; j++) {
      if (i !== shortLen - eccLen || j >= shortCount) interleaved.push(groups[j][i]);
    }
  }
  return interleaved;
}

function alignmentPositions(version, size) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const positions = [6];
  for (let pos = size - 7; positions.length < count; pos -= step) positions.splice(1, 0, pos);
  return positions;
}

function makeMatrix(version, codewords, ecc, mask) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => Array(size).fill(false));
  const set = (x, y, value, isFixed = true) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = value;
    if (isFixed) fixed[y][x] = true;
  };

  const finder = (cx, cy) => {
    for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
      const x = cx + dx; const y = cy + dy;
      const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark = inside && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      set(x, y, dark);
    }
  };
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
  for (let i = 8; i < size - 8; i++) {
    set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0);
  }

  const positions = alignmentPositions(version, size);
  for (let yi = 0; yi < positions.length; yi++) for (let xi = 0; xi < positions.length; xi++) {
    const x = positions[xi]; const y = positions[yi];
    const last = positions.length - 1;
    if ((xi === 0 && yi === 0) || (xi === 0 && yi === last) || (xi === last && yi === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  // Reserve format cells, then fill the version code for larger symbols.
  const format = (selectedMask) => {
    const data = (ECC_FORMAT[Object.keys(ECC_INDEX)[ecc]] << 3) | selectedMask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  for (let i = 0; i < 15; i++) {
    if (i < 6) set(8, i, false);
    else if (i < 8) set(8, i + 1, false);
    else if (i === 8) set(7, 8, false);
    else set(14 - i, 8, false);
    if (i < 8) set(size - 1 - i, 8, false);
    else set(8, size - 15 + i, false);
  }
  set(8, size - 8, true);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ (((rem >>> 11) & 1) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const value = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3); const b = Math.floor(i / 3);
      set(a, b, value); set(b, a, value);
    }
  }

  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (fixed[y][x]) continue;
        let dark = bitIndex < codewords.length * 8 && ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
        bitIndex++;
        const invert = [
          (x + y) % 2 === 0,
          y % 2 === 0,
          x % 3 === 0,
          (x + y) % 3 === 0,
          (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
          (x * y) % 2 + (x * y) % 3 === 0,
          ((x * y) % 2 + (x * y) % 3) % 2 === 0,
          ((x + y) % 2 + (x * y) % 3) % 2 === 0,
        ][mask];
        modules[y][x] = dark !== invert;
      }
    }
  }
  format(mask);
  return modules;
}

function penalty(matrix) {
  const size = matrix.length;
  let score = 0;
  const lines = [...matrix, ...matrix.map((_, x) => matrix.map((row) => row[x]))];
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else { if (run >= 5) score += run - 2; run = 1; }
    }
    const bits = line.map(Number).join('');
    for (let i = 0; i <= size - 11; i++) {
      const pattern = bits.slice(i, i + 11);
      if (pattern === '00001011101' || pattern === '10111010000') score += 40;
    }
  }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const v = matrix[y][x];
    if (matrix[y][x + 1] === v && matrix[y + 1][x] === v && matrix[y + 1][x + 1] === v) score += 3;
  }
  const dark = matrix.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  score += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
  return score;
}

/** Encode UTF-8 text as a Model 2 QR matrix. ECC is L, M, Q, or H. */
export function encodeQr(text, ecc = 'M') {
  const level = String(ecc || 'M').toUpperCase();
  if (!(level in ECC_INDEX)) throw new Error('Choose an error correction level: L, M, Q, or H.');
  const bytes = [...new TextEncoder().encode(String(text ?? ''))];
  for (let version = 1; version <= 40; version++) {
    const countBits = version < 10 ? 8 : 16;
    if (bytes.length >= 2 ** countBits) continue;
    const capacity = dataCodewords(version, ECC_INDEX[level]) * 8;
    const needed = 4 + countBits + bytes.length * 8;
    if (needed > capacity) continue;
    const bits = [];
    appendBits(bits, 0b0100, 4);
    appendBits(bits, bytes.length, countBits);
    for (const byte of bytes) appendBits(bits, byte, 8);
    appendBits(bits, 0, Math.min(4, capacity - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, bit) => (n << 1) | bit, 0));
    for (let pad = 0xec; data.length < capacity / 8; pad ^= 0xec ^ 0x11) data.push(pad);
    const encoded = addEcc(data, version, ECC_INDEX[level]);
    let best = null; let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const candidate = makeMatrix(version, encoded, ECC_INDEX[level], mask);
      const value = penalty(candidate);
      if (value < bestScore) { best = candidate; bestScore = value; }
    }
    return { size: best.length, modules: best };
  }
  throw new Error('This text is too long for a QR code, even at version 40.');
}

function matrixParts(matrix) {
  const modules = Array.isArray(matrix) ? matrix : matrix?.modules;
  if (!Array.isArray(modules) || !modules.length || modules.some((row) => !Array.isArray(row) || row.length !== modules.length)) throw new Error('QR matrix must be a non-empty square array.');
  return { modules, size: modules.length };
}

function safeColor(value, fallback) {
  const color = String(value ?? fallback);
  if (!/^(#[\da-f]{3,8}|[a-z]{1,24}|rgba?\([\d.,%\s]+\))$/i.test(color)) return fallback;
  return color;
}

/** Render a QR matrix to a self-contained SVG string. */
export function qrToSvg(matrix, options = {}) {
  const { modules, size } = matrixParts(matrix);
  const quiet = Math.max(0, Math.floor(options.quietZone ?? options.quiet ?? 4));
  const scale = Math.max(1, Number(options.scale) || 1);
  const dim = (size + quiet * 2) * scale;
  const fg = safeColor(options.fg, '#000000');
  const bg = safeColor(options.bg, '#ffffff');
  const gradient = options.gradient;
  const fill = gradient ? 'url(#qr-gradient)' : fg;
  const cells = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) {
    const px = (x + quiet) * scale; const py = (y + quiet) * scale;
    const r = options.rounded ? Math.min(scale * 0.3, scale / 2) : 0;
    cells.push(`<rect x="${px}" y="${py}" width="${scale}" height="${scale}"${r ? ` rx="${r}"` : ''} fill="${fill}"/>`);
  }
  let gradientDef = '';
  if (gradient) {
    const from = safeColor(Array.isArray(gradient) ? gradient[0] : gradient.from || gradient.start, fg);
    const to = safeColor(Array.isArray(gradient) ? gradient[1] : gradient.to || gradient.end, fg);
    gradientDef = `<defs><linearGradient id="qr-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${bg}"/>${gradientDef}${cells.join('')}</svg>`;
}

/** Draw a QR matrix into an existing canvas and return that canvas. */
export function drawQr(canvas, matrix, options = {}) {
  const { modules, size } = matrixParts(matrix);
  const scale = Math.max(1, Math.floor(Number(options.scale) || 8));
  const quiet = Math.max(0, Math.floor(options.quietZone ?? options.quiet ?? 4));
  const dim = (size + quiet * 2) * scale;
  canvas.width = dim; canvas.height = dim;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw to canvas.');
  const fg = safeColor(options.fg, '#000000');
  const bg = safeColor(options.bg, '#ffffff');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, dim, dim);
  if (options.gradient) {
    const gradient = Array.isArray(options.gradient) ? options.gradient : [options.gradient.from || options.gradient.start, options.gradient.to || options.gradient.end];
    const paint = ctx.createLinearGradient(0, 0, dim, dim);
    paint.addColorStop(0, safeColor(gradient[0], fg)); paint.addColorStop(1, safeColor(gradient[1], fg));
    ctx.fillStyle = paint;
  } else ctx.fillStyle = fg;
  const rounded = !!options.rounded;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) {
    const px = (x + quiet) * scale; const py = (y + quiet) * scale;
    if (rounded && ctx.beginPath && ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(px, py, scale, scale, scale * 0.28); ctx.fill();
    } else ctx.fillRect(px, py, scale, scale);
  }
  return canvas;
}

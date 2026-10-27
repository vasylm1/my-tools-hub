// Dominant-colour extraction with k-means on a down-sampled pixel set. Pure: takes RGBA bytes.

const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * @param {Uint8ClampedArray} rgba  pixel data
 * @param {number} k                number of colours
 * @returns {{ hex: string, share: number }[]} sorted by share, largest first
 */
export function extractPalette(rgba, k = 6, iterations = 12) {
  const pts = [];
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue; // ignore transparent pixels
    pts.push(rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  const n = pts.length / 3;
  if (!n) return [];
  k = Math.min(k, n);
  // Seed with evenly spaced samples of the luminance-sorted pixels for stable, spread-out starts.
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => lum(pts, a) - lum(pts, b));
  let centers = Array.from({ length: k }, (_, c) => {
    const p = order[Math.floor(((c + 0.5) * n) / k)];
    return [pts[p * 3], pts[p * 3 + 1], pts[p * 3 + 2]];
  });
  let assign = new Int32Array(n);
  for (let it = 0; it < iterations; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let p = 0; p < n; p++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = pts[p * 3] - centers[c][0];
        const dg = pts[p * 3 + 1] - centers[c][1];
        const db = pts[p * 3 + 2] - centers[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = c; }
      }
      assign[p] = best;
      const s = sums[best];
      s[0] += pts[p * 3]; s[1] += pts[p * 3 + 1]; s[2] += pts[p * 3 + 2]; s[3]++;
    }
    centers = centers.map((c, i) => (sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : c));
  }
  const counts = new Array(k).fill(0);
  for (let p = 0; p < n; p++) counts[assign[p]]++;
  return centers
    .map((c, i) => ({ hex: toHex(...c), share: counts[i] / n }))
    .filter((x) => x.share > 0)
    .sort((a, b) => b.share - a.share);
}

function lum(pts, i) { return 0.299 * pts[i * 3] + 0.587 * pts[i * 3 + 1] + 0.114 * pts[i * 3 + 2]; }

export function paletteToCss(colors, prefix = 'brand') {
  return `:root {\n${colors.map((c, i) => `  --${prefix}-${i + 1}: ${c.hex};`).join('\n')}\n}\n`;
}

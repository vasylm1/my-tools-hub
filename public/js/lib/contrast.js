// WCAG 2.x colour contrast. Pure functions, no DOM.

/** Parse #rgb, #rgba, #rrggbb, #rrggbbaa or rgb()/rgba(). Returns { r, g, b, a } (0-255, alpha 0-1) or null. */
export function parseColor(input) {
  const s = String(input ?? '').trim();
  let m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  m = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(s);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    if ([r, g, b].some((v) => v > 255)) return null;
    let a = 1;
    if (m[4] != null) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r, g, b, a: Math.min(1, Math.max(0, a)) };
  }
  return null;
}

export const toHex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const luminance = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** Blend a translucent colour over an opaque background. */
export const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });

export function contrastRatio(fg, bg) {
  const f = fg.a < 1 ? over(fg, bg) : fg;
  const [hi, lo] = [luminance(f), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pass/fail for each WCAG requirement at a given ratio. */
export function grade(ratio) {
  const r = Math.floor(ratio * 100) / 100; // never round a near miss up to a pass
  return {
    normalAA: r >= 4.5, normalAAA: r >= 7, largeAA: r >= 3, largeAAA: r >= 4.5, ui: r >= 3,
  };
}

/** Short label for matrices: the strongest level reached. */
export function level(ratio) {
  const g = grade(ratio);
  if (g.normalAAA) return 'AAA';
  if (g.normalAA) return 'AA';
  if (g.largeAA) return 'Large only';
  return 'Fail';
}

function rgbToHsl({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((v) => v / 255);
  const max = Math.max(R, G, B); const min = Math.min(R, G, B); const l = (max + min) / 2; const d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? ((G - B) / d + (G < B ? 6 : 0)) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a: 1 };
}

/**
 * The closest colour to `fg` (same hue and saturation, adjusted lightness) that reaches `target` against `bg`.
 * Returns null if even black or white cannot reach it.
 */
export function suggestForeground(fg, bg, target = 4.5) {
  const base = fg.a < 1 ? over(fg, bg) : fg;
  if (contrastRatio(base, bg) >= target) return base;
  const [h, s, l] = rgbToHsl(base);
  let best = null;
  for (const dir of [1, -1]) {
    for (let step = 1; step <= 100; step++) {
      const nl = l + (dir * step) / 100;
      if (nl < 0 || nl > 1) break;
      const c = hslToRgb(h, s, nl);
      if (contrastRatio(c, bg) >= target) { if (!best || step < best.step) best = { step, c }; break; }
    }
  }
  return best ? best.c : null;
}

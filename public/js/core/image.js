// Image and canvas helpers for the image tools.

export const MAX_PIXELS = 100e6;
export const MAX_FILE_BYTES = 60 * 1024 * 1024;

/** Decode a File into { img, name, width, height }. Rejects non-images and absurdly large images. */
export async function loadImageFile(file) {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" is not an image.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`"${file.name}" is larger than 60 MB.`);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    try { await img.decode(); } catch { throw new Error(`"${file.name}" could not be decoded as an image.`); }
    if (img.naturalWidth * img.naturalHeight > MAX_PIXELS) throw new Error(`"${file.name}" has more than 100 megapixels.`);
    return { img, name: file.name, width: img.naturalWidth, height: img.naturalHeight, file };
  } finally {
    // The decoded bitmap stays alive on the element; the URL is no longer needed.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function ctx2d(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

export function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The browser could not encode this image.'))), type, quality);
  });
}

export const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Draw `img` into the box (x,y,w,h) using 'cover' (crop to fill) or 'contain' (letterbox). */
export function drawFit(ctx, img, x, y, w, h, mode = 'cover', focusX = 0.5, focusY = 0.5) {
  const iw = img.width || img.naturalWidth;
  const ih = img.height || img.naturalHeight;
  const scale = mode === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) * focusX;
  const dy = y + (h - dh) * focusY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Word-wrap text to a pixel width using the current ctx.font. */
export function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text).split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Pick black or white text for a given background hex colour. */
export function readableOn(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111111' : '#ffffff';
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return [0, 0, 0];
  let v = m[1];
  if (v.length === 3) v = [...v].map((c) => c + c).join('');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export const rgbToHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

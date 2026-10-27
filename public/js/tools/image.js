// Image tools and QR codes. Everything is drawn on <canvas> in the browser; nothing is uploaded.
import { h, slug, formatBytes } from '../core/dom.js';
import { makeCanvas, ctx2d, canvasToBlob, drawFit, roundRect, wrapLines, readableOn, hexToRgb, FONT, EXT } from '../core/image.js';
import { encodeQr, drawQr, qrToSvg } from '../lib/qr.js';
import { extractPalette, paletteToCss } from '../lib/palette.js';
import { encodeBmp, encodeIco } from '../lib/bmp.js';
import { imagesToPdf } from '../lib/pdf.js';
import { createZip } from '../lib/zip.js';

const NEED_IMAGE = { empty: 'Add an image to get started.' };
const img = (id = 'image', label = 'Image') => ({ id, type: 'image', label });

/** Flatten onto white and encode as JPEG bytes. */
async function jpegBytes(canvas, quality = 0.9) {
  const flat = makeCanvas(canvas.width, canvas.height);
  const c = flat.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, flat.width, flat.height); c.drawImage(canvas, 0, 0);
  return new Uint8Array(await (await canvasToBlob(flat, 'image/jpeg', quality)).arrayBuffer());
}

function scaled(source, w, h2) {
  const c = makeCanvas(w, h2);
  const x = ctx2d(c);
  // Step down in halves for sharper results on big reductions.
  let cur = source.img || source;
  let cw = source.width || cur.width;
  let ch = source.height || cur.height;
  while (cw / 2 > w && ch / 2 > h2) {
    const t = makeCanvas(Math.round(cw / 2), Math.round(ch / 2));
    ctx2d(t).drawImage(cur, 0, 0, t.width, t.height);
    cur = t; cw = t.width; ch = t.height;
  }
  x.drawImage(cur, 0, 0, w, h2);
  return c;
}

const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const GRADIENTS = [['sunset', 'Sunset', '#ff7e5f', '#feb47b'], ['ocean', 'Ocean', '#2193b0', '#6dd5ed'], ['grape', 'Grape', '#7f00ff', '#e100ff'], ['forest', 'Forest', '#134e5e', '#71b280'], ['slate', 'Slate', '#232526', '#414345'], ['peach', 'Peach', '#ffecd2', '#fcb69f'], ['mint', 'Mint', '#0f766e', '#a7f3d0']];
const gradientField = { id: 'bg', type: 'select', label: 'Background', options: [...GRADIENTS.map(([k, n]) => [k, n]), ['custom', 'Custom colours']] };
function backdrop(ctx, w, hh, v) {
  const preset = GRADIENTS.find(([k]) => k === v.bg);
  const [c1, c2] = preset ? [preset[2], preset[3]] : [v.c1, v.c2];
  const g = ctx.createLinearGradient(0, 0, w, hh);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
}
const customColors = [
  { id: 'c1', type: 'color', label: 'Colour 1', value: '#4361ee', half: true, show: (v) => v.bg === 'custom' },
  { id: 'c2', type: 'color', label: 'Colour 2', value: '#7209b7', half: true, show: (v) => v.bg === 'custom' },
];

const SOCIAL = {
  'instagram-square': ['Instagram square', 1080, 1080], 'instagram-portrait': ['Instagram portrait', 1080, 1350], 'instagram-story': ['Instagram story / Reels', 1080, 1920],
  'facebook-cover': ['Facebook cover', 820, 312], 'linkedin-banner': ['LinkedIn banner', 1584, 396], 'x-header': ['X header', 1500, 500], 'youtube-banner': ['YouTube banner', 2048, 1152],
};
const socialOptions = (keys) => keys.map((k) => [k, `${SOCIAL[k][0]} (${SOCIAL[k][1]}×${SOCIAL[k][2]})`]);

/* ------------------------------------------------------------------ tools */

export const tools = {
  'qr-code': {
    fields: [
      { id: 'mode', type: 'select', label: 'Mode', options: [['single', 'One QR code'], ['batch', 'Batch (one code per line)']] },
      { id: 'text', type: 'textarea', label: 'Text or URL', rows: 4, placeholder: 'https://example.com', show: (v) => v.mode === 'single' },
      { id: 'list', type: 'textfile', label: 'One item per line (or the first column of a CSV)', rows: 6, show: (v) => v.mode === 'batch' },
      { id: 'ecc', type: 'select', label: 'Error correction', half: true, options: [['L', 'Low (7%)'], ['M', 'Medium (15%)'], ['Q', 'Quartile (25%)'], ['H', 'High (30%)']], value: 'M' },
      { id: 'scale', type: 'range', label: 'Module size', min: 4, max: 24, value: 10, unit: ' px', half: true },
      { id: 'style', type: 'select', label: 'Style', half: true, options: [['solid', 'Solid'], ['gradient', 'Gradient']] },
      { id: 'round', type: 'checkbox', label: 'Rounded modules', half: true },
      { id: 'fg', type: 'color', label: 'Foreground', value: '#000000', half: true },
      { id: 'fg2', type: 'color', label: 'Gradient end', value: '#4361ee', half: true, show: (v) => v.style === 'gradient' },
      { id: 'bg', type: 'color', label: 'Background', value: '#ffffff', half: true },
    ],
    example: { mode: 'single', text: 'https://example.com/?utm_source=poster' },
    async run(v) {
      const opts = { scale: v.scale, quietZone: 4, fg: v.fg, bg: v.bg, rounded: v.round, gradient: v.style === 'gradient' ? [v.fg, v.fg2] : null };
      const weak = contrast(v.style === 'gradient' ? v.fg : v.fg, v.bg) < 3 || (v.style === 'gradient' && contrast(v.fg2, v.bg) < 3);
      const notice = weak ? { kind: 'warn', text: 'Low contrast between the code and its background: many scanners will fail to read it. Use a dark code on a light background.' } : null;
      if (v.mode === 'batch') {
        const items = v.list.split(/\r?\n/).map((l) => l.split(/[,;\t]/)[0].trim().replace(/^"|"$/g, '')).filter(Boolean);
        if (!items.length) return { empty: 'Add one value per line to make a batch of QR codes.' };
        if (items.length > 200) return { error: 'Batches are limited to 200 codes.' };
        const files = [];
        let first = null;
        for (const [i, item] of items.entries()) {
          const canvas = drawQr(makeCanvas(1, 1), encodeQr(item, v.ecc), opts);
          first ||= canvas;
          files.push({ name: `${String(i + 1).padStart(3, '0')}-${slug(item.slice(0, 40), 'qr')}.png`, data: new Uint8Array(await (await canvasToBlob(canvas)).arrayBuffer()) });
        }
        return {
          stats: [['Codes', items.length]], notice,
          canvas: { canvas: first, filename: 'qr-preview', formats: ['png'] },
          downloads: [{ name: 'qr-codes.zip', data: createZip(files), mime: 'application/zip', label: `All ${items.length} codes (ZIP)` }],
        };
      }
      if (!v.text.trim()) return { empty: 'Type some text or a link to create a QR code.' };
      const qr = encodeQr(v.text, v.ecc);
      const canvas = drawQr(makeCanvas(1, 1), qr, opts);
      const svg = qrToSvg(qr, { ...opts, scale: 8 });
      return {
        stats: [['Version', qr.version ?? Math.round((qr.size - 17) / 4)], ['Modules', `${qr.size}×${qr.size}`]], notice,
        canvas: { canvas, filename: 'qr-code', formats: ['png', 'jpeg'] },
        downloads: [{ name: 'qr-code.svg', data: svg, mime: 'image/svg+xml', label: 'Vector SVG' }],
      };
    },
  },

  'image-resizer': {
    fields: [
      img(),
      { id: 'mode', type: 'select', label: 'Task', options: [['resize', 'Resize / compress'], ['favicon', 'Favicon pack']] },
      { id: 'width', type: 'number', label: 'Width (px)', half: true, min: 1, max: 12000, step: 1, show: (v) => v.mode === 'resize' },
      { id: 'height', type: 'number', label: 'Height (px)', half: true, min: 1, max: 12000, step: 1, show: (v) => v.mode === 'resize', hint: 'Leave one empty to keep the aspect ratio.' },
      { id: 'format', type: 'select', label: 'Format', half: true, options: [['image/jpeg', 'JPEG'], ['image/png', 'PNG'], ['image/webp', 'WebP']], show: (v) => v.mode === 'resize' },
      { id: 'quality', type: 'range', label: 'Quality', min: 30, max: 100, value: 85, unit: '%', half: true, show: (v) => v.mode === 'resize' && v.format !== 'image/png' },
    ],
    async run(v) {
      const src = v.image;
      if (!src) return NEED_IMAGE;
      if (v.mode === 'favicon') {
        const sizes = [16, 32, 48, 64, 128, 180, 192, 512];
        const s = Math.min(src.width, src.height);
        const square = makeCanvas(s, s);
        ctx2d(square).drawImage(src.img, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, s, s);
        const pngs = {};
        for (const size of sizes) pngs[size] = new Uint8Array(await (await canvasToBlob(scaled(square, size, size))).arrayBuffer());
        const ico = encodeIco([16, 32, 48].map((size) => ({ size, png: pngs[size] })));
        const files = [
          { name: 'favicon.ico', data: ico },
          ...sizes.map((size) => ({ name: size === 180 ? 'apple-touch-icon.png' : `favicon-${size}x${size}.png`, data: pngs[size] })),
          { name: 'snippet.html', data: '<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n' },
        ];
        return {
          canvas: { canvas: scaled(square, 128, 128), filename: 'favicon-preview', formats: ['png'] },
          downloads: [{ name: 'favicon-pack.zip', data: createZip(files), mime: 'application/zip', label: 'Favicon pack (ZIP)' }],
          notice: 'The source is cropped to a square from the centre. Pack contains favicon.ico (16/32/48), PNGs up to 512 px and an HTML snippet.',
        };
      }
      let w = v.width;
      let hh = v.height;
      if (!w && !hh) { w = src.width; hh = src.height; } else if (!hh) hh = Math.round((src.height * w) / src.width); else if (!w) w = Math.round((src.width * hh) / src.height);
      if (w * hh > 100e6) return { error: 'The output would be larger than 100 megapixels.' };
      const canvas = scaled(src, w, hh);
      const flat = v.format === 'image/jpeg';
      if (flat) { const c = makeCanvas(w, hh); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh); x.drawImage(canvas, 0, 0); }
      const blob = await canvasToBlob(canvas, v.format, v.quality / 100);
      return {
        stats: [['Original', `${src.width}×${src.height}`], ['New size', `${w}×${hh}`], ['File size', formatBytes(blob.size)]],
        canvas: { canvas, filename: `${slug(src.name.replace(/\.[^.]+$/, ''))}-${w}x${hh}`, formats: [{ 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[v.format]], quality: v.quality / 100 },
      };
    },
  },

  'image-watermark': {
    fields: [
      img(),
      { id: 'kind', type: 'select', label: 'Watermark type', options: [['text', 'Text'], ['logo', 'Logo image']] },
      { id: 'text', type: 'text', label: 'Text', value: '© Your Name', show: (v) => v.kind === 'text' },
      img('logo', 'Logo'),
      { id: 'pos', type: 'select', label: 'Position', half: true, options: [['br', 'Bottom right'], ['bl', 'Bottom left'], ['tr', 'Top right'], ['tl', 'Top left'], ['c', 'Centre'], ['tile', 'Tiled across image']] },
      { id: 'size', type: 'range', label: 'Size', min: 5, max: 60, value: 22, unit: '%', half: true },
      { id: 'opacity', type: 'range', label: 'Opacity', min: 5, max: 100, value: 55, unit: '%', half: true },
      { id: 'color', type: 'color', label: 'Text colour', value: '#ffffff', half: true, show: (v) => v.kind === 'text' },
    ],
    run(v) {
      const src = v.image;
      if (!src) return NEED_IMAGE;
      if (v.kind === 'logo' && !v.logo) return { ...NEED_IMAGE, empty: 'Add a logo image too, or switch to a text watermark.' };
      const canvas = makeCanvas(src.width, src.height);
      const c = ctx2d(canvas);
      c.drawImage(src.img, 0, 0);
      c.globalAlpha = v.opacity / 100;
      const targetW = (src.width * v.size) / 100;
      const pad = Math.round(Math.min(src.width, src.height) * 0.03);
      let ww;
      let wh;
      let draw;
      if (v.kind === 'text') {
        const text = v.text || ' ';
        const fontPx = Math.max(10, targetW / Math.max(4, text.length * 0.55));
        c.font = `700 ${fontPx}px ${FONT}`;
        ww = c.measureText(text).width; wh = fontPx;
        draw = (x, y) => {
          c.fillStyle = v.color; c.textBaseline = 'top';
          c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = fontPx * 0.12;
          c.fillText(text, x, y); c.shadowBlur = 0;
        };
      } else {
        ww = targetW; wh = (v.logo.height / v.logo.width) * ww;
        draw = (x, y) => c.drawImage(v.logo.img, x, y, ww, wh);
      }
      if (v.pos === 'tile') {
        c.save(); c.translate(src.width / 2, src.height / 2); c.rotate(-Math.PI / 6);
        const gx = ww * 1.8;
        const gy = wh * 3.5;
        const reach = Math.hypot(src.width, src.height);
        for (let y = -reach; y < reach; y += gy) for (let x = -reach, row = 0; x < reach; x += gx, row++) draw(x + (Math.round(y / gy) % 2 ? gx / 2 : 0), y);
        c.restore();
      } else {
        const x = v.pos.includes('l') ? pad : v.pos.includes('r') ? src.width - ww - pad : (src.width - ww) / 2;
        const y = v.pos.includes('t') ? pad : v.pos.includes('b') ? src.height - wh - pad : (src.height - wh) / 2;
        draw(x, y);
      }
      return { canvas: { canvas, filename: `${slug(src.name.replace(/\.[^.]+$/, ''))}-watermarked` } };
    },
  },

  'social-cropper': {
    fields: [
      { id: 'images', type: 'images', label: 'Images' },
      { id: 'preset', type: 'select', label: 'Format', options: socialOptions(Object.keys(SOCIAL).filter((k) => k !== 'youtube-banner')) },
      { id: 'fit', type: 'select', label: 'Fit', half: true, options: [['cover', 'Fill (crop edges)'], ['contain', 'Fit inside (add bars)']] },
      { id: 'bg', type: 'color', label: 'Bar colour', value: '#ffffff', half: true, show: (v) => v.fit === 'contain' },
    ],
    async run({ images, preset, fit, bg }) {
      if (!images.length) return { empty: 'Add one or more images to crop them.' };
      const [, W, H] = SOCIAL[preset];
      const files = [];
      let first = null;
      for (const it of images) {
        const canvas = makeCanvas(W, H);
        const c = ctx2d(canvas);
        c.fillStyle = bg; c.fillRect(0, 0, W, H);
        drawFit(c, it.img, 0, 0, W, H, fit);
        first ||= canvas;
        files.push({ name: `${slug(it.name.replace(/\.[^.]+$/, ''))}-${preset}.png`, data: await canvasToBlob(canvas), mime: 'image/png' });
      }
      return { canvas: { canvas: first, filename: `${preset}`, formats: ['png', 'jpeg'] }, downloads: images.length > 1 ? files : [], notice: images.length > 1 ? `Preview shows the first of ${images.length} images.` : null };
    },
  },

  'meme-generator': {
    fields: [
      img(),
      { id: 'top', type: 'text', label: 'Top text', value: '' },
      { id: 'bottom', type: 'text', label: 'Bottom text', value: '' },
      { id: 'size', type: 'range', label: 'Text size', min: 4, max: 16, value: 9, unit: '%' },
    ],
    run({ image, top, bottom, size }) {
      if (!image) return NEED_IMAGE;
      const canvas = makeCanvas(image.width, image.height);
      const c = ctx2d(canvas);
      c.drawImage(image.img, 0, 0);
      const fontPx = (image.height * size) / 100;
      c.font = `900 ${fontPx}px Impact, "Arial Black", ${FONT}`;
      c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineJoin = 'round'; c.lineWidth = fontPx / 7;
      const block = (text, y0, dir) => {
        const ls = wrapLines(c, text.toUpperCase(), image.width * 0.94);
        ls.forEach((l, i) => {
          const y = dir > 0 ? y0 + fontPx * (i + 0.9) : y0 - fontPx * (ls.length - 1 - i) * 1.0;
          c.strokeText(l, image.width / 2, y); c.fillText(l, image.width / 2, y);
        });
      };
      if (top.trim()) block(top, image.height * 0.02, 1);
      if (bottom.trim()) block(bottom, image.height * 0.97, -1);
      return { canvas: { canvas, filename: 'meme' } };
    },
  },

  'brand-palette': {
    fields: [img(), { id: 'n', type: 'range', label: 'Number of colours', min: 3, max: 10, value: 6 }],
    run({ image, n }) {
      if (!image) return NEED_IMAGE;
      const s = Math.min(1, 160 / Math.max(image.width, image.height));
      const c = makeCanvas(image.width * s, image.height * s);
      const x = ctx2d(c);
      x.drawImage(image.img, 0, 0, c.width, c.height);
      const colors = extractPalette(x.getImageData(0, 0, c.width, c.height).data, n);
      if (!colors.length) return { error: 'No visible pixels found in this image.' };
      const grid = h('div', { class: 'swatches' }, ...colors.map((k) => h('div', { class: 'swatch' }, h('i', { style: `background:${k.hex}` }), h('span', {}, k.hex.toUpperCase(), h('br'), `${Math.round(k.share * 100)}%`))));
      return {
        node: grid,
        text: [{ label: 'CSS variables', value: paletteToCss(colors), filename: 'palette.css', mime: 'text/css;charset=utf-8', rows: Math.min(14, colors.length + 3) }, { label: 'HEX list', value: colors.map((k) => k.hex).join(', '), rows: 2 }],
      };
    },
  },

  'screenshot-beautifier': {
    fields: [
      img(), gradientField, ...customColors,
      { id: 'pad', type: 'range', label: 'Padding', min: 0, max: 200, value: 80, unit: ' px', half: true },
      { id: 'radius', type: 'range', label: 'Corner radius', min: 0, max: 60, value: 18, unit: ' px', half: true },
      { id: 'shadow', type: 'range', label: 'Shadow', min: 0, max: 100, value: 45, unit: '%' },
    ],
    run(v) {
      const s = v.image;
      if (!s) return NEED_IMAGE;
      const W = s.width + v.pad * 2;
      const H = s.height + v.pad * 2;
      const canvas = makeCanvas(W, H);
      const c = ctx2d(canvas);
      backdrop(c, W, H, v);
      c.save();
      c.shadowColor = `rgba(0,0,0,${v.shadow / 160})`; c.shadowBlur = v.shadow * 0.7; c.shadowOffsetY = v.shadow * 0.25;
      roundRect(c, v.pad, v.pad, s.width, s.height, v.radius); c.fillStyle = '#fff'; c.fill();
      c.restore();
      c.save(); roundRect(c, v.pad, v.pad, s.width, s.height, v.radius); c.clip(); c.drawImage(s.img, v.pad, v.pad); c.restore();
      return { canvas: { canvas, filename: 'screenshot' } };
    },
  },

  'browser-mockup': {
    fields: [
      img('image', 'Screenshot'),
      { id: 'url', type: 'text', label: 'Address bar text', value: 'example.com' },
      { id: 'theme', type: 'select', label: 'Theme', half: true, options: [['light', 'Light'], ['dark', 'Dark']] },
      { id: 'shadow', type: 'checkbox', label: 'Drop shadow', value: true, half: true },
    ],
    run({ image, url, theme, shadow }) {
      if (!image) return NEED_IMAGE;
      const dark = theme === 'dark';
      const bar = Math.max(44, Math.round(image.width * 0.045));
      const m = shadow ? 40 : 0;
      const W = image.width + m * 2;
      const H = image.height + bar + m * 2;
      const canvas = makeCanvas(W, H);
      const c = ctx2d(canvas);
      const r = 14;
      c.save();
      if (shadow) { c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 30; c.shadowOffsetY = 12; }
      roundRect(c, m, m, image.width, image.height + bar, r); c.fillStyle = dark ? '#2b2d31' : '#e8e8ea'; c.fill();
      c.restore();
      c.save(); roundRect(c, m, m, image.width, image.height + bar, r); c.clip();
      c.fillStyle = dark ? '#2b2d31' : '#e8e8ea'; c.fillRect(m, m, image.width, bar);
      [['#ff5f57', 0], ['#febc2e', 1], ['#28c840', 2]].forEach(([col, i]) => { c.fillStyle = col; c.beginPath(); c.arc(m + bar * 0.45 + i * bar * 0.4, m + bar / 2, bar * 0.13, 0, Math.PI * 2); c.fill(); });
      const px = m + bar * 1.9;
      const pw = image.width - bar * 2.4;
      if (pw > 60) {
        roundRect(c, px, m + bar * 0.2, pw, bar * 0.6, bar * 0.3); c.fillStyle = dark ? '#1b1c1f' : '#ffffff'; c.fill();
        c.fillStyle = dark ? '#c9ccd1' : '#555'; c.font = `${Math.round(bar * 0.34)}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
        let label = url || '';
        while (label.length > 1 && c.measureText(label).width > pw - bar * 0.7) label = `${label.slice(0, -2)}…`;
        c.fillText(label, px + bar * 0.3, m + bar / 2 + 1);
      }
      c.drawImage(image.img, m, m + bar);
      c.restore();
      return { canvas: { canvas, filename: 'browser-mockup', formats: ['png', 'webp'] } };
    },
  },

  'device-mockup': {
    fields: [
      img('image', 'Screenshot'),
      { id: 'device', type: 'select', label: 'Device', options: [['phone', 'Phone'], ['laptop', 'Laptop']] },
      gradientField, ...customColors,
    ],
    run(v) {
      const s = v.image;
      if (!s) return NEED_IMAGE;
      let canvas;
      if (v.device === 'phone') {
        const sw = 560;
        const sh = Math.round(sw * 2.05);
        const bz = 26;
        const m = 90;
        canvas = makeCanvas(sw + bz * 2 + m * 2, sh + bz * 2 + m * 2);
        const c = ctx2d(canvas);
        backdrop(c, canvas.width, canvas.height, v);
        c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 50; c.shadowOffsetY = 20;
        roundRect(c, m, m, sw + bz * 2, sh + bz * 2, 84); c.fillStyle = '#111'; c.fill(); c.restore();
        c.save(); roundRect(c, m + bz, m + bz, sw, sh, 58); c.clip(); c.fillStyle = '#000'; c.fillRect(m, m, sw + bz * 2, sh + bz * 2);
        drawFit(c, s.img, m + bz, m + bz, sw, sh, 'cover', 0.5, 0); c.restore();
        roundRect(c, canvas.width / 2 - 70, m + bz + 14, 140, 34, 17); c.fillStyle = '#000'; c.fill();
      } else {
        const sw = 1000;
        const sh = 625;
        const bz = 26;
        const m = 90;
        canvas = makeCanvas(sw + bz * 2 + m * 2 + 120, sh + bz * 2 + m * 2 + 50);
        const c = ctx2d(canvas);
        backdrop(c, canvas.width, canvas.height, v);
        const x0 = (canvas.width - sw - bz * 2) / 2;
        c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 50; c.shadowOffsetY = 20;
        roundRect(c, x0, m, sw + bz * 2, sh + bz * 2, 26); c.fillStyle = '#111'; c.fill(); c.restore();
        c.save(); roundRect(c, x0 + bz, m + bz, sw, sh, 8); c.clip(); c.fillStyle = '#000'; c.fillRect(x0, m, sw + bz * 2, sh + bz * 2);
        drawFit(c, s.img, x0 + bz, m + bz, sw, sh, 'cover', 0.5, 0); c.restore();
        const by = m + sh + bz * 2;
        c.fillStyle = '#c9cacf';
        c.beginPath(); c.moveTo(x0 - 70, by); c.lineTo(x0 + sw + bz * 2 + 70, by); c.lineTo(x0 + sw + bz * 2 + 40, by + 28); c.lineTo(x0 - 40, by + 28); c.closePath(); c.fill();
        c.fillStyle = '#a8a9ae'; roundRect(c, canvas.width / 2 - 90, by, 180, 10, 5); c.fill();
      }
      return { canvas: { canvas, filename: `${v.device}-mockup` } };
    },
  },

  'social-banner': {
    fields: [
      { id: 'preset', type: 'select', label: 'Format', options: socialOptions(['linkedin-banner', 'x-header', 'facebook-cover', 'youtube-banner']) },
      { id: 'name', type: 'text', label: 'Name', value: 'Jane Doe' },
      { id: 'tagline', type: 'text', label: 'Tagline', value: 'Marketing · Strategy · Growth' },
      { id: 'c1', type: 'color', label: 'Colour 1', value: '#0f766e', half: true },
      { id: 'c2', type: 'color', label: 'Colour 2', value: '#4361ee', half: true },
      { id: 'align', type: 'select', label: 'Text position', options: [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']] },
    ],
    run({ preset, name, tagline, c1, c2, align }) {
      const [, W, H] = SOCIAL[preset];
      const canvas = makeCanvas(W, H);
      const c = ctx2d(canvas);
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, c1); g.addColorStop(1, c2);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.arc(W * 0.88, H * 0.1, H * 0.7, 0, Math.PI * 2); c.fill();
      const ink = readableOn(c1);
      const nameSize = Math.round(H * 0.17);
      const tagSize = Math.round(H * 0.075);
      const x = align === 'left' ? W * 0.07 : align === 'right' ? W * 0.93 : W / 2;
      c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillStyle = ink;
      c.font = `800 ${nameSize}px ${FONT}`; c.fillText(name, x, H / 2 + (tagline ? 0 : nameSize / 3), W * 0.86);
      if (tagline) { c.globalAlpha = 0.85; c.font = `500 ${tagSize}px ${FONT}`; c.fillText(tagline, x, H / 2 + tagSize * 1.7, W * 0.86); c.globalAlpha = 1; }
      return { canvas: { canvas, filename: `${preset}` } };
    },
  },

  'certificate-generator': {
    fields: [
      { id: 'title', type: 'text', label: 'Title', value: 'Certificate of Achievement' },
      { id: 'name', type: 'text', label: 'Recipient', value: 'Jane Doe' },
      { id: 'reason', type: 'textarea', label: 'Description', rows: 3, value: 'for successfully completing the Advanced Marketing Strategy programme with distinction.' },
      { id: 'date', type: 'text', label: 'Date', value: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), half: true },
      { id: 'issuer', type: 'text', label: 'Issuer / signature', value: 'John Smith, Director', half: true },
      { id: 'accent', type: 'color', label: 'Accent colour', value: '#0f766e' },
    ],
    async run(v) {
      const W = 1754;
      const H = 1240;
      const canvas = makeCanvas(W, H);
      const c = ctx2d(canvas);
      c.fillStyle = '#fffdf8'; c.fillRect(0, 0, W, H);
      c.strokeStyle = v.accent; c.lineWidth = 14; c.strokeRect(50, 50, W - 100, H - 100);
      c.lineWidth = 3; c.strokeRect(78, 78, W - 156, H - 156);
      c.textAlign = 'center'; c.fillStyle = v.accent; c.font = `700 84px Georgia, "Times New Roman", serif`;
      c.fillText(v.title, W / 2, 300, W - 300);
      c.fillStyle = '#5a6168'; c.font = `italic 34px Georgia, serif`; c.fillText('This certificate is proudly presented to', W / 2, 410);
      c.fillStyle = '#1d2327'; c.font = `700 104px Georgia, "Times New Roman", serif`; c.fillText(v.name, W / 2, 570, W - 300);
      c.strokeStyle = v.accent; c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2 - 340, 610); c.lineTo(W / 2 + 340, 610); c.stroke();
      c.fillStyle = '#333'; c.font = `38px Georgia, serif`;
      wrapLines(c, v.reason, W - 440).slice(0, 4).forEach((l, i) => c.fillText(l, W / 2, 700 + i * 56));
      c.font = `30px Georgia, serif`; c.fillStyle = '#5a6168';
      c.textAlign = 'left'; c.fillText(v.date, 220, H - 190);
      c.strokeStyle = '#999'; c.lineWidth = 2; c.beginPath(); c.moveTo(210, H - 235); c.lineTo(560, H - 235); c.moveTo(W - 560, H - 235); c.lineTo(W - 210, H - 235); c.stroke();
      c.textAlign = 'right'; c.fillText(v.issuer, W - 220, H - 190);
      c.textAlign = 'left'; c.font = `22px ${FONT}`; c.fillStyle = '#999'; c.fillText('Date', 220, H - 150); c.textAlign = 'right'; c.fillText('Signature', W - 220, H - 150);
      const pdf = imagesToPdf([{ jpeg: await jpegBytes(canvas, 0.92), width: W, height: H }], { pageSize: 'a4', orientation: 'landscape', margin: 0 });
      return { canvas: { canvas, filename: `${slug(v.name, 'certificate')}-certificate`, formats: ['png', 'jpeg'] }, downloads: [{ name: `${slug(v.name, 'certificate')}.pdf`, data: pdf, mime: 'application/pdf', label: 'PDF (A4 landscape)' }] };
    },
  },

  'file-converter': {
    fields: [
      { id: 'images', type: 'images', label: 'Images' },
      { id: 'format', type: 'select', label: 'Convert to', half: true, options: [['image/png', 'PNG'], ['image/jpeg', 'JPG'], ['image/webp', 'WebP'], ['image/bmp', 'BMP']] },
      { id: 'quality', type: 'range', label: 'Quality', min: 30, max: 100, value: 90, unit: '%', half: true, show: (v) => v.format === 'image/jpeg' || v.format === 'image/webp' },
      { id: 'bg', type: 'color', label: 'Background for transparent areas', value: '#ffffff', show: (v) => v.format === 'image/jpeg' || v.format === 'image/bmp' },
    ],
    async run({ images, format, quality, bg }) {
      if (!images.length) return { empty: 'Add one or more images to convert them.' };
      const ext = format === 'image/bmp' ? 'bmp' : EXT[format];
      const out = [];
      for (const it of images) {
        const canvas = makeCanvas(it.width, it.height);
        const c = ctx2d(canvas);
        if (format === 'image/jpeg' || format === 'image/bmp') { c.fillStyle = bg; c.fillRect(0, 0, canvas.width, canvas.height); }
        c.drawImage(it.img, 0, 0);
        const data = format === 'image/bmp' ? new Blob([encodeBmp(c.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, hexToRgb(bg))], { type: 'image/bmp' }) : await canvasToBlob(canvas, format, quality / 100);
        out.push({ name: `${slug(it.name.replace(/\.[^.]+$/, ''))}.${ext}`, data, mime: format, label: `${it.name.replace(/\.[^.]+$/, '')}.${ext} · ${formatBytes(data.size)}` });
      }
      return { stats: [['Converted', out.length], ['Format', ext.toUpperCase()]], downloads: out };
    },
  },

  'images-to-pdf': {
    fields: [
      { id: 'images', type: 'images', label: 'Images (in page order)' },
      { id: 'size', type: 'select', label: 'Page size', half: true, options: [['a4', 'A4'], ['letter', 'US Letter'], ['fit', 'Fit to image']] },
      { id: 'orientation', type: 'select', label: 'Orientation', half: true, options: [['portrait', 'Portrait'], ['landscape', 'Landscape']], show: (v) => v.size !== 'fit' },
      { id: 'margin', type: 'range', label: 'Margin', min: 0, max: 30, value: 10, unit: ' mm', half: true },
      { id: 'quality', type: 'range', label: 'JPEG quality', min: 50, max: 100, value: 88, unit: '%', half: true },
    ],
    async run({ images, size, orientation, margin, quality }) {
      if (!images.length) return { empty: 'Add images and they will be combined into one PDF.' };
      if (images.length > 100) return { error: 'Please use 100 images or fewer per PDF.' };
      const pages = [];
      for (const it of images) {
        const cap = Math.min(1, 3200 / Math.max(it.width, it.height));
        const canvas = makeCanvas(it.width * cap, it.height * cap);
        ctx2d(canvas).drawImage(it.img, 0, 0, canvas.width, canvas.height);
        pages.push({ jpeg: await jpegBytes(canvas, quality / 100), width: canvas.width, height: canvas.height });
      }
      const pdf = imagesToPdf(pages, { pageSize: size, orientation, margin });
      return {
        stats: [['Pages', pages.length], ['PDF size', formatBytes(pdf.length)]],
        downloads: [{ name: 'images.pdf', data: pdf, mime: 'application/pdf', label: 'Download images.pdf' }],
        notice: 'Transparent areas become white because PDFs embed images as JPEG.',
      };
    },
  },
};

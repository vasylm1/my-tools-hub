// 24-bit BMP and PNG-in-ICO encoders (the browser cannot encode these formats natively).

/** @param {Uint8ClampedArray} rgba @returns {Uint8Array} */
export function encodeBmp(rgba, width, height, background = [255, 255, 255]) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + rowSize * height;
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  out[0] = 0x42; out[1] = 0x4d;
  dv.setUint32(2, size, true);
  dv.setUint32(10, 54, true);
  dv.setUint32(14, 40, true);
  dv.setInt32(18, width, true);
  dv.setInt32(22, height, true);
  dv.setUint16(26, 1, true);
  dv.setUint16(28, 24, true);
  dv.setUint32(34, rowSize * height, true);
  dv.setInt32(38, 2835, true);
  dv.setInt32(42, 2835, true);
  for (let y = 0; y < height; y++) {
    let o = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = rgba[i + 3] / 255; // flatten transparency onto the background
      out[o++] = Math.round(rgba[i + 2] * a + background[2] * (1 - a));
      out[o++] = Math.round(rgba[i + 1] * a + background[1] * (1 - a));
      out[o++] = Math.round(rgba[i] * a + background[0] * (1 - a));
    }
  }
  return out;
}

/** @param {{ size: number, png: Uint8Array }[]} images @returns {Uint8Array} an .ico containing PNG frames */
export function encodeIco(images) {
  const header = 6 + images.length * 16;
  const total = header + images.reduce((n, i) => n + i.png.length, 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint16(2, 1, true);
  dv.setUint16(4, images.length, true);
  let offset = header;
  images.forEach((img, i) => {
    const p = 6 + i * 16;
    out[p] = img.size >= 256 ? 0 : img.size;
    out[p + 1] = img.size >= 256 ? 0 : img.size;
    dv.setUint16(p + 4, 1, true);
    dv.setUint16(p + 6, 32, true);
    dv.setUint32(p + 8, img.png.length, true);
    dv.setUint32(p + 12, offset, true);
    out.set(img.png, offset);
    offset += img.png.length;
  });
  return out;
}

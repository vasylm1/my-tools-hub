const enc = new TextEncoder();
const MM_TO_PT = 72 / 25.4;
const PX_TO_PT = 72 / 96;
const number = (n) => (Math.round(n * 10000) / 10000).toString();

function join(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

/** Write image pages into a small PDF with correct byte offsets and JPEG streams. */
export function imagesToPdf(pages, options = {}) {
  if (!Array.isArray(pages) || !pages.length) throw new Error('Add at least one image page.');
  const { pageSize = 'a4', orientation = 'portrait', margin = 10 } = options;
  if (!['a4', 'letter', 'fit'].includes(pageSize)) throw new Error('Choose A4, Letter, or fit-to-image page size.');
  if (!['portrait', 'landscape'].includes(orientation)) throw new Error('Choose portrait or landscape orientation.');
  if (!Number.isFinite(margin) || margin < 0) throw new Error('Page margin must be a non-negative number of millimetres.');
  for (const page of pages) {
    if (!page || !(page.jpeg instanceof Uint8Array) || page.jpeg.length < 4 || page.jpeg[0] !== 0xff || page.jpeg[1] !== 0xd8 || !Number.isFinite(page.width) || !Number.isFinite(page.height) || page.width <= 0 || page.height <= 0) {
      throw new Error('Each page needs a valid JPEG image and positive dimensions.');
    }
  }

  const objects = [];
  const add = (body) => { objects.push(typeof body === 'string' ? enc.encode(body) : body); return objects.length; };
  const stream = (dict, bytes) => join([enc.encode(`<< ${dict} /Length ${bytes.length} >>\nstream\n`), bytes, enc.encode('\nendstream')]);
  const catalogId = add('');
  const pagesId = add('');
  const pageIds = [];
  for (const [i, page] of pages.entries()) {
    const marginPt = margin * MM_TO_PT;
    let [pw, ph] = pageSize === 'fit'
      ? [page.width * PX_TO_PT + marginPt * 2, page.height * PX_TO_PT + marginPt * 2]
      : pageSize === 'letter' ? [612, 792] : [595.276, 841.89];
    if (pageSize !== 'fit' && orientation === 'landscape') [pw, ph] = [Math.max(pw, ph), Math.min(pw, ph)];
    if (pageSize !== 'fit' && orientation === 'portrait') [pw, ph] = [Math.min(pw, ph), Math.max(pw, ph)];
    const boxW = Math.max(0.1, pw - marginPt * 2);
    const boxH = Math.max(0.1, ph - marginPt * 2);
    const scale = Math.min(boxW / page.width, boxH / page.height) * PX_TO_PT;
    const drawW = page.width * scale;
    const drawH = page.height * scale;
    const x = (pw - drawW) / 2;
    const y = (ph - drawH) / 2;
    const imageId = add(stream(`/Type /XObject /Subtype /Image /Width ${Math.round(page.width)} /Height ${Math.round(page.height)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, page.jpeg));
    const content = enc.encode(`q ${number(drawW)} 0 0 ${number(drawH)} ${number(x)} ${number(y)} cm /Im${i + 1} Do Q`);
    const contentId = add(stream('', content));
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${number(pw)} ${number(ph)}] /Resources << /XObject << /Im${i + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  objects[catalogId - 1] = enc.encode(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects[pagesId - 1] = enc.encode(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);

  const parts = [enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  let offset = parts[0].length;
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    const head = enc.encode(`${i + 1} 0 obj\n`);
    const tail = enc.encode('\nendobj\n');
    parts.push(head, body, tail);
    offset += head.length + body.length + tail.length;
  });
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const objectOffset of offsets) xref += `${String(objectOffset).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(enc.encode(xref));
  return join(parts);
}

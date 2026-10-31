import { deflateSync } from 'node:zlib';

// Hand-built PDFs for the tests: a classic file with an incremental update, and a PDF 1.5 file with object and cross-reference streams.
export const enc = new TextEncoder();
export const dec = (b) => new TextDecoder('latin1').decode(b);
const cat = (...parts) => { const bs = parts.map((p) => (typeof p === 'string' ? enc.encode(p) : p)); const out = new Uint8Array(bs.reduce((n, b) => n + b.length, 0)); let at = 0; for (const b of bs) { out.set(b, at); at += b.length; } return out; };

export const CONTENT = 'BT /F1 18 Tf 20 100 Td (Hello hidden world) Tj ET';
const PAGES = [
  '<< /Type /Catalog /Pages 2 0 R %META% >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>',
];

// Classic file: objects 1 to 4 plus Info (5) and an XMP packet (6), trailer, optional incremental update.
export function classic({ author = 'Alice Example', update = null, xmp = true } = {}) {
  const parts = [];
  let size = 0;
  const offsets = {};
  const add = (s) => { const b = typeof s === 'string' ? enc.encode(s) : s; parts.push(b); size += b.length; };
  add('%PDF-1.4\n%\xE2\xE3\n');
  const obj = (n, body) => { offsets[n] = size; add(`${n} 0 obj\n${body}\nendobj\n`); };
  obj(1, PAGES[0].replace('%META%', xmp ? '/Metadata 6 0 R' : ''));
  obj(2, PAGES[1]);
  obj(3, PAGES[2]);
  obj(4, `<< /Length ${CONTENT.length} >>\nstream\n${CONTENT}\nendstream`);
  obj(5, `<< /Author (${author}) /Creator (Word 16) /Producer (Acme PDF 3) /CreationDate (D:20250102030405+01'00') /Title (Budget) >>`);
  if (xmp) {
    const x = `<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><dc:creator><rdf:Seq><rdf:li>${author}</rdf:li></rdf:Seq></dc:creator><xmp:CreatorTool>Word 16</xmp:CreatorTool></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
    obj(6, `<< /Type /Metadata /Subtype /XML /Length ${x.length} >>\nstream\n${x}\nendstream`);
  }
  const xref = size;
  add(`xref\n0 1\n0000000000 65535 f \n`);
  add(`trailer\n<< /Size 7 /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  if (update) {
    offsets[5] = size;
    add(`5 0 obj\n<< /Author (${update}) /Producer (Acme PDF 4) >>\nendobj\n`);
    add(`trailer\n<< /Size 7 /Root 1 0 R /Info 5 0 R /Prev ${xref} >>\nstartxref\n${size}\n%%EOF\n`);
  }
  return cat(...parts);
}

// PDF 1.5 style: catalog, pages, page and Info live in a compressed object stream, indexed by a cross-reference stream.
export function compressed() {
  const inner = [[1, PAGES[0].replace('%META%', '')], [2, PAGES[1]], [3, PAGES[2]], [5, "<< /Author (Bob Builder) /Producer (LaTeX 2025) >>"]];
  let head = '';
  let body = '';
  for (const [n, text] of inner) { head += `${n} ${body.length} `; body += `${text}\n`; }
  const first = head.length;
  const packed = deflateSync(enc.encode(head + body));
  const parts = [];
  let size = 0;
  const add = (s) => { const b = typeof s === 'string' ? enc.encode(s) : s; parts.push(b); size += b.length; };
  add('%PDF-1.5\n%\xE2\xE3\n');
  const off = {};
  off[4] = size; add(`4 0 obj\n<< /Length ${CONTENT.length} >>\nstream\n${CONTENT}\nendstream\nendobj\n`);
  off[6] = size; add(`6 0 obj\n<< /Type /ObjStm /N ${inner.length} /First ${first} /Filter /FlateDecode /Length ${packed.length} >>\nstream\n`); add(packed); add('\nendstream\nendobj\n');
  off[7] = size;
  const rows = [[0, 0, 255], [2, 6, 0], [2, 6, 1], [2, 6, 2], [1, off[4], 0], [2, 6, 3], [1, off[6], 0], [1, off[7], 0]];
  const data = Uint8Array.from(rows.flatMap(([t, a, b]) => [t, a >> 8, a & 255, b]));
  add(`7 0 obj\n<< /Type /XRef /Size 8 /W [1 2 1] /Root 1 0 R /Info 5 0 R /Length ${data.length} >>\nstream\n`); add(data); add(`\nendstream\nendobj\nstartxref\n${off[7]}\n%%EOF\n`);
  return cat(...parts);
}


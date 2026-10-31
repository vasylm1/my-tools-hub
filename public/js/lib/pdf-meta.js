// Reads and removes the metadata of a PDF: the Info dictionary (author, software, dates), XMP packets, and earlier saved versions.
// Approach: repair-style scan of every "N G obj" in the file, expand object streams, keep the newest definition of each object and write
// only what the page tree can still reach into a fresh file, without /Info, /Metadata and /PieceInfo. Page content is copied byte for byte.
// Encrypted files are refused; digital signatures stop being valid once the file is rewritten (reported to the caller).

export class PdfError extends Error {}

const MAX_BYTES = 150 * 1024 * 1024;

function latin1(b, s = 0, e = b.length) {
  let out = '';
  for (let i = s; i < e; i += 8192) out += String.fromCharCode.apply(null, b.subarray(i, Math.min(e, i + 8192)));
  return out;
}
const toBytes = (str) => { const u = new Uint8Array(str.length); for (let i = 0; i < str.length; i += 1) u[i] = str.charCodeAt(i) & 255; return u; };
const WS = /[\0\t\n\f\r ]/;

// Index just after the ">>" that closes the dictionary starting at src[i] ("<<"). Skips strings, hex strings and comments.
function skipDict(src, i) {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '<' && src[i + 1] === '<') { depth += 1; i += 2; continue; }
    if (c === '>' && src[i + 1] === '>') { depth -= 1; i += 2; if (depth === 0) return i; continue; }
    if (c === '(') { i = skipString(src, i); continue; }
    if (c === '<') { const j = src.indexOf('>', i); i = j < 0 ? src.length : j + 1; continue; }
    if (c === '%') { while (i < src.length && src[i] !== '\n' && src[i] !== '\r') i += 1; continue; }
    i += 1;
  }
  return -1;
}
function skipString(src, i) {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '(') depth += 1;
    else if (c === ')') { depth -= 1; if (depth === 0) return i + 1; }
    i += 1;
  }
  return src.length;
}

// Decodes a literal or hex PDF string starting at src[i] ("(" or "<") into text.
function readString(src, i) {
  const bytes = [];
  if (src[i] === '(') {
    const end = skipString(src, i);
    const s = src.slice(i + 1, end - 1);
    for (let k = 0; k < s.length; k += 1) {
      const c = s[k];
      if (c !== '\\') { bytes.push(s.charCodeAt(k) & 255); continue; }
      const n = s[k + 1];
      k += 1;
      const esc = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 }[n];
      if (esc !== undefined) bytes.push(esc);
      else if (/[0-7]/.test(n)) { let o = n; while (o.length < 3 && /[0-7]/.test(s[k + 1] || '')) { o += s[k + 1]; k += 1; } bytes.push(parseInt(o, 8) & 255); }
      else if (n === '\r') { if (s[k + 1] === '\n') k += 1; } else if (n !== '\n') bytes.push(n.charCodeAt(0) & 255);
    }
  } else {
    const end = src.indexOf('>', i);
    const hex = src.slice(i + 1, end < 0 ? undefined : end).replace(/[^0-9a-f]/gi, '');
    for (let k = 0; k < hex.length; k += 2) bytes.push(parseInt(hex.slice(k, k + 2).padEnd(2, '0'), 16));
  }
  const u = Uint8Array.from(bytes);
  if (u[0] === 0xfe && u[1] === 0xff) return new TextDecoder('utf-16be').decode(u.subarray(2));
  if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder('utf-16le').decode(u.subarray(2));
  if (u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf) return new TextDecoder('utf-8').decode(u.subarray(3));
  return new TextDecoder('windows-1252').decode(u);
}

async function inflate(data) {
  if (typeof DecompressionStream === 'undefined') throw new PdfError('This browser cannot unpack compressed PDF data.');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Reads every object in file order. Each: { num, gen, pos, dict (text or null), body (text, without stream data), data ([start, end] or null) }.
function scanObjects(src) {
  const re = /(?<![0-9])(\d{1,10})[ \t\r\n\0\f]+(\d{1,5})[ \t\r\n\0\f]+obj(?![a-zA-Z])/g;
  const objects = [];
  let m;
  while ((m = re.exec(src))) {
    const num = Number(m[1]);
    const gen = Number(m[2]);
    let p = re.lastIndex;
    while (p < src.length && WS.test(src[p])) p += 1;
    const obj = { num, gen, pos: m.index, dict: null, body: '', data: null, lengthFixed: false };
    let end;
    if (src[p] === '<' && src[p + 1] === '<') {
      const d = skipDict(src, p);
      if (d < 0) { re.lastIndex = p + 2; continue; }
      obj.dict = src.slice(p, d);
      obj.body = obj.dict;
      let q = d;
      while (q < src.length && WS.test(src[q])) q += 1;
      if (src.startsWith('stream', q)) {
        let s = q + 6;
        if (src[s] === '\r' && src[s + 1] === '\n') s += 2; else if (src[s] === '\n' || src[s] === '\r') s += 1;
        const len = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(obj.dict);
        let e = -1;
        if (len) {
          const cand = s + Number(len[1]);
          if (/^[\0\t\n\f\r ]*endstream/.test(src.slice(cand, cand + 12))) e = cand;
        }
        if (e < 0) {
          const k = src.indexOf('endstream', s);
          e = k < 0 ? src.length : k;
          if (src[e - 1] === '\n') e -= 1;
          if (src[e - 1] === '\r') e -= 1;
          obj.lengthFixed = Boolean(len);
        }
        obj.data = [s, e];
        const k = src.indexOf('endobj', e);
        end = k < 0 ? src.length : k + 6;
      }
    }
    if (end === undefined) {
      const k = src.indexOf('endobj', p);
      end = k < 0 ? src.length : k + 6;
      if (!obj.dict) obj.body = src.slice(p, k < 0 ? end : k).trim();
    }
    objects.push(obj);
    re.lastIndex = end;
  }
  return objects;
}

// Removes /Key values (a reference or an inline dictionary) from dictionary text.
function stripKeys(text, keys) {
  let out = text;
  for (const key of keys) {
    const re = new RegExp(`/${key}(?![A-Za-z0-9_.#-])\\s*`, 'g');
    let m;
    let guard = 0;
    while ((m = re.exec(out)) && guard < 1000) {
      guard += 1;
      const from = m.index;
      const rest = out.slice(re.lastIndex);
      let len = 0;
      const ref = /^(\d+)\s+(\d+)\s+R(?![A-Za-z])/.exec(rest);
      if (ref) len = ref[0].length;
      else if (rest.startsWith('<<')) { const d = skipDict(rest, 0); len = d < 0 ? 0 : d; } else if (rest.startsWith('[')) { const d = rest.indexOf(']'); len = d < 0 ? 0 : d + 1; }
      if (!len) continue;
      out = `${out.slice(0, from)}${out.slice(re.lastIndex + len)}`;
      re.lastIndex = from;
    }
  }
  return out;
}

const refRe = /(?<![0-9])(\d+)\s+(\d+)\s+R(?![A-Za-z])/g;
const DROP_KEYS = ['Metadata', 'PieceInfo'];

async function parse(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  if (bytes.length > MAX_BYTES) throw new PdfError('That file is larger than 150 MB.');
  const src = latin1(bytes);
  if (!/%PDF-\d\.\d/.test(src.slice(0, 1024))) throw new PdfError('This does not look like a PDF file.');
  const scanned = scanObjects(src);
  if (!scanned.length) throw new PdfError('No readable objects were found. The file may be damaged.');

  // Trailers and cross-reference streams carry /Root, /Info and /Encrypt. The last one in the file wins.
  const trailers = [];
  for (const m of src.matchAll(/trailer\s*(?=<<)/g)) {
    const at = m.index + m[0].length;
    const d = skipDict(src, at);
    if (d > 0) trailers.push({ pos: m.index, text: src.slice(at, d) });
  }
  for (const o of scanned) if (o.dict && /\/Type\s*\/XRef(?![A-Za-z])/.test(o.dict)) trailers.push({ pos: o.pos, text: o.dict });
  trailers.sort((a, b) => a.pos - b.pos);
  if (trailers.some((t) => /\/Encrypt(?![A-Za-z])/.test(t.text))) throw new PdfError('This PDF is password-protected. Remove the protection first, then clean it.');

  // Object streams hold most dictionaries in PDF 1.5 and later.
  const entries = scanned.map((o) => ({ ...o, order: o.pos }));
  for (const o of scanned) {
    if (!o.data || !o.dict || !/\/Type\s*\/ObjStm(?![A-Za-z])/.test(o.dict)) continue;
    const n = Number(/\/N\s+(\d+)/.exec(o.dict)?.[1] || 0);
    const first = Number(/\/First\s+(\d+)/.exec(o.dict)?.[1] || 0);
    if (/\/Predictor\s+\d+/.test(o.dict) || /\/Filter\s*\[?\s*\/(?!FlateDecode)/.test(o.dict)) throw new PdfError('This PDF uses a compression method that is not supported.');
    let raw = bytes.subarray(o.data[0], o.data[1]);
    if (/\/Filter/.test(o.dict)) { try { raw = await inflate(raw); } catch { throw new PdfError('A compressed part of this PDF could not be unpacked. The file may be damaged.'); } }
    const text = latin1(raw);
    const head = text.slice(0, first).trim().split(/\s+/).map(Number);
    for (let k = 0; k < n; k += 1) {
      const num = head[k * 2];
      const off = head[k * 2 + 1];
      if (!Number.isFinite(num) || !Number.isFinite(off)) continue;
      const next = k + 1 < n ? head[(k + 1) * 2 + 1] : text.length - first;
      const body = text.slice(first + off, first + next).trim();
      entries.push({ num, gen: 0, pos: o.pos, order: o.pos + (k + 1) / (n + 2), dict: body.startsWith('<<') ? body : null, body, data: null, fromStream: true });
    }
  }
  entries.sort((a, b) => a.order - b.order);
  const byNum = new Map();
  for (const e of entries) byNum.set(e.num, e);

  let root = null;
  const infoNums = new Set();
  for (const t of trailers) {
    const r = /\/Root\s+(\d+)\s+\d+\s+R/.exec(t.text);
    if (r) root = Number(r[1]);
    const i = /\/Info\s+(\d+)\s+\d+\s+R/.exec(t.text);
    if (i) infoNums.add(Number(i[1]));
  }
  if (root === null) { const c = [...byNum.values()].reverse().find((e) => e.dict && /\/Type\s*\/Catalog(?![A-Za-z])/.test(e.dict)); if (c) root = c.num; }
  if (root === null || !byNum.has(root)) throw new PdfError('The document structure could not be found. The file may be damaged.');
  const eofs = (src.match(/%%EOF/g) || []).length;
  return { bytes, src, entries, byNum, root, infoNums, trailers, revisions: Math.max(1, eofs) };
}

// Everything the page tree can reach, following references but ignoring /Metadata and /PieceInfo.
function reachable(doc) {
  const seen = new Set();
  const stack = [doc.root];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n)) continue;
    const e = doc.byNum.get(n);
    if (!e) continue;
    seen.add(n);
    const text = stripKeys(e.dict || e.body, DROP_KEYS);
    for (const m of text.matchAll(refRe)) stack.push(Number(m[1]));
  }
  return seen;
}

function stringEntries(dict) {
  const out = [];
  for (const m of dict.matchAll(/\/([A-Za-z0-9_.-]+)\s*(?=[(<\/])/g)) {
    const at = m.index + m[0].length;
    if (dict[at] === '(' || (dict[at] === '<' && dict[at + 1] !== '<')) out.push([m[1], readString(dict, at)]);
    else if (dict[at] === '/') { const name = /^\/([A-Za-z0-9_.-]+)/.exec(dict.slice(at)); if (name && m[1] === 'Trapped') out.push([m[1], name[1]]); }
  }
  return out;
}

function pdfDate(v) {
  const m = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz+-])?(\d{2})?'?(\d{2})?/.exec(v);
  if (!m) return v;
  const [, y, mo = '01', d = '01', h, mi, , sign, th, tm] = m;
  const time = h ? ` ${h}:${mi || '00'}` : '';
  const zone = sign && sign !== 'Z' && sign !== 'z' ? ` (UTC${sign}${th || '00'}:${tm || '00'})` : sign ? ' (UTC)' : '';
  return `${y}-${mo}-${d}${time}${zone}`;
}

const INFO_LABEL = {
  Title: 'Title', Author: 'Author', Subject: 'Subject', Keywords: 'Keywords', Creator: 'Created with', Producer: 'PDF software',
  CreationDate: 'Created', ModDate: 'Last modified', Trapped: 'Trapped',
};
// What a field can give away, by its display label. Anything else in the Info dictionary counts as a custom property.
const RISK = { Author: 'author name', 'Created with': 'software used', 'PDF software': 'software used', Created: 'dates', 'Last modified': 'dates', Title: 'document title', Subject: 'document subject', Keywords: 'keywords', 'Document ID': 'document ID' };

function xmpValue(xml, tag) {
  const el = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (el) {
    const items = [...el[1].matchAll(/<rdf:li[^>]*>([^<]*)<\/rdf:li>/g)].map((x) => x[1].trim()).filter(Boolean);
    const text = (items.length ? items.join(', ') : el[1].replace(/<[^>]+>/g, '')).trim();
    if (text) return text;
  }
  const attr = new RegExp(`${tag}="([^"]*)"`).exec(xml);
  return attr ? attr[1].trim() : '';
}
const XMP_TAGS = [['dc:creator', 'Author'], ['dc:title', 'Title'], ['dc:description', 'Subject'], ['xmp:CreatorTool', 'Created with'], ['pdf:Producer', 'PDF software'],
  ['pdf:Keywords', 'Keywords'], ['xmp:CreateDate', 'Created'], ['xmp:ModifyDate', 'Last modified'], ['xmpMM:DocumentID', 'Document ID']];

async function xmpText(doc, e) {
  if (!e?.data) return '';
  let raw = doc.bytes.subarray(e.data[0], e.data[1]);
  if (/\/Filter/.test(e.dict || '')) { try { raw = await inflate(raw); } catch { return ''; } }
  return new TextDecoder('utf-8').decode(raw);
}

const ANNOT = /\/Subtype\s*\/(Text|FreeText|Highlight|Underline|StrikeOut|Squiggly|Stamp|Ink|Line|Square|Circle|Polygon|PolyLine|Caret|FileAttachment)(?![A-Za-z])/;

// What the file reveals today. Does not change anything.
export async function inspect(input) {
  return describe(await parse(input));
}

async function describe(doc) {
  const fields = [];
  const risks = new Set();
  const infoDicts = [];
  for (const n of doc.infoNums) {
    let e = doc.byNum.get(n);
    if (e && !e.dict) { const ref = /^(\d+)\s+\d+\s+R/.exec(e.body); e = ref ? doc.byNum.get(Number(ref[1])) : e; }
    if (e?.dict) infoDicts.push(e.dict);
  }
  // A file without a trailer reference can still carry an Info dictionary: pick up anything that looks like one.
  if (!infoDicts.length) for (const e of doc.entries) if (e.dict && /\/(Author|Producer|Creator|CreationDate)\s*[(<]/.test(e.dict) && !/\/Type\s*\//.test(e.dict)) infoDicts.push(e.dict);
  const seen = new Set();
  for (const dict of infoDicts) {
    for (const [k, v] of stringEntries(dict)) {
      if (!v.trim() || seen.has(k)) continue;
      seen.add(k);
      const label = INFO_LABEL[k] || k;
      fields.push([label, /Date$/.test(k) ? pdfDate(v) : v]);
      if (k !== 'Trapped') risks.add(RISK[label] || 'custom properties');
    }
  }

  const rootEntry = doc.byNum.get(doc.root);
  const xmpRef = /\/Metadata\s+(\d+)\s+\d+\s+R/.exec(rootEntry.dict || rootEntry.body);
  let xmpBytes = 0;
  let pdfa = false;
  if (xmpRef) {
    const xml = await xmpText(doc, doc.byNum.get(Number(xmpRef[1])));
    xmpBytes = xml.length;
    pdfa = /pdfaid:/.test(xml);
    const have = new Set(fields.map(([k]) => k));
    for (const [tag, label] of XMP_TAGS) {
      const v = xmpValue(xml, tag);
      if (v && !have.has(label)) { fields.push([label, v]); have.add(label); risks.add(RISK[label]); }
    }
  }

  const keep = reachable(doc);
  let xmpPackets = 0;
  let pages = 0;
  const annotAuthors = new Set();
  let signed = false;
  for (const n of keep) {
    const e = doc.byNum.get(n);
    const d = e.dict || '';
    if (/\/Type\s*\/Page(?![A-Za-z])/.test(d)) pages += 1;
    if (ANNOT.test(d)) { const t = /\/T\s*(?=[(<])/.exec(d); if (t) { const a = readString(d, t.index + t[0].length).trim(); if (a) annotAuthors.add(a); } }
    if (/\/ByteRange\s*\[/.test(d) || /\/Type\s*\/Sig(?![A-Za-z])/.test(d)) signed = true;
  }
  for (const e of doc.byNum.values()) if (/\/Metadata\s+\d+\s+\d+\s+R/.test(e.dict || e.body) && keep.has(e.num)) xmpPackets += 1;
  const pieceInfo = [...keep].some((n) => /\/PieceInfo(?![A-Za-z])/.test(doc.byNum.get(n).dict || ''));
  const olderObjects = doc.entries.length - doc.byNum.size; // objects that a later save replaced
  if (doc.revisions > 1 || olderObjects > 0) risks.add('earlier versions of the document');
  if (pieceInfo) risks.add('editor-private data');
  if (annotAuthors.size) risks.add('comment authors');
  return {
    fields, risks: [...risks], pages, revisions: doc.revisions, olderObjects, xmp: xmpBytes > 0, xmpPackets, pdfa, signed, pieceInfo,
    annotAuthors: [...annotAuthors], hasMetadata: fields.length > 0 || xmpBytes > 0 || doc.revisions > 1 || olderObjects > 0 || pieceInfo,
  };
}

// Writes a new PDF without Info, XMP, PieceInfo or earlier revisions. Returns { bytes, removed: [labels] }.
export async function clean(input) {
  const doc = await parse(input);
  const before = await describe(doc);
  const keep = reachable(doc);
  const head = /^%PDF-\d\.\d/.exec(doc.src.slice(0, 1024))?.[0] || '%PDF-1.7';
  const chunks = [toBytes(`${head}\n%\xE2\xE3\xCF\xD3\n`)];
  const offsets = new Map();
  let size = chunks[0].length;
  const push = (b) => { chunks.push(b); size += b.length; };
  const nums = [...keep].sort((a, b) => a - b);
  for (const n of nums) {
    const e = doc.byNum.get(n);
    if (e.dict && /\/Type\s*\/(ObjStm|XRef)(?![A-Za-z])/.test(e.dict)) { keep.delete(n); continue; }
    offsets.set(n, size);
    if (e.data) {
      let dict = stripKeys(e.dict, DROP_KEYS);
      if (e.lengthFixed) dict = dict.replace(/\/Length\s+\d+(?!\s+\d+\s+R)/, `/Length ${e.data[1] - e.data[0]}`);
      push(toBytes(`${n} ${e.gen} obj\n${dict}\nstream\n`));
      push(doc.bytes.subarray(e.data[0], e.data[1]));
      push(toBytes('\nendstream\nendobj\n'));
    } else {
      push(toBytes(`${n} ${e.gen} obj\n${stripKeys(e.body, DROP_KEYS)}\nendobj\n`));
    }
  }
  const max = Math.max(...offsets.keys());
  const free = [];
  for (let n = 1; n <= max; n += 1) if (!offsets.has(n)) free.push(n);
  const xrefAt = size;
  const lines = [`xref\n0 ${max + 1}\n`];
  const nextFree = (n) => free[free.indexOf(n) + 1] || 0;
  lines.push(`${String(free[0] || 0).padStart(10, '0')} 65535 f \n`);
  for (let n = 1; n <= max; n += 1) lines.push(offsets.has(n) ? `${String(offsets.get(n)).padStart(10, '0')} ${String(doc.byNum.get(n).gen).padStart(5, '0')} n \n` : `${String(nextFree(n)).padStart(10, '0')} 00000 f \n`);
  const rootGen = doc.byNum.get(doc.root).gen;
  lines.push(`trailer\n<< /Size ${max + 1} /Root ${doc.root} ${rootGen} R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  push(toBytes(lines.join('')));
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }

  const removed = [];
  if (before.fields.length) removed.push('Document properties');
  if (before.xmp || before.xmpPackets) removed.push('XMP metadata');
  if (before.pieceInfo) removed.push('Editor-private data');
  if (before.revisions > 1 || before.olderObjects > 0) removed.push('Earlier saved versions');
  return { bytes: out, removed, before };
}

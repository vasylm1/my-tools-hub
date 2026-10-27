// Read the first worksheet of an .xlsx file into rows of strings. Regex-based so it also runs in Node tests.
import { createZip, readZip } from './zip.js';

const unescapeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

const textRuns = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');

function columnIndex(ref) {
  let n = 0;
  for (const ch of ref.replace(/[^A-Z]/gi, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

export function parseSheetXml(xml, shared = []) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row = [];
    let next = 0;
    for (const c of (rowMatch[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /\br="([A-Z]+)\d+"/i.exec(attrs);
      const col = ref ? columnIndex(ref[1]) : next;
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const body = c[2] || '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = '';
      if (type === 's') value = shared[+v] ?? '';
      else if (type === 'inlineStr') value = textRuns(body);
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (v != null) value = unescapeXml(v);
      while (row.length < col) row.push('');
      row[col] = value;
      next = col + 1;
    }
    rows.push(row);
  }
  while (rows.length && rows[rows.length - 1].every((x) => x === '')) rows.pop();
  return rows;
}

/** @returns {Promise<{ sheetName: string, rows: string[][] }>} the first sheet of the workbook */
export async function readXlsx(buffer) {
  const zip = readZip(buffer);
  if (!zip.names.includes('xl/workbook.xml')) throw new Error('This does not look like an .xlsx workbook.');
  const sharedXml = await zip.text('xl/sharedStrings.xml');
  const shared = sharedXml ? [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''))) : [];
  const workbook = await zip.text('xl/workbook.xml');
  const first = /<sheet\b([^>]*)\/?>/.exec(workbook);
  let path = 'xl/worksheets/sheet1.xml';
  let sheetName = 'Sheet1';
  if (first) {
    sheetName = unescapeXml(/\bname="([^"]*)"/.exec(first[1])?.[1] ?? sheetName);
    const rid = /\br:id="([^"]+)"/.exec(first[1])?.[1];
    const rels = await zip.text('xl/_rels/workbook.xml.rels');
    const target = rid && rels && new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*>`).exec(rels)?.[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (target) path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  }
  const xml = await zip.text(path);
  if (xml == null) throw new Error('The first worksheet could not be found in this workbook.');
  return { sheetName, rows: parseSheetXml(xml, shared) };
}

/** Build a tiny single-sheet .xlsx from rows (used for templates). Strings are stored inline. */
export function buildXlsx(rows, sheetName = 'Sheet1') {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const colName = (i) => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
  const sheet = rows.map((r, y) => `<row r="${y + 1}">${r.map((v, x) => `<c r="${colName(x)}${y + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`).join('');
  return createZip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', data: `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>` },
  ]);
}

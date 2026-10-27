// CSV parsing and writing (RFC 4180 quoting, delimiter auto-detection).

export function detectDelimiter(text) {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ',';
}

/** Parse CSV text into an array of rows (arrays of strings). */
export function parseCSV(text, delimiter) {
  text = String(text ?? '').replace(/^﻿/, '');
  const d = delimiter || detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  const endCell = () => { row.push(cell); cell = ''; };
  const endRow = () => { endCell(); rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === d) endCell();
    else if (ch === '\n') endRow();
    else if (ch === '\r') { if (text[i + 1] === '\n') i++; endRow(); }
    else cell += ch;
    i++;
  }
  if (cell !== '' || row.length) endRow();
  return rows;
}

const needsQuote = (s, d) => s.includes(d) || s.includes('"') || s.includes('\n') || s.includes('\r') || /^\s|\s$/.test(s);

/** Serialize rows to CSV. `null`/`undefined` become empty cells. */
export function toCSV(rows, delimiter = ',') {
  return rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    return needsQuote(s, delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(delimiter)).join('\r\n');
}

/** Split parsed rows into a header row and body rows (ragged rows are padded). */
export function tableFromRows(rows) {
  if (!rows.length) return { head: [], body: [] };
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r) => Array.from({ length: width }, (_, i) => r[i] ?? '');
  const [head, ...body] = rows.map(pad);
  return { head, body };
}

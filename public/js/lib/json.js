// Strict JSON validator with line/column errors and duplicate-key detection.
// It only validates; the actual value comes from JSON.parse once validation passes.

export class JsonError extends Error {
  constructor(message, index, text) {
    super(message);
    this.index = index;
    let line = 1;
    let col = 1;
    for (let i = 0; i < Math.min(index, text.length); i++) {
      if (text[i] === '\n') { line++; col = 1; } else col++;
    }
    this.line = line;
    this.column = col;
  }
}

const WS = new Set([' ', '\t', '\n', '\r']);
const MAX_DEPTH = 400;

/** @returns {{ value: any, duplicates: string[] }} @throws {JsonError} */
export function validateJson(text) {
  let i = 0;
  const duplicates = [];
  const fail = (msg, at = i) => { throw new JsonError(msg, at, text); };
  const skip = () => { while (i < text.length && WS.has(text[i])) i++; };

  function string() {
    const start = i;
    i++; // opening quote
    let out = '';
    while (i < text.length) {
      const c = text[i];
      if (c === '"') { i++; return out; }
      if (c === '\\') {
        const e = text[i + 1];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail('Invalid \\u escape', i);
          out += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16));
          i += 6;
        } else if ('"\\/bfnrt'.includes(e) && e !== undefined) {
          out += { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }[e] ?? e;
          i += 2;
        } else fail('Invalid \\ escape', i);
      } else if (c < ' ') fail('Invalid control character in string', i);
      else { out += c; i++; }
    }
    return fail('Unterminated string', start);
  }

  function value(depth) {
    if (depth > MAX_DEPTH) fail('Maximum nesting depth exceeded');
    skip();
    const c = text[i];
    if (c === '{') {
      i++;
      const seen = new Set();
      skip();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        skip();
        if (text[i] !== '"') fail('Expecting property name enclosed in double quotes');
        const key = string();
        if (seen.has(key)) duplicates.push(key); else seen.add(key);
        skip();
        if (text[i] !== ':') fail("Expecting ':' delimiter");
        i++;
        value(depth + 1);
        skip();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return; }
        fail("Expecting ',' delimiter");
      }
    } else if (c === '[') {
      i++;
      skip();
      if (text[i] === ']') { i++; return; }
      for (;;) {
        value(depth + 1);
        skip();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; return; }
        fail("Expecting ',' delimiter");
      }
    } else if (c === '"') string();
    else {
      const m = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 64));
      if (!m) fail('Expecting value');
      i += m[0].length;
    }
  }

  skip();
  if (i >= text.length) fail('Expecting value');
  value(0);
  skip();
  if (i < text.length) fail('Extra data after the JSON value');
  return { value: JSON.parse(text), duplicates: [...new Set(duplicates)] };
}

export function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeysDeep(v[k])]));
  return v;
}

/** Flatten an array of objects into CSV rows. Nested values are JSON-encoded. */
export function jsonToRows(value) {
  const list = Array.isArray(value) ? value : [value];
  if (!list.length || !list.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
    throw new Error('CSV conversion needs a JSON array of objects, e.g. [{"a":1},{"a":2}].');
  }
  const cols = [...new Set(list.flatMap((o) => Object.keys(o)))];
  const cell = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v);
  return [cols, ...list.map((o) => cols.map((c) => cell(o[c])))];
}

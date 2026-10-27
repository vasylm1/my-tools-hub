// A small SQL pretty-printer: tokenizes (strings, comments, identifiers) and lays out clauses.

const MAJOR = [
  'WITH', 'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'RETURNING', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'WINDOW',
];
const JOINS = ['LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'NATURAL JOIN', 'JOIN'];
const INLINE_KEYWORDS = new Set(`AS ON AND OR NOT IN IS NULL LIKE ILIKE BETWEEN EXISTS CASE WHEN THEN ELSE END DISTINCT ALL ASC DESC USING
OVER PARTITION BY INTO DEFAULT PRIMARY KEY REFERENCES UNIQUE CHECK CONSTRAINT IF ANY SOME TOP FETCH NEXT ROWS ONLY FIRST LAST
COUNT SUM AVG MIN MAX COALESCE CAST NULLIF ROW_NUMBER RANK DENSE_RANK LAG LEAD TRUE FALSE CURRENT_DATE CURRENT_TIMESTAMP`.split(/\s+/));
const MULTI = [...MAJOR, ...JOINS].filter((k) => k.includes(' ')).sort((a, b) => b.split(' ').length - a.split(' ').length);

export function tokenize(sql) {
  const tokens = [];
  const re = /\s+|--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'|"(?:[^"]|"")*"|`[^`]*`|\[[^\]]*\]|[A-Za-z_][\w$]*|\d+(?:\.\d+)?|<>|<=|>=|!=|\|\||::|[(),;.*+\-/%=<>]|./gy;
  let m;
  while ((m = re.exec(sql))) {
    const t = m[0];
    if (/^\s+$/.test(t)) continue;
    tokens.push({ text: t, type: t.startsWith('--') || t.startsWith('/*') ? 'comment' : /^['"`[]/.test(t) ? 'quoted' : /^[A-Za-z_]/.test(t) ? 'word' : 'sym' });
  }
  return tokens;
}

function matchMulti(tokens, i, list) {
  for (const phrase of list) {
    const parts = phrase.split(' ');
    if (parts.every((p, k) => tokens[i + k]?.type === 'word' && tokens[i + k].text.toUpperCase() === p)) return { phrase, len: parts.length };
  }
  return null;
}

const LIST_CLAUSES = new Set(['SELECT', 'SET', 'GROUP BY', 'ORDER BY', 'WITH']);
const SET_OPS = new Set(['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT']);
const NOT_CALLS = new Set(['IN', 'AND', 'OR', 'ON', 'NOT', 'EXISTS', 'AS', 'VALUES', 'USING', 'ANY', 'ALL', 'SOME', 'WHEN', 'THEN', 'ELSE', 'BETWEEN', 'LIKE', 'FROM', 'JOIN', 'WHERE']);

export function formatSql(sql, { indent = '  ', uppercase = true } = {}) {
  const tokens = tokenize(sql);
  const kw = (t) => (uppercase ? t.toUpperCase() : t.toLowerCase());
  let out = '';
  let base = 0; // indent of the query we are currently inside
  let level = 0;
  let clause = '';
  let lineStart = true;
  let prev = null;
  const parens = [];

  const newline = () => {
    out = out.replace(/[ ]+$/, '');
    if (out && !out.endsWith('\n')) out += '\n';
    out += indent.repeat(Math.max(0, level));
    lineStart = true;
  };
  const emit = (text, space = true) => {
    if (!lineStart && space) out += ' ';
    out += text;
    lineStart = false;
  };
  const tightAfter = () => prev && (prev.text === '.' || prev.text === '::' || prev.text === '(');

  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    const upper = tk.text.toUpperCase();

    if (tk.type === 'comment') {
      emit(tk.text);
      if (tk.text.startsWith('--')) newline();
      prev = tk;
      continue;
    }

    if (tk.type === 'word') {
      const major = matchMulti(tokens, i, MAJOR) || (MAJOR.includes(upper) ? { phrase: upper, len: 1 } : null);
      const startsStatement = !prev || prev.text === ';';
      if (major && !(major.phrase === 'SET' && clause !== 'UPDATE') && !(major.phrase === 'WITH' && !startsStatement)) {
        level = base;
        if (!lineStart) newline();
        emit(kw(major.phrase));
        clause = major.phrase;
        i += major.len - 1;
        if (LIST_CLAUSES.has(clause)) { level = base + 1; newline(); }
        if (SET_OPS.has(clause)) { newline(); }
        prev = tk;
        continue;
      }
      const join = matchMulti(tokens, i, JOINS);
      if (join) {
        level = base;
        newline();
        emit(kw(join.phrase));
        clause = 'JOIN';
        i += join.len - 1;
        prev = tk;
        continue;
      }
      if (upper === 'ON' && clause === 'JOIN') { clause = 'ON'; emit(kw('ON')); prev = tk; continue; }
      if ((upper === 'AND' || upper === 'OR') && ['WHERE', 'HAVING', 'ON'].includes(clause) && !(upper === 'AND' && inBetween(tokens, i))) {
        const saved = level;
        level = base + 1;
        newline();
        level = saved;
        emit(kw(upper));
        prev = tk;
        continue;
      }
      if (upper === 'CASE') { emit(kw('CASE')); level++; prev = tk; continue; }
      if ((upper === 'WHEN' || upper === 'ELSE') && level > base) { newline(); emit(kw(upper)); prev = tk; continue; }
      if (upper === 'END' && level > base) { level--; newline(); emit(kw('END')); prev = tk; continue; }

      const isKw = INLINE_KEYWORDS.has(upper);
      emit(isKw ? kw(tk.text) : tk.text, !tightAfter());
      if (tokens[i + 1]?.text === '(') tokens[i + 1].tight = !NOT_CALLS.has(upper) && clause !== 'INSERT INTO' && clause !== 'CREATE TABLE';
      prev = tk;
      continue;
    }

    switch (tk.text) {
      case ',':
        out = out.replace(/[ ]+$/, '') + ',';
        lineStart = false;
        if (LIST_CLAUSES.has(clause) && parens.every((p) => p.sub)) newline();
        break;
      case ';':
        out = out.replace(/[ ]+$/, '') + ';';
        base = 0; level = 0; clause = ''; lineStart = false;
        if (i < tokens.length - 1) { out += '\n\n'; lineStart = true; }
        break;
      case '(': {
        const sub = /^(SELECT|WITH)$/i.test(tokens[i + 1]?.text || '');
        emit('(', !(tk.tight || tightAfter()));
        parens.push({ sub, base, level, clause });
        if (sub) { base = level + 1; level = base; clause = ''; newline(); }
        break;
      }
      case ')': {
        const closed = parens.pop();
        if (closed?.sub) {
          base = closed.base;
          level = closed.level;
          newline();
          clause = closed.clause;
          emit(')', false);
        } else emit(')', false);
        break;
      }
      case '.': case '::': emit(tk.text, false); break;
      default: emit(tk.text, !tightAfter());
    }
    prev = tk;
  }
  return `${out.replace(/[ \t]+\n/g, '\n').trim()}\n`;
}

function inBetween(tokens, i) {
  for (let k = i - 1; k >= 0 && k > i - 8; k--) {
    const t = tokens[k].text.toUpperCase();
    if (t === 'BETWEEN') return true;
    if (t === 'AND' || t === 'OR' || t === 'WHERE' || t === 'ON') return false;
  }
  return false;
}

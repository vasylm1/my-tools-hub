// Text analysis helpers (no DOM).

export const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu;
export const words = (text) => String(text).match(WORD_RE) ?? [];

const STOPWORDS = new Set(`
a an the and or but if then else of to in on for with at by from up about into over after before
is are was were be been being do does did this that these those it its as not no nor so than too very
he she they we you i your our their his her them him me my mine ours yours has have had will would can
de la le les des et un une du au aux pour avec sur dans par ne pas plus
der die das und oder aber mit fur für von zu im am ist sind ein eine den dem auch nicht
w z na nie to sie się ze jest są oraz dla od po jak co czy tak ten ta te
і в у на з до не що це як для бо але або чи
`.split(/\s+/).filter(Boolean));

export function countSyllables(word) {
  const groups = word.toLowerCase().match(/[aeiouyąęóуеёиыэюяіїєäöü]+/g);
  return Math.max(1, groups ? groups.length : 0);
}

export function fleschLabel(score) {
  if (score >= 90) return 'Very easy';
  if (score >= 70) return 'Easy';
  if (score >= 60) return 'Plain';
  if (score >= 50) return 'Fairly hard';
  if (score >= 30) return 'Hard';
  return 'Very hard';
}

export function topWords(list, n, minLen = 3) {
  const counts = new Map();
  for (const w of list.map((x) => x.toLowerCase())) {
    if (w.length < minLen || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

export function analyzeCopy(text) {
  const ws = words(text);
  const sentences = String(text).split(/[.!?…]+/).filter((s) => s.trim());
  const paragraphs = String(text).split(/\n\s*\n/).filter((s) => s.trim());
  const syllables = ws.reduce((n, w) => n + countSyllables(w), 0) || 1;
  const nSent = Math.max(1, sentences.length);
  const raw = 206.835 - 1.015 * (ws.length / nSent) - 84.6 * (syllables / Math.max(1, ws.length));
  const flesch = Math.max(0, Math.min(100, Math.round(raw)));
  return {
    words: ws.length,
    chars: [...text].length,
    charsNoSpaces: [...text.replace(/\s/g, '')].length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    avgSentence: ws.length / nSent,
    readingMin: ws.length / 200,
    speakingMin: ws.length / 130,
    flesch,
    fleschLabel: fleschLabel(flesch),
    top: topWords(ws, 10),
  };
}

const POWER_WORDS = new Set(`free new now best easy proven instantly guaranteed save boost ultimate exclusive secret
powerful essential fast top smart win discover unlock results today how why you your`.split(/\s+/));

export function scoreHeadline(headline) {
  const chars = [...headline].length;
  const ws = words(headline);
  const powers = ws.filter((w) => POWER_WORDS.has(w.toLowerCase()));
  const hasNumber = /\d/.test(headline);
  let score = 40;
  if (chars >= 40 && chars <= 60) score += 25; else if (chars >= 30 && chars <= 70) score += 12;
  if (ws.length >= 6 && ws.length <= 12) score += 15;
  if (powers.length) score += 12;
  if (hasNumber) score += 8;
  score = Math.min(100, score);
  const tips = [];
  if (chars < 30) tips.push('Very short: add detail so readers know what they get.');
  else if (chars > 70) tips.push('Longer than 70 characters: search engines may truncate it.');
  else if (chars > 60) tips.push('Over 60 characters: it may be cut off in search results.');
  else if (chars < 40) tips.push('Aim for 40–60 characters for the best balance.');
  if (ws.length < 6) tips.push('Try 6–12 words.');
  else if (ws.length > 12) tips.push('Try trimming to 12 words or fewer.');
  if (!powers.length) tips.push('Consider a power word such as “proven”, “free” or “how”.');
  if (!hasNumber) tips.push('Numbers (“7 ways…”) tend to lift click-through.');
  if (!tips.length) tips.push('Length, wording and structure all look strong.');
  return { chars, words: ws.length, powers, hasNumber, score, tips };
}

export function extractKeywords(text, n = 12) {
  const found = [...new Set([...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]))];
  const ws = (text.toLowerCase().match(/[\p{L}]{3,}/gu) ?? []);
  return { found, top: topWords(ws, n) };
}

/** Longest-common-subsequence diff over token arrays. Returns [{ type: 'eq'|'add'|'del', value }]. */
export function diffTokens(a, b, eq = (x, y) => x === y) {
  let start = 0;
  while (start < a.length && start < b.length && eq(a[start], b[start])) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && eq(a[endA - 1], b[endB - 1])) { endA--; endB--; }
  const A = a.slice(start, endA);
  const B = b.slice(start, endB);
  const n = A.length;
  const m = B.length;
  if (n * m > 16e6) throw new Error('These texts are too different and too long to compare in the browser. Try smaller sections.');
  const w = m + 1;
  const dp = new Uint16Array((n + 1) * w);
  const cap = 65535;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = eq(A[i], B[j]) ? Math.min(cap, dp[(i + 1) * w + j + 1] + 1) : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const ops = a.slice(0, start).map((value) => ({ type: 'eq', value }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(A[i], B[j])) { ops.push({ type: 'eq', value: A[i] }); i++; j++; }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) ops.push({ type: 'del', value: A[i++] });
    else ops.push({ type: 'add', value: B[j++] });
  }
  while (i < n) ops.push({ type: 'del', value: A[i++] });
  while (j < m) ops.push({ type: 'add', value: B[j++] });
  for (const v of a.slice(endA)) ops.push({ type: 'eq', value: v });
  return ops;
}

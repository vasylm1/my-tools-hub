// Sentence-level readability: the LIX index works for most European languages; grade level and passive voice are English only.
import { words as wordList, countSyllables } from './text.js';

const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'no', 'fig', 'inc', 'ltd', 'co',
  'np', 'tzw', 'itd', 'itp', 'ul', 'ok', 'godz', 'tys', 'mln', 'z.b', 'usw', 'bzw', 'ca', 'd.h', 'u.a', 'vgl', 'nr', 'str']);

// Splits on . ! ? and the ellipsis when followed by a space and a capital letter, digit, quote or the end of the text.
export function splitSentences(text) {
  const out = [];
  const src = String(text);
  let start = 0;
  const push = (end) => {
    const raw = src.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (body) out.push({ text: body, start: start + lead, end: start + lead + body.length });
    start = end;
  };
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '\n' && src[i + 1] === '\n') { push(i); continue; }
    if (!/[.!?…]/.test(ch)) continue;
    let j = i + 1;
    while (j < src.length && /[.!?…"'”’)\]]/.test(src[j])) j += 1;
    if (j < src.length && !/\s/.test(src[j])) continue; // 3.5, example.com, e.g.
    let k = j;
    while (k < src.length && /\s/.test(src[k])) k += 1;
    const next = src[k];
    if (k < src.length && !/[\p{Lu}\p{N}"'“‘(\[]/u.test(next)) { i = j - 1; continue; }
    if (ch === '.') {
      const before = src.slice(0, i).match(/[\p{L}.]+$/u)?.[0]?.toLowerCase() || '';
      if (ABBREVIATIONS.has(before) || /^\p{L}$/u.test(before)) { i = j - 1; continue; } // single initials like "J."
    }
    push(j);
    i = j - 1;
  }
  push(src.length);
  return out;
}

const IRREGULAR = ['arisen', 'begun', 'bought', 'broken', 'brought', 'built', 'chosen', 'cut', 'done', 'drawn', 'driven', 'eaten', 'fallen', 'fed', 'felt',
  'found', 'given', 'grown', 'heard', 'held', 'hidden', 'hit', 'hurt', 'kept', 'known', 'laid', 'led', 'left', 'let', 'lit', 'lost', 'made', 'met', 'paid',
  'put', 'read', 'run', 'seen', 'sent', 'set', 'shown', 'shut', 'sold', 'spent', 'split', 'spoken', 'spread', 'stolen', 'struck', 'sung', 'taken', 'taught',
  'thrown', 'told', 'torn', 'understood', 'won', 'woken', 'worn', 'written'];
const NOT_PASSIVE = new Set(['tired', 'excited', 'interested', 'concerned', 'worried', 'scared', 'surprised', 'pleased', 'hundred', 'sacred', 'naked',
  'wicked', 'beloved', 'indeed', 'bored', 'confused', 'amazed', 'married', 'finished', 'prepared', 'ashamed', 'embarrassed', 'satisfied']);
const PASSIVE_RE = new RegExp(`\\b(?:am|is|are|was|were|be|been|being)\\s+(?:(?:not|never|also|often|always|still|already|just|usually|rarely)\\s+)*(?:[a-z]+ly\\s+)?([a-z]{3,}ed|${IRREGULAR.join('|')})\\b`, 'gi');

export function findPassive(sentence) {
  const hits = [];
  for (const m of sentence.matchAll(PASSIVE_RE)) {
    if (NOT_PASSIVE.has(m[1].toLowerCase())) continue;
    hits.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return hits;
}

export const LONG = 25;
export const VERY_LONG = 35;

export function lixLabel(lix) {
  if (lix < 30) return 'Very easy';
  if (lix < 40) return 'Easy';
  if (lix < 50) return 'Medium';
  if (lix < 60) return 'Hard';
  return 'Very hard';
}

export function analyzeReadability(text, { lang = 'en' } = {}) {
  const english = lang === 'en';
  const list = splitSentences(text).map((s) => {
    const w = wordList(s.text);
    const flags = [];
    if (w.length >= VERY_LONG) flags.push('very-long'); else if (w.length >= LONG) flags.push('long');
    const passive = english ? findPassive(s.text) : [];
    if (passive.length) flags.push('passive');
    return { ...s, words: w.length, flags, passive };
  }).filter((s) => s.words > 0);

  // Three or more sentences in a row that open with the same word read as monotone.
  const first = list.map((s) => (wordList(s.text)[0] || '').toLowerCase());
  for (let i = 0; i < list.length; i += 1) {
    let run = 1;
    while (i + run < list.length && first[i + run] === first[i] && first[i]) run += 1;
    if (run >= 3) { for (let k = i; k < i + run; k += 1) list[k].flags.push('same-start'); i += run - 1; }
  }

  const all = wordList(text);
  const words = all.length;
  const sentences = list.length;
  const longWords = all.filter((w) => [...w].length > 6).length;
  const avgSentence = sentences ? words / sentences : 0;
  const lix = words ? avgSentence + (100 * longWords) / words : 0;
  const syllables = english ? all.reduce((n, w) => n + countSyllables(w), 0) : 0;
  const grade = english && words && sentences ? 0.39 * avgSentence + 11.8 * (syllables / words) - 15.59 : null;
  const count = (flag) => list.filter((s) => s.flags.includes(flag)).length;
  return {
    words, sentences, avgSentence, lix, lixLabel: lixLabel(lix),
    longWordShare: words ? longWords / words : 0,
    grade: grade === null ? null : Math.max(0, Math.round(grade * 10) / 10),
    list,
    counts: { long: count('long'), veryLong: count('very-long'), passive: count('passive'), sameStart: count('same-start') },
  };
}

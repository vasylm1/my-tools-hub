// Writing & text tools.
import { h } from '../core/dom.js';
import { analyzeCopy, scoreHeadline, extractKeywords, diffTokens } from '../lib/text.js';
import { markdownToHtml, markdownDocument } from '../lib/md.js';
import { htmlToMarkdown } from '../lib/html2md.js';
import { analyzeReadability } from '../lib/readability.js';
import { t as tr } from '../i18n.js';

const SAMPLE_COPY = `Great copy is clear. It respects the reader's time and says one thing well.

Short sentences help. So do concrete words, active verbs and a friendly tone. Read it aloud: if you stumble, your reader will too!`;

const READABILITY_SAMPLE = `Our new thermostat was designed by a small team in Warsaw. It was tested in forty offices over two winters. The results were reviewed by an independent lab.

We wanted a product that anyone could install without a manual, which meant rethinking the pairing process, the mobile app, the packaging, the support articles and the default schedules so that a facilities manager with no technical background could complete the whole setup in a few minutes while standing in a corridor.

We made it simple. We made it quiet. We made it cheap to run.`;

const fmtMin = (m) => (m < 1 ? `${Math.max(1, Math.round(m * 60))} sec` : `${Math.round(m)} min`);

export const tools = {
  'copy-analyzer': {
    fields: [{ id: 'text', type: 'textarea', label: 'Your text', rows: 12, placeholder: 'Paste or type your copy here…', spellcheck: true }],
    example: { text: SAMPLE_COPY },
    run({ text }) {
      if (!text.trim()) return { empty: 'Paste some text to see its statistics.' };
      const a = analyzeCopy(text);
      return {
        stats: [
          ['Words', a.words], ['Characters', a.chars], ['No spaces', a.charsNoSpaces], ['Sentences', a.sentences], ['Paragraphs', a.paragraphs],
          ['Words / sentence', a.avgSentence.toFixed(1)], ['Reading time', fmtMin(a.readingMin)], ['Speaking time', fmtMin(a.speakingMin)],
          ['Readability', `${a.flesch} · ${a.fleschLabel}`],
        ],
        notice: { kind: 'info', text: 'Readability is the Flesch Reading Ease score (0–100, higher is easier). It is tuned for English; other languages are approximate.' },
        table: a.top.length ? { caption: 'Most used words', head: ['Word', 'Count'], rows: a.top } : null,
      };
    },
  },

  'readability-checker': {
    fields: [
      { id: 'text', type: 'textarea', label: 'Your text', rows: 12, placeholder: 'Paste or type your text here…', spellcheck: true },
      { id: 'lang', type: 'select', label: 'Language', options: [['en', 'English'], ['other', 'Another language (Polish, German, …)']], hint: 'Passive voice and grade level are checked for English only.' },
    ],
    example: { text: READABILITY_SAMPLE, lang: 'en' },
    run({ text, lang }) {
      if (!text.trim()) return { empty: 'Paste some text to check how easy it is to read.' };
      const r = analyzeReadability(text, { lang });
      const issue = { long: 'Long sentence', 'very-long': 'Very long sentence', passive: 'Passive voice', 'same-start': 'Same opening word' };
      const flagged = r.list.filter((s) => s.flags.length);
      const stats = [['Words', r.words], ['Sentences', r.sentences], ['Words / sentence', r.avgSentence.toFixed(1)], ['Readability (LIX)', `${Math.round(r.lix)} · ${tr(r.lixLabel)}`]];
      if (r.grade !== null) stats.push(['Grade level', r.grade.toFixed(1)]);
      stats.push(['Long sentences', r.counts.long + r.counts.veryLong]);
      if (lang === 'en') stats.push(['Passive sentences', r.counts.passive]);
      stats.push(['Repeated openings', r.counts.sameStart]);
      // Highlighted copy of the text: sentences keep their original spacing, passive phrases are marked inside them.
      const view = h('div', { class: 'rd-text', lang: lang === 'en' ? 'en' : undefined });
      let at = 0;
      for (const s of r.list) {
        view.append(text.slice(at, s.start));
        const cls = s.flags.includes('very-long') ? 'rd-vlong' : s.flags.includes('long') ? 'rd-long' : '';
        const wrap = h(cls ? 'mark' : 'span', { class: cls });
        let from = 0;
        for (const p of s.passive) { wrap.append(s.text.slice(from, p.start), h('u', { class: 'rd-passive' }, s.text.slice(p.start, p.end))); from = p.end; }
        wrap.append(s.text.slice(from));
        view.append(wrap);
        at = s.end;
      }
      view.append(text.slice(at));
      const legend = h('p', { class: 'muted small-text' },
        h('mark', { class: 'rd-long' }, tr('Long sentence')), ' ', h('mark', { class: 'rd-vlong' }, tr('Very long sentence')), ' ', lang === 'en' && h('u', { class: 'rd-passive' }, tr('Passive voice')));
      return {
        sections: [
          { stats },
          { node: h('div', { class: 'block' }, view, legend) },
          flagged.length ? { table: { caption: tr('Sentences worth a second look'), head: [tr('Sentence'), tr('Words'), tr('Issue')],
            rows: flagged.map((s) => [s.text.length > 110 ? `${s.text.slice(0, 107)}…` : s.text, s.words, s.flags.map((f) => tr(issue[f])).join(', ')]) } } : {},
          { notice: { kind: 'info', text: lang === 'en'
            ? 'LIX combines sentence length and long words (under 30 is very easy, over 60 very hard). Sentences of 25 words or more are marked as long and 35 or more as very long.'
            : 'LIX combines sentence length and long words and works for most European languages (under 30 is very easy, over 60 very hard). Grade level and passive voice are shown for English only.' } },
        ],
      };
    },
  },

  'headline-analyzer': {
    fields: [{ id: 'headline', type: 'text', label: 'Headline', placeholder: '7 proven ways to write headlines people click', spellcheck: true }],
    example: { headline: '7 proven ways to write headlines people actually click' },
    run({ headline }) {
      if (!headline.trim()) return { empty: 'Type a headline to score it.' };
      const r = scoreHeadline(headline.trim());
      return {
        stats: [['Score', `${r.score}/100`], ['Characters', r.chars], ['Words', r.words], ['Number', r.hasNumber ? 'Yes' : 'No'], ['Power words', r.powers.length ? r.powers.join(', ') : '—']],
        node: h('ul', { class: 'tips' }, ...r.tips.map((t) => h('li', {}, t))),
        notice: 'Power-word detection works best for English headlines.',
      };
    },
  },

  'hashtag-extractor': {
    fields: [
      { id: 'text', type: 'textarea', label: 'Text', rows: 10, placeholder: 'Paste a post, article or caption…', spellcheck: true },
      { id: 'count', type: 'range', label: 'Number of keywords', min: 5, max: 30, value: 12 },
    ],
    example: { text: 'Our new smart thermostat range cuts energy use in offices by 20%. Smart controls, room sensors and open protocols make retrofits simple. #sustainability #lighting' },
    run({ text, count }) {
      if (!text.trim()) return { empty: 'Paste some text to extract keywords and hashtags.' };
      const { found, top } = extractKeywords(text, count);
      const sections = [
        { table: top.length ? { head: ['Keyword', 'Count'], rows: top } : null, empty: top.length ? null : 'No keywords found.' },
        { text: { label: 'Suggested hashtags', value: top.map(([w]) => `#${w}`).join(' '), rows: 3 } },
      ];
      if (found.length) sections.push({ text: { label: 'Hashtags already in the text', value: found.map((x) => `#${x}`).join(' '), rows: 2 } });
      return { sections };
    },
  },

  'text-diff': {
    fields: [
      { id: 'a', type: 'textarea', label: 'Original', rows: 9, half: false },
      { id: 'b', type: 'textarea', label: 'Changed', rows: 9 },
      { id: 'mode', type: 'select', label: 'Compare by', options: [['lines', 'Lines'], ['words', 'Words']], half: true },
      { id: 'ic', type: 'checkbox', label: 'Ignore case', half: true },
      { id: 'iw', type: 'checkbox', label: 'Ignore whitespace differences', half: true },
    ],
    example: { a: 'Dear team,\nthe launch is on Monday.\nPlease confirm by Friday.\nThanks', b: 'Dear team,\nthe launch moved to Tuesday.\nPlease confirm by Friday.\nThanks,\nAnna' },
    run({ a, b, mode, ic, iw }) {
      if (!a && !b) return { empty: 'Enter two texts to compare them.' };
      const split = (t) => (mode === 'words' ? t.split(/(\s+)/).filter((x) => x !== '') : t.split('\n'));
      const norm = (x) => {
        let v = x;
        if (ic) v = v.toLowerCase();
        if (iw) v = v.replace(/\s+/g, ' ').trim();
        return v;
      };
      const ops = diffTokens(split(a), split(b), (x, y) => norm(x) === norm(y));
      const added = ops.filter((o) => o.type === 'add' && (mode === 'lines' || o.value.trim())).length;
      const removed = ops.filter((o) => o.type === 'del' && (mode === 'lines' || o.value.trim())).length;
      const box = h('div', { class: 'diff', role: 'region', 'aria-label': 'Differences', tabindex: 0 });
      if (mode === 'lines') {
        let ln = 0;
        for (const o of ops) {
          if (o.type !== 'add') ln++;
          box.append(h('div', { class: o.type === 'add' ? 'add' : o.type === 'del' ? 'del' : '' },
            h('span', { class: 'ln' }, o.type === 'add' ? '+' : o.type === 'del' ? '−' : ' '), ' ', o.value || ' '));
        }
      } else {
        const p = h('div', {});
        for (const o of ops) {
          if (o.type === 'eq') p.append(o.value);
          else p.append(h(o.type === 'add' ? 'ins' : 'del', {}, o.value));
        }
        box.append(p);
      }
      return {
        stats: [[mode === 'lines' ? 'Lines added' : 'Words added', added], [mode === 'lines' ? 'Lines removed' : 'Words removed', removed], ['Identical', added + removed === 0 ? 'Yes' : 'No']],
        node: box,
      };
    },
  },

  'markdown-to-html': {
    fields: [
      { id: 'md', type: 'textarea', label: 'Markdown', rows: 14, placeholder: '# Title\n\nSome **bold** text…' },
      { id: 'title', type: 'text', label: 'Document title', value: 'Document' },
    ],
    example: { md: '# Release notes\n\nVersion **2.1** is here.\n\n- Faster exports\n- New *dark* theme\n- [Read the docs](https://example.com)\n\n| Plan | Price |\n|------|------:|\n| Free | 0 |\n| Pro  | 12 |\n\n```js\nconsole.log("hello");\n```' },
    run({ md, title }) {
      if (!md.trim()) return { empty: 'Write some Markdown to preview it.' };
      const full = markdownDocument(md, title || 'Document');
      return {
        html: { value: full, filename: 'document.html', title: 'Rendered Markdown', print: true },
        text: { label: 'HTML body', value: markdownToHtml(md), rows: 8 },
        notice: 'Raw HTML inside the Markdown is escaped for safety.',
      };
    },
  },

  'html-to-markdown': {
    fields: [{ id: 'html', type: 'textarea', label: 'HTML', rows: 14, placeholder: '<h1>Hello</h1><p>Paste <b>HTML</b> here…</p>' }],
    example: { html: '<h1>Pricing</h1><p>Our <strong>Pro</strong> plan includes:</p><ul><li>Unlimited projects</li><li>Priority <a href="https://example.com/support">support</a></li></ul><blockquote>Best tool we use.</blockquote>' },
    run({ html }) {
      if (!html.trim()) return { empty: 'Paste some HTML to convert it to Markdown.' };
      return { text: { label: 'Markdown', value: htmlToMarkdown(html), filename: 'converted.md', mime: 'text/markdown;charset=utf-8', rows: 14 } };
    },
  },
};

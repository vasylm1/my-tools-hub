// Writing & text tools.
import { h } from '../core/dom.js';
import { analyzeCopy, scoreHeadline, extractKeywords, diffTokens } from '../lib/text.js';
import { markdownToHtml, markdownDocument } from '../lib/md.js';
import { htmlToMarkdown } from '../lib/html2md.js';

const SAMPLE_COPY = `Great copy is clear. It respects the reader's time and says one thing well.

Short sentences help. So do concrete words, active verbs and a friendly tone. Read it aloud: if you stumble, your reader will too!`;

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
    example: { text: 'Our new smart lighting range cuts energy use in offices by 40%. Smart controls, daylight sensors and open protocols make lighting retrofits simple. #sustainability #lighting' },
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

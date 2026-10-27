// Small, safe Markdown -> HTML converter (CommonMark subset). Raw HTML in the input is escaped.
// Output is XHTML-compatible (self-closed void tags) so it can also go into EPUB files.

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function safeUrl(url) {
  const u = url.trim().replace(/[\u0000-\u001f\u007f\s]+/g, '');
  if (/^(?:https?:|mailto:|tel:|#|\/|\.{0,2}\/|[^:]*$)/i.test(u) && !/^javascript:/i.test(u)) return url.trim();
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(u)) return url.trim();
  return '#';
}

export function inline(src) {
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
  let s = src;
  s = s.replace(/\\([\\`*_{}\[\]()#+\-.!|>~<])/g, (_, c) => keep(esc(c)));
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, __, code) => keep(`<code>${esc(code.trim())}</code>`));
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\)/g, (_, alt, url, title) =>
    keep(`<img src="${esc(safeUrl(url.replace(/&amp;/g, '&')))}" alt="${alt}"${title ? ` title="${title}"` : ''} />`));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\)/g, (_, text, url, title) =>
    keep(`<a href="${esc(safeUrl(url.replace(/&amp;/g, '&')))}"${title ? ` title="${title}"` : ''} rel="noopener noreferrer">${text}</a>`));
  s = s.replace(/&lt;(https?:\/\/(?:(?!&gt;)\S)+)&gt;/gi, (_, u) => keep(`<a href="${u}" rel="noopener noreferrer">${u}</a>`));
  s = s.replace(/&lt;([^\s@&]+@[^\s@&]+\.[a-z]{2,})&gt;/gi, (_, u) => keep(`<a href="mailto:${u}">${u}</a>`));
  s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>');
  s = s.replace(/(?<![\p{L}\p{N}])(\*|_)(?=\S)([\s\S]*?\S)\1(?![\p{L}\p{N}])/gu, '<em>$2</em>');
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  s = s.replace(/ {2,}\n/g, '<br />\n');
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => stash[+n]);
}

const isTableSep = (l) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l) && l.includes('-');
const splitRow = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;

function renderList(lines) {
  const items = [];
  for (const line of lines) {
    const m = LIST_RE.exec(line);
    if (!m) { if (items.length) items[items.length - 1].text += ` ${line.trim()}`; continue; }
    const task = /^\[([ xX])\]\s+(.*)$/.exec(m[3]);
    items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: task ? task[2] : m[3], task: task ? task[1] !== ' ' : null });
  }
  let pos = 0;
  function parse(indent) {
    const list = { ordered: items[pos].ordered, items: [] };
    while (pos < items.length && items[pos].indent >= indent) {
      if (items[pos].indent > indent) {
        let last = list.items[list.items.length - 1];
        if (!last) { last = { text: '', task: null, children: [] }; list.items.push(last); }
        last.children.push(parse(items[pos].indent));
      } else list.items.push({ ...items[pos++], children: [] });
    }
    return list;
  }
  const render = (list) => {
    const tag = list.ordered ? 'ol' : 'ul';
    return `<${tag}>${list.items.map((it) => {
      const box = it.task == null ? '' : `<input type="checkbox" disabled="disabled"${it.task ? ' checked="checked"' : ''} /> `;
      return `<li>${box}${inline(it.text)}${it.children.map(render).join('')}</li>`;
    }).join('')}</${tag}>`;
  };
  const html = [];
  while (pos < items.length) html.push(render(parse(items[pos].indent)));
  return html.join('');
}

export function markdownToHtml(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = /^\s*(```+|~~~+)\s*([\w+-]*)/.exec(line);
    if (fence) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code${fence[2] ? ` class="language-${esc(fence[2])}"` : ''}>${esc(buf.join('\n'))}\n</code></pre>`);
      continue;
    }
    const head = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(line);
    if (head) { out.push(`<h${head[1].length}>${inline(head[2])}</h${head[1].length}>`); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr />'); i++; continue; }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${markdownToHtml(buf.join('\n'))}</blockquote>`);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const aligns = splitRow(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : ''));
      const cell = (tag, c, k) => `<${tag}${aligns[k] ? ` style="text-align:${aligns[k]}"` : ''}>${inline(c)}</${tag}>`;
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
      out.push(`<table><thead><tr>${header.map((c, k) => cell('th', c, k)).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${header.map((_, k) => cell('td', r[k] ?? '', k)).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (LIST_RE.test(line)) {
      const buf = [];
      while (i < lines.length && lines[i].trim() && (LIST_RE.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) buf.push(lines[i++]);
      // blank line between items of the same list
      while (i + 1 < lines.length && !lines[i].trim() && LIST_RE.test(lines[i + 1]) && /^\s/.test(lines[i + 1])) {
        i++;
        while (i < lines.length && lines[i].trim() && (LIST_RE.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) buf.push(lines[i++]);
      }
      out.push(renderList(buf));
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(#{1,6}\s|```|~~~|>)/.test(lines[i]) && !LIST_RE.test(lines[i]) && !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
      && !(lines[i].includes('|') && lines[i + 1] && isTableSep(lines[i + 1]))) buf.push(lines[i++]);
    if (!buf.length) { buf.push(lines[i++]); }
    out.push(`<p>${inline(buf.join('\n'))}</p>`);
  }
  return out.join('\n');
}

export const DOC_CSS = `body{font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#1d2327}
h1,h2,h3,h4{line-height:1.25;margin:1.6em 0 .5em}pre{background:#f3f1ec;padding:1rem;border-radius:8px;overflow:auto}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92em;background:#f3f1ec;padding:.1em .35em;border-radius:4px}pre code{background:none;padding:0}
blockquote{margin:1em 0;padding:.2em 1em;border-left:4px solid #1a6b47;color:#4a535a}table{border-collapse:collapse}th,td{border:1px solid #d9d4c8;padding:.4em .7em}
img{max-width:100%}a{color:#1a6b47}hr{border:0;border-top:1px solid #d9d4c8;margin:2em 0}`;

export function markdownDocument(md, title = 'Document') {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${esc(title)}</title>\n<style>${DOC_CSS}</style>\n</head>\n<body>\n${markdownToHtml(md)}\n</body>\n</html>\n`;
}

// HTML -> Markdown using the browser's DOMParser (scripts are never executed: parsing happens in an inert document).

const BLOCK = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'FIGURE', 'FIGCAPTION']);

export function htmlToMarkdown(html, parser = new DOMParser()) {
  const doc = parser.parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,template,iframe,object,embed').forEach((n) => n.remove());
  const md = children(doc.body, { list: null, depth: 0 });
  return md.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const esc = (t) => t.replace(/([\\`*_[\]])/g, '\\$1');

function children(node, ctx) {
  return [...node.childNodes].map((n) => walk(n, ctx)).join('');
}

function walk(node, ctx) {
  if (node.nodeType === 3) {
    const t = node.textContent.replace(/\s+/g, ' ');
    return ctx.pre ? node.textContent : esc(t);
  }
  if (node.nodeType !== 1) return '';
  const tag = node.tagName;
  const inner = () => children(node, ctx);
  switch (tag) {
    case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6':
      return `\n\n${'#'.repeat(+tag[1])} ${inner().trim()}\n\n`;
    case 'P': return `\n\n${inner().trim()}\n\n`;
    case 'BR': return '  \n';
    case 'HR': return '\n\n---\n\n';
    case 'STRONG': case 'B': { const t = inner().trim(); return t ? `**${t}**` : ''; }
    case 'EM': case 'I': { const t = inner().trim(); return t ? `*${t}*` : ''; }
    case 'DEL': case 'S': { const t = inner().trim(); return t ? `~~${t}~~` : ''; }
    case 'CODE': return ctx.pre ? node.textContent : `\`${node.textContent}\``;
    case 'PRE': return `\n\n\`\`\`\n${node.textContent.replace(/\n$/, '')}\n\`\`\`\n\n`;
    case 'A': {
      const href = node.getAttribute('href');
      const t = inner().trim();
      return href && t ? `[${t}](${href})` : t;
    }
    case 'IMG': {
      const src = node.getAttribute('src');
      return src ? `![${esc(node.getAttribute('alt') || '')}](${src})` : '';
    }
    case 'BLOCKQUOTE': return `\n\n${inner().trim().split('\n').map((l) => `> ${l}`).join('\n')}\n\n`;
    case 'UL': case 'OL': {
      const items = [...node.children].filter((c) => c.tagName === 'LI');
      const pad = '  '.repeat(ctx.depth);
      const lines = items.map((li, i) => {
        const marker = tag === 'OL' ? `${i + 1}.` : '-';
        const body = children(li, { ...ctx, depth: ctx.depth + 1 }).trim().replace(/\n{2,}/g, '\n').replace(/\n/g, `\n${pad}  `);
        return `${pad}${marker} ${body}`;
      });
      return ctx.depth ? `\n${lines.join('\n')}\n` : `\n\n${lines.join('\n')}\n\n`;
    }
    case 'TABLE': {
      const rows = [...node.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => children(c, ctx).trim().replace(/\|/g, '\\|').replace(/\n/g, ' ')));
      if (!rows.length) return '';
      const width = Math.max(...rows.map((r) => r.length));
      const fill = (r) => Array.from({ length: width }, (_, i) => r[i] ?? '');
      const [head, ...body] = rows.map(fill);
      return `\n\n| ${head.join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n${body.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n\n`;
    }
    default:
      return BLOCK.has(tag) ? `\n\n${children(node, ctx).trim()}\n\n` : children(node, tag === 'PRE' ? { ...ctx, pre: true } : ctx);
  }
}

// Text extraction from Office Open XML files (.docx, .pptx) for the "Office to Markdown" tool.
// Uses regexes (not DOMParser) so it runs the same in browsers and Node tests.
import { readZip } from './zip.js';

const unxml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

function runsToMd(paraXml, rels) {
  let out = '';
  const re = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>|<w:hyperlink\b([^>]*)>|<\/w:hyperlink>/g;
  let link = null;
  for (const m of paraXml.matchAll(re)) {
    if (m[0].startsWith('<w:hyperlink')) {
      const rid = /r:id="([^"]+)"/.exec(m[2] || '')?.[1];
      link = rid && rels[rid] ? rels[rid] : null;
      if (link) out += '[';
      continue;
    }
    if (m[0] === '</w:hyperlink>') { if (link) out += `](${link})`; link = null; continue; }
    const run = m[1];
    const text = [...run.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)]
      .map((t) => (t[0] === '<w:tab/>' ? '\t' : t[0] === '<w:br/>' ? '  \n' : unxml(t[1]))).join('');
    if (!text) continue;
    const bold = /<w:b\/>|<w:b w:val="(?:1|true)"\/>/.test(run);
    const italic = /<w:i\/>|<w:i w:val="(?:1|true)"\/>/.test(run);
    const t = text.replace(/([\\`*_[\]])/g, '\\$1');
    const lead = /^\s*/.exec(t)[0];
    const trail = /\s*$/.exec(t)[0];
    const core = t.trim();
    if (!core) { out += t; continue; }
    out += lead + (bold && italic ? `***${core}***` : bold ? `**${core}**` : italic ? `*${core}*` : core) + trail;
  }
  return out.replace(/\*\*\*\*|\*\* \*\*/g, ' ').trim();
}

export async function docxToMarkdown(buffer) {
  const zip = readZip(buffer);
  const doc = await zip.text('word/document.xml');
  if (!doc) throw new Error('This does not look like a .docx file (word/document.xml is missing).');
  const relsXml = (await zip.text('word/_rels/document.xml.rels')) || '';
  const rels = {};
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[1])?.[1];
    if (id && target && /hyperlink/.test(m[1])) rels[id] = unxml(target);
  }
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(doc)?.[1] || doc;
  const blocks = [];
  const re = /<w:tbl>([\s\S]*?)<\/w:tbl>|<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  for (const m of body.matchAll(re)) {
    if (m[1] !== undefined) {
      const rows = [...m[1].matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((tr) => [...tr[0].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((tc) => [...tc[1].matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map((p) => runsToMd(p[1], rels)).join(' ').replace(/\|/g, '\\|')));
      if (rows.length) {
        const width = Math.max(...rows.map((r) => r.length));
        const fill = (r) => Array.from({ length: width }, (_, i) => r[i] ?? '');
        const [head, ...rest] = rows.map(fill);
        blocks.push(`| ${head.join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n${rest.map((r) => `| ${r.join(' | ')} |`).join('\n')}`);
      }
      continue;
    }
    const p = m[2];
    const text = runsToMd(p, rels);
    if (!text) continue;
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] || '';
    const heading = /^(?:Heading|Titre|Nagłówek|Überschrift)\s?(\d)$/i.exec(style);
    if (heading) blocks.push(`${'#'.repeat(Math.min(6, +heading[1]))} ${text}`);
    else if (/^Title$/i.test(style)) blocks.push(`# ${text}`);
    else if (/<w:numPr>/.test(p)) {
      const lvl = +(/<w:ilvl w:val="(\d+)"/.exec(p)?.[1] || 0);
      blocks.push(`${'  '.repeat(lvl)}- ${text}`);
    } else blocks.push(text);
  }
  // keep consecutive list items together
  return blocks.reduce((acc, b, i) => acc + (i && /^\s*- /.test(b) && /^\s*- /.test(blocks[i - 1]) ? '\n' : i ? '\n\n' : '') + b, '').trim() + '\n';
}

export async function pptxToMarkdown(buffer) {
  const zip = readZip(buffer);
  const slides = zip.names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  if (!slides.length) throw new Error('This does not look like a .pptx file (no slides found).');
  const out = [];
  let n = 0;
  for (const name of slides) {
    const xml = await zip.text(name);
    const paras = [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)].map((p) => [...p[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => unxml(t[1])).join('')).filter((t) => t.trim());
    n++;
    out.push(`## Slide ${n}${paras[0] ? `: ${paras[0]}` : ''}\n\n${paras.slice(1).map((t) => `- ${t}`).join('\n')}`.trim());
  }
  return `${out.join('\n\n')}\n`;
}

// EPUB 3 builder: Markdown chapters -> .epub (a ZIP with a mimetype entry stored first).
import { createZip } from './zip.js';
import { markdownToHtml } from './md.js';

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Split Markdown into chapters at top-level (# ) headings. Text before the first heading becomes chapter 1. */
export function splitChapters(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const chapters = [];
  let cur = null;
  let fence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = !fence && /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) { cur = { title: m[1], body: [] }; chapters.push(cur); cur.body.push(line); continue; }
    if (!cur) { cur = { title: 'Start', body: [] }; chapters.push(cur); }
    cur.body.push(line);
  }
  return chapters.filter((c) => c.body.join('').trim()).map((c) => ({ title: c.title, markdown: c.body.join('\n') }));
}

export function buildEpub({ title, author, language = 'en', markdown, id = crypto.randomUUID(), modified = new Date() }) {
  const chapters = splitChapters(markdown);
  if (!chapters.length) throw new Error('Write at least one chapter. Start each chapter with a "# Heading" line.');
  const stamp = modified.toISOString().replace(/\.\d+Z$/, 'Z');
  const css = 'body{font-family:serif;line-height:1.5;margin:5%}h1,h2,h3{font-family:sans-serif;line-height:1.2}pre,code{font-family:monospace}pre{white-space:pre-wrap}blockquote{margin-left:1em;border-left:3px solid #999;padding-left:1em}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #999;padding:.2em .5em}';
  const page = (t, body) => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${xml(language)}" xml:lang="${xml(language)}">\n<head><meta charset="utf-8"/><title>${xml(t)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>\n<body>\n${body}\n</body>\n</html>\n`;
  const files = [
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
    { name: 'OEBPS/style.css', data: css },
  ];
  chapters.forEach((c, i) => files.push({ name: `OEBPS/chapter${i + 1}.xhtml`, data: page(c.title, markdownToHtml(c.markdown)) }));
  const nav = `<nav epub:type="toc" id="toc"><h1>${xml(title)}</h1><ol>${chapters.map((c, i) => `<li><a href="chapter${i + 1}.xhtml">${xml(c.title)}</a></li>`).join('')}</ol></nav>`;
  files.push({ name: 'OEBPS/nav.xhtml', data: page('Contents', nav) });
  files.push({
    name: 'OEBPS/toc.ncx',
    data: `<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:${id}"/></head><docTitle><text>${xml(title)}</text></docTitle><navMap>${chapters.map((c, i) => `<navPoint id="n${i + 1}" playOrder="${i + 1}"><navLabel><text>${xml(c.title)}</text></navLabel><content src="chapter${i + 1}.xhtml"/></navPoint>`).join('')}</navMap></ncx>`,
  });
  files.push({
    name: 'OEBPS/content.opf',
    data: `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:uuid:${id}</dc:identifier><dc:title>${xml(title)}</dc:title><dc:creator>${xml(author || 'Unknown')}</dc:creator><dc:language>${xml(language)}</dc:language><meta property="dcterms:modified">${stamp}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="style.css" media-type="text/css"/>${chapters.map((_, i) => `<item id="c${i + 1}" href="chapter${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine toc="ncx">${chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('')}</spine></package>`,
  });
  return { bytes: createZip(files), chapters: chapters.length };
}

// Documents & marketing tools. Everything user-supplied is HTML-escaped; URLs are restricted to safe schemes.
import { h, escapeHtml as e, slug } from '../core/dom.js';
import { readTable } from '../core/form.js';
import { makeCanvas, ctx2d, FONT, readableOn, wrapLines, roundRect } from '../core/image.js';
import { parseCSV } from '../lib/csv.js';
import { readXlsx } from '../lib/xlsx.js';
import { docxToMarkdown, pptxToMarkdown } from '../lib/office.js';
import { htmlToMarkdown } from '../lib/html2md.js';
import { buildEpub } from '../lib/epub.js';
import { buildVcard } from '../lib/vcard.js';
import { encodeQr, drawQr } from '../lib/qr.js';
import { safeUrl } from '../lib/md.js';
import { createZip } from '../lib/zip.js';

const href = (u) => e(safeUrl(String(u || '').trim()));
const lines = (t) => String(t || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const para = (t) => lines(t).map((l) => e(l)).join('<br>');
const ul = (t, cls = '') => (lines(t).length ? `<ul${cls ? ` class="${cls}"` : ''}>${lines(t).map((l) => `<li>${e(l.replace(/^[-•*]\s*/, ''))}</li>`).join('')}</ul>` : '');
const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#0f766e');

const A4_CSS = (accent) => `@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1d2327;background:#fff}
.page{width:210mm;min-height:297mm;padding:16mm 18mm}h1{font-size:30px;line-height:1.15;margin:0 0 4px;color:${accent}}h2{font-size:13px;letter-spacing:.09em;text-transform:uppercase;color:${accent};border-bottom:2px solid ${accent};padding-bottom:3px;margin:22px 0 8px}
p{margin:0 0 8px}ul{margin:0 0 8px;padding-left:18px}li{margin:2px 0}.muted{color:#5a6168}.row{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.tag{display:inline-block;background:${accent}1a;color:${accent};padding:2px 9px;border-radius:99px;margin:0 6px 6px 0;font-size:13px}`;
const doc = (title, css, body) => `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${e(title)}</title><style>${css}</style></head><body>${body}</body></html>`;

/* ---------------------------------------------------------- vcard helpers */

function vcardQr(vcf) {
  const canvas = makeCanvas(10, 10);
  drawQr(canvas, encodeQr(vcf, 'M'), { scale: 6, quietZone: 3 });
  return canvas;
}

export const tools = {
  'office-to-markdown': {
    fields: [{ id: 'file', type: 'file', label: 'File', accept: '.docx,.pptx,.xlsx,.html,.htm,.csv,.tsv,.txt,.md', hint: 'Word (.docx), PowerPoint (.pptx), Excel (.xlsx, first sheet), HTML, CSV or text. PDF is not supported.' }],
    async run({ file }) {
      if (!file) return { empty: 'Choose a file to convert it to Markdown.' };
      if (file.size > 50 * 1024 * 1024) return { error: 'That file is larger than 50 MB.' };
      const ext = file.name.split('.').pop().toLowerCase();
      let md;
      if (ext === 'docx') md = await docxToMarkdown(await file.arrayBuffer());
      else if (ext === 'pptx') md = await pptxToMarkdown(await file.arrayBuffer());
      else if (ext === 'xlsx') {
        const { rows } = await readXlsx(await file.arrayBuffer());
        md = tableMd(rows);
      } else if (ext === 'html' || ext === 'htm') md = htmlToMarkdown(await file.text());
      else if (ext === 'csv' || ext === 'tsv') md = tableMd(parseCSV(await file.text(), ext === 'tsv' ? '\t' : undefined));
      else if (ext === 'txt' || ext === 'md') md = await file.text();
      else if (ext === 'pdf') return { error: 'PDF files cannot be converted in the browser without uploading them. Export the PDF to .docx first.' };
      else return { error: `.${ext} files are not supported.` };
      return { text: { label: `Markdown from ${file.name}`, value: md, filename: `${slug(file.name.replace(/\.[^.]+$/, ''))}.md`, mime: 'text/markdown;charset=utf-8', rows: 18 } };
    },
  },

  'epub-builder': {
    fields: [
      { id: 'title', type: 'text', label: 'Title', value: 'My Book', half: true },
      { id: 'author', type: 'text', label: 'Author', half: true, placeholder: 'Your name' },
      { id: 'lang', type: 'select', label: 'Language', half: true, options: [['en', 'English'], ['pl', 'Polski'], ['de', 'Deutsch'], ['uk', 'Українська'], ['fr', 'Français'], ['es', 'Español']] },
      { id: 'md', type: 'textfile', label: 'Content (Markdown)', rows: 14, accept: '.md,.txt', hint: 'Start every chapter with a “# Chapter title” line.' },
    ],
    example: { title: 'Field Notes', author: 'A. Writer', md: '# Chapter 1\n\nIt began on a **quiet** morning.\n\n- First clue\n- Second clue\n\n# Chapter 2\n\nBy noon, everything had changed.\n\n> “Nothing stays the same.”' },
    run({ title, author, lang, md }) {
      if (!md.trim()) return { empty: 'Write or open some Markdown to build an EPUB.' };
      const { bytes, chapters } = buildEpub({ title: title || 'Untitled', author, language: lang, markdown: md });
      return {
        stats: [['Chapters', chapters], ['File size', `${Math.max(1, Math.round(bytes.length / 1024))} KB`]],
        downloads: [{ name: `${slug(title, 'book')}.epub`, data: bytes, mime: 'application/epub+zip', label: `${slug(title, 'book')}.epub` }],
      };
    },
  },

  'vcard-generator': {
    fields: [
      { id: 'mode', type: 'select', label: 'Mode', options: [['single', 'One contact'], ['batch', 'Many contacts from a spreadsheet']] },
      ...[['name', 'Full name', 'Jane Doe'], ['title', 'Job title', 'Product Marketing Manager'], ['company', 'Company', 'ACME Corp'], ['phone', 'Phone', '+48 600 000 000'], ['email', 'Email', 'jane@example.com'], ['website', 'Website', 'https://example.com'], ['address', 'Address', '1 Main St, Warsaw, Poland']]
        .map(([id, label, placeholder]) => ({ id, type: 'text', label, placeholder, half: id !== 'address' && id !== 'name', show: (v) => v.mode === 'single' })),
      { id: 'data', type: 'textfile', label: 'Contacts (columns: Full Name, Phone, Email, Company, Website, Address)', rows: 8, show: (v) => v.mode === 'batch' },
    ],
    example: { mode: 'single', name: 'Jane Doe', title: 'Product Marketing Manager', company: 'ACME Corp', phone: '+48 600 000 000', email: 'jane@example.com', website: 'https://example.com' },
    run(v) {
      if (v.mode === 'batch') {
        const t = readTable(v.data);
        if (!t.body.length) return { empty: 'Add a table of contacts (first row = headers).' };
        const col = (names) => t.head.findIndex((c) => names.includes(c.trim().toLowerCase()));
        const idx = { name: col(['full name', 'name']), phone: col(['phone', 'tel', 'mobile']), email: col(['email', 'e-mail']), company: col(['company', 'organization', 'org']), website: col(['website', 'url', 'web']), address: col(['address']), title: col(['title', 'job title']) };
        if (idx.name < 0) return { error: 'A “Full Name” column is required.' };
        const contacts = t.body.filter((r) => r[idx.name].trim()).map((r) => Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, i >= 0 ? r[i].trim() : ''])));
        const files = contacts.map((c, i) => ({ name: `${String(i + 1).padStart(3, '0')}-${slug(c.name, 'contact')}.vcf`, data: buildVcard(c) }));
        return {
          stats: [['Contacts', contacts.length]],
          table: { head: ['Name', 'Email', 'Phone', 'Company'], rows: contacts.slice(0, 50).map((c) => [c.name, c.email, c.phone, c.company]) },
          downloads: [
            { name: 'contacts.vcf', data: contacts.map((c) => buildVcard(c)).join(''), mime: 'text/vcard;charset=utf-8', label: 'All contacts (one .vcf)' },
            { name: 'contacts-individual.zip', data: createZip(files), mime: 'application/zip', label: 'One .vcf per contact (ZIP)' },
          ],
        };
      }
      if (!v.name.trim()) return { empty: 'Enter a name to build the contact card.' };
      const vcf = buildVcard(v);
      return {
        canvas: { canvas: vcardQr(vcf), filename: `${slug(v.name)}-qr`, formats: ['png'] },
        text: { label: 'vCard', value: vcf, filename: `${slug(v.name, 'contact')}.vcf`, mime: 'text/vcard;charset=utf-8', rows: 9 },
        notice: 'Scan the QR code with a phone camera to add the contact.',
      };
    },
  },

  'email-signature': {
    fields: [
      { id: 'name', type: 'text', label: 'Name', value: 'Jane Doe', half: true },
      { id: 'role', type: 'text', label: 'Job title', value: 'Product Marketing Manager', half: true },
      { id: 'company', type: 'text', label: 'Company', value: 'ACME Corp', half: true },
      { id: 'phone', type: 'text', label: 'Phone', value: '+48 600 000 000', half: true },
      { id: 'email', type: 'email', label: 'Email', value: 'jane@example.com', half: true },
      { id: 'web', type: 'url', label: 'Website', value: 'https://example.com', half: true },
      { id: 'photoUrl', type: 'url', label: 'Photo URL (recommended)', hint: 'Email clients load a hosted image reliably. An uploaded photo below is embedded instead.' },
      { id: 'photo', type: 'image', label: 'Or upload a photo' },
      { id: 'linkedin', type: 'url', label: 'LinkedIn URL', half: true },
      { id: 'x', type: 'url', label: 'X / Twitter URL', half: true },
      { id: 'accent', type: 'color', label: 'Accent colour', value: '#0f766e' },
    ],
    run(v) {
      const accent = hex(v.accent);
      let photo = v.photoUrl.trim() ? safeUrl(v.photoUrl) : '';
      if (!photo && v.photo) {
        const c = makeCanvas(160, 160);
        const x = ctx2d(c);
        const s = Math.min(v.photo.width, v.photo.height);
        x.drawImage(v.photo.img, (v.photo.width - s) / 2, (v.photo.height - s) / 2, s, s, 0, 0, 160, 160);
        photo = c.toDataURL('image/jpeg', 0.85);
      }
      const social = [['LinkedIn', v.linkedin], ['X', v.x]].filter(([, u]) => u.trim()).map(([n, u]) => `<a href="${href(u)}" style="color:${accent};text-decoration:none;font-weight:600">${n}</a>`).join(' &nbsp;·&nbsp; ');
      const line = (t) => (t ? `<div style="margin:2px 0">${t}</div>` : '');
      const html = `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#222222"><tr>
${photo ? `<td style="padding-right:16px;vertical-align:top"><img src="${e(photo)}" width="80" height="80" alt="" style="display:block;border-radius:50%;width:80px;height:80px;object-fit:cover"></td>` : ''}
<td style="${photo ? `border-left:3px solid ${accent};padding-left:16px;` : ''}vertical-align:top">
<div style="font-size:17px;font-weight:700;color:#111111">${e(v.name)}</div>
${line(e([v.role, v.company].filter(Boolean).join(' · ')))}
${line(v.phone ? `<a href="tel:${e(v.phone.replace(/[^+\d]/g, ''))}" style="color:#222222;text-decoration:none">${e(v.phone)}</a>` : '')}
${line(v.email ? `<a href="mailto:${e(v.email)}" style="color:${accent};text-decoration:none">${e(v.email)}</a>` : '')}
${line(v.web ? `<a href="${href(v.web)}" style="color:${accent};text-decoration:none">${e(v.web.replace(/^https?:\/\//, ''))}</a>` : '')}
${line(social)}
</td></tr></table>`;
      return { html: { value: html, filename: 'signature.html', title: 'Signature preview', rich: true }, notice: 'Use “Copy formatted”, then paste into your email client’s signature box. In Gmail, paste into Settings → Signature.' };
    },
  },

  'persona-builder': {
    fields: [
      { id: 'name', type: 'text', label: 'Persona name', value: 'Marketing Mary', half: true },
      { id: 'role', type: 'text', label: 'Role', value: 'Head of Marketing', half: true },
      { id: 'industry', type: 'text', label: 'Industry', value: 'B2B SaaS', half: true },
      { id: 'channels', type: 'text', label: 'Preferred channels', value: 'LinkedIn, Email, Webinars', half: true },
      { id: 'goals', type: 'textarea', label: 'Goals (one per line)', rows: 4, value: 'Generate qualified pipeline\nProve campaign ROI' },
      { id: 'pains', type: 'textarea', label: 'Pain points (one per line)', rows: 4, value: 'Disconnected tools\nLimited budget' },
      { id: 'quote', type: 'text', label: 'Quote', value: '“I need results I can show my CEO.”' },
      { id: 'accent', type: 'color', label: 'Accent colour', value: '#4361ee' },
    ],
    run(v) {
      const a = hex(v.accent);
      const css = `${A4_CSS(a)}.cols{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}blockquote{margin:18px 0;padding:12px 18px;border-left:4px solid ${a};background:${a}12;font-size:17px;font-style:italic}`;
      const body = `<div class="page"><h1>${e(v.name)}</h1><p class="muted">${e([v.role, v.industry].filter(Boolean).join(' · '))}</p>
${v.quote ? `<blockquote>${e(v.quote)}</blockquote>` : ''}<div class="cols"><div><h2>Goals</h2>${ul(v.goals)}</div><div><h2>Pain points</h2>${ul(v.pains)}</div></div>
${v.channels ? `<h2>Channels</h2><p>${v.channels.split(',').map((c) => c.trim()).filter(Boolean).map((c) => `<span class="tag">${e(c)}</span>`).join('')}</p>` : ''}</div>`;
      return { html: { value: doc(`${v.name} persona`, css, body), filename: `${slug(v.name, 'persona')}.html`, pageWidth: 794, print: true, title: 'Persona' } };
    },
  },

  'newsletter-builder': {
    fields: [
      { id: 'brand', type: 'text', label: 'Brand', value: 'Acme', half: true },
      { id: 'accent', type: 'color', label: 'Accent colour', value: '#4361ee', half: true },
      { id: 'headline', type: 'text', label: 'Headline', value: 'What’s new this month' },
      { id: 'intro', type: 'textarea', label: 'Intro', rows: 3, value: 'A short roundup of what our team shipped, learned and loved.' },
      { id: 'body', type: 'textarea', label: 'Body (blank line = new paragraph)', rows: 6, value: 'We redesigned the dashboard and made exports twice as fast.\n\nJoin our webinar on the 14th to see everything in action.' },
      { id: 'ctaText', type: 'text', label: 'Button text', value: 'Read more', half: true },
      { id: 'ctaUrl', type: 'url', label: 'Button link', value: 'https://example.com', half: true },
      { id: 'footer', type: 'text', label: 'Footer', value: '© Acme · You are receiving this because you subscribed.' },
    ],
    run(v) {
      const a = hex(v.accent);
      const paragraphs = v.body.split(/\n\s*\n/).filter((p) => p.trim()).map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#333333">${para(p)}</p>`).join('');
      const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(v.headline)}</title></head>
<body style="margin:0;padding:0;background:#f2f2f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
<tr><td style="background:${a};padding:20px 32px;color:${readableOn(a)};font-size:20px;font-weight:700">${e(v.brand)}</td></tr>
<tr><td style="padding:32px 32px 8px"><h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#111111">${e(v.headline)}</h1>${v.intro ? `<p style="margin:0 0 20px;font-size:17px;line-height:1.5;color:#555555">${para(v.intro)}</p>` : ''}${paragraphs}</td></tr>
${v.ctaText ? `<tr><td style="padding:8px 32px 32px"><a href="${href(v.ctaUrl)}" style="display:inline-block;background:${a};color:${readableOn(a)};padding:13px 26px;border-radius:6px;text-decoration:none;font-weight:700;font-size:16px">${e(v.ctaText)}</a></td></tr>` : ''}
<tr><td style="padding:18px 32px;background:#fafafa;color:#888888;font-size:12px;line-height:1.5;border-top:1px solid #eeeeee">${e(v.footer)}</td></tr>
</table></td></tr></table></body></html>`;
      return { html: { value: html, filename: 'newsletter.html', title: 'Newsletter preview' }, notice: 'Table layout with inline styles for broad email-client support. Test in your email provider before sending.' };
    },
  },

  'sell-sheet': {
    fields: [
      { id: 'product', type: 'text', label: 'Product', value: 'Acme Analytics' },
      { id: 'tagline', type: 'text', label: 'Tagline', value: 'Know what works. Do more of it.' },
      { id: 'overview', type: 'textarea', label: 'Overview', rows: 3, value: 'A privacy-first analytics suite that turns raw events into decisions in minutes.' },
      { id: 'features', type: 'textarea', label: 'Features (one per line)', rows: 4, value: 'Real-time dashboards\nNo-code setup\nEU data residency' },
      { id: 'benefits', type: 'textarea', label: 'Benefits (one per line)', rows: 4, value: 'Cut reporting time by 60%\nOne source of truth for every team' },
      { id: 'cta', type: 'text', label: 'Call to action', value: 'Book a demo: sales@example.com' },
      { id: 'accent', type: 'color', label: 'Accent colour', value: '#4361ee' },
    ],
    run(v) {
      const a = hex(v.accent);
      const css = `${A4_CSS(a)}.hero{background:${a};color:${readableOn(a)};margin:-16mm -18mm 18px;padding:22mm 18mm 14mm}.hero h1{color:inherit;font-size:38px}.hero p{font-size:18px;margin:0;opacity:.92}.cols{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}.cta{margin-top:26px;padding:16px 20px;background:${a}14;border-left:5px solid ${a};font-weight:700;font-size:17px}`;
      const body = `<div class="page"><div class="hero"><h1>${e(v.product)}</h1><p>${e(v.tagline)}</p></div><p style="font-size:16px">${para(v.overview)}</p>
<div class="cols"><div><h2>Features</h2>${ul(v.features)}</div><div><h2>Benefits</h2>${ul(v.benefits)}</div></div>${v.cta ? `<div class="cta">${e(v.cta)}</div>` : ''}</div>`;
      return { html: { value: doc(`${v.product} sell sheet`, css, body), filename: `${slug(v.product, 'sell-sheet')}.html`, pageWidth: 794, print: true, title: 'Sell sheet' } };
    },
  },

  'resume-builder': {
    fields: [
      { id: 'name', type: 'text', label: 'Full name', value: 'Jane Doe', half: true },
      { id: 'title', type: 'text', label: 'Headline', value: 'Product Marketing Manager', half: true },
      { id: 'contact', type: 'text', label: 'Contact (separate with |)', value: 'jane@example.com | +48 600 000 000 | Warsaw | linkedin.com/in/janedoe' },
      { id: 'summary', type: 'textarea', label: 'Summary', rows: 3, value: 'Go-to-market specialist with 8 years of experience launching B2B products across Europe.' },
      { id: 'experience', type: 'textarea', label: 'Experience', rows: 9, hint: 'One block per job, blank line between blocks. First line: Role | Company | Dates. Following lines: achievements.', value: 'Senior Product Marketing Manager | Acme Lighting | 2021 – now\nLed launch of 3 product families in 12 markets\nBuilt the sales enablement programme used by 400 reps\n\nMarketing Specialist | Globex | 2017 – 2021\nGrew qualified leads by 85% in two years' },
      { id: 'education', type: 'textarea', label: 'Education', rows: 3, hint: 'Same format: Degree | School | Dates.', value: 'MSc Marketing Management | VIZJA University | 2024 – now' },
      { id: 'skills', type: 'text', label: 'Skills (comma-separated)', value: 'Go-to-market, Power BI, SQL, Sales enablement, n8n' },
      { id: 'accent', type: 'color', label: 'Accent colour', value: '#0f766e' },
    ],
    run(v) {
      const a = hex(v.accent);
      const blocks = (t) => t.split(/\n\s*\n/).map((b) => lines(b)).filter((l) => l.length).map(([head, ...rest]) => {
        const [role = '', org = '', when = ''] = head.split('|').map((x) => x.trim());
        return `<div style="margin-bottom:10px"><div class="row"><strong>${e(role)}${org ? ` · ${e(org)}` : ''}</strong><span class="muted">${e(when)}</span></div>${ul(rest.join('\n'))}</div>`;
      }).join('');
      const body = `<div class="page"><h1>${e(v.name)}</h1><p style="font-size:16px;margin:0 0 6px">${e(v.title)}</p><p class="muted">${e(v.contact.split('|').map((x) => x.trim()).filter(Boolean).join('  ·  '))}</p>
${v.summary ? `<h2>Profile</h2><p>${para(v.summary)}</p>` : ''}${v.experience.trim() ? `<h2>Experience</h2>${blocks(v.experience)}` : ''}${v.education.trim() ? `<h2>Education</h2>${blocks(v.education)}` : ''}
${v.skills.trim() ? `<h2>Skills</h2><p>${v.skills.split(',').map((s) => s.trim()).filter(Boolean).map((s) => `<span class="tag">${e(s)}</span>`).join('')}</p>` : ''}</div>`;
      return { html: { value: doc(`${v.name} CV`, A4_CSS(a), body), filename: `${slug(v.name, 'cv')}-cv.html`, pageWidth: 794, print: true, title: 'CV' }, notice: 'Press “Print / Save as PDF” and choose “Save as PDF”. Turn off headers and footers for the cleanest result.' };
    },
  },

  'cover-letter': {
    fields: [
      { id: 'sender', type: 'textarea', label: 'Your details (name, address, contact)', rows: 4, value: 'Jane Doe\n1 Main St, Warsaw\njane@example.com' },
      { id: 'date', type: 'text', label: 'Date', value: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), half: true },
      { id: 'recipient', type: 'textarea', label: 'Recipient (name, company, address)', rows: 3, value: 'Hiring Manager\nGlobex Corporation' },
      { id: 'subject', type: 'text', label: 'Subject', value: 'Application: Product Marketing Manager' },
      { id: 'salutation', type: 'text', label: 'Salutation', value: 'Dear Hiring Manager,', half: true },
      { id: 'closing', type: 'text', label: 'Closing', value: 'Kind regards,', half: true },
      { id: 'body', type: 'textarea', label: 'Letter (blank line = new paragraph)', rows: 10, value: 'I am excited to apply for the Product Marketing Manager role at Globex.\n\nOver the last eight years I have launched products across Europe and built enablement programmes that sales teams actually use.\n\nI would welcome the chance to discuss how I can help.' },
    ],
    run(v) {
      const css = `${A4_CSS('#1d2327')}.page{padding:25mm 25mm;font-size:14.5px;line-height:1.6}.sender{text-align:right;margin-bottom:20px}.subject{font-weight:700;margin:18px 0}`;
      const paras = v.body.split(/\n\s*\n/).filter((p) => p.trim()).map((p) => `<p>${para(p)}</p>`).join('');
      const body = `<div class="page"><div class="sender">${para(v.sender)}<br><br>${e(v.date)}</div><div>${para(v.recipient)}</div><div class="subject">${e(v.subject)}</div><p>${e(v.salutation)}</p>${paras}<p style="margin-top:24px">${e(v.closing)}<br><br>${e(lines(v.sender)[0] || '')}</p></div>`;
      return { html: { value: doc('Cover letter', css, body), filename: 'cover-letter.html', pageWidth: 794, print: true, title: 'Cover letter' } };
    },
  },

  'label-sheet': {
    fields: [
      { id: 'text', type: 'textarea', label: 'Labels (one per line)', rows: 8, placeholder: 'Label A\nLabel B\nLabel C', hint: 'Use “Label x6” at the end of a line to repeat it.' },
      { id: 'cols', type: 'range', label: 'Columns', min: 1, max: 5, value: 3, half: true },
      { id: 'rows', type: 'range', label: 'Rows per page', min: 1, max: 12, value: 8, half: true },
      { id: 'size', type: 'range', label: 'Font size', min: 8, max: 36, value: 16, unit: ' pt', half: true },
      { id: 'border', type: 'checkbox', label: 'Draw label borders', value: true, half: true },
    ],
    example: { text: 'Shelf A1\nShelf A2\nFragile x4\nThis way up' },
    run({ text, cols, rows, size, border }) {
      const labels = lines(text).flatMap((l) => {
        const m = /^(.*?)\s+x(\d{1,3})$/i.exec(l);
        return m ? Array(Math.min(+m[2], 200)).fill(m[1]) : [l];
      });
      if (!labels.length) return { empty: 'Add at least one label.' };
      const per = cols * rows;
      const pages = [];
      for (let i = 0; i < labels.length; i += per) pages.push(labels.slice(i, i + per));
      const css = `@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:system-ui,Arial,sans-serif}.sheet{width:210mm;height:297mm;padding:10mm;display:grid;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr);page-break-after:always;break-after:page}.sheet:last-child{page-break-after:auto;break-after:auto}.l{display:flex;align-items:center;justify-content:center;text-align:center;padding:4mm;font-size:${size}pt;overflow:hidden;overflow-wrap:anywhere;${border ? 'outline:1px dashed #999;outline-offset:-1px' : ''}}`;
      const body = pages.map((p) => `<div class="sheet">${p.map((l) => `<div class="l">${e(l)}</div>`).join('')}</div>`).join('');
      return { html: { value: doc('Label sheet', css, body), filename: 'labels.html', pageWidth: 794, print: true, title: 'Label sheet' }, stats: [['Labels', labels.length], ['Pages', pages.length]] };
    },
  },

  'roadmap-maker': {
    fields: [
      { id: 'heading', type: 'text', label: 'Heading', value: 'Product Roadmap 2027' },
      { id: 'items', type: 'textarea', label: 'Milestones (Name | Period)', rows: 9, value: 'Discovery | Q1\nUser research | Q1\nBeta | Q2\nPublic launch | Q3\nIntegrations | Q3\nScale-up | Q4' },
      { id: 'accent', type: 'color', label: 'Accent colour', value: '#4361ee' },
    ],
    run({ heading, items, accent }) {
      const parsed = lines(items).map((l) => { const [n, p = ''] = l.split('|').map((x) => x.trim()); return { n, p }; }).filter((x) => x.n);
      if (!parsed.length) return { empty: 'Add milestones, one per line: “Name | Q1”.' };
      const periods = [...new Set(parsed.map((x) => x.p || '—'))];
      const colW = Math.max(220, Math.min(320, Math.floor(1500 / periods.length)));
      const W = 80 + colW * periods.length;
      const rowsMax = Math.max(...periods.map((p) => parsed.filter((x) => (x.p || '—') === p).length));
      const H = 230 + rowsMax * 92;
      const canvas = makeCanvas(W, H);
      const c = ctx2d(canvas);
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#1d2327'; c.font = `700 40px ${FONT}`; c.textAlign = 'left';
      c.fillText(heading, 40, 70);
      const lineY = 150;
      c.strokeStyle = accent; c.lineWidth = 6;
      c.beginPath(); c.moveTo(40, lineY); c.lineTo(W - 40, lineY); c.stroke();
      periods.forEach((p, i) => {
        const x = 40 + i * colW;
        c.fillStyle = accent; c.beginPath(); c.arc(x + 14, lineY, 14, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1d2327'; c.font = `700 26px ${FONT}`; c.fillText(p, x, lineY - 28);
        parsed.filter((it) => (it.p || '—') === p).forEach((it, j) => {
          const y = lineY + 40 + j * 92;
          c.fillStyle = `${accent}1c`; roundRect(c, x, y, colW - 24, 76, 12); c.fill();
          c.fillStyle = accent; c.fillRect(x, y + 10, 5, 56);
          c.fillStyle = '#1d2327'; c.font = `600 22px ${FONT}`;
          wrapLines(c, it.n, colW - 64).slice(0, 2).forEach((ln, k) => c.fillText(ln, x + 20, y + 32 + k * 26));
        });
      });
      return { canvas: { canvas, filename: slug(heading, 'roadmap') } };
    },
  },
};

function tableMd(rows) {
  if (!rows.length) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const fill = (r) => Array.from({ length: width }, (_, i) => String(r[i] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '));
  const [head, ...body] = rows.map(fill);
  return `| ${head.join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n${body.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`;
}


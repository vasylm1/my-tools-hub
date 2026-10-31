// Tool catalogue. `module` is the file in js/tools/ that exports the tool definition under `tools[id]`.
// Keep descriptions to one sentence: they feed the home grid and the search index.

export const CATEGORIES = [
  { id: 'writing', name: 'Writing & text', icon: 'doc', blurb: 'Count, score, compare and convert text and Markdown.' },
  { id: 'dev', name: 'Developer & utilities', icon: 'code', blurb: 'Format JSON and SQL, check flows, convert units, dates and currencies.' },
  { id: 'data', name: 'Spreadsheets & data', icon: 'layers', blurb: 'Clean, validate and anonymise tables. Chart them. Turn sheets into calendars.' },
  { id: 'docs', name: 'Documents & marketing', icon: 'folder', blurb: 'CVs, signatures, newsletters, e-books, roadmaps and one-pagers.' },
  { id: 'image', name: 'Images & codes', icon: 'image', blurb: 'QR codes, resizing, watermarks, mockups, palettes and PDFs.' },
];

const T = (module, cat, id, icon, name, desc, kw = '') => ({ module, cat, id, icon, name, desc, kw });

export const TOOLS = [
  // Writing & text
  T('text', 'writing', 'copy-analyzer', 'bars', 'Copy analyzer', 'Word, character and sentence counts, reading time and Flesch readability.', 'count words characters reading time seo'),
  T('text', 'writing', 'readability-checker', 'book', 'Readability checker', 'Highlight long sentences and passive voice, and score how easy a text is to read.', 'sentences passive voice lix grade clarity style editor plain language'),
  T('text', 'writing', 'headline-analyzer', 'heading', 'Headline analyzer', 'Score a headline on length, power words and numbers.', 'title seo score'),
  T('text', 'writing', 'hashtag-extractor', 'hash', 'Hashtag extractor', 'Pull top keywords and suggested hashtags out of any text.', 'keywords social tags'),
  T('text', 'writing', 'text-diff', 'diff', 'Text diff', 'Compare two texts and highlight what was added or removed.', 'compare difference changes'),
  T('text', 'writing', 'markdown-to-html', 'doc', 'Markdown to HTML', 'Render Markdown to clean, self-contained HTML with a live preview.', 'md convert'),
  T('text', 'writing', 'html-to-markdown', 'swap', 'HTML to Markdown', 'Turn pasted HTML into tidy Markdown.', 'md convert'),

  // Developer & utilities
  T('dev', 'dev', 'json-formatter', 'braces', 'JSON formatter', 'Format, minify and validate JSON, or convert an array of objects to CSV.', 'prettify validate csv'),
  T('dev', 'dev', 'power-automate-checker', 'bolt', 'Power Automate JSON checker', 'Find syntax errors and structural problems in a Power Automate flow definition.', 'flow microsoft validate'),
  T('dev', 'dev', 'sql-formatter', 'database', 'SQL formatter', 'Pretty-print and standardise SQL queries.', 'query beautify'),
  T('dev', 'dev', 'seo-files-generator', 'route', 'robots.txt and sitemap generator', 'Create a robots.txt and a sitemap.xml for your site, with warnings for common mistakes.', 'seo crawler search engine xml google sitemap robots'),
  T('dev', 'dev', 'html-viewer', 'globe', 'HTML viewer', 'Paste or open HTML and preview it safely in an isolated, responsive frame.', 'preview sandbox'),
  T('dev', 'dev', 'unit-converter', 'ruler', 'Unit converter', 'Convert length, mass, temperature, area, volume, speed, time and data units.', 'metric imperial'),
  T('dev', 'dev', 'datetime-toolkit', 'clock', 'Date & time toolkit', 'Date differences, working days between dates, and time zone conversion.', 'timezone workdays'),
  T('dev', 'dev', 'currency-converter', 'coins', 'Currency converter', 'Convert between currencies using daily reference rates.', 'exchange rates money'),

  // Spreadsheets & data
  T('data', 'data', 'spreadsheet-cleaner', 'sparkles', 'Spreadsheet cleaner', 'Trim, deduplicate, drop empty rows and columns, and standardise headers in CSV or Excel.', 'csv xlsx dedupe'),
  T('data', 'data', 'email-list-validator', 'checkcircle', 'Email list validator', 'Validate, deduplicate and summarise a column of email addresses.', 'csv domains'),
  T('data', 'data', 'data-anonymizer', 'shield', 'Data anonymizer', 'Mask emails and phone numbers and hash a chosen column in CSV or Excel.', 'privacy gdpr mask'),
  T('data', 'data', 'fake-data-generator', 'dice', 'Fake data generator', 'Generate locale-aware sample data (names, emails, companies…) as CSV.', 'sample mock test'),
  T('data', 'data', 'chart-maker', 'linechart', 'Chart maker', 'Turn CSV or Excel columns into a bar, line or pie chart image.', 'graph plot png'),
  T('data', 'data', 'excel-to-calendar', 'calendar', 'Excel to calendar', 'Convert a sheet of events into an .ics calendar file.', 'ics ical events'),

  // Documents & marketing
  T('docs', 'docs', 'office-to-markdown', 'import', 'Office to Markdown', 'Convert Word, PowerPoint, Excel, HTML or CSV files to Markdown.', 'docx pptx xlsx convert'),
  T('docs', 'docs', 'epub-builder', 'book', 'EPUB builder', 'Turn Markdown chapters into an EPUB e-book.', 'ebook book'),
  T('docs', 'docs', 'vcard-generator', 'user', 'vCard generator', 'Build a .vcf contact card (single or batch from a spreadsheet) plus a QR code.', 'contact vcf'),
  T('docs', 'docs', 'email-signature', 'mail', 'Email signature', 'Build a self-contained HTML email signature with a live preview.', 'gmail outlook'),
  T('docs', 'docs', 'persona-builder', 'users', 'Persona builder', 'Build a persona / ICP one-pager and export it as HTML or PDF.', 'marketing icp'),
  T('docs', 'docs', 'newsletter-builder', 'send', 'Newsletter builder', 'Build a responsive HTML email newsletter with a live preview.', 'email html'),
  T('docs', 'docs', 'sell-sheet', 'tag', 'Sell sheet', 'Build a product one-pager and export it as HTML or PDF.', 'product flyer one-pager'),
  T('docs', 'docs', 'utm-link-builder', 'link', 'Campaign link builder', 'Add UTM tracking to links for Google Analytics and other tools, one at a time or from a spreadsheet, with an optional QR code.', 'utm campaign tracking ga4 marketing url source medium'),
  T('docs', 'docs', 'resume-builder', 'briefcase', 'Resume builder', 'Fill a form and print a clean CV as PDF.', 'cv'),
  T('docs', 'docs', 'cover-letter', 'letter', 'Cover letter', 'Generate a formatted cover letter and print it as PDF.', 'job application'),
  T('docs', 'docs', 'label-sheet', 'grid', 'Label sheet', 'Lay labels out on a printable A4 grid.', 'avery stickers print'),
  T('docs', 'docs', 'roadmap-maker', 'route', 'Roadmap maker', 'Generate a roadmap / timeline graphic from milestones.', 'timeline plan'),

  // Images & codes
  T('image', 'image', 'qr-code', 'qr', 'QR code', 'Create QR codes (single or batch) in solid or gradient style, as PNG or SVG.', 'barcode url wifi'),
  T('image', 'image', 'qr-decoder', 'scan', 'QR code reader', 'Read a QR code from an image, screenshot or photo and see what it contains, without uploading it.', 'scan decode barcode wifi'),
  T('image', 'image', 'photo-metadata-cleaner', 'shield', 'Photo metadata cleaner', 'See what a photo reveals, such as location, camera and time, and remove it without re-compressing the image.', 'exif gps privacy strip jpeg png webp location remove metadata'),
  T('image', 'image', 'image-resizer', 'resize', 'Image resizer', 'Resize and compress images, or generate a complete favicon pack.', 'compress favicon ico'),
  T('image', 'image', 'image-watermark', 'droplet', 'Image watermark', 'Overlay a text or logo watermark with position, opacity and size.', 'logo stamp'),
  T('image', 'image', 'social-cropper', 'crop', 'Social cropper', 'Crop images to Instagram, Facebook, LinkedIn and X presets.', 'instagram linkedin'),
  T('image', 'image', 'meme-generator', 'smile', 'Meme generator', 'Add top and bottom captions to an image.', 'caption'),
  T('image', 'image', 'brand-palette', 'palette', 'Brand palette', 'Extract a dominant colour palette from an image and export it as CSS.', 'colors hex'),
  T('image', 'image', 'color-contrast-checker', 'contrast', 'Colour contrast checker', 'Check text and background colours against WCAG contrast rules and get a passing suggestion.', 'accessibility wcag a11y color colour'),
  T('image', 'image', 'screenshot-beautifier', 'sparkles', 'Screenshot beautifier', 'Add a gradient background, padding, rounded corners and a shadow.', 'mockup'),
  T('image', 'image', 'browser-mockup', 'browser', 'Browser mockup', 'Wrap a screenshot in a browser-window frame.', 'screenshot frame'),
  T('image', 'image', 'device-mockup', 'phone', 'Device mockup', 'Place a screenshot into a phone or laptop frame.', 'iphone macbook'),
  T('image', 'image', 'social-banner', 'flag', 'Social banner', 'Generate a LinkedIn, X, Facebook or YouTube banner with a name and tagline.', 'header cover'),
  T('image', 'image', 'certificate-generator', 'award', 'Certificate generator', 'Create a certificate as PNG or PDF.', 'diploma award'),
  T('image', 'image', 'file-converter', 'image', 'Image converter', 'Convert between PNG, JPG, WebP and BMP.', 'format jpeg png webp'),
  T('image', 'image', 'images-to-pdf', 'filepdf', 'Images to PDF', 'Combine multiple images into one PDF (A4, Letter or fit-to-image).', 'pdf merge'),
];

export const byId = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

export function searchTools(query, translate = (value) => value) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return TOOLS;
  const score = (t) => {
    const name = `${t.name} ${translate(t.name)}`.toLowerCase();
    const hay = `${name} ${t.desc} ${translate(t.desc)} ${t.kw}`.toLowerCase();
    if (!terms.every((x) => hay.includes(x))) return -1;
    // Name matches beat description matches; earlier and word-start matches rank higher.
    return terms.reduce((n, x) => n + (name.startsWith(x) ? 4 : name.split(/\s+/).some((w) => w.startsWith(x)) ? 3 : name.includes(x) ? 2 : 0), 0);
  };
  return TOOLS.map((t) => [t, score(t)]).filter(([, n]) => n >= 0).sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

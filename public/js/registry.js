// Tool catalogue. `module` is the file in js/tools/ that exports the tool definition under `tools[id]`.
// Keep descriptions to one sentence: they feed the home grid and the search index.

export const CATEGORIES = [
  { id: 'writing', name: 'Writing & text', icon: '✍️' },
  { id: 'dev', name: 'Developer & utilities', icon: '🧰' },
  { id: 'data', name: 'Spreadsheets & data', icon: '🗂️' },
  { id: 'docs', name: 'Documents & marketing', icon: '📄' },
  { id: 'image', name: 'Images & codes', icon: '🖼️' },
];

const T = (module, cat, id, icon, name, desc, kw = '') => ({ module, cat, id, icon, name, desc, kw });

export const TOOLS = [
  // Writing & text
  T('text', 'writing', 'copy-analyzer', '📊', 'Copy analyzer', 'Word, character and sentence counts, reading time and Flesch readability.', 'count words characters reading time seo'),
  T('text', 'writing', 'headline-analyzer', '📰', 'Headline analyzer', 'Score a headline on length, power words and numbers.', 'title seo score'),
  T('text', 'writing', 'hashtag-extractor', '#️⃣', 'Hashtag extractor', 'Pull top keywords and suggested hashtags out of any text.', 'keywords social tags'),
  T('text', 'writing', 'text-diff', '↔️', 'Text diff', 'Compare two texts and highlight what was added or removed.', 'compare difference changes'),
  T('text', 'writing', 'markdown-to-html', '📝', 'Markdown to HTML', 'Render Markdown to clean, self-contained HTML with a live preview.', 'md convert'),
  T('text', 'writing', 'html-to-markdown', '🔁', 'HTML to Markdown', 'Turn pasted HTML into tidy Markdown.', 'md convert'),

  // Developer & utilities
  T('dev', 'dev', 'json-formatter', '🧾', 'JSON formatter', 'Format, minify and validate JSON, or convert an array of objects to CSV.', 'prettify validate csv'),
  T('dev', 'dev', 'power-automate-checker', '⚡', 'Power Automate JSON checker', 'Find syntax errors and structural problems in a Power Automate flow definition.', 'flow microsoft validate'),
  T('dev', 'dev', 'sql-formatter', '🗄️', 'SQL formatter', 'Pretty-print and standardise SQL queries.', 'query beautify'),
  T('dev', 'dev', 'html-viewer', '🌐', 'HTML viewer', 'Paste or open HTML and preview it safely in an isolated, responsive frame.', 'preview sandbox'),
  T('dev', 'dev', 'unit-converter', '📏', 'Unit converter', 'Convert length, mass, temperature, area, volume, speed, time and data units.', 'metric imperial'),
  T('dev', 'dev', 'datetime-toolkit', '🕒', 'Date & time toolkit', 'Date differences, working days between dates, and time zone conversion.', 'timezone workdays'),
  T('dev', 'dev', 'currency-converter', '💱', 'Currency converter', 'Convert between currencies using daily reference rates.', 'exchange rates money'),

  // Spreadsheets & data
  T('data', 'data', 'spreadsheet-cleaner', '🧹', 'Spreadsheet cleaner', 'Trim, deduplicate, drop empty rows and columns, and standardise headers in CSV or Excel.', 'csv xlsx dedupe'),
  T('data', 'data', 'email-list-validator', '✅', 'Email list validator', 'Validate, deduplicate and summarise a column of email addresses.', 'csv domains'),
  T('data', 'data', 'data-anonymizer', '🕵️', 'Data anonymizer', 'Mask emails and phone numbers and hash a chosen column in CSV or Excel.', 'privacy gdpr mask'),
  T('data', 'data', 'fake-data-generator', '🎲', 'Fake data generator', 'Generate locale-aware sample data (names, emails, companies…) as CSV.', 'sample mock test'),
  T('data', 'data', 'chart-maker', '📈', 'Chart maker', 'Turn CSV or Excel columns into a bar, line or pie chart image.', 'graph plot png'),
  T('data', 'data', 'excel-to-calendar', '📅', 'Excel to calendar', 'Convert a sheet of events into an .ics calendar file.', 'ics ical events'),

  // Documents & marketing
  T('docs', 'docs', 'office-to-markdown', '📥', 'Office to Markdown', 'Convert Word, PowerPoint, Excel, HTML or CSV files to Markdown.', 'docx pptx xlsx convert'),
  T('docs', 'docs', 'epub-builder', '📚', 'EPUB builder', 'Turn Markdown chapters into an EPUB e-book.', 'ebook book'),
  T('docs', 'docs', 'vcard-generator', '👤', 'vCard generator', 'Build a .vcf contact card (single or batch from a spreadsheet) plus a QR code.', 'contact vcf'),
  T('docs', 'docs', 'email-signature', '✉️', 'Email signature', 'Build a self-contained HTML email signature with a live preview.', 'gmail outlook'),
  T('docs', 'docs', 'persona-builder', '🧑‍🤝‍🧑', 'Persona builder', 'Build a persona / ICP one-pager and export it as HTML or PDF.', 'marketing icp'),
  T('docs', 'docs', 'newsletter-builder', '📬', 'Newsletter builder', 'Build a responsive HTML email newsletter with a live preview.', 'email html'),
  T('docs', 'docs', 'sell-sheet', '🏷️', 'Sell sheet', 'Build a product one-pager and export it as HTML or PDF.', 'product flyer one-pager'),
  T('docs', 'docs', 'resume-builder', '🧑‍💼', 'Resume builder', 'Fill a form and print a clean CV as PDF.', 'cv'),
  T('docs', 'docs', 'cover-letter', '💌', 'Cover letter', 'Generate a formatted cover letter and print it as PDF.', 'job application'),
  T('docs', 'docs', 'label-sheet', '🔖', 'Label sheet', 'Lay labels out on a printable A4 grid.', 'avery stickers print'),
  T('docs', 'docs', 'roadmap-maker', '🗺️', 'Roadmap maker', 'Generate a roadmap / timeline graphic from milestones.', 'timeline plan'),

  // Images & codes
  T('image', 'image', 'qr-code', '▦', 'QR code', 'Create QR codes (single or batch) in solid or gradient style, as PNG or SVG.', 'barcode url wifi'),
  T('image', 'image', 'image-resizer', '📐', 'Image resizer', 'Resize and compress images, or generate a complete favicon pack.', 'compress favicon ico'),
  T('image', 'image', 'image-watermark', '💧', 'Image watermark', 'Overlay a text or logo watermark with position, opacity and size.', 'logo stamp'),
  T('image', 'image', 'social-cropper', '✂️', 'Social cropper', 'Crop images to Instagram, Facebook, LinkedIn and X presets.', 'instagram linkedin'),
  T('image', 'image', 'meme-generator', '😂', 'Meme generator', 'Add top and bottom captions to an image.', 'caption'),
  T('image', 'image', 'brand-palette', '🎨', 'Brand palette', 'Extract a dominant colour palette from an image and export it as CSS.', 'colors hex'),
  T('image', 'image', 'screenshot-beautifier', '✨', 'Screenshot beautifier', 'Add a gradient background, padding, rounded corners and a shadow.', 'mockup'),
  T('image', 'image', 'browser-mockup', '🪟', 'Browser mockup', 'Wrap a screenshot in a browser-window frame.', 'screenshot frame'),
  T('image', 'image', 'device-mockup', '📱', 'Device mockup', 'Place a screenshot into a phone or laptop frame.', 'iphone macbook'),
  T('image', 'image', 'social-banner', '🚩', 'Social banner', 'Generate a LinkedIn, X, Facebook or YouTube banner with a name and tagline.', 'header cover'),
  T('image', 'image', 'certificate-generator', '🏅', 'Certificate generator', 'Create a certificate as PNG or PDF.', 'diploma award'),
  T('image', 'image', 'file-converter', '🔄', 'Image converter', 'Convert between PNG, JPG, WebP and BMP.', 'format jpeg png webp'),
  T('image', 'image', 'images-to-pdf', '🧷', 'Images to PDF', 'Combine multiple images into one PDF (A4, Letter or fit-to-image).', 'pdf merge'),
];

export const byId = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

export function searchTools(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return TOOLS;
  return TOOLS.filter((t) => {
    const hay = `${t.name} ${t.desc} ${t.kw}`.toLowerCase();
    return terms.every((x) => hay.includes(x));
  });
}

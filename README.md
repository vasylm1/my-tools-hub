# My Tools Hub

A collection of 43 small, private tools that run entirely in your browser: nothing you paste or open is uploaded. The Currency converter downloads exchange rates from `open.er-api.com`. Self-hosted Umami records page views; it does not receive tool inputs or files.

It is a static site in plain HTML, CSS and vanilla JavaScript (ES modules). There is no build step and no runtime dependencies. Everything served lives in `public/`.

## Tools

The catalogue is defined in `public/js/registry.js`.

**Writing & text**
- Copy analyzer
- Headline analyzer
- Hashtag extractor
- Text diff
- Markdown to HTML
- HTML to Markdown

**Developer & utilities**
- JSON formatter
- Power Automate JSON checker
- SQL formatter
- HTML viewer
- Unit converter
- Date & time toolkit
- Currency converter

**Spreadsheets & data**
- Spreadsheet cleaner
- Email list validator
- Data anonymizer
- Fake data generator
- Chart maker
- Excel to calendar

**Documents & marketing**
- Office to Markdown
- EPUB builder
- vCard generator
- Email signature
- Persona builder
- Newsletter builder
- Sell sheet
- Resume builder
- Cover letter
- Label sheet
- Roadmap maker

**Images & codes**
- QR code
- Image resizer
- Image watermark
- Social cropper
- Meme generator
- Brand palette
- Screenshot beautifier
- Browser mockup
- Device mockup
- Social banner
- Certificate generator
- Image converter
- Images to PDF

## Run locally

Requires Node.js 20 or newer (used only for the dev server and checks).

```sh
npm start              # serves public/ at http://localhost:8080
npm start -- 3000      # or pick a port (also: PORT=3000 npm start)
```

The server (`scripts/serve.mjs`) applies the headers from `netlify.toml`, including the Content-Security-Policy, so what you test is what Netlify serves. No `npm install` is needed to run the app.

Checks and tests need no `npm install`; the repository has no dependencies at all:

```sh
npm run check          # registry <-> tool module consistency checks
npm test               # node --test tests/
```

`tests/qr.decode.test.mjs` can additionally verify generated QR codes with the independent jsQR decoder. jsQR is deliberately not a dependency of this repository, so this is optional and scratch-only: install it in a directory outside the repo and point `JSQR_PATH` at its entry file. Without `JSQR_PATH` (or if the path can't be loaded) those tests are skipped.

```sh
mkdir -p /tmp/jsqr-scratch && (cd /tmp/jsqr-scratch && npm install jsqr)
JSQR_PATH=/tmp/jsqr-scratch/node_modules/jsqr/dist/jsQR.js npm test
```

## Deploy to Netlify

`netlify.toml` already configures everything: `publish = "public"`, no build command, plus security and cache headers.

1. Push the repository to GitHub, GitLab or Bitbucket.
2. In Netlify choose **Add new site → Import an existing project** and select the repository. Leave the build command empty; the publish directory comes from `netlify.toml`.
3. Deploy. Every push to the production branch redeploys.

Or, with the Netlify CLI: `npx netlify-cli deploy --prod` from the repository root.

## Add a tool

1. Add a `T(...)` entry to `TOOLS` in `public/js/registry.js` (module, category id, kebab-case tool id, icon, name, one-sentence description, search keywords).
2. Add a definition under the same id in `tools` in the matching `public/js/tools/<module>.js`, with its `fields`, an `example` and a `run()` function (put reusable logic in `public/js/lib/`).
3. Run `npm run check` and `npm test`, then try it with `npm start`.

## Project layout

```
public/            deployed site: index.html, css/, js/, icons/, sw.js, manifest
  js/registry.js   tool catalogue and search
  js/tools/        tool definitions by category (text, dev, data, docs, image)
  js/lib/          pure helpers (CSV, XLSX, PDF, QR, Markdown, ...)
  js/core/         shared UI: DOM helper, form renderer, runner, image utils
scripts/           serve.mjs (local server), check.mjs (consistency checks)
tests/             node:test suites
netlify.toml       Netlify publish directory and headers
```

## License

MIT, see `LICENSE`.

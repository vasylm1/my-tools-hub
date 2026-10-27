# Contributing to My Tools Hub

My Tools Hub is a set of small, private tools that run entirely in the browser. It is plain HTML, CSS and vanilla JavaScript (ES modules). Please keep it that way.

## Ground rules

- **No build step.** Netlify serves `public/` as-is. Do not add a bundler, transpiler, framework or generated output.
- **No runtime dependencies.** Anything the app needs lives in `public/js/lib/` as our own code, and `package.json` has no dependencies at all, so there is nothing to install.
- **Nothing leaves the browser.** Files and text are processed locally. The only allowed network request is the exchange-rate fetch to `https://open.er-api.com` by the Currency converter. Do not add analytics, fonts, CDNs or other remote resources.
- **Node 20+** is needed for the scripts and tests; the app itself needs only a browser.

## Project layout

| Path | Purpose |
|---|---|
| `public/index.html`, `public/css/app.css` | App shell and all styles |
| `public/js/main.js` | Hash router, sidebar, search, theme, lazy loading of tool modules |
| `public/js/registry.js` | Catalogue of categories and tools (name, icon, description, search keywords) |
| `public/js/tools/*.js` | Tool definitions, grouped by module (`text`, `dev`, `data`, `docs`, `image`) |
| `public/js/lib/*.js` | Pure logic (parsers, formatters, encoders). No DOM access, so it is testable in Node |
| `public/js/core/*.js` | Shared UI: `dom.js` helpers, `form.js` field builders, `runner.js` renders results, `image.js` |
| `public/sw.js`, `public/manifest.webmanifest` | Offline support and PWA metadata |
| `netlify.toml` | Publish directory and security headers (including the CSP) |
| `scripts/serve.mjs`, `scripts/check.mjs` | Local server and consistency checks |
| `tests/*.test.mjs` | Tests using `node:test` |

## Code conventions

- ES modules with relative imports and the `.js` extension. Two-space indent, single quotes, semicolons.
- Match the style of the file you are editing, including comment density. Comments explain *why*, not *what*.
- Put logic in `js/lib/` as pure functions and keep tool modules thin: declare fields, call the lib, return a result.
- Build DOM with the `h()` helper from `core/dom.js`, not string templates.
- Tool ids are kebab-case and unique.

## Adding a tool

1. **Logic.** If it is more than a few lines, add a pure module in `public/js/lib/` (or extend an existing one).
2. **Definition.** In the matching `public/js/tools/<module>.js`, add an entry to the exported `tools` object, keyed by the tool id:
   ```js
   'my-tool': {
     fields: [{ id: 'text', type: 'textarea', label: 'Your text', rows: 10 }],
     example: { text: 'Sample input' },   // keys must be field ids
     run({ text }) {
       if (!text.trim()) return { empty: 'Paste some text to begin.' };
       return { stats: [['Characters', text.length]] };
     },
   },
   ```
   Field types are in `core/form.js`; the result shapes (`error`, `empty`, `notice`, `stats`, `table`, `node`, `canvas`, `html`, `text`, `downloads`, `sections`) are documented at the top of `core/runner.js`. Set `live: false` (and optionally `runLabel`) for heavy work that should run only on a button press.
3. **Register it.** Add a `T(...)` line to `TOOLS` in `public/js/registry.js` with the right module and category, an emoji icon, a one-sentence description and a few search keywords. Use a new module/category only when none fit.
4. **Test it.** Add cases for the lib logic in `tests/` (see `tests/logic.test.mjs` and `tests/formats.test.mjs`).
5. **Check it.** Run the commands below and try the tool in a browser, including empty input and bad input.

If you add a new file to the app shell that must work offline, update `SHELL` in `public/sw.js`. Tool modules are cached on demand and need no change.

## Accessibility

- Use real controls (`button`, `a`, `label` + input) rather than clickable `div`s. Every field needs a label; the form builders provide one.
- Decorative emoji and icons get `aria-hidden="true"`; meaningful ones get text.
- Results render into an `aria-live="polite"` region, so return clear `error`, `empty` and `notice` messages instead of failing silently.
- Everything must work by keyboard with a visible focus style, and in both light and dark themes (`prefers-color-scheme`). Do not rely on colour alone to convey status.
- Layouts must work on a phone-width screen with no horizontal page scroll.

## Handling user input safely

The CSP in `netlify.toml` is strict (`script-src 'self'`, no inline scripts, `object-src 'none'`, no framing). Work with it, not around it.

- **Never** use `innerHTML =`, `eval()`, `new Function()`, inline `on...=` handlers, or remote scripts. `scripts/check.mjs` fails on them.
- Insert user text with `textContent`, text nodes or `h()` (which creates text nodes). If you must build an HTML string from user data, run each value through `escapeHtml()` from `core/dom.js`.
- Preview user-built or untrusted HTML only through the result `html` type, which renders in a sandboxed iframe with scripts disabled.
- Treat uploaded files as untrusted: validate the format, handle malformed or empty files with a friendly `error` result, and avoid unbounded work on huge inputs.
- Do not store user content in `localStorage` or send it anywhere (the only stored value is the theme choice). Revoke any object URLs you create (`download()` already does).
- A new third-party host needs a deliberate change to both the CSP in `netlify.toml` and the allow-list in `scripts/check.mjs`. Expect that to need a strong justification.

## Local verification

```sh
npm run check      # registry <-> tool modules, unique field ids, external URLs, banned patterns
npm test           # node --test tests/
npm start          # serves public/ on http://localhost:8080 with the netlify.toml headers
```

`npm start` accepts a port (`node scripts/serve.mjs 3000`) or `PORT=3000`. Because it applies the real CSP, a CSP violation shows up in the browser console as it would in production. Before submitting, open the app, exercise your change (light and dark theme, narrow window, keyboard only), and check the console for errors. The QR decode test is skipped unless `JSQR_PATH` points at a scratch install of jsQR (see the comment at the top of `tests/qr.decode.test.mjs`); jsQR is deliberately not a repo dependency.

## Submitting a change

1. Branch from `main` and keep the change focused: one tool or one fix per pull request.
2. Make sure `npm run check` and `npm test` pass and you have tested in a browser.
3. Write a commit message that says what changed and why, in the imperative mood (for example, "Add Base64 encoder tool").
4. Open a pull request describing the change, how you verified it, and screenshots for visible UI changes. Call out any change to `netlify.toml`, `sw.js` or the CSP.
5. Respond to review feedback with follow-up commits.

By contributing you agree that your work is released under the [MIT License](LICENSE).

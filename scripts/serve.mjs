// Local static server that applies the headers from netlify.toml, so what you test is what Netlify serves.
// Usage: node scripts/serve.mjs [port]
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const port = Number(process.argv[2] || process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

export async function loadHeaderRules() {
  const toml = await readFile(path.join(root, 'netlify.toml'), 'utf8');
  const rules = [];
  let current = null;
  for (const raw of toml.split('\n')) {
    const line = raw.trim();
    if (line === '[[headers]]') { current = { for: '', values: {} }; rules.push(current); continue; }
    if (!current) continue;
    const m = /^([\w-]+)\s*=\s*"(.*)"$/.exec(line);
    if (!m) continue;
    if (m[1] === 'for') current.for = m[2]; else current.values[m[1]] = m[2];
  }
  return rules;
}

const matches = (pattern, url) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(url);

export function startServer(rules, listenPort = port) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost').pathname;
    let file = path.join(publicDir, decodeURIComponent(url));
    if (!file.startsWith(publicDir)) { res.writeHead(403).end('Forbidden'); return; }
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const body = await readFile(file);
      const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
      for (const rule of rules) if (matches(rule.for, url)) Object.assign(headers, rule.values);
      res.writeHead(200, headers).end(body);
    } catch {
      const body = await readFile(path.join(publicDir, '404.html'));
      res.writeHead(404, { 'Content-Type': TYPES['.html'], ...rules.find((r) => r.for === '/*')?.values }).end(body);
    }
  });
  return new Promise((resolve) => server.listen(listenPort, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startServer(await loadHeaderRules());
  console.log(`My Tools Hub on http://localhost:${port}`);
}

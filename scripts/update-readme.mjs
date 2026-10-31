// Rewrites the "All tools" tables in README.md from public/js/registry.js.  Run after adding a tool: npm run readme
// npm run check fails when a tool is missing from the README.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { CATEGORIES, TOOLS } = await import(pathToFileURL(path.join(root, 'public/js/registry.js')).href);

export const toolTables = () => CATEGORIES.map((c) => [
  `### ${c.name}`, '', '| Tool | What it does |', '| --- | --- |',
  ...TOOLS.filter((t) => t.cat === c.id).map((t) => `| **${t.name}** | ${t.desc.replace(/\|/g, '\\|')} |`), '',
].join('\n')).join('\n');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = path.join(root, 'README.md');
  const text = await readFile(file, 'utf8');
  const start = text.indexOf('The catalogue is defined in `public/js/registry.js`.');
  const end = text.indexOf('## Good to know');
  if (start < 0 || end < 0) throw new Error('README.md: could not find the "All tools" section');
  const head = 'The catalogue is defined in `public/js/registry.js`. The tables below are generated from it with `npm run readme`.\n\n';
  await writeFile(file, `${text.slice(0, start)}${head}${toolTables()}\n${text.slice(end)}`);
  console.log(`README tables updated: ${TOOLS.length} tools`);
}

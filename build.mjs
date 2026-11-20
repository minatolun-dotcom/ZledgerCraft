// ZledgerCraft - single-file build. Inlines CSS and ES modules into dist/ZledgerCraft.html
// so the app can be opened straight from disk.
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const MODULE_ORDER = [
  'src/store.js',
  'src/accounting.js',
  'src/tally.js',
  'src/xlsx.js',
  'src/backup-crypto.js',
  'src/ui-constants.js',
  'src/ui-server.js',
  'src/ui-screens.js',
  'src/ui-reports.js',
  'src/ui-inventory.js',
  'src/ui-admin.js',
  'src/ui-tax.js',
  'src/ui-payroll.js',
  'src/ui-banking.js',
  'src/ui.js',
  'src/main.js',
];

function stripModuleSyntax(source) {
  return source
    .replace(/^import\s[\s\S]*?;\s*$/gm, '')
    .replace(/\bexport\s+(?=(?:async\s+)?(?:const|let|var|function|class)\b)/g, '');
}

const [html, css] = await Promise.all([
  readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(root, 'styles.css'), 'utf8'),
]);

const modules = [];
for (const relative of MODULE_ORDER) {
  const source = await readFile(join(root, relative), 'utf8');
  modules.push(`// ---- ${relative} ----\n${stripModuleSyntax(source)}`);
}

const bundle = `(function () {\n'use strict';\n${modules.join('\n')}\n})();`;

const output = html
  .replace(
    '<link rel="stylesheet" href="styles.css" />',
    () => `<style>\n${css}\n</style>`,
  )
  .replace(
    '<script type="module" src="src/main.js"></script>',
    () => `<script>\n${bundle}\n</script>`,
  );

if (output === html || !output.includes('<style>') || !output.includes('(function () {')) {
  throw new Error('Build failed: index.html is missing the stylesheet or module script tag.');
}

await mkdir(join(root, 'dist'), { recursive: true });
await cp(join(root, 'brand'), join(root, 'dist', 'brand'), { recursive: true });
const target = join(root, 'dist', 'ZledgerCraft.html');
await writeFile(target, output, 'utf8');
// Cloudflare Pages expects an index document at the root of its output
// directory. Keep the downloadable single-file name as well.
await writeFile(join(root, 'dist', 'index.html'), output, 'utf8');
console.log(`Built ${target} and dist/index.html (${(output.length / 1024).toFixed(1)} kB)`);

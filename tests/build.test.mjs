import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('build emits the single-file app and a Cloudflare Pages index', () => {
  execFileSync(process.execPath, ['build.mjs'], { cwd: root, stdio: 'pipe' });
  const single = readFileSync(join(root, 'dist', 'ZledgerCraft.html'), 'utf8');
  const pages = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
  assert.equal(pages, single);
  assert.match(pages, /<style>/);
  assert.match(pages, /\(function \(\) \{/);
  assert.match(pages, /ZledgerCraft/);
});

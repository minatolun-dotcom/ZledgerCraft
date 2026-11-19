// Load a local env file without adding a runtime dependency. Existing process
// environment values win so `PORT=... npm start` still overrides the file.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const skip = process.env.ZL_DISABLE_ENV_FILE === '1' || Boolean(process.env.NODE_TEST_CONTEXT);

for (const name of skip ? [] : ['.env.local', '.env']) {
  const file = join(root, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

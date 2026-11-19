// Create a short-lived Neon branch, run the Postgres workspace integration
// test against it, then remove the branch. Requires a logged-in Neon CLI/API
// key and network access; it is not part of the offline `npm test` suite.
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const branchName = `zl-phase2-${Date.now().toString(36)}`;
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function neon(args) {
  return execFileSync('npx', ['--yes', 'neon@latest', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForDatabase(connectionString) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
    try {
      await pool.query('select 1');
      await pool.end();
      return;
    } catch (error) {
      lastError = error;
      await pool.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

let created = false;
try {
  const output = neon([
    'branches',
    'create',
    '--name',
    branchName,
    '--expires-at',
    expiresAt,
    '--output',
    'json',
  ]);
  const result = JSON.parse(output);
  const connectionString = result.connection_uris?.[0]?.connection_uri;
  if (!connectionString) throw new Error('Neon did not return a branch connection string.');
  created = true;
  await waitForDatabase(connectionString);
  console.log(`Created ${branchName}; running Postgres integration test.`);
  const test = spawnSync(process.execPath, ['--test', 'tests/server-pg.test.mjs'], {
    cwd: appRoot,
    env: { ...process.env, TEST_DATABASE_URL: connectionString, ZL_DISABLE_ENV_FILE: '1' },
    stdio: 'inherit',
  });
  if (test.status !== 0) throw new Error(`Postgres integration test failed (${test.status}).`);
} finally {
  if (created) {
    try {
      neon(['branches', 'delete', branchName]);
      console.log(`Deleted ${branchName}.`);
    } catch (error) {
      console.error(`Could not delete ${branchName}; it expires at ${expiresAt}.`);
      console.error(error.stderr || error.message);
    }
  }
}

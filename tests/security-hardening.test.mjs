import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('..', import.meta.url));

function serverEnv(extra = {}) {
  const env = { ...process.env };
  for (const name of [
    'DATABASE_URL',
    'DATABASE_URL_UNPOOLED',
    'NEON_AUTH_BASE_URL',
    'NEON_AUTH_JWKS_URL',
    'RESEND_API_KEY',
    'ZL_BACKUP_PASSPHRASE',
    'ZL_OWNER_PASSWORD',
    'ZL_ALLOWED_IPS',
    'ZL_PROXY_SECRET',
    'ZL_SCHEDULER_SECRET',
    'ZL_REPORT_SECRET',
  ]) {
    delete env[name];
  }
  return {
    ...env,
    HOST: '127.0.0.1',
    PORT: '0',
    ZL_DISABLE_ENV_FILE: '1',
    ...extra,
  };
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`Server did not start:\n${buffer}`)), 15000);
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/ZledgerCraft running at http:\/\/127\.0\.0\.1:(\d+)\//);
      if (!match) return;
      clearTimeout(timer);
      resolve(`http://127.0.0.1:${match[1]}`);
    });
    child.stderr.on('data', (chunk) => {
      buffer += chunk.toString();
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with ${code}:\n${buffer}`));
    });
  });
}

async function withServer(extra, run, prepareData) {
  const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-security-'));
  if (prepareData) prepareData(dataDir);
  const child = spawn(process.execPath, ['serve.mjs'], {
    cwd: appRoot,
    env: serverEnv({ ZL_DATA_DIR: dataDir, ...extra }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const base = await waitForServer(child);
    await run({ base, dataDir });
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
}

test('forwarded client IPs require the proxy secret', { timeout: 30000 }, async () => {
  await withServer(
    {
      ZL_ALLOWED_IPS: '192.0.2.10',
      ZL_PROXY_SECRET: 'proxy-test-secret',
    },
    async ({ base }) => {
      assert.equal((await fetch(`${base}/`)).status, 403);
      assert.equal(
        (
          await fetch(`${base}/`, {
            headers: { 'x-zl-client-ip': '192.0.2.10' },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${base}/`, {
            headers: {
              'x-zl-client-ip': '192.0.2.10',
              'x-zl-proxy-secret': 'wrong-secret',
            },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${base}/`, {
            headers: {
              'x-zl-client-ip': '192.0.2.10',
              'x-zl-proxy-secret': 'proxy-test-secret',
            },
          })
        ).status,
        200,
      );
    },
  );
});

test('scheduler requires ZL_SCHEDULER_SECRET, not a forgeable trigger header', { timeout: 30000 }, async () => {
  await withServer({ ZL_SCHEDULER_SECRET: 'scheduler-test-secret' }, async ({ base }) => {
    assert.equal((await fetch(`${base}/api/internal/scheduler`, { method: 'POST' })).status, 401);
    assert.equal(
      (
        await fetch(`${base}/api/internal/scheduler`, {
          method: 'POST',
          headers: { 'x-neon-trigger-invocation-id': 'forged' },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${base}/api/internal/scheduler`, {
          method: 'POST',
          headers: { authorization: 'Bearer wrong-secret' },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${base}/api/internal/scheduler`, {
          method: 'POST',
          headers: { authorization: 'Bearer scheduler-test-secret' },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${base}/api/internal/scheduler/wrong-secret`, {
          method: 'POST',
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${base}/api/internal/scheduler/scheduler-test-secret`, {
          method: 'POST',
        })
      ).status,
      200,
    );
  });
});

test('only public app assets are served as static files', { timeout: 30000 }, async () => {
  await withServer({}, async ({ base }) => {
    for (const path of ['/src/main.js', '/brand/favicon.svg', '/dist/index.html']) {
      assert.equal((await fetch(`${base}${path}`)).status, 200, path);
    }
    for (const path of [
      '/serve.mjs',
      '/server-auth.js',
      '/server-env.js',
      '/package.json',
      '/wrangler.toml',
      '/tests/server-api.test.mjs',
      '/node_modules/pg/package.json',
      '/README.md',
    ]) {
      assert.equal((await fetch(`${base}${path}`)).status, 403, path);
    }
  });
});

test('workspace data is created with owner-only permissions', { timeout: 30000 }, async () => {
  await withServer(
    {},
    async ({ dataDir }) => {
      assert.equal(statSync(dataDir).mode & 0o777, 0o700);
      assert.equal(statSync(join(dataDir, 'workspace.sqlite')).mode & 0o777, 0o600);
      for (const name of ['workspace.sqlite-wal', 'workspace.sqlite-shm']) {
        const path = join(dataDir, name);
        if (existsSync(path)) assert.equal(statSync(path).mode & 0o777, 0o600, name);
      }
    },
    (dataDir) => {
      chmodSync(dataDir, 0o755);
      const database = join(dataDir, 'workspace.sqlite');
      writeFileSync(database, '');
      chmodSync(database, 0o644);
    },
  );
});

test('report links and auth bodies are hardened', { timeout: 30000 }, async () => {
  await withServer(
    {
      ZL_AUTH: '1',
      ZL_OWNER_PASSWORD: 'correct horse battery',
      ZL_REPORT_SECRET: 'report-test-secret',
    },
    async ({ base }) => {
      const report = await fetch(`${base}/api/reports/daily?token=forged`);
      assert.equal(report.status, 401);
      assert.equal(report.headers.get('x-content-type-options'), 'nosniff');
      assert.match(report.headers.get('content-security-policy') ?? '', /default-src 'self'/);

      const login = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'owner', password: 'x'.repeat(70 * 1024) }),
      });
      assert.equal(login.status, 400);
    },
  );
});

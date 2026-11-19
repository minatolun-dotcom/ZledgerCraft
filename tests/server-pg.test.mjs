import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const databaseUrl = process.env.TEST_DATABASE_URL;

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`Server did not start:\n${buffer}`)), 30000);
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

function client(base) {
  let cookie = '';
  return {
    async request(path, options = {}) {
      const headers = { ...(options.headers ?? {}) };
      if (cookie) headers.cookie = cookie;
      const response = await fetch(`${base}${path}`, { ...options, headers });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      let body = null;
      try {
        body = await response.json();
      } catch {
        // Empty responses are valid for this test.
      }
      return { status: response.status, body, headers: Object.fromEntries(response.headers.entries()) };
    },
  };
}

test(
  'branch Postgres workspace saves, reloads, leases and verifies audit',
  { skip: !databaseUrl && 'TEST_DATABASE_URL is not set', timeout: 90000 },
  async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-pg-'));
    const child = spawn(process.execPath, ['serve.mjs'], {
      cwd: appRoot,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: '0',
        ZL_AUTH: '1',
        ZL_OWNER_USER: 'owner',
        ZL_OWNER_NAME: 'PG Test Owner',
        ZL_OWNER_PASSWORD: 'correct horse battery',
        ZL_DATA_DIR: dataDir,
        ZL_DISABLE_ENV_FILE: '1',
        DATABASE_URL: databaseUrl,
        DATABASE_URL_UNPOOLED: '',
        NEON_AUTH_BASE_URL: '',
        NEON_AUTH_JWKS_URL: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      const base = await waitForServer(child);
      const owner = client(base);
      const login = await owner.request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'owner', password: 'correct horse battery' }),
      });
      assert.equal(login.status, 200, JSON.stringify(login.body));
      const me = await owner.request('/api/auth/me');
      assert.equal(me.status, 200, JSON.stringify(me.body));
      assert.equal(me.body.storage, 'postgres');
      assert.equal(me.body.postgres, true);

      const company = {
        id: 'co_pg_branch',
        name: 'Branch Books',
        fyStart: '2026-04-01',
        fyEnd: '2027-03-31',
        yearId: 'year_pg_branch',
        years: [{ id: 'year_pg_branch', start: '2026-04-01', end: '2027-03-31', closed: false }],
        ledgers: [{ id: 'ledger_pg_cash', name: 'Cash', groupId: 'cash', opening: 0, openingType: 'Dr' }],
        vouchers: [],
      };
      const state = {
        version: 1,
        activeCompanyId: company.id,
        companies: [company],
        users: [],
        audit: [],
        currentUserId: null,
      };
      const opened = await owner.request('/api/workspace');
      assert.equal(opened.status, 200, JSON.stringify(opened.body));
      const saved = await owner.request('/api/workspace', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseRev: opened.body.rev, state }),
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      const reloaded = await owner.request('/api/workspace');
      assert.equal(reloaded.status, 200, JSON.stringify(reloaded.body));
      assert.equal(reloaded.body.state.companies[0].id, company.id);

      const lease = await owner.request('/api/workspace/leases', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          recordType: 'voucher',
          recordId: 'voucher_pg_branch',
        }),
      });
      assert.equal(lease.status, 200, JSON.stringify(lease.body));
      assert.ok(lease.body.token);
      const released = await owner.request('/api/workspace/leases', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          recordType: 'voucher',
          recordId: 'voucher_pg_branch',
          token: lease.body.token,
        }),
      });
      assert.equal(released.status, 200, JSON.stringify(released.body));
      assert.equal(released.body.released, true);

      const audit = await owner.request('/api/server-audit');
      assert.equal(audit.status, 200, JSON.stringify(audit.body));
      assert.equal(audit.body.chain.ok, true);
      assert.ok(audit.body.chain.checked > 0);
      assert.equal(audit.body.eventChain.ok, true);
    } finally {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
      rmSync(dataDir, { recursive: true, force: true });
    }
  },
);

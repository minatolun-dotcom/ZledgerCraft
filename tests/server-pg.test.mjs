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
  { skip: !databaseUrl && 'TEST_DATABASE_URL is not set', timeout: 180000 },
  async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-pg-'));
    const env = {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      ZL_AUTH: '1',
      ZL_OWNER_USER: 'owner',
      ZL_OWNER_NAME: 'PG Test Owner',
      ZL_OWNER_PASSWORD: 'correct horse battery',
      ZL_DATA_DIR: dataDir,
      ZL_DISABLE_ENV_FILE: '1',
      ZL_API_RATE_LIMIT: '3',
      DATABASE_URL: databaseUrl,
      DATABASE_URL_UNPOOLED: '',
      NEON_AUTH_BASE_URL: '',
      NEON_AUTH_JWKS_URL: '',
    };
    const child = spawn(process.execPath, ['serve.mjs'], {
      cwd: appRoot,
      env,
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

      const tokenCreated = await owner.request('/api/auth/api-tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'PG reporting job' }),
      });
      assert.equal(tokenCreated.status, 200, JSON.stringify(tokenCreated.body));
      const apiHeaders = { authorization: `Bearer ${tokenCreated.body.token}` };
      const apiCompanies = await owner.request('/api/v1/companies', { headers: apiHeaders });
      assert.equal(apiCompanies.status, 200, JSON.stringify(apiCompanies.body));
      assert.equal(apiCompanies.body.data.companies[0].id, company.id);
      const tokenList = await owner.request('/api/auth/api-tokens');
      assert.equal(tokenList.body.tokens[0].lastUsedAt !== null, true);
      assert.equal(
        (await owner.request(`/api/auth/api-tokens/${tokenCreated.body.apiToken.id}`, { method: 'DELETE' })).status,
        200,
      );
      assert.equal((await owner.request('/api/v1/companies', { headers: apiHeaders })).status, 401);

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

      const reportSettings = await owner.request('/api/reports/settings');
      assert.equal(reportSettings.status, 200, JSON.stringify(reportSettings.body));
      assert.equal(reportSettings.body.settings.enabled, false);
      const savedSettings = await owner.request('/api/reports/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: true, recipients: 'owner@example.com' }),
      });
      assert.equal(savedSettings.status, 200, JSON.stringify(savedSettings.body));
      assert.equal(savedSettings.body.settings.enabled, true);
      const rereadSettings = await owner.request('/api/reports/settings');
      assert.equal(rereadSettings.body.settings.recipients, 'owner@example.com');
      const failedSend = await owner.request('/api/reports/send', { method: 'POST' });
      assert.equal(failedSend.status, 503, JSON.stringify(failedSend.body));
      const reportHistory = await owner.request('/api/reports/settings');
      assert.equal(reportHistory.body.history[0].status, 'failed');
      assert.equal(reportHistory.body.history[0].source, 'manual');
      assert.equal(reportHistory.body.history[0].recipients, 'owner@example.com');
      const backup = await owner.request('/api/backups', { method: 'POST' });
      assert.equal(backup.status, 200, JSON.stringify(backup.body));
      const backupList = await owner.request('/api/backups');
      assert.equal(backupList.body.history[0].status, 'ok');
      assert.equal(backupList.body.history[0].name, backup.body.backup.name);

      const audit = await owner.request('/api/server-audit');
      assert.equal(audit.status, 200, JSON.stringify(audit.body));
      assert.equal(audit.body.chain.ok, true);
      assert.ok(audit.body.chain.checked > 0);
      assert.equal(audit.body.eventChain.ok, true);

      const sharedRateToken = await owner.request('/api/auth/api-tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Shared rate token' }),
      });
      assert.equal(sharedRateToken.status, 200, JSON.stringify(sharedRateToken.body));
      const sharedRateHeaders = { authorization: `Bearer ${sharedRateToken.body.token}` };
      // The limiter uses fixed one-minute windows. Start near the beginning of
      // one so the second instance cannot land in the next window and reset it.
      const msLeftInWindow = 60_000 - (Date.now() % 60_000);
      if (msLeftInWindow < 30_000) {
        await new Promise((resolve) => setTimeout(resolve, msLeftInWindow + 1000));
      }
      for (let attempt = 0; attempt < 3; attempt += 1) {
        assert.equal((await owner.request('/api/v1/companies', { headers: sharedRateHeaders })).status, 200);
      }
      const usageToken = (await owner.request('/api/auth/api-tokens')).body.tokens.find(
        (entry) => entry.name === 'Shared rate token',
      );
      assert.ok(usageToken.requests24h >= 3, JSON.stringify(usageToken));
      assert.ok(usageToken.requests1h >= 3, JSON.stringify(usageToken));

      // Rate-limit failures recorded by a second instance must block the first
      // instance too, because both share the Postgres limiter table.
      const secondDataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-pg-peer-'));
      const peer = spawn(process.execPath, ['serve.mjs'], {
        cwd: appRoot,
        env: { ...env, ZL_DATA_DIR: secondDataDir },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      try {
        const peerBase = await waitForServer(peer);
        const peerClient = client(peerBase);
        assert.equal(
          (await peerClient.request('/api/v1/companies', { headers: sharedRateHeaders })).status,
          429,
        );
        for (let attempt = 1; attempt <= 8; attempt += 1) {
          const failed = await peerClient.request('/api/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ username: `nobody${attempt}`, password: 'wrong password' }),
          });
          assert.equal(failed.status, 401);
        }
        const blocked = await owner.request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'owner', password: 'correct horse battery' }),
        });
        assert.equal(blocked.status, 429, JSON.stringify(blocked.body));
      } finally {
        peer.kill('SIGTERM');
        await new Promise((resolve) => peer.once('exit', resolve));
        rmSync(secondDataDir, { recursive: true, force: true });
      }
    } finally {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
      rmSync(dataDir, { recursive: true, force: true });
    }
  },
);

import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const passphrase = 'correct horse battery staple';

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

function client(base) {
  let cookie = '';
  async function request(path, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    if (cookie) headers.cookie = cookie;
    const response = await fetch(`${base}${path}`, { ...options, headers });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    let body = null;
    try {
      body = await response.json();
    } catch {
      // Keep the status and headers for non-JSON responses.
    }
    return {
      status: response.status,
      body,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }
  return { request };
}

function serverEnv(dataDir, extra = {}) {
  return {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: '0',
    ZL_DATA_DIR: dataDir,
    ZL_DISABLE_ENV_FILE: '1',
    DATABASE_URL: '',
    ...extra,
  };
}

function spawnServer(dataDir, extra) {
  return spawn(process.execPath, ['serve.mjs'], {
    cwd: appRoot,
    env: serverEnv(dataDir, extra),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
}

test(
  'server encrypts backups at rest and restores them with the configured passphrase',
  { timeout: 45000 },
  async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-encrypted-backup-'));
    let child = spawnServer(dataDir, { ZL_BACKUP_PASSPHRASE: passphrase });
    let base = '';
    try {
      base = await waitForServer(child);
      const api = client(base);
      const state = {
        version: 1,
        activeCompanyId: 'co_enc',
        companies: [
          {
            id: 'co_enc',
            name: 'Encrypted Books',
            fyStart: '2026-04-01',
            fyEnd: '2027-03-31',
            yearId: 'year_enc',
            years: [{ id: 'year_enc', start: '2026-04-01', end: '2027-03-31', closed: false }],
            ledgers: [],
            vouchers: [],
          },
        ],
        users: [],
        audit: [],
      };
      assert.equal(
        (
          await api.request('/api/workspace', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ baseRev: 0, state }),
          })
        ).status,
        200,
      );

      const created = await api.request('/api/backups', { method: 'POST' });
      assert.equal(created.status, 200, JSON.stringify(created.body));
      const name = created.body.backup.name;
      assert.match(name, /^workspace-\d{8}-\d{6}-manual\.sqlite\.enc$/);
      assert.equal(created.body.backup.encrypted, true);

      const encryptedFile = readFileSync(join(dataDir, 'backups', name));
      assert.equal(encryptedFile.subarray(0, 7).toString(), 'ZLCBK1\n');
      assert.notEqual(encryptedFile.subarray(0, 15).toString(), 'SQLite format 3');
      assert.equal(encryptedFile.includes(Buffer.from('Encrypted Books')), false);

      const listed = await api.request('/api/backups');
      assert.equal(listed.body.encryption.configured, true);
      assert.equal(listed.body.backups.find((backup) => backup.name === name)?.encrypted, true);

      const download = await fetch(`${base}/api/backups/${encodeURIComponent(name)}`);
      assert.equal(download.status, 200);
      assert.equal(download.headers.get('content-type'), 'application/octet-stream');
      assert.equal(download.headers.get('x-zledgercraft-encrypted'), 'AES-256-GCM');
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), encryptedFile);

      const current = await api.request('/api/workspace');
      const changed = structuredClone(current.body.state);
      changed.companies.push({ ...changed.companies[0], id: 'co_temp', name: 'Temporary Books' });
      assert.equal(
        (
          await api.request('/api/workspace', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ baseRev: current.body.rev, state: changed }),
          })
        ).status,
        200,
      );
      const restored = await api.request(`/api/backups/${encodeURIComponent(name)}/restore`, {
        method: 'POST',
      });
      assert.equal(restored.status, 200, JSON.stringify(restored.body));
      assert.match(restored.body.preRestore.name, /\.sqlite\.enc$/);
      const after = await api.request('/api/workspace');
      assert.deepEqual(after.body.state.companies.map((company) => company.id), ['co_enc']);

      await stopServer(child);
      child = spawnServer(dataDir);
      const noKeyBase = await waitForServer(child);
      const noKey = client(noKeyBase);
      const refused = await noKey.request(`/api/backups/${encodeURIComponent(name)}/restore`, {
        method: 'POST',
      });
      assert.equal(refused.status, 500);
      assert.match(refused.body.error, /encrypted.*ZL_BACKUP_PASSPHRASE/i);
    } finally {
      await stopServer(child);
      rmSync(dataDir, { recursive: true, force: true });
    }
  },
);

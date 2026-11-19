import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { totpCode } from '../server-auth.js';
import { fileURLToPath } from 'node:url';

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
      // Some responses intentionally have no JSON body.
    }
    return {
      status: response.status,
      body,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }
  return { request };
}

function rawRequest(base, text) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const socket = connect(Number(url.port), url.hostname, () => {
      socket.end(text);
    });
    let response = '';
    socket.on('data', (chunk) => {
      response += chunk.toString();
    });
    socket.on('end', () => resolve(response));
    socket.on('error', reject);
  });
}

test('server migrates a legacy workspace blob into normalized tables', { timeout: 30000 }, async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-migrate-'));
  const dbPath = join(dataDir, 'workspace.sqlite');
  const legacy = new DatabaseSync(dbPath);
  legacy.exec(`
    CREATE TABLE workspace (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      rev INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      state TEXT NOT NULL
    );
  `);
  const legacyState = {
    version: 1,
    activeCompanyId: 'co1',
    companies: [
      {
        id: 'co1',
        name: 'Migrated Books',
        fyStart: '2026-04-01',
        fyEnd: '2027-03-31',
        yearId: 'year1',
        years: [{ id: 'year1', start: '2026-04-01', end: '2027-03-31', closed: false }],
        ledgers: [{ id: 'led1', name: 'Cash', groupId: 'cash', opening: 0, openingType: 'Dr' }],
        vouchers: [
          {
            id: 'vou1',
            type: 'Payment',
            no: 1,
            date: '2026-04-02',
            total: 50,
            lines: [
              { ledgerId: 'led1', side: 'Cr', amount: 50 },
              { ledgerId: 'led1', side: 'Dr', amount: 50 },
            ],
          },
        ],
      },
    ],
    users: [],
    audit: [],
    currentUserId: null,
  };
  legacy
    .prepare('INSERT INTO workspace (id, rev, updated_at, state) VALUES (1, ?, ?, ?)')
    .run(9, '2026-04-02T00:00:00.000Z', JSON.stringify(legacyState));
  legacy.close();

  const child = spawn(process.execPath, ['serve.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', ZL_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    const base = await waitForServer(child);
    const response = await client(base).request('/api/workspace');
    assert.equal(response.status, 200);
    assert.equal(response.body.rev, 9);
    assert.equal(response.body.state.companies[0].name, 'Migrated Books');
    assert.equal(response.body.state.companies[0].vouchers[0].lines.length, 2);

    const migrated = new DatabaseSync(dbPath);
    assert.equal(migrated.prepare('SELECT COUNT(*) AS count FROM workspace').get().count, 0);
    assert.equal(migrated.prepare('SELECT COUNT(*) AS count FROM companies').get().count, 1);
    assert.equal(migrated.prepare('SELECT COUNT(*) AS count FROM vouchers').get().count, 1);
    assert.equal(migrated.prepare('SELECT COUNT(*) AS count FROM voucher_lines').get().count, 2);
    migrated.close();
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('server API rejects clients outside the configured IP allowlist', { timeout: 30000 }, async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-ips-'));
  const child = spawn(process.execPath, ['serve.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      ZL_DATA_DIR: dataDir,
      ZL_ALLOWED_IPS: '192.0.2.10',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const base = await waitForServer(child);
    assert.equal((await fetch(`${base}/`)).status, 403);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('server API scopes non-owner accounts to assigned companies', { timeout: 30000 }, async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ledgercraft-scope-'));
  const child = spawn(process.execPath, ['serve.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      ZL_AUTH: '1',
      ZL_DATA_DIR: dataDir,
      ZL_OWNER_USER: 'owner',
      ZL_OWNER_NAME: 'Owner',
      ZL_OWNER_PASSWORD: 'correct horse battery',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    const base = await waitForServer(child);
    const owner = client(base);
    await owner.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'correct horse battery' }),
    });
    const company = (id, name) => ({
      id,
      name,
      fyStart: '2026-04-01',
      fyEnd: '2027-03-31',
      yearId: `year_${id}`,
      years: [{ id: `year_${id}`, start: '2026-04-01', end: '2027-03-31', closed: false }],
      ledgers: [{ id: `ledger_${id}`, name: 'Cash', groupId: 'cash', opening: 0, openingType: 'Dr' }],
      vouchers: [],
    });
    const state = {
      version: 1,
      activeCompanyId: 'co_a',
      companies: [company('co_a', 'Alpha Books'), company('co_b', 'Beta Books')],
      users: [],
      audit: [
        { id: 'audit_a', companyId: 'co_a', action: 'company.create', summary: 'Alpha created' },
        { id: 'audit_b', companyId: 'co_b', action: 'company.create', summary: 'Beta created' },
      ],
    };
    const opened = await owner.request('/api/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRev: 0, state }),
    });
    assert.equal(opened.status, 200);

    const unknownScope = await owner.request('/api/auth/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'ghost',
        name: 'Ghost',
        role: 'accountant',
        password: 'ledger pass',
        companyIds: ['missing'],
      }),
    });
    assert.equal(unknownScope.status, 400);

    const created = await owner.request('/api/auth/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'books',
        name: 'Books',
        role: 'accountant',
        password: 'ledger pass',
        companyIds: ['co_a'],
      }),
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.deepEqual(created.body.user.companyIds, ['co_a']);
    const mfa = await owner.request(`/api/auth/users/${created.body.user.id}/mfa`, { method: 'POST' });
    assert.equal(mfa.status, 200, JSON.stringify(mfa.body));
    assert.match(mfa.body.secret, /^[A-Z2-7]+$/);
    assert.match(mfa.body.recoveryCode, /^[A-F0-9]{16}$/);
    assert.match(mfa.body.uri, /^otpauth:\/\/totp\//);
    const requireMfa = await owner.request(`/api/auth/users/${created.body.user.id}/mfa-required`, { method: 'POST' });
    assert.equal(requireMfa.status, 200, JSON.stringify(requireMfa.body));
    assert.equal(requireMfa.body.user.requireMfa, true);
    assert.equal(
      (await owner.request('/api/auth/users')).body.users.find((user) => user.id === created.body.user.id)?.requireMfa,
      true,
    );
    assert.equal(
      (await owner.request(`/api/auth/users/${created.body.user.id}/mfa`, { method: 'DELETE' })).status,
      400,
    );

    const scoped = client(base);
    const missingCode = await scoped.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'books', password: 'ledger pass' }),
    });
    assert.equal(missingCode.status, 401);
    assert.equal(missingCode.body.mfaRequired, true);
    const accepted = await scoped.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'books',
        password: 'ledger pass',
        code: totpCode(mfa.body.secret),
      }),
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    const replay = await client(base).request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'books',
        password: 'ledger pass',
        code: totpCode(mfa.body.secret),
      }),
    });
    assert.equal(replay.status, 401);
    assert.equal(replay.body.mfaRequired, true);
    const visible = await scoped.request('/api/workspace');
    assert.equal(visible.status, 200);
    assert.deepEqual(visible.body.state.companies.map((entry) => entry.id), ['co_a']);
    assert.deepEqual(visible.body.state.audit.map((entry) => entry.id), ['audit_a']);
    assert.deepEqual(visible.body.state.users, []);

    const hiddenInjection = structuredClone(visible.body.state);
    hiddenInjection.companies.push(company('co_b', 'Beta Books'));
    const hiddenResponse = await scoped.request('/api/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRev: visible.body.rev, state: hiddenInjection }),
    });
    assert.equal(hiddenResponse.status, 403);
    assert.match(hiddenResponse.body.error, /access/i);

    const changedActive = structuredClone(visible.body.state);
    changedActive.activeCompanyId = 'co_b';
    changedActive.companies[0].vouchers.push({
      id: 'voucher_a',
      type: 'Payment',
      no: 1,
      date: '2026-04-10',
      total: 10,
      lines: [],
    });
    const saved = await scoped.request('/api/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRev: visible.body.rev, state: changedActive }),
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const scopedAgain = await scoped.request('/api/workspace');
    assert.equal(scopedAgain.body.state.activeCompanyId, 'co_a');

    const ownerView = await owner.request('/api/workspace');
    assert.deepEqual(ownerView.body.state.companies.map((entry) => entry.id), ['co_a', 'co_b']);
    assert.equal(ownerView.body.state.companies[1].name, 'Beta Books');
    assert.equal(ownerView.body.state.companies[0].vouchers[0].id, 'voucher_a');

    const ownerEdit = structuredClone(ownerView.body.state);
    ownerEdit.companies[1].vouchers.push({
      id: 'voucher_b',
      type: 'Receipt',
      no: 1,
      date: '2026-04-11',
      total: 20,
      lines: [],
    });
    assert.equal(
      (
        await owner.request('/api/workspace', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ baseRev: ownerView.body.rev, state: ownerEdit }),
        })
      ).status,
      200,
    );
    const staleState = structuredClone(scopedAgain.body.state);
    staleState.companies[0].vouchers.push({
      id: 'voucher_scoped',
      type: 'Journal',
      no: 1,
      date: '2026-04-12',
      total: 5,
      lines: [],
    });
    const stale = await scoped.request('/api/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRev: scopedAgain.body.rev, state: staleState }),
    });
    assert.equal(stale.status, 200, JSON.stringify(stale.body));
    assert.equal(stale.body.merged, true);
    const mergedOwnerView = await owner.request('/api/workspace');
    assert.equal(mergedOwnerView.body.state.companies[1].vouchers[0].id, 'voucher_b');
    assert.deepEqual(
      mergedOwnerView.body.state.companies[0].vouchers.map((voucher) => voucher.id).sort(),
      ['voucher_a', 'voucher_scoped'],
    );
    assert.equal((await scoped.request('/api/auth/users')).status, 403);

    const users = await owner.request('/api/auth/users');
    const books = users.body.users.find((user) => user.username === 'books');
    assert.deepEqual(books.companyIds, ['co_a']);
    assert.equal(
      (
        await owner.request(`/api/auth/users/${books.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ companyIds: [] }),
        })
      ).status,
      200,
    );
    assert.deepEqual((await scoped.request('/api/workspace')).body.state.companies, []);

    const serverAudit = await owner.request('/api/server-audit');
    assert.equal(serverAudit.status, 200);
    assert.ok(serverAudit.body.rows.some((row) => row.username === 'books'));
    assert.equal(serverAudit.body.chain.ok, true);
    assert.ok(serverAudit.body.chain.checked > 0);
    assert.ok(
      serverAudit.body.events.some(
        (event) => event.action === 'account.create' && event.target === 'books',
      ),
    );
    assert.ok(serverAudit.body.events.some((event) => event.action === 'account.mfa.enable'));
    assert.equal(serverAudit.body.eventChain.ok, true);
    assert.equal((await scoped.request('/api/server-audit')).status, 403);

    assert.equal((await scoped.request('/api/backups')).status, 403);
    const backup = await owner.request('/api/backups', { method: 'POST' });
    assert.equal(backup.status, 200, JSON.stringify(backup.body));
    assert.match(backup.body.backup.name, /^workspace-\d{8}-\d{6}-manual\.sqlite$/);
    assert.ok(
      (await owner.request('/api/server-audit')).body.events.some(
        (event) => event.action === 'backup.create' && event.target === backup.body.backup.name,
      ),
    );
    const backupList = await owner.request('/api/backups');
    assert.equal(backupList.status, 200);
    assert.ok(backupList.body.backups.some((entry) => entry.name === backup.body.backup.name));
    assert.equal(backupList.body.history[0].status, 'ok');
    assert.equal(backupList.body.history[0].reason, 'manual');
    assert.equal(backupList.body.history[0].name, backup.body.backup.name);

    const beforeRestore = await owner.request('/api/workspace');
    const modified = structuredClone(beforeRestore.body.state);
    modified.companies.push(company('co_temp', 'Temporary Books'));
    assert.equal(
      (
        await owner.request('/api/workspace', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ baseRev: beforeRestore.body.rev, state: modified }),
        })
      ).status,
      200,
    );
    const restored = await owner.request(`/api/backups/${backup.body.backup.name}/restore`, { method: 'POST' });
    assert.equal(restored.status, 200, JSON.stringify(restored.body));
    assert.match(restored.body.preRestore.name, /^workspace-\d{8}-\d{6}-prerestore\.sqlite$/);
    const afterRestore = await owner.request('/api/workspace');
    assert.deepEqual(afterRestore.body.state.companies.map((entry) => entry.id), ['co_a', 'co_b']);
    assert.equal((await owner.request('/api/auth/me')).body.user.username, 'owner');

    const logins = await owner.request('/api/auth/logins');
    assert.equal(logins.status, 200);
    assert.ok(logins.body.events.some((entry) => entry.username === 'books' && entry.ok));
    assert.equal((await scoped.request('/api/auth/logins')).status, 403);
    const sessions = await owner.request('/api/auth/sessions');
    assert.equal(sessions.status, 200);
    assert.ok(sessions.body.sessions.some((session) => session.username === 'books' && session.id));
    assert.equal((await scoped.request('/api/auth/sessions')).status, 403);
    assert.equal(
      (
        await scoped.request('/api/auth/password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'new ledger pass' }),
        })
      ).status,
      400,
    );
    const missingMfa = await scoped.request('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'ledger pass', newPassword: 'new ledger pass' }),
    });
    assert.equal(missingMfa.status, 400);
    assert.equal(missingMfa.body.code, 'mfa');
    assert.equal(
      (
        await scoped.request('/api/auth/password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            currentPassword: 'ledger pass',
            newPassword: 'new ledger pass',
            code: totpCode(mfa.body.secret, Date.now() + 30_000),
          }),
        })
      ).status,
      200,
    );
    assert.equal((await scoped.request('/api/auth/me')).body.user.username, 'books');
    assert.equal((await owner.request(`/api/auth/users/${books.id}/sessions`, { method: 'DELETE' })).status, 200);
    assert.equal((await scoped.request('/api/workspace')).status, 401);
    assert.equal((await owner.request('/api/workspace', { method: 'DELETE' })).status, 200);
    const finalAudit = await owner.request('/api/server-audit');
    assert.ok(finalAudit.body.events.some((event) => event.action === 'workspace.clear'));
    assert.ok(finalAudit.body.events.some((event) => event.action === 'workspace.restore'));
    assert.equal(finalAudit.body.eventChain.ok, true);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('server API authenticates, shares one workspace and enforces roles', { timeout: 30000 }, async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-auth-'));
  const child = spawn(process.execPath, ['serve.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '0',
      ZL_AUTH: '1',
      ZL_DATA_DIR: dataDir,
      ZL_OWNER_USER: 'owner',
      ZL_OWNER_NAME: 'Test Owner',
      ZL_OWNER_PASSWORD: 'correct horse battery',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    const base = await waitForServer(child);
    const anonymous = client(base);
    assert.equal((await anonymous.request('/api/auth/me')).body.required, true);
    assert.equal((await anonymous.request('/api/auth/me')).body.user, null);
    assert.equal((await anonymous.request('/api/workspace')).status, 401);
    assert.equal((await anonymous.request('/data/workspace.sqlite')).status, 403);
    assert.equal(
      (
        await anonymous.request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'owner', password: 'wrong' }),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await anonymous.request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: 'null',
        })
      ).status,
      400,
    );

    const owner = client(base);
    const login = await owner.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'correct horse battery' }),
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, 'owner');
    assert.equal((await owner.request('/api/auth/me')).body.user.username, 'owner');

    for (const account of [
      { username: 'books', name: 'Books', role: 'accountant', password: 'ledger pass' },
      { username: 'reader', name: 'Reader', role: 'viewer', password: 'reader pass' },
    ]) {
      assert.equal(
        (
          await owner.request('/api/auth/users', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(account),
          })
        ).status,
        200,
      );
    }
    assert.equal((await owner.request('/api/auth/users')).body.users.length, 3);

    const auditEntry = {
      id: 'audit_1',
      at: '2026-11-19T00:00:00.000Z',
      action: 'company.create',
      summary: 'Company created',
      companyId: 'company_1',
      companyName: 'Test Co',
      actorId: 'local-owner',
      actorName: 'Local owner',
      actorRole: 'owner',
    };
    const baseState = {
      version: 1,
      activeCompanyId: 'company_1',
      companies: [
        {
          id: 'company_1',
          name: 'Test Co',
          fyStart: '2026-04-01',
          fyEnd: '2027-03-31',
          yearId: 'year_1',
          years: [{ id: 'year_1', start: '2026-04-01', end: '2027-03-31', closed: false }],
          ledgers: [],
          vouchers: [],
        },
      ],
      users: [],
      audit: [auditEntry],
    };
    const opened = await owner.request('/api/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRev: 0, state: baseState }),
    });
    assert.equal(opened.status, 200);
    assert.equal(opened.body.rev, 1);

    const accountant = client(base);
    await accountant.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'books', password: 'ledger pass' }),
    });
    assert.equal(
      (
        await accountant.request('/api/workspace', {
          method: 'PUT',
          headers: { 'content-type': 'application/json', origin: 'http://evil.test' },
          body: JSON.stringify({ baseRev: 1, state: baseState }),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await accountant.request('/api/workspace', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ baseRev: 1, state: baseState }),
        })
      ).status,
      200,
    );
    const dangerous = {
      ...baseState,
      users: [{ id: 'forged', name: 'Forged owner', role: 'owner' }],
    };
    const blocked = await accountant.request('/api/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRev: 2, state: dangerous }),
    });
    assert.equal(blocked.status, 403);
    assert.match(blocked.body.error, /owner/i);

    const changedYear = {
      ...baseState,
      companies: [{ ...baseState.companies[0], fyStart: '2026-05-01' }],
    };
    assert.equal(
      (
        await accountant.request('/api/workspace', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ baseRev: 2, state: changedYear }),
        })
      ).status,
      403,
    );

    for (const tamperedAudit of [[], [{ ...auditEntry, summary: 'Rewritten history' }]]) {
      assert.equal(
        (
          await accountant.request('/api/workspace', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ baseRev: 2, state: { ...baseState, audit: tamperedAudit } }),
          })
        ).status,
        403,
      );
    }

    const viewer = client(base);
    await viewer.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'reader', password: 'reader pass' }),
    });
    assert.equal((await viewer.request('/api/workspace')).status, 200);
    assert.equal(
      (
        await viewer.request('/api/workspace', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ baseRev: 2, state: baseState }),
        })
      ).status,
      403,
    );
    assert.equal((await viewer.request('/api/auth/users')).status, 403);

    const secondAccountant = client(base);
    await secondAccountant.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'books', password: 'ledger pass' }),
    });
    const beforeMerge = await accountant.request('/api/workspace');
    const stateA = structuredClone(beforeMerge.body.state);
    const stateB = structuredClone(beforeMerge.body.state);
    stateA.companies[0].vouchers.push({
      id: 'voucher_a',
      type: 'Payment',
      no: 1,
      date: '2026-04-10',
      total: 10,
      lines: [],
    });
    stateB.companies[0].vouchers.push({
      id: 'voucher_b',
      type: 'Receipt',
      no: 1,
      date: '2026-04-11',
      total: 20,
      lines: [],
    });
    assert.equal(
      (
        await accountant.request('/api/workspace', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ baseRev: beforeMerge.body.rev, state: stateA }),
        })
      ).status,
      200,
    );
    const merged = await secondAccountant.request('/api/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRev: beforeMerge.body.rev, state: stateB }),
    });
    assert.equal(merged.status, 200);
    assert.equal(merged.body.merged, true);
    assert.deepEqual(
      merged.body.state.companies[0].vouchers.map((voucher) => voucher.id).sort(),
      ['voucher_a', 'voucher_b'],
    );

    assert.equal((await owner.request('/api/auth/logout', { method: 'POST' })).status, 200);
    assert.equal((await owner.request('/api/auth/me')).body.user, null);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('server leases a voucher and rejects an unleased overlapping save', { timeout: 30000 }, async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-lease-'));
  const child = spawn(process.execPath, ['serve.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', ZL_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const base = await waitForServer(child);
    const api = client(base);
    const state = {
      version: 1,
      activeCompanyId: 'co1',
      companies: [
        {
          id: 'co1',
          name: 'Lease Test',
          fyStart: '2026-04-01',
          fyEnd: '2027-03-31',
          yearId: 'fy1',
          years: [{ id: 'fy1', start: '2026-04-01', end: '2027-03-31', closed: false }],
          groups: [{ id: 'grp1', name: 'Cash', parentId: null }],
          ledgers: [{ id: 'led1', name: 'Cash', groupId: 'grp1' }],
          vouchers: [
            {
              id: 'vou1',
              type: 'Payment',
              no: 1,
              date: '2026-04-02',
              total: 10,
              narration: 'Before',
              lines: [
                { ledgerId: 'led1', side: 'Dr', amount: 10 },
                { ledgerId: 'led1', side: 'Cr', amount: 10 },
              ],
            },
          ],
        },
      ],
      users: [],
      audit: [],
      currentUserId: null,
    };
    const created = await api.request('/api/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRev: 0, state }),
    });
    assert.equal(created.status, 200);
    const opened = await api.request('/api/workspace');
    assert.equal(opened.body.rev, 1);

    const lease = await api.request('/api/workspace/leases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ companyId: 'co1', recordType: 'voucher', recordId: 'vou1' }),
    });
    assert.equal(lease.status, 200);
    assert.ok(lease.body.token);
    assert.equal(lease.body.lease.username, 'local');

    const changed = structuredClone(opened.body.state);
    changed.companies[0].vouchers[0].narration = 'After';
    const blocked = await api.request('/api/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRev: 1, state: changed }),
    });
    assert.equal(blocked.status, 423);
    assert.equal(blocked.body.code, 'locked');
    assert.equal(blocked.body.holder.username, 'local');
    assert.equal((await api.request('/api/workspace')).body.rev, 1);

    const saved = await api.request('/api/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRev: 1, state: changed, leaseToken: lease.body.token }),
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.rev, 2);

    const released = await api.request('/api/workspace/leases', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        companyId: 'co1',
        recordType: 'voucher',
        recordId: 'vou1',
        token: lease.body.token,
      }),
    });
    assert.equal(released.status, 200);
    assert.equal(released.body.released, true);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('server survives a malformed Host header', { timeout: 30000 }, async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-host-'));
  const child = spawn(process.execPath, ['serve.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', ZL_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const base = await waitForServer(child);
    const response = await rawRequest(
      base,
      'GET / HTTP/1.1\r\nHost: [\r\nConnection: close\r\n\r\n',
    );
    assert.ok(response === '' || /^HTTP\/1\.1 400 /.test(response), response);
    assert.equal((await fetch(`${base}/api/workspace`)).status, 200);
    assert.equal(child.exitCode, null);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('server sends security headers on static, JSON and error responses', { timeout: 30000 }, async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-headers-'));
  const child = spawn(process.execPath, ['serve.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', ZL_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const base = await waitForServer(child);
    for (const path of ['/', '/api/auth/me', '/does-not-exist']) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
      assert.equal(response.headers.get('x-frame-options'), 'DENY', path);
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer', path);
      assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'self'/, path);
      assert.match(response.headers.get('permissions-policy') ?? '', /camera=\(\)/, path);
    }
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

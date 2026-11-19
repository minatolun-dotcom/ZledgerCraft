import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
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

test('read-only API tokens authenticate, scope to books and revoke', { timeout: 30000 }, async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-api-'));
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
    assert.equal(
      (
        await owner.request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'owner', password: 'correct horse battery' }),
        })
      ).status,
      200,
    );

    const state = {
      version: 1,
      activeCompanyId: 'co1',
      companies: [
        {
          id: 'co1',
          name: 'Read Only Books',
          fyStart: '2026-04-01',
          fyEnd: '2027-03-31',
          yearId: 'year1',
          years: [{ id: 'year1', start: '2026-04-01', end: '2027-03-31', closed: false }],
          groups: [
            { id: 'cash', name: 'Cash & Bank', parentId: null },
            { id: 'sales', name: 'Sales Accounts', parentId: null },
          ],
          ledgers: [
            { id: 'cash', name: 'Cash', groupId: 'cash', opening: 100, openingType: 'Dr' },
            { id: 'sales', name: 'Sales', groupId: 'sales', opening: 0, openingType: 'Cr' },
          ],
          vouchers: [
            {
              id: 'v1',
              no: 1,
              type: 'Receipt',
              date: '2026-04-02',
              narration: 'Opening receipt',
              total: 100,
              lines: [
                { ledgerId: 'cash', side: 'Dr', amount: 100 },
                { ledgerId: 'sales', side: 'Cr', amount: 100 },
              ],
            },
          ],
        },
        {
          id: 'co2',
          name: 'Other Books',
          fyStart: '2026-04-01',
          fyEnd: '2027-03-31',
          yearId: 'year2',
          years: [{ id: 'year2', start: '2026-04-01', end: '2027-03-31', closed: false }],
          groups: [{ id: 'cash2', name: 'Cash & Bank', parentId: null }],
          ledgers: [{ id: 'cash2', name: 'Cash', groupId: 'cash2', opening: 0, openingType: 'Dr' }],
          vouchers: [],
        },
      ],
      users: [],
      audit: [],
    };
    assert.equal(
      (
        await owner.request('/api/workspace', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ baseRev: 0, state }),
        })
      ).status,
      200,
    );

    assert.equal((await owner.request('/api/auth/api-tokens')).body.tokens.length, 0);
    const denied = await fetch(`${base}/api/v1/companies`, {
      headers: { authorization: 'Bearer nope' },
    });
    assert.equal(denied.status, 401);
    assert.equal((await denied.json()).ok, false);

    const openapi = await fetch(`${base}/api/v1/openapi.json`);
    assert.equal(openapi.status, 200);
    assert.equal((await openapi.json()).openapi, '3.0.3');

    const created = await owner.request('/api/auth/api-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Reporting job', scopes: ['books:read'] }),
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.match(created.body.token, /^zlp_api_[a-f0-9]+_/);
    assert.equal(created.body.apiToken.name, 'Reporting job');
    assert.deepEqual(created.body.apiToken.scopes, ['books:read']);
    const token = created.body.token;

    const listed = await owner.request('/api/auth/api-tokens');
    assert.equal(listed.body.tokens.length, 1);
    assert.equal(listed.body.tokens[0].token, undefined);
    assert.match(listed.body.tokens[0].prefix, /^zlp_api_/);

    const inspect = new DatabaseSync(join(dataDir, 'workspace.sqlite'), { readOnly: true });
    try {
      const row = inspect.prepare('SELECT token_hash, scopes FROM auth_api_tokens').get();
      assert.match(row.token_hash, /^[a-f0-9]{64}$/);
      assert.notEqual(row.token_hash, token);
      assert.deepEqual(JSON.parse(row.scopes), ['books:read']);
    } finally {
      inspect.close();
    }

    const authHeaders = { authorization: `Bearer ${token}` };
    const companies = await fetch(`${base}/api/v1/companies`, { headers: authHeaders });
    assert.equal(companies.status, 200);
    assert.equal(companies.headers.get('x-ratelimit-limit'), '120');
    assert.match(companies.headers.get('x-ratelimit-remaining'), /^\d+$/);
    const companiesBody = await companies.json();
    assert.equal(companiesBody.data.companies.length, 2);
    assert.equal(companiesBody.data.companies[0].name, 'Read Only Books');
    assert.equal(companiesBody.data.companies[0].counts.vouchers, 1);

    const trial = await fetch(`${base}/api/v1/companies/co1/trial-balance?asOn=2026-04-30`, {
      headers: authHeaders,
    });
    const trialBody = await trial.json();
    assert.equal(trial.status, 200, JSON.stringify(trialBody));
    assert.equal(trialBody.data.balanced, true);
    assert.ok(trialBody.data.rows.some((row) => row.name === 'Cash' && row.debit >= 100));

    const parties = await fetch(`${base}/api/v1/companies/co1/parties?side=payable`, {
      headers: authHeaders,
    });
    assert.equal(parties.status, 200);
    assert.equal((await parties.json()).data.side, 'payable');

    const vouchers = await fetch(`${base}/api/v1/companies/co1/vouchers?type=receipt&limit=10`, {
      headers: authHeaders,
    });
    assert.equal(vouchers.status, 200);
    const voucherBody = await vouchers.json();
    assert.equal(voucherBody.data.total, 1);
    assert.equal(voucherBody.data.vouchers[0].id, 'v1');
    assert.equal(voucherBody.data.vouchers[0].lines.length, 2);

    assert.equal(
      (
        await fetch(`${base}/api/v1/companies/co1/vouchers?from=not-a-date`, {
          headers: authHeaders,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(`${base}/api/v1/companies/missing`, {
          headers: authHeaders,
        })
      ).status,
      404,
    );

    const unknownScope = await owner.request('/api/auth/api-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bad scope', companyIds: ['missing'] }),
    });
    assert.equal(unknownScope.status, 400);
    const emptyScope = await owner.request('/api/auth/api-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Empty scope', companyIds: [] }),
    });
    assert.equal(emptyScope.status, 400);
    const scopedToken = await owner.request('/api/auth/api-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Scoped job', companyIds: ['co1'] }),
    });
    assert.equal(scopedToken.status, 200, JSON.stringify(scopedToken.body));
    assert.deepEqual(scopedToken.body.apiToken.companyIds, ['co1']);
    const scopedHeaders = { authorization: `Bearer ${scopedToken.body.token}` };
    const scopedCompanies = await fetch(`${base}/api/v1/companies`, { headers: scopedHeaders });
    assert.equal(scopedCompanies.status, 200);
    assert.deepEqual(
      (await scopedCompanies.json()).data.companies.map((company) => company.id),
      ['co1'],
    );
    assert.equal((await fetch(`${base}/api/v1/companies/co2`, { headers: scopedHeaders })).status, 404);
    assert.equal(
      (await fetch(`${base}/api/v1/companies/co1`, { headers: scopedHeaders })).status,
      200,
    );

    const rateToken = await owner.request('/api/auth/api-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Rate test' }),
    });
    assert.equal(rateToken.status, 200, JSON.stringify(rateToken.body));
    const rateHeaders = { authorization: `Bearer ${rateToken.body.token}` };
    for (let attempt = 0; attempt < 120; attempt += 1) {
      assert.equal((await fetch(`${base}/api/v1/companies`, { headers: rateHeaders })).status, 200);
    }
    const limited = await fetch(`${base}/api/v1/companies`, { headers: rateHeaders });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('x-ratelimit-remaining'), '0');
    assert.ok(Number(limited.headers.get('retry-after')) > 0);

    assert.equal((await owner.request(`/api/auth/api-tokens/${created.body.apiToken.id}`, { method: 'DELETE' })).status, 200);
    const revoked = await fetch(`${base}/api/v1/companies`, { headers: authHeaders });
    assert.equal(revoked.status, 401);
    const events = await owner.request('/api/server-audit');
    assert.ok(events.body.events.some((event) => event.action === 'apiToken.create'));
    assert.ok(events.body.events.some((event) => event.action === 'apiToken.revoke'));
    assert.equal(events.body.eventChain.ok, true);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

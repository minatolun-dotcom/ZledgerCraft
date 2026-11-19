import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('..', import.meta.url));

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
        // A download or empty response has no JSON body.
      }
      return { status: response.status, body, headers: Object.fromEntries(response.headers.entries()) };
    },
  };
}

async function mockHttp(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    server,
    port: server.address().port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function withServer(env, run) {
  const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-cloud-'));
  const child = spawn(process.execPath, ['serve.mjs'], {
    cwd: appRoot,
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', ZL_DATA_DIR: dataDir, ...env },
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

test('server uploads a verified manual backup to R2', { timeout: 30000 }, async () => {
  const uploads = [];
  const r2 = await mockHttp((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      uploads.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        body: Buffer.concat(chunks),
      });
      response.writeHead(200, { etag: '"backup-etag"' });
      response.end();
    });
  });
  try {
    await withServer(
      {
        ZL_AUTH: '1',
        ZL_OWNER_PASSWORD: 'correct horse battery',
        R2_ACCOUNT_ID: 'account',
        R2_ACCESS_KEY_ID: 'AKIDEXAMPLE',
        R2_SECRET_ACCESS_KEY: 'secret-example',
        R2_BUCKET: 'books-backups',
        R2_ENDPOINT: `http://127.0.0.1:${r2.port}`,
      },
      async ({ base }) => {
        const owner = client(base);
        const login = await owner.request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'owner', password: 'correct horse battery' }),
        });
        assert.equal(login.status, 200, JSON.stringify(login.body));
        const created = await owner.request('/api/backups', { method: 'POST' });
        assert.equal(created.status, 200, JSON.stringify(created.body));
        assert.equal(created.body.backup.offsite.ok, true);
        assert.equal(created.body.backup.offsite.bucket, 'books-backups');
        assert.match(created.body.backup.offsite.key, /^zledgercraft\/workspace\/\d{4}\/\d{2}\//);
        assert.equal(uploads.length, 1);
        assert.equal(uploads[0].method, 'PUT');
        assert.match(uploads[0].url, /^\/books-backups\/zledgercraft\/workspace\//);
        assert.match(uploads[0].authorization, /^AWS4-HMAC-SHA256 /);
        assert.equal(uploads[0].body.subarray(0, 15).toString(), 'SQLite format 3');
      },
    );
  } finally {
    await r2.close();
  }
});

test('server keeps a local backup and sends a Resend alert when R2 fails', { timeout: 30000 }, async () => {
  const r2 = await mockHttp((request, response) => {
    request.resume();
    response.writeHead(503);
    response.end('R2 unavailable');
  });
  const emails = [];
  const resend = await mockHttp((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      emails.push(JSON.parse(Buffer.concat(chunks).toString()));
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: 'email_1' }));
    });
  });
  try {
    await withServer(
      {
        ZL_AUTH: '1',
        ZL_OWNER_PASSWORD: 'correct horse battery',
        R2_ACCOUNT_ID: 'account',
        R2_ACCESS_KEY_ID: 'AKIDEXAMPLE',
        R2_SECRET_ACCESS_KEY: 'secret-example',
        R2_BUCKET: 'books-backups',
        R2_ENDPOINT: `http://127.0.0.1:${r2.port}`,
        RESEND_API_KEY: 're_test',
        RESEND_API_URL: `http://127.0.0.1:${resend.port}/emails`,
        RESEND_FROM: 'Books <books@example.com>',
        ZL_PUBLIC_URL: 'https://books.example.com',
        ZL_ALERT_EMAIL: 'ops@example.com',
      },
      async ({ base }) => {
        const owner = client(base);
        await owner.request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'owner', password: 'correct horse battery' }),
        });
        const created = await owner.request('/api/backups', { method: 'POST' });
        assert.equal(created.status, 200, JSON.stringify(created.body));
        assert.equal(created.body.backup.offsite.ok, false);
        assert.match(created.body.backup.offsite.error, /R2 upload failed \(503\)/);
        assert.equal(emails.length, 1);
        assert.equal(emails[0].to[0], 'ops@example.com');
        assert.match(emails[0].subject, /backup upload failed/);
      },
    );
  } finally {
    await r2.close();
    await resend.close();
  }
});

test('server emails a single-use password-reset link and revokes sessions', { timeout: 30000 }, async () => {
  const emails = [];
  const resend = await mockHttp((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      emails.push(JSON.parse(Buffer.concat(chunks).toString()));
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: `email_${emails.length}` }));
    });
  });
  try {
    await withServer(
      {
        ZL_AUTH: '1',
        ZL_OWNER_PASSWORD: 'correct horse battery',
        RESEND_API_KEY: 're_test',
        RESEND_API_URL: `http://127.0.0.1:${resend.port}/emails`,
        RESEND_FROM: 'Books <books@example.com>',
        ZL_PUBLIC_URL: 'https://books.example.com',
      },
      async ({ base }) => {
        const owner = client(base);
        const login = await owner.request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'owner', password: 'correct horse battery' }),
        });
        assert.equal(login.status, 200, JSON.stringify(login.body));
        const account = await owner.request('/api/auth/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'books',
            name: 'Books',
            role: 'accountant',
            password: 'ledger pass',
            email: 'books@example.com',
          }),
        });
        assert.equal(account.status, 200, JSON.stringify(account.body));
        assert.equal(account.body.user.email, 'books@example.com');

        const books = client(base);
        const firstLogin = await books.request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'books', password: 'ledger pass' }),
        });
        assert.equal(firstLogin.status, 200, JSON.stringify(firstLogin.body));

        const anonymous = client(base);
        const forgot = await anonymous.request('/api/auth/forgot', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ identifier: 'books@example.com' }),
        });
        assert.equal(forgot.status, 200, JSON.stringify(forgot.body));
        assert.match(forgot.body.message, /If that account has an email address/);
        assert.equal(emails.length, 1);
        assert.equal(emails[0].to[0], 'books@example.com');
        const link = new URL(emails[0].text.match(/https:\/\/books\.example\.com\/\?reset=[a-f0-9]{64}/)[0]);
        const token = link.searchParams.get('reset');

        const unknown = await anonymous.request('/api/auth/forgot', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ identifier: 'nobody@example.com' }),
        });
        assert.equal(unknown.status, 200);
        assert.equal(emails.length, 1);

        const reset = await anonymous.request('/api/auth/reset', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, password: 'new ledger pass' }),
        });
        assert.equal(reset.status, 200, JSON.stringify(reset.body));

        const oldSession = await books.request('/api/auth/me');
        assert.equal(oldSession.status, 200);
        assert.equal(oldSession.body.user, null);
        const oldPassword = await client(base).request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'books', password: 'ledger pass' }),
        });
        assert.equal(oldPassword.status, 401);
        const newPassword = await client(base).request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'books', password: 'new ledger pass' }),
        });
        assert.equal(newPassword.status, 200, JSON.stringify(newPassword.body));

        const reuse = await anonymous.request('/api/auth/reset', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, password: 'third ledger pass' }),
        });
        assert.equal(reuse.status, 400);
      },
    );
  } finally {
    await resend.close();
  }
});

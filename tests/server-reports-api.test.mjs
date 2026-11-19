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
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      return { status: response.status, body, headers: Object.fromEntries(response.headers.entries()) };
    },
  };
}

async function mockHttp(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: server.address().port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function withServer(env, run) {
  const dataDir = mkdtempSync(join(tmpdir(), 'zledgercraft-reports-'));
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

const state = {
  version: 1,
  activeCompanyId: 'co_reports',
  companies: [
    {
      id: 'co_reports',
      name: 'Report Books',
      fyStart: '2026-04-01',
      fyEnd: '2027-03-31',
      groups: [
        { id: 'currentAssets', key: 'currentAssets', name: 'Current Assets', parentId: null },
        { id: 'cash', key: 'cash', name: 'Cash-in-Hand', parentId: 'currentAssets' },
        { id: 'sales', key: 'sales', name: 'Sales Accounts', parentId: null },
      ],
      ledgers: [
        { id: 'cash', name: 'Cash', groupId: 'cash', opening: 0, openingType: 'Dr' },
        { id: 'sales', name: 'Sales', groupId: 'sales', opening: 0, openingType: 'Cr' },
      ],
      vouchers: [
        {
          id: 'v1',
          date: '2026-11-19',
          type: 'Sales',
          total: 1180,
          lines: [
            { ledgerId: 'cash', side: 'Dr', amount: 1180 },
            { ledgerId: 'sales', side: 'Cr', amount: 1180 },
          ],
        },
      ],
    },
  ],
  users: [],
  audit: [],
  currentUserId: null,
};

test('owner can configure, preview and send a signed daily report', { timeout: 30000 }, async () => {
  const emails = [];
  let failNext = false;
  const resend = await mockHttp((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const payload = JSON.parse(Buffer.concat(chunks).toString());
      if (failNext) {
        failNext = false;
        response.writeHead(500, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: 'simulated Resend outage' }));
        return;
      }
      emails.push(payload);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: 'email_report_1' }));
    });
  });
  try {
    await withServer(
      {
        ZL_AUTH: '1',
        ZL_OWNER_PASSWORD: 'correct horse battery',
        ZL_PUBLIC_URL: 'https://books.example.com',
        ZL_REPORT_SECRET: 'report-test-secret',
        ZL_SCHEDULER_SECRET: 'scheduler-test-secret',
        ZL_ALERT_EMAIL: 'ops@example.com',
        RESEND_API_KEY: 're_test',
        RESEND_API_URL: `http://127.0.0.1:${resend.port}/emails`,
        RESEND_FROM: 'Books <books@example.com>',
      },
      async ({ base }) => {
        const owner = client(base);
        const login = await owner.request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'owner', password: 'correct horse battery' }),
        });
        assert.equal(login.status, 200, JSON.stringify(login.body));

        const opened = await owner.request('/api/workspace');
        assert.equal(opened.status, 200, JSON.stringify(opened.body));
        const saved = await owner.request('/api/workspace', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ baseRev: opened.body.rev, state }),
        });
        assert.equal(saved.status, 200, JSON.stringify(saved.body));

        const initial = await owner.request('/api/reports/settings');
        assert.equal(initial.status, 200, JSON.stringify(initial.body));
        assert.equal(initial.body.settings.enabled, false);
        assert.equal(initial.body.settings.lastError, '');
        assert.equal(initial.body.emailConfigured, true);
        assert.equal(initial.body.secretConfigured, true);

        const configured = await owner.request('/api/reports/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled: true, recipients: 'owner@example.com' }),
        });
        assert.equal(configured.status, 200, JSON.stringify(configured.body));
        assert.equal(configured.body.settings.enabled, true);

        failNext = true;
        const failedSchedule = await fetch(`${base}/api/internal/scheduler`, {
          method: 'POST',
          headers: { authorization: 'Bearer scheduler-test-secret' },
        });
        assert.equal(failedSchedule.status, 200);
        const failedScheduleBody = await failedSchedule.json();
        assert.match(failedScheduleBody.reportError, /simulated Resend outage/);
        assert.ok(failedScheduleBody.backup?.name);
        assert.equal(emails.length, 1);
        assert.deepEqual(emails[0].to, ['ops@example.com']);
        assert.equal(emails[0].subject, 'ZledgerCraft scheduled report failed');
        assert.match(emails[0].text, /simulated Resend outage/);
        assert.equal(emails[0].attachments, undefined);
        const afterScheduleFailure = await owner.request('/api/reports/settings');
        assert.match(afterScheduleFailure.body.settings.lastError, /simulated Resend outage/);

        const preview = await owner.request('/api/reports/preview', { method: 'POST' });
        assert.equal(preview.status, 200, JSON.stringify(preview.body));
        const path = new URL(preview.body.url).pathname + new URL(preview.body.url).search;
        const reportResponse = await fetch(`${base}${path}`);
        assert.equal(reportResponse.status, 200);
        const html = await reportResponse.text();
        assert.match(html, /Report Books/);
        assert.match(html, /Sales this month/);

        const sent = await owner.request('/api/reports/send', { method: 'POST' });
        assert.equal(sent.status, 200, JSON.stringify(sent.body));
        assert.equal(emails.length, 2);
        assert.deepEqual(emails[1].to, ['owner@example.com']);
        assert.match(emails[1].subject, /ZledgerCraft daily summary/);
        assert.match(emails[1].text, /Report Books/);
        assert.match(emails[1].text, /api\/reports\/daily\?token=/);
        assert.match(emails[1].text, /branded PDF summary is attached/);
        assert.equal(emails[1].attachments.length, 1);
        assert.match(emails[1].attachments[0].filename, /^zledgercraft-daily-\d{4}-\d{2}-\d{2}\.pdf$/);
        assert.equal(emails[1].attachments[0].content_type, 'application/pdf');
        assert.match(Buffer.from(emails[1].attachments[0].content, 'base64').toString('latin1'), /^%PDF-1\.4/);
        const afterSend = await owner.request('/api/reports/settings');
        assert.ok(afterSend.body.settings.lastAttemptAt);
        assert.equal(afterSend.body.settings.lastError, '');

        const unauthorized = await fetch(`${base}/api/internal/scheduler`, { method: 'POST' });
        assert.equal(unauthorized.status, 401);
        const manuallyScheduled = await fetch(`${base}/api/internal/scheduler`, {
          method: 'POST',
          headers: { authorization: 'Bearer scheduler-test-secret' },
        });
        assert.equal(manuallyScheduled.status, 200);
        const manuallyScheduledBody = await manuallyScheduled.json();
        assert.equal(manuallyScheduledBody.report, 'already-sent');
        const scheduled = await fetch(`${base}/api/internal/scheduler`, {
          method: 'POST',
          headers: { 'x-neon-trigger-invocation-id': 'test-invocation' },
        });
        assert.equal(scheduled.status, 200);
        const scheduledBody = await scheduled.json();
        assert.equal(scheduledBody.report, 'already-sent');

        failNext = true;
        const failed = await owner.request('/api/reports/send', { method: 'POST' });
        assert.equal(failed.status, 503, JSON.stringify(failed.body));
        const afterFailure = await owner.request('/api/reports/settings');
        assert.match(afterFailure.body.settings.lastError, /simulated Resend outage/);
        assert.ok(afterFailure.body.settings.lastAttemptAt);
      },
    );
  } finally {
    await resend.close();
  }
});

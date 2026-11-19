import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  backupObjectKey,
  r2Configuration,
  signedR2Request,
  uploadBackup,
} from '../server-r2.js';
import {
  emailConfiguration,
  sendBackupFailureEmail,
  sendEmail,
  sendPasswordResetEmail,
} from '../server-email.js';

const r2 = {
  accountId: 'account',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'secret-example',
  bucket: 'books-backups',
  prefix: 'zledgercraft',
  endpoint: 'https://account.r2.cloudflarestorage.com',
};

test('R2 configuration is optional and uses path-style bucket URLs', () => {
  assert.equal(r2Configuration({}), null);
  assert.equal(
    r2Configuration({
      R2_ACCOUNT_ID: 'account',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'bucket',
    }).endpoint,
    'https://account.r2.cloudflarestorage.com',
  );
  assert.equal(
    backupObjectKey('workspace-1.sqlite', 'prefix', new Date('2026-11-19T12:00:00Z')),
    'prefix/workspace/2026/11/workspace-1.sqlite',
  );
});

test('R2 signs a PUT with the payload hash and scoped credentials', () => {
  const body = Buffer.from('sqlite backup bytes');
  const request = signedR2Request({
    config: r2,
    key: 'zledgercraft/workspace/2026/11/backup.sqlite',
    body,
    now: new Date('2026-11-19T12:34:56.000Z'),
  });
  assert.equal(
    request.url.toString(),
    'https://account.r2.cloudflarestorage.com/books-backups/zledgercraft/workspace/2026/11/backup.sqlite',
  );
  assert.equal(request.headers['x-amz-date'], '20261119T123456Z');
  assert.equal(
    request.headers['x-amz-content-sha256'],
    createHash('sha256').update(body).digest('hex'),
  );
  assert.match(
    request.headers.authorization,
    /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20261119\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[a-f0-9]{64}$/,
  );
  const changed = signedR2Request({
    config: r2,
    key: 'zledgercraft/workspace/2026/11/backup.sqlite',
    body: Buffer.from('different bytes'),
    now: new Date('2026-11-19T12:34:56.000Z'),
  });
  assert.notEqual(changed.headers.authorization, request.headers.authorization);
});

test('R2 upload reads the verified snapshot and reports the stored object', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'zledgercraft-r2-'));
  const path = join(dir, 'workspace.sqlite');
  writeFileSync(path, 'snapshot');
  let captured;
  try {
    const result = await uploadBackup({
      config: r2,
      path,
      name: 'workspace-1.sqlite',
      key: 'zledgercraft/workspace/2026/11/workspace-1.sqlite',
      fetchImpl: async (url, options) => {
        captured = { url: url.toString(), options };
        return new Response('', { status: 200, headers: { etag: '"abc"' } });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.key, 'zledgercraft/workspace/2026/11/workspace-1.sqlite');
    assert.equal(captured.options.method, 'PUT');
    assert.equal(captured.options.body.toString(), 'snapshot');
    assert.match(captured.options.headers.authorization, /^AWS4-HMAC-SHA256 /);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('R2 upload surfaces an HTTP failure without pretending the backup succeeded', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'zledgercraft-r2-fail-'));
  const path = join(dir, 'workspace.sqlite');
  writeFileSync(path, 'snapshot');
  try {
    await assert.rejects(
      uploadBackup({
        config: r2,
        path,
        name: 'workspace-1.sqlite',
        fetchImpl: async () => new Response('bucket unavailable', { status: 503 }),
      }),
      /R2 upload failed \(503\): bucket unavailable/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('email configuration requires a complete verified sender and public URL', () => {
  assert.equal(emailConfiguration({}), null);
  assert.equal(
    emailConfiguration({
      RESEND_API_KEY: 're_test',
      RESEND_FROM: 'Books <books@example.com>',
      ZL_PUBLIC_URL: 'not-a-url',
    }),
    null,
  );
  const config = emailConfiguration({
    RESEND_API_KEY: 're_test',
    RESEND_FROM: 'Books <books@example.com>',
    ZL_PUBLIC_URL: 'https://books.example.com/',
  });
  assert.equal(config.publicUrl, 'https://books.example.com');
  assert.equal(config.endpoint, 'https://api.resend.com/emails');
});

test('Resend sends reset and backup-failure messages', async () => {
  const config = emailConfiguration({
    RESEND_API_KEY: 're_test',
    RESEND_FROM: 'Books <books@example.com>',
    ZL_PUBLIC_URL: 'https://books.example.com',
  });
  const sent = [];
  const fetchImpl = async (url, options) => {
    sent.push({ url, payload: JSON.parse(options.body) });
    return Response.json({ id: 'email_1' });
  };
  const reset = await sendPasswordResetEmail(
    {
      to: 'owner@example.com',
      username: 'owner',
      resetLink: 'https://books.example.com/?reset=abc',
    },
    config,
    { fetchImpl },
  );
  assert.equal(reset.id, 'email_1');
  assert.equal(sent[0].url, 'https://api.resend.com/emails');
  assert.equal(sent[0].payload.to[0], 'owner@example.com');
  assert.match(sent[0].payload.subject, /Reset your ZledgerCraft password/);
  assert.match(sent[0].payload.text, /password reset was requested/);
  assert.match(sent[0].payload.html, /reset=abc/);

  await sendBackupFailureEmail(
    { to: 'ops@example.com', backupName: 'workspace-1.sqlite', error: 'timeout' },
    config,
    { fetchImpl },
  );
  assert.equal(sent[1].payload.to[0], 'ops@example.com');
  assert.match(sent[1].payload.subject, /backup upload failed/);
  assert.match(sent[1].payload.text, /timeout/);
});

test('Resend errors are reported and missing configuration is rejected', async () => {
  const config = emailConfiguration({
    RESEND_API_KEY: 're_test',
    RESEND_FROM: 'Books <books@example.com>',
    ZL_PUBLIC_URL: 'https://books.example.com',
  });
  await assert.rejects(
    sendEmail(
      { to: 'owner@example.com', subject: 'Test', text: 'Body' },
      config,
      { fetchImpl: async () => Response.json({ message: 'domain is not verified' }, { status: 422 }) },
    ),
    /Email delivery failed \(422\): domain is not verified/,
  );
  await assert.rejects(
    sendEmail({ to: 'owner@example.com', subject: 'Test', text: 'Body' }, null),
    /Email is not configured/,
  );
});

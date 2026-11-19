// ZledgerCraft - optional Cloudflare R2 offsite backup uploader.
// Uses the S3-compatible API and Node's crypto module, so the server stays
// dependency-free. The uploader only receives verified SQLite snapshots.
import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const SERVICE = 's3';
const REGION = 'auto';
const DEFAULT_PREFIX = 'zledgercraft';

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return createHmac('sha256', key).update(value).digest();
}

function amzDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function encodeKey(key) {
  return String(key)
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function signingKey(secret, day, region = REGION, service = SERVICE) {
  const dateKey = hmac(`AWS4${secret}`, day);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, 'aws4_request');
}

export function r2Configuration(env = process.env) {
  const accountId = text(env.R2_ACCOUNT_ID);
  const accessKeyId = text(env.R2_ACCESS_KEY_ID);
  const secretAccessKey = text(env.R2_SECRET_ACCESS_KEY);
  const bucket = text(env.R2_BUCKET);
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const endpoint = text(env.R2_ENDPOINT) || `https://${accountId}.r2.cloudflarestorage.com`;
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    prefix: text(env.R2_PREFIX) || DEFAULT_PREFIX,
    endpoint: endpoint.replace(/\/+$/, ''),
  };
}

export function backupObjectKey(name, prefix = DEFAULT_PREFIX, date = new Date()) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const cleanPrefix = text(prefix).replace(/^\/+|\/+$/g, '');
  const cleanName = text(name).replace(/^\/+/, '');
  if (!cleanName) throw new Error('A backup name is required.');
  return [cleanPrefix, 'workspace', year, month, cleanName].filter(Boolean).join('/');
}

export function signedR2Request({
  config,
  method = 'PUT',
  key,
  body = Buffer.alloc(0),
  contentType = 'application/vnd.sqlite3',
  now = new Date(),
}) {
  if (!config) throw new Error('R2 is not configured.');
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body ?? '');
  const encodedKey = encodeKey(key);
  const url = new URL(`${config.endpoint}/${encodeURIComponent(config.bucket)}/${encodedKey}`);
  const payloadHash = sha256(payload);
  const date = amzDate(now);
  const day = date.slice(0, 8);
  const scope = `${day}/${REGION}/${SERVICE}/aws4_request`;
  const canonicalHeaders = [
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${date}`,
  ].join('\n');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    url.pathname,
    '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    date,
    scope,
    sha256(canonicalRequest),
  ].join('\n');
  const signature = createHmac('sha256', signingKey(config.secretAccessKey, day))
    .update(stringToSign)
    .digest('hex');
  return {
    url,
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': date,
    },
    body: payload,
    key,
    bytes: payload.length,
  };
}

export async function uploadBackup({
  config,
  path,
  name,
  key = backupObjectKey(name, config?.prefix),
  fetchImpl = fetch,
  now = new Date(),
}) {
  if (!config) return { ok: false, skipped: true, error: 'R2 is not configured.' };
  const body = await readFile(path);
  const request = signedR2Request({ config, key, body, now });
  let response;
  try {
    response = await fetchImpl(request.url, {
      method: 'PUT',
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`R2 upload failed: ${error.message || 'network error'}`);
  }
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 500);
    } catch {
      // Keep the status-only error when R2 returns no readable body.
    }
    throw new Error(`R2 upload failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  return {
    ok: true,
    key,
    bytes: request.bytes,
    etag: response.headers.get('etag') || '',
  };
}

export const R2_DEFAULTS = Object.freeze({ region: REGION, service: SERVICE });

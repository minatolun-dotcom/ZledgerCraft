// ZledgerCraft - static server with SQLite or Neon Postgres workspace storage.
import './server-env.js';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import { chmod, mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthStore, generateTotpSecret, totpUri } from './server-auth.js';
import { PostgresAuthStore } from './server-auth-pg.js';
import { emailConfiguration, sendBackupFailureEmail, sendEmail, sendPasswordResetEmail } from './server-email.js';
import { neonAuthConfiguration, neonForgotPassword, neonResetPassword, neonSignIn, neonSignUp } from './server-neon-auth.js';
import { createPostgresPool, PostgresWorkspaceStore } from './server-pg.js';
import {
  backupObjectKey,
  downloadBackup,
  listBackupObjects,
  r2Configuration,
  uploadBackup,
} from './server-r2.js';
import { deepEqual, mergeWorkspaceStates, repairVoucherNumbers } from './server-merge.js';
import { readWorkspaceSnapshot, WorkspaceStore } from './server-workspace.js';
import {
  buildDailyReport,
  createReportToken,
  normalizeRecipients,
  reportHtml,
  reportSecret,
  reportSubject,
  reportText,
  reportTtlMs,
  verifyReportToken,
} from './server-reports.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const host = String(process.env.HOST || '127.0.0.1');
const neonAuth = neonAuthConfiguration(process.env);
const postgresUrl = String(process.env.DATABASE_URL || '').trim();
const functionMode = process.env.ZL_FUNCTION === '1';
const authRequired =
  process.env.ZL_AUTH === '1' || Boolean(neonAuth) || !['127.0.0.1', 'localhost', '::1'].includes(host);
const tlsCertPath = process.env.TLS_CERT_PATH || '';
const tlsKeyPath = process.env.TLS_KEY_PATH || '';
if (Boolean(tlsCertPath) !== Boolean(tlsKeyPath)) {
  console.error('Set both TLS_CERT_PATH and TLS_KEY_PATH to enable HTTPS.');
  process.exit(1);
}
const tlsEnabled = Boolean(tlsCertPath && tlsKeyPath);
function cookieSecure(request) {
  const forwarded = String(request.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return tlsEnabled || request.socket?.encrypted || forwarded === 'https' ? '; Secure' : '';
}
const dataDir = process.env.ZL_DATA_DIR ? resolve(process.env.ZL_DATA_DIR) : join(root, 'data');
const legacyWorkspaceFile = join(dataDir, 'workspace.json');
const workspaceDbFile = join(dataDir, 'workspace.sqlite');
const backupDir = process.env.ZL_BACKUP_DIR ? resolve(process.env.ZL_BACKUP_DIR) : join(dataDir, 'backups');
const backupKeep = Math.min(100, Math.max(1, Number(process.env.ZL_BACKUP_KEEP) || 7));
const backupHours = Math.min(168, Math.max(1, Number(process.env.ZL_BACKUP_HOURS) || 24));
const allowedNetworks = String(process.env.ZL_ALLOWED_IPS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [address, bitsText] = entry.split('/');
    const bits = bitsText === undefined ? 32 : Number(bitsText);
    const octets = address.split('.').map(Number);
    if (
      octets.length !== 4 ||
      octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255) ||
      !Number.isInteger(bits) ||
      bits < 0 ||
      bits > 32
    ) {
      return { invalid: entry };
    }
    const value = octets.reduce((total, octet) => (total << 8) | octet, 0) >>> 0;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return { network: (value & mask) >>> 0, mask };
  });
if (allowedNetworks.some((entry) => entry.invalid)) {
  console.error(`Invalid ZL_ALLOWED_IPS entry: ${allowedNetworks.find((entry) => entry.invalid).invalid}`);
  process.exit(1);
}
const BODY_LIMIT = 20 * 1024 * 1024;
const SESSION_COOKIE = 'zl_session';
const AUDIT_GENESIS = '0'.repeat(64);
const r2Config = r2Configuration(process.env);
const emailConfig = emailConfiguration(process.env);
const alertEmail = String(process.env.ZL_ALERT_EMAIL || '').trim();
const LOGIN_IP_LIMIT = { maxFailures: 8, windowMs: 60_000, lockMs: 60_000 };
const FORGOT_IP_LIMIT = { maxFailures: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
const signingSecret = reportSecret(process.env);
const reportTtl = reportTtlMs(process.env);
let workspaceWriteQueue = Promise.resolve();
let backupTimer = null;

let DatabaseSync = null;
let sqliteBackup = null;
try {
  ({ DatabaseSync, backup: sqliteBackup } = await import('node:sqlite'));
} catch {
  // Older Node releases fall back to the revisioned JSON file.
}

let db = null;
let auth = null;
let workspaceStore = null;
let postgresStore = null;
let insertWorkspaceAudit = null;
let storage = 'json';
let selectWorkspace = null;
let selectWorkspaceAudit = null;
let lastWorkspaceAudit = null;
let insertServerEvent = null;
let selectServerEvents = null;
let lastServerEvent = null;
let upsertWorkspace = null;

if (DatabaseSync) {
  await mkdir(dataDir, { recursive: true });
  db = new DatabaseSync(workspaceDbFile);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS workspace (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      rev INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      state TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      rev INTEGER NOT NULL,
      bytes INTEGER NOT NULL,
      prev_hash TEXT NOT NULL DEFAULT '',
      hash TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS server_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      prev_hash TEXT NOT NULL DEFAULT '',
      hash TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS report_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      recipients TEXT NOT NULL DEFAULT '',
      last_sent_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  const auditColumns = db.prepare('PRAGMA table_info(workspace_audit)').all();
  if (!auditColumns.some((column) => column.name === 'prev_hash')) {
    db.exec("ALTER TABLE workspace_audit ADD COLUMN prev_hash TEXT NOT NULL DEFAULT ''");
  }
  if (!auditColumns.some((column) => column.name === 'hash')) {
    db.exec("ALTER TABLE workspace_audit ADD COLUMN hash TEXT NOT NULL DEFAULT ''");
  }
  selectWorkspace = db.prepare('SELECT rev, updated_at, state FROM workspace WHERE id = 1');
  upsertWorkspace = db.prepare(`
    INSERT INTO workspace (id, rev, updated_at, state)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      rev = excluded.rev,
      updated_at = excluded.updated_at,
      state = excluded.state
  `);
  insertWorkspaceAudit = db.prepare(`
    INSERT INTO workspace_audit (at, user_id, username, role, rev, bytes, prev_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  selectWorkspaceAudit = db.prepare(
    'SELECT id, at, user_id, username, role, rev, bytes, prev_hash, hash FROM workspace_audit ORDER BY id DESC LIMIT ?',
  );
  lastWorkspaceAudit = db.prepare('SELECT hash FROM workspace_audit ORDER BY id DESC LIMIT 1');
  insertServerEvent = db.prepare(`
    INSERT INTO server_events (at, user_id, username, role, action, target, detail, prev_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  selectServerEvents = db.prepare(
    'SELECT id, at, user_id, username, role, action, target, detail, prev_hash, hash FROM server_events ORDER BY id DESC LIMIT ?',
  );
  lastServerEvent = db.prepare('SELECT hash FROM server_events ORDER BY id DESC LIMIT 1');
  ensureWorkspaceAuditChain();
  storage = 'sqlite';
  await migrateLegacyWorkspace();
  const sqliteWorkspaceStore = new WorkspaceStore(db);
  if (sqliteWorkspaceStore.migrateLegacy()) {
    const migrated = sqliteWorkspaceStore.read();
    console.log(`Migrated the workspace into normalized SQLite tables at revision ${migrated.rev}.`);
  }
  sqliteWorkspaceStore.ensureHistory();
  const sqliteAuth = new AuthStore(db);
  auth = sqliteAuth;
  if (postgresUrl) {
    const pool = createPostgresPool(postgresUrl);
    postgresStore = new PostgresWorkspaceStore(pool);
    await postgresStore.init();
    workspaceStore = postgresStore;
    storage = 'postgres';
    const current = await postgresStore.read();
    if (!current.state) {
      const migrated = sqliteWorkspaceStore.read();
      if (migrated.state) {
        await postgresStore.write(migrated.state, 0, {
          updatedAt: migrated.updatedAt || new Date().toISOString(),
        });
        console.log(`Copied the existing SQLite workspace to Neon Postgres at revision ${migrated.rev}.`);
      }
    }
    await postgresStore.ensureHistory();
    const postgresAuth = new PostgresAuthStore(pool);
    await postgresAuth.init();
    if (!(await postgresAuth.hasUsers()) && sqliteAuth.hasUsers()) {
      const imported = await postgresAuth.migrateFromSqlite(db);
      if (imported) console.log('Copied SQLite profiles, sessions and login state to Neon Postgres.');
    }
    auth = postgresAuth;
    console.log('Workspace storage: Neon Postgres.');
    console.log(`Authentication storage: Neon Postgres (${(await auth.hasUsers()) ? 'existing' : 'empty'}).`);
  } else {
    workspaceStore = sqliteWorkspaceStore;
    storage = 'sqlite';
  }
  if (authRequired && !neonAuth && !(await auth.hasUsers())) {
    const password = String(process.env.ZL_OWNER_PASSWORD || '');
    if (!password) {
      console.error('LAN mode needs an owner account. Set ZL_OWNER_PASSWORD (at least 8 characters) for the first start.');
      process.exit(1);
    }
    const owner = await auth.ensureOwner({
      username: process.env.ZL_OWNER_USER || 'owner',
      name: process.env.ZL_OWNER_NAME || 'Owner',
      password,
      email: process.env.ZL_OWNER_EMAIL || '',
    });
    if (!owner.ok) {
      console.error(`Could not create the owner account: ${owner.error}`);
      process.exit(1);
    }
    console.log(`Created owner account "${owner.user.username}" from ZL_OWNER_* settings.`);
  }
}

if (authRequired && !db) {
  console.error('LAN mode requires Node with built-in node:sqlite support (Node 22.5 or newer).');
  process.exit(1);
}

async function migrateLegacyWorkspace() {
  if (selectWorkspace.get()) return;
  let raw;
  try {
    raw = await readFile(legacyWorkspaceFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    throw new Error('Legacy workspace.json is not valid JSON. Fix or remove it before starting the server.');
  }
  if (!saved?.state || !Array.isArray(saved.state.companies)) {
    throw new Error('Legacy workspace.json has no company state. Fix or remove it before starting the server.');
  }
  const rev = Math.max(1, Number(saved.rev) || 0);
  const updatedAt = saved.updatedAt || new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    upsertWorkspace.run(rev, updatedAt, JSON.stringify(saved.state));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  try {
    await rename(legacyWorkspaceFile, `${legacyWorkspaceFile}.migrated`);
  } catch {
    // The SQLite row is authoritative even if the legacy rename fails.
  }
  console.log(`Migrated ${legacyWorkspaceFile} into ${workspaceDbFile} at revision ${rev}.`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const pathname = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = resolve(join(root, normalize(pathname)));
  const fromRoot = relative(root, target);
  if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) return null;
  if (fromRoot.split(sep).some((segment) => segment.startsWith('.'))) return null;
  return target;
}

function securityHeaders() {
  return {
    'content-security-policy':
      "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    ...(tlsEnabled ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}

function json(response, status, payload, headers = {}) {
  response.writeHead(status, {
    ...securityHeaders(),
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function parseCookies(request) {
  const cookies = {};
  for (const part of String(request.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    try {
      cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // Ignore malformed cookie values rather than failing the whole request.
    }
  }
  return cookies;
}

function sessionToken(request) {
  return parseCookies(request)[SESSION_COOKIE] || '';
}

async function currentUser(request) {
  return auth ? await auth.sessionUser(sessionToken(request)) : null;
}

function localUser() {
  return { id: 'local-owner', username: 'local', name: 'Local owner', role: 'owner' };
}

function allowedCompanyIds(user) {
  if (!authRequired || user.role === 'owner') return null;
  // Legacy accounts have no companyIds and retain access to every company.
  if (!Array.isArray(user.companyIds)) return null;
  return new Set(user.companyIds);
}

function filterWorkspaceForUser(state, user) {
  const allowed = allowedCompanyIds(user);
  if (!allowed || !state) return state;
  const companies = (state.companies ?? []).filter((company) => allowed.has(company.id));
  return {
    ...state,
    activeCompanyId: companies.some((company) => company.id === state.activeCompanyId)
      ? state.activeCompanyId
      : companies[0]?.id ?? null,
    companies,
    users: [],
    currentUserId: null,
    audit: (state.audit ?? []).filter((entry) => allowed.has(entry.companyId)),
  };
}

function mergeScopedWorkspace(base, current, incoming, user) {
  const allowed = allowedCompanyIds(user);
  if (!allowed) return { state: incoming };
  for (const company of incoming.companies ?? []) {
    if (!allowed.has(company.id)) return { error: 'That company is outside this account\'s access.' };
  }
  const visible = (state) => ({
    ...filterWorkspaceForUser(state, user),
    users: [],
    currentUserId: null,
  });
  const result = mergeWorkspaceStates(visible(base), visible(current), visible(incoming));
  if (!result.ok) return { error: result.reason || 'The changes overlap.' };
  repairVoucherNumbers(result.state);

  const mergedById = new Map((result.state.companies ?? []).map((company) => [company.id, company]));
  const currentIds = new Set((current.companies ?? []).map((company) => company.id));
  const companies = (current.companies ?? []).map((company) =>
    allowed.has(company.id) ? mergedById.get(company.id) ?? company : company,
  );
  for (const company of result.state.companies ?? []) {
    if (!currentIds.has(company.id)) companies.push(company);
  }
  const currentAudit = current.audit ?? [];
  const knownAudit = new Set(currentAudit.map((entry) => entry.id));
  const appendedAudit = (result.state.audit ?? []).filter((entry) => entry && !knownAudit.has(entry.id));
  return {
    state: {
      ...result.state,
      activeCompanyId: allowed.has(result.state.activeCompanyId)
        ? result.state.activeCompanyId
        : current.activeCompanyId,
      companies,
      users: current.users ?? [],
      currentUserId: current.currentUserId ?? null,
      audit: [...currentAudit, ...appendedAudit],
    },
  };
}

function prepareWorkspaceForScopedWrite(current, incoming, user) {
  const allowed = allowedCompanyIds(user);
  if (!allowed) return { state: incoming };
  if (!current) return { error: 'No workspace exists yet.' };
  const currentCompanies = current.companies ?? [];
  const currentById = new Map(currentCompanies.map((company) => [company.id, company]));
  const incomingCompanies = incoming.companies ?? [];
  const incomingById = new Map(incomingCompanies.map((company) => [company.id, company]));
  for (const company of incomingCompanies) {
    if (!allowed.has(company.id)) return { error: 'That company is outside this account\'s access.' };
  }

  const companies = [];
  for (const company of currentCompanies) {
    if (allowed.has(company.id)) {
      const next = incomingById.get(company.id);
      if (next) companies.push(next);
    } else {
      companies.push(company);
    }
  }
  for (const company of incomingCompanies) {
    if (!currentById.has(company.id)) companies.push(company);
  }

  const currentAudit = current.audit ?? [];
  const knownAudit = new Set(currentAudit.map((entry) => entry.id));
  const appendedAudit = (incoming.audit ?? []).filter((entry) => entry && !knownAudit.has(entry.id));
  return {
    state: {
      ...incoming,
      activeCompanyId: allowed.has(incoming.activeCompanyId)
        ? incoming.activeCompanyId
        : current.activeCompanyId,
      companies,
      users: current.users ?? [],
      currentUserId: current.currentUserId ?? null,
      audit: [...currentAudit, ...appendedAudit],
    },
  };
}

async function requireUser(request, response) {
  if (!authRequired) return localUser();
  const user = await currentUser(request);
  if (!user) {
    json(response, 401, { ok: false, code: 'auth', error: 'Sign in to use this workspace.' });
    return null;
  }
  return user;
}

async function requireOwner(request, response) {
  const user = await requireUser(request, response);
  if (!user) return null;
  if (user.role !== 'owner') {
    json(response, 403, { ok: false, error: 'Only an owner can manage server accounts.' });
    return null;
  }
  return user;
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const host = request.headers['x-forwarded-host'] || request.headers.host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function companyScopeError(value) {
  if (value === undefined || value === null) return '';
  if (!Array.isArray(value)) return 'Company access must be a list of company ids.';
  const state = workspaceStore ? (await workspaceStore.read()).state : null;
  const known = new Set((state?.companies ?? []).map((company) => company.id));
  for (const id of value) {
    if (!known.has(String(id))) return 'One of the selected companies no longer exists.';
  }
  return '';
}

function clientIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return (
    String(request.headers['x-zl-client-ip'] || '').trim() ||
    forwarded ||
    request.headers['cf-connecting-ip'] ||
    request.socket.remoteAddress ||
    'unknown'
  );
}

function allowedClient(address) {
  if (!allowedNetworks.length) return true;
  const normalized = String(address).startsWith('::ffff:') ? String(address).slice(7) : String(address);
  const octets = normalized.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const value = octets.reduce((total, octet) => (total << 8) | octet, 0) >>> 0;
  return allowedNetworks.some((entry) => ((value & entry.mask) >>> 0) === entry.network);
}

async function loginBlocked(ip) {
  if (!auth) return false;
  return (await auth.loginLimit(`ip|${ip}`, LOGIN_IP_LIMIT)).blocked;
}

async function recordLoginFailure(ip) {
  if (!auth) return;
  await auth.recordFailure(`ip|${ip}`, LOGIN_IP_LIMIT);
}

async function forgotBlocked(ip) {
  if (!auth) return false;
  const key = `forgot|${ip}`;
  if ((await auth.loginLimit(key, FORGOT_IP_LIMIT)).blocked) return true;
  await auth.recordFailure(key, FORGOT_IP_LIMIT);
  return false;
}

async function notifyBackupFailure(backup, error) {
  if (!emailConfig || !alertEmail) return;
  try {
    await sendBackupFailureEmail(
      { to: alertEmail, backupName: backup, error },
      emailConfig,
    );
  } catch (mailError) {
    console.error(`Could not send backup failure email: ${mailError.message}`);
  }
}

async function uploadVerifiedBackup(name, target) {
  if (!r2Config) return null;
  try {
    const uploaded = await uploadBackup({
      config: r2Config,
      path: target,
      name,
      key: backupObjectKey(name, r2Config.prefix),
    });
    return { ...uploaded, bucket: r2Config.bucket };
  } catch (error) {
    console.error(`R2 backup upload failed for ${name}: ${error.message}`);
    await notifyBackupFailure(name, error.message);
    return { ok: false, error: error.message, bucket: r2Config.bucket };
  }
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error('Workspace body is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJsonEnvelope() {
  try {
    const raw = await readFile(legacyWorkspaceFile, 'utf8');
    const saved = JSON.parse(raw);
    return {
      state: saved.state ?? null,
      rev: Number.isInteger(Number(saved.rev)) ? Number(saved.rev) : 0,
      updatedAt: saved.updatedAt ?? null,
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { state: null, rev: 0, updatedAt: null };
    throw error;
  }
}

async function readWorkspaceEnvelope() {
  if (!workspaceStore) return readJsonEnvelope();
  return workspaceStore.read();
}

function workspaceAuditHash(prevHash, row) {
  return createHash('sha256')
    .update(JSON.stringify([prevHash, row.at, row.user_id, row.username, row.role, row.rev, row.bytes]))
    .digest('hex');
}

function ensureWorkspaceAuditChain() {
  const rows = db.prepare('SELECT * FROM workspace_audit ORDER BY id').all();
  if (rows.every((row) => row.prev_hash && row.hash)) return;
  const update = db.prepare('UPDATE workspace_audit SET prev_hash = ?, hash = ? WHERE id = ?');
  let previous = AUDIT_GENESIS;
  for (const row of rows) {
    const hash = workspaceAuditHash(previous, row);
    update.run(previous, hash, row.id);
    previous = hash;
  }
}

function appendWorkspaceAudit(at, user, rev, bytes) {
  const previous = lastWorkspaceAudit?.get()?.hash || AUDIT_GENESIS;
  const row = { at, user_id: user.id, username: user.username, role: user.role, rev, bytes };
  insertWorkspaceAudit.run(at, user.id, user.username, user.role, rev, bytes, previous, workspaceAuditHash(previous, row));
}

async function verifyWorkspaceAuditChain() {
  if (postgresStore) return postgresStore.verifyWorkspaceAuditChain();
  const rows = db.prepare('SELECT * FROM workspace_audit ORDER BY id').all();
  let previous = AUDIT_GENESIS;
  for (const [index, row] of rows.entries()) {
    const expected = workspaceAuditHash(previous, row);
    if (row.prev_hash !== previous || row.hash !== expected) {
      return { ok: false, checked: index, brokenId: row.id };
    }
    previous = row.hash;
  }
  return { ok: true, checked: rows.length };
}

function serverEventHash(prevHash, row) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        prevHash,
        row.at,
        row.user_id,
        row.username,
        row.role,
        row.action,
        row.target,
        row.detail,
      ]),
    )
    .digest('hex');
}

function appendServerEvent(user, action, target = '', detail = '') {
  if (postgresStore) {
    const row = {
      at: new Date().toISOString(),
      user_id: user.id,
      username: user.username,
      role: user.role,
      action,
      target: String(target).slice(0, 200),
      detail: String(detail).slice(0, 500),
    };
    void postgresStore
      .appendServerEvent(row)
      .catch((error) => console.error(`Could not append server event ${action}: ${error.message}`));
    return;
  }
  if (!db || !insertServerEvent) return;
  const previous = lastServerEvent?.get()?.hash || AUDIT_GENESIS;
  const row = {
    at: new Date().toISOString(),
    user_id: user.id,
    username: user.username,
    role: user.role,
    action,
    target: String(target).slice(0, 200),
    detail: String(detail).slice(0, 500),
  };
  try {
    insertServerEvent.run(
      row.at,
      row.user_id,
      row.username,
      row.role,
      row.action,
      row.target,
      row.detail,
      previous,
      serverEventHash(previous, row),
    );
  } catch (error) {
    console.error(`Could not append server event ${action}: ${error.message}`);
  }
}

async function verifyServerEventChain() {
  if (postgresStore) return postgresStore.verifyServerEventChain();
  const rows = db.prepare('SELECT * FROM server_events ORDER BY id').all();
  let previous = AUDIT_GENESIS;
  for (const [index, row] of rows.entries()) {
    const expected = serverEventHash(previous, row);
    if (row.prev_hash !== previous || row.hash !== expected) {
      return { ok: false, checked: index, brokenId: row.id };
    }
    previous = row.hash;
  }
  return { ok: true, checked: rows.length };
}

const BACKUP_NAME = /^workspace-\d{8}-\d{6}-[a-z]+(?:-\d+)?\.(?:sqlite|json)$/;
let backupQueue = Promise.resolve();

function backupStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-');
}

async function listLocalServerBackups() {
  let entries;
  try {
    entries = await readdir(backupDir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const backups = [];
  const extension = postgresStore ? '.json' : '.sqlite';
  for (const name of entries) {
    if (!BACKUP_NAME.test(name) || !name.endsWith(extension)) continue;
    try {
      const info = await stat(join(backupDir, name));
      if (!info.isFile()) continue;
      backups.push({ name, bytes: info.size, createdAt: info.mtime.toISOString() });
    } catch {
      // A backup may be removed by another operator between listing and stat.
    }
  }
  return backups.sort((a, b) => b.name.localeCompare(a.name));
}

async function listRemoteServerBackups() {
  if (!r2Config) return [];
  const extension = postgresStore ? '.json' : '.sqlite';
  try {
    const objects = await listBackupObjects({ config: r2Config });
    return objects
      .filter((object) => BACKUP_NAME.test(object.name) && object.name.endsWith(extension))
      .map((object) => ({
        name: object.name,
        bytes: object.bytes,
        createdAt: object.createdAt,
        offsite: true,
      }));
  } catch (error) {
    console.error(`Could not list R2 backups: ${error.message}`);
    return [];
  }
}

async function listServerBackups() {
  const local = await listLocalServerBackups();
  const remote = await listRemoteServerBackups();
  const merged = new Map(local.map((backup) => [backup.name, backup]));
  for (const backup of remote) {
    merged.set(backup.name, { ...merged.get(backup.name), ...backup });
  }
  return [...merged.values()].sort((a, b) => b.name.localeCompare(a.name));
}

async function remoteBackupKey(name) {
  if (!r2Config) return '';
  const objects = await listBackupObjects({ config: r2Config });
  return objects.find((object) => object.name === name)?.key || '';
}

async function readServerBackupBytes(name) {
  const target = join(backupDir, name);
  try {
    return await readFile(target);
  } catch (error) {
    if (error.code !== 'ENOENT' || !r2Config) throw error;
    const key = await remoteBackupKey(name);
    if (!key) throw error;
    return downloadBackup({ config: r2Config, key });
  }
}

async function createServerBackup(reason = 'manual') {
  if (!workspaceStore) throw new Error('Server backups require a server workspace.');
  if (!postgresStore && (!db || !sqliteBackup)) throw new Error('Server backups require SQLite.');
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const base = `workspace-${backupStamp()}-${String(reason).replace(/[^a-z]/gi, '').toLowerCase() || 'manual'}`;
  const extension = postgresStore ? 'json' : 'sqlite';
  let name = `${base}.${extension}`;
  for (let suffix = 1; ; suffix += 1) {
    try {
      await stat(join(backupDir, name));
      name = `${base}-${suffix}.${extension}`;
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
  const target = join(backupDir, name);
  if (postgresStore) {
    const saved = await postgresStore.read();
    if (!saved.state || !Array.isArray(saved.state.companies)) {
      throw new Error('There is no Postgres workspace to back up.');
    }
    await writeFile(
      target,
      JSON.stringify({ version: 2, rev: saved.rev, updatedAt: saved.updatedAt, state: saved.state }),
      { encoding: 'utf8', mode: 0o600 },
    );
    try {
      const copy = JSON.parse(await readFile(target, 'utf8'));
      if (!copy.state || !Array.isArray(copy.state.companies)) throw new Error('missing state');
    } catch {
      await unlink(target).catch(() => {});
      throw new Error('The backup failed its integrity check.');
    }
    const info = await stat(target);
    const offsite = await uploadVerifiedBackup(name, target);
    if (!offsite || offsite.ok) {
      const backups = await listLocalServerBackups();
      for (const old of backups.slice(backupKeep)) {
        await unlink(join(backupDir, old.name)).catch(() => {});
      }
    }
    return {
      name,
      bytes: info.size,
      createdAt: info.mtime.toISOString(),
      kept: backupKeep,
      offsite,
    };
  }
  await sqliteBackup(db, target);
  await chmod(target, 0o600).catch(() => {});
  let verified = false;
  try {
    const copy = new DatabaseSync(target, { readOnly: true });
    try {
      const check = copy.prepare('PRAGMA integrity_check').get();
      verified = String(Object.values(check ?? {})[0] ?? '').toLowerCase() === 'ok';
    } finally {
      copy.close();
    }
  } catch {
    verified = false;
  }
  if (!verified) {
    await unlink(target).catch(() => {});
    throw new Error('The backup failed its integrity check.');
  }
  const info = await stat(target);
  const offsite = await uploadVerifiedBackup(name, target);
  // Keep older local copies when an offsite upload failed, so a transient R2
  // outage does not reduce the number of surviving copies.
  if (!offsite || offsite.ok) {
    const backups = await listLocalServerBackups();
    for (const old of backups.slice(backupKeep)) {
      await unlink(join(backupDir, old.name)).catch(() => {});
    }
  }
  return {
    name,
    bytes: info.size,
    createdAt: info.mtime.toISOString(),
    kept: backupKeep,
    offsite,
  };
}

function queueServerBackup(reason) {
  const run = backupQueue.then(
    () => createServerBackup(reason),
    () => createServerBackup(reason),
  );
  backupQueue = run.catch(() => {});
  return run;
}

async function maybeCreateDailyServerBackup() {
  if (!workspaceStore || (!postgresStore && (!db || !sqliteBackup)) || !(await workspaceStore.read()).state) return null;
  const today = backupStamp().slice(0, 8);
  const backups = await listServerBackups();
  if (backups.some((backup) => backup.name.startsWith(`workspace-${today}-`))) return null;
  return queueServerBackup('daily');
}

function scheduleServerBackupCheck() {
  if (!workspaceStore || (!postgresStore && (!db || !sqliteBackup)) || backupTimer) return;
  backupTimer = setTimeout(() => {
    backupTimer = null;
    maybeCreateDailyServerBackup().catch((error) => console.error(`Server backup failed: ${error.message}`));
  }, 1500);
  backupTimer.unref?.();
}

async function readReportSettings() {
  if (postgresStore) return postgresStore.getReportSettings();
  if (!db) return { enabled: false, recipients: '', lastSentAt: null, updatedAt: null };
  const row = db
    .prepare('SELECT enabled, recipients, last_sent_at, updated_at FROM report_settings WHERE id = 1')
    .get();
  return {
    enabled: Boolean(row?.enabled),
    recipients: row?.recipients || '',
    lastSentAt: row?.last_sent_at || null,
    updatedAt: row?.updated_at || null,
  };
}

async function writeReportSettings({ enabled = false, recipients = '', lastSentAt = null } = {}) {
  if (postgresStore) {
    return postgresStore.saveReportSettings({ enabled, recipients, lastSentAt });
  }
  if (!db) throw new Error('Scheduled reports require server storage.');
  db.prepare(
    `INSERT INTO report_settings (id, enabled, recipients, last_sent_at, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       enabled = excluded.enabled,
       recipients = excluded.recipients,
       last_sent_at = COALESCE(excluded.last_sent_at, report_settings.last_sent_at),
       updated_at = excluded.updated_at`,
  ).run(enabled ? 1 : 0, String(recipients), lastSentAt, new Date().toISOString());
  return readReportSettings();
}

function reportBaseUrl(request = null) {
  const configured = emailConfig?.publicUrl || String(process.env.ZL_PUBLIC_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (request) {
    const proto =
      String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim() ||
      (tlsEnabled ? 'https' : 'http');
    const host = request.headers['x-forwarded-host'] || request.headers.host || `127.0.0.1:${port}`;
    return `${proto}://${host}`;
  }
  return '';
}

function signedReportUrl(request = null, now = Date.now()) {
  if (!signingSecret) throw new Error('Report links are not configured. Set ZL_REPORT_SECRET.');
  const token = createReportToken(signingSecret, { now, ttlMs: reportTtl });
  const base = reportBaseUrl(request);
  if (!base) throw new Error('Set ZL_PUBLIC_URL to generate report links.');
  return {
    url: `${base}/api/reports/daily?token=${encodeURIComponent(token)}`,
    expiresAt: new Date(now + reportTtl).toISOString(),
  };
}

async function latestBackupForReport() {
  try {
    const backups = await listServerBackups();
    const latest = backups[0];
    if (!latest) return null;
    return {
      name: latest.name,
      createdAt: latest.createdAt,
      offsite: Boolean(latest.offsite),
    };
  } catch {
    return null;
  }
}

async function sendDailyReport({ force = false, request = null } = {}) {
  const settings = await readReportSettings();
  if (!force && !settings.enabled) return { skipped: 'disabled' };
  if (!force && settings.lastSentAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)) {
    return { skipped: 'already-sent' };
  }
  const parsed = normalizeRecipients(settings.recipients);
  if (!parsed.ok) throw new Error(parsed.error);
  if (!parsed.recipients.length) throw new Error('Add at least one report recipient.');
  if (!emailConfig) throw new Error('Resend email is not configured on this server.');
  const signed = signedReportUrl(request);
  const saved = await workspaceStore.read();
  const report = buildDailyReport(saved.state, {
    backup: await latestBackupForReport(),
    recipients: parsed.recipients,
  });
  await sendEmail(
    {
      to: parsed.recipients,
      subject: reportSubject(report),
      text: reportText(report, signed),
      html: reportHtml(report, signed),
    },
    emailConfig,
  );
  await writeReportSettings({
    enabled: settings.enabled,
    recipients: settings.recipients,
    lastSentAt: new Date().toISOString(),
  });
  appendServerEvent(
    { id: 'system', username: 'scheduler', role: 'owner' },
    'report.send',
    parsed.recipients.join(', '),
    `${report.companies.length} company(ies)`,
  );
  return { sent: true, recipients: parsed.recipients, report, url: signed.url, expiresAt: signed.expiresAt };
}

async function runScheduledJobs() {
  let backup = null;
  let backupError = '';
  try {
    backup = await maybeCreateDailyServerBackup();
  } catch (error) {
    backupError = error.message || 'Daily backup failed.';
    console.error(`Scheduled backup failed: ${backupError}`);
  }
  let report = null;
  let reportError = '';
  try {
    report = await sendDailyReport({ force: false });
  } catch (error) {
    reportError = error.message || 'Scheduled report failed.';
    console.error(`Scheduled report failed: ${reportError}`);
  }
  return {
    ok: !backupError && !reportError,
    backup: backup ? { name: backup.name, offsite: Boolean(backup.offsite?.ok) } : null,
    backupError,
    report: report?.sent ? { recipients: report.recipients.length, expiresAt: report.expiresAt } : report?.skipped || null,
    reportError,
  };
}

function schedulerAuthorized(request) {
  const configured = String(process.env.ZL_SCHEDULER_SECRET || '');
  const supplied = String(request.headers['x-zl-scheduler-secret'] || '');
  if (configured && supplied) {
    const expected = Buffer.from(configured);
    const actual = Buffer.from(supplied);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) return true;
  }
  return Boolean(request.headers['x-neon-trigger-invocation-id']);
}

async function handleReportApi(request, response, url, pathname) {
  if (pathname === '/api/reports/daily' && request.method === 'GET') {
    const verified = verifyReportToken(signingSecret, url.searchParams.get('token') || '');
    if (!verified.ok) {
      response.writeHead(verified.reason === 'expired' ? 410 : 401, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(
        `<!doctype html><meta charset="utf-8"><title>Report link unavailable</title><p>${verified.reason === 'expired' ? 'This report link has expired.' : 'This report link is invalid.'} Ask an owner for a new daily summary.</p>`,
      );
      return;
    }
    try {
      const saved = await workspaceStore.read();
      const report = buildDailyReport(saved.state, { backup: await latestBackupForReport() });
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(reportHtml(report, { expiresAt: verified.expiresAt }));
    } catch (error) {
      json(response, 500, { ok: false, error: error.message || 'Could not build the report.' });
    }
    return;
  }

  const owner = await requireOwner(request, response);
  if (!owner) return;
  if (pathname === '/api/reports/settings' && request.method === 'GET') {
    const settings = await readReportSettings();
    json(response, 200, {
      ok: true,
      settings,
      emailConfigured: Boolean(emailConfig),
      secretConfigured: Boolean(signingSecret),
      publicUrl: reportBaseUrl(request),
    });
    return;
  }
  if (pathname === '/api/reports/settings' && request.method === 'PUT') {
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin report settings are not allowed.' });
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      json(response, 400, { ok: false, error: 'Send report settings as JSON.' });
      return;
    }
    const recipients = normalizeRecipients(body?.recipients ?? '');
    if (!recipients.ok) {
      json(response, 400, { ok: false, error: recipients.error });
      return;
    }
    const updated = await writeReportSettings({
      enabled: Boolean(body?.enabled),
      recipients: recipients.recipients.join(', '),
    });
    json(response, 200, { ok: true, settings: updated });
    return;
  }
  if (pathname === '/api/reports/preview' && request.method === 'POST') {
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin report previews are not allowed.' });
      return;
    }
    try {
      const signed = signedReportUrl(request);
      json(response, 200, { ok: true, ...signed });
    } catch (error) {
      json(response, 503, { ok: false, error: error.message });
    }
    return;
  }
  if (pathname === '/api/reports/send' && request.method === 'POST') {
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin report requests are not allowed.' });
      return;
    }
    try {
      const result = await sendDailyReport({ force: true, request });
      json(response, 200, { ok: true, ...result });
    } catch (error) {
      json(response, 503, { ok: false, error: error.message || 'Could not send the report.' });
    }
    return;
  }
  response.writeHead(405, { allow: 'GET, PUT, POST' });
  response.end();
}

function accountantWriteError(previous, next) {
  if (!previous) return '';
  if (JSON.stringify(previous.users ?? []) !== JSON.stringify(next.users ?? [])) {
    return 'Only an owner can change user profiles.';
  }
  const before = new Map((previous.companies ?? []).map((company) => [company.id, company]));
  const after = new Map((next.companies ?? []).map((company) => [company.id, company]));
  if (before.size !== after.size) return 'Only an owner can add or delete companies.';
  for (const [id, company] of after) {
    const old = before.get(id);
    if (!old) return 'Only an owner can add companies.';
    if (old.name !== company.name) return 'Only an owner can rename companies.';
    const yearSignature = (entry) =>
      `${entry.fyStart ?? ''}:${entry.fyEnd ?? ''}:${entry.yearId ?? ''}:` +
      (entry.years ?? []).map((year) => `${year.id}:${year.start}:${year.end}:${Boolean(year.closed)}`).join('|');
    if (yearSignature(old) !== yearSignature(company)) {
      return 'Only an owner can add, close or reopen financial years.';
    }
  }
  const oldAudit = previous.audit ?? [];
  const nextAudit = next.audit ?? [];
  if (nextAudit.length < oldAudit.length) return 'Audit history cannot be removed.';
  for (let index = 0; index < oldAudit.length; index += 1) {
    if (JSON.stringify(oldAudit[index]) !== JSON.stringify(nextAudit[index])) {
      return 'Audit history cannot be edited.';
    }
  }
  return '';
}

function changedVouchers(baseState, nextState) {
  if (!baseState || !nextState) return [];
  const before = new Map();
  const nextCompanyIds = new Set((nextState.companies ?? []).map((company) => company.id));
  for (const company of baseState.companies ?? []) {
    // A scoped writer never receives hidden companies, so their vouchers must
    // not look deleted when the filtered state is compared with the full base.
    if (!nextCompanyIds.has(company.id)) continue;
    for (const voucher of company.vouchers ?? []) {
      before.set(voucher.id, { companyId: company.id, voucher });
    }
  }
  const changed = [];
  const seen = new Set();
  for (const company of nextState.companies ?? []) {
    for (const voucher of company.vouchers ?? []) {
      seen.add(voucher.id);
      const previous = before.get(voucher.id);
      if (!previous || !deepEqual(previous.voucher, voucher)) {
        changed.push({ companyId: company.id, recordId: voucher.id });
      }
    }
  }
  for (const [recordId, previous] of before) {
    if (!seen.has(recordId)) changed.push({ companyId: previous.companyId, recordId });
  }
  return changed;
}

async function lockedVoucherChange(baseState, nextState, user, leaseToken) {
  if (!workspaceStore || !baseState) return null;
  const presented = leaseToken
    ? createHash('sha256').update(String(leaseToken)).digest('hex')
    : '';
  for (const change of changedVouchers(baseState, nextState)) {
    const lease = await workspaceStore.leaseFor(change.companyId, 'voucher', change.recordId);
    if (!lease || lease.token_hash === presented) continue;
    return {
      error: `${lease.username} is editing this voucher. Wait for the lease to expire or ask them to finish.`,
      holder: {
        username: lease.username,
        acquiredAt: lease.acquired_at,
        expiresAt: lease.expires_at,
      },
    };
  }
  return null;
}

function enqueueWorkspaceWrite(task) {
  const run = workspaceWriteQueue.then(task, task);
  workspaceWriteQueue = run.catch(() => {});
  return run;
}

async function writeWorkspace(state, baseRev, user, leaseToken = '') {
  const updatedAt = new Date().toISOString();
  if (workspaceStore) {
    const locked = await lockedVoucherChange(
      await workspaceStore.revisionState(baseRev),
      state,
      user,
      leaseToken,
    );
    if (locked) return { locked: true, ...locked };
    const afterWrite = postgresStore
      ? (serialized) => async (rev, auditClient) => {
          await postgresStore.appendWorkspaceAudit(
            {
              at: updatedAt,
              user_id: user.id,
              username: user.username,
              role: user.role,
              rev,
              bytes: Buffer.byteLength(serialized),
            },
            auditClient,
          );
        }
      : (serialized) => (rev) => {
          appendWorkspaceAudit(updatedAt, user, rev, Buffer.byteLength(serialized));
        };
    const allowed = allowedCompanyIds(user);
    if (allowed) {
      const current = await workspaceStore.read();
      if (!current.state) return { forbidden: true, error: 'No workspace exists yet.' };
      if (Number(current.rev) !== baseRev) {
        const base = await workspaceStore.revisionState(baseRev);
        if (!base) return { conflict: true, rev: current.rev, updatedAt: current.updatedAt ?? null };
        const merged = mergeScopedWorkspace(base, current.state, state, user);
        if (merged.error) {
          return {
            conflict: true,
            rev: current.rev,
            updatedAt: current.updatedAt ?? null,
            mergeError: merged.error,
          };
        }
        const serialized = JSON.stringify(merged.state);
        const written = await workspaceStore.write(merged.state, Number(current.rev), {
          updatedAt,
          validate: accountantWriteError,
          afterWrite: afterWrite(serialized),
        });
        if (written.conflict || written.forbidden) return written;
        return { ...written, merged: true, state: merged.state };
      }
      const prepared = prepareWorkspaceForScopedWrite(current.state, state, user);
      if (prepared.error) return { forbidden: true, error: prepared.error };
      const serialized = JSON.stringify(prepared.state);
      return workspaceStore.write(prepared.state, baseRev, {
        updatedAt,
        validate: accountantWriteError,
        afterWrite: afterWrite(serialized),
      });
    }
    const serialized = JSON.stringify(state);
    return workspaceStore.write(state, baseRev, {
      updatedAt,
      validate: user.role === 'owner' ? null : accountantWriteError,
      afterWrite: afterWrite(serialized),
    });
  }
  const serialized = JSON.stringify(state);

  const current = await readJsonEnvelope();
  if (current.rev !== baseRev) {
    return { conflict: true, rev: current.rev, updatedAt: current.updatedAt };
  }
  await mkdir(dataDir, { recursive: true });
  const temp = `${legacyWorkspaceFile}.tmp`;
  const saved = { version: 2, rev: baseRev + 1, updatedAt, state };
  await writeFile(temp, JSON.stringify(saved), 'utf8');
  await rename(temp, legacyWorkspaceFile);
  return { conflict: false, rev: saved.rev, updatedAt };
}

async function handleAuthApi(request, response, url) {
  const pathname = url.pathname;
  if (pathname === '/api/auth/me' && request.method === 'GET') {
    const user = authRequired ? await currentUser(request) : null;
    json(response, 200, {
      ok: true,
      required: authRequired,
      user,
      storage,
      tls: tlsEnabled,
      neonAuth: Boolean(neonAuth),
      postgres: storage === 'postgres',
      emailReset: Boolean(neonAuth) || Boolean(emailConfig),
      lan: !['127.0.0.1', 'localhost', '::1'].includes(host),
    });
    return;
  }
  if (!auth || !authRequired) {
    json(response, 404, { ok: false, error: 'Server accounts are not enabled.' });
    return;
  }

  if (pathname === '/api/auth/forgot' && request.method === 'POST') {
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin reset requests are not allowed.' });
      return;
    }
    if (!neonAuth && !emailConfig) {
      json(response, 503, { ok: false, error: 'Email password reset is not configured on this server.' });
      return;
    }
    const ip = clientIp(request);
    if (await forgotBlocked(ip)) {
      json(response, 429, { ok: false, error: 'Too many reset requests. Wait a few minutes and try again.' });
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      json(response, 400, { ok: false, error: 'Send a username or email address.' });
      return;
    }
    const identifier = String(body?.identifier ?? body?.email ?? '').trim().slice(0, 200);
    const generic = {
      ok: true,
      message: 'If that account has an email address, a reset link has been sent.',
    };
    if (!identifier) {
      json(response, 200, generic);
      return;
    }
    if (neonAuth) {
      const result = await neonForgotPassword(neonAuth, identifier);
      if (!result.ok) console.error(`Neon Auth password reset request failed: ${result.error}`);
      json(response, 200, generic);
      return;
    }
    const reset = await auth.createPasswordReset(identifier);
    if (reset) {
      const link = new URL(emailConfig.publicUrl);
      link.searchParams.set('reset', reset.token);
      try {
        await sendPasswordResetEmail(
          {
            to: reset.user.email,
            username: reset.user.username,
            resetLink: link.toString(),
            expiresMinutes: reset.expiresMinutes,
          },
          emailConfig,
        );
      } catch (error) {
        // Keep the response generic so this endpoint cannot be used to probe
        // which accounts exist. Operators still get the server log.
        console.error(`Password reset email failed for @${reset.user.username}: ${error.message}`);
      }
      appendServerEvent(reset.user, 'account.password.forgot', reset.user.username);
    }
    json(response, 200, generic);
    return;
  }

  if (pathname === '/api/auth/reset' && request.method === 'POST') {
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin reset requests are not allowed.' });
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      json(response, 400, { ok: false, error: 'Send a reset token and new password.' });
      return;
    }
    if (neonAuth) {
      const result = await neonResetPassword(neonAuth, body?.token, body?.password);
      if (!result.ok) {
        json(response, 400, { ok: false, error: result.error || 'Password reset failed.' });
        return;
      }
      json(response, 200, { ok: true, message: 'Password reset. Sign in with the new password.' });
      return;
    }
    const result = await auth.consumePasswordReset(body?.token, body?.password);
    if (!result.ok) {
      json(response, 400, result);
      return;
    }
    appendServerEvent(result.user, 'account.password.reset', result.user.username);
    json(response, 200, { ok: true, message: 'Password reset. Sign in with the new password.' });
    return;
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin login is not allowed.' });
      return;
    }
    const ip = clientIp(request);
    if (await loginBlocked(ip)) {
      json(response, 429, { ok: false, error: 'Too many sign-in attempts. Wait a minute and try again.' });
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      json(response, 400, { ok: false, error: 'Send a JSON username and password.' });
      return;
    }    if (!body || typeof body !== 'object') {
      json(response, 400, { ok: false, error: 'Send a JSON username and password.' });
      return;
    }
    const limitKey = `${String(body.username ?? '').trim().toLowerCase()}|${ip}`;
    const limit = await auth.loginLimit(limitKey);
    if (limit.blocked) {
      json(response, 429, {
        ok: false,
        error: `Too many failed sign-ins for this account from this device. Try again in ${Math.max(1, Math.ceil(limit.retryAfterMs / 60000))} minute(s).`,
      });
      return;
    }

    if (neonAuth) {
      const email = String(body.username ?? body.email ?? '').trim();
      const result = await neonSignIn(neonAuth, email, body.password);
      if (!result.ok || !result.payload?.user) {
        await auth.recordLogin({
          username: email,
          userId: null,
          ok: false,
          ip,
          userAgent: request.headers['user-agent'] || '',
        });
        await recordLoginFailure(ip);
        await auth.recordFailure(limitKey);
        json(response, 401, { ok: false, error: 'Incorrect email or password.' });
        return;
      }
      const neonUser = result.payload.user;
      const profile = await auth.ensureNeonUser({
        neonUserId: neonUser.id,
        email: neonUser.email,
        name: neonUser.name,
      });
      if (!profile.ok) {
        json(response, 403, { ok: false, error: profile.error });
        return;
      }
      await auth.recordLogin({
        username: profile.user.username,
        userId: profile.user.id,
        ok: true,
        ip,
        userAgent: request.headers['user-agent'] || '',
      });
      await auth.clearLoginFailures(limitKey);
      const oldToken = sessionToken(request);
      if (oldToken) await auth.deleteSession(oldToken);
      const session = await auth.createSession(profile.user.id, request.headers['user-agent'] || '');
      json(
        response,
        200,
        { ok: true, user: profile.user, neon: true },
        {
          'set-cookie': `${SESSION_COOKIE}=${encodeURIComponent(session.token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${cookieSecure(request)}`,
        },
      );
      return;
    }

    const user = await auth.authenticate(body.username, body.password);
    if (!user) {
      await auth.recordLogin({
        username: body.username,
        userId: null,
        ok: false,
        ip,
        userAgent: request.headers['user-agent'] || '',
      });
      await recordLoginFailure(ip);
      await auth.recordFailure(limitKey);
      json(response, 401, { ok: false, error: 'Incorrect username or password.' });
      return;
    }
    const mfaSecret = user.mfaEnabled ? await auth.mfaSecret(user.id) : '';
    let mfaOk = !mfaSecret || await auth.verifyMfaCode(user.id, body.code);
    let recoveryUsed = false;
    if (mfaSecret && !mfaOk) {
      mfaOk = await auth.consumeMfaRecovery(user.id, body.code);
      recoveryUsed = mfaOk;
    }
    if (mfaSecret && !mfaOk) {
      await auth.recordLogin({
        username: body.username,
        userId: user.id,
        ok: false,
        ip,
        userAgent: request.headers['user-agent'] || '',
      });
      await auth.recordFailure(limitKey);
      json(response, 401, {
        ok: false,
        code: 'mfa',
        mfaRequired: true,
        error: 'Enter the current 6-digit authenticator code.',
      });
      return;
    }
    await auth.recordLogin({
      username: body.username,
      userId: user.id,
      ok: true,
      ip,
      userAgent: request.headers['user-agent'] || '',
    });
    await auth.clearLoginFailures(limitKey);
    const oldToken = sessionToken(request);
    if (oldToken) await auth.deleteSession(oldToken);
    const session = await auth.createSession(user.id, request.headers['user-agent'] || '');
    json(
      response,
      200,
      { ok: true, user, ...(recoveryUsed ? { mfaRecoveryUsed: true } : {}) },
      {
        'set-cookie': `${SESSION_COOKIE}=${encodeURIComponent(session.token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${cookieSecure(request)}`,
      },
    );
    return;
  }

  if (pathname === '/api/auth/register' && request.method === 'POST') {
    if (!neonAuth) {
      json(response, 404, { ok: false, error: 'Self-service sign-up requires Neon Auth.' });
      return;
    }
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin sign-up is not allowed.' });
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      json(response, 400, { ok: false, error: 'Send a JSON email, password and name.' });
      return;
    }
    if (!body || typeof body !== 'object') {
      json(response, 400, { ok: false, error: 'Send a JSON email, password and name.' });
      return;
    }
    const email = String(body.email ?? '').trim();
    const result = await neonSignUp(neonAuth, {
      email,
      password: body.password,
      name: String(body.name ?? email.split('@')[0] ?? 'Owner').slice(0, 80),
    });
    if (!result.ok || !result.payload?.user) {
      json(response, 400, { ok: false, error: result.error || 'Neon Auth could not create the account.' });
      return;
    }
    const neonUser = result.payload.user;
    const profile = await auth.ensureNeonUser({
      neonUserId: neonUser.id,
      email: neonUser.email,
      name: neonUser.name,
    });
    if (!profile.ok) {
      json(response, 403, { ok: false, error: profile.error });
      return;
    }
    const session = await auth.createSession(profile.user.id, request.headers['user-agent'] || '');
    json(
      response,
      200,
      { ok: true, user: profile.user, neon: true },
      {
        'set-cookie': `${SESSION_COOKIE}=${encodeURIComponent(session.token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${cookieSecure(request)}`,
      },
    );
    return;
  }

  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin logout is not allowed.' });
      return;
    }
    await auth.deleteSession(sessionToken(request));
    json(
      response,
      200,
      { ok: true },
      { 'set-cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${cookieSecure(request)}` },
    );
    return;
  }

  if (pathname === '/api/auth/password' && request.method === 'POST') {
    const user = await requireUser(request, response);
    if (!user) return;
    if (neonAuth) {
      json(response, 501, {
        ok: false,
        error: 'Passwords are managed by Neon Auth. Use the sign-in screen reset link instead.',
      });
      return;
    }
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin password changes are not allowed.' });
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      json(response, 400, { ok: false, error: 'Send the current and new password.' });
      return;
    }
    if (!body || typeof body !== 'object') {
      json(response, 400, { ok: false, error: 'Send the current and new password.' });
      return;
    }
    if (!(await auth.authenticate(user.username, body.currentPassword))) {
      json(response, 400, { ok: false, error: 'The current password is incorrect.' });
      return;
    }
    let recoveryUsed = false;
    if (user.mfaEnabled) {
      let mfaOk = await auth.verifyMfaCode(user.id, body.code);
      if (!mfaOk) {
        mfaOk = await auth.consumeMfaRecovery(user.id, body.code);
        recoveryUsed = mfaOk;
      }
      if (!mfaOk) {
        json(response, 400, { ok: false, code: 'mfa', mfaRequired: true, error: 'Enter the current authenticator code.' });
        return;
      }
    }
    const result = await auth.updateUser(user.id, { password: body.newPassword });
    if (!result.ok) {
      json(response, 400, result);
      return;
    }
    appendServerEvent(user, 'account.password.change', user.username);
    const session = await auth.createSession(user.id, request.headers['user-agent'] || '');
    json(
      response,
      200,
      { ok: true, user: result.user, ...(recoveryUsed ? { mfaRecoveryUsed: true } : {}) },
      {
        'set-cookie': `${SESSION_COOKIE}=${encodeURIComponent(session.token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${cookieSecure(request)}`,
      },
    );
    return;
  }

  if (pathname === '/api/auth/logins' && request.method === 'GET') {
    if (!(await requireOwner(request, response))) return;
    json(response, 200, { ok: true, events: await auth.listLoginEvents(50) });
    return;
  }

  if (pathname === '/api/server-audit' && request.method === 'GET') {
    if (!(await requireOwner(request, response))) return;
    const rawRows = postgresStore
      ? await postgresStore.listWorkspaceAudit(100)
      : selectWorkspaceAudit?.all(100) ?? [];
    const rows = rawRows.map((row) => ({
      at: row.at,
      userId: row.user_id,
      username: row.username,
      role: row.role,
      rev: row.rev,
      bytes: row.bytes,
      prevHash: row.prev_hash,
      hash: row.hash,
    }));
    const rawEvents = postgresStore
      ? await postgresStore.listServerEvents(100)
      : selectServerEvents?.all(100) ?? [];
    const events = rawEvents.map((event) => ({
      at: event.at,
      userId: event.user_id,
      username: event.username,
      role: event.role,
      action: event.action,
      target: event.target,
      detail: event.detail,
      prevHash: event.prev_hash,
      hash: event.hash,
    }));
    json(response, 200, {
      ok: true,
      rows,
      chain: await verifyWorkspaceAuditChain(),
      events,
      eventChain: await verifyServerEventChain(),
    });
    return;
  }

  if (pathname === '/api/auth/sessions' && request.method === 'GET') {
    if (!(await requireOwner(request, response))) return;
    json(response, 200, { ok: true, sessions: await auth.listSessions() });
    return;
  }

  const revokeSessionMatch = pathname.match(/^\/api\/auth\/sessions\/([^/]+)$/);
  if (revokeSessionMatch && request.method === 'DELETE') {
    if (!(await requireOwner(request, response))) return;
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin session changes are not allowed.' });
      return;
    }
    let id;
    try {
      id = decodeURIComponent(revokeSessionMatch[1]);
    } catch {
      json(response, 400, { ok: false, error: 'Invalid session id.' });
      return;
    }
    json(response, 200, { ok: true, ...(await auth.deleteSessionById(id)) });
    return;
  }

  const mfaMatch = pathname.match(/^\/api\/auth\/users\/([^/]+)\/mfa$/);
  if (mfaMatch && (request.method === 'POST' || request.method === 'DELETE')) {
    const actor = await requireOwner(request, response);
    if (!actor) return;
    if (neonAuth) {
      json(response, 501, {
        ok: false,
        error: 'Neon Managed Auth does not support TOTP/MFA on this branch.',
      });
      return;
    }
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin two-step changes are not allowed.' });
      return;
    }
    let id;
    try {
      id = decodeURIComponent(mfaMatch[1]);
    } catch {
      json(response, 400, { ok: false, error: 'Invalid account id.' });
      return;
    }
    if (request.method === 'DELETE') {
      const account = await auth.getUser(id);
      const result = await auth.disableMfa(id);
      if (result.ok) appendServerEvent(actor, 'account.mfa.disable', account?.username ?? id);
      json(response, result.ok ? 200 : 400, result);
      return;
    }
    const account = await auth.getUser(id);
    if (!account) {
      json(response, 404, { ok: false, error: 'Account not found.' });
      return;
    }
    if (account.mfaEnabled) {
      json(response, 400, { ok: false, error: 'Two-step verification is already enabled.' });
      return;
    }
    const secret = generateTotpSecret();
    const recoveryCode = randomBytes(8).toString('hex').toUpperCase();
    const result = await auth.enableMfa(id, secret, recoveryCode);
    if (result.ok) appendServerEvent(actor, 'account.mfa.enable', account.username);
    json(response, result.ok ? 200 : 400, {
      ...result,
      secret,
      recoveryCode,
      uri: totpUri(account.username, secret),
    });
    return;
  }

  if (pathname === '/api/auth/users' && request.method === 'GET') {
    if (!(await requireOwner(request, response))) return;
    json(response, 200, { ok: true, users: await auth.listUsers() });
    return;
  }

  const sessionsMatch = pathname.match(/^\/api\/auth\/users\/([^/]+)\/sessions$/);
  if (sessionsMatch && request.method === 'DELETE') {
    const actor = await requireOwner(request, response);
    if (!actor) return;
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin session changes are not allowed.' });
      return;
    }
    let id;
    try {
      id = decodeURIComponent(sessionsMatch[1]);
    } catch {
      json(response, 400, { ok: false, error: 'Invalid account id.' });
      return;
    }
    if (id === actor.id) {
      json(response, 400, { ok: false, error: 'Use Sign out to end your own session.' });
      return;
    }
    const result = await auth.deleteUserSessions(id);
    appendServerEvent(actor, 'account.sessions.revoke', (await auth.getUser(id))?.username ?? id);
    json(response, 200, { ok: true, removed: result.removed });
    return;
  }

  if (pathname === '/api/auth/users' && request.method === 'POST') {
    const actor = await requireOwner(request, response);
    if (!actor) return;
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin account changes are not allowed.' });
      return;
    }
    try {
      const body = JSON.parse(await readBody(request));
      if (!body || typeof body !== 'object') throw new Error('account');
      if (neonAuth) {
        if (!String(body.email ?? '').trim()) {
          json(response, 400, { ok: false, error: 'An email address is required to link a Neon Auth account.' });
          return;
        }
        if (!body.password) body.password = randomBytes(24).toString('hex');
      }
      if (String(body.role) !== 'owner') {
        const scopeError = await companyScopeError(body.companyIds);
        if (scopeError) {
          json(response, 400, { ok: false, error: scopeError });
          return;
        }
      }
      const result = await auth.createUser(body);
      if (result.ok) appendServerEvent(actor, 'account.create', result.user.username, result.user.role);
      json(response, result.ok ? 200 : 400, result);
    } catch {
      json(response, 400, { ok: false, error: 'Send a JSON account.' });
    }
    return;
  }

  const match = pathname.match(/^\/api\/auth\/users\/([^/]+)$/);
  if (match && (request.method === 'PATCH' || request.method === 'DELETE')) {
    const actor = await requireOwner(request, response);
    if (!actor) return;
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin account changes are not allowed.' });
      return;
    }
    let id;
    try {
      id = decodeURIComponent(match[1]);
    } catch {
      json(response, 400, { ok: false, error: 'Invalid account id.' });
      return;
    }
    if (request.method === 'DELETE') {
      const account = await auth.getUser(id);
      const result = await auth.deleteUser(id, actor.id);
      if (result.ok) appendServerEvent(actor, 'account.delete', account?.username ?? id);
      json(response, result.ok ? 200 : 400, result);
      return;
    }
    try {
      const body = JSON.parse(await readBody(request));
      if (!body || typeof body !== 'object') throw new Error('account');
      if (neonAuth && body.password) {
        json(response, 501, {
          ok: false,
          error: 'Passwords are managed by Neon Auth. Ask the account holder to use the sign-in reset link.',
        });
        return;
      }
      const scopeError = await companyScopeError(body.companyIds);
      if (scopeError) {
        json(response, 400, { ok: false, error: scopeError });
        return;
      }
      const result = await auth.updateUser(id, body);
      if (result.ok) {
        appendServerEvent(
          actor,
          body.password ? 'account.password.reset' : 'account.update',
          result.user.username,
          result.user.role,
        );
      }
      json(response, result.ok ? 200 : 400, result);
    } catch {
      json(response, 400, { ok: false, error: 'Send a JSON account update.' });
    }
    return;
  }

  json(response, 404, { ok: false, error: 'Unknown authentication endpoint.' });
}

async function handleWorkspaceLeaseApi(request, response) {
  const user = await requireUser(request, response);
  if (!user) return;
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    response.writeHead(405, { allow: 'POST, DELETE' });
    response.end();
    return;
  }
  if (!sameOrigin(request)) {
    json(response, 403, { ok: false, error: 'Cross-origin lease changes are not allowed.' });
    return;
  }
  if (user.role === 'viewer') {
    json(response, 403, { ok: false, error: 'Viewer accounts are read-only.' });
    return;
  }
  if (!workspaceStore) {
    json(response, 501, {
      ok: false,
      code: 'unsupported',
      error: 'Record leases require server workspace storage.',
    });
    return;
  }
  let body;
  try {
    body = JSON.parse(await readBody(request));
  } catch {
    json(response, 400, { ok: false, error: 'Send a JSON lease request.' });
    return;
  }
  if (!body || typeof body !== 'object') {
    json(response, 400, { ok: false, error: 'Send a JSON lease request.' });
    return;
  }
  const companyId = String(body.companyId ?? '').trim();
  const recordType = String(body.recordType ?? '').trim();
  const recordId = String(body.recordId ?? '').trim();
  if (!companyId || !['voucher', 'ledger', 'stock_item', 'company'].includes(recordType)) {
    json(response, 400, { ok: false, error: 'Choose a company and a supported record type.' });
    return;
  }
  if (!recordId || recordId.length > 120) {
    json(response, 400, { ok: false, error: 'A valid record id is required.' });
    return;
  }
  if (String(body.token ?? '').length > 256) {
    json(response, 400, { ok: false, error: 'Invalid lease token.' });
    return;
  }
  const state = (await workspaceStore.read()).state;
  const company = (state?.companies ?? []).find((entry) => entry.id === companyId);
  if (!company) {
    json(response, 404, { ok: false, error: 'Company not found.' });
    return;
  }
  const allowed = allowedCompanyIds(user);
  if (allowed && !allowed.has(companyId)) {
    json(response, 403, { ok: false, error: 'That company is outside this account\'s access.' });
    return;
  }
  if (recordType === 'company' && recordId !== companyId) {
    json(response, 400, { ok: false, error: 'Company leases must target the selected company.' });
    return;
  }
  if (request.method === 'POST') {
    const result = await workspaceStore.acquireLease({
      companyId,
      recordType,
      recordId,
      user,
      token: String(body.token ?? ''),
      ttlMs: body.ttlMs,
    });
    if (!result.ok) {
      json(response, 409, {
        ok: false,
        code: 'locked',
        error: `${result.holder?.username ?? 'Another user'} is editing this record.`,
        holder: result.holder,
      });
      return;
    }
    json(response, 200, { ok: true, ...result });
    return;
  }
  const result = await workspaceStore.releaseLease({
    companyId,
    recordType,
    recordId,
    token: String(body.token ?? ''),
  });
  if (!result.ok) {
    json(response, 409, {
      ok: false,
      code: 'locked',
      error: 'That record lease is held by another session.',
      holder: result.holder,
    });
    return;
  }
  json(response, 200, { ok: true, ...result });
}

async function handleWorkspaceApi(request, response, url) {
  const user = await requireUser(request, response);
  if (!user) return;
  if ((request.method === 'PUT' || request.method === 'DELETE') && !sameOrigin(request)) {
    json(response, 403, { ok: false, error: 'Cross-origin workspace changes are not allowed.' });
    return;
  }
  if (request.method === 'PUT' && user.role === 'viewer') {
    json(response, 403, { ok: false, error: 'Viewer accounts are read-only.' });
    return;
  }
  if (request.method === 'DELETE' && user.role !== 'owner') {
    json(response, 403, { ok: false, error: 'Only an owner can clear the workspace.' });
    return;
  }
  if (request.method === 'GET') {
    try {
      const saved = await readWorkspaceEnvelope();
      if (url.searchParams.get('meta') === '1') {
        json(response, 200, { ok: true, rev: saved.rev, updatedAt: saved.updatedAt, storage });
      } else {
        json(response, 200, {
          ok: true,
          state: filterWorkspaceForUser(saved.state, user),
          rev: saved.rev,
          updatedAt: saved.updatedAt,
          storage,
        });
      }
    } catch {
      json(response, 500, { ok: false, error: 'Could not read the server workspace.' });
    }
    return;
  }
  if (request.method === 'PUT') {
    try {
      const body = JSON.parse(await readBody(request));
      if (!body || !body.state || !Array.isArray(body.state.companies)) {
        json(response, 400, { ok: false, error: 'Workspace state must contain companies.' });
        return;
      }
      const baseRev = Number(body.baseRev);
      if (!Number.isInteger(baseRev) || baseRev < 0) {
        json(response, 400, { ok: false, error: 'A workspace base revision is required.' });
        return;
      }
      const result = await enqueueWorkspaceWrite(() =>
        writeWorkspace(body.state, baseRev, user, body.leaseToken),
      );
      if (result.locked) {
        json(response, 423, {
          ok: false,
          code: 'locked',
          error: result.error,
          holder: result.holder,
          storage,
        });
        return;
      }
      if (result.forbidden) {
        json(response, 403, { ok: false, error: result.error });
        return;
      }
      if (result.conflict) {
        json(response, 409, {
          ok: false,
          code: 'conflict',
          error: result.mergeError || 'The server workspace changed since this copy was loaded.',
          rev: result.rev,
          updatedAt: result.updatedAt,
          mergeError: result.mergeError || '',
          storage,
        });
        return;
      }
      json(response, 200, {
        ok: true,
        rev: result.rev,
        updatedAt: result.updatedAt,
        merged: Boolean(result.merged),
        renumbered: Number(result.renumbered) || 0,
        ...(result.state ? { state: filterWorkspaceForUser(result.state, user) } : {}),
        storage,
      });
      scheduleServerBackupCheck();
    } catch (error) {
      json(response, 400, { ok: false, error: error.message || 'Could not save the server workspace.' });
    }
    return;
  }
  if (request.method === 'DELETE') {
    try {
      await enqueueWorkspaceWrite(async () => {
        if (workspaceStore) {
          await workspaceStore.clear();
          return;
        }
        try {
          await unlink(legacyWorkspaceFile);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      });
    } catch {
      json(response, 500, { ok: false, error: 'Could not clear the server workspace.' });
      return;
    }
    appendServerEvent(user, 'workspace.clear', '', 'Server workspace cleared');
    json(response, 200, { ok: true, rev: 0, storage });
    return;
  }
  response.writeHead(405, { allow: 'GET, PUT, DELETE' });
  response.end();
}

async function readVerifiedBackup(name) {
  const target = join(backupDir, name);
  let info;
  try {
    info = await stat(target);
  } catch (error) {
    if (error.code !== 'ENOENT' || !r2Config) throw error;
    const body = await readServerBackupBytes(name);
    await mkdir(backupDir, { recursive: true, mode: 0o700 });
    await writeFile(target, body, { mode: 0o600 });
    info = await stat(target);
  }
  if (!info.isFile()) throw new Error('Backup not found.');
  if (name.endsWith('.json')) {
    const saved = JSON.parse(await readFile(target, 'utf8'));
    if (!saved?.state || !Array.isArray(saved.state.companies)) {
      throw new Error('The backup does not contain a readable workspace.');
    }
    return { snapshot: saved, info };
  }
  const copy = new DatabaseSync(target, { readOnly: true });
  try {
    const check = copy.prepare('PRAGMA integrity_check').get();
    if (String(Object.values(check ?? {})[0] ?? '').toLowerCase() !== 'ok') {
      throw new Error('The backup failed its integrity check.');
    }
    const snapshot = readWorkspaceSnapshot(copy);
    if (!snapshot?.state || !Array.isArray(snapshot.state.companies)) {
      throw new Error('The backup does not contain a readable workspace.');
    }
    return { snapshot, info };
  } finally {
    copy.close();
  }
}

async function restoreServerBackup(name, user) {
  const { snapshot, info } = await readVerifiedBackup(name);
  const preRestore = await queueServerBackup('prerestore');
  return enqueueWorkspaceWrite(async () => {
    const current = await workspaceStore.read();
    const updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(snapshot.state);
    const result = await workspaceStore.write(snapshot.state, Number(current.rev), {
      updatedAt,
      afterWrite: postgresStore
        ? (rev, auditClient) =>
            postgresStore.appendWorkspaceAudit(
              {
                at: updatedAt,
                user_id: user.id,
                username: user.username,
                role: user.role,
                rev,
                bytes: Buffer.byteLength(serialized),
              },
              auditClient,
            )
        : (rev) => appendWorkspaceAudit(updatedAt, user, rev, Buffer.byteLength(serialized)),
    });
    if (result.conflict || result.forbidden) {
      throw new Error(result.error || 'The workspace changed while restoring the backup.');
    }
    return {
      rev: result.rev,
      updatedAt,
      preRestore,
      backup: { name, bytes: info.size, createdAt: info.mtime.toISOString() },
    };
  });
}

async function handleBackupApi(request, response, url) {
  const user = await requireOwner(request, response);
  if (!user) return;
  if (!workspaceStore || (!postgresStore && (!db || !sqliteBackup))) {
    json(response, 501, { ok: false, error: 'Server backups require server storage on this server.' });
    return;
  }
  const pathname = url.pathname;
  const prefix = '/api/backups/';
  const restoreMatch = pathname.match(/^\/api\/backups\/([^/]+)\/restore$/);
  if (request.method === 'POST' && restoreMatch) {
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin restore requests are not allowed.' });
      return;
    }
    let name;
    try {
      name = decodeURIComponent(restoreMatch[1]);
    } catch {
      json(response, 400, { ok: false, error: 'Invalid backup name.' });
      return;
    }
    if (!BACKUP_NAME.test(name)) {
      json(response, 400, { ok: false, error: 'Invalid backup name.' });
      return;
    }
    try {
      const restored = await restoreServerBackup(name, user);
      appendServerEvent(user, 'workspace.restore', name, `Revision ${restored.rev}`);
      json(response, 200, { ok: true, ...restored });
    } catch (error) {
      const missing = error.code === 'ENOENT';
      json(response, missing ? 404 : 500, {
        ok: false,
        error: missing ? 'Backup not found.' : error.message || 'Could not restore the backup.',
      });
    }
    return;
  }
  if (request.method === 'POST' && pathname === '/api/backups') {
    if (!sameOrigin(request)) {
      json(response, 403, { ok: false, error: 'Cross-origin backup requests are not allowed.' });
      return;
    }
    try {
      const backup = await queueServerBackup('manual');
      appendServerEvent(user, 'backup.create', backup.name);
      json(response, 200, { ok: true, backup });
    } catch (error) {
      json(response, 500, { ok: false, error: error.message || 'Could not create the server backup.' });
    }
    return;
  }
  if (request.method === 'GET' && pathname === '/api/backups') {
    try {
      json(response, 200, {
        ok: true,
        backups: await listServerBackups(),
        keep: backupKeep,
        hours: backupHours,
        offsite: { configured: Boolean(r2Config), bucket: r2Config?.bucket ?? '' },
      });
    } catch {
      json(response, 500, { ok: false, error: 'Could not list server backups.' });
    }
    return;
  }
  if (request.method === 'GET' && pathname.startsWith(prefix)) {
    let name;
    try {
      name = decodeURIComponent(pathname.slice(prefix.length));
    } catch {
      json(response, 400, { ok: false, error: 'Invalid backup name.' });
      return;
    }
    if (!BACKUP_NAME.test(name)) {
      json(response, 400, { ok: false, error: 'Invalid backup name.' });
      return;
    }
    try {
      const body = await readServerBackupBytes(name);
      response.writeHead(200, {
        'content-type': name.endsWith('.json') ? 'application/json; charset=utf-8' : 'application/vnd.sqlite3',
        'content-disposition': `attachment; filename="${name}"`,
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch {
      json(response, 404, { ok: false, error: 'Backup not found.' });
    }
    return;
  }
  response.writeHead(405, { allow: 'GET, POST' });
  response.end();
}

export async function requestHandler(request, response) {
  for (const [name, value] of Object.entries(securityHeaders())) response.setHeader(name, value);
  if (!allowedClient(clientIp(request))) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Client address is not allowed by ZL_ALLOWED_IPS.');
    return;
  }
  let requestUrl;
  try {
    // The Host header is untrusted and only pathname/searchParams are used here.
    requestUrl = new URL(request.url ?? '/', 'http://localhost');
  } catch {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }
  const pathname = requestUrl.pathname;
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }
  if (pathname === '/api/internal/scheduler') {
    if (request.method !== 'POST' || !schedulerAuthorized(request)) {
      json(response, request.method === 'POST' ? 401 : 405, {
        ok: false,
        error: 'Scheduler authorization is required.',
      });
      return;
    }
    try {
      json(response, 200, { ok: true, ...(await runScheduledJobs()) });
    } catch (error) {
      json(response, 500, { ok: false, error: error.message || 'Scheduled jobs failed.' });
    }
    return;
  }
  if (pathname.startsWith('/api/reports/')) {
    await handleReportApi(request, response, requestUrl, pathname);
    return;
  }
  if (pathname.startsWith('/api/auth/')) {
    await handleAuthApi(request, response, requestUrl);
    return;
  }
  if (pathname === '/api/workspace/leases') {
    await handleWorkspaceLeaseApi(request, response);
    return;
  }
  if (pathname === '/api/workspace') {
    await handleWorkspaceApi(request, response, requestUrl);
    return;
  }
  if (pathname === '/api/backups' || pathname.startsWith('/api/backups/')) {
    await handleBackupApi(request, response, requestUrl);
    return;
  }
  if (pathname === '/api/server-audit') {
    await handleAuthApi(request, response, requestUrl);
    return;
  }
  if (decodedPath === '/data' || decodedPath.startsWith('/data/')) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }
  let target;
  try {
    target = resolvePath(request.url ?? '/');
  } catch {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }
  const dataRoot = resolve(dataDir);
  const backupRoot = resolve(backupDir);
  if (
    !target ||
    target === dataRoot ||
    target.startsWith(`${dataRoot}${sep}`) ||
    target === backupRoot ||
    target.startsWith(`${backupRoot}${sep}`)
  ) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }
  try {
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, 'index.html') : target;
    const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(file)]);
    if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${sep}`)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

function safeRequestHandler(request, response) {
  requestHandler(request, response).catch((error) => {
    console.error(`Request failed: ${error.message}`);
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Internal server error');
  });
}

let server;
if (tlsEnabled) {
  const [cert, key] = await Promise.all([readFile(tlsCertPath), readFile(tlsKeyPath)]);
  server = createHttpsServer({ cert, key }, safeRequestHandler);
} else {
  server = createHttpServer(safeRequestHandler);
}

function lanAddresses() {
  if (['127.0.0.1', 'localhost', '::1'].includes(host)) return [];
  const addresses = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      addresses.push(entry.address);
    }
  }
  return [...new Set(addresses)];
}

if (!functionMode) server.listen(port, host, () => {
  const scheme = tlsEnabled ? 'https' : 'http';
  const mode = authRequired ? 'authenticated' : 'local-development';
  const actualPort = server.address().port;
  console.log(`ZledgerCraft running at ${scheme}://${host}:${actualPort}/ (${storage} workspace, ${mode})`);
  for (const address of lanAddresses()) {
    console.log(`  LAN: ${scheme}://${address}:${actualPort}/`);
  }
  if (authRequired && !tlsEnabled && !neonAuth) {
    console.warn('  Warning: LAN passwords are being sent over plain HTTP. Provide TLS_CERT_PATH and TLS_KEY_PATH for encrypted access.');
  }
  if (neonAuth) console.log('Authentication: Neon Managed Auth.');
  if (!functionMode && workspaceStore && (postgresStore || (db && sqliteBackup))) {
    scheduleServerBackupCheck();
    setInterval(scheduleServerBackupCheck, backupHours * 3600000).unref?.();
    setTimeout(() => runScheduledJobs().catch((error) => console.error(`Scheduled jobs failed: ${error.message}`)), 5000).unref?.();
    setInterval(
      () => runScheduledJobs().catch((error) => console.error(`Scheduled jobs failed: ${error.message}`)),
      3600000,
    ).unref?.();
  }
});

// ZledgerCraft - server accounts, password hashes and session tokens.
// Node-only: uses the built-in SQLite database opened by serve.mjs.
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const ROLES = new Set(['owner', 'accountant', 'viewer']);
const SESSION_DAYS = 7;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;
export const AUTH_LIMITS = Object.freeze({
  sessionDays: SESSION_DAYS,
  loginWindowMs: LOGIN_WINDOW_MS,
  loginLockMs: LOGIN_LOCK_MS,
  loginMaxFailures: LOGIN_MAX_FAILURES,
});
export const USERNAME_PATTERN = USERNAME;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_MINUTES = 30;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value) {
  let bits = 0;
  let current = 0;
  const output = [];
  for (const character of String(value).toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    const index = BASE32.indexOf(character);
    if (index < 0) continue;
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function totpAt(secret, counter) {
  const key = base32Decode(secret);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret, at = Date.now()) {
  return totpAt(secret, Math.floor(at / 30_000));
}

export function totpCounter(secret, code, window = 1, at = Date.now()) {
  const normalized = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return null;
  const counter = Math.floor(at / 30_000);
  for (let offset = -window; offset <= window; offset += 1) {
    if (totpAt(secret, counter + offset) === normalized) return counter + offset;
  }
  return null;
}

export function verifyTotp(secret, code, window = 1, at = Date.now()) {
  return totpCounter(secret, code, window, at) !== null;
}

export function totpUri(username, secret, issuer = 'ZledgerCraft') {
  const label = encodeURIComponent(`${issuer}:${username}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const actual = scryptSync(String(password), salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function sessionHash(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function parseCompanyIds(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return [...new Set(value.map(String))];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? [...new Set(parsed.map(String))] : null;
  } catch {
    return null;
  }
}

export function normalizeCompanyIds(value) {
  if (value === undefined || value === null) return { ids: null };
  if (!Array.isArray(value)) return { error: 'Company access must be a list of company ids.' };
  const ids = [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
  if (ids.some((id) => id.length > 100)) return { error: 'A company id is too long.' };
  return { ids };
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    email: row.email || '',
    companyIds: parseCompanyIds(row.company_ids),
    mfaEnabled: Boolean(row.mfa_secret),
    createdAt: row.created_at,
  };
}

export function validPassword(password) {
  const value = String(password ?? '');
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (value.length > 200) return 'Password must be 200 characters or fewer.';
  return '';
}

export function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function emailError(value) {
  const email = normalizeEmail(value);
  if (!email) return '';
  if (email.length > 200) return 'Email must be 200 characters or fewer.';
  if (!EMAIL.test(email)) return 'Enter a valid email address.';
  return '';
}

export class AuthStore {
  constructor(db) {
    this.db = db;
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'accountant', 'viewer')),
        password_hash TEXT NOT NULL,
        email TEXT,
        company_ids TEXT,
        neon_user_id TEXT,
        mfa_secret TEXT,
        mfa_recovery_hash TEXT,
        mfa_last_counter INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        id TEXT,
        user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        user_agent TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id);
      CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS auth_login_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        username TEXT NOT NULL,
        user_id TEXT,
        ok INTEGER NOT NULL,
        ip TEXT NOT NULL,
        user_agent TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_login_events_at ON auth_login_events(at);
      CREATE TABLE IF NOT EXISTS auth_login_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        first_at TEXT NOT NULL,
        locked_until TEXT
      );
      CREATE TABLE IF NOT EXISTS auth_password_resets (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_password_resets_user ON auth_password_resets(user_id);
      CREATE INDEX IF NOT EXISTS auth_password_resets_expiry ON auth_password_resets(expires_at);
    `);
    const columns = this.db.prepare('PRAGMA table_info(auth_users)').all();
    if (!columns.some((column) => column.name === 'email')) {
      this.db.exec('ALTER TABLE auth_users ADD COLUMN email TEXT');
    }
    if (!columns.some((column) => column.name === 'company_ids')) {
      this.db.exec('ALTER TABLE auth_users ADD COLUMN company_ids TEXT');
    }
    if (!columns.some((column) => column.name === 'neon_user_id')) {
      this.db.exec('ALTER TABLE auth_users ADD COLUMN neon_user_id TEXT');
    }
    this.db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS auth_users_neon_id ON auth_users(neon_user_id) WHERE neon_user_id IS NOT NULL',
    );
    this.db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email ON auth_users(email) WHERE email IS NOT NULL AND email <> \'\'',
    );
    if (!columns.some((column) => column.name === 'mfa_secret')) {
      this.db.exec('ALTER TABLE auth_users ADD COLUMN mfa_secret TEXT');
    }
    if (!columns.some((column) => column.name === 'mfa_recovery_hash')) {
      this.db.exec('ALTER TABLE auth_users ADD COLUMN mfa_recovery_hash TEXT');
    }
    if (!columns.some((column) => column.name === 'mfa_last_counter')) {
      this.db.exec('ALTER TABLE auth_users ADD COLUMN mfa_last_counter INTEGER NOT NULL DEFAULT 0');
    }
    const sessionColumns = this.db.prepare('PRAGMA table_info(auth_sessions)').all();
    if (!sessionColumns.some((column) => column.name === 'id')) {
      this.db.exec('ALTER TABLE auth_sessions ADD COLUMN id TEXT');
    }
    this.db.exec('UPDATE auth_sessions SET id = token_hash WHERE id IS NULL OR id = \'\'');
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_public_id ON auth_sessions(id)');
    this.db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(nowIso());
    this.db.prepare('DELETE FROM auth_password_resets WHERE expires_at <= ?').run(nowIso());
    this.stmts = {
      count: this.db.prepare('SELECT COUNT(*) AS count FROM auth_users'),
      byUsername: this.db.prepare('SELECT * FROM auth_users WHERE username = ?'),
      byEmail: this.db.prepare('SELECT * FROM auth_users WHERE email = ?'),
      byNeonId: this.db.prepare('SELECT * FROM auth_users WHERE neon_user_id = ?'),
      byId: this.db.prepare('SELECT * FROM auth_users WHERE id = ?'),
      list: this.db.prepare('SELECT * FROM auth_users ORDER BY created_at, username'),
      owners: this.db.prepare("SELECT COUNT(*) AS count FROM auth_users WHERE role = 'owner'"),
      insertUser: this.db.prepare(`
        INSERT INTO auth_users (id, username, name, role, password_hash, email, company_ids, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateUser: this.db.prepare(`
        UPDATE auth_users SET name = ?, role = ?, password_hash = ?, email = ?, company_ids = ?, updated_at = ? WHERE id = ?
      `),
      updatePassword: this.db.prepare(
        'UPDATE auth_users SET password_hash = ?, updated_at = ? WHERE id = ?',
      ),
      insertPasswordReset: this.db.prepare(`
        INSERT INTO auth_password_resets (token_hash, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `),
      passwordReset: this.db.prepare(`
        SELECT u.* FROM auth_password_resets r
        JOIN auth_users u ON u.id = r.user_id
        WHERE r.token_hash = ? AND r.expires_at > ?
      `),
      deletePasswordResets: this.db.prepare('DELETE FROM auth_password_resets WHERE user_id = ?'),
      updateMfa: this.db.prepare(
        'UPDATE auth_users SET mfa_secret = ?, mfa_recovery_hash = ?, mfa_last_counter = 0, updated_at = ? WHERE id = ?',
      ),
      consumeMfaCounter: this.db.prepare(
        'UPDATE auth_users SET mfa_last_counter = ?, updated_at = ? WHERE id = ? AND mfa_last_counter < ?',
      ),
      deleteUser: this.db.prepare('DELETE FROM auth_users WHERE id = ?'),
      insertSession: this.db.prepare(`
        INSERT INTO auth_sessions (token_hash, id, user_id, created_at, expires_at, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      session: this.db.prepare(`
        SELECT u.* FROM auth_sessions s
        JOIN auth_users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?
      `),
      listSessions: this.db.prepare(`
        SELECT s.id, s.user_id, s.created_at, s.expires_at, s.user_agent, u.username
        FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
        WHERE s.expires_at > ?
        ORDER BY s.created_at DESC
      `),
      deleteSession: this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?'),
      deleteSessionById: this.db.prepare('DELETE FROM auth_sessions WHERE id = ?'),
      deleteUserSessions: this.db.prepare('DELETE FROM auth_sessions WHERE user_id = ?'),
      insertLoginEvent: this.db.prepare(`
        INSERT INTO auth_login_events (at, username, user_id, ok, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      listLoginEvents: this.db.prepare('SELECT * FROM auth_login_events ORDER BY id DESC LIMIT ?'),
      pruneLoginEvents: this.db.prepare(`
        DELETE FROM auth_login_events
        WHERE id NOT IN (SELECT id FROM auth_login_events ORDER BY id DESC LIMIT 1000)
      `),
      loginLimit: this.db.prepare('SELECT * FROM auth_login_limits WHERE key = ?'),
      saveLoginLimit: this.db.prepare(`
        INSERT INTO auth_login_limits (key, count, first_at, locked_until)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          count = excluded.count,
          first_at = excluded.first_at,
          locked_until = excluded.locked_until
      `),
      deleteLoginLimit: this.db.prepare('DELETE FROM auth_login_limits WHERE key = ?'),
    };
  }

  hasUsers() {
    return Number(this.stmts.count.get()?.count ?? 0) > 0;
  }

  createUser(input = {}) {
    const username = normalizeUsername(input.username);
    const name = String(input.name ?? '').trim();
    const role = String(input.role ?? '').trim();
    const email = normalizeEmail(input.email);
    const emailValidation = emailError(email);
    if (emailValidation) return { ok: false, error: emailValidation };
    const passwordError = validPassword(input.password);
    if (!USERNAME.test(username)) {
      return {
        ok: false,
        error: 'Username must be 3–40 characters: letters, numbers, dot, underscore or hyphen.',
      };
    }
    if (!name || name.length > 80) {
      return { ok: false, error: 'Name is required and must be 80 characters or fewer.' };
    }
    if (!ROLES.has(role)) return { ok: false, error: 'Choose a valid role.' };
    if (passwordError) return { ok: false, error: passwordError };
    const scope = role === 'owner' ? { ids: null } : normalizeCompanyIds(input.companyIds);
    if (scope.error) return { ok: false, error: scope.error };
    if (this.stmts.byUsername.get(username)) {
      return { ok: false, error: `Username "${username}" already exists.` };
    }
    if (email && this.stmts.byEmail.get(email)) {
      return { ok: false, error: 'That email address is already used by another account.' };
    }
    const id = `usr_${randomBytes(12).toString('hex')}`;
    const at = nowIso();
    try {
      this.stmts.insertUser.run(
        id,
        username,
        name,
        role,
        hashPassword(input.password),
        email || null,
        scope.ids === null ? null : JSON.stringify(scope.ids),
        at,
        at,
      );
    } catch (error) {
      return { ok: false, error: error.message || 'Could not create the account.' };
    }
    return { ok: true, user: publicUser(this.stmts.byId.get(id)) };
  }

  ensureOwner(input = {}) {
    if (this.hasUsers()) return { ok: true, created: false };
    const result = this.createUser({
      username: input.username || 'owner',
      name: input.name || 'Owner',
      role: 'owner',
      password: input.password,
      email: input.email || '',
    });
    return result.ok ? { ...result, created: true } : result;
  }

  findUserByIdentifier(identifier) {
    const value = String(identifier ?? '').trim();
    if (!value) return null;
    const row = this.stmts.byUsername.get(normalizeUsername(value)) || this.stmts.byEmail.get(normalizeEmail(value));
    return row ? publicUser(row) : null;
  }

  findUserByNeonId(neonUserId) {
    const value = String(neonUserId ?? '').trim();
    if (!value) return null;
    return publicUser(this.stmts.byNeonId.get(value));
  }

  linkNeonUser(userId, neonUserId) {
    const row = this.stmts.byId.get(String(userId ?? ''));
    const neonId = String(neonUserId ?? '').trim();
    if (!row || !neonId) return { ok: false, error: 'Account or Neon identity is missing.' };
    const existing = this.stmts.byNeonId.get(neonId);
    if (existing && existing.id !== row.id) {
      return { ok: false, error: 'That Neon Auth account is already linked to another profile.' };
    }
    try {
      this.db
        .prepare('UPDATE auth_users SET neon_user_id = ?, updated_at = ? WHERE id = ?')
        .run(neonId, nowIso(), row.id);
    } catch (error) {
      return { ok: false, error: error.message || 'Could not link the Neon Auth account.' };
    }
    return { ok: true, user: publicUser(this.stmts.byId.get(row.id)) };
  }

  ensureNeonUser({ neonUserId, email, name } = {}) {
    const neonId = String(neonUserId ?? '').trim();
    if (!neonId) return { ok: false, error: 'Neon Auth did not return a user id.' };
    const linked = this.findUserByNeonId(neonId);
    if (linked) return { ok: true, created: false, user: linked };
    const normalizedEmail = normalizeEmail(email);
    const byEmail = normalizedEmail ? this.stmts.byEmail.get(normalizedEmail) : null;
    if (byEmail) {
      const linkedResult = this.linkNeonUser(byEmail.id, neonId);
      return linkedResult.ok
        ? { ok: true, created: false, user: linkedResult.user }
        : linkedResult;
    }
    if (this.hasUsers()) {
      return {
        ok: false,
        error:
          'This Neon Auth account is not linked to a ZledgerCraft profile. Ask an owner to add this email address first.',
      };
    }
    const local = normalizedEmail.split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 40);
    let username = local.length >= 3 ? local : 'owner';
    let suffix = 1;
    while (this.stmts.byUsername.get(username)) {
      username = `${local || 'owner'}${suffix}`.slice(0, 40);
      suffix += 1;
    }
    const result = this.createUser({
      username,
      name: String(name || username).slice(0, 80),
      role: 'owner',
      password: randomBytes(32).toString('hex'),
      email: normalizedEmail,
    });
    if (!result.ok) return result;
    const linkedResult = this.linkNeonUser(result.user.id, neonId);
    return linkedResult.ok
      ? { ok: true, created: true, user: linkedResult.user }
      : linkedResult;
  }

  createPasswordReset(identifier, now = new Date()) {
    const row =
      this.stmts.byUsername.get(normalizeUsername(identifier)) ||
      this.stmts.byEmail.get(normalizeEmail(identifier));
    if (!row?.email) return null;
    const token = randomBytes(32).toString('hex');
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + RESET_MINUTES * 60_000).toISOString();
    this.stmts.deletePasswordResets.run(row.id);
    this.stmts.insertPasswordReset.run(sessionHash(token), row.id, createdAt, expiresAt);
    return { user: publicUser(row), token, expiresAt, expiresMinutes: RESET_MINUTES };
  }

  consumePasswordReset(token, newPassword, now = new Date()) {
    const passwordError = validPassword(newPassword);
    if (passwordError) return { ok: false, error: passwordError };
    const row = this.stmts.passwordReset.get(sessionHash(token), now.toISOString());
    if (!row) return { ok: false, error: 'This password-reset link is invalid or has expired.' };
    const updatedAt = now.toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.stmts.updatePassword.run(hashPassword(newPassword), updatedAt, row.id);
      this.stmts.deletePasswordResets.run(row.id);
      this.stmts.deleteUserSessions.run(row.id);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      return { ok: false, error: error.message || 'Could not reset the password.' };
    }
    return { ok: true, user: publicUser(this.stmts.byId.get(row.id)) };
  }

  authenticate(username, password) {
    const row = this.stmts.byUsername.get(normalizeUsername(username));
    if (!row || !verifyPassword(password, row.password_hash)) return null;
    return publicUser(row);
  }

  createSession(userId, userAgent = '') {
    const token = randomBytes(32).toString('hex');
    const id = randomBytes(12).toString('hex');
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + SESSION_DAYS * 86400000);
    this.stmts.insertSession.run(
      sessionHash(token),
      id,
      userId,
      createdAt.toISOString(),
      expiresAt.toISOString(),
      String(userAgent).slice(0, 300),
    );
    return { token, id, expiresAt: expiresAt.toISOString() };
  }

  listSessions() {
    return this.stmts.listSessions.all(nowIso()).map((row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      userAgent: row.user_agent,
    }));
  }

  deleteSessionById(id) {
    const result = this.stmts.deleteSessionById.run(String(id ?? ''));
    return { ok: true, removed: Number(result.changes) || 0 };
  }

  sessionUser(token) {
    if (!token) return null;
    const row = this.stmts.session.get(sessionHash(token), nowIso());
    return publicUser(row);
  }

  deleteSession(token) {
    if (token) this.stmts.deleteSession.run(sessionHash(token));
  }

  enableMfa(userId, secret, recoveryCode = '') {
    const row = this.stmts.byId.get(String(userId ?? ''));
    if (!row) return { ok: false, error: 'Account not found.' };
    if (row.mfa_secret) return { ok: false, error: 'Two-step verification is already enabled.' };
    this.stmts.updateMfa.run(
      String(secret),
      recoveryCode ? sessionHash(recoveryCode) : null,
      nowIso(),
      row.id,
    );
    return { ok: true, user: publicUser(this.stmts.byId.get(row.id)) };
  }

  disableMfa(userId) {
    const row = this.stmts.byId.get(String(userId ?? ''));
    if (!row) return { ok: false, error: 'Account not found.' };
    this.stmts.updateMfa.run(null, null, nowIso(), row.id);
    return { ok: true, user: publicUser(this.stmts.byId.get(row.id)) };
  }

  mfaSecret(userId) {
    return this.stmts.byId.get(String(userId ?? ''))?.mfa_secret || '';
  }

  verifyMfaCode(userId, code, at = Date.now()) {
    const row = this.stmts.byId.get(String(userId ?? ''));
    if (!row?.mfa_secret) return false;
    const counter = totpCounter(row.mfa_secret, code, 1, at);
    if (counter === null || counter <= Number(row.mfa_last_counter ?? 0)) return false;
    const result = this.stmts.consumeMfaCounter.run(counter, nowIso(), row.id, counter);
    return Number(result.changes) === 1;
  }

  consumeMfaRecovery(userId, code) {
    const row = this.stmts.byId.get(String(userId ?? ''));
    const expected = row?.mfa_recovery_hash || '';
    if (!expected || !code) return false;
    const actual = sessionHash(String(code).replace(/\s/g, '').toUpperCase());
    if (actual.length !== expected.length) return false;
    const matches = timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
    if (!matches) return false;
    this.stmts.updateMfa.run(null, null, nowIso(), row.id);
    return true;
  }

  deleteUserSessions(userId) {
    const result = this.stmts.deleteUserSessions.run(String(userId ?? ''));
    return { ok: true, removed: Number(result.changes) || 0 };
  }

  loginLimit(key) {
    const row = this.stmts.loginLimit.get(String(key));
    if (!row) return { blocked: false, count: 0, retryAfterMs: 0 };
    const now = Date.now();
    const lockedUntil = row.locked_until ? Date.parse(row.locked_until) : 0;
    if (lockedUntil > now) return { blocked: true, count: Number(row.count), retryAfterMs: lockedUntil - now };
    const firstAt = Date.parse(row.first_at);
    if (!Number.isFinite(firstAt) || now - firstAt > LOGIN_WINDOW_MS) {
      this.stmts.deleteLoginLimit.run(String(key));
      return { blocked: false, count: 0, retryAfterMs: 0 };
    }
    return { blocked: false, count: Number(row.count) || 0, retryAfterMs: 0 };
  }

  recordFailure(key) {
    const current = this.loginLimit(key);
    const now = new Date();
    const count = current.count + 1;
    const lockedUntil = count >= LOGIN_MAX_FAILURES ? new Date(now.getTime() + LOGIN_LOCK_MS).toISOString() : null;
    this.stmts.saveLoginLimit.run(String(key), count, now.toISOString(), lockedUntil);
    return { blocked: Boolean(lockedUntil), count, retryAfterMs: lockedUntil ? LOGIN_LOCK_MS : 0 };
  }

  clearLoginFailures(key) {
    this.stmts.deleteLoginLimit.run(String(key));
  }

  recordLogin({ username = '', userId = null, ok = false, ip = '', userAgent = '' } = {}) {
    this.stmts.insertLoginEvent.run(
      nowIso(),
      String(username).slice(0, 40),
      userId ? String(userId) : null,
      ok ? 1 : 0,
      String(ip).slice(0, 100),
      String(userAgent).slice(0, 300),
    );
    this.stmts.pruneLoginEvents.run();
  }

  listLoginEvents(limit = 50) {
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    return this.stmts.listLoginEvents.all(safeLimit).map((row) => ({
      id: row.id,
      at: row.at,
      username: row.username,
      userId: row.user_id,
      ok: Boolean(row.ok),
      ip: row.ip,
      userAgent: row.user_agent,
    }));
  }

  listUsers() {
    return this.stmts.list.all().map(publicUser);
  }

  getUser(id) {
    return publicUser(this.stmts.byId.get(String(id ?? '')));
  }

  updateUser(id, input = {}) {
    const row = this.stmts.byId.get(String(id ?? ''));
    if (!row) return { ok: false, error: 'Account not found.' };
    const name = String(input.name ?? row.name).trim();
    const role = String(input.role ?? row.role);
    if (!name || name.length > 80) {
      return { ok: false, error: 'Name is required and must be 80 characters or fewer.' };
    }
    if (!ROLES.has(role)) return { ok: false, error: 'Choose a valid role.' };
    if (row.role === 'owner' && role !== 'owner' && Number(this.stmts.owners.get()?.count) <= 1) {
      return { ok: false, error: 'Keep at least one owner account.' };
    }
    let email = normalizeEmail(row.email);
    if (input.email !== undefined) {
      const validation = emailError(input.email);
      if (validation) return { ok: false, error: validation };
      email = normalizeEmail(input.email);
      const duplicate = email ? this.stmts.byEmail.get(email) : null;
      if (duplicate && duplicate.id !== row.id) {
        return { ok: false, error: 'That email address is already used by another account.' };
      }
    }
    let passwordHash = row.password_hash;
    if (input.password !== undefined && input.password !== '') {
      const passwordError = validPassword(input.password);
      if (passwordError) return { ok: false, error: passwordError };
      passwordHash = hashPassword(input.password);
    }
    let companyIds = parseCompanyIds(row.company_ids);
    if (role === 'owner') {
      companyIds = null;
    } else if (input.companyIds !== undefined) {
      const scope = normalizeCompanyIds(input.companyIds);
      if (scope.error) return { ok: false, error: scope.error };
      companyIds = scope.ids;
    }
    try {
      this.stmts.updateUser.run(
        name,
        role,
        passwordHash,
        email || null,
        companyIds === null ? null : JSON.stringify(companyIds),
        nowIso(),
        row.id,
      );
      if (input.password) this.stmts.deleteUserSessions.run(row.id);
      if (input.email !== undefined && email !== normalizeEmail(row.email)) {
        this.stmts.deletePasswordResets.run(row.id);
      }
    } catch (error) {
      return { ok: false, error: error.message || 'Could not update the account.' };
    }
    return { ok: true, user: publicUser(this.stmts.byId.get(row.id)) };
  }

  deleteUser(id, actorId) {
    const row = this.stmts.byId.get(String(id ?? ''));
    if (!row) return { ok: false, error: 'Account not found.' };
    if (row.id === String(actorId ?? '')) {
      return { ok: false, error: 'You cannot delete the account you are signed in with.' };
    }
    if (row.role === 'owner' && Number(this.stmts.owners.get()?.count) <= 1) {
      return { ok: false, error: 'Keep at least one owner account.' };
    }
    this.stmts.deleteUser.run(row.id);
    return { ok: true, user: publicUser(row) };
  }
}

export const AUTH_ROLES = Object.freeze([...ROLES]);

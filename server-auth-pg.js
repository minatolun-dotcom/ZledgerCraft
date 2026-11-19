// ZledgerCraft - Neon Postgres profiles, sessions and login state.
// The SQLite AuthStore remains the local/LAN implementation; this store keeps
// the same public shape so serve.mjs can await either implementation.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  AUTH_LIMITS,
  AUTH_ROLES,
  USERNAME_PATTERN,
  emailError,
  hashPassword,
  normalizeCompanyIds,
  normalizeEmail,
  normalizeUsername,
  nowIso,
  parseCompanyIds,
  publicUser,
  sessionHash,
  totpCounter,
  validPassword,
  verifyPassword,
} from './server-auth.js';

const ROLES = new Set(AUTH_ROLES);
const RESET_MINUTES = 30;

function timestamp(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function loginState(row, now = Date.now()) {
  if (!row) return { blocked: false, count: 0, retryAfterMs: 0 };
  const lockedUntil = timestamp(row.locked_until);
  if (lockedUntil > now) {
    return { blocked: true, count: Number(row.count), retryAfterMs: lockedUntil - now };
  }
  const firstAt = timestamp(row.first_at);
  if (!firstAt || now - firstAt > AUTH_LIMITS.loginWindowMs) {
    return { blocked: false, count: 0, retryAfterMs: 0 };
  }
  return { blocked: false, count: Number(row.count) || 0, retryAfterMs: 0 };
}

function sessionResult(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    userAgent: row.user_agent,
  };
}

export class PostgresAuthStore {
  constructor(pool) {
    this.pool = pool;
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS zl_auth_users (
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
        mfa_last_counter BIGINT NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS zl_auth_users_email
        ON zl_auth_users(email) WHERE email IS NOT NULL AND email <> '';
      CREATE UNIQUE INDEX IF NOT EXISTS zl_auth_users_neon_id
        ON zl_auth_users(neon_user_id) WHERE neon_user_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS zl_auth_sessions (
        token_hash TEXT PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL REFERENCES zl_auth_users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        user_agent TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS zl_auth_sessions_user ON zl_auth_sessions(user_id);
      CREATE INDEX IF NOT EXISTS zl_auth_sessions_expiry ON zl_auth_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS zl_auth_login_events (
        id BIGSERIAL PRIMARY KEY,
        at TEXT NOT NULL,
        username TEXT NOT NULL,
        user_id TEXT,
        ok BOOLEAN NOT NULL,
        ip TEXT NOT NULL,
        user_agent TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS zl_auth_login_events_at ON zl_auth_login_events(at);
      CREATE TABLE IF NOT EXISTS zl_auth_login_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        first_at TEXT NOT NULL,
        locked_until TEXT
      );
      CREATE TABLE IF NOT EXISTS zl_auth_password_resets (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES zl_auth_users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS zl_auth_password_resets_user ON zl_auth_password_resets(user_id);
      CREATE INDEX IF NOT EXISTS zl_auth_password_resets_expiry ON zl_auth_password_resets(expires_at);
    `);
    const now = nowIso();
    await this.pool.query('DELETE FROM zl_auth_sessions WHERE expires_at <= $1', [now]);
    await this.pool.query('DELETE FROM zl_auth_password_resets WHERE expires_at <= $1', [now]);
  }

  async migrateFromSqlite(db) {
    const users = db.prepare('SELECT * FROM auth_users ORDER BY created_at, username').all();
    if (!users.length) return false;
    const sessions = db.prepare('SELECT * FROM auth_sessions').all();
    const resets = db.prepare('SELECT * FROM auth_password_resets').all();
    const limits = db.prepare('SELECT * FROM auth_login_limits').all();
    const events = db.prepare('SELECT * FROM auth_login_events ORDER BY id').all();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of users) {
        await client.query(
          `INSERT INTO zl_auth_users
            (id, username, name, role, password_hash, email, company_ids, neon_user_id,
             mfa_secret, mfa_recovery_hash, mfa_last_counter, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.username,
            row.name,
            row.role,
            row.password_hash,
            row.email || null,
            row.company_ids || null,
            row.neon_user_id || null,
            row.mfa_secret || null,
            row.mfa_recovery_hash || null,
            Number(row.mfa_last_counter) || 0,
            row.created_at,
            row.updated_at,
          ],
        );
      }
      for (const row of sessions) {
        await client.query(
          `INSERT INTO zl_auth_sessions
            (token_hash, id, user_id, created_at, expires_at, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (token_hash) DO NOTHING`,
          [row.token_hash, row.id || row.token_hash, row.user_id, row.created_at, row.expires_at, row.user_agent || ''],
        );
      }
      for (const row of resets) {
        await client.query(
          `INSERT INTO zl_auth_password_resets (token_hash, user_id, created_at, expires_at)
           VALUES ($1, $2, $3, $4) ON CONFLICT (token_hash) DO NOTHING`,
          [row.token_hash, row.user_id, row.created_at, row.expires_at],
        );
      }
      for (const row of limits) {
        await client.query(
          `INSERT INTO zl_auth_login_limits (key, count, first_at, locked_until)
           VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING`,
          [row.key, Number(row.count) || 0, row.first_at, row.locked_until || null],
        );
      }
      for (const row of events) {
        await client.query(
          `INSERT INTO zl_auth_login_events (at, username, user_id, ok, ip, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [row.at, row.username, row.user_id || null, Boolean(row.ok), row.ip, row.user_agent],
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async hasUsers() {
    const result = await this.pool.query('SELECT COUNT(*)::int AS count FROM zl_auth_users');
    return Number(result.rows[0]?.count ?? 0) > 0;
  }

  async userRowByUsername(username) {
    const result = await this.pool.query('SELECT * FROM zl_auth_users WHERE username = $1', [username]);
    return result.rows[0] ?? null;
  }

  async userRowByEmail(email) {
    if (!email) return null;
    const result = await this.pool.query('SELECT * FROM zl_auth_users WHERE email = $1', [email]);
    return result.rows[0] ?? null;
  }

  async userRowById(id) {
    const result = await this.pool.query('SELECT * FROM zl_auth_users WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async createUser(input = {}) {
    const username = normalizeUsername(input.username);
    const name = String(input.name ?? '').trim();
    const role = String(input.role ?? '').trim();
    const email = normalizeEmail(input.email);
    const emailValidation = emailError(email);
    if (emailValidation) return { ok: false, error: emailValidation };
    const passwordError = validPassword(input.password);
    if (!USERNAME_PATTERN.test(username)) {
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
    if (await this.userRowByUsername(username)) {
      return { ok: false, error: `Username "${username}" already exists.` };
    }
    if (email && (await this.userRowByEmail(email))) {
      return { ok: false, error: 'That email address is already used by another account.' };
    }
    const id = `usr_${randomBytes(12).toString('hex')}`;
    const at = nowIso();
    try {
      const result = await this.pool.query(
        `INSERT INTO zl_auth_users
          (id, username, name, role, password_hash, email, company_ids, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          username,
          name,
          role,
          hashPassword(input.password),
          email || null,
          scope.ids === null ? null : JSON.stringify(scope.ids),
          at,
          at,
        ],
      );
      return { ok: true, user: publicUser(result.rows[0]) };
    } catch (error) {
      return { ok: false, error: error.message || 'Could not create the account.' };
    }
  }

  async ensureOwner(input = {}) {
    if (await this.hasUsers()) return { ok: true, created: false };
    const result = await this.createUser({
      username: input.username || 'owner',
      name: input.name || 'Owner',
      role: 'owner',
      password: input.password,
      email: input.email || '',
    });
    return result.ok ? { ...result, created: true } : result;
  }

  async findUserByIdentifier(identifier) {
    const value = String(identifier ?? '').trim();
    if (!value) return null;
    const result = await this.pool.query(
      'SELECT * FROM zl_auth_users WHERE username = $1 OR email = $2 LIMIT 1',
      [normalizeUsername(value), normalizeEmail(value)],
    );
    return result.rows[0] ? publicUser(result.rows[0]) : null;
  }

  async findUserByNeonId(neonUserId) {
    const value = String(neonUserId ?? '').trim();
    if (!value) return null;
    const result = await this.pool.query('SELECT * FROM zl_auth_users WHERE neon_user_id = $1', [value]);
    return result.rows[0] ? publicUser(result.rows[0]) : null;
  }

  async linkNeonUser(userId, neonUserId) {
    const row = await this.userRowById(String(userId ?? ''));
    const neonId = String(neonUserId ?? '').trim();
    if (!row || !neonId) return { ok: false, error: 'Account or Neon identity is missing.' };
    const existing = await this.pool.query('SELECT * FROM zl_auth_users WHERE neon_user_id = $1', [neonId]);
    if (existing.rows[0] && existing.rows[0].id !== row.id) {
      return { ok: false, error: 'That Neon Auth account is already linked to another profile.' };
    }
    try {
      const result = await this.pool.query(
        'UPDATE zl_auth_users SET neon_user_id = $1, updated_at = $2 WHERE id = $3 RETURNING *',
        [neonId, nowIso(), row.id],
      );
      return result.rows[0]
        ? { ok: true, user: publicUser(result.rows[0]) }
        : { ok: false, error: 'Account not found.' };
    } catch (error) {
      return { ok: false, error: error.message || 'Could not link the Neon Auth account.' };
    }
  }

  async ensureNeonUser({ neonUserId, email, name } = {}) {
    const neonId = String(neonUserId ?? '').trim();
    if (!neonId) return { ok: false, error: 'Neon Auth did not return a user id.' };
    const linked = await this.findUserByNeonId(neonId);
    if (linked) return { ok: true, created: false, user: linked };
    const normalizedEmail = normalizeEmail(email);
    const byEmail = await this.userRowByEmail(normalizedEmail);
    if (byEmail) {
      const linkedResult = await this.linkNeonUser(byEmail.id, neonId);
      return linkedResult.ok
        ? { ok: true, created: false, user: linkedResult.user }
        : linkedResult;
    }
    if (await this.hasUsers()) {
      return {
        ok: false,
        error:
          'This Neon Auth account is not linked to a ZledgerCraft profile. Ask an owner to add this email address first.',
      };
    }
    const local = normalizedEmail.split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 40);
    let username = local.length >= 3 ? local : 'owner';
    let suffix = 1;
    while (await this.userRowByUsername(username)) {
      username = `${local || 'owner'}${suffix}`.slice(0, 40);
      suffix += 1;
    }
    const result = await this.createUser({
      username,
      name: String(name || username).slice(0, 80),
      role: 'owner',
      password: randomBytes(32).toString('hex'),
      email: normalizedEmail,
    });
    if (!result.ok) return result;
    const linkedResult = await this.linkNeonUser(result.user.id, neonId);
    return linkedResult.ok
      ? { ok: true, created: true, user: linkedResult.user }
      : linkedResult;
  }

  async createPasswordReset(identifier, now = new Date()) {
    const value = String(identifier ?? '').trim();
    if (!value) return null;
    const result = await this.pool.query(
      'SELECT * FROM zl_auth_users WHERE username = $1 OR email = $2 LIMIT 1',
      [normalizeUsername(value), normalizeEmail(value)],
    );
    const row = result.rows[0];
    if (!row?.email) return null;
    const token = randomBytes(32).toString('hex');
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + RESET_MINUTES * 60_000).toISOString();
    await this.pool.query('DELETE FROM zl_auth_password_resets WHERE user_id = $1', [row.id]);
    await this.pool.query(
      `INSERT INTO zl_auth_password_resets (token_hash, user_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [sessionHash(token), row.id, createdAt, expiresAt],
    );
    return { user: publicUser(row), token, expiresAt, expiresMinutes: RESET_MINUTES };
  }

  async consumePasswordReset(token, newPassword, now = new Date()) {
    const passwordError = validPassword(newPassword);
    if (passwordError) return { ok: false, error: passwordError };
    const updatedAt = now.toISOString();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT u.* FROM zl_auth_password_resets r
         JOIN zl_auth_users u ON u.id = r.user_id
         WHERE r.token_hash = $1 AND r.expires_at > $2
         FOR UPDATE OF r`,
        [sessionHash(token), now.toISOString()],
      );
      const row = result.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'This password-reset link is invalid or has expired.' };
      }
      await client.query('UPDATE zl_auth_users SET password_hash = $1, updated_at = $2 WHERE id = $3', [
        hashPassword(newPassword),
        updatedAt,
        row.id,
      ]);
      await client.query('DELETE FROM zl_auth_password_resets WHERE user_id = $1', [row.id]);
      await client.query('DELETE FROM zl_auth_sessions WHERE user_id = $1', [row.id]);
      await client.query('COMMIT');
      return { ok: true, user: publicUser(row) };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      return { ok: false, error: error.message || 'Could not reset the password.' };
    } finally {
      client.release();
    }
  }

  async authenticate(username, password) {
    const row = await this.userRowByUsername(normalizeUsername(username));
    if (!row || !verifyPassword(password, row.password_hash)) return null;
    return publicUser(row);
  }

  async createSession(userId, userAgent = '') {
    const token = randomBytes(32).toString('hex');
    const id = randomBytes(12).toString('hex');
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + AUTH_LIMITS.sessionDays * 86400000);
    await this.pool.query(
      `INSERT INTO zl_auth_sessions (token_hash, id, user_id, created_at, expires_at, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sessionHash(token),
        id,
        userId,
        createdAt.toISOString(),
        expiresAt.toISOString(),
        String(userAgent).slice(0, 300),
      ],
    );
    return { token, id, expiresAt: expiresAt.toISOString() };
  }

  async listSessions() {
    const result = await this.pool.query(
      `SELECT s.id, s.user_id, s.created_at, s.expires_at, s.user_agent, u.username
       FROM zl_auth_sessions s JOIN zl_auth_users u ON u.id = s.user_id
       WHERE s.expires_at > $1
       ORDER BY s.created_at DESC`,
      [nowIso()],
    );
    return result.rows.map(sessionResult);
  }

  async deleteSessionById(id) {
    const result = await this.pool.query('DELETE FROM zl_auth_sessions WHERE id = $1', [String(id ?? '')]);
    return { ok: true, removed: Number(result.rowCount) || 0 };
  }

  async sessionUser(token) {
    if (!token) return null;
    const result = await this.pool.query(
      `SELECT u.* FROM zl_auth_sessions s
       JOIN zl_auth_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > $2`,
      [sessionHash(token), nowIso()],
    );
    return result.rows[0] ? publicUser(result.rows[0]) : null;
  }

  async deleteSession(token) {
    if (token) await this.pool.query('DELETE FROM zl_auth_sessions WHERE token_hash = $1', [sessionHash(token)]);
  }

  async enableMfa(userId, secret, recoveryCode = '') {
    const result = await this.pool.query(
      `UPDATE zl_auth_users
       SET mfa_secret = $1, mfa_recovery_hash = $2, mfa_last_counter = 0, updated_at = $3
       WHERE id = $4 AND mfa_secret IS NULL
       RETURNING *`,
      [String(secret), recoveryCode ? sessionHash(recoveryCode) : null, nowIso(), String(userId ?? '')],
    );
    if (result.rows[0]) return { ok: true, user: publicUser(result.rows[0]) };
    const current = await this.userRowById(String(userId ?? ''));
    return current
      ? { ok: false, error: 'Two-step verification is already enabled.' }
      : { ok: false, error: 'Account not found.' };
  }

  async disableMfa(userId) {
    const result = await this.pool.query(
      `UPDATE zl_auth_users
       SET mfa_secret = NULL, mfa_recovery_hash = NULL, mfa_last_counter = 0, updated_at = $1
       WHERE id = $2 RETURNING *`,
      [nowIso(), String(userId ?? '')],
    );
    return result.rows[0]
      ? { ok: true, user: publicUser(result.rows[0]) }
      : { ok: false, error: 'Account not found.' };
  }

  async mfaSecret(userId) {
    return (await this.userRowById(String(userId ?? '')))?.mfa_secret || '';
  }

  async verifyMfaCode(userId, code, at = Date.now()) {
    const row = await this.userRowById(String(userId ?? ''));
    if (!row?.mfa_secret) return false;
    const counter = totpCounter(row.mfa_secret, code, 1, at);
    if (counter === null || counter <= Number(row.mfa_last_counter ?? 0)) return false;
    const result = await this.pool.query(
      `UPDATE zl_auth_users SET mfa_last_counter = $1, updated_at = $2
       WHERE id = $3 AND mfa_last_counter < $1`,
      [counter, nowIso(), row.id],
    );
    return Number(result.rowCount) === 1;
  }

  async consumeMfaRecovery(userId, code) {
    const row = await this.userRowById(String(userId ?? ''));
    const expected = row?.mfa_recovery_hash || '';
    if (!expected || !code) return false;
    const actual = sessionHash(String(code).replace(/\s/g, '').toUpperCase());
    if (actual.length !== expected.length) return false;
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) return false;
    const result = await this.pool.query(
      `UPDATE zl_auth_users
       SET mfa_secret = NULL, mfa_recovery_hash = NULL, mfa_last_counter = 0, updated_at = $1
       WHERE id = $2`,
      [nowIso(), row.id],
    );
    return Number(result.rowCount) === 1;
  }

  async deleteUserSessions(userId) {
    const result = await this.pool.query('DELETE FROM zl_auth_sessions WHERE user_id = $1', [
      String(userId ?? ''),
    ]);
    return { ok: true, removed: Number(result.rowCount) || 0 };
  }

  async loginLimit(key) {
    const result = await this.pool.query('SELECT * FROM zl_auth_login_limits WHERE key = $1', [String(key)]);
    const state = loginState(result.rows[0]);
    if (result.rows[0] && !state.blocked && state.count === 0) {
      await this.clearLoginFailures(key);
    }
    return state;
  }

  async recordFailure(key) {
    const now = Date.now();
    const nowText = new Date(now).toISOString();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO zl_auth_login_limits (key, count, first_at, locked_until)
         VALUES ($1, 0, $2, NULL) ON CONFLICT (key) DO NOTHING`,
        [String(key), nowText],
      );
      const result = await client.query('SELECT * FROM zl_auth_login_limits WHERE key = $1 FOR UPDATE', [
        String(key),
      ]);
      const row = result.rows[0];
      let count = Number(row.count) || 0;
      const firstAt = timestamp(row.first_at);
      const first = !firstAt || now - firstAt > AUTH_LIMITS.loginWindowMs ? nowText : row.first_at;
      if (!firstAt || now - firstAt > AUTH_LIMITS.loginWindowMs) count = 0;
      count += 1;
      const lockedUntil =
        count >= AUTH_LIMITS.loginMaxFailures
          ? new Date(now + AUTH_LIMITS.loginLockMs).toISOString()
          : null;
      await client.query(
        'UPDATE zl_auth_login_limits SET count = $1, first_at = $2, locked_until = $3 WHERE key = $4',
        [count, first, lockedUntil, String(key)],
      );
      await client.query('COMMIT');
      return { blocked: Boolean(lockedUntil), count, retryAfterMs: lockedUntil ? AUTH_LIMITS.loginLockMs : 0 };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async clearLoginFailures(key) {
    await this.pool.query('DELETE FROM zl_auth_login_limits WHERE key = $1', [String(key)]);
  }

  async recordLogin({ username = '', userId = null, ok = false, ip = '', userAgent = '' } = {}) {
    await this.pool.query(
      `INSERT INTO zl_auth_login_events (at, username, user_id, ok, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nowIso(), String(username).slice(0, 40), userId ? String(userId) : null, Boolean(ok), String(ip).slice(0, 100), String(userAgent).slice(0, 300)],
    );
    await this.pool.query(
      `DELETE FROM zl_auth_login_events
       WHERE id NOT IN (SELECT id FROM zl_auth_login_events ORDER BY id DESC LIMIT 1000)`,
    );
  }

  async listLoginEvents(limit = 50) {
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    const result = await this.pool.query(
      'SELECT * FROM zl_auth_login_events ORDER BY id DESC LIMIT $1',
      [safeLimit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      at: row.at,
      username: row.username,
      userId: row.user_id,
      ok: Boolean(row.ok),
      ip: row.ip,
      userAgent: row.user_agent,
    }));
  }

  async listUsers() {
    const result = await this.pool.query('SELECT * FROM zl_auth_users ORDER BY created_at, username');
    return result.rows.map(publicUser);
  }

  async getUser(id) {
    return publicUser(await this.userRowById(String(id ?? '')));
  }

  async updateUser(id, input = {}) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT * FROM zl_auth_users WHERE id = $1 FOR UPDATE', [
        String(id ?? ''),
      ]);
      const row = found.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Account not found.' };
      }
      const name = String(input.name ?? row.name).trim();
      const role = String(input.role ?? row.role);
      if (!name || name.length > 80) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Name is required and must be 80 characters or fewer.' };
      }
      if (!ROLES.has(role)) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Choose a valid role.' };
      }
      if (row.role === 'owner' && role !== 'owner') {
        const owners = await client.query("SELECT id FROM zl_auth_users WHERE role = 'owner' FOR UPDATE");
        if (owners.rowCount <= 1) {
          await client.query('ROLLBACK');
          return { ok: false, error: 'Keep at least one owner account.' };
        }
      }
      let email = normalizeEmail(row.email);
      if (input.email !== undefined) {
        const validation = emailError(input.email);
        if (validation) {
          await client.query('ROLLBACK');
          return { ok: false, error: validation };
        }
        email = normalizeEmail(input.email);
        if (email) {
          const duplicate = await client.query(
            'SELECT id FROM zl_auth_users WHERE email = $1 AND id <> $2',
            [email, row.id],
          );
          if (duplicate.rows[0]) {
            await client.query('ROLLBACK');
            return { ok: false, error: 'That email address is already used by another account.' };
          }
        }
      }
      let passwordHash = row.password_hash;
      if (input.password !== undefined && input.password !== '') {
        const passwordError = validPassword(input.password);
        if (passwordError) {
          await client.query('ROLLBACK');
          return { ok: false, error: passwordError };
        }
        passwordHash = hashPassword(input.password);
      }
      let companyIds = parseCompanyIds(row.company_ids);
      if (role === 'owner') {
        companyIds = null;
      } else if (input.companyIds !== undefined) {
        const scope = normalizeCompanyIds(input.companyIds);
        if (scope.error) {
          await client.query('ROLLBACK');
          return { ok: false, error: scope.error };
        }
        companyIds = scope.ids;
      }
      const result = await client.query(
        `UPDATE zl_auth_users
         SET name = $1, role = $2, password_hash = $3, email = $4, company_ids = $5, updated_at = $6
         WHERE id = $7 RETURNING *`,
        [
          name,
          role,
          passwordHash,
          email || null,
          companyIds === null ? null : JSON.stringify(companyIds),
          nowIso(),
          row.id,
        ],
      );
      if (input.password) {
        await client.query('DELETE FROM zl_auth_sessions WHERE user_id = $1', [row.id]);
      }
      if (input.email !== undefined && email !== normalizeEmail(row.email)) {
        await client.query('DELETE FROM zl_auth_password_resets WHERE user_id = $1', [row.id]);
      }
      await client.query('COMMIT');
      return { ok: true, user: publicUser(result.rows[0]) };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      return { ok: false, error: error.message || 'Could not update the account.' };
    } finally {
      client.release();
    }
  }

  async deleteUser(id, actorId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT * FROM zl_auth_users WHERE id = $1 FOR UPDATE', [
        String(id ?? ''),
      ]);
      const row = found.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Account not found.' };
      }
      if (row.id === String(actorId ?? '')) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'You cannot delete the account you are signed in with.' };
      }
      if (row.role === 'owner') {
        const owners = await client.query("SELECT id FROM zl_auth_users WHERE role = 'owner' FOR UPDATE");
        if (owners.rowCount <= 1) {
          await client.query('ROLLBACK');
          return { ok: false, error: 'Keep at least one owner account.' };
        }
      }
      await client.query('DELETE FROM zl_auth_users WHERE id = $1', [row.id]);
      await client.query('COMMIT');
      return { ok: true, user: publicUser(row) };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      return { ok: false, error: error.message || 'Could not delete the account.' };
    } finally {
      client.release();
    }
  }
}

// ZledgerCraft - Neon Postgres workspace storage.
// The canonical workspace is retained as one JSONB document so the existing
// accounting engine keeps its exact shape. Revision history and leases use
// separate rows, and every write is serialized by a row lock.
import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';
import { deepEqual, mergeWorkspaceStates, repairVoucherNumbers } from './server-merge.js';

const HISTORY_LIMIT = 20;
const DEFAULT_LEASE_MS = 2 * 60 * 1000;
const MAX_LEASE_MS = 10 * 60 * 1000;
const AUDIT_GENESIS = '0'.repeat(64);

function tokenHash(token) {
  return createHash('sha256').update(String(token ?? '')).digest('hex');
}

function leaseHolder(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username,
    acquiredAt: new Date(row.acquired_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

function auditHash(prevHash, row) {
  return createHash('sha256')
    .update(JSON.stringify([prevHash, row.at, row.user_id, row.username, row.role, row.rev, row.bytes]))
    .digest('hex');
}

function eventHash(prevHash, row) {
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

export function createPostgresPool(connectionString) {
  return new pg.Pool({
    connectionString,
    max: Number(process.env.ZL_PG_POOL_SIZE) || 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export class PostgresWorkspaceStore {
  constructor(pool) {
    this.pool = pool;
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS zl_workspace (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        rev INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        state JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS zl_workspace_history (
        rev INTEGER PRIMARY KEY,
        updated_at TIMESTAMPTZ NOT NULL,
        state JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS zl_workspace_leases (
        company_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        record_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        acquired_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (company_id, record_type, record_id)
      );
      CREATE INDEX IF NOT EXISTS zl_workspace_leases_expiry ON zl_workspace_leases(expires_at);
      CREATE TABLE IF NOT EXISTS zl_workspace_audit (
        id BIGSERIAL PRIMARY KEY,
        at TIMESTAMPTZ NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        role TEXT NOT NULL,
        rev INTEGER NOT NULL,
        bytes INTEGER NOT NULL,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS zl_server_events (
        id BIGSERIAL PRIMARY KEY,
        at TIMESTAMPTZ NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        role TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT '',
        detail TEXT NOT NULL DEFAULT '',
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS zl_report_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        recipients TEXT NOT NULL DEFAULT '',
        last_sent_at TIMESTAMPTZ,
        last_attempt_at TIMESTAMPTZ,
        last_error TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL
      );
      ALTER TABLE zl_report_settings ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
      ALTER TABLE zl_report_settings ADD COLUMN IF NOT EXISTS last_error TEXT NOT NULL DEFAULT '';
      CREATE TABLE IF NOT EXISTS zl_report_attempts (
        id BIGSERIAL PRIMARY KEY,
        at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        recipients TEXT NOT NULL DEFAULT '',
        error TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS zl_report_attempts_at ON zl_report_attempts(at DESC);
    `);
  }

  async migrateLegacy() {
    return false;
  }

  async ensureHistory() {
    const current = await this.read();
    if (!current.state) return false;
    const inserted = await this.pool.query(
      'INSERT INTO zl_workspace_history (rev, updated_at, state) VALUES ($1, $2, $3) ON CONFLICT (rev) DO NOTHING',
      [current.rev, current.updatedAt, current.state],
    );
    return inserted.rowCount > 0;
  }

  async read() {
    const result = await this.pool.query('SELECT rev, updated_at, state FROM zl_workspace WHERE id = 1');
    if (!result.rowCount) return { state: null, rev: 0, updatedAt: null };
    const row = result.rows[0];
    return { state: row.state, rev: Number(row.rev), updatedAt: new Date(row.updated_at).toISOString() };
  }

  async revisionState(rev) {
    const result = await this.pool.query('SELECT state FROM zl_workspace_history WHERE rev = $1', [
      Number(rev),
    ]);
    return result.rowCount ? result.rows[0].state : null;
  }

  async write(state, baseRev, { updatedAt, validate, afterWrite } = {}) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const meta = await client.query(
        'SELECT rev, updated_at, state FROM zl_workspace WHERE id = 1 FOR UPDATE',
      );
      const currentRev = meta.rowCount ? Number(meta.rows[0].rev) : 0;
      const currentState = meta.rowCount ? meta.rows[0].state : null;
      let nextState = state;
      let merged = false;
      let renumbered = 0;

      if (currentRev !== baseRev) {
        const base = await client.query('SELECT state FROM zl_workspace_history WHERE rev = $1', [
          Number(baseRev),
        ]);
        if (!base.rowCount) {
          await client.query('ROLLBACK');
          return { conflict: true, rev: currentRev, updatedAt: meta.rows[0]?.updated_at ?? null };
        }
        const result = mergeWorkspaceStates(base.rows[0].state, state, currentState);
        if (!result.ok) {
          await client.query('ROLLBACK');
          return {
            conflict: true,
            rev: currentRev,
            updatedAt: meta.rows[0]?.updated_at ?? null,
            mergeError: result.reason || 'The changes overlap. Reload the server copy.',
          };
        }
        nextState = result.state;
        merged = true;
        renumbered = repairVoucherNumbers(nextState);
        if (deepEqual(nextState, currentState)) {
          await client.query('COMMIT');
          return {
            conflict: false,
            rev: currentRev,
            updatedAt: meta.rows[0]?.updated_at ?? null,
            merged: true,
            renumbered,
            state: currentState,
          };
        }
      }

      if (validate) {
        const error = validate(currentState, nextState);
        if (error) {
          await client.query('ROLLBACK');
          return { forbidden: true, error };
        }
      }

      const rev = currentRev + 1;
      const at = updatedAt || new Date().toISOString();
      await client.query(
        `INSERT INTO zl_workspace (id, rev, updated_at, state)
         VALUES (1, $1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET
           rev = excluded.rev,
           updated_at = excluded.updated_at,
           state = excluded.state`,
        [rev, at, nextState],
      );
      await client.query(
        `INSERT INTO zl_workspace_history (rev, updated_at, state)
         VALUES ($1, $2, $3)
         ON CONFLICT (rev) DO UPDATE SET updated_at = excluded.updated_at, state = excluded.state`,
        [rev, at, nextState],
      );
      await client.query('DELETE FROM zl_workspace_history WHERE rev <= $1', [Math.max(0, rev - HISTORY_LIMIT)]);
      if (afterWrite) await afterWrite(rev, client);
      await client.query('COMMIT');
      return {
        conflict: false,
        rev,
        updatedAt: at,
        merged,
        renumbered,
        state: merged ? nextState : undefined,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async clear() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM zl_workspace_history');
      await client.query('DELETE FROM zl_workspace_leases');
      await client.query('DELETE FROM zl_workspace');
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async leaseFor(companyId, recordType, recordId) {
    await this.pool.query('DELETE FROM zl_workspace_leases WHERE expires_at <= now()');
    const result = await this.pool.query(
      `SELECT * FROM zl_workspace_leases
       WHERE company_id = $1 AND record_type = $2 AND record_id = $3`,
      [companyId, recordType, recordId],
    );
    return result.rowCount ? result.rows[0] : null;
  }

  async acquireLease({ companyId, recordType, recordId, user, token = '', ttlMs = DEFAULT_LEASE_MS }) {
    const ttl = Math.min(MAX_LEASE_MS, Math.max(10_000, Number(ttlMs) || DEFAULT_LEASE_MS));
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expiresAt = new Date(now + ttl).toISOString();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM zl_workspace_leases WHERE expires_at <= now()');
      const existing = await client.query(
        `SELECT * FROM zl_workspace_leases
         WHERE company_id = $1 AND record_type = $2 AND record_id = $3 FOR UPDATE`,
        [companyId, recordType, recordId],
      );
      const presented = tokenHash(token);
      if (existing.rowCount && existing.rows[0].token_hash !== presented) {
        await client.query('COMMIT');
        return { ok: false, locked: true, holder: leaseHolder(existing.rows[0]) };
      }
      if (existing.rowCount && existing.rows[0].token_hash === presented) {
        await client.query(
          'UPDATE zl_workspace_leases SET expires_at = $1 WHERE company_id = $2 AND record_type = $3 AND record_id = $4',
          [expiresAt, companyId, recordType, recordId],
        );
        await client.query('COMMIT');
        return {
          ok: true,
          token,
          renewed: true,
          lease: {
            userId: existing.rows[0].user_id,
            username: existing.rows[0].username,
            acquiredAt: new Date(existing.rows[0].acquired_at).toISOString(),
            expiresAt,
          },
        };
      }
      const fresh = randomBytes(24).toString('hex');
      const username = String(user.username || user.name || user.id);
      await client.query(
        `INSERT INTO zl_workspace_leases
          (company_id, record_type, record_id, token_hash, user_id, username, acquired_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (company_id, record_type, record_id) DO UPDATE SET
           token_hash = excluded.token_hash,
           user_id = excluded.user_id,
           username = excluded.username,
           acquired_at = excluded.acquired_at,
           expires_at = excluded.expires_at`,
        [companyId, recordType, recordId, tokenHash(fresh), user.id, username, nowIso, expiresAt],
      );
      await client.query('COMMIT');
      return {
        ok: true,
        token: fresh,
        renewed: false,
        lease: { userId: user.id, username, acquiredAt: nowIso, expiresAt },
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async releaseLease({ companyId, recordType, recordId, token }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT * FROM zl_workspace_leases
         WHERE company_id = $1 AND record_type = $2 AND record_id = $3 FOR UPDATE`,
        [companyId, recordType, recordId],
      );
      if (!existing.rowCount) {
        await client.query('COMMIT');
        return { ok: true, released: false };
      }
      if (existing.rows[0].token_hash !== tokenHash(token)) {
        await client.query('COMMIT');
        return { ok: false, locked: true, holder: leaseHolder(existing.rows[0]) };
      }
      await client.query(
        'DELETE FROM zl_workspace_leases WHERE company_id = $1 AND record_type = $2 AND record_id = $3',
        [companyId, recordType, recordId],
      );
      await client.query('COMMIT');
      return { ok: true, released: true };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async appendWorkspaceAudit(row, suppliedClient = null) {
    if (suppliedClient) {
      const last = await suppliedClient.query('SELECT hash FROM zl_workspace_audit ORDER BY id DESC LIMIT 1');
      const previous = last.rows[0]?.hash || AUDIT_GENESIS;
      const hash = auditHash(previous, row);
      await suppliedClient.query(
        `INSERT INTO zl_workspace_audit
          (at, user_id, username, role, rev, bytes, prev_hash, hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [row.at, row.user_id, row.username, row.role, row.rev, row.bytes, previous, hash],
      );
      return hash;
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const last = await client.query('SELECT hash FROM zl_workspace_audit ORDER BY id DESC LIMIT 1');
      const previous = last.rows[0]?.hash || AUDIT_GENESIS;
      const hash = auditHash(previous, row);
      await client.query(
        `INSERT INTO zl_workspace_audit
          (at, user_id, username, role, rev, bytes, prev_hash, hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [row.at, row.user_id, row.username, row.role, row.rev, row.bytes, previous, hash],
      );
      await client.query('COMMIT');
      return hash;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async listWorkspaceAudit(limit = 100) {
    const result = await this.pool.query(
      'SELECT id, at, user_id, username, role, rev, bytes, prev_hash, hash FROM zl_workspace_audit ORDER BY id DESC LIMIT $1',
      [Number(limit)],
    );
    return result.rows;
  }

  async verifyWorkspaceAuditChain() {
    const result = await this.pool.query('SELECT * FROM zl_workspace_audit ORDER BY id');
    let previous = AUDIT_GENESIS;
    for (const [index, row] of result.rows.entries()) {
      const expected = auditHash(previous, row);
      if (row.prev_hash !== previous || row.hash !== expected) {
        return { ok: false, checked: index, brokenId: row.id };
      }
      previous = row.hash;
    }
    return { ok: true, checked: result.rows.length };
  }

  async getReportSettings() {
    const result = await this.pool.query(
      'SELECT enabled, recipients, last_sent_at, last_attempt_at, last_error, updated_at FROM zl_report_settings WHERE id = 1',
    );
    if (!result.rowCount) {
      return { enabled: false, recipients: '', lastSentAt: null, lastAttemptAt: null, lastError: '', updatedAt: null };
    }
    const row = result.rows[0];
    return {
      enabled: Boolean(row.enabled),
      recipients: row.recipients || '',
      lastSentAt: row.last_sent_at ? new Date(row.last_sent_at).toISOString() : null,
      lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null,
      lastError: row.last_error || '',
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async saveReportSettings({ enabled = false, recipients = '', lastSentAt = null } = {}) {
    const result = await this.pool.query(
      `INSERT INTO zl_report_settings (id, enabled, recipients, last_sent_at, updated_at)
       VALUES (1, $1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET
         enabled = excluded.enabled,
         recipients = excluded.recipients,
         last_sent_at = COALESCE(excluded.last_sent_at, zl_report_settings.last_sent_at),
         updated_at = now()
       RETURNING enabled, recipients, last_sent_at, updated_at`,
      [Boolean(enabled), String(recipients), lastSentAt ? new Date(lastSentAt) : null],
    );
    return this.getReportSettings();
  }

  async recordReportAttempt({ sent = false, error = '', at = new Date().toISOString(), source = 'manual', recipients = [] } = {}) {
    await this.pool.query(
      `INSERT INTO zl_report_settings
         (id, enabled, recipients, last_sent_at, last_attempt_at, last_error, updated_at)
       VALUES (1, FALSE, '', $1, $1, $2, now())
       ON CONFLICT (id) DO UPDATE SET
         last_sent_at = CASE WHEN $3 THEN $1 ELSE zl_report_settings.last_sent_at END,
         last_attempt_at = $1,
         last_error = $2,
         updated_at = now()`,
      [new Date(at), String(error).slice(0, 500), Boolean(sent)],
    );
    await this.pool.query(
      `INSERT INTO zl_report_attempts (at, status, source, recipients, error)
       VALUES ($1, $2, $3, $4, $5)`,
      [new Date(at), sent ? 'sent' : 'failed', String(source), (Array.isArray(recipients) ? recipients : []).join(', '), String(error).slice(0, 500)],
    );
    await this.pool.query(
      `DELETE FROM zl_report_attempts
       WHERE id NOT IN (SELECT id FROM zl_report_attempts ORDER BY id DESC LIMIT 50)`,
    );
    return this.getReportSettings();
  }

  async getReportHistory(limit = 10) {
    const result = await this.pool.query(
      `SELECT id, at, status, source, recipients, error
       FROM zl_report_attempts ORDER BY id DESC LIMIT $1`,
      [Math.max(1, Math.min(50, Number(limit) || 10))],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      at: new Date(row.at).toISOString(),
      status: row.status,
      source: row.source,
      recipients: row.recipients || '',
      error: row.error || '',
    }));
  }

  async appendServerEvent(row) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const last = await client.query('SELECT hash FROM zl_server_events ORDER BY id DESC LIMIT 1');
      const previous = last.rows[0]?.hash || AUDIT_GENESIS;
      const hash = eventHash(previous, row);
      await client.query(
        `INSERT INTO zl_server_events
          (at, user_id, username, role, action, target, detail, prev_hash, hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          row.at,
          row.user_id,
          row.username,
          row.role,
          row.action,
          row.target,
          row.detail,
          previous,
          hash,
        ],
      );
      await client.query('COMMIT');
      return hash;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async listServerEvents(limit = 100) {
    const result = await this.pool.query(
      'SELECT id, at, user_id, username, role, action, target, detail, prev_hash, hash FROM zl_server_events ORDER BY id DESC LIMIT $1',
      [Number(limit)],
    );
    return result.rows;
  }

  async verifyServerEventChain() {
    const result = await this.pool.query('SELECT * FROM zl_server_events ORDER BY id');
    let previous = AUDIT_GENESIS;
    for (const [index, row] of result.rows.entries()) {
      const expected = eventHash(previous, row);
      if (row.prev_hash !== previous || row.hash !== expected) {
        return { ok: false, checked: index, brokenId: row.id };
      }
      previous = row.hash;
    }
    return { ok: true, checked: result.rows.length };
  }

  async close() {
    await this.pool.end();
  }
}

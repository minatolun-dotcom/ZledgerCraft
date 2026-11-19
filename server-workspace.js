// ZledgerCraft - relational workspace storage.
// Companies, ledgers, vouchers and voucher lines are canonical rows. Every other
// company collection is stored as one ordered record row with searchable hints,
// while the complete record JSON preserves fields the engine has not promoted to
// columns yet. Expiring leases provide advisory-but-enforced record ownership.
import { createHash, randomBytes } from 'node:crypto';
import { deepEqual, mergeWorkspaceStates, repairVoucherNumbers } from './server-merge.js';

const SCHEMA_VERSION = 2;
const HISTORY_LIMIT = 20;
const DEFAULT_LEASE_MS = 2 * 60 * 1000;
const MAX_LEASE_MS = 10 * 60 * 1000;

// Top-level company arrays stored in company_records. Stock items have their own
// table because they are queried by group, unit and HSN independently.
const RECORD_COLLECTIONS = [
  'groups',
  'years',
  'costCategories',
  'costCentres',
  'budgets',
  'currencies',
  'units',
  'stockGroups',
  'godowns',
  'stockTransfers',
  'orders',
  'boms',
  'manufactures',
  'taxChallans',
];

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function tokenHash(token) {
  return createHash('sha256').update(String(token ?? '')).digest('hex');
}

function leaseHolder(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username,
    acquiredAt: row.acquired_at,
    expiresAt: row.expires_at,
  };
}

function recordHint(collection, item) {
  const parent =
    item.parentId ?? item.stockGroupId ?? item.categoryId ?? item.targetId ?? item.groupId ?? '';
  const reference = item.unitId ?? item.yearId ?? item.ledgerId ?? item.voucherId ?? '';
  const amount =
    collection === 'budgets'
      ? item.amount
      : item.opening ?? item.openingQty ?? item.total ?? null;
  return {
    name: text(item.name),
    parent: text(parent),
    reference: text(reference),
    amount: optionalNumber(amount),
  };
}

function collectionRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, new Map());
    const collections = byCompany.get(row.company_id);
    if (!collections.has(row.collection)) collections.set(row.collection, []);
    collections.get(row.collection).push(JSON.parse(row.data));
  }
  return byCompany;
}

function stockRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    byCompany.get(row.company_id).push(JSON.parse(row.data));
  }
  return byCompany;
}

function stateFromRows({
  meta,
  users,
  log,
  companies,
  ledgers,
  vouchers,
  lines,
  records = [],
  stockItems = [],
}) {
  const state = {
    ...JSON.parse(meta.meta),
    activeCompanyId: meta.active_company_id ?? null,
    companies: [],
    users: users.map((row) => JSON.parse(row.data)),
    audit: log.map((row) => JSON.parse(row.data)),
    currentUserId: meta.current_user_id ?? null,
  };
  const ledgersByCompany = new Map();
  const vouchersByCompany = new Map();
  const linesByVoucher = new Map();
  const recordsByCompany = collectionRows(records);
  const stockByCompany = stockRows(stockItems);

  for (const row of ledgers) {
    if (!ledgersByCompany.has(row.company_id)) ledgersByCompany.set(row.company_id, []);
    ledgersByCompany.get(row.company_id).push({ ...JSON.parse(row.data), id: row.id, name: row.name, groupId: row.group_id });
  }
  for (const row of vouchers) {
    if (!vouchersByCompany.has(row.company_id)) vouchersByCompany.set(row.company_id, []);
    vouchersByCompany.get(row.company_id).push({
      ...JSON.parse(row.data),
      id: row.id,
      type: row.type,
      no: number(row.no),
      date: row.date,
      total: number(row.total),
    });
  }
  for (const row of lines) {
    if (!linesByVoucher.has(row.voucher_id)) linesByVoucher.set(row.voucher_id, []);
    linesByVoucher.get(row.voucher_id).push({
      ...JSON.parse(row.data),
      ledgerId: row.ledger_id,
      side: row.side,
      amount: number(row.amount),
    });
  }

  for (const row of companies) {
    const company = JSON.parse(row.data);
    company.id = row.id;
    company.name = row.name;
    company.fyStart = row.fy_start;
    company.fyEnd = row.fy_end;
    company.yearId = row.year_id;
    // Empty arrays stay in company.data so their presence survives a round trip.
    // Non-empty ones are reconstructed from their ordered rows.
    const storedCollections = recordsByCompany.get(row.id);
    if (storedCollections) {
      for (const [collection, items] of storedCollections) company[collection] = items;
    }
    const storedStockItems = stockByCompany.get(row.id);
    if (storedStockItems) company.stockItems = storedStockItems;
    company.ledgers = ledgersByCompany.get(row.id) ?? [];
    company.vouchers = (vouchersByCompany.get(row.id) ?? []).map((voucher) => ({
      ...voucher,
      lines: linesByVoucher.get(voucher.id) ?? [],
    }));
    state.companies.push(company);
  }
  return { state, rev: Number(meta.rev), updatedAt: meta.updated_at };
}

function optionalRows(db, sql) {
  try {
    return db.prepare(sql).all();
  } catch {
    // Older backups do not have the newer collection and lease tables.
    return [];
  }
}

export function readWorkspaceSnapshot(db) {
  let meta = null;
  try {
    meta = db.prepare('SELECT * FROM workspace_meta WHERE id = 1').get();
  } catch {
    // Older backups may only have the whole-workspace blob.
  }
  if (meta) {
    const select = (sql) => db.prepare(sql).all();
    return stateFromRows({
      meta,
      users: select('SELECT data FROM workspace_users ORDER BY position'),
      log: select('SELECT data FROM workspace_log ORDER BY position'),
      companies: select('SELECT * FROM companies ORDER BY position'),
      ledgers: select('SELECT * FROM ledgers ORDER BY position'),
      vouchers: select('SELECT * FROM vouchers ORDER BY position'),
      lines: select('SELECT * FROM voucher_lines ORDER BY position'),
      records: optionalRows(db, 'SELECT * FROM company_records ORDER BY company_id, collection, position'),
      stockItems: optionalRows(db, 'SELECT * FROM stock_items ORDER BY company_id, position'),
    });
  }
  let legacy = null;
  try {
    legacy = db.prepare('SELECT rev, updated_at, state FROM workspace WHERE id = 1').get();
  } catch {
    return null;
  }
  if (!legacy) return null;
  const state = JSON.parse(legacy.state);
  if (!state || !Array.isArray(state.companies)) return null;
  return {
    state,
    rev: Number(legacy.rev) || 0,
    updatedAt: legacy.updated_at || null,
  };
}

export class WorkspaceStore {
  constructor(db) {
    this.db = db;
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS workspace_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        rev INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        active_company_id TEXT,
        current_user_id TEXT,
        meta TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_users (
        position INTEGER PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_log (
        position INTEGER PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_revisions (
        rev INTEGER PRIMARY KEY,
        state TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL,
        name TEXT NOT NULL,
        fy_start TEXT,
        fy_end TEXT,
        year_id TEXT,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ledgers (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        group_id TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS vouchers (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        type TEXT,
        no INTEGER,
        date TEXT,
        total REAL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS voucher_lines (
        voucher_id TEXT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        ledger_id TEXT,
        side TEXT,
        amount REAL,
        data TEXT NOT NULL,
        PRIMARY KEY (voucher_id, position)
      );
      CREATE TABLE IF NOT EXISTS company_records (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        parent_id TEXT,
        reference_id TEXT,
        amount REAL,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, collection, id)
      );
      CREATE TABLE IF NOT EXISTS stock_items (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        stock_group_id TEXT,
        unit_id TEXT,
        hsn TEXT,
        opening_qty REAL,
        opening_rate REAL,
        batch_tracking INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS workspace_leases (
        company_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        record_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        acquired_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        PRIMARY KEY (company_id, record_type, record_id)
      );
      CREATE INDEX IF NOT EXISTS ledgers_company ON ledgers(company_id, position);
      CREATE INDEX IF NOT EXISTS vouchers_company ON vouchers(company_id, position);
      CREATE INDEX IF NOT EXISTS voucher_lines_voucher ON voucher_lines(voucher_id, position);
      CREATE INDEX IF NOT EXISTS company_records_collection ON company_records(company_id, collection, position);
      CREATE INDEX IF NOT EXISTS company_records_name ON company_records(company_id, collection, name);
      CREATE INDEX IF NOT EXISTS stock_items_group ON stock_items(company_id, stock_group_id, position);
      CREATE INDEX IF NOT EXISTS stock_items_name ON stock_items(company_id, name);
      CREATE INDEX IF NOT EXISTS workspace_leases_expiry ON workspace_leases(expires_at);
    `);

    this.meta = this.db.prepare('SELECT * FROM workspace_meta WHERE id = 1');
    this.users = this.db.prepare('SELECT data FROM workspace_users ORDER BY position');
    this.log = this.db.prepare('SELECT data FROM workspace_log ORDER BY position');
    this.companies = this.db.prepare('SELECT * FROM companies ORDER BY position');
    this.ledgers = this.db.prepare('SELECT * FROM ledgers ORDER BY position');
    this.vouchers = this.db.prepare('SELECT * FROM vouchers ORDER BY position');
    this.lines = this.db.prepare('SELECT * FROM voucher_lines ORDER BY position');
    this.records = this.db.prepare('SELECT * FROM company_records ORDER BY company_id, collection, position');
    this.stockItems = this.db.prepare('SELECT * FROM stock_items ORDER BY company_id, position');
    this.insertMeta = this.db.prepare(`
      INSERT INTO workspace_meta
        (id, rev, updated_at, schema_version, active_company_id, current_user_id, meta)
      VALUES (1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        rev = excluded.rev,
        updated_at = excluded.updated_at,
        schema_version = excluded.schema_version,
        active_company_id = excluded.active_company_id,
        current_user_id = excluded.current_user_id,
        meta = excluded.meta
    `);
    this.insertUser = this.db.prepare('INSERT INTO workspace_users (position, data) VALUES (?, ?)');
    this.insertLog = this.db.prepare('INSERT INTO workspace_log (position, data) VALUES (?, ?)');
    this.insertCompany = this.db.prepare(`
      INSERT INTO companies (id, position, name, fy_start, fy_end, year_id, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertLedger = this.db.prepare(`
      INSERT INTO ledgers (company_id, id, position, name, group_id, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.insertVoucher = this.db.prepare(`
      INSERT INTO vouchers (company_id, id, position, type, no, date, total, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertLine = this.db.prepare(`
      INSERT INTO voucher_lines (voucher_id, position, ledger_id, side, amount, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.insertRecord = this.db.prepare(`
      INSERT INTO company_records
        (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertStockItem = this.db.prepare(`
      INSERT INTO stock_items
        (company_id, id, position, name, stock_group_id, unit_id, hsn, opening_qty,
         opening_rate, batch_tracking, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.revision = this.db.prepare('SELECT state FROM workspace_revisions WHERE rev = ?');
    this.insertRevision = this.db.prepare('INSERT INTO workspace_revisions (rev, state) VALUES (?, ?)');
    this.pruneRevisions = this.db.prepare('DELETE FROM workspace_revisions WHERE rev < ?');
    this.clearRevisions = this.db.prepare('DELETE FROM workspace_revisions');
    this.clearCompanies = this.db.prepare('DELETE FROM companies');
    this.clearRecords = this.db.prepare('DELETE FROM company_records');
    this.clearStockItems = this.db.prepare('DELETE FROM stock_items');
    this.clearUsers = this.db.prepare('DELETE FROM workspace_users');
    this.clearLog = this.db.prepare('DELETE FROM workspace_log');
    this.clearMeta = this.db.prepare('DELETE FROM workspace_meta');
    this.clearLeases = this.db.prepare('DELETE FROM workspace_leases');
    this.selectLease = this.db.prepare(
      'SELECT * FROM workspace_leases WHERE company_id = ? AND record_type = ? AND record_id = ?',
    );
    this.insertLease = this.db.prepare(`
      INSERT INTO workspace_leases
        (company_id, record_type, record_id, token_hash, user_id, username, acquired_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.deleteLease = this.db.prepare(
      'DELETE FROM workspace_leases WHERE company_id = ? AND record_type = ? AND record_id = ?',
    );
    this.pruneLeases = this.db.prepare('DELETE FROM workspace_leases WHERE expires_at <= ?');
    this.selectLegacy = this.db.prepare('SELECT rev, updated_at, state FROM workspace WHERE id = 1');
    this.clearLegacy = this.db.prepare('DELETE FROM workspace WHERE id = 1');

    this.migrateSchema();
  }

  migrateSchema() {
    const meta = this.meta.get();
    if (!meta || Number(meta.schema_version) >= SCHEMA_VERSION) return false;
    const state = this.read().state;
    if (!state) return false;
    this.replace(state, Number(meta.rev), meta.updated_at, null, { skipRevision: true });
    return true;
  }

  migrateLegacy() {
    let legacy;
    try {
      legacy = this.selectLegacy.get();
    } catch {
      return false;
    }
    if (!legacy || this.meta.get()) return false;
    let state;
    try {
      state = JSON.parse(legacy.state);
    } catch {
      throw new Error('The legacy workspace contains invalid JSON.');
    }
    if (!state || !Array.isArray(state.companies)) {
      throw new Error('The legacy workspace has no company state.');
    }
    const rev = Math.max(1, Number(legacy.rev) || 0);
    this.replace(state, rev, legacy.updated_at || new Date().toISOString());
    // The normalized rows are canonical after this point. Keeping the old blob
    // would let a later clear or failed upgrade resurrect stale books.
    this.clearLegacy.run();
    return true;
  }

  read() {
    const meta = this.meta.get();
    if (!meta) return { state: null, rev: 0, updatedAt: null };
    return stateFromRows({
      meta,
      users: this.users.all(),
      log: this.log.all(),
      companies: this.companies.all(),
      ledgers: this.ledgers.all(),
      vouchers: this.vouchers.all(),
      lines: this.lines.all(),
      records: this.records.all(),
      stockItems: this.stockItems.all(),
    });
  }

  revisionState(rev) {
    const row = this.revision.get(Number(rev));
    if (!row) return null;
    try {
      return JSON.parse(row.state);
    } catch {
      return null;
    }
  }

  ensureHistory() {
    const meta = this.meta.get();
    if (!meta || this.revision.get(meta.rev)) return false;
    const state = this.read().state;
    if (!state) return false;
    this.transaction(() => this.insertRevision.run(Number(meta.rev), JSON.stringify(state)));
    return true;
  }

  write(state, baseRev, { updatedAt, validate, afterWrite } = {}) {
    const meta = this.meta.get();
    const currentRev = meta ? Number(meta.rev) : 0;
    let nextState = state;
    let merged = false;
    let mergeError = '';
    let mergeDetails = null;
    let renumbered = 0;

    if (currentRev !== baseRev) {
      const baseRow = this.revision.get(baseRev);
      if (!baseRow) {
        return { conflict: true, rev: currentRev, updatedAt: meta?.updated_at ?? null };
      }
      let baseState;
      try {
        baseState = JSON.parse(baseRow.state);
      } catch {
        return { conflict: true, rev: currentRev, updatedAt: meta?.updated_at ?? null };
      }
      const currentState = this.read().state;
      const result = mergeWorkspaceStates(baseState, state, currentState);
      if (!result.ok) {
        mergeError = result.reason || 'The changes overlap. Reload the server copy.';
        return { conflict: true, rev: currentRev, updatedAt: meta?.updated_at ?? null, mergeError };
      }
      nextState = result.state;
      merged = true;
      mergeDetails = result.mergeDetails ?? null;
      renumbered = repairVoucherNumbers(nextState);
      if (deepEqual(nextState, currentState)) {
        return {
          conflict: false,
          rev: currentRev,
          updatedAt: meta?.updated_at ?? null,
          merged: true,
          mergeDetails,
          renumbered,
          state: currentState,
        };
      }
    }

    if (validate) {
      const previous = meta ? this.read().state : null;
      const error = validate(previous, nextState);
      if (error) return { forbidden: true, error };
    }
    const rev = currentRev + 1;
    this.replace(nextState, rev, updatedAt, afterWrite);
    return {
      conflict: false,
      rev,
      updatedAt,
      merged,
      mergeDetails,
      renumbered,
      state: merged ? nextState : undefined,
      mergeError,
    };
  }

  clear() {
    this.transaction(() => {
      this.clearRecords.run();
      this.clearStockItems.run();
      this.clearCompanies.run();
      this.clearUsers.run();
      this.clearLog.run();
      this.clearRevisions.run();
      this.clearLeases.run();
      this.clearMeta.run();
      this.clearLegacy.run();
    });
  }

  replace(state, rev, updatedAt, afterWrite = null, { skipRevision = false } = {}) {
    const meta = { ...state };
    delete meta.activeCompanyId;
    delete meta.companies;
    delete meta.users;
    delete meta.audit;
    delete meta.currentUserId;
    this.transaction(() => {
      this.clearRecords.run();
      this.clearStockItems.run();
      this.clearCompanies.run();
      this.clearUsers.run();
      this.clearLog.run();
      this.insertMeta.run(
        rev,
        updatedAt,
        SCHEMA_VERSION,
        text(state.activeCompanyId) || null,
        text(state.currentUserId) || null,
        JSON.stringify(meta),
      );
      if (!skipRevision) {
        this.insertRevision.run(rev, JSON.stringify(state));
        this.pruneRevisions.run(Math.max(0, rev - HISTORY_LIMIT));
      }
      for (const [position, user] of (state.users ?? []).entries()) {
        this.insertUser.run(position, JSON.stringify(user));
      }
      for (const [position, entry] of (state.audit ?? []).entries()) {
        this.insertLog.run(position, JSON.stringify(entry));
      }
      for (const [companyPosition, company] of (state.companies ?? []).entries()) {
        const companyData = { ...company };
        delete companyData.ledgers;
        delete companyData.vouchers;
        // Empty arrays stay in companyData; non-empty arrays are reconstructed
        // from rows so there is only one canonical copy.
        for (const collection of RECORD_COLLECTIONS) {
          if (Array.isArray(company[collection]) && company[collection].length > 0) {
            delete companyData[collection];
          }
        }
        const hasStockItems = Array.isArray(company.stockItems) && company.stockItems.length > 0;
        if (hasStockItems) delete companyData.stockItems;
        this.insertCompany.run(
          text(company.id),
          companyPosition,
          text(company.name),
          text(company.fyStart) || null,
          text(company.fyEnd) || null,
          text(company.yearId) || null,
          JSON.stringify(companyData),
        );
        for (const collection of RECORD_COLLECTIONS) {
          const items = company[collection];
          if (!Array.isArray(items) || items.length === 0) continue;
          for (const [position, item] of items.entries()) {
            const hint = recordHint(collection, item);
            this.insertRecord.run(
              text(company.id),
              collection,
              text(item.id) || `${collection}-${position}`,
              position,
              hint.name || null,
              hint.parent || null,
              hint.reference || null,
              hint.amount,
              JSON.stringify(item),
            );
          }
        }
        if (hasStockItems) {
          for (const [position, item] of company.stockItems.entries()) {
            this.insertStockItem.run(
              text(company.id),
              text(item.id) || `stockItems-${position}`,
              position,
              text(item.name) || null,
              text(item.stockGroupId) || null,
              text(item.unitId) || null,
              text(item.hsn) || null,
              optionalNumber(item.openingQty),
              optionalNumber(item.openingRate),
              item.batchTracking ? 1 : 0,
              JSON.stringify(item),
            );
          }
        }
        for (const [position, ledger] of (company.ledgers ?? []).entries()) {
          const ledgerData = { ...ledger };
          delete ledgerData.id;
          delete ledgerData.name;
          delete ledgerData.groupId;
          this.insertLedger.run(
            text(company.id),
            text(ledger.id),
            position,
            text(ledger.name),
            text(ledger.groupId) || null,
            JSON.stringify(ledgerData),
          );
        }
        for (const [position, voucher] of (company.vouchers ?? []).entries()) {
          const voucherData = { ...voucher };
          delete voucherData.id;
          delete voucherData.lines;
          this.insertVoucher.run(
            text(company.id),
            text(voucher.id),
            position,
            text(voucher.type),
            number(voucher.no),
            text(voucher.date) || null,
            number(voucher.total),
            JSON.stringify(voucherData),
          );
          for (const [linePosition, line] of (voucher.lines ?? []).entries()) {
            const lineData = { ...line };
            delete lineData.ledgerId;
            delete lineData.side;
            delete lineData.amount;
            this.insertLine.run(
              text(voucher.id),
              linePosition,
              text(line.ledgerId) || null,
              text(line.side),
              number(line.amount),
              JSON.stringify(lineData),
            );
          }
        }
      }
      if (afterWrite) afterWrite(rev);
    });
  }

  leaseFor(companyId, recordType, recordId, now = Date.now()) {
    const row = this.selectLease.get(text(companyId), text(recordType), text(recordId));
    if (!row) return null;
    if (Date.parse(row.expires_at) <= now) {
      this.deleteLease.run(text(companyId), text(recordType), text(recordId));
      return null;
    }
    return row;
  }

  acquireLease({ companyId, recordType, recordId, user, token = '', ttlMs = DEFAULT_LEASE_MS }) {
    const ttl = Math.min(MAX_LEASE_MS, Math.max(10_000, Number(ttlMs) || DEFAULT_LEASE_MS));
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expiresAt = new Date(now + ttl).toISOString();
    return this.transaction(() => {
      this.pruneLeases.run(nowIso);
      const existing = this.selectLease.get(text(companyId), text(recordType), text(recordId));
      const presented = tokenHash(token);
      if (existing && Date.parse(existing.expires_at) > now && existing.token_hash !== presented) {
        return { ok: false, locked: true, holder: leaseHolder(existing) };
      }
      if (existing && existing.token_hash === presented) {
        this.deleteLease.run(text(companyId), text(recordType), text(recordId));
        this.insertLease.run(
          text(companyId),
          text(recordType),
          text(recordId),
          existing.token_hash,
          existing.user_id,
          existing.username,
          existing.acquired_at,
          expiresAt,
        );
        return {
          ok: true,
          token,
          renewed: true,
          lease: {
            userId: existing.user_id,
            username: existing.username,
            acquiredAt: existing.acquired_at,
            expiresAt,
          },
        };
      }
      // An expired lease is pruned above. A new owner receives a fresh token.
      const fresh = randomBytes(24).toString('hex');
      this.deleteLease.run(text(companyId), text(recordType), text(recordId));
      this.insertLease.run(
        text(companyId),
        text(recordType),
        text(recordId),
        tokenHash(fresh),
        text(user.id),
        text(user.username || user.name || user.id),
        nowIso,
        expiresAt,
      );
      return {
        ok: true,
        token: fresh,
        renewed: false,
        lease: {
          userId: text(user.id),
          username: text(user.username || user.name || user.id),
          acquiredAt: nowIso,
          expiresAt,
        },
      };
    });
  }

  releaseLease({ companyId, recordType, recordId, token }) {
    return this.transaction(() => {
      const existing = this.selectLease.get(text(companyId), text(recordType), text(recordId));
      if (!existing) return { ok: true, released: false };
      if (existing.token_hash !== tokenHash(token)) {
        return { ok: false, locked: true, holder: leaseHolder(existing) };
      }
      this.deleteLease.run(text(companyId), text(recordType), text(recordId));
      return { ok: true, released: true };
    });
  }

  transaction(task) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = task();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // The transaction may already have rolled back.
      }
      throw error;
    }
  }
}

export { RECORD_COLLECTIONS, SCHEMA_VERSION };

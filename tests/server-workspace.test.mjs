import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { WorkspaceStore } from '../server-workspace.js';

function fixture() {
  return {
    version: 1,
    activeCompanyId: 'co1',
    companies: [
      {
        id: 'co1',
        name: 'Alpha Traders',
        fyStart: '2026-04-01',
        fyEnd: '2027-03-31',
        yearId: 'year1',
        years: [{ id: 'year1', start: '2026-04-01', end: '2027-03-31', closed: false }],
        groups: [{ id: 'grp1', name: 'Sundry Debtors', parentId: 'assets' }],
        ledgers: [
          {
            id: 'led1',
            name: 'Sharma Traders',
            groupId: 'grp1',
            opening: 0,
            openingType: 'Dr',
            gstin: '27AABCU9603R1ZM',
          },
        ],
        vouchers: [
          {
            id: 'vou1',
            type: 'Sales',
            no: 1,
            date: '2026-04-10',
            total: 1000.5,
            narration: 'First sale',
            lines: [
              { ledgerId: 'led1', side: 'Dr', amount: 1000.5, costCentreId: 'cc1' },
              { ledgerId: 'led2', side: 'Cr', amount: 1000.5, allocations: [{ voucherId: 'v2', amount: 500 }] },
            ],
          },
        ],
        costCentres: [{ id: 'cc1', name: 'North' }],
        costCategories: [{ id: 'ccat1', name: 'Primary Cost Category' }],
        units: [{ id: 'unit1', name: 'Numbers', symbol: 'Nos' }],
        stockGroups: [{ id: 'sg1', name: 'Primary', primary: true }],
        stockItems: [
          {
            id: 'item1',
            name: 'Widget',
            stockGroupId: 'sg1',
            unitId: 'unit1',
            openingQty: 5,
            openingRate: 10,
            batchTracking: true,
            hsn: '1234',
          },
        ],
        godowns: [{ id: 'gd1', name: 'Main Location', primary: true }],
        budgets: [{ id: 'bud1', name: 'Sales budget', targetType: 'ledger', targetId: 'led1', yearId: 'year1', amount: 1000 }],
        currencies: [{ id: 'cur1', code: 'USD', name: 'US Dollar', symbol: '$', rates: [{ date: '2026-04-01', rate: 83 }] }],
      },
      {
        id: 'co2',
        name: 'Beta Services',
        fyStart: '2026-04-01',
        fyEnd: '2027-03-31',
        yearId: 'year2',
        years: [{ id: 'year2', start: '2026-04-01', end: '2027-03-31', closed: false }],
        groups: [],
        ledgers: [],
        vouchers: [],
      },
    ],
    users: [{ id: 'u1', name: 'Owner', role: 'owner' }],
    audit: [{ id: 'a1', at: '2026-04-10T00:00:00.000Z', action: 'voucher.create', summary: 'Sale' }],
    currentUserId: 'u1',
  };
}

function legacyStore(state, rev = 7) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE workspace (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      rev INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      state TEXT NOT NULL
    );
  `);
  db.prepare('INSERT INTO workspace (id, rev, updated_at, state) VALUES (1, ?, ?, ?)').run(
    rev,
    '2026-04-10T10:00:00.000Z',
    JSON.stringify(state),
  );
  return { db, store: new WorkspaceStore(db) };
}

test('normalized storage migrates the legacy workspace and round-trips every core field', () => {
  const state = fixture();
  const { db, store } = legacyStore(state);

  assert.equal(store.migrateLegacy(), true);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM workspace').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM companies').get().count, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ledgers').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM vouchers').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM voucher_lines').get().count, 2);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM company_records WHERE collection = 'groups'").get().count,
    1,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stock_items').get().count, 1);
  assert.equal(
    db.prepare("SELECT name FROM stock_items WHERE id = 'item1'").get().name,
    'Widget',
  );

  const loaded = store.read();
  assert.equal(loaded.rev, 7);
  assert.deepEqual(loaded.state, state);
});

test('normalized writes replace the core atomically and preserve a clear operation', () => {
  const { store } = legacyStore(fixture(), 3);
  store.migrateLegacy();
  const before = store.read();

  const next = structuredClone(before.state);
  next.activeCompanyId = 'co2';
  next.companies[0].vouchers[0].lines[0].amount = 1200;
  let committedRev = 0;
  const result = store.write(next, before.rev, {
    updatedAt: '2026-05-01T00:00:00.000Z',
    afterWrite: (rev) => {
      committedRev = rev;
    },
  });
  assert.equal(result.conflict, false);
  assert.equal(result.rev, 4);
  assert.equal(committedRev, 4);
  assert.equal(store.read().state.companies[0].vouchers[0].lines[0].amount, 1200);
  assert.equal(store.read().state.activeCompanyId, 'co2');

  const staleButIdentical = store.write(next, before.rev, { updatedAt: 'later' });
  assert.equal(staleButIdentical.conflict, false);
  assert.equal(staleButIdentical.merged, true);
  assert.equal(staleButIdentical.rev, 4, 'a no-op merge does not create another revision');
  const forbidden = store.write(next, 4, {
    updatedAt: 'later',
    validate: () => 'Not allowed.',
  });
  assert.equal(forbidden.forbidden, true);
  assert.equal(store.read().rev, 4, 'a rejected write does not change the revision');

  assert.throws(
    () =>
      store.write(next, 4, {
        updatedAt: 'later',
        afterWrite: () => {
          throw new Error('audit insert failed');
        },
      }),
    /audit insert failed/,
  );
  assert.equal(store.read().rev, 4, 'a failed after-write callback rolls back the workspace');

  store.clear();
  assert.equal(store.read().state, null);
  assert.equal(store.read().rev, 0);
});

test('normalized storage can be read after the legacy blob is removed', () => {
  const state = fixture();
  const { db, store } = legacyStore(state);
  store.migrateLegacy();
  db.prepare('DELETE FROM workspace').run();
  assert.deepEqual(store.read().state, state);
});

test('normalized storage merges independent stale saves and rejects overlapping ones', () => {
  const { store } = legacyStore(fixture(), 3);
  store.migrateLegacy();
  const base = store.read();
  const current = structuredClone(base.state);
  const local = structuredClone(base.state);

  current.companies[0].vouchers.push({
    id: 'v3',
    type: 'Payment',
    no: 2,
    date: '2026-04-11',
    total: 25,
    lines: [{ ledgerId: 'led1', side: 'Cr', amount: 25 }],
  });
  local.companies[0].vouchers.push({
    id: 'v4',
    type: 'Receipt',
    no: 1,
    date: '2026-04-12',
    total: 40,
    lines: [{ ledgerId: 'led1', side: 'Dr', amount: 40 }],
  });

  const first = store.write(current, base.rev, { updatedAt: '2026-04-11T00:00:00.000Z' });
  assert.equal(first.conflict, false);
  const merged = store.write(local, base.rev, { updatedAt: '2026-04-12T00:00:00.000Z' });
  assert.equal(merged.conflict, false, merged.mergeError);
  assert.equal(merged.merged, true);
  assert.deepEqual(
    merged.state.companies[0].vouchers.map((voucher) => voucher.id).sort(),
    ['v3', 'v4', 'vou1'],
  );

  const overlapBase = store.read();
  const overlapCurrent = structuredClone(overlapBase.state);
  const overlapLocal = structuredClone(overlapBase.state);
  overlapCurrent.companies[0].vouchers[0].narration = 'Changed on server';
  overlapLocal.companies[0].vouchers[0].narration = 'Changed locally';
  assert.equal(store.write(overlapCurrent, overlapBase.rev, { updatedAt: 'later' }).conflict, false);
  const rejected = store.write(overlapLocal, overlapBase.rev, { updatedAt: 'later' });
  assert.equal(rejected.conflict, true);
  assert.match(rejected.mergeError, /vouchers/);
  assert.equal(store.read().state.companies[0].vouchers[0].narration, 'Changed on server');
});

test('schema version 1 workspaces migrate their JSON collections into rows', () => {
  const { db, store } = legacyStore(fixture());
  store.migrateLegacy();
  const expected = store.read().state;
  for (const company of expected.companies) {
    const companyRow = db.prepare('SELECT data FROM companies WHERE id = ?').get(company.id);
    const companyData = JSON.parse(companyRow.data);
    for (const collection of [
      'groups',
      'years',
      'costCategories',
      'costCentres',
      'stockItems',
      'units',
      'stockGroups',
      'godowns',
      'budgets',
      'currencies',
    ]) {
      if (Array.isArray(company[collection])) {
        companyData[collection] = structuredClone(company[collection]);
      }
    }
    db.prepare('UPDATE companies SET data = ? WHERE id = ?').run(
      JSON.stringify(companyData),
      company.id,
    );
  }
  db.prepare('DELETE FROM company_records').run();
  db.prepare('DELETE FROM stock_items').run();
  db.prepare('UPDATE workspace_meta SET schema_version = 1').run();

  const upgraded = new WorkspaceStore(db);
  assert.equal(
    db.prepare('SELECT schema_version FROM workspace_meta').get().schema_version,
    2,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM company_records WHERE collection = 'groups'").get().count,
    1,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stock_items').get().count, 1);
  assert.deepEqual(upgraded.read().state, expected);
});

test('record leases block other sessions, renew with the same token and expire', () => {
  const { store } = legacyStore(fixture());
  store.migrateLegacy();
  const owner = { id: 'u1', username: 'owner', name: 'Owner' };
  const other = { id: 'u2', username: 'accountant', name: 'Accountant' };
  const acquired = store.acquireLease({
    companyId: 'co1',
    recordType: 'voucher',
    recordId: 'vou1',
    user: owner,
  });
  assert.equal(acquired.ok, true);
  assert.ok(acquired.token);
  assert.deepEqual(store.leaseFor('co1', 'voucher', 'vou1').username, 'owner');

  const blocked = store.acquireLease({
    companyId: 'co1',
    recordType: 'voucher',
    recordId: 'vou1',
    user: other,
  });
  assert.equal(blocked.locked, true);
  assert.equal(blocked.holder.username, 'owner');

  const renewed = store.acquireLease({
    companyId: 'co1',
    recordType: 'voucher',
    recordId: 'vou1',
    user: owner,
    token: acquired.token,
  });
  assert.equal(renewed.ok, true);
  assert.equal(renewed.renewed, true);
  assert.equal(renewed.token, acquired.token);

  const wrongRelease = store.releaseLease({
    companyId: 'co1',
    recordType: 'voucher',
    recordId: 'vou1',
    token: 'not-the-token',
  });
  assert.equal(wrongRelease.locked, true);
  assert.equal(
    store.releaseLease({
      companyId: 'co1',
      recordType: 'voucher',
      recordId: 'vou1',
      token: acquired.token,
    }).released,
    true,
  );
  assert.equal(store.leaseFor('co1', 'voucher', 'vou1'), null);

  const expiring = store.acquireLease({
    companyId: 'co1',
    recordType: 'voucher',
    recordId: 'vou1',
    user: owner,
  });
  store.db
    .prepare('UPDATE workspace_leases SET expires_at = ? WHERE company_id = ? AND record_id = ?')
    .run(new Date(Date.now() - 1000).toISOString(), 'co1', 'vou1');
  const takeover = store.acquireLease({
    companyId: 'co1',
    recordType: 'voucher',
    recordId: 'vou1',
    user: other,
  });
  assert.equal(takeover.ok, true);
  assert.notEqual(takeover.token, expiring.token);
  assert.equal(store.leaseFor('co1', 'voucher', 'vou1').username, 'accountant');
});

test('a normalized workspace without history can seed the current revision', () => {
  const { db, store } = legacyStore(fixture(), 6);
  store.migrateLegacy();
  db.prepare('DELETE FROM workspace_revisions').run();
  assert.equal(store.ensureHistory(), true);
  assert.equal(store.ensureHistory(), false);
  const current = store.read();
  const local = structuredClone(current.state);
  local.companies[0].name = 'Renamed';
  assert.equal(store.write(local, current.rev, { updatedAt: 'later' }).conflict, false);
});

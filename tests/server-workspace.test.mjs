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
        createdAt: '2026-03-01T00:00:00.000Z',
        years: [{ id: 'year1', start: '2026-04-01', end: '2027-03-31', closed: false }],
        groups: [
          { id: 'grp1', name: 'Sundry Debtors', parentId: 'assets', nature: 'assets', key: 'debtors' },
        ],
        ledgers: [
          {
            id: 'led1',
            name: 'Sharma Traders',
            groupId: 'grp1',
            opening: 0,
            openingType: 'Dr',
            gstin: '27AABCU9603R1ZM',
            stateCode: '27',
            pan: 'ABCDE1234F',
            address: '1 Market Road',
            city: 'Pune',
            pin: '411001',
            gstRole: 'cgst',
            createdAt: '2026-04-01T00:00:00.000Z',
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
        costCentres: [
          {
            id: 'cc1',
            name: 'North',
            categoryId: 'ccat1',
            createdAt: '2026-03-03T00:00:00.000Z',
          },
        ],
        costCategories: [
          { id: 'ccat1', name: 'Primary Cost Category', createdAt: '2026-03-03T00:00:00.000Z' },
        ],
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
            createdAt: '2026-04-02T00:00:00.000Z',
          },
        ],
        godowns: [{ id: 'gd1', name: 'Main Location', primary: true }],
        budgets: [
          {
            id: 'bud1',
            name: 'Sales budget',
            targetType: 'ledger',
            targetId: 'led1',
            yearId: 'year1',
            amount: 1000,
            createdAt: '2026-03-05T00:00:00.000Z',
          },
        ],
        currencies: [
          {
            id: 'cur1',
            code: 'USD',
            name: 'US Dollar',
            symbol: '$',
            rates: [{ date: '2026-04-01', rate: 83 }],
            createdAt: '2026-03-04T00:00:00.000Z',
          },
        ],
        stockTransfers: [
          {
            id: 'xfer1',
            no: 1,
            date: '2026-04-12',
            fromGodownId: 'gd1',
            toGodownId: 'gd2',
            items: [{ stockItemId: 'item1', qty: 2, batchNo: 'B1' }],
            narration: 'Move to shop',
            createdAt: '2026-04-12T00:00:00.000Z',
          },
        ],
        orders: [
          {
            id: 'ord1',
            type: 'Sales',
            no: 1,
            date: '2026-04-13',
            partyLedgerId: 'led1',
            deliveryDate: '2026-04-20',
            items: [{ stockItemId: 'item1', qty: 5, rate: 100, amount: 500, godownId: 'gd1' }],
            total: 500,
            status: 'Open',
            narration: 'SO-1',
            createdAt: '2026-04-13T00:00:00.000Z',
          },
        ],
        boms: [
          {
            id: 'bom1',
            name: 'Widget kit',
            outputItemId: 'item1',
            outputQty: 1,
            components: [{ stockItemId: 'comp1', qty: 3 }],
            createdAt: '2026-04-14T00:00:00.000Z',
          },
        ],
        manufactures: [
          {
            id: 'mfg1',
            no: 1,
            date: '2026-04-15',
            bomId: 'bom1',
            bomName: 'Widget kit',
            bomOutputQty: 1,
            outputItemId: 'item1',
            outputQty: 2,
            componentGodownId: 'gd1',
            outputGodownId: 'gd1',
            components: [{ stockItemId: 'comp1', qty: 6 }],
            outputBatchNo: 'MB1',
            expiryDate: '2027-04-15',
            narration: 'Production run',
            createdAt: '2026-04-15T00:00:00.000Z',
          },
        ],
        taxChallans: [
          {
            id: 'challan1',
            kind: 'TDS',
            date: '2026-04-16',
            amount: 1200,
            reference: 'CH-1',
            bsrCode: '0001234',
            sectionId: 'tds1',
          },
        ],
      },
      {
        id: 'co2',
        name: 'Beta Services',
        fyStart: '2026-04-01',
        fyEnd: '2027-03-31',
        yearId: 'year2',
        createdAt: '2026-03-02T00:00:00.000Z',
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
  const promoted = db.prepare('SELECT * FROM ledgers WHERE id = ?').get('led1');
  assert.equal(promoted.opening, 0);
  assert.equal(promoted.opening_type, 'Dr');
  assert.equal(promoted.gstin, '27AABCU9603R1ZM');
  assert.equal(promoted.state_code, '27');
  assert.equal(promoted.pan, 'ABCDE1234F');
  assert.equal(promoted.address, '1 Market Road');
  assert.equal(promoted.city, 'Pune');
  assert.equal(promoted.pin, '411001');
  assert.equal(promoted.gst_role, 'cgst');
  assert.equal(promoted.created_at, '2026-04-01T00:00:00.000Z');
  const ledgerJson = JSON.parse(promoted.data);
  for (const field of ['opening', 'openingType', 'gstin', 'stateCode', 'pan', 'address', 'city', 'pin', 'gstRole', 'createdAt']) {
    assert.equal(ledgerJson[field], undefined, `${field} should not remain in ledger JSON`);
  }
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get('co1');
  assert.equal(company.created_at, '2026-03-01T00:00:00.000Z');
  const companyJson = JSON.parse(company.data);
  for (const field of ['id', 'name', 'fyStart', 'fyEnd', 'yearId', 'createdAt']) {
    assert.equal(companyJson[field], undefined, `${field} should not remain in company JSON`);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM vouchers').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM voucher_lines').get().count, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM account_groups').get().count, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM company_records WHERE collection = 'groups'").get().count,
    0,
  );
  const group = db.prepare('SELECT * FROM account_groups WHERE id = ?').get('grp1');
  assert.equal(group.name, 'Sundry Debtors');
  assert.equal(group.parent_id, 'assets');
  assert.equal(JSON.parse(group.data).name, undefined);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM financial_years').get().count, 2);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM company_records WHERE collection = 'years'").get().count,
    0,
  );
  const year = db.prepare('SELECT * FROM financial_years WHERE id = ?').get('year1');
  assert.equal(year.start_date, '2026-04-01');
  assert.equal(year.end_date, '2027-03-31');
  assert.equal(year.closed, 0);
  const yearJson = JSON.parse(year.data);
  for (const field of ['id', 'start', 'end', 'closed']) {
    assert.equal(yearJson[field], undefined, `${field} should not remain in financial year JSON`);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cost_categories').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cost_centres').get().count, 1);
  for (const collection of ['costCategories', 'costCentres']) {
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM company_records WHERE collection = ?').get(collection)
        .count,
      0,
    );
  }
  const category = db.prepare('SELECT * FROM cost_categories WHERE id = ?').get('ccat1');
  assert.equal(category.name, 'Primary Cost Category');
  assert.equal(category.created_at, '2026-03-03T00:00:00.000Z');
  const categoryJson = JSON.parse(category.data);
  for (const field of ['id', 'name', 'createdAt']) {
    assert.equal(categoryJson[field], undefined, `${field} should not remain in cost category JSON`);
  }
  const centre = db.prepare('SELECT * FROM cost_centres WHERE id = ?').get('cc1');
  assert.equal(centre.name, 'North');
  assert.equal(centre.category_id, 'ccat1');
  assert.equal(centre.created_at, '2026-03-03T00:00:00.000Z');
  const centreJson = JSON.parse(centre.data);
  for (const field of ['id', 'name', 'categoryId', 'createdAt']) {
    assert.equal(centreJson[field], undefined, `${field} should not remain in cost centre JSON`);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stock_items').get().count, 1);
  const stockItem = db.prepare('SELECT * FROM stock_items WHERE id = ?').get('item1');
  assert.equal(stockItem.name, 'Widget');
  assert.equal(stockItem.stock_group_id, 'sg1');
  assert.equal(stockItem.unit_id, 'unit1');
  assert.equal(stockItem.hsn, '1234');
  assert.equal(stockItem.opening_qty, 5);
  assert.equal(stockItem.opening_rate, 10);
  assert.equal(stockItem.batch_tracking, 1);
  assert.equal(stockItem.created_at, '2026-04-02T00:00:00.000Z');
  const stockJson = JSON.parse(stockItem.data);
  for (const field of ['id', 'name', 'stockGroupId', 'unitId', 'hsn', 'openingQty', 'openingRate', 'batchTracking', 'createdAt']) {
    assert.equal(stockJson[field], undefined, `${field} should not remain in stock item JSON`);
  }

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
      'stockTransfers',
      'orders',
      'boms',
      'manufactures',
      'taxChallans',
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
  db.prepare('DELETE FROM account_groups').run();
  db.prepare('DELETE FROM financial_years').run();
  db.prepare('DELETE FROM cost_categories').run();
  db.prepare('DELETE FROM cost_centres').run();
  db.prepare('DELETE FROM units').run();
  db.prepare('DELETE FROM stock_groups').run();
  db.prepare('DELETE FROM godowns').run();
  db.prepare('DELETE FROM budgets').run();
  db.prepare('DELETE FROM currencies').run();
  db.prepare('DELETE FROM stock_transfers').run();
  db.prepare('DELETE FROM orders').run();
  db.prepare('DELETE FROM boms').run();
  db.prepare('DELETE FROM manufactures').run();
  db.prepare('DELETE FROM tax_challans').run();
  db.prepare('DELETE FROM stock_items').run();
  db.prepare('UPDATE workspace_meta SET schema_version = 1').run();

  const upgraded = new WorkspaceStore(db);
  assert.equal(
    db.prepare('SELECT schema_version FROM workspace_meta').get().schema_version,
    11,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM account_groups').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM financial_years').get().count, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cost_categories').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cost_centres').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM units').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stock_groups').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM godowns').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM budgets').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM currencies').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stock_items').get().count, 1);
  assert.deepEqual(upgraded.read().state, expected);
});

test('schema version 2 promotes ledger JSON fields into typed columns', () => {
  const { db, store } = legacyStore(fixture());
  store.migrateLegacy();
  const expected = store.read().state;
  const ledger = expected.companies[0].ledgers[0];
  const data = JSON.parse(db.prepare('SELECT data FROM ledgers WHERE id = ?').get('led1').data);
  for (const field of ['opening', 'openingType', 'gstin', 'stateCode', 'pan', 'address', 'city', 'pin', 'gstRole', 'createdAt']) {
    data[field] = ledger[field];
  }
  db.prepare(
    `UPDATE ledgers SET opening = NULL, opening_type = NULL, gstin = NULL, state_code = NULL,
       pan = NULL, address = NULL, city = NULL, pin = NULL, gst_role = NULL, created_at = NULL,
       data = ? WHERE id = ?`,
  ).run(JSON.stringify(data), 'led1');
  db.prepare('UPDATE workspace_meta SET schema_version = 2').run();

  const upgraded = new WorkspaceStore(db);
  assert.equal(db.prepare('SELECT schema_version FROM workspace_meta').get().schema_version, 11);
  const row = db.prepare('SELECT * FROM ledgers WHERE id = ?').get('led1');
  assert.equal(row.opening, 0);
  assert.equal(row.opening_type, 'Dr');
  assert.equal(row.pan, 'ABCDE1234F');
  assert.equal(row.pin, '411001');
  assert.equal(row.gst_role, 'cgst');
  assert.deepEqual(upgraded.read().state, expected);
});

test('schema version 3 promotes company and stock item JSON fields into typed columns', () => {
  const original = fixture();
  const { db, store } = legacyStore(original);
  store.migrateLegacy();
  const expected = store.read().state;
  db.prepare('UPDATE companies SET data = ?, created_at = NULL WHERE id = ?').run(
    JSON.stringify(original.companies[0]),
    'co1',
  );
  db.prepare(
    `UPDATE stock_items SET data = ?, stock_group_id = NULL, unit_id = NULL, hsn = NULL,
       opening_qty = NULL, opening_rate = NULL, created_at = NULL
     WHERE id = ?`,
  ).run(JSON.stringify(original.companies[0].stockItems[0]), 'item1');
  db.prepare('UPDATE workspace_meta SET schema_version = 3').run();

  const upgraded = new WorkspaceStore(db);
  assert.equal(db.prepare('SELECT schema_version FROM workspace_meta').get().schema_version, 11);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get('co1');
  assert.equal(company.created_at, '2026-03-01T00:00:00.000Z');
  assert.equal(JSON.parse(company.data).name, undefined);
  const stockItem = db.prepare('SELECT * FROM stock_items WHERE id = ?').get('item1');
  assert.equal(stockItem.stock_group_id, 'sg1');
  assert.equal(stockItem.unit_id, 'unit1');
  assert.equal(stockItem.hsn, '1234');
  assert.equal(stockItem.opening_qty, 5);
  assert.equal(stockItem.opening_rate, 10);
  assert.equal(stockItem.batch_tracking, 1);
  assert.equal(stockItem.created_at, '2026-04-02T00:00:00.000Z');
  const stockJson = JSON.parse(stockItem.data);
  for (const field of ['name', 'stockGroupId', 'unitId', 'hsn', 'openingQty', 'openingRate', 'batchTracking', 'createdAt']) {
    assert.equal(stockJson[field], undefined, `${field} should not remain in stock item JSON`);
  }
  assert.deepEqual(upgraded.read().state, expected);
});

test('schema version 4 moves account groups out of collection rows', () => {
  const original = fixture();
  const { db, store } = legacyStore(original);
  store.migrateLegacy();
  const expected = store.read().state;
  const group = original.companies[0].groups[0];
  db.prepare('DELETE FROM account_groups').run();
  db.prepare(
    `INSERT INTO company_records
       (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
     VALUES (?, 'groups', ?, 0, ?, ?, NULL, NULL, ?)`,
  ).run('co1', group.id, group.name, group.parentId, JSON.stringify(group));
  db.prepare('UPDATE workspace_meta SET schema_version = 4').run();

  const upgraded = new WorkspaceStore(db);
  assert.equal(db.prepare('SELECT schema_version FROM workspace_meta').get().schema_version, 11);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM company_records WHERE collection = 'groups'").get().count,
    0,
  );
  const row = db.prepare('SELECT * FROM account_groups WHERE id = ?').get('grp1');
  assert.equal(row.name, 'Sundry Debtors');
  assert.equal(row.parent_id, 'assets');
  assert.equal(row.nature, 'assets');
  assert.equal(row.group_key, 'debtors');
  const data = JSON.parse(row.data);
  for (const field of ['id', 'name', 'parentId', 'nature', 'key']) {
    assert.equal(data[field], undefined, `${field} should not remain in group JSON`);
  }
  assert.deepEqual(upgraded.read().state, expected);
});

test('schema version 5 moves financial years out of collection rows', () => {
  const original = fixture();
  const { db, store } = legacyStore(original);
  store.migrateLegacy();
  const expected = store.read().state;
  const year = original.companies[0].years[0];
  db.prepare("DELETE FROM financial_years WHERE company_id = 'co1'").run();
  db.prepare(
    `INSERT INTO company_records
       (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
     VALUES (?, 'years', ?, 0, NULL, NULL, NULL, NULL, ?)`,
  ).run('co1', year.id, JSON.stringify(year));
  db.prepare('UPDATE workspace_meta SET schema_version = 5').run();

  const upgraded = new WorkspaceStore(db);
  assert.equal(db.prepare('SELECT schema_version FROM workspace_meta').get().schema_version, 11);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM company_records WHERE collection = 'years'").get().count,
    0,
  );
  const row = db.prepare('SELECT * FROM financial_years WHERE id = ?').get('year1');
  assert.equal(row.start_date, '2026-04-01');
  assert.equal(row.end_date, '2027-03-31');
  assert.equal(row.closed, 0);
  const data = JSON.parse(row.data);
  for (const field of ['id', 'start', 'end', 'closed']) {
    assert.equal(data[field], undefined, `${field} should not remain in financial year JSON`);
  }
  assert.deepEqual(upgraded.read().state, expected);
});

test('schema version 6 moves cost masters out of collection rows', () => {
  const original = fixture();
  const { db, store } = legacyStore(original);
  store.migrateLegacy();
  const expected = store.read().state;
  const category = original.companies[0].costCategories[0];
  const centre = original.companies[0].costCentres[0];
  db.prepare("DELETE FROM cost_categories WHERE company_id = 'co1'").run();
  db.prepare("DELETE FROM cost_centres WHERE company_id = 'co1'").run();
  db.prepare(
    `INSERT INTO company_records
       (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
     VALUES (?, 'costCategories', ?, 0, ?, NULL, NULL, NULL, ?)`,
  ).run('co1', category.id, category.name, JSON.stringify(category));
  db.prepare(
    `INSERT INTO company_records
       (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
     VALUES (?, 'costCentres', ?, 0, ?, ?, NULL, NULL, ?)`,
  ).run('co1', centre.id, centre.name, centre.categoryId, JSON.stringify(centre));
  db.prepare('UPDATE workspace_meta SET schema_version = 6').run();

  const upgraded = new WorkspaceStore(db);
  assert.equal(db.prepare('SELECT schema_version FROM workspace_meta').get().schema_version, 11);
  for (const collection of ['costCategories', 'costCentres']) {
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM company_records WHERE collection = ?').get(collection)
        .count,
      0,
    );
  }
  const categoryRow = db.prepare('SELECT * FROM cost_categories WHERE id = ?').get('ccat1');
  assert.equal(categoryRow.name, 'Primary Cost Category');
  assert.equal(categoryRow.created_at, '2026-03-03T00:00:00.000Z');
  const categoryData = JSON.parse(categoryRow.data);
  for (const field of ['id', 'name', 'createdAt']) {
    assert.equal(categoryData[field], undefined, `${field} should not remain in category JSON`);
  }
  const centreRow = db.prepare('SELECT * FROM cost_centres WHERE id = ?').get('cc1');
  assert.equal(centreRow.name, 'North');
  assert.equal(centreRow.category_id, 'ccat1');
  assert.equal(centreRow.created_at, '2026-03-03T00:00:00.000Z');
  const centreData = JSON.parse(centreRow.data);
  for (const field of ['id', 'name', 'categoryId', 'createdAt']) {
    assert.equal(centreData[field], undefined, `${field} should not remain in centre JSON`);
  }
  assert.deepEqual(upgraded.read().state, expected);
});

test('schema version 7 moves inventory masters out of collection rows', () => {
  const original = fixture();
  const { db, store } = legacyStore(original);
  store.migrateLegacy();
  const expected = store.read().state;
  const masters = [
    ['units', 'unit1', original.companies[0].units[0]],
    ['stockGroups', 'sg1', original.companies[0].stockGroups[0]],
    ['godowns', 'gd1', original.companies[0].godowns[0]],
  ];
  db.prepare('DELETE FROM units').run();
  db.prepare('DELETE FROM stock_groups').run();
  db.prepare('DELETE FROM godowns').run();
  for (const [collection, id, master] of masters) {
    db.prepare(
      `INSERT INTO company_records
         (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
       VALUES (?, ?, ?, 0, ?, NULL, NULL, NULL, ?)`,
    ).run('co1', collection, id, master.name, JSON.stringify(master));
  }
  db.prepare('UPDATE workspace_meta SET schema_version = 7').run();

  const upgraded = new WorkspaceStore(db);
  assert.equal(db.prepare('SELECT schema_version FROM workspace_meta').get().schema_version, 11);
  for (const collection of ['units', 'stockGroups', 'godowns']) {
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM company_records WHERE collection = ?').get(collection)
        .count,
      0,
    );
  }
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get('unit1');
  assert.equal(unit.name, 'Numbers');
  assert.equal(unit.symbol, 'Nos');
  const unitData = JSON.parse(unit.data);
  for (const field of ['id', 'name', 'symbol']) {
    assert.equal(unitData[field], undefined, `${field} should not remain in unit JSON`);
  }
  const group = db.prepare('SELECT * FROM stock_groups WHERE id = ?').get('sg1');
  assert.equal(group.name, 'Primary');
  assert.equal(group.is_primary, 1);
  const groupData = JSON.parse(group.data);
  for (const field of ['id', 'name', 'primary']) {
    assert.equal(groupData[field], undefined, `${field} should not remain in stock group JSON`);
  }
  const godown = db.prepare('SELECT * FROM godowns WHERE id = ?').get('gd1');
  assert.equal(godown.name, 'Main Location');
  assert.equal(godown.is_primary, 1);
  const godownData = JSON.parse(godown.data);
  for (const field of ['id', 'name', 'primary']) {
    assert.equal(godownData[field], undefined, `${field} should not remain in godown JSON`);
  }
  assert.deepEqual(upgraded.read().state, expected);
});

test('schema version 8 moves budgets and currencies out of collection rows', () => {
  const original = fixture();
  const { db, store } = legacyStore(original);
  store.migrateLegacy();
  const expected = store.read().state;
  const budget = original.companies[0].budgets[0];
  const currency = original.companies[0].currencies[0];
  db.prepare('DELETE FROM budgets').run();
  db.prepare('DELETE FROM currencies').run();
  db.prepare(
    `INSERT INTO company_records
       (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
     VALUES (?, 'budgets', ?, 0, ?, ?, ?, ?, ?)`,
  ).run('co1', budget.id, budget.name, budget.targetId, budget.yearId, budget.amount, JSON.stringify(budget));
  db.prepare(
    `INSERT INTO company_records
       (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
     VALUES (?, 'currencies', ?, 0, ?, NULL, NULL, NULL, ?)`,
  ).run('co1', currency.id, currency.name, JSON.stringify(currency));
  db.prepare('UPDATE workspace_meta SET schema_version = 8').run();

  const upgraded = new WorkspaceStore(db);
  assert.equal(db.prepare('SELECT schema_version FROM workspace_meta').get().schema_version, 11);
  for (const collection of ['budgets', 'currencies']) {
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM company_records WHERE collection = ?').get(collection)
        .count,
      0,
    );
  }
  const budgetRow = db.prepare('SELECT * FROM budgets WHERE id = ?').get('bud1');
  assert.equal(budgetRow.name, 'Sales budget');
  assert.equal(budgetRow.target_type, 'ledger');
  assert.equal(budgetRow.target_id, 'led1');
  assert.equal(budgetRow.year_id, 'year1');
  assert.equal(budgetRow.amount, 1000);
  assert.equal(budgetRow.created_at, '2026-03-05T00:00:00.000Z');
  const budgetData = JSON.parse(budgetRow.data);
  for (const field of ['id', 'name', 'targetType', 'targetId', 'yearId', 'amount', 'createdAt']) {
    assert.equal(budgetData[field], undefined, `${field} should not remain in budget JSON`);
  }
  const currencyRow = db.prepare('SELECT * FROM currencies WHERE id = ?').get('cur1');
  assert.equal(currencyRow.code, 'USD');
  assert.equal(currencyRow.name, 'US Dollar');
  assert.equal(currencyRow.symbol, '$');
  assert.equal(currencyRow.created_at, '2026-03-04T00:00:00.000Z');
  const currencyData = JSON.parse(currencyRow.data);
  for (const field of ['id', 'code', 'name', 'symbol', 'createdAt']) {
    assert.equal(currencyData[field], undefined, `${field} should not remain in currency JSON`);
  }
  assert.deepEqual(currencyData.rates, [{ date: '2026-04-01', rate: 83 }]);
  assert.deepEqual(upgraded.read().state, expected);
});

test('schema version 9 moves stock transfers and orders out of collection rows', () => {
  const original = fixture();
  const { db, store } = legacyStore(original);
  store.migrateLegacy();
  const expected = store.read().state;
  const transfer = original.companies[0].stockTransfers[0];
  const order = original.companies[0].orders[0];
  db.prepare('DELETE FROM stock_transfers').run();
  db.prepare('DELETE FROM orders').run();
  db.prepare(
    `INSERT INTO company_records
       (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
     VALUES (?, 'stockTransfers', ?, 0, NULL, ?, NULL, NULL, ?)`,
  ).run('co1', transfer.id, transfer.fromGodownId, JSON.stringify(transfer));
  db.prepare(
    `INSERT INTO company_records
       (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
     VALUES (?, 'orders', ?, 0, NULL, ?, NULL, ?, ?)`,
  ).run('co1', order.id, order.partyLedgerId, order.total, JSON.stringify(order));
  db.prepare('UPDATE workspace_meta SET schema_version = 9').run();

  const upgraded = new WorkspaceStore(db);
  assert.equal(db.prepare('SELECT schema_version FROM workspace_meta').get().schema_version, 11);
  for (const collection of ['stockTransfers', 'orders']) {
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM company_records WHERE collection = ?').get(collection)
        .count,
      0,
    );
  }
  const transferRow = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get('xfer1');
  assert.equal(transferRow.no, 1);
  assert.equal(transferRow.date, '2026-04-12');
  assert.equal(transferRow.from_godown_id, 'gd1');
  assert.equal(transferRow.to_godown_id, 'gd2');
  assert.equal(transferRow.narration, 'Move to shop');
  assert.equal(transferRow.created_at, '2026-04-12T00:00:00.000Z');
  const transferData = JSON.parse(transferRow.data);
  for (const field of ['id', 'no', 'date', 'fromGodownId', 'toGodownId', 'narration', 'createdAt']) {
    assert.equal(transferData[field], undefined, `${field} should not remain in transfer JSON`);
  }
  assert.equal(transferData.items[0].qty, 2);
  const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get('ord1');
  assert.equal(orderRow.type, 'Sales');
  assert.equal(orderRow.no, 1);
  assert.equal(orderRow.date, '2026-04-13');
  assert.equal(orderRow.party_ledger_id, 'led1');
  assert.equal(orderRow.delivery_date, '2026-04-20');
  assert.equal(orderRow.total, 500);
  assert.equal(orderRow.status, 'Open');
  assert.equal(orderRow.created_at, '2026-04-13T00:00:00.000Z');
  const orderData = JSON.parse(orderRow.data);
  for (const field of ['id', 'type', 'no', 'date', 'partyLedgerId', 'deliveryDate', 'total', 'status', 'narration', 'createdAt']) {
    assert.equal(orderData[field], undefined, `${field} should not remain in order JSON`);
  }
  assert.equal(orderData.items[0].rate, 100);
  assert.deepEqual(upgraded.read().state, expected);
});

test('schema version 10 moves BOMs, production runs and tax challans out of collection rows', () => {
  const original = fixture();
  const { db, store } = legacyStore(original);
  store.migrateLegacy();
  const expected = store.read().state;
  const bom = original.companies[0].boms[0];
  const manufacture = original.companies[0].manufactures[0];
  const challan = original.companies[0].taxChallans[0];
  db.prepare('DELETE FROM boms').run();
  db.prepare('DELETE FROM manufactures').run();
  db.prepare('DELETE FROM tax_challans').run();
  db.prepare(
    `INSERT INTO company_records
       (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
     VALUES (?, 'boms', ?, 0, ?, NULL, ?, NULL, ?)`,
  ).run('co1', bom.id, bom.name, bom.outputItemId, JSON.stringify(bom));
  db.prepare(
    `INSERT INTO company_records
       (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
     VALUES (?, 'manufactures', ?, 0, NULL, ?, ?, ?, ?)`,
  ).run(
    'co1',
    manufacture.id,
    manufacture.bomId,
    manufacture.outputItemId,
    manufacture.outputQty,
    JSON.stringify(manufacture),
  );
  db.prepare(
    `INSERT INTO company_records
       (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
     VALUES (?, 'taxChallans', ?, 0, NULL, NULL, NULL, ?, ?)`,
  ).run('co1', challan.id, challan.amount, JSON.stringify(challan));
  db.prepare('UPDATE workspace_meta SET schema_version = 10').run();

  const upgraded = new WorkspaceStore(db);
  assert.equal(db.prepare('SELECT schema_version FROM workspace_meta').get().schema_version, 11);
  for (const collection of ['boms', 'manufactures', 'taxChallans']) {
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM company_records WHERE collection = ?').get(collection)
        .count,
      0,
    );
  }
  const bomRow = db.prepare('SELECT * FROM boms WHERE id = ?').get('bom1');
  assert.equal(bomRow.name, 'Widget kit');
  assert.equal(bomRow.output_item_id, 'item1');
  assert.equal(bomRow.output_qty, 1);
  assert.equal(bomRow.created_at, '2026-04-14T00:00:00.000Z');
  const bomData = JSON.parse(bomRow.data);
  for (const field of ['id', 'name', 'outputItemId', 'outputQty', 'createdAt']) {
    assert.equal(bomData[field], undefined, `${field} should not remain in BOM JSON`);
  }
  assert.deepEqual(bomData.components, [{ stockItemId: 'comp1', qty: 3 }]);
  const manufactureRow = db.prepare('SELECT * FROM manufactures WHERE id = ?').get('mfg1');
  assert.equal(manufactureRow.no, 1);
  assert.equal(manufactureRow.date, '2026-04-15');
  assert.equal(manufactureRow.bom_id, 'bom1');
  assert.equal(manufactureRow.bom_name, 'Widget kit');
  assert.equal(manufactureRow.bom_output_qty, 1);
  assert.equal(manufactureRow.output_item_id, 'item1');
  assert.equal(manufactureRow.output_qty, 2);
  assert.equal(manufactureRow.component_godown_id, 'gd1');
  assert.equal(manufactureRow.output_godown_id, 'gd1');
  assert.equal(manufactureRow.output_batch_no, 'MB1');
  assert.equal(manufactureRow.expiry_date, '2027-04-15');
  assert.equal(manufactureRow.narration, 'Production run');
  assert.equal(manufactureRow.created_at, '2026-04-15T00:00:00.000Z');
  const manufactureData = JSON.parse(manufactureRow.data);
  for (const field of ['id', 'no', 'date', 'bomId', 'bomName', 'outputItemId', 'outputQty', 'createdAt']) {
    assert.equal(manufactureData[field], undefined, `${field} should not remain in production JSON`);
  }
  assert.deepEqual(manufactureData.components, [{ stockItemId: 'comp1', qty: 6 }]);
  const challanRow = db.prepare('SELECT * FROM tax_challans WHERE id = ?').get('challan1');
  assert.equal(challanRow.kind, 'TDS');
  assert.equal(challanRow.date, '2026-04-16');
  assert.equal(challanRow.amount, 1200);
  assert.equal(challanRow.reference, 'CH-1');
  assert.equal(challanRow.bsr_code, '0001234');
  assert.equal(challanRow.section_id, 'tds1');
  const challanData = JSON.parse(challanRow.data);
  for (const field of ['id', 'kind', 'date', 'amount', 'reference', 'bsrCode', 'sectionId']) {
    assert.equal(challanData[field], undefined, `${field} should not remain in challan JSON`);
  }
  assert.deepEqual(upgraded.read().state, expected);
});

test('normalized writes keep promoted company, group, year, cost master, inventory master, budget, currency, stock item and ledger columns in sync', () => {
  const { db, store } = legacyStore(fixture());
  store.migrateLegacy();
  const before = store.read();
  const next = structuredClone(before.state);
  Object.assign(next.companies[0], {
    name: 'Alpha Traders Updated',
    createdAt: '2026-05-01T00:00:00.000Z',
  });
  Object.assign(next.companies[0].groups[0], {
    name: 'Trade Debtors',
    nature: 'assets',
    key: 'tradeDebtors',
  });
  Object.assign(next.companies[0].years[0], { closed: true });
  Object.assign(next.companies[0].costCategories[0], {
    name: 'Primary',
    createdAt: '2026-05-03T00:00:00.000Z',
  });
  Object.assign(next.companies[0].costCentres[0], {
    name: 'North Zone',
    categoryId: 'ccat1',
    createdAt: '2026-05-03T00:00:00.000Z',
  });
  Object.assign(next.companies[0].units[0], { name: 'Pieces', symbol: 'Pcs' });
  Object.assign(next.companies[0].stockGroups[0], {
    name: 'Trade Goods',
    primary: false,
    code: 'SG-1',
  });
  Object.assign(next.companies[0].godowns[0], { name: 'Warehouse', primary: true });
  Object.assign(next.companies[0].budgets[0], {
    name: 'Sales plan',
    targetType: 'group',
    targetId: 'grp1',
    yearId: 'year1',
    amount: 1250.5,
    createdAt: '2026-05-04T00:00:00.000Z',
    note: 'Quarterly',
  });
  Object.assign(next.companies[0].currencies[0], {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    createdAt: '2026-05-05T00:00:00.000Z',
    note: 'Travel',
  });
  Object.assign(next.companies[0].stockTransfers[0], {
    no: 2,
    date: '2026-05-06',
    fromGodownId: 'gd2',
    toGodownId: 'gd1',
    narration: 'Return to main',
    createdAt: '2026-05-06T00:00:00.000Z',
  });
  Object.assign(next.companies[0].orders[0], {
    type: 'Purchase',
    no: 2,
    date: '2026-05-07',
    partyLedgerId: 'led2',
    deliveryDate: '2026-05-10',
    total: 750.5,
    status: 'Closed',
    narration: 'PO-2',
    createdAt: '2026-05-07T00:00:00.000Z',
  });
  Object.assign(next.companies[0].boms[0], {
    name: 'Gadget kit',
    outputItemId: 'item2',
    outputQty: 2,
    createdAt: '2026-05-08T00:00:00.000Z',
  });
  Object.assign(next.companies[0].manufactures[0], {
    no: 2,
    date: '2026-05-09',
    bomId: 'bom1',
    bomName: 'Gadget kit',
    bomOutputQty: 2,
    outputItemId: 'item2',
    outputQty: 4,
    componentGodownId: 'gd2',
    outputGodownId: 'gd1',
    outputBatchNo: 'MB2',
    expiryDate: '2027-05-09',
    narration: 'Second run',
    createdAt: '2026-05-09T00:00:00.000Z',
  });
  Object.assign(next.companies[0].taxChallans[0], {
    kind: 'TCS',
    date: '2026-05-11',
    amount: 2400,
    reference: 'CH-2',
    bsrCode: '0005678',
    sectionId: 'tcs1',
  });
  Object.assign(next.companies[0].stockItems[0], {
    name: 'Gadget',
    hsn: '5678',
    openingQty: 7.5,
    openingRate: 12,
    batchTracking: false,
    createdAt: '2026-05-02T00:00:00.000Z',
  });
  Object.assign(next.companies[0].ledgers[0], {
    opening: 500.25,
    openingType: 'Cr',
    pan: 'FGHIJ5678K',
    stateCode: '29',
    address: '9 Residency Road',
    city: 'Bengaluru',
    pin: '560001',
    gstRole: 'sgst',
  });
  assert.equal(store.write(next, before.rev, { updatedAt: '2026-06-01T00:00:00.000Z' }).conflict, false);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get('co1');
  assert.equal(company.name, 'Alpha Traders Updated');
  assert.equal(company.created_at, '2026-05-01T00:00:00.000Z');
  const companyJson = JSON.parse(company.data);
  for (const field of ['id', 'name', 'fyStart', 'fyEnd', 'yearId', 'createdAt']) {
    assert.equal(companyJson[field], undefined, `${field} should not remain in company JSON`);
  }
  const year = db.prepare('SELECT * FROM financial_years WHERE id = ?').get('year1');
  assert.equal(year.start_date, '2026-04-01');
  assert.equal(year.end_date, '2027-03-31');
  assert.equal(year.closed, 1);
  assert.equal(JSON.parse(year.data).closed, undefined);
  const group = db.prepare('SELECT * FROM account_groups WHERE id = ?').get('grp1');
  assert.equal(group.name, 'Trade Debtors');
  assert.equal(group.parent_id, 'assets');
  assert.equal(group.nature, 'assets');
  assert.equal(group.group_key, 'tradeDebtors');
  assert.equal(JSON.parse(group.data).name, undefined);
  const category = db.prepare('SELECT * FROM cost_categories WHERE id = ?').get('ccat1');
  assert.equal(category.name, 'Primary');
  assert.equal(category.created_at, '2026-05-03T00:00:00.000Z');
  assert.equal(JSON.parse(category.data).name, undefined);
  const centre = db.prepare('SELECT * FROM cost_centres WHERE id = ?').get('cc1');
  assert.equal(centre.name, 'North Zone');
  assert.equal(centre.category_id, 'ccat1');
  assert.equal(centre.created_at, '2026-05-03T00:00:00.000Z');
  assert.equal(JSON.parse(centre.data).name, undefined);
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get('unit1');
  assert.equal(unit.name, 'Pieces');
  assert.equal(unit.symbol, 'Pcs');
  assert.equal(JSON.parse(unit.data).name, undefined);
  const stockGroup = db.prepare('SELECT * FROM stock_groups WHERE id = ?').get('sg1');
  assert.equal(stockGroup.name, 'Trade Goods');
  assert.equal(stockGroup.is_primary, 0);
  const stockGroupData = JSON.parse(stockGroup.data);
  assert.equal(stockGroupData.name, undefined);
  assert.equal(stockGroupData.primary, undefined);
  assert.equal(stockGroupData.code, 'SG-1');
  const godown = db.prepare('SELECT * FROM godowns WHERE id = ?').get('gd1');
  assert.equal(godown.name, 'Warehouse');
  assert.equal(godown.is_primary, 1);
  assert.equal(JSON.parse(godown.data).name, undefined);
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get('bud1');
  assert.equal(budget.name, 'Sales plan');
  assert.equal(budget.target_type, 'group');
  assert.equal(budget.target_id, 'grp1');
  assert.equal(budget.year_id, 'year1');
  assert.equal(budget.amount, 1250.5);
  assert.equal(budget.created_at, '2026-05-04T00:00:00.000Z');
  const budgetData = JSON.parse(budget.data);
  assert.equal(budgetData.name, undefined);
  assert.equal(budgetData.amount, undefined);
  assert.equal(budgetData.note, 'Quarterly');
  const currency = db.prepare('SELECT * FROM currencies WHERE id = ?').get('cur1');
  assert.equal(currency.code, 'EUR');
  assert.equal(currency.name, 'Euro');
  assert.equal(currency.symbol, '€');
  assert.equal(currency.created_at, '2026-05-05T00:00:00.000Z');
  const currencyData = JSON.parse(currency.data);
  assert.equal(currencyData.code, undefined);
  assert.equal(currencyData.name, undefined);
  assert.equal(currencyData.note, 'Travel');
  assert.deepEqual(currencyData.rates, [{ date: '2026-04-01', rate: 83 }]);
  const transfer = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get('xfer1');
  assert.equal(transfer.no, 2);
  assert.equal(transfer.date, '2026-05-06');
  assert.equal(transfer.from_godown_id, 'gd2');
  assert.equal(transfer.to_godown_id, 'gd1');
  assert.equal(transfer.narration, 'Return to main');
  assert.equal(transfer.created_at, '2026-05-06T00:00:00.000Z');
  const transferData = JSON.parse(transfer.data);
  assert.equal(transferData.date, undefined);
  assert.equal(transferData.narration, undefined);
  assert.equal(transferData.items[0].qty, 2);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get('ord1');
  assert.equal(order.type, 'Purchase');
  assert.equal(order.no, 2);
  assert.equal(order.date, '2026-05-07');
  assert.equal(order.party_ledger_id, 'led2');
  assert.equal(order.delivery_date, '2026-05-10');
  assert.equal(order.total, 750.5);
  assert.equal(order.status, 'Closed');
  assert.equal(order.narration, 'PO-2');
  assert.equal(order.created_at, '2026-05-07T00:00:00.000Z');
  const orderData = JSON.parse(order.data);
  assert.equal(orderData.total, undefined);
  assert.equal(orderData.status, undefined);
  assert.equal(orderData.items[0].rate, 100);
  const bom = db.prepare('SELECT * FROM boms WHERE id = ?').get('bom1');
  assert.equal(bom.name, 'Gadget kit');
  assert.equal(bom.output_item_id, 'item2');
  assert.equal(bom.output_qty, 2);
  assert.equal(bom.created_at, '2026-05-08T00:00:00.000Z');
  const bomData = JSON.parse(bom.data);
  assert.equal(bomData.name, undefined);
  assert.equal(bomData.outputQty, undefined);
  assert.deepEqual(bomData.components, [{ stockItemId: 'comp1', qty: 3 }]);
  const manufacture = db.prepare('SELECT * FROM manufactures WHERE id = ?').get('mfg1');
  assert.equal(manufacture.no, 2);
  assert.equal(manufacture.date, '2026-05-09');
  assert.equal(manufacture.bom_id, 'bom1');
  assert.equal(manufacture.bom_name, 'Gadget kit');
  assert.equal(manufacture.bom_output_qty, 2);
  assert.equal(manufacture.output_item_id, 'item2');
  assert.equal(manufacture.output_qty, 4);
  assert.equal(manufacture.component_godown_id, 'gd2');
  assert.equal(manufacture.output_godown_id, 'gd1');
  assert.equal(manufacture.output_batch_no, 'MB2');
  assert.equal(manufacture.expiry_date, '2027-05-09');
  assert.equal(manufacture.narration, 'Second run');
  const manufactureData = JSON.parse(manufacture.data);
  assert.equal(manufactureData.outputQty, undefined);
  assert.equal(manufactureData.outputBatchNo, undefined);
  assert.deepEqual(manufactureData.components, [{ stockItemId: 'comp1', qty: 6 }]);
  const challan = db.prepare('SELECT * FROM tax_challans WHERE id = ?').get('challan1');
  assert.equal(challan.kind, 'TCS');
  assert.equal(challan.date, '2026-05-11');
  assert.equal(challan.amount, 2400);
  assert.equal(challan.reference, 'CH-2');
  assert.equal(challan.bsr_code, '0005678');
  assert.equal(challan.section_id, 'tcs1');
  assert.deepEqual(JSON.parse(challan.data), {});
  const stockItem = db.prepare('SELECT * FROM stock_items WHERE id = ?').get('item1');
  assert.equal(stockItem.name, 'Gadget');
  assert.equal(stockItem.hsn, '5678');
  assert.equal(stockItem.opening_qty, 7.5);
  assert.equal(stockItem.opening_rate, 12);
  assert.equal(stockItem.batch_tracking, 0);
  assert.equal(stockItem.created_at, '2026-05-02T00:00:00.000Z');
  assert.equal(JSON.parse(stockItem.data).name, undefined);
  const row = db.prepare('SELECT * FROM ledgers WHERE id = ?').get('led1');
  assert.equal(row.opening, 500.25);
  assert.equal(row.opening_type, 'Cr');
  assert.equal(row.pan, 'FGHIJ5678K');
  assert.equal(row.state_code, '29');
  assert.equal(row.address, '9 Residency Road');
  assert.equal(row.city, 'Bengaluru');
  assert.equal(row.pin, '560001');
  assert.equal(row.gst_role, 'sgst');
  assert.equal(JSON.parse(row.data).pan, undefined);
  assert.deepEqual(store.read().state.companies[0], next.companies[0]);
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

import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeWorkspaceStates, repairVoucherNumbers } from '../server-merge.js';

function baseState() {
  return {
    version: 1,
    activeCompanyId: 'co1',
    companies: [
      {
        id: 'co1',
        name: 'Alpha',
        fyStart: '2026-04-01',
        fyEnd: '2027-03-31',
        yearId: 'y1',
        years: [{ id: 'y1', start: '2026-04-01', end: '2027-03-31', closed: false }],
        ledgers: [
          { id: 'l1', name: 'Cash', groupId: 'cash', opening: 0, openingType: 'Dr' },
          { id: 'l2', name: 'Sales', groupId: 'sales', opening: 0, openingType: 'Cr' },
        ],
        vouchers: [
          {
            id: 'v1',
            type: 'Sales',
            no: 1,
            date: '2026-04-03',
            total: 100,
            narration: 'Original',
            lines: [
              { ledgerId: 'l1', side: 'Dr', amount: 100 },
              { ledgerId: 'l2', side: 'Cr', amount: 100 },
            ],
          },
          {
            id: 'v2',
            type: 'Payment',
            no: 1,
            date: '2026-04-04',
            total: 20,
            narration: 'Rent',
            lines: [
              { ledgerId: 'l2', side: 'Dr', amount: 20 },
              { ledgerId: 'l1', side: 'Cr', amount: 20 },
            ],
          },
        ],
      },
      {
        id: 'co2',
        name: 'Beta',
        fyStart: '2026-04-01',
        fyEnd: '2027-03-31',
        yearId: 'y2',
        years: [{ id: 'y2', start: '2026-04-01', end: '2027-03-31', closed: false }],
        ledgers: [],
        vouchers: [],
      },
    ],
    users: [{ id: 'u1', name: 'Owner', role: 'owner' }],
    audit: [{ id: 'a1', at: '2026-04-01T00:00:00.000Z', action: 'company.create', summary: 'Created' }],
    currentUserId: 'u1',
  };
}

function clone(value) {
  return structuredClone(value);
}

test('independent voucher additions merge', () => {
  const base = baseState();
  const local = clone(base);
  const current = clone(base);
  local.companies[0].vouchers.push({
    id: 'v3',
    type: 'Sales',
    no: 2,
    date: '2026-04-05',
    total: 50,
    narration: 'Local sale',
    lines: [{ ledgerId: 'l1', side: 'Dr', amount: 50 }],
  });
  current.companies[0].vouchers.push({
    id: 'v4',
    type: 'Payment',
    no: 2,
    date: '2026-04-06',
    total: 30,
    narration: 'Other payment',
    lines: [{ ledgerId: 'l1', side: 'Cr', amount: 30 }],
  });

  const merged = mergeWorkspaceStates(base, local, current);
  assert.equal(merged.ok, true, merged.reason);
  assert.deepEqual(
    merged.state.companies[0].vouchers.map((voucher) => voucher.id).sort(),
    ['v1', 'v2', 'v3', 'v4'],
  );
});

test('different fields on the same ledger merge without conflict', () => {
  const base = baseState();
  const local = clone(base);
  const current = clone(base);
  local.companies[0].ledgers[0].name = 'Cash in hand';
  current.companies[0].ledgers[0].opening = 500;

  const merged = mergeWorkspaceStates(base, local, current);
  assert.equal(merged.ok, true, merged.reason);
  assert.equal(merged.state.companies[0].ledgers[0].name, 'Cash in hand');
  assert.equal(merged.state.companies[0].ledgers[0].opening, 500);
});

test('the same field and delete-versus-modify conflicts are rejected', () => {
  const base = baseState();
  const local = clone(base);
  const current = clone(base);
  local.companies[0].ledgers[0].name = 'Local cash';
  current.companies[0].ledgers[0].name = 'Other cash';
  let merged = mergeWorkspaceStates(base, local, current);
  assert.equal(merged.ok, false);
  assert.match(merged.reason, /ledgers/);

  const deleted = clone(base);
  deleted.companies[0].vouchers = deleted.companies[0].vouchers.filter((voucher) => voucher.id !== 'v1');
  const edited = clone(base);
  edited.companies[0].vouchers[0].narration = 'Edited elsewhere';
  merged = mergeWorkspaceStates(base, deleted, edited);
  assert.equal(merged.ok, false);
});

test('voucher lines are atomic and overlapping line edits conflict', () => {
  const base = baseState();
  const local = clone(base);
  const current = clone(base);
  local.companies[0].vouchers[0].lines[0].amount = 120;
  current.companies[0].vouchers[0].lines[1].amount = 120;

  const merged = mergeWorkspaceStates(base, local, current);
  assert.equal(merged.ok, false);
  assert.match(merged.reason, /vouchers/);
});

test('merged vouchers with the same type and number are renumbered', () => {
  const base = baseState();
  const local = clone(base);
  const current = clone(base);
  local.companies[0].vouchers.push({
    id: 'v3',
    type: 'Sales',
    no: 2,
    date: '2026-04-05',
    total: 10,
    lines: [],
  });
  current.companies[0].vouchers.push({
    id: 'v4',
    type: 'Sales',
    no: 2,
    date: '2026-04-06',
    total: 20,
    lines: [],
  });
  const merged = mergeWorkspaceStates(base, local, current);
  assert.equal(merged.ok, true, merged.reason);
  assert.equal(repairVoucherNumbers(merged.state), 1);
  const numbers = merged.state.companies[0].vouchers
    .filter((voucher) => voucher.type === 'Sales')
    .map((voucher) => voucher.no)
    .sort((left, right) => left - right);
  assert.deepEqual(numbers, [1, 2, 3]);
  assert.equal(merged.state.companies[0].counters.Sales, 3);
});

test('audit additions merge by id and view selection stays local', () => {
  const base = baseState();
  const local = clone(base);
  const current = clone(base);
  local.audit.push({ id: 'a2', at: '2026-04-02T00:00:00.000Z', action: 'voucher.create', summary: 'Local' });
  current.audit.push({ id: 'a3', at: '2026-04-03T00:00:00.000Z', action: 'voucher.create', summary: 'Other' });
  local.activeCompanyId = 'co2';
  current.activeCompanyId = 'co3';

  const merged = mergeWorkspaceStates(base, local, current);
  assert.equal(merged.ok, true, merged.reason);
  assert.deepEqual(merged.state.audit.map((entry) => entry.id).sort(), ['a1', 'a2', 'a3']);
  assert.equal(merged.state.activeCompanyId, 'co2');
});

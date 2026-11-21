import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLedger,
  createCompany,
  exportState,
  findLedgerByName,
  importState,
  postVoucherBatch,
  validateVoucherBatch,
} from '../src/store.js';

function fixture() {
  const company = createCompany('Bulk Co', '2026-04-01').company;
  const cash = findLedgerByName(company, 'Cash');
  const expense = addLedger(company, {
    name: 'Office Expenses',
    groupId: company.groups.find((group) => group.key === 'indirectExpenses').id,
    opening: 0,
  }).ledger;
  return { company, cash, expense };
}

function row(company, cash, expense, overrides = {}) {
  return {
    type: 'Journal',
    date: '2026-04-05',
    narration: 'Bulk entry',
    lines: [
      { ledgerId: expense.id, side: 'Dr', amount: 1000 },
      { ledgerId: cash.id, side: 'Cr', amount: 1000 },
    ],
    ...overrides,
  };
}

function stateFor(company) {
  return { version: 1, activeCompanyId: company.id, companies: [company] };
}

test('a batch posts every valid row and keeps source references', () => {
  const { company, cash, expense } = fixture();
  const rows = [
    row(company, cash, expense, { batchRef: 'BULK-1', narration: 'Rent' }),
    row(company, cash, expense, {
      batchRef: 'BULK-2',
      date: '2026-04-06',
      narration: 'Stationery',
      lines: [
        { ledgerId: expense.id, side: 'Dr', amount: 500 },
        { ledgerId: cash.id, side: 'Cr', amount: 500 },
      ],
    }),
  ];
  const result = postVoucherBatch(company, rows);
  assert.equal(result.ok, true, result.errors?.[0]?.error);
  assert.equal(result.count, 2);
  assert.equal(company.vouchers.length, 2);
  assert.deepEqual(
    company.vouchers.map((voucher) => voucher.batchRef),
    ['BULK-1', 'BULK-2'],
  );
  assert.deepEqual(
    company.vouchers.map((voucher) => voucher.total),
    [1000, 500],
  );
});

test('one invalid row rolls back the whole batch', () => {
  const { company, cash, expense } = fixture();
  const existing = company.vouchers.length;
  const result = postVoucherBatch(company, [
    row(company, cash, expense, { batchRef: 'GOOD' }),
    row(company, cash, expense, {
      batchRef: 'BAD',
      lines: [
        { ledgerId: expense.id, side: 'Dr', amount: 0 },
        { ledgerId: cash.id, side: 'Cr', amount: 0 },
      ],
    }),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].index, 1);
  assert.match(result.errors[0].error, /greater than zero/i);
  assert.equal(company.vouchers.length, existing, 'no valid row from the batch was posted');
});

test('duplicate references stop the batch before posting', () => {
  const { company, cash, expense } = fixture();
  const repeated = postVoucherBatch(company, [
    row(company, cash, expense, { batchRef: 'SAME' }),
    row(company, cash, expense, { batchRef: 'SAME' }),
  ]);
  assert.equal(repeated.ok, false);
  assert.match(repeated.errors[0].error, /repeated/i);
  assert.equal(company.vouchers.length, 0);

  assert.equal(postVoucherBatch(company, [row(company, cash, expense, { batchRef: 'ONCE' })]).ok, true);
  const alreadyPosted = postVoucherBatch(company, [
    row(company, cash, expense, { batchRef: 'ONCE', date: '2026-04-07' }),
  ]);
  assert.equal(alreadyPosted.ok, false);
  assert.match(alreadyPosted.errors[0].error, /already been posted/i);
  assert.equal(company.vouchers.length, 1);
});

test('batch references survive a backup round trip', () => {
  const { company, cash, expense } = fixture();
  assert.equal(postVoucherBatch(company, [row(company, cash, expense, { batchRef: 'KEEP-ME' })]).ok, true);
  const restored = importState(exportState(stateFor(company)));
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.companies[0].vouchers[0].batchRef, 'KEEP-ME');
});

test('validation preview does not mutate the live company', () => {
  const { company, cash, expense } = fixture();
  const checked = validateVoucherBatch(company, [row(company, cash, expense, { batchRef: 'PREVIEW' })]);
  assert.equal(checked.ok, true);
  assert.equal(checked.vouchers.length, 1);
  assert.equal(company.vouchers.length, 0);
});

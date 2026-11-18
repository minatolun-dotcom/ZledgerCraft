import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLedger,
  addVoucher,
  createCompany,
  deleteVoucher,
  findLedgerByName,
} from '../src/store.js';
import {
  balanceSheet,
  dayBook,
  ledgerStatement,
  ledgerTotals,
  profitAndLoss,
  trialBalance,
} from '../src/accounting.js';

function makeCompany() {
  const result = createCompany('Test Traders', '2026-04-01');
  assert.equal(result.ok, true, result.error);
  return result.company;
}

function groupKeyFor(company, key) {
  return company.groups.find((group) => group.key === key).id;
}

function ledger(company, name, groupKey, opening = 0, openingType = 'Dr') {
  const result = addLedger(company, {
    name,
    groupId: groupKeyFor(company, groupKey),
    opening,
    openingType,
  });
  assert.equal(result.ok, true, result.error);
  return result.ledger;
}

function voucher(company, type, lines, date = '2026-04-15') {
  const result = addVoucher(company, { type, date, lines, narration: '' });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

test('new company has standard groups and seed ledgers', () => {
  const company = makeCompany();
  assert.equal(company.fyEnd, '2027-03-31');
  assert.ok(company.groups.some((group) => group.name === 'Sundry Debtors'));
  assert.deepEqual(
    company.ledgers.map((item) => item.name).sort(),
    ['Bank', 'Capital', 'Cash', 'Purchases', 'Sales'],
  );
});

test('company and ledger validation rejects bad input', () => {
  assert.equal(createCompany('   ', '2026-04-01').ok, false);
  assert.equal(createCompany('Bad FY', '2026-02-30').ok, false);

  const company = makeCompany();
  assert.equal(addLedger(company, { name: 'cash', groupId: groupKeyFor(company, 'cash') }).ok, false);
  assert.equal(addLedger(company, { name: 'Orphan', groupId: 'nope' }).ok, false);
  assert.equal(
    addLedger(company, { name: 'Negative', groupId: groupKeyFor(company, 'cash'), opening: -5 }).ok,
    false,
  );
});

test('unbalanced and malformed vouchers are rejected', () => {
  const company = makeCompany();
  const cash = findLedgerByName(company, 'Cash');
  const sales = findLedgerByName(company, 'Sales');

  const unbalanced = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 100 },
      { ledgerId: sales.id, side: 'Cr', amount: 90 },
    ],
  });
  assert.equal(unbalanced.ok, false);
  assert.match(unbalanced.error, /not balanced/i);

  const outsideFy = addVoucher(company, {
    type: 'Sales',
    date: '2027-05-01',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 100 },
      { ledgerId: sales.id, side: 'Cr', amount: 100 },
    ],
  });
  assert.equal(outsideFy.ok, false);

  const zero = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 0 },
      { ledgerId: sales.id, side: 'Cr', amount: 0 },
    ],
  });
  assert.equal(zero.ok, false);

  assert.equal(company.vouchers.length, 0);
  assert.equal(company.counters.Sales, undefined);
});

test('sales, purchase and expense vouchers flow through the reports', () => {
  const company = makeCompany();
  const cash = findLedgerByName(company, 'Cash');
  const sales = findLedgerByName(company, 'Sales');
  const purchases = findLedgerByName(company, 'Purchases');
  const rent = ledger(company, 'Rent', 'indirectExpenses');
  const debtor = ledger(company, 'Sharma Traders', 'sundryDebtors');
  const creditor = ledger(company, 'Gupta Supplies', 'sundryCreditors');

  voucher(company, 'Journal', [
    { ledgerId: cash.id, side: 'Dr', amount: 5000 },
    { ledgerId: findLedgerByName(company, 'Capital').id, side: 'Cr', amount: 5000 },
  ]);
  voucher(company, 'Sales', [
    { ledgerId: debtor.id, side: 'Dr', amount: 1000 },
    { ledgerId: sales.id, side: 'Cr', amount: 1000 },
  ]);
  voucher(company, 'Purchase', [
    { ledgerId: purchases.id, side: 'Dr', amount: 400 },
    { ledgerId: creditor.id, side: 'Cr', amount: 400 },
  ]);
  voucher(company, 'Payment', [
    { ledgerId: rent.id, side: 'Dr', amount: 500 },
    { ledgerId: cash.id, side: 'Cr', amount: 500 },
  ]);

  const totals = ledgerTotals(company);
  assert.equal(totals.get(cash.id).closing, 4500);
  assert.equal(totals.get(debtor.id).closing, 1000);
  assert.equal(totals.get(creditor.id).closing, -400);

  const trial = trialBalance(company);
  assert.equal(trial.balanced, true);
  assert.equal(trial.debitTotal, 6400);
  assert.equal(trial.creditTotal, 6400);

  const pnl = profitAndLoss(company);
  assert.equal(pnl.direct.incomeTotal, 1000);
  assert.equal(pnl.direct.expenseTotal, 400);
  assert.equal(pnl.grossProfit, 600);
  assert.equal(pnl.netProfit, 100);

  const sheet = balanceSheet(company);
  assert.equal(sheet.balanced, true);
  assert.equal(sheet.assets.total, 5500);
  assert.equal(sheet.liabilities.total, 5500);
  assert.equal(sheet.netProfit, 100);
});

test('voucher numbering increments per type', () => {
  const company = makeCompany();
  const cash = findLedgerByName(company, 'Cash');
  const sales = findLedgerByName(company, 'Sales');
  const first = voucher(company, 'Sales', [
    { ledgerId: cash.id, side: 'Dr', amount: 10 },
    { ledgerId: sales.id, side: 'Cr', amount: 10 },
  ]);
  const second = voucher(company, 'Sales', [
    { ledgerId: cash.id, side: 'Dr', amount: 20 },
    { ledgerId: sales.id, side: 'Cr', amount: 20 },
  ]);
  const receipt = voucher(company, 'Receipt', [
    { ledgerId: cash.id, side: 'Dr', amount: 5 },
    { ledgerId: sales.id, side: 'Cr', amount: 5 },
  ]);
  assert.equal(first.no, 1);
  assert.equal(second.no, 2);
  assert.equal(receipt.no, 1);
});

test('opening balances that do not balance appear as a difference row', () => {
  const company = makeCompany();
  ledger(company, 'Opening Cash', 'cash', 2500, 'Dr');
  ledger(company, 'Opening Capital', 'capital', 1000, 'Cr');

  const trial = trialBalance(company);
  assert.equal(trial.balanced, true);
  const differenceRow = trial.rows.find((row) => row.name === 'Difference in Opening Balances');
  assert.ok(differenceRow);
  assert.equal(differenceRow.credit, 1500);
  assert.equal(trial.debitTotal, trial.creditTotal);

  const sheet = balanceSheet(company);
  assert.equal(sheet.balanced, true);
});

test('day book filters by type and date range', () => {
  const company = makeCompany();
  const cash = findLedgerByName(company, 'Cash');
  const sales = findLedgerByName(company, 'Sales');

  voucher(company, 'Receipt', [
    { ledgerId: cash.id, side: 'Dr', amount: 100 },
    { ledgerId: sales.id, side: 'Cr', amount: 100 },
  ], '2026-04-05');
  voucher(company, 'Payment', [
    { ledgerId: sales.id, side: 'Dr', amount: 50 },
    { ledgerId: cash.id, side: 'Cr', amount: 50 },
  ], '2026-06-10');

  assert.equal(dayBook(company).length, 2);
  assert.equal(dayBook(company, { type: 'Payment' }).length, 1);
  assert.equal(dayBook(company, { from: '2026-05-01', to: '2026-06-30' }).length, 1);
  assert.equal(dayBook(company)[0].date, '2026-06-10');
});

test('ledger statement carries opening balance and running balance', () => {
  const company = makeCompany();
  const petty = ledger(company, 'Petty Cash', 'cash', 100, 'Dr');
  const sales = findLedgerByName(company, 'Sales');

  voucher(company, 'Receipt', [
    { ledgerId: petty.id, side: 'Dr', amount: 300 },
    { ledgerId: sales.id, side: 'Cr', amount: 300 },
  ], '2026-04-20');
  voucher(company, 'Payment', [
    { ledgerId: sales.id, side: 'Dr', amount: 120 },
    { ledgerId: petty.id, side: 'Cr', amount: 120 },
  ], '2026-05-02');

  const full = ledgerStatement(company, petty.id);
  assert.equal(full.opening, 100);
  assert.equal(full.closing, 280);
  assert.equal(full.rows.length, 2);
  assert.deepEqual(full.rows.map((row) => row.balance), [400, 280]);

  const later = ledgerStatement(company, petty.id, { from: '2026-05-01' });
  assert.equal(later.opening, 400);
  assert.equal(later.closing, 280);
  assert.equal(later.rows.length, 1);
});

test('deleting a voucher restores ledger balances', () => {
  const company = makeCompany();
  const cash = findLedgerByName(company, 'Cash');
  const sales = findLedgerByName(company, 'Sales');
  const entry = voucher(company, 'Sales', [
    { ledgerId: cash.id, side: 'Dr', amount: 700 },
    { ledgerId: sales.id, side: 'Cr', amount: 700 },
  ]);

  assert.equal(ledgerTotals(company).get(cash.id).closing, 700);
  assert.equal(deleteVoucher(company, entry.id), true);
  assert.equal(ledgerTotals(company).get(cash.id).closing, 0);
  assert.equal(company.counters.Sales, 1);
  assert.equal(deleteVoucher(company, entry.id), false);
});

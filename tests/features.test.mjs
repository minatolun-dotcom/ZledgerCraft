import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCompany,
  addGroup,
  addLedger,
  addVoucher,
  createCompany,
  deleteCompany,
  deleteGroup,
  deleteLedger,
  exportState,
  findLedgerByName,
  importState,
  updateCompany,
  updateGroup,
  updateLedger,
  updateVoucher,
  VOUCHER_TYPES,
} from '../src/store.js';
import {
  balanceSheet,
  cashBankBook,
  dashboard,
  cashFlow,
  groupSummary,
  groupVouchers,
  ledgerStatement,
  ledgerTotals,
  outstanding,
  profitAndLoss,
  ratioAnalysis,
  statistics,
  trialBalance,
  voucherRegister,
} from '../src/accounting.js';

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

function voucher(company, type, lines, date, narration = '') {
  const result = addVoucher(company, { type, date, lines, narration });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

/** Cash 800, Bank 1400, Sharma 300 Dr, Gupta 400 Cr, Capital 1800 Cr, ... */
function tradingFixture() {
  const company = createCompany('Parity Traders', '2026-04-01').company;
  const cash = findLedgerByName(company, 'Cash');
  const bank = findLedgerByName(company, 'Bank');
  const capital = findLedgerByName(company, 'Capital');
  const sales = findLedgerByName(company, 'Sales');
  const purchases = findLedgerByName(company, 'Purchases');

  cash.opening = 500;
  bank.opening = 1000;
  capital.opening = 1500;

  const rent = ledger(company, 'Rent', 'indirectExpenses');
  const sharma = ledger(company, 'Sharma Traders', 'sundryDebtors');
  const gupta = ledger(company, 'Gupta Supplies', 'sundryCreditors');

  voucher(company, 'Sales', [
    { ledgerId: sharma.id, side: 'Dr', amount: 1000 },
    { ledgerId: sales.id, side: 'Cr', amount: 1000 },
  ], '2026-04-05', 'Invoice 12');

  voucher(company, 'Purchase', [
    { ledgerId: purchases.id, side: 'Dr', amount: 400 },
    { ledgerId: gupta.id, side: 'Cr', amount: 400 },
  ], '2026-04-10');

  voucher(company, 'Receipt', [
    { ledgerId: bank.id, side: 'Dr', amount: 600 },
    { ledgerId: sharma.id, side: 'Cr', amount: 600 },
  ], '2026-04-15');

  voucher(company, 'Payment', [
    { ledgerId: rent.id, side: 'Dr', amount: 200 },
    { ledgerId: bank.id, side: 'Cr', amount: 200 },
  ], '2026-05-01');

  voucher(company, 'CreditNote', [
    { ledgerId: sales.id, side: 'Dr', amount: 100 },
    { ledgerId: sharma.id, side: 'Cr', amount: 100 },
  ], '2026-05-10', 'Return');

  voucher(company, 'Journal', [
    { ledgerId: cash.id, side: 'Dr', amount: 300 },
    { ledgerId: capital.id, side: 'Cr', amount: 300 },
  ], '2026-06-01');

  return { company, cash, bank, capital, sales, purchases, rent, sharma, gupta };
}

test('credit and debit notes are first-class voucher types', () => {
  assert.ok(VOUCHER_TYPES.CreditNote);
  assert.ok(VOUCHER_TYPES.DebitNote);

  const { company, sales, purchases, sharma, gupta } = tradingFixture();
  const note = voucher(company, 'DebitNote', [
    { ledgerId: gupta.id, side: 'Dr', amount: 50 },
    { ledgerId: purchases.id, side: 'Cr', amount: 50 },
  ], '2026-06-05');

  assert.equal(note.type, 'DebitNote');
  assert.equal(note.no, 1);
  assert.equal(company.counters.CreditNote, 1);
  assert.equal(company.counters.DebitNote, 1);

  // The sales return reduced direct income; the purchase return reduced purchases.
  const pnl = profitAndLoss(company);
  assert.equal(pnl.direct.incomeTotal, 900);
  assert.equal(pnl.direct.expenseTotal, 350);
  assert.equal(pnl.netProfit, 350);
  assert.equal(ledgerTotals(company).get(sharma.id).closing, 300);
  assert.equal(ledgerTotals(company).get(sales.id).closing, -900);
});

test('vouchers can be altered and keep numbering unless the type changes', () => {
  const { company, sales, sharma } = tradingFixture();
  const original = company.vouchers.find((item) => item.type === 'Sales');

  const update = updateVoucher(company, original.id, {
    type: 'Sales',
    date: '2026-04-06',
    narration: 'Revised invoice',
    lines: [
      { ledgerId: sharma.id, side: 'Dr', amount: 1200 },
      { ledgerId: sales.id, side: 'Cr', amount: 1200 },
    ],
  });
  assert.equal(update.ok, true, update.error);
  assert.equal(update.voucher.no, 1);
  assert.equal(update.voucher.total, 1200);
  assert.equal(update.voucher.date, '2026-04-06');
  assert.equal(ledgerTotals(company).get(sharma.id).closing, 500);

  const rejected = updateVoucher(company, original.id, {
    type: 'Sales',
    date: '2026-04-06',
    lines: [
      { ledgerId: sharma.id, side: 'Dr', amount: 10 },
      { ledgerId: sales.id, side: 'Cr', amount: 9 },
    ],
  });
  assert.equal(rejected.ok, false);
  assert.equal(company.vouchers.find((item) => item.id === original.id).total, 1200);

  const renumbered = updateVoucher(company, original.id, {
    type: 'Journal',
    date: '2026-04-06',
    lines: [
      { ledgerId: sharma.id, side: 'Dr', amount: 1200 },
      { ledgerId: sales.id, side: 'Cr', amount: 1200 },
    ],
  });
  assert.equal(renumbered.ok, true, renumbered.error);
  // The fixture already has Journal 1, so the retyped voucher becomes Journal 2.
  assert.equal(renumbered.voucher.no, 2);
  assert.equal(company.counters.Journal, 2);
  assert.equal(profitAndLoss(company).direct.incomeTotal, 1100);

  assert.equal(updateVoucher(company, 'missing', { type: 'Sales', date: '2026-04-01', lines: [] }).ok, false);
});

test('custom groups inherit their primary nature and hold ledgers', () => {
  const company = createCompany('Groups Co', '2026-04-01').company;
  const parent = groupKeyFor(company, 'indirectExpenses');
  const created = addGroup(company, { name: 'Shop Overheads', parentId: parent });
  assert.equal(created.ok, true, created.error);
  assert.equal(created.group.nature, 'Expense');
  assert.equal(created.group.custom, true);

  assert.equal(addGroup(company, { name: 'shop overheads', parentId: parent }).ok, false);
  assert.equal(addGroup(company, { name: 'Orphan', parentId: 'nope' }).ok, false);

  const rent = addLedger(company, { name: 'Shed Rent', groupId: created.group.id });
  assert.equal(rent.ok, true, rent.error);

  assert.equal(deleteGroup(company, created.group.id).ok, false, 'group with a ledger cannot go');
  assert.equal(updateGroup(company, created.group.id, { parentId: groupKeyFor(company, 'currentAssets') }).ok, true);
  assert.equal(
    company.groups.find((group) => group.id === created.group.id).nature,
    'Assets',
    'moving the group reclassifies it',
  );

  const child = addGroup(company, { name: 'Sheds', parentId: created.group.id }).group;
  assert.equal(updateGroup(company, created.group.id, { parentId: child.id }).ok, false, 'cycle rejected');
  assert.equal(updateGroup(company, groupKeyFor(company, 'sales'), {}).ok, true, 'standard groups can be renamed');
  assert.equal(updateGroup(company, groupKeyFor(company, 'sales'), { parentId: 'x' }).ok, false);
  assert.equal(deleteGroup(company, groupKeyFor(company, 'sales')).ok, false, 'standard groups stay');
});

test('ledgers can be altered and deleted only when unused', () => {
  const { company, rent } = tradingFixture();

  const renamed = updateLedger(company, rent.id, {
    name: 'Office Rent',
    groupId: groupKeyFor(company, 'directExpenses'),
    opening: 0,
    openingType: 'Dr',
  });
  assert.equal(renamed.ok, true, renamed.error);
  assert.equal(renamed.ledger.name, 'Office Rent');
  assert.equal(profitAndLoss(company).direct.expenseTotal, 600, 'moving the ledger changes the P&L split');
  assert.equal(profitAndLoss(company).indirect.expenseTotal, 0);

  assert.equal(updateLedger(company, rent.id, { name: 'Cash' }).ok, false, 'duplicate name rejected');
  assert.equal(updateLedger(company, rent.id, { opening: -5 }).ok, false);
  assert.equal(updateLedger(company, 'missing', { name: 'X' }).ok, false);

  const blocked = deleteLedger(company, rent.id);
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /used in 1 voucher/);

  const spare = ledger(company, 'Spare', 'indirectExpenses');
  assert.equal(deleteLedger(company, spare.id).ok, true);
  assert.equal(findLedgerByName(company, 'Spare'), null);
});

test('company rename, financial-year guard and delete', () => {
  const state = { version: 1, activeCompanyId: null, companies: [] };
  addCompany(state, 'First Co', '2026-04-01');
  addCompany(state, 'Second Co', '2026-04-01');
  const second = state.companies[1];

  assert.equal(updateCompany(second, { name: '  ' }).ok, false);
  assert.equal(updateCompany(second, { name: 'Second Co', fyStart: 'not-a-date' }).ok, false);
  assert.equal(updateCompany(second, { name: 'Second Co Renamed', fyStart: '2026-04-01' }).ok, true);
  assert.equal(second.name, 'Second Co Renamed');

  const cash = findLedgerByName(second, 'Cash');
  const sales = findLedgerByName(second, 'Sales');
  voucher(second, 'Sales', [
    { ledgerId: cash.id, side: 'Dr', amount: 10 },
    { ledgerId: sales.id, side: 'Cr', amount: 10 },
  ], '2026-04-10');

  assert.equal(updateCompany(second, { fyStart: '2026-05-01' }).ok, false, 'April voucher blocks the move');

  const removed = deleteCompany(state, second.id);
  assert.equal(removed.ok, true);
  assert.equal(state.activeCompanyId, state.companies[0].id);
  assert.equal(state.companies.length, 1);
  assert.equal(deleteCompany(state, 'nope').ok, false);
});

test('dashboard cash and bank totals come from the secondary groups', () => {
  const { company } = tradingFixture();
  const stats = dashboard(company);
  assert.equal(stats.cash, 800);
  assert.equal(stats.bank, 1400);
  assert.equal(stats.netProfit, 300);
  assert.equal(stats.vouchers, 6);
});

test('reports honour an as-on date for trial balance and balance sheet', () => {
  const { company } = tradingFixture();

  const aprilTrial = trialBalance(company, { to: '2026-04-30' });
  assert.equal(aprilTrial.balanced, true);
  assert.equal(aprilTrial.debitTotal, 2900);
  assert.equal(aprilTrial.asOn, '2026-04-30');

  const aprilSheet = balanceSheet(company, { to: '2026-04-30' });
  assert.equal(aprilSheet.balanced, true);
  assert.equal(aprilSheet.assets.total, 2500);
  assert.equal(aprilSheet.asOn, '2026-04-30');

  const juneSheet = balanceSheet(company, { to: '2026-06-30' });
  assert.equal(juneSheet.balanced, true);
  assert.equal(juneSheet.netProfit, 300);
  assert.equal(juneSheet.assets.total, 2500);
});

test('sub-period profit and loss measures only that period', () => {
  const { company } = tradingFixture();

  const full = profitAndLoss(company);
  assert.equal(full.includeOpening, true);
  assert.equal(full.grossProfit, 500);
  assert.equal(full.netProfit, 300);
  assert.equal(full.direct.sections[0].title, 'Sales Accounts');
  assert.equal(full.indirect.expenseSections[0].title, 'Indirect Expenses');

  const may = profitAndLoss(company, { from: '2026-05-01', to: '2026-06-30' });
  assert.equal(may.includeOpening, false);
  assert.equal(may.direct.incomeTotal, -100);
  assert.equal(may.direct.expenseTotal, 0);
  assert.equal(may.netProfit, -300);
});

test('cash book shows receipts, payments and running balances', () => {
  const { company, bank } = tradingFixture();
  const book = cashBankBook(company, { from: '2026-04-01', to: '2026-06-30' });

  assert.equal(book.opening, 1500);
  assert.equal(book.sections.length, 2);
  const bankSection = book.sections.find((section) => section.ledgerId === bank.id);
  assert.ok(bankSection);
  assert.equal(bankSection.opening, 1000);
  assert.equal(bankSection.receiptTotal, 600);
  assert.equal(bankSection.paymentTotal, 200);
  assert.equal(bankSection.closing, 1400);
  assert.deepEqual(bankSection.rows.map((row) => row.balance), [1600, 1400]);
  assert.equal(book.closing, 2200);

  const single = cashBankBook(company, { ledgerId: bank.id });
  assert.equal(single.sections.length, 1);
  assert.equal(single.closing, 1400);
});

test('sales and purchase registers list the party and totals', () => {
  const { company } = tradingFixture();

  const sales = voucherRegister(company, { types: ['Sales'] });
  assert.equal(sales.count, 1);
  assert.equal(sales.total, 1000);
  assert.equal(sales.rows[0].party, 'Sharma Traders');
  assert.equal(sales.rows[0].no, 1);

  const notes = voucherRegister(company, { types: ['CreditNote'] });
  assert.equal(notes.count, 1);
  assert.equal(notes.rows[0].party, 'Sharma Traders');

  const purchases = voucherRegister(company, { types: ['Purchase'] });
  assert.equal(purchases.rows[0].party, 'Gupta Supplies');

  const all = voucherRegister(company, {});
  assert.equal(all.count, 6);
  assert.equal(all.total, 2600);

  const april = voucherRegister(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(april.count, 3);
});

test('group summary and group vouchers roll up sub-groups', () => {
  const { company, gupta } = tradingFixture();

  const summary = groupSummary(company);
  const salesSection = summary.sections.find((section) => section.key === 'sales');
  assert.equal(salesSection.name, 'Sales Accounts');
  assert.equal(salesSection.closing, -900);
  assert.equal(salesSection.rows.length, 1);
  assert.equal(summary.total, 0, 'balanced books leave no residual');

  const currentLiabilities = company.groups.find((group) => group.key === 'currentLiabilities');
  const vouchers = groupVouchers(company, currentLiabilities.id, { from: '2026-04-01', to: '2026-06-30' });
  assert.equal(vouchers.rows.length, 1);
  assert.equal(vouchers.debitTotal, 0);
  assert.equal(vouchers.creditTotal, 400);
  assert.equal(vouchers.rows[0].voucherId, company.vouchers[1].id);

  assert.equal(groupVouchers(company, 'missing'), null);
  assert.ok(ledgerTotals(company).get(gupta.id));
  assert.ok(ledgerStatement(company, gupta.id));
});

test('receivables age FIFO and split into buckets', () => {
  const { company, sharma } = tradingFixture();

  const may = outstanding(company, { asOn: '2026-05-31' });
  assert.equal(may.count, 1);
  assert.equal(may.parties[0].ledgerId, sharma.id);
  assert.equal(may.total, 300);
  assert.equal(may.parties[0].bills.length, 1);
  assert.equal(may.parties[0].bills[0].amount, 300);
  // 2026-04-05 invoice, settled 600 + 100, is 56 days old at 31 May.
  assert.equal(may.parties[0].bills[0].ageDays, 56);
  assert.equal(may.parties[0].bills[0].bucket, '31-60');
  assert.equal(may.buckets['31-60'], 300);
  assert.equal(may.net, 300);

  const june = outstanding(company, { asOn: '2026-06-30' });
  assert.equal(june.parties[0].bills[0].ageDays, 86);
  assert.equal(june.buckets['61-90'], 300);

  const beforeReceipt = outstanding(company, { asOn: '2026-04-10' });
  assert.equal(beforeReceipt.total, 1000);

  const payable = outstanding(company, { side: 'payable', asOn: '2026-06-30' });
  assert.equal(payable.count, 1);
  assert.equal(payable.total, 400);
  assert.equal(payable.parties[0].bills[0].bucket, '61-90');

  // Closing balance and ageing agree.
  const closing = ledgerTotals(company).get(sharma.id).closing;
  assert.equal(june.net, closing);
});

test('an unallocated receipt becomes a customer advance', () => {
  const company = createCompany('Advances Co', '2026-04-01').company;
  const cash = findLedgerByName(company, 'Cash');
  const sales = findLedgerByName(company, 'Sales');
  const customer = ledger(company, 'Advance Customer', 'sundryDebtors');

  voucher(company, 'Receipt', [
    { ledgerId: cash.id, side: 'Dr', amount: 500 },
    { ledgerId: customer.id, side: 'Cr', amount: 500 },
  ], '2026-04-02');

  const report = outstanding(company, { asOn: '2026-04-30' });
  assert.equal(report.total, 0);
  assert.equal(report.advances, 500);
  assert.equal(report.parties[0].advance, 500);
  assert.equal(report.net, -500);

  voucher(company, 'Sales', [
    { ledgerId: customer.id, side: 'Dr', amount: 700 },
    { ledgerId: sales.id, side: 'Cr', amount: 700 },
  ], '2026-04-20');

  const after = outstanding(company, { asOn: '2026-04-30' });
  assert.equal(after.total, 200, 'the advance settles the oldest invoice first');
  assert.equal(after.advances, 0);
  assert.equal(after.net, 200);
  assert.equal(after.parties[0].bills[0].amount, 200);
});

test('cash flow groups receipts and payments by ledger group', () => {
  const { company } = tradingFixture();
  const report = cashFlow(company, { from: '2026-04-01', to: '2026-06-30' });

  assert.equal(report.opening, 1500);
  assert.equal(report.totalIn, 900);
  assert.equal(report.totalOut, 200);
  assert.equal(report.net, 700);
  assert.equal(report.closing, 2200);

  const inflow = report.inflows.find((section) => section.key === 'sundryDebtors');
  assert.equal(inflow.total, 600);
  assert.equal(inflow.rows[0].name, 'Sharma Traders');

  const capital = report.inflows.find((section) => section.key === 'capital');
  assert.equal(capital.total, 300);

  const outflow = report.outflows.find((section) => section.key === 'indirectExpenses');
  assert.equal(outflow.total, 200);
  assert.equal(outflow.rows[0].name, 'Rent');

  const closingCash = cashBankBook(company, { to: '2026-06-30' }).closing;
  assert.equal(report.closing, closingCash);

  const empty = cashFlow(company, { from: '2025-04-01', to: '2025-04-30' });
  assert.equal(empty.totalIn, 0);
});

test('ratio analysis matches the underlying balances', () => {
  const { company } = tradingFixture();
  const report = ratioAnalysis(company, { to: '2026-06-30' });
  const byLabel = Object.fromEntries(report.ratios.map((item) => [item.label, item]));

  assert.equal(byLabel['Current ratio'].value, 6.25);
  assert.equal(byLabel['Quick ratio'].value, 6.25);
  assert.equal(byLabel['Debt / equity'].value, 0);
  assert.equal(byLabel['Gross profit %'].value, 55.56);
  assert.equal(byLabel['Net profit %'].value, 33.33);
  assert.equal(byLabel['Return on assets %'].value, 12);
  assert.equal(report.workingCapital, 2100);
  assert.equal(report.asOn, '2026-06-30');

  // No creditors and no sales: ratios that need a denominator report null.
  const empty = createCompany('Empty Co', '2026-04-01').company;
  const emptyReport = ratioAnalysis(empty);
  assert.equal(emptyReport.ratios.find((item) => item.label === 'Current ratio').value, null);
  assert.equal(emptyReport.ratios.find((item) => item.label === 'Gross profit %').value, null);
});

test('statistics count vouchers, ledgers and groups', () => {
  const { company } = tradingFixture();
  const stats = statistics(company);

  assert.equal(stats.voucherTotal, 6);
  assert.equal(stats.voucherCounts.find((row) => row.type === 'Sales').count, 1);
  assert.equal(stats.voucherCounts.find((row) => row.type === 'CreditNote').count, 1);
  assert.equal(stats.voucherCounts.find((row) => row.type === 'Payment').total, 200);
  assert.equal(stats.ledgerCount, 8);
  assert.equal(stats.customGroupCount, 0);
  assert.equal(stats.firstDate, '2026-04-05');
  assert.equal(stats.lastDate, '2026-06-01');
  assert.equal(stats.groups.find((group) => group.name === 'Sundry Debtors').ledgers, 1);
  assert.equal(stats.monthly.length, 12);
  const april = stats.monthly.find((row) => row.month === '2026-04');
  assert.deepEqual(
    { sales: april.sales, purchases: april.purchases, receipts: april.receipts, payments: april.payments },
    { sales: 1000, purchases: 400, receipts: 600, payments: 0 },
  );
  const may = stats.monthly.find((row) => row.month === '2026-05');
  assert.equal(may.creditNotes, 100);
  assert.equal(may.payments, 200);
  const june = stats.monthly.find((row) => row.month === '2026-06');
  assert.equal(june.sales, 0);
  assert.equal(june.payments, 0);
});

test('backup export and restore round-trip through validation', () => {
  const state = { version: 1, activeCompanyId: null, companies: [] };
  addCompany(state, 'Backup Co', '2026-04-01');
  const company = state.companies[0];
  const cash = findLedgerByName(company, 'Cash');
  const sales = findLedgerByName(company, 'Sales');
  voucher(company, 'Sales', [
    { ledgerId: cash.id, side: 'Dr', amount: 250 },
    { ledgerId: sales.id, side: 'Cr', amount: 250 },
  ], '2026-04-11');

  const json = exportState(state);
  const restored = importState(json);
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.companies.length, 1);
  assert.equal(restored.state.companies[0].vouchers.length, 1);
  assert.equal(restored.state.companies[0].counters.Sales, 1);
  assert.equal(restored.state.activeCompanyId, state.activeCompanyId);
  assert.equal(restored.state.companies[0].fyEnd, '2027-03-31');

  assert.equal(importState('not json').ok, false);
  assert.equal(importState('{}').ok, false);
  assert.equal(importState(JSON.stringify({ companies: [] })).ok, false);

  const broken = JSON.parse(json);
  broken.companies[0].vouchers[0].lines[0].ledgerId = 'missing';
  const brokenResult = importState(JSON.stringify(broken));
  assert.equal(brokenResult.ok, false);
  assert.match(brokenResult.error, /missing ledger/);

  const unbalanced = JSON.parse(json);
  unbalanced.companies[0].vouchers[0].lines[1].amount = 999;
  const unbalancedResult = importState(JSON.stringify(unbalanced));
  assert.equal(unbalancedResult.ok, false);
  assert.match(unbalancedResult.error, /not balanced/);

  const negative = JSON.parse(json);
  negative.companies[0].vouchers[0].lines[0].amount = -5;
  assert.equal(importState(JSON.stringify(negative)).ok, false);

  const badGroup = JSON.parse(json);
  badGroup.companies[0].groups.push({ id: 'orphan', name: 'Orphan', parentId: 'nowhere', nature: 'Assets' });
  assert.equal(importState(JSON.stringify(badGroup)).ok, false);
});

test('opening balances on party ledgers are aged from the financial year start', () => {
  const company = createCompany('Old Balances', '2026-04-01').company;
  const debtor = ledger(company, 'Legacy Customer', 'sundryDebtors', 900, 'Dr');

  const report = outstanding(company, { asOn: '2026-06-30' });
  assert.equal(report.total, 900);
  assert.equal(report.parties[0].bills[0].date, '2026-04-01');
  assert.equal(report.parties[0].bills[0].bucket, '61-90');
  assert.equal(report.parties[0].ledgerId, debtor.id);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addFinancialYear,
  addVoucher,
  closeFinancialYear,
  createCompany,
  deleteVoucher,
  exportState,
  findLedgerByName,
  importState,
  reopenFinancialYear,
  seedYears,
  selectYear,
  updateVoucher,
} from '../src/store.js';
import {
  balanceSheet,
  ledgerStatement,
  profitAndLoss,
  trialBalance,
  yearComparison,
} from '../src/accounting.js';

function sale(company, amount, date) {
  const cash = findLedgerByName(company, 'Cash');
  const sales = findLedgerByName(company, 'Sales');
  const result = addVoucher(company, {
    type: 'Sales',
    date,
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount },
      { ledgerId: sales.id, side: 'Cr', amount },
    ],
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

function yearsFixture() {
  const company = createCompany('Years Co', '2026-04-01').company;
  sale(company, 1000, '2026-04-10');
  const next = addFinancialYear(company).year;
  sale(company, 500, '2027-04-10');
  return { company, next };
}

test('an older company gets one financial year on load', () => {
  const company = createCompany('Legacy Co', '2026-04-01').company;
  delete company.years;
  delete company.yearId;
  seedYears(company);
  assert.equal(company.years.length, 1);
  assert.equal(company.years[0].start, '2026-04-01');
  assert.equal(company.years[0].end, '2027-03-31');
  assert.equal(company.yearId, company.years[0].id);
});

test('adding a year creates the next April–March year and selects it', () => {
  const { company, next } = yearsFixture();
  assert.equal(next.start, '2027-04-01');
  assert.equal(next.end, '2028-03-31');
  assert.equal(company.years.length, 2);
  assert.equal(company.fyStart, '2027-04-01');
  assert.equal(company.fyEnd, '2028-03-31');
});

test('profit and loss is scoped to the selected year', () => {
  const { company } = yearsFixture();
  const year2 = profitAndLoss(company, { from: company.fyStart, to: company.fyEnd });
  assert.equal(year2.netProfit, 500);
  assert.equal(year2.includeOpening, false);

  selectYear(company, company.years[0].id);
  const year1 = profitAndLoss(company, { from: company.fyStart, to: company.fyEnd });
  assert.equal(year1.netProfit, 1000);
  assert.equal(year1.includeOpening, true);
});

test('balances carry forward and the balance sheet stays cumulative', () => {
  const { company } = yearsFixture();
  const cash = findLedgerByName(company, 'Cash');
  const opening = ledgerStatement(company, cash.id, { from: '2027-04-01', to: '2027-04-30' });
  assert.equal(opening.opening, 1000, 'year one profit is the year two opening cash');
  assert.equal(opening.closing, 1500);

  const trial = trialBalance(company, { to: company.fyEnd });
  assert.equal(trial.balanced, true);
  assert.equal(trial.rows.find((row) => row.name === 'Cash').debit, 1500);

  const sheet = balanceSheet(company, { to: company.fyEnd });
  assert.equal(sheet.balanced, true);
  assert.equal(sheet.netProfit, 1500, 'retained earnings include both years');
});

test('year comparison reports each year side by side', () => {
  const { company } = yearsFixture();
  const report = yearComparison(company);
  assert.equal(report.length, 2);
  assert.deepEqual(report.map((row) => row.directIncome), [1000, 500]);
  assert.deepEqual(report.map((row) => row.netProfit), [1000, 500]);
  assert.deepEqual(report.map((row) => row.assets), [1000, 1500], 'assets are cumulative');
  assert.deepEqual(report.map((row) => row.cash), [1000, 1500]);
  assert.deepEqual(report.map((row) => row.vouchers), [1, 1]);
  assert.equal(report[1].selected, true);
  assert.equal(report[0].start, '2026-04-01');
  assert.equal(report[1].start, '2027-04-01');
});

test('closing a year locks its vouchers and opens the next year', () => {
  const company = createCompany('Closing Co', '2026-04-01').company;
  sale(company, 800, '2026-05-01');
  const closed = closeFinancialYear(company, company.years[0].id);
  assert.equal(closed.ok, true, closed.error);
  assert.equal(closed.year.closed, true);
  assert.equal(company.years.length, 2);
  assert.equal(company.fyStart, '2027-04-01');

  const blocked = addVoucher(company, {
    type: 'Sales',
    date: '2026-06-01',
    lines: [
      { ledgerId: findLedgerByName(company, 'Cash').id, side: 'Dr', amount: 100 },
      { ledgerId: findLedgerByName(company, 'Sales').id, side: 'Cr', amount: 100 },
    ],
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /closed/i);

  const first = company.vouchers[0];
  assert.equal(deleteVoucher(company, first.id), false, 'closed-year vouchers cannot be deleted');
  const altered = updateVoucher(company, first.id, {
    type: 'Sales',
    date: '2026-05-01',
    lines: first.lines,
  });
  assert.equal(altered.ok, false);
  assert.match(altered.error, /closed/i);

  const entry = addVoucher(company, {
    type: 'Sales',
    date: '2027-05-01',
    lines: [
      { ledgerId: findLedgerByName(company, 'Cash').id, side: 'Dr', amount: 200 },
      { ledgerId: findLedgerByName(company, 'Sales').id, side: 'Cr', amount: 200 },
    ],
  });
  assert.equal(entry.ok, true, entry.error);
});

test('reopening a closed year allows edits again', () => {
  const company = createCompany('Reopen Co', '2026-04-01').company;
  const entry = sale(company, 300, '2026-05-01');
  closeFinancialYear(company, company.years[0].id);
  selectYear(company, company.years[0].id);
  assert.equal(reopenFinancialYear(company, company.yearId).ok, true);

  const updated = updateVoucher(company, entry.id, {
    type: 'Sales',
    date: '2026-05-02',
    lines: entry.lines,
  });
  assert.equal(updated.ok, true, updated.error);
});

test('financial years survive a backup round trip', () => {
  const { company } = yearsFixture();
  closeFinancialYear(company, company.years[0].id);
  const restored = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  assert.equal(copy.years.length, 2);
  assert.equal(copy.years[0].closed, true);
  assert.equal(copy.years[1].start, '2027-04-01');
  assert.equal(copy.fyStart, copy.years[1].start);
  assert.equal(copy.yearId, copy.years[1].id);
});

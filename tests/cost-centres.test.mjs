import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCostCategory,
  addCostCentre,
  addLedger,
  addVoucher,
  costCentreUsage,
  createCompany,
  deleteCostCategory,
  deleteCostCentre,
  exportState,
  findLedgerByName,
  importState,
  normalizeCostMasters,
} from '../src/store.js';
import { costCentreBreakup, costCentreSummary } from '../src/accounting.js';

function costFixture() {
  const company = createCompany('Cost Co', '2026-04-01').company;
  const bank = findLedgerByName(company, 'Bank');
  const customer = addLedger(company, {
    name: 'Acme Customer',
    groupId: company.groups.find((group) => group.key === 'sundryDebtors').id,
    opening: 0,
  }).ledger;
  const rent = addLedger(company, {
    name: 'Rent',
    groupId: company.groups.find((group) => group.key === 'indirectExpenses').id,
    opening: 0,
  }).ledger;
  const salaries = addLedger(company, {
    name: 'Salaries',
    groupId: company.groups.find((group) => group.key === 'indirectExpenses').id,
    opening: 0,
  }).ledger;
  const sales = findLedgerByName(company, 'Sales');
  const category = addCostCategory(company, { name: 'Departments' }).category;
  const admin = addCostCentre(company, { name: 'Admin', categoryId: category.id }).centre;
  const salesTeam = addCostCentre(company, { name: 'Sales team', categoryId: category.id }).centre;
  return { company, bank, customer, rent, salaries, sales, category, admin, salesTeam };
}

test('a new company has a primary cost category and cost centres validate', () => {
  const company = createCompany('Default Cost Co', '2026-04-01').company;
  assert.equal(company.costCategories.length, 1);
  assert.equal(company.costCategories[0].name, 'Primary Cost Category');
  assert.equal(company.costCentres.length, 0);

  const payment = addVoucher(company, {
    type: 'Payment',
    date: '2026-04-05',
    lines: [
      { ledgerId: findLedgerByName(company, 'Capital').id, side: 'Dr', amount: 100 },
      { ledgerId: findLedgerByName(company, 'Cash').id, side: 'Cr', amount: 100, costCentreId: 'missing' },
    ],
  });
  assert.equal(payment.ok, false);
  assert.match(payment.error, /cost centre no longer exists/i);
});

test('cost allocations roll up by centre and category', () => {
  const { company, bank, customer, rent, salaries, sales, admin, salesTeam } = costFixture();
  const payment = (ledger, amount, centreId, date = '2026-04-10') =>
    addVoucher(company, {
      type: 'Payment',
      date,
      lines: [
        { ledgerId: ledger.id, side: 'Dr', amount, costCentreId: centreId },
        { ledgerId: bank.id, side: 'Cr', amount },
      ],
    });
  assert.equal(payment(rent, 1000, admin.id).ok, true);
  assert.equal(payment(salaries, 500, salesTeam.id).ok, true);
  const sale = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-12',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 3000 },
      { ledgerId: sales.id, side: 'Cr', amount: 3000, costCentreId: salesTeam.id },
    ],
  });
  assert.equal(sale.ok, true, sale.error);

  const report = costCentreSummary(company);
  const adminRow = report.centreRows.find((row) => row.centreId === admin.id);
  const salesRow = report.centreRows.find((row) => row.centreId === salesTeam.id);
  assert.equal(adminRow.debit, 1000);
  assert.equal(adminRow.net, 1000);
  assert.equal(salesRow.debit, 500);
  assert.equal(salesRow.credit, 3000);
  assert.equal(salesRow.net, -2500);
  assert.equal(report.totalDebit, 1500);
  assert.equal(report.totalCredit, 3000);
  assert.equal(report.totalNet, -1500);

  const department = report.categoryRows.find((row) => row.categoryId === admin.categoryId);
  assert.equal(department.debit, 1500);
  assert.equal(department.credit, 3000);
  assert.equal(department.net, -1500);
  assert.equal(department.centreCount, 2);
});

test('cost centre break-up lists only the chosen centre and honours its period', () => {
  const { company, bank, rent, admin, salesTeam } = costFixture();
  addVoucher(company, {
    type: 'Payment',
    date: '2026-04-10',
    narration: 'April rent',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 1000, costCentreId: admin.id },
      { ledgerId: bank.id, side: 'Cr', amount: 1000 },
    ],
  });
  addVoucher(company, {
    type: 'Payment',
    date: '2026-05-10',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 400, costCentreId: salesTeam.id },
      { ledgerId: bank.id, side: 'Cr', amount: 400 },
    ],
  });

  const april = costCentreBreakup(company, admin.id, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(april.count, 1);
  assert.equal(april.rows[0].ledger, 'Rent');
  assert.equal(april.rows[0].narration, 'April rent');
  assert.equal(april.debit, 1000);
  assert.equal(april.credit, 0);
  assert.equal(april.net, 1000);

  const may = costCentreBreakup(company, admin.id, { from: '2026-05-01', to: '2026-05-31' });
  assert.equal(may.count, 0);
  assert.equal(costCentreBreakup(company, 'missing', {}), null);
});

test('used centres and non-empty categories are protected from deletion', () => {
  const { company, bank, rent, category, admin } = costFixture();
  addVoucher(company, {
    type: 'Payment',
    date: '2026-04-10',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 100, costCentreId: admin.id },
      { ledgerId: bank.id, side: 'Cr', amount: 100 },
    ],
  });
  assert.equal(costCentreUsage(company, admin.id), 1);
  assert.equal(deleteCostCentre(company, admin.id).ok, false);
  assert.equal(deleteCostCategory(company, category.id).ok, false);

  const spare = addCostCentre(company, { name: 'Spare', categoryId: category.id }).centre;
  assert.equal(deleteCostCentre(company, spare.id).ok, true);
  assert.equal(deleteCostCategory(company, category.id).ok, false, 'one centre still remains');
});

test('backups keep cost masters and reject missing line references', () => {
  const { company, bank, rent, admin, category } = costFixture();
  addVoucher(company, {
    type: 'Payment',
    date: '2026-04-10',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 900, costCentreId: admin.id },
      { ledgerId: bank.id, side: 'Cr', amount: 900 },
    ],
  });
  const restored = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  assert.equal(copy.costCategories.find((item) => item.id === category.id).name, 'Departments');
  assert.equal(costCentreSummary(copy).centreRows.find((row) => row.centreId === admin.id).debit, 900);

  company.vouchers[0].lines[0].costCentreId = 'missing-centre';
  const broken = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(broken.ok, false);
  assert.match(broken.error, /missing cost centre/i);
});

test('normalization drops orphaned centres and line references', () => {
  const { company, category, admin } = costFixture();
  company.costCentres[0].categoryId = 'missing-category';
  company.vouchers = [
    { id: 'v1', lines: [{ ledgerId: 'ledger', side: 'Dr', amount: 10, costCentreId: admin.id }] },
  ];
  normalizeCostMasters(company);
  assert.equal(company.costCentres.some((centre) => centre.id === admin.id), false);
  assert.equal(company.costCentres.some((centre) => centre.categoryId === category.id), true);
  assert.equal(company.vouchers[0].lines[0].costCentreId, undefined);
});

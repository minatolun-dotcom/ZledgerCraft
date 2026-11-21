import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addBudget,
  addCostCategory,
  addCostCentre,
  addLedger,
  addVoucher,
  costCentreUsage,
  createCompany,
  deleteCostCategory,
  deleteCostCentre,
  deleteCostCentreOpening,
  exportState,
  findLedgerByName,
  importState,
  mergeCostCategory,
  mergeCostCentre,
  normalizeCostMasters,
  setCostCentreOpening,
  updateCostCategory,
  updateCostCentre,
} from '../src/store.js';
import { budgetVsActual, costCentreBreakup, costCentreSummary, costCategoryPnl } from '../src/accounting.js';

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

test('cost categories can be renamed and centres moved between categories', () => {
  const { company, bank, rent, admin, category } = costFixture();
  const payment = addVoucher(company, {
    type: 'Payment',
    date: '2026-04-10',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 500, costCentreId: admin.id },
      { ledgerId: bank.id, side: 'Cr', amount: 500 },
    ],
  });
  assert.equal(payment.ok, true, payment.error);

  const renamed = updateCostCategory(company, category.id, { name: 'Business units' });
  assert.equal(renamed.ok, true, renamed.error);
  assert.equal(renamed.category.name, 'Business units');
  assert.equal(company.costCategories.find((entry) => entry.id === category.id).name, 'Business units');
  assert.equal(updateCostCategory(company, category.id, { name: 'primary cost category' }).ok, false);
  assert.equal(updateCostCategory(company, category.id, { name: ' ' }).ok, false);
  assert.equal(updateCostCategory(company, 'missing', { name: 'Other' }).ok, false);

  const second = addCostCategory(company, { name: 'Support' }).category;
  const moved = updateCostCentre(company, admin.id, { name: 'Admin & HR', categoryId: second.id });
  assert.equal(moved.ok, true, moved.error);
  assert.equal(moved.centre.name, 'Admin & HR');
  assert.equal(moved.centre.categoryId, second.id);
  assert.equal(costCentreUsage(company, admin.id), 1, 'renaming and moving keeps voucher allocations');
  assert.equal(updateCostCentre(company, admin.id, { name: 'Sales team', categoryId: second.id }).ok, false);
  assert.equal(updateCostCentre(company, admin.id, { name: 'Ops', categoryId: 'missing' }).ok, false);
  assert.equal(updateCostCentre(company, 'missing', { name: 'Ops', categoryId: second.id }).ok, false);
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
  assert.equal(report.unallocatedDebit, 3000);
  assert.equal(report.unallocatedCredit, 1500);
  assert.equal(report.unallocatedNet, 1500);
  assert.equal(report.unallocatedRows.find((row) => row.ledgerId === customer.id).debit, 3000);
  assert.equal(report.unallocatedRows.find((row) => row.ledgerId === bank.id).credit, 1500);

  const department = report.categoryRows.find((row) => row.categoryId === admin.categoryId);
  assert.equal(department.debit, 1500);
  assert.equal(department.credit, 3000);
  assert.equal(department.net, -1500);
  assert.equal(department.centreCount, 2);
});

test('a voucher line can split its amount across several cost centres', () => {
  const { company, bank, rent, admin, salesTeam, category } = costFixture();
  const split = addVoucher(company, {
    type: 'Payment',
    date: '2026-04-10',
    lines: [
      {
        ledgerId: rent.id,
        side: 'Dr',
        amount: 1000,
        costCentreAllocations: [
          { centreId: admin.id, amount: 600 },
          { centreId: salesTeam.id, amount: 400 },
        ],
      },
      { ledgerId: bank.id, side: 'Cr', amount: 1000 },
    ],
  });
  assert.equal(split.ok, true, split.error);
  const line = company.vouchers[0].lines[0];
  assert.equal(line.costCentreId, undefined);
  assert.deepEqual(line.costCentreAllocations, [
    { centreId: admin.id, amount: 600 },
    { centreId: salesTeam.id, amount: 400 },
  ]);
  assert.equal(costCentreUsage(company, admin.id), 1);
  assert.equal(costCentreUsage(company, salesTeam.id), 1);

  const summary = costCentreSummary(company);
  assert.equal(summary.centreRows.find((row) => row.centreId === admin.id).debit, 600);
  assert.equal(summary.centreRows.find((row) => row.centreId === salesTeam.id).debit, 400);
  assert.equal(summary.totalDebit, 1000);
  assert.equal(summary.unallocatedDebit, 0, 'the split covers the whole rent line');
  assert.equal(summary.unallocatedCredit, 1000, 'the untagged bank line stays unallocated');
  assert.equal(summary.categoryRows.find((row) => row.categoryId === category.id).debit, 1000);

  const detail = costCentreBreakup(company, admin.id, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(detail.rows.length, 1);
  assert.equal(detail.rows[0].amount, 600);
  assert.equal(detail.debit, 600);

  addBudget(company, {
    name: 'Admin plan',
    targetType: 'costCentre',
    targetId: admin.id,
    yearId: company.yearId,
    amount: 1000,
  });
  addBudget(company, {
    name: 'Department plan',
    targetType: 'costCategory',
    targetId: category.id,
    yearId: company.yearId,
    amount: 1000,
  });
  const budget = budgetVsActual(company, { yearId: company.yearId, asOn: '2026-04-30' });
  assert.equal(budget.rows.find((row) => row.name === 'Admin plan').actual, 600);
  assert.equal(budget.rows.find((row) => row.name === 'Department plan').actual, 1000);

  const restored = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(restored.ok, true, restored.error);
  const restoredLine = restored.state.companies[0].vouchers[0].lines[0];
  assert.deepEqual(restoredLine.costCentreAllocations, line.costCentreAllocations);
  assert.equal(costCentreSummary(restored.state.companies[0]).totalDebit, 1000);
});

test('cost-centre splits are validated and merged without duplication', () => {
  const { company, bank, rent, admin, salesTeam } = costFixture();
  const base = {
    type: 'Payment',
    date: '2026-04-10',
    lines: [
      {
        ledgerId: rent.id,
        side: 'Dr',
        amount: 1000,
        costCentreAllocations: [
          { centreId: admin.id, amount: 600 },
          { centreId: salesTeam.id, amount: 400 },
        ],
      },
      { ledgerId: bank.id, side: 'Cr', amount: 1000 },
    ],
  };
  const withAllocations = (allocations, extra = {}) => ({
    ...base,
    lines: [
      { ...base.lines[0], costCentreAllocations: allocations, ...extra },
      base.lines[1],
    ],
  });
  assert.match(
    addVoucher(company, withAllocations([
      { centreId: admin.id, amount: 600 },
      { centreId: salesTeam.id, amount: 300 },
    ])).error,
    /must add up/i,
  );
  assert.match(
    addVoucher(company, withAllocations([{ centreId: 'missing', amount: 1000 }])).error,
    /cost centre no longer exists/i,
  );
  assert.match(
    addVoucher(company, withAllocations([
      { centreId: admin.id, amount: 500 },
      { centreId: admin.id, amount: 500 },
    ])).error,
    /each cost centre once/i,
  );
  assert.match(
    addVoucher(company, withAllocations([{ centreId: admin.id, amount: 1000 }], { costCentreId: admin.id })).error,
    /either one cost centre or a split/i,
  );
  assert.match(
    addVoucher(company, withAllocations([{ centreId: admin.id, amount: 0 }, { centreId: salesTeam.id, amount: 1000 }])).error,
    /enter an amount/i,
  );

  const saved = addVoucher(company, base);
  assert.equal(saved.ok, true, saved.error);
  const merged = mergeCostCentre(company, admin.id, salesTeam.id);
  assert.equal(merged.ok, true, merged.error);
  assert.equal(merged.linesMoved, 1);
  assert.deepEqual(company.vouchers[0].lines[0].costCentreAllocations, [
    { centreId: salesTeam.id, amount: 1000 },
  ]);
  assert.equal(costCentreUsage(company, admin.id), 0);
  assert.equal(costCentreUsage(company, salesTeam.id), 1);
});

test('backups reject cost-centre splits that do not add up', () => {
  const { company, bank, rent, admin, salesTeam } = costFixture();
  const saved = addVoucher(company, {
    type: 'Payment',
    date: '2026-04-10',
    lines: [
      {
        ledgerId: rent.id,
        side: 'Dr',
        amount: 1000,
        costCentreAllocations: [
          { centreId: admin.id, amount: 600 },
          { centreId: salesTeam.id, amount: 400 },
        ],
      },
      { ledgerId: bank.id, side: 'Cr', amount: 1000 },
    ],
  });
  assert.equal(saved.ok, true, saved.error);
  const restored = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(restored.ok, true, restored.error);

  company.vouchers[0].lines[0].costCentreAllocations[1].amount = 300;
  const broken = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(broken.ok, false);
  assert.match(broken.error, /cost-centre splits.*do not add up/i);
});

test('cost-category P&L counts tagged income and expenses only', () => {
  const { company, bank, customer, rent, salaries, sales, category, admin, salesTeam } = costFixture();
  addVoucher(company, {
    type: 'Payment',
    date: '2026-04-10',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 1000, costCentreId: admin.id },
      { ledgerId: bank.id, side: 'Cr', amount: 1000 },
    ],
  });
  addVoucher(company, {
    type: 'Payment',
    date: '2026-04-11',
    lines: [
      { ledgerId: salaries.id, side: 'Dr', amount: 500, costCentreId: salesTeam.id },
      { ledgerId: bank.id, side: 'Cr', amount: 500 },
    ],
  });
  addVoucher(company, {
    type: 'Sales',
    date: '2026-04-12',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 3000 },
      { ledgerId: sales.id, side: 'Cr', amount: 3000, costCentreId: salesTeam.id },
    ],
  });
  addVoucher(company, {
    type: 'Payment',
    date: '2026-04-13',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 200 },
      { ledgerId: bank.id, side: 'Cr', amount: 200 },
    ],
  });

  const report = costCategoryPnl(company);
  assert.equal(report.rows.length, 1);
  const row = report.rows[0];
  assert.equal(row.categoryId, category.id);
  assert.equal(row.directIncome, 3000);
  assert.equal(row.directExpense, 0);
  assert.equal(row.directNet, 3000);
  assert.equal(row.indirectExpense, 1500);
  assert.equal(row.indirectNet, -1500);
  assert.equal(row.net, 1500);
  assert.equal(row.voucherCount, 3, 'the untagged payment is excluded');
  assert.equal(report.totalDirectIncome, 3000);
  assert.equal(report.totalIndirectExpense, 1500);
  assert.equal(report.totalNet, 1500);

  const may = costCategoryPnl(company, { from: '2026-05-01', to: '2026-05-31' });
  assert.equal(may.rows.length, 0);
  assert.equal(may.totalNet, 0);
});

test('cost categories and centres can be merged without losing references', () => {
  const { company, bank, rent, category, admin, salesTeam } = costFixture();
  addVoucher(company, {
    type: 'Payment',
    date: '2026-04-10',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 700, costCentreId: admin.id },
      { ledgerId: bank.id, side: 'Cr', amount: 700 },
    ],
  });
  addBudget(company, {
    name: 'Department plan',
    targetType: 'costCategory',
    targetId: category.id,
    yearId: company.years[0].id,
    amount: 1000,
  });
  const targetCategory = addCostCategory(company, { name: 'Business units' }).category;
  const shared = addCostCentre(company, { name: 'Shared services', categoryId: targetCategory.id }).centre;

  const categoryMerge = mergeCostCategory(company, category.id, targetCategory.id);
  assert.equal(categoryMerge.ok, true, categoryMerge.error);
  assert.equal(categoryMerge.centresMoved, 2);
  assert.equal(categoryMerge.budgetsMoved, 1);
  assert.equal(company.costCategories.some((entry) => entry.id === category.id), false);
  assert.equal(company.costCentres.find((centre) => centre.id === admin.id).categoryId, targetCategory.id);
  assert.equal(company.budgets.find((budget) => budget.name === 'Department plan').targetId, targetCategory.id);
  assert.equal(costCentreUsage(company, admin.id), 1, 'voucher allocation survives the category merge');

  addBudget(company, {
    name: 'Admin plan',
    targetType: 'costCentre',
    targetId: admin.id,
    yearId: company.years[0].id,
    amount: 500,
  });
  const centreMerge = mergeCostCentre(company, admin.id, shared.id);
  assert.equal(centreMerge.ok, true, centreMerge.error);
  assert.equal(centreMerge.linesMoved, 1);
  assert.equal(centreMerge.budgetsMoved, 1);
  assert.equal(company.costCentres.some((centre) => centre.id === admin.id), false);
  assert.equal(company.vouchers[0].lines[0].costCentreId, shared.id);
  assert.equal(company.budgets.find((budget) => budget.name === 'Admin plan').targetId, shared.id);
  assert.equal(costCentreUsage(company, shared.id), 1);
  assert.equal(mergeCostCentre(company, shared.id, shared.id).ok, false);
  assert.equal(mergeCostCentre(company, 'missing', salesTeam.id).ok, false);
});

test('cost-master merges are refused when both sides have a budget for the year', () => {
  const { company, category, admin, salesTeam } = costFixture();
  const targetCategory = addCostCategory(company, { name: 'Support' }).category;
  addBudget(company, {
    name: 'Department plan',
    targetType: 'costCategory',
    targetId: category.id,
    yearId: company.years[0].id,
    amount: 1000,
  });
  addBudget(company, {
    name: 'Support plan',
    targetType: 'costCategory',
    targetId: targetCategory.id,
    yearId: company.years[0].id,
    amount: 800,
  });
  const categoryMerge = mergeCostCategory(company, category.id, targetCategory.id);
  assert.equal(categoryMerge.ok, false);
  assert.match(categoryMerge.error, /budget.*delete one/i);
  assert.equal(company.costCategories.some((entry) => entry.id === category.id), true);
  assert.equal(company.costCentres.find((centre) => centre.id === admin.id).categoryId, category.id);

  addBudget(company, {
    name: 'Admin plan',
    targetType: 'costCentre',
    targetId: admin.id,
    yearId: company.years[0].id,
    amount: 500,
  });
  addBudget(company, {
    name: 'Sales plan',
    targetType: 'costCentre',
    targetId: salesTeam.id,
    yearId: company.years[0].id,
    amount: 600,
  });
  const centreMerge = mergeCostCentre(company, admin.id, salesTeam.id);
  assert.equal(centreMerge.ok, false);
  assert.match(centreMerge.error, /budget.*delete one/i);
  assert.equal(company.costCentres.some((centre) => centre.id === admin.id), true);
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
  assert.equal(april.ledgerCount, 1);
  assert.equal(april.ledgerRows[0].ledger, 'Rent');
  assert.equal(april.ledgerRows[0].debit, 1000);
  assert.equal(april.ledgerRows[0].credit, 0);
  assert.equal(april.ledgerRows[0].net, 1000);

  const may = costCentreBreakup(company, admin.id, { from: '2026-05-01', to: '2026-05-31' });
  assert.equal(may.count, 0);
  assert.equal(may.ledgerRows.length, 0);
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


test('cost-centre openings are year-scoped, reportable and budget-aware', () => {
  const { company, bank, rent, admin, category } = costFixture();
  const set = setCostCentreOpening(company, admin.id, company.yearId, 750);
  assert.equal(set.ok, true, set.error);
  assert.equal(admin.openings[company.yearId], 750);
  assert.equal(setCostCentreOpening(company, admin.id, 'missing-year', 10).ok, false);
  assert.equal(setCostCentreOpening(company, 'missing', company.yearId, 10).ok, false);
  assert.equal(setCostCentreOpening(company, admin.id, company.yearId, 'abc').ok, false);

  const summary = costCentreSummary(company, {
    from: '2026-04-01',
    to: '2026-04-30',
    yearId: company.yearId,
  });
  const row = summary.centreRows.find((entry) => entry.centreId === admin.id);
  assert.equal(row.opening, 750);
  assert.equal(row.net, 0);
  assert.equal(row.netWithOpening, 750);
  assert.equal(summary.categoryRows.find((entry) => entry.categoryId === category.id).opening, 750);
  assert.equal(summary.openingTotal, 750);
  const detail = costCentreBreakup(company, admin.id, {
    from: '2026-04-01',
    to: '2026-04-30',
    yearId: company.yearId,
  });
  assert.equal(detail.opening, 750);
  assert.equal(detail.netWithOpening, 750);

  const payment = addVoucher(company, {
    type: 'Payment',
    date: '2026-04-10',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 200, costCentreId: admin.id },
      { ledgerId: bank.id, side: 'Cr', amount: 200 },
    ],
  });
  assert.equal(payment.ok, true, payment.error);
  addBudget(company, {
    name: 'Admin plan',
    targetType: 'costCentre',
    targetId: admin.id,
    yearId: company.yearId,
    amount: 1000,
  });
  const withoutOpening = budgetVsActual(company, { yearId: company.yearId, asOn: '2026-04-30' });
  assert.equal(withoutOpening.rows[0].actual, 200);
  const withOpening = budgetVsActual(company, {
    yearId: company.yearId,
    asOn: '2026-04-30',
    includeOpening: true,
  });
  assert.equal(withOpening.rows[0].actual, 950);

  const restored = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.companies[0].costCentres.find((entry) => entry.id === admin.id).openings[company.yearId], 750);

  assert.equal(deleteCostCentreOpening(company, admin.id, company.yearId).ok, true);
  assert.equal(admin.openings, undefined);
  assert.equal(deleteCostCentreOpening(company, admin.id, company.yearId).ok, false);
});

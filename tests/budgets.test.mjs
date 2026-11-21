import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addBudget,
  addCostCategory,
  addCostCentre,
  addFinancialYear,
  addGroup,
  addLedger,
  addVoucher,
  createCompany,
  deleteBudget,
  deleteCostCategory,
  deleteCostCentre,
  deleteGroup,
  deleteLedger,
  duplicateBudget,
  exportState,
  findLedgerByName,
  importState,
  normalizeBudgets,
  updateBudget,
} from '../src/store.js';
import { budgetVsActual } from '../src/accounting.js';

function budgetFixture() {
  const company = createCompany('Budget Co', '2026-04-01').company;
  const bank = findLedgerByName(company, 'Bank');
  const sales = findLedgerByName(company, 'Sales');
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
  const customer = addLedger(company, {
    name: 'Acme Customer',
    groupId: company.groups.find((group) => group.key === 'sundryDebtors').id,
    opening: 0,
  }).ledger;
  return { company, bank, sales, rent, salaries, customer };
}

function expense(company, bank, ledger, amount, date) {
  return addVoucher(company, {
    type: 'Payment',
    date,
    lines: [
      { ledgerId: ledger.id, side: 'Dr', amount },
      { ledgerId: bank.id, side: 'Cr', amount },
    ],
  });
}

function yearId(company) {
  return company.years[0].id;
}

test('budgets validate targets, years, amounts and duplicates', () => {
  const { company, rent } = budgetFixture();
  assert.deepEqual(company.budgets, []);
  const budget = addBudget(company, {
    name: 'Rent plan',
    targetType: 'ledger',
    targetId: rent.id,
    yearId: yearId(company),
    amount: 1000,
  });
  assert.equal(budget.ok, true, budget.error);
  assert.equal(company.budgets.length, 1);
  assert.equal(company.budgets[0].name, 'Rent plan');

  const duplicateTarget = addBudget(company, {
    name: 'Rent plan 2',
    targetType: 'ledger',
    targetId: rent.id,
    yearId: yearId(company),
    amount: 500,
  });
  assert.equal(duplicateTarget.ok, false);
  assert.match(duplicateTarget.error, /already exists/i);

  const phased = addBudget(company, {
    name: 'Quarterly rent',
    targetType: 'ledger',
    targetId: findLedgerByName(company, 'Salaries').id,
    yearId: yearId(company),
    amount: 1200,
    phases: [300, 300, 300, 300],
  });
  assert.equal(phased.ok, true, phased.error);
  assert.deepEqual(phased.budget.phases, [300, 300, 300, 300]);
  const report = budgetVsActual(company, {
    yearId: yearId(company),
    asOn: '2026-07-01',
  });
  const phasedRow = report.rows.find((row) => row.name === 'Quarterly rent');
  assert.deepEqual(phasedRow.phases, [300, 300, 300, 300]);
  assert.equal(phasedRow.phaseBudgetToDate, 600);
  const badPhases = addBudget(company, {
    name: 'Bad phasing',
    targetType: 'ledger',
    targetId: findLedgerByName(company, 'Bank').id,
    yearId: yearId(company),
    amount: 100,
    phases: [10, 10, 10, 10],
  });
  assert.equal(badPhases.ok, false);
  assert.match(badPhases.error, /totals/i);

  const monthly = addBudget(company, {
    name: 'Monthly bank plan',
    targetType: 'ledger',
    targetId: findLedgerByName(company, 'Bank').id,
    yearId: yearId(company),
    amount: 1200,
    monthlyPhases: Array(12).fill(100),
  });
  assert.equal(monthly.ok, true, monthly.error);
  assert.deepEqual(monthly.budget.monthlyPhases, Array(12).fill(100));
  const monthlyReport = budgetVsActual(company, { yearId: yearId(company), asOn: '2026-07-01' });
  const monthlyRow = monthlyReport.rows.find((row) => row.name === 'Monthly bank plan');
  assert.deepEqual(monthlyRow.monthlyPhases, Array(12).fill(100));
  assert.equal(monthlyRow.phaseBudgetToDate, 400);
  const mixedPhasing = addBudget(company, {
    name: 'Mixed phasing',
    targetType: 'ledger',
    targetId: findLedgerByName(company, 'Cash').id,
    yearId: yearId(company),
    amount: 100,
    phases: [25, 25, 25, 25],
    monthlyPhases: Array(12).fill(8.34),
  });
  assert.equal(mixedPhasing.ok, false);
  assert.match(mixedPhasing.error, /either quarterly or monthly/i);
  const badMonthly = addBudget(company, {
    name: 'Bad monthly',
    targetType: 'ledger',
    targetId: findLedgerByName(company, 'Capital').id,
    yearId: yearId(company),
    amount: 100,
    monthlyPhases: Array(12).fill(10),
  });
  assert.equal(badMonthly.ok, false);
  assert.match(badMonthly.error, /Monthly phasing totals/i);

  const duplicateName = addBudget(company, {
    name: 'rent plan',
    targetType: 'ledger',
    targetId: findLedgerByName(company, 'Bank').id,
    yearId: yearId(company),
    amount: 500,
  });
  assert.equal(duplicateName.ok, false);
  assert.match(duplicateName.error, /already exists/i);

  const badTarget = addBudget(company, {
    name: 'Missing',
    targetType: 'ledger',
    targetId: 'missing',
    yearId: yearId(company),
    amount: 10,
  });
  assert.equal(badTarget.ok, false);
  assert.match(badTarget.error, /target not found/i);

  const badAmount = addBudget(company, {
    name: 'Negative',
    targetType: 'ledger',
    targetId: findLedgerByName(company, 'Rent').id,
    yearId: yearId(company),
    amount: -1,
  });
  assert.equal(badAmount.ok, false);
  assert.match(badAmount.error, /zero or more/i);
});

test('budgets can be edited and duplicated into the next financial year', () => {
  const { company, rent, salaries } = budgetFixture();
  const first = addBudget(company, {
    name: 'Rent plan',
    targetType: 'ledger',
    targetId: rent.id,
    yearId: yearId(company),
    amount: 1000,
  }).budget;
  addBudget(company, {
    name: 'Salary plan',
    targetType: 'ledger',
    targetId: salaries.id,
    yearId: yearId(company),
    amount: 5000,
  });

  const updated = updateBudget(company, first.id, { name: 'Rent revised', amount: 1200 });
  assert.equal(updated.ok, true, updated.error);
  assert.equal(updated.budget.name, 'Rent revised');
  assert.equal(updated.budget.amount, 1200);
  assert.equal(updated.budget.targetId, rent.id);
  assert.ok(updated.budget.updatedAt);
  assert.equal(updated.budget.history.length, 1);
  assert.equal(updated.budget.history[0].amount, 1000);
  assert.equal(updated.budget.history[0].name, 'Rent plan');
  assert.ok(updated.budget.history[0].changedAt);

  const clash = updateBudget(company, first.id, { name: 'salary plan' });
  assert.equal(clash.ok, false);
  assert.match(clash.error, /already exists/);

  const badAmount = updateBudget(company, first.id, { amount: -5 });
  assert.equal(badAmount.ok, false);
  assert.match(badAmount.error, /zero or more/);

  const noNextYear = duplicateBudget(company, first.id);
  assert.equal(noNextYear.ok, false);
  assert.match(noNextYear.error, /next financial year/);

  const nextYear = addFinancialYear(company);
  assert.equal(nextYear.ok, true, nextYear.error);
  const copy = duplicateBudget(company, first.id);
  assert.equal(copy.ok, true, copy.error);
  assert.equal(copy.budget.yearId, nextYear.year.id);
  assert.equal(copy.budget.targetId, rent.id);
  assert.equal(copy.budget.amount, 1200);
  assert.match(copy.budget.name, /2027/);

  const again = duplicateBudget(company, first.id);
  assert.equal(again.ok, false);
  assert.match(again.error, /already exists/);

  const sameYear = duplicateBudget(company, first.id, { yearId: yearId(company) });
  assert.equal(sameYear.ok, false);
  assert.match(sameYear.error, /already exists/);
});

test('budget vs actual measures expense movement up to the as-on date', () => {
  const { company, bank, rent } = budgetFixture();
  expense(company, bank, rent, 600, '2026-04-10');
  expense(company, bank, rent, 200, '2026-05-10');
  const added = addBudget(company, {
    name: 'Rent plan',
    targetType: 'ledger',
    targetId: rent.id,
    yearId: yearId(company),
    amount: 1000,
  });
  assert.equal(added.ok, true, added.error);

  const april = budgetVsActual(company, { yearId: yearId(company), asOn: '2026-04-30' });
  assert.equal(april.count, 1);
  assert.equal(april.rows[0].actual, 600);
  assert.equal(april.rows[0].variance, 400);
  assert.equal(april.rows[0].usedPercent, 60);
  assert.equal(april.rows[0].over, false);

  const may = budgetVsActual(company, { yearId: yearId(company), asOn: '2026-05-31' });
  assert.equal(may.rows[0].actual, 800);
  assert.equal(may.rows[0].variance, 200);
  assert.equal(may.totalBudget, 1000);
  assert.equal(may.totalActual, 800);

  const withOpening = budgetVsActual({
    ...company,
    ledgers: company.ledgers.map((ledger) => (ledger.id === rent.id ? { ...ledger, opening: 300, openingType: 'Dr' } : ledger)),
  }, { yearId: yearId(company), asOn: '2026-05-31', includeOpening: true });
  assert.equal(withOpening.includeOpening, true);
  assert.equal(withOpening.rows[0].actual, 1100, 'opening plus period movement');
  assert.equal(withOpening.rows[0].variance, -100);
  assert.equal(withOpening.rows[0].over, true);
});

test('budget openings respect the credit side for income ledgers', () => {
  const fixture = budgetFixture();
  const company = {
    ...fixture.company,
    ledgers: fixture.company.ledgers.map((ledger) =>
      ledger.id === fixture.sales.id ? { ...ledger, opening: 1000, openingType: 'Cr' } : ledger,
    ),
  };
  addVoucher(company, {
    type: 'Sales',
    date: '2026-04-07',
    lines: [
      { ledgerId: fixture.customer.id, side: 'Dr', amount: 500 },
      { ledgerId: fixture.sales.id, side: 'Cr', amount: 500 },
    ],
  });
  addBudget(company, {
    name: 'Sales target',
    targetType: 'ledger',
    targetId: fixture.sales.id,
    yearId: yearId(company),
    amount: 2000,
  });
  const movement = budgetVsActual(company, { yearId: yearId(company), asOn: '2026-04-30' });
  assert.equal(movement.rows[0].actual, 500);
  const withOpening = budgetVsActual(company, {
    yearId: yearId(company),
    asOn: '2026-04-30',
    includeOpening: true,
  });
  assert.equal(withOpening.rows[0].actual, 1500);
  assert.equal(withOpening.rows[0].variance, 500);
});

test('group budgets include child ledgers and income uses the credit side', () => {
  const { company, bank, rent, salaries, sales, customer } = budgetFixture();
  expense(company, bank, rent, 400, '2026-04-05');
  expense(company, bank, salaries, 300, '2026-04-06');
  addVoucher(company, {
    type: 'Sales',
    date: '2026-04-07',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 3000 },
      { ledgerId: sales.id, side: 'Cr', amount: 3000 },
    ],
  });
  const expenseGroup = company.groups.find((group) => group.key === 'indirectExpenses');
  const salesGroup = company.groups.find((group) => group.key === 'sales');
  assert.equal(
    addBudget(company, {
      name: 'Overheads',
      targetType: 'group',
      targetId: expenseGroup.id,
      yearId: yearId(company),
      amount: 1000,
    }).ok,
    true,
  );
  assert.equal(
    addBudget(company, {
      name: 'Sales plan',
      targetType: 'group',
      targetId: salesGroup.id,
      yearId: yearId(company),
      amount: 5000,
    }).ok,
    true,
  );

  const report = budgetVsActual(company, { yearId: yearId(company), asOn: '2026-04-30' });
  const overheads = report.rows.find((row) => row.name === 'Overheads');
  const salesPlan = report.rows.find((row) => row.name === 'Sales plan');
  assert.equal(overheads.actual, 700);
  assert.equal(overheads.over, false);
  assert.equal(salesPlan.actual, 3000);
  assert.equal(salesPlan.variance, 2000);
  assert.equal(salesPlan.over, false);
  assert.equal(report.totalActual, 3700);
});

test('over-budget rows are flagged and budgets can be deleted', () => {
  const { company, bank, rent } = budgetFixture();
  expense(company, bank, rent, 1200, '2026-04-10');
  const added = addBudget(company, {
    name: 'Rent plan',
    targetType: 'ledger',
    targetId: rent.id,
    yearId: yearId(company),
    amount: 1000,
  });
  const report = budgetVsActual(company, { yearId: yearId(company), asOn: '2026-04-30' });
  assert.equal(report.rows[0].actual, 1200);
  assert.equal(report.rows[0].variance, -200);
  assert.equal(report.rows[0].over, true);
  assert.equal(report.overCount, 1);

  const removed = deleteBudget(company, added.budget.id);
  assert.equal(removed.ok, true, removed.error);
  assert.equal(company.budgets.length, 0);
});

test('a budget can target a cost centre and measure tagged spend', () => {
  const { company, bank, rent, salaries } = budgetFixture();
  const centre = addCostCentre(company, {
    name: 'Marketing',
    categoryId: company.costCategories[0].id,
  }).centre;
  const budget = addBudget(company, {
    name: 'Marketing plan',
    targetType: 'costCentre',
    targetId: centre.id,
    yearId: yearId(company),
    amount: 5000,
  });
  assert.equal(budget.ok, true, budget.error);
  assert.equal(budget.budget.targetType, 'costCentre');

  const tagged = addVoucher(company, {
    type: 'Payment',
    date: '2026-04-10',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 1200, costCentreId: centre.id },
      { ledgerId: bank.id, side: 'Cr', amount: 1200 },
    ],
  });
  assert.equal(tagged.ok, true, tagged.error);
  addVoucher(company, {
    type: 'Payment',
    date: '2026-04-11',
    lines: [
      { ledgerId: salaries.id, side: 'Dr', amount: 900 },
      { ledgerId: bank.id, side: 'Cr', amount: 900 },
    ],
  });

  const report = budgetVsActual(company, { yearId: yearId(company), asOn: '2026-04-30' });
  const row = report.rows.find((entry) => entry.name === 'Marketing plan');
  assert.equal(row.targetType, 'costCentre');
  assert.equal(row.nature, 'Cost centre');
  assert.equal(row.actual, 1200, 'only the tagged line counts');
  assert.equal(row.variance, 3800);
  assert.equal(row.nested, false);
  assert.equal(report.totalBudget, 5000);

  const duplicate = addBudget(company, {
    name: 'Marketing plan 2',
    targetType: 'costCentre',
    targetId: centre.id,
    yearId: yearId(company),
    amount: 100,
  });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /already exists/);
  assert.equal(
    addBudget(company, {
      name: 'Missing centre',
      targetType: 'costCentre',
      targetId: 'missing',
      yearId: yearId(company),
      amount: 10,
    }).ok,
    false,
  );
});

test('a cost-category budget covers every centre in the category', () => {
  const { company, bank, rent, salaries } = budgetFixture();
  const category = company.costCategories[0];
  const marketing = addCostCentre(company, { name: 'Marketing', categoryId: category.id }).centre;
  const events = addCostCentre(company, { name: 'Events', categoryId: category.id }).centre;
  const budget = addBudget(company, {
    name: 'Category plan',
    targetType: 'costCategory',
    targetId: category.id,
    yearId: yearId(company),
    amount: 5000,
  });
  assert.equal(budget.ok, true, budget.error);
  assert.equal(budget.budget.targetType, 'costCategory');

  addVoucher(company, {
    type: 'Payment',
    date: '2026-04-10',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 1200, costCentreId: marketing.id },
      { ledgerId: bank.id, side: 'Cr', amount: 1200 },
    ],
  });
  addVoucher(company, {
    type: 'Payment',
    date: '2026-04-11',
    lines: [
      { ledgerId: salaries.id, side: 'Dr', amount: 500, costCentreId: events.id },
      { ledgerId: bank.id, side: 'Cr', amount: 500 },
    ],
  });
  addVoucher(company, {
    type: 'Payment',
    date: '2026-04-12',
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 900 },
      { ledgerId: bank.id, side: 'Cr', amount: 900 },
    ],
  });

  const report = budgetVsActual(company, { yearId: yearId(company), asOn: '2026-04-30' });
  const row = report.rows.find((entry) => entry.name === 'Category plan');
  assert.equal(row.nature, 'Cost category');
  assert.equal(row.actual, 1700, 'both centres count and unallocated spend does not');
  assert.equal(row.variance, 3300);
  assert.equal(report.totalActual, 1700);

  addBudget(company, {
    name: 'Marketing plan',
    targetType: 'costCentre',
    targetId: marketing.id,
    yearId: yearId(company),
    amount: 2000,
  });
  const overlapped = budgetVsActual(company, { yearId: yearId(company), asOn: '2026-04-30' });
  assert.equal(overlapped.rows.find((entry) => entry.name === 'Marketing plan').nested, true);
  assert.equal(overlapped.totalBudget, 5000, 'the category budget is totalled once');

  const centreDelete = deleteCostCentre(company, events.id);
  assert.equal(centreDelete.ok, false);
  assert.match(centreDelete.error, /voucher line/i);
});

test('budgeted cost masters cannot be deleted', () => {
  const { company } = budgetFixture();
  const category = addCostCategory(company, { name: 'Delivery' }).category;
  addBudget(company, {
    name: 'Category plan',
    targetType: 'costCategory',
    targetId: category.id,
    yearId: yearId(company),
    amount: 1000,
  });
  const categoryDelete = deleteCostCategory(company, category.id);
  assert.equal(categoryDelete.ok, false);
  assert.match(categoryDelete.error, /budget/i);

  const centre = addCostCentre(company, { name: 'Unused centre', categoryId: category.id }).centre;
  addBudget(company, {
    name: 'Centre plan',
    targetType: 'costCentre',
    targetId: centre.id,
    yearId: yearId(company),
    amount: 500,
  });
  const centreDelete = deleteCostCentre(company, centre.id);
  assert.equal(centreDelete.ok, false);
  assert.match(centreDelete.error, /budget/i);
});

test('budget totals exclude a ledger budget nested inside a group budget', () => {
  const { company, rent, salaries } = budgetFixture();
  const group = company.groups.find((entry) => entry.key === 'indirectExpenses');
  addBudget(company, {
    name: 'Overhead plan',
    targetType: 'group',
    targetId: group.id,
    yearId: yearId(company),
    amount: 10000,
  });
  addBudget(company, {
    name: 'Rent plan',
    targetType: 'ledger',
    targetId: rent.id,
    yearId: yearId(company),
    amount: 2000,
  });
  addBudget(company, {
    name: 'Salary plan',
    targetType: 'ledger',
    targetId: salaries.id,
    yearId: yearId(company),
    amount: 6000,
  });

  const report = budgetVsActual(company, { yearId: yearId(company), asOn: '2026-04-30' });
  assert.equal(report.rows.length, 3, 'every budget still has its own row');
  assert.equal(report.overlapCount, 2);
  assert.equal(report.rows.find((row) => row.name === 'Rent plan').nested, true);
  assert.equal(report.rows.find((row) => row.name === 'Salary plan').nested, true);
  assert.equal(report.rows.find((row) => row.name === 'Overhead plan').nested, false);
  assert.equal(report.totalBudget, 10000, 'only the top-level group budget is totalled');
});

test('budgets survive backup and reject missing targets on restore', () => {
  const { company, rent } = budgetFixture();
  addBudget(company, {
    name: 'Rent plan',
    targetType: 'ledger',
    targetId: rent.id,
    yearId: yearId(company),
    amount: 1000,
  });
  const exported = exportState({ version: 1, activeCompanyId: company.id, companies: [company] });
  const restored = importState(exported);
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.companies[0].budgets[0].name, 'Rent plan');
  assert.equal(budgetVsActual(restored.state.companies[0], { asOn: '2026-04-30' }).count, 1);

  company.budgets[0].targetId = 'missing-ledger';
  const broken = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(broken.ok, false);
  assert.match(broken.error, /missing ledger/i);
});

test('budgeted ledgers and groups cannot be deleted', () => {
  const { company, rent } = budgetFixture();
  addBudget(company, {
    name: 'Rent plan',
    targetType: 'ledger',
    targetId: rent.id,
    yearId: yearId(company),
    amount: 1000,
  });
  const ledgerDelete = deleteLedger(company, rent.id);
  assert.equal(ledgerDelete.ok, false);
  assert.match(ledgerDelete.error, /used by 1 budget/i);

  const parent = company.groups.find((group) => group.key === 'indirectExpenses');
  const custom = addGroup(company, { name: 'Marketing', parentId: parent.id }).group;
  assert.equal(
    addBudget(company, {
      name: 'Marketing plan',
      targetType: 'group',
      targetId: custom.id,
      yearId: yearId(company),
      amount: 2000,
    }).ok,
    true,
  );
  const groupDelete = deleteGroup(company, custom.id);
  assert.equal(groupDelete.ok, false);
  assert.match(groupDelete.error, /used by 1 budget/i);
});

test('normalization keeps valid budgets and drops duplicates or orphans', () => {
  const { company, rent, salaries } = budgetFixture();
  addBudget(company, {
    name: 'Rent plan',
    targetType: 'ledger',
    targetId: rent.id,
    yearId: yearId(company),
    amount: 1000,
  });
  addBudget(company, {
    name: 'Salary plan',
    targetType: 'ledger',
    targetId: salaries.id,
    yearId: yearId(company),
    amount: 500,
  });
  company.budgets[1].targetId = 'missing';
  company.budgets.push({ ...company.budgets[0], id: 'duplicate' });
  normalizeBudgets(company);
  assert.equal(company.budgets.length, 1);
  assert.equal(company.budgets[0].name, 'Rent plan');
});

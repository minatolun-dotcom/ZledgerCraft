import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addEmployee,
  addLeaveRecord,
  addPayHead,
  applyStatutoryDeductions,
  createCompany,
  deleteEmployee,
  deleteLeaveRecord,
  deletePayHead,
  deletePayrollRun,
  emptyState,
  employeeLeaveBalance,
  exportState,
  findLedgerByName,
  importState,
  payrollBankTransferRows,
  payrollLedgers,
  payrollStatutoryRows,
  reversePayrollRun,
  runPayroll,
  savePayrollSettings,
  updateEmployee,
} from '../src/store.js';
import { epfEcr, esiReturn, payrollForm16, payrollSummary, payrollTdsReturn, trialBalance } from '../src/accounting.js';
import { parseAttendanceCsv } from '../src/ui-payroll.js';

function fixture() {
  const company = createCompany('Payroll Co', '2026-04-01').company;
  const setup = savePayrollSettings(company, { enabled: true });
  assert.equal(setup.ok, true, setup.error);
  return { company, setup };
}

function head(company, name) {
  return company.payroll.payHeads.find((entry) => entry.name === name);
}

function employee(company, name, amounts, extra = {}) {
  const pay = Object.entries(amounts).map(([headName, amount]) => ({
    payHeadId: head(company, headName).id,
    amount,
  }));
  const result = addEmployee(company, { name, ...extra, pay });
  assert.equal(result.ok, true, result.error);
  return result.employee;
}

function standardEmployee(company, name = 'Asha Menon', extra = {}) {
  return employee(
    company,
    name,
    { 'Basic Salary': 30000, 'House Rent Allowance': 10000, 'Provident Fund (Employee)': 4200, 'Professional Tax': 200 },
    extra,
  );
}

test('payroll setup creates salary ledgers and seeds pay heads', () => {
  const company = createCompany('Setup Co', '2026-04-01').company;
  assert.equal(company.payroll.enabled, false);
  assert.deepEqual(company.payroll.employees, []);

  const result = savePayrollSettings(company, { enabled: true });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.created, [
    'Salaries',
    'Salary Payable',
    'Provident Fund Payable',
    'ESI Payable',
    'Professional Tax Payable',
  ]);
  assert.equal(company.payroll.enabled, true);
  assert.equal(company.payroll.payHeads.length, 6);
  assert.equal(head(company, 'Basic Salary').kind, 'Earning');
  assert.equal(head(company, 'Provident Fund (Employee)').statutory, 'PF');

  const ledgers = payrollLedgers(company);
  assert.equal(ledgers.salaries.name, 'Salaries');
  assert.equal(ledgers.payable.name, 'Salary Payable');
  assert.equal(company.groups.find((group) => group.id === ledgers.salaries.groupId).key, 'indirectExpenses');
  assert.equal(company.groups.find((group) => group.id === ledgers.payable.groupId).key, 'currentLiabilities');
  for (const payHead of company.payroll.payHeads) {
    assert.equal(company.ledgers.some((ledger) => ledger.id === payHead.ledgerId), true, payHead.name);
  }

  const again = savePayrollSettings(company, { enabled: true });
  assert.equal(again.ok, true, again.error);
  assert.deepEqual(again.created, []);
  assert.equal(company.payroll.payHeads.length, 6);
  assert.equal(company.ledgers.filter((ledger) => ledger.name === 'Salaries').length, 1);
});

test('pay heads validate their ledger and cannot be deleted while assigned', () => {
  const { company } = fixture();
  const salaries = payrollLedgers(company).salaries;
  const added = addPayHead(company, { name: 'Vehicle Allowance', kind: 'Earning', ledgerId: salaries.id });
  assert.equal(added.ok, true, added.error);
  assert.equal(head(company, 'Vehicle Allowance').kind, 'Earning');

  assert.equal(addPayHead(company, { name: 'Vehicle Allowance', kind: 'Earning', ledgerId: salaries.id }).ok, false);
  assert.equal(addPayHead(company, { name: 'Bad kind', kind: 'Employer', ledgerId: salaries.id }).ok, false);
  assert.equal(addPayHead(company, { name: 'No ledger', kind: 'Deduction', ledgerId: 'missing' }).ok, false);

  standardEmployee(company);
  const basic = head(company, 'Basic Salary');
  const blocked = deletePayHead(company, basic.id);
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /used by 1 employee/);
  assert.equal(deletePayHead(company, added.payHead.id).ok, true);
  assert.equal(company.payroll.payHeads.some((entry) => entry.name === 'Vehicle Allowance'), false);
});

test('employees need a name, a valid PAN and at least one earning', () => {
  const { company } = fixture();
  standardEmployee(company, 'Asha Menon');
  assert.equal(
    addEmployee(company, { name: 'Asha Menon', pay: [{ payHeadId: head(company, 'Basic Salary').id, amount: 1000 }] }).ok,
    false,
  );
  assert.equal(
    addEmployee(company, { name: 'Bad PAN', pan: 'BADPAN', pay: [{ payHeadId: head(company, 'Basic Salary').id, amount: 1000 }] }).ok,
    false,
  );
  const noEarning = addEmployee(company, {
    name: 'Only PF',
    pay: [{ payHeadId: head(company, 'Provident Fund (Employee)').id, amount: 500 }],
  });
  assert.equal(noEarning.ok, false);
  assert.match(noEarning.error, /earning/);

  const updated = updateEmployee(company, company.payroll.employees[0].id, {
    name: 'Asha M',
    pan: 'ABCDE1234F',
    active: false,
    pay: [{ payHeadId: head(company, 'Basic Salary').id, amount: 20000 }],
  });
  assert.equal(updated.ok, true, updated.error);
  assert.equal(updated.employee.active, false);
  assert.equal(updated.employee.pan, 'ABCDE1234F');
  assert.equal(company.payroll.employees[0].name, 'Asha M');
});

test('percentage-of-basic pay heads compute from fixed Basic and prorate', () => {
  const { company } = fixture();
  const salaries = payrollLedgers(company).salaries;
  const added = addPayHead(company, {
    name: 'Performance Bonus',
    kind: 'Earning',
    ledgerId: salaries.id,
    percentOfBasic: 10,
  });
  assert.equal(added.ok, true, added.error);
  assert.equal(added.payHead.percentOfBasic, 10);
  assert.equal(addPayHead(company, { name: 'Too much', kind: 'Earning', ledgerId: salaries.id, percentOfBasic: 101 }).ok, false);
  assert.equal(addPayHead(company, { name: 'Tagged', kind: 'Deduction', ledgerId: salaries.id, percentOfBasic: 5, statutory: 'PF' }).ok, false);

  const basic = head(company, 'Basic Salary').id;
  const bonus = added.payHead.id;
  const result = addEmployee(company, {
    name: 'Ravi Kumar',
    pay: [
      { payHeadId: basic, amount: 10000 },
      { payHeadId: bonus, amount: 12 },
    ],
  });
  assert.equal(result.ok, true, result.error);

  const run = runPayroll(company, { month: '2026-04' });
  assert.equal(run.ok, true, run.error);
  const bonusLine = run.run.rows[0].earnings.find((line) => line.payHeadId === bonus);
  assert.equal(bonusLine.amount, 1200);
  assert.equal(run.run.rows[0].gross, 11200);

  const part = runPayroll(company, { month: '2026-06', paidDays: { [result.employee.id]: 15 } });
  assert.equal(part.ok, true, part.error);
  assert.equal(part.run.rows[0].earnings.find((line) => line.payHeadId === bonus).amount, 600);
  assert.equal(part.run.rows[0].gross, 5600);
});

test('a payroll run posts a balanced journal and stores the run snapshot', () => {
  const { company } = fixture();
  standardEmployee(company);
  const result = runPayroll(company, { month: '2026-04' });
  assert.equal(result.ok, true, result.error);
  const { run, voucher } = result;

  assert.equal(run.month, '2026-04');
  assert.equal(run.date, '2026-04-30');
  assert.equal(run.totals.employees, 1);
  assert.equal(run.totals.gross, 40000);
  assert.equal(run.totals.deductions, 4400);
  assert.equal(run.totals.net, 35600);
  assert.equal(run.rows[0].name, 'Asha Menon');
  assert.equal(run.rows[0].earnings.length, 2);
  assert.equal(run.rows[0].deductions.length, 2);
  assert.equal(run.rows[0].deductions.find((line) => line.statutory === 'PF').amount, 4200);
  assert.equal(voucher.type, 'Journal');
  assert.equal(voucher.payrollRunId, run.id);
  assert.equal(voucher.narration, 'Payroll for 2026-04');
  assert.equal(run.voucherId, voucher.id);
  assert.equal(voucher.lines.length, 4);
  assert.equal(voucher.total, 40000);

  const byName = (name) => voucher.lines.find((line) => line.ledgerId === findLedgerByName(company, name).id);
  assert.equal(byName('Salaries').side, 'Dr');
  assert.equal(byName('Salaries').amount, 40000);
  assert.equal(byName('Provident Fund Payable').side, 'Cr');
  assert.equal(byName('Provident Fund Payable').amount, 4200);
  assert.equal(byName('Professional Tax Payable').amount, 200);
  assert.equal(byName('Salary Payable').amount, 35600);

  const balances = trialBalance(company);
  assert.equal(balances.balanced, true);
  assert.equal(balances.debitTotal, 40000);
  assert.equal(balances.creditTotal, 40000);

  const summary = payrollSummary(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(summary.count, 1);
  assert.equal(summary.totals.gross, 40000);
  assert.equal(summary.totals.deductions, 4400);
  assert.equal(summary.totals.net, 35600);
  assert.equal(summary.payHeads.length, 4);
  assert.equal(summary.statutory.find((row) => row.tag === 'PF').amount, 4200);
  assert.equal(summary.employees[0].name, 'Asha Menon');
  assert.equal(summary.runs[0].voucherNo, voucher.no);
});

test('paid days prorate a payroll run and reject impossible attendance', () => {
  const { company } = fixture();
  const asha = standardEmployee(company);
  const run = runPayroll(company, { month: '2026-05', paidDays: { [asha.id]: 15 } });
  assert.equal(run.ok, true, run.error);
  assert.equal(run.run.rows[0].paidDays, 15);
  assert.equal(run.run.rows[0].monthDays, 31);
  assert.equal(run.run.rows[0].gross, 19354.84);
  assert.equal(run.run.rows[0].net, 17225.81);

  const invalid = runPayroll(company, { month: '2026-06', paidDays: { [asha.id]: 31 } });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /paid days must be between 0 and 30/);
});

test('leave records reduce balances and reject overlaps', () => {
  const { company } = fixture();
  const asha = standardEmployee(company);
  asha.leave = { CL: 12, SL: 6, EL: 0 };
  const leave = addLeaveRecord(company, {
    employeeId: asha.id,
    type: 'CL',
    from: '2026-04-10',
    to: '2026-04-11',
    notes: 'Personal',
  });
  assert.equal(leave.ok, true, leave.error);
  assert.equal(leave.record.days, 2);
  assert.equal(employeeLeaveBalance(company, asha.id).CL.remaining, 10);
  assert.equal(
    addLeaveRecord(company, { employeeId: asha.id, type: 'SL', from: '2026-04-11', to: '2026-04-12' }).ok,
    false,
  );
  assert.equal(deleteLeaveRecord(company, leave.record.id).ok, true);
  assert.equal(employeeLeaveBalance(company, asha.id).CL.remaining, 12);
});

test('changing a pay structure records a dated salary revision', () => {
  const { company } = fixture();
  const asha = standardEmployee(company);
  assert.equal(asha.revisions.length, 1);
  const basic = head(company, 'Basic Salary');
  const updated = updateEmployee(company, asha.id, {
    name: asha.name,
    pay: [{ payHeadId: basic.id, amount: 35000 }],
    leave: { CL: 0, SL: 0, EL: 0 },
    revisionDate: '2026-05-01',
  });
  assert.equal(updated.ok, true, updated.error);
  assert.equal(updated.employee.revisions.length, 2);
  assert.equal(updated.employee.revisions[1].date, '2026-05-01');
  assert.equal(updated.employee.revisions[1].pay[0].amount, 35000);
  const unchanged = updateEmployee(company, asha.id, {
    name: asha.name,
    pay: [{ payHeadId: basic.id, amount: 35000 }],
    leave: { CL: 0, SL: 0, EL: 0 },
  });
  assert.equal(unchanged.employee.revisions.length, 2);
});

test('statutory calculator applies capped PF and professional tax', () => {
  const { company } = fixture();
  standardEmployee(company);
  const rows = payrollStatutoryRows(company, '2026-04');
  assert.equal(rows[0].gross, 40000);
  assert.equal(rows[0].pf, 1800);
  assert.equal(rows[0].esi, 0);
  assert.equal(rows[0].pt, 200);
  const applied = applyStatutoryDeductions(company, '2026-04');
  assert.equal(applied.ok, true, applied.error);
  const pfHead = head(company, 'Provident Fund (Employee)');
  assert.equal(company.payroll.employees[0].pay.find((entry) => entry.payHeadId === pfHead.id).amount, 1800);
  assert.equal(savePayrollSettings(company, { enabled: true, pfRate: 10, pfCeiling: 10000 }).ok, true);
  assert.equal(payrollStatutoryRows(company, '2026-04')[0].pf, 1000);
});

test('optional employer PF and ESI are posted to their payable ledgers', () => {
  const { company } = fixture();
  standardEmployee(company);
  assert.equal(savePayrollSettings(company, { enabled: true, employerPfRate: 12, employerEsiRate: 3.25 }).ok, true);
  const rows = payrollStatutoryRows(company, '2026-04');
  assert.equal(rows[0].employerPf, 1800);
  assert.equal(rows[0].employerEsi, 0);

  const run = runPayroll(company, { month: '2026-04' });
  assert.equal(run.ok, true, run.error);
  assert.equal(run.run.totals.employerPf, 1800);
  assert.equal(run.run.totals.employerCost, 1800);
  const pf = findLedgerByName(company, 'Provident Fund Payable');
  const salaries = findLedgerByName(company, 'Salaries');
  const debit = run.voucher.lines.find((line) => line.ledgerId === salaries.id && line.side === 'Dr');
  const credit = run.voucher.lines.find((line) => line.ledgerId === pf.id && line.side === 'Cr');
  assert.equal(debit.amount, 41800);
  assert.equal(credit.amount, 6000);
  assert.equal(trialBalance(company, '2026-04-30').balanced, true);
});

test('attendance CSV matches employees by name or code', () => {
  const { company } = fixture();
  const asha = standardEmployee(company);
  asha.code = 'EMP-1';
  const parsed = parseAttendanceCsv('Employee,PaidDays\nEMP-1,24\n', company.payroll.employees);
  assert.equal(parsed.ok, true, parsed.error);
  assert.equal(parsed.paidDays[asha.id], 24);
  assert.equal(parseAttendanceCsv('Employee,PaidDays\nMissing,10', company.payroll.employees).ok, false);
  assert.equal(parseAttendanceCsv('Employee,PaidDays\nAsha Menon,32', company.payroll.employees).ok, false);
});

test('one payroll run per month and only inside an open financial year', () => {
  const { company } = fixture();
  standardEmployee(company);
  assert.equal(runPayroll(company, { month: '2026-04' }).ok, true);
  const twice = runPayroll(company, { month: '2026-04' });
  assert.equal(twice.ok, false);
  assert.match(twice.error, /already been run/);

  assert.equal(runPayroll(company, { month: '2026-13' }).ok, false);
  assert.equal(runPayroll(company, { month: '2026-05', date: '2026-04-30' }).ok, false);
  assert.equal(runPayroll(company, { month: '2026-08' }).ok, true);
  assert.equal(company.payroll.runs.length, 2);
  assert.equal(company.vouchers.filter((voucher) => voucher.type === 'Journal').length, 2);
});

test('inactive employees are skipped and deductions cannot exceed earnings', () => {
  const { company } = fixture();
  standardEmployee(company);
  const inactive = standardEmployee(company, 'Rohan Das');
  updateEmployee(company, inactive.id, {
    name: 'Rohan Das',
    active: false,
    pay: [{ payHeadId: head(company, 'Basic Salary').id, amount: 10000 }],
  });

  const result = runPayroll(company, { month: '2026-04' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.run.rows.length, 1);

  company.payroll.employees.push({
    id: 'emp_over',
    name: 'Over Deducted',
    active: true,
    pay: [
      { payHeadId: head(company, 'Basic Salary').id, amount: 1000 },
      { payHeadId: head(company, 'Provident Fund (Employee)').id, amount: 2000 },
    ],
  });
  const over = runPayroll(company, { month: '2026-05' });
  assert.equal(over.ok, false);
  assert.match(over.error, /deductions exceed earnings/);
});

test('a second month updates the register and keeps older snapshots intact', () => {
  const { company } = fixture();
  const asha = standardEmployee(company);
  assert.equal(runPayroll(company, { month: '2026-04' }).ok, true);

  updateEmployee(company, asha.id, {
    name: asha.name,
    pay: [
      { payHeadId: head(company, 'Basic Salary').id, amount: 35000 },
      { payHeadId: head(company, 'Provident Fund (Employee)').id, amount: 4200 },
    ],
  });
  const second = runPayroll(company, { month: '2026-05' });
  assert.equal(second.ok, true, second.error);
  assert.equal(second.run.totals.gross, 35000);

  const first = company.payroll.runs.find((run) => run.month === '2026-04');
  assert.equal(first.rows[0].gross, 40000);
  assert.equal(first.totals.net, 35600);

  const report = payrollSummary(company, { from: '2026-04-01', to: '2026-06-30' });
  assert.equal(report.count, 2);
  assert.equal(report.totals.gross, 75000);
  assert.equal(report.totals.deductions, 8600);
  assert.equal(report.totals.net, 66400);
  assert.equal(report.statutory.find((row) => row.tag === 'PF').amount, 8400);
  const ashaRow = report.employees.find((row) => row.employeeId === asha.id);
  assert.equal(ashaRow.months, 2);
  assert.equal(ashaRow.gross, 75000);
  assert.equal(report.payHeads.find((row) => row.name === 'Basic Salary').count, 2);
});

test('runs can be deleted with their voucher, and employees with history cannot', () => {
  const { company } = fixture();
  const asha = standardEmployee(company);
  const run = runPayroll(company, { month: '2026-04' }).run;
  const voucherId = run.voucherId;

  const blocked = deleteEmployee(company, asha.id);
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /Deactivate/);

  const deleted = deletePayrollRun(company, run.id);
  assert.equal(deleted.ok, true, deleted.error);
  assert.equal(company.payroll.runs.length, 0);
  assert.equal(company.vouchers.some((voucher) => voucher.id === voucherId), false);
  assert.equal(deleteEmployee(company, asha.id).ok, true);
});

test('joining and exit dates prorate pay by calendar days', () => {
  const joinedMidMonth = fixture().company;
  standardEmployee(joinedMidMonth, 'Asha Menon', { dateOfJoining: '2026-04-16' });
  const joined = runPayroll(joinedMidMonth, { month: '2026-04' });
  assert.equal(joined.ok, true, joined.error);
  const joinedRow = joined.run.rows[0];
  assert.equal(joinedRow.workedDays, 15);
  assert.equal(joinedRow.monthDays, 30);
  assert.equal(joinedRow.gross, 20000);
  assert.equal(joinedRow.deductionTotal, 2200);
  assert.equal(joinedRow.net, 17800);
  assert.equal(joined.run.totals.gross, 20000);
  assert.equal(joined.voucher.total, 20000);

  const exitedMidMonth = fixture().company;
  standardEmployee(exitedMidMonth, 'Asha Menon', {
    dateOfJoining: '2025-06-01',
    dateOfExit: '2026-04-15',
  });
  const exited = runPayroll(exitedMidMonth, { month: '2026-04' });
  assert.equal(exited.ok, true, exited.error);
  assert.equal(exited.run.rows[0].workedDays, 15);
  assert.equal(exited.run.rows[0].gross, 20000);

  const exitedBeforeMonth = fixture().company;
  standardEmployee(exitedBeforeMonth, 'Asha Menon', { dateOfExit: '2026-03-31' });
  const empty = runPayroll(exitedBeforeMonth, { month: '2026-04' });
  assert.equal(empty.ok, false);
  assert.match(empty.error, /No employee worked during 2026-04/);
});

test('employee bank details validate and build a bank transfer file', () => {
  const { company } = fixture();
  const pay = [{ payHeadId: head(company, 'Basic Salary').id, amount: 30000 }];
  assert.equal(addEmployee(company, { name: 'Bad Account', bankAccount: 'ABC', pay }).ok, false);
  assert.equal(addEmployee(company, { name: 'Bad IFSC', ifsc: 'HDFC123', pay }).ok, false);
  const added = addEmployee(company, {
    name: 'Asha Menon',
    bankName: 'HDFC Bank',
    bankAccount: '1234 5678 9012',
    ifsc: 'hdfc0001234',
    pay,
  });
  assert.equal(added.ok, true, added.error);
  assert.equal(added.employee.bankAccount, '123456789012');
  assert.equal(added.employee.ifsc, 'HDFC0001234');

  standardEmployee(company, 'Ravi Kumar');
  const run = runPayroll(company, { month: '2026-04' }).run;
  const file = payrollBankTransferRows(company, run.id);
  assert.equal(file.ok, true, file.error);
  const asha = file.rows.find((row) => row.name === 'Asha Menon');
  assert.equal(asha.accountNumber, '123456789012');
  assert.equal(asha.ifsc, 'HDFC0001234');
  assert.equal(asha.net, 30000);
  assert.deepEqual(file.missing, ['Ravi Kumar']);
  assert.equal(payrollBankTransferRows(company, 'missing').ok, false);

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0].payroll.employees.find((employee) => employee.name === 'Asha Menon');
  assert.equal(copy.bankName, 'HDFC Bank');
  assert.equal(copy.bankAccount, '123456789012');
  assert.equal(copy.ifsc, 'HDFC0001234');
});

test('employee exit dates are validated and survive a backup round trip', () => {
  const { company } = fixture();
  const pay = [{ payHeadId: head(company, 'Basic Salary').id, amount: 30000 }];
  assert.equal(
    addEmployee(company, { name: 'Bad Exit', dateOfJoining: '2026-04-10', dateOfExit: '2026-04-01', pay }).ok,
    false,
  );
  assert.equal(
    addEmployee(company, { name: 'Bad Date', dateOfExit: '2026-02-30', pay }).ok,
    false,
  );
  const added = addEmployee(company, {
    name: 'Asha Menon',
    dateOfJoining: '2025-06-01',
    dateOfExit: '2026-04-15',
    pay,
  });
  assert.equal(added.ok, true, added.error);
  assert.equal(added.employee.dateOfExit, '2026-04-15');

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.companies[0].payroll.employees[0].dateOfExit, '2026-04-15');
});

test('payroll settings, employees and runs survive a backup round trip', () => {
  const { company } = fixture();
  standardEmployee(company, 'Asha Menon', { pan: 'ABCDE1234F', dateOfJoining: '2025-06-01' });
  const run = runPayroll(company, { month: '2026-04' }).run;

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];

  assert.equal(copy.payroll.enabled, true);
  assert.equal(copy.payroll.payHeads.length, 6);
  assert.equal(copy.payroll.employees[0].name, 'Asha Menon');
  assert.equal(copy.payroll.employees[0].pan, 'ABCDE1234F');
  assert.equal(copy.payroll.runs.length, 1);
  assert.equal(copy.payroll.runs[0].totals.net, 35600);
  assert.equal(copy.payroll.runs[0].voucherId, run.voucherId);
  assert.equal(copy.vouchers.find((voucher) => voucher.id === run.voucherId).narration, 'Payroll for 2026-04');
  assert.equal(payrollLedgers(copy).payable.name, 'Salary Payable');

  const report = payrollSummary(copy, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(report.totals.net, 35600);
  assert.equal(report.rows[0].employee, 'Asha Menon');
});

test('backup validation rejects a payroll run with inconsistent totals', () => {
  const { company } = fixture();
  standardEmployee(company);
  runPayroll(company, { month: '2026-04' });
  company.payroll.runs[0].totals.net = 1000;

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, false);
  assert.match(restored.error, /inconsistent totals/);
});

test('payroll reversal posts an opposite journal and excludes the run from summaries', () => {
  const { company } = fixture();
  employee(company, 'Reversal Employee', { 'Basic Salary': 10000 });
  const run = runPayroll(company, { month: '2026-04' });
  assert.equal(run.ok, true, run.error);
  const original = company.vouchers.find((voucher) => voucher.id === run.run.voucherId);
  const reversed = reversePayrollRun(company, run.run.id);
  assert.equal(reversed.ok, true, reversed.error);
  assert.ok(run.run.reversedAt);
  assert.equal(run.run.reversalVoucherId, reversed.voucher.id);
  assert.equal(reversed.voucher.lines.length, original.lines.length);
  for (const line of original.lines) {
    const opposite = reversed.voucher.lines.find(
      (entry) => entry.ledgerId === line.ledgerId && entry.amount === line.amount,
    );
    assert.ok(opposite);
    assert.notEqual(opposite.side, line.side);
  }
  const summary = payrollSummary(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(summary.totals.gross, 0);
  assert.equal(summary.rows.length, 0);
  assert.equal(summary.runs[0].reversed, true);
  assert.equal(reversePayrollRun(company, run.run.id).ok, false);
  assert.equal(deletePayrollRun(company, run.run.id).ok, true);
  assert.equal(company.vouchers.some((voucher) => voucher.id === reversed.voucher.id), false);
});

test('a supplementary run pays only employees missed by the regular run', () => {
  const { company } = fixture();
  const asha = standardEmployee(company);
  const regular = runPayroll(company, { month: '2026-04' });
  assert.equal(regular.ok, true, regular.error);
  assert.equal(regular.run.rows.length, 1);

  const rohan = standardEmployee(company, 'Rohan Das', { dateOfJoining: '2026-04-20' });
  const supplementary = runPayroll(company, {
    month: '2026-04',
    kind: 'Supplementary',
    reason: 'Late joiner',
  });
  assert.equal(supplementary.ok, true, supplementary.error);
  assert.equal(supplementary.run.kind, 'Supplementary');
  assert.equal(supplementary.run.reason, 'Late joiner');
  assert.equal(supplementary.run.rows.length, 1);
  assert.equal(supplementary.run.rows[0].employeeId, rohan.id);
  assert.match(supplementary.voucher.narration, /Supplementary payroll/);
  assert.equal(company.payroll.runs.length, 2);
  assert.equal(company.vouchers.length, 2);

  const none = runPayroll(company, { month: '2026-04', kind: 'Supplementary' });
  assert.equal(none.ok, false);
  assert.match(none.error, /No uncovered active employees/);

  const report = payrollSummary(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(report.count, 2);
  assert.equal(report.runs.filter((run) => run.kind === 'Supplementary').length, 1);
  assert.equal(report.totals.gross, regular.run.totals.gross + supplementary.run.totals.gross);
});

test('supplementary and adjustment runs require a regular run first', () => {
  const { company } = fixture();
  standardEmployee(company);
  const early = runPayroll(company, { month: '2026-04', kind: 'Supplementary' });
  assert.equal(early.ok, false);
  assert.match(early.error, /regular payroll/i);
  const adjustment = runPayroll(company, {
    month: '2026-04',
    kind: 'Adjustment',
    adjustments: [],
  });
  assert.equal(adjustment.ok, false);
  assert.match(adjustment.error, /regular payroll/i);
});

test('an adjustment run allocates explicit signed deltas to employee pay heads', () => {
  const { company } = fixture();
  const asha = standardEmployee(company);
  assert.equal(runPayroll(company, { month: '2026-04' }).ok, true);
  const basic = head(company, 'Basic Salary');
  const pf = head(company, 'Provident Fund (Employee)');
  const adjusted = runPayroll(company, {
    month: '2026-04',
    kind: 'Adjustment',
    reason: 'Bonus and PF correction',
    adjustments: [
      { employeeId: asha.id, payHeadId: basic.id, amount: 5000 },
      { employeeId: asha.id, payHeadId: pf.id, amount: 500 },
    ],
  });
  assert.equal(adjusted.ok, true, adjusted.error);
  assert.equal(adjusted.run.kind, 'Adjustment');
  assert.equal(adjusted.run.rows.length, 1);
  assert.equal(adjusted.run.rows[0].gross, 5000);
  assert.equal(adjusted.run.rows[0].deductionTotal, 500);
  assert.equal(adjusted.run.rows[0].net, 4500);
  const payable = payrollLedgers(company).payable;
  const basicLine = adjusted.voucher.lines.find((line) => line.ledgerId === basic.ledgerId);
  const pfLine = adjusted.voucher.lines.find((line) => line.ledgerId === pf.ledgerId);
  const payableLine = adjusted.voucher.lines.find((line) => line.ledgerId === payable.id);
  assert.deepEqual({ side: basicLine.side, amount: basicLine.amount }, { side: 'Dr', amount: 5000 });
  assert.deepEqual({ side: pfLine.side, amount: pfLine.amount }, { side: 'Cr', amount: 500 });
  assert.deepEqual({ side: payableLine.side, amount: payableLine.amount }, { side: 'Cr', amount: 4500 });
  assert.equal(trialBalance(company, '2026-04-30').balanced, true);

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.companies[0].payroll.runs.find((run) => run.kind === 'Adjustment').totals.net, 4500);
});

test('a negative adjustment reverses pay and remains valid in backups', () => {
  const { company } = fixture();
  const asha = standardEmployee(company);
  assert.equal(runPayroll(company, { month: '2026-04' }).ok, true);
  const basic = head(company, 'Basic Salary');
  const adjusted = runPayroll(company, {
    month: '2026-04',
    kind: 'Adjustment',
    reason: 'Recover overpayment',
    adjustments: [{ employeeId: asha.id, payHeadId: basic.id, amount: -1000 }],
  });
  assert.equal(adjusted.ok, true, adjusted.error);
  assert.equal(adjusted.run.rows[0].net, -1000);
  const payable = payrollLedgers(company).payable;
  const payableLine = adjusted.voucher.lines.find((line) => line.ledgerId === payable.id);
  const basicLine = adjusted.voucher.lines.find((line) => line.ledgerId === basic.ledgerId);
  assert.deepEqual({ side: payableLine.side, amount: payableLine.amount }, { side: 'Dr', amount: 1000 });
  assert.deepEqual({ side: basicLine.side, amount: basicLine.amount }, { side: 'Cr', amount: 1000 });
  assert.equal(trialBalance(company, '2026-04-30').balanced, true);

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.companies[0].payroll.runs.some((run) => run.kind === 'Adjustment'), true);
});

test('employee UAN and ESIC numbers validate, update and survive backup validation', () => {
  const { company } = fixture();
  const basic = [{ payHeadId: head(company, 'Basic Salary').id, amount: 10000 }];
  assert.equal(addEmployee(company, { name: 'Bad UAN', uan: '12345', pay: basic }).ok, false);
  assert.equal(addEmployee(company, { name: 'Bad ESIC', esic: 'ABC123', pay: basic }).ok, false);
  assert.match(
    addEmployee(company, { name: 'Bad UAN', uan: '12345', pay: basic }).error,
    /UAN must be 12 digits/,
  );

  const asha = standardEmployee(company, 'Asha Menon', {
    uan: '100200300400',
    esic: '3100123456',
    pan: 'ABCDE1234F',
  });
  assert.equal(asha.uan, '100200300400');
  assert.equal(asha.esic, '3100123456');

  const pay = asha.pay.map(({ payHeadId, amount }) => ({ payHeadId, amount }));
  const updated = updateEmployee(company, asha.id, {
    name: asha.name,
    pay,
    uan: '100200300401',
    esic: '',
  });
  assert.equal(updated.ok, true, updated.error);
  assert.equal(updated.employee.uan, '100200300401');
  assert.equal(updated.employee.esic, undefined);

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  assert.equal(importState(exportState(state)).ok, true);
  company.payroll.employees[0].uan = '123';
  const rejected = importState(exportState(state));
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /invalid UAN/);
});

test('EPF ECR and ESI working papers use stored payroll snapshots and statutory identifiers', () => {
  const { company } = fixture();
  standardEmployee(company, 'Asha Menon', {
    uan: '100200300400',
    esic: '3100123456',
    pan: 'ABCDE1234F',
  });
  employee(
    company,
    'Ravi Kumar',
    { 'Basic Salary': 10000, 'House Rent Allowance': 5000, 'ESI (Employee)': 150 },
    { uan: '100200300401', esic: '3100123457' },
  );
  const run = runPayroll(company, { month: '2026-04' });
  assert.equal(run.ok, true, run.error);

  const ecr = epfEcr(company, { month: '2026-04' });
  assert.equal(ecr.ok, true, ecr.error);
  assert.equal(ecr.rows.length, 2);
  const asha = ecr.rows.find((row) => row.name === 'Asha Menon');
  assert.equal(asha.uan, '100200300400');
  assert.equal(asha.grossWages, 40000);
  assert.equal(asha.pfWages, 15000);
  assert.equal(asha.employeePf, 4200);
  const ravi = ecr.rows.find((row) => row.name === 'Ravi Kumar');
  assert.equal(ravi.pfWages, 10000);
  assert.equal(ecr.totals.pfWages, 25000);
  assert.deepEqual(ecr.warnings, []);
  assert.match(ecr.note, /not an uploaded ECR/);

  const esi = esiReturn(company, { month: '2026-04' });
  assert.equal(esi.ok, true, esi.error);
  assert.equal(esi.rows.length, 2);
  const raviEsi = esi.rows.find((row) => row.name === 'Ravi Kumar');
  assert.equal(raviEsi.esic, '3100123457');
  assert.equal(raviEsi.grossWages, 15000);
  assert.equal(raviEsi.employeeEsi, 150);
  assert.equal(raviEsi.contributionPeriod, 'Apr–Sep');
  assert.equal(esi.rows.find((row) => row.name === 'Asha Menon').grossWages, 0);
  assert.equal(epfEcr(company, { month: 'April' }).ok, false);
});

test('Form 24Q and Form 16 working papers aggregate payroll gross and TDS', () => {
  const { company } = fixture();
  const asha = standardEmployee(company, 'Asha Menon', { pan: 'ABCDE1234F' });
  const salaries = payrollLedgers(company).salaries;
  const added = addPayHead(company, {
    name: 'Income Tax',
    kind: 'Deduction',
    ledgerId: salaries.id,
    statutory: 'TDS',
  });
  assert.equal(added.ok, true, added.error);
  const pay = [...asha.pay, { payHeadId: added.payHead.id, amount: 5000 }];
  assert.equal(updateEmployee(company, asha.id, { name: asha.name, pan: 'ABCDE1234F', pay }).ok, true);
  assert.equal(runPayroll(company, { month: '2026-04' }).ok, true);

  const quarterly = payrollTdsReturn(company, { quarter: 'Q1', to: '2026-04-30' });
  assert.equal(quarterly.ok, true, quarterly.error);
  assert.equal(quarterly.quarter, 'Q1');
  assert.equal(quarterly.from, '2026-04-01');
  assert.equal(quarterly.to, '2026-06-30');
  assert.equal(quarterly.rows.length, 1);
  assert.equal(quarterly.rows[0].pan, 'ABCDE1234F');
  assert.equal(quarterly.rows[0].gross, 40000);
  assert.equal(quarterly.rows[0].tds, 5000);
  assert.equal(quarterly.totals.tds, 5000);
  assert.match(quarterly.note, /not an uploaded return/);

  const form16 = payrollForm16(company, { employeeId: asha.id, from: '2026-04-01', to: '2027-03-31' });
  assert.equal(form16.ok, true, form16.error);
  assert.equal(form16.employee.pan, 'ABCDE1234F');
  assert.equal(form16.rows.length, 1);
  assert.equal(form16.rows[0].month, '2026-04');
  assert.equal(form16.totals.gross, 40000);
  assert.equal(form16.totals.tds, 5000);
  assert.match(form16.note, /not a signed certificate/);
  assert.equal(payrollForm16(company, { employeeId: 'missing' }).ok, false);
});

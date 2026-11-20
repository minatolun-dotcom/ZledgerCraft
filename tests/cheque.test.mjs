import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLedger,
  addVoucher,
  createCompany,
  emptyState,
  exportState,
  findLedgerByName,
  importState,
  normalizeInstruments,
  saveBankStatement,
  setBankMatch,
  setInstrumentStatus,
  updateVoucher,
} from '../src/store.js';
import { amountInWords, postDatedRegister } from '../src/accounting.js';

function chequeFixture() {
  const company = createCompany('Cheque Co', '2026-04-01').company;
  const bank = findLedgerByName(company, 'Bank');
  const cash = findLedgerByName(company, 'Cash');
  const expense = addLedger(company, {
    name: 'Office Expenses',
    groupId: company.groups.find((group) => group.key === 'indirectExpenses').id,
    opening: 0,
  }).ledger;
  return { company, bank, cash, expense };
}

function payment(company, bank, expense, amount, date, instrument) {
  return addVoucher(company, {
    type: 'Payment',
    date,
    narration: 'Cheque payment',
    instrument,
    lines: [
      { ledgerId: expense.id, side: 'Dr', amount },
      { ledgerId: bank.id, side: 'Cr', amount },
    ],
  });
}

test('a payment stores valid cheque details', () => {
  const { company, bank, expense } = chequeFixture();
  const result = payment(company, bank, expense, 1250, '2026-05-10', {
    kind: 'Cheque',
    number: ' 100234 ',
    date: '2026-06-15',
    bankLedgerId: bank.id,
  });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.voucher.instrument, {
    kind: 'Cheque',
    number: '100234',
    date: '2026-06-15',
    bankLedgerId: bank.id,
  });

  const register = postDatedRegister(company, { asOn: '2026-05-31' });
  assert.equal(register.count, 1);
  assert.equal(register.rows[0].status, 'Post-dated');
  assert.equal(register.rows[0].daysFromAsOn, 15);
  assert.equal(register.rows[0].party, 'Office Expenses');
  assert.equal(register.rows[0].bank, 'Bank');
  assert.equal(register.postDatedTotal, 1250);
  assert.equal(postDatedRegister(company, { asOn: '2026-05-31', bankLedgerId: bank.id }).count, 1);
  assert.equal(postDatedRegister(company, { asOn: '2026-05-31', bankLedgerId: 'other' }).count, 0);
  assert.equal(postDatedRegister(company, { asOn: '2026-05-31', party: 'office' }).count, 1);
  assert.equal(postDatedRegister(company, { asOn: '2026-05-31', party: 'customer' }).count, 0);
});

test('cheque details need a supported voucher, number, date and bank line', () => {
  const { company, bank, cash, expense } = chequeFixture();
  const instrument = (overrides = {}) => ({
    kind: 'Cheque',
    number: '9001',
    date: '2026-05-12',
    bankLedgerId: bank.id,
    ...overrides,
  });

  const sales = addVoucher(company, {
    type: 'Sales',
    date: '2026-05-10',
    instrument: instrument(),
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 100 },
      { ledgerId: findLedgerByName(company, 'Sales').id, side: 'Cr', amount: 100 },
    ],
  });
  assert.equal(sales.ok, false);
  assert.match(sales.error, /only available on payment, receipt and contra/i);

  const blankNumber = payment(company, bank, expense, 100, '2026-05-10', instrument({ number: ' ' }));
  assert.equal(blankNumber.ok, false);
  assert.match(blankNumber.error, /number/i);

  const badDate = payment(company, bank, expense, 100, '2026-05-10', instrument({ date: '15/06/2026' }));
  assert.equal(badDate.ok, false);
  assert.match(badDate.error, /date/i);

  const wrongBank = payment(company, bank, expense, 100, '2026-05-10', instrument({ bankLedgerId: cash.id }));
  assert.equal(wrongBank.ok, false);
  assert.match(wrongBank.error, /bank ledgers on this voucher/i);

  const noBankLine = addVoucher(company, {
    type: 'Payment',
    date: '2026-05-10',
    instrument: instrument(),
    lines: [
      { ledgerId: expense.id, side: 'Dr', amount: 100 },
      { ledgerId: cash.id, side: 'Cr', amount: 100 },
    ],
  });
  assert.equal(noBankLine.ok, false);
  assert.match(noBankLine.error, /bank ledger line/i);
});

test('post-dated register status follows the as-on date and reconciliation', () => {
  const { company, bank, expense } = chequeFixture();
  const created = payment(company, bank, expense, 500, '2026-05-10', {
    kind: 'Cheque',
    number: '7001',
    date: '2026-05-25',
    bankLedgerId: bank.id,
  });
  assert.equal(created.ok, true, created.error);

  assert.equal(postDatedRegister(company, { asOn: '2026-05-20' }).rows[0].status, 'Post-dated');
  assert.equal(postDatedRegister(company, { asOn: '2026-05-25' }).rows[0].status, 'Due');
  assert.equal(postDatedRegister(company, { asOn: '2026-05-30', status: 'Post-dated' }).count, 0);

  saveBankStatement(company, bank.id, [{ date: '2026-05-25', description: 'Cheque 7001', amount: -500 }]);
  const lineId = company.bankReconciliations[bank.id].statement.lines[0].id;
  assert.equal(setBankMatch(company, bank.id, lineId, created.voucher.id).ok, true);

  const report = postDatedRegister(company, { asOn: '2026-05-20' });
  assert.equal(report.rows[0].status, 'Cleared');
  assert.equal(report.clearedCount, 1);
  assert.equal(report.postDatedCount, 0);
  assert.equal(postDatedRegister(company, { asOn: '2026-05-20', status: 'Due' }).count, 0);
});

test('instruments can be marked cleared, stopped or cancelled manually', () => {
  const { company, bank, expense } = chequeFixture();
  const instrument = {
    kind: 'Cheque',
    number: '8100',
    date: '2026-05-25',
    bankLedgerId: bank.id,
  };
  const created = payment(company, bank, expense, 900, '2026-05-10', instrument);
  assert.equal(created.ok, true, created.error);

  const stopped = setInstrumentStatus(company, created.voucher.id, 'Stopped');
  assert.equal(stopped.ok, true, stopped.error);
  assert.equal(created.voucher.instrument.status, 'Stopped');
  let report = postDatedRegister(company, { asOn: '2026-05-20' });
  assert.equal(report.rows[0].status, 'Stopped');
  assert.equal(report.rows[0].manualStatus, 'Stopped');
  assert.equal(report.stoppedCount, 1);
  assert.equal(report.postDatedCount, 0);
  assert.equal(postDatedRegister(company, { asOn: '2026-05-20', status: 'Stopped' }).count, 1);

  const edited = updateVoucher(company, created.voucher.id, {
    type: 'Payment',
    date: '2026-05-10',
    instrument,
    lines: [
      { ledgerId: expense.id, side: 'Dr', amount: 900 },
      { ledgerId: bank.id, side: 'Cr', amount: 900 },
    ],
  });
  assert.equal(edited.ok, true, edited.error);
  assert.equal(edited.voucher.instrument.status, 'Stopped', 'editing the voucher keeps a manual status');

  assert.equal(setInstrumentStatus(company, created.voucher.id, 'Cancelled').ok, true);
  report = postDatedRegister(company, { asOn: '2026-05-20' });
  assert.equal(report.rows[0].status, 'Cancelled');
  assert.equal(report.cancelledCount, 1);

  assert.equal(setInstrumentStatus(company, created.voucher.id, '').ok, true);
  report = postDatedRegister(company, { asOn: '2026-05-20' });
  assert.equal(report.rows[0].status, 'Post-dated');
  assert.equal(report.rows[0].manualStatus, '');

  assert.equal(setInstrumentStatus(company, created.voucher.id, 'Cleared').ok, true);
  assert.equal(postDatedRegister(company, { asOn: '2026-05-20' }).rows[0].status, 'Cleared');
  assert.equal(setInstrumentStatus(company, created.voucher.id, 'Bounced').ok, false);
  assert.equal(setInstrumentStatus(company, 'missing', 'Stopped').ok, false);
});

test('manual instrument statuses survive a backup round trip', () => {
  const { company, bank, expense } = chequeFixture();
  const created = payment(company, bank, expense, 300, '2026-05-10', {
    kind: 'DD',
    number: 'DD-88',
    date: '2026-05-30',
    bankLedgerId: bank.id,
  });
  assert.equal(setInstrumentStatus(company, created.voucher.id, 'Cancelled').ok, true);

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.companies[0].vouchers[0].instrument.status, 'Cancelled');
});

test('clearing instrument details removes them on alteration', () => {
  const { company, bank, expense } = chequeFixture();
  const created = payment(company, bank, expense, 250, '2026-05-10', {
    kind: 'DD',
    number: 'DD-44',
    date: '2026-05-20',
    bankLedgerId: bank.id,
  });
  assert.equal(created.ok, true, created.error);

  const altered = updateVoucher(company, created.voucher.id, {
    type: 'Payment',
    date: '2026-05-10',
    instrument: { kind: '', number: '', date: '', bankLedgerId: '' },
    lines: [
      { ledgerId: expense.id, side: 'Dr', amount: 250 },
      { ledgerId: bank.id, side: 'Cr', amount: 250 },
    ],
  });
  assert.equal(altered.ok, true, altered.error);
  assert.equal(altered.voucher.instrument, undefined);
  assert.equal(postDatedRegister(company, { asOn: '2026-05-20' }).count, 0);
});

test('backup validates cheque details and keeps valid ones', () => {
  const { company, bank, expense } = chequeFixture();
  const created = payment(company, bank, expense, 800, '2026-05-10', {
    kind: 'Cheque',
    number: 'A-1',
    date: '2026-05-18',
    bankLedgerId: bank.id,
  });
  assert.equal(created.ok, true, created.error);

  const exported = exportState({ version: 1, activeCompanyId: company.id, companies: [company] });
  const restored = importState(exported);
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.companies[0].vouchers[0].instrument.number, 'A-1');

  company.vouchers[0].instrument.bankLedgerId = 'missing-bank';
  const broken = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(broken.ok, false);
  assert.match(broken.error, /cheque\/DD details for a bank not on the voucher/i);
});

test('normalization drops malformed legacy cheque details only', () => {
  const { company, bank, expense } = chequeFixture();
  payment(company, bank, expense, 100, '2026-05-10', {
    kind: 'Cheque',
    number: 'N-1',
    date: '2026-05-10',
    bankLedgerId: bank.id,
  });
  payment(company, bank, expense, 200, '2026-05-10', null);
  company.vouchers[0].instrument.kind = 'Card';
  normalizeInstruments(company);
  assert.equal(company.vouchers[0].instrument, undefined);
  assert.equal(company.vouchers[0].total, 100);
  assert.equal(company.vouchers.length, 2);
});

test('amount in words uses Indian numbering and paise', () => {
  assert.equal(amountInWords(0), 'Zero Rupees Only');
  assert.equal(amountInWords(1), 'One Rupee Only');
  assert.equal(amountInWords(1234.5), 'One Thousand Two Hundred Thirty-Four Rupees and Fifty Paise Only');
  assert.equal(amountInWords(100000), 'One Lakh Rupees Only');
  assert.equal(amountInWords(10000000), 'One Crore Rupees Only');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLedger,
  addVoucher,
  autoMatchBank,
  clearBankStatement,
  createCompany,
  deleteVoucher,
  exportState,
  findLedgerByName,
  importState,
  saveBankStatement,
  setBankMatch,
  unsetBankMatch,
  updateVoucher,
} from '../src/store.js';
import { bankReconciliation } from '../src/accounting.js';

function bankFixture() {
  const company = createCompany('Bank Co', '2026-04-01').company;
  const bank = findLedgerByName(company, 'Bank');
  const capital = findLedgerByName(company, 'Capital');
  const rent = addLedger(company, {
    name: 'Rent',
    groupId: company.groups.find((group) => group.key === 'indirectExpenses').id,
    opening: 0,
  }).ledger;
  return { company, bank, capital, rent };
}

function receipt(company, bank, capital, amount, date, narration = '') {
  const result = addVoucher(company, {
    type: 'Receipt',
    date,
    narration,
    lines: [
      { ledgerId: bank.id, side: 'Dr', amount },
      { ledgerId: capital.id, side: 'Cr', amount },
    ],
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

function payment(company, bank, rent, amount, date, narration = '') {
  const result = addVoucher(company, {
    type: 'Payment',
    date,
    narration,
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount },
      { ledgerId: bank.id, side: 'Cr', amount },
    ],
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

test('auto-match pairs signed amounts within a week one-to-one', () => {
  const { company, bank, capital, rent } = bankFixture();
  const firstReceipt = receipt(company, bank, capital, 1000, '2026-04-10', 'Customer receipt');
  const secondReceipt = receipt(company, bank, capital, 1000, '2026-04-20', 'Second receipt');
  const paid = payment(company, bank, rent, 250, '2026-04-12', 'Rent');

  const saved = saveBankStatement(company, bank.id, [
    { date: '2026-04-11', description: 'Deposit', amount: 1000 },
    { date: '2026-04-19', description: 'Deposit', amount: 1000 },
    { date: '2026-04-13', description: 'Rent cheque', amount: -250 },
    { date: '2026-04-14', description: 'Bank charge', amount: -10 },
  ]);
  assert.equal(saved.ok, true, saved.error);

  const matched = autoMatchBank(company, bank.id);
  assert.equal(matched.ok, true, matched.error);
  assert.equal(matched.count, 3);

  const report = bankReconciliation(company, bank.id);
  assert.equal(report.lines.length, 4);
  assert.equal(report.matchedCount, 3);
  assert.equal(report.unmatchedCount, 1);
  assert.equal(report.unmatchedEntries.length, 0);
  assert.equal(report.matchedPercent, 75);

  const matches = company.bankReconciliations[bank.id].matches;
  assert.equal(matches[report.lines[0].id], firstReceipt.id);
  assert.equal(matches[report.lines[1].id], secondReceipt.id);
  assert.equal(matches[report.lines[2].id], paid.id);
});

test('a manual match requires the exact signed bank amount and is exclusive', () => {
  const { company, bank, capital } = bankFixture();
  const received = receipt(company, bank, capital, 700, '2026-04-10');
  saveBankStatement(company, bank.id, [
    { date: '2026-04-11', description: 'Receipt', amount: 700 },
    { date: '2026-04-12', description: 'Different amount', amount: 800 },
    { date: '2026-04-13', description: 'Duplicate receipt', amount: 700 },
  ]);
  const lines = company.bankReconciliations[bank.id].statement.lines;

  const mismatched = setBankMatch(company, bank.id, lines[1].id, received.id);
  assert.equal(mismatched.ok, false);
  assert.match(mismatched.error, /matching bank amount/i);

  const matched = setBankMatch(company, bank.id, lines[0].id, received.id);
  assert.equal(matched.ok, true, matched.error);

  const duplicate = setBankMatch(company, bank.id, lines[2].id, received.id);
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /already matched/i);

  const removed = unsetBankMatch(company, bank.id, lines[0].id);
  assert.equal(removed.ok, true, removed.error);
  assert.equal(Object.keys(company.bankReconciliations[bank.id].matches).length, 0);
});

test('statement import replaces earlier lines and clear keeps vouchers', () => {
  const { company, bank, capital } = bankFixture();
  receipt(company, bank, capital, 300, '2026-04-10');
  saveBankStatement(company, bank.id, [{ date: '2026-04-10', amount: 300 }]);
  saveBankStatement(company, bank.id, [{ date: '2026-04-11', amount: 300, description: 'New' }]);
  assert.equal(company.bankReconciliations[bank.id].statement.lines.length, 1);
  assert.equal(company.bankReconciliations[bank.id].statement.lines[0].description, 'New');

  const cleared = clearBankStatement(company, bank.id);
  assert.equal(cleared.ok, true, cleared.error);
  assert.equal(company.bankReconciliations[bank.id], undefined);
  assert.equal(company.vouchers.length, 1);
});

test('only bank ledgers accept statements and malformed lines are rejected', () => {
  const { company, bank, rent } = bankFixture();
  const notBank = saveBankStatement(company, rent.id, [{ date: '2026-04-10', amount: 100 }]);
  assert.equal(notBank.ok, false);

  const badDate = saveBankStatement(company, bank.id, [{ date: '10/04/2026', amount: 100 }]);
  assert.equal(badDate.ok, false);

  const zero = saveBankStatement(company, bank.id, [{ date: '2026-04-10', amount: 0 }]);
  assert.equal(zero.ok, false);

  const empty = saveBankStatement(company, bank.id, []);
  assert.equal(empty.ok, false);
});

test('editing or deleting a matched voucher drops the stale match', () => {
  const { company, bank, capital } = bankFixture();
  const received = receipt(company, bank, capital, 400, '2026-04-10');
  saveBankStatement(company, bank.id, [{ date: '2026-04-10', amount: 400 }]);
  const lineId = company.bankReconciliations[bank.id].statement.lines[0].id;
  assert.equal(setBankMatch(company, bank.id, lineId, received.id).ok, true);

  const changed = updateVoucher(company, received.id, {
    type: 'Receipt',
    date: '2026-04-10',
    lines: [
      { ledgerId: bank.id, side: 'Dr', amount: 450 },
      { ledgerId: capital.id, side: 'Cr', amount: 450 },
    ],
  });
  assert.equal(changed.ok, true, changed.error);
  assert.equal(company.bankReconciliations[bank.id].matches[lineId], undefined);

  assert.equal(setBankMatch(company, bank.id, lineId, received.id).ok, false);
  assert.equal(deleteVoucher(company, received.id), true);
  assert.equal(company.bankReconciliations[bank.id].matches[lineId], undefined);
});

test('deleting a bank ledger removes its reconciliation data', async () => {
  const { deleteLedger } = await import('../src/store.js');
  const { company } = bankFixture();
  const spare = addLedger(company, {
    name: 'Spare Bank',
    groupId: company.groups.find((group) => group.key === 'bank').id,
    opening: 0,
  }).ledger;
  saveBankStatement(company, spare.id, [{ date: '2026-04-10', amount: 100 }]);
  const removed = deleteLedger(company, spare.id);
  assert.equal(removed.ok, true, removed.error);
  assert.equal(company.bankReconciliations[spare.id], undefined);
});

test('bank statements and matches survive a backup round trip', () => {
  const { company, bank, capital } = bankFixture();
  const received = receipt(company, bank, capital, 900, '2026-04-10');
  saveBankStatement(company, bank.id, [{ date: '2026-04-10', description: 'Deposit', amount: 900 }]);
  const lineId = company.bankReconciliations[bank.id].statement.lines[0].id;
  setBankMatch(company, bank.id, lineId, received.id);

  const restored = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  const config = copy.bankReconciliations[bank.id];
  assert.equal(config.statement.lines[0].description, 'Deposit');
  assert.equal(config.matches[lineId], received.id);
  assert.equal(bankReconciliation(copy, bank.id).matchedCount, 1);
});

test('a backup with a match to a missing voucher is rejected', () => {
  const { company, bank, capital } = bankFixture();
  receipt(company, bank, capital, 100, '2026-04-10');
  saveBankStatement(company, bank.id, [{ date: '2026-04-10', amount: 100 }]);
  const lineId = company.bankReconciliations[bank.id].statement.lines[0].id;
  company.bankReconciliations[bank.id].matches[lineId] = 'missing-voucher';
  const restored = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(restored.ok, false);
  assert.match(restored.error, /bank reconciliation match is invalid/i);
});

test('bank reconciliation reports book balance and unmatched values', () => {
  const { company, bank, capital, rent } = bankFixture();
  receipt(company, bank, capital, 1000, '2026-04-10');
  payment(company, bank, rent, 200, '2026-04-12');
  saveBankStatement(company, bank.id, [
    { date: '2026-04-10', description: 'Deposit', amount: 1000 },
    { date: '2026-04-20', description: 'Not in books', amount: -50 },
  ]);
  autoMatchBank(company, bank.id);

  const report = bankReconciliation(company, bank.id);
  assert.equal(report.bookBalance, 800);
  assert.equal(report.inflow, 1000);
  assert.equal(report.outflow, -50);
  assert.equal(report.unmatchedStatementAmount, 50);
  assert.equal(report.unmatchedBookAmount, 200);
  assert.equal(report.unmatchedEntries.length, 1);
  assert.equal(report.unmatchedEntries[0].amount, -200);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addChequeBook,
  addLedger,
  addVoucher,
  autoMatchBank,
  clearBankStatement,
  createCompany,
  deleteChequeBook,
  deleteVoucher,
  emptyState,
  exportState,
  findLedgerByName,
  importState,
  nextChequeNumber,
  advanceChequeBook,
  updateChequeBook,
  postBankAdjustment,
  saveBankStatement,
  setBankGroupMatch,
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

test('statement opening and closing balances expose completeness gaps', () => {
  const { company, bank } = bankFixture();
  const lines = [
    { date: '2026-04-10', description: 'Deposit', amount: 300 },
    { date: '2026-04-11', description: 'Charge', amount: -50 },
  ];
  const saved = saveBankStatement(company, bank.id, lines, {
    openingBalance: 1000,
    closingBalance: 1250,
  });
  assert.equal(saved.ok, true, saved.error);
  let report = bankReconciliation(company, bank.id);
  assert.deepEqual(report.balances, { opening: 1000, closing: 1250 });
  assert.equal(report.statementNet, 250);
  assert.equal(report.statementDifference, 0);

  saveBankStatement(company, bank.id, lines, { openingBalance: 1000, closingBalance: 1200 });
  report = bankReconciliation(company, bank.id);
  assert.equal(report.statementDifference, -50);

  assert.equal(
    saveBankStatement(company, bank.id, lines, { openingBalance: 1000 }).ok,
    false,
    'both balances are needed for validation',
  );
  assert.equal(
    saveBankStatement(company, bank.id, lines, { openingBalance: 'not-a-number', closingBalance: 0 }).ok,
    false,
  );

  saveBankStatement(company, bank.id, lines);
  assert.equal(bankReconciliation(company, bank.id).balances, null);

  saveBankStatement(company, bank.id, lines, { openingBalance: 1000, closingBalance: 1250 });
  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  assert.deepEqual(
    restored.state.companies[0].bankReconciliations[bank.id].statement.balances,
    { opening: 1000, closing: 1250 },
  );
});

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

test('auto-match honours narration overlap, date window and amount tolerance', () => {
  const { company, bank, capital, rent } = bankFixture();
  const first = receipt(company, bank, capital, 1000, '2026-04-10', 'Acme customer settlement');
  const second = receipt(company, bank, capital, 1000, '2026-04-11', 'Other deposit');
  const small = payment(company, bank, rent, 250, '2026-04-12', 'Rent for April');

  saveBankStatement(company, bank.id, [
    { date: '2026-04-10', description: 'Acme customer settlement', amount: 1000 },
    { date: '2026-04-11', description: 'Unrelated credit', amount: 1000 },
    { date: '2026-04-20', description: 'Rent April cheque', amount: -249.5 },
  ]);

  const withoutWidth = autoMatchBank(company, bank.id, { dateWindow: 2, tolerance: 1 });
  assert.equal(withoutWidth.ok, true, withoutWidth.error);
  assert.equal(withoutWidth.count, 2);
  const firstLine = bankReconciliation(company, bank.id).lines.find((line) => line.description === 'Acme customer settlement');
  const secondLine = bankReconciliation(company, bank.id).lines.find((line) => line.description === 'Unrelated credit');
  assert.equal(company.bankReconciliations[bank.id].matches[firstLine.id], first.id);
  assert.equal(company.bankReconciliations[bank.id].matches[secondLine.id], second.id);

  const wider = autoMatchBank(company, bank.id, { dateWindow: 10, tolerance: 1 });
  assert.equal(wider.ok, true, wider.error);
  assert.equal(wider.count, 1);
  const rentLine = bankReconciliation(company, bank.id).lines.find((line) => line.description === 'Rent April cheque');
  assert.equal(company.bankReconciliations[bank.id].matches[rentLine.id], small.id);
});

test('manual group matching requires same-direction vouchers and an exact total', () => {
  const { company, bank, capital, rent } = bankFixture();
  const first = receipt(company, bank, capital, 1000, '2026-04-10', 'Deposit one');
  const second = receipt(company, bank, capital, 500, '2026-04-11', 'Deposit two');
  const third = receipt(company, bank, capital, 200, '2026-04-12', 'Deposit three');
  const paid = payment(company, bank, rent, 300, '2026-04-13', 'Rent');
  saveBankStatement(company, bank.id, [
    { date: '2026-04-10', description: 'Combined deposit', amount: 1500 },
    { date: '2026-04-11', description: 'Third deposit', amount: 200 },
    { date: '2026-04-13', description: 'Rent cheque', amount: -300 },
  ]);
  const lines = company.bankReconciliations[bank.id].statement.lines;

  const short = setBankGroupMatch(company, bank.id, lines[0].id, [first.id, third.id]);
  assert.equal(short.ok, false);
  assert.match(short.error, /total/i);

  const duplicate = setBankGroupMatch(company, bank.id, lines[0].id, [first.id, first.id]);
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /at least two/i);

  const mixed = setBankGroupMatch(company, bank.id, lines[0].id, [first.id, paid.id]);
  assert.equal(mixed.ok, false);
  assert.match(mixed.error, /same direction/i);

  const matched = setBankGroupMatch(company, bank.id, lines[0].id, [first.id, second.id]);
  assert.equal(matched.ok, true, matched.error);
  assert.equal(matched.total, 1500);
  assert.deepEqual(company.bankReconciliations[bank.id].matches[lines[0].id], [first.id, second.id]);

  const report = bankReconciliation(company, bank.id);
  const groupLine = report.lines.find((line) => line.id === lines[0].id);
  assert.deepEqual(groupLine.matchedVoucherIds, [first.id, second.id]);
  assert.equal(groupLine.matchedEntries.length, 2);
  assert.equal(groupLine.matchedDifference, 0);
  assert.equal(report.groupedCount, 1);
  assert.equal(report.groupedVoucherCount, 1);
  assert.equal(report.matchedCount, 1);
  assert.equal(report.unmatchedEntries.length, 2);

  assert.equal(setBankMatch(company, bank.id, lines[1].id, first.id).ok, false);
  assert.equal(unsetBankMatch(company, bank.id, lines[0].id).ok, true);
  assert.equal(company.bankReconciliations[bank.id].matches[lines[0].id], undefined);
});

test('auto-match groups up to three vouchers when no single amount fits', () => {
  const { company, bank, capital } = bankFixture();
  const first = receipt(company, bank, capital, 1000, '2026-04-10', 'Acme invoice one');
  const second = receipt(company, bank, capital, 500, '2026-04-11', 'Acme invoice two');
  saveBankStatement(company, bank.id, [
    { date: '2026-04-10', description: 'Acme settlement', amount: 1500 },
  ]);
  const lineId = company.bankReconciliations[bank.id].statement.lines[0].id;

  const matched = autoMatchBank(company, bank.id);
  assert.equal(matched.ok, true, matched.error);
  assert.equal(matched.count, 1);
  assert.equal(matched.grouped, 1);
  assert.deepEqual(company.bankReconciliations[bank.id].matches[lineId], [first.id, second.id]);

  const report = bankReconciliation(company, bank.id);
  assert.equal(report.matchedCount, 1);
  assert.equal(report.groupedCount, 1);
  assert.equal(report.lines[0].matchedEntries.length, 2);
  assert.equal(report.unmatchedEntries.length, 0);
});

test('group matches survive backup restore and are removed when a voucher changes', () => {
  const { company, bank, capital } = bankFixture();
  const first = receipt(company, bank, capital, 1000, '2026-04-10');
  const second = receipt(company, bank, capital, 500, '2026-04-11');
  saveBankStatement(company, bank.id, [{ date: '2026-04-10', amount: 1500 }]);
  const lineId = company.bankReconciliations[bank.id].statement.lines[0].id;
  assert.equal(setBankGroupMatch(company, bank.id, lineId, [first.id, second.id]).ok, true);

  const restored = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  assert.deepEqual(copy.bankReconciliations[bank.id].matches[lineId], [first.id, second.id]);
  assert.equal(bankReconciliation(copy, bank.id).groupedCount, 1);

  const changed = updateVoucher(copy, first.id, {
    type: 'Receipt',
    date: '2026-04-10',
    lines: [
      { ledgerId: bank.id, side: 'Dr', amount: 1100 },
      { ledgerId: capital.id, side: 'Cr', amount: 1100 },
    ],
  });
  assert.equal(changed.ok, true, changed.error);
  assert.equal(copy.bankReconciliations[bank.id].matches[lineId], undefined);
});

test('a backup with an invalid group match is rejected', () => {
  const { company, bank, capital } = bankFixture();
  const first = receipt(company, bank, capital, 1000, '2026-04-10');
  const second = receipt(company, bank, capital, 500, '2026-04-11');
  saveBankStatement(company, bank.id, [{ date: '2026-04-10', amount: 1500 }]);
  const lineId = company.bankReconciliations[bank.id].statement.lines[0].id;
  setBankGroupMatch(company, bank.id, lineId, [first.id, second.id]);
  company.bankReconciliations[bank.id].matches[lineId] = [first.id, 'missing-voucher'];
  const restored = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(restored.ok, false);
  assert.match(restored.error, /bank reconciliation match is invalid/i);
});

test('unmatched statement lines can be posted as bank adjustments', () => {
  const { company, bank, rent } = bankFixture();
  saveBankStatement(company, bank.id, [
    { date: '2026-04-14', description: 'Bank charge', amount: -50 },
    { date: '2026-04-15', description: 'Interest credit', amount: 25 },
  ]);
  const lines = company.bankReconciliations[bank.id].statement.lines;
  const before = company.vouchers.length;
  const posted = postBankAdjustment(company, bank.id, lines[0].id, rent.id);
  assert.equal(posted.ok, true, posted.error);
  assert.equal(posted.voucher.type, 'Journal');
  assert.equal(company.vouchers.length, before + 1);
  const bankLine = posted.voucher.lines.find((line) => line.ledgerId === bank.id);
  const rentLine = posted.voucher.lines.find((line) => line.ledgerId === rent.id);
  assert.deepEqual({ side: bankLine.side, amount: bankLine.amount }, { side: 'Cr', amount: 50 });
  assert.deepEqual({ side: rentLine.side, amount: rentLine.amount }, { side: 'Dr', amount: 50 });
  assert.equal(company.bankReconciliations[bank.id].matches[lines[0].id], posted.voucher.id);
  assert.equal(bankReconciliation(company, bank.id).matchedCount, 1);
  assert.equal(postBankAdjustment(company, bank.id, lines[0].id, rent.id).ok, false);
  assert.equal(postBankAdjustment(company, bank.id, lines[1].id, bank.id).ok, false);
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

test('cheque books track ranges, next numbers and recorded instruments', () => {
  const { company, bank, rent } = bankFixture();
  const created = addChequeBook(company, {
    name: 'Current account 2026',
    bankLedgerId: bank.id,
    prefix: '00',
    startNo: 1001,
    endNo: 1050,
    nextNo: 1001,
  });
  assert.equal(created.ok, true, created.error);
  assert.equal(nextChequeNumber(company, created.book.id).number, '001001');
  const overlap = addChequeBook(company, {
    name: 'Overlapping book',
    bankLedgerId: bank.id,
    prefix: '00',
    startNo: 1050,
    endNo: 1100,
  });
  assert.equal(overlap.ok, false);
  assert.match(overlap.error, /overlaps/i);

  const issued = addVoucher(company, {
    type: 'Payment',
    date: '2026-05-10',
    instrument: {
      kind: 'Cheque',
      number: '001001',
      date: '2026-05-12',
      bankLedgerId: bank.id,
    },
    lines: [
      { ledgerId: rent.id, side: 'Dr', amount: 100 },
      { ledgerId: bank.id, side: 'Cr', amount: 100 },
    ],
  });
  assert.equal(issued.ok, true, issued.error);
  assert.equal(deleteChequeBook(company, created.book.id).ok, false);
  assert.equal(advanceChequeBook(company, created.book.id).number, '001002');
  assert.equal(
    updateChequeBook(company, created.book.id, { name: 'Renamed book', nextNo: 1003 }).ok,
    true,
  );
  assert.equal(nextChequeNumber(company, created.book.id).number, '001003');
});

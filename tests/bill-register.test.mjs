import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLedger,
  addVoucher,
  createCompany,
  findLedgerByName,
} from '../src/store.js';
import { billWiseRegister, outstanding, partyStatement } from '../src/accounting.js';

function groupKeyFor(company, key) {
  return company.groups.find((group) => group.key === key).id;
}

function ledger(company, name, groupKey) {
  const result = addLedger(company, { name, groupId: groupKeyFor(company, groupKey), opening: 0 });
  assert.equal(result.ok, true, result.error);
  return result.ledger;
}

function sale(company, customer, sales, amount, date, bill = null) {
  const result = addVoucher(company, {
    type: 'Sales',
    date,
    bill,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount },
      { ledgerId: sales.id, side: 'Cr', amount },
    ],
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

function receipt(company, cash, customer, amount, date, allocations = []) {
  const result = addVoucher(company, {
    type: 'Receipt',
    date,
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount },
      { ledgerId: customer.id, side: 'Cr', amount, allocations },
    ],
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

function fixture() {
  const company = createCompany('Bill Register Co', '2026-04-01').company;
  const customer = ledger(company, 'Acme Customer', 'sundryDebtors');
  const supplier = ledger(company, 'Parts Supplier', 'sundryCreditors');
  const sales = findLedgerByName(company, 'Sales');
  const purchases = findLedgerByName(company, 'Purchases');
  const cash = findLedgerByName(company, 'Cash');
  return { company, customer, supplier, sales, purchases, cash };
}

test('bill-wise register keeps original, settled and outstanding amounts', () => {
  const { company, customer, sales, cash } = fixture();
  const first = sale(company, customer, sales, 1000, '2026-04-05', {
    ref: 'INV-001',
    dueDate: '2026-05-05',
  });
  sale(company, customer, sales, 500, '2026-04-20', { ref: 'INV-002', dueDate: '2026-05-20' });
  receipt(company, cash, customer, 400, '2026-04-25', [{ voucherId: first.id, amount: 400 }]);

  const report = billWiseRegister(company, {
    side: 'receivable',
    from: '2026-04-01',
    to: '2026-04-30',
  });

  assert.equal(report.count, 2);
  assert.equal(report.totalOriginal, 1500);
  assert.equal(report.totalSettled, 400);
  assert.equal(report.totalOutstanding, 1100);
  const one = report.rows.find((row) => row.ref === 'INV-001');
  assert.equal(one.party, 'Acme Customer');
  assert.equal(one.original, 1000);
  assert.equal(one.settled, 400);
  assert.equal(one.amount, 600);
  assert.equal(one.status, 'Part-paid');
  assert.equal(one.overdue, false);
  const two = report.rows.find((row) => row.ref === 'INV-002');
  assert.equal(two.status, 'Open');
  assert.equal(two.settled, 0);
  assert.equal(two.amount, 500);
});

test('bill status can be reviewed as on a date later than the bill period', () => {
  const { company, customer, sales, cash } = fixture();
  const bill = sale(company, customer, sales, 1000, '2026-04-05', {
    ref: 'INV-LATE',
    dueDate: '2026-05-05',
  });
  receipt(company, cash, customer, 1000, '2026-05-20', [{ voucherId: bill.id, amount: 1000 }]);

  const atBillPeriodEnd = billWiseRegister(company, {
    side: 'receivable',
    from: '2026-04-01',
    to: '2026-04-30',
    asOn: '2026-04-30',
  });
  assert.equal(atBillPeriodEnd.asOn, '2026-04-30');
  assert.equal(atBillPeriodEnd.rows[0].status, 'Open');
  assert.equal(atBillPeriodEnd.totalOutstanding, 1000);

  const afterReceipt = billWiseRegister(company, {
    side: 'receivable',
    from: '2026-04-01',
    to: '2026-04-30',
    asOn: '2026-05-31',
  });
  assert.equal(afterReceipt.asOn, '2026-05-31');
  assert.equal(afterReceipt.rows[0].status, 'Settled');
  assert.equal(afterReceipt.totalSettled, 1000);
  assert.equal(afterReceipt.totalOutstanding, 0);

  const fallback = billWiseRegister(company, {
    side: 'receivable',
    from: '2026-04-01',
    to: '2026-04-30',
    asOn: 'not-a-date',
  });
  assert.equal(fallback.asOn, '2026-04-30', 'an invalid as-on date falls back to the period end');
});

test('bill-wise register attributes unallocated receipts to the oldest bill first', () => {
  const { company, customer, sales, cash } = fixture();
  sale(company, customer, sales, 1000, '2026-04-05', { ref: 'INV-001' });
  sale(company, customer, sales, 500, '2026-04-20', { ref: 'INV-002' });
  receipt(company, cash, customer, 1200, '2026-04-25');

  const report = billWiseRegister(company, {
    side: 'receivable',
    from: '2026-04-01',
    to: '2026-04-30',
  });

  assert.equal(report.totalSettled, 1200);
  assert.equal(report.totalOutstanding, 300);
  const one = report.rows.find((row) => row.ref === 'INV-001');
  assert.equal(one.status, 'Settled');
  assert.equal(one.settled, 1000);
  assert.equal(one.amount, 0);
  const two = report.rows.find((row) => row.ref === 'INV-002');
  assert.equal(two.status, 'Part-paid');
  assert.equal(two.settled, 200);
  assert.equal(two.amount, 300);
  assert.equal(outstanding(company, { asOn: '2026-04-30' }).total, 300);
});

test('bill-wise register filters by period, side and status', () => {
  const { company, customer, supplier, sales, purchases, cash } = fixture();
  const april = sale(company, customer, sales, 700, '2026-04-10', {
    ref: 'APR-001',
    dueDate: '2026-04-10',
  });
  sale(company, customer, sales, 300, '2026-05-10', { ref: 'MAY-001' });
  const purchase = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-12',
    bill: { ref: 'BILL-009', dueDate: '2026-05-12' },
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 450 },
      { ledgerId: supplier.id, side: 'Cr', amount: 450 },
    ],
  });
  assert.equal(purchase.ok, true, purchase.error);
  receipt(company, cash, customer, 700, '2026-04-20', [{ voucherId: april.id, amount: 700 }]);

  const aprilOnly = billWiseRegister(company, {
    side: 'receivable',
    from: '2026-04-01',
    to: '2026-04-30',
    status: 'All',
  });
  assert.deepEqual(aprilOnly.rows.map((row) => row.ref), ['APR-001']);
  assert.equal(aprilOnly.rows[0].status, 'Settled');
  assert.equal(aprilOnly.rows[0].overdue, false);

  const overdue = billWiseRegister(company, {
    side: 'receivable',
    from: '2026-04-01',
    to: '2026-04-30',
    status: 'Overdue',
  });
  assert.equal(overdue.count, 0, 'a settled bill is no longer overdue');

  const payables = billWiseRegister(company, {
    side: 'payable',
    from: '2026-04-01',
    to: '2026-04-30',
    status: 'Open',
  });
  assert.equal(payables.count, 1);
  assert.equal(payables.rows[0].ref, 'BILL-009');
  assert.equal(payables.totalOutstanding, 450);
});

test('party statement adds bill references and allocation detail to the ledger', () => {
  const { company, customer, sales, cash } = fixture();
  const first = sale(company, customer, sales, 1000, '2026-04-05', {
    ref: 'INV-001',
    dueDate: '2026-05-05',
  });
  sale(company, customer, sales, 500, '2026-04-20', { ref: 'INV-002' });
  receipt(company, cash, customer, 400, '2026-04-25', [{ voucherId: first.id, amount: 400 }]);

  const statement = partyStatement(company, customer.id, {
    from: '2026-04-01',
    to: '2026-04-30',
  });

  assert.equal(statement.side, 'receivable');
  assert.equal(statement.opening, 0);
  assert.equal(statement.closing, 1100);
  assert.equal(statement.debitTotal, 1500);
  assert.equal(statement.creditTotal, 400);
  assert.equal(statement.rows.length, 3);
  const saleRow = statement.rows.find((row) => row.voucherId === first.id);
  assert.equal(saleRow.billRef, 'INV-001');
  assert.equal(saleRow.billDueDate, '2026-05-05');
  const receiptRow = statement.rows.find((row) => row.type === 'Receipt');
  assert.equal(receiptRow.allocations.length, 1);
  assert.equal(receiptRow.allocations[0].ref, 'INV-001');
  assert.equal(receiptRow.allocations[0].amount, 400);
  assert.equal(statement.bills.length, 2);
  assert.equal(statement.bills.find((bill) => bill.ref === 'INV-001').settled, 400);
  assert.equal(statement.billOutstanding, 1100);
  assert.equal(statement.advances, 0);
});

test('party statement returns null for an unknown ledger', () => {
  const { company } = fixture();
  assert.equal(partyStatement(company, 'missing-ledger', {}), null);
});

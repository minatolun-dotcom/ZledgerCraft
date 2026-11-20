import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLedger,
  addStockItem,
  addVoucher,
  createCompany,
  exportState,
  findLedgerByName,
  importState,
  updateLedger,
  updateVoucher,
} from '../src/store.js';
import { interestWorkingPaper, outstanding, stockSummary } from '../src/accounting.js';

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
  return result;
}

function billsFixture() {
  const company = createCompany('Bills Co', '2026-04-01').company;
  const customer = ledger(company, 'Acme Customer', 'sundryDebtors');
  const otherCustomer = ledger(company, 'Other Customer', 'sundryDebtors');
  const sales = findLedgerByName(company, 'Sales');
  const cash = findLedgerByName(company, 'Cash');
  return { company, customer, otherCustomer, sales, cash };
}

test('a sales bill keeps its reference and due date', () => {
  const { company, customer, sales } = billsFixture();
  sale(company, customer, sales, 1000, '2026-04-05', { ref: 'INV-001', dueDate: '2026-05-05' });

  const report = outstanding(company, { asOn: '2026-06-30' });
  assert.equal(report.total, 1000);
  assert.equal(report.parties.length, 1);
  const bill = report.parties[0].bills[0];
  assert.equal(bill.ref, 'INV-001');
  assert.equal(bill.dueDate, '2026-05-05');
  assert.equal(bill.overdue, true);
  assert.equal(bill.overdueDays, 56);
  assert.equal(bill.bucket, '31-60');
  assert.equal(report.buckets['31-60'], 1000);
});

test('a party credit limit is tracked against open receivables', () => {
  const { company, customer, sales } = billsFixture();
  assert.equal(updateLedger(company, customer.id, { creditLimit: '-1' }).ok, false);
  assert.equal(updateLedger(company, customer.id, { creditLimit: '750' }).ok, true);
  sale(company, customer, sales, 1000, '2026-04-05', { ref: 'INV-LIMIT' });

  const report = outstanding(company, { asOn: '2026-04-30' });
  const party = report.parties[0];
  assert.equal(party.creditLimit, 750);
  assert.equal(party.available, -250);
  assert.equal(party.overLimit, true);

  assert.equal(updateLedger(company, customer.id, { creditLimit: '' }).ok, true);
  assert.equal(outstanding(company, { asOn: '2026-04-30' }).parties[0].creditLimit, 0);
});

test('overdue interest is computed as a simple working paper', () => {
  const { company, customer, sales } = billsFixture();
  assert.equal(updateLedger(company, customer.id, { interestRate: '101' }).ok, false);
  assert.equal(updateLedger(company, customer.id, { interestRate: '12' }).ok, true);
  sale(company, customer, sales, 1000, '2026-04-05', { ref: 'INV-INT', dueDate: '2026-04-15' });

  const report = interestWorkingPaper(company, { asOn: '2026-04-25' });
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].overdueDays, 10);
  assert.equal(report.rows[0].interest, 3.29);
  assert.equal(report.totals.interest, 3.29);
  assert.equal(company.vouchers.length, 1, 'the working paper posts nothing');
});

test('an explicit receipt allocation settles only the chosen bill', () => {
  const { company, customer, sales, cash } = billsFixture();
  const first = sale(company, customer, sales, 1000, '2026-04-05', { ref: 'INV-001' });
  sale(company, customer, sales, 500, '2026-04-20', { ref: 'INV-002' });

  const result = receipt(company, cash, customer, 900, '2026-04-25', [
    { voucherId: first.id, amount: 900 },
  ]);
  assert.equal(result.ok, true, result.error);

  const report = outstanding(company, { asOn: '2026-04-30' });
  assert.equal(report.total, 600);
  const bills = report.parties[0].bills;
  assert.equal(bills.length, 2);
  assert.equal(bills.find((bill) => bill.ref === 'INV-001').amount, 100);
  assert.equal(bills.find((bill) => bill.ref === 'INV-002').amount, 500);
});

test('unallocated money still settles the oldest bill first', () => {
  const { company, customer, sales, cash } = billsFixture();
  sale(company, customer, sales, 1000, '2026-04-05', { ref: 'INV-001' });
  sale(company, customer, sales, 500, '2026-04-20', { ref: 'INV-002' });
  const result = receipt(company, cash, customer, 1200, '2026-04-25');
  assert.equal(result.ok, true, result.error);

  const report = outstanding(company, { asOn: '2026-04-30' });
  assert.equal(report.total, 300);
  assert.deepEqual(
    report.parties[0].bills.map((bill) => [bill.ref, bill.amount]),
    [['INV-002', 300]],
  );
});

test('over-allocating or settling another party bill is rejected', () => {
  const { company, customer, otherCustomer, sales, cash } = billsFixture();
  const first = sale(company, customer, sales, 1000, '2026-04-05', { ref: 'INV-001' });
  const other = sale(company, otherCustomer, sales, 400, '2026-04-06', { ref: 'INV-009' });

  const tooMuch = receipt(company, cash, customer, 1200, '2026-04-25', [
    { voucherId: first.id, amount: 1200 },
  ]);
  assert.equal(tooMuch.ok, false);
  assert.match(tooMuch.error, /only .* left to settle/i);

  const wrongParty = receipt(company, cash, customer, 100, '2026-04-25', [
    { voucherId: other.id, amount: 100 },
  ]);
  assert.equal(wrongParty.ok, false);
  assert.match(wrongParty.error, /different party/i);
});

test('editing a receipt does not count its own old allocation', () => {
  const { company, customer, sales, cash } = billsFixture();
  const first = sale(company, customer, sales, 1000, '2026-04-05', { ref: 'INV-001' });
  const created = receipt(company, cash, customer, 600, '2026-04-25', [
    { voucherId: first.id, amount: 600 },
  ]);
  assert.equal(created.ok, true, created.error);

  const changed = updateVoucher(company, created.voucher.id, {
    type: 'Receipt',
    date: '2026-04-25',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 700 },
      { ledgerId: customer.id, side: 'Cr', amount: 700, allocations: [{ voucherId: first.id, amount: 700 }] },
    ],
  });
  assert.equal(changed.ok, true, changed.error);
  assert.equal(outstanding(company, { asOn: '2026-04-30' }).total, 300);
});

test('bill references survive a backup round trip', () => {
  const { company, customer, sales, cash } = billsFixture();
  const first = sale(company, customer, sales, 1000, '2026-04-05', { ref: 'INV-001', dueDate: '2026-05-05' });
  receipt(company, cash, customer, 250, '2026-04-25', [{ voucherId: first.id, amount: 250 }]);

  const restored = importState(exportState({ version: 1, activeCompanyId: company.id, companies: [company] }));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  assert.equal(copy.vouchers[0].bill.ref, 'INV-001');
  const allocation = copy.vouchers[1].lines.find((line) => line.ledgerId === customer.id).allocations[0];
  assert.equal(allocation.amount, 250);
  assert.equal(outstanding(copy, { asOn: '2026-04-30' }).total, 750);
});

test('a bill due date cannot precede the voucher', () => {
  const { company, customer, sales } = billsFixture();
  const result = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-05',
    bill: { ref: 'INV-001', dueDate: '2026-04-01' },
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 100 },
      { ledgerId: sales.id, side: 'Cr', amount: 100 },
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /due date cannot be before/i);
});

test('selling more stock than is on hand is rejected', () => {
  const company = createCompany('Stock Guard Co', '2026-04-01').company;
  const unit = company.units.find((entry) => entry.symbol === 'Nos');
  const item = addStockItem(company, {
    name: 'Lamp',
    stockGroupId: company.stockGroups[0].id,
    unitId: unit.id,
    openingQty: 2,
    openingRate: 100,
  }).item;
  const cash = findLedgerByName(company, 'Cash');
  const sales = findLedgerByName(company, 'Sales');
  const purchases = findLedgerByName(company, 'Purchases');

  const sell = (qty, date = '2026-04-10') =>
    addVoucher(company, {
      type: 'Sales',
      date,
      lines: [
        { ledgerId: cash.id, side: 'Dr', amount: qty * 100 },
        { ledgerId: sales.id, side: 'Cr', amount: qty * 100 },
      ],
      items: [{ stockItemId: item.id, qty, rate: 100 }],
    });

  const blocked = sell(3);
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /Only 2 Nos .* in stock/i);

  const purchase = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-08',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 500 },
      { ledgerId: cash.id, side: 'Cr', amount: 500 },
    ],
    items: [{ stockItemId: item.id, qty: 5, rate: 100 }],
  });
  assert.equal(purchase.ok, true, purchase.error);

  assert.equal(sell(7).ok, true);
  assert.equal(sell(1).ok, false, 'only one unit is left after selling seven');
  assert.equal(stockSummary(company).rows[0].closingQty, 0);
});

test('a sale can be re-saved without double counting its own stock', () => {
  const company = createCompany('Stock Edit Co', '2026-04-01').company;
  const unit = company.units.find((entry) => entry.symbol === 'Nos');
  const item = addStockItem(company, {
    name: 'Chair',
    stockGroupId: company.stockGroups[0].id,
    unitId: unit.id,
    openingQty: 4,
    openingRate: 50,
  }).item;
  const cash = findLedgerByName(company, 'Cash');
  const sales = findLedgerByName(company, 'Sales');
  const created = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 400 },
      { ledgerId: sales.id, side: 'Cr', amount: 400 },
    ],
    items: [{ stockItemId: item.id, qty: 4, rate: 100 }],
  });
  assert.equal(created.ok, true, created.error);

  const updated = updateVoucher(company, created.voucher.id, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 400 },
      { ledgerId: sales.id, side: 'Cr', amount: 400 },
    ],
    items: [{ stockItemId: item.id, qty: 4, rate: 100 }],
  });
  assert.equal(updated.ok, true, updated.error);
  assert.equal(stockSummary(company).rows[0].closingQty, 0);
});

test('the dashboard summarises receivables and this month sales', async () => {
  const { dashboard } = await import('../src/accounting.js');
  const { defaultFyStart, todayIso } = await import('../src/store.js');
  const company = createCompany('Dashboard Co', defaultFyStart()).company;
  const customer = ledger(company, 'Dash Customer', 'sundryDebtors');
  const sales = findLedgerByName(company, 'Sales');
  sale(company, customer, sales, 700, todayIso());

  const stats = dashboard(company);
  assert.equal(stats.receivables, 700);
  assert.equal(stats.payables, 0);
  assert.equal(stats.salesThisMonth, 700);
  assert.equal(stats.vouchersThisMonth, 1);
  assert.equal(stats.outOfStock, 0);
});

test('a settled bill cannot be deleted or reduced below its allocations', async () => {
  const { deleteVoucher } = await import('../src/store.js');
  const { company, customer, sales, cash } = billsFixture();
  const invoice = sale(company, customer, sales, 1000, '2026-04-05', { ref: 'INV-001' });
  const receiptResult = receipt(company, cash, customer, 400, '2026-04-10', [
    { voucherId: invoice.id, amount: 400 },
  ]);
  assert.equal(receiptResult.ok, true, receiptResult.error);

  assert.equal(deleteVoucher(company, invoice.id), false, 'settled bill is protected');

  const reduced = updateVoucher(company, invoice.id, {
    type: 'Sales',
    date: '2026-04-05',
    bill: { ref: 'INV-001', dueDate: '' },
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 300 },
      { ledgerId: sales.id, side: 'Cr', amount: 300 },
    ],
  });
  assert.equal(reduced.ok, false);
  assert.match(reduced.error, /settled by/i);
});

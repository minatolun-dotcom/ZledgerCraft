import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCurrency,
  addGstRate,
  addLedger,
  addStockItem,
  addVoucher,
  createCompany,
  deleteGstRate,
  updateGstRate,
  emptyState,
  exportState,
  findLedgerByName,
  saveGstTaxLedger,
  gstTaxLedgers,
  importState,
  round2,
  saveGstSettings,
  updateVoucher,
} from '../src/store.js';
import { gstReturns, trialBalance } from '../src/accounting.js';

function groupId(company, key) {
  return company.groups.find((group) => group.key === key).id;
}

function party(company, name, key) {
  const result = addLedger(company, { name, groupId: groupId(company, key), opening: 0 });
  assert.equal(result.ok, true, result.error);
  return result.ledger;
}

function rateId(company, rate) {
  return company.gst.rates.find((entry) => entry.rate === rate).id;
}

function fixture() {
  const company = createCompany('GST Co', '2026-04-01').company;
  const setup = saveGstSettings(company, {
    enabled: true,
    gstin: '27ABCDE1234F1Z5',
    legalName: 'GST Co',
    stateCode: '27',
  });
  assert.equal(setup.ok, true, setup.error);
  return {
    company,
    setup,
    customer: party(company, 'Acme Customer', 'sundryDebtors'),
    supplier: party(company, 'Parts Supplier', 'sundryCreditors'),
    sales: findLedgerByName(company, 'Sales'),
    purchases: findLedgerByName(company, 'Purchases'),
    cash: findLedgerByName(company, 'Cash'),
  };
}

function sale(company, { customer, sales, taxable, date = '2026-04-10', gst = {} }) {
  const payload = { rateId: rateId(company, 18), placeOfSupply: '27', ...gst };
  const entry = company.gst.rates.find((rate) => rate.id === payload.rateId);
  const total = round2(taxable + (taxable * entry.rate) / 100 + (taxable * (entry.cess ?? 0)) / 100);
  const result = addVoucher(company, {
    type: 'Sales',
    date,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: total },
      { ledgerId: sales.id, side: 'Cr', amount: taxable },
    ],
    gst: payload,
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

test('GST setup validates the GSTIN and creates the four tax ledgers', () => {
  const company = createCompany('Setup Co', '2026-04-01').company;
  assert.equal(company.gst.enabled, false);
  assert.equal(company.gst.rates.length, 5);

  const mismatch = saveGstSettings(company, {
    enabled: true,
    gstin: '29ABCDE1234F1Z5',
    stateCode: '27',
  });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.error, /does not match|starts with state/);

  const invalid = saveGstSettings(company, { enabled: true, gstin: 'ABC', stateCode: '27' });
  assert.equal(invalid.ok, false);

  const missingState = saveGstSettings(company, { enabled: true, gstin: '27ABCDE1234F1Z5' });
  assert.equal(missingState.ok, false);

  const result = saveGstSettings(company, {
    enabled: true,
    gstin: '27ABCDE1234F1Z5',
    legalName: 'Setup Co',
    stateCode: '27',
  });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.created, ['CGST', 'SGST', 'IGST', 'Cess']);

  const ledgers = gstTaxLedgers(company);
  assert.equal(ledgers.cgst.name, 'CGST');
  assert.equal(ledgers.sgst.name, 'SGST');
  assert.equal(ledgers.igst.name, 'IGST');
  assert.equal(ledgers.cess.name, 'Cess');
  for (const ledger of Object.values(ledgers)) {
    assert.equal(company.groups.find((group) => group.id === ledger.groupId).key, 'dutiesTaxes');
  }

  assert.equal(saveGstTaxLedger(company, 'cgst', 'Central GST').ok, true);
  assert.equal(ledgers.cgst.name, 'Central GST');
  assert.equal(saveGstTaxLedger(company, 'cgst', 'SGST').ok, false);
  assert.equal(saveGstTaxLedger(company, 'bogus', 'Tax').ok, false);
  const cess = saveGstTaxLedger(company, 'cess', 'GST Compensation Cess');
  assert.equal(cess.ok, true, cess.error);
  assert.equal(cess.created, false);
  assert.equal(ledgers.cess.name, 'GST Compensation Cess');

  // Saving again reuses the same ledgers instead of duplicating them.
  const again = saveGstSettings(company, {
    enabled: true,
    gstin: '27ABCDE1234F1Z5',
    stateCode: '27',
  });
  assert.equal(again.ok, true, again.error);
  assert.deepEqual(again.created, []);
  assert.equal(company.ledgers.filter((ledger) => ledger.name === 'Central GST').length, 1);
});

test('a service ledger SAC code feeds the HSN/SAC summary without stock items', () => {
  const { company, customer } = fixture();
  const service = addLedger(company, {
    name: 'Consulting services',
    groupId: groupId(company, 'directIncomes'),
    opening: 0,
    sacCode: '998311',
  });
  assert.equal(service.ok, true, service.error);
  assert.equal(addLedger(company, {
    name: 'Bad SAC',
    groupId: groupId(company, 'directIncomes'),
    opening: 0,
    sacCode: '12',
  }).ok, false);

  const sale = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1180 },
      { ledgerId: service.ledger.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: rateId(company, 18), placeOfSupply: '27' },
  });
  assert.equal(sale.ok, true, sale.error);
  const report = gstReturns(company, { from: '2026-04-01', to: '2026-04-30' });
  const row = report.gstr1.hsn.find((entry) => entry.hsn === '998311');
  assert.ok(row);
  assert.equal(row.unit, 'OTH');
  assert.equal(row.qty, 1);
  assert.equal(row.taxable, 1000);
  assert.equal(row.tax, 180);
});

test('an intra-state sale posts CGST and SGST and balances the party line', () => {
  const { company, customer, sales } = fixture();
  const voucher = sale(company, { customer, sales, taxable: 1000 });

  assert.equal(voucher.total, 1180);
  assert.equal(voucher.gst.taxable, 1000);
  assert.equal(voucher.gst.cgst, 90);
  assert.equal(voucher.gst.sgst, 90);
  assert.equal(voucher.gst.igst, 0);
  assert.equal(voucher.gst.supplyType, 'Intra');
  assert.equal(voucher.gst.partyLedgerId, customer.id);

  const partyLine = voucher.lines.find((line) => line.ledgerId === customer.id);
  assert.equal(partyLine.amount, 1180);
  const taxLines = voucher.lines.filter((line) => line.side === 'Cr' && line.ledgerId !== sales.id);
  assert.equal(taxLines.length, 2);
  assert.deepEqual(taxLines.map((line) => line.amount).sort((a, b) => a - b), [90, 90]);

  const totals = trialBalance(company);
  assert.equal(totals.rows.find((row) => row.ledgerId === customer.id).debit, 1180);
  assert.equal(totals.balanced, true);
  assert.equal(totals.debitTotal, totals.creditTotal);

  // The taxable value is what the sales ledger carries; tax sits in Duties & Taxes.
  const report = gstReturns(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(report.outward.taxable, 1000);
  assert.equal(report.outward.cgst, 90);
  assert.equal(report.outward.sgst, 90);
  assert.equal(report.gstr3b.netTotal, 180);
});

test('an inter-state purchase uses IGST and claims input tax credit', () => {
  const { company, supplier, purchases } = fixture();
  const result = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-12',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 5000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 5000 },
    ],
    gst: { rateId: rateId(company, 18), placeOfSupply: '29', partyGstin: '29ABCDE1234F1Z5' },
  });
  assert.equal(result.ok, true, result.error);
  const voucher = result.voucher;
  assert.equal(voucher.gst.supplyType, 'Inter');
  assert.equal(voucher.gst.igst, 900);
  assert.equal(voucher.gst.cgst, 0);
  assert.equal(voucher.total, 5900);

  const report = gstReturns(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(report.gstr3b.itc.igst, 900);
  assert.equal(report.gstr3b.itcTaxable, 5000);
  assert.equal(report.gstr3b.outwardTaxable, 0);
  assert.equal(report.gstr3b.netTotal, -900);
});

test('credit notes reduce outward supplies and debit notes reduce ITC', () => {
  const { company, customer, supplier, sales, purchases } = fixture();
  const invoice = sale(company, { customer, sales, taxable: 1000 });
  const purchase = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-11',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 2000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 2000 },
    ],
    gst: { rateId: rateId(company, 18), placeOfSupply: '27' },
  }).voucher;
  assert.equal(purchase.total, 2360);

  const credit = addVoucher(company, {
    type: 'CreditNote',
    date: '2026-04-15',
    lines: [
      { ledgerId: sales.id, side: 'Dr', amount: 1000 },
      { ledgerId: customer.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: rateId(company, 18), placeOfSupply: '27', originalVoucherId: invoice.id },
  });
  assert.equal(credit.ok, true, credit.error);
  assert.equal(credit.voucher.total, 1180);
  assert.equal(credit.voucher.gst.originalVoucherId, invoice.id);
  assert.equal(credit.voucher.lines.find((line) => line.ledgerId === customer.id).side, 'Cr');
  const returns = gstReturns(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(returns.gstr1.cdnr[0].originalRef, 'Sales 1');
  const wrongLink = addVoucher(company, {
    type: 'CreditNote',
    date: '2026-04-16',
    lines: [
      { ledgerId: sales.id, side: 'Dr', amount: 100 },
      { ledgerId: customer.id, side: 'Cr', amount: 100 },
    ],
    gst: { rateId: rateId(company, 18), placeOfSupply: '27', originalVoucherId: purchase.id },
  });
  assert.equal(wrongLink.ok, false);
  assert.match(wrongLink.error, /sales invoice/);

  const debit = addVoucher(company, {
    type: 'DebitNote',
    date: '2026-04-16',
    lines: [
      { ledgerId: supplier.id, side: 'Dr', amount: 500 },
      { ledgerId: purchases.id, side: 'Cr', amount: 500 },
    ],
    gst: { rateId: rateId(company, 18), placeOfSupply: '27' },
  });
  assert.equal(debit.ok, true, debit.error);

  const report = gstReturns(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(report.outward.taxable, 0);
  assert.equal(report.outward.cgst, 0);
  assert.equal(report.creditNotes.taxable, 1000);
  assert.equal(report.gstr1.cdnr.length, 1);
  assert.equal(report.gstr1.rateRows[0].taxable, 0);
  assert.equal(report.purchases.taxable, 1500);
  assert.equal(report.gstr3b.itc.cgst, 135);
  assert.equal(report.gstr3b.netTotal, -270);
  assert.equal(report.debitNotes.taxable, 500);
  assert.equal(invoice.type, 'Sales');
});

test('GSTR-1 splits B2B and B2C supplies and builds an HSN summary', () => {
  const { company, customer, sales } = fixture();
  const item = addStockItem(company, {
    name: 'Cotton shirt',
    stockGroupId: company.stockGroups[0].id,
    unitId: company.units[0].id,
    openingQty: 100,
    openingRate: 100,
    hsn: '6109',
  });
  assert.equal(item.ok, true, item.error);

  const b2b = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-05',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1180 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
    items: [{ stockItemId: item.item.id, qty: 10, rate: 100 }],
    gst: { rateId: rateId(company, 18), placeOfSupply: '27', partyGstin: '27AAACR1234F1Z2' },
  });
  assert.equal(b2b.ok, true, b2b.error);

  const cashSale = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-06',
    lines: [
      { ledgerId: company.ledgers.find((ledger) => ledger.name === 'Cash').id, side: 'Dr', amount: 590 },
      { ledgerId: sales.id, side: 'Cr', amount: 500 },
    ],
    items: [{ stockItemId: item.item.id, qty: 5, rate: 100 }],
    gst: { rateId: rateId(company, 18), placeOfSupply: '27' },
  });
  assert.equal(cashSale.ok, true, cashSale.error);

  const report = gstReturns(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(report.gstr1.b2b.length, 1);
  assert.equal(report.gstr1.b2b[0].partyGstin, '27AAACR1234F1Z2');
  assert.equal(report.gstr1.b2bTotal.taxable, 1000);
  assert.equal(report.gstr1.b2c.length, 1);
  assert.equal(report.gstr1.b2c[0].taxable, 500);
  assert.equal(report.gstr1.b2c[0].count, 1);
  assert.equal(report.gstr1.b2cTotal.count, 1);
  assert.equal(report.gstr1.rateRows[0].count, 2);
  assert.equal(report.gstr1.rateRows[0].taxable, 1500);

  assert.equal(report.gstr1.hsn.length, 1);
  assert.equal(report.gstr1.hsn[0].hsn, '6109');
  assert.equal(report.gstr1.hsn[0].qty, 15);
  assert.equal(report.gstr1.hsn[0].taxable, 1500);
  assert.equal(report.gstr1.hsn[0].tax, 270);
  assert.equal(report.totals.tax, 270);
});

test('HSN summary splits quantities by unit quantity code', () => {
  const { company, customer, sales } = fixture();
  const nos = company.units.find((unit) => unit.symbol === 'Nos');
  const kg = company.units.find((unit) => unit.symbol === 'Kg');
  const buttons = addStockItem(company, {
    name: 'Buttons',
    stockGroupId: company.stockGroups[0].id,
    unitId: nos.id,
    openingQty: 100,
    openingRate: 10,
    hsn: '9606',
  });
  assert.equal(buttons.ok, true, buttons.error);
  const thread = addStockItem(company, {
    name: 'Thread',
    stockGroupId: company.stockGroups[0].id,
    unitId: kg.id,
    openingQty: 50,
    openingRate: 100,
    hsn: '9606',
  });
  assert.equal(thread.ok, true, thread.error);

  const invoice = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-07',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1534 },
      { ledgerId: sales.id, side: 'Cr', amount: 1300 },
    ],
    items: [
      { stockItemId: buttons.item.id, qty: 10, rate: 100 },
      { stockItemId: thread.item.id, qty: 3, rate: 100 },
    ],
    gst: { rateId: rateId(company, 18), placeOfSupply: '27', partyGstin: '27AAACR1234F1Z2' },
  });
  assert.equal(invoice.ok, true, invoice.error);

  const report = gstReturns(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(report.gstr1.hsn.length, 2, 'one row per HSN and UQC pair');
  const byUnit = Object.fromEntries(report.gstr1.hsn.map((row) => [row.unit, row]));
  assert.equal(byUnit.NOS.qty, 10);
  assert.equal(byUnit.NOS.taxable, 1000);
  assert.equal(byUnit.NOS.tax, 180);
  assert.equal(byUnit.KGS.qty, 3);
  assert.equal(byUnit.KGS.taxable, 300);
  assert.equal(byUnit.KGS.tax, 54);
  assert.equal(report.gstr1.hsn.reduce((sum, row) => sum + row.taxable, 0), 1300);
  assert.equal(report.gstr1.hsn.reduce((sum, row) => sum + row.tax, 0), 234);
});

test('reverse-charge purchases appear in both liability and ITC', () => {
  const { company, supplier, purchases } = fixture();
  const result = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-20',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 1000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: rateId(company, 18), placeOfSupply: '27', reverseCharge: true },
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.voucher.gst.reverseCharge, true);
  assert.equal(result.voucher.total, 1180);

  const report = gstReturns(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(report.rcm.taxable, 1000);
  assert.equal(report.gstr3b.rcmTaxTotal, 180);
  assert.equal(report.gstr3b.liabilityTotal, 180);
  assert.equal(report.gstr3b.itcTotal, 180);
  assert.equal(report.gstr3b.netTotal, 0);
});

test('GST voucher validation rejects tax without a single balancing line', () => {
  const { company, customer, sales, cash } = fixture();
  const bank = party(company, 'Current account', 'bank');
  const rate = rateId(company, 18);

  const split = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 600 },
      { ledgerId: bank.id, side: 'Dr', amount: 580 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: rate, placeOfSupply: '27' },
  });
  assert.equal(split.ok, false);
  assert.match(split.error, /exactly one/);

  const noValue = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 0 },
      { ledgerId: sales.id, side: 'Cr', amount: 0 },
    ],
    gst: { rateId: rate, placeOfSupply: '27' },
  });
  assert.equal(noValue.ok, false);

  const badGstin = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1180 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: rate, placeOfSupply: '27', partyGstin: 'NOT-A-GSTIN' },
  });
  assert.equal(badGstin.ok, false);
  assert.match(badGstin.error, /GSTIN/);

  const badState = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1180 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: rate, placeOfSupply: '99' },
  });
  assert.equal(badState.ok, false);

  const journal = addVoucher(company, {
    type: 'Journal',
    date: '2026-04-10',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1180 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: rate, placeOfSupply: '27' },
  });
  assert.equal(journal.ok, false);
});

test('GST needs enabling, and stock item totals must equal the taxable value', () => {
  const company = createCompany('No GST Co', '2026-04-01').company;
  const customer = party(company, 'Buyer', 'sundryDebtors');
  const sales = findLedgerByName(company, 'Sales');
  const disabled = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1180 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: 'gst_missing', placeOfSupply: '27' },
  });
  assert.equal(disabled.ok, false);
  assert.match(disabled.error, /not enabled/);

  const { company: enabled, customer: buyer, sales: salesLedger } = fixture();
  const item = addStockItem(enabled, {
    name: 'Widget',
    stockGroupId: enabled.stockGroups[0].id,
    unitId: enabled.units[0].id,
    openingQty: 50,
    openingRate: 100,
  });
  const mismatch = addVoucher(enabled, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: buyer.id, side: 'Dr', amount: 1180 },
      { ledgerId: salesLedger.id, side: 'Cr', amount: 1000 },
    ],
    items: [{ stockItemId: item.item.id, qty: 5, rate: 100 }],
    gst: { rateId: rateId(enabled, 18), placeOfSupply: '27' },
  });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.error, /GST taxable value/);

  // GSTIN and state captured on a party ledger drive the default place of supply.
  const ledger = addLedger(enabled, {
    name: 'Delhi Buyer',
    groupId: groupId(enabled, 'sundryDebtors'),
    opening: 0,
    gstin: '07ABCDE1234F1Z5',
  });
  assert.equal(ledger.ok, true, ledger.error);
  assert.equal(ledger.ledger.stateCode, '07');
  const inter = addVoucher(enabled, {
    type: 'Sales',
    date: '2026-04-11',
    lines: [
      { ledgerId: ledger.ledger.id, side: 'Dr', amount: 1180 },
      { ledgerId: salesLedger.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: rateId(enabled, 18) },
  });
  assert.equal(inter.ok, true, inter.error);
  assert.equal(inter.voucher.gst.placeOfSupply, '07');
  assert.equal(inter.voucher.gst.supplyType, 'Inter');
  assert.equal(inter.voucher.gst.igst, 180);
});

test('altering a GST invoice recomputes its tax lines and total', () => {
  const { company, customer, sales } = fixture();
  const voucher = sale(company, { customer, sales, taxable: 1000 });
  const result = updateVoucher(company, voucher.id, {
    type: 'Sales',
    date: voucher.date,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1180 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: rateId(company, 5), placeOfSupply: '27' },
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.voucher.gst.rate, 5);
  assert.equal(result.voucher.gst.cgst, 25);
  assert.equal(result.voucher.gst.sgst, 25);
  assert.equal(result.voucher.total, 1050);
  const taxLines = result.voucher.lines.filter((line) => line.side === 'Cr' && line.ledgerId !== sales.id);
  assert.equal(taxLines.length, 2);

  const noGst = updateVoucher(company, voucher.id, {
    type: 'Sales',
    date: voucher.date,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1050 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
      { ledgerId: gstTaxLedgers(company).cgst.id, side: 'Cr', amount: 25 },
      { ledgerId: gstTaxLedgers(company).sgst.id, side: 'Cr', amount: 25 },
    ],
    gst: { rateId: '' },
  });
  assert.equal(noGst.ok, true, noGst.error);
  assert.equal(noGst.voucher.gst, undefined);
  assert.equal(noGst.voucher.total, 1050);
});

test('GST rate effective dates allow a future rate change', () => {
  const { company } = fixture();
  const added = addGstRate(company, { rate: 18, effectiveFrom: '2026-07-01' });
  assert.equal(added.ok, true, added.error);
  assert.equal(added.rate.effectiveFrom, '2026-07-01');
  assert.equal(addGstRate(company, { rate: 18, effectiveFrom: '2026-07-01' }).ok, false);
  assert.equal(addGstRate(company, { rate: 18, effectiveFrom: 'not-a-date' }).ok, false);
  assert.equal(updateGstRate(company, added.rate.id, { effectiveFrom: '2026-08-01' }).rate.effectiveFrom, '2026-08-01');

  const windowed = addGstRate(company, { rate: 40, effectiveFrom: '2026-04-01', effectiveTo: '2026-06-30' });
  assert.equal(windowed.ok, true, windowed.error);
  assert.equal(windowed.rate.effectiveTo, '2026-06-30');
  assert.equal(addGstRate(company, { rate: 40, effectiveFrom: '2026-04-01', effectiveTo: '2026-06-30' }).ok, false);
  assert.equal(addGstRate(company, { rate: 40, effectiveFrom: '2026-08-01', effectiveTo: '2026-07-01' }).ok, false);
  assert.equal(addGstRate(company, { rate: 40, effectiveTo: 'not-a-date' }).ok, false);
  const extended = updateGstRate(company, windowed.rate.id, { effectiveTo: '2026-09-30' });
  assert.equal(extended.ok, true, extended.error);
  assert.equal(extended.rate.effectiveTo, '2026-09-30');
  assert.equal(updateGstRate(company, windowed.rate.id, { effectiveTo: '2026-03-31' }).ok, false);
});

test('GST rates are unique and used rates cannot be deleted', () => {
  const { company, customer, sales } = fixture();
  const added = addGstRate(company, { label: '40% + 12% cess', rate: 40, cess: 12 });
  assert.equal(added.ok, true, added.error);
  assert.equal(addGstRate(company, { rate: 40, cess: 12 }).ok, false);
  assert.equal(addGstRate(company, { rate: 51 }).ok, false);
  assert.equal(addGstRate(company, { rate: 18 }).ok, false);

  const unused = deleteGstRate(company, added.rate.id);
  assert.equal(unused.ok, true, unused.error);

  const voucher = sale(company, { customer, sales, taxable: 1000 });
  assert.equal(voucher.gst.rate, 18);
  const used = deleteGstRate(company, rateId(company, 18));
  assert.equal(used.ok, false);
  assert.match(used.error, /used by 1 voucher/);
});

test('GST rates can be edited without rewriting posted vouchers', () => {
  const { company, customer, sales } = fixture();
  const voucher = sale(company, { customer, sales, taxable: 1000 });
  const id = rateId(company, 18);
  assert.equal(voucher.gst.rate, 18);

  const edited = updateGstRate(company, id, { label: '18% revised', rate: 20, cess: 1 });
  assert.equal(edited.ok, true, edited.error);
  assert.equal(edited.rate.label, '18% revised');
  assert.equal(edited.rate.rate, 20);
  assert.equal(edited.rate.cess, 1);
  assert.equal(
    company.vouchers[0].gst.rate,
    18,
    'a posted voucher keeps the rate it was saved with',
  );

  const duplicate = updateGstRate(company, id, { rate: 12, cess: 0 });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /already exists/);
  assert.equal(updateGstRate(company, id, { rate: 51 }).ok, false);
  assert.equal(updateGstRate(company, id, { cess: 51 }).ok, false);
  assert.equal(updateGstRate(company, 'missing', { rate: 5 }).ok, false);

  const relabelled = updateGstRate(company, id, { label: '' });
  assert.equal(relabelled.ok, true, relabelled.error);
  assert.equal(relabelled.rate.label, '20% + 1% cess', 'an empty label falls back to the rate label');
});

test('GST settings, rates and voucher tax survive a backup round trip', () => {
  const { company, customer, sales } = fixture();
  sale(company, { customer, sales, taxable: 1000 });
  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;

  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  assert.equal(copy.gst.enabled, true);
  assert.equal(copy.gst.gstin, '27ABCDE1234F1Z5');
  assert.equal(copy.gst.stateCode, '27');
  assert.equal(copy.gst.rates.length, company.gst.rates.length);
  assert.equal(copy.vouchers[0].gst.taxable, 1000);
  assert.equal(copy.vouchers[0].gst.cgst, 90);
  assert.equal(copy.vouchers[0].total, 1180);
  assert.equal(gstTaxLedgers(copy).cgst.name, 'CGST');
  assert.equal(copy.stockItems.every((item) => item.hsn === undefined), true);

  const report = gstReturns(copy, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(report.outward.taxable, 1000);
});

test('GST is unavailable on foreign-currency vouchers', () => {
  const { company, customer, sales } = fixture();
  const currency = addCurrency(company, {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    date: '2026-04-01',
    rate: 80,
  });
  assert.equal(currency.ok, true, currency.error);
  const result = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-10',
    currencyCode: 'USD',
    exchangeRate: 80,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 10 },
      { ledgerId: sales.id, side: 'Cr', amount: 10 },
    ],
    gst: { rateId: rateId(company, 18), placeOfSupply: '27' },
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /foreign-currency/);
});

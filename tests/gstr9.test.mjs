import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLedger,
  addVoucher,
  createCompany,
  findLedgerByName,
  saveGstSettings,
} from '../src/store.js';
import { gstr9Json, gstr9Summary } from '../src/accounting.js';

function groupId(company, key) {
  return company.groups.find((group) => group.key === key).id;
}

function fixture() {
  const company = createCompany('Annual Co', '2026-04-01').company;
  assert.equal(
    saveGstSettings(company, {
      enabled: true,
      gstin: '27ABCDE1234F1Z5',
      legalName: 'Annual Co Private Limited',
      stateCode: '27',
    }).ok,
    true,
  );
  const customer = addLedger(company, {
    name: 'Buyer',
    groupId: groupId(company, 'sundryDebtors'),
    opening: 0,
    gstin: '27AAACR1234F1Z2',
    stateCode: '27',
  });
  const supplier = addLedger(company, {
    name: 'Supplier',
    groupId: groupId(company, 'sundryCreditors'),
    opening: 0,
    gstin: '27AAACR5678F1Z9',
    stateCode: '27',
  });
  assert.equal(customer.ok, true, customer.error);
  assert.equal(supplier.ok, true, supplier.error);
  return { company, customer: customer.ledger, supplier: supplier.ledger };
}

function sale(company, customer, taxable, date = '2026-04-10') {
  const rate = company.gst.rates.find((entry) => entry.rate === 18);
  const result = addVoucher(company, {
    type: 'Sales',
    date,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: taxable },
      { ledgerId: findLedgerByName(company, 'Sales').id, side: 'Cr', amount: taxable },
    ],
    gst: { rateId: rate.id, placeOfSupply: '27', partyGstin: customer.gstin },
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

function purchase(company, supplier, taxable, date = '2026-04-12') {
  const rate = company.gst.rates.find((entry) => entry.rate === 18);
  const result = addVoucher(company, {
    type: 'Purchase',
    date,
    lines: [
      { ledgerId: findLedgerByName(company, 'Purchases').id, side: 'Dr', amount: taxable },
      { ledgerId: supplier.id, side: 'Cr', amount: taxable },
    ],
    gst: { rateId: rate.id, placeOfSupply: '27', partyGstin: supplier.gstin },
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

test('GSTR-9 working paper totals the financial year from voucher tax detail', () => {
  const { company, customer, supplier } = fixture();
  sale(company, customer, 1000);
  purchase(company, supplier, 2000);

  const report = gstr9Summary(company, { from: '2026-04-01', to: '2027-03-31' });
  assert.equal(report.from, '2026-04-01');
  assert.equal(report.to, '2027-03-31');
  assert.equal(report.legalName, 'Annual Co Private Limited');
  assert.equal(report.months.length, 12);
  assert.equal(report.summary.outward.taxable, 1000);
  assert.equal(report.summary.outward.total, 180);
  assert.equal(report.summary.outward.b2bInvoices, 1);
  assert.equal(report.summary.inward.taxable, 2000);
  assert.equal(report.summary.inward.total, 360);
  assert.equal(report.summary.itc.cgst, 180);
  assert.equal(report.summary.itc.sgst, 180);
  assert.equal(report.summary.liabilityTotal, 180);
  assert.equal(report.summary.netTotal, -180);
  assert.equal(report.rateRows.length, 1);
  assert.equal(report.rateRows[0].rate, 18);
});

test('GSTR-9 JSON export validates GST setup and labels the file as a working paper', () => {
  const disabled = createCompany('No GST', '2026-04-01').company;
  assert.equal(gstr9Json(disabled).ok, false);

  const { company, customer } = fixture();
  sale(company, customer, 1000);
  const result = gstr9Json(company, { from: '2026-04-01', to: '2027-03-31' });
  assert.equal(result.ok, true, result.error);
  assert.match(result.filename, /^GSTR-9-working-paper-27ABCDE1234F1Z5-2026-27\.json$/);
  assert.equal(result.payload.form, 'GSTR-9 working paper');
  assert.equal(result.payload.gstin, '27ABCDE1234F1Z5');
  assert.equal(result.payload.period.from, '2026-04-01');
  assert.equal(result.payload.summary.outward.taxable, 1000);
  assert.equal(result.payload.monthly.length, 12);
  assert.equal(result.payload.rateSummary[0].taxable, 1000);
  assert.match(result.payload.note, /not a filed return/i);
});

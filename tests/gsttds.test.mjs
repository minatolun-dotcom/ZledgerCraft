import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLedger,
  addVoucher,
  createCompany,
  findLedgerByName,
  saveGstSettings,
  saveTdsSettings,
} from '../src/store.js';
import { gstReturns, trialBalance, withholdingSummary } from '../src/accounting.js';

function groupId(company, key) {
  return company.groups.find((group) => group.key === key).id;
}

function fixture() {
  const company = createCompany('GST TDS Co', '2026-04-01').company;
  assert.equal(
    saveGstSettings(company, {
      enabled: true,
      gstin: '27ABCDE1234F1Z5',
      legalName: 'GST TDS Co',
      stateCode: '27',
    }).ok,
    true,
  );
  assert.equal(saveTdsSettings(company, { enabled: true, tan: 'MUMA12345B' }).ok, true);
  const supplier = addLedger(company, {
    name: 'Consultant',
    groupId: groupId(company, 'sundryCreditors'),
    opening: 0,
    gstin: '27AAACR1234F1Z2',
    stateCode: '27',
    pan: 'ABCDE1234F',
  });
  const customer = addLedger(company, {
    name: 'Buyer',
    groupId: groupId(company, 'sundryDebtors'),
    opening: 0,
    gstin: '27AAACR5678F1Z9',
    stateCode: '27',
  });
  assert.equal(supplier.ok, true, supplier.error);
  assert.equal(customer.ok, true, customer.error);
  return { company, supplier: supplier.ledger, customer: customer.ledger };
}

test('a GST purchase can deduct TDS on the taxable value', () => {
  const { company, supplier } = fixture();
  const rate = company.gst.rates.find((entry) => entry.rate === 18);
  const section = company.tds.sections.find((entry) => entry.code === '194J');
  const result = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-12',
    lines: [
      { ledgerId: findLedgerByName(company, 'Purchases').id, side: 'Dr', amount: 1000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: rate.id, placeOfSupply: '27', partyGstin: supplier.gstin },
    tds: { sectionId: section.id, pan: 'ABCDE1234F' },
  });
  assert.equal(result.ok, true, result.error);
  const voucher = result.voucher;
  assert.equal(voucher.gst.taxable, 1000);
  assert.equal(voucher.gst.cgst, 90);
  assert.equal(voucher.tds.base, 1000);
  assert.equal(voucher.tds.amount, 100);
  const partyLine = voucher.lines.find((line) => line.ledgerId === supplier.id);
  assert.equal(partyLine.amount, 1080);
  assert.equal(voucher.lines.find((line) => line.ledgerId === supplier.id).side, 'Cr');

  const totals = trialBalance(company);
  assert.equal(totals.balanced, true);
  assert.equal(gstReturns(company, { from: '2026-04-01', to: '2026-04-30' }).gstr3b.itcTotal, 180);
  assert.equal(withholdingSummary(company, { from: '2026-04-01', to: '2026-04-30' }).periodAmount, 100);
});

test('a GST sale can collect TCS on the taxable value', () => {
  const { company, customer } = fixture();
  const rate = company.gst.rates.find((entry) => entry.rate === 18);
  const section = company.tds.sections.find((entry) => entry.code === '206C(1H)');
  const result = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-13',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 10000 },
      { ledgerId: findLedgerByName(company, 'Sales').id, side: 'Cr', amount: 10000 },
    ],
    gst: { rateId: rate.id, placeOfSupply: '27', partyGstin: customer.gstin },
    tds: { sectionId: section.id },
  });
  assert.equal(result.ok, true, result.error);
  const voucher = result.voucher;
  assert.equal(voucher.gst.taxable, 10000);
  assert.equal(voucher.gst.cgst, 900);
  assert.equal(voucher.gst.sgst, 900);
  assert.equal(voucher.tds.base, 10000);
  assert.equal(voucher.tds.amount, 10);
  const partyLine = voucher.lines.find((line) => line.ledgerId === customer.id);
  assert.equal(partyLine.amount, 11810);
  assert.equal(trialBalance(company).balanced, true);
});

test('mixed per-line GST rates still withhold on the full taxable value', () => {
  const { company, supplier } = fixture();
  const purchase = findLedgerByName(company, 'Purchases');
  const five = company.gst.rates.find((entry) => entry.rate === 5);
  const eighteen = company.gst.rates.find((entry) => entry.rate === 18);
  const section = company.tds.sections.find((entry) => entry.code === '194J');
  const result = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-14',
    lines: [
      { ledgerId: purchase.id, side: 'Dr', amount: 1000, gstRateId: five.id },
      { ledgerId: purchase.id, side: 'Dr', amount: 500, gstRateId: eighteen.id },
      { ledgerId: supplier.id, side: 'Cr', amount: 1500 },
    ],
    gst: { placeOfSupply: '27', partyGstin: supplier.gstin },
    tds: { sectionId: section.id, pan: 'ABCDE1234F' },
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.voucher.gst.taxable, 1500);
  assert.equal(result.voucher.gst.mixedRate, true);
  assert.equal(result.voucher.tds.base, 1500);
  assert.equal(result.voucher.tds.amount, 150);
  assert.equal(
    result.voucher.lines.find((line) => line.ledgerId === supplier.id).amount,
    1490,
  );
  assert.equal(trialBalance(company).balanced, true);
});

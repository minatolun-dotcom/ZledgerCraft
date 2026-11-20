import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLedger,
  addStockItem,
  addVoucher,
  createCompany,
  deleteVoucher,
  emptyState,
  exportState,
  findLedgerByName,
  importState,
  saveGstSettings,
  saveTdsSettings,
  setEwayPartB,
  updateLedger,
} from '../src/store.js';
import {
  eInvoiceRegister,
  ewayBillRegister,
  gstReturns,
  taxAuditSummary,
} from '../src/accounting.js';

function groupId(company, key) {
  return company.groups.find((group) => group.key === key).id;
}

function party(company, name, key, extra = {}) {
  const result = addLedger(company, { name, groupId: groupId(company, key), opening: 0, ...extra });
  assert.equal(result.ok, true, result.error);
  return result.ledger;
}

function rateId(company, rate) {
  return company.gst.rates.find((entry) => entry.rate === rate).id;
}

function fixture() {
  const company = createCompany('Compliance Co', '2026-04-01').company;
  const setup = saveGstSettings(company, {
    enabled: true,
    gstin: '27ABCDE1234F1Z5',
    legalName: 'Compliance Co Private Limited',
    tradeName: 'Compliance Co',
    address: '12 Market Road',
    city: 'Pune',
    pin: '411001',
    stateCode: '27',
  });
  assert.equal(setup.ok, true, setup.error);
  const tds = saveTdsSettings(company, { enabled: true, tan: 'MUMA12345B' });
  assert.equal(tds.ok, true, tds.error);

  const customer = party(company, 'Acme Customer', 'sundryDebtors', {
    gstin: '27AAACR1234F1Z2',
    stateCode: '27',
    address: '4 Industrial Estate',
    city: 'Pune',
    pin: '411014',
  });
  const supplier = party(company, 'Consultant', 'sundryCreditors', { pan: 'ABCDE1234F' });
  const item = addStockItem(company, {
    name: 'Cotton shirt',
    stockGroupId: company.stockGroups[0].id,
    unitId: company.units.find((unit) => unit.symbol === 'Nos').id,
    openingQty: 2000,
    openingRate: 100,
    hsn: '6109',
  });
  assert.equal(item.ok, true, item.error);

  return {
    company,
    customer,
    supplier,
    item: item.item,
    sales: findLedgerByName(company, 'Sales'),
    purchases: findLedgerByName(company, 'Purchases'),
    cash: findLedgerByName(company, 'Cash'),
  };
}

function sale(company, { customer, item, qty = 10, rate = 100, date = '2026-04-05', gstin = '27AAACR1234F1Z2' }) {
  const taxable = qty * rate;
  const total = Math.round(taxable * 1.18 * 100) / 100;
  const result = addVoucher(company, {
    type: 'Sales',
    date,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: total },
      { ledgerId: findLedgerByName(company, 'Sales').id, side: 'Cr', amount: taxable },
    ],
    items: [{ stockItemId: item.id, qty, rate }],
    gst: {
      rateId: rateId(company, 18),
      placeOfSupply: '27',
      ...(gstin ? { partyGstin: gstin } : {}),
    },
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

test('GST registration and party ledgers store the address fields e-invoices need', () => {
  const company = createCompany('Address Co', '2026-04-01').company;
  const result = saveGstSettings(company, {
    enabled: true,
    gstin: '27ABCDE1234F1Z5',
    legalName: 'Address Co',
    tradeName: 'Address Trading',
    address: '12 Market Road',
    city: 'Pune',
    pin: '411001',
    stateCode: '27',
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(company.gst.tradeName, 'Address Trading');
  assert.equal(company.gst.address, '12 Market Road');
  assert.equal(company.gst.pin, '411001');

  assert.equal(saveGstSettings(company, { enabled: false, pin: '4110' }).ok, false);
  assert.equal(
    saveGstSettings(company, {
      enabled: false,
      gstin: '27ABCDE1234F1Z5',
      legalName: 'Address Co',
      address: '12 Market Road',
      city: 'Pune',
      pin: '411001',
      stateCode: '27',
    }).ok,
    true,
  );

  const customer = party(company, 'Buyer', 'sundryDebtors', {
    gstin: '27AAACR1234F1Z2',
    stateCode: '27',
    address: '4 Industrial Estate',
    city: 'Pune',
    pin: '411014',
  });
  assert.equal(customer.address, '4 Industrial Estate');
  assert.equal(customer.pin, '411014');

  const updated = updateLedger(company, customer.id, { pin: '4110' });
  assert.equal(updated.ok, false);
  assert.match(updated.error, /PIN/);
  assert.equal(updateLedger(company, customer.id, { pin: '' }).ok, true);
  assert.equal(customer.pin, undefined);
});

test('e-invoice register builds a ready NIC-style draft for a B2B intra-state sale', () => {
  const { company, customer, item } = fixture();
  const voucher = sale(company, { customer, item });
  const report = eInvoiceRegister(company, { from: '2026-04-01', to: '2026-04-30' });

  assert.equal(report.count, 1);
  assert.equal(report.eligibleCount, 1);
  assert.equal(report.readyCount, 1);
  assert.equal(report.blockedCount, 0);
  assert.equal(report.seller.gstin, '27ABCDE1234F1Z5');
  assert.equal(report.seller.address, '12 Market Road');

  const row = report.rows[0];
  assert.equal(row.id, voucher.id);
  assert.equal(row.ready, true);
  assert.deepEqual(row.blockers, []);
  assert.equal(row.buyer.gstin, '27AAACR1234F1Z2');
  assert.equal(row.payload.Version, '1.1');
  assert.equal(row.payload.TranDtls.SupTyp, 'B2B');
  assert.equal(row.payload.DocDtls.No, 'Sales 1');
  assert.equal(row.payload.DocDtls.Dt, '05/04/2026');
  assert.equal(row.payload.SellerDtls.LglNm, 'Compliance Co Private Limited');
  assert.equal(row.payload.BuyerDtls.Pos, '27');
  assert.equal(row.payload.ItemList[0].HsnCd, '6109');
  assert.equal(row.payload.ItemList[0].Unit, 'NOS');
  assert.equal(row.payload.ItemList[0].CgstAmt, 90);
  assert.equal(row.payload.ValDtls.AssVal, 1000);
  assert.equal(row.payload.ValDtls.CgstVal, 90);
  assert.equal(row.payload.ValDtls.TotInvVal, 1180);
});

test('e-invoice readiness flags B2C invoices and missing buyer address fields', () => {
  const { company, customer, item, cash } = fixture();
  const b2c = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-06',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 590 },
      { ledgerId: findLedgerByName(company, 'Sales').id, side: 'Cr', amount: 500 },
    ],
    items: [{ stockItemId: item.id, qty: 5, rate: 100 }],
    gst: { rateId: rateId(company, 18), placeOfSupply: '27' },
  });
  assert.equal(b2c.ok, true, b2c.error);

  const report = eInvoiceRegister(company, { from: '2026-04-01', to: '2026-04-30' });
  const b2cRow = report.rows.find((row) => row.id === b2c.voucher.id);
  assert.equal(b2cRow.eligible, false);
  assert.equal(b2cRow.payload, null);
  assert.equal(b2cRow.ready, false);
  assert.match(b2cRow.blockers.join(' '), /B2C/);

  updateLedger(company, customer.id, { address: '', city: '', pin: '' });
  const b2b = sale(company, { customer, item, date: '2026-04-07' });
  const next = eInvoiceRegister(company, { from: '2026-04-01', to: '2026-04-30' });
  const row = next.rows.find((entry) => entry.id === b2b.id);
  assert.equal(row.ready, false);
  assert.match(row.blockers.join(' '), /Buyer address/);
  assert.match(row.blockers.join(' '), /Buyer city/);
  assert.match(row.blockers.join(' '), /Buyer PIN/);
  assert.equal(next.blockedCount, 1);
});

test('e-way bill register uses the 50,000 threshold and saves Part B details', () => {
  const { company, customer, item } = fixture();
  const small = sale(company, { customer, item, qty: 10, rate: 100 });
  const large = sale(company, { customer, item, qty: 1000, rate: 100, date: '2026-04-08' });

  const report = ewayBillRegister(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(report.threshold, 50000);
  assert.equal(report.count, 1);
  assert.equal(report.rows[0].id, large.id);
  assert.equal(report.rows.some((row) => row.id === small.id), false);

  const payload = report.rows[0].payload.BillLists[0];
  assert.equal(payload.docNo, 'Sales 2');
  assert.equal(payload.docDate, '08/04/2026');
  assert.equal(payload.fromPincode, 411001);
  assert.equal(payload.toGstin, '27AAACR1234F1Z2');
  assert.equal(payload.totalValue, 118000);
  assert.equal(payload.cgstValue, 9000);
  assert.equal(payload.sgstValue, 9000);
  assert.equal(payload.itemList[0].hsnCode, '6109');
  assert.equal(payload.itemList[0].qtyUnit, 'NOS');
  assert.match(report.rows[0].warnings.join(' '), /Part B/);
  assert.equal(report.rows[0].partBReady, false);

  const saved = setEwayPartB(company, large.id, {
    transporterName: ' Fast Freight ',
    transporterId: '27aabcf1234f1z9',
    vehicleNo: 'mh 12 ab 1234',
    distance: '42',
  });
  assert.equal(saved.ok, true, saved.error);
  assert.equal(saved.partB.transporterName, 'Fast Freight');
  assert.equal(saved.partB.transporterId, '27AABCF1234F1Z9');
  assert.equal(saved.partB.vehicleNo, 'MH12AB1234');
  assert.equal(saved.partB.distance, 42);

  const withPartB = ewayBillRegister(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(withPartB.rows[0].partBReady, true);
  assert.equal(withPartB.rows[0].warnings.some((warning) => /Part B/.test(warning)), false);
  const fullPayload = withPartB.rows[0].payload.BillLists[0];
  assert.equal(fullPayload.transporterName, 'Fast Freight');
  assert.equal(fullPayload.transporterId, '27AABCF1234F1Z9');
  assert.equal(fullPayload.vehicleNo, 'MH12AB1234');
  assert.equal(fullPayload.transDistance, '42');

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  assert.deepEqual(restored.state.companies[0].ewayPartB[large.id], company.ewayPartB[large.id]);

  assert.equal(setEwayPartB(company, 'missing', {}).ok, false);
  assert.equal(setEwayPartB(company, large.id, { distance: 0 }).ok, false);
  const cleared = setEwayPartB(company, large.id, {});
  assert.equal(cleared.ok, true, cleared.error);
  assert.equal(cleared.cleared, true);
  assert.equal(ewayBillRegister(company, { from: '2026-04-01', to: '2026-04-30' }).rows[0].partBReady, false);

  setEwayPartB(company, large.id, { transporterName: 'Return Trip', distance: 10 });
  assert.equal(deleteVoucher(company, large.id), true);
  assert.equal(company.ewayPartB[large.id], undefined);

  const lower = ewayBillRegister(company, {
    from: '2026-04-01',
    to: '2026-04-30',
    threshold: 500000,
  });
  assert.equal(lower.count, 0);
});

test('tax audit reconciles turnover, GST and TDS and survives a backup', () => {
  const { company, customer, item, supplier } = fixture();
  sale(company, { customer, item });
  const purchase = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-10',
    lines: [
      { ledgerId: findLedgerByName(company, 'Purchases').id, side: 'Dr', amount: 10000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 10000 },
    ],
    tds: { sectionId: company.tds.sections.find((entry) => entry.code === '194J').id, pan: 'ABCDE1234F' },
  });
  assert.equal(purchase.ok, true, purchase.error);

  const report = taxAuditSummary(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(report.turnover.books, 1000);
  assert.equal(report.turnover.gstTaxable, 1000);
  assert.equal(report.turnover.difference, 0);
  assert.equal(report.outputTax.books, 180);
  assert.equal(report.outputTax.returns, 180);
  assert.equal(report.outputTax.difference, 0);
  assert.equal(report.itc.books, 0);
  assert.equal(report.itc.returns, 0);
  assert.equal(report.taxPosition.tds.deducted, 1000);
  assert.equal(report.taxPosition.tds.outstanding, 1000);
  assert.equal(report.clauses.length, 10);
  assert.equal(report.clauses.find((clause) => clause.clause === '20(b)').status, 'Ready');
  assert.equal(report.clauses.find((clause) => clause.clause === '34').status, 'Review');

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  assert.equal(copy.gst.address, '12 Market Road');
  assert.equal(copy.gst.pin, '411001');
  assert.equal(copy.ledgers.find((ledger) => ledger.name === 'Acme Customer').address, '4 Industrial Estate');
  assert.equal(copy.ledgers.find((ledger) => ledger.name === 'Acme Customer').pin, '411014');

  const copyReport = eInvoiceRegister(copy, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(copyReport.readyCount, 1);
  assert.equal(copyReport.rows[0].payload.SellerDtls.Pin, '411001');
  assert.equal(gstReturns(copy, { from: '2026-04-01', to: '2026-04-30' }).outward.taxable, 1000);
});

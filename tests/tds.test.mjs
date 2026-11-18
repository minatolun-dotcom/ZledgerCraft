import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addStockItem,
  addTaxChallan,
  addTdsSection,
  addLedger,
  addVoucher,
  createCompany,
  deleteTaxChallan,
  deleteTdsSection,
  emptyState,
  exportState,
  findLedgerByName,
  importState,
  saveGstSettings,
  saveTdsSettings,
  updateVoucher,
  withholdingTaxLedgers,
} from '../src/store.js';
import { trialBalance, withholdingSummary } from '../src/accounting.js';

function groupId(company, key) {
  return company.groups.find((group) => group.key === key).id;
}

function party(company, name, key, pan = '') {
  const result = addLedger(company, { name, groupId: groupId(company, key), opening: 0, pan });
  assert.equal(result.ok, true, result.error);
  return result.ledger;
}

function section(company, code) {
  return company.tds.sections.find((entry) => entry.code === code);
}

function fixture() {
  const company = createCompany('Tax Co', '2026-04-01').company;
  const setup = saveTdsSettings(company, { enabled: true, tan: 'MUMA12345B' });
  assert.equal(setup.ok, true, setup.error);
  return {
    company,
    setup,
    supplier: party(company, 'Consultant', 'sundryCreditors', 'ABCDE1234F'),
    customer: party(company, 'Buyer', 'sundryDebtors', 'PQRSX6789L'),
    purchases: findLedgerByName(company, 'Purchases'),
    sales: findLedgerByName(company, 'Sales'),
  };
}

function tdsPurchase(company, { supplier, purchases, base, date = '2026-04-10', code = '194J', pan = '' }) {
  const result = addVoucher(company, {
    type: 'Purchase',
    date,
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: base },
      { ledgerId: supplier.id, side: 'Cr', amount: base },
    ],
    tds: { sectionId: section(company, code).id, pan },
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

function tcsSale(company, { customer, sales, base, date = '2026-04-12', code = '206C(1H)' }) {
  const result = addVoucher(company, {
    type: 'Sales',
    date,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: base },
      { ledgerId: sales.id, side: 'Cr', amount: base },
    ],
    tds: { sectionId: section(company, code).id },
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

test('TDS/TCS setup validates the TAN and creates the payable ledgers', () => {
  const company = createCompany('Setup Co', '2026-04-01').company;
  assert.equal(company.tds.enabled, false);
  assert.equal(company.tds.sections.length, 6);

  assert.equal(saveTdsSettings(company, { enabled: true }).ok, false);
  assert.equal(saveTdsSettings(company, { enabled: true, tan: '12345' }).ok, false);
  assert.equal(saveTdsSettings(company, { enabled: false, tan: 'BAD' }).ok, false);

  const result = saveTdsSettings(company, { enabled: true, tan: 'MUMA12345B' });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.created, ['TDS Payable', 'TCS Payable']);
  assert.equal(withholdingTaxLedgers(company).TDS.name, 'TDS Payable');
  assert.equal(withholdingTaxLedgers(company).TCS.name, 'TCS Payable');
  for (const ledger of Object.values(withholdingTaxLedgers(company))) {
    assert.equal(company.groups.find((group) => group.id === ledger.groupId).key, 'dutiesTaxes');
  }

  const again = saveTdsSettings(company, { enabled: true, tan: 'MUMA12345B' });
  assert.equal(again.ok, true, again.error);
  assert.deepEqual(again.created, []);
  assert.equal(company.ledgers.filter((ledger) => ledger.name === 'TDS Payable').length, 1);
});

test('a TDS purchase reduces the party credit and posts TDS Payable', () => {
  const { company, supplier, purchases } = fixture();
  const voucher = tdsPurchase(company, { supplier, purchases, base: 10000 });

  assert.equal(voucher.total, 10000);
  assert.equal(voucher.tds.kind, 'TDS');
  assert.equal(voucher.tds.code, '194J');
  assert.equal(voucher.tds.base, 10000);
  assert.equal(voucher.tds.amount, 1000);
  assert.equal(voucher.tds.pan, 'ABCDE1234F');
  assert.equal(voucher.tds.partyLedgerId, supplier.id);

  const partyLine = voucher.lines.find((line) => line.ledgerId === supplier.id);
  assert.equal(partyLine.amount, 9000);
  const payable = withholdingTaxLedgers(company).TDS;
  const payableLine = voucher.lines.find((line) => line.ledgerId === payable.id);
  assert.equal(payableLine.side, 'Cr');
  assert.equal(payableLine.amount, 1000);

  const totals = trialBalance(company);
  assert.equal(totals.balanced, true);
  assert.equal(totals.rows.find((row) => row.ledgerId === null), undefined);
});

test('a TCS sale adds the collection to the party debit', () => {
  const { company, customer, sales } = fixture();
  const voucher = tcsSale(company, { customer, sales, base: 100000 });

  assert.equal(voucher.tds.kind, 'TCS');
  assert.equal(voucher.tds.amount, 100);
  assert.equal(voucher.total, 100100);
  const partyLine = voucher.lines.find((line) => line.ledgerId === customer.id);
  assert.equal(partyLine.amount, 100100);
  const payable = withholdingTaxLedgers(company).TCS;
  assert.equal(voucher.lines.find((line) => line.ledgerId === payable.id).amount, 100);

  const totals = trialBalance(company);
  assert.equal(totals.balanced, true);
});

test('TDS/TCS validation rejects wrong vouchers, sections and PANs', () => {
  const { company, supplier, customer, purchases, sales } = fixture();

  const disabledCompany = createCompany('Off Co', '2026-04-01').company;
  const offSupplier = party(disabledCompany, 'Vendor', 'sundryCreditors');
  const offPurchase = findLedgerByName(disabledCompany, 'Purchases');
  const off = addVoucher(disabledCompany, {
    type: 'Purchase',
    date: '2026-04-10',
    lines: [
      { ledgerId: offPurchase.id, side: 'Dr', amount: 10000 },
      { ledgerId: offSupplier.id, side: 'Cr', amount: 10000 },
    ],
    tds: { sectionId: 'tds_missing' },
  });
  assert.equal(off.ok, false);
  assert.match(off.error, /not enabled/);

  const wrongKind = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-10',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 10000 },
      { ledgerId: sales.id, side: 'Cr', amount: 10000 },
    ],
    tds: { sectionId: section(company, '194J').id },
  });
  assert.equal(wrongKind.ok, false);
  assert.match(wrongKind.error, /TDS section/);

  const split = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-10',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 10000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 6000 },
      { ledgerId: findLedgerByName(company, 'Bank').id, side: 'Cr', amount: 4000 },
    ],
    tds: { sectionId: section(company, '194J').id },
  });
  assert.equal(split.ok, false);
  assert.match(split.error, /exactly one/);

  const badPan = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-10',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 10000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 10000 },
    ],
    tds: { sectionId: section(company, '194J').id, pan: 'BADPAN' },
  });
  assert.equal(badPan.ok, false);
  assert.match(badPan.error, /PAN/);

  const journal = addVoucher(company, {
    type: 'Journal',
    date: '2026-04-10',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 10000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 10000 },
    ],
    tds: { sectionId: section(company, '194J').id },
  });
  assert.equal(journal.ok, false);
});

test('GST and TDS/TCS cannot share a voucher', () => {
  const { company, supplier, purchases } = fixture();
  const setup = saveGstSettings(company, {
    enabled: true,
    gstin: '27ABCDE1234F1Z5',
    stateCode: '27',
  });
  assert.equal(setup.ok, true, setup.error);
  const result = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-10',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 1000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 1000 },
    ],
    gst: { rateId: company.gst.rates.find((rate) => rate.rate === 18).id, placeOfSupply: '27' },
    tds: { sectionId: section(company, '194J').id },
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /both GST and TDS\/TCS/);
});

test('a 100% section cannot take the whole party amount', () => {
  const { company, supplier, purchases } = fixture();
  const added = addTdsSection(company, { kind: 'TDS', code: 'TEST100', label: 'Full rate', rate: 100, threshold: 0 });
  assert.equal(added.ok, true, added.error);
  const result = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-10',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 5000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 5000 },
    ],
    tds: { sectionId: added.section.id },
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /whole party amount/);
});

test('withholding summary reports sections, parties, quarters and thresholds', () => {
  const { company, supplier, purchases } = fixture();
  tdsPurchase(company, { supplier, purchases, base: 10000, date: '2026-04-10' });
  tdsPurchase(company, { supplier, purchases, base: 20000, date: '2026-07-10' });

  const challan = addTaxChallan(company, {
    kind: 'TDS',
    date: '2026-05-05',
    amount: 500,
    reference: 'CH-1',
    sectionId: section(company, '194J').id,
  });
  assert.equal(challan.ok, true, challan.error);

  const report = withholdingSummary(company, { kind: 'TDS', from: '2026-04-01', to: '2026-09-30' });
  assert.equal(report.count, 2);
  assert.equal(report.periodBase, 30000);
  assert.equal(report.periodAmount, 3000);
  assert.equal(report.payableToDate, 3000);
  assert.equal(report.paidToDate, 500);
  assert.equal(report.outstanding, 2500);
  assert.equal(report.sections.length, 1);
  assert.equal(report.sections[0].code, '194J');
  assert.equal(report.sections[0].base, 30000);
  assert.equal(report.parties.length, 1);
  assert.equal(report.parties[0].party, 'Consultant');
  assert.equal(report.parties[0].pan, 'ABCDE1234F');

  const q1 = report.quarters.find((entry) => entry.key === 'Q1');
  const q2 = report.quarters.find((entry) => entry.key === 'Q2');
  assert.equal(q1.amount, 1000);
  assert.equal(q2.amount, 2000);

  const threshold = report.thresholdRows.find((row) => row.code === '194J');
  assert.equal(threshold.base, 30000);
  assert.equal(threshold.threshold, 30000);
  assert.equal(threshold.crossed, true);
  assert.equal(report.challans.length, 1);
  assert.equal(report.challans[0].section.startsWith('194J'), true);
  assert.equal(report.documents[0].pan, 'ABCDE1234F');
});

test('unused sections and challans can be removed, used ones cannot', () => {
  const { company, supplier, purchases } = fixture();
  const unused = addTdsSection(company, { kind: 'TCS', code: 'TEST1', rate: 2, threshold: 0 });
  assert.equal(unused.ok, true, unused.error);
  assert.equal(addTdsSection(company, { kind: 'TCS', code: 'TEST1', rate: 2 }).ok, false);
  assert.equal(addTdsSection(company, { kind: 'TCS', code: 'TEST2', rate: 101 }).ok, false);
  assert.equal(deleteTdsSection(company, unused.section.id).ok, true);

  const voucher = tdsPurchase(company, { supplier, purchases, base: 10000 });
  const usedDelete = deleteTdsSection(company, voucher.tds.sectionId);
  assert.equal(usedDelete.ok, false);
  assert.match(usedDelete.error, /used by 1 voucher/);

  const challan = addTaxChallan(company, { kind: 'TDS', date: '2026-05-05', amount: 100 });
  assert.equal(challan.ok, true, challan.error);
  assert.equal(deleteTaxChallan(company, challan.challan.id).ok, true);
  assert.equal(company.taxChallans?.some((entry) => entry.id === challan.challan.id), false);
});

test('altering or clearing the section recomputes and removes the deduction', () => {
  const { company, supplier, purchases } = fixture();
  const voucher = tdsPurchase(company, { supplier, purchases, base: 10000 });
  assert.equal(voucher.lines.find((line) => line.ledgerId === supplier.id).amount, 9000);

  const altered = updateVoucher(company, voucher.id, {
    type: 'Purchase',
    date: voucher.date,
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 10000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 10000 },
    ],
    tds: { sectionId: section(company, '194C').id },
  });
  assert.equal(altered.ok, true, altered.error);
  assert.equal(altered.voucher.tds.code, '194C');
  assert.equal(altered.voucher.tds.amount, 200);
  assert.equal(altered.voucher.lines.find((line) => line.ledgerId === supplier.id).amount, 9800);

  const cleared = updateVoucher(company, voucher.id, {
    type: 'Purchase',
    date: voucher.date,
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 10000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 10000 },
    ],
    tds: { sectionId: '' },
  });
  assert.equal(cleared.ok, true, cleared.error);
  assert.equal(cleared.voucher.tds, undefined);
  assert.equal(cleared.voucher.total, 10000);
});

test('altering a stored TDS voucher does not duplicate its payable line', () => {
  const { company, supplier, purchases } = fixture();
  const voucher = tdsPurchase(company, { supplier, purchases, base: 10000 });
  const stored = voucher.lines.map((line) => ({ ...line }));
  const result = updateVoucher(company, voucher.id, {
    type: 'Purchase',
    date: voucher.date,
    lines: stored,
    tds: { sectionId: section(company, '194J').id },
  });
  assert.equal(result.ok, true, result.error);
  const payable = withholdingTaxLedgers(company).TDS;
  assert.equal(result.voucher.lines.filter((line) => line.ledgerId === payable.id).length, 1);
  assert.equal(result.voucher.lines.find((line) => line.ledgerId === supplier.id).amount, 9000);
  assert.equal(result.voucher.total, 10000);
});

test('stock items reconcile with the TDS/TCS base', () => {
  const { company, customer, sales } = fixture();
  const item = addStockItem(company, {
    name: 'Scrap metal',
    stockGroupId: company.stockGroups[0].id,
    unitId: company.units[0].id,
    openingQty: 50,
    openingRate: 100,
  });
  assert.equal(item.ok, true, item.error);
  const result = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-12',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1000 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
    items: [{ stockItemId: item.item.id, qty: 10, rate: 100 }],
    tds: { sectionId: section(company, '206C(1)').id },
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.voucher.total, 1010);
  assert.equal(result.voucher.tds.amount, 10);
});

test('TDS/TCS settings, sections, vouchers and challans survive a backup', () => {
  const { company, supplier, purchases } = fixture();
  tdsPurchase(company, { supplier, purchases, base: 10000 });
  addTaxChallan(company, { kind: 'TDS', date: '2026-05-05', amount: 400, reference: 'CH-9' });

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  assert.equal(copy.tds.enabled, true);
  assert.equal(copy.tds.tan, 'MUMA12345B');
  assert.equal(copy.tds.sections.length, company.tds.sections.length);
  assert.equal(copy.vouchers[0].tds.amount, 1000);
  assert.equal(copy.vouchers[0].tds.pan, 'ABCDE1234F');
  assert.equal(copy.taxChallans.length, 1);
  assert.equal(copy.taxChallans[0].reference, 'CH-9');
  assert.equal(copy.ledgers.find((ledger) => ledger.name === 'Consultant').pan, 'ABCDE1234F');
  assert.equal(withholdingTaxLedgers(copy).TDS.name, 'TDS Payable');

  const report = withholdingSummary(copy, { kind: 'TDS', from: '2026-04-01', to: '2026-09-30' });
  assert.equal(report.periodAmount, 1000);
  assert.equal(report.paidToDate, 400);
});

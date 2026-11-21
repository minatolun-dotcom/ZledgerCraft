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
  updateTdsSection,
  updateVoucher,
  withholdingTaxLedgers,
} from '../src/store.js';
import { trialBalance, withholdingReturnWorkingPaper, withholdingSummary } from '../src/accounting.js';

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

  assert.equal(
    addTaxChallan(company, { kind: 'TDS', date: '2026-05-05', amount: 500, lateFee: -1 }).ok,
    false,
  );
  const challan = addTaxChallan(company, {
    kind: 'TDS',
    date: '2026-05-05',
    amount: 500,
    lateFee: 25,
    interest: 12.5,
    reference: 'CH-1',
    sectionId: section(company, '194J').id,
  });
  assert.equal(challan.ok, true, challan.error);
  assert.equal(challan.challan.lateFee, 25);
  assert.equal(challan.challan.interest, 12.5);

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
  assert.equal(report.challans[0].lateFee, 25);
  assert.equal(report.challans[0].interest, 12.5);
  assert.equal(report.challans[0].total, 537.5);
  assert.equal(report.challanLateFee, 25);
  assert.equal(report.challanInterest, 12.5);
  assert.equal(report.challanOutlay, 537.5);
  assert.equal(report.paidToDate, 500);
  assert.equal(report.outstanding, 2500);
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

test('sections can be edited without rewriting posted deductions', () => {
  const { company, supplier, purchases } = fixture();
  const voucher = tdsPurchase(company, { supplier, purchases, base: 10000 });
  const original = section(company, '194J');
  assert.equal(voucher.tds.rate, original.rate);
  assert.equal(voucher.tds.amount, 1000);

  const edited = updateTdsSection(company, original.id, {
    label: 'Professional fees revised',
    rate: 5,
    threshold: 30000,
  });
  assert.equal(edited.ok, true, edited.error);
  assert.equal(edited.section.label, 'Professional fees revised');
  assert.equal(edited.section.rate, 5);
  assert.equal(edited.section.threshold, 30000);
  assert.equal(edited.section.code, '194J', 'the section code stays fixed');
  assert.equal(voucher.tds.rate, 10, 'a posted voucher keeps its saved rate');
  assert.equal(voucher.tds.amount, 1000);

  assert.equal(updateTdsSection(company, original.id, { rate: 101 }).ok, false);
  assert.equal(updateTdsSection(company, original.id, { threshold: -1 }).ok, false);
  assert.equal(updateTdsSection(company, 'missing', { rate: 5 }).ok, false);
  const relabelled = updateTdsSection(company, original.id, { label: '' });
  assert.equal(relabelled.ok, true, relabelled.error);
  assert.equal(relabelled.section.label, '194J');
});

test('TDS sections keep date windows and an edit history', () => {
  const { company } = fixture();
  const added = addTdsSection(company, {
    kind: 'TDS',
    code: '194Q',
    label: 'Purchase of goods',
    rate: 0.1,
    threshold: 5000000,
    effectiveFrom: '2026-04-01',
    effectiveTo: '2026-06-30',
  });
  assert.equal(added.ok, true, added.error);
  assert.equal(added.section.effectiveFrom, '2026-04-01');
  assert.equal(added.section.effectiveTo, '2026-06-30');
  assert.equal(
    addTdsSection(company, {
      kind: 'TDS',
      code: '194Q',
      rate: 0.1,
      effectiveFrom: '2026-04-01',
      effectiveTo: '2026-06-30',
    }).ok,
    false,
  );
  assert.equal(
    addTdsSection(company, {
      kind: 'TDS',
      code: '194Q',
      rate: 0.1,
      effectiveFrom: '2026-08-01',
      effectiveTo: '2026-07-01',
    }).ok,
    false,
  );

  const extended = updateTdsSection(company, added.section.id, {
    rate: 0.2,
    effectiveTo: '2026-09-30',
  });
  assert.equal(extended.ok, true, extended.error);
  assert.equal(extended.section.rate, 0.2);
  assert.equal(extended.section.effectiveTo, '2026-09-30');
  assert.equal(extended.section.history.length, 1);
  assert.equal(extended.section.history[0].rate, 0.1);
  assert.equal(extended.section.history[0].effectiveTo, '2026-06-30');
  assert.equal(updateTdsSection(company, added.section.id, { effectiveTo: '2026-03-01' }).ok, false);
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

test('per-line TDS sections aggregate deductions and exempt lines', () => {
  const { company, supplier, purchases } = fixture();
  const contractor = section(company, '194C');
  const professional = section(company, '194J');
  const created = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-12',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 1000, tdsSectionId: contractor.id },
      { ledgerId: purchases.id, side: 'Dr', amount: 500, tdsSectionId: professional.id },
      { ledgerId: purchases.id, side: 'Dr', amount: 200, tdsSectionId: '__none__' },
      { ledgerId: supplier.id, side: 'Cr', amount: 1630 },
    ],
    tds: { pan: 'ABCDE1234F' },
  });
  assert.equal(created.ok, true, created.error);
  assert.equal(created.voucher.tds.base, 1700);
  assert.equal(created.voucher.tds.amount, 70);
  assert.equal(created.voucher.tds.sections.length, 2);
  assert.equal(created.voucher.tds.sections.find((entry) => entry.code === '194C').amount, 20);
  assert.equal(created.voucher.tds.sections.find((entry) => entry.code === '194J').amount, 50);
  const summary = withholdingSummary(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(summary.periodAmount, 70);
  assert.equal(summary.sections.length, 2);
});

test('TDS return working papers split 26Q, 27Q and 27EQ by section and quarter', () => {
  const { company, supplier, customer, purchases, sales } = fixture();
  const nonResident = addTdsSection(company, {
    kind: 'TDS',
    code: '195',
    label: 'Non-resident payments',
    rate: 20,
    threshold: 0,
  });
  assert.equal(nonResident.ok, true, nonResident.error);

  tdsPurchase(company, { supplier, purchases, base: 10000, pan: 'ABCDE1234F' });
  addVoucher(company, {
    type: 'Purchase',
    date: '2026-05-10',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 5000 },
      { ledgerId: supplier.id, side: 'Cr', amount: 5000 },
    ],
    tds: { sectionId: nonResident.section.id, pan: 'ABCDE1234F' },
  });
  tcsSale(company, { customer, sales, base: 20000 });

  const form26 = withholdingReturnWorkingPaper(company, {
    form: '26Q',
    quarter: 'Q1',
    to: '2026-06-30',
  });
  assert.equal(form26.ok, true);
  assert.equal(form26.kind, 'TDS');
  assert.equal(form26.quarter, 'Q1');
  assert.equal(form26.from, '2026-04-01');
  assert.equal(form26.to, '2026-06-30');
  assert.equal(form26.rows.length, 1);
  assert.equal(form26.rows[0].section, '194J');
  assert.equal(form26.summary.base, 10000);
  assert.equal(form26.summary.tax, 1000);
  assert.equal(form26.summary.missingPan, 0);

  const form27 = withholdingReturnWorkingPaper(company, {
    form: '27Q',
    quarter: 'Q1',
    to: '2026-06-30',
  });
  assert.equal(form27.rows.length, 1);
  assert.equal(form27.rows[0].section, '195');
  assert.equal(form27.summary.tax, 1000);

  const form27eq = withholdingReturnWorkingPaper(company, {
    form: '27EQ',
    quarter: 'Q1',
    to: '2026-06-30',
  });
  assert.equal(form27eq.kind, 'TCS');
  assert.equal(form27eq.rows.length, 1);
  assert.equal(form27eq.rows[0].section, '206C(1H)');
  assert.equal(form27eq.summary.base, 20000);
  assert.equal(form27eq.summary.tax, 20);

  const noPanVendor = party(company, 'No PAN Vendor', 'sundryCreditors');
  const missingPan = addVoucher(company, {
    type: 'Purchase',
    date: '2026-06-01',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 2000 },
      { ledgerId: noPanVendor.id, side: 'Cr', amount: 2000 },
    ],
    tds: { sectionId: section(company, '194J').id, pan: '' },
  });
  assert.equal(missingPan.ok, true, missingPan.error);
  const withMissingPan = withholdingReturnWorkingPaper(company, {
    form: '26Q',
    quarter: 'Q1',
    to: '2026-06-30',
  });
  assert.equal(withMissingPan.summary.missingPan, 1);
  assert.equal(withMissingPan.rows.length, 2);
  assert.match(withMissingPan.note, /not a filed/i);
});

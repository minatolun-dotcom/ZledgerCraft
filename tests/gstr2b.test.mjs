import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLedger,
  addVoucher,
  createCompany,
  deleteGstr2bImport,
  emptyState,
  exportState,
  findLedgerByName,
  importGstr2b,
  importState,
  saveGstSettings,
} from '../src/store.js';
import { gstr2bReconciliation } from '../src/accounting.js';

function groupId(company, key) {
  return company.groups.find((group) => group.key === key).id;
}

function fixture() {
  const company = createCompany('2B Co', '2026-04-01').company;
  assert.equal(
    saveGstSettings(company, {
      enabled: true,
      gstin: '27ABCDE1234F1Z5',
      legalName: '2B Co',
      stateCode: '27',
    }).ok,
    true,
  );
  const supplier = addLedger(company, {
    name: 'Parts Supplier',
    groupId: groupId(company, 'sundryCreditors'),
    opening: 0,
    gstin: '27AAACR1234F1Z2',
    stateCode: '27',
  });
  assert.equal(supplier.ok, true, supplier.error);
  return { company, supplier: supplier.ledger };
}

function purchase(company, supplier, { ref, taxable = 1000, date = '2026-04-12' }) {
  const rate = company.gst.rates.find((entry) => entry.rate === 18);
  const result = addVoucher(company, {
    type: 'Purchase',
    date,
    bill: { ref },
    lines: [
      { ledgerId: findLedgerByName(company, 'Purchases').id, side: 'Dr', amount: taxable },
      { ledgerId: supplier.id, side: 'Cr', amount: taxable },
    ],
    gst: { rateId: rate.id, placeOfSupply: '27', partyGstin: supplier.gstin },
  });
  assert.equal(result.ok, true, result.error);
  return result.voucher;
}

function invoice({
  inum = 'INV-001',
  idt = '12-04-2026',
  taxable = 1000,
  cgst = 90,
  sgst = 90,
  igst = 0,
  val,
} = {}) {
  return {
    inum,
    idt,
    val: val ?? taxable + cgst + sgst + igst,
    pos: '27',
    rchrg: 'N',
    itms: [
      {
        num: 1,
        itm_det: { rt: 18, txval: taxable, iamt: igst, camt: cgst, samt: sgst, csamt: 0 },
      },
    ],
  };
}

function payload(invoices = [invoice()], period = '042026') {
  return {
    gstin: '27ABCDE1234F1Z5',
    rtnprd: period,
    b2b: [{ ctin: '27AAACR1234F1Z2', cfs: 'N', inv: invoices }],
  };
}

test('GSTR-2B import validates the recipient and normalises B2B invoices', () => {
  const { company } = fixture();
  assert.equal(importGstr2b(company, { json: '{bad' }).ok, false);
  assert.equal(importGstr2b(company, { json: { ...payload(), gstin: '29ABCDE1234F1Z5' } }).ok, false);
  assert.equal(importGstr2b(company, { json: { ...payload(), rtnprd: '' } }).ok, false);

  const result = importGstr2b(company, { json: JSON.stringify(payload()), sourceName: 'April 2B' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.import.period, '2026-04');
  assert.equal(result.import.gstin, '27ABCDE1234F1Z5');
  assert.equal(result.import.invoices.length, 1);
  const imported = result.import.invoices[0];
  assert.equal(imported.ctin, '27AAACR1234F1Z2');
  assert.equal(imported.inum, 'INV-001');
  assert.equal(imported.idt, '2026-04-12');
  assert.equal(imported.taxable, 1000);
  assert.equal(imported.cgst, 90);
  assert.equal(imported.sgst, 90);
  assert.equal(imported.taxTotal, 180);
  assert.equal(imported.value, 1180);
  assert.equal(company.gst.gstr2bImports.length, 1);

  // A second import for the same period replaces the first instead of duplicating it.
  const replacement = importGstr2b(company, { json: payload([invoice({ inum: 'INV-002' })]) });
  assert.equal(replacement.ok, true, replacement.error);
  assert.equal(company.gst.gstr2bImports.length, 1);
  assert.equal(company.gst.gstr2bImports[0].invoices[0].inum, 'INV-002');

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.companies[0].gst.gstr2bImports.length, 1);
  assert.equal(restored.state.companies[0].gst.gstr2bImports[0].invoices[0].inum, 'INV-002');
});

test('GSTR-2B reconciliation matches purchases and reports both sides of a gap', () => {
  const { company, supplier } = fixture();
  purchase(company, supplier, { ref: 'INV-001' });
  purchase(company, supplier, { ref: 'INV-002', taxable: 5000, date: '2026-04-18' });
  purchase(company, supplier, { ref: 'INV-003', taxable: 2000, date: '2026-04-20' });
  assert.equal(
    importGstr2b(company, {
      json: payload([
        invoice(),
        invoice({ inum: 'INV-002', taxable: 4000, cgst: 360, sgst: 360, val: 4720 }),
        invoice({ inum: 'INV-004', taxable: 700, cgst: 63, sgst: 63, val: 826 }),
      ]),
    }).ok,
    true,
  );

  const report = gstr2bReconciliation(company, { period: '2026-04' });
  assert.equal(report.available, true);
  assert.equal(report.summary.invoiceCount, 3);
  assert.equal(report.summary.bookCount, 3);
  assert.equal(report.summary.matchedCount, 1);
  assert.equal(report.summary.mismatchCount, 1);
  assert.equal(report.summary.missingInBooksCount, 1);
  assert.equal(report.summary.missingIn2bCount, 1);
  assert.equal(report.summary.tax2b, 1026);
  assert.equal(report.summary.taxBooks, 1440);
  assert.equal(report.summary.matchedTax, 180);

  const matched = report.rows.find((row) => row.inum === 'INV-001');
  assert.equal(matched.status, 'Matched');
  assert.equal(matched.book.ref, 'INV-001');
  assert.equal(matched.atRisk, 0);

  const mismatch = report.rows.find((row) => row.inum === 'INV-002');
  assert.equal(mismatch.status, 'Value differs');
  assert.equal(mismatch.book.taxable, 5000);
  assert.equal(mismatch.difference.taxable, -1000);
  assert.equal(mismatch.atRisk, 0);

  const missing = report.rows.find((row) => row.inum === 'INV-004');
  assert.equal(missing.status, 'Missing in books');
  assert.equal(missing.atRisk, 126);

  assert.equal(report.missingIn2b.length, 1);
  assert.equal(report.missingIn2b[0].ref, 'INV-003');
  assert.equal(report.summary.atRisk, 486);
});

test('GSTR-2B reconciliation handles an empty import and deletion', () => {
  const { company } = fixture();
  const empty = importGstr2b(company, { json: payload([]) });
  assert.equal(empty.ok, true, empty.error);
  const report = gstr2bReconciliation(company, { period: '2026-04' });
  assert.equal(report.available, true);
  assert.equal(report.rows.length, 0);
  assert.equal(report.summary.invoiceCount, 0);
  assert.equal(deleteGstr2bImport(company, empty.import.id).ok, true);
  assert.equal(company.gst.gstr2bImports.length, 0);
  assert.equal(gstr2bReconciliation(company, { period: '2026-04' }).available, false);
});

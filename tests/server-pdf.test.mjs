import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReportPdf } from '../server-pdf.js';

const baseReport = {
  generatedAt: '2026-11-19T12:00:00.000Z',
  generatedDate: '2026-11-19',
  companies: [
    {
      id: 'co_reports',
      name: 'Report Books',
      asOn: '2026-11-19',
      sales: 1180,
      purchases: 240,
      cashBank: 1180,
      receivables: 500,
      payables: 240,
      vouchersToday: 1,
      balanced: true,
      difference: 0,
    },
  ],
  totals: {
    sales: 1180,
    purchases: 240,
    cashBank: 1180,
    receivables: 500,
    payables: 240,
    vouchersToday: 1,
    balanced: 1,
    unbalanced: 0,
  },
  backup: {
    name: 'workspace-20261119-120000-daily.json',
    createdAt: '2026-11-19T12:00:00.000Z',
    offsite: true,
  },
  recipients: [],
};

test('daily report PDF is branded and self-contained', () => {
  const pdf = buildReportPdf(baseReport);
  const raw = pdf.toString('latin1');
  assert.ok(pdf.length > 1500);
  assert.match(raw, /^%PDF-1\.4/);
  assert.match(raw, /ZledgerCraft/);
  assert.match(raw, /Daily management summary/);
  assert.match(raw, /Report Books/);
  assert.match(raw, /INR 1,180\.00/);
  assert.match(raw, /workspace-20261119-120000-daily\.json/);
  assert.match(raw, /startxref\n\d+\n%%EOF/);
});

test('daily report PDF paginates large company lists', () => {
  const report = {
    ...baseReport,
    companies: Array.from({ length: 48 }, (_, index) => ({
      ...baseReport.companies[0],
      id: `co_${index}`,
      name: `Company ${index + 1}`,
    })),
  };
  const raw = buildReportPdf(report).toString('latin1');
  const count = Number(raw.match(/\/Count (\d+)/)?.[1]);
  assert.ok(count >= 2, `expected multiple pages, got ${count}`);
  assert.match(raw, /Company 48/);
  assert.match(raw, /Page 1 of \d+/);
});

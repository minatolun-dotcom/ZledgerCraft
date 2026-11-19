import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDailyReport,
  createReportToken,
  normalizeRecipients,
  reportHtml,
  reportText,
  verifyReportToken,
} from '../server-reports.js';

const state = {
  companies: [
    {
      id: 'co_report',
      name: 'Report Books',
      fyStart: '2026-04-01',
      fyEnd: '2027-03-31',
      groups: [
        { id: 'currentAssets', key: 'currentAssets', name: 'Current Assets', parentId: null },
        { id: 'cash', key: 'cash', name: 'Cash-in-Hand', parentId: 'currentAssets' },
        { id: 'sales', key: 'sales', name: 'Sales Accounts', parentId: null },
      ],
      ledgers: [
        { id: 'cash', name: 'Cash', groupId: 'cash', opening: 0, openingType: 'Dr' },
        { id: 'sales', name: 'Sales', groupId: 'sales', opening: 0, openingType: 'Cr' },
      ],
      vouchers: [
        {
          id: 'v1',
          date: '2026-11-19',
          type: 'Sales',
          total: 1180,
          lines: [
            { ledgerId: 'cash', side: 'Dr', amount: 1180 },
            { ledgerId: 'sales', side: 'Cr', amount: 1180 },
          ],
        },
      ],
    },
  ],
};

test('report links are signed, scoped and expire', () => {
  const token = createReportToken('test-secret', { now: 1_700_000_000_000, ttlMs: 60_000 });
  assert.equal(verifyReportToken('test-secret', token, { now: 1_700_000_030_000 }).ok, true);
  assert.equal(verifyReportToken('wrong-secret', token, { now: 1_700_000_030_000 }).ok, false);
  assert.equal(verifyReportToken('test-secret', `${token}x`, { now: 1_700_000_030_000 }).ok, false);
  const expired = verifyReportToken('test-secret', token, { now: 1_700_000_061_000 });
  assert.equal(expired.ok, false);
  assert.equal(expired.reason, 'expired');
});

test('recipient parsing normalizes and rejects bad addresses', () => {
  assert.deepEqual(normalizeRecipients('OWNER@example.com, books@example.com').recipients, [
    'owner@example.com',
    'books@example.com',
  ]);
  assert.equal(normalizeRecipients('not-an-email').ok, false);
  assert.equal(normalizeRecipients('a@example.com,b@example.com,c@example.com,d@example.com,e@example.com,f@example.com,g@example.com,h@example.com,i@example.com,j@example.com,k@example.com').ok, false);
});

test('daily report summarizes sales, cash, receivables and trial balance', () => {
  const report = buildDailyReport(state, { now: new Date('2026-11-19T12:00:00Z') });
  assert.equal(report.companies.length, 1);
  assert.equal(report.companies[0].name, 'Report Books');
  assert.equal(report.companies[0].sales, 1180);
  assert.equal(report.companies[0].cashBank, 1180);
  assert.equal(report.companies[0].balanced, true);
  assert.equal(report.totals.vouchersToday, 1);
  assert.match(reportText(report), /Report Books/);
  assert.match(reportHtml(report), /ZledgerCraft daily summary/);
});

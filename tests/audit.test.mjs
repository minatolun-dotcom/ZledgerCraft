import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditEntries,
  createCompany,
  emptyState,
  exportState,
  importState,
  normalizeAudit,
  recordAudit,
} from '../src/store.js';

test('audit entries are appended, timestamped and returned newest first', () => {
  const state = emptyState();
  const first = recordAudit(state, {
    action: 'company.create',
    summary: 'Created company "Audit Co".',
    companyId: 'co_1',
    companyName: 'Audit Co',
    entity: 'Audit Co',
  });
  const second = recordAudit(state, {
    action: 'voucher.create',
    summary: 'Created Sales 1.',
    companyId: 'co_1',
    companyName: 'Audit Co',
  });
  assert.equal(state.audit.length, 2);
  assert.match(first.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(second.id, /^aud_/);
  assert.deepEqual(auditEntries(state).map((entry) => entry.id), [second.id, first.id]);
  assert.equal(recordAudit(state, { action: 'noop', summary: '   ' }), null);
  assert.equal(state.audit.length, 2, 'blank events are not recorded');
});

test('import normalizes audit history and does not invent a missing log', () => {
  const { company } = createCompany('Audit Backup Co', '2026-04-01');
  const state = {
    version: 1,
    activeCompanyId: company.id,
    companies: [company],
    audit: [
      {
        id: 'aud_1',
        at: '2026-04-01T10:00:00.000Z',
        action: 'company.create',
        summary: 'Created company.',
        companyId: company.id,
        companyName: company.name,
      },
      { action: 'voucher.create', summary: 'Created Sales 1.', at: 'not-a-date' },
      { action: 'bad' },
    ],
  };
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  assert.equal(restored.state.audit.length, 2);
  assert.equal(restored.state.audit[0].id, 'aud_1');
  assert.match(restored.state.audit[1].at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(restored.state.audit[1].summary, 'Created Sales 1.');

  const withoutAudit = { ...state };
  delete withoutAudit.audit;
  const older = importState(exportState(withoutAudit));
  assert.equal(older.ok, true, older.error);
  assert.deepEqual(older.state.audit, [], 'older backups load without a synthetic log');
});

test('normalizeAudit sorts entries chronologically and caps oversized text', () => {
  const entries = normalizeAudit([
    { id: 'b', at: '2026-05-02T00:00:00.000Z', action: 'voucher.create', summary: 'Later' },
    { id: 'a', at: '2026-05-01T00:00:00.000Z', action: 'voucher.update', summary: 'x'.repeat(900) },
  ]);
  assert.deepEqual(entries.map((entry) => entry.id), ['a', 'b']);
  assert.equal(entries[0].summary.length, 500);
});

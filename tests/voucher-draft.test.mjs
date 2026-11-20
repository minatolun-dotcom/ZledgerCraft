import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const { readVoucherDraft, clearVoucherDraft } = await import('../src/ui.js');

const company = { id: 'co-draft' };

test('an unsaved voucher draft is read back only for its company and type', () => {
  store.clear();
  const snapshot = {
    type: 'Sales',
    date: '2026-04-10',
    narration: 'Half entered',
    lines: [{ ledgerId: 'led1', side: 'Dr', amount: 100 }],
    items: [{ stockItemId: 'item1', qty: 2, rate: 50 }],
  };
  localStorage.setItem(`zc.voucherDraft.${company.id}.Sales`, JSON.stringify(snapshot));

  assert.deepEqual(readVoucherDraft(company, 'Sales'), snapshot);
  assert.equal(readVoucherDraft(company, 'Purchase'), null);
  assert.equal(readVoucherDraft({ id: 'other' }, 'Sales'), null);
  assert.equal(readVoucherDraft(null, 'Sales'), null);
});

test('an unsaved alteration draft is kept separate from a new voucher draft', () => {
  store.clear();
  const created = { type: 'Sales', narration: 'new', lines: [] };
  const altered = { type: 'Sales', narration: 'edit', lines: [] };
  localStorage.setItem(`zc.voucherDraft.${company.id}.Sales`, JSON.stringify(created));
  localStorage.setItem(`zc.voucherDraft.${company.id}.Sales.v1`, JSON.stringify(altered));
  assert.deepEqual(readVoucherDraft(company, 'Sales'), created);
  assert.deepEqual(readVoucherDraft(company, 'Sales', 'v1'), altered);
  clearVoucherDraft(company, 'Sales', 'v1');
  assert.equal(readVoucherDraft(company, 'Sales', 'v1'), null);
  assert.deepEqual(readVoucherDraft(company, 'Sales'), created);
});

test('corrupt, oversized or mismatched drafts are ignored', () => {
  store.clear();
  localStorage.setItem(`zc.voucherDraft.${company.id}.Sales`, '{not json');
  assert.equal(readVoucherDraft(company, 'Sales'), null);

  localStorage.setItem(
    `zc.voucherDraft.${company.id}.Sales`,
    JSON.stringify({ type: 'Purchase', lines: [] }),
  );
  assert.equal(readVoucherDraft(company, 'Sales'), null);

  localStorage.setItem(
    `zc.voucherDraft.${company.id}.Sales`,
    JSON.stringify({ type: 'Sales', lines: [], narration: 'x'.repeat(200001) }),
  );
  assert.equal(readVoucherDraft(company, 'Sales'), null);
});

test('saving or discarding clears the stored draft', () => {
  store.clear();
  const key = `zc.voucherDraft.${company.id}.Payment`;
  localStorage.setItem(key, JSON.stringify({ type: 'Payment', lines: [] }));
  assert.ok(readVoucherDraft(company, 'Payment'));
  clearVoucherDraft(company, 'Payment');
  assert.equal(readVoucherDraft(company, 'Payment'), null);
  assert.equal(store.size, 0);
});

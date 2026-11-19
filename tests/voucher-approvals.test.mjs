import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addVoucher,
  approvePendingVoucher,
  createCompany,
  deletePendingVoucher,
  rejectPendingVoucher,
  updateCompany,
} from '../src/store.js';
import { dayBook } from '../src/accounting.js';

function makeCompany() {
  const result = createCompany('Approval Traders', '2026-04-01');
  assert.equal(result.ok, true, result.error);
  return result.company;
}

function pendingSale(company, submittedBy, amount = 1180) {
  const cash = company.ledgers.find((ledger) => ledger.name === 'Cash').id;
  const sales = company.ledgers.find((ledger) => ledger.name === 'Sales').id;
  return addVoucher(company, {
    type: 'Sales',
    date: '2026-04-15',
    narration: 'Awaiting approval',
    pending: true,
    submittedBy,
    lines: [
      { ledgerId: cash, side: 'Dr', amount },
      { ledgerId: sales, side: 'Cr', amount },
    ],
  });
}

test('pending vouchers stay out of the books until an owner approves them', () => {
  const company = makeCompany();
  company.approvalsRequired = true;
  const submitted = pendingSale(company, { id: 'user_a', username: 'books', name: 'Books' });
  assert.equal(submitted.ok, true, submitted.error);
  assert.equal(submitted.pending, true);
  assert.equal(company.vouchers.length, 0);
  assert.equal(company.pendingVouchers.length, 1);
  assert.equal(company.pendingVouchers[0].status, 'pending');
  assert.equal(company.pendingVouchers[0].no, null);
  assert.equal(dayBook(company).length, 0);
  assert.equal(company.counters.Sales, undefined);

  const self = approvePendingVoucher(company, submitted.voucher.id, { id: 'user_a', username: 'books' });
  assert.equal(self.ok, false);
  assert.match(self.error, /cannot approve a voucher you submitted/i);

  const approved = approvePendingVoucher(company, submitted.voucher.id, {
    id: 'user_owner',
    username: 'owner',
    name: 'Owner',
  });
  assert.equal(approved.ok, true, approved.error);
  assert.equal(company.pendingVouchers.length, 0);
  assert.equal(company.vouchers.length, 1);
  assert.equal(company.vouchers[0].no, 1);
  assert.equal(company.vouchers[0].approval.status, 'approved');
  assert.equal(company.vouchers[0].approval.approvedBy.id, 'user_owner');
  assert.equal(company.vouchers[0].submittedBy.id, 'user_a');
  assert.equal(dayBook(company).length, 1);
});

test('rejected vouchers never post and can be removed from the queue', () => {
  const company = makeCompany();
  company.approvalsRequired = true;
  const submitted = pendingSale(company, { id: 'user_a', username: 'books', name: 'Books' }, 500);
  const rejected = rejectPendingVoucher(
    company,
    submitted.voucher.id,
    { id: 'user_owner', username: 'owner', name: 'Owner' },
    'Wrong date',
  );
  assert.equal(rejected.ok, true, rejected.error);
  assert.equal(company.vouchers.length, 0);
  assert.equal(company.pendingVouchers[0].status, 'rejected');
  assert.equal(company.pendingVouchers[0].rejectionNote, 'Wrong date');
  assert.equal(dayBook(company).length, 0);
  assert.equal(deletePendingVoucher(company, submitted.voucher.id).ok, true);
  assert.equal(company.pendingVouchers.length, 0);
});

test('company approval policy is explicit and defaults off', () => {
  const company = makeCompany();
  assert.equal(company.approvalsRequired, false);
  updateCompany(company, { name: company.name, fyStart: company.fyStart, requireApproval: true });
  assert.equal(company.approvalsRequired, true);
  updateCompany(company, { name: company.name, fyStart: company.fyStart, requireApproval: false });
  assert.equal(company.approvalsRequired, false);
});

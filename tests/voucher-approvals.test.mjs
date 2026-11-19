import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addVoucher,
  approvalRequiredForAmount,
  approvePendingVoucher,
  createCompany,
  deletePendingVoucher,
  rejectPendingVoucher,
  updateCompany,
  updatePendingVoucher,
  withdrawPendingVoucher,
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

test('submitters can revise or withdraw their own pending voucher', () => {
  const company = makeCompany();
  company.approvalsRequired = true;
  const submittedBy = { id: 'user_a', username: 'books', name: 'Books' };
  const submitted = pendingSale(company, submittedBy, 500);
  const cash = company.ledgers.find((ledger) => ledger.name === 'Cash').id;
  const sales = company.ledgers.find((ledger) => ledger.name === 'Sales').id;
  const submittedAt = submitted.voucher.submittedAt;

  const other = updatePendingVoucher(
    company,
    submitted.voucher.id,
    { narration: 'Not mine' },
    { id: 'user_b', username: 'other' },
  );
  assert.equal(other.ok, false);
  assert.match(other.error, /submitted this voucher/i);

  const revised = updatePendingVoucher(
    company,
    submitted.voucher.id,
    {
      type: 'Sales',
      date: '2026-04-16',
      narration: 'Corrected before approval',
      lines: [
        { ledgerId: cash, side: 'Dr', amount: 600 },
        { ledgerId: sales, side: 'Cr', amount: 600 },
      ],
    },
    submittedBy,
  );
  assert.equal(revised.ok, true, revised.error);
  assert.equal(company.pendingVouchers.length, 1);
  assert.equal(company.vouchers.length, 0);
  assert.equal(company.pendingVouchers[0].total, 600);
  assert.equal(company.pendingVouchers[0].narration, 'Corrected before approval');
  assert.equal(company.pendingVouchers[0].submittedAt, submittedAt);
  assert.ok(company.pendingVouchers[0].editedAt);
  assert.equal(company.pendingVouchers[0].revisions.length, 1);
  assert.equal(company.pendingVouchers[0].revisions[0].by.id, submittedBy.id);
  const changedFields = company.pendingVouchers[0].revisions[0].changes.map((change) => change.field);
  assert.ok(changedFields.includes('date'));
  assert.ok(changedFields.includes('narration'));
  assert.ok(changedFields.includes('total'));
  assert.ok(changedFields.includes('lines'));
  assert.equal(dayBook(company).length, 0);

  const approved = approvePendingVoucher(company, submitted.voucher.id, {
    id: 'user_owner',
    username: 'owner',
    name: 'Owner',
  });
  assert.equal(approved.ok, true, approved.error);
  assert.equal(company.vouchers[0].total, 600);

  const second = pendingSale(company, submittedBy, 250);
  assert.equal(
    withdrawPendingVoucher(company, second.voucher.id, { id: 'user_b', username: 'other' }).ok,
    false,
  );
  const withdrawn = withdrawPendingVoucher(company, second.voucher.id, submittedBy);
  assert.equal(withdrawn.ok, true, withdrawn.error);
  assert.equal(company.pendingVouchers.length, 0);
  assert.equal(company.vouchers.length, 1);
  assert.equal(dayBook(company).length, 1);
});

test('company approval policy is explicit and defaults off', () => {
  const company = makeCompany();
  assert.equal(company.approvalsRequired, false);
  assert.equal(company.approvalThreshold, 0);
  assert.equal(approvalRequiredForAmount(company, 500), false);
  updateCompany(company, { name: company.name, fyStart: company.fyStart, requireApproval: true });
  assert.equal(company.approvalsRequired, true);
  assert.equal(approvalRequiredForAmount(company, 0), true);
  const threshold = updateCompany(company, {
    name: company.name,
    fyStart: company.fyStart,
    requireApproval: true,
    approvalThreshold: 5000,
  });
  assert.equal(threshold.ok, true, threshold.error);
  assert.equal(company.approvalThreshold, 5000);
  assert.equal(approvalRequiredForAmount(company, 4999.99), false);
  assert.equal(approvalRequiredForAmount(company, 5000), true);
  assert.equal(
    updateCompany(company, {
      name: company.name,
      fyStart: company.fyStart,
      requireApproval: true,
      approvalThreshold: -1,
    }).ok,
    false,
  );
  updateCompany(company, { name: company.name, fyStart: company.fyStart, requireApproval: false });
  assert.equal(company.approvalsRequired, false);
});

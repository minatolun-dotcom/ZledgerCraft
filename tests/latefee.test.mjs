import assert from 'node:assert/strict';
import test from 'node:test';
import { gstLateFee, gstReturnDueDate } from '../src/accounting.js';

test('GST return due dates follow the monthly and annual calendars', () => {
  assert.equal(gstReturnDueDate('GSTR-1', '2026-04'), '2026-05-11');
  assert.equal(gstReturnDueDate('GSTR-3B', '2026-04'), '2026-05-20');
  assert.equal(gstReturnDueDate('GSTR-1', '2026-12'), '2027-01-11');
  assert.equal(gstReturnDueDate('GSTR-9', '2026-03'), '2026-12-31');
  assert.equal(gstReturnDueDate('GSTR-9', '2026-04'), '2027-12-31');
  assert.equal(gstReturnDueDate('GSTR-3B', 'bad'), '');
});

test('late GSTR-3B calculates daily late fee and 18% simple interest', () => {
  const result = gstLateFee({
    returnType: 'GSTR-3B',
    period: '2026-04',
    filedDate: '2026-05-25',
    taxAmount: 10000,
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.dueDate, '2026-05-20');
  assert.equal(result.daysLate, 5);
  assert.equal(result.ratePerDay, 50);
  assert.equal(result.lateFee, 250);
  assert.equal(result.interest, 24.66);
  assert.equal(result.total, 274.66);
});

test('nil returns use the lower daily rate and cap', () => {
  const nil = gstLateFee({
    returnType: 'GSTR-3B',
    period: '2026-04',
    filedDate: '2026-06-30',
    nil: true,
    taxAmount: 5000,
  });
  assert.equal(nil.lateFee, 820);
  assert.equal(nil.interest, 0);
  assert.equal(nil.cap, 2000);

  const capped = gstLateFee({
    returnType: 'GSTR-1',
    dueDate: '2026-05-11',
    filedDate: '2026-08-31',
  });
  assert.equal(capped.daysLate, 112);
  assert.equal(capped.lateFee, 5000);
  assert.equal(capped.interest, 0);
});

test('GSTR-1 has no interest and GSTR-9 uses turnover for its cap', () => {
  const gstr1 = gstLateFee({
    returnType: 'GSTR-1',
    period: '2026-04',
    filedDate: '2026-05-12',
    taxAmount: 50000,
  });
  assert.equal(gstr1.daysLate, 1);
  assert.equal(gstr1.lateFee, 50);
  assert.equal(gstr1.interest, 0);

  const missingTurnover = gstLateFee({
    returnType: 'GSTR-9',
    period: '2026-03',
    filedDate: '2027-01-10',
    taxAmount: 1000,
  });
  assert.equal(missingTurnover.ok, false);

  const gstr9 = gstLateFee({
    returnType: 'GSTR-9',
    period: '2026-03',
    filedDate: '2027-01-10',
    taxAmount: 1000,
    annualTurnover: 1000000,
  });
  assert.equal(gstr9.ok, true, gstr9.error);
  assert.equal(gstr9.dueDate, '2026-12-31');
  assert.equal(gstr9.daysLate, 10);
  assert.equal(gstr9.ratePerDay, 200);
  assert.equal(gstr9.cap, 5000);
  assert.equal(gstr9.lateFee, 2000);
  assert.equal(gstr9.interest, 4.93);
});

test('on-time and unfiled returns are handled without negative days', () => {
  const onTime = gstLateFee({
    returnType: 'GSTR-3B',
    dueDate: '2026-05-20',
    filedDate: '2026-05-20',
    taxAmount: 1000,
  });
  assert.equal(onTime.daysLate, 0);
  assert.equal(onTime.total, 0);

  const unfiled = gstLateFee({
    returnType: 'GSTR-1',
    dueDate: '2026-05-11',
    filedDate: '',
    taxAmount: 1000,
  });
  assert.equal(unfiled.ok, true, unfiled.error);
  assert.ok(unfiled.daysLate >= 0);
  assert.equal(unfiled.interest, 0);

  assert.equal(gstLateFee({ dueDate: 'not-a-date' }).ok, false);
});

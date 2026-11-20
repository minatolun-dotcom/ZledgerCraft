import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCurrency,
  addCurrencyRate,
  addLedger,
  addVoucher,
  createCompany,
  deleteCurrency,
  deleteCurrencyRate,
  exportState,
  findLedgerByName,
  importState,
  normalizeCurrencies,
  rateForCurrency,
  updateCurrencyRate,
} from '../src/store.js';
import { forexRevaluation } from '../src/accounting.js';

function currencyFixture() {
  const company = createCompany('Forex Co', '2026-04-01').company;
  const customer = addLedger(company, {
    name: 'Acme Global',
    groupId: company.groups.find((group) => group.key === 'sundryDebtors').id,
    opening: 0,
  }).ledger;
  const supplier = addLedger(company, {
    name: 'Euro Supplies',
    groupId: company.groups.find((group) => group.key === 'sundryCreditors').id,
    opening: 0,
  }).ledger;
  const sales = findLedgerByName(company, 'Sales');
  const purchase = findLedgerByName(company, 'Purchases');
  return { company, customer, supplier, sales, purchase };
}

function usd(company, date = '2026-04-01', rate = 83) {
  return addCurrency(company, {
    code: 'usd',
    name: 'US Dollar',
    symbol: '$',
    date,
    rate,
  });
}

function stateFor(company) {
  return { version: 1, activeCompanyId: company.id, companies: [company] };
}

test('currency masters validate codes, names and dated rates', () => {
  const { company } = currencyFixture();
  assert.deepEqual(company.currencies, []);

  const created = usd(company);
  assert.equal(created.ok, true, created.error);
  assert.equal(company.currencies.length, 1);
  assert.equal(company.currencies[0].code, 'USD');
  assert.equal(company.currencies[0].rates[0].rate, 83);
  assert.equal(rateForCurrency(company, 'usd', '2026-04-01'), 83);
  assert.equal(rateForCurrency(company, 'USD', '2026-03-31'), null);
  assert.equal(rateForCurrency(company, 'INR', '2026-03-31'), 1);

  assert.equal(addCurrency(company, { code: 'USD', name: 'Duplicate', date: '2026-04-01', rate: 1 }).ok, false);
  assert.equal(addCurrency(company, { code: 'INR', name: 'Rupee', date: '2026-04-01', rate: 1 }).ok, false);
  assert.equal(addCurrency(company, { code: 'EU', name: 'Euro', date: '2026-04-01', rate: 0 }).ok, false);
  assert.equal(addCurrency(company, { code: 'GBP', name: 'Pound', date: 'not-a-date', rate: 100 }).ok, false);

  const later = addCurrencyRate(company, 'USD', { date: '2026-04-10', rate: 84 });
  assert.equal(later.ok, true, later.error);
  assert.equal(rateForCurrency(company, 'USD', '2026-04-09'), 83);
  assert.equal(rateForCurrency(company, 'USD', '2026-04-10'), 84);
  assert.equal(addCurrencyRate(company, 'USD', { date: '2026-04-10', rate: 85 }).ok, false);
  assert.equal(addCurrencyRate(company, 'USD', { date: '2026-04-11', rate: -1 }).ok, false);
});

test('dated exchange rates can be edited, redated and deleted', () => {
  const { company } = currencyFixture();
  usd(company);
  addCurrencyRate(company, 'USD', { date: '2026-04-10', rate: 84 });

  const edited = updateCurrencyRate(company, 'USD', '2026-04-10', { rate: 85 });
  assert.equal(edited.ok, true, edited.error);
  assert.equal(rateForCurrency(company, 'USD', '2026-04-10'), 85);
  assert.equal(rateForCurrency(company, 'USD', '2026-04-09'), 83, 'the earlier rate is untouched');

  const redated = updateCurrencyRate(company, 'USD', '2026-04-10', { date: '2026-04-12', rate: 86 });
  assert.equal(redated.ok, true, redated.error);
  assert.equal(rateForCurrency(company, 'USD', '2026-04-11'), 83);
  assert.equal(rateForCurrency(company, 'USD', '2026-04-12'), 86);
  assert.deepEqual(
    company.currencies[0].rates.map((entry) => entry.date),
    ['2026-04-01', '2026-04-12'],
    'rates stay sorted by date',
  );

  const clash = updateCurrencyRate(company, 'USD', '2026-04-12', { date: '2026-04-01' });
  assert.equal(clash.ok, false);
  assert.match(clash.error, /already exists/);
  assert.equal(updateCurrencyRate(company, 'USD', '2026-04-12', { date: 'nope' }).ok, false);
  assert.equal(updateCurrencyRate(company, 'USD', '2026-04-12', { rate: 0 }).ok, false);
  assert.equal(updateCurrencyRate(company, 'USD', '2026-05-01', { rate: 90 }).ok, false);
  assert.equal(updateCurrencyRate(company, 'INR', '2026-04-01', { rate: 2 }).ok, false);

  const removed = deleteCurrencyRate(company, 'USD', '2026-04-12');
  assert.equal(removed.ok, true, removed.error);
  assert.equal(rateForCurrency(company, 'USD', '2026-04-12'), 83);
  assert.equal(deleteCurrencyRate(company, 'USD', '2026-04-12').ok, false);
  assert.equal(deleteCurrencyRate(company, 'INR', '2026-04-01').ok, false);
});

test('a foreign voucher stores base amounts and its currency detail', () => {
  const { company, customer, sales } = currencyFixture();
  usd(company);
  const created = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-05',
    currencyCode: 'USD',
    exchangeRate: 83,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1000 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
  });
  assert.equal(created.ok, true, created.error);
  const voucher = created.voucher;
  assert.equal(voucher.total, 83000);
  assert.equal(voucher.currencyCode, 'USD');
  assert.equal(voucher.exchangeRate, 83);
  assert.equal(voucher.currencyTotal, 1000);
  assert.equal(voucher.lines[0].amount, 83000);
  assert.equal(voucher.lines[0].currencyAmount, 1000);

  addCurrency(company, {
    code: 'GBP',
    name: 'Pound Sterling',
    symbol: '£',
    date: '2026-04-10',
    rate: 108,
  });
  const before = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-05',
    currencyCode: 'GBP',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 10 },
      { ledgerId: sales.id, side: 'Cr', amount: 10 },
    ],
  });
  assert.equal(before.ok, false);
  assert.match(before.error, /exchange rate/i);
});

test('forex revaluation revalues asset balances and excludes profit and loss', () => {
  const { company, customer, sales } = currencyFixture();
  usd(company);
  addCurrencyRate(company, 'USD', { date: '2026-04-10', rate: 84 });
  addVoucher(company, {
    type: 'Sales',
    date: '2026-04-05',
    currencyCode: 'USD',
    exchangeRate: 83,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1000 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
  });

  const atBook = forexRevaluation(company, { asOn: '2026-04-09' });
  assert.equal(atBook.rows.length, 1);
  assert.equal(atBook.rows[0].ledger, 'Acme Global');
  assert.equal(atBook.rows[0].bookBalance, 83000);
  assert.equal(atBook.rows[0].revalued, 83000);
  assert.equal(atBook.rows[0].difference, 0);
  assert.equal(atBook.gain, 0);
  assert.equal(atBook.loss, 0);

  const later = forexRevaluation(company, { asOn: '2026-04-10' });
  assert.equal(later.rows.length, 1, 'sales is a P&L ledger and must not be revalued');
  assert.equal(later.rows[0].rate, 84);
  assert.equal(later.rows[0].revalued, 84000);
  assert.equal(later.rows[0].gain, 1000);
  assert.equal(later.gain, 1000);
  assert.equal(later.net, 1000);
  assert.deepEqual(later.currencies, ['USD']);

  assert.equal(forexRevaluation(company, { asOn: '2026-04-04' }).rows.length, 0);
});

test('forex revaluation shows a loss on a foreign creditor when the rate rises', () => {
  const { company, supplier, purchase } = currencyFixture();
  usd(company);
  addCurrencyRate(company, 'USD', { date: '2026-04-10', rate: 84 });
  addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-06',
    currencyCode: 'USD',
    exchangeRate: 83,
    lines: [
      { ledgerId: purchase.id, side: 'Dr', amount: 500 },
      { ledgerId: supplier.id, side: 'Cr', amount: 500 },
    ],
  });

  const report = forexRevaluation(company, { asOn: '2026-04-10' });
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].foreignBalance, -500);
  assert.equal(report.rows[0].bookBalance, -41500);
  assert.equal(report.rows[0].revalued, -42000);
  assert.equal(report.rows[0].loss, 500);
  assert.equal(report.net, -500);
});

test('foreign vouchers reject unknown currencies and bill allocations', () => {
  const { company, customer, sales } = currencyFixture();
  const missing = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-05',
    currencyCode: 'USD',
    exchangeRate: 83,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 10 },
      { ledgerId: sales.id, side: 'Cr', amount: 10 },
    ],
  });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /not set up/i);

  usd(company);
  const allocated = addVoucher(company, {
    type: 'Receipt',
    date: '2026-04-05',
    currencyCode: 'USD',
    exchangeRate: 83,
    lines: [
      { ledgerId: customer.id, side: 'Cr', amount: 10, allocations: [{ voucherId: 'bill', amount: 10 }] },
      { ledgerId: sales.id, side: 'Dr', amount: 10 },
    ],
  });
  assert.equal(allocated.ok, false);
  assert.match(allocated.error, /bill-wise/i);
});

test('currency masters and foreign vouchers survive a backup round trip', () => {
  const { company, customer, sales } = currencyFixture();
  usd(company);
  addVoucher(company, {
    type: 'Sales',
    date: '2026-04-05',
    currencyCode: 'USD',
    exchangeRate: 83,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1000 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
  });

  const restored = importState(exportState(stateFor(company)));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  assert.equal(copy.currencies[0].code, 'USD');
  assert.equal(copy.currencies[0].rates[0].rate, 83);
  assert.equal(copy.vouchers[0].currencyCode, 'USD');
  assert.equal(copy.vouchers[0].currencyTotal, 1000);
  assert.equal(copy.vouchers[0].lines[0].currencyAmount, 1000);

  const wrongRate = JSON.parse(exportState(stateFor(company)));
  wrongRate.companies[0].vouchers[0].exchangeRate = 84;
  const wrongRateResult = importState(JSON.stringify(wrongRate));
  assert.equal(wrongRateResult.ok, false);
  assert.match(wrongRateResult.error, /does not convert/i);

  const wrongTotal = JSON.parse(exportState(stateFor(company)));
  wrongTotal.companies[0].vouchers[0].currencyTotal = 999;
  const wrongTotalResult = importState(JSON.stringify(wrongTotal));
  assert.equal(wrongTotalResult.ok, false);
  assert.match(wrongTotalResult.error, /foreign total/i);
});

test('used currencies cannot be deleted and normalization drops malformed entries', () => {
  const { company, customer, sales } = currencyFixture();
  usd(company);
  addVoucher(company, {
    type: 'Sales',
    date: '2026-04-05',
    currencyCode: 'USD',
    exchangeRate: 83,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 100 },
      { ledgerId: sales.id, side: 'Cr', amount: 100 },
    ],
  });
  const used = deleteCurrency(company, company.currencies[0].id);
  assert.equal(used.ok, false);
  assert.match(used.error, /used by/i);

  company.currencies = [
    {
      id: 'cur-usd',
      code: ' usd ',
      name: 'US Dollar',
      symbol: '$',
      rates: [
        { date: '2026-04-10', rate: 84 },
        { date: '2026-04-01', rate: 83 },
        { date: '2026-04-10', rate: 85 },
        { date: 'bad', rate: 1 },
      ],
    },
    { id: 'cur-bad', code: 'INR', name: 'Rupee', rates: [{ date: '2026-04-01', rate: 1 }] },
    { id: 'cur-empty', code: 'EUR', name: 'Euro', rates: [] },
  ];
  normalizeCurrencies(company);
  assert.equal(company.currencies.length, 1);
  assert.equal(company.currencies[0].id, 'cur-usd');
  assert.equal(company.currencies[0].code, 'USD');
  assert.deepEqual(company.currencies[0].rates, [
    { date: '2026-04-01', rate: 83 },
    { date: '2026-04-10', rate: 84 },
  ]);
});

test('base-currency vouchers are unchanged by the currency feature', () => {
  const { company, customer, sales } = currencyFixture();
  const created = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-05',
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 1000 },
      { ledgerId: sales.id, side: 'Cr', amount: 1000 },
    ],
  });
  assert.equal(created.ok, true, created.error);
  assert.equal(created.voucher.currencyCode, undefined);
  assert.equal(created.voucher.lines[0].currencyAmount, undefined);
  assert.equal(created.voucher.total, 1000);
});

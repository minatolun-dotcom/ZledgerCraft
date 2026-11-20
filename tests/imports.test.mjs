import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { addCurrency, createCompany } from '../src/store.js';
import {
  csvObjects,
  importStockItemCsv,
  importCurrencyRateCsv,
  parseBankStatement,
  parseBankStatementCsv,
  parseMt940Statement,
  parseOfxStatement,
  parseQifStatement,
  parseCsv,
  parseCsvChecked,
} from '../src/ui-admin.js';
import { importTallyXml, parseTallyXml } from '../src/tally.js';

function fixture(name) {
  return readFileSync(new URL(`./fixtures/imports/${name}`, import.meta.url), 'utf8');
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function randomText(random, length) {
  const alphabet = 'abcXYZ0123, "<>\\n\\r&;#/\\\'-_.';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += alphabet[Math.floor(random() * alphabet.length)];
  }
  return output;
}

test('CSV fixture handles BOM, CRLF, quoted commas and escaped quotes', () => {
  const text = fixture('ledger-import.csv');
  const parsed = parseCsvChecked(text);
  assert.equal(parsed.ok, true, parsed.error);
  assert.equal(parsed.rows.length, 3);
  assert.deepEqual(parsed.rows[0], ['Name', 'Group', 'Opening', 'Type']);
  assert.deepEqual(parsed.rows[1], ['Rao, Sons', 'Sundry Debtors', '1,250.50', 'Dr']);
  assert.deepEqual(parsed.rows[2], ['Quote "Ledger"', 'Sundry Creditors', '0', 'Cr']);
  assert.deepEqual(parseCsv(text), parsed.rows);

  const objects = csvObjects(text);
  assert.equal(objects.ok, true, objects.error);
  assert.equal(objects.rows[0].name, 'Rao, Sons');
  assert.equal(objects.rows[1].name, 'Quote "Ledger"');
});

test('CSV rejects unclosed quotes, text after a quote and duplicate headers', () => {
  const unclosed = parseCsvChecked(fixture('invalid/unclosed.csv'));
  assert.equal(unclosed.ok, false);
  assert.match(unclosed.error, /unclosed quoted field/);
  assert.deepEqual(parseCsv(fixture('invalid/unclosed.csv')), []);

  const duplicate = csvObjects(fixture('invalid/duplicate-header.csv'));
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /duplicate column names/);

  const afterQuote = parseCsvChecked('Name,Group\n"Rao"tail,Sundry Debtors\n');
  assert.equal(afterQuote.ok, false);
  assert.match(afterQuote.error, /after a closing quote/);

  const quoteInside = parseCsvChecked('Name,Group\nRao"tail,Sundry Debtors\n');
  assert.equal(quoteInside.ok, false);
  assert.match(quoteInside.error, /inside an unquoted field/);
});

test('OFX and QIF statements parse into signed bank lines', () => {
  const ofx = parseOfxStatement(`<OFX><BANKTRANLIST>
    <STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260410120000<TRNAMT>200.00<FITID>FIT-1<NAME>Customer receipt</STMTTRN>
    <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260411<TRNAMT>-50<FITID>FIT-2<NAME>Bank charge</STMTTRN>
  </BANKTRANLIST></OFX>`);
  assert.equal(ofx.ok, true, ofx.error);
  assert.deepEqual(ofx.lines[0], {
    date: '2026-04-10',
    description: 'Customer receipt',
    reference: 'FIT-1',
    amount: 200,
  });
  assert.equal(ofx.lines[1].amount, -50);

  const qif = parseQifStatement('!Type:Bank\nD4/11/2026\nT-75.50\nPBank fee\nNQ1\n^\nD4/12/2026\nT1000\nPReceipt\n^');
  assert.equal(qif.ok, true, qif.error);
  assert.equal(qif.lines[0].date, '2026-04-11');
  assert.equal(qif.lines[0].amount, -75.5);
  assert.equal(qif.lines[1].amount, 1000);
  assert.equal(parseBankStatement('!Type:Bank\nD4/11/2026\nT-1\n^').ok, true);
});

test('MT940 transactions parse with signed amounts and details', () => {
  const parsed = parseMt940Statement(
    ':20:STATEMENT\n:60F:C260401INR1000,00\n:61:2604100410C200,00NTRFNONREF\n:86:Customer receipt\n:61:2604110411D50,25NCHQ123//CHQ-9\n:62F:C260430INR1149,75',
  );
  assert.equal(parsed.ok, true, parsed.error);
  assert.equal(parsed.lines.length, 2);
  assert.deepEqual(parsed.lines[0], {
    date: '2026-04-10',
    description: 'Customer receipt',
    reference: '',
    amount: 200,
  });
  assert.equal(parsed.lines[1].amount, -50.25);
  assert.equal(parsed.lines[1].reference, 'CHQ-9');
  assert.equal(parseBankStatement(':61:2604110411D1,00NTRF\n:86:Fee').ok, true);
});

test('currency-rate CSV import is atomic', () => {
  const company = createCompany('Rate Import Co', '2026-04-01').company;
  assert.equal(importCurrencyRateCsv('Code,Date,Rate\nUSD,2026-04-01,83\n', company).ok, false);
  addCurrency(company, { code: 'USD', name: 'US Dollar', symbol: '$', date: '2026-04-01', rate: 83 });
  const imported = importCurrencyRateCsv(
    'Code,Date,Rate\nUSD,2026-04-10,84\nUSD,2026-04-15,85\n',
    company,
  );
  assert.equal(imported.ok, true, imported.error);
  assert.equal(imported.count, 2);
  assert.equal(company.currencies.find((item) => item.code === 'USD').rates.length, 3);
  const before = company.currencies.find((item) => item.code === 'USD').rates.length;
  assert.equal(importCurrencyRateCsv('Code,Date,Rate\nUSD,2026-04-20,86\nUSD,2026-04-10,99', company).ok, false);
  assert.equal(company.currencies.find((item) => item.code === 'USD').rates.length, before);
});

test('stock item CSV import resolves units and is all-or-nothing', () => {
  const company = createCompany('Import Stock Co', '2026-04-01').company;
  const imported = importStockItemCsv(
    'Name,Group,Unit,Opening,Rate,Reorder,Selling,Purchase,HSN,Batch\nCotton Shirt,Primary,Nos,10,100,12,150,90,6109,No',
    company,
  );
  assert.equal(imported.ok, true, imported.error);
  assert.equal(imported.count, 1);
  assert.equal(company.stockItems.length, 1);
  assert.equal(company.stockItems[0].name, 'Cotton Shirt');
  assert.equal(company.stockItems[0].openingQty, 10);
  assert.equal(company.stockItems[0].sellingPrice, 150);
  const before = company.stockItems.length;
  const bad = importStockItemCsv('Name,Group,Unit\nShirt,Primary,Missing', company);
  assert.equal(bad.ok, false);
  assert.equal(company.stockItems.length, before, 'invalid files add nothing');
});

test('bank statement fixture resolves debit/credit and quoted descriptions', () => {
  const parsed = parseBankStatementCsv(fixture('bank-import.csv'));
  assert.equal(parsed.ok, true, parsed.error);
  assert.equal(parsed.lines.length, 2);
  assert.deepEqual(parsed.lines[0], {
    date: '2026-04-10',
    description: 'Customer receipt, Apex',
    reference: 'CHQ-1',
    amount: 200000,
  });
  assert.equal(parsed.lines[1].amount, -118000);

  const badDate = parseBankStatementCsv(fixture('invalid/bad-date.csv'));
  assert.equal(badDate.ok, false);
  assert.match(badDate.error, /Row 2: date/);

  const bothSides = parseBankStatementCsv('Date,Debit,Credit\n2026-04-10,10,10\n');
  assert.equal(bothSides.ok, false);
  assert.match(bothSides.error, /either debit or credit/);

  const amountType = parseBankStatementCsv('Date,Amount,Type\n2026-04-10,100,Deposit\n');
  assert.equal(amountType.ok, true, amountType.error);
  assert.equal(amountType.lines[0].amount, 100);
});

test('Tally fixture imports masters and a balanced voucher', () => {
  const company = createCompany('Fixture Imports', '2026-04-01').company;
  const result = importTallyXml(company, fixture('tally-import.xml'));
  assert.equal(result.ok, true, result.error);
  assert.equal(result.ledgers, 2);
  assert.equal(result.vouchers, 1);
  assert.equal(company.vouchers[0].narration, 'Fixture & entry');
  assert.equal(company.vouchers[0].total, 500);
});

test('Tally rejects impossible dates without throwing and replaces invalid entities', () => {
  const impossible = parseTallyXml(fixture('invalid/tally-bad-date.xml'));
  assert.equal(impossible.ok, false);
  assert.match(impossible.error, /invalid or missing date/);

  const entity = parseTallyXml(fixture('invalid/tally-bad-entity.xml'));
  assert.equal(entity.ok, true, entity.error);
  assert.match(entity.ledgers[0].name, /Bad \uFFFD Entity/);
  assert.equal(parseTallyXml(fixture('invalid/tally-unsupported.xml')).ok, false);
});

test('CSV and Tally parsers reject arbitrary text without escaping their error contract', () => {
  const random = seededRandom(0x5eed1234);
  for (let index = 0; index < 250; index += 1) {
    const text = randomText(random, Math.floor(random() * 160));
    const csv = parseCsvChecked(text);
    assert.equal(typeof csv.ok, 'boolean');
    if (csv.ok) assert.ok(Array.isArray(csv.rows));
    else assert.equal(typeof csv.error, 'string');

    const tally = parseTallyXml(text);
    assert.equal(typeof tally.ok, 'boolean');
    if (!tally.ok) assert.equal(typeof tally.error, 'string');
  }
});

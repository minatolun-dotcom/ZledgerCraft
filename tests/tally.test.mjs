import assert from 'node:assert/strict';
import test from 'node:test';
import { addStockItem, createCompany, findLedgerByName } from '../src/store.js';
import { batchStockSummary } from '../src/accounting.js';
import { importTallyXml, parseTallyXml } from '../src/tally.js';

function tallyFixture() {
  return createCompany('Tally Import Co', '2026-04-01').company;
}

const xmlWithMastersAndVoucher = `<?xml version="1.0"?>
<ENVELOPE>
  <BODY>
    <TALLYMESSAGE>
      <LEDGER NAME="Ram &amp; Sons">
        <PARENT>Sundry Debtors</PARENT>
        <OPENINGBALANCE>-500.50</OPENINGBALANCE>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      </LEDGER>
      <LEDGER NAME="Shop Rent">
        <PARENT>Indirect Expenses</PARENT>
        <OPENINGBALANCE>0</OPENINGBALANCE>
      </LEDGER>
    </TALLYMESSAGE>
    <TALLYMESSAGE>
      <VOUCHER VCHTYPE="Sales">
        <DATE>20260410</DATE>
        <NARRATION>Invoice &amp; delivery</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Ram &amp; Sons</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>1000.00</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Sales</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>1000.00</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>
    </TALLYMESSAGE>
  </BODY>
</ENVELOPE>`;

test('Tally XML imports ledgers and vouchers with signs and entities', () => {
  const company = tallyFixture();
  const before = company.ledgers.length;
  const result = importTallyXml(company, xmlWithMastersAndVoucher);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.ledgers, 2);
  assert.equal(result.vouchers, 1);
  assert.equal(company.ledgers.length, before + 2);

  const ram = company.ledgers.find((ledger) => ledger.name === 'Ram & Sons');
  assert.equal(ram.opening, 500.5);
  assert.equal(ram.openingType, 'Cr');
  assert.equal(company.vouchers.length, 1);
  assert.equal(company.vouchers[0].type, 'Sales');
  assert.equal(company.vouchers[0].date, '2026-04-10');
  assert.equal(company.vouchers[0].total, 1000);
  assert.equal(company.vouchers[0].narration, 'Invoice & delivery');
  assert.equal(findLedgerByName(company, 'Ram & Sons').id, ram.id);
});

test('Tally XML import is all-or-nothing when a group or ledger is missing', () => {
  const company = tallyFixture();
  const beforeLedgers = company.ledgers.length;
  const beforeVouchers = company.vouchers.length;

  const badGroup = xmlWithMastersAndVoucher.replace(
    '<PARENT>Indirect Expenses</PARENT>',
    '<PARENT>Missing Group</PARENT>',
  );
  const groupResult = importTallyXml(company, badGroup);
  assert.equal(groupResult.ok, false);
  assert.match(groupResult.error, /Missing Group/);
  assert.equal(company.ledgers.length, beforeLedgers);
  assert.equal(company.vouchers.length, beforeVouchers);

  const missingLedger = xmlWithMastersAndVoucher.replace(
    '<LEDGERNAME>Sales</LEDGERNAME>',
    '<LEDGERNAME>Unknown Sales Ledger</LEDGERNAME>',
  );
  const ledgerResult = importTallyXml(company, missingLedger);
  assert.equal(ledgerResult.ok, false);
  assert.match(ledgerResult.error, /Unknown Sales Ledger/);
  assert.equal(company.ledgers.length, beforeLedgers);
  assert.equal(company.vouchers.length, beforeVouchers);
});

test('Tally XML falls back to amount signs and accepts credit notes', () => {
  const company = tallyFixture();
  const xml = `<ENVELOPE><BODY>
    <TALLYMESSAGE>
      <VOUCHER VCHTYPE="Credit Note">
        <DATE>10-04-2026</DATE>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Sales</LEDGERNAME>
          <AMOUNT>-300</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Cash</LEDGERNAME>
          <AMOUNT>300</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>
    </TALLYMESSAGE>
  </BODY></ENVELOPE>`;
  const parsed = parseTallyXml(xml);
  assert.equal(parsed.ok, true, parsed.error);
  assert.equal(parsed.vouchers[0].date, '2026-04-10');
  assert.equal(parsed.vouchers[0].lines[0].side, 'Cr');
  assert.equal(parsed.vouchers[0].lines[1].side, 'Dr');
  assert.equal(parsed.stockItems.length, 0);

  const result = importTallyXml(company, xml);
  assert.equal(result.ok, true, result.error);
  assert.equal(company.vouchers[0].type, 'CreditNote');
  assert.equal(company.vouchers[0].total, 300);
});

test('Tally XML imports custom account groups before their ledgers', () => {
  const company = tallyFixture();
  const beforeGroups = company.groups.length;
  const xml = `<ENVELOPE><BODY><TALLYMESSAGE>
    <GROUP NAME="Tally Child"><PARENT>Tally Parent</PARENT></GROUP>
    <GROUP NAME="Tally Parent"><PARENT>Indirect Expenses</PARENT></GROUP>
    <LEDGER NAME="Tally Rent"><PARENT>Tally Child</PARENT><OPENINGBALANCE>0</OPENINGBALANCE></LEDGER>
  </TALLYMESSAGE></BODY></ENVELOPE>`;
  const result = importTallyXml(company, xml);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.groups, 2);
  assert.equal(result.ledgers, 1);
  assert.equal(company.groups.length, beforeGroups + 2);

  const parent = company.groups.find((group) => group.name === 'Tally Parent');
  const child = company.groups.find((group) => group.name === 'Tally Child');
  const indirect = company.groups.find((group) => group.name === 'Indirect Expenses');
  assert.equal(parent.parentId, indirect.id);
  assert.equal(parent.nature, 'Expense');
  assert.equal(child.parentId, parent.id);
  assert.equal(findLedgerByName(company, 'Tally Rent').groupId, child.id);
});

test('Tally account-group import is all-or-nothing when a parent is missing', () => {
  const company = tallyFixture();
  const beforeGroups = company.groups.length;
  const beforeLedgers = company.ledgers.length;
  const xml = `<ENVELOPE><BODY><TALLYMESSAGE>
    <GROUP NAME="Tally Orphan"><PARENT>Missing Tally Parent</PARENT></GROUP>
    <LEDGER NAME="Orphan Ledger"><PARENT>Tally Orphan</PARENT><OPENINGBALANCE>0</OPENINGBALANCE></LEDGER>
  </TALLYMESSAGE></BODY></ENVELOPE>`;
  const result = importTallyXml(company, xml);
  assert.equal(result.ok, false);
  assert.match(result.error, /Missing Tally Parent/);
  assert.equal(company.groups.length, beforeGroups);
  assert.equal(company.ledgers.length, beforeLedgers);
});

test('Tally XML imports stock groups, items and opening stock', () => {
  const company = tallyFixture();
  const xml = `<ENVELOPE><BODY><TALLYMESSAGE>
    <STOCKGROUP NAME="Packaged Goods"><PARENT>Primary</PARENT></STOCKGROUP>
    <STOCKITEM NAME="Soap">
      <PARENT>Packaged Goods</PARENT>
      <BASEUNITS>Nos</BASEUNITS>
      <OPENINGBALANCE>12</OPENINGBALANCE>
      <OPENINGRATE>45.50</OPENINGRATE>
      <HSNCODE>3401</HSNCODE>
    </STOCKITEM>
    <STOCKITEM NAME="Mustard Oil">
      <PARENT>Primary</PARENT>
      <BASEUNITS>Ltr</BASEUNITS>
      <OPENINGBALANCE>2</OPENINGBALANCE>
      <OPENINGVALUE>300</OPENINGVALUE>
    </STOCKITEM>
  </TALLYMESSAGE></BODY></ENVELOPE>`;
  const result = importTallyXml(company, xml);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.stockGroups, 1);
  assert.equal(result.stockItems, 2);

  const group = company.stockGroups.find((entry) => entry.name === 'Packaged Goods');
  const soap = company.stockItems.find((entry) => entry.name === 'Soap');
  const oil = company.stockItems.find((entry) => entry.name === 'Mustard Oil');
  assert.equal(soap.stockGroupId, group.id);
  assert.equal(soap.openingQty, 12);
  assert.equal(soap.openingRate, 45.5);
  assert.equal(soap.hsn, '3401');
  assert.equal(oil.openingQty, 2);
  assert.equal(oil.openingRate, 150);
});

test('Tally stock import rejects unknown units without changing the company', () => {
  const company = tallyFixture();
  const beforeGroups = company.stockGroups.length;
  const beforeItems = company.stockItems.length;
  const xml = `<ENVELOPE><BODY><TALLYMESSAGE>
    <STOCKGROUP NAME="Imported Group"><PARENT>Primary</PARENT></STOCKGROUP>
    <STOCKITEM NAME="Unknown Unit Item">
      <PARENT>Imported Group</PARENT>
      <BASEUNITS>Barrels</BASEUNITS>
      <OPENINGBALANCE>1</OPENINGBALANCE>
    </STOCKITEM>
  </TALLYMESSAGE></BODY></ENVELOPE>`;
  const result = importTallyXml(company, xml);
  assert.equal(result.ok, false);
  assert.match(result.error, /Barrels/);
  assert.equal(company.stockGroups.length, beforeGroups);
  assert.equal(company.stockItems.length, beforeItems);
});

test('Tally batch masters become opening batches with expiry dates', () => {
  const company = tallyFixture();
  const xml = `<ENVELOPE><BODY><TALLYMESSAGE>
    <STOCKGROUP NAME="Tally Pharma"><PARENT>Primary</PARENT></STOCKGROUP>
    <STOCKITEM NAME="Tally Syrup"><PARENT>Tally Pharma</PARENT><BASEUNITS>Nos</BASEUNITS><OPENINGBALANCE>12</OPENINGBALANCE><OPENINGRATE>80</OPENINGRATE></STOCKITEM>
    <BATCH NAME="LOT-A"><PARENT>Tally Syrup</PARENT><OPENINGBALANCE>5 Nos</OPENINGBALANCE><OPENINGRATE>80/Nos</OPENINGRATE><EXPIRYDATE>20270430</EXPIRYDATE></BATCH>
    <BATCH NAME="LOT-B"><PARENT>Tally Syrup</PARENT><OPENINGBALANCE>7 Nos</OPENINGBALANCE><OPENINGRATE>80/Nos</OPENINGRATE></BATCH>
  </TALLYMESSAGE></BODY></ENVELOPE>`;
  const parsed = parseTallyXml(xml);
  assert.equal(parsed.ok, true, parsed.error);
  assert.equal(parsed.stockItems[0].batches.length, 2);

  const result = importTallyXml(company, xml);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.batches, 2);
  const item = company.stockItems.find((entry) => entry.name === 'Tally Syrup');
  assert.equal(item.batchTracking, true);
  assert.equal(item.openingQty, 12);
  assert.equal(item.openingRate, 80);
  assert.deepEqual(item.openingBatches, [
    { batchNo: 'LOT-A', qty: 5, expiryDate: '2027-04-30' },
    { batchNo: 'LOT-B', qty: 7 },
  ]);

  const rows = batchStockSummary(company).rows.filter((row) => row.itemId === item.id);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.batchNo === 'LOT-A').expiryDate, '2027-04-30');
  assert.equal(rows.find((row) => row.batchNo === 'LOT-A').openingQty, 5);
  assert.equal(rows.find((row) => row.batchNo === 'LOT-B').openingQty, 7);
});

test('Tally batch masters reject an unknown stock item or bad expiry', () => {
  const company = tallyFixture();
  const xml = `<ENVELOPE><BODY><TALLYMESSAGE>
    <STOCKGROUP NAME="Tally Pharma"><PARENT>Primary</PARENT></STOCKGROUP>
    <STOCKITEM NAME="Tally Syrup"><PARENT>Tally Pharma</PARENT><BASEUNITS>Nos</BASEUNITS><OPENINGBALANCE>5</OPENINGBALANCE><OPENINGRATE>80</OPENINGRATE></STOCKITEM>
    <BATCH NAME="LOT-A"><PARENT>Missing Item</PARENT><OPENINGBALANCE>5</OPENINGBALANCE></BATCH>
  </TALLYMESSAGE></BODY></ENVELOPE>`;
  const missing = importTallyXml(company, xml);
  assert.equal(missing.ok, false);
  assert.match(missing.error, /Missing Item/);
  assert.equal(company.stockItems.length, 0, 'a bad batch writes nothing');

  const badExpiry = importTallyXml(
    company,
    xml.replace('<PARENT>Missing Item</PARENT>', '<PARENT>Tally Syrup</PARENT>').replace(
      '<OPENINGBALANCE>5</OPENINGBALANCE></BATCH>',
      '<OPENINGBALANCE>5</OPENINGBALANCE><EXPIRYDATE>2026-02-30</EXPIRYDATE></BATCH>',
    ),
  );
  assert.equal(badExpiry.ok, false);
  assert.match(badExpiry.error, /invalid expiry date/);
  assert.equal(company.stockItems.length, 0);
});

test('Tally XML attaches a stock line to a sales voucher', () => {
  const company = tallyFixture();
  const group = company.stockGroups.find((entry) => entry.primary);
  const unit = company.units.find((entry) => entry.symbol === 'Nos');
  const item = addStockItem(company, {
    name: 'Batch Soap',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 20,
    openingRate: 50,
    batchTracking: true,
  }).item;
  const xml = `<ENVELOPE><BODY><TALLYMESSAGE><VOUCHER VCHTYPE="Sales">
    <DATE>20260410</DATE>
    <ALLLEDGERENTRIES.LIST><LEDGERNAME>Cash</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>1000</AMOUNT></ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST><LEDGERNAME>Sales</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>-1000</AMOUNT></ALLLEDGERENTRIES.LIST>
    <INVENTORYENTRIES.LIST>
      <STOCKITEMNAME>Batch Soap</STOCKITEMNAME>
      <ACTUALQTY>10 Nos</ACTUALQTY>
      <RATE>100/Nos</RATE>
      <AMOUNT>1000</AMOUNT>
      <BATCHALLOCATIONS.LIST>
        <BATCHNAME>Opening</BATCHNAME>
        <EXPIRYDATE>20270410</EXPIRYDATE>
        <ACTUALQTY>10 Nos</ACTUALQTY>
        <GODOWNNAME>Main Location</GODOWNNAME>
      </BATCHALLOCATIONS.LIST>
    </INVENTORYENTRIES.LIST>
  </VOUCHER></TALLYMESSAGE></BODY></ENVELOPE>`;
  const result = importTallyXml(company, xml);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.vouchers, 1);
  assert.equal(result.stockLines, 1);
  assert.equal(result.stockLinesSkipped, 0);

  const voucher = company.vouchers[0];
  assert.equal(voucher.items.length, 1);
  assert.equal(voucher.items[0].stockItemId, item.id);
  assert.equal(voucher.items[0].qty, 10);
  assert.equal(voucher.items[0].rate, 100);
  assert.equal(voucher.items[0].batchNo, 'Opening');
  assert.equal(voucher.items[0].expiryDate, '2027-04-10');
});

test('Tally stock lines resolve a stock item created by the same import', () => {
  const company = tallyFixture();
  const xml = `<ENVELOPE><BODY>
    <TALLYMESSAGE>
      <STOCKGROUP NAME="Tally Stock"><PARENT>Primary</PARENT></STOCKGROUP>
      <STOCKITEM NAME="Tally Item"><PARENT>Tally Stock</PARENT><BASEUNITS>Nos</BASEUNITS><OPENINGBALANCE>20</OPENINGBALANCE><OPENINGRATE>50</OPENINGRATE></STOCKITEM>
    </TALLYMESSAGE>
    <TALLYMESSAGE><VOUCHER VCHTYPE="Sales">
      <DATE>20260410</DATE>
      <ALLLEDGERENTRIES.LIST><LEDGERNAME>Cash</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>1000</AMOUNT></ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST><LEDGERNAME>Sales</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>-1000</AMOUNT></ALLLEDGERENTRIES.LIST>
      <INVENTORYENTRIES.LIST><STOCKITEMNAME>Tally Item</STOCKITEMNAME><ACTUALQTY>10 Nos</ACTUALQTY><RATE>100</RATE><AMOUNT>1000</AMOUNT></INVENTORYENTRIES.LIST>
    </VOUCHER></TALLYMESSAGE>
  </BODY></ENVELOPE>`;
  const result = importTallyXml(company, xml);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.stockItems, 1);
  assert.equal(result.stockLines, 1);
  const importedItem = company.stockItems.find((entry) => entry.name === 'Tally Item');
  assert.equal(company.vouchers[0].items[0].stockItemId, importedItem.id);
});

test('Tally keeps the voucher and reports stock lines that do not match its total', () => {
  const company = tallyFixture();
  addStockItem(company, {
    name: 'Mismatch Item',
    stockGroupId: company.stockGroups.find((entry) => entry.primary).id,
    unitId: company.units.find((entry) => entry.symbol === 'Nos').id,
    openingQty: 20,
    openingRate: 50,
  }).item;
  const xml = `<ENVELOPE><BODY><TALLYMESSAGE><VOUCHER VCHTYPE="Sales">
    <DATE>20260410</DATE>
    <ALLLEDGERENTRIES.LIST><LEDGERNAME>Cash</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>1000</AMOUNT></ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST><LEDGERNAME>Sales</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>-1000</AMOUNT></ALLLEDGERENTRIES.LIST>
    <INVENTORYENTRIES.LIST><STOCKITEMNAME>Mismatch Item</STOCKITEMNAME><ACTUALQTY>10 Nos</ACTUALQTY><RATE>90</RATE><AMOUNT>900</AMOUNT></INVENTORYENTRIES.LIST>
  </VOUCHER></TALLYMESSAGE></BODY></ENVELOPE>`;
  const result = importTallyXml(company, xml);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.vouchers, 1);
  assert.equal(result.stockLines, 0);
  assert.equal(result.stockLinesSkipped, 1);
  assert.match(result.stockWarning, /Stock lines total/);
  assert.equal(company.vouchers.length, 1);
  assert.equal(company.vouchers[0].items, undefined);
  assert.equal(company.stockItems.some((entry) => entry.name === 'Mismatch Item'), true);
});

test('Tally XML rejects unsupported voucher types and empty input', () => {
  const company = tallyFixture();
  const unsupported = `<ENVELOPE><BODY><TALLYMESSAGE><VOUCHER VCHTYPE="Sales Order">
    <DATE>20260410</DATE>
    <ALLLEDGERENTRIES.LIST><LEDGERNAME>Cash</LEDGERNAME><AMOUNT>1</AMOUNT></ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST><LEDGERNAME>Sales</LEDGERNAME><AMOUNT>-1</AMOUNT></ALLLEDGERENTRIES.LIST>
  </VOUCHER></TALLYMESSAGE></BODY></ENVELOPE>`;
  const result = importTallyXml(company, unsupported);
  assert.equal(result.ok, false);
  assert.match(result.error, /Unsupported Tally voucher type/);
  assert.equal(importTallyXml(company, '').ok, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { buildXlsx, parseXlsxWorkbook, pickSheet, rowsToCsv, xlsxToCsv } from '../src/xlsx.js';

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const raw = Buffer.from(entry.data);
    const body = entry.deflate ? deflateRawSync(raw) : raw;
    const method = entry.deflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(method, 10);
    directory.writeUInt32LE(0, 12);
    directory.writeUInt32LE(body.length, 20);
    directory.writeUInt32LE(raw.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt16LE(0, 30);
    directory.writeUInt16LE(0, 32);
    directory.writeUInt16LE(0, 34);
    directory.writeUInt16LE(0, 36);
    directory.writeUInt32LE(0, 38);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += local.length + name.length + body.length;
  }
  const directorySize = central.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

function excelSerial(iso) {
  return (Date.UTC(...iso.split('-').map((value, index) => (index === 1 ? Number(value) - 1 : Number(value)))) -
    Date.UTC(1899, 11, 30)) / 86400000;
}

function workbookFixture() {
  const sharedStrings = `<?xml version="1.0" encoding="UTF-8"?>
    <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="12" uniqueCount="12">
      <si><t>Name</t></si><si><t>Group</t></si><si><t>Opening</t></si><si><t>Type</t></si>
      <si><t>Excel Traders</t></si><si><t>Sundry Debtors</t></si><si><t>Cr</t></si>
      <si><t>Rent, Shop</t></si><si><t>Indirect Expenses</t></si><si><t>Dr</t></si>
      <si><t>Date</t></si><si><t>Type</t></si>
    </sst>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets>
        <sheet name="Ledgers" sheetId="1" r:id="rId1"/>
        <sheet name="Vouchers" sheetId="2" r:id="rId2"/>
        <sheet name="Chart" sheetId="3" r:id="rId3"/>
      </sheets>
    </workbook>`;
  const relationships = `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="worksheet" Target="worksheets/sheet2.xml"/>
      <Relationship Id="rId3" Type="chartsheet" Target="chartsheets/sheet1.xml"/>
    </Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8"?>
    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs>
    </styleSheet>`;
  const ledgers = `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
      <row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2" t="s"><v>5</v></c><c r="C2"><v>-100.50</v></c><c r="D2" t="s"><v>6</v></c></row>
      <row r="3"><c r="A3" t="inlineStr"><is><t>Rent, Shop</t></is></c><c r="B3" t="s"><v>8</v></c><c r="C3"><v>0</v></c><c r="D3" t="s"><v>9</v></c></row>
      <row r="4"></row>
    </sheetData></worksheet>`;
  const vouchers = `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
      <row r="1"><c r="A1" t="s"><v>10</v></c><c r="B1" t="s"><v>11</v></c></row>
      <row r="2"><c r="A2" s="1"><v>${excelSerial('2026-04-10')}</v></c><c r="B2" t="inlineStr"><is><t>Sales</t></is></c></row>
    </sheetData></worksheet>`;
  return zip([
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: 'xl/workbook.xml', data: workbook, deflate: true },
    { name: 'xl/_rels/workbook.xml.rels', data: relationships },
    { name: 'xl/sharedStrings.xml', data: sharedStrings, deflate: true },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: ledgers, deflate: true },
    { name: 'xl/worksheets/sheet2.xml', data: vouchers, deflate: true },
  ]);
}

test('XLSX reads shared strings, inline strings, numbers and dates', async () => {
  const workbook = await parseXlsxWorkbook(workbookFixture());
  assert.deepEqual(
    workbook.sheets.map((sheet) => sheet.name),
    ['Ledgers', 'Vouchers'],
  );
  const ledgers = workbook.sheets[0].rows;
  assert.deepEqual(ledgers[0], ['Name', 'Group', 'Opening', 'Type']);
  assert.deepEqual(ledgers[1], ['Excel Traders', 'Sundry Debtors', '-100.50', 'Cr']);
  assert.deepEqual(ledgers[2], ['Rent, Shop', 'Indirect Expenses', '0', 'Dr']);
  assert.equal(ledgers.length, 3);
  assert.equal(workbook.sheets[1].rows[1][0], '2026-04-10');
});

test('XLSX prefers a named sheet and converts it to CSV', async () => {
  const workbook = await parseXlsxWorkbook(workbookFixture());
  assert.equal(pickSheet(workbook, 'Vouchers').name, 'Vouchers');
  assert.equal(pickSheet(workbook, 'voucher').name, 'Vouchers');
  assert.equal(pickSheet(workbook, 'Missing').name, 'Ledgers');

  const result = await xlsxToCsv(workbookFixture(), 'Vouchers');
  assert.equal(result.sheetName, 'Vouchers');
  assert.equal(result.rows, 1);
  assert.equal(result.csv, 'Date,Type\n2026-04-10,Sales');
});

test('XLSX rows are quoted safely for the CSV importer', () => {
  assert.equal(
    rowsToCsv([
      ['Name', 'Narration'],
      ['Rent, Shop', 'Line one\nLine "two"'],
    ]),
    'Name,Narration\n"Rent, Shop","Line one\nLine ""two"""',
  );
});

test('XLSX writer builds a readable workbook with numbers and escaped text', async () => {
  const bytes = buildXlsx([
    {
      name: 'MIS: 2026/27',
      rows: [
        ['Net sales', 1000],
        ['Rent & rates', 'Line <one>'],
        [],
      ],
    },
    { name: 'MIS: 2026/27', rows: [['Second sheet']] },
  ]);
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 100);

  const workbook = await parseXlsxWorkbook(bytes);
  assert.deepEqual(workbook.sheets.map((sheet) => sheet.name), ['MIS  2026 27', 'MIS  2026 27 (2)']);
  assert.deepEqual(workbook.sheets[0].rows[0], ['Net sales', '1000']);
  assert.deepEqual(workbook.sheets[0].rows[1], ['Rent & rates', 'Line <one>']);
});

test('XLSX rejects files that are not zipped workbooks', async () => {
  await assert.rejects(parseXlsxWorkbook(Buffer.from('not an xlsx file')), /not a valid \.xlsx/);
  await assert.rejects(parseXlsxWorkbook(workbookFixture().subarray(0, 20)), /not a valid \.xlsx/);
});

function minimalWorkbook(reference) {
  return zip([
    { name: '[Content_Types].xml', data: '<Types/>' },
    {
      name: 'xl/workbook.xml',
      data: '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="${reference}"><v>1</v></c></row></sheetData></worksheet>`,
    },
  ]);
}

test('XLSX rejects arbitrary bytes with a user-facing Error', async () => {
  let seed = 0x1f2e3d4c;
  const randomByte = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed & 255;
  };
  for (let index = 0; index < 80; index += 1) {
    const bytes = new Uint8Array(index * 3 + 1);
    for (let offset = 0; offset < bytes.length; offset += 1) bytes[offset] = randomByte();
    await assert.rejects(parseXlsxWorkbook(bytes), (error) => error instanceof Error && error.message.length > 0);
  }
  const valid = workbookFixture();
  for (const length of [22, 30, 50, 100, valid.length - 1]) {
    await assert.rejects(
      parseXlsxWorkbook(valid.subarray(0, Math.max(0, length))),
      (error) => error instanceof Error && error.message.length > 0,
    );
  }
});

test('XLSX rejects duplicate ZIP entries and cells beyond Excel column XFD', async () => {
  await assert.rejects(
    parseXlsxWorkbook(zip([
      { name: 'xl/workbook.xml', data: '<workbook/>' },
      { name: 'xl/workbook.xml', data: '<workbook/>' },
    ])),
    /duplicate ZIP entry/,
  );
  await assert.rejects(
    parseXlsxWorkbook(minimalWorkbook('XFE1')),
    /16,384-column limit/,
  );
  const lastColumn = await parseXlsxWorkbook(minimalWorkbook('XFD1'));
  assert.equal(lastColumn.sheets[0].rows[0].length, 16_384);
});

const playwright = require('playwright');
const fs = require('node:fs');

const BROWSER = process.env.BROWSER === 'firefox' ? 'firefox' : process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4173/';
const KEY = 'zledgercraft.state.v1';
const path = require('node:path');
const OUT = process.env.AUDIT_OUT || path.join(__dirname, '.artifacts');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await playwright[BROWSER].launch();
  console.log(`browser=${BROWSER}`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  const dialogs = [];
  const downloads = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('dialog', async (dialog) => {
    dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  page.on('filechooser', (chooser) => chooser.setFiles([]).catch(() => {}));
  await page.addInitScript(() => { window.print = () => {}; });

  let checks = 0;
  const assert = (condition, label, detail = '') => {
    checks += 1;
    if (!condition) throw new Error(`FAIL ${checks}: ${label}${detail ? `\n${detail}` : ''}`);
    console.log(`ok ${checks}: ${label}`);
  };
  const text = () => page.locator('main').innerText();
  const waitText = (needle) =>
    page.waitForFunction((value) => document.querySelector('main')?.innerText.includes(value), needle, { timeout: 8000 });
  const open = async (screen) => {
    const sidebar = page.locator(`.sidebar [data-screen="${screen}"]`);
    if (await sidebar.count()) await sidebar.first().click();
    else {
      const direct = page.locator(`[data-screen="${screen}"]:visible`);
      if (!(await direct.count())) throw new Error(`navigation target ${screen} not found`);
      await direct.first().click();
    }
    await page.waitForTimeout(120);
  };
  const pick = async (select, name) => {
    if ((await select.evaluate((el) => el.tagName)) !== 'SELECT') {
      await select.fill(name);
      return;
    }
    const value = await select.evaluate(
      (el, wanted) => [...el.options].find((option) => option.textContent.replace(/^—\s*/, '').startsWith(wanted))?.value,
      name,
    );
    if (!value) throw new Error(`option ${name} not found in ${await select.evaluate((el) => [...el.options].map((o) => o.textContent).slice(0, 20).join(' | '))}`);
    await select.selectOption(value);
  };
  const saveState = () => page.evaluate((key) => localStorage.getItem(key), KEY);
  const state = async () => JSON.parse(await saveState());
  const ledgerId = async (name) => {
    const s = await state();
    return s.companies[0].ledgers.find((entry) => entry.name === name)?.id;
  };
  const addLedger = async (name, group, options = {}) => {
    await open('masters');
    await page.waitForSelector('#ledger-form');
    await page.fill('#ledger-form [name="name"]', name);
    await pick(page.locator('#ledger-form [name="groupId"]'), group);
    if (options.opening !== undefined) {
      await page.fill('#ledger-form [name="opening"]', String(options.opening));
      await page.selectOption('#ledger-form [name="openingType"]', options.type || 'Dr');
    }
    if (options.gstin) await page.fill('#ledger-form [name="gstin"]', options.gstin);
    if (options.stateCode) await page.selectOption('#ledger-form [name="stateCode"]', options.stateCode);
    if (options.address) await page.fill('#ledger-form [name="address"]', options.address);
    if (options.city) await page.fill('#ledger-form [name="city"]', options.city);
    if (options.pin) await page.fill('#ledger-form [name="pin"]', options.pin);
    if (options.pan) await page.fill('#ledger-form [name="pan"]', options.pan);
    await page.click('#ledger-form button[type="submit"]');
    await page.waitForTimeout(150);
    assert(await ledgerId(name), `ledger ${name} created`);
  };
  const addStockItem = async (name, openingQty, openingRate, hsn, batch = false) => {
    await open('inventory');
    await page.waitForSelector('#stock-item-form');
    await page.fill('#stock-item-form [name="name"]', name);
    await page.fill('#stock-item-form [name="openingQty"]', String(openingQty));
    await page.fill('#stock-item-form [name="openingRate"]', String(openingRate));
    await page.fill('#stock-item-form [name="hsn"]', hsn);
    if (batch) await page.check('#stock-item-form [name="batchTracking"]');
    await page.click('#stock-item-form button[type="submit"]');
    await page.waitForTimeout(150);
    const s = await state();
    assert(s.companies[0].stockItems.some((item) => item.name === name), `stock item ${name} created`);
  };
  const addCostCentre = async (name) => {
    await open('masters');
    await page.fill('#cost-centre-form [name="name"]', name);
    await pick(page.locator('#cost-centre-form [name="categoryId"]'), 'Primary Cost Category');
    await page.click('#cost-centre-form button[type="submit"]');
    await page.waitForTimeout(120);
  };
  const addBudget = async (name, target, amount) => {
    await open('masters');
    await page.fill('#budget-form [name="name"]', name);
    await pick(page.locator('#budget-form [name="target"]'), target);
    await pick(page.locator('#budget-form [name="yearId"]'), '01-Apr-2026');
    await page.fill('#budget-form [name="amount"]', String(amount));
    await page.click('#budget-form button[type="submit"]');
    await page.waitForTimeout(150);
    const s = await state();
    assert(s.companies[0].budgets.some((budget) => budget.name === name), `budget ${name} created`);
  };
  const openVoucher = async (shortcut, type) => {
    await page.keyboard.press(shortcut);
    await page.waitForSelector('#voucher-form');
    const heading = await page.locator('#voucher-form h1').innerText();
    if (type && !heading.includes(type)) throw new Error(`expected ${type}, opened ${heading}`);
  };
  const fillLine = async (row, ledger, side, amount) => {
    await row.locator('input.ledger').fill(ledger);
    await row.locator('select.side').selectOption(side);
    await row.locator('input.amount').fill(String(amount));
  };
  const setCostCentre = async (row, centre) => {
    if (centre) await pick(row.locator('select.cost-centre'), centre);
  };
  const addItem = async (item, qty, rate, options = {}) => {
    await page.click('[data-action="add-item"]');
    const row = page.locator('#stock-items tr.item-line').last();
    await pick(row.locator('select.item'), item);
    if (options.godown) await pick(row.locator('select.godown'), options.godown);
    if (options.batch) await row.locator('input.batch').fill(options.batch);
    if (options.expiry) await row.locator('input.expiry').fill(options.expiry);
    await row.locator('input.qty').fill(String(qty));
    await row.locator('input.rate').fill(String(rate));
  };
  const setGst = async (rateLabel, placeValue, gstin) => {
    await page.selectOption('#voucher-form [name="gstRate"]', { label: rateLabel });
    if (gstin !== undefined) await page.fill('#voucher-form [name="gstPartyGstin"]', gstin);
    await page.selectOption('#voucher-form [name="gstPlaceOfSupply"]', placeValue);
    await page.waitForTimeout(200);
  };
  const setTds = async (label) => {
    await page.selectOption('#voucher-form [name="tdsSection"]', { label });
    await page.waitForTimeout(200);
  };
  const setBill = async (ref, due) => {
    await page.fill('#voucher-form [name="billRef"]', ref);
    await page.fill('#voucher-form [name="billDueDate"]', due);
  };
  const setInstrument = async (kind, number, date, bank) => {
    await page.selectOption('#voucher-form [name="instrumentKind"]', kind);
    await page.fill('#voucher-form [name="instrumentNumber"]', number);
    await page.fill('#voucher-form [name="instrumentDate"]', date);
    await pick(page.locator('#voucher-form [name="instrumentBank"]'), bank);
  };
  const allocate = async (party, amount, billHint = '') => {
    await page.waitForTimeout(300);
    const rows = page.locator('#bill-settlement tr.bill-allocation');
    if (!(await rows.count())) throw new Error(`no bill settlement rows for ${party}`);
    const row = rows.filter({ hasText: party }).first();
    if (!(await row.count())) throw new Error(`no settlement row for ${party}`);
    const select = row.locator('select.alloc-bill');
    const options = await select.locator('option').evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, text: node.textContent })));
    const option = options.find((entry) => entry.value && entry.text.includes(billHint)) || options.find((entry) => entry.value);
    if (!option) throw new Error(`no open bill for ${party}`);
    await select.selectOption(option.value);
    await row.locator('.alloc-amount').fill(String(amount));
  };
  const submit = async (label) => {
    await page.click('#voucher-form button[type="submit"]');
    try {
      await page.waitForSelector('.voucher-view-meta', { timeout: 5000 });
    } catch {
      const err = await page.locator('#form-error').innerText().catch(() => '');
      throw new Error(`voucher ${label} not saved: ${err}`);
    }
    const s = await state();
    return s.companies[0].vouchers[s.companies[0].vouchers.length - 1];
  };
  const reportValue = async (label) => {
    const row = page.locator('.block-row', { hasText: label }).first();
    if (!(await row.count())) return '';
    return (await row.locator('.num').first().innerText()).trim();
  };
  const assertBody = async (needle, label) => {
    const body = await text();
    assert(body.includes(needle), label, body.slice(0, 1600));
  };

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await waitText('Start a company');
  await open('companies');
  await page.fill('#company-form [name="name"]', 'Meridian Precision Components Pvt Ltd');
  await page.fill('#company-form [name="fyStart"]', '2026-04-01');
  await page.click('#company-form button[type="submit"]');
  await page.waitForTimeout(250);
  assert((await text()).includes('Meridian Precision Components'), 'company created');

  // Statutory setup.
  await open('gst');
  await page.fill('#gst-form [name="gstin"]', '27ABCDE1234F1Z5');
  await page.fill('#gst-form [name="legalName"]', 'Meridian Precision Components Private Limited');
  await page.fill('#gst-form [name="tradeName"]', 'Meridian Precision');
  await page.fill('#gst-form [name="address"]', 'Plot 12, Chakan Industrial Area');
  await page.fill('#gst-form [name="city"]', 'Pune');
  await page.fill('#gst-form [name="pin"]', '410501');
  await page.selectOption('#gst-form [name="stateCode"]', '27');
  await page.check('#gst-form [name="enabled"]');
  await page.click('#gst-form button[type="submit"]');
  await waitText('GST is enabled');
  await open('tds');
  await page.fill('#tds-form [name="tan"]', 'PNEP12345A');
  await page.check('#tds-form [name="enabled"]');
  await page.click('#tds-form button[type="submit"]');
  await waitText('TDS/TCS is enabled');
  await open('payroll');
  await page.check('#payroll-form [name="enabled"]');
  await page.click('#payroll-form button[type="submit"]');
  await waitText('Payroll is on');

  // Opening chart of accounts. Opening assets = opening liabilities + capital.
  await addLedger('HDFC Bank Current A/c', 'Bank Accounts', { opening: 1500000, type: 'Dr' });
  await addLedger('Petty Cash', 'Cash-in-Hand', { opening: 50000, type: 'Dr' });
  await addLedger('Plant & Machinery', 'Fixed Assets', { opening: 1500000, type: 'Dr' });
  await addLedger('Accumulated Depreciation', 'Fixed Assets');
  await addLedger('Promoter Capital', 'Capital Account', { opening: 2100000, type: 'Cr' });
  await addLedger('SBI Term Loan', 'Secured Loans', { opening: 1000000, type: 'Cr' });
  await addLedger('Apex Auto Ltd', 'Sundry Debtors', {
    opening: 300000, type: 'Dr', gstin: '27AAACA1111A1Z5', stateCode: '27',
    address: 'Plot 12, Chakan Industrial Area', city: 'Pune', pin: '410501', pan: 'AAACA1111A',
  });
  await addLedger('Northern Motors', 'Sundry Debtors', {
    gstin: '07AAACN2222B1Z6', stateCode: '07',
    address: 'Okhla Phase 2', city: 'New Delhi', pin: '110020', pan: 'AAACN2222B',
  });
  await addLedger('Global Tools Inc', 'Sundry Debtors');
  await addLedger('Steel Suppliers Pvt Ltd', 'Sundry Creditors', {
    opening: 250000, type: 'Cr', gstin: '27AAACS3333C1Z7', stateCode: '27',
    address: 'MIDC Bhosari', city: 'Pune', pin: '411026', pan: 'AAACS3333C',
  });
  await addLedger('Delhi Components', 'Sundry Creditors', {
    gstin: '07AAACD4444D1Z8', stateCode: '07',
    address: 'Wazirpur Industrial Area', city: 'New Delhi', pin: '110052', pan: 'AAACD4444D',
  });
  await addLedger('Advocate Rao', 'Sundry Creditors', { pan: 'AAAPR5555R' });
  await addLedger('Professional Fees', 'Indirect Expenses');
  await addLedger('Audit Fees', 'Indirect Expenses');
  await addLedger('Rent', 'Indirect Expenses');
  await addLedger('Electricity', 'Direct Expenses');
  await addLedger('Freight Inward', 'Direct Expenses');
  await addLedger('Bank Charges', 'Indirect Expenses');
  await addLedger('Depreciation', 'Indirect Expenses');
  await addLedger('Interest Income', 'Indirect Incomes');

  // Cost centres, budgets and currency.
  await addCostCentre('Production');
  await addCostCentre('Sales');
  await addCostCentre('Administration');
  await addBudget('FY27 Sales budget', 'Sales', 600000);
  await addBudget('FY27 Rent budget', 'Rent', 25000);
  await open('masters');
  await page.fill('#currency-form [name="code"]', 'USD');
  await page.fill('#currency-form [name="name"]', 'US Dollar');
  await page.fill('#currency-form [name="symbol"]', '$');
  await page.fill('#currency-form [name="date"]', '2026-04-01');
  await page.fill('#currency-form [name="rate"]', '83');
  await page.click('#currency-form button[type="submit"]');
  await page.waitForTimeout(200);
  assert((await text()).includes('USD'), 'USD currency master created');
  await page.fill('#currency-rate-form [name="date"]', '2026-04-30');
  await page.fill('#currency-rate-form [name="rate"]', '84');
  await page.click('#currency-rate-form button[type="submit"]');
  await page.waitForTimeout(200);

  // Inventory masters: components, finished good with batch tracking, factory godown and BOM.
  await addStockItem('RM Steel Bar', 100, 1000, '7214');
  await addStockItem('RM Bearing', 200, 500, '8482');
  await addStockItem('FG Gearbox', 0, 0, '8483', true);
  await open('inventory');
  await page.fill('#godown-form [name="name"]', 'Factory');
  await page.click('#godown-form button[type="submit"]');
  await page.waitForTimeout(150);
  await page.fill('#bom-form [name="name"]', 'Gearbox BOM');
  await pick(page.locator('#bom-form [name="outputItemId"]'), 'FG Gearbox');
  await page.fill('#bom-form [name="outputQty"]', '1');
  const bomRows = page.locator('#bom-form .bom-row');
  await pick(bomRows.nth(0).locator('select'), 'RM Steel Bar');
  await bomRows.nth(0).locator('input').fill('2');
  await pick(bomRows.nth(1).locator('select'), 'RM Bearing');
  await bomRows.nth(1).locator('input').fill('1');
  await page.click('#bom-form button[type="submit"]');
  await page.waitForTimeout(200);
  assert((await text()).includes('Gearbox BOM'), 'BOM created');

  // Payroll employees. Seed order: Basic, HRA, Conveyance, PF, ESI, PT.
  await open('payroll');
  const addEmployee = async (name, code, designation, pan, amounts) => {
    await page.fill('#employee-form [name="name"]', name);
    await page.fill('#employee-form [name="code"]', code);
    await page.fill('#employee-form [name="designation"]', designation);
    await page.fill('#employee-form [name="pan"]', pan);
    await page.fill('#employee-form [name="dateOfJoining"]', '2026-04-01');
    for (const [head, amount] of Object.entries(amounts)) {
      const field = page.locator('#employee-form label.field', { hasText: head }).locator('input').first();
      await field.fill(String(amount));
    }
    await page.click('#employee-form button[type="submit"]');
    await page.waitForTimeout(150);
  };
  await addEmployee('Asha Kale', 'EMP-001', 'Design Engineer', 'AAAPA1234A', {
    'Basic Salary': 40000, 'House Rent Allowance': 16000, 'Conveyance Allowance': 1600, 'Provident Fund (Employee)': 4800, 'ESI (Employee)': 640, 'Professional Tax': 200,
  });
  await addEmployee('Rohit Deshmukh', 'EMP-002', 'Production Supervisor', 'AAAPR1234B', {
    'Basic Salary': 30000, 'House Rent Allowance': 12000, 'Conveyance Allowance': 1600, 'Provident Fund (Employee)': 3600, 'ESI (Employee)': 480, 'Professional Tax': 200,
  });
  assert((await text()).includes('Asha Kale') && (await text()).includes('Rohit Deshmukh'), 'two employees added');

  // Purchase 1: intra-state 18% GST, 100 steel bars at 1,000 with stock.
  await openVoucher('F9', 'Purchase');
  await page.fill('#voucher-form [name="date"]', '2026-04-02');
  let rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Purchases', 'Dr', 100000);
  await fillLine(rows.nth(1), 'Steel Suppliers Pvt Ltd', 'Cr', 118000);
  await setGst('18%', '27', '27AAACS3333C1Z7');
  await addItem('RM Steel Bar', 100, 1000, { godown: 'Main Location' });
  await setBill('SS/26-27/101', '2026-05-02');
  await page.fill('#voucher-form [name="narration"]', 'Raw material purchase - April');
  let v = await submit('purchase steel');
  assert(v.gst?.cgst === 9000 && v.gst?.sgst === 9000, 'steel purchase CGST/SGST 9,000 each', JSON.stringify(v.gst));
  assert(v.total === 118000, 'steel purchase total 118,000', String(v.total));

  // Purchase 2: inter-state 12% GST, 200 bearings.
  await openVoucher('F9', 'Purchase');
  await page.fill('#voucher-form [name="date"]', '2026-04-03');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Purchases', 'Dr', 100000);
  await fillLine(rows.nth(1), 'Delhi Components', 'Cr', 112000);
  await setGst('12%', '07', '07AAACD4444D1Z8');
  await addItem('RM Bearing', 200, 500, { godown: 'Main Location' });
  await setBill('DC-001', '2026-05-03');
  await page.fill('#voucher-form [name="narration"]', 'Bearing purchase - inter-state');
  v = await submit('purchase bearings');
  assert(v.gst?.igst === 12000, 'bearing purchase IGST 12,000', JSON.stringify(v.gst));

  // Stock transfer and production before sale.
  await open('inventory');
  await page.fill('#stock-transfer-form [name="date"]', '2026-04-03');
  await pick(page.locator('#stock-transfer-form [name="fromGodownId"]'), 'Main Location');
  await pick(page.locator('#stock-transfer-form [name="toGodownId"]'), 'Factory');
  await pick(page.locator('#stock-transfer-form [name="stockItemId"]'), 'RM Bearing');
  await page.fill('#stock-transfer-form [name="qty"]', '10');
  await page.fill('#stock-transfer-form [name="narration"]', 'Issued to factory');
  await page.click('#stock-transfer-form button[type="submit"]');
  await page.waitForTimeout(250);
  assert((await text()).includes('ST-1'), 'stock transfer ST-1 recorded');

  await page.fill('#manufacture-form [name="date"]', '2026-04-04');
  await pick(page.locator('#manufacture-form [name="bomId"]'), 'Gearbox BOM');
  await page.fill('#manufacture-form [name="outputQty"]', '100');
  await page.fill('#manufacture-form [name="outputBatchNo"]', 'LOT-APR');
  await page.fill('#manufacture-form [name="expiryDate"]', '2027-03-31');
  await page.fill('#manufacture-form [name="narration"]', 'April production batch');
  await page.click('#manufacture-form button[type="submit"]');
  await page.waitForTimeout(300);
  assert((await text()).includes('MFG-1'), 'production MFG-1 recorded');

  // Sale 1: Apex, intra-state 18%, 50 gearboxes at 5,000, bill APX-1001.
  await openVoucher('F8', 'Sales');
  await page.fill('#voucher-form [name="date"]', '2026-04-05');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Apex Auto Ltd', 'Dr', 295000);
  await fillLine(rows.nth(1), 'Sales', 'Cr', 250000);
  await setGst('18%', '27', '27AAACA1111A1Z5');
  await addItem('FG Gearbox', 50, 5000, { godown: 'Main Location', batch: 'LOT-APR', expiry: '2027-03-31' });
  await setBill('APX-1001', '2026-05-05');
  await page.fill('#voucher-form [name="narration"]', 'Gearbox sale to Apex');
  v = await submit('sale Apex');
  assert(v.gst?.cgst === 22500 && v.gst?.sgst === 22500, 'Apex sale CGST/SGST 22,500 each', JSON.stringify(v.gst));

  // Sale 2: Northern, inter-state 12%, 20 gearboxes.
  await openVoucher('F8', 'Sales');
  await page.fill('#voucher-form [name="date"]', '2026-04-07');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Northern Motors', 'Dr', 112000);
  await fillLine(rows.nth(1), 'Sales', 'Cr', 100000);
  await setGst('12%', '07', '07AAACN2222B1Z6');
  await addItem('FG Gearbox', 20, 5000, { godown: 'Main Location', batch: 'LOT-APR', expiry: '2027-03-31' });
  await setBill('NM-5001', '2026-05-07');
  await page.fill('#voucher-form [name="narration"]', 'Gearbox sale to Northern Motors');
  v = await submit('sale Northern');
  assert(v.gst?.igst === 12000, 'Northern sale IGST 12,000', JSON.stringify(v.gst));

  // TDS purchase: professional fees 50,000 less 194J TDS 5,000.
  await openVoucher('F9', 'Purchase');
  await page.fill('#voucher-form [name="date"]', '2026-04-08');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Professional Fees', 'Dr', 50000);
  await fillLine(rows.nth(1), 'Advocate Rao', 'Cr', 50000);
  await setTds('194J · Professional or technical fees (10%)');
  await setBill('ADV-APR', '2026-05-08');
  await page.fill('#voucher-form [name="narration"]', 'Legal professional fees - April');
  v = await submit('TDS professional fees');
  assert(v.tds?.amount === 5000 && v.lines.some((line) => line.amount === 45000), 'TDS 5,000 deducted, net payable 45,000', JSON.stringify(v.tds));

  // TCS sale: cash sale 100,000 plus 206C(1H) TCS 100.
  await openVoucher('F8', 'Sales');
  await page.fill('#voucher-form [name="date"]', '2026-04-09');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Petty Cash', 'Dr', 100000);
  await fillLine(rows.nth(1), 'Sales', 'Cr', 100000);
  await setTds('206C(1H) · Sale of goods above turnover threshold (0.1%)');
  await page.fill('#voucher-form [name="narration"]', 'Counter sale - TCS');
  v = await submit('TCS cash sale');
  assert(v.tds?.amount === 100 && v.total === 100100, 'TCS 100 collected, cash total 100,100', JSON.stringify(v.tds));

  // Receipt from Apex with cheque, allocated to APX-1001.
  await openVoucher('F6', 'Receipt');
  await page.fill('#voucher-form [name="date"]', '2026-04-10');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'HDFC Bank Current A/c', 'Dr', 200000);
  await fillLine(rows.nth(1), 'Apex Auto Ltd', 'Cr', 200000);
  await allocate('Apex Auto Ltd', 200000, 'APX-1001');
  await setInstrument('Cheque', '123456', '2026-04-10', 'HDFC Bank Current A/c');
  await page.fill('#voucher-form [name="narration"]', 'Part receipt against APX-1001');
  await submit('receipt Apex');
  assert(true, 'Apex receipt saved');

  // Payment to Steel Suppliers with cheque, allocated to SS/26-27/101.
  await openVoucher('F5', 'Payment');
  await page.fill('#voucher-form [name="date"]', '2026-04-12');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Steel Suppliers Pvt Ltd', 'Dr', 118000);
  await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', 118000);
  await allocate('Steel Suppliers Pvt Ltd', 118000, 'SS/26-27/101');
  await setInstrument('Cheque', '654321', '2026-04-12', 'HDFC Bank Current A/c');
  await page.fill('#voucher-form [name="narration"]', 'Full settlement of steel bill');
  await submit('payment Steel');

  // Contra cash to bank.
  await openVoucher('F4', 'Contra');
  await page.fill('#voucher-form [name="date"]', '2026-04-13');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'HDFC Bank Current A/c', 'Dr', 25000);
  await fillLine(rows.nth(1), 'Petty Cash', 'Cr', 25000);
  await page.fill('#voucher-form [name="narration"]', 'Cash deposited into bank');
  await submit('contra');

  // Rent and electricity payments with cost centres.
  await openVoucher('F5', 'Payment');
  await page.fill('#voucher-form [name="date"]', '2026-04-15');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Rent', 'Dr', 30000);
  await setCostCentre(rows.nth(0), 'Sales');
  await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', 30000);
  await page.fill('#voucher-form [name="narration"]', 'April office rent');
  await submit('rent');

  await openVoucher('F5', 'Payment');
  await page.fill('#voucher-form [name="date"]', '2026-04-16');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Electricity', 'Dr', 20000);
  await setCostCentre(rows.nth(0), 'Production');
  await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', 20000);
  await page.fill('#voucher-form [name="narration"]', 'Factory power bill');
  await submit('electricity');

  // Freight inward, direct expense.
  await openVoucher('F5', 'Payment');
  await page.fill('#voucher-form [name="date"]', '2026-04-18');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Freight Inward', 'Dr', 5000);
  await setCostCentre(rows.nth(0), 'Production');
  await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', 5000);
  await page.fill('#voucher-form [name="narration"]', 'Inward freight on raw material');
  await submit('freight');

  // Credit note: 5 gearboxes returned, 18% GST, allocated to APX-1001.
  await openVoucher('Control+F8', 'Credit Note');
  await page.fill('#voucher-form [name="date"]', '2026-04-20');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Sales', 'Dr', 25000);
  await fillLine(rows.nth(1), 'Apex Auto Ltd', 'Cr', 29500);
  await setGst('18%', '27', '27AAACA1111A1Z5');
  await addItem('FG Gearbox', 5, 5000, { godown: 'Main Location', batch: 'LOT-APR', expiry: '2027-03-31' });
  await allocate('Apex Auto Ltd', 29500, 'APX-1001');
  await page.fill('#voucher-form [name="narration"]', 'Credit note for returned gearboxes');
  v = await submit('credit note');
  assert(v.gst?.cgst === 2250 && v.gst?.sgst === 2250, 'credit note reverses 2,250 CGST and SGST', JSON.stringify(v.gst));

  // Debit note: 10 bearings returned to Delhi, 12% IGST.
  await openVoucher('Control+F9', 'Debit Note');
  await page.fill('#voucher-form [name="date"]', '2026-04-22');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Delhi Components', 'Dr', 5600);
  await fillLine(rows.nth(1), 'Purchases', 'Cr', 5000);
  await setGst('12%', '07', '07AAACD4444D1Z8');
  await addItem('RM Bearing', 10, 500, { godown: 'Main Location' });
  await allocate('Delhi Components', 5600, 'DC-001');
  await page.fill('#voucher-form [name="narration"]', 'Purchase return - damaged bearings');
  v = await submit('debit note');
  assert(v.gst?.igst === 600, 'debit note reverses 600 IGST', JSON.stringify(v.gst));

  // Settle Delhi and Advocate.
  await openVoucher('F5', 'Payment');
  await page.fill('#voucher-form [name="date"]', '2026-04-25');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Delhi Components', 'Dr', 106400);
  await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', 106400);
  await allocate('Delhi Components', 106400, 'DC-001');
  await setInstrument('Cheque', '777777', '2026-04-25', 'HDFC Bank Current A/c');
  await page.fill('#voucher-form [name="narration"]', 'Settlement after purchase return');
  await submit('payment Delhi');

  await openVoucher('F5', 'Payment');
  await page.fill('#voucher-form [name="date"]', '2026-04-26');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Advocate Rao', 'Dr', 45000);
  await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', 45000);
  await allocate('Advocate Rao', 45000, 'ADV-APR');
  await setInstrument('Cheque', '888888', '2026-04-26', 'HDFC Bank Current A/c');
  await page.fill('#voucher-form [name="narration"]', 'Professional fees paid net of TDS');
  await submit('payment Advocate');

  // Foreign-currency sale: USD 1,000 at 83 => INR 83,000.
  await openVoucher('F8', 'Sales');
  await page.fill('#voucher-form [name="date"]', '2026-04-28');
  await page.selectOption('#voucher-form [name="currencyCode"]', 'USD');
  await page.waitForTimeout(250);
  assert((await page.inputValue('#voucher-form [name="exchangeRate"]')) === '83', 'USD voucher uses the 83 rate');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Global Tools Inc', 'Dr', 1000);
  await fillLine(rows.nth(1), 'Sales', 'Cr', 1000);
  await page.fill('#voucher-form [name="narration"]', 'Export engineering services - USD invoice');
  v = await submit('foreign sale');
  assert(v.currencyCode === 'USD' && v.total === 83000, 'foreign sale posts INR 83,000', JSON.stringify({ currency: v.currencyCode, total: v.total }));

  // Post-dated audit fee cheque, not yet cleared.
  await openVoucher('F5', 'Payment');
  await page.fill('#voucher-form [name="date"]', '2026-04-29');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Audit Fees', 'Dr', 10000);
  await setCostCentre(rows.nth(0), 'Administration');
  await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', 10000);
  await setInstrument('Cheque', '999999', '2026-05-10', 'HDFC Bank Current A/c');
  await page.fill('#voucher-form [name="narration"]', 'Statutory audit fee - post-dated cheque');
  await submit('post-dated audit fee');

  // Bank charges and interest.
  await openVoucher('F5', 'Payment');
  await page.fill('#voucher-form [name="date"]', '2026-04-30');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Bank Charges', 'Dr', 500);
  await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', 500);
  await page.fill('#voucher-form [name="narration"]', 'April bank charges');
  await submit('bank charges');

  await openVoucher('F6', 'Receipt');
  await page.fill('#voucher-form [name="date"]', '2026-04-30');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'HDFC Bank Current A/c', 'Dr', 2000);
  await fillLine(rows.nth(1), 'Interest Income', 'Cr', 2000);
  await page.fill('#voucher-form [name="narration"]', 'Savings bank interest');
  await submit('interest');

  // Depreciation journal.
  await openVoucher('F7', 'Journal');
  await page.fill('#voucher-form [name="date"]', '2026-04-30');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Depreciation', 'Dr', 15000);
  await fillLine(rows.nth(1), 'Accumulated Depreciation', 'Cr', 15000);
  await page.fill('#voucher-form [name="narration"]', 'Monthly depreciation on plant');
  await submit('depreciation');

  // Payroll run for April.
  await open('payroll');
  await page.fill('#payroll-run-form [name="month"]', '2026-04');
  await page.fill('#payroll-run-form [name="date"]', '2026-04-30');
  await page.click('#payroll-run-form button[type="submit"]');
  await page.waitForTimeout(400);
  const payrollBody = await text();
  assert(payrollBody.includes('1,01,200.00') && payrollBody.includes('91,280.00'), 'payroll run gross 1,01,200 and net 91,280', payrollBody.slice(0, 1600));

  const snapshot = await saveState();
  fs.writeFileSync(`${OUT}/ca-core-state.json`, snapshot);
  const s = await state();
  const company = s.companies[0];
  assert(company.vouchers.length === 22, '22 accounting vouchers posted', String(company.vouchers.length));
  const types = company.vouchers.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] ?? 0) + 1;
    return acc;
  }, {});
  assert(types.Contra === 1 && types.Payment === 8 && types.Receipt === 2 && types.Journal === 2 && types.Sales === 4 && types.Purchase === 3 && types.CreditNote === 1 && types.DebitNote === 1,
    'all eight voucher types used', JSON.stringify(types));

  // Day Book.
  await open('daybook');
  await waitText('Day Book');
  let body = await text();
  assert(body.includes('22 vouchers'), 'day book shows 22 vouchers', body.slice(0, 800));
  assert(body.includes('15,83,300.00'), 'day book total is 15,83,300.00', body.slice(0, 1200));

  // Trial Balance.
  await open('trial');
  await waitText('Trial Balance');
  body = await text();
  assert(body.includes('Trial balance tallies.'), 'trial balance tallies');
  assert(body.includes('40,04,400.00'), 'trial balance total is 40,04,400.00', body.slice(0, 1600));

  // P&L.
  await open('pnl');
  await waitText('Profit & Loss');
  assert((await reportValue('Net profit')) === '83,300.00', 'net profit is 83,300.00', await text());
  body = await text();
  assert(body.includes('5,08,000.00'), 'P&L turnover 5,08,000.00');
  assert(body.includes('1,95,000.00'), 'P&L purchases 1,95,000.00');
  assert(body.includes('83,300.00'), 'P&L carries net profit 83,300.00');

  // Balance Sheet.
  await open('balanceSheet');
  await waitText('Balance Sheet');
  body = await text();
  assert(body.includes('Balance sheet tallies.'), 'balance sheet tallies');
  assert(body.includes('35,62,700.00'), 'balance sheet total is 35,62,700.00', body.slice(0, 1600));

  // Cash and bank.
  await open('cashBank');
  await waitText('Cash & Bank');
  body = await text();
  assert(body.includes('15,17,200.00'), 'cash and bank closing is 15,17,200.00', body.slice(0, 1600));

  // Receivables and payables.
  await open('outstanding');
  await waitText('Receivables ageing');
  body = await text();
  assert(body.includes('5,60,500.00'), 'receivables total 5,60,500.00', body.slice(0, 1600));
  await page.selectOption('#outstanding-form [name="side"]', 'payable');
  await page.click('#outstanding-form button[type="submit"]');
  await page.waitForTimeout(150);
  body = await text();
  assert(body.includes('2,50,000.00'), 'payables total 2,50,000.00', body.slice(0, 1600));

  // Ledger closing.
  await open('ledgerPick');
  await page.fill('#ledger-search', 'Apex Auto');
  await page.waitForTimeout(120);
  await page.locator('tbody tr.clickable:visible').first().click();
  await waitText('Apex Auto Ltd');
  body = await text();
  assert(body.includes('3,65,500.00') && /Dr/.test(body), 'Apex ledger closes at 3,65,500 Dr', body.slice(0, 1600));

  // GST returns.
  await open('gst');
  await waitText('GSTR-3B');
  body = await text();
  assert(body.includes('3,25,000.00'), 'GSTR-1 net outward taxable 3,25,000.00', body.slice(0, 1600));
  assert(body.includes('52,500.00'), 'GSTR-3B output tax 52,500.00');
  assert(body.includes('29,400.00'), 'GSTR-3B ITC 29,400.00');
  assert(body.includes('23,100.00'), 'GSTR-3B net payable 23,100.00');
  assert(body.includes('8483'), 'GSTR-1 HSN summary includes 8483');

  // TDS and TCS.
  await open('tds');
  await waitText('TDS');
  body = await text();
  assert(body.includes('5,000.00'), 'TDS register shows 5,000 deducted');
  assert(body.includes('194J'), 'TDS register shows 194J');
  await page.selectOption('#tds-report-form [name="kind"]', 'TCS');
  await page.click('#tds-report-form button[type="submit"]');
  await page.waitForTimeout(150);
  body = await text();
  assert(body.includes('100.00') && body.includes('206C(1H)'), 'TCS register shows 100 under 206C(1H)');

  // Payroll register and payslip.
  await open('payroll');
  await page.click('[data-screen="payrollRegister"]');
  await waitText('Salary register');
  body = await text();
  assert(body.includes('1,01,200.00') && body.includes('9,920.00') && body.includes('91,280.00'), 'salary register reconciles gross, deductions and net', body.slice(0, 2000));
  await open('payroll');
  const payrollRunButton = page.locator('[data-action="open-payroll-run"]').first();
  assert(await payrollRunButton.count(), 'payroll run offers payslips');
  await payrollRunButton.click();
  await page.waitForTimeout(200);
  body = await text();
  assert(body.includes('Asha Kale') && body.includes('Rohit Deshmukh'), 'payroll run lists both employees', body.slice(0, 2000));
  await page.locator('[data-action="open-payslip"]').first().click();
  await page.waitForTimeout(200);
  body = await text();
  assert(body.includes('Payslip') && body.includes('Asha Kale') && body.includes('Net pay'), 'payslip renders for an employee', body.slice(0, 2000));

  // Inventory and godowns.
  await open('inventory');
  await waitText('Stock Summary');
  body = await text();
  assert(body.includes('FG Gearbox') && body.includes('RM Bearing'), 'stock summary lists finished and raw items');
  assert(body.includes('87,500.00'), 'FG closing stock value 87,500.00', body.slice(0, 2200));
  assert(body.includes('1,45,000.00'), 'bearing closing stock value 1,45,000.00');
  assert(body.includes('2,32,500.00'), 'total closing stock value 2,32,500.00');
  assert(body.includes('LOT-APR') && body.includes('31-Mar-2027'), 'batch balance shows LOT-APR and expiry');
  assert(body.includes('ST-1') && body.includes('MFG-1'), 'stock transfer and production are registered');

  // Cost centres.
  await open('costCentres');
  await waitText('Cost centre summary');
  body = await text();
  assert(body.includes('Production') && body.includes('Sales') && body.includes('Administration'), 'cost centre summary lists all centres');
  assert(body.includes('25,000.00') && body.includes('30,000.00') && body.includes('10,000.00'), 'cost centre allocations total 25,000 / 30,000 / 10,000', body.slice(0, 2200));

  // Budget vs actual.
  await open('budgets');
  await waitText('Budget vs Actual');
  body = await text();
  assert(body.includes('6,00,000.00') && body.includes('5,08,000.00'), 'sales budget compares 600,000 to 508,000', body.slice(0, 2200));
  assert(body.includes('25,000.00') && body.includes('30,000.00'), 'rent budget shows 25,000 budget vs 30,000 actual');
  assert(/over budget/i.test(body), 'rent budget is flagged over budget');

  // Forex revaluation.
  await open('forex');
  await waitText('Forex Revaluation');
  body = await text();
  assert(body.includes('Global Tools Inc'), 'forex report lists the USD debtor');
  assert(body.includes('83,000.00') && body.includes('84,000.00') && body.includes('1,000.00'), 'forex report shows book 83,000, revalued 84,000, gain 1,000', body.slice(0, 2200));

  // Bill-wise register and party statement.
  await open('billRegister');
  await waitText('Bill-wise');
  body = await text();
  assert(body.includes('APX-1001') && body.includes('65,500.00'), 'Apex bill has 65,500 outstanding', body.slice(0, 2200));
  assert(body.includes('NM-5001') && body.includes('1,12,000.00'), 'Northern bill has 112,000 outstanding');
  await page.selectOption('#bill-register-form [name="side"]', 'payable');
  await page.click('#bill-register-form button[type="submit"]');
  await page.waitForTimeout(150);
  body = await text();
  assert(body.includes('SS/26-27/101') && body.includes('DC-001'), 'settled supplier bills are listed');
  await open('partyStatement');
  await waitText('Party statement');
  await page.selectOption('#party-statement-form [name="side"]', 'receivable');
  await pick(page.locator('#party-statement-form [name="ledgerId"]'), 'Apex Auto Ltd');
  await page.click('#party-statement-form button[type="submit"]');
  await waitText('Apex Auto Ltd');
  body = await text();
  assert(body.includes('3,65,500.00') && body.includes('2,29,500.00') && body.includes('65,500.00'), 'Apex statement shows settled and outstanding bill amounts', body.slice(0, 2600));

  // E-invoice, e-way and tax audit.
  await open('einvoice');
  await waitText('E-invoice register');
  body = await text();
  assert(body.includes('B2B') && body.includes('Apex Auto Ltd'), 'e-invoice register includes the B2B invoice', body.slice(0, 2200));
  assert(body.includes('Draft JSON'), 'e-invoice offers draft JSON');
  await open('ewaybill');
  await waitText('E-way bill register');
  body = await text();
  assert(body.includes('Apex Auto Ltd') && body.includes('Part A JSON'), 'e-way bill register includes the large invoice', body.slice(0, 2200));
  await open('taxAudit');
  await waitText('Tax audit position');
  body = await text();
  assert(body.includes('5,08,000.00') && body.includes('3,25,000.00'), 'tax audit reconciles books 508,000 to GST 325,000', body.slice(0, 2600));
  assert(body.includes('52,500.00') && body.includes('29,400.00'), 'tax audit shows output tax and ITC');
  assert(body.includes('Form 3CD-style checklist'), 'tax audit shows the Form 3CD-style checklist');

  // Ratios, cash flow, statistics, group summary, registers, audit trail.
  await open('ratios');
  await waitText('Ratio Analysis');
  body = await text();
  assert(/current ratio/i.test(body), 'ratio analysis shows current ratio');
  await open('cashFlow');
  await waitText('Cash Flow');
  body = await text();
  assert(/cash received from/i.test(body) && /cash spent on/i.test(body), 'cash flow separates receipts and payments');
  await open('statistics');
  await waitText('Statistics');
  body = await text();
  const netSalesKpi = await page.locator('.mis-kpi', { hasText: 'Net sales' }).innerText();
  const netPurchasesKpi = await page.locator('.mis-kpi', { hasText: 'Purchase spend' }).innerText();
  assert(netPurchasesKpi.includes('All purchase vouchers, after returns'), 'purchase KPI explains that it covers all purchase vouchers', netPurchasesKpi);
  assert(netSalesKpi.includes('5,08,000.00'), 'statistics net sales use accounting value, not GST-inclusive total', netSalesKpi);
  assert(netPurchasesKpi.includes('2,45,000.00'), 'statistics purchase spend uses accounting value, not GST-inclusive total', netPurchasesKpi);
  assert(!netSalesKpi.includes('5,60,600.00') && !netPurchasesKpi.includes('2,74,400.00'), 'statistics excludes GST and TDS from headline figures');
  await open('groupSummary');
  await waitText('Group Summary');
  body = await text();
  assert(/Sundry Debtors/.test(body), 'group summary includes debtors');
  await open('registers');
  await waitText('Registers');
  body = await text();
  assert(body.includes('APX-1001') || body.includes('Apex Auto Ltd'), 'sales register includes Apex invoice', body.slice(0, 2200));
  await open('audit');
  await waitText('Audit trail');
  body = await text();
  assert(/voucher.create|created|Company/i.test(body), 'audit trail records activity', body.slice(0, 1600));

  // Bank statement import and auto-match.
  await open('bankRecon');
  await waitText('Bank reconciliation');
  await page.selectOption('#bank-ledger-select', { label: 'HDFC Bank Current A/c' });
  await page.waitForTimeout(200);
  const statement = [
    'Date,Description,Reference,Debit,Credit',
    '2026-04-10,Customer receipt APX,CHQ-123456,,200000',
    '2026-04-12,Supplier payment steel,CHQ-654321,118000,',
    '2026-04-13,Cash deposit,CONTRA-1,,25000',
    '2026-04-15,Office rent,RENT-APR,30000,',
    '2026-04-16,Electricity bill,ELEC-APR,20000,',
    '2026-04-18,Inward freight,FREIGHT-APR,5000,',
    '2026-04-25,Delhi Components settlement,CHQ-777777,106400,',
    '2026-04-26,Advocate Rao payment,CHQ-888888,45000,',
    '2026-04-29,UPI refund,UPI-REF,,1234',
    '2026-04-30,Interest credit,INT-APR,,2000',
    '2026-04-30,Bank charges,CHG-APR,500,',
  ].join('\n');
  await page.fill('#bank-statement-csv', statement);
  await page.click('[data-action="import-bank-statement"]');
  await page.waitForTimeout(300);
  body = await text();
  assert(body.includes('11') && body.includes('13,92,100.00'), 'bank statement imported with book balance 13,92,100.00', body.slice(0, 1800));
  await page.click('[data-action="recon-auto"]');
  await page.waitForTimeout(300);
  body = await text();
  assert(body.includes('10 / 11'), 'bank auto-match matched 10 of 11 statement lines', body.slice(0, 1800));
  assert(body.includes('1,234.00'), 'bank reconciliation surfaces the unmatched UPI refund');

  // Cheque register.
  await open('postDated');
  await waitText('Cheque');
  body = await text();
  assert(body.includes('123456') && body.includes('654321') && body.includes('999999'), 'cheque register lists all instruments', body.slice(0, 2200));
  assert(/post-dated/i.test(body) || /Post-dated/i.test(body), 'cheque register identifies the post-dated cheque');
  assert(/cleared/i.test(body), 'cheque register identifies cleared instruments');

  // Gateway dashboard.
  await open('gateway');
  await waitText('Gateway of ZledgerCraft');
  body = await text();
  assert(/net p&l/i.test(body) && body.includes('83,300.00'), 'gateway dashboard shows net P&L 83,300.00', body.slice(0, 2000));
  assert(body.includes('13,92,100.00') && body.includes('1,25,100.00'), 'gateway dashboard exposes bank and cash figures', body.slice(0, 2000));

  // Exports from key reports.
  await open('gst');
  const beforeDownloads = downloads.length;
  const [gstDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-action="export-csv"]'),
  ]);
  const gstCsv = fs.readFileSync(await gstDownload.path(), 'utf8');
  assert(downloads.length > beforeDownloads, 'GST report CSV export downloads');
  assert(gstCsv.includes('GSTR-1') && gstCsv.includes('29,400.00'), 'GST export contains the return and input-tax figures', gstCsv.slice(0, 500));
  await open('trial');
  const beforeTrial = downloads.length;
  const [trialDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-action="export-csv"]'),
  ]);
  const trialCsv = fs.readFileSync(await trialDownload.path(), 'utf8');
  assert(downloads.length > beforeTrial, 'trial balance CSV export downloads');
  assert(trialCsv.includes('Trial Balance') && trialCsv.includes('40,04,400.00'), 'trial balance export contains the report and balanced total', trialCsv.slice(0, 500));

  assert(errors.length === 0, 'no page or console errors during CA core workflow', errors.join('\n'));
  await page.screenshot({ path: `${OUT}/ca-core-final.png`, fullPage: true });
  fs.writeFileSync(`${OUT}/ca-core-summary.json`, JSON.stringify({
    browser: BROWSER,
    checks,
    vouchers: s.companies[0].vouchers.length,
    types,
    errors,
    dialogs,
    downloads,
    final: (await text()).slice(0, 1000),
  }, null, 2));
  console.log(`CA core passed browser=${BROWSER} checks=${checks} vouchers=${s.companies[0].vouchers.length} errors=${errors.length} downloads=${downloads.length}`);
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});

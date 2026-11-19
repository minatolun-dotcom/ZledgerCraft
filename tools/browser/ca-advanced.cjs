const playwright = require('playwright');
const BROWSER = process.env.BROWSER === 'firefox' ? 'firefox' : process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4173/';
const KEY = 'zledgercraft.state.v1';
const OUT = process.env.AUDIT_OUT || path.join(__dirname, '.artifacts');
const SNAPSHOT = `${OUT}/ca-core-state.json`;
const baseline = fs.readFileSync(SNAPSHOT, 'utf8');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await playwright[BROWSER].launch();
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
  const saveState = () => page.evaluate((key) => localStorage.getItem(key), KEY);
  const state = async () => JSON.parse(await saveState());
  const company = async () => {
    const current = await state();
    return current.companies.find((entry) => entry.id === current.activeCompanyId) ?? current.companies[0];
  };
  const restore = async (snapshot = baseline) => {
    await page.evaluate(
      ([key, value]) => {
        localStorage.setItem(key, value);
        location.reload();
      },
      [KEY, snapshot],
    );
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
  };
  const open = async (screen) => {
    if (screen === 'backup') {
      await open('companies');
      const backupButton = page.locator('[data-screen="backup"]:visible');
      if (!(await backupButton.count())) throw new Error('backup navigation not found');
      await backupButton.first().click();
      await page.waitForTimeout(150);
      return;
    }
    if (screen === 'importData') {
      await open('backup');
      const importButton = page.locator('[data-screen="importData"]:visible');
      if (!(await importButton.count())) throw new Error('import navigation not found');
      await importButton.first().click();
      await page.waitForTimeout(150);
      return;
    }
    const sidebar = page.locator(`.sidebar [data-screen="${screen}"]`);
    if (await sidebar.count()) await sidebar.first().click();
    else {
      const direct = page.locator(`[data-screen="${screen}"]:visible`);
      if (!(await direct.count())) throw new Error(`navigation target ${screen} not found`);
      await direct.first().click();
    }
    await page.waitForTimeout(150);
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
    if (!value) throw new Error(`option ${name} not found: ${await select.evaluate((el) => [...el.options].map((o) => o.textContent).slice(0, 12).join(' | '))}`);
    await select.selectOption(value);
  };
  const fillLine = async (row, ledger, side, amount) => {
    await row.locator('input.ledger').fill(ledger);
    await row.locator('select.side').selectOption(side);
    await row.locator('input.amount').fill(String(amount));
  };
  const voucherCount = async () => (await company()).vouchers.length;
  const errorText = () => page.locator('#form-error').innerText().catch(() => '');

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await restore();

  // --- Orders -----------------------------------------------------------------
  assert((await company()).orders.length === 0, 'orders start empty');
  await open('orders');
  await page.selectOption('#order-form [name="type"]', 'Sales');
  await page.fill('#order-form [name="date"]', '2026-04-29');
  await pick(page.locator('#order-form [name="partyLedgerId"]'), 'Apex Auto Ltd');
  await page.fill('#order-form [name="deliveryDate"]', '2026-05-15');
  await pick(page.locator('#order-form [name="stockItemId"]'), 'FG Gearbox');
  await pick(page.locator('#order-form [name="godownId"]'), 'Main Location');
  await page.fill('#order-form [name="batchNo"]', 'LOT-APR');
  await page.fill('#order-form [name="expiryDate"]', '2027-03-31');
  await page.fill('#order-form [name="qty"]', '10');
  await page.fill('#order-form [name="rate"]', '5000');
  await page.fill('#order-form [name="narration"]', 'May replenishment order');
  await page.click('#order-form button[type="submit"]');
  await page.waitForTimeout(300);
  assert((await text()).includes('SO-1'), 'sales order SO-1 recorded');
  assert((await company()).orders[0].total === 50000, 'sales order value 50,000');

  await page.selectOption('#order-form [name="type"]', 'Purchase');
  await page.fill('#order-form [name="date"]', '2026-04-30');
  await pick(page.locator('#order-form [name="partyLedgerId"]'), 'Delhi Components');
  await page.fill('#order-form [name="deliveryDate"]', '2026-05-20');
  await pick(page.locator('#order-form [name="stockItemId"]'), 'RM Bearing');
  await page.fill('#order-form [name="qty"]', '100');
  await page.fill('#order-form [name="rate"]', '500');
  await page.fill('#order-form [name="narration"]', 'May bearing order');
  await page.click('#order-form button[type="submit"]');
  await page.waitForTimeout(300);
  let body = await text();
  assert(body.includes('PO-1') && (await company()).orders.length === 2, 'purchase order PO-1 recorded');
  assert(body.includes('1,00,000.00'), 'open order value totals 1,00,000.00', body.slice(0, 1400));
  assert((await voucherCount()) === 22, 'orders do not post vouchers');

  // Order prefill without posting.
  const soRow = page.locator('tbody tr', { hasText: 'SO-1' });
  await soRow.locator('[data-action="order-to-voucher"]').click();
  await page.waitForSelector('#voucher-form');
  const prefill = await page.locator('#voucher-form').evaluate((form) => ({
    date: form.querySelector('[name="date"]').value,
    lines: [...form.querySelectorAll('tr.line')].map((row) => ({
      ledger: row.querySelector('input.ledger').value,
      side: row.querySelector('select.side').value,
      amount: row.querySelector('input.amount').value,
    })),
    itemQty: form.querySelector('#stock-items input.qty')?.value,
    itemBatch: form.querySelector('#stock-items input.batch')?.value,
    narration: form.querySelector('[name="narration"]').value,
  }));
  assert(prefill.date === '2026-04-29' && prefill.lines[0].ledger === 'Apex Auto Ltd' && prefill.lines[0].amount === '50000', 'order prefill carries date, party and amount', JSON.stringify(prefill));
  assert(prefill.itemQty === '10' && prefill.itemBatch === 'LOT-APR', 'order prefill carries item, quantity and batch', JSON.stringify(prefill));
  assert(prefill.narration.includes('SO-1'), 'order prefill carries the order reference');
  await page.keyboard.press('Escape');
  assert((await voucherCount()) === 22, 'abandoned order prefill creates no voucher');

  // Status transitions and filters.
  await open('orders');
  let row = page.locator('tbody tr', { hasText: 'SO-1' });
  await row.locator('[data-action="order-status"][data-status="Closed"]').click();
  await page.waitForTimeout(200);
  assert((await company()).orders.find((entry) => entry.type === 'Sales').status === 'Closed', 'sales order can be closed');
  row = page.locator('tbody tr', { hasText: 'SO-1' });
  await row.locator('[data-action="order-status"][data-status="Open"]').click();
  await page.waitForTimeout(200);
  assert((await company()).orders.find((entry) => entry.type === 'Sales').status === 'Open', 'sales order can be reopened');
  row = page.locator('tbody tr', { hasText: 'SO-1' });
  await row.locator('[data-action="order-status"][data-status="Cancelled"]').click();
  await page.waitForTimeout(200);
  assert((await company()).orders.find((entry) => entry.type === 'Sales').status === 'Cancelled', 'sales order can be cancelled');
  await page.selectOption('#orders-filter [name="status"]', 'Cancelled');
  await page.click('#orders-filter button[type="submit"]');
  await page.waitForTimeout(150);
  body = await text();
  assert(body.includes('SO-1') && !body.includes('PO-1'), 'order status filter isolates cancelled orders');
  await page.selectOption('#orders-filter [name="status"]', 'All');
  await page.click('#orders-filter button[type="submit"]');
  await page.waitForTimeout(100);
  await page.locator('tbody tr', { hasText: 'PO-1' }).locator('[data-action="delete-order"]').click();
  await page.waitForTimeout(200);
  assert((await company()).orders.length === 1, 'purchase order can be deleted');

  // --- Period close and reopen -------------------------------------------------
  await restore();
  await open('companies');
  await page.click('[data-action="add-year"]');
  await page.waitForTimeout(300);
  let s = await state();
  assert(s.companies[0].years.length === 2, 'next financial year can be added');
  assert((await page.locator('#year-select option').count()) === 2, 'year selector shows both years');

  await restore();
  await open('companies');
  let yearRow = page.locator('.year-table tbody tr', { hasText: '01-Apr-2026 – 31-Mar-2027' });
  await yearRow.locator('[data-action="close-year"]').click();
  await page.waitForTimeout(400);
  s = await state();
  assert(s.companies[0].years[0].closed === true, '2026-27 year is marked closed');
  assert(s.companies[0].years[1].start === '2027-04-01', 'closing creates the 2027-28 year');
  assert(s.companies[0].yearId === s.companies[0].years[1].id, 'closing selects the new year');
  body = await text();
  assert(body.includes('01-Apr-2027 – 31-Mar-2028') && body.includes('CLOSED'), 'companies screen shows the closed year and new active year', body.slice(0, 1600));

  await page.keyboard.press('P');
  await waitText('Profit & Loss');
  assert((await page.locator('.block-row', { hasText: 'Net profit' }).locator('.num').first().innerText()).trim() === '0.00', 'new year P&L starts at zero');
  await page.keyboard.press('B');
  await waitText('Balance Sheet');
  body = await text();
  assert(body.includes('35,62,700.00') && body.includes('83,300.00'), 'new year balance sheet carries prior profit as a reserve', body.slice(0, 2200));

  // A closed-year voucher is rejected.
  await page.keyboard.press('F5');
  await page.waitForSelector('#voucher-form');
  await page.fill('#voucher-form [name="date"]', '2026-04-30');
  let rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Rent', 'Dr', 1);
  await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', 1);
  await page.click('#voucher-form button[type="submit"]');
  await page.waitForTimeout(300);
  let err = await errorText();
  assert(/closed/i.test(err), 'closed-year voucher is rejected', err);
  assert((await voucherCount()) === 22, 'rejected closed-year voucher is not posted');
  await page.keyboard.press('Escape');

  // Closed-year deletion is blocked.
  const closedYearId = s.companies[0].years[0].id;
  await page.selectOption('#year-select', closedYearId);
  await page.waitForTimeout(250);
  await page.keyboard.press('D');
  await waitText('Day Book');
  await page.locator('tbody tr.clickable').filter({ hasText: 'Sales' }).first().click();
  await page.waitForSelector('.voucher-view-meta');
  await page.click('[data-action="delete-voucher"]');
  await page.waitForTimeout(250);
  assert((await voucherCount()) === 22, 'closed-year voucher cannot be deleted');

  // Reopen and post.
  await open('companies');
  yearRow = page.locator('.year-table tbody tr', { hasText: '01-Apr-2026 – 31-Mar-2027' });
  await yearRow.locator('[data-action="reopen-year"]').click();
  await page.waitForTimeout(250);
  s = await state();
  assert(s.companies[0].years[0].closed === false, 'closed year can be reopened');
  await page.selectOption('#year-select', s.companies[0].years[0].id);
  await page.waitForTimeout(250);
  await page.keyboard.press('F7');
  await page.waitForSelector('#voucher-form');
  await page.fill('#voucher-form [name="date"]', '2026-04-30');
  rows = page.locator('#voucher-form tr.line');
  await fillLine(rows.nth(0), 'Rent', 'Dr', 1);
  await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', 1);
  await page.fill('#voucher-form [name="narration"]', 'Reopen test');
  await page.click('#voucher-form button[type="submit"]');
  await page.waitForTimeout(300);
  assert((await voucherCount()) === 23, 'reopened year accepts a voucher');

  // --- Roles -------------------------------------------------------------------
  await restore();
  await open('companies');
  await page.fill('#user-form [name="name"]', 'Riya Viewer');
  await page.selectOption('#user-form [name="role"]', 'viewer');
  await page.click('#user-form button[type="submit"]');
  await page.waitForTimeout(150);
  await page.fill('#user-form [name="name"]', 'Amit Accountant');
  await page.selectOption('#user-form [name="role"]', 'accountant');
  await page.click('#user-form button[type="submit"]');
  await page.waitForTimeout(150);
  assert((await state()).users.length === 3, 'viewer and accountant profiles added');

  await page.selectOption('#user-select', { label: 'Riya Viewer · Viewer' });
  await page.waitForTimeout(250);
  assert((await page.locator('.role-banner').innerText()).includes('Viewer'), 'viewer banner is shown');
  await open('vouchers');
  assert((await page.locator('[data-action="new-voucher"]:not([disabled])').count()) === 0, 'viewer cannot start a voucher from the type grid');
  await page.keyboard.press('F5');
  await page.waitForTimeout(250);
  assert((await page.locator('#voucher-form').count()) === 0, 'viewer cannot open voucher entry by shortcut');
  await open('backup');
  assert((await page.locator('#restore-form').count()) === 0, 'viewer cannot restore a backup');
  await page.keyboard.press('T');
  await waitText('Trial Balance');
  assert((await page.locator('[data-action="export-csv"]').count()) > 0, 'viewer can still read and export reports');

  await page.selectOption('#user-select', { label: 'Amit Accountant · Accountant' });
  await page.waitForTimeout(250);
  assert((await page.locator('.role-banner').innerText()).includes('Accountant'), 'accountant banner is shown');
  await page.keyboard.press('F5');
  await page.waitForSelector('#voucher-form');
  assert((await page.locator('#voucher-form').count()) === 1, 'accountant can open voucher entry');
  await page.keyboard.press('Escape');
  await open('companies');
  assert((await page.locator('[data-action="delete-company"]').count()) === 0, 'accountant cannot delete companies');
  assert((await page.locator('[data-action="add-year"]').count()) === 0, 'accountant cannot add a financial year');
  assert((await page.locator('#user-form').count()) === 0, 'accountant cannot manage users');
  await page.selectOption('#user-select', { label: 'Local owner · Owner' });
  await page.waitForTimeout(200);
  assert((await page.locator('#user-form').count()) === 1, 'owner can manage users again');

  // --- Backup and restore ------------------------------------------------------
  await restore();
  await open('backup');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('a[download]').click(),
  ]);
  const backupPath = `${OUT}/backup-download.json`;
  await download.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert(backup.companies?.[0]?.vouchers.length === 22, 'backup contains all 22 vouchers');
  assert(backup.companies[0].gst?.enabled && backup.companies[0].payroll?.runs?.length === 1, 'backup retains GST and payroll data');
  assert(Array.isArray(backup.audit) && backup.audit.length > 0, 'backup retains the audit trail');

  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.companies[0].name = 'Damaged Books';
    saved.companies[0].vouchers = [];
    localStorage.setItem(key, JSON.stringify(saved));
    location.reload();
  }, KEY);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(250);
  assert((await voucherCount()) === 0, 'test data was deliberately damaged');

  await open('backup');
  await page.fill('#restore-form textarea', JSON.stringify(backup));
  await page.click('#restore-form button[type="submit"]');
  await page.waitForTimeout(550);
  assert((await company()).name === 'Meridian Precision Components Pvt Ltd', 'restore recovers the company name');
  assert((await voucherCount()) === 22, 'restore recovers all vouchers');
  assert((await state()).audit.some((entry) => entry.action === 'data.restore'), 'restore is recorded in the audit trail');

  const beforeInvalid = await voucherCount();
  await open('backup');
  await page.fill('#restore-form textarea', '{"nope":true}');
  await page.click('#restore-form button[type="submit"]');
  await page.waitForTimeout(300);
  err = await errorText();
  assert(err.length > 0, 'invalid backup is rejected with an error', err);
  assert((await voucherCount()) === beforeInvalid, 'invalid restore leaves existing books intact');

  await open('backup');
  await page.click('[data-action="save-snapshot"]');
  await page.waitForTimeout(300);
  body = await text();
  assert(/manual/i.test(body) && body.includes('22'), 'manual snapshot is saved and listed', body.slice(0, 1800));

  // --- Imports -----------------------------------------------------------------
  await restore();
  await open('companies');
  await page.fill('#company-form [name="name"]', 'CA Import Co');
  await page.fill('#company-form [name="fyStart"]', '2026-04-01');
  await page.click('#company-form button[type="submit"]');
  await page.waitForTimeout(300);
  s = await state();
  const importCompany = s.companies.find((entry) => entry.name === 'CA Import Co');
  assert(Boolean(importCompany), 'second company for import created');

  await open('importData');
  const ledgerCsvPath = `${OUT}/ledger-upload.csv`;
  fs.writeFileSync(ledgerCsvPath, [
    'Name,Group,Opening,Type',
    'Imported Debtor,Sundry Debtors,1000,Dr',
    'Imported Creditor,Sundry Creditors,1000,Cr',
  ].join('\n'));
  await page.setInputFiles('[data-csv-target="ledger-csv"]', ledgerCsvPath);
  await page.waitForFunction(() => document.querySelector('#ledger-csv')?.value.includes('Imported Creditor'));
  assert((await page.inputValue('#ledger-csv')).includes('Imported Debtor'), 'ledger CSV loads through the file picker');
  await page.click('[data-action="import-ledgers"]');
  await page.waitForTimeout(300);
  let imported = (await state()).companies.find((entry) => entry.name === 'CA Import Co');
  assert(imported.ledgers.some((ledger) => ledger.name === 'Imported Debtor') && imported.ledgers.some((ledger) => ledger.name === 'Imported Creditor'), 'CSV ledger import creates both ledgers');
  const ledgerCount = imported.ledgers.length;

  const badLedgerCsvPath = `${OUT}/bad-ledger-upload.csv`;
  fs.writeFileSync(badLedgerCsvPath, 'Bad Ledger,No Such Group,100,Dr');
  await page.setInputFiles('[data-csv-target="ledger-csv"]', badLedgerCsvPath);
  await page.waitForFunction(() => document.querySelector('#ledger-csv')?.value.includes('Bad Ledger'));
  await page.click('[data-action="import-ledgers"]');
  await page.waitForTimeout(250);
  imported = (await state()).companies.find((entry) => entry.name === 'CA Import Co');
  assert(imported.ledgers.length === ledgerCount, 'invalid ledger CSV is rejected as a whole');
  assert((await text()).includes('No Such Group') || (await page.locator('.flash').innerText().catch(() => '')).length > 0, 'invalid ledger import shows a reason');

  const voucherCsvPath = `${OUT}/voucher-upload.csv`;
  fs.writeFileSync(voucherCsvPath, [
    'Date,Type,No,Ledger,Side,Amount,Narration',
    '2026-04-10,Journal,1,Imported Debtor,Dr,1000,',
    '2026-04-10,Journal,1,Imported Creditor,Cr,1000,',
  ].join('\n'));
  await page.setInputFiles('[data-csv-target="voucher-csv"]', voucherCsvPath);
  await page.waitForFunction(() => document.querySelector('#voucher-csv')?.value.includes('Imported Creditor'));
  assert((await page.inputValue('#voucher-csv')).includes('2026-04-10,Journal,1'), 'voucher CSV loads through the file picker');
  await page.click('[data-action="import-vouchers"]');
  await page.waitForTimeout(350);
  imported = (await state()).companies.find((entry) => entry.name === 'CA Import Co');
  assert(imported.vouchers.length === 1, 'CSV voucher import creates one balanced voucher');
  await page.keyboard.press('T');
  await waitText('Trial Balance');
  body = await text();
  assert(body.includes('Trial balance tallies.'), 'imported voucher leaves the trial balance tallied', body.slice(0, 1400));

  const voucherCountBefore = imported.vouchers.length;
  await open('importData');
  await page.fill('#voucher-csv', [
    'Date,Type,No,Ledger,Side,Amount,Narration',
    '2026-04-11,Journal,2,Imported Debtor,Dr,1000,',
    '2026-04-11,Journal,2,Imported Creditor,Cr,900,',
  ].join('\n'));
  await page.click('[data-action="import-vouchers"]');
  await page.waitForTimeout(300);
  imported = (await state()).companies.find((entry) => entry.name === 'CA Import Co');
  assert(imported.vouchers.length === voucherCountBefore, 'unbalanced voucher CSV is rejected as a whole');

  await open('importData');
  const tallyXmlPath = `${OUT}/tally-upload.xml`;
  fs.writeFileSync(tallyXmlPath, [
    '<ENVELOPE><BODY><TALLYMESSAGE>',
    '<LEDGER NAME="Tally Imported"><PARENT>Sundry Debtors</PARENT><OPENINGBALANCE>0</OPENINGBALANCE></LEDGER>',
    '</TALLYMESSAGE></BODY></ENVELOPE>',
  ].join(''));
  await page.setInputFiles('[data-csv-target="tally-xml"]', tallyXmlPath);
  await page.waitForFunction(() => document.querySelector('#tally-xml')?.value.includes('Tally Imported'));
  assert((await page.inputValue('#tally-xml')).includes('<ENVELOPE>'), 'Tally XML loads through the file picker');
  await page.click('[data-action="import-tally"]');
  await page.waitForTimeout(300);
  imported = (await state()).companies.find((entry) => entry.name === 'CA Import Co');
  assert(imported.ledgers.some((ledger) => ledger.name === 'Tally Imported'), 'Tally XML ledger import works');

  // --- Adversarial voucher and stock controls ----------------------------------
  await restore();
  const startingVouchers = await voucherCount();
  const attemptVoucher = async (shortcut, setup, label, expected) => {
    await page.keyboard.press(shortcut);
    await page.waitForSelector('#voucher-form');
    await setup();
    await page.click('#voucher-form button[type="submit"]');
    await page.waitForTimeout(300);
    const message = await errorText();
    assert(expected.test(message), label, message);
    assert((await voucherCount()) === startingVouchers, `${label} leaves the books unchanged`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
  };

  await attemptVoucher('F8', async () => {
    await page.fill('#voucher-form [name="date"]', '2026-04-21');
    rows = page.locator('#voucher-form tr.line');
    await fillLine(rows.nth(0), 'Apex Auto Ltd', 'Dr', 200000);
    await fillLine(rows.nth(1), 'Sales', 'Cr', 200000);
    await page.click('[data-action="add-item"]');
    const item = page.locator('#stock-items tr.item-line').last();
    await pick(item.locator('select.item'), 'FG Gearbox');
    await item.locator('input.batch').fill('LOT-APR');
    await item.locator('input.expiry').fill('2027-03-31');
    await item.locator('input.qty').fill('40');
    await item.locator('input.rate').fill('5000');
  }, 'over-selling a tracked batch is rejected', /only|available|stock|quantity/i);

  await attemptVoucher('F8', async () => {
    await page.fill('#voucher-form [name="date"]', '2026-04-03');
    rows = page.locator('#voucher-form tr.line');
    await fillLine(rows.nth(0), 'Apex Auto Ltd', 'Dr', 5000);
    await fillLine(rows.nth(1), 'Sales', 'Cr', 5000);
    await page.click('[data-action="add-item"]');
    const item = page.locator('#stock-items tr.item-line').last();
    await pick(item.locator('select.item'), 'FG Gearbox');
    await item.locator('input.batch').fill('LOT-APR');
    await item.locator('input.expiry').fill('2027-03-31');
    await item.locator('input.qty').fill('1');
    await item.locator('input.rate').fill('5000');
  }, 'back-dated sale before production is rejected', /only|available|stock|quantity/i);

  await attemptVoucher('F8', async () => {
    await page.fill('#voucher-form [name="date"]', '2026-04-21');
    rows = page.locator('#voucher-form tr.line');
    await fillLine(rows.nth(0), 'Apex Auto Ltd', 'Dr', 5000);
    await fillLine(rows.nth(1), 'Sales', 'Cr', 5000);
    await page.click('[data-action="add-item"]');
    const item = page.locator('#stock-items tr.item-line').last();
    await pick(item.locator('select.item'), 'FG Gearbox');
    await item.locator('input.batch').fill('WRONG-BATCH');
    await item.locator('input.qty').fill('1');
    await item.locator('input.rate').fill('5000');
  }, 'unknown batch is rejected', /batch|only|available|stock/i);

  await attemptVoucher('Control+F9', async () => {
    await page.fill('#voucher-form [name="date"]', '2026-04-22');
    rows = page.locator('#voucher-form tr.line');
    await fillLine(rows.nth(0), 'Delhi Components', 'Dr', 250000);
    await fillLine(rows.nth(1), 'Purchases', 'Cr', 250000);
    await page.click('[data-action="add-item"]');
    const item = page.locator('#stock-items tr.item-line').last();
    await pick(item.locator('select.item'), 'RM Bearing');
    await item.locator('input.qty').fill('500');
    await item.locator('input.rate').fill('500');
  }, 'purchase return above stock on hand is rejected', /only|available|stock|quantity/i);

  await attemptVoucher('F5', async () => {
    await page.fill('#voucher-form [name="date"]', '2026-04-24');
    rows = page.locator('#voucher-form tr.line');
    await fillLine(rows.nth(0), 'Rent', 'Dr', -100);
    await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', -100);
  }, 'negative voucher amounts are rejected', /positive|amount/i);

  await attemptVoucher('F8', async () => {
    await page.fill('#voucher-form [name="date"]', '2026-04-24');
    rows = page.locator('#voucher-form tr.line');
    await fillLine(rows.nth(0), 'Apex Auto Ltd', 'Dr', 1000);
    await fillLine(rows.nth(1), 'Sales', 'Cr', 900);
  }, 'unbalanced voucher is rejected', /balanced|difference/i);

  await attemptVoucher('F9', async () => {
    await page.fill('#voucher-form [name="date"]', '2026-04-24');
    rows = page.locator('#voucher-form tr.line');
    await fillLine(rows.nth(0), 'Professional Fees', 'Dr', 1000);
    await fillLine(rows.nth(1), 'Advocate Rao', 'Cr', 1000);
    await page.selectOption('#voucher-form [name="gstRate"]', { label: '18%' });
    await page.selectOption('#voucher-form [name="tdsSection"]', { label: '194J · Professional or technical fees (10%)' });
  }, 'GST and TDS cannot be combined on one voucher', /both|cannot|GST/i);

  await attemptVoucher('F9', async () => {
    await page.fill('#voucher-form [name="date"]', '2026-04-24');
    rows = page.locator('#voucher-form tr.line');
    await fillLine(rows.nth(0), 'Professional Fees', 'Dr', 1000);
    await fillLine(rows.nth(1), 'Advocate Rao', 'Cr', 1000);
    await page.selectOption('#voucher-form [name="tdsSection"]', { label: '194J · Professional or technical fees (10%)' });
    await page.fill('#voucher-form [name="tdsPan"]', 'BADPAN');
  }, 'invalid deductee PAN is rejected', /PAN/i);

  await attemptVoucher('F6', async () => {
    await page.fill('#voucher-form [name="date"]', '2026-04-24');
    rows = page.locator('#voucher-form tr.line');
    await fillLine(rows.nth(0), 'HDFC Bank Current A/c', 'Dr', 1000);
    await fillLine(rows.nth(1), 'Apex Auto Ltd', 'Cr', 1000);
    await page.waitForTimeout(320);
    const alloc = page.locator('#bill-settlement tr.bill-allocation').first();
    const bill = alloc.locator('select.alloc-bill');
    const option = await bill.locator('option').evaluateAll((nodes) => nodes.find((node) => node.value)?.value);
    if (option) await bill.selectOption(option);
    await alloc.locator('.alloc-amount').fill('5000');
  }, 'bill allocation above the receipt is rejected', /alloc|exceed|settle/i);

  // Master deletion guards and duplicate/invalid masters.
  await open('masters');
  let masterRow = page.locator('tbody tr', { hasText: 'Steel Suppliers Pvt Ltd' }).first();
  await masterRow.locator('[data-action="delete-ledger"]').click();
  await page.waitForTimeout(300);
  assert((await company()).ledgers.some((ledger) => ledger.name === 'Steel Suppliers Pvt Ltd'), 'used ledger cannot be deleted');
  await page.fill('#ledger-form [name="name"]', 'Rent');
  await pick(page.locator('#ledger-form [name="groupId"]'), 'Indirect Expenses');
  await page.click('#ledger-form button[type="submit"]');
  await page.waitForTimeout(250);
  assert((await company()).ledgers.filter((ledger) => ledger.name === 'Rent').length === 1, 'duplicate ledger name is rejected');
  await page.fill('#ledger-form [name="name"]', 'Bad GST Party');
  await pick(page.locator('#ledger-form [name="groupId"]'), 'Sundry Debtors');
  await page.fill('#ledger-form [name="gstin"]', 'BADGST');
  await page.click('#ledger-form button[type="submit"]');
  await page.waitForTimeout(250);
  assert(!(await company()).ledgers.some((ledger) => ledger.name === 'Bad GST Party'), 'invalid GSTIN is rejected');

  await open('inventory');
  row = page.locator('.panel', { hasText: 'New stock item' }).locator('tbody tr', { hasText: 'FG Gearbox' }).first();
  await row.locator('[data-action="delete-stock-item"]').click();
  await page.waitForTimeout(250);
  assert((await company()).stockItems.some((item) => item.name === 'FG Gearbox'), 'used stock item cannot be deleted');
  const godownPanel = page.locator('#godown-form').locator('xpath=ancestor::section[1]');
  const godownRow = godownPanel.locator('tbody tr', { hasText: 'Factory' }).first();
  await godownRow.locator('[data-action="delete-godown"]').click();
  await page.waitForTimeout(250);
  assert((await company()).godowns.some((godown) => godown.name === 'Factory'), 'used godown cannot be deleted');

  await open('masters');
  const centreRow = page.locator('tbody tr', { hasText: 'Production' }).first();
  assert(await centreRow.locator('[data-action="delete-cost-centre"]').isDisabled(), 'used cost centre cannot be deleted');

  // Future date outside every financial year.
  await attemptVoucher('F5', async () => {
    await page.fill('#voucher-form [name="date"]', '2028-04-01');
    rows = page.locator('#voucher-form tr.line');
    await fillLine(rows.nth(0), 'Rent', 'Dr', 100);
    await fillLine(rows.nth(1), 'HDFC Bank Current A/c', 'Cr', 100);
  }, 'date outside every financial year is rejected', /financial year|outside|closed/i);

  // --- Bank reconciliation manual matching and clear --------------------------
  await restore();
  await open('bankRecon');
  await page.selectOption('#bank-ledger-select', { label: 'HDFC Bank Current A/c' });
  await page.waitForTimeout(200);
  const bankCsvPath = `${OUT}/bank-statement-upload.csv`;
  fs.writeFileSync(bankCsvPath, [
    'Date,Description,Reference,Debit,Credit',
    '2026-04-10,Customer receipt APX,CHQ-123456,,200000',
    '2026-04-12,Supplier payment steel,CHQ-654321,118000,',
    '2026-04-13,Cash deposit,CONTRA-1,,25000',
    '2026-04-15,Office rent,RENT-APR,30000,',
    '2026-04-16,Electricity bill,ELEC-APR,20000,',
    '2026-04-18,Inward freight,FREIGHT-APR,5000,',
    '2026-04-25,Delhi Components settlement,CHQ-777777,106400,',
    '2026-04-26,Advocate Rao payment,CHQ-888888,45000,',
    '2026-04-30,Interest credit,INT-APR,,2000',
    '2026-04-30,Bank charges,CHG-APR,500,',
  ].join('\n'));
  await page.setInputFiles('[data-csv-target="bank-statement-csv"]', bankCsvPath);
  await page.waitForFunction(() => document.querySelector('#bank-statement-csv')?.value.includes('Supplier payment steel'));
  assert((await page.inputValue('#bank-statement-csv')).includes('Customer receipt APX'), 'bank statement CSV loads through the file picker');
  await page.click('[data-action="import-bank-statement"]');
  await page.waitForTimeout(300);
  await page.click('[data-action="recon-auto"]');
  await page.waitForTimeout(300);
  body = await text();
  assert(body.includes('10 / 10'), 'bank auto-match reconciles all ten statement lines', body.slice(0, 1200));
  await page.locator('[data-action="recon-unmatch"]').first().click();
  await page.waitForTimeout(250);
  body = await text();
  assert(body.includes('9 / 10'), 'unmatching a statement line reduces the matched count', body.slice(0, 1200));
  const unmatchRow = page.locator('.recon-table tbody tr').first();
  const reconSelect = unmatchRow.locator('select.recon-voucher');
  const receiptOption = await reconSelect.locator('option').evaluateAll((nodes) => nodes.find((node) => node.textContent.includes('Receipt 1'))?.value);
  assert(Boolean(receiptOption), 'unmatched bank entry can be selected manually');
  await reconSelect.selectOption(receiptOption);
  await unmatchRow.locator('[data-action="recon-match"]').click();
  await page.waitForTimeout(250);
  body = await text();
  assert(body.includes('10 / 10'), 'manual rematch restores the match', body.slice(0, 1200));
  await page.click('[data-action="recon-clear"]');
  await page.waitForTimeout(300);
  assert((await text()).includes('No statement imported') || (await text()).includes('No statement'), 'bank statement can be cleared');

  const requiredDialogs = [
    /Delete this order\?/,
    /Close this financial year\?/,
    /Delete this voucher\?/,
    /Reopen this financial year/,
    /Replace all current companies with this backup\?/,
    /Delete this ledger\?/,
    /Delete this stock item\?/,
    /Delete this godown\?/,
    /Clear this bank statement/,
  ];
  assert(dialogs.length === 10, 'advanced run raises ten confirmation dialogs', JSON.stringify(dialogs));
  assert(dialogs.every((entry) => entry.startsWith('confirm: ')), 'every native dialog is an expected confirmation', JSON.stringify(dialogs));
  for (const pattern of requiredDialogs) {
    assert(dialogs.some((entry) => pattern.test(entry)), `dialog text is explicit: ${pattern}`, JSON.stringify(dialogs));
  }

  assert(errors.length === 0, 'no page or console errors in advanced controls', errors.join('\n'));
  fs.writeFileSync(`${OUT}/ca-advanced-summary.json`, JSON.stringify({ checks, errors, dialogs: dialogs.slice(-20), downloads }, null, 2));
  console.log(`CA advanced passed checks=${checks} errors=${errors.length} dialogs=${dialogs.length} downloads=${downloads.length}`);
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});

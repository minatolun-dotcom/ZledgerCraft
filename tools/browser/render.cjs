const playwright = require('playwright');

const BROWSER = process.env.BROWSER === 'firefox' ? 'firefox' : process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4173/';
const COUNT = Number(process.env.VOUCHER_COUNT || 1000);

(async () => {
  const browser = await playwright[BROWSER].launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  let checks = 0;
  const assert = (condition, label, detail = '') => {
    checks += 1;
    if (!condition) throw new Error(`FAIL ${checks}: ${label}${detail ? `\n${detail}` : ''}`);
    console.log(`ok ${checks}: ${label}`);
  };

  try {
    await page.goto(BASE);
    const state = await page.evaluate(async (count) => {
      const store = await import('/src/store.js');
      const result = store.createCompany('Render bench', '2025-04-01');
      const company = result.company;
      const cash = company.ledgers.find((ledger) => ledger.name === 'Cash');
      const sales = company.ledgers.find((ledger) => ledger.name === 'Sales');
      company.vouchers = Array.from({ length: count }, (_, index) => ({
        id: `bench-${index}`,
        type: index % 2 ? 'Payment' : 'Receipt',
        no: index + 1,
        date: `2025-${String(4 + Math.floor(index / 3000)).padStart(2, '0')}-${String(1 + (index % 27)).padStart(2, '0')}`,
        total: 100 + (index % 900),
        narration: `Synthetic entry ${index}`,
        lines: [
          { ledgerId: cash.id, side: index % 2 ? 'Cr' : 'Dr', amount: 100 + (index % 900) },
          { ledgerId: sales.id, side: index % 2 ? 'Dr' : 'Cr', amount: 100 + (index % 900) },
        ],
      }));
      return {
        version: 1,
        activeCompanyId: company.id,
        companies: [company],
        audit: [],
        users: [{ id: 'u1', name: 'Owner', role: 'owner' }],
        currentUserId: 'u1',
      };
    }, COUNT);
    await page.evaluate((next) => localStorage.setItem('zledgercraft.state.v1', JSON.stringify(next)), state);
    await page.reload();
    await page.waitForSelector('.app-shell');
    await page.evaluate(async () => {
      const ui = await import('/src/ui.js');
      ui.navigate('daybook');
    });
    await page.waitForSelector('#daybook-form');

    assert((await page.locator('main table tbody tr').count()) === 250, 'Day Book renders 250 rows by default');
    assert((await page.locator('main').innerText()).includes(`${COUNT} vouchers`), 'Day Book keeps the full voucher count');
    assert((await page.locator('.daybook-pages').innerText()).includes('Page 1 of 4'), 'Day Book exposes page navigation');

    await page.click('[data-action="daybook-page"][data-page="2"]');
    await page.waitForFunction(() => document.querySelector('.daybook-pages')?.innerText.includes('Page 2 of 4'));
    assert((await page.locator('main table tbody tr').count()) === 250, 'second Day Book page renders 250 rows');

    await page.selectOption('#daybook-form select[name="pageSize"]', 'all');
    await page.click('#daybook-form button[type="submit"]');
    await page.waitForFunction((count) => document.querySelectorAll('main table tbody tr').length === count, COUNT);
    assert((await page.locator('main table tbody tr').count()) === COUNT, 'All rows renders the complete period');

    const exportCount = await page.evaluate(async () => {
      const ui = await import('/src/ui.js');
      const report = ui.reportExportData();
      return report.rows.filter((row) => /^\d{2}-[A-Z][a-z]{2}-\d{4}$/.test(row[0] || '')).length;
    });
    assert(exportCount === COUNT, 'report export data includes every voucher regardless of paging', String(exportCount));
    assert(errors.length === 0, 'no page or console errors in the render regression', errors.join('\n'));
  } finally {
    await browser.close();
  }
  console.log(`Render regression passed browser=${BROWSER} checks=${checks} vouchers=${COUNT}`);
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

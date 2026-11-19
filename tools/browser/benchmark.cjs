const fs = require('node:fs');
const path = require('node:path');
const playwright = require('playwright');

const BROWSER = process.env.BROWSER === 'firefox' ? 'firefox' : process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4173/';
const OUT = process.env.AUDIT_OUT || path.join(__dirname, '.artifacts');
const COUNT = Number(process.env.VOUCHER_COUNT || 10_000);
const MAX_MEDIAN_MS = Number(process.env.BENCH_MAX_MS || 900);

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

(async () => {
  const browser = await playwright[BROWSER].launch();
  try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
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

  const results = {};
  for (const screen of ['gateway', 'daybook', 'trial', 'statistics']) {
    results[screen] = await page.evaluate(async (target) => {
      const ui = await import('/src/ui.js');
      const runs = [];
      for (let run = 0; run < 4; run += 1) {
        const started = performance.now();
        ui.navigate(target);
        runs.push(performance.now() - started);
      }
      return runs;
    }, screen);
  }
  const summary = Object.fromEntries(
    Object.entries(results).map(([screen, runs]) => [
      screen,
      { runs: runs.map((value) => Number(value.toFixed(1))), medianMs: Number(median(runs).toFixed(1)) },
    ]),
  );
  const report = { browser: BROWSER, vouchers: COUNT, screens: summary, errors };
  fs.writeFileSync(path.join(OUT, 'benchmark.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) throw new Error(`Page errors during benchmark:\n${errors.join('\n')}`);
  if (summary.daybook.medianMs > MAX_MEDIAN_MS) {
    throw new Error(
      `Day Book median ${summary.daybook.medianMs} ms exceeds the ${MAX_MEDIAN_MS} ms budget`,
    );
  }
  console.log(
    `Benchmark passed browser=${BROWSER} vouchers=${COUNT} daybookMedian=${summary.daybook.medianMs}ms`,
  );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

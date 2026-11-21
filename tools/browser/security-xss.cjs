const playwright = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const BROWSER = process.env.BROWSER === 'firefox' ? 'firefox' : process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4411/';
const KEY = 'zledgercraft.state.v1';
const OUT = process.env.AUDIT_OUT || path.join(__dirname, '.artifacts');
const SNAPSHOT = `${OUT}/ca-core-state.json`;
const PAYLOAD = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';

function hostile(value, key = '') {
  if (Array.isArray(value)) return value.map((item) => hostile(item, key));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [field, child] of Object.entries(value)) {
    if (typeof child === 'string' && /name|narration|description|title|reason|reference|address|city|notes|detail|designation|bankName|batchNo|vehicleNo|transporterName|legalName|tradeName/i.test(field)) {
      out[field] = PAYLOAD;
    } else {
      out[field] = hostile(child, field);
    }
  }
  return out;
}

(async () => {
  const browser = await playwright[BROWSER].launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('dialog', async (dialog) => dialog.accept());
  await page.addInitScript(() => {
    window.print = () => {};
    window.__xss = 0;
  });

  const raw = fs.readFileSync(SNAPSHOT, 'utf8');
  const state = hostile(JSON.parse(raw));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
    location.reload();
  }, [KEY, JSON.stringify(state)]);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(250);

  const screens = await page
    .locator('.sidebar [data-screen]')
    .evaluateAll((nodes) => [...new Set(nodes.map((node) => node.dataset.screen))]);
  let checks = 0;
  const assert = (condition, label, detail = '') => {
    checks += 1;
    if (!condition) throw new Error(`FAIL ${checks}: ${label}${detail ? `\n${detail}` : ''}`);
    console.log(`ok ${checks}: ${label}`);
  };
  assert(screens.length >= 30, `hostile state loads ${screens.length} screens`, JSON.stringify(screens));

  let injected = 0;
  for (const screen of screens) {
    await page.locator(`.sidebar [data-screen="${screen}"]`).first().click();
    await page.waitForTimeout(80);
    const result = await page.evaluate(() => ({
      imgs: document.querySelectorAll('img[src="x"]').length,
      explicit: document.querySelectorAll('img[src="/x"], svg[onload]').length,
      scripts: [...document.querySelectorAll('script')].filter((node) => node.textContent?.includes('__xss')).length,
      executed: Number(window.__xss) || 0,
      text: document.querySelector('main')?.innerText?.slice(0, 300) || '',
    }));
    if (result.imgs || result.explicit || result.scripts || result.executed) {
      injected += result.imgs + result.explicit + result.scripts + result.executed;
      console.log(`INJECTED ${screen}: ${JSON.stringify(result)}`);
    }
    assert(
      result.imgs === 0 && result.explicit === 0 && result.scripts === 0 && result.executed === 0,
      `${screen} renders hostile values as text`,
      JSON.stringify(result),
    );
  }

  assert(injected === 0, 'no hostile payload created DOM or executed');
  assert(errors.length === 0, 'no page or console errors during hostile sweep', errors.join('\n'));
  console.log(`Security XSS sweep passed checks=${checks} screens=${screens.length} injected=${injected}`);
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});

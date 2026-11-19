const playwright = require('playwright');
const BROWSER = process.env.BROWSER === 'firefox' ? 'firefox' : process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const base = (process.env.AUDIT_BASE || 'http://127.0.0.1:4174').replace(/\/$/, '');

async function server() {
  const response = await fetch(`${base}/api/workspace`, { cache: 'no-store' });
  return response.json();
}

async function waitForServer(predicate, timeout = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const payload = await server();
    if (predicate(payload)) return payload;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server workspace did not reach the expected state');
}

async function createCompany(page, name) {
  await page.click('[data-screen="companies"]');
  await page.waitForSelector('#company-form');
  await page.fill('#company-form [name="name"]', name);
  await page.fill('#company-form [name="fyStart"]', '2026-04-01');
  await page.click('#company-form button[type="submit"]');
  await page.waitForTimeout(300);
}

(async () => {
  await fetch(`${base}/api/workspace`, { method: 'DELETE' });
  const empty = { version: 1, activeCompanyId: null, companies: [], users: [], audit: [] };
  const putState = (baseRev, name) =>
    fetch(`${base}/api/workspace`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: { ...empty, probe: name }, baseRev }),
    });
  await putState(0, 'initial');
  const concurrent = await Promise.all([putState(1, 'one'), putState(1, 'two')]);
  const statuses = concurrent.map((response) => response.status).sort((a, b) => a - b);
  if (statuses[0] !== 200 || statuses[1] !== 409) {
    throw new Error(`overlapping writes were not rejected: ${statuses.join(', ')}`);
  }
  console.log('ok: overlapping server writes are rejected');
  const meta = await (await fetch(`${base}/api/workspace?meta=1`)).json();
  if (meta.storage !== 'sqlite') throw new Error(`expected SQLite storage, got ${meta.storage}`);
  console.log('ok: workspace uses the SQLite backend');
  await fetch(`${base}/api/workspace`, { method: 'DELETE' });
  const browser = await playwright[BROWSER].launch();
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const contextB = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const errors = [];
  for (const page of [pageA, pageB]) page.on('pageerror', (error) => errors.push(error.message));

  await pageA.goto(`${base}/?workspace=1`, { waitUntil: 'domcontentloaded' });
  await pageA.waitForFunction(() => document.querySelector('main')?.innerText.includes('Start a company'));
  await createCompany(pageA, 'Shared Co');
  const first = await waitForServer(
    (payload) => payload.state?.companies?.some((company) => company.name === 'Shared Co'),
  );
  if (!first.rev) throw new Error('workspace save did not return a revision');
  console.log('ok: first client saves at a revision');

  await pageB.goto(`${base}/?workspace=1`, { waitUntil: 'domcontentloaded' });
  await pageB.waitForFunction(() => document.body.innerText.includes('Shared Co'));
  console.log('ok: second client loads the same revision');

  await createCompany(pageA, 'A Second Co');
  await waitForServer((payload) =>
    payload.state?.companies?.some((company) => company.name === 'A Second Co'),
  );
  await createCompany(pageB, 'B Co');
  const merged = await waitForServer(
    (payload) =>
      payload.state?.companies?.some((company) => company.name === 'A Second Co') &&
      payload.state?.companies?.some((company) => company.name === 'B Co'),
  );
  console.log('ok: independent client additions merge', merged.rev);
  await pageB.waitForFunction(() => document.body.innerText.includes('B Co'));
  if (await pageB.locator('#workspace-banner .role-banner.warn').count()) {
    throw new Error('merged client still shows a conflict banner');
  }
  console.log('ok: merged client receives both companies');
  await pageB.screenshot({ path: '/tmp/visual/shots/77-workspace-merge.png', fullPage: true });

  await createCompany(pageB, 'C Co');
  const recovered = await waitForServer((payload) =>
    payload.state?.companies?.some((company) => company.name === 'C Co'),
  );
  if (recovered.rev <= merged.rev) throw new Error('client did not advance after merge');
  console.log('ok: client can save after merge');

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});

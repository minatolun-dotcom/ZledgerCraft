const playwright = require('playwright');

const BROWSER = process.env.BROWSER === 'firefox' ? 'firefox' : process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4173/';

(async () => {
  const browser = await playwright[BROWSER].launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  const requests = [];
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

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        ok: true,
        required: true,
        user: null,
        emailReset: true,
        storage: 'sqlite',
        tls: false,
        lan: false,
      },
    }),
  );
  await page.route('**/api/auth/forgot', async (route) => {
    requests.push({ path: 'forgot', body: route.request().postDataJSON() });
    await route.fulfill({
      json: {
        ok: true,
        message: 'If that account has an email address, a reset link has been sent.',
      },
    });
  });
  await page.route('**/api/auth/reset', async (route) => {
    requests.push({ path: 'reset', body: route.request().postDataJSON() });
    await route.fulfill({
      json: { ok: true, message: 'Password reset. Sign in with the new password.' },
    });
  });

  try {
    await page.goto(BASE);
    await page.waitForSelector('#login-form');
    assert(await page.locator('details.auth-reset').isVisible(), 'forgot-password control is available');
    await page.click('details.auth-reset summary');
    await page.fill('#forgot-password-form input[name="identifier"]', 'books@example.com');
    await page.click('#forgot-password-form button[type="submit"]');
    await page.waitForFunction(() =>
      document.querySelector('#forgot-status')?.textContent.includes('reset link has been sent'),
    );
    assert(requests.length === 1 && requests[0].path === 'forgot', 'forgot request reaches the API');
    assert(requests[0].body.identifier === 'books@example.com', 'forgot request carries the identifier');

    await page.goto(`${BASE}?reset=abcdef`);
    await page.waitForSelector('#reset-password-form');
    assert(
      (await page.locator('#reset-password-form').getAttribute('data-token')) === 'abcdef',
      'reset screen keeps the token',
    );
    await page.fill('#reset-password-form input[name="newPassword"]', 'new ledger pass');
    await page.fill('#reset-password-form input[name="confirmPassword"]', 'different password');
    await page.click('#reset-password-form button[type="submit"]');
    await page.waitForFunction(() =>
      document.querySelector('#reset-password-error')?.textContent.includes('do not match'),
    );
    assert(requests.length === 1, 'mismatched passwords do not call reset API');

    await page.fill('#reset-password-form input[name="confirmPassword"]', 'new ledger pass');
    await page.click('#reset-password-form button[type="submit"]');
    await page.waitForSelector('#login-form');
    assert(requests.length === 2 && requests[1].path === 'reset', 'reset request reaches the API');
    assert(requests[1].body.token === 'abcdef', 'reset request carries the token');
    assert(
      (await page.locator('#login-error').innerText()).includes('Password reset'),
      'successful reset returns to sign-in with a message',
    );
    assert(errors.length === 0, 'no page or console errors in the login/reset regression', errors.join('\n'));
  } finally {
    await browser.close();
  }
  console.log(`Login/reset regression passed browser=${BROWSER} checks=${checks}`);
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

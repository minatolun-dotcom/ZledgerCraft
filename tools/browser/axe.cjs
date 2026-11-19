const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('node:fs');
const path = require('node:path');
const playwright = require('playwright');

const BROWSER = process.env.BROWSER === 'firefox' ? 'firefox' : process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4173/';
const OUT = process.env.AUDIT_OUT || path.join(__dirname, '.artifacts');
const state = fs.readFileSync(path.join(OUT, 'ca-core-state.json'), 'utf8');
const screens = ['gateway', 'daybook', 'vouchers', 'masters', 'trial', 'statistics'];

(async () => {
  const browser = await playwright[BROWSER].launch();
  try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.addInitScript((snapshot) => {
    localStorage.setItem('zledgercraft.state.v1', snapshot);
  }, state);
  await page.goto(BASE);
  await page.waitForSelector('.app-shell');

  const findings = [];
  for (const screen of screens) {
    await page.evaluate(async (target) => {
      const ui = await import('/src/ui.js');
      ui.navigate(target);
    }, screen);
    await page.waitForTimeout(80);
    const report = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const relevant = report.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    if (relevant.length) {
      findings.push({
        screen,
        violations: relevant.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          nodes: violation.nodes.slice(0, 5).map((node) => node.target),
        })),
      });
    }
    console.log(
      `axe ${screen}: ${relevant.length} serious/critical violation${relevant.length === 1 ? '' : 's'}`,
    );
  }
  fs.writeFileSync(path.join(OUT, 'axe.json'), JSON.stringify({ screens, findings, errors }, null, 2));
  if (errors.length) throw new Error(`Page errors during axe pass:\n${errors.join('\n')}`);
  if (findings.length) {
    throw new Error(`Serious accessibility findings:\n${JSON.stringify(findings, null, 2)}`);
  }
  console.log(`Accessibility pass browser=${BROWSER} screens=${screens.length}`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

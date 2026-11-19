// ZledgerCraft - expiring signed management-report links.
// The report is a small server-rendered summary, not a workspace dump. It only
// needs the pure accounting engine and the saved workspace state.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { inGroupKey, ledgerTotals, trialBalance } from './src/accounting.js';

const TOKEN_SCOPE = 'daily-report';
const DEFAULT_TTL_HOURS = 7 * 24;

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function reportSecret(env = process.env) {
  return text(env.ZL_REPORT_SECRET) || text(env.DATABASE_URL) || text(env.ZL_OWNER_PASSWORD);
}

export function reportTtlMs(env = process.env) {
  const hours = Number(env.ZL_REPORT_TTL_HOURS) || DEFAULT_TTL_HOURS;
  return Math.min(30 * 24, Math.max(1, hours)) * 60 * 60 * 1000;
}

export function createReportToken(secret, { now = Date.now(), ttlMs = DEFAULT_TTL_HOURS * 3600000 } = {}) {
  if (!secret) throw new Error('A report signing secret is required.');
  const payload = base64url(
    JSON.stringify({
      scope: TOKEN_SCOPE,
      iat: new Date(now).toISOString(),
      exp: new Date(now + ttlMs).toISOString(),
    }),
  );
  return `${payload}.${sign(secret, payload)}`;
}

export function verifyReportToken(secret, token, { now = Date.now() } = {}) {
  if (!secret || !token || typeof token !== 'string') return { ok: false, reason: 'invalid' };
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return { ok: false, reason: 'invalid' };
  const expected = sign(secret, payload);
  if (Buffer.byteLength(expected) !== Buffer.byteLength(signature)) return { ok: false, reason: 'invalid' };
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return { ok: false, reason: 'invalid' };
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed?.scope !== TOKEN_SCOPE || !parsed.exp) return { ok: false, reason: 'invalid' };
  const expiresAt = Date.parse(parsed.exp);
  if (!Number.isFinite(expiresAt)) return { ok: false, reason: 'invalid' };
  if (expiresAt <= now) return { ok: false, reason: 'expired', expiresAt: new Date(expiresAt).toISOString() };
  return { ok: true, expiresAt: new Date(expiresAt).toISOString(), issuedAt: parsed.iat || null };
}

export function normalizeRecipients(value) {
  const items = Array.isArray(value) ? value : String(value ?? '').split(/[\s,;]+/);
  const seen = new Set();
  const recipients = [];
  for (const item of items) {
    const email = text(item).toLowerCase();
    if (!email || seen.has(email)) continue;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
      return { ok: false, error: `Invalid email address: ${email.slice(0, 80)}` };
    }
    seen.add(email);
    recipients.push(email);
  }
  if (recipients.length > 10) return { ok: false, error: 'Use at most 10 report recipients.' };
  return { ok: true, recipients };
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateLabel(value) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return String(value || '');
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function reportDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function buildDailyReport(state, { now = new Date(), backup = null, recipients = [] } = {}) {
  const at = reportDate(now);
  const today = at.toISOString().slice(0, 10);
  const companies = Array.isArray(state?.companies) ? state.companies : [];
  const rows = [];
  const totals = {
    sales: 0,
    purchases: 0,
    cashBank: 0,
    receivables: 0,
    payables: 0,
    vouchersToday: 0,
    balanced: 0,
    unbalanced: 0,
  };

  for (const company of companies) {
    const asOn = today > company.fyEnd ? company.fyEnd : today < company.fyStart ? company.fyStart : today;
    const monthStart = `${asOn.slice(0, 7)}-01`;
    const trial = trialBalance(company, { to: asOn });
    const balances = ledgerTotals(company, { to: asOn });
    const sumGroup = (keys) => {
      let total = 0;
      for (const entry of balances.values()) {
        const ledger = (company.ledgers ?? []).find((item) => item.id === entry.ledgerId);
        if (ledger && keys.some((key) => inGroupKey(company, ledger, key))) total += entry.closing;
      }
      return total;
    };
    const inMonth = (voucher) => voucher.date >= monthStart && voucher.date <= asOn;
    const sales = (company.vouchers ?? [])
      .filter((voucher) => inMonth(voucher) && ['Sales', 'CreditNote'].includes(voucher.type))
      .reduce((total, voucher) => total + (voucher.type === 'CreditNote' ? -1 : 1) * Number(voucher.total || 0), 0);
    const purchases = (company.vouchers ?? [])
      .filter((voucher) => inMonth(voucher) && ['Purchase', 'DebitNote'].includes(voucher.type))
      .reduce((total, voucher) => total + (voucher.type === 'DebitNote' ? -1 : 1) * Number(voucher.total || 0), 0);
    const cashBank = sumGroup(['cash', 'bank']);
    const receivables = sumGroup(['sundryDebtors']);
    const payables = -sumGroup(['sundryCreditors']);
    const vouchersToday = (company.vouchers ?? []).filter((voucher) => voucher.date === today).length;
    const row = {
      id: company.id,
      name: company.name,
      asOn,
      sales,
      purchases,
      cashBank,
      receivables,
      payables,
      vouchersToday,
      balanced: trial.balanced,
      difference: trial.difference,
    };
    rows.push(row);
    totals.sales += sales;
    totals.purchases += purchases;
    totals.cashBank += cashBank;
    totals.receivables += receivables;
    totals.payables += payables;
    totals.vouchersToday += vouchersToday;
    if (trial.balanced) totals.balanced += 1;
    else totals.unbalanced += 1;
  }

  return {
    generatedAt: at.toISOString(),
    generatedDate: today,
    companies: rows,
    totals,
    backup,
    recipients,
  };
}

export function reportSubject(report) {
  return `ZledgerCraft daily summary — ${dateLabel(report.generatedDate)}`;
}

export function reportText(report, { url = '', expiresAt = '' } = {}) {
  const lines = [
    `ZledgerCraft daily summary — ${dateLabel(report.generatedDate)}`,
    '',
  ];
  if (!report.companies.length) lines.push('No companies are set up yet.', '');
  for (const company of report.companies) {
    lines.push(
      company.name,
      `  As on ${dateLabel(company.asOn)} · ${company.vouchersToday} voucher(s) dated today`,
      `  Sales this month: ${money(company.sales)}`,
      `  Purchases this month: ${money(company.purchases)}`,
      `  Cash & bank: ${money(company.cashBank)}`,
      `  Receivables: ${money(company.receivables)} · Payables: ${money(company.payables)}`,
      `  Trial balance: ${company.balanced ? 'tallies' : `out by ${money(Math.abs(company.difference))}`}`,
      '',
    );
  }
  lines.push(
    `Totals: sales ${money(report.totals.sales)} · purchases ${money(report.totals.purchases)} · cash & bank ${money(report.totals.cashBank)}`,
    `Receivables ${money(report.totals.receivables)} · payables ${money(report.totals.payables)} · ${report.totals.unbalanced} unbalanced company(ies)`,
  );
  if (report.backup) {
    lines.push(
      `Latest backup: ${report.backup.name} (${report.backup.createdAt || 'time unknown'})${report.backup.offsite ? ' · offsite copy available' : ''}`,
    );
  } else {
    lines.push('Latest backup: none created today.');
  }
  lines.push('', 'This is a management summary, not a statutory report.', 'A branded PDF summary is attached.');
  if (url) lines.push('', `Open the signed report (expires ${expiresAt}):`, url);
  return lines.join('\n');
}

export function reportHtml(report, { url = '', expiresAt = '' } = {}) {
  const companyRows = report.companies
    .map(
      (company) => `<tr>
        <td><strong>${escapeHtml(company.name)}</strong><br><span class="muted">As on ${escapeHtml(dateLabel(company.asOn))}</span></td>
        <td class="num">${escapeHtml(money(company.sales))}</td>
        <td class="num">${escapeHtml(money(company.purchases))}</td>
        <td class="num">${escapeHtml(money(company.cashBank))}</td>
        <td class="num">${escapeHtml(money(company.receivables))}</td>
        <td class="num">${escapeHtml(money(company.payables))}</td>
        <td>${company.balanced ? 'Tallies' : `Out by ${escapeHtml(money(Math.abs(company.difference)))}`}</td>
      </tr>`,
    )
    .join('');
  const body = report.companies.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Company</th><th class="num">Sales MTD</th><th class="num">Purchases MTD</th><th class="num">Cash &amp; bank</th><th class="num">Receivables</th><th class="num">Payables</th><th>Trial balance</th></tr></thead>
        <tbody>${companyRows}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${escapeHtml(money(report.totals.sales))}</td><td class="num">${escapeHtml(money(report.totals.purchases))}</td><td class="num">${escapeHtml(money(report.totals.cashBank))}</td><td class="num">${escapeHtml(money(report.totals.receivables))}</td><td class="num">${escapeHtml(money(report.totals.payables))}</td><td>${report.totals.unbalanced ? `${report.totals.unbalanced} unbalanced` : 'All tally'}</td></tr></tfoot>
      </table></div>`
    : '<p class="muted">No companies are set up yet.</p>';
  const backup = report.backup
    ? `<p><strong>Latest backup:</strong> ${escapeHtml(report.backup.name)} <span class="muted">(${escapeHtml(report.backup.createdAt || 'time unknown')}${report.backup.offsite ? ' · offsite copy available' : ''})</span></p>`
    : '<p><strong>Latest backup:</strong> none created today.</p>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(reportSubject(report))}</title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f6f7f9;color:#17202a;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:1100px;margin:32px auto;padding:0 20px}header{border-bottom:3px solid #1f6f5c;padding-bottom:14px;margin-bottom:22px}h1{font-size:24px;margin:0 0 4px}.muted{color:#5d6d7e;font-size:13px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}.card{background:#fff;border:1px solid #d9e0e6;border-radius:8px;padding:12px}.card span{display:block;color:#5d6d7e;font-size:12px}.card strong{font-size:18px}.table-wrap{overflow-x:auto;background:#fff;border:1px solid #d9e0e6;border-radius:8px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px 10px;border-bottom:1px solid #edf0f3;text-align:left;white-space:nowrap}.num{text-align:right;font-variant-numeric:tabular-nums}tfoot td{font-weight:600;background:#f3f6f7}.note{margin-top:18px;color:#5d6d7e;font-size:12px}@media print{body{background:#fff}main{margin:0}.card,.table-wrap{border-color:#bbb}}
</style></head>
<body><main><header><h1>ZledgerCraft daily summary</h1><div class="muted">${escapeHtml(dateLabel(report.generatedDate))} · generated ${escapeHtml(new Date(report.generatedAt).toLocaleString('en-IN'))}</div></header>
<div class="cards"><div class="card"><span>Sales this month</span><strong>${escapeHtml(money(report.totals.sales))}</strong></div><div class="card"><span>Purchases this month</span><strong>${escapeHtml(money(report.totals.purchases))}</strong></div><div class="card"><span>Cash &amp; bank</span><strong>${escapeHtml(money(report.totals.cashBank))}</strong></div><div class="card"><span>Receivables</span><strong>${escapeHtml(money(report.totals.receivables))}</strong></div><div class="card"><span>Payables</span><strong>${escapeHtml(money(report.totals.payables))}</strong></div><div class="card"><span>Vouchers today</span><strong>${escapeHtml(report.totals.vouchersToday)}</strong></div></div>
${body}
${backup}
${url ? `<p><a href="${escapeHtml(url)}">Open the signed report</a> <span class="muted">· expires ${escapeHtml(expiresAt)}</span></p>` : ''}
<p class="note">This is a management summary, not a statutory report or tax filing. Amounts are in the company currency.</p>
</main></body></html>`;
}

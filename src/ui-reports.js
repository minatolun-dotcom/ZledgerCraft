// ZledgerCraft - Reports and report helpers.
// Screen functions read the live UI state exported by ui.js.
import {
  VOUCHER_TYPES,
  auditEntries,
  dateLabel,
  ledgerOptions,
  round2,
  todayIso,
} from './store.js';
import {
  AGE_BUCKETS,
  balanceSheet,
  billWiseRegister,
  cashBankBook,
  cashBankLedgers,
  cashForecast,
  cashFlow,
  consolidationSummary,
  dayBook,
  groupSummary,
  groupVouchers,
  inGroupKey,
  interestWorkingPaper,
  ledgerStatement,
  ledgerTotals,
  outstanding,
  partyStatement,
  profitAndLoss,
  ratioAnalysis,
  statistics,
  yearComparison,
  trialBalance,
  voucherRegister,
  voucherSummary,
} from './accounting.js';
import {
  state,
  view,
  filters,
  voucherLabel,
  fmtQty,
  esc,
  company,
  roleLabel,
  can,
  money,
  balanceLabel,
  reportPeriod,
  periodBar,
  asOnBar,
  auditActionLabel,
  panel,
  emptyCompanyScreen,
} from './ui.js';

export function daybookScreen() {
  if (!company()) return emptyCompanyScreen('Day Book');
  const active = company();
  const current = filters.daybook;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const rows = dayBook(active, { ...current, from, to });
  const total = round2(rows.reduce((sum, voucher) => sum + voucher.total, 0));
  const requestedSize = current.pageSize ?? 250;
  const pageSize = requestedSize === 'all' ? Math.max(1, rows.length) : Math.max(1, Number(requestedSize) || 250);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Number(current.page) || 1));
  const pageStart = (page - 1) * pageSize;
  const pageRows = rows.slice(pageStart, pageStart + pageSize);
  const typeOptions = ['All', ...Object.keys(VOUCHER_TYPES)]
    .map(
      (type) =>
        `<option value="${type}"${current.type === type ? ' selected' : ''}>${type === 'All' ? 'All voucher types' : esc(voucherLabel(type))}</option>`,
    )
    .join('');
  const sizeOptions = [100, 250, 500, 'all']
    .map(
      (size) =>
        `<option value="${size}"${String(requestedSize) === String(size) ? ' selected' : ''}>${size === 'all' ? 'All rows' : `${size} rows`}</option>`,
    )
    .join('');
  const pagination = rows.length > pageSize
    ? `<nav class="form-actions daybook-pages" aria-label="Day Book pages">
        <button class="btn small" type="button" data-action="daybook-page" data-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>Previous</button>
        <span class="muted small">Page ${page} of ${pageCount}</span>
        <button class="btn small" type="button" data-action="daybook-page" data-page="${page + 1}"${page >= pageCount ? ' disabled' : ''}>Next</button>
      </nav>`
    : '';

  return panel(
    'Day Book',
    `<form id="daybook-form" class="filter-bar">
      <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}"></label>
      <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}"></label>
      <label class="field inline-field"><span>Type</span><select name="type">${typeOptions}</select></label>
      <label class="field inline-field"><span>Rows</span><select name="pageSize">${sizeOptions}</select></label>
      <button class="btn small" type="submit">Apply</button>
      <button class="btn small ghost" type="button" data-action="new-voucher" data-type="Payment"${can('voucher.write') ? '' : ' disabled'}>New voucher <kbd>F5</kbd></button>
    </form>
    ${rows.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table">
          <thead><tr><th>Date</th><th>Voucher</th><th>Type</th><th>Particulars</th><th class="num">Amount</th></tr></thead>
          <tbody>${pageRows
            .map(
              (voucher) => `<tr class="clickable" data-action="open-voucher" data-id="${esc(voucher.id)}">
                <td>${esc(dateLabel(voucher.date))}</td>
                <td><strong>${voucher.no}</strong></td>
                <td>${esc(voucherLabel(voucher.type))}</td>
                <td class="muted">${esc(voucherSummary(active, voucher))}</td>
                <td class="num">${money(voucher.total)}</td>
              </tr>`,
            )
            .join('')}</tbody>
          <tfoot><tr><td colspan="4">${rows.length} voucher${rows.length === 1 ? '' : 's'}${rows.length > pageSize ? ` · showing ${pageStart + 1}–${Math.min(rows.length, pageStart + pageSize)}` : ''}</td><td class="num">${money(total)}</td></tr></tfoot>
        </table></div>
        ${pagination}`
      : '<p class="muted">No vouchers in this range.</p>'}`,
    'Click a row to open the voucher. Large books are paged; exports always include the full period.',
  );
}

export function ledgerPickScreen() {
  if (!company()) return emptyCompanyScreen('Ledger');
  const active = company();
  const totals = ledgerTotals(active);
  const rows = ledgerOptions(active)
    .map((ledger) => {
      const closing = totals.get(ledger.id)?.closing ?? 0;
      return `<tr class="clickable ledger-row" data-action="pick-ledger" data-id="${esc(ledger.id)}"
        data-search="${esc(`${ledger.name} ${ledger.groupName}`.toLowerCase())}">
        <td><strong>${esc(ledger.name)}</strong></td>
        <td class="muted">${esc(ledger.groupName)}</td>
        <td class="num ${closing < 0 ? 'neg' : ''}">${balanceLabel(closing)}</td>
      </tr>`;
    })
    .join('');

  return panel(
    'Select ledger',
    `<label class="field search-field">
      <span>Search</span>
      <input id="ledger-search" placeholder="Type a ledger or group name" autocomplete="off">
    </label>
    <table class="data-table">
      <thead><tr><th>Ledger</th><th>Group</th><th class="num">Closing balance</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  );
}

export function ledgerScreen() {
  const active = company();
  if (!active) return emptyCompanyScreen('Ledger');
  const ledger = active.ledgers.find((item) => item.id === view.id);
  if (!ledger) return panel('Ledger', '<p class="muted">That ledger no longer exists.</p>');
  const current = filters.statement;
  const statement = ledgerStatement(active, ledger.id, current);
  const from = statement.from;
  const to = statement.to;

  const rows = statement.rows
    .map(
      (row) => `<tr class="clickable" data-action="open-voucher" data-id="${esc(row.voucherId)}">
        <td>${esc(dateLabel(row.date))}</td>
        <td>${esc(row.voucher)}</td>
        <td class="muted">${esc(row.particulars)}</td>
        <td class="num">${row.debit ? money(row.debit) : ''}</td>
        <td class="num">${row.credit ? money(row.credit) : ''}</td>
        <td class="num">${balanceLabel(row.balance)}</td>
      </tr>`,
    )
    .join('');

  return panel(
    esc(ledger.name),
    `<form id="statement-form" class="filter-bar">
      <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}"></label>
      <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}"></label>
      <button class="btn small" type="submit">Apply</button>
      <button class="btn small ghost" type="button" data-screen="ledgerPick">Change ledger</button>
    </form>
    <table class="data-table">
      <thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
      <tbody>
        <tr class="opening-row"><td colspan="5">Opening balance</td><td class="num">${balanceLabel(statement.opening)}</td></tr>
        ${rows || '<tr><td colspan="6" class="muted">No transactions in this period.</td></tr>'}
      </tbody>
      <tfoot>
        <tr><td colspan="3">Closing balance</td><td class="num">${money(statement.debitTotal)}</td><td class="num">${money(statement.creditTotal)}</td><td class="num">${balanceLabel(statement.closing)}</td></tr>
      </tfoot>
    </table>`,
    `${esc(statement.groupName)} · ${esc(ledger.name)}`,
  );
}

export function trialScreen() {
  if (!company()) return emptyCompanyScreen('Trial Balance');
  const active = company();
  const report = trialBalance(active, { to: filters.period.to || active.fyEnd });
  const rows = report.rows
    .map(
      (row) => `<tr>
        <td class="muted">${esc(row.groupName)}</td>
        <td>${esc(row.name)}</td>
        <td class="num">${row.debit ? money(row.debit) : ''}</td>
        <td class="num">${row.credit ? money(row.credit) : ''}</td>
      </tr>`,
    )
    .join('');

  return panel(
    'Trial Balance',
    asOnBar('period-form', report.asOn) +
      (report.rows.length
      ? `<table class="data-table">
          <thead><tr><th>Group</th><th>Ledger</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="2">Total</td><td class="num">${money(report.debitTotal)}</td><td class="num">${money(report.creditTotal)}</td></tr></tfoot>
        </table>
        <p class="verdict ${report.balanced ? 'ok' : 'bad'}">${report.balanced ? 'Trial balance tallies.' : `Out of balance by ${money(Math.abs(report.difference))}.`}</p>`
      : '<p class="muted">No balances yet. Add opening balances or vouchers.</p>'),
    `As on ${esc(dateLabel(report.asOn))}`,
  );
}

function isoShiftDay(iso, days) {
  return new Date(Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)) + days,
  )).toISOString().slice(0, 10);
}

function previousPeriod(from, to) {
  const days = Math.max(
    1,
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1,
  );
  const priorTo = isoShiftDay(from, -1);
  return { from: isoShiftDay(priorTo, -(days - 1)), to: priorTo };
}

export function consolidationScreen() {
  const active = company();
  if (!active) return emptyCompanyScreen('Consolidation');
  const asOn = filters.consolidation?.asOn || active.fyEnd;
  const report = consolidationSummary(state.companies, { asOn });
  return panel(
    'Company consolidation',
    `<form id="consolidation-form" class="filter-bar">
      <label class="field inline-field"><span>As on</span><input name="asOn" type="date" value="${esc(asOn)}"></label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    <div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Companies</span><strong>${report.rows.length}</strong><span class="muted small">All accessible companies</span></div>
      <div class="ratio-card"><span class="ratio-label">Combined income</span><strong>${money(report.totals.income)}</strong><span class="muted small">Direct and indirect</span></div>
      <div class="ratio-card"><span class="ratio-label">Combined net profit</span><strong>${money(report.totals.netProfit)}</strong><span class="muted small">Before eliminations</span></div>
      <div class="ratio-card"><span class="ratio-label">Combined cash & bank</span><strong>${money(report.totals.cash)}</strong><span class="muted small">Across all companies</span></div>
    </div>
    <table class="data-table compact">
      <thead><tr><th>Company</th><th>As on</th><th class="num">Income</th><th class="num">Expenses</th><th class="num">Net profit</th><th class="num">Assets</th><th class="num">Liabilities</th><th class="num">Receivable</th><th class="num">Payable</th><th class="num">Cash & bank</th></tr></thead>
      <tbody>${report.rows.map((row) => `<tr><td><strong>${esc(row.name)}</strong></td><td>${esc(dateLabel(row.asOn))}</td><td class="num">${money(row.income)}</td><td class="num">${money(row.expenses)}</td><td class="num ${row.netProfit < 0 ? 'neg' : ''}">${money(row.netProfit)}</td><td class="num">${money(row.assets)}</td><td class="num">${money(row.liabilities)}</td><td class="num">${money(row.receivable)}</td><td class="num">${money(row.payable)}</td><td class="num">${money(row.cash)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2">Combined</td><td class="num">${money(report.totals.income)}</td><td class="num">${money(report.totals.expenses)}</td><td class="num">${money(report.totals.netProfit)}</td><td class="num">${money(report.totals.assets)}</td><td class="num">${money(report.totals.liabilities)}</td><td class="num">${money(report.totals.receivable)}</td><td class="num">${money(report.totals.payable)}</td><td class="num">${money(report.totals.cash)}</td></tr></tfoot>
    </table>`,
    'Simple aggregation of each company\'s own financial year. Inter-company balances, transactions and ownership adjustments are not eliminated; this is not a statutory consolidated statement.',
  );
}

export function exceptionsScreen() {
  if (!company()) return emptyCompanyScreen('Exception register');
  const active = company();
  const asOn = filters.exceptions?.asOn || todayIso();
  const stock = stockSummary(active, { from: active.fyStart, to: asOn });
  const receivables = outstanding(active, { side: 'receivable', asOn });
  const negativeStock = stock.rows.filter((row) => row.closingQty < -0.0005);
  const overLimit = receivables.parties.filter((party) => party.overLimit);
  const oldBills = receivables.parties.flatMap((party) =>
    party.bills.filter((bill) => bill.overdue && bill.overdueDays > 90).map((bill) => ({ ...bill, party: party.name })),
  );
  const staleOrders = (active.orders ?? []).filter(
    (order) => order.status === 'Open' && order.deliveryDate && order.deliveryDate < asOn,
  );
  const countCards = [
    ['Negative stock', negativeStock.length, 'Items with a negative closing quantity'],
    ['Over credit limit', overLimit.length, 'Customers above their stored limit'],
    ['Bills over 90 days', oldBills.length, 'Receivable bills overdue by more than 90 days'],
    ['Late open orders', staleOrders.length, 'Open orders past the expected delivery date'],
  ];

  const empty = '<p class="muted small">None.</p>';
  return panel(
    'Exception register',
    `<form id="exceptions-form" class="filter-bar">
      <label class="field inline-field"><span>As on</span><input name="asOn" type="date" value="${esc(asOn)}"></label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    <div class="ratio-grid">${countCards
      .map(([label, count, note]) => `<div class="ratio-card"><span class="ratio-label">${esc(label)}</span><strong class="${count ? 'neg' : ''}">${count}</strong><span class="muted small">${esc(note)}</span></div>`)
      .join('')}</div>
    <h3 class="section-title">Negative stock</h3>
    ${negativeStock.length
      ? `<table class="data-table compact"><thead><tr><th>Item</th><th>Unit</th><th class="num">Closing qty</th><th class="num">Value</th></tr></thead><tbody>${negativeStock.map((row) => `<tr><td>${esc(row.name)}</td><td>${esc(row.unit)}</td><td class="num neg">${row.closingQty}</td><td class="num">${money(row.closingValue)}</td></tr>`).join('')}</tbody></table>`
      : empty}
    <h3 class="section-title">Credit limits</h3>
    ${overLimit.length
      ? `<table class="data-table compact"><thead><tr><th>Customer</th><th class="num">Outstanding</th><th class="num">Limit</th><th class="num">Over by</th></tr></thead><tbody>${overLimit.map((party) => `<tr><td>${esc(party.name)}</td><td class="num">${money(party.outstanding)}</td><td class="num">${money(party.creditLimit)}</td><td class="num neg">${money(-party.available)}</td></tr>`).join('')}</tbody></table>`
      : empty}
    <h3 class="section-title">Receivable bills over 90 days</h3>
    ${oldBills.length
      ? `<table class="data-table compact"><thead><tr><th>Customer</th><th>Bill</th><th>Due date</th><th class="num">Overdue days</th><th class="num">Amount</th></tr></thead><tbody>${oldBills.map((bill) => `<tr><td>${esc(bill.party)}</td><td>${esc(bill.ref)}</td><td>${esc(dateLabel(bill.dueDate))}</td><td class="num">${bill.overdueDays}</td><td class="num">${money(bill.amount)}</td></tr>`).join('')}</tbody></table>`
      : empty}
    <h3 class="section-title">Late open orders</h3>
    ${staleOrders.length
      ? `<table class="data-table compact"><thead><tr><th>Order</th><th>Party</th><th>Expected delivery</th><th class="num">Value</th></tr></thead><tbody>${staleOrders.map((order) => `<tr><td>${order.type === 'Sales' ? 'SO' : 'PO'}-${order.no}</td><td>${esc((active.ledgers ?? []).find((ledger) => ledger.id === order.partyLedgerId)?.name ?? 'Unknown party')}</td><td>${esc(dateLabel(order.deliveryDate))}</td><td class="num">${money(order.total)}</td></tr>`).join('')}</tbody></table>`
      : empty}`,
    'One screen for operational exceptions. Each list is informational; use the underlying report or form to correct it.',
  );
}

export function pnlScreen() {
  if (!company()) return emptyCompanyScreen('Profit & Loss');
  const active = company();
  const { from, to } = reportPeriod(active);
  const report = profitAndLoss(active, { from, to });
  const prior = previousPeriod(report.from, report.to);
  const priorReport = profitAndLoss(active, prior);
  const compareRows = [
    ['Direct income', report.direct.incomeTotal, priorReport.direct.incomeTotal],
    ['Direct expenses', report.direct.expenseTotal, priorReport.direct.expenseTotal],
    ['Gross profit', report.grossProfit, priorReport.grossProfit],
    ['Indirect income', report.indirect.incomeTotal, priorReport.indirect.incomeTotal],
    ['Indirect expenses', report.indirect.expenseTotal, priorReport.indirect.expenseTotal],
    ['Net profit', report.netProfit, priorReport.netProfit],
  ];
  const primaryName = (key) => active.groups.find((group) => group.key === key)?.name ?? key;

  const side = (sections) =>
    sections.length
      ? sections
          .map(
            (section) => `
            <div class="ledger-block">
              <div class="block-title">${esc(section.title)}</div>
              ${section.rows
                .map(
                  (row) => `<div class="block-row"><span>${esc(row.name)}</span><span class="num">${money(row.amount)}</span></div>`,
                )
                .join('')}
              <div class="block-row subtotal"><span>Total</span><span class="num">${money(section.total)}</span></div>
            </div>`,
          )
          .join('')
      : '<p class="muted small">None</p>';

  return `
    ${panel(
      'Trading Account',
      `${periodBar('period-form', report.from, report.to)}
      <div class="report-grid">
        <div>
          <h3 class="column-title">Debit · Direct expenses</h3>
          ${side(report.direct.expenseSections)}
          <div class="block-row strong"><span>Gross ${report.grossProfit >= 0 ? 'Profit' : 'Loss'} c/d</span>
            <span class="num">${money(Math.abs(report.grossProfit))}</span></div>
        </div>
        <div>
          <h3 class="column-title">Credit · Direct income</h3>
          ${side(report.direct.sections)}
          <div class="block-row strong"><span>Total</span><span class="num">${money(report.direct.incomeTotal)}</span></div>
        </div>
      </div>
      <p class="verdict ${report.grossProfit >= 0 ? 'ok' : 'bad'}">
        Gross ${report.grossProfit >= 0 ? 'profit' : 'loss'}: ${money(Math.abs(report.grossProfit))}
      </p>`,
      `${esc(primaryName('sales'))} less ${esc(primaryName('purchase'))} and direct expenses · ${esc(dateLabel(report.from))} to ${esc(dateLabel(report.to))}`,
    )}
    ${panel(
      'Profit & Loss Account',
      `<div class="report-grid">
        <div>
          <h3 class="column-title">Debit · Indirect expenses</h3>
          ${side(report.indirect.expenseSections)}
          <div class="block-row strong"><span>Net ${report.netProfit >= 0 ? 'Profit' : 'Loss'}</span>
            <span class="num">${money(Math.abs(report.netProfit))}</span></div>
        </div>
        <div>
          <h3 class="column-title">Credit · Indirect income</h3>
          ${side(report.indirect.sections)}
          <div class="block-row strong"><span>Total</span><span class="num">${money(report.indirect.incomeTotal)}</span></div>
        </div>
      </div>
      <p class="verdict ${report.netProfit >= 0 ? 'ok' : 'bad'}">
        Net ${report.netProfit >= 0 ? 'profit' : 'loss'}: ${money(Math.abs(report.netProfit))}
      </p>`,
      `For the period ${esc(dateLabel(report.from))} to ${esc(dateLabel(report.to))}${report.includeOpening ? '' : ' · opening balances excluded'}`,
    )}
    ${panel(
      'Comparative P&L',
      `<table class="data-table compact">
        <thead><tr><th>Line</th><th class="num">Current</th><th class="num">Previous</th><th class="num">Change</th></tr></thead>
        <tbody>${compareRows.map(([label, current, previous]) => {
          const change = round2(current - previous);
          return `<tr><td>${esc(label)}</td><td class="num">${money(current)}</td><td class="num">${money(previous)}</td><td class="num ${change < 0 ? 'neg' : ''}">${change > 0 ? '+' : ''}${money(change)}</td></tr>`;
        }).join('')}</tbody>
      </table>`,
      `Previous period: ${esc(dateLabel(prior.from))} to ${esc(dateLabel(prior.to))}. A positive change is not always favourable; compare expense and profit lines separately.`,
    )}`;
}

export function balanceSheetScreen() {
  if (!company()) return emptyCompanyScreen('Balance Sheet');
  const active = company();
  const report = balanceSheet(active, { to: filters.period.to || active.fyEnd });

  const side = (sections, total) => `
    ${sections
      .map(
        (section) => `
        <div class="ledger-block">
          <div class="block-title">${esc(section.title)}</div>
          ${section.rows
            .map(
              (row) => `<div class="block-row"><span>${esc(row.name)}</span><span class="num">${money(row.amount)}</span></div>`,
            )
            .join('')}
          <div class="block-row subtotal"><span>Total</span><span class="num">${money(section.total)}</span></div>
        </div>`,
      )
      .join('') || '<p class="muted small">None</p>'}
    <div class="block-row strong"><span>Grand total</span><span class="num">${money(total)}</span></div>`;

  return panel(
    'Balance Sheet',
    `${asOnBar('period-form', report.asOn)}
    <div class="report-grid">
      <div>
        <h3 class="column-title">Liabilities</h3>
        ${side(report.liabilities.sections, report.liabilities.total)}
      </div>
      <div>
        <h3 class="column-title">Assets</h3>
        ${side(report.assets.sections, report.assets.total)}
      </div>
    </div>
    <p class="verdict ${report.balanced ? 'ok' : 'bad'}">
      ${report.balanced ? 'Balance sheet tallies.' : `Out of balance by ${money(Math.abs(report.difference))}.`}
    </p>`,
    `As on ${esc(dateLabel(report.asOn))} · net ${report.netProfit >= 0 ? 'profit' : 'loss'} ${money(Math.abs(report.netProfit))}`,
  );
}

export function cashBankScreen() {
  if (!company()) return emptyCompanyScreen('Cash & Bank Book');
  const active = company();
  const current = filters.cashBook;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const report = cashBankBook(active, { from, to, ledgerId: current.ledgerId || undefined });
  const forecastDate = todayIso() >= from && todayIso() <= to ? todayIso() : to;
  const forecast = cashForecast(active, { asOn: forecastDate, days: 30 });
  const options = [
    `<option value="">All cash & bank ledgers</option>`,
    ...cashBankLedgers(active).map(
      (ledger) =>
        `<option value="${esc(ledger.id)}"${current.ledgerId === ledger.id ? ' selected' : ''}>${esc(ledger.name)}</option>`,
    ),
  ].join('');

  const section = (item) => `
    <div class="ledger-block">
      <div class="block-title">${esc(item.name)} <span class="muted">· ${esc(item.groupName)}</span></div>
      <table class="data-table compact">
        <thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th class="num">Receipt</th><th class="num">Payment</th><th class="num">Balance</th></tr></thead>
        <tbody>
          <tr class="opening-row"><td colspan="5">Opening balance</td><td class="num">${balanceLabel(item.opening)}</td></tr>
          ${item.rows.length
            ? item.rows
                .map(
                  (row) => `<tr class="clickable" data-action="open-voucher" data-id="${esc(row.voucherId)}">
                    <td>${esc(dateLabel(row.date))}</td>
                    <td>${esc(row.voucher)}</td>
                    <td class="muted">${esc(row.particulars)}</td>
                    <td class="num">${row.receipt ? money(row.receipt) : ''}</td>
                    <td class="num">${row.payment ? money(row.payment) : ''}</td>
                    <td class="num">${balanceLabel(row.balance)}</td>
                  </tr>`,
                )
                .join('')
            : '<tr><td colspan="6" class="muted">No transactions in this period.</td></tr>'}
        </tbody>
        <tfoot><tr><td colspan="3">Closing balance</td><td class="num">${money(item.receiptTotal)}</td><td class="num">${money(item.paymentTotal)}</td><td class="num">${balanceLabel(item.closing)}</td></tr></tfoot>
      </table>
    </div>`;

  return `${panel(
    'Cash & Bank Book',
    `<form id="cashbook-form" class="filter-bar">
      <label class="field inline-field"><span>Ledger</span><select name="ledgerId">${options}</select></label>
      <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
      <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    ${report.sections.length
      ? report.sections.map(section).join('')
      : '<p class="muted">No cash or bank ledgers yet. Create one under Cash-in-Hand or Bank Accounts.</p>'}
    <p class="verdict ok">Cash & bank: ${money(report.closing)} · receipts ${money(report.receiptTotal)} · payments ${money(report.paymentTotal)}</p>`,
    `${esc(dateLabel(from))} to ${esc(dateLabel(to))} · opening ${money(report.opening)}`,
  )}
  ${panel(
    'Cash-flow forecast',
    `<table class="data-table compact">
      <thead><tr><th>Period</th><th class="num">Expected receipts</th><th class="num">Expected payments</th><th class="num">Net</th><th class="num">Projected cash</th></tr></thead>
      <tbody>
        <tr><td>Opening cash & bank</td><td></td><td></td><td></td><td class="num">${money(forecast.opening)}</td></tr>
        ${forecast.rows.map((row) => `<tr><td>${esc(row.label)}</td><td class="num">${row.receipts ? money(row.receipts) : '—'}</td><td class="num">${row.payments ? money(row.payments) : '—'}</td><td class="num ${row.net < 0 ? 'neg' : ''}">${money(row.net)}</td><td class="num ${row.closing < 0 ? 'neg' : ''}">${money(row.closing)}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td>Projected ${forecast.days}-day closing</td><td class="num">${money(forecast.totals.receipts)}</td><td class="num">${money(forecast.totals.payments)}</td><td class="num">${money(forecast.totals.receipts - forecast.totals.payments)}</td><td class="num">${money(forecast.totals.closing)}</td></tr></tfoot>
    </table>`,
    `From ${esc(dateLabel(forecast.asOn))}. Uses cash/bank balances and open receivable/payable bills with due dates; bills already due are assumed due now. It does not forecast orders, recurring entries or unscheduled payments.`,
  )}`;
}

export function registersScreen() {
  if (!company()) return emptyCompanyScreen('Registers');
  const active = company();
  const current = filters.register;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const type = current.type || 'Sales';
  const report = voucherRegister(active, { from, to, types: type === 'All' ? [] : [type] });
  const typeOptions = ['All', 'Sales', 'Purchase', 'CreditNote', 'DebitNote']
    .map(
      (item) =>
        `<option value="${item}"${type === item ? ' selected' : ''}>${item === 'All' ? 'All voucher types' : VOUCHER_TYPES[item].label}</option>`,
    )
    .join('');
  const title = type === 'All' ? 'Voucher register' : `${VOUCHER_TYPES[type].label} register`;

  return panel(
    title,
    `${periodBar(
      'register-form',
      from,
      to,
      `<label class="field inline-field"><span>Type</span><select name="type">${typeOptions}</select></label>`,
    )}
    ${report.rows.length
      ? `<table class="data-table">
          <thead><tr><th>Date</th><th>Voucher</th><th>Party / particulars</th><th>Entries</th><th class="num">Amount</th></tr></thead>
          <tbody>${report.rows
            .map(
              (row) => `<tr class="clickable" data-action="open-voucher" data-id="${esc(row.voucherId)}">
                <td>${esc(dateLabel(row.date))}</td>
                <td><strong>${esc(row.type)} ${row.no}</strong></td>
                <td>${esc(row.party)}</td>
                <td class="muted small">${esc(row.particulars)}</td>
                <td class="num">${money(row.total)}</td>
              </tr>`,
            )
            .join('')}</tbody>
          <tfoot><tr><td colspan="4">${report.count} voucher${report.count === 1 ? '' : 's'}</td><td class="num">${money(report.total)}</td></tr></tfoot>
        </table>`
      : '<p class="muted">No vouchers of this type in the period.</p>'}`,
    `${esc(dateLabel(from))} to ${esc(dateLabel(to))}`,
  );
}

export function outstandingScreen() {
  if (!company()) return emptyCompanyScreen('Outstanding');
  const active = company();
  const current = filters.outstanding;
  const side = current.side === 'payable' ? 'payable' : 'receivable';
  const asOn = current.asOn || active.fyEnd;
  const report = outstanding(active, { side, asOn });
  const partyLabel = side === 'receivable' ? 'Customer' : 'Supplier';
  const title = side === 'receivable' ? 'Receivables ageing' : 'Payables ageing';
  const cell = (value) => (Math.abs(value) >= 0.005 ? money(value) : '');

  const partyRows = report.parties
    .map(
      (party) => `<tr>
        <td><strong>${esc(party.name)}</strong>${party.overLimit ? ' <span class="badge overdue">Over limit</span>' : ''}</td>
        ${AGE_BUCKETS.map(
          (bucket) => `<td class="num">${cell(
            party.bills.filter((bill) => bill.bucket === bucket.key).reduce((sum, bill) => sum + bill.amount, 0),
          )}</td>`,
        ).join('')}
        <td class="num">${money(party.outstanding)}</td>
        <td class="num">${cell(party.advance)}</td>
        <td class="num">${party.creditLimit ? money(party.creditLimit) : '<span class="muted">—</span>'}</td>
        <td class="num ${party.available < 0 ? 'neg' : ''}">${party.creditLimit ? money(party.available) : '<span class="muted">—</span>'}</td>
        <td>${side === 'receivable' ? `<button class="btn small ghost" type="button" data-action="payment-reminder" data-id="${esc(party.ledgerId)}">Reminder</button>` : ''}</td>
      </tr>`,
    )
    .join('');
  const reminderParty = side === 'receivable' && view.reminderPartyId
    ? report.parties.find((party) => party.ledgerId === view.reminderPartyId) ?? null
    : null;
  const reminderBills = reminderParty
    ? reminderParty.bills.filter((bill) => bill.overdue)
    : [];
  const interest = interestWorkingPaper(active, { side, asOn });
  const interestRows = interest.rows
    .map((row) => `<tr><td>${esc(row.party)}</td><td>${esc(row.bill)}</td><td>${esc(dateLabel(row.dueDate))}</td><td class="num">${row.overdueDays}</td><td class="num">${money(row.amount)}</td><td class="num">${row.rate}%</td><td class="num">${money(row.interest)}</td></tr>`)
    .join('');
  const reminderPanel = reminderParty
    ? panel(
        `Payment reminder · ${esc(reminderParty.name)}`,
        `<div class="print-area">
          <p class="muted">${esc(active.name)} · ${esc(dateLabel(asOn))}</p>
          <p>To,<br><strong>${esc(reminderParty.name)}</strong></p>
          <p>Our records show ${money(reminderParty.outstanding)} outstanding${reminderParty.overLimit ? `, above the credit limit of ${money(reminderParty.creditLimit)}` : ''}. The following bills are overdue:</p>
          ${reminderBills.length
            ? `<table class="data-table compact">
                <thead><tr><th>Bill</th><th>Due date</th><th class="num">Overdue days</th><th class="num">Amount</th></tr></thead>
                <tbody>${reminderBills.map((bill) => `<tr><td>${esc(bill.ref)}</td><td>${esc(dateLabel(bill.dueDate))}</td><td class="num">${bill.overdueDays}</td><td class="num">${money(bill.amount)}</td></tr>`).join('')}</tbody>
              </table>`
            : '<p class="muted">No bills are past their due date; this is a balance reminder.</p>'}
          <p>Please arrange payment at your earliest convenience and share the payment reference.</p>
        </div>
        <div class="form-actions">
          <button class="btn primary" type="button" data-action="print-report">Print reminder</button>
          <button class="btn ghost" type="button" data-action="close-payment-reminder">Close</button>
        </div>`,
      )
    : '';

  const billRows = report.parties
    .flatMap((party) =>
      party.bills.map(
        (bill) => `<tr class="${bill.overdue ? 'overdue-row' : ''}">
          <td>${esc(party.name)}</td>
          <td>${esc(bill.ref)}</td>
          <td>${esc(dateLabel(bill.date))}</td>
          <td>${bill.dueDate ? esc(dateLabel(bill.dueDate)) : '<span class="muted">—</span>'}</td>
          <td class="num">${bill.overdue ? bill.overdueDays : bill.ageDays}</td>
          <td class="muted">${esc(AGE_BUCKETS.find((bucket) => bucket.key === bill.bucket)?.label ?? bill.bucket)}</td>
          <td class="num">${money(bill.amount)}</td>
        </tr>`,
      ),
    )
    .join('');

  return `
    ${panel(
      title,
      `<form id="outstanding-form" class="filter-bar">
        <label class="field inline-field"><span>Show</span>
          <select name="side">
            <option value="receivable"${side === 'receivable' ? ' selected' : ''}>Receivables (debtors)</option>
            <option value="payable"${side === 'payable' ? ' selected' : ''}>Payables (creditors)</option>
          </select>
        </label>
        <label class="field inline-field"><span>As on</span><input name="asOn" type="date" value="${esc(asOn)}" data-period></label>
        <button class="btn small" type="submit">Apply</button>
      </form>
      ${report.parties.length
        ? `<table class="data-table">
            <thead><tr><th>${partyLabel}</th>${AGE_BUCKETS.map((bucket) => `<th class="num">${esc(bucket.label)}</th>`).join('')}<th class="num">Outstanding</th><th class="num">Advance</th><th class="num">Limit</th><th class="num">Available</th><th></th></tr></thead>
            <tbody>${partyRows}</tbody>
            <tfoot><tr><td>Total</td>${AGE_BUCKETS.map((bucket) => `<td class="num">${money(report.buckets[bucket.key])}</td>`).join('')}<td class="num">${money(report.total)}</td><td class="num">${money(report.advances)}</td><td colspan="3"></td></tr></tfoot>
          </table>`
        : `<p class="muted">No open ${side === 'receivable' ? 'receivables' : 'payables'} as on ${esc(dateLabel(asOn))}.</p>`}`,
      `As on ${esc(dateLabel(asOn))} · ${report.count} part${report.count === 1 ? 'y' : 'ies'} · net ${money(report.net)}`,
    )}
    ${report.parties.length
      ? panel(
          'Open bills (oldest first)',
          `<table class="data-table compact">
            <thead><tr><th>${partyLabel}</th><th>Bill</th><th>Bill date</th><th>Due date</th><th class="num">Age / overdue (days)</th><th>Bucket</th><th class="num">Amount</th></tr></thead>
            <tbody>${billRows}</tbody>
          </table>`,
        )
      : ''}
    ${reminderPanel}
    ${interest.rows.length
      ? panel(
          side === 'receivable' ? 'Interest receivable' : 'Interest payable',
          `${can('voucher.write')
            ? `<div class="form-actions"><button class="btn small primary" type="button" data-action="post-interest" data-side="${side}" data-date="${esc(asOn)}">Post interest</button></div>`
            : ''}
          <table class="data-table compact">
            <thead><tr><th>${partyLabel}</th><th>Bill</th><th>Due date</th><th class="num">Overdue days</th><th class="num">Principal</th><th class="num">Rate</th><th class="num">Simple interest</th></tr></thead>
            <tbody>${interestRows}</tbody>
            <tfoot><tr><td colspan="4">Total</td><td class="num">${money(interest.totals.principal)}</td><td></td><td class="num">${money(interest.totals.interest)}</td></tr></tfoot>
          </table>`,
          'Simple interest on overdue bill balances at each party\'s stored annual rate. Posting creates a Journal on the selected date; later runs only propose interest accrued since the last posting.',
        )
      : ''}`;
}

export function partyLedgerList(active, side) {
  const key = side === 'payable' ? 'sundryCreditors' : 'sundryDebtors';
  return active.ledgers
    .filter((ledger) => inGroupKey(active, ledger, key))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function billStatusBadge(status) {
  const tone = status === 'Overdue' ? 'overdue' : status === 'Part-paid' ? 'attention' : '';
  return `<span class="badge${tone ? ` ${tone}` : ''}">${esc(status)}</span>`;
}

export function billRegisterScreen() {
  if (!company()) return emptyCompanyScreen('Bill-wise register');
  const active = company();
  const current = filters.billRegister;
  const side = current.side === 'payable' ? 'payable' : 'receivable';
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const status = current.status || 'All';
  const asOn = current.asOn || to;
  const report = billWiseRegister(active, {
    side,
    from,
    to,
    status,
    asOn,
    compareAsOn: current.compareAsOn,
  });
  const compared = Boolean(report.compareAsOn);
  const partyLabel = side === 'receivable' ? 'Customer' : 'Supplier';
  const title = side === 'receivable' ? 'Customer bill-wise register' : 'Supplier bill-wise register';
  const statusOptions = [
    ['All', 'All statuses'],
    ['Open', 'Unsettled (open, part-paid or overdue)'],
    ['Settled', 'Settled'],
    ['Overdue', 'Overdue'],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}"${status === value ? ' selected' : ''}>${label}</option>`,
    )
    .join('');

  const rows = report.rows
    .map(
      (row) => `<tr class="${row.overdue ? 'overdue-row' : ''}">
        <td>
          <button class="table-link" type="button" data-action="open-party-statement" data-id="${esc(row.partyId)}" data-side="${side}" aria-label="Open party statement for ${esc(row.party)}">
            <strong>${esc(row.party)}</strong>
          </button>
        </td>
        <td>
          <button class="table-link" type="button" data-action="open-voucher" data-id="${esc(row.voucherId)}" aria-label="Open ${esc(row.ref)}">
            <strong>${esc(row.ref)}</strong>
            <span class="muted small">${esc(voucherLabel(row.type))} ${row.no}</span>
          </button>
          ${(row.events ?? []).length > 1
            ? `<details class="bill-history"><summary class="muted small">${row.events.length} history events</summary><div class="muted small">${row.events
                .map((event) =>
                  event.kind === 'raised'
                    ? `${esc(dateLabel(event.date))} · Raised ${money(event.amount)}`
                    : event.kind === 'due'
                      ? `${esc(dateLabel(event.date))} · Due date passed · Overdue`
                      : `${esc(dateLabel(event.date))} · ${esc(voucherLabel(event.type))} ${event.no} · ${money(event.amount)} · ${esc(event.statusAfter)}`,
                )
                .join('<br>')}</div>
              <button class="btn small ghost" type="button" data-action="download-bill-timeline" data-id="${esc(row.voucherId)}">Download timeline CSV</button></details>`
            : ''}
        </td>
        <td>${esc(dateLabel(row.date))}</td>
        <td>${row.dueDate ? esc(dateLabel(row.dueDate)) : '<span class="muted">—</span>'}</td>
        <td class="num">${money(row.original)}</td>
        <td class="num">${money(row.settled)}</td>
        ${compared ? `<td class="num ${row.settledDuring < 0 ? 'neg' : ''}">${row.settledDuring ? money(row.settledDuring) : '—'}</td>` : ''}
        <td class="num">${money(row.amount)}</td>
        <td>${compared && row.statusChanged ? `<span class="muted small">${esc(row.priorStatus)} →</span> ` : ''}${billStatusBadge(row.status)}</td>
        <td class="num">${row.overdue ? row.overdueDays : ''}</td>
      </tr>`,
    )
    .join('');

  return panel(
    title,
    `<form id="bill-register-form" class="filter-bar">
      <label class="field inline-field"><span>Show</span>
        <select name="side">
          <option value="receivable"${side === 'receivable' ? ' selected' : ''}>Receivables (customers)</option>
          <option value="payable"${side === 'payable' ? ' selected' : ''}>Payables (suppliers)</option>
        </select>
      </label>
      <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
      <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
      <label class="field inline-field"><span>Status as on</span><input name="asOn" type="date" value="${esc(asOn)}"></label>
      <label class="field inline-field"><span>Compare from</span><input name="compareAsOn" type="date" max="${esc(asOn)}" value="${esc(report.compareAsOn ?? '')}"></label>
      <label class="field inline-field"><span>Status</span><select name="status">${statusOptions}</select></label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    ${compared
      ? `<p class="muted small">Compared with ${esc(dateLabel(report.compareAsOn))}: ${report.openedCount} listed bill${report.openedCount === 1 ? '' : 's'} raised, ${report.closedCount} settled, ${report.statusChangeCount} status change${report.statusChangeCount === 1 ? '' : 's'}. ${money(report.allSettledDuring)} settled across ${report.movementBillCount} bill${report.movementBillCount === 1 ? '' : 's'}${report.movementOutsideCount ? ` (${report.movementOutsideCount} outside this bill period)` : ''}.</p>`
      : ''}
    ${report.rows.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact bill-register-table">
          <thead><tr><th>${partyLabel}</th><th>Bill</th><th>Bill date</th><th>Due date</th><th class="num">Bill amount</th><th class="num">Settled</th>${compared ? '<th class="num">Settled since</th>' : ''}<th class="num">Outstanding</th><th>Status</th><th class="num">Overdue days</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4">${report.count} bill${report.count === 1 ? '' : 's'} · ${report.partyCount} part${report.partyCount === 1 ? 'y' : 'ies'}${report.overdueCount ? ` · ${report.overdueCount} overdue` : ''}</td><td class="num">${money(report.totalOriginal)}</td><td class="num">${money(report.totalSettled)}</td>${compared ? `<td class="num">${money(report.totalSettledDuring)}</td>` : ''}<td class="num">${money(report.totalOutstanding)}</td><td colspan="2"></td></tr></tfoot>
        </table></div>`
      : `<p class="muted">No ${side === 'receivable' ? 'customer' : 'supplier'} bills in this period${status === 'All' ? '' : ` with status ${esc(status)}`}.</p>`}`,
    `Bills dated ${esc(dateLabel(from))} to ${esc(dateLabel(to))} · status as on ${esc(dateLabel(asOn))}${compared ? ` · movement compared with ${esc(dateLabel(report.compareAsOn))}` : ''}. Fully settled bills remain listed. Click a party for its statement, or a bill to open the voucher. Expand a bill's history to see each settlement and the resulting status.`,
  );
}

export function partyStatementScreen() {
  if (!company()) return emptyCompanyScreen('Party statement');
  const active = company();
  const current = filters.partyStatement;
  const side = current.side === 'payable' ? 'payable' : 'receivable';
  const parties = partyLedgerList(active, side);
  const requested = current.ledgerId || view.id;
  const ledgerId = parties.some((ledger) => ledger.id === requested) ? requested : parties[0]?.id;
  const ledger = parties.find((item) => item.id === ledgerId) ?? null;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;

  const sideOptions = `
    <option value="receivable"${side === 'receivable' ? ' selected' : ''}>Receivables (customers)</option>
    <option value="payable"${side === 'payable' ? ' selected' : ''}>Payables (suppliers)</option>`;
  const partyOptions = parties
    .map(
      (item) =>
        `<option value="${esc(item.id)}"${item.id === ledgerId ? ' selected' : ''}>${esc(item.name)}</option>`,
    )
    .join('');
  const filterBar = `<form id="party-statement-form" class="filter-bar">
    <label class="field inline-field"><span>Show</span><select name="side">${sideOptions}</select></label>
    <label class="field inline-field"><span>Party</span><select name="ledgerId">${partyOptions || '<option value="">No party ledgers</option>'}</select></label>
    <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
    <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
    <button class="btn small" type="submit">Apply</button>
  </form>`;

  if (!ledger || !ledgerId) {
    return panel(
      'Party statement',
      `${filterBar}<p class="muted">No ${side === 'receivable' ? 'customer' : 'supplier'} ledgers found. Add a ledger under ${side === 'receivable' ? 'Sundry Debtors' : 'Sundry Creditors'} first.</p>`,
    );
  }

  const report = partyStatement(active, ledgerId, { from, to });
  if (!report) return panel('Party statement', `${filterBar}<p class="muted">That ledger no longer exists.</p>`);

  const rows = report.rows
    .map((row) => {
      let detail = '';
      if (row.billRef) {
        detail = `Bill ${esc(row.billRef)}${row.billDueDate ? ` · due ${esc(dateLabel(row.billDueDate))}` : ''}`;
      } else if (row.allocations.length) {
        detail = row.allocations
          .map((allocation) => `Settles ${esc(allocation.ref)} · ${money(allocation.amount)}`)
          .join('<br>');
      } else if (!row.isBillLine) {
        detail = '<span class="muted">Unallocated / FIFO</span>';
      }
      return `<tr class="clickable" data-action="open-voucher" data-id="${esc(row.voucherId)}">
        <td>${esc(dateLabel(row.date))}</td>
        <td>${esc(row.voucher)}</td>
        <td class="muted">${esc(row.particulars)}</td>
        <td class="muted small">${detail}</td>
        <td class="num">${row.debit ? money(row.debit) : ''}</td>
        <td class="num">${row.credit ? money(row.credit) : ''}</td>
        <td class="num">${balanceLabel(row.balance)}</td>
      </tr>`;
    })
    .join('');

  const billRows = report.bills
    .map(
      (bill) => `<tr class="${bill.overdue ? 'overdue-row' : ''} clickable" data-action="open-voucher" data-id="${esc(bill.voucherId)}">
        <td><strong>${esc(bill.ref)}</strong> <span class="muted small">${esc(voucherLabel(bill.type))} ${bill.no}</span></td>
        <td>${esc(dateLabel(bill.date))}</td>
        <td>${bill.dueDate ? esc(dateLabel(bill.dueDate)) : '<span class="muted">—</span>'}</td>
        <td class="num">${money(bill.original)}</td>
        <td class="num">${money(bill.settled)}</td>
        <td class="num">${money(bill.amount)}</td>
        <td>${billStatusBadge(bill.status)}</td>
        <td class="num">${bill.overdue ? bill.overdueDays : ''}</td>
      </tr>`,
    )
    .join('');

  const summary = report.side
    ? `Bill-wise ${money(report.billOutstanding)} outstanding of ${money(report.billOriginal)}${report.advances ? ` · advance ${money(report.advances)}` : ''}`
    : 'This ledger is not under Sundry Debtors or Sundry Creditors, so bill-wise detail is unavailable.';

  return `
    ${panel(
      esc(report.ledger.name),
      `${filterBar}
      <table class="data-table">
        <thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th>Bill detail</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
        <tbody>
          <tr class="opening-row"><td colspan="6">Opening balance</td><td class="num">${balanceLabel(report.opening)}</td></tr>
          ${rows || '<tr><td colspan="7" class="muted">No transactions in this period.</td></tr>'}
        </tbody>
        <tfoot><tr><td colspan="4">Closing balance</td><td class="num">${money(report.debitTotal)}</td><td class="num">${money(report.creditTotal)}</td><td class="num">${balanceLabel(report.closing)}</td></tr></tfoot>
      </table>`,
      `${esc(report.groupName)} · ${summary}`,
    )}
    ${report.side
      ? panel(
          'Bill-wise detail',
          report.bills.length
            ? `<div class="table-scroll" tabindex="0"><table class="data-table compact bill-register-table">
                <thead><tr><th>Bill</th><th>Bill date</th><th>Due date</th><th class="num">Bill amount</th><th class="num">Settled</th><th class="num">Outstanding</th><th>Status</th><th class="num">Overdue days</th></tr></thead>
                <tbody>${billRows}</tbody>
                <tfoot><tr><td colspan="3">${report.billCount} bill${report.billCount === 1 ? '' : 's'}</td><td class="num">${money(report.billOriginal)}</td><td class="num">${money(report.billSettled)}</td><td class="num">${money(report.billOutstanding)}</td><td colspan="2"></td></tr></tfoot>
              </table></div>`
            : '<p class="muted">No sales or purchase bills for this party up to the report date.</p>',
          `All bills up to ${esc(dateLabel(to))}; fully settled bills are included.`,
        )
      : ''}`;
}

export function groupSummaryScreen() {
  if (!company()) return emptyCompanyScreen('Group Summary');
  const active = company();
  const to = filters.period.to || active.fyEnd;
  const report = groupSummary(active, { to });

  const sections = report.sections
    .map(
      (section) => `
      <div class="ledger-block">
        <div class="block-title">
          <span>${esc(section.name)} <span class="muted">${esc(section.nature)}</span></span>
          <button class="btn small ghost" type="button" data-action="pick-group" data-id="${esc(section.groupId)}">Vouchers</button>
        </div>
        <table class="data-table compact">
          <thead><tr><th>Ledger</th><th>Group</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Closing</th></tr></thead>
          <tbody>${section.rows
            .map(
              (row) => `<tr class="clickable" data-action="pick-ledger" data-id="${esc(row.ledgerId)}">
                <td>${esc(row.name)}</td>
                <td class="muted">${esc(row.groupName)}</td>
                <td class="num">${row.debit ? money(row.debit) : ''}</td>
                <td class="num">${row.credit ? money(row.credit) : ''}</td>
                <td class="num">${balanceLabel(row.closing)}</td>
              </tr>`,
            )
            .join('')}</tbody>
          <tfoot><tr><td colspan="4">Total</td><td class="num">${balanceLabel(section.closing)}</td></tr></tfoot>
        </table>
      </div>`,
    )
    .join('');

  return panel(
    'Group Summary',
    `${asOnBar('period-form', report.asOn)}
    ${sections || '<p class="muted">No ledgers yet.</p>'}`,
    `As on ${esc(dateLabel(report.asOn))} · closing totals ${balanceLabel(report.total)}`,
  );
}

export function groupVouchersScreen() {
  if (!company()) return emptyCompanyScreen('Group Vouchers');
  const active = company();
  const { from, to } = reportPeriod(active);
  const report = groupVouchers(active, view.groupId, { from, to });
  if (!report) return panel('Group vouchers', '<p class="muted">That group no longer exists.</p>');

  return panel(
    `${esc(report.group.name)} vouchers`,
    `${periodBar('period-form', from, to)}
    ${report.rows.length
      ? `<table class="data-table">
          <thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
          <tbody>${report.rows
            .map(
              (row) => `<tr class="clickable" data-action="open-voucher" data-id="${esc(row.voucherId)}">
                <td>${esc(dateLabel(row.date))}</td>
                <td><strong>${esc(row.type)} ${row.no}</strong></td>
                <td class="muted">${esc(row.particulars)}</td>
                <td class="num">${row.debit ? money(row.debit) : ''}</td>
                <td class="num">${row.credit ? money(row.credit) : ''}</td>
              </tr>`,
            )
            .join('')}</tbody>
          <tfoot><tr><td colspan="3">Total</td><td class="num">${money(report.debitTotal)}</td><td class="num">${money(report.creditTotal)}</td></tr></tfoot>
        </table>`
      : '<p class="muted">No vouchers touch this group in the period.</p>'}`,
    `${esc(dateLabel(from))} to ${esc(dateLabel(to))}`,
  );
}

export function cashFlowScreen() {
  if (!company()) return emptyCompanyScreen('Cash Flow');
  const active = company();
  const { from, to } = reportPeriod(active);
  const report = cashFlow(active, { from, to });

  const column = (title, sections, total) => `
    <div>
      <h3 class="column-title">${title}</h3>
      ${sections.length
        ? sections
            .map(
              (section) => `
            <div class="ledger-block">
              <div class="block-title">${esc(section.title)}</div>
              ${section.rows
                .map(
                  (row) => `<div class="block-row"><span>${esc(row.name)}</span><span class="num">${money(row.amount)}</span></div>`,
                )
                .join('')}
              <div class="block-row subtotal"><span>Total</span><span class="num">${money(section.total)}</span></div>
            </div>`,
            )
            .join('')
        : '<p class="muted small">None</p>'}
      <div class="block-row strong"><span>Total</span><span class="num">${money(total)}</span></div>
    </div>`;

  return panel(
    'Cash Flow',
    `${periodBar('period-form', from, to)}
    <div class="report-grid">
      ${column('Cash received from', report.inflows, report.totalIn)}
      ${column('Cash spent on', report.outflows, report.totalOut)}
    </div>
    <p class="verdict ${report.net >= 0 ? 'ok' : 'bad'}">
      Net ${report.net >= 0 ? 'inflow' : 'outflow'} ${money(Math.abs(report.net))} · opening ${money(report.opening)} · closing ${money(report.closing)}
    </p>`,
    `${esc(dateLabel(report.from))} to ${esc(dateLabel(report.to))}`,
  );
}

export function ratiosScreen() {
  if (!company()) return emptyCompanyScreen('Ratio Analysis');
  const active = company();
  const to = filters.period.to || active.fyEnd;
  const report = ratioAnalysis(active, { to });
  const format = (item) => {
    if (item.value === null) return '—';
    if (item.unit === '%') return `${money(item.value)}%`;
    if (item.unit === 'x') return `${money(item.value)}×`;
    return money(item.value);
  };

  return panel(
    'Ratio Analysis',
    `${asOnBar('period-form', report.asOn)}
    <div class="ratio-grid">
      ${report.ratios
        .map(
          (item) => `<div class="ratio-card">
            <span class="ratio-label">${esc(item.label)}</span>
            <strong>${format(item)}</strong>
            <span class="muted small">${esc(item.hint)}</span>
          </div>`,
        )
        .join('')}
    </div>
    <div class="ledger-block">
      <div class="block-title">Supporting numbers</div>
      <div class="block-row"><span>Working capital</span><span class="num">${money(report.workingCapital)}</span></div>
      <div class="block-row"><span>Gross profit</span><span class="num">${money(report.grossProfit)}</span></div>
      <div class="block-row"><span>Net profit</span><span class="num">${money(report.netProfit)}</span></div>
      <div class="block-row"><span>Sales / direct income</span><span class="num">${money(report.sales)}</span></div>
    </div>`,
    `As on ${esc(dateLabel(report.asOn))}`,
  );
}

export function auditScreen() {
  const all = auditEntries(state);
  const companyNames = new Map(state.companies.map((item) => [item.id, item.name]));
  for (const entry of all) {
    if (entry.companyId && !companyNames.has(entry.companyId)) {
      companyNames.set(entry.companyId, entry.companyName || 'Deleted company');
    }
  }
  const selectedCompany = filters.audit.companyId;
  const needle = filters.audit.q.trim().toLowerCase();
  const entries = all.filter((entry) => {
    if (selectedCompany && entry.companyId !== selectedCompany) return false;
    if (!needle) return true;
    return [entry.action, auditActionLabel(entry.action), entry.summary, entry.entity, entry.companyName]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
  const options = [...companyNames.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(
      ([id, name]) => `<option value="${esc(id)}"${id === selectedCompany ? ' selected' : ''}>${esc(name)}</option>`,
    )
    .join('');
  const rows = entries
    .map(
      (entry) => `<tr>
        <td class="audit-time">${esc(new Date(entry.at).toLocaleString('en-IN'))}</td>
        <td><strong>${esc(auditActionLabel(entry.action))}</strong></td>
        <td>${entry.actorName ? `${esc(entry.actorName)}${entry.actorRole ? ` <span class="muted small">${esc(roleLabel(entry.actorRole))}</span>` : ''}` : '—'}</td>
        <td>${esc(entry.companyName || companyNames.get(entry.companyId) || '—')}</td>
        <td>${esc(entry.summary)}</td>
      </tr>`,
    )
    .join('');

  return panel(
    `Audit trail <span class="count">${all.length}</span>`,
    `<p class="muted">Append-only history of companies, masters, vouchers, financial years and restores. Entries cannot be edited or deleted in the app.</p>
    <form id="audit-form" class="filter-bar">
      <label class="field inline-field"><span>Company</span>
        <select name="companyId"><option value="">All companies</option>${options}</select>
      </label>
      <label class="field"><span>Search</span>
        <input name="q" value="${esc(filters.audit.q)}" placeholder="Voucher, ledger, action…">
      </label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    <p class="muted small">Showing ${entries.length} of ${all.length} recorded event${all.length === 1 ? '' : 's'}.</p>
    ${entries.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact audit-table">
          <thead><tr><th>When</th><th>Action</th><th>By</th><th>Company</th><th>Details</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No activity matches this filter.</p>'}`,
    'Backups preserve this log; restoring data adds a restore event instead of erasing history.',
  );
}

export function yearComparisonScreen() {
  if (!company()) return emptyCompanyScreen('Year comparison');
  const active = company();
  const years = yearComparison(active);
  if (!years.length) {
    return panel('Year comparison', '<p class="muted">This company has no financial years yet.</p>');
  }
  const fyLabel = (year) => {
    const startYear = year.start.slice(0, 4);
    const endYear = year.end.slice(0, 4);
    return `FY ${startYear}–${endYear.slice(2)}`;
  };
  const rows = [
    { label: 'Direct income', key: 'directIncome' },
    { label: 'Direct expenses', key: 'directExpense' },
    { label: 'Gross profit', key: 'grossProfit', strong: true },
    { label: 'Other income', key: 'indirectIncome' },
    { label: 'Indirect expenses', key: 'indirectExpense' },
    { label: 'Net profit', key: 'netProfit', strong: true },
    { label: 'Total assets', key: 'assets' },
    { label: 'Total liabilities', key: 'liabilities' },
    { label: 'Cash', key: 'cash' },
    { label: 'Bank', key: 'bank' },
    { label: 'Receivables', key: 'receivables' },
    { label: 'Payables', key: 'payables' },
  ];
  const head = years
    .map(
      (year) => `<th class="num${year.selected ? ' current-year' : ''}">
        ${esc(fyLabel(year))}
        ${year.closed ? '<span class="badge">closed</span>' : ''}
      </th>`,
    )
    .join('');
  const body = rows
    .map((row) => {
      const cells = years
        .map((year) => {
          const value = year[row.key];
          return `<td class="num${year.selected ? ' current-year' : ''}${value < 0 ? ' neg' : ''}">${money(value)}</td>`;
        })
        .join('');
      return `<tr class="${row.strong ? 'strong-row' : ''}"><td>${esc(row.label)}</td>${cells}</tr>`;
    })
    .join('');
  const voucherCells = years
    .map(
      (year) => `<td class="num${year.selected ? ' current-year' : ''}">${year.vouchers}</td>`,
    )
    .join('');

  return panel(
    'Year comparison',
    `<div class="table-scroll" tabindex="0"><table class="data-table year-compare">
      <thead><tr><th>Metric</th>${head}</tr></thead>
      <tbody>${body}<tr><td>Vouchers</td>${voucherCells}</tr></tbody>
    </table></div>`,
    'Profit and loss covers each year on its own; assets, liabilities and balances are cumulative at each year end.',
  );
}

export function statisticsScreen() {
  if (!company()) return emptyCompanyScreen('Statistics');
  const stats = statistics(company());
  const months = stats.monthly ?? [];
  const maxTrend = Math.max(1, ...months.flatMap((row) => [row.sales, row.purchases]));
  const total = months.reduce(
    (sum, row) => ({
      sales: round2(sum.sales + row.sales),
      purchases: round2(sum.purchases + row.purchases),
      creditNotes: round2(sum.creditNotes + row.creditNotes),
      debitNotes: round2(sum.debitNotes + row.debitNotes),
      receipts: round2(sum.receipts + row.receipts),
      payments: round2(sum.payments + row.payments),
    }),
    { sales: 0, purchases: 0, creditNotes: 0, debitNotes: 0, receipts: 0, payments: 0 },
  );
  const trend = months
    .map((row) => {
      const month = dateLabel(`${row.month}-01`).slice(3, 6);
      const height = (value) =>
        value > 0 ? `${Math.max(2, (value / maxTrend) * 100).toFixed(1)}%` : '0';
      return `<div class="mis-col">
        <div class="mis-bars">
          <span class="mis-bar sales" style="height:${height(row.sales)}" title="${esc(month)} sales ${esc(money(row.sales))}"></span>
          <span class="mis-bar purchases" style="height:${height(row.purchases)}" title="${esc(month)} purchases ${esc(money(row.purchases))}"></span>
        </div>
        <span class="mis-label">${esc(month)}</span>
      </div>`;
    })
    .join('');
  const misRows = months
    .map((row) => {
      const netSales = round2(row.sales - row.creditNotes);
      const netPurchases = round2(row.purchases - row.debitNotes);
      const netCash = round2(row.receipts - row.payments);
      return `<tr>
        <td>${esc(dateLabel(`${row.month}-01`).slice(3))}</td>
        <td class="num">${money(row.sales)}</td>
        <td class="num">${money(row.creditNotes)}</td>
        <td class="num">${money(netSales)}</td>
        <td class="num">${money(row.purchases)}</td>
        <td class="num">${money(row.debitNotes)}</td>
        <td class="num">${money(netPurchases)}</td>
        <td class="num">${money(row.receipts)}</td>
        <td class="num">${money(row.payments)}</td>
        <td class="num">${money(netCash)}</td>
      </tr>`;
    })
    .join('');
  const netSales = round2(total.sales - total.creditNotes);
  const netPurchases = round2(total.purchases - total.debitNotes);
  const netCash = round2(total.receipts - total.payments);
  const partyTable = (rows, amountLabel, emptyLabel) => `<table class="data-table compact">
    <thead><tr><th>Party</th><th class="num">${esc(amountLabel)}</th><th class="num">Share</th></tr></thead>
    <tbody>${rows.length
      ? rows
          .map(
            (row) => `<tr><td>${esc(row.name)}</td><td class="num">${money(row.amount)}</td><td class="num">${row.share.toFixed(1)}%</td></tr>`,
          )
          .join('')
      : `<tr><td colspan="3" class="muted">${esc(emptyLabel)}</td></tr>`}</tbody>
  </table>`;
  const stockTable = (rows, emptyLabel) => `<table class="data-table compact">
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Value</th><th class="num">Share</th></tr></thead>
    <tbody>${rows.length
      ? rows
          .map(
            (row) => `<tr><td>${esc(row.name)}</td><td class="num">${fmtQty(row.closingQty)} ${esc(row.unit)}</td><td class="num">${money(row.closingValue)}</td><td class="num">${row.share.toFixed(1)}%</td></tr>`,
          )
          .join('')
      : `<tr><td colspan="4" class="muted">${esc(emptyLabel)}</td></tr>`}</tbody>
  </table>`;
  const expenseTable = (rows) => `<table class="data-table compact">
    <thead><tr><th>Expense head</th><th>Group</th><th class="num">Amount</th><th class="num">Share</th></tr></thead>
    <tbody>${rows
      .map(
        (row) => `<tr><td>${esc(row.name)}</td><td>${esc(row.groupName)}</td><td class="num">${money(row.amount)}</td><td class="num">${row.share.toFixed(1)}%</td></tr>`,
      )
      .join('')}</tbody>
  </table>`;

  return `
    <div class="mis-kpis" aria-label="MIS summary">
      <div class="mis-kpi"><span>Net sales</span><strong>${money(netSales)}</strong><small>After returns</small></div>
      <div class="mis-kpi"><span>Purchase spend</span><strong>${money(netPurchases)}</strong><small>All purchase vouchers, after returns</small></div>
      <div class="mis-kpi"><span>Net profit</span><strong class="${stats.netProfit < 0 ? 'neg' : ''}">${money(stats.netProfit)}</strong><small>Current financial year</small></div>
      <div class="mis-kpi"><span>Working capital</span><strong class="${stats.workingCapital.net < 0 ? 'neg' : ''}">${money(stats.workingCapital.net)}</strong><small>Year-end</small></div>
      ${stats.stock ? `<div class="mis-kpi"><span>Closing stock</span><strong>${money(stats.stock.closingValue)}</strong><small>At year end</small></div>` : ''}
    </div>
    ${panel(
      'Monthly MIS',
      `<div class="mis-chart" role="img" aria-label="Monthly sales and purchases">
        <div class="mis-legend"><span><i class="mis-dot sales"></i>Sales</span><span><i class="mis-dot purchases"></i>Purchases</span></div>
        <div class="mis-grid">${trend}</div>
      </div>
      <div class="table-scroll" tabindex="0"><table class="data-table compact">
        <thead><tr><th>Month</th><th class="num">Sales</th><th class="num">Returns</th><th class="num">Net sales</th><th class="num">Purchases</th><th class="num">Purchase returns</th><th class="num">Net purchases</th><th class="num">Receipts</th><th class="num">Payments</th><th class="num">Net cash</th></tr></thead>
        <tbody>${misRows}</tbody>
        <tfoot><tr><td>Financial year</td><td class="num">${money(total.sales)}</td><td class="num">${money(total.creditNotes)}</td><td class="num">${money(netSales)}</td><td class="num">${money(total.purchases)}</td><td class="num">${money(total.debitNotes)}</td><td class="num">${money(netPurchases)}</td><td class="num">${money(total.receipts)}</td><td class="num">${money(total.payments)}</td><td class="num">${money(netCash)}</td></tr></tfoot>
      </table></div>`,
      'Net sales and purchases deduct credit/debit notes. Net cash is receipts minus payments. Journal and contra vouchers are excluded from the trend.',
    )}
    ${stats.forecast
      ? panel(
          'Run-rate outlook',
          `<p class="muted">Based on ${esc(stats.forecast.basis.map((month) => dateLabel(`${month}-01`).slice(3)).join(', '))}. Repeating the straight average for the next ${stats.forecast.months.length} month${stats.forecast.months.length === 1 ? '' : 's'}.</p>
          <table class="data-table compact">
            <thead><tr><th>Month</th><th class="num">Net sales</th><th class="num">Net purchases</th></tr></thead>
            <tbody>${stats.forecast.months
              .map(
                (row) => `<tr><td>${esc(dateLabel(`${row.month}-01`).slice(3))}</td><td class="num">${money(row.sales)}</td><td class="num">${money(row.purchases)}</td></tr>`,
              )
              .join('')}</tbody>
          </table>`,
          'Straight average of net sales and net purchases in the last three completed months, repeated for the rest of the financial year. It ignores seasonality, growth, open orders and one-off items; treat it as a run-rate, not a projection.',
        )
      : ''}
    ${panel(
      'Party concentration',
      `<div class="split-grid">
        <div><h3>Top customers</h3>${partyTable(stats.topCustomers, 'Net sales', 'No customer sales in this financial year.')}</div>
        <div><h3>Top suppliers</h3>${partyTable(stats.topSuppliers, 'Net purchases', 'No supplier purchases in this financial year.')}</div>
      </div>`,
      'Top five parties by voucher value. Credit notes reduce customer sales; debit notes reduce supplier purchases. Cash sales and purchases without a party ledger are excluded.',
    )}
    ${stats.stock
      ? panel(
          'Stock position',
          `<p class="muted">Closing stock <strong>${money(stats.stock.closingValue)}</strong> across ${stats.stock.itemCount} item${stats.stock.itemCount === 1 ? '' : 's'}. ${stats.stock.idleCount} item${stats.stock.idleCount === 1 ? '' : 's'} worth <strong>${money(stats.stock.idleValue)}</strong> had no issues during the financial year.</p>
          <div class="split-grid">
            <div><h3>Top items by value</h3>${stockTable(stats.stock.topItems, 'No stock on hand at the financial year end.')}</div>
            <div><h3>No issues this year</h3>${stockTable(stats.stock.idleItems, 'Every stocked item had an outward movement this year.')}</div>
          </div>`,
          'Closing quantities and values use the weighted-average cost at the financial year end. “No issues” means no stock left the item during the year; it is a review flag, not proof of obsolescence.',
        )
      : ''}
    ${panel(
      'Working capital',
      `<table class="data-table compact">
        <tbody>
          <tr><td>Receivables</td><td class="num">${money(stats.workingCapital.receivables)}</td></tr>
          <tr><td>Stock</td><td class="num">${money(stats.workingCapital.stock)}</td></tr>
          <tr><td>Cash</td><td class="num">${money(stats.workingCapital.cash)}</td></tr>
          <tr><td>Bank</td><td class="num">${money(stats.workingCapital.bank)}</td></tr>
          <tr><td>Less: payables</td><td class="num">${money(-stats.workingCapital.payables)}</td></tr>
        </tbody>
        <tfoot><tr><td>Net working capital</td><td class="num ${stats.workingCapital.net < 0 ? 'neg' : ''}"><strong>${money(stats.workingCapital.net)}</strong></td></tr></tfoot>
      </table>`,
      `Party balances and stock as on ${esc(dateLabel(stats.workingCapital.asOn))}. Net working capital is receivables plus stock, cash and bank, less payables.`,
    )}
    ${stats.topExpenses.length
      ? panel(
          'Expense concentration',
          `<p class="muted">Total expenses <strong>${money(stats.expenseTotal)}</strong> across the year.</p>${expenseTable(stats.topExpenses)}`,
          'Top five expense ledgers by net amount for the financial year. Purchases are included; credit balances and zero-value heads are excluded.',
        )
      : ''}
    ${panel(
      `Voucher statistics <span class="count">${stats.voucherTotal}</span>`,
      `<table class="data-table compact">
        <thead><tr><th>Voucher type</th><th class="num">Count</th><th class="num">Total value</th></tr></thead>
        <tbody>${stats.voucherCounts
          .map(
            (row) => `<tr><td>${esc(row.label)}</td><td class="num">${row.count}</td><td class="num">${money(row.total)}</td></tr>`,
          )
          .join('')}</tbody>
        <tfoot><tr><td>All vouchers</td><td class="num">${stats.voucherTotal}</td><td class="num">${money(
          stats.voucherCounts.reduce((sum, row) => sum + row.total, 0),
        )}</td></tr></tfoot>
      </table>`,
      `${stats.firstDate ? `${esc(dateLabel(stats.firstDate))} to ${esc(dateLabel(stats.lastDate))}` : 'No vouchers yet'}`,
    )}
    ${panel(
      `Master statistics <span class="count">${stats.ledgerCount}</span>`,
      `<table class="data-table compact">
        <thead><tr><th>Group</th><th>Nature</th><th class="num">Ledgers</th></tr></thead>
        <tbody>${stats.groups
          .map(
            (group) => `<tr><td>${esc(group.name)}${group.custom ? ' <span class="badge">custom</span>' : ''}</td><td class="muted">${esc(group.nature)}</td><td class="num">${group.ledgers}</td></tr>`,
          )
          .join('')}</tbody>
      </table>`,
      `${stats.groupCount} groups · ${stats.customGroupCount} custom · ${stats.ledgerCount} ledgers`,
    )}`;
}

export function allPartyLedgerOptions(active, selectedId) {
  const groups = [
    ['Customers', partyLedgerList(active, 'receivable')],
    ['Suppliers', partyLedgerList(active, 'payable')],
  ];
  let html = '<option value="">Select party…</option>';
  for (const [label, ledgers] of groups) {
    if (!ledgers.length) continue;
    html += `<optgroup label="${label}">`;
    html += ledgers
      .map(
        (ledger) => `<option value="${esc(ledger.id)}"${ledger.id === selectedId ? ' selected' : ''}>${esc(ledger.name)}</option>`,
      )
      .join('');
    html += '</optgroup>';
  }
  return html;
}


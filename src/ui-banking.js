// ZledgerCraft - Cost centres, instruments, bank reconciliation and import screens.
// Screen functions read the live UI state exported by ui.js.
import {
  dateLabel,
  ledgerOptions,
  todayIso,
} from './store.js';
import {
  amountInWords,
  bankReconciliation,
  costCentreBreakup,
  costCentreSummary,
  costCategoryPnl,
  groupChainKeys,
  postDatedRegister,
} from './accounting.js';
import {
  view,
  filters,
  voucherLabel,
  esc,
  company,
  can,
  money,
  periodBar,
  panel,
  emptyCompanyScreen,
} from './ui.js';

export function costCentresScreen() {
  if (!company()) return emptyCompanyScreen('Cost centres');
  const active = company();
  const current = filters.costCentres;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const report = costCentreSummary(active, { from, to });
  const pnl = costCategoryPnl(active, { from, to });
  const pnlRows = pnl.rows
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.category)}</strong><div class="muted small">${row.voucherCount} voucher${row.voucherCount === 1 ? '' : 's'}</div></td>
        <td class="num">${money(row.directIncome)}</td>
        <td class="num">${money(row.directExpense)}</td>
        <td class="num ${row.directNet < 0 ? 'neg' : ''}">${money(row.directNet)}</td>
        <td class="num">${money(row.indirectIncome)}</td>
        <td class="num">${money(row.indirectExpense)}</td>
        <td class="num ${row.net < 0 ? 'neg' : ''}"><strong>${money(row.net)}</strong></td>
      </tr>`,
    )
    .join('');
  const pnlTotalRow = pnl.rows.length
    ? `<tr>
        <td><strong>Total</strong></td>
        <td class="num">${money(pnl.totalDirectIncome)}</td>
        <td class="num">${money(pnl.totalDirectExpense)}</td>
        <td class="num ${pnl.totalDirectNet < 0 ? 'neg' : ''}">${money(pnl.totalDirectNet)}</td>
        <td class="num">${money(pnl.totalIndirectIncome)}</td>
        <td class="num">${money(pnl.totalIndirectExpense)}</td>
        <td class="num ${pnl.totalNet < 0 ? 'neg' : ''}"><strong>${money(pnl.totalNet)}</strong></td>
      </tr>`
    : '';
  const centreRows = report.centreRows
    .map(
      (row) => `<tr class="clickable" data-action="open-cost-centre" data-id="${esc(row.centreId)}">
        <td><strong>${esc(row.centre)}</strong></td>
        <td class="muted">${esc(row.category)}</td>
        <td class="num">${row.voucherCount}</td>
        <td class="num">${money(row.debit)}</td>
        <td class="num">${money(row.credit)}</td>
        <td class="num ${row.net < 0 ? 'neg' : ''}">${money(row.net)}</td>
      </tr>`,
    )
    .join('');
  const unallocatedRows = report.unallocatedRows
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.ledger)}</strong></td>
        <td class="num">${money(row.debit)}</td>
        <td class="num">${money(row.credit)}</td>
        <td class="num ${row.net < 0 ? 'neg' : ''}">${money(row.net)}</td>
      </tr>`,
    )
    .join('');
  const categoryRows = report.categoryRows
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.category)}</strong></td>
        <td class="num">${row.centreCount}</td>
        <td class="num">${row.voucherCount}</td>
        <td class="num">${money(row.debit)}</td>
        <td class="num">${money(row.credit)}</td>
        <td class="num ${row.net < 0 ? 'neg' : ''}">${money(row.net)}</td>
      </tr>`,
    )
    .join('');

  return panel(
    'Cost centre summary',
    `${periodBar('cost-report-form', from, to)}
    <div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Debit allocations</span><strong>${money(report.totalDebit)}</strong><span class="muted small">${report.voucherCount} voucher${report.voucherCount === 1 ? '' : 's'}</span></div>
      <div class="ratio-card"><span class="ratio-label">Credit allocations</span><strong>${money(report.totalCredit)}</strong><span class="muted small">${report.centreRows.length} centres</span></div>
      <div class="ratio-card"><span class="ratio-label">Net allocation</span><strong>${money(report.totalNet)}</strong><span class="muted small">Debit less credit</span></div>
      <div class="ratio-card"><span class="ratio-label">Unallocated net</span><strong class="${Math.abs(report.unallocatedNet) > 0.005 ? 'neg' : ''}">${money(report.unallocatedNet)}</strong><span class="muted small">${report.unallocatedVoucherCount} voucher${report.unallocatedVoucherCount === 1 ? '' : 's'} · ${money(report.unallocatedDebit)} Dr / ${money(report.unallocatedCredit)} Cr</span></div>
    </div>
    <h3 class="column-title">By category</h3>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Category</th><th class="num">Centres</th><th class="num">Vouchers</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table></div>
    <h3 class="column-title">Profit &amp; loss by category</h3>
    ${pnl.rows.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact">
          <thead><tr><th>Category</th><th class="num">Direct income</th><th class="num">Direct expense</th><th class="num">Direct net</th><th class="num">Indirect income</th><th class="num">Indirect expense</th><th class="num">Net</th></tr></thead>
          <tbody>${pnlRows}${pnlTotalRow}</tbody>
        </table></div>`
      : '<p class="muted">No income or expense lines are tagged to a cost centre in this period.</p>'}
    <h3 class="column-title">By cost centre</h3>
    ${report.centreRows.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact cost-centre-table">
          <thead><tr><th>Cost centre</th><th>Category</th><th class="num">Vouchers</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead>
          <tbody>${centreRows}</tbody>
        </table></div>`
      : '<p class="muted">No cost centres yet. Create them in Masters, then choose one on a voucher line.</p>'}
    <h3 class="column-title">Unallocated lines</h3>
    ${report.unallocatedRows.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact">
          <thead><tr><th>Ledger without a cost centre</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead>
          <tbody>${unallocatedRows}</tbody>
        </table></div>`
      : '<p class="muted">Every voucher line in this period has a cost centre.</p>'}`,
    'Allocated columns include only lines with a cost centre. The unallocated table reconciles the remaining lines in the same period. Profit & loss by category counts only tagged income and expense lines, so untagged income or expense is excluded. Click a centre to see its vouchers.',
  );
}

export function costCentreDetailScreen() {
  if (!company()) return emptyCompanyScreen('Cost centre');
  const active = company();
  const current = filters.costCentres;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const report = costCentreBreakup(active, view.id, { from, to });
  if (!report) return panel('Cost centre', '<p class="muted">That cost centre no longer exists.</p>');
  const ledgerRows = report.ledgerRows
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.ledger)}</strong></td>
        <td class="num">${money(row.debit)}</td>
        <td class="num">${money(row.credit)}</td>
        <td class="num ${row.net < 0 ? 'neg' : ''}">${money(row.net)}</td>
      </tr>`,
    )
    .join('');
  const rows = report.rows
    .map(
      (row) => `<tr class="clickable" data-action="open-voucher" data-id="${esc(row.voucherId)}">
        <td>${esc(dateLabel(row.date))}</td>
        <td>${esc(voucherLabel(row.type))} ${row.no}</td>
        <td>${esc(row.ledger)}</td>
        <td>${row.side}</td>
        <td class="num">${money(row.amount)}</td>
        <td class="muted small">${esc(row.narration || '—')}</td>
      </tr>`,
    )
    .join('');
  return panel(
    `Cost centre · ${esc(report.centre.name)}`,
    `${periodBar('cost-report-form', from, to)}
    <div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Category</span><strong>${esc(report.category)}</strong><span class="muted small">${report.count} allocated lines</span></div>
      <div class="ratio-card"><span class="ratio-label">Debit</span><strong>${money(report.debit)}</strong><span class="muted small">Total debits</span></div>
      <div class="ratio-card"><span class="ratio-label">Credit</span><strong>${money(report.credit)}</strong><span class="muted small">Total credits</span></div>
      <div class="ratio-card"><span class="ratio-label">Net</span><strong>${money(report.net)}</strong><span class="muted small">Debit less credit</span></div>
    </div>
    <h3 class="column-title">Ledger movement</h3>
    ${report.ledgerRows.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact">
          <thead><tr><th>Ledger</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead>
          <tbody>${ledgerRows}</tbody>
        </table></div>`
      : '<p class="muted">No lines are allocated to this centre in the period.</p>'}
    <p class="muted small">Ledger movement covers this period only; cost-centre opening balances are not modelled.</p>
    <h3 class="column-title">Voucher lines</h3>
    ${report.rows.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact">
          <thead><tr><th>Date</th><th>Voucher</th><th>Ledger</th><th>Side</th><th class="num">Amount</th><th>Narration</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No voucher lines are allocated to this centre in the selected period.</p>'}`,
    'Click a row to open its voucher.',
  );
}

export function postDatedScreen() {
  if (!company()) return emptyCompanyScreen('Cheque / DD register');
  const active = company();
  const current = filters.postDated;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const asOn = current.asOn || todayIso();
  const report = postDatedRegister(active, {
    from,
    to,
    asOn,
    status: current.status,
    bankLedgerId: current.bankLedgerId,
    party: current.party,
    partyLedgerId: current.partyLedgerId,
    numberFrom: current.numberFrom,
    numberTo: current.numberTo,
  });
  const canWrite = can('voucher.write');
  const statusOptions = ['All', 'Post-dated', 'Due', 'Cleared', 'Stopped', 'Cancelled']
    .map((status) => `<option value="${status}"${current.status === status ? ' selected' : ''}>${status === 'All' ? 'All instruments' : status}</option>`)
    .join('');
  const bankOptions = [
    '<option value="">All banks</option>',
    ...active.ledgers
      .filter((ledger) => groupChainKeys(active, ledger.groupId).includes('bank'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((ledger) => `<option value="${esc(ledger.id)}"${current.bankLedgerId === ledger.id ? ' selected' : ''}>${esc(ledger.name)}</option>`),
  ].join('');
  const partyOptions = [
    '<option value="">Any party account</option>',
    ...ledgerOptions(active).map(
      (ledger) => `<option value="${esc(ledger.id)}"${current.partyLedgerId === ledger.id ? ' selected' : ''}>${esc(ledger.name)} · ${esc(ledger.groupName)}</option>`,
    ),
  ].join('');
  const rows = report.rows
    .map((row) => {
      const timing = row.manualStatus
        ? 'set manually'
        : row.status === 'Cleared'
          ? 'matched in bank reconciliation'
          : row.daysFromAsOn > 0
            ? `${row.daysFromAsOn} day${row.daysFromAsOn === 1 ? '' : 's'} ahead`
            : row.daysFromAsOn < 0
              ? `${Math.abs(row.daysFromAsOn)} day${Math.abs(row.daysFromAsOn) === 1 ? '' : 's'} overdue`
              : 'today';
      return `<tr class="clickable" data-action="open-voucher" data-id="${esc(row.voucherId)}">
        <td>${esc(dateLabel(row.instrumentDate))}</td>
        <td><strong>${esc(row.kind)} ${esc(row.number)}</strong><div class="muted small">${esc(row.bank)}</div></td>
        <td>${esc(row.party)}</td>
        <td>${esc(voucherLabel(row.type))} ${row.no}<div class="muted small">voucher ${esc(dateLabel(row.voucherDate))}</div></td>
        <td><span class="badge ${row.status === 'Post-dated' ? 'attention' : row.status === 'Due' ? 'overdue' : ''}">${esc(row.status)}</span><div class="muted small">${esc(timing)}</div>
          ${row.statusHistory.length
            ? `<details><summary class="muted small">${row.statusHistory.length} status change${row.statusHistory.length === 1 ? '' : 's'}</summary><div class="muted small">${row.statusHistory
                .slice()
                .reverse()
                .slice(0, 8)
                .map((entry) => `${esc(entry.status)} · ${esc(new Date(entry.at).toLocaleString('en-IN'))}`)
                .join('<br>')}</div></details>`
            : ''}
          ${canWrite
            ? `<div class="row-actions">${row.manualStatus
                ? `<button class="btn small ghost" type="button" data-action="set-instrument-status" data-status="" data-id="${esc(row.voucherId)}">Restore automatic</button>`
                : `<button class="btn small ghost" type="button" data-action="set-instrument-status" data-status="Cleared" data-id="${esc(row.voucherId)}">Mark cleared</button>
                   <button class="btn small ghost" type="button" data-action="set-instrument-status" data-status="Stopped" data-id="${esc(row.voucherId)}">Stop</button>
                   <button class="btn small ghost" type="button" data-action="set-instrument-status" data-status="Cancelled" data-id="${esc(row.voucherId)}">Cancel</button>`}</div>`
            : ''}
        </td>
        <td class="num">${money(row.amount)}</td>
      </tr>`;
    })
    .join('');

  return panel(
    'Cheque / DD register',
    `<form id="postdated-form" class="filter-bar">
      <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
      <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
      <label class="field inline-field"><span>As on</span><input name="asOn" type="date" value="${esc(asOn)}" data-period></label>
      <label class="field inline-field"><span>Status</span><select name="status">${statusOptions}</select></label>
      <label class="field inline-field"><span>Bank</span><select name="bankLedgerId">${bankOptions}</select></label>
      <label class="field inline-field"><span>Party contains</span><input name="party" maxlength="80" placeholder="Any party" value="${esc(current.party ?? '')}"></label>
      <label class="field inline-field"><span>Party account</span><select name="partyLedgerId">${partyOptions}</select></label>
      <label class="field inline-field"><span>Cheque no. from</span><input name="numberFrom" maxlength="30" placeholder="Any" value="${esc(current.numberFrom ?? '')}"></label>
      <label class="field inline-field"><span>to</span><input name="numberTo" maxlength="30" placeholder="Any" value="${esc(current.numberTo ?? '')}"></label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    <div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Post-dated</span><strong>${report.postDatedCount}</strong><span class="muted small">${money(report.postDatedTotal)} value</span></div>
      <div class="ratio-card"><span class="ratio-label">Due</span><strong>${report.dueCount}</strong><span class="muted small">${money(report.dueTotal)} value</span></div>
      <div class="ratio-card"><span class="ratio-label">Cleared</span><strong>${report.clearedCount}</strong><span class="muted small">${money(report.clearedTotal)} value</span></div>
      <div class="ratio-card"><span class="ratio-label">Instruments</span><strong>${report.count}</strong><span class="muted small">${money(report.total)} value${report.cancelledCount + report.stoppedCount ? ` · ${report.cancelledCount + report.stoppedCount} stopped/cancelled` : ''}</span></div>
    </div>
    ${report.rows.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact postdated-table">
          <thead><tr><th>Instrument date</th><th>Instrument</th><th>Party</th><th>Voucher</th><th>Status</th><th class="num">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No cheque or DD instruments in this period. Add instrument details on a payment, receipt or contra voucher.</p>'}`,
    'Post-dated means the instrument date is after the as-on date. Cleared means the voucher is matched in Bank Reconciliation unless the instrument was marked cleared, stopped or cancelled manually. Bank, party text, exact party account and cheque-number range filters narrow the same register without changing status logic; manual status changes keep a short history.',
  );
}

export function chequePrintScreen() {
  if (!company()) return emptyCompanyScreen('Instrument print');
  const active = company();
  const voucher = active.vouchers.find((item) => item.id === view.id);
  if (
    !voucher ||
    !['Payment', 'Receipt', 'Contra'].includes(voucher.type) ||
    !['Cheque', 'DD'].includes(voucher.instrument?.kind)
  ) {
    return panel(
      'Instrument print',
      `<p class="muted">Printing is available for payment, receipt and contra vouchers with cheque or DD details.</p>
       <button class="btn" type="button" data-screen="gateway">Back to Gateway</button>`,
    );
  }
  const instrument = voucher.instrument;
  const bank = active.ledgers.find((ledger) => ledger.id === instrument.bankLedgerId);
  const isPayment = voucher.type === 'Payment';
  const isContra = voucher.type === 'Contra';
  const bankLine = voucher.lines.find((line) => line.ledgerId === instrument.bankLedgerId);
  const party =
    voucher.lines
      .filter(
        (line) =>
          line.ledgerId !== instrument.bankLedgerId &&
          (isContra || line.side === (isPayment ? 'Dr' : 'Cr')),
      )
      .map((line) => active.ledgers.find((ledger) => ledger.id === line.ledgerId)?.name)
      .filter(Boolean)
      .join(' / ') || '—';
  const date = instrument.date;
  const bankName = esc(bank?.name ?? 'Bank');
  const kindLabel = instrument.kind === 'DD' ? 'Demand Draft' : 'Cheque';
  const printLabel = isContra
    ? 'Print contra advice'
    : !isPayment
      ? 'Print deposit slip'
      : instrument.kind === 'DD'
        ? 'Print DD advice'
        : 'Print cheque';

  let preview;
  if (isContra) {
    const deposit = bankLine?.side === 'Dr';
    preview = `<div class="cheque-sheet">
        <div class="cheque-head"><strong>${bankName}</strong><span class="cheque-number">Contra advice</span></div>
        <div class="cheque-date">Date <strong>${esc(dateLabel(date))}</strong></div>
        <div class="cheque-payee">${deposit ? 'Deposit to' : 'Withdrawal from'} <strong>${bankName}</strong> ${deposit ? 'from' : 'to'} <strong>${esc(party)}</strong></div>
        <div class="cheque-payee">Instrument <strong>${esc(instrument.kind)} ${esc(instrument.number)}</strong></div>
        <div class="cheque-words">${esc(amountInWords(voucher.total))}</div>
        <div class="cheque-footer"><span class="cheque-amount">${money(voucher.total)}</span><span class="cheque-sign">Authorised signatory</span></div>
        <div class="cheque-cross">${esc(voucherLabel(voucher.type))} ${voucher.no}</div>
      </div>`;
  } else if (isPayment && instrument.kind === 'Cheque') {
    preview = `<div class="cheque-sheet">
        <div class="cheque-head"><strong>${bankName}</strong><span class="cheque-number">Cheque ${esc(instrument.number)}</span></div>
        <div class="cheque-date">Date <strong>${esc(dateLabel(date))}</strong></div>
        <div class="cheque-payee">Pay <strong>${esc(party)}</strong></div>
        <div class="cheque-words">${esc(amountInWords(voucher.total))}</div>
        <div class="cheque-footer"><span class="cheque-amount">${money(voucher.total)}</span><span class="cheque-sign">Authorised signatory</span></div>
        <div class="cheque-cross">A/c Payee</div>
      </div>`;
  } else if (isPayment) {
    preview = `<div class="cheque-sheet">
        <div class="cheque-head"><strong>${bankName}</strong><span class="cheque-number">${kindLabel} ${esc(instrument.number)}</span></div>
        <div class="cheque-date">Date <strong>${esc(dateLabel(date))}</strong></div>
        <div class="cheque-payee">Pay <strong>${esc(party)}</strong></div>
        <div class="cheque-words">${esc(amountInWords(voucher.total))}</div>
        <div class="cheque-footer"><span class="cheque-amount">${money(voucher.total)}</span><span class="cheque-sign">Authorised signatory</span></div>
        <div class="cheque-cross">DD advice</div>
      </div>`;
  } else {
    preview = `<div class="cheque-sheet">
        <div class="cheque-head"><strong>${bankName}</strong><span class="cheque-number">Deposit slip</span></div>
        <div class="cheque-date">Date <strong>${esc(dateLabel(date))}</strong></div>
        <div class="cheque-payee">Received from <strong>${esc(party)}</strong></div>
        <div class="cheque-payee">Instrument <strong>${esc(instrument.kind)} ${esc(instrument.number)}</strong></div>
        <div class="cheque-words">${esc(amountInWords(voucher.total))}</div>
        <div class="cheque-footer"><span class="cheque-amount">${money(voucher.total)}</span><span class="cheque-sign">For deposit to the above account</span></div>
        <div class="cheque-cross">${esc(voucherLabel(voucher.type))} ${voucher.no}</div>
      </div>`;
  }

  return panel(
    `${isContra ? 'Contra advice' : isPayment ? kindLabel : 'Deposit slip'} print · ${esc(instrument.number)}`,
    `<div class="cheque-preview">${preview}</div>
    <div class="form-actions">
      <button class="btn primary" type="button" data-action="print-report">${printLabel}</button>
      <button class="btn ghost" type="button" data-action="open-voucher" data-id="${esc(voucher.id)}">Back to voucher</button>
    </div>`,
    'Preview only. Use your browser print dialog; alignment depends on the printer and stationery. It is not a bank-issued advice or a validated receipt.',
  );
}

export function selectedBankLedgerId() {
  const active = company();
  if (!active) return '';
  const banks = active.ledgers
    .filter((ledger) => groupChainKeys(active, ledger.groupId).includes('bank'))
    .sort((a, b) => a.name.localeCompare(b.name));
  return banks.some((ledger) => ledger.id === view.bankLedgerId) ? view.bankLedgerId : banks[0]?.id ?? '';
}

export function bankReconScreen() {
  if (!company()) return emptyCompanyScreen('Bank Reconciliation');
  const active = company();
  const banks = active.ledgers
    .filter((ledger) => groupChainKeys(active, ledger.groupId).includes('bank'))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!banks.length) {
    return panel(
      'Bank reconciliation',
      `<p class="muted">Create a ledger under <strong>Bank Accounts</strong> first, then record receipts and payments through it.</p>
      <button class="btn primary" type="button" data-screen="masters">Open Masters</button>`,
    );
  }
  const ledgerId = banks.some((ledger) => ledger.id === view.bankLedgerId) ? view.bankLedgerId : banks[0].id;
  const report = bankReconciliation(active, ledgerId);
  const canWrite = can('recon.write');
  const bankOptions = banks
    .map((ledger) => `<option value="${esc(ledger.id)}"${ledger.id === ledgerId ? ' selected' : ''}>${esc(ledger.name)}</option>`)
    .join('');
  const entryOptions = report.unmatchedEntries
    .map(
      (entry) => `<option value="${esc(entry.voucherId)}">${esc(dateLabel(entry.date))} · ${esc(voucherLabel(entry.type))} ${entry.no} · ${money(entry.amount)}</option>`,
    )
    .join('');
  const adjustmentOptions = active.ledgers
    .filter((ledger) => ledger.id !== ledgerId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((ledger) => `<option value="${esc(ledger.id)}">${esc(ledger.name)}</option>`)
    .join('');

  const rows = report.lines
    .map((line) => {
      const matched = line.matchedVoucherId
        ? `<span class="badge">matched</span> ${line.matchedEntry ? `${esc(voucherLabel(line.matchedEntry.type))} ${line.matchedEntry.no}` : 'voucher'}
           <button class="btn small" type="button" data-action="recon-unmatch" data-line="${esc(line.id)}"${canWrite ? '' : ' disabled'}>Unmatch</button>`
        : `<select class="recon-voucher" data-line="${esc(line.id)}"${canWrite ? '' : ' disabled'}>
             <option value="">Choose voucher…</option>${entryOptions}
           </select>
           <button class="btn small primary" type="button" data-action="recon-match" data-line="${esc(line.id)}"${canWrite ? '' : ' disabled'}>Match</button>
           <button class="btn small" type="button" data-action="recon-adjust" data-line="${esc(line.id)}"${canWrite ? '' : ' disabled'}>Adjust</button>`;
      return `<tr class="${line.matchedVoucherId ? '' : 'overdue-row'}">
        <td>${esc(dateLabel(line.date))}</td>
        <td>${esc(line.description || '—')}${line.reference ? ` <span class="muted small">${esc(line.reference)}</span>` : ''}</td>
        <td class="num ${line.amount < 0 ? 'neg' : ''}">${money(line.amount)}</td>
        <td class="recon-match-cell">${matched}</td>
      </tr>`;
    })
    .join('');

  const unmatchedRows = report.unmatchedEntries
    .map(
      (entry) => `<tr>
        <td>${esc(dateLabel(entry.date))}</td>
        <td>${esc(voucherLabel(entry.type))} ${entry.no}</td>
        <td>${esc(entry.narration || '—')}</td>
        <td class="num ${entry.amount < 0 ? 'neg' : ''}">${money(entry.amount)}</td>
      </tr>`,
    )
    .join('');

  return `
    ${panel(
      `Bank reconciliation · ${esc(report.ledger.name)}`,
      `<div class="filter-bar">
        <label class="field inline-field"><span>Bank ledger</span>
          <select id="bank-ledger-select">${bankOptions}</select>
        </label>
        <label class="field inline-field"><span>Adjustment ledger</span>
          <select id="recon-adjust-ledger"><option value="">Choose ledger…</option>${adjustmentOptions}</select>
        </label>
      </div>
      <p class="muted small">For an unmatched statement line, choose the other side and press Adjust. This posts a Journal to the bank ledger and marks the line matched.</p>
      <div class="ratio-grid">
        <div class="ratio-card"><span class="ratio-label">Matched</span><strong>${report.matchedCount} / ${report.lines.length}</strong><span class="muted small">${report.matchedPercent}% of statement lines</span></div>
        <div class="ratio-card"><span class="ratio-label">Statement unmatched</span><strong>${report.unmatchedCount}</strong><span class="muted small">${money(report.unmatchedStatementAmount)} value</span></div>
        <div class="ratio-card"><span class="ratio-label">Book unmatched</span><strong>${report.unmatchedEntries.length}</strong><span class="muted small">${money(report.unmatchedBookAmount)} value</span></div>
        <div class="ratio-card"><span class="ratio-label">Bank balance</span><strong>${money(report.bookBalance)}</strong><span class="muted small">${report.importedAt ? `Statement imported ${esc(new Date(report.importedAt).toLocaleDateString('en-IN'))}` : 'No statement imported'}</span></div>
      </div>
      ${report.balances
        ? `<p class="${report.statementDifference === 0 ? 'muted small' : 'off-text'}">Statement balances: opening ${money(report.balances.opening)}, closing ${money(report.balances.closing)}, movement ${money(report.statementNet)}. ${report.statementDifference === 0 ? 'Opening plus movement equals closing.' : `Difference ${money(report.statementDifference)} — the statement may be incomplete or mistyped.`}</p>`
        : ''}
      ${report.importedAt
        ? `<div class="form-actions">
             <button class="btn small primary" type="button" data-action="recon-auto"${canWrite ? '' : ' disabled'}>Auto-match by amount and date</button>
             <button class="btn small danger" type="button" data-action="recon-clear"${canWrite ? '' : ' disabled'}>Clear statement</button>
           </div>`
        : ''}`,
      `${report.inflow ? `Statement inflow ${money(report.inflow)}` : ''}${report.inflow && report.outflow ? ' · ' : ''}${report.outflow ? `outflow ${money(report.outflow)}` : ''}`,
    )}
    ${canWrite
      ? panel(
          'Import bank statement',
          `<p class="muted">Paste or choose CSV, OFX, QIF or MT940. CSV columns: <code>Date, Description, Reference, Debit, Credit</code>; dates accept YYYY-MM-DD or DD/MM/YYYY. OFX uses TRNAMT/DTPOSTED, QIF uses D/T/P/N and MT940 uses :61:/:86: fields. Debit is money out; credit is money in. Importing replaces the current statement and its matches.</p>
          <div class="pay-grid">
            <label class="field"><span>Opening balance (optional)</span><input id="bank-opening-balance" inputmode="decimal" placeholder="0.00"></label>
            <label class="field"><span>Closing balance (optional)</span><input id="bank-closing-balance" inputmode="decimal" placeholder="0.00"></label>
          </div>
          <p class="muted small">Provide both balances to check that opening plus statement movement equals closing. This validates the statement file, not the book balance.</p>
          <label class="field"><span>Statement file (CSV, OFX, QIF or MT940)</span><input type="file" accept=".csv,.ofx,.qif,.sta,.mt940,text/csv,application/x-ofx,application/qif" data-csv-target="bank-statement-csv"></label>
          <label class="field"><span>Or Excel workbook (.xlsx)</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-xlsx-target="bank-statement-csv" data-xlsx-sheet="Statement"></label>
          <textarea id="bank-statement-csv" class="backup-box import-box" rows="7" placeholder="Date,Description,Reference,Debit,Credit\n10/05/2026,Customer receipt,R1,,1000\n11/05/2026,Supplier payment,P1,500," aria-label="Bank statement CSV"></textarea>
          <div class="form-actions"><button class="btn small primary" type="button" data-action="import-bank-statement">Import statement</button></div>`,
        )
      : ''}
    ${panel(
      'Statement lines',
      report.lines.length
        ? `<div class="table-scroll" tabindex="0"><table class="data-table compact recon-table">
            <thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th><th>Match</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`
        : '<p class="muted">No statement imported yet. Paste or choose a CSV above.</p>',
    )}
    ${panel(
      `Unmatched bank entries <span class="count">${report.unmatchedEntries.length}</span>`,
      report.unmatchedEntries.length
        ? `<div class="table-scroll" tabindex="0"><table class="data-table compact recon-table">
            <thead><tr><th>Date</th><th>Voucher</th><th>Narration</th><th class="num">Amount</th></tr></thead>
            <tbody>${unmatchedRows}</tbody>
          </table></div>`
        : '<p class="muted">Every bank voucher is matched to a statement line.</p>',
      'Bank amounts are signed from the bank ledger: debit positive, credit negative.',
    )}`;
}

export function importScreen() {
  if (!company()) return emptyCompanyScreen('Import data');
  return `${panel(
    'Import ledgers from CSV or Excel',
    `<p class="muted">Header: <code>Name, Group, Opening, Type</code>. Type is Dr or Cr. The group must already exist. The whole file is rejected if any row fails. An .xlsx workbook can be loaded into the box below for review first; it uses the <code>Ledgers</code> sheet when present, otherwise the first sheet.</p>
    <label class="field"><span>CSV file</span><input type="file" accept=".csv,text/csv" data-csv-target="ledger-csv"></label>
    <label class="field"><span>Excel workbook (.xlsx)</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-xlsx-target="ledger-csv" data-xlsx-sheet="Ledgers"></label>
    <textarea id="ledger-csv" class="backup-box import-box" rows="7" placeholder="Name,Group,Opening,Type\nSharma Traders,Sundry Debtors,0,Dr\nRent,Indirect Expenses,0,Dr" aria-label="Ledger import CSV"></textarea>
    <div class="form-actions"><button class="btn small primary" type="button" data-action="import-ledgers"${can('master.write') ? '' : ' disabled'}>Import ledgers</button></div>`,
  )}
  ${panel(
    'Import stock items from CSV',
    `<p class="muted">Header: <code>Name, Group, Unit, Opening, Rate, Reorder, Selling, Purchase, HSN, Batch</code>. Only Name and Unit are required; Group defaults to Primary. Unit matches its symbol or name. Batch accepts Yes/No. The whole file is rejected if any row fails.</p>
    <label class="field"><span>CSV file</span><input type="file" accept=".csv,text/csv" data-csv-target="stock-item-csv"></label>
    <label class="field"><span>Excel workbook (.xlsx)</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-xlsx-target="stock-item-csv" data-xlsx-sheet="Stock Items"></label>
    <textarea id="stock-item-csv" class="backup-box import-box" rows="7" placeholder="Name,Group,Unit,Opening,Rate,Reorder,Selling,Purchase,HSN,Batch\nCotton Shirt,Primary,Nos,10,100,12,150,90,6109,No" aria-label="Stock item import CSV"></textarea>
    <div class="form-actions"><button class="btn small primary" type="button" data-action="import-stock-items"${can('master.write') ? '' : ' disabled'}>Import stock items</button></div>`,
  )}
  ${panel(
    'Import currency rates from CSV',
    `<p class="muted">Header: <code>Code, Date, Rate</code>. Date uses YYYY-MM-DD and the currency must already exist. The whole file is rejected if any row fails or duplicates an existing rate date.</p>
    <label class="field"><span>CSV file</span><input type="file" accept=".csv,text/csv" data-csv-target="currency-rate-csv"></label>
    <label class="field"><span>Excel workbook (.xlsx)</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-xlsx-target="currency-rate-csv" data-xlsx-sheet="Rates"></label>
    <textarea id="currency-rate-csv" class="backup-box import-box" rows="6" placeholder="Code,Date,Rate\nUSD,2026-04-01,83.25\nUSD,2026-04-15,84.10" aria-label="Currency rate import CSV"></textarea>
    <div class="form-actions"><button class="btn small primary" type="button" data-action="import-currency-rates"${can('master.write') ? '' : ' disabled'}>Import rates</button></div>`,
  )}
  ${panel(
    'Import other masters from CSV',
    `<p class="muted">Choose the master type. Units need <code>Name,Symbol</code>; cost centres need <code>Name,Category</code>; pay heads need <code>Name,Kind,Ledger,Statutory</code>; currencies need <code>Code,Name,Symbol,Rate,Date</code>; employees need <code>Name,PayHead,Amount</code> with one row per pay head, plus optional code, designation, PAN, joining, exit, active, bank, account and IFSC columns. Other masters need <code>Name</code>. Existing names are rejected and the whole file is atomic.</p>
    <label class="field"><span>Master type</span><select id="master-import-type"><option value="units">Units</option><option value="stockGroups">Stock groups</option><option value="godowns">Godowns</option><option value="costCategories">Cost categories</option><option value="costCentres">Cost centres</option><option value="payHeads">Pay heads</option><option value="currencies">Currencies</option><option value="employees">Employees</option></select></label>
    <label class="field"><span>CSV file</span><input type="file" accept=".csv,text/csv" data-csv-target="master-csv"></label>
    <label class="field"><span>Excel workbook (.xlsx)</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-xlsx-target="master-csv" data-xlsx-sheet="Masters"></label>
    <textarea id="master-csv" class="backup-box import-box" rows="6" placeholder="Name,Symbol\nBoxes,Box\nDozens,Doz" aria-label="Other master import CSV"></textarea>
    <div class="form-actions"><button class="btn small primary" type="button" data-action="import-masters"${can('master.write') ? '' : ' disabled'}>Import masters</button></div>`,
  )}
  ${panel(
    'Import vouchers from CSV or Excel',
    `<p class="muted">Header: <code>Date, Type, No, Ledger, Side, Amount, Narration</code>. Use one row per voucher line and repeat Date, Type and No for lines of the same voucher. Dates use YYYY-MM-DD. Stock items and bill allocations are not imported; use the voucher screen for those. An .xlsx workbook can be loaded into the box below for review first; it uses the <code>Vouchers</code> sheet when present, otherwise the first sheet.</p>
    <label class="field"><span>CSV file</span><input type="file" accept=".csv,text/csv" data-csv-target="voucher-csv"></label>
    <label class="field"><span>Excel workbook (.xlsx)</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-xlsx-target="voucher-csv" data-xlsx-sheet="Vouchers"></label>
    <textarea id="voucher-csv" class="backup-box import-box" rows="9" placeholder="Date,Type,No,Ledger,Side,Amount,Narration\n2026-04-10,Sales,1,Cash,Dr,1000,\n2026-04-10,Sales,1,Sales,Cr,1000," aria-label="Voucher import CSV"></textarea>
    <div class="form-actions"><button class="btn small primary" type="button" data-action="import-vouchers"${can('voucher.write') ? '' : ' disabled'}>Import vouchers</button></div>`,
  )}
  ${panel(
    'Import from Tally XML',
    `<p class="muted">Paste an All Masters export to create account groups, ledgers, stock groups and stock items, a voucher export to create vouchers, or all together. Custom account groups need an existing standard parent; custom top-level groups and units must already exist here. Stock groups are created automatically. Opening stock quantity and rate are imported. Stock lines attach when their total matches the voucher and the item/godown exists; batch names and expiry attach when the local item is batch-tracked. Otherwise the accounting voucher imports and skipped stock lines are reported. Tally voucher numbers are regenerated; bill allocations, GST and TDS details are not imported.</p>
    <label class="field"><span>Tally XML file</span><input type="file" accept=".xml,text/xml,application/xml" data-csv-target="tally-xml"></label>
    <textarea id="tally-xml" class="backup-box import-box" rows="10" placeholder="<ENVELOPE>\n  <BODY>\n    <TALLYMESSAGE>\n      <LEDGER NAME=&quot;Sharma Traders&quot;>\n        <PARENT>Sundry Debtors</PARENT>\n        <OPENINGBALANCE>0</OPENINGBALANCE>\n      </LEDGER>\n    </TALLYMESSAGE>\n  </BODY>\n</ENVELOPE>" aria-label="Tally XML import"></textarea>
    <div class="form-actions"><button class="btn small primary" type="button" data-action="import-tally"${can('master.write') && can('voucher.write') ? '' : ' disabled'}>Import Tally XML</button></div>`,
  )}`;
}


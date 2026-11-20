// ZledgerCraft - Cost centres, instruments, bank reconciliation and import screens.
// Screen functions read the live UI state exported by ui.js.
import {
  dateLabel,
  todayIso,
} from './store.js';
import {
  amountInWords,
  bankReconciliation,
  costCentreBreakup,
  costCentreSummary,
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
    </div>
    <h3 class="column-title">By category</h3>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Category</th><th class="num">Centres</th><th class="num">Vouchers</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table></div>
    <h3 class="column-title">By cost centre</h3>
    ${report.centreRows.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact cost-centre-table">
          <thead><tr><th>Cost centre</th><th>Category</th><th class="num">Vouchers</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead>
          <tbody>${centreRows}</tbody>
        </table></div>`
      : '<p class="muted">No cost centres yet. Create them in Masters, then choose one on a voucher line.</p>'}`,
    'Only voucher lines with a cost centre are included. Click a centre to see its vouchers.',
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
  const report = postDatedRegister(active, { from, to, asOn, status: current.status });
  const canWrite = can('voucher.write');
  const statusOptions = ['All', 'Post-dated', 'Due', 'Cleared', 'Stopped', 'Cancelled']
    .map((status) => `<option value="${status}"${current.status === status ? ' selected' : ''}>${status === 'All' ? 'All instruments' : status}</option>`)
    .join('');
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
    'Post-dated means the instrument date is after the as-on date. Cleared means the voucher is matched in Bank Reconciliation unless the instrument was marked cleared, stopped or cancelled manually.',
  );
}

export function chequePrintScreen() {
  if (!company()) return emptyCompanyScreen('Cheque print');
  const active = company();
  const voucher = active.vouchers.find((item) => item.id === view.id);
  if (!voucher || voucher.type !== 'Payment' || voucher.instrument?.kind !== 'Cheque') {
    return panel(
      'Cheque print',
      `<p class="muted">Cheque printing is available for payment vouchers with cheque details.</p>
       <button class="btn" type="button" data-screen="gateway">Back to Gateway</button>`,
    );
  }
  const bank = active.ledgers.find((ledger) => ledger.id === voucher.instrument.bankLedgerId);
  const payee =
    voucher.lines
      .filter((line) => line.side === 'Dr' && line.ledgerId !== voucher.instrument.bankLedgerId)
      .map((line) => active.ledgers.find((ledger) => ledger.id === line.ledgerId)?.name)
      .filter(Boolean)
      .join(' / ') || '—';
  const date = voucher.instrument.date;

  return panel(
    `Cheque print · ${esc(voucher.instrument.number)}`,
    `<div class="cheque-preview">
      <div class="cheque-sheet">
        <div class="cheque-head"><strong>${esc(bank?.name ?? 'Bank')}</strong><span class="cheque-number">Cheque ${esc(voucher.instrument.number)}</span></div>
        <div class="cheque-date">Date <strong>${esc(dateLabel(date))}</strong></div>
        <div class="cheque-payee">Pay <strong>${esc(payee)}</strong></div>
        <div class="cheque-words">${esc(amountInWords(voucher.total))}</div>
        <div class="cheque-footer"><span class="cheque-amount">${money(voucher.total)}</span><span class="cheque-sign">Authorised signatory</span></div>
        <div class="cheque-cross">A/c Payee</div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn primary" type="button" data-action="print-report">Print cheque</button>
      <button class="btn ghost" type="button" data-action="open-voucher" data-id="${esc(voucher.id)}">Back to voucher</button>
    </div>`,
    'Preview only. Use your browser print dialog to print the cheque; alignment depends on the printer and cheque stationery.',
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

  const rows = report.lines
    .map((line) => {
      const matched = line.matchedVoucherId
        ? `<span class="badge">matched</span> ${line.matchedEntry ? `${esc(voucherLabel(line.matchedEntry.type))} ${line.matchedEntry.no}` : 'voucher'}
           <button class="btn small" type="button" data-action="recon-unmatch" data-line="${esc(line.id)}"${canWrite ? '' : ' disabled'}>Unmatch</button>`
        : `<select class="recon-voucher" data-line="${esc(line.id)}"${canWrite ? '' : ' disabled'}>
             <option value="">Choose voucher…</option>${entryOptions}
           </select>
           <button class="btn small primary" type="button" data-action="recon-match" data-line="${esc(line.id)}"${canWrite ? '' : ' disabled'}>Match</button>`;
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
      </div>
      <div class="ratio-grid">
        <div class="ratio-card"><span class="ratio-label">Matched</span><strong>${report.matchedCount} / ${report.lines.length}</strong><span class="muted small">${report.matchedPercent}% of statement lines</span></div>
        <div class="ratio-card"><span class="ratio-label">Statement unmatched</span><strong>${report.unmatchedCount}</strong><span class="muted small">${money(report.unmatchedStatementAmount)} value</span></div>
        <div class="ratio-card"><span class="ratio-label">Book unmatched</span><strong>${report.unmatchedEntries.length}</strong><span class="muted small">${money(report.unmatchedBookAmount)} value</span></div>
        <div class="ratio-card"><span class="ratio-label">Bank balance</span><strong>${money(report.bookBalance)}</strong><span class="muted small">${report.importedAt ? `Statement imported ${esc(new Date(report.importedAt).toLocaleDateString('en-IN'))}` : 'No statement imported'}</span></div>
      </div>
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
          `<p class="muted">CSV columns: <code>Date, Description, Reference, Debit, Credit</code>. Dates accept YYYY-MM-DD or DD/MM/YYYY. Debit is money out; credit is money in. Importing replaces the current statement and its matches.</p>
          <label class="field"><span>CSV file</span><input type="file" accept=".csv,text/csv" data-csv-target="bank-statement-csv"></label>
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


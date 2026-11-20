// ZledgerCraft - GST, e-invoice, e-way bill and TDS screens.
// Screen functions read the live UI state exported by ui.js.
import {
  GST_ROLES,
  GST_STATES,
  dateLabel,
  gstRateLabel,
  gstTaxLedgers,
  round2,
  suggestedComplianceDueDate,
  todayIso,
  withholdingTaxLedgers,
} from './store.js';
import {
  eInvoiceRegister,
  ewayBillRegister,
  gstAnnualSummary,
  gstReturns,
  ledgerTotals,
  outstanding,
  taxAuditSummary,
  withholdingCertificates,
  withholdingSummary,
} from './accounting.js';
import {
  state,
  view,
  draft,
  filters,
  voucherLabel,
  fmtQty,
  esc,
  company,
  can,
  money,
  balanceLabel,
  panel,
  emptyCompanyScreen,
} from './ui.js';

export function gstDocumentSubtitle(row) {
  const fallback = `${voucherLabel(row.type)} ${row.no}`;
  return row.ref === fallback ? '' : fallback;
}

export function gstScreen() {
  if (!company()) return emptyCompanyScreen('GST');
  const active = company();
  const gst = active.gst ?? {};
  const taxLedgers = gstTaxLedgers(active);
  const current = filters.gst;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const report = gstReturns(active, { from, to });
  const annual = gstAnnualSummary(active, { from: active.fyStart, to: active.fyEnd });
  const totals = ledgerTotals(active, { to });

  const stateOptions = [
    `<option value=""${gst.stateCode ? '' : ' selected'}>Choose a state…</option>`,
    ...GST_STATES.map(
      ([code, name]) =>
        `<option value="${code}"${gst.stateCode === code ? ' selected' : ''}>${code} · ${esc(name)}</option>`,
    ),
  ].join('');

  const ledgerRoleRows = Object.entries(GST_ROLES)
    .map(([role, label]) => {
      const ledger = taxLedgers[role];
      const closing = ledger ? totals.get(ledger.id)?.closing ?? 0 : null;
      return `<tr>
        <td>${label}</td>
        <td>${ledger ? esc(ledger.name) : '<span class="badge overdue">missing</span>'}</td>
        <td class="num">${ledger ? balanceLabel(closing) : '—'}</td>
      </tr>`;
    })
    .join('');

  const editingGstRate = view.editingGstRateId
    ? (gst.rates ?? []).find((rate) => rate.id === view.editingGstRateId) ?? null
    : null;
  const rateRows = (gst.rates ?? [])
    .map((rate) => {
      const used = active.vouchers.filter((voucher) => voucher.gst?.rateId === rate.id).length;
      return `<tr>
        <td><strong>${esc(rate.label)}</strong></td>
        <td class="num">${rate.rate}%</td>
        <td class="num">${rate.cess ? `${rate.cess}%` : '—'}</td>
        <td>${rate.effectiveFrom ? esc(dateLabel(rate.effectiveFrom)) : '<span class="muted">Always</span>'}</td>
        <td class="num">${used}</td>
        <td class="row-actions">
          <button class="btn small" type="button" data-action="edit-gst-rate" data-id="${esc(rate.id)}">Edit</button>
          <button class="btn small danger" type="button" data-action="delete-gst-rate" data-id="${esc(rate.id)}"
            ${used > 0 ? 'disabled' : ''}>Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  const setupPanel = panel(
    'GST registration',
    `<form id="gst-form" class="form-grid" novalidate>
      <label class="field">
        <span>GSTIN</span>
        <input name="gstin" maxlength="15" placeholder="27ABCDE1234F1Z5" value="${esc(gst.gstin ?? '')}">
      </label>
      <label class="field">
        <span>Registered legal name</span>
        <input name="legalName" maxlength="120" placeholder="Optional" value="${esc(gst.legalName ?? '')}">
      </label>
      <label class="field">
        <span>Trade name</span>
        <input name="tradeName" maxlength="120" placeholder="Optional" value="${esc(gst.tradeName ?? '')}">
      </label>
      <label class="field">
        <span>Registered address</span>
        <input name="address" maxlength="200" placeholder="Street, building, area" value="${esc(gst.address ?? '')}">
      </label>
      <label class="field">
        <span>City / location</span>
        <input name="city" maxlength="80" placeholder="Optional" value="${esc(gst.city ?? '')}">
      </label>
      <label class="field">
        <span>PIN code</span>
        <input name="pin" inputmode="numeric" maxlength="6" placeholder="6 digits" value="${esc(gst.pin ?? '')}">
      </label>
      <label class="field">
        <span>Home state</span>
        <select name="stateCode">${stateOptions}</select>
      </label>
      <label class="field gst-check">
        <input type="checkbox" name="enabled"${gst.enabled ? ' checked' : ''}>
        <span>Compute GST on invoices</span>
      </label>
      <div class="field form-actions">
        <button class="btn primary" type="submit">Save GST settings</button>
      </div>
      <p id="gst-error" class="form-error" role="alert"></p>
    </form>
    <p class="muted small">Enabling GST creates or reuses CGST, SGST, IGST and Cess ledgers under Duties &amp; Taxes. The home state decides CGST+SGST versus IGST from the place of supply.</p>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Tax ledger</th><th>Ledger</th><th class="num">Closing (as on ${esc(dateLabel(to))})</th></tr></thead>
      <tbody>${ledgerRoleRows}</tbody>
    </table></div>`,
    gst.enabled
      ? `GST is enabled${gst.gstin ? ` for ${esc(gst.gstin)}` : ''}. Invoice tax is computed on save and posted to the tax ledgers.`
      : 'GST is off. Tax is not computed on vouchers until settings are saved with GST enabled.',
  );

  const ratesPanel = panel(
    `GST rate master <span class="count">${(gst.rates ?? []).length}</span>`,
    `<form id="gst-rate-form" class="inline-form" novalidate>
      <input name="label" maxlength="40" placeholder="Label (optional)" aria-label="GST rate label" value="${esc(editingGstRate?.label ?? '')}">
      <input name="rate" inputmode="decimal" placeholder="Rate %" aria-label="GST rate percent" value="${esc(editingGstRate?.rate ?? '')}" required>
      <input name="cess" inputmode="decimal" placeholder="Cess %" aria-label="Cess percent" value="${esc(editingGstRate?.cess ?? '')}">
      <input name="effectiveFrom" type="date" aria-label="Effective from" value="${esc(editingGstRate?.effectiveFrom ?? '')}">
      <button class="btn small" type="submit">${editingGstRate ? 'Save rate' : 'Add rate'}</button>
      ${editingGstRate ? '<button class="btn small ghost" type="button" data-action="cancel-gst-rate-edit">Cancel</button>' : ''}
      <p id="gst-rate-error" class="form-error" role="alert"></p>
    </form>
    <p class="muted small">A rate is selectable from its effective date onwards. Editing a rate changes future vouchers only; posted vouchers keep the rate they were saved with.</p>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Rate</th><th class="num">GST</th><th class="num">Cess</th><th>Effective from</th><th class="num">Vouchers</th><th></th></tr></thead>
      <tbody>${rateRows}</tbody>
    </table></div>`,
    'One rate applies to the whole invoice. Rates used by vouchers cannot be deleted.',
  );

  const rateTable = report.gstr1.rateRows.length
    ? `<div class="table-scroll" tabindex="0"><table class="data-table compact gst-report-table">
        <thead><tr><th>Rate</th><th class="num">Documents</th><th class="num">Taxable value</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Cess</th></tr></thead>
        <tbody>${report.gstr1.rateRows
          .map(
            (row) => `<tr>
              <td>${esc(gstRateLabel(row.rate, row.cessRate))}</td>
              <td class="num">${row.count}</td>
              <td class="num">${money(row.taxable)}</td>
              <td class="num">${money(row.cgst)}</td>
              <td class="num">${money(row.sgst)}</td>
              <td class="num">${money(row.igst)}</td>
              <td class="num">${money(row.cess)}</td>
            </tr>`,
          )
          .join('')}</tbody>
        <tfoot><tr><td colspan="2">Sales less credit notes</td><td class="num">${money(report.outward.taxable)}</td><td class="num">${money(report.outward.cgst)}</td><td class="num">${money(report.outward.sgst)}</td><td class="num">${money(report.outward.igst)}</td><td class="num">${money(report.outward.cess)}</td></tr></tfoot>
      </table></div>`
    : '<p class="muted">No outward supplies with GST in this period.</p>';

  const b2bTable = report.gstr1.b2b.length
    ? `<h3 class="section-title">B2B invoices <span class="count">${report.gstr1.b2b.length}</span></h3>
      <div class="table-scroll" tabindex="0"><table class="data-table compact gst-report-table">
        <thead><tr><th>Invoice</th><th>Date</th><th>Customer GSTIN</th><th>Place of supply</th><th class="num">Taxable</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Invoice total</th></tr></thead>
        <tbody>${report.gstr1.b2b
          .map(
            (row) => `<tr class="clickable" data-action="open-voucher" data-id="${esc(row.id)}">
              <td><strong>${esc(row.ref)}</strong>${gstDocumentSubtitle(row) ? `<div class="muted small">${esc(gstDocumentSubtitle(row))}</div>` : ''}</td>
              <td>${esc(dateLabel(row.date))}</td>
              <td>${esc(row.partyGstin)}<div class="muted small">${esc(row.party)}</div></td>
              <td>${esc(row.placeOfSupplyName || row.placeOfSupply)}</td>
              <td class="num">${money(row.taxable)}</td>
              <td class="num">${money(row.cgst)}</td>
              <td class="num">${money(row.sgst)}</td>
              <td class="num">${money(row.igst)}</td>
              <td class="num">${money(row.total)}</td>
            </tr>`,
          )
          .join('')}</tbody>
        <tfoot><tr><td colspan="4">${report.gstr1.b2bTotal.count} invoice${report.gstr1.b2bTotal.count === 1 ? '' : 's'}</td><td class="num">${money(report.gstr1.b2bTotal.taxable)}</td><td class="num">${money(report.gstr1.b2bTotal.cgst)}</td><td class="num">${money(report.gstr1.b2bTotal.sgst)}</td><td class="num">${money(report.gstr1.b2bTotal.igst)}</td><td></td></tr></tfoot>
      </table></div>`
    : '';

  const b2cTable = report.gstr1.b2c.length
    ? `<h3 class="section-title">B2C supplies by rate</h3>
      <table class="data-table compact gst-report-table">
        <thead><tr><th>Rate</th><th class="num">Invoices</th><th class="num">Taxable</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Cess</th></tr></thead>
        <tbody>${report.gstr1.b2c
          .map(
            (row) => `<tr><td>${esc(gstRateLabel(row.rate, row.cessRate))}</td><td class="num">${row.count}</td><td class="num">${money(row.taxable)}</td><td class="num">${money(row.cgst)}</td><td class="num">${money(row.sgst)}</td><td class="num">${money(row.igst)}</td><td class="num">${money(row.cess)}</td></tr>`,
          )
          .join('')}</tbody>
        <tfoot><tr><td colspan="2">${report.gstr1.b2cTotal.count} invoice${report.gstr1.b2cTotal.count === 1 ? '' : 's'}</td><td class="num">${money(report.gstr1.b2cTotal.taxable)}</td><td class="num">${money(report.gstr1.b2cTotal.cgst)}</td><td class="num">${money(report.gstr1.b2cTotal.sgst)}</td><td class="num">${money(report.gstr1.b2cTotal.igst)}</td><td class="num">${money(report.gstr1.b2cTotal.cess)}</td></tr></tfoot>
      </table>`
    : '';

  const cdnrTable = report.gstr1.cdnr.length
    ? `<h3 class="section-title">Credit notes <span class="count">${report.gstr1.cdnr.length}</span></h3>
      <div class="table-scroll" tabindex="0"><table class="data-table compact gst-report-table">
        <thead><tr><th>Credit note</th><th>Date</th><th>Customer</th><th>GSTIN</th><th class="num">Taxable</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Total</th></tr></thead>
        <tbody>${report.gstr1.cdnr
          .map(
            (row) => `<tr class="clickable" data-action="open-voucher" data-id="${esc(row.id)}">
              <td><strong>${esc(row.ref)}</strong>${gstDocumentSubtitle(row) ? `<div class="muted small">${esc(gstDocumentSubtitle(row))}</div>` : ''}</td>
              <td>${esc(dateLabel(row.date))}</td>
              <td>${esc(row.party)}</td>
              <td>${row.partyGstin ? esc(row.partyGstin) : '<span class="muted">B2C</span>'}</td>
              <td class="num">${money(row.taxable)}</td>
              <td class="num">${money(row.cgst)}</td>
              <td class="num">${money(row.sgst)}</td>
              <td class="num">${money(row.igst)}</td>
              <td class="num">${money(row.total)}</td>
            </tr>`,
          )
          .join('')}</tbody>
        <tfoot><tr><td colspan="4">Reduces outward supplies</td><td class="num">${money(report.creditNotes.taxable)}</td><td class="num">${money(report.creditNotes.cgst)}</td><td class="num">${money(report.creditNotes.sgst)}</td><td class="num">${money(report.creditNotes.igst)}</td><td></td></tr></tfoot>
      </table></div>`
    : '';

  const hsnRows = report.gstr1.hsn
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.hsn)}</strong>${row.description ? `<div class="muted small">${esc(row.description)}</div>` : ''}</td>
        <td>${esc(row.unit)}</td>
        <td class="num">${fmtQty(row.qty)}</td>
        <td class="num">${money(row.taxable)}</td>
        <td class="num">${money(row.tax)}</td>
      </tr>`,
    )
    .join('');

  const gstr3b = report.gstr3b;
  const gstr3bRow = (label, taxable, heads, total) => `<tr>
    <td>${label}</td>
    <td class="num">${taxable === null ? '' : money(taxable)}</td>
    <td class="num">${money(heads.cgst)}</td>
    <td class="num">${money(heads.sgst)}</td>
    <td class="num">${money(heads.igst)}</td>
    <td class="num">${money(heads.cess)}</td>
    <td class="num">${money(total)}</td>
  </tr>`;

  const reportPanels = `
    ${panel(
      'GSTR-1 · outward supplies',
      `<form id="gst-report-form" class="filter-bar">
        <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
        <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
        <button class="btn small" type="submit">Apply</button>
      </form>
      <div class="ratio-grid">
        <div class="ratio-card"><span class="ratio-label">Outward taxable</span><strong>${money(report.outward.taxable)}</strong><span class="muted small">${report.outward.count} document${report.outward.count === 1 ? '' : 's'} net of credit notes</span></div>
        <div class="ratio-card"><span class="ratio-label">Output tax</span><strong>${money(gstr3b.outwardTaxTotal)}</strong><span class="muted small">CGST + SGST + IGST + cess</span></div>
        <div class="ratio-card"><span class="ratio-label">Input tax credit</span><strong>${money(gstr3b.itcTotal)}</strong><span class="muted small">${money(gstr3b.itcTaxable)} taxable purchases</span></div>
        <div class="ratio-card"><span class="ratio-label">Net payable</span><strong class="${gstr3b.netTotal < 0 ? 'pos' : ''}">${money(gstr3b.netTotal)}</strong><span class="muted small">Negative is credit carried forward</span></div>
      </div>
      ${rateTable}
      ${b2bTable}
      ${b2cTable}
      ${cdnrTable}`,
      `Period ${esc(dateLabel(from))} to ${esc(dateLabel(to))} · ${esc(report.stateName || 'Home state not set')}${report.gstin ? ` · ${esc(report.gstin)}` : ''}. Working papers only — nothing is filed or transmitted.`,
    )}
    ${panel(
      `HSN / SAC summary <span class="count">${report.gstr1.hsn.length}</span>`,
      report.gstr1.hsn.length
        ? `<div class="table-scroll" tabindex="0"><table class="data-table compact">
            <thead><tr><th>HSN / SAC</th><th>UQC</th><th class="num">Quantity</th><th class="num">Taxable</th><th class="num">Tax</th></tr></thead>
            <tbody>${hsnRows}</tbody>
          </table></div>`
        : '<p class="muted">No stock-item invoices with GST in this period. Add an HSN/SAC code to stock items to build this summary.</p>',
      'Outward stock lines only. Tax is apportioned from each invoice rate; quantities are split by unit quantity code (UQC).',
    )}
    ${panel(
      'GSTR-3B · summary return',
      `<div class="table-scroll" tabindex="0"><table class="data-table compact gst-report-table">
        <thead><tr><th>Particulars</th><th class="num">Taxable value</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Cess</th><th class="num">Total tax</th></tr></thead>
        <tbody>
          ${gstr3bRow('3.1(a) Outward taxable supplies (sales less credit notes)', gstr3b.outwardTaxable, gstr3b.outwardTax, gstr3b.outwardTaxTotal)}
          ${gstr3bRow('3.1(d) Inward supplies liable to reverse charge', gstr3b.rcmTaxable, gstr3b.rcmTax, gstr3b.rcmTaxTotal)}
          ${gstr3bRow('4(A)(5) Input tax credit (purchases less debit notes, incl. RCM)', gstr3b.itcTaxable, gstr3b.itc, gstr3b.itcTotal)}
        </tbody>
        <tfoot>
          <tr><td>Total liability (3.1(a) + 3.1(d))</td><td></td><td class="num">${money(gstr3b.liability.cgst)}</td><td class="num">${money(gstr3b.liability.sgst)}</td><td class="num">${money(gstr3b.liability.igst)}</td><td class="num">${money(gstr3b.liability.cess)}</td><td class="num">${money(gstr3b.liabilityTotal)}</td></tr>
          <tr><td>Net tax payable (liability less ITC)</td><td></td><td class="num">${money(gstr3b.net.cgst)}</td><td class="num">${money(gstr3b.net.sgst)}</td><td class="num">${money(gstr3b.net.igst)}</td><td class="num">${money(gstr3b.net.cess)}</td><td class="num">${money(gstr3b.netTotal)}</td></tr>
        </tfoot>
      </table></div>`,
      'A negative head is input credit carried forward. Reverse-charge tax appears in both liability and ITC so it nets to zero on the return.',
    )}
    ${panel(
      `GST vouchers <span class="count">${report.count}</span>`,
      report.documents.length
        ? `<div class="table-scroll" tabindex="0"><table class="data-table compact gst-report-table">
            <thead><tr><th>Date</th><th>Voucher</th><th>Party</th><th>Supply</th><th class="num">Rate</th><th class="num">Taxable</th><th class="num">Tax</th><th class="num">Total</th></tr></thead>
            <tbody>${report.documents
              .map(
                (row) => `<tr class="clickable" data-action="open-voucher" data-id="${esc(row.id)}">
                  <td>${esc(dateLabel(row.date))}</td>
                  <td><strong>${esc(row.ref)}</strong>${gstDocumentSubtitle(row) ? `<div class="muted small">${esc(gstDocumentSubtitle(row))}</div>` : ''}</td>
                  <td>${esc(row.party)}${row.reverseCharge ? ' <span class="badge attention">RCM</span>' : ''}</td>
                  <td class="muted small">${esc(row.supplyType)} · ${esc(row.placeOfSupplyName || row.placeOfSupply)}</td>
                  <td class="num">${esc(gstRateLabel(row.rate, row.cessRate))}</td>
                  <td class="num">${money(row.taxable)}</td>
                  <td class="num">${money(row.taxTotal)}</td>
                  <td class="num">${money(row.total)}</td>
                </tr>`,
              )
              .join('')}</tbody>
          </table></div>`
        : '<p class="muted">No voucher carries GST in this period. Open a sales or purchase voucher, choose a GST rate and save.</p>',
    )}`;

  return `${setupPanel}${ratesPanel}${gst.enabled || report.count ? reportPanels : ''}
    ${panel(
      'GST annual working paper',
      `<table class="data-table compact">
        <thead><tr><th>Month</th><th class="num">Outward taxable</th><th class="num">Output tax</th><th class="num">ITC</th><th class="num">Net tax</th></tr></thead>
        <tbody>${annual.rows.map((row) => `<tr><td>${esc(row.label)}</td><td class="num">${money(row.outwardTaxable)}</td><td class="num">${money(row.outwardTax)}</td><td class="num">${money(row.itc)}</td><td class="num ${row.net < 0 ? 'neg' : ''}">${money(row.net)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Financial year</td><td class="num">${money(annual.totals.outwardTaxable)}</td><td class="num">${money(annual.totals.outwardTax)}</td><td class="num">${money(annual.totals.itc)}</td><td class="num">${money(annual.totals.net)}</td></tr></tfoot>
      </table>`,
      `Monthly GSTR-1/GSTR-3B working totals for ${esc(dateLabel(annual.from))} to ${esc(dateLabel(annual.to))}. This is not GSTR-9, an annual return or a filing.`,
    )}`;
}

export function readinessBadge(ready, label = 'Ready') {
  return ready
    ? `<span class="badge">${esc(label)}</span>`
    : `<span class="badge overdue">Review</span>`;
}

export function issueList(issues, limit = 3) {
  if (!issues.length) return '<span class="muted">—</span>';
  const shown = issues.slice(0, limit).map((issue) => `<div>${esc(issue)}</div>`).join('');
  const more = issues.length > limit ? `<div class="muted small">+${issues.length - limit} more</div>` : '';
  return `<div class="muted small">${shown}${more}</div>`;
}

export function eInvoiceScreen() {
  if (!company()) return emptyCompanyScreen('E-invoice');
  const active = company();
  const current = filters.einvoice;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const report = eInvoiceRegister(active, { from, to });
  const seller = report.seller;
  const sellerIssues = [];
  if (!seller.gstin) sellerIssues.push('GSTIN');
  if (!seller.legalName) sellerIssues.push('legal name');
  if (!seller.address) sellerIssues.push('address');
  if (!seller.city) sellerIssues.push('city');
  if (!seller.pin) sellerIssues.push('PIN');

  const rows = report.rows
    .map((row) => {
      const badge = !row.eligible
        ? '<span class="badge">B2C · not eligible</span>'
        : row.ready
          ? '<span class="badge">ready</span>'
          : `<span class="badge overdue">${row.blockers.length} blocker${row.blockers.length === 1 ? '' : 's'}</span>`;
      return `<tr>
        <td><strong>${esc(row.ref)}</strong><div class="muted small">${esc(dateLabel(row.date))}</div></td>
        <td>${esc(row.buyer.legalName || row.party)}<div class="muted small">${row.buyer.gstin ? esc(row.buyer.gstin) : 'Unregistered / B2C'}</div></td>
        <td>${esc(row.placeOfSupplyName || row.placeOfSupply)}<div class="muted small">${esc(row.supplyType)}</div></td>
        <td class="num">${money(row.taxable)}</td>
        <td class="num">${money(row.total)}</td>
        <td>${badge}</td>
        <td>${issueList([...row.blockers, ...row.warnings])}</td>
        <td class="row-actions">
          <button class="btn small ghost" type="button" data-action="open-voucher" data-id="${esc(row.id)}">Open</button>
          ${row.payload
            ? `<button class="btn small ghost" type="button" data-action="download-einvoice" data-id="${esc(row.id)}">Draft JSON</button>`
            : ''}
        </td>
      </tr>`;
    })
    .join('');

  return `
    ${active.gst?.enabled
      ? ''
      : panel(
          'GST is off',
          `<p class="muted">E-invoice preparation reads the GST registration and invoice tax detail. Enable GST and save a GSTIN first.</p>
           <button class="btn primary" type="button" data-screen="gst">Open GST settings</button>`,
        )}
    ${panel(
      'Seller profile',
      `<div class="ratio-grid">
        <div class="ratio-card"><span class="ratio-label">GSTIN</span><strong>${esc(seller.gstin || 'Not set')}</strong><span class="muted small">${esc(seller.stateCode)} · ${esc(seller.stateName || 'State not set')}</span></div>
        <div class="ratio-card"><span class="ratio-label">Legal name</span><strong>${esc(seller.legalName || 'Not set')}</strong><span class="muted small">${esc(seller.tradeName || 'No trade name')}</span></div>
        <div class="ratio-card"><span class="ratio-label">Address</span><strong>${esc(seller.address || 'Not set')}</strong><span class="muted small">${esc([seller.city, seller.pin].filter(Boolean).join(' · ') || 'City and PIN not set')}</span></div>
        <div class="ratio-card"><span class="ratio-label">Readiness</span><strong>${sellerIssues.length ? `${sellerIssues.length} field${sellerIssues.length === 1 ? '' : 's'} missing` : 'Complete'}</strong><span class="muted small">${sellerIssues.length ? esc(sellerIssues.join(', ')) : 'Seller block can be filled'}</span></div>
      </div>
      <p class="muted small">${esc(report.note)}</p>
      <button class="btn small ghost" type="button" data-screen="gst">Edit GST registration</button>`,
      'These fields feed the draft payload. Buyer address and PIN come from the party ledger.',
    )}
    ${panel(
      'E-invoice register',
      `<form id="einvoice-report-form" class="filter-bar">
        <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
        <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
        <button class="btn small" type="submit">Apply</button>
      </form>
      <div class="ratio-grid">
        <div class="ratio-card"><span class="ratio-label">Sales invoices</span><strong>${report.count}</strong><span class="muted small">${report.b2cCount} B2C</span></div>
        <div class="ratio-card"><span class="ratio-label">B2B eligible</span><strong>${report.eligibleCount}</strong><span class="muted small">${money(report.eligibleValue)} invoice value</span></div>
        <div class="ratio-card"><span class="ratio-label">Ready drafts</span><strong>${report.readyCount}</strong><span class="muted small">${report.blockedCount} need review</span></div>
        <div class="ratio-card"><span class="ratio-label">Sales value</span><strong>${money(report.total)}</strong><span class="muted small">Invoices in this period</span></div>
      </div>
      ${report.rows.length
        ? `<div class="table-scroll" tabindex="0"><table class="data-table compact">
            <thead><tr><th>Invoice</th><th>Buyer</th><th>Place of supply</th><th class="num">Taxable</th><th class="num">Invoice total</th><th>Status</th><th>Readiness notes</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`
        : '<p class="muted">No sales invoices carry GST in this period.</p>'}`,
      'Draft JSON follows the NIC e-invoice field names for review and manual upload. No IRN, QR code or IRP acknowledgement is generated.',
    )}`;
}

export function ewayBillScreen() {
  if (!company()) return emptyCompanyScreen('E-way bill');
  const active = company();
  const current = filters.ewaybill;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const threshold = Number(current.threshold) > 0 ? Number(current.threshold) : 50000;
  const report = ewayBillRegister(active, { from, to, threshold });
  const editVoucher = view.ewayPartBId
    ? active.vouchers.find((voucher) => voucher.id === view.ewayPartBId && voucher.type === 'Sales') ?? null
    : null;
  const editPartB = editVoucher ? active.ewayPartB?.[editVoucher.id] ?? {} : {};
  const partBEditor = editVoucher
    ? `<form id="eway-partb-form" class="eway-partb-form" novalidate>
        <input type="hidden" name="voucherId" value="${esc(editVoucher.id)}">
        <h3>Part B for Sales ${editVoucher.no}</h3>
        <div class="form-grid">
          <label class="field"><span>Transporter name</span><input name="transporterName" maxlength="100" placeholder="Transporter or fleet name" value="${esc(editPartB.transporterName ?? '')}"></label>
          <label class="field"><span>Transporter ID</span><input name="transporterId" maxlength="20" placeholder="GSTIN / TRANSIN (optional)" value="${esc(editPartB.transporterId ?? '')}"></label>
          <label class="field"><span>Vehicle number</span><input name="vehicleNo" maxlength="20" placeholder="e.g. MH12AB1234" value="${esc(editPartB.vehicleNo ?? '')}"></label>
          <label class="field"><span>Distance (km)</span><input name="distance" inputmode="numeric" placeholder="e.g. 240" value="${esc(editPartB.distance ?? '')}"></label>
        </div>
        <p class="muted small">Part B needs a transporter, a distance and either a vehicle number or transporter ID for readiness. Values are saved with this invoice as working data.</p>
        <div class="form-actions">
          <button class="btn primary" type="submit">Save Part B</button>
          ${editPartB.transporterName || editPartB.transporterId || editPartB.vehicleNo || editPartB.distance
            ? '<button class="btn ghost" type="button" data-action="clear-eway-partb" data-id="' + esc(editVoucher.id) + '">Remove Part B</button>'
            : ''}
          <button class="btn ghost" type="button" data-action="cancel-eway-partb">Cancel</button>
        </div>
        <p id="eway-partb-error" class="form-error" role="alert"></p>
      </form>`
    : '';
  const rows = report.rows
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.ref)}</strong><div class="muted small nowrap">${esc(dateLabel(row.date))}</div></td>
        <td>${esc(row.buyer.legalName || row.party)}<div class="muted small">${row.buyer.gstin ? esc(row.buyer.gstin) : 'URP'} · ${esc(row.buyer.stateName || row.buyer.stateCode || 'State not set')}</div></td>
        <td class="num">${money(row.taxable)}</td>
        <td class="num">${money(row.total)}</td>
        <td><span class="badge${row.ready ? '' : ' overdue'}">Part A ${row.ready ? 'ready' : 'review'}</span> <span class="badge${row.partBReady ? '' : ' overdue'}">Part B ${row.partBReady ? 'ready' : 'gap'}</span></td>
        <td>${issueList(row.warnings)}</td>
        <td class="row-actions">
          <button class="btn small ghost" type="button" data-action="open-voucher" data-id="${esc(row.id)}">Open</button>
          <button class="btn small ghost" type="button" data-action="edit-eway-partb" data-id="${esc(row.id)}">Part B</button>
          <button class="btn small ghost" type="button" data-action="download-ewaybill" data-id="${esc(row.id)}">JSON</button>
        </td>
      </tr>`,
    )
    .join('');

  return panel(
    'E-way bill register',
    `${partBEditor}
    <form id="ewaybill-report-form" class="filter-bar">
      <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
      <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
      <label class="field inline-field"><span>Minimum invoice value</span><input name="threshold" inputmode="decimal" value="${esc(threshold)}"></label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    <div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Consignments</span><strong>${report.count}</strong><span class="muted small">At or above ${money(report.threshold)}</span></div>
      <div class="ratio-card"><span class="ratio-label">Invoice value</span><strong>${money(report.value)}</strong><span class="muted small">Outward sales in this period</span></div>
      <div class="ratio-card"><span class="ratio-label">Part A ready</span><strong>${report.rows.filter((row) => row.ready).length}</strong><span class="muted small">Seller and buyer state captured</span></div>
      <div class="ratio-card"><span class="ratio-label">Part B ready</span><strong>${report.rows.filter((row) => row.partBReady).length}</strong><span class="muted small">${report.rows.length - report.rows.filter((row) => row.partBReady).length} gap${report.rows.length - report.rows.filter((row) => row.partBReady).length === 1 ? '' : 's'}</span></div>
    </div>
    ${report.rows.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact">
          <thead><tr><th>Invoice</th><th>Consignee / destination</th><th class="num">Taxable</th><th class="num">Invoice total</th><th>Status</th><th>Notes</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : `<p class="muted">No outward invoice at or above ${money(report.threshold)} in this period.</p>`}
    <p class="muted small">${esc(report.note)} The default threshold is ₹50,000; change it only when a different state or goods rule applies.</p>`,
    'Part A is derived from the invoice and Part B is saved working data. The JSON is a portal draft; nothing is submitted, signed or acknowledged.',
  );
}

function addIsoDays(iso, days) {
  const date = new Date(Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)) + days,
  ));
  return date.toISOString().slice(0, 10);
}

export function complianceScreen() {
  if (!company()) return emptyCompanyScreen('Compliance');
  const active = company();
  const today = todayIso();
  const soon = addIsoDays(today, 7);
  const tasks = [...(active.complianceTasks ?? [])];
  const editing = view.complianceTaskId
    ? tasks.find((task) => task.id === view.complianceTaskId) ?? null
    : null;
  const sorted = tasks.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Open' ? -1 : 1;
    return a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title);
  });
  const open = tasks.filter((task) => task.status === 'Open');
  const overdue = open.filter((task) => task.dueDate < today);
  const dueSoon = open.filter((task) => task.dueDate >= today && task.dueDate <= soon);
  const done = tasks.filter((task) => task.status === 'Done');

  const categoryOptions = ['GST', 'TDS', 'Payroll', 'Other']
    .map((category) => `<option value="${category}"${(editing?.category ?? 'Other') === category ? ' selected' : ''}>${category}</option>`)
    .join('');
  const taskForm = `<form id="compliance-task-form" class="form-grid compliance-task-form" novalidate>
    <input type="hidden" name="taskId" value="${esc(editing?.id ?? '')}">
    <label class="field"><span>Task</span><input name="title" maxlength="100" placeholder="e.g. File GSTR-3B for April" value="${esc(editing?.title ?? '')}"></label>
    <label class="field"><span>Category</span><select name="category">${categoryOptions}</select></label>
    <label class="field"><span>Due date</span><input name="dueDate" type="date" value="${esc(editing?.dueDate ?? view.complianceDueDate ?? '')}"></label>
    <div class="field form-actions"><button class="btn small ghost" type="button" data-action="suggest-compliance-date">Suggest next due date</button></div>
    <label class="field"><span>Notes</span><input name="notes" maxlength="200" placeholder="Optional working note" value="${esc(editing?.notes ?? '')}"></label>
    <label class="field"><span>Filed on (optional)</span><input name="filedOn" type="date" value="${esc(editing?.filedOn ?? '')}"></label>
    <label class="field"><span>Acknowledgement / reference</span><input name="reference" maxlength="80" placeholder="Portal reference or ARN" value="${esc(editing?.reference ?? '')}"></label>
    <div class="form-actions">
      <button class="btn primary" type="submit">${editing ? 'Update task' : 'Add task'}</button>
      ${editing ? '<button class="btn ghost" type="button" data-action="cancel-compliance-task">Cancel</button>' : ''}
    </div>
    <p id="compliance-task-error" class="form-error" role="alert"></p>
  </form>`;

  const rows = sorted
    .map((task) => {
      const isDone = task.status === 'Done';
      const late = !isDone && task.dueDate < today;
      const near = !isDone && !late && task.dueDate <= soon;
      return `<tr>
        <td><span class="badge${isDone ? '' : late ? ' overdue' : near ? ' attention' : ''}">${isDone ? 'Done' : late ? 'Overdue' : near ? 'Due soon' : 'Open'}</span></td>
        <td><strong>${esc(task.title)}</strong>${task.notes ? `<div class="muted small">${esc(task.notes)}</div>` : ''}${task.reference ? `<div class="muted small">Ref ${esc(task.reference)}</div>` : ''}</td>
        <td>${esc(task.category)}</td>
        <td>${esc(dateLabel(task.dueDate))}${task.filedOn ? `<div class="muted small">Filed ${esc(dateLabel(task.filedOn))}</div>` : ''}</td>
        <td class="row-actions">
          <button class="btn small ghost" type="button" data-action="edit-compliance-task" data-id="${esc(task.id)}">Edit</button>
          <button class="btn small ghost" type="button" data-action="toggle-compliance-task" data-id="${esc(task.id)}">${isDone ? 'Reopen' : 'Mark done'}</button>
          <button class="btn small danger" type="button" data-action="delete-compliance-task" data-id="${esc(task.id)}">Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  return panel(
    'Compliance calendar',
    `${taskForm}
    <div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Open</span><strong>${open.length}</strong><span class="muted small">${overdue.length} overdue · ${dueSoon.length} due within 7 days</span></div>
      <div class="ratio-card"><span class="ratio-label">Completed</span><strong>${done.length}</strong><span class="muted small">Kept for filing history</span></div>
    </div>
    ${sorted.length
      ? `<table class="data-table compact">
          <thead><tr><th>Status</th><th>Task</th><th>Category</th><th>Due date</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : '<p class="muted">No compliance tasks yet. Add GST, TDS, payroll or other filing reminders above.</p>'}`,
    'Tasks are your own reminders and filing notes. The app does not calculate statutory due dates, file returns or store acknowledgements.',
  );
}

export function taxAuditScreen() {
  if (!company()) return emptyCompanyScreen('Tax audit');
  const active = company();
  const current = filters.taxAudit;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const report = taxAuditSummary(active, { from, to });
  const turnover = report.turnover;
  const outputTax = report.outputTax;
  const itc = report.itc;
  const tds = report.taxPosition.tds;
  const tcs = report.taxPosition.tcs;

  const turnoverRows = [
    ['Sales accounts (books)', turnover.books, 'Net credit movement in Sales Accounts'],
    ['GST outward taxable', turnover.gstTaxable, 'GSTR-1 taxable value net of credit notes'],
    ['Difference', turnover.difference, 'Books less GST outward taxable'],
    ['Other direct income', turnover.otherIncome, 'Direct Incomes ledgers, outside GST turnover'],
    ['GST invoice gross', turnover.gstGross, 'Taxable plus output tax'],
  ]
    .map(
      ([label, value, note]) => `<tr><td>${esc(label)}<div class="muted small">${esc(note)}</div></td><td class="num">${money(value)}</td></tr>`,
    )
    .join('');

  const taxRows = [
    ['Output tax', outputTax.books, outputTax.returns, outputTax.difference],
    ['Input tax credit', itc.books, itc.returns, itc.difference],
    ['Net payable', round2(outputTax.books - itc.books), round2(outputTax.returns - itc.returns), round2(outputTax.difference - itc.difference)],
  ]
    .map(
      ([label, books, returns, diff]) => `<tr><td>${esc(label)}</td><td class="num">${money(books)}</td><td class="num">${money(returns)}</td><td class="num">${money(diff)}</td></tr>`,
    )
    .join('');

  const clauseRows = report.clauses
    .map(
      (clause) => `<tr>
        <td><strong>${esc(clause.clause)}</strong></td>
        <td>${esc(clause.title)}<div class="muted small">${esc(clause.description)}</div></td>
        <td>${clause.status === 'Ready'
          ? '<span class="badge">ready</span>'
          : clause.status === 'Review'
            ? '<span class="badge attention">review</span>'
            : '<span class="badge overdue">manual</span>'}</td>
        <td class="muted small">${esc(clause.evidence)}</td>
      </tr>`,
    )
    .join('');

  return `
    ${panel(
      'Tax audit position',
      `<form id="taxaudit-report-form" class="filter-bar">
        <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
        <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
        <button class="btn small" type="submit">Apply</button>
      </form>
      <div class="ratio-grid">
        <div class="ratio-card"><span class="ratio-label">Books turnover</span><strong>${money(turnover.books)}</strong><span class="muted small">${esc(turnover.status)}</span></div>
        <div class="ratio-card"><span class="ratio-label">GST outward taxable</span><strong>${money(turnover.gstTaxable)}</strong><span class="muted small">GSTR-1 working paper</span></div>
        <div class="ratio-card"><span class="ratio-label">Turnover difference</span><strong class="${Math.abs(turnover.difference) >= 1 ? 'neg' : ''}">${money(turnover.difference)}</strong><span class="muted small">Books less GST</span></div>
        <div class="ratio-card"><span class="ratio-label">Tax audit threshold</span><strong>${money(turnover.threshold)}</strong><span class="muted small">₹10 crore high threshold also flagged</span></div>
      </div>
      <p class="muted small">${esc(report.note)}</p>`,
      'Reconciliations use posted vouchers only. Tax-audit applicability and every Form 3CD disclosure need professional review.',
    )}
    ${panel(
      'Turnover reconciliation',
      `<div class="table-scroll" tabindex="0"><table class="data-table compact">
        <thead><tr><th>Particulars</th><th class="num">Amount</th></tr></thead>
        <tbody>${turnoverRows}</tbody>
      </table></div>`,
      'A difference can be legitimate: non-GST sales, timing, or a sales ledger outside Sales Accounts. Investigate before signing.',
    )}
    ${panel(
      'GST liability and ITC reconciliation',
      `<div class="table-scroll" tabindex="0"><table class="data-table compact">
        <thead><tr><th>Particulars</th><th class="num">Books / ledgers</th><th class="num">GSTR-3B</th><th class="num">Difference</th></tr></thead>
        <tbody>${taxRows}</tbody>
      </table></div>`,
      'Books figures are net movements on GST-role ledgers. GSTR-3B figures come from the same voucher tax detail, so a difference points to manual tax journals or missing ledger tags.',
    )}
    ${panel(
      'TDS / TCS position',
      `<div class="table-scroll" tabindex="0"><table class="data-table compact">
        <thead><tr><th>Tax</th><th class="num">Deducted / collected</th><th class="num">Challans in period</th><th class="num">Outstanding to date</th></tr></thead>
        <tbody>
          <tr><td>TDS</td><td class="num">${money(tds.deducted)}</td><td class="num">${money(tds.paid)}</td><td class="num">${money(tds.outstanding)}</td></tr>
          <tr><td>TCS</td><td class="num">${money(tcs.collected)}</td><td class="num">${money(tcs.paid)}</td><td class="num">${money(tcs.outstanding)}</td></tr>
        </tbody>
      </table></div>`,
      'Outstanding is computed to the period end from all vouchers and challans, not just this period.',
    )}
    ${panel(
      `Form 3CD-style checklist <span class="count">${report.clauses.length}</span>`,
      `<div class="ratio-grid">
        <div class="ratio-card"><span class="ratio-label">Ready</span><strong>${report.clauseSummary.ready}</strong><span class="muted small">Data present</span></div>
        <div class="ratio-card"><span class="ratio-label">Review</span><strong>${report.clauseSummary.review}</strong><span class="muted small">Reconcile before use</span></div>
        <div class="ratio-card"><span class="ratio-label">Manual</span><strong>${report.clauseSummary.manual}</strong><span class="muted small">Documents outside the app</span></div>
      </div>
      <div class="table-scroll" tabindex="0"><table class="data-table compact">
        <thead><tr><th>Clause</th><th>Disclosure</th><th>Status</th><th>Evidence / action</th></tr></thead>
        <tbody>${clauseRows}</tbody>
      </table></div>`,
      'Checklist only: clause numbers are a guide to Form 3CD, not a filed return or an audit opinion.',
    )}`;
}

export function tdsScreen() {
  if (!company()) return emptyCompanyScreen('TDS / TCS');
  const active = company();
  const tds = active.tds ?? {};
  const kind = filters.tds.kind === 'TCS' ? 'TCS' : 'TDS';
  const from = filters.tds.from || active.fyStart;
  const to = filters.tds.to || active.fyEnd;
  const report = withholdingSummary(active, { kind, from, to });
  const certificates = withholdingCertificates(active, { kind, from, to });
  const totals = ledgerTotals(active, { to });
  const ledgers = withholdingTaxLedgers(active);
  const kindNoun = kind === 'TDS' ? 'deducted' : 'collected';
  const sections = tds.sections ?? [];
  const kindSections = sections.filter((section) => section.kind === kind);

  const ledgerRows = ['TDS', 'TCS']
    .map((role) => {
      const ledger = ledgers[role];
      const closing = ledger ? totals.get(ledger.id)?.closing ?? 0 : null;
      return `<tr>
        <td>${role === 'TDS' ? 'TDS Payable' : 'TCS Payable'}</td>
        <td>${ledger ? esc(ledger.name) : '<span class="badge overdue">missing</span>'}</td>
        <td class="num">${ledger ? balanceLabel(closing) : '—'}</td>
      </tr>`;
    })
    .join('');

  const setupPanel = panel(
    'TDS / TCS registration',
    `<form id="tds-form" class="form-grid" novalidate>
      <label class="field">
        <span>TAN</span>
        <input name="tan" maxlength="10" placeholder="MUMA12345B" value="${esc(tds.tan ?? '')}">
      </label>
      <label class="field gst-check">
        <input type="checkbox" name="enabled"${tds.enabled ? ' checked' : ''}>
        <span>Deduct TDS and collect TCS on vouchers</span>
      </label>
      <div class="field form-actions">
        <button class="btn primary" type="submit">Save TDS/TCS settings</button>
      </div>
      <p id="tds-error" class="form-error" role="alert"></p>
    </form>
    <p class="muted small">Enabling TDS/TCS creates or reuses TDS Payable and TCS Payable ledgers under Duties &amp; Taxes. Deductions post to those ledgers; nothing is filed with the department.</p>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
      <thead><tr><th>Tax ledger</th><th>Ledger</th><th class="num">Closing (as on ${esc(dateLabel(to))})</th></tr></thead>
      <tbody>${ledgerRows}</tbody>
    </table></div>`,
    tds.enabled
      ? `TDS/TCS is enabled${tds.tan ? ` for TAN ${esc(tds.tan)}` : ''}.`
      : 'TDS/TCS is off. Vouchers cannot deduct tax until settings are saved with it enabled.',
  );

  const editingSection = view.editingTdsSectionId
    ? sections.find((section) => section.id === view.editingTdsSectionId) ?? null
    : null;
  const sectionRows = sections
    .map((section) => {
      const used = active.vouchers.filter((voucher) => voucher.tds?.sectionId === section.id).length;
      return `<tr>
        <td><span class="badge">${esc(section.kind)}</span></td>
        <td><strong>${esc(section.code)}</strong></td>
        <td class="muted">${esc(section.label)}</td>
        <td class="num">${section.rate}%</td>
        <td class="num">${section.threshold ? money(section.threshold) : '—'}</td>
        <td class="num">${used}</td>
        <td class="row-actions">
          <button class="btn small" type="button" data-action="edit-tds-section" data-id="${esc(section.id)}">Edit</button>
          <button class="btn small danger" type="button" data-action="delete-tds-section" data-id="${esc(section.id)}"
            ${used > 0 ? 'disabled' : ''}>Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  const sectionsPanel = panel(
    `Section master <span class="count">${sections.length}</span>`,
    `<form id="tds-section-form" class="inline-form" novalidate>
      <select name="kind" aria-label="Section kind"${editingSection ? ' disabled' : ''}>
        <option value="TDS"${(editingSection?.kind ?? kind) === 'TDS' ? ' selected' : ''}>TDS</option>
        <option value="TCS"${(editingSection?.kind ?? kind) === 'TCS' ? ' selected' : ''}>TCS</option>
      </select>
      <input name="code" maxlength="12" placeholder="Section code" aria-label="Section code" value="${esc(editingSection?.code ?? '')}"${editingSection ? ' disabled' : ''} required>
      <input name="label" maxlength="60" placeholder="Description (optional)" aria-label="Section description" value="${esc(editingSection?.label ?? '')}">
      <input name="rate" inputmode="decimal" placeholder="Rate %" aria-label="Section rate" value="${esc(editingSection?.rate ?? '')}" required>
      <input name="threshold" inputmode="decimal" placeholder="Threshold" aria-label="Section threshold" value="${esc(editingSection?.threshold ?? '')}">
      <button class="btn small" type="submit">${editingSection ? 'Save section' : 'Add section'}</button>
      ${editingSection ? '<button class="btn small ghost" type="button" data-action="cancel-tds-section-edit">Cancel</button>' : ''}
      <p id="tds-section-error" class="form-error" role="alert"></p>
    </form>
    <p class="muted small">Editing a section changes future deductions only; posted vouchers keep their saved section rate.</p>
    <div class="table-scroll" tabindex="0"><table class="data-table compact tds-report-table">
      <thead><tr><th>Kind</th><th>Code</th><th>Description</th><th class="num">Rate</th><th class="num">Threshold</th><th class="num">Vouchers</th><th></th></tr></thead>
      <tbody>${sectionRows}</tbody>
    </table></div>`,
    'Rates and thresholds are local working parameters. A section used by a voucher cannot be deleted.',
  );

  const challanRows = report.challans
    .map(
      (challan) => `<tr>
        <td>${esc(dateLabel(challan.date))}</td>
        <td>${challan.reference ? `<strong>${esc(challan.reference)}</strong>` : '<span class="muted">—</span>'}</td>
        <td class="muted small">${esc(challan.section)}</td>
        <td class="muted small">${esc(challan.bsrCode || '')}</td>
        <td class="num">${money(challan.amount)}</td>
        <td class="row-actions">
          <button class="btn small danger" type="button" data-action="delete-challan" data-id="${esc(challan.id)}">Delete</button>
        </td>
      </tr>`,
    )
    .join('');
  const challanSectionOptions = [
    `<option value="">Not linked</option>`,
    ...kindSections.map((section) => `<option value="${esc(section.id)}">${esc(section.code)} · ${esc(section.label)}</option>`),
  ].join('');

  const challanPanel = panel(
    'Tax challans',
    `<form id="tax-challan-form" class="inline-form" novalidate>
      <select name="kind" aria-label="Challan kind">
        <option value="TDS"${kind === 'TDS' ? ' selected' : ''}>TDS</option>
        <option value="TCS"${kind === 'TCS' ? ' selected' : ''}>TCS</option>
      </select>
      <input name="date" type="date" aria-label="Challan date" value="${esc(todayIso())}" required>
      <input name="amount" inputmode="decimal" placeholder="Amount" aria-label="Challan amount" required>
      <input name="reference" maxlength="40" placeholder="Challan reference" aria-label="Challan reference">
      <input name="bsrCode" maxlength="20" placeholder="BSR code" aria-label="BSR code">
      <select name="sectionId" aria-label="Challan section">${challanSectionOptions}</select>
      <button class="btn small" type="submit">Add challan</button>
      <p id="challan-error" class="form-error" role="alert"></p>
    </form>
    ${report.challans.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact">
          <thead><tr><th>Date</th><th>Reference</th><th>Section</th><th>BSR</th><th class="num">Amount</th><th></th></tr></thead>
          <tbody>${challanRows}</tbody>
          <tfoot><tr><td colspan="4">${report.challans.length} challan${report.challans.length === 1 ? '' : 's'} in this period</td><td class="num">${money(report.challanTotal)}</td><td></td></tr></tfoot>
        </table></div>`
      : '<p class="muted">No challans in this period.</p>'}`,
    'Challans record payments against the payable ledger for tracking only; they do not post a voucher or reconcile automatically.',
  );

  const reportRows = report.documents
    .map(
      (row) => `<tr class="clickable" data-action="open-voucher" data-id="${esc(row.id)}">
        <td>${esc(dateLabel(row.date))}</td>
        <td><strong>${esc(row.ref)}</strong>${gstDocumentSubtitle(row) ? `<div class="muted small">${esc(gstDocumentSubtitle(row))}</div>` : ''}</td>
        <td>${esc(row.party)}<div class="muted small">${row.pan ? esc(row.pan) : 'No PAN'}</div></td>
        <td><strong>${esc(row.code)}</strong><div class="muted small">${esc(row.label)}</div></td>
        <td class="num">${row.rate}%</td>
        <td class="num">${money(row.base)}</td>
        <td class="num">${money(row.amount)}</td>
        <td class="muted small">${esc(row.quarter)}</td>
      </tr>`,
    )
    .join('');

  const sectionSummary = report.sections
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.code)}</strong></td>
        <td class="muted">${esc(row.label)}</td>
        <td class="num">${row.rate}%</td>
        <td class="num">${row.count}</td>
        <td class="num">${money(row.base)}</td>
        <td class="num">${money(row.amount)}</td>
      </tr>`,
    )
    .join('');

  const partySummary = report.parties
    .map(
      (row) => `<tr>
        <td>${esc(row.party)}</td>
        <td class="muted small">${row.pan ? esc(row.pan) : 'No PAN'}</td>
        <td class="num">${row.count}</td>
        <td class="num">${money(row.base)}</td>
        <td class="num">${money(row.amount)}</td>
      </tr>`,
    )
    .join('');

  const quarterRows = report.quarters
    .map(
      (row) => `<tr>
        <td>${esc(row.label)}</td>
        <td class="num">${row.count}</td>
        <td class="num">${money(row.base)}</td>
        <td class="num">${money(row.amount)}</td>
      </tr>`,
    )
    .join('');

  const thresholdRows = report.thresholdRows
    .map(
      (row) => `<tr class="${row.crossed && row.threshold ? 'overdue-row' : ''}">
        <td><strong>${esc(row.code)}</strong><div class="muted small">${esc(row.label)}</div></td>
        <td class="num">${row.rate}%</td>
        <td class="num">${row.threshold ? money(row.threshold) : '—'}</td>
        <td class="num">${money(row.base)}</td>
        <td>${row.threshold ? (row.crossed ? '<span class="badge overdue">crossed</span>' : '<span class="muted small">below</span>') : '<span class="muted small">no threshold</span>'}</td>
      </tr>`,
    )
    .join('');

  const reportPanels = `
    ${panel(
      `${kind} register`,
      `<form id="tds-report-form" class="filter-bar">
        <label class="field inline-field"><span>Show</span>
          <select name="kind">
            <option value="TDS"${kind === 'TDS' ? ' selected' : ''}>TDS deducted</option>
            <option value="TCS"${kind === 'TCS' ? ' selected' : ''}>TCS collected</option>
          </select>
        </label>
        <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
        <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
        <button class="btn small" type="submit">Apply</button>
      </form>
      <div class="ratio-grid">
        <div class="ratio-card"><span class="ratio-label">${kind} ${kindNoun} in period</span><strong>${money(report.periodAmount)}</strong><span class="muted small">${report.count} voucher${report.count === 1 ? '' : 's'} on ${money(report.periodBase)}</span></div>
        <div class="ratio-card"><span class="ratio-label">Payable to date</span><strong>${money(report.payableToDate)}</strong><span class="muted small">All ${kind} up to ${esc(dateLabel(to))}</span></div>
        <div class="ratio-card"><span class="ratio-label">Challans paid</span><strong>${money(report.paidToDate)}</strong><span class="muted small">${report.challans.length} in this period</span></div>
        <div class="ratio-card"><span class="ratio-label">Outstanding</span><strong class="${report.outstanding > 0 ? 'neg' : 'pos'}">${money(report.outstanding)}</strong><span class="muted small">Payable less challans to date</span></div>
      </div>
      ${report.sections.length
        ? `<h3 class="section-title">Section summary</h3>
          <div class="table-scroll" tabindex="0"><table class="data-table compact tds-report-table">
            <thead><tr><th>Section</th><th>Description</th><th class="num">Rate</th><th class="num">Vouchers</th><th class="num">Base</th><th class="num">${kind}</th></tr></thead>
            <tbody>${sectionSummary}</tbody>
            <tfoot><tr><td colspan="3">Total</td><td class="num">${report.count}</td><td class="num">${money(report.periodBase)}</td><td class="num">${money(report.periodAmount)}</td></tr></tfoot>
          </table></div>`
        : '<p class="muted">No tax deducted or collected in this period.</p>'}
      ${report.parties.length
        ? `<h3 class="section-title">Party summary</h3>
          <div class="table-scroll" tabindex="0"><table class="data-table compact tds-report-table">
            <thead><tr><th>Party</th><th>PAN</th><th class="num">Vouchers</th><th class="num">Base</th><th class="num">${kind}</th></tr></thead>
            <tbody>${partySummary}</tbody>
          </table></div>`
        : ''}
      <h3 class="section-title">Quarterly totals</h3>
      <table class="data-table compact tds-report-table">
        <thead><tr><th>Quarter</th><th class="num">Vouchers</th><th class="num">Base</th><th class="num">${kind}</th></tr></thead>
        <tbody>${quarterRows}</tbody>
      </table>
      <h3 class="section-title">Threshold watch · this financial year to date</h3>
      <div class="table-scroll" tabindex="0"><table class="data-table compact tds-report-table">
        <thead><tr><th>Section</th><th class="num">Rate</th><th class="num">Threshold</th><th class="num">Base to date</th><th>Status</th></tr></thead>
        <tbody>${thresholdRows}</tbody>
      </table></div>
      ${report.documents.length
        ? `<h3 class="section-title">${kind} vouchers</h3>
          <div class="table-scroll" tabindex="0"><table class="data-table compact tds-report-table">
            <thead><tr><th>Date</th><th>Voucher</th><th>Party</th><th>Section</th><th class="num">Rate</th><th class="num">Base</th><th class="num">${kind}</th><th>Quarter</th></tr></thead>
            <tbody>${reportRows}</tbody>
          </table></div>`
        : ''}`,
      `Period ${esc(dateLabel(from))} to ${esc(dateLabel(to))}${report.tan ? ` · TAN ${esc(report.tan)}` : ''}. Working papers only — deductions, thresholds and challans are tracked locally and nothing is filed.`,
    )}`;

  return `${setupPanel}${sectionsPanel}${challanPanel}${tds.enabled || report.count ? reportPanels : ''}
    ${panel(
      `${kind} certificate working paper`,
      certificates.rows.length
        ? `<table class="data-table compact">
            <thead><tr><th>Deductee</th><th>PAN</th><th>Quarter</th><th>Sections</th><th class="num">Vouchers</th><th class="num">Base</th><th class="num">${kind}</th></tr></thead>
            <tbody>${certificates.rows.map((row) => `<tr><td>${esc(row.party)}</td><td>${row.pan ? esc(row.pan) : '<span class="badge overdue">missing PAN</span>'}</td><td>${esc(row.quarterLabel)}</td><td>${esc(row.sections)}</td><td class="num">${row.count}</td><td class="num">${money(row.base)}</td><td class="num">${money(row.amount)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="5">Total</td><td class="num">${money(certificates.totals.base)}</td><td class="num">${money(certificates.totals.amount)}</td></tr></tfoot>
          </table>`
        : '<p class="muted">No deductor/collector entries in this period.</p>',
      `Deductee-and-quarter totals for preparing Form 16A/27D-style certificates${certificates.tan ? ` under TAN ${esc(certificates.tan)}` : ''}. No certificate is generated, signed or filed.`,
    )}`;
}


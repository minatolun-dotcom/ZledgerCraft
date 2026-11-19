// ZledgerCraft - screen renderers and screen-specific helpers.
// This module reads the live UI state exported by ui.js.
// ZledgerCraft - keyboard-first UI: gateway, masters, vouchers and reports.
import {
  GST_ROLES,
  GST_STATES,
  GST_TAXABLE_SIDE,
  INVENTORY_TYPES,
  USER_ROLES,
  VOUCHER_TYPES,
  activeCompany,
  activeUser,
  addBom,
  addBudget,
  addCurrency,
  addCurrencyRate,
  addUser,
  addCompany,
  addCostCategory,
  addCostCentre,
  addEmployee,
  addGodown,
  addOrder,
  addPayHead,
  auditEntries,
  addFinancialYear,
  booksStart,
  addGstRate,
  addGroup,
  addLedger,
  addManufacture,
  addStockGroup,
  addStockTransfer,
  addTaxChallan,
  addStockItem,
  addTdsSection,
  addUnit,
  addVoucher,
  autoMatchBank,
  allocationsAgainst,
  billLabel,
  clearBankStatement,
  closeFinancialYear,
  costCentreUsage,
  dateLabel,
  defaultFyStart,
  defaultGodownId,
  deleteBom,
  deleteBudget,
  deleteCompany,
  deleteCurrency,
  deleteCostCategory,
  deleteCostCentre,
  deleteEmployee,
  deleteGodown,
  deleteGstRate,
  deleteOrder,
  deleteGroup,
  deletePayHead,
  deletePayrollRun,
  deleteTaxChallan,
  deleteLedger,
  deleteManufacture,
  deleteStockGroup,
  deleteStockItem,
  deleteStockTransfer,
  deleteTdsSection,
  deleteUnit,
  deleteUser,
  deleteVoucher,
  exportState,
  fmtMoney,
  groupById,
  gstRateLabel,
  gstStateName,
  gstTaxLedgers,
  emptyState,
  importState,
  isPartyLedger,
  ledgerOptions,
  loadState,
  normalizeAudit,
  parseAmount,
  parseQty,
  partyOpenBills,
  payrollLedgers,
  payrollMonthEnd,
  rateForCurrency,
  reopenFinancialYear,
  recordAudit,
  round2,
  runPayroll,
  saveBankStatement,
  saveGstSettings,
  savePayrollSettings,
  saveState,
  saveTdsSettings,
  selectYear,
  setBankMatch,
  setCurrentUser,
  setOrderStatus,
  signedOpening,
  todayIso,
  updateCompany,
  updateEmployee,
  updateGroup,
  updateLedger,
  updateStockItem,
  updateVoucher,
  unsetBankMatch,
  withholdingTaxLedgers,
} from './store.js';
import {
  AGE_BUCKETS,
  amountInWords,
  balanceSheet,
  bankReconciliation,
  batchStockSummary,
  billWiseRegister,
  budgetVsActual,
  cashBankBook,
  cashBankLedgers,
  cashFlow,
  costCentreBreakup,
  costCentreSummary,
  dashboard,
  dayBook,
  eInvoiceRegister,
  ewayBillRegister,
  forexRevaluation,
  godownStockSummary,
  groupSummary,
  gstReturns,
  groupVouchers,
  groupChainKeys,
  inGroupKey,
  ledgerStatement,
  ledgerTotals,
  outstanding,
  partyStatement,
  payrollSummary,
  postDatedRegister,
  primaryKeyOf,
  profitAndLoss,
  ratioAnalysis,
  statistics,
  stockMovements,
  taxAuditSummary,
  yearComparison,
  stockSummary,
  trialBalance,
  voucherRegister,
  voucherSummary,
  withholdingSummary,
} from './accounting.js';
import { importTallyXml } from './tally.js';
import { buildXlsx, xlsxToCsv } from './xlsx.js';
import { serverUsersPanel } from './ui-server.js';
import {
  AUDIT_ACTION_LABELS,
  HOTKEYS,
  REPORT_SCREENS,
  REPORT_TITLES,
  SCREEN_TITLES,
  SERVER_EVENT_LABELS,
  VISIBLE_H1_SCREENS,
} from './ui-constants.js';

import {
  SNAPSHOT_KEY,
  SNAPSHOT_LIMIT,
  inlineLedger,
  WORKSPACE_KEY,
  state,
  workspaceMode,
  workspaceQueue,
  workspaceRev,
  workspaceUpdatedAt,
  workspaceStorage,
  workspaceRemote,
  workspaceWatchTimer,
  authRequired,
  authUser,
  authInfo,
  authAccounts,
  serverBackups,
  serverBackupInfo,
  reportSettings,
  authLoginEvents,
  authSessions,
  authApiTokens,
  serverAuditRows,
  serverAuditChain,
  serverAuditEvents,
  serverEventChain,
  view,
  draft,
  flash,
  flashTimer,
  filters,
  voucherLabel,
  fmtQty,
  esc,
  company,
  ROLE_PERMISSIONS,
  currentProfile,
  roleLabel,
  can,
  requirePermission,
  authWarningHtml,
  renderLogin,
  workspaceAvailable,
  workspaceRequested,
  queueWorkspaceSave,
  persist,
  workspaceBannerHtml,
  refreshWorkspaceBanner,
  stopWorkspaceWatch,
  startWorkspaceWatch,
  logAudit,
  mergeAuditEntries,
  applyRestoredState,
  voucherAuditLabel,
  setFlash,
  money,
  balanceLabel,
  navigate,
  requireCompany,
  ledgerNameById,
  ledgerIdByName,
  ledgerDatalistHtml,
  groupSelectOptions,
  reportPeriod,
  periodBar,
  asOnBar,
  groupParentOptions,
  costCentreSelectOptions,
  bankLedgerSelectOptions,
  suggestedLedger,
  voucherFormLines,
  prepareDraft,
  openVoucher,
  openAlter,
  duplicateVoucher,
  orderToVoucher,
  formLines,
  formBill,
  formInstrument,
  formGst,
  formTds,
  tdsVoucherBlock,
  gstVoucherBlock,
  captureDraft,
  readVoucherForm,
  stockItemSelectOptions,
  godownSelectOptions,
  itemLineAmount,
  gstTaxableValue,
  tdsBaseValue,
  updateVoucherTotals,
  headerHtml,
  asideHtml,
  footerHtml,
  flashHtml,
  roleBannerHtml,
  screenTitle,
  auditActionLabel,
  reportPeriodLabel,
  reportToolbarHtml,
  printHeaderHtml,
  panel,
  emptyCompanyScreen,
  kpisHtml,
  screenHtml,
  render,
  filterLedgerRows,
  showFormError,
  submitPayload,
  handleSubmit,
  csvCell,
  downloadJsonFile,
  reportExportData,
  exportReportCsv,
  exportReportXlsx,
  resetPeriodFilters,
  handleChange,
  ledgerRefreshTimer,
  previewRestore,
  handleInput,
  SCREEN_KEYS,
  VOUCHER_KEYS,
  handleKeydown,
} from './ui.js';

export function gatewayScreen() {
  const active = company();
  const stats = active ? dashboard(active) : null;
  const types = Object.entries(VOUCHER_TYPES)
    .map(
      ([type, meta]) => `
      <button type="button" class="type-card" data-action="new-voucher" data-type="${type}"${can('voucher.write') ? '' : ' disabled'}>
        <span class="type-name">${meta.label}</span>
        <span class="type-blurb">${meta.blurb}</span>
        <kbd>${meta.shortcut}</kbd>
      </button>`,
    )
    .join('');

  return `
    <div class="hero">
      <div>
        <h1>Gateway of ZledgerCraft</h1>
        <p class="muted">Double-entry bookkeeping with a keyboard-first workflow. Esc always returns here.</p>
      </div>
      ${stats
        ? `<div class="hero-stats">
            <div><span>Cash</span><strong>${money(stats.cash)}</strong></div>
            <div><span>Bank</span><strong>${money(stats.bank)}</strong></div>
            <div><span>Net P&amp;L</span><strong class="${stats.netProfit < 0 ? 'neg' : ''}">${money(stats.netProfit)}</strong></div>
          </div>`
        : ''}
    </div>
    ${stats ? kpisHtml(stats) : ''}
    ${active
      ? `<div class="type-grid">${types}</div>`
      : `<section class="panel">
          <h2>Start a company</h2>
          <p class="muted">ZledgerCraft keeps everything in your browser. Nothing leaves this machine.</p>
          <button class="btn primary" type="button" data-screen="companies">Create a company <kbd>F3</kbd></button>
        </section>`}
    <div class="gateway-columns">
      <section class="panel">
        <h3>Masters &amp; reports</h3>
        <div class="link-list">
          <button type="button" class="link-row" data-screen="masters"><span>Ledgers &amp; groups</span><kbd>K</kbd></button>
          <button type="button" class="link-row" data-screen="daybook"><span>Day Book</span><kbd>D</kbd></button>
          <button type="button" class="link-row" data-screen="ledgerPick"><span>Ledger vouchers</span><kbd>L</kbd></button>
          <button type="button" class="link-row" data-screen="inventory"><span>Stock summary</span><kbd>I</kbd></button>
          <button type="button" class="link-row" data-screen="trial"><span>Trial Balance</span><kbd>T</kbd></button>
          <button type="button" class="link-row" data-screen="pnl"><span>Profit &amp; Loss</span><kbd>P</kbd></button>
          <button type="button" class="link-row" data-screen="balanceSheet"><span>Balance Sheet</span><kbd>B</kbd></button>
          <button type="button" class="link-row" data-screen="cashBank"><span>Cash &amp; Bank Book</span><kbd>C</kbd></button>
          <button type="button" class="link-row" data-screen="bankRecon"><span>Bank reconciliation</span><span class="muted small">Match</span></button>
          <button type="button" class="link-row" data-screen="postDated"><span>Cheque / DD register</span><span class="muted small">Instruments</span></button>
          <button type="button" class="link-row" data-screen="costCentres"><span>Cost centre summary</span><span class="muted small">Costs</span></button>
          <button type="button" class="link-row" data-screen="budgets"><span>Budget vs Actual</span><span class="muted small">Plan</span></button>
          <button type="button" class="link-row" data-screen="forex"><span>Forex Revaluation</span><span class="muted small">Currency</span></button>
          <button type="button" class="link-row" data-screen="gst"><span>GST returns</span><span class="muted small">Tax</span></button>
          <button type="button" class="link-row" data-screen="tds"><span>TDS / TCS register</span><span class="muted small">Tax</span></button>
          <button type="button" class="link-row" data-screen="payroll"><span>Payroll &amp; payslips</span><span class="muted small">Salary</span></button>
          <button type="button" class="link-row" data-screen="registers"><span>Sales &amp; purchase registers</span><kbd>R</kbd></button>
          <button type="button" class="link-row" data-screen="outstanding"><span>Receivables &amp; payables</span><kbd>O</kbd></button>
          <button type="button" class="link-row" data-screen="billRegister"><span>Bill-wise register</span><span class="muted small">Bills</span></button>
          <button type="button" class="link-row" data-screen="partyStatement"><span>Party statement</span><span class="muted small">Account</span></button>
          <button type="button" class="link-row" data-screen="groupSummary"><span>Group Summary</span><kbd>G</kbd></button>
          <button type="button" class="link-row" data-screen="yearComparison"><span>Year comparison</span><span class="muted small">FY</span></button>
          <button type="button" class="link-row" data-screen="audit"><span>Audit trail</span><span class="muted small">Log</span></button>
          <button type="button" class="link-row" data-screen="cashFlow"><span>Cash Flow</span><kbd>F</kbd></button>
          <button type="button" class="link-row" data-screen="ratios"><span>Ratio Analysis</span><kbd>Y</kbd></button>
          <button type="button" class="link-row" data-screen="statistics"><span>Statistics</span><kbd>S</kbd></button>
        </div>
      </section>
      <section class="panel">
        <h3>How it works</h3>
        <ol class="steps">
          <li>Create a company with its financial year.</li>
          <li>Add ledgers under the standard accounting groups.</li>
          <li>Enter balanced vouchers — every debit needs a credit.</li>
          <li>Read the day book, ledger, trial balance, P&amp;L and balance sheet.</li>
        </ol>
      </section>
    </div>`;
}

export function financialYearsPanel(active) {
  const years = active.years ?? [];
  const rows = years
    .map((year) => {
      const count = active.vouchers.filter(
        (voucher) => voucher.date >= year.start && voucher.date <= year.end,
      ).length;
      const selected = year.id === active.yearId;
      return `<tr class="${selected ? 'selected' : ''}">
        <td><strong>${esc(dateLabel(year.start))} – ${esc(dateLabel(year.end))}</strong>${selected ? ' <span class="badge">selected</span>' : ''}</td>
        <td>${year.closed ? '<span class="badge">closed</span>' : '<span class="badge">open</span>'}</td>
        <td class="num">${count}</td>
        <td class="row-actions">
          <button class="btn small" type="button" data-action="select-year" data-id="${esc(year.id)}"
            ${selected ? 'disabled' : ''}>View</button>
          ${can('year.manage')
            ? year.closed
              ? `<button class="btn small" type="button" data-action="reopen-year" data-id="${esc(year.id)}">Reopen</button>`
              : `<button class="btn small" type="button" data-action="close-year" data-id="${esc(year.id)}">Close year</button>`
            : ''}
        </td>
      </tr>`;
    })
    .join('');

  return panel(
    `Financial years <span class="count">${years.length}</span>`,
    `<p class="muted">Reports and new vouchers use the year selected in the header. Closing a year locks its vouchers; the next year is created automatically.</p>
    <div class="table-scroll" tabindex="0"><table class="data-table compact year-table">
      <thead><tr><th>Year</th><th>Status</th><th class="num">Vouchers</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="form-actions">
      ${can('year.manage') ? '<button class="btn small" type="button" data-action="add-year">Add next financial year</button>' : ''}
      <button class="btn small" type="button" data-screen="yearComparison">Compare years</button>
    </div>`,
    'Closing keeps every voucher; balances carry forward into the new year automatically.',
  );
}

export function serverCompanyChecks(selectedIds = null) {
  const checked = selectedIds === null ? null : new Set(selectedIds);
  return (state.companies ?? [])
    .map((company) => {
      const isChecked = checked === null || checked.has(company.id);
      return `<label class="check-item"><input type="checkbox" name="companyIds" value="${esc(company.id)}" ${isChecked ? 'checked' : ''}> <span>${esc(company.name)}</span></label>`;
    })
    .join('');
}

export function serverScopeLabel(account) {
  if (account.role === 'owner' || account.companyIds === null) return 'All companies';
  if (!account.companyIds?.length) return 'No companies';
  const names = account.companyIds.map((id) =>
    (state.companies ?? []).find((company) => company.id === id)?.name,
  );
  const visible = names.filter(Boolean);
  const missing = names.length - visible.length;
  return `${visible.length ? visible.join(', ') : 'No current companies'}${missing ? ` (+${missing} unavailable)` : ''}`;
}

export function serverScopeEditor(account) {
  if (account.role === 'owner') return '<span class="muted small">Owners always have every company.</span>';
  const selected = account.companyIds;
  const mode = selected === null ? 'all' : selected.length ? 'selected' : 'none';
  const options = [
    ['all', 'All companies (including future)'],
    ['selected', 'Selected companies'],
    ['none', 'No companies'],
  ];
  return `<details class="scope-editor">
    <summary>${esc(serverScopeLabel(account))}</summary>
    <form data-server-scope="true" data-id="${esc(account.id)}" data-username="${esc(account.username)}">
      <label class="field"><span>Access</span><select name="scopeMode">${options
        .map(([value, label]) => `<option value="${value}" ${mode === value ? 'selected' : ''}>${esc(label)}</option>`)
        .join('')}</select></label>
      <div class="check-grid">${serverCompanyChecks(selected)}</div>
      <button class="btn small primary" type="submit">Save access</button>
    </form>
  </details>`;
}

export function usersPanel() {
  if (authRequired) {
    return serverUsersPanel({
      accounts: authAccounts,
      authUser,
      USER_ROLES,
      roleLabel,
      esc,
      serverScopeEditor,
      serverCompanyChecks,
      authSessions,
      apiTokens: authApiTokens,
      companies: state.companies ?? [],
      serverAuditRows,
      serverAuditChain,
      SERVER_EVENT_LABELS,
      serverAuditEvents,
      serverEventChain,
      serverBackups,
      serverBackupInfo,
      reportSettings,
      authLoginEvents,
      neonAuth: Boolean(authInfo?.neonAuth),
      postgres: Boolean(authInfo?.postgres),
      panel,
    });
  }
  const users = state.users ?? [];
  const ownerCount = users.filter((user) => user.role === 'owner').length;
  const rows = users
    .map((user) => {
      const isCurrent = user.id === state.currentUserId;
      const lastOwner = user.role === 'owner' && ownerCount <= 1;
      return `<tr class=\"${isCurrent ? 'selected' : ''}\">
        <td><strong>${esc(user.name)}</strong>${isCurrent ? ' <span class=\"badge\">active</span>' : ''}</td>
        <td><span class=\"badge\">${esc(roleLabel(user.role))}</span></td>
        <td class=\"muted small\">${esc(USER_ROLES[user.role]?.blurb ?? '')}</td>
        <td class=\"row-actions\">
          <button class=\"btn small danger\" type=\"button\" data-action=\"delete-user\" data-id=\"${esc(user.id)}\"
            ${isCurrent || lastOwner ? 'disabled' : ''}>Remove</button>
        </td>
      </tr>`;
    })
    .join('');

  return panel(
    `Users & access <span class=\"count\">${users.length}</span>`,
    `<p class=\"muted\">Owner can manage companies, years, users and restores. Accountant can manage vouchers and masters. Viewer is read-only. Profiles are access control, not authentication — anyone with this browser can switch users.</p>
    <form id=\"user-form\" class=\"form-grid\" novalidate>
      <label class=\"field\">
        <span>Profile name</span>
        <input name=\"name\" maxlength=\"80\" placeholder=\"e.g. Priya\" required>
      </label>
      <label class=\"field\">
        <span>Role</span>
        <select name=\"role\">
          ${Object.entries(USER_ROLES)
            .map(([role, meta]) => `<option value=\"${esc(role)}\">${esc(meta.label)}</option>`)
            .join('')}
        </select>
      </label>
      <div class=\"field form-actions\">
        <button class=\"btn primary\" type=\"submit\">Add profile</button>
      </div>
      <p id=\"user-error\" class=\"form-error\" role=\"alert\"></p>
    </form>
    <div class=\"table-scroll\"><table class=\"data-table compact\">
      <thead><tr><th>Profile</th><th>Role</th><th>Access</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`,
    'Add a profile, then switch it from the User selector in the header.',
  );
}

export function companiesScreen() {
  const rows = state.companies
    .map((item) => {
      const isActive = item.id === state.activeCompanyId;
      return `<tr class="${isActive ? 'selected' : ''}">
        <td><strong>${esc(item.name)}</strong>${isActive ? ' <span class="badge">open</span>' : ''}</td>
        <td>${esc(dateLabel(item.fyStart))} – ${esc(dateLabel(item.fyEnd))}</td>
        <td class="num">${item.ledgers.length}</td>
        <td class="num">${item.vouchers.length}</td>
        <td class="row-actions">
          ${can('company.manage')
            ? `<button class="btn small" type="button" data-action="edit-company" data-id="${esc(item.id)}">Edit</button>
               <button class="btn small danger" type="button" data-action="delete-company" data-id="${esc(item.id)}">Delete</button>`
            : ''}
          ${isActive ? '' : `<button class="btn small" type="button" data-action="select-company" data-id="${esc(item.id)}">Switch to</button>`}
        </td>
      </tr>`;
    })
    .join('');

  const editingCompany = view.editingCompanyId
    ? state.companies.find((item) => item.id === view.editingCompanyId) ?? null
    : null;

  return `
    ${editingCompany
      ? panel(
          `Alter company · ${esc(editingCompany.name)}`,
          `<form id="company-edit-form" class="form-grid" novalidate>
            <label class="field">
              <span>Company name</span>
              <input name="name" maxlength="80" value="${esc(editingCompany.name)}" required>
            </label>
            ${(editingCompany.years?.length ?? 1) <= 1 && editingCompany.vouchers.length === 0
              ? `<label class="field">
                  <span>Financial year begins</span>
                  <input name="fyStart" type="date" value="${esc(editingCompany.years?.[0]?.start ?? editingCompany.fyStart)}" required>
                </label>`
              : `<input type="hidden" name="fyStart" value="${esc(editingCompany.fyStart)}">`}
            <label class="field inline-field"><input type="checkbox" name="requireApproval" ${editingCompany.approvalsRequired ? 'checked' : ''}> <span>Require owner approval for staff vouchers</span></label>
            <div class="field form-actions">
              <button class="btn primary" type="submit">Save company</button>
              <button class="btn ghost" type="button" data-action="cancel-company-edit">Cancel</button>
            </div>
            <p id="company-error" class="form-error" role="alert"></p>
          </form>`,
          'Manage additional years in the Financial years panel.',
        )
      : ''}
    ${can('company.manage')
      ? panel(
          'Create company',
          `<form id="company-form" class="form-grid" novalidate>
            <label class="field">
              <span>Company name</span>
              <input name="name" maxlength="80" placeholder="e.g. ZledgerCraft Traders" required autofocus>
            </label>
            <label class="field">
              <span>Financial year begins</span>
              <input name="fyStart" type="date" value="${esc(defaultFyStart())}" required>
            </label>
            <div class="field form-actions">
              <button class="btn primary" type="submit">Create company</button>
            </div>
            <p id="form-error" class="form-error" role="alert"></p>
          </form>`,
        )
      : ''}
    ${panel(
      `Companies <span class="count">${state.companies.length}</span>`,
      state.companies.length
        ? `<div class="table-scroll" tabindex="0"><table class="data-table companies-table">
            <thead><tr><th>Company</th><th>Financial year</th><th class="num">Ledgers</th><th class="num">Vouchers</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`
        : '<p class="muted">No companies yet. Create one above.</p>',
    )}
    ${company() ? financialYearsPanel(company()) : ''}
    ${can('user.manage') ? usersPanel() : ''}
    ${panel(
      'Backup & restore',
      `<p class="muted">Download every company as JSON, or restore a previous backup. Restoring replaces what is currently stored in this browser.</p>
       <div class="form-actions">
         <button class="btn" type="button" data-screen="backup">Open backup & restore</button>
       </div>`,
    )}`;
}

export function budgetTargetOptions(active, selected = '') {
  const groups = [...active.groups].sort((a, b) => a.name.localeCompare(b.name));
  const ledgers = [...active.ledgers].sort((a, b) => a.name.localeCompare(b.name));
  return `<option value="">Choose a ledger or group…</option>
    <optgroup label="Groups">${groups
      .map((group) => `<option value="group:${esc(group.id)}"${selected === `group:${group.id}` ? ' selected' : ''}>${esc(group.name)}</option>`)
      .join('')}</optgroup>
    <optgroup label="Ledgers">${ledgers
      .map((ledger) => `<option value="ledger:${esc(ledger.id)}"${selected === `ledger:${ledger.id}` ? ' selected' : ''}>${esc(ledger.name)}</option>`)
      .join('')}</optgroup>`;
}

export function budgetMastersPanel(active) {
  const budgets = [...(active.budgets ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const years = [...(active.years ?? [])].sort((a, b) => b.start.localeCompare(a.start));
  const rows = budgets
    .map((budget) => {
      const target =
        budget.targetType === 'group'
          ? active.groups.find((group) => group.id === budget.targetId)
          : active.ledgers.find((ledger) => ledger.id === budget.targetId);
      const year = (active.years ?? []).find((item) => item.id === budget.yearId);
      return `<tr>
        <td><strong>${esc(budget.name)}</strong></td>
        <td>${esc(target?.name ?? 'Missing target')}</td>
        <td class="muted">${budget.targetType === 'group' ? 'Group' : 'Ledger'} · ${esc(year ? dateLabel(year.start) : 'Missing year')}</td>
        <td class="num">${money(budget.amount)}</td>
        <td class="row-actions">
          <button class="btn small danger" type="button" data-action="delete-budget" data-id="${esc(budget.id)}">Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  return panel(
    `Budgets <span class="count">${budgets.length}</span>`,
    `<p class="muted">Create one annual budget per ledger or group. Actuals are measured from the start of the selected financial year to the as-on date in Budget vs Actual.</p>
    <form id="budget-form" class="form-grid" novalidate>
      <label class="field">
        <span>Budget name</span>
        <input name="name" maxlength="80" placeholder="Optional, e.g. FY marketing budget">
      </label>
      <label class="field">
        <span>Budget for</span>
        <select name="target" required>${budgetTargetOptions(active)}</select>
      </label>
      <label class="field">
        <span>Financial year</span>
        <select name="yearId" required>${years
          .map((year) => `<option value="${esc(year.id)}"${year.id === active.yearId ? ' selected' : ''}>${esc(dateLabel(year.start))} – ${esc(dateLabel(year.end))}</option>`)
          .join('')}</select>
      </label>
      <label class="field narrow">
        <span>Amount</span>
        <input name="amount" inputmode="decimal" placeholder="0.00" required>
      </label>
      <div class="field form-actions">
        <button class="btn primary" type="submit">Add budget</button>
      </div>
      <p id="budget-error" class="form-error" role="alert"></p>
    </form>
    ${budgets.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact budget-table">
          <thead><tr><th>Budget</th><th>Target</th><th>Year</th><th class="num">Amount</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No budgets yet. Add one above, then open Budget vs Actual.</p>'}`,
  );
}

export function costCentreMastersPanel(active) {
  const categories = active.costCategories ?? [];
  const centres = active.costCentres ?? [];
  const categoryRows = categories
    .map((category) => {
      const count = centres.filter((centre) => centre.categoryId === category.id).length;
      return `<tr>
        <td><strong>${esc(category.name)}</strong></td>
        <td class="num">${count}</td>
        <td class="row-actions">
          <button class="btn small danger" type="button" data-action="delete-cost-category" data-id="${esc(category.id)}"
            ${count > 0 || categories.length <= 1 ? 'disabled' : ''}>Delete</button>
        </td>
      </tr>`;
    })
    .join('');
  const centreRows = centres
    .map((centre) => {
      const category = categories.find((item) => item.id === centre.categoryId);
      const used = costCentreUsage(active, centre.id);
      return `<tr>
        <td><strong>${esc(centre.name)}</strong></td>
        <td class="muted">${esc(category?.name ?? 'Unknown')}</td>
        <td class="num">${used}</td>
        <td class="row-actions">
          <button class="btn small danger" type="button" data-action="delete-cost-centre" data-id="${esc(centre.id)}"
            ${used > 0 ? 'disabled' : ''}>Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  return panel(
    `Cost centres <span class="count">${centres.length}</span>`,
    `<p class="muted">Group cost centres by category, then choose one on any voucher line. Unallocated lines stay outside cost-centre reports.</p>
    <div class="split-grid">
      <div>
        <h3 class="column-title">Cost categories</h3>
        <form id="cost-category-form" class="inline-form" novalidate>
          <input name="name" maxlength="80" placeholder="e.g. Departments" required>
          <button class="btn small" type="submit">Add category</button>
        </form>
        <p id="cost-category-error" class="form-error" role="alert"></p>
        <table class="data-table compact">
          <thead><tr><th>Category</th><th class="num">Centres</th><th></th></tr></thead>
          <tbody>${categoryRows}</tbody>
        </table>
      </div>
      <div>
        <h3 class="column-title">Cost centres</h3>
        <form id="cost-centre-form" class="inline-form" novalidate>
          <input name="name" maxlength="80" placeholder="e.g. Sales team" required>
          <select name="categoryId" aria-label="Cost category">
            ${categories.map((category) => `<option value="${esc(category.id)}">${esc(category.name)}</option>`).join('')}
          </select>
          <button class="btn small" type="submit">Add centre</button>
        </form>
        <p id="cost-centre-error" class="form-error" role="alert"></p>
        ${centres.length
          ? `<table class="data-table compact">
              <thead><tr><th>Cost centre</th><th>Category</th><th class="num">Used</th><th></th></tr></thead>
              <tbody>${centreRows}</tbody>
            </table>`
          : '<p class="muted">No cost centres yet. Create one above and assign it to voucher lines.</p>'}
      </div>
    </div>`,
  );
}

export function currencyMastersPanel(active) {
  const currencies = active.currencies ?? [];
  const rows = currencies
    .map((currency) => {
      const latest = currency.rates?.[currency.rates.length - 1];
      const used = (active.vouchers ?? []).filter((voucher) => voucher.currencyCode === currency.code).length;
      return `<tr>
        <td><strong>${esc(currency.code)}</strong> <span class="muted">${esc(currency.symbol)}</span></td>
        <td>${esc(currency.name)}</td>
        <td class="num">${latest ? `${money(latest.rate)}<div class="muted small">${esc(dateLabel(latest.date))}</div>` : '—'}</td>
        <td class="num">${currency.rates?.length ?? 0}</td>
        <td class="num">${used}</td>
        <td class="row-actions">
          <button class="btn small danger" type="button" data-action="delete-currency" data-id="${esc(currency.id)}"
            ${used > 0 ? 'disabled title="Used by vouchers"' : ''}>Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  return panel(
    `Currencies <span class="count">${currencies.length}</span>`,
    `<p class="muted">INR is the base currency and every report stays in INR. Add a foreign currency with a dated exchange rate, then choose it on a voucher. Rates are INR per one unit of the foreign currency.</p>
    <div class="split-grid">
      <div>
        <h3 class="column-title">Add foreign currency</h3>
        <form id="currency-form" class="form-grid" novalidate>
          <label class="field"><span>Code</span>
            <input name="code" maxlength="5" placeholder="USD" required autocapitalize="characters">
          </label>
          <label class="field"><span>Name</span>
            <input name="name" maxlength="60" placeholder="US Dollar" required>
          </label>
          <label class="field"><span>Symbol</span>
            <input name="symbol" maxlength="8" placeholder="$">
          </label>
          <label class="field"><span>Rate date</span>
            <input name="date" type="date" value="${esc(todayIso())}" required>
          </label>
          <label class="field"><span>Rate in INR</span>
            <input name="rate" inputmode="decimal" placeholder="83.00" required>
          </label>
          <div class="field form-actions"><button class="btn primary" type="submit">Add currency</button></div>
          <p id="currency-error" class="form-error" role="alert"></p>
        </form>
      </div>
      <div>
        <h3 class="column-title">Add a dated rate</h3>
        ${currencies.length
          ? `<form id="currency-rate-form" class="form-grid" novalidate>
              <label class="field"><span>Currency</span>
                <select name="code" required>${currencies.map((currency) => `<option value="${esc(currency.code)}">${esc(currency.code)} · ${esc(currency.name)}</option>`).join('')}</select>
              </label>
              <label class="field"><span>Rate date</span>
                <input name="date" type="date" value="${esc(todayIso())}" required>
              </label>
              <label class="field"><span>Rate in INR</span>
                <input name="rate" inputmode="decimal" placeholder="83.00" required>
              </label>
              <div class="field form-actions"><button class="btn" type="submit">Save rate</button></div>
              <p id="currency-rate-error" class="form-error" role="alert"></p>
            </form>
            <p class="muted small">A voucher uses the latest rate dated on or before the voucher date.</p>`
          : '<p class="muted">Add a currency first, then keep its rates current here.</p>'}
      </div>
    </div>
    ${currencies.length
      ? `<table class="data-table compact">
          <thead><tr><th>Code</th><th>Name</th><th class="num">Latest rate</th><th class="num">Rates</th><th class="num">Vouchers</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : '<p class="muted">No foreign currencies yet.</p>'}`,
  );
}

export function mastersScreen() {
  if (!company()) return emptyCompanyScreen('Masters');
  const active = company();
  const totals = ledgerTotals(active);
  const editingLedger = view.editingLedgerId
    ? active.ledgers.find((ledger) => ledger.id === view.editingLedgerId) ?? null
    : null;
  const editingGroup = view.editingGroupId
    ? active.groups.find((group) => group.id === view.editingGroupId) ?? null
    : null;
  const groups = new Map();
  for (const ledger of ledgerOptions(active)) {
    const primary = primaryKeyOf(active, ledger.groupId);
    if (!groups.has(primary)) groups.set(primary, []);
    groups.get(primary).push(ledger);
  }

  const sections = [...groups.entries()]
    .map(([primary, ledgers]) => {
      const title = active.groups.find((group) => group.key === primary)?.name ?? primary;
      const body = ledgers
        .map((ledger) => {
          const closing = totals.get(ledger.id)?.closing ?? 0;
          return `<tr>
            <td>${esc(ledger.name)}</td>
            <td class="muted">${esc(ledger.groupName)}</td>
            <td class="num">${balanceLabel(signedOpening(ledger))}</td>
            <td class="num ${closing < 0 ? 'neg' : ''}">${balanceLabel(closing)}</td>
            <td class="row-actions">
              <button class="btn small" type="button" data-action="edit-ledger" data-id="${esc(ledger.id)}">Edit</button>
              <button class="btn small danger" type="button" data-action="delete-ledger" data-id="${esc(ledger.id)}">Delete</button>
            </td>
          </tr>`;
        })
        .join('');
      return `<tr class="group-row"><td colspan="5">${esc(title)}</td></tr>${body}`;
    })
    .join('');

  const defaultGroup = active.groups.find((group) => group.key === 'sundryDebtors')?.id ?? '';
  const parentDefault = active.groups.find((group) => group.key === 'indirectExpenses')?.id ?? '';
  const customGroups = active.groups.filter((group) => group.custom);
  const customRows = customGroups
    .map((group) => {
      const parent = group.parentId ? active.groups.find((item) => item.id === group.parentId) : null;
      const count = active.ledgers.filter((ledger) => ledger.groupId === group.id).length;
      return `<tr>
        <td><strong>${esc(group.name)}</strong></td>
        <td class="muted">${esc(parent?.name ?? '—')}</td>
        <td class="muted">${esc(group.nature)}</td>
        <td class="num">${count}</td>
        <td class="row-actions">
          <button class="btn small" type="button" data-action="edit-group" data-id="${esc(group.id)}">Edit</button>
          <button class="btn small danger" type="button" data-action="delete-group" data-id="${esc(group.id)}">Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  return `
    ${panel(
      editingLedger ? `Alter ledger · ${esc(editingLedger.name)}` : 'New ledger',
      `<form id="ledger-form" class="form-grid" novalidate>
        <label class="field">
          <span>Ledger name</span>
          <input name="name" maxlength="80" placeholder="e.g. Sharma Traders" required
            value="${esc(editingLedger?.name ?? '')}">
        </label>
        <label class="field">
          <span>Under group</span>
          <select name="groupId" required>${groupSelectOptions(editingLedger?.groupId ?? defaultGroup)}</select>
        </label>
        <label class="field">
          <span>Opening balance</span>
          <input name="opening" inputmode="decimal" placeholder="0.00"
            value="${editingLedger ? esc(String(editingLedger.opening)) : ''}">
        </label>
        <label class="field narrow">
          <span>Dr / Cr</span>
          <select name="openingType">
            <option${editingLedger?.openingType === 'Cr' ? '' : ' selected'}>Dr</option>
            <option${editingLedger?.openingType === 'Cr' ? ' selected' : ''}>Cr</option>
          </select>
        </label>
        ${active.gst?.enabled
          ? `<label class="field">
              <span>GSTIN (party)</span>
              <input name="gstin" maxlength="15" placeholder="Optional B2B GSTIN" value="${esc(editingLedger?.gstin ?? '')}">
            </label>
            <label class="field">
              <span>GST state</span>
              <select name="stateCode">
                <option value=""${editingLedger?.stateCode ? '' : ' selected'}>Not set</option>
                ${GST_STATES.map(
                  ([code, name]) =>
                    `<option value="${code}"${editingLedger?.stateCode === code ? ' selected' : ''}>${code} · ${esc(name)}</option>`,
                ).join('')}
              </select>
            </label>
            <label class="field">
              <span>Party address</span>
              <input name="address" maxlength="200" placeholder="Optional, for e-invoice" value="${esc(editingLedger?.address ?? '')}">
            </label>
            <label class="field">
              <span>Party city / location</span>
              <input name="city" maxlength="80" placeholder="Optional" value="${esc(editingLedger?.city ?? '')}">
            </label>
            <label class="field">
              <span>Party PIN code</span>
              <input name="pin" inputmode="numeric" maxlength="6" placeholder="6 digits" value="${esc(editingLedger?.pin ?? '')}">
            </label>`
          : ''}
        ${active.tds?.enabled
          ? `<label class="field">
              <span>PAN (party)</span>
              <input name="pan" maxlength="10" placeholder="Optional deductee PAN" value="${esc(editingLedger?.pan ?? '')}">
            </label>`
          : ''}
        <div class="field form-actions">
          <button class="btn primary" type="submit">${editingLedger ? 'Save ledger' : 'Create ledger'}</button>
          ${editingLedger ? '<button class="btn ghost" type="button" data-action="cancel-ledger-edit">Cancel</button>' : ''}
        </div>
        <p id="form-error" class="form-error" role="alert"></p>
      </form>`,
      'Opening balances must net to zero across all ledgers for a balanced trial balance.',
    )}
    ${panel(
      `Groups <span class="count">${active.groups.length}</span>`,
      `<div class="report-grid">
        <div>
          <h3 class="column-title">${editingGroup ? `Alter group · ${esc(editingGroup.name)}` : 'New custom group'}</h3>
          <form id="group-form" class="form-grid" novalidate>
            <label class="field">
              <span>Group name</span>
              <input name="name" maxlength="80" placeholder="e.g. Shop Expenses" required
                value="${esc(editingGroup?.name ?? '')}">
            </label>
            <label class="field">
              <span>Under</span>
              <select name="parentId" required>${groupParentOptions(editingGroup?.parentId ?? parentDefault, editingGroup?.id)}</select>
            </label>
            <div class="field form-actions">
              <button class="btn primary" type="submit">${editingGroup ? 'Save group' : 'Create group'}</button>
              ${editingGroup ? '<button class="btn ghost" type="button" data-action="cancel-group-edit">Cancel</button>' : ''}
            </div>
            <p id="group-error" class="form-error" role="alert"></p>
          </form>
        </div>
        <div>
          ${customGroups.length
            ? `<table class="data-table compact">
                <thead><tr><th>Custom group</th><th>Under</th><th>Nature</th><th class="num">Ledgers</th><th></th></tr></thead>
                <tbody>${customRows}</tbody>
              </table>`
            : '<p class="muted">No custom groups yet. Create one to group ledgers your own way.</p>'}
        </div>
      </div>`,
      'Standard groups cannot be moved or deleted; custom groups can sit under any group.',
    )}
    ${costCentreMastersPanel(active)}
    ${budgetMastersPanel(active)}
    ${currencyMastersPanel(active)}
    ${panel(
      `Ledger masters <span class="count">${active.ledgers.length}</span>`,
      `<table class="data-table compact">
        <thead><tr><th>Ledger</th><th>Group</th><th class="num">Opening</th><th class="num">Closing</th><th></th></tr></thead>
        <tbody>${sections}</tbody>
      </table>`,
    )}`;
}

function pendingVouchersPanel(active) {
  const pending = active.pendingVouchers ?? [];
  if (!active.approvalsRequired && !pending.length) return '';
  const rows = pending
    .slice()
    .reverse()
    .map((voucher) => {
      const own = Boolean(authUser?.id && voucher.submittedBy?.id === authUser.id);
      const pendingStatus = voucher.status === 'pending';
      return `<tr>
        <td>${esc(dateLabel(voucher.date))}</td>
        <td><strong>${esc(voucherLabel(voucher.type))}</strong><br><span class="muted small">${esc(voucher.narration || 'No narration')}</span></td>
        <td class="num">${money(voucher.total)}</td>
        <td>${esc(voucher.submittedBy?.name || voucher.submittedBy?.username || 'Unknown')}</td>
        <td>${pendingStatus ? 'Pending' : 'Rejected'}${voucher.rejectionNote ? `<br><span class="muted small">${esc(voucher.rejectionNote)}</span>` : ''}</td>
        <td class="row-actions">${
          pendingStatus
            ? own
              ? `<span class="muted small">${can('voucher.approve') ? 'Awaiting another owner' : 'Awaiting owner'}</span>
                 ${can('voucher.write') ? `<button class="btn small" type="button" data-action="edit-pending-voucher" data-id="${esc(voucher.id)}">Edit</button>
                 <button class="btn small danger" type="button" data-action="withdraw-pending-voucher" data-id="${esc(voucher.id)}">Withdraw</button>` : ''}`
              : can('voucher.approve')
                ? `<button class="btn small primary" type="button" data-action="approve-pending-voucher" data-id="${esc(voucher.id)}">Approve</button>
                   <button class="btn small danger" type="button" data-action="reject-pending-voucher" data-id="${esc(voucher.id)}">Reject</button>`
                : '<span class="muted small">Awaiting owner</span>'
            : can('voucher.approve')
              ? `<button class="btn small" type="button" data-action="delete-pending-voucher" data-id="${esc(voucher.id)}">Remove</button>`
              : ''
        }</td>
      </tr>`;
    })
    .join('');
  return panel(
    `Voucher approvals <span class="count">${pending.filter((voucher) => voucher.status === 'pending').length}</span>`,
    `<p class="muted small">${active.approvalsRequired ? 'Staff vouchers wait here until an owner approves them; only approved vouchers post to the books.' : 'Approval is currently off, but previously submitted vouchers still need a decision.'}</p>
    ${pending.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact"><thead><tr><th>Date</th><th>Voucher</th><th class="num">Amount</th><th>Submitted by</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<p class="muted">No vouchers are waiting for approval.</p>'}`,
  );
}

export function vouchersScreen() {
  if (!company()) return emptyCompanyScreen('Vouchers');
  const active = company();
  const recent = dayBook(active).slice(0, 12);
  const cards = Object.entries(VOUCHER_TYPES)
    .map(
      ([type, meta]) => `
      <button type="button" class="type-card small" data-action="new-voucher" data-type="${type}"${can('voucher.write') ? '' : ' disabled'}>
        <span class="type-name">${meta.label}</span>
        <kbd>${meta.shortcut}</kbd>
      </button>`,
    )
    .join('');
  return `
    <div class="voucher-banner">
      <div>
        <h1>Vouchers</h1>
        <p class="muted">Pick a voucher type. Enter at least one debit and one credit; they must match.</p>
      </div>
      <div class="type-grid inline">${cards}</div>
    </div>
    ${pendingVouchersPanel(active)}
    ${panel(
      'Recent vouchers',
      recent.length
        ? `<table class="data-table">
            <thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th class="num">Amount</th></tr></thead>
            <tbody>${recent
              .map(
                (voucher) => `<tr class="clickable" data-action="open-voucher" data-id="${esc(voucher.id)}">
                  <td>${esc(dateLabel(voucher.date))}</td>
                  <td><strong>${esc(voucherLabel(voucher.type))} ${voucher.no}</strong></td>
                  <td class="muted">${esc(voucherSummary(company(), voucher))}</td>
                  <td class="num">${money(voucher.total)}</td>
                </tr>`,
              )
              .join('')}</tbody>
          </table>`
        : '<p class="muted">No vouchers yet. Press F5 to record a payment, or F8 for a sale.</p>',
    )}`;
}

export function settlementContentHtml(active) {
  if (!draft || !active) return '';
  if (draft.type === 'Sales' || draft.type === 'Purchase') return '';
  if (draft.currencyCode && draft.currencyCode !== 'INR') return '';
  const partyLines = draft.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.ledgerId && isPartyLedger(active, line.ledgerId));
  if (!partyLines.length) return '';
  return `<div class="bill-block">
    <div class="inventory-head">
      <h2>Bill-wise settlement</h2>
      <span class="muted">Optional. Unallocated money settles the oldest bill, or becomes an advance.</span>
    </div>
    <table class="lines-table bill-table">
      <thead><tr><th>Party line</th><th>Against bill</th><th class="num">Settle amount</th></tr></thead>
      <tbody>${partyLines
        .map(({ line, index }) => {
          const ledger = active.ledgers.find((item) => item.id === line.ledgerId);
          const open = partyOpenBills(active, line.ledgerId, {
            asOn: draft.date,
            excludeVoucherId: view.editId,
          });
          const existing = (line.allocations ?? [])[0];
          const options = open
            .map(
              (bill) => `<option value="${esc(bill.voucherId)}"${existing?.voucherId === bill.voucherId ? ' selected' : ''}>${esc(bill.ref)} · ${esc(dateLabel(bill.date))} · ${money(bill.remaining)} left</option>`,
            )
            .join('');
          return `<tr class="bill-allocation" data-line="${index}">
            <td><strong>${esc(ledger?.name ?? 'Party')}</strong>
              <div class="muted"><span class="party-amount">${line.side} ${money(parseAmount(line.amount) ?? 0)}</span>${open.length === 0 ? ' · no open bills' : ''}</div></td>
            <td><select class="alloc-bill" aria-label="Bill to settle for ${esc(ledger?.name ?? 'party')}">
              <option value="">On account / advance</option>${options}
            </select></td>
            <td class="num"><input class="alloc-amount" inputmode="decimal" placeholder="0.00"
              aria-label="Settlement amount" value="${esc(existing?.amount ?? '')}"></td>
          </tr>`;
        })
        .join('')}</tbody>
    </table>
  </div>`;
}

export function applyPartyGstDefaults() {
  const active = company();
  const form = document.getElementById('voucher-form');
  if (!active || !form || !draft?.gst) return;
  const side = GST_TAXABLE_SIDE[draft.type];
  if (!side) return;
  const partyRow = [...form.querySelectorAll('tr.line')].find(
    (row) => row.querySelector('select.side').value !== side,
  );
  if (!partyRow) return;
  const ledger = active.ledgers.find(
    (entry) => entry.id === ledgerIdByName(partyRow.querySelector('input.ledger').value),
  );
  if (!ledger) return;
  const gstin = form.querySelector('[name="gstPartyGstin"]');
  if (gstin && !gstin.value.trim() && ledger.gstin) gstin.value = ledger.gstin;
  const placeOfSupply = form.querySelector('[name="gstPlaceOfSupply"]');
  if (placeOfSupply && !placeOfSupply.value && ledger.stateCode) placeOfSupply.value = ledger.stateCode;
  const pan = form.querySelector('[name="tdsPan"]');
  if (pan && !pan.value.trim() && ledger.pan) pan.value = ledger.pan;
}

export function refreshSettlement() {
  const container = document.getElementById('bill-settlement');
  if (!container) return;
  applyPartyGstDefaults();
  captureDraft();
  container.innerHTML = settlementContentHtml(company());
  updateVoucherTotals();
}

export function inlineLedgerBlock(active) {
  if (inlineLedger === null) return '';
  return `<div class="inline-ledger" id="inline-ledger">
    <div class="inventory-head">
      <h2>New ledger</h2>
      <span class="muted">Created and selected on line ${inlineLedger + 1}.</span>
    </div>
    <div class="form-grid">
      <label class="field"><span>Ledger name</span>
        <input name="inlineLedgerName" maxlength="80" placeholder="e.g. Sharma Traders" autocomplete="off">
      </label>
      <label class="field"><span>Under group</span>
        <select name="inlineLedgerGroup">${groupSelectOptions(active.groups.find((group) => group.key === 'sundryDebtors')?.id)}</select>
      </label>
      <label class="field"><span>Opening balance</span>
        <input name="inlineLedgerOpening" inputmode="decimal" value="0.00">
      </label>
      <label class="field"><span>Dr / Cr</span>
        <select name="inlineLedgerOpeningType"><option>Dr</option><option>Cr</option></select>
      </label>
    </div>
    <p id="inline-ledger-error" class="form-error" role="alert"></p>
    <div class="form-actions">
      <button class="btn small primary" type="button" data-action="create-inline-ledger">Create &amp; use</button>
      <button class="btn small ghost" type="button" data-action="cancel-inline-ledger">Cancel</button>
    </div>
  </div>`;
}


export function voucherNewScreen() {
  if (!company()) return emptyCompanyScreen('New voucher');
  if (!draft || draft.type !== view.type) return '';
  const active = company();
  const meta = VOUCHER_TYPES[draft.type];
  const pendingEditing = view.pendingEdit
    ? (active.pendingVouchers ?? []).find((item) => item.id === view.editId)
    : null;
  const editing = pendingEditing || (view.editId ? active.vouchers.find((item) => item.id === view.editId) : null);
  const nextNo = pendingEditing ? 'Pending' : editing ? editing.no : (active.counters[draft.type] ?? 0) + 1;

  const rows = draft.lines
    .map(
      (line, index) => `
      <tr class="line">
        <td data-label="Ledger"><div class="ledger-field">
          <input class="ledger" list="ledger-options" autocomplete="off" value="${esc(ledgerNameById(line.ledgerId))}"
            placeholder="Start typing a ledger…" aria-label="Line ${index + 1} ledger">
          <button type="button" class="icon-btn" data-action="new-ledger-inline" data-index="${index}"
            title="Create a ledger and use it here" aria-label="Create ledger for line ${index + 1}">+</button>
        </div></td>
        <td data-label="Dr / Cr">
          <select class="side" aria-label="Line ${index + 1} side">
            <option${line.side === 'Dr' ? ' selected' : ''}>Dr</option>
            <option${line.side === 'Cr' ? ' selected' : ''}>Cr</option>
          </select>
        </td>
        <td class="num" data-label="Amount"><input class="amount" inputmode="decimal" placeholder="0.00" value="${esc(line.amount)}"
          aria-label="Line ${index + 1} amount"></td>
        <td data-label="Cost centre"><select class="cost-centre" aria-label="Line ${index + 1} cost centre">${costCentreSelectOptions(active, line.costCentreId)}</select></td>
        <td class="row-actions">
          <button type="button" class="icon-btn" data-action="remove-line" data-index="${index}"
            title="Remove line" aria-label="Remove line">✕</button>
        </td>
      </tr>`,
    )
    .join('');

  const foreign = draft.currencyCode && draft.currencyCode !== 'INR';
  const inventoryType = INVENTORY_TYPES.includes(draft.type) && !foreign;
  const stockItems = active.stockItems ?? [];
  const itemRows = (draft.items ?? [])
    .map(
      (line, index) => `
      <tr class="item-line">
        <td data-label="Item"><select class="item" aria-label="Item ${index + 1}">${stockItemSelectOptions(active, line.stockItemId)}</select></td>
        <td data-label="Godown"><select class="godown" aria-label="Item ${index + 1} godown">${godownSelectOptions(active, line.godownId)}</select></td>
        <td data-label="Batch / expiry"><input class="batch" maxlength="30" placeholder="Batch" value="${esc(line.batchNo ?? '')}"
          aria-label="Item ${index + 1} batch"${stockItems.find((item) => item.id === line.stockItemId)?.batchTracking ? '' : ' disabled'}>
          <input class="expiry" type="date" value="${esc(line.expiryDate ?? '')}"
            aria-label="Item ${index + 1} expiry"${stockItems.find((item) => item.id === line.stockItemId)?.batchTracking ? '' : ' disabled'}></td>
        <td class="num" data-label="Quantity"><input class="qty" inputmode="decimal" placeholder="0" value="${esc(line.qty)}"
          aria-label="Item ${index + 1} quantity"></td>
        <td class="num" data-label="Rate"><input class="rate" inputmode="decimal" placeholder="0.00" value="${esc(line.rate)}"
          aria-label="Item ${index + 1} rate"></td>
        <td class="num item-amount" data-label="Amount">${money(itemLineAmount(line))}</td>
        <td class="row-actions">
          <button type="button" class="icon-btn" data-action="remove-item" data-index="${index}"
            title="Remove item" aria-label="Remove item">✕</button>
        </td>
      </tr>`,
    )
    .join('');
  const invoiceType = (draft.type === 'Sales' || draft.type === 'Purchase') && !foreign;
  const billFields = invoiceType
    ? `<div class="bill-block">
        <div class="inventory-head">
          <h2>Bill-wise details</h2>
          <span class="muted">Optional. The bill reference and due date drive bill-wise ageing.</span>
        </div>
        <div class="bill-fields">
          <label class="field inline-field"><span>Bill no.</span>
            <input name="billRef" maxlength="40" placeholder="e.g. INV-1024" value="${esc(draft.bill?.ref ?? '')}">
          </label>
          <label class="field inline-field"><span>Due date</span>
            <input name="billDueDate" type="date" min="${esc(draft.date)}" value="${esc(draft.bill?.dueDate ?? '')}">
          </label>
        </div>
      </div>`
    : '';

  const settlementBlock = foreign ? '' : `<div id="bill-settlement">${settlementContentHtml(active)}</div>`;
  const currencyOptions = [
    `<option value="INR"${draft.currencyCode === 'INR' ? ' selected' : ''}>INR · Indian Rupee</option>`,
    ...(active.currencies ?? []).map(
      (currency) => `<option value="${esc(currency.code)}"${draft.currencyCode === currency.code ? ' selected' : ''}>${esc(currency.code)} · ${esc(currency.name)}</option>`,
    ),
  ].join('');
  const rateValue = draft.exchangeRate || (foreign ? rateForCurrency(active, draft.currencyCode, draft.date) ?? '' : '');

  const cashVoucher = ['Payment', 'Receipt', 'Contra'].includes(draft.type);
  const instrument = draft.instrument ?? {};
  const firstBankLine = draft.lines.find((line) =>
    active.ledgers.some(
      (ledger) => ledger.id === line.ledgerId && groupChainKeys(active, ledger.groupId).includes('bank'),
    ),
  );
  const firstBank = active.ledgers.find((ledger) => groupChainKeys(active, ledger.groupId).includes('bank'));
  const instrumentBank = instrument.bankLedgerId || firstBankLine?.ledgerId || firstBank?.id || '';
  const instrumentBlock = cashVoucher
    ? `<div class="instrument-block">
        <div class="inventory-head">
          <h2>Cheque / DD details</h2>
          <span class="muted">Optional. Record the instrument now; the bank must also appear on a voucher line.</span>
        </div>
        <div class="instrument-grid">
          <label class="field"><span>Instrument</span>
            <select name="instrumentKind">
              <option value=""${!instrument.kind ? ' selected' : ''}>None</option>
              <option value="Cheque"${instrument.kind === 'Cheque' ? ' selected' : ''}>Cheque</option>
              <option value="DD"${instrument.kind === 'DD' ? ' selected' : ''}>DD</option>
            </select>
          </label>
          <label class="field"><span>Number</span>
            <input name="instrumentNumber" maxlength="30" placeholder="e.g. 123456" value="${esc(instrument.number ?? '')}">
          </label>
          <label class="field"><span>Instrument date</span>
            <input name="instrumentDate" type="date" value="${esc(instrument.date ?? '')}">
          </label>
          <label class="field"><span>Bank ledger</span>
            <select name="instrumentBank">${bankLedgerSelectOptions(active, instrumentBank)}</select>
          </label>
        </div>
        <p class="muted small">Post-dated instruments appear in the Cheque / DD register until their date. Bank reconciliation marks them cleared when matched.</p>
      </div>`
    : '';

  const inventoryBlock = inventoryType
    ? `<div class="inventory-block">
        <div class="inventory-head">
          <h2>Stock items</h2>
          <span class="muted">Optional. When used, the item total must equal the ${active.gst?.enabled || active.tds?.enabled ? 'taxable value or TDS/TCS base' : 'voucher amount'}.</span>
        </div>
        ${stockItems.length
          ? `<div class="table-scroll" tabindex="0"><table class="lines-table" id="stock-items">
              <thead><tr><th>Item</th><th>Godown</th><th>Batch / expiry</th><th class="num">Quantity</th><th class="num">Rate</th><th class="num">Amount</th><th></th></tr></thead>
              <tbody>${itemRows}</tbody>
            </table></div>
            <div class="line-actions">
              <button type="button" class="btn small" data-action="add-item">+ Add item</button>
              <span id="item-total-note" class="muted"></span>
            </div>`
          : '<p class="muted">No stock items yet. Create items under Inventory (I) to record quantities with this voucher.</p>'}
      </div>`
    : '';

  return `
    <form id="voucher-form" class="voucher-form" novalidate>
      <div class="voucher-head">
        <div>
          <p class="eyebrow">${pendingEditing ? 'Pending approval' : editing ? 'Voucher alteration' : 'Voucher entry'}</p>
          <h1>${pendingEditing ? 'Revise' : editing ? 'Alter' : 'New'} ${esc(meta.label)} voucher <span class="badge">${meta.shortcut}</span></h1>
        </div>
        <div class="voucher-meta">
          <span class="label">No.</span><strong>${nextNo}</strong>
          <label class="field inline-field">
            <span>Currency</span>
            <select name="currencyCode" aria-label="Voucher currency">${currencyOptions}</select>
          </label>
          <label class="field inline-field">
            <span>Rate (INR)</span>
            <input name="exchangeRate" inputmode="decimal" placeholder="—" value="${esc(rateValue)}"${foreign ? '' : ' disabled'} aria-label="Exchange rate to INR">
          </label>
          <label class="field inline-field">
            <span>Date</span>
            <input name="date" type="date" value="${esc(draft.date)}" min="${esc(booksStart(active))}"
              max="${esc((active.years?.length ? active.years[active.years.length - 1] : { end: active.fyEnd }).end)}" required>
          </label>
        </div>
      </div>
      ${ledgerDatalistHtml()}
      ${foreign ? `<p class="muted small currency-hint">Amounts are entered in ${esc(draft.currencyCode)} and posted to the books in INR at the rate above. Stock items and bill-wise settlement are not available on foreign vouchers yet.</p>` : ''}
      <div class="table-scroll" tabindex="0"><table class="lines-table">
        <thead><tr><th>Particulars</th><th>Dr/Cr</th><th class="num">Amount${foreign ? ` (${esc(draft.currencyCode)})` : ''}</th><th>Cost centre</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${inlineLedgerBlock(active)}
      <div class="line-actions">
        <button type="button" class="btn small" data-action="add-line">+ Add line</button>
        <div id="voucher-totals" class="totals"></div>
      </div>
      ${inventoryBlock}
      ${gstVoucherBlock(active)}
      ${tdsVoucherBlock(active)}
      ${billFields}
      ${settlementBlock}
      ${instrumentBlock}
      <label class="field">
        <span>Narration</span>
        <input name="narration" maxlength="400" placeholder="Optional note for this voucher" value="${esc(draft.narration)}">
      </label>
      <p id="form-error" class="form-error" role="alert"></p>
      <div class="form-actions">
        <button class="btn primary" type="submit">${pendingEditing ? 'Resubmit for approval' : editing ? 'Update voucher' : 'Accept'} <kbd>Alt+S</kbd></button>
        <button class="btn ghost" type="button" data-screen="gateway">Esc · Gateway</button>
        <button class="btn ghost" type="button" data-screen="daybook">Day Book</button>
      </div>
    </form>`;
}

export function voucherViewScreen() {
  const active = company();
  if (!active) return emptyCompanyScreen('Voucher');
  const voucher = active.vouchers.find((item) => item.id === view.id);
  if (!voucher) return panel('Voucher', '<p class="muted">That voucher no longer exists.</p>');
  const voucherCurrency = voucher.currencyCode
    ? (active.currencies ?? []).find((currency) => currency.code === voucher.currencyCode)
    : null;
  const foreignMoney = (value) => `${esc(voucher.currencyCode)} ${round2(value).toFixed(2)}`;

  const rows = voucher.lines
    .map((line) => {
      const ledger = active.ledgers.find((item) => item.id === line.ledgerId);
      const group = ledger ? groupById(active, ledger.groupId) : null;
      const costCentre = line.costCentreId
        ? (active.costCentres ?? []).find((centre) => centre.id === line.costCentreId)
        : null;
      const allocations = (line.allocations ?? [])
        .map((allocation) => {
          const bill = active.vouchers.find((item) => item.id === allocation.voucherId);
          return bill ? `Settles ${billLabel(bill)} · ${money(allocation.amount)}` : '';
        })
        .filter(Boolean);
      return `<tr>
        <td>${esc(ledger?.name ?? 'Unknown')}${costCentre ? `<div class="muted small">Cost centre: ${esc(costCentre.name)}</div>` : ''}${allocations.length ? `<div class="muted small">${allocations.map(esc).join('<br>')}</div>` : ''}</td>
        <td class="muted">${esc(group?.name ?? '')}</td>
        <td class="num">${line.side === 'Dr' ? (voucherCurrency ? `${foreignMoney(line.currencyAmount)}<div class="muted small">${money(line.amount)}</div>` : money(line.amount)) : ''}</td>
        <td class="num">${line.side === 'Cr' ? (voucherCurrency ? `${foreignMoney(line.currencyAmount)}<div class="muted small">${money(line.amount)}</div>` : money(line.amount)) : ''}</td>
      </tr>`;
    })
    .join('');

  const stockRows = (voucher.items ?? [])
    .map((line) => {
      const item = (active.stockItems ?? []).find((entry) => entry.id === line.stockItemId);
      const unit = (active.units ?? []).find((entry) => entry.id === item?.unitId)?.symbol ?? '';
      const godown = (active.godowns ?? []).find((entry) => entry.id === (line.godownId || defaultGodownId(active)));
      const batch = line.batchNo ? ` · batch ${line.batchNo}` : '';
      const expiry = line.expiryDate ? ` · exp ${dateLabel(line.expiryDate)}` : '';
      return `<tr>
        <td>${esc(item?.name ?? 'Unknown item')}<div class="muted small">${esc(godown?.name ?? 'Main Location')}${esc(batch)}${esc(expiry)}</div></td>
        <td class="num">${fmtQty(line.qty)}${unit ? ` ${esc(unit)}` : ''}</td>
        <td class="num">${money(line.rate)}</td>
        <td class="num">${money(line.amount ?? round2(line.qty * line.rate))}</td>
      </tr>`;
    })
    .join('');
  const stockBlock = stockRows
    ? `<h2 class="section-title">Stock items</h2>
       <table class="data-table compact">
         <thead><tr><th>Item</th><th class="num">Quantity</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
         <tbody>${stockRows}</tbody>
       </table>`
    : '';

  return `
    ${panel(
      `${esc(voucherLabel(voucher.type))} ${voucher.no}`,
      `<div class="voucher-view-meta">
        <div><span class="label">Date</span><strong>${esc(dateLabel(voucher.date))}</strong></div>
        <div><span class="label">Amount</span><strong>${money(voucher.total)}</strong></div>
        ${voucherCurrency ? `<div><span class="label">Currency</span><span>${foreignMoney(voucher.currencyTotal)} @ ${money(voucher.exchangeRate)}<br><span class="muted small">${esc(voucherCurrency.name)}</span></span></div>` : ''}
        ${voucher.bill ? `<div><span class="label">Bill</span><span>${esc(voucher.bill.ref || '—')}${voucher.bill.dueDate ? ` · due ${esc(dateLabel(voucher.bill.dueDate))}` : ''}</span></div>` : ''}
        ${voucher.instrument ? `<div><span class="label">Instrument</span><span>${esc(voucher.instrument.kind)} ${esc(voucher.instrument.number)} · ${esc(dateLabel(voucher.instrument.date))}<br><span class="muted small">${esc(active.ledgers.find((ledger) => ledger.id === voucher.instrument.bankLedgerId)?.name ?? 'Unknown bank')}</span></span></div>` : ''}
        ${voucher.tds ? `<div><span class="label">${esc(voucher.tds.kind)}</span><span>${esc(voucher.tds.code)} · ${voucher.tds.rate}%<br><span class="muted small">Base ${money(voucher.tds.base)} · ${voucher.tds.kind.toLowerCase()} ${money(voucher.tds.amount)}${voucher.tds.pan ? ` · PAN ${esc(voucher.tds.pan)}` : ''}</span></span></div>` : ''}
        ${voucher.gst ? `<div><span class="label">GST</span><span>${esc(gstRateLabel(voucher.gst.rate, voucher.gst.cessRate))} · ${esc(voucher.gst.supplyType)}<br><span class="muted small">Taxable ${money(voucher.gst.taxable)} · tax ${money(round2(voucher.gst.cgst + voucher.gst.sgst + voucher.gst.igst + voucher.gst.cess))}${voucher.gst.partyGstin ? ` · ${esc(voucher.gst.partyGstin)}` : ''}${voucher.gst.reverseCharge ? ' · RCM' : ''}</span></span></div>` : ''}
        <div><span class="label">Narration</span><span>${esc(voucher.narration || '—')}</span></div>
      </div>
      <table class="data-table">
        <thead><tr><th>Particulars</th><th>Group</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2"></td><td class="num">${money(voucher.total)}</td><td class="num">${money(voucher.total)}</td></tr></tfoot>
      </table>
      ${stockBlock}
      <div class="form-actions">
        <button class="btn ghost" type="button" data-screen="daybook">Back to Day Book</button>
        <button class="btn" type="button" data-action="alter-voucher" data-id="${esc(voucher.id)}">Alter voucher</button>
        ${voucher.instrument?.kind === 'Cheque' && voucher.type === 'Payment' ? `<button class="btn" type="button" data-action="print-cheque" data-id="${esc(voucher.id)}">Print cheque</button>` : ''}
        <button class="btn" type="button" data-action="duplicate-voucher" data-id="${esc(voucher.id)}">Duplicate</button>
        <button class="btn danger" type="button" data-action="delete-voucher" data-id="${esc(voucher.id)}">Delete voucher</button>
      </div>`,
    )}`;
}


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
  addComplianceTask,
  addDeliveryNote,
  addCostCategory,
  addCostCentre,
  addEmployee,
  addGodown,
  addOrder,
  addRecurringVoucher,
  addPayHead,
  auditEntries,
  addFinancialYear,
  booksStart,
  addGstRate,
  updateGstRate,
  addGroup,
  addLedger,
  addManufacture,
  addStockCount,
  addStockGroup,
  addStockTransfer,
  addTaxChallan,
  addStockItem,
  addTdsSection,
  addUnit,
  addVoucher,
  autoMatchBank,
  allocationsAgainst,
  approvalRequiredForAmount,
  orderRemainingItems,
  approvePendingVoucher,
  billLabel,
  clearBankStatement,
  closeFinancialYear,
  convertQuotationToOrder,
  costCentreUsage,
  dateLabel,
  defaultFyStart,
  defaultGodownId,
  deleteBom,
  deleteBudget,
  duplicateBudget,
  deleteCompany,
  deleteComplianceTask,
  deleteCurrency,
  deleteCurrencyRate,
  deleteCostCategory,
  deleteCostCentre,
  deleteEmployee,
  deleteGodown,
  deleteGstRate,
  deleteOrder,
  deletePendingVoucher,
  deleteGroup,
  deletePayHead,
  deletePayrollRun,
  deleteTaxChallan,
  deleteLedger,
  deleteManufacture,
  deleteRecurringVoucher,
  deleteStockCount,
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
  payrollBankTransferRows,
  payrollLedgers,
  payrollMonthEnd,
  postForexRevaluation,
  postStockCount,
  rateForCurrency,
  reopenFinancialYear,
  recordAudit,
  rejectPendingVoucher,
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
  setComplianceTaskStatus,
  setEwayPartB,
  setNextVoucherNumber,
  setInstrumentStatus,
  setOrderStatus,
  signedOpening,
  todayIso,
  updateCompany,
  updateComplianceTask,
  updateEmployee,
  updateGroup,
  updateLedger,
  updateStockItem,
  updateTdsSection,
  updateBudget,
  updateCostCategory,
  updateCostCentre,
  updateCurrencyRate,
  updatePendingVoucher,
  updateVoucher,
  withdrawPendingVoucher,
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
import { decryptBackup, encryptBackup, isEncryptedBackup } from './backup-crypto.js';
import { importTallyXml } from './tally.js';
import { buildXlsx, xlsxToCsv } from './xlsx.js';
import { serverUsersPanel } from './ui-server.js';

import {
  gatewayScreen,
  financialYearsPanel,
  serverCompanyChecks,
  serverScopeLabel,
  serverScopeEditor,
  usersPanel,
  companiesScreen,
  budgetTargetOptions,
  budgetMastersPanel,
  costCentreMastersPanel,
  currencyMastersPanel,
  mastersScreen,
  vouchersScreen,
  settlementContentHtml,
  applyPartyGstDefaults,
  refreshSettlement,
  inlineLedgerBlock,
  voucherNewScreen,
  voucherViewScreen,
} from './ui-screens.js';
import {
  daybookScreen,
  ledgerPickScreen,
  ledgerScreen,
  trialScreen,
  pnlScreen,
  balanceSheetScreen,
  cashBankScreen,
  registersScreen,
  outstandingScreen,
  consolidationScreen,
  exceptionsScreen,
  partyLedgerList,
  billStatusBadge,
  billRegisterScreen,
  partyStatementScreen,
  groupSummaryScreen,
  groupVouchersScreen,
  cashFlowScreen,
  ratiosScreen,
  auditScreen,
  yearComparisonScreen,
  statisticsScreen,
  allPartyLedgerOptions,
} from './ui-reports.js';
import {
  ordersScreen,
  orderItemRow,
  bomComponentRow,
  stockTransferItemRow,
  stockOpeningBatchRow,
  inventoryScreen,
} from './ui-inventory.js';
import {
  loadSnapshots,
  saveSnapshot,
  localDay,
  maybeAutoSnapshot,
  snapshotHtml,
  workspacePanel,
  backupScreen,
  parseCsv,
  csvObjects,
  importLedgerCsv,
  importVoucherCsv,
  parseStatementDate,
  parseBankStatementCsv,
  budgetsScreen,
  forexScreen,
} from './ui-admin.js';
import {
  gstDocumentSubtitle,
  gstScreen,
  readinessBadge,
  issueList,
  eInvoiceScreen,
  ewayBillScreen,
  complianceScreen,
  taxAuditScreen,
  tdsScreen,
} from './ui-tax.js';
import {
  payrollMonthLabel,
  defaultPayrollMonth,
  employeeMonthlyTotals,
  payrollScreen,
  salaryRegisterPanel,
  payrollRegisterScreen,
  payrollRunScreen,
  payslipScreen,
} from './ui-payroll.js';
import {
  costCentresScreen,
  costCentreDetailScreen,
  postDatedScreen,
  chequePrintScreen,
  selectedBankLedgerId,
  bankReconScreen,
  importScreen,
} from './ui-banking.js';

import {
  AUDIT_ACTION_LABELS,
  HOTKEYS,
  REPORT_SCREENS,
  REPORT_TITLES,
  SCREEN_TITLES,
  SERVER_EVENT_LABELS,
  VISIBLE_H1_SCREENS,
} from './ui-constants.js';

export const WORKSPACE_KEY = 'zledgercraft.workspace.v1';
export let state = loadState();
export let inlineLedger = null;
export const SNAPSHOT_KEY = 'zledgercraft.snapshots.v1';
export const SNAPSHOT_LIMIT = 10;
export let workspaceMode = false;
export let workspaceQueue = Promise.resolve();
export let workspaceRev = 0;
export let workspaceUpdatedAt = null;
export let workspaceStorage = null;
export let workspaceRemote = null;
export let workspaceWatchTimer = null;
export let workspaceSaveError = '';
export let activeLease = null;
let leaseRenewTimer = null;
export let authRequired = false;
export let authUser = null;
export let authInfo = null;
export let authAccounts = [];
export let serverBackups = [];
export let serverBackupInfo = {
  keep: 7,
  hours: 24,
  offsite: { configured: false, bucket: '' },
  encryption: { configured: false, algorithm: '' },
  history: [],
};
export let reportSettings = {
  enabled: false,
  recipients: '',
  lastSentAt: null,
  lastAttemptAt: null,
  lastError: '',
  history: [],
  updatedAt: null,
  emailConfigured: false,
  secretConfigured: false,
  publicUrl: '',
};
export let authLoginEvents = [];
export let authSessions = [];
export let authApiTokens = [];
export let serverAuditRows = [];
export let serverAuditChain = { ok: null, checked: 0 };
export let serverAuditEvents = [];
export let serverEventChain = { ok: null, checked: 0 };
export let view = { screen: 'gateway' };
export let draft = null;
export let flash = null;
export let flashTimer = null;
export let filters = {
  daybook: { type: 'All', from: '', to: '', pageSize: 250, page: 1 },
  statement: { from: '', to: '' },
  period: { from: '', to: '' },
  register: { type: 'Sales', from: '', to: '' },
  outstanding: { side: 'receivable', asOn: '' },
  billRegister: { side: 'receivable', from: '', to: '', asOn: '', status: 'All' },
  partyStatement: { side: 'receivable', ledgerId: '', from: '', to: '' },
  cashBook: { ledgerId: '', from: '', to: '' },
  stock: { from: '', to: '' },
  orders: { from: '', to: '', status: 'All' },
  postDated: { from: '', to: '', asOn: '', status: 'All' },
  costCentres: { from: '', to: '' },
  budget: { yearId: '', asOn: '' },
  forex: { asOn: '' },
  gst: { from: '', to: '' },
  tds: { kind: 'TDS', from: '', to: '' },
  einvoice: { from: '', to: '' },
  ewaybill: { from: '', to: '', threshold: '50000' },
  taxAudit: { from: '', to: '' },
  payroll: { month: '', date: '', from: '', to: '' },
  audit: { companyId: '', q: '' },
};


export function voucherLabel(type) {
  return VOUCHER_TYPES[type]?.label ?? type;
}

export function fmtQty(value) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(rounded);
}

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function company() {
  return activeCompany(state);
}

export const ROLE_PERMISSIONS = {
  owner: [
    'voucher.write',
    'voucher.delete',
    'master.write',
    'master.delete',
    'company.manage',
    'year.manage',
    'data.restore',
    'user.manage',
    'recon.write',
    'voucher.approve',
  ],
  accountant: ['voucher.write', 'voucher.delete', 'master.write', 'master.delete', 'recon.write'],
  viewer: [],
};

export function currentProfile() {
  return authUser ?? activeUser(state);
}

export function roleLabel(role) {
  return USER_ROLES[role]?.label ?? 'Viewer';
}

export function can(action) {
  return (ROLE_PERMISSIONS[currentProfile()?.role] ?? []).includes(action);
}

export function requirePermission(action) {
  if (can(action)) return true;
  setFlash(`${roleLabel(currentProfile()?.role)} profiles cannot make this change.`, 'warn');
  render();
  return false;
}

async function loadAuthState() {
  if (!workspaceAvailable()) return;
  try {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (response.status === 404) return;
    const payload = await response.json();
    if (!response.ok || !payload.ok) return;
    authInfo = payload;
    authRequired = Boolean(payload.required);
    authUser = payload.user ?? null;
  } catch {
    // A static single-file deployment has no auth endpoint.
  }
}

async function refreshAuthAccounts() {
  if (!authRequired || authUser?.role !== 'owner') {
    authAccounts = [];
    return;
  }
  try {
    const response = await fetch('/api/auth/users', { cache: 'no-store' });
    const payload = await response.json();
    if (response.ok && payload.ok) authAccounts = payload.users ?? [];
  } catch {
    authAccounts = [];
  }
}

async function refreshApiTokens() {
  if (!authRequired || authUser?.role !== 'owner') {
    authApiTokens = [];
    return;
  }
  try {
    const response = await fetch('/api/auth/api-tokens', { cache: 'no-store' });
    const payload = await response.json();
    authApiTokens = response.ok && payload.ok ? payload.tokens ?? [] : [];
  } catch {
    authApiTokens = [];
  }
}

async function refreshServerBackups() {
  if (!authRequired || authUser?.role !== 'owner') {
    serverBackups = [];
    return;
  }
  try {
    const response = await fetch('/api/backups', { cache: 'no-store' });
    const payload = await response.json();
    if (response.ok && payload.ok) {
      serverBackups = payload.backups ?? [];
      serverBackupInfo = {
        keep: payload.keep ?? 7,
        hours: payload.hours ?? 24,
        offsite: payload.offsite ?? { configured: false, bucket: '' },
        encryption: payload.encryption ?? { configured: false, algorithm: '' },
        history: Array.isArray(payload.history) ? payload.history : [],
      };
    }
  } catch {
    serverBackups = [];
  }
}

async function refreshReportSettings() {
  if (!authRequired || authUser?.role !== 'owner') {
    reportSettings = {
      enabled: false,
      recipients: '',
      lastSentAt: null,
      lastAttemptAt: null,
      lastError: '',
      updatedAt: null,
      emailConfigured: false,
      secretConfigured: false,
      publicUrl: '',
    };
    return;
  }
  try {
    const response = await fetch('/api/reports/settings', { cache: 'no-store' });
    const payload = await response.json();
    if (response.ok && payload.ok) {
      reportSettings = {
        ...payload.settings,
        history: Array.isArray(payload.history) ? payload.history : [],
        emailConfigured: Boolean(payload.emailConfigured),
        secretConfigured: Boolean(payload.secretConfigured),
        publicUrl: payload.publicUrl || '',
      };
    }
  } catch {
    // Leave the last known settings visible when the server is unreachable.
  }
}

async function refreshAuthLogins() {
  if (!authRequired || authUser?.role !== 'owner') {
    authLoginEvents = [];
    return;
  }
  try {
    const response = await fetch('/api/auth/logins', { cache: 'no-store' });
    const payload = await response.json();
    if (response.ok && payload.ok) authLoginEvents = payload.events ?? [];
  } catch {
    authLoginEvents = [];
  }
}

async function refreshAuthSessions() {
  if (!authRequired || authUser?.role !== 'owner') {
    authSessions = [];
    return;
  }
  try {
    const response = await fetch('/api/auth/sessions', { cache: 'no-store' });
    const payload = await response.json();
    if (response.ok && payload.ok) authSessions = payload.sessions ?? [];
  } catch {
    authSessions = [];
  }
}

async function refreshServerAudit() {
  if (!authRequired || authUser?.role !== 'owner') {
    serverAuditRows = [];
    serverAuditChain = { ok: null, checked: 0 };
    serverAuditEvents = [];
    serverEventChain = { ok: null, checked: 0 };
    return;
  }
  try {
    const response = await fetch('/api/server-audit', { cache: 'no-store' });
    const payload = await response.json();
    if (response.ok && payload.ok) {
      serverAuditRows = payload.rows ?? [];
      serverAuditChain = payload.chain ?? { ok: null, checked: 0 };
      serverAuditEvents = payload.events ?? [];
      serverEventChain = payload.eventChain ?? { ok: null, checked: 0 };
    }
  } catch {
    serverAuditRows = [];
    serverAuditChain = { ok: null, checked: 0 };
    serverAuditEvents = [];
    serverEventChain = { ok: null, checked: 0 };
  }
}

async function logoutServer() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Reloading still clears the in-memory UI.
  }
  location.reload();
}

export function authWarningHtml() {
  if (!authInfo?.lan) return '';
  return authInfo.tls
    ? '<p class="muted small">LAN mode · encrypted connection</p>'
    : '<p class="form-error" role="status">LAN mode over HTTP: passwords are not encrypted on the network. Use a local TLS certificate or reverse proxy before regular use.</p>';
}

export function renderLogin(message = '', messageClass = 'form-error') {
  const root = document.getElementById('app');
  if (!root) return;
  document.title = 'Sign in · ZledgerCraft';
  root.innerHTML = `<main id="main-content" class="auth-screen">
    <section class="auth-card">
      <div class="brand"><svg class="brand-mark" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M 82 40 H 174 A 20 20 0 0 1 194 60 V 196 A 20 20 0 0 1 174 216 H 82 A 20 20 0 0 1 62 196 V 60 A 20 20 0 0 1 82 40 Z M 76 67 H 180 V 93 L 110 163 H 180 V 189 H 76 V 163 L 146 93 H 76 Z"/></svg>Zledger<span>CRAFT</span></div>
      <h1>Sign in to the server</h1>
      <p class="muted">${authInfo?.neonAuth ? 'Use your Neon Auth email and password. Books are stored on the server.' : 'Use the account created by the server owner. This is a LAN workspace; books are not stored in this browser.'}</p>
      <form id="login-form" class="form-grid" novalidate>
        <label class="field"><span>${authInfo?.neonAuth ? 'Email' : 'Username'}</span><input name="username" type="${authInfo?.neonAuth ? 'email' : 'text'}" autocomplete="${authInfo?.neonAuth ? 'email' : 'username'}" autocapitalize="none" aria-describedby="login-error" required></label>
        <label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" aria-describedby="login-error" required></label>
        ${authInfo?.neonAuth ? '' : '<label class="field"><span>Authenticator code (if enabled)</span><input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" aria-describedby="login-error"></label>'}
        <p id="login-error" class="${messageClass}" role="alert">${esc(message)}</p>
        <div class="form-actions"><button class="btn primary" type="submit">Sign in</button></div>
      </form>
      ${authInfo?.neonAuth
        ? `<details class="auth-reset">
            <summary>Create the first account</summary>
            <form id="signup-form" class="form-grid" novalidate>
              <label class="field"><span>Name</span><input name="name" maxlength="80" autocomplete="name" required></label>
              <label class="field"><span>Email</span><input type="email" name="email" maxlength="200" autocomplete="email" required></label>
              <label class="field"><span>Password</span><input type="password" name="password" minlength="8" autocomplete="new-password" required></label>
              <p id="signup-error" class="form-error" role="alert"></p>
              <div class="form-actions"><button class="btn small" type="submit">Create account</button></div>
            </form>
          </details>`
        : ''}
      ${authInfo?.emailReset
        ? `<details class="auth-reset">
            <summary>Forgot password?</summary>
            <form id="forgot-password-form" class="form-grid" novalidate>
              <label class="field"><span>${authInfo?.neonAuth ? 'Email' : 'Username or account email'}</span><input name="identifier" type="${authInfo?.neonAuth ? 'email' : 'text'}" maxlength="200" autocomplete="${authInfo?.neonAuth ? 'email' : 'username'}" required></label>
              <p id="forgot-status" class="muted small" role="status"></p>
              <div class="form-actions"><button class="btn small" type="submit">Email reset link</button></div>
            </form>
          </details>`
        : ''}
      ${authWarningHtml()}
    </section>
  </main>`;
}

export function renderPasswordReset(token, message = '') {
  const root = document.getElementById('app');
  if (!root) return;
  document.title = 'Reset password · ZledgerCraft';
  root.innerHTML = `<main id="main-content" class="auth-screen">
    <section class="auth-card">
      <div class="brand"><svg class="brand-mark" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M 82 40 H 174 A 20 20 0 0 1 194 60 V 196 A 20 20 0 0 1 174 216 H 82 A 20 20 0 0 1 62 196 V 60 A 20 20 0 0 1 82 40 Z M 76 67 H 180 V 93 L 110 163 H 180 V 189 H 76 V 163 L 146 93 H 76 Z"/></svg>Zledger<span>CRAFT</span></div>
      <h1>Reset your password</h1>
      <p class="muted">Choose a new password. The link can be used once and expires automatically.</p>
      <form id="reset-password-form" class="form-grid" data-token="${esc(token)}" novalidate>
        <label class="field"><span>New password</span><input type="password" name="newPassword" minlength="8" autocomplete="new-password" aria-describedby="reset-password-error" required></label>
        <label class="field"><span>Confirm new password</span><input type="password" name="confirmPassword" minlength="8" autocomplete="new-password" aria-describedby="reset-password-error" required></label>
        <p id="reset-password-error" class="form-error" role="alert">${esc(message)}</p>
        <div class="form-actions"><button class="btn primary" type="submit">Reset password</button></div>
      </form>
      ${authWarningHtml()}
    </section>
  </main>`;
}

export function workspaceAvailable() {
  return typeof location !== 'undefined' && ['http:', 'https:'].includes(location.protocol);
}

export function workspaceRequested() {
  if (authRequired) return true;
  if (!workspaceAvailable()) return false;
  try {
    return (
      new URLSearchParams(location.search).get('workspace') === '1' ||
      localStorage.getItem(WORKSPACE_KEY) === 'server'
    );
  } catch {
    return false;
  }
}

export function queueWorkspaceSave() {
  if (!workspaceMode) return workspaceQueue;
  const snapshot = JSON.parse(JSON.stringify(state));
  workspaceQueue = workspaceQueue
    .catch(() => {})
    .then(async () => {
      if (workspaceRemote?.conflict) return;
      const baseRev = workspaceRev;
      const response = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          state: snapshot,
          baseRev,
          leaseToken: activeLease?.token ?? '',
        }),
      });
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        // Keep the status-based error below.
      }
      if (response.status === 401 && authRequired) {
        stopWorkspaceWatch();
        authUser = null;
        renderLogin('Your server session expired. Sign in again.');
        return;
      }
      if (response.status === 409) {
        workspaceRemote = {
          rev: Number(payload.rev) || workspaceRev,
          updatedAt: payload.updatedAt ?? null,
          conflict: true,
          reason: payload.error || '',
        };
        const error = new Error(payload.error || 'The server workspace changed.');
        error.conflict = true;
        workspaceSaveError = error.message;
        throw error;
      }
      if (response.status === 423) {
        const error = new Error(payload.error || 'That record is being edited in another session.');
        error.locked = true;
        workspaceSaveError = error.message;
        throw error;
      }
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Server workspace returned ${response.status}.`);
      }
      workspaceRev = Number(payload.rev) || baseRev + 1;
      workspaceUpdatedAt = payload.updatedAt ?? workspaceUpdatedAt;
      workspaceStorage = payload.storage ?? workspaceStorage;
      workspaceRemote = null;
      workspaceSaveError = '';
      if (payload.merged && payload.state) {
        const imported = importState(JSON.stringify(payload.state));
        if (!imported.ok) throw new Error(imported.error);
        state = imported.state;
        if (authRequired) {
          state.users = [];
          state.currentUserId = null;
        }
        const renumbered = Number(payload.renumbered) || 0;
        setFlash(
          renumbered
            ? `Merged changes from another session. ${renumbered} voucher number${renumbered === 1 ? ' was' : 's were'} reassigned to avoid a duplicate.`
            : 'Merged changes from another session into the server workspace.',
        );
        render();
        return;
      }
      refreshWorkspaceBanner();
    })
    .catch((error) => {
      if (error.conflict) {
        refreshWorkspaceBanner();
        return;
      }
      if (error.locked) {
        setFlash(error.message, 'warn');
        render();
        return;
      }
      workspaceSaveError = error.message;
      if (authRequired) {
        setFlash(`Server workspace save failed: ${error.message}`, 'warn');
        render();
        return;
      }
      workspaceMode = false;
      stopWorkspaceWatch();
      try {
        localStorage.removeItem(WORKSPACE_KEY);
      } catch {
        // Browser storage may be unavailable.
      }
      setFlash('Server workspace save failed. This browser is using local storage again.', 'warn');
      render();
    });
  return workspaceQueue;
}

export function persist() {
  if (!authRequired) saveState(state);
  maybeAutoSnapshot();
  if (workspaceMode) return queueWorkspaceSave();
  return workspaceQueue;
}

export async function releaseActiveLease() {
  if (leaseRenewTimer) clearInterval(leaseRenewTimer);
  leaseRenewTimer = null;
  const lease = activeLease;
  activeLease = null;
  if (!lease || !workspaceMode) return;
  try {
    await fetch('/api/workspace/leases', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        companyId: lease.companyId,
        recordType: lease.recordType,
        recordId: lease.recordId,
        token: lease.token,
      }),
      keepalive: true,
    });
  } catch {
    // The server expires the lease even when the browser disappears.
  }
}

function startLeaseRenewal() {
  if (leaseRenewTimer) clearInterval(leaseRenewTimer);
  leaseRenewTimer = setInterval(() => {
    void renewActiveLease();
  }, 45_000);
}

async function renewActiveLease() {
  if (!activeLease || !workspaceMode) return;
  const lease = activeLease;
  try {
    const response = await fetch('/api/workspace/leases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        companyId: lease.companyId,
        recordType: lease.recordType,
        recordId: lease.recordId,
        token: lease.token,
      }),
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // Keep the status-based message below.
    }
    if (response.status === 409) {
      activeLease = null;
      if (leaseRenewTimer) clearInterval(leaseRenewTimer);
      leaseRenewTimer = null;
      setFlash(payload.error || 'Another session took over this record.', 'warn');
      if (view.screen === 'voucherNew') navigate('vouchers');
      return;
    }
    if (!response.ok || payload.ok === false) return;
    activeLease = { ...lease, expiresAt: payload.lease?.expiresAt ?? lease.expiresAt };
  } catch {
    // A transient network failure leaves the server lease to expire naturally.
  }
}

async function acquireRecordLease(recordType, recordId) {
  await releaseActiveLease();
  if (!workspaceMode) return true;
  const companyId = state.activeCompanyId;
  try {
    const response = await fetch('/api/workspace/leases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ companyId, recordType, recordId }),
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // Keep the status-based message below.
    }
    if (response.status === 409) {
      setFlash(payload.error || 'That record is being edited in another session.', 'warn');
      render();
      return false;
    }
    if (response.status === 404 || response.status === 501) return true;
    if (!response.ok || payload.ok === false) {
      setFlash(payload.error || 'Could not reserve this record for editing.', 'warn');
      render();
      return false;
    }
    activeLease = {
      companyId,
      recordType,
      recordId,
      token: payload.token,
      expiresAt: payload.lease?.expiresAt ?? null,
    };
    startLeaseRenewal();
    return true;
  } catch {
    setFlash('Could not confirm a record lease. The save may be rejected if another session edits it.', 'warn');
    render();
    return true;
  }
}

export function workspaceBannerHtml() {
  if (!workspaceMode || !workspaceRemote) return '';
  const when = workspaceRemote.updatedAt
    ? new Date(workspaceRemote.updatedAt).toLocaleString('en-IN')
    : 'an unknown time';
  const action = '<button class="btn small" type="button" data-action="reload-workspace">Reload server copy</button>';
  return workspaceRemote.conflict
    ? `<div class="role-banner warn" role="status">Server workspace changed at ${esc(when)} (revision ${workspaceRemote.rev}). The last change was ${authRequired ? 'kept unsaved in this tab' : 'kept in this browser'} but was not saved to the server.${workspaceRemote.reason ? ` ${esc(workspaceRemote.reason)}` : ''} ${action}</div>`
    : `<div class="role-banner" role="status">A newer server workspace is available, saved ${esc(when)} (revision ${workspaceRemote.rev}). ${action}</div>`;
}

export function refreshWorkspaceBanner() {
  const holder = document.getElementById('workspace-banner');
  if (holder) holder.innerHTML = workspaceBannerHtml();
}

export function stopWorkspaceWatch() {
  if (workspaceWatchTimer) clearInterval(workspaceWatchTimer);
  workspaceWatchTimer = null;
}

async function checkWorkspaceMeta() {
  if (!workspaceMode || workspaceRemote?.conflict || document.hidden) return;
  try {
    const response = await fetch('/api/workspace?meta=1', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.ok) return;
    if (Number(payload.rev) > workspaceRev) {
      workspaceRemote = {
        rev: Number(payload.rev),
        updatedAt: payload.updatedAt ?? null,
        conflict: false,
      };
      refreshWorkspaceBanner();
    }
  } catch {
    // The next poll or save reports a persistent connection problem.
  }
}

export function startWorkspaceWatch() {
  if (workspaceWatchTimer || !workspaceMode) return;
  workspaceWatchTimer = setInterval(checkWorkspaceMeta, 8000);
  setTimeout(checkWorkspaceMeta, 1000);
}

async function loadServerWorkspace() {
  if (!workspaceRequested()) return null;
  workspaceMode = true;
  try {
    const response = await fetch('/api/workspace', { cache: 'no-store' });
    if (response.status === 401 && authRequired) {
      workspaceMode = false;
      authUser = null;
      return null;
    }
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Workspace unavailable.');
    workspaceRev = Number(payload.rev) || 0;
    workspaceUpdatedAt = payload.updatedAt ?? null;
    workspaceStorage = payload.storage ?? null;
    workspaceRemote = null;
    localStorage.setItem(WORKSPACE_KEY, 'server');
    startWorkspaceWatch();
    if (payload.state && Array.isArray(payload.state.companies) && payload.state.companies.length) {
      const imported = importState(JSON.stringify(payload.state));
      if (!imported.ok) throw new Error(imported.error);
      if (authRequired) {
        imported.state.users = [];
        imported.state.currentUserId = null;
      }
      return imported.state;
    }
    return null;
  } catch (error) {
    console.error('Server workspace load failed:', error);
    workspaceMode = false;
    stopWorkspaceWatch();
    try {
      localStorage.removeItem(WORKSPACE_KEY);
    } catch {
      // Ignore storage failures.
    }
    return null;
  }
}

export function logAudit(action, summary, active = company(), entity = '', actor = currentProfile()) {
  recordAudit(state, {
    action,
    summary,
    entity,
    companyId: active?.id ?? '',
    companyName: active?.name ?? '',
    actorId: actor?.id ?? '',
    actorName: actor?.name ?? '',
    actorRole: actor?.role ?? '',
  });
}

export function mergeAuditEntries(current, incoming) {
  const seen = new Set();
  return [...normalizeAudit(current), ...normalizeAudit(incoming)]
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Restores data while preserving the current log and recording the restore. */
export function applyRestoredState(nextState, summary) {
  const previousAudit = state.audit;
  const previousUsers = state.users ?? [];
  const previousUserId = state.currentUserId;
  const actor = currentProfile();
  nextState.audit = mergeAuditEntries(previousAudit, nextState.audit);
  const knownUsers = new Set(previousUsers.map((user) => user.id));
  nextState.users = [
    ...previousUsers,
    ...(nextState.users ?? []).filter((user) => !knownUsers.has(user.id)),
  ];
  if (authRequired) {
    nextState.users = [];
    nextState.currentUserId = null;
  } else if (nextState.users.some((user) => user.id === previousUserId)) {
    nextState.currentUserId = previousUserId;
  }
  state = nextState;
  const active = activeCompany(state);
  logAudit('data.restore', summary, active, '', actor);
  persist();
}

export function voucherAuditLabel(voucher) {
  return `${voucherLabel(voucher.type)} ${voucher.no} · ${dateLabel(voucher.date)} · ${money(voucher.total)}`;
}

export function setFlash(message, tone = 'ok') {
  flash = { message, tone };
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flash = null;
    document.querySelector('.flash')?.remove();
  }, 3200);
}

export function money(value) {
  return fmtMoney(value);
}

export function balanceLabel(value) {
  const rounded = round2(value);
  if (Math.abs(rounded) < 0.005) return `${money(0)}`;
  return `${money(Math.abs(rounded))} ${rounded > 0 ? 'Dr' : 'Cr'}`;
}

export function navigate(screen, extra = {}) {
  const keepLease =
    screen === 'voucherNew' &&
    activeLease?.recordType === 'voucher' &&
    extra.editId === activeLease.recordId;
  if (!keepLease) void releaseActiveLease();
  view = { screen, ...extra };
  if (screen !== 'voucherNew') draft = null;
  render();
}

export function requireCompany() {
  if (company()) return true;
  setFlash('Create a company first.', 'warn');
  navigate('companies');
  return false;
}

export function ledgerNameById(ledgerId) {
  return company()?.ledgers.find((ledger) => ledger.id === ledgerId)?.name ?? '';
}

export function ledgerIdByName(name) {
  const target = String(name ?? '').trim().toLowerCase();
  if (!target) return '';
  return company()?.ledgers.find((ledger) => ledger.name.trim().toLowerCase() === target)?.id ?? '';
}

export function ledgerDatalistHtml() {
  const active = company();
  if (!active) return '';
  return `<datalist id="ledger-options">${ledgerOptions(active)
    .map((ledger) => `<option value="${esc(ledger.name)}">${esc(ledger.groupName)}</option>`)
    .join('')}</datalist>`;
}

export function groupSelectOptions(selectedId) {
  const active = company();
  if (!active) return '';
  const byPrimary = new Map();
  for (const group of active.groups) {
    const primary = active.groups.find((item) => item.id === group.parentId) ?? group;
    const root = active.groups.find((item) => item.id === primary.parentId) ?? primary;
    if (!byPrimary.has(root.id)) byPrimary.set(root.id, []);
    byPrimary.get(root.id).push(group);
  }
  let html = '';
  for (const [rootId, groups] of byPrimary) {
    const root = active.groups.find((group) => group.id === rootId);
    html += `<optgroup label="${esc(root.name)} · ${esc(root.nature)}">`;
    for (const group of groups) {
      const selected = group.id === selectedId ? ' selected' : '';
      const depth = group.parentId ? '— ' : '';
      html += `<option value="${esc(group.id)}"${selected}>${depth}${esc(group.name)}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

export function reportPeriod(active) {
  return {
    from: filters.period.from || active.fyStart,
    to: filters.period.to || active.fyEnd,
  };
}

export function periodBar(formId, from, to, extra = '') {
  return `<form id="${formId}" class="filter-bar">
    <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
    <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
    ${extra}
    <button class="btn small" type="submit">Apply</button>
  </form>`;
}

export function asOnBar(formId, to) {
  return `<form id="${formId}" class="filter-bar">
    <label class="field inline-field"><span>As on</span><input name="to" type="date" value="${esc(to)}" data-period></label>
    <button class="btn small" type="submit">Apply</button>
  </form>`;
}

export function groupParentOptions(selectedId = '', excludeId = null) {
  const active = company();
  if (!active) return '';
  const depthOf = (group) => {
    let depth = 0;
    let cursor = group;
    while (cursor && cursor.parentId && depth < 8) {
      cursor = active.groups.find((item) => item.id === cursor.parentId);
      depth += 1;
    }
    return depth;
  };

  let html = '';
  for (const root of active.groups.filter((group) => !group.parentId)) {
    const options = active.groups.filter(
      (group) => group.id !== excludeId && primaryKeyOf(active, group.id) === root.key,
    );
    if (options.length === 0) continue;
    html += `<optgroup label="${esc(root.name)} · ${esc(root.nature)}">`;
    for (const group of options) {
      const selected = group.id === selectedId ? ' selected' : '';
      html += `<option value="${esc(group.id)}"${selected}>${'— '.repeat(depthOf(group))}${esc(group.name)}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

export function costCentreSelectOptions(active, selectedId) {
  const centres = active.costCentres ?? [];
  if (centres.length === 0) return '<option value="">—</option>';
  let html = '<option value="">—</option>';
  for (const category of active.costCategories ?? []) {
    const options = centres.filter((centre) => centre.categoryId === category.id);
    if (options.length === 0) continue;
    html += `<optgroup label="${esc(category.name)}">`;
    for (const centre of options) {
      html += `<option value="${esc(centre.id)}"${centre.id === selectedId ? ' selected' : ''}>${esc(centre.name)}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

export function bankLedgerSelectOptions(active, selectedId) {
  const banks = active.ledgers
    .filter((ledger) => groupChainKeys(active, ledger.groupId).includes('bank'))
    .sort((a, b) => a.name.localeCompare(b.name));
  return banks
    .map(
      (ledger) => `<option value="${esc(ledger.id)}"${ledger.id === selectedId ? ' selected' : ''}>${esc(ledger.name)}</option>`,
    )
    .join('');
}

export function suggestedLedger(groupKey) {
  const active = company();
  if (!active) return '';
  const match = active.ledgers.find((ledger) => primaryKeyOf(active, ledger.groupId) === groupKey);
  return match ? match.id : '';
}

export function voucherFormLines(type) {
  const defaults = {
    Contra: [['Dr', 'cash'], ['Cr', 'bank']],
    Payment: [['Dr', ''], ['Cr', 'cash']],
    Receipt: [['Dr', 'cash'], ['Cr', '']],
    Journal: [['Dr', ''], ['Cr', '']],
    Sales: [['Dr', ''], ['Cr', 'sales']],
    Purchase: [['Dr', 'purchase'], ['Cr', '']],
    CreditNote: [['Dr', 'sales'], ['Cr', '']],
    DebitNote: [['Dr', ''], ['Cr', 'purchase']],
  }[type] ?? [['Dr', ''], ['Cr', '']];
  return defaults.map(([side, groupKey]) => ({
    side,
    ledgerId: groupKey ? suggestedLedger(groupKey) : '',
    amount: '',
  }));
}

export function prepareDraft(type, source = null) {
  const active = company();
  if (!active) return null;
  const today = todayIso();
  const openToday = (active.years ?? []).some(
    (year) => !year.closed && today >= year.start && today <= year.end,
  );
  draft = {
    type: source?.type ?? type,
    date: source?.date ?? (openToday ? today : active.fyStart),
    narration: source?.narration ?? '',
    bill: {
      ref: source?.bill?.ref ?? '',
      dueDate: source?.bill?.dueDate ?? '',
    },
    instrument: {
      kind: source?.instrument?.kind ?? '',
      number: source?.instrument?.number ?? '',
      date: source?.instrument?.date ?? '',
      bankLedgerId: source?.instrument?.bankLedgerId ?? '',
    },
    gst: {
      rateId: source?.gst?.rateId ?? '',
      partyGstin: source?.gst?.partyGstin ?? '',
      placeOfSupply: source?.gst?.placeOfSupply ?? '',
      reverseCharge: Boolean(source?.gst?.reverseCharge),
    },
    tds: {
      sectionId: source?.tds?.sectionId ?? '',
      pan: source?.tds?.pan ?? '',
    },
    currencyCode: source?.currencyCode ?? 'INR',
    exchangeRate: source?.exchangeRate != null ? String(source.exchangeRate) : '',
    orderId: null,
    lines: source
      ? source.lines.map((line) => ({
          ...line,
          amount: line.currencyAmount ?? line.amount,
          allocations: (line.allocations ?? []).map((allocation) => ({ ...allocation })),
        }))
      : voucherFormLines(type),
    items: source?.items ? source.items.map((line) => ({ ...line })) : [],
  };
  inlineLedger = null;
  return draft;
}

const VOUCHER_DRAFT_PREFIX = 'zc.voucherDraft.';
let voucherDraftTimer = null;

function voucherDraftKey(companyId, type) {
  return `${VOUCHER_DRAFT_PREFIX}${companyId}.${type}`;
}

export function readVoucherDraft(company, type) {
  if (!company?.id || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(voucherDraftKey(company.id, type));
    if (!raw || raw.length > 200000) return null;
    const saved = JSON.parse(raw);
    if (!saved || saved.type !== type || !Array.isArray(saved.lines)) return null;
    return saved;
  } catch {
    return null;
  }
}

export function clearVoucherDraft(company, type) {
  if (!company?.id || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(voucherDraftKey(company.id, type));
  } catch {
    // A full or unavailable storage area should not block voucher entry.
  }
}

function saveVoucherDraft() {
  if (!draft || view.screen !== 'voucherNew' || view.editId || view.pendingEdit) return;
  const active = company();
  const form = document.getElementById('voucher-form');
  if (!active?.id || !form || typeof localStorage === 'undefined') return;
  try {
    const snapshot = { ...readVoucherForm(), orderId: draft.orderId || '' };
    localStorage.setItem(voucherDraftKey(active.id, snapshot.type), JSON.stringify(snapshot));
  } catch {
    // Ignore quota errors; the draft is a convenience, not the save of record.
  }
}

function scheduleVoucherDraftSave() {
  if (voucherDraftTimer) clearTimeout(voucherDraftTimer);
  voucherDraftTimer = setTimeout(saveVoucherDraft, 400);
}

export function openVoucher(type) {
  if (!requirePermission('voucher.write')) return;
  if (!requireCompany()) return;
  const active = company();
  const saved = readVoucherDraft(active, type);
  prepareDraft(type, saved);
  if (saved) {
    draft.orderId = saved.orderId || null;
    setFlash('Restored your unsaved voucher draft.');
  }
  navigate('voucherNew', { type });
}

export async function openAlter(voucherId) {
  if (!requirePermission('voucher.write')) return false;
  const active = company();
  if (!active) return false;
  const voucher = active.vouchers.find((item) => item.id === voucherId);
  if (!voucher) {
    setFlash('Voucher not found.', 'warn');
    return false;
  }
  if (active.approvalsRequired && authRequired && authUser?.role !== 'owner') {
    setFlash('Owner approval is required before staff can alter posted vouchers.', 'warn');
    return false;
  }
  if (!(await acquireRecordLease('voucher', voucher.id))) return false;
  prepareDraft(voucher.type, voucher);
  navigate('voucherNew', { type: voucher.type, editId: voucher.id });
  return true;
}

export function openPendingVoucher(voucherId) {
  if (!requirePermission('voucher.write')) return false;
  const active = company();
  if (!active) return false;
  const voucher = (active.pendingVouchers ?? []).find((item) => item.id === voucherId);
  if (!voucher) {
    setFlash('Pending voucher not found.', 'warn');
    return false;
  }
  if (voucher.status !== 'pending') {
    setFlash('This voucher has already been decided.', 'warn');
    return false;
  }
  if (!authUser?.id || voucher.submittedBy?.id !== authUser.id) {
    setFlash('Only the person who submitted this voucher can edit it.', 'warn');
    return false;
  }
  prepareDraft(voucher.type, voucher);
  navigate('voucherNew', { type: voucher.type, editId: voucher.id, pendingEdit: true });
  return true;
}

export function duplicateVoucher(voucherId) {
  const active = company();
  if (!active) return;
  const voucher = active.vouchers.find((item) => item.id === voucherId);
  if (!voucher) {
    setFlash('Voucher not found.', 'warn');
    return;
  }
  const today = todayIso();
  const withinFy = today >= active.fyStart && today <= active.fyEnd;
  prepareDraft(voucher.type, { ...voucher, date: withinFy ? today : active.fyStart });
  navigate('voucherNew', { type: voucher.type });
  setFlash('Copied — review the details and accept.', 'ok');
}

export function orderToVoucher(orderId) {
  const active = company();
  if (!active || !requirePermission('voucher.write')) return;
  const order = (active.orders ?? []).find((entry) => entry.id === orderId);
  if (!order) {
    setFlash('Order not found.', 'warn');
    return;
  }
  const type = order.type === 'Sales' ? 'Sales' : 'Purchase';
  const party = (active.ledgers ?? []).find((ledger) => ledger.id === order.partyLedgerId);
  const controlId = suggestedLedger(type === 'Sales' ? 'sales' : 'purchase');
  if (!party || !controlId) {
    setFlash(`Add a ${type === 'Sales' ? 'Sales' : 'Purchases'} ledger before converting this order.`, 'warn');
    return;
  }
  const remaining = orderRemainingItems(order);
  if (!remaining.length) {
    setFlash('This order is already fully fulfilled.', 'warn');
    return;
  }
  const total = round2(remaining.reduce((sum, line) => sum + line.amount, 0));
  prepareDraft(type);
  draft.orderId = order.id;
  draft.date = order.date;
  draft.lines = type === 'Sales'
    ? [
        { ledgerId: party.id, side: 'Dr', amount: total },
        { ledgerId: controlId, side: 'Cr', amount: total },
      ]
    : [
        { ledgerId: controlId, side: 'Dr', amount: total },
        { ledgerId: party.id, side: 'Cr', amount: total },
      ];
  draft.items = remaining.map((line) => ({ ...line }));
  if (remaining.length !== (order.items ?? []).length) {
    setFlash('Prefilled with the remaining quantity on this order.', 'ok');
  }
  draft.narration = `Against ${order.type === 'Sales' ? 'SO' : 'PO'}-${order.no}${order.narration ? ` · ${order.narration}` : ''}`;
  navigate('voucherNew', { type });
  setFlash(`Prefilled a ${type.toLowerCase()} voucher from ${order.type === 'Sales' ? 'SO' : 'PO'}-${order.no}. Review and accept it.`);
}

export function formLines(form) {
  const allocationsByLine = new Map();
  for (const row of form.querySelectorAll('tr.bill-allocation')) {
    const index = Number(row.dataset.line);
    const billId = row.querySelector('select.alloc-bill')?.value ?? '';
    const amount = row.querySelector('input.alloc-amount')?.value ?? '';
    if (billId && String(amount).trim() !== '') {
      allocationsByLine.set(index, [{ voucherId: billId, amount }]);
    }
  }
  return [...form.querySelectorAll('tr.line')].map((row, index) => {
    const line = {
      ledgerId: ledgerIdByName(row.querySelector('input.ledger').value),
      side: row.querySelector('select.side').value,
      amount: row.querySelector('input.amount').value,
      costCentreId: row.querySelector('select.cost-centre')?.value ?? '',
    };
    if (allocationsByLine.has(index)) line.allocations = allocationsByLine.get(index);
    return line;
  });
}

export function formBill(form) {
  const ref = form.querySelector('[name="billRef"]');
  const dueDate = form.querySelector('[name="billDueDate"]');
  return {
    ref: ref ? ref.value : '',
    dueDate: dueDate ? dueDate.value : '',
  };
}

export function formInstrument(form) {
  const kind = form.querySelector('[name="instrumentKind"]');
  if (!kind) return null;
  return {
    kind: kind.value,
    number: form.querySelector('[name="instrumentNumber"]')?.value ?? '',
    date: form.querySelector('[name="instrumentDate"]')?.value ?? '',
    bankLedgerId: form.querySelector('[name="instrumentBank"]')?.value ?? '',
  };
}

export function formGst(form) {
  const rate = form.querySelector('[name="gstRate"]');
  if (!rate) return null;
  return {
    rateId: rate.value,
    partyGstin: form.querySelector('[name="gstPartyGstin"]')?.value ?? '',
    placeOfSupply: form.querySelector('[name="gstPlaceOfSupply"]')?.value ?? '',
    reverseCharge: Boolean(form.querySelector('[name="gstReverseCharge"]')?.checked),
  };
}

export function formTds(form) {
  const section = form.querySelector('[name="tdsSection"]');
  if (!section) return null;
  return {
    sectionId: section.value,
    pan: form.querySelector('[name="tdsPan"]')?.value ?? '',
  };
}

export function tdsVoucherBlock(active) {
  const tds = active.tds ?? {};
  if (!tds.enabled || !['Purchase', 'Sales'].includes(draft.type)) return '';
  if (draft.currencyCode && draft.currencyCode !== 'INR') return '';
  const kind = draft.type === 'Purchase' ? 'TDS' : 'TCS';
  const sections = (tds.sections ?? []).filter((section) => section.kind === kind);
  const sectionOptions = [
    `<option value="">No ${kind}</option>`,
    ...sections.map(
      (section) =>
        `<option value="${esc(section.id)}"${draft.tds?.sectionId === section.id ? ' selected' : ''}>${esc(section.code)} · ${esc(section.label)} (${section.rate}%)</option>`,
    ),
  ].join('');
  return `<div class="tds-block">
      <div class="inventory-head">
        <h2>${kind}</h2>
        <span class="muted">${kind === 'TDS' ? 'Deducted from the supplier and posted to TDS Payable.' : 'Collected from the customer and posted to TCS Payable.'}</span>
      </div>
      <div class="gst-grid">
        <label class="field"><span>Section</span><select name="tdsSection">${sectionOptions}</select></label>
        <label class="field"><span>Party PAN</span>
          <input name="tdsPan" maxlength="10" placeholder="Optional deductee PAN" value="${esc(draft.tds?.pan ?? '')}">
        </label>
      </div>
      <div id="tds-summary" class="gst-summary"></div>
      <p class="muted small">One section applies to the whole voucher and the deduction is balanced into the party/cash line on save. Choosing “No TDS/TCS” keeps any payable line already on the voucher as a manual entry. GST and TDS/TCS cannot be combined on the same voucher yet.</p>
    </div>`;
}

export function gstVoucherBlock(active) {
  const gst = active.gst ?? {};
  if (!gst.enabled || !INVENTORY_TYPES.includes(draft.type)) return '';
  if (draft.currencyCode && draft.currencyCode !== 'INR') return '';
  const rateOptions = [
    `<option value="">No GST</option>`,
    ...(gst.rates ?? []).map(
      (rate) =>
        `<option value="${esc(rate.id)}"${draft.gst?.rateId === rate.id ? ' selected' : ''}>${esc(rate.label)}</option>`,
    ),
  ].join('');
  const stateOptions = [
    `<option value=""${draft.gst?.placeOfSupply ? '' : ' selected'}>Default · ${esc(gstStateName(gst.stateCode) || 'home state')}</option>`,
    ...GST_STATES.map(
      ([code, name]) =>
        `<option value="${code}"${draft.gst?.placeOfSupply === code ? ' selected' : ''}>${code} · ${esc(name)}</option>`,
    ),
  ].join('');
  return `<div class="gst-block">
      <div class="inventory-head">
        <h2>GST</h2>
        <span class="muted">Tax is computed from the taxable side and posted to the GST tax ledgers.</span>
      </div>
      <div class="gst-grid">
        <label class="field"><span>Rate</span><select name="gstRate">${rateOptions}</select></label>
        <label class="field"><span>Party GSTIN</span>
          <input name="gstPartyGstin" maxlength="15" placeholder="Blank for B2C" value="${esc(draft.gst?.partyGstin ?? '')}">
        </label>
        <label class="field"><span>Place of supply</span><select name="gstPlaceOfSupply">${stateOptions}</select></label>
        <label class="field gst-check">
          <input type="checkbox" name="gstReverseCharge"${draft.gst?.reverseCharge ? ' checked' : ''}>
          <span>Reverse charge</span>
        </label>
      </div>
      <div id="gst-summary" class="gst-summary"></div>
      <p class="muted small">One rate applies to the whole invoice. The party/cash line is the tax-inclusive total and is balanced on save. Choosing “No GST” keeps any tax lines already on the voucher as ordinary manual entries.</p>
    </div>`;
}

export function captureDraft() {
  if (!draft || view.screen !== 'voucherNew') return;
  const form = document.getElementById('voucher-form');
  if (!form) return;
  draft.date = form.querySelector('[name="date"]').value;
  draft.narration = form.querySelector('[name="narration"]').value;
  draft.currencyCode = form.querySelector('[name="currencyCode"]')?.value ?? 'INR';
  draft.exchangeRate = form.querySelector('[name="exchangeRate"]')?.value ?? '';
  draft.bill = formBill(form);
  draft.instrument = formInstrument(form);
  draft.gst = formGst(form) ?? draft.gst;
  draft.tds = formTds(form) ?? draft.tds;
  draft.lines = formLines(form);
  const itemTable = document.getElementById('stock-items');
  if (itemTable) {
    draft.items = [...itemTable.querySelectorAll('tr.item-line')].map((row) => ({
      stockItemId: row.querySelector('select.item').value,
      godownId: row.querySelector('select.godown')?.value ?? '',
      batchNo: row.querySelector('input.batch')?.value ?? '',
      expiryDate: row.querySelector('input.expiry')?.value ?? '',
      qty: row.querySelector('input.qty').value,
      rate: row.querySelector('input.rate').value,
    }));
  }
}

export function readVoucherForm() {
  const form = document.getElementById('voucher-form');
  const itemTable = document.getElementById('stock-items');
  return {
    type: draft.type,
    ...(draft.orderId ? { orderId: draft.orderId } : {}),
    date: form.querySelector('[name="date"]').value,
    narration: form.querySelector('[name="narration"]').value,
    currencyCode: form.querySelector('[name="currencyCode"]')?.value ?? 'INR',
    exchangeRate: form.querySelector('[name="exchangeRate"]')?.value ?? '',
    bill: formBill(form),
    instrument: formInstrument(form),
    gst: formGst(form),
    tds: formTds(form),
    lines: formLines(form),
    items: itemTable
      ? [...itemTable.querySelectorAll('tr.item-line')].map((row) => ({
          stockItemId: row.querySelector('select.item').value,
          godownId: row.querySelector('select.godown')?.value ?? '',
          batchNo: row.querySelector('input.batch')?.value ?? '',
          expiryDate: row.querySelector('input.expiry')?.value ?? '',
          qty: row.querySelector('input.qty').value,
          rate: row.querySelector('input.rate').value,
        }))
      : [],
  };
}

export function stockItemSelectOptions(active, selectedId) {
  const units = new Map((active.units ?? []).map((unit) => [unit.id, unit]));
  let html = '<option value="">Select item…</option>';
  for (const item of active.stockItems ?? []) {
    const unit = units.get(item.unitId)?.symbol ?? '';
    html += `<option value="${esc(item.id)}"${item.id === selectedId ? ' selected' : ''}>${esc(item.name)}${unit ? ` · ${esc(unit)}` : ''}</option>`;
  }
  return html;
}

export function godownSelectOptions(active, selectedId) {
  const main = defaultGodownId(active);
  return (active.godowns ?? [])
    .map(
      (godown) => `<option value="${esc(godown.id)}"${(selectedId || main) === godown.id ? ' selected' : ''}>${esc(godown.name)}</option>`,
    )
    .join('');
}

export function itemLineAmount(line) {
  const qty = parseQty(line.qty) ?? 0;
  const rate = parseAmount(line.rate) ?? 0;
  return round2(qty * rate);
}

export function gstTaxableValue(form, active) {
  if (!draft || !GST_TAXABLE_SIDE[draft.type]) return null;
  if (!form.querySelector('[name="gstRate"]')?.value) return null;
  const side = GST_TAXABLE_SIDE[draft.type];
  const taxLedgerIds = new Set(Object.values(gstTaxLedgers(active)).map((ledger) => ledger.id));
  let taxable = 0;
  for (const row of form.querySelectorAll('tr.line')) {
    if (row.querySelector('select.side').value !== side) continue;
    if (taxLedgerIds.has(ledgerIdByName(row.querySelector('input.ledger').value))) continue;
    taxable = round2(taxable + (parseAmount(row.querySelector('input.amount').value) ?? 0));
  }
  return taxable;
}

export function tdsBaseValue(form) {
  if (!draft || !['Purchase', 'Sales'].includes(draft.type)) return null;
  if (!form.querySelector('[name="tdsSection"]')?.value) return null;
  const side = draft.type === 'Purchase' ? 'Dr' : 'Cr';
  let base = 0;
  for (const row of form.querySelectorAll('tr.line')) {
    if (row.querySelector('select.side').value !== side) continue;
    base = round2(base + (parseAmount(row.querySelector('input.amount').value) ?? 0));
  }
  return base;
}

export function updateVoucherTotals() {
  const form = document.getElementById('voucher-form');
  const target = document.getElementById('voucher-totals');
  if (!form || !target) return;
  const active = company();
  const currencyCode = form.querySelector('[name="currencyCode"]')?.value || 'INR';
  const foreign = currencyCode !== 'INR';
  const rate = foreign ? parseAmount(form.querySelector('[name="exchangeRate"]')?.value) ?? 0 : 1;
  let foreignDebit = 0;
  let foreignCredit = 0;
  let debit = 0;
  let credit = 0;
  for (const row of form.querySelectorAll('tr.line')) {
    const amount = parseAmount(row.querySelector('input.amount').value) ?? 0;
    const base = round2(amount * rate);
    if (row.querySelector('select.side').value === 'Cr') {
      foreignCredit += amount;
      credit += base;
    } else {
      foreignDebit += amount;
      debit += base;
    }
  }
  foreignDebit = round2(foreignDebit);
  foreignCredit = round2(foreignCredit);
  debit = round2(debit);
  credit = round2(credit);
  const difference = round2(debit - credit);
  const foreignDifference = round2(foreignDebit - foreignCredit);
  const currency = (active?.currencies ?? []).find((item) => item.code === currencyCode);
  const foreignMoney = (value) => `${esc(currencyCode)} ${round2(value).toFixed(2)}`;

  for (const allocationRow of form.querySelectorAll('tr.bill-allocation')) {
    const lineRow = form.querySelectorAll('tr.line')[Number(allocationRow.dataset.line)];
    const target = allocationRow.querySelector('.party-amount');
    if (!lineRow || !target) continue;
    target.textContent = `${lineRow.querySelector('select.side').value} ${money(
      parseAmount(lineRow.querySelector('input.amount').value) ?? 0,
    )}`;
  }

  const itemTable = document.getElementById('stock-items');
  let itemTotal = null;
  if (itemTable) {
    itemTotal = 0;
    for (const row of itemTable.querySelectorAll('tr.item-line')) {
      const qty = parseQty(row.querySelector('input.qty').value) ?? 0;
      const rate = parseAmount(row.querySelector('input.rate').value) ?? 0;
      const amount = round2(qty * rate);
      row.querySelector('.item-amount').textContent = money(amount);
      itemTotal = round2(itemTotal + amount);
    }
    const gstBase = gstTaxableValue(form, active);
    const tdsBase = gstBase === null ? tdsBaseValue(form) : null;
    const compareBase = gstBase ?? tdsBase;
    const compareLabel = gstBase !== null ? 'GST taxable value' : tdsBase !== null ? 'TDS/TCS base' : 'voucher total';
    const itemGap = round2((compareBase ?? debit) - itemTotal);
    const note = document.getElementById('item-total-note');
    if (note) {
      note.textContent = !itemTotal
        ? ''
        : Math.abs(itemGap) < 0.01
          ? `Stock items match the ${compareLabel}.`
          : `Stock items are ${money(Math.abs(itemGap))} ${itemGap > 0 ? 'below' : 'above'} the ${compareLabel}.`;
      note.className = Math.abs(itemGap) < 0.01 ? 'muted ok-text' : 'muted off-text';
    }
  }

  const gstTarget = document.getElementById('gst-summary');
  if (gstTarget) {
    const rateId = form.querySelector('[name="gstRate"]')?.value ?? '';
    const rate = (active?.gst?.rates ?? []).find((entry) => entry.id === rateId);
    if (!rate) {
      gstTarget.innerHTML = '<span class="muted">No GST on this voucher.</span>';
    } else {
      const taxable = gstTaxableValue(form, active) ?? 0;
      const placeOfSupply = form.querySelector('[name="gstPlaceOfSupply"]')?.value || active.gst.stateCode;
      const intra = placeOfSupply === active.gst.stateCode;
      const tax = round2((taxable * rate.rate) / 100);
      const half = round2(tax / 2);
      const cgst = intra ? half : 0;
      const sgst = intra ? round2(tax - half) : 0;
      const igst = intra ? 0 : tax;
      const cess = round2((taxable * (rate.cess ?? 0)) / 100);
      const gross = round2(taxable + cgst + sgst + igst + cess);
      gstTarget.innerHTML = `
        <span>Taxable <strong>${money(taxable)}</strong></span>
        <span>${intra ? 'CGST' : 'IGST'} <strong>${money(intra ? cgst : igst)}</strong></span>
        ${intra ? `<span>SGST <strong>${money(sgst)}</strong></span>` : ''}
        ${cess ? `<span>Cess <strong>${money(cess)}</strong></span>` : ''}
        <span>Tax <strong>${money(round2(cgst + sgst + igst + cess))}</strong></span>
        <span class="gst-total">Party/cash line will be <strong>${money(gross)}</strong></span>`;
    }
  }

  const tdsTarget = document.getElementById('tds-summary');
  if (tdsTarget) {
    const sectionId = form.querySelector('[name="tdsSection"]')?.value ?? '';
    const section = (active?.tds?.sections ?? []).find((entry) => entry.id === sectionId);
    if (!section) {
      tdsTarget.innerHTML = '<span class="muted">No TDS/TCS on this voucher.</span>';
    } else {
      const base = tdsBaseValue(form) ?? 0;
      const amount = round2((base * section.rate) / 100);
      const partyTotal = section.kind === 'TDS' ? round2(base - amount) : round2(base + amount);
      tdsTarget.innerHTML = `
        <span>Base <strong>${money(base)}</strong></span>
        <span>${esc(section.code)} <strong>${section.rate}%</strong></span>
        <span>${section.kind} <strong>${money(amount)}</strong></span>
        <span class="gst-total">Party/cash line will be <strong>${money(partyTotal)}</strong></span>`;
    }
  }

  target.innerHTML = foreign
    ? `
    <span>Debit <strong>${foreignMoney(foreignDebit)}</strong></span>
    <span>Credit <strong>${foreignMoney(foreignCredit)}</strong></span>
    <span class="${Math.abs(foreignDifference) < 0.01 ? 'flat' : 'off'}">Difference <strong>${foreignMoney(foreignDifference)}</strong></span>
    <span class="currency-note">At ${esc(currency?.symbol ?? currencyCode)} 1 = ${money(rate)} · base Dr ${money(debit)} / Cr ${money(credit)}</span>`
    : `
    <span>Debit <strong>${money(debit)}</strong></span>
    <span>Credit <strong>${money(credit)}</strong></span>
    <span class="${Math.abs(difference) < 0.01 ? 'flat' : 'off'}">Difference <strong>${money(difference)}</strong></span>
    ${itemTotal === null ? '' : `<span class="${Math.abs(round2((gstTaxableValue(form, active) ?? tdsBaseValue(form) ?? debit) - itemTotal)) < 0.01 ? 'flat' : 'off'}">Items <strong>${money(itemTotal)}</strong></span>`}`;
}

export function headerHtml(active) {
  return `
    <header class="topbar">
      <div class="brand"><svg class="brand-mark" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M 82 40 H 174 A 20 20 0 0 1 194 60 V 196 A 20 20 0 0 1 174 216 H 82 A 20 20 0 0 1 62 196 V 60 A 20 20 0 0 1 82 40 Z M 76 67 H 180 V 93 L 110 163 H 180 V 189 H 76 V 163 L 146 93 H 76 Z"/></svg>Zledger<span>CRAFT</span></div>
      <div class="company-line">
        ${active
          ? `<span class="label">Company</span> <strong>${esc(active.name)}</strong>
             <span class="sep">/</span>
             <label class="year-picker"><span class="label">FY</span>
               <select id="year-select" aria-label="Financial year">
                 ${(active.years ?? [{ id: active.yearId, start: active.fyStart, end: active.fyEnd, closed: false }])
                   .map(
                     (year) => `<option value="${esc(year.id)}"${year.id === active.yearId ? ' selected' : ''}>${esc(dateLabel(year.start))} – ${esc(dateLabel(year.end))}${year.closed ? ' · closed' : ''}</option>`,
                   )
                   .join('')}
               </select>
             </label>`
          : '<span class="label">No company open</span>'}
      </div>
      <div class="topbar-actions">
        ${authRequired
          ? `<span class="user-badge" title="Signed-in server account"><strong>${esc(authUser?.name ?? 'Signed out')}</strong> · ${esc(roleLabel(authUser?.role))}</span>
             <button class="btn ghost" type="button" data-action="logout-server">Sign out</button>`
          : `<label class="user-picker" title="Local profile — access control, not authentication">
               <span class="label">User</span>
               <select id="user-select" aria-label="Active user">
                 ${(state.users ?? [])
                   .map(
                     (user) => `<option value="${esc(user.id)}"${user.id === state.currentUserId ? ' selected' : ''}>${esc(user.name)} · ${esc(roleLabel(user.role))}</option>`,
                   )
                   .join('')}
               </select>
             </label>`}
        <span class="today">${esc(dateLabel(todayIso()))}</span>
        <button class="btn ghost" data-screen="companies" type="button">Company <kbd>F3</kbd></button>
      </div>
    </header>`;
}

export function asideHtml(active) {
  const items = [
    ['gateway', 'Gateway', 'Esc'],
    ['masters', 'Masters', 'K'],
    ['vouchers', 'Vouchers', 'V'],
    ['payroll', 'Payroll', ''],
    ['daybook', 'Day Book', 'D'],
    ['ledgerPick', 'Ledger', 'L'],
    ['inventory', 'Inventory', 'I'],
    ['orders', 'Orders', ''],
  ];
  const reports = [
    ['trial', 'Trial Balance', 'T'],
    ['pnl', 'Profit & Loss', 'P'],
    ['balanceSheet', 'Balance Sheet', 'B'],
    ['cashBank', 'Cash & Bank', 'C'],
    ['bankRecon', 'Bank Reconciliation', ''],
    ['postDated', 'Cheque / DD Register', ''],
    ['costCentres', 'Cost Centres', ''],
    ['budgets', 'Budgets', ''],
    ['forex', 'Forex Revaluation', ''],
    ['gst', 'GST returns', ''],
    ['tds', 'TDS / TCS', ''],
    ['einvoice', 'E-invoice', ''],
    ['ewaybill', 'E-way bill', ''],
    ['taxAudit', 'Tax audit', ''],
    ['registers', 'Registers', 'R'],
    ['outstanding', 'Outstanding', 'O'],
    ['billRegister', 'Bill-wise register', ''],
    ['partyStatement', 'Party statement', ''],
    ['groupSummary', 'Group Summary', 'G'],
    ['cashFlow', 'Cash Flow', 'F'],
    ['ratios', 'Ratios', 'Y'],
    ['statistics', 'Statistics', 'S'],
    ['audit', 'Audit trail', ''],
  ];
  const navButton = ([screen, label, key]) => `
          <button type="button" class="nav-item ${view.screen === screen ? 'active' : ''}"
            aria-current="${view.screen === screen ? 'page' : 'false'}"
            data-screen="${screen}">
            <span>${label}</span>${key ? `<kbd>${key}</kbd>` : ''}
          </button>`;
  const stats = active ? dashboard(active) : null;
  return `
    <aside class="sidebar">
      <nav aria-label="Primary">
        ${items.map(navButton).join('')}
        <p class="nav-heading">Reports</p>
        ${reports.map(navButton).join('')}
      </nav>
      ${stats
        ? `<div class="side-stats">
            <div><span>Cash</span><strong>${money(stats.cash)}</strong></div>
            <div><span>Bank</span><strong>${money(stats.bank)}</strong></div>
            <div><span>Vouchers</span><strong>${stats.vouchers}</strong></div>
            <div><span>Net P&amp;L</span><strong class="${stats.netProfit < 0 ? 'neg' : ''}">${money(stats.netProfit)}</strong></div>
          </div>`
        : ''}
      <p class="side-note">${workspaceMode ? (authRequired ? 'LAN server workspace. Data stays on the server.' : 'Local server workspace. Data stays on this machine.') : 'Local-only. Data stays in this browser.'}</p>
    </aside>`;
}

export function footerHtml() {
  const hints = [...HOTKEYS];
  if (view.screen === 'voucherNew') hints.push(['Alt+S', 'Save voucher']);
  return `<footer class="statusbar">
    ${hints.map(([key, label]) => `<span class="hint"><kbd>${key}</kbd> ${label}</span>`).join('')}
  </footer>`;
}

export function flashHtml() {
  if (!flash) return '';
  return `<div class="flash ${flash.tone}" role="status" aria-live="polite">${esc(flash.message)}</div>`;
}

export function roleBannerHtml() {
  const user = currentProfile();
  if (!user || user.role === 'owner') return '';
  if (user.role === 'viewer') {
    return authRequired
      ? '<div class="role-banner warn" role="status">Viewer account — read-only. Reports, search, print and CSV are available.</div>'
      : '<div class="role-banner warn" role="status">Viewer profile — read-only. Reports, search, print and CSV are available; switching profile is not a sign-in.</div>';
  }
  return authRequired
    ? '<div class="role-banner" role="status">Accountant account — vouchers and masters are editable; companies, financial years, accounts and restores are owner-only.</div>'
    : '<div class="role-banner" role="status">Accountant profile — vouchers and masters are editable; companies, financial years, users and restores are owner-only.</div>';
}





export function screenTitle() {
  if (view.screen === 'voucherNew') {
    return `${view.pendingEdit ? 'Revise pending' : view.editId ? 'Alter' : 'New'} ${voucherLabel(view.type || 'Payment')} voucher`;
  }
  return SCREEN_TITLES[view.screen] ?? REPORT_TITLES[view.screen] ?? 'ZledgerCraft';
}



export function auditActionLabel(action) {
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];
  return String(action || 'Activity')
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function reportPeriodLabel() {
  const active = company();
  if (!active) return '';
  const fromDefault = dateLabel(active.fyStart);
  const toDefault = dateLabel(active.fyEnd);
  const span = (from, to) => `${dateLabel(from || active.fyStart)} to ${dateLabel(to || active.fyEnd)}`;
  if (view.screen === 'yearComparison') {
    const years = [...(active.years ?? [])].sort((a, b) => a.start.localeCompare(b.start));
    if (!years.length) return 'No financial years';
    return `${years.length} year${years.length === 1 ? '' : 's'} · ${dateLabel(years[0].start)} to ${dateLabel(years[years.length - 1].end)}`;
  }
  if (view.screen === 'audit') {
    const count = auditEntries(state).length;
    return `${count} recorded event${count === 1 ? '' : 's'}`;
  }
  if (view.screen === 'daybook') return span(filters.daybook.from, filters.daybook.to);
  if (view.screen === 'ledger') return span(filters.statement.from, filters.statement.to);
  if (view.screen === 'registers') return span(filters.register.from, filters.register.to);
  if (view.screen === 'inventory') return span(filters.stock.from, filters.stock.to);
  if (view.screen === 'orders') {
    return `${span(filters.orders.from, filters.orders.to)} · ${filters.orders.status || 'All'} orders`;
  }
  if (view.screen === 'cashBank') return span(filters.cashBook.from, filters.cashBook.to);
  if (view.screen === 'postDated') {
    return `${span(filters.postDated.from, filters.postDated.to)} · as on ${dateLabel(filters.postDated.asOn || todayIso())}`;
  }
  if (view.screen === 'costCentres' || view.screen === 'costCentreDetail') {
    return span(filters.costCentres.from, filters.costCentres.to);
  }
  if (view.screen === 'forex') {
    return `As on ${dateLabel(filters.forex.asOn || todayIso())}`;
  }
  if (view.screen === 'gst') return span(filters.gst.from, filters.gst.to);
  if (view.screen === 'einvoice') return span(filters.einvoice.from, filters.einvoice.to);
  if (view.screen === 'ewaybill') {
    return `${span(filters.ewaybill.from, filters.ewaybill.to)} · threshold ${money(Number(filters.ewaybill.threshold) || 50000)}`;
  }
  if (view.screen === 'taxAudit') return span(filters.taxAudit.from, filters.taxAudit.to);
  if (view.screen === 'tds') {
    return `${filters.tds.kind === 'TCS' ? 'TCS' : 'TDS'} · ${span(filters.tds.from, filters.tds.to)}`;
  }
  if (view.screen === 'payrollRegister') {
    return span(filters.payroll.from, filters.payroll.to);
  }
  if (view.screen === 'payslip') {
    const run = (active.payroll?.runs ?? []).find((item) => item.id === view.runId);
    return run ? payrollMonthLabel(run.month) : 'Payroll';
  }
  if (view.screen === 'budgets') {
    const year =
      (active.years ?? []).find((item) => item.id === filters.budget.yearId) ??
      (active.years ?? []).find((item) => item.id === active.yearId);
    const range = year ? `${dateLabel(year.start)} to ${dateLabel(year.end)}` : `${fromDefault} to ${toDefault}`;
    return `${range} · as on ${dateLabel(filters.budget.asOn || todayIso())}`;
  }
  if (view.screen === 'outstanding') {
    return `As on ${dateLabel(filters.outstanding.asOn || active.fyEnd)}`;
  }
  if (view.screen === 'billRegister') {
    const to = filters.billRegister.to || active.fyEnd;
    const asOn = filters.billRegister.asOn || to;
    return `${span(filters.billRegister.from, to)} · status as on ${dateLabel(asOn)}`;
  }
  if (view.screen === 'partyStatement') {
    const ledger = active.ledgers.find((item) => item.id === (filters.partyStatement.ledgerId || view.id));
    return `${ledger ? `${ledger.name} · ` : ''}${span(filters.partyStatement.from, filters.partyStatement.to)}`;
  }
  if (['trial', 'balanceSheet', 'groupSummary', 'ratios', 'statistics'].includes(view.screen)) {
    return `As on ${dateLabel(filters.period.to || active.fyEnd)}`;
  }
  if (filters.period.from || filters.period.to) return span(filters.period.from, filters.period.to);
  return `${fromDefault} to ${toDefault}`;
}

export function reportToolbarHtml() {
  if (!REPORT_SCREENS.has(view.screen) || !company()) return '';
  const title = REPORT_TITLES[view.screen] ?? 'Report';
  return `<div class="report-toolbar">
    <span class="muted">${esc(title)} · ${esc(reportPeriodLabel())}</span>
    <div class="toolbar-actions">
      <button class="btn small ghost" type="button" data-action="print-report">Print</button>
      <button class="btn small ghost" type="button" data-action="export-xlsx">Export Excel</button>
      <button class="btn small ghost" type="button" data-action="export-csv">Export CSV</button>
    </div>
  </div>`;
}

export function printHeaderHtml() {
  if (!REPORT_SCREENS.has(view.screen) || !company()) return '';
  const title = REPORT_TITLES[view.screen] ?? 'Report';
  return `<div class="print-only print-head">
    <strong>${esc(company().name)}</strong>
    <span>${esc(title)} · ${esc(reportPeriodLabel())}</span>
  </div>`;
}

export function panel(title, body, subtitle = '') {
  return `<section class="panel">
    <div class="panel-head">
      <div>
        <h2>${title}</h2>
        ${subtitle ? `<p class="muted">${subtitle}</p>` : ''}
      </div>
    </div>
    ${body}
  </section>`;
}

export function emptyCompanyScreen(title) {
  return panel(
    title,
    `<p class="muted">Open or create a company to use this screen.</p>
     <button class="btn primary" type="button" data-screen="companies">Go to Company Info <kbd>F3</kbd></button>`,
  );
}

export function kpisHtml(stats) {
  const [year, month] = stats.monthLabel.split('-').map(Number);
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const stockLabel = stats.outOfStock
    ? `${stats.outOfStock} out of stock${stats.outOfStockNames.length ? ` · ${stats.outOfStockNames.join(', ')}` : ''}`
    : 'All items in stock';
  return `<div class="gateway-kpis">
    <button type="button" class="kpi" data-screen="registers">
      <span>Sales · ${esc(monthName)}</span>
      <strong>${money(stats.salesThisMonth)}</strong>
      <small>${stats.vouchersThisMonth} voucher${stats.vouchersThisMonth === 1 ? '' : 's'} this month</small>
    </button>
    <button type="button" class="kpi" data-screen="outstanding">
      <span>Receivables</span>
      <strong>${money(stats.receivables)}</strong>
      <small>Open customer bills</small>
    </button>
    <button type="button" class="kpi" data-screen="outstanding">
      <span>Payables</span>
      <strong>${money(stats.payables)}</strong>
      <small>Open supplier bills</small>
    </button>
    <button type="button" class="kpi" data-screen="inventory">
      <span>Stock</span>
      <strong class="${stats.outOfStock ? 'neg' : ''}">${stats.outOfStock}</strong>
      <small>${esc(stockLabel)}</small>
    </button>
  </div>`;
}

export function screenHtml() {
  switch (view.screen) {
    case 'companies':
      return companiesScreen();
    case 'masters':
      return mastersScreen();
    case 'vouchers':
      return vouchersScreen();
    case 'voucherNew':
      return voucherNewScreen();
    case 'voucherView':
      return voucherViewScreen();
    case 'daybook':
      return daybookScreen();
    case 'ledgerPick':
      return ledgerPickScreen();
    case 'ledger':
      return ledgerScreen();
    case 'trial':
      return trialScreen();
    case 'pnl':
      return pnlScreen();
    case 'balanceSheet':
      return balanceSheetScreen();
    case 'cashBank':
      return cashBankScreen();
    case 'bankRecon':
      return bankReconScreen();
    case 'postDated':
      return postDatedScreen();
    case 'costCentres':
      return costCentresScreen();
    case 'costCentreDetail':
      return costCentreDetailScreen();
    case 'budgets':
      return budgetsScreen();
    case 'forex':
      return forexScreen();
    case 'gst':
      return gstScreen();
    case 'tds':
      return tdsScreen();
    case 'einvoice':
      return eInvoiceScreen();
    case 'ewaybill':
      return ewayBillScreen();
    case 'compliance':
      return complianceScreen();
    case 'taxAudit':
      return taxAuditScreen();
    case 'payroll':
      return payrollScreen();
    case 'payrollRun':
      return payrollRunScreen();
    case 'payrollRegister':
      return payrollRegisterScreen();
    case 'payslip':
      return payslipScreen();
    case 'chequePrint':
      return chequePrintScreen();
    case 'registers':
      return registersScreen();
    case 'outstanding':
      return outstandingScreen();
    case 'exceptions':
      return exceptionsScreen();
    case 'consolidation':
      return consolidationScreen();
    case 'billRegister':
      return billRegisterScreen();
    case 'partyStatement':
      return partyStatementScreen();
    case 'groupSummary':
      return groupSummaryScreen();
    case 'groupVouchers':
      return groupVouchersScreen();
    case 'cashFlow':
      return cashFlowScreen();
    case 'ratios':
      return ratiosScreen();
    case 'statistics':
      return statisticsScreen();
    case 'yearComparison':
      return yearComparisonScreen();
    case 'audit':
      return auditScreen();
    case 'inventory':
      return inventoryScreen();
    case 'orders':
      return ordersScreen();
    case 'backup':
      return backupScreen();
    case 'importData':
      return importScreen();
    case 'gateway':
    default:
      return gatewayScreen();
  }
}

export function render() {
  const root = document.getElementById('app');
  if (!root) return;
  if (view.screen === 'voucherNew' && !draft) {
    const source = view.editId
      ? company()?.vouchers.find((item) => item.id === view.editId) ?? null
      : null;
    const saved = !source && !view.pendingEdit
      ? readVoucherDraft(company(), view.type || 'Payment')
      : null;
    prepareDraft(view.type || 'Payment', source ?? saved);
    if (!source && saved) draft.orderId = saved.orderId || null;
  }
  const active = company();
  const wasSearch = view.screen === 'ledgerPick';
  document.title = `${screenTitle()} · ZledgerCraft`;
  root.innerHTML = `
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <div class="app-shell">
      ${headerHtml(active)}
      ${asideHtml(active)}
      <main id="main-content" class="main${view.screen === 'chequePrint' ? ' cheque-print' : ''}">
        ${VISIBLE_H1_SCREENS.has(view.screen) ? '' : `<h1 class="sr-only">${esc(screenTitle())}</h1>`}
        ${flashHtml()}
        <div id="workspace-banner">${workspaceBannerHtml()}</div>
        ${roleBannerHtml()}
        ${printHeaderHtml()}
        ${reportToolbarHtml()}
        ${screenHtml()}
      </main>
      ${footerHtml()}
    </div>`;
  const nav = root.querySelector('.sidebar nav');
  const activeNav = nav?.querySelector('.nav-item.active');
  if (nav && activeNav && nav.scrollWidth > nav.clientWidth + 1) {
    nav.scrollLeft = activeNav.offsetLeft - (nav.clientWidth - activeNav.clientWidth) / 2;
  }
  if (view.screen === 'voucherNew') updateVoucherTotals();
  if (wasSearch) {
    const input = document.getElementById('ledger-search');
    if (input) input.value = view.search || '';
    filterLedgerRows(view.search || '');
  }
}

export function filterLedgerRows(term) {
  const needle = term.trim().toLowerCase();
  for (const row of document.querySelectorAll('.ledger-row')) {
    row.hidden = needle !== '' && !row.dataset.search.includes(needle);
  }
}

export function showFormError(message, targetId = 'form-error') {
  const target = document.getElementById(targetId);
  if (target) target.textContent = message;
}

export function submitPayload(data) {
  const payload = {
    name: data.get('name'),
    groupId: data.get('groupId'),
    opening: data.get('opening') || 0,
    openingType: data.get('openingType'),
  };
  if (data.has('gstin')) payload.gstin = data.get('gstin') || '';
  if (data.has('stateCode')) payload.stateCode = data.get('stateCode') || '';
  if (data.has('pan')) payload.pan = data.get('pan') || '';
  if (data.has('address')) payload.address = data.get('address') || '';
  if (data.has('city')) payload.city = data.get('city') || '';
  if (data.has('pin')) payload.pin = data.get('pin') || '';
  return payload;
}

export async function handleSubmit(event) {
  const form = event.target;
  event.preventDefault();

  if (form.id === 'login-form') {
    const data = new FormData(form);
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: data.get('username'), password: data.get('password'), code: data.get('code') || '' }),
    })
      .then(async (response) => {
        let payload = {};
        try {
          payload = await response.json();
        } catch {
          // Keep the status-based error below.
        }
        if (!response.ok || !payload.ok) throw new Error(payload.error || `Sign-in failed (${response.status}).`);
        if (payload.mfaRecoveryUsed) {
          window.alert('Recovery code accepted. Two-step verification has been disabled; enable it again with a new authenticator secret.');
        }
        location.reload();
      })
      .catch((error) => showFormError(error.message, 'login-error'));
    return;
  }

  if (form.id === 'signup-form') {
    const data = new FormData(form);
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        email: data.get('email'),
        password: data.get('password'),
      }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not create the account.');
        location.reload();
      })
      .catch((error) => showFormError(error.message, 'signup-error'));
    return;
  }

  if (form.id === 'forgot-password-form') {
    const data = new FormData(form);
    fetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: data.get('identifier') }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not request a reset link.');
        const status = document.getElementById('forgot-status');
        if (status) status.textContent = payload.message || 'If that account has an email address, a reset link has been sent.';
      })
      .catch((error) => showFormError(error.message, 'forgot-status'));
    return;
  }

  if (form.id === 'reset-password-form') {
    const data = new FormData(form);
    if (data.get('newPassword') !== data.get('confirmPassword')) {
      showFormError('The new passwords do not match.', 'reset-password-error');
      return;
    }
    fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: form.dataset.token, password: data.get('newPassword') }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Password reset failed.');
        history.replaceState({}, '', location.pathname);
        renderLogin(payload.message || 'Password reset. Sign in with the new password.', 'muted small');
      })
      .catch((error) => showFormError(error.message, 'reset-password-error'));
    return;
  }

  if (form.id === 'change-password-form') {
    const data = new FormData(form);
    if (data.get('newPassword') !== data.get('confirmPassword')) {
      showFormError('The new passwords do not match.', 'change-password-error');
      return;
    }
    fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: data.get('currentPassword'),
        newPassword: data.get('newPassword'),
        code: data.get('code') || '',
      }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Password change failed.');
        if (payload.mfaRecoveryUsed) {
          window.alert('Recovery code accepted. Two-step verification has been disabled; enable it again with a new authenticator secret.');
        }
        setFlash('Password changed. Other sessions were signed out.');
        render();
      })
      .catch((error) => showFormError(error.message, 'change-password-error'));
    return;
  }

  if (form.dataset.serverScope !== undefined) {
    if (!can('user.manage')) {
      requirePermission('user.manage');
      return;
    }
    const data = new FormData(form);
    const role = data.get('role');
    const mode = data.get('scopeMode');
    let companyIds = null;
    if (role !== 'owner' && mode === 'none') companyIds = [];
    if (role !== 'owner' && mode === 'selected') {
      companyIds = data.getAll('companyIds');
      if (!companyIds.length) {
        setFlash('Choose at least one company, or set access to No companies.', 'warn');
        return;
      }
    }
    fetch(`/api/auth/users/${encodeURIComponent(form.dataset.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ companyIds }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not update company access.');
        await refreshAuthAccounts();
        setFlash(`Company access updated for @${form.dataset.username}.`);
        render();
      })
      .catch((error) => {
        setFlash(error.message, 'warn');
        render();
      });
    return;
  }

  if (form.id === 'api-token-form') {
    if (!can('user.manage')) {
      requirePermission('user.manage');
      return;
    }
    const data = new FormData(form);
    const mode = data.get('scopeMode');
    const companyIds = mode === 'selected' ? data.getAll('companyIds') : null;
    if (mode === 'selected' && !companyIds.length) {
      showFormError('Choose at least one company, or allow all companies.', 'api-token-error');
      return;
    }
    fetch('/api/auth/api-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        scopes: ['books:read'],
        companyIds,
      }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not create the API token.');
        await refreshApiTokens();
        const access = payload.apiToken.companyIds === null
          ? 'all companies'
          : `${payload.apiToken.companyIds.length} selected company(ies)`;
        window.alert(`API token created for "${payload.apiToken.name}" (${access}).\n\n${payload.token}\n\nCopy it now. It is stored as a hash and cannot be shown again. Scope: books:read. It can read the books but cannot post or change anything.`);
        render();
      })
      .catch((error) => {
        setFlash(error.message, 'warn');
        render();
      });
    return;
  }

  if (form.id === 'server-user-form') {
    if (!can('user.manage')) {
      requirePermission('user.manage');
      return;
    }
    const data = new FormData(form);
    const role = data.get('role');
    const mode = data.get('scopeMode');
    let companyIds = null;
    if (role !== 'owner' && mode === 'none') companyIds = [];
    if (role !== 'owner' && mode === 'selected') {
      companyIds = data.getAll('companyIds');
      if (!companyIds.length) {
        showFormError('Choose at least one company, or set access to No companies.', 'server-user-error');
        return;
      }
    }
    fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        username: data.get('username'),
        email: data.get('email') || '',
        role,
        password: data.get('password'),
        companyIds,
      }),
    })
      .then(async (response) => {
        let payload = {};
        try {
          payload = await response.json();
        } catch {
          // Keep the status-based error below.
        }
        if (!response.ok || !payload.ok) throw new Error(payload.error || `Account creation failed (${response.status}).`);
        await refreshAuthAccounts();
        setFlash(`Server account "${payload.user.username}" created.`);
        render();
      })
      .catch((error) => showFormError(error.message, 'server-user-error'));
    return;
  }

  if (form.id === 'user-form') {
    if (!can('user.manage')) {
      requirePermission('user.manage');
      return;
    }
    const data = new FormData(form);
    const result = addUser(state, { name: data.get('name'), role: data.get('role') });
    if (!result.ok) {
      showFormError(result.error, 'user-error');
      return;
    }
    logAudit(
      'user.create',
      `Added ${roleLabel(result.user.role)} profile "${result.user.name}".`,
      company(),
      result.user.name,
    );
    persist();
    setFlash(`Profile "${result.user.name}" added as ${roleLabel(result.user.role)}.`);
    navigate('companies');
    return;
  }

  if (form.id === 'company-form') {
    if (!can('company.manage')) {
      requirePermission('company.manage');
      return;
    }
    const data = new FormData(form);
    const result = addCompany(state, data.get('name'), data.get('fyStart'));
    if (!result.ok) {
      showFormError(result.error);
      return;
    }
    logAudit(
      'company.create',
      `Created company "${result.company.name}" with FY starting ${dateLabel(result.company.fyStart)}.`,
      result.company,
      result.company.name,
    );
    persist();
    setFlash(`Company "${result.company.name}" created.`);
    navigate('gateway');
    return;
  }

  if (form.id === 'audit-form') {
    const data = new FormData(form);
    filters.audit = {
      companyId: String(data.get('companyId') || ''),
      q: String(data.get('q') || ''),
    };
    navigate('audit');
    return;
  }

  if (form.id === 'restore-form') {
    if (!can('data.restore')) {
      requirePermission('data.restore');
      return;
    }
    const data = new FormData(form);
    if (!window.confirm('Replace all current companies with this backup?')) return;
    const payload = String(data.get('payload') ?? '').trim();
    let plaintext = payload;
    if (isEncryptedBackup(payload)) {
      try {
        plaintext = await decryptBackup(payload, String(data.get('passphrase') ?? ''));
      } catch (error) {
        showFormError(error.message);
        return;
      }
    }
    const result = importState(plaintext);
    if (!result.ok) {
      showFormError(result.error);
      return;
    }
    saveSnapshot(state, 'pre-restore');
    applyRestoredState(
      result.state,
      `Restored backup with ${result.state.companies.length} company${result.state.companies.length === 1 ? '' : 'ies'}.`,
    );
    setFlash(`Backup restored: ${state.companies.length} company${state.companies.length === 1 ? '' : 'ies'}.`);
    navigate('gateway');
    return;
  }

  const active = company();
  if (!active) {
    showFormError('Create a company first.');
    return;
  }

  if (form.id === 'company-edit-form') {
    if (!can('company.manage')) {
      requirePermission('company.manage');
      return;
    }
    const data = new FormData(form);
    const previousName = active.name;
    const result = updateCompany(active, {
      name: data.get('name'),
      fyStart: data.get('fyStart'),
      requireApproval: data.get('requireApproval') === 'on',
      approvalThreshold: data.get('approvalThreshold'),
    });
    if (!result.ok) {
      showFormError(result.error, 'company-error');
      return;
    }
    logAudit(
      'company.update',
      previousName === active.name
        ? `Updated company "${active.name}".`
        : `Renamed company "${previousName}" to "${active.name}".`,
      active,
      active.name,
    );
    persist();
    setFlash('Company updated.');
    navigate('companies');
    return;
  }

  if (form.id === 'recurring-voucher-form') {
    if (!can('voucher.write')) {
      requirePermission('voucher.write');
      return;
    }
    const data = new FormData(form);
    const result = addRecurringVoucher(active, {
      voucherId: data.get('voucherId'),
      name: data.get('name'),
      frequency: data.get('frequency'),
      nextDate: data.get('nextDate'),
    });
    if (!result.ok) {
      showFormError(result.error, 'recurring-voucher-error');
      return;
    }
    logAudit('recurring.create', `Created recurring voucher template "${result.template.name}".`, active, result.template.id);
    persist();
    setFlash(`Recurring template "${result.template.name}" created.`);
    navigate('vouchers');
    return;
  }

  if (form.id === 'document-number-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const type = String(data.get('type') ?? '');
    const result = setNextVoucherNumber(active, type, data.get('next'));
    if (!result.ok) {
      showFormError(result.error, 'document-number-error');
      return;
    }
    logAudit('numbering.update', `Set the next ${type} voucher number to ${result.next}.`, active, type);
    persist();
    setFlash(`Next ${type} voucher number set to ${result.next}.`);
    navigate('masters');
    return;
  }

  if (form.id === 'ledger-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const editingId = view.editingLedgerId;
    const result = editingId
      ? updateLedger(active, editingId, submitPayload(data))
      : addLedger(active, submitPayload(data));
    if (!result.ok) {
      showFormError(result.error);
      return;
    }
    logAudit(
      editingId ? 'ledger.update' : 'ledger.create',
      `${editingId ? 'Updated' : 'Created'} ledger "${result.ledger.name}".`,
      active,
      result.ledger.name,
    );
    persist();
    setFlash(`Ledger "${result.ledger.name}" ${editingId ? 'updated' : 'created'}.`);
    navigate('masters');
    return;
  }

  if (form.id === 'group-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const editingId = view.editingGroupId;
    const payload = { name: data.get('name'), parentId: data.get('parentId') };
    const result = editingId ? updateGroup(active, editingId, payload) : addGroup(active, payload);
    if (!result.ok) {
      showFormError(result.error, 'group-error');
      return;
    }
    logAudit(
      editingId ? 'group.update' : 'group.create',
      `${editingId ? 'Updated' : 'Created'} group "${result.group.name}".`,
      active,
      result.group.name,
    );
    persist();
    setFlash(`Group "${result.group.name}" ${editingId ? 'updated' : 'created'}.`);
    navigate('masters');
    return;
  }

  if (form.id === 'consolidation-form') {
    const data = new FormData(form);
    filters.consolidation = { asOn: data.get('asOn') || '' };
    render();
    return;
  }

  if (form.id === 'exceptions-form') {
    const data = new FormData(form);
    filters.exceptions = { asOn: data.get('asOn') || '' };
    render();
    return;
  }

  if (form.id === 'stock-form') {
    const data = new FormData(form);
    filters.stock = { from: data.get('from') || '', to: data.get('to') || '' };
    render();
    return;
  }

  if (form.id === 'stock-item-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const batchRows = [...form.querySelectorAll('#stock-item-batches .opening-batch-row')]
      .map((row) => ({
        batchNo: row.querySelector('[name="openingBatchNo"]')?.value ?? '',
        qty: row.querySelector('[name="openingBatchQty"]')?.value ?? '',
        expiryDate: row.querySelector('[name="openingBatchExpiry"]')?.value ?? '',
      }))
      .filter((row) => row.batchNo.trim() || row.qty.trim() || row.expiryDate);
    const payload = {
      name: data.get('name'),
      stockGroupId: data.get('stockGroupId'),
      unitId: data.get('unitId'),
      openingQty: data.get('openingQty') || 0,
      openingRate: data.get('openingRate') || 0,
      hsn: data.get('hsn') || '',
      reorderLevel: data.get('reorderLevel') || 0,
      sellingPrice: data.get('sellingPrice') || 0,
      purchasePrice: data.get('purchasePrice') || 0,
      batchTracking: data.get('batchTracking') === 'on',
    };
    if (batchRows.length) payload.openingBatches = batchRows;
    else if (view.editingItemId) {
      const existing = (active.stockItems ?? []).find((item) => item.id === view.editingItemId);
      if (existing?.openingBatches?.length) payload.openingBatches = [];
    }
    const result = view.editingItemId
      ? updateStockItem(active, view.editingItemId, payload)
      : addStockItem(active, payload);
    if (!result.ok) {
      showFormError(result.error, 'stock-item-error');
      return;
    }
    logAudit(
      view.editingItemId ? 'stockItem.update' : 'stockItem.create',
      `${view.editingItemId ? 'Updated' : 'Created'} stock item "${result.item.name}".`,
      active,
      result.item.name,
    );
    persist();
    setFlash(`Stock item "${result.item.name}" ${view.editingItemId ? 'updated' : 'created'}.`);
    navigate('inventory');
    return;
  }

  if (form.id === 'unit-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = addUnit(active, { name: data.get('name'), symbol: data.get('symbol') });
    if (!result.ok) {
      showFormError(result.error, 'unit-error');
      return;
    }
    logAudit('unit.create', `Added unit "${result.unit.name}".`, active, result.unit.name);
    persist();
    setFlash(`Unit "${result.unit.name}" added.`);
    render();
    return;
  }

  if (form.id === 'stock-group-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = addStockGroup(active, { name: data.get('name') });
    if (!result.ok) {
      showFormError(result.error, 'stock-group-error');
      return;
    }
    logAudit('stockGroup.create', `Added stock group "${result.group.name}".`, active, result.group.name);
    persist();
    setFlash(`Stock group "${result.group.name}" added.`);
    render();
    return;
  }

  if (form.id === 'orders-filter') {
    const data = new FormData(form);
    filters.orders = {
      from: data.get('from') || '',
      to: data.get('to') || '',
      status: data.get('status') || 'All',
    };
    render();
    return;
  }

  if (form.id === 'quotation-form') {
    if (!can('voucher.write')) {
      requirePermission('voucher.write');
      return;
    }
    const data = new FormData(form);
    const items = [...form.querySelectorAll('#quotation-lines .order-row')].map((row) => ({
      stockItemId: row.querySelector('[name="orderItemId"]')?.value ?? '',
      godownId: row.querySelector('[name="orderGodownId"]')?.value ?? '',
      batchNo: row.querySelector('[name="orderBatchNo"]')?.value ?? '',
      expiryDate: row.querySelector('[name="orderExpiryDate"]')?.value ?? '',
      qty: row.querySelector('[name="orderQty"]')?.value ?? '',
      rate: row.querySelector('[name="orderRate"]')?.value ?? '',
    }));
    const result = addOrder(active, {
      kind: 'Quotation',
      type: 'Sales',
      date: data.get('date'),
      partyLedgerId: data.get('partyLedgerId'),
      deliveryDate: data.get('deliveryDate'),
      items,
      narration: data.get('narration'),
    });
    if (!result.ok) {
      showFormError(result.error, 'quotation-error');
      return;
    }
    logAudit('quotation.create', `Created quotation QTN-${result.order.no}.`, active, `QTN-${result.order.no}`);
    persist();
    setFlash(`Quotation QTN-${result.order.no} created.`);
    render();
    return;
  }

  if (form.id === 'order-form') {
    if (!can('voucher.write')) {
      requirePermission('voucher.write');
      return;
    }
    const data = new FormData(form);
    const items = [...form.querySelectorAll('#order-lines .order-row')].map((row) => ({
      stockItemId: row.querySelector('[name="orderItemId"]')?.value ?? '',
      godownId: row.querySelector('[name="orderGodownId"]')?.value ?? '',
      batchNo: row.querySelector('[name="orderBatchNo"]')?.value ?? '',
      expiryDate: row.querySelector('[name="orderExpiryDate"]')?.value ?? '',
      qty: row.querySelector('[name="orderQty"]')?.value ?? '',
      rate: row.querySelector('[name="orderRate"]')?.value ?? '',
    }));
    const result = addOrder(active, {
      type: data.get('type'),
      date: data.get('date'),
      partyLedgerId: data.get('partyLedgerId'),
      deliveryDate: data.get('deliveryDate'),
      items,
      narration: data.get('narration'),
    });
    if (!result.ok) {
      showFormError(result.error, 'order-error');
      return;
    }
    logAudit(
      'order.create',
      `Recorded ${result.order.type === 'Sales' ? 'sales' : 'purchase'} order ${result.order.type === 'Sales' ? 'SO' : 'PO'}-${result.order.no}.`,
      active,
      `${result.order.type === 'Sales' ? 'SO' : 'PO'}-${result.order.no}`,
    );
    persist();
    setFlash(`Order ${result.order.type === 'Sales' ? 'SO' : 'PO'}-${result.order.no} recorded.`);
    render();
    return;
  }

  if (form.id === 'godown-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = addGodown(active, { name: data.get('name') });
    if (!result.ok) {
      showFormError(result.error, 'godown-error');
      return;
    }
    logAudit('godown.create', `Added godown "${result.godown.name}".`, active, result.godown.name);
    persist();
    setFlash(`Godown "${result.godown.name}" added.`);
    render();
    return;
  }

  if (form.id === 'stock-count-start-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const date = String(data.get('date') ?? '');
    const godownId = String(data.get('godownId') ?? '');
    if (!date || !godownId) {
      setFlash('Choose a count date and godown.', 'warn');
      render();
      return;
    }
    view.stockCountDraft = { date, godownId };
    view.stockCountId = null;
    render();
    return;
  }

  if (form.id === 'stock-count-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const rows = [...form.querySelectorAll('[data-count-item]')].map((input) => ({
      stockItemId: input.dataset.countItem,
      batchNo:
        input.closest('tr')?.querySelector('[data-count-batch-input]')?.value ??
        input.dataset.countBatch ?? '',
      countedQty: input.value,
    }));
    const result = addStockCount(active, {
      date: data.get('date'),
      godownId: data.get('godownId'),
      narration: data.get('narration'),
      rows,
    });
    if (!result.ok) {
      showFormError(result.error, 'stock-count-error');
      return;
    }
    const differences = result.count.rows.filter((row) => Math.abs(row.difference) >= 0.0005).length;
    logAudit(
      'stockCount.create',
      `Recorded stock count SC-${result.count.no} with ${result.count.rows.length} item${result.count.rows.length === 1 ? '' : 's'} and ${differences} difference${differences === 1 ? '' : 's'}.`,
      active,
      `SC-${result.count.no}`,
    );
    persist();
    view.stockCountDraft = null;
    view.stockCountId = result.count.id;
    setFlash(`Stock count SC-${result.count.no} saved.`);
    render();
    return;
  }

  if (form.id === 'stock-transfer-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const items = [...form.querySelectorAll('#stock-transfer-lines .transfer-row')].map((row) => ({
      stockItemId: row.querySelector('[name="transferItemId"]')?.value ?? '',
      batchNo: row.querySelector('[name="transferBatchNo"]')?.value ?? '',
      qty: row.querySelector('[name="transferQty"]')?.value ?? '',
    }));
    const result = addStockTransfer(active, {
      date: data.get('date'),
      fromGodownId: data.get('fromGodownId'),
      toGodownId: data.get('toGodownId'),
      items,
      narration: data.get('narration'),
    });
    if (!result.ok) {
      showFormError(result.error, 'stock-transfer-error');
      return;
    }
    const lineCount = result.transfer.items.length;
    logAudit(
      'stockTransfer.create',
      `Transferred ${lineCount} item${lineCount === 1 ? '' : 's'} as ST-${result.transfer.no}.`,
      active,
      `ST-${result.transfer.no}`,
    );
    persist();
    setFlash(`Stock transfer ST-${result.transfer.no} recorded.`);
    render();
    return;
  }

  if (form.id === 'bom-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const componentIds = data.getAll('componentItemId');
    const componentQtys = data.getAll('componentQty');
    const components = componentIds
      .map((stockItemId, index) => ({ stockItemId, qty: componentQtys[index] }))
      .filter((line) => line.stockItemId || String(line.qty ?? '').trim());
    const result = addBom(active, {
      name: data.get('name'),
      outputItemId: data.get('outputItemId'),
      outputQty: data.get('outputQty'),
      components,
    });
    if (!result.ok) {
      showFormError(result.error, 'bom-error');
      return;
    }
    logAudit('bom.create', `Created BOM "${result.bom.name}".`, active, result.bom.name);
    persist();
    setFlash(`BOM "${result.bom.name}" created.`);
    render();
    return;
  }

  if (form.id === 'manufacture-form') {
    if (!can('voucher.write')) {
      requirePermission('voucher.write');
      return;
    }
    const data = new FormData(form);
    const result = addManufacture(active, {
      date: data.get('date'),
      bomId: data.get('bomId'),
      outputQty: data.get('outputQty'),
      wastageQty: data.get('wastageQty') || 0,
      componentGodownId: data.get('componentGodownId'),
      outputGodownId: data.get('outputGodownId'),
      outputBatchNo: data.get('outputBatchNo'),
      expiryDate: data.get('expiryDate'),
      narration: data.get('narration'),
    });
    if (!result.ok) {
      showFormError(result.error, 'manufacture-error');
      return;
    }
    logAudit(
      'manufacture.create',
      `Recorded production MFG-${result.manufacture.no} from BOM "${result.manufacture.bomName}".`,
      active,
      `MFG-${result.manufacture.no}`,
    );
    persist();
    setFlash(`Production MFG-${result.manufacture.no} recorded.`);
    render();
    return;
  }

  if (form.id === 'budget-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const [targetType, ...targetParts] = String(data.get('target') ?? '').split(':');
    const payload = {
      name: data.get('name'),
      targetType,
      targetId: targetParts.join(':'),
      yearId: data.get('yearId'),
      amount: data.get('amount'),
    };
    const editingBudgetId = view.editingBudgetId;
    const result = editingBudgetId
      ? updateBudget(active, editingBudgetId, payload)
      : addBudget(active, payload);
    if (!result.ok) {
      showFormError(result.error, 'budget-error');
      return;
    }
    logAudit(
      editingBudgetId ? 'budget.update' : 'budget.create',
      `${editingBudgetId ? 'Updated' : 'Added'} budget "${result.budget.name}".`,
      active,
      result.budget.name,
    );
    persist();
    setFlash(`Budget "${result.budget.name}" ${editingBudgetId ? 'updated' : 'added'}.`);
    if (editingBudgetId) navigate('masters');
    else render();
    return;
  }

  if (form.id === 'compliance-task-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const taskId = String(data.get('taskId') ?? '');
    const input = {
      title: data.get('title'),
      category: data.get('category'),
      dueDate: data.get('dueDate'),
      notes: data.get('notes'),
      filedOn: data.get('filedOn'),
      reference: data.get('reference'),
    };
    const result = taskId
      ? updateComplianceTask(active, taskId, input)
      : addComplianceTask(active, input);
    if (!result.ok) {
      showFormError(result.error, 'compliance-task-error');
      return;
    }
    logAudit(
      taskId ? 'compliance.update' : 'compliance.create',
      `${taskId ? 'Updated' : 'Added'} compliance task "${result.task.title}" due ${result.task.dueDate}.`,
      active,
      result.task.id,
    );
    persist();
    view.complianceTaskId = null;
    setFlash(taskId ? 'Compliance task updated.' : 'Compliance task added.');
    render();
    return;
  }

  if (form.id === 'gst-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = saveGstSettings(active, {
      enabled: data.get('enabled') === 'on',
      gstin: data.get('gstin'),
      legalName: data.get('legalName'),
      tradeName: data.get('tradeName'),
      address: data.get('address'),
      city: data.get('city'),
      pin: data.get('pin'),
      stateCode: data.get('stateCode'),
    });
    if (!result.ok) {
      showFormError(result.error, 'gst-error');
      return;
    }
    logAudit(
      'gst.settings',
      `${result.gst.enabled ? 'Enabled' : 'Disabled'} GST${result.gst.gstin ? ` for ${result.gst.gstin}` : ''}${result.created.length ? `; created ${result.created.join(', ')}` : ''}.`,
      active,
      result.gst.gstin || 'GST settings',
    );
    persist();
    setFlash(
      result.gst.enabled
        ? `GST enabled${result.created.length ? ` · created ${result.created.join(', ')}` : ''}.`
        : 'GST disabled. Existing tax vouchers are unchanged.',
    );
    render();
    return;
  }

  if (form.id === 'gst-rate-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const editingRateId = view.editingGstRateId;
    const payload = {
      label: data.get('label'),
      rate: data.get('rate'),
      cess: data.get('cess') || 0,
    };
    const result = editingRateId
      ? updateGstRate(active, editingRateId, payload)
      : addGstRate(active, payload);
    if (!result.ok) {
      showFormError(result.error, 'gst-rate-error');
      return;
    }
    logAudit(
      editingRateId ? 'gst.rate.update' : 'gst.rate',
      `${editingRateId ? 'Updated' : 'Added'} GST rate ${result.rate.label}.`,
      active,
      result.rate.label,
    );
    persist();
    setFlash(`GST rate ${result.rate.label} ${editingRateId ? 'updated' : 'added'}.`);
    if (editingRateId) navigate('gst');
    else render();
    return;
  }

  if (form.id === 'tds-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = saveTdsSettings(active, {
      enabled: data.get('enabled') === 'on',
      tan: data.get('tan'),
    });
    if (!result.ok) {
      showFormError(result.error, 'tds-error');
      return;
    }
    logAudit(
      'tds.settings',
      `${result.tds.enabled ? 'Enabled' : 'Disabled'} TDS/TCS${result.tds.tan ? ` for TAN ${result.tds.tan}` : ''}${result.created.length ? `; created ${result.created.join(', ')}` : ''}.`,
      active,
      result.tds.tan || 'TDS/TCS settings',
    );
    persist();
    setFlash(
      result.tds.enabled
        ? `TDS/TCS enabled${result.created.length ? ` · created ${result.created.join(', ')}` : ''}.`
        : 'TDS/TCS disabled. Existing deductions are unchanged.',
    );
    render();
    return;
  }

  if (form.id === 'tds-section-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const editingSectionId = view.editingTdsSectionId;
    const payload = {
      kind: data.get('kind'),
      code: data.get('code'),
      label: data.get('label'),
      rate: data.get('rate'),
      threshold: data.get('threshold') || 0,
    };
    const result = editingSectionId
      ? updateTdsSection(active, editingSectionId, payload)
      : addTdsSection(active, payload);
    if (!result.ok) {
      showFormError(result.error, 'tds-section-error');
      return;
    }
    logAudit(
      editingSectionId ? 'tds.section.update' : 'tds.section',
      `${editingSectionId ? 'Updated' : 'Added'} ${result.section.kind} section ${result.section.code} at ${result.section.rate}%.`,
      active,
      `${result.section.kind} ${result.section.code}`,
    );
    persist();
    setFlash(`${result.section.kind} section ${result.section.code} ${editingSectionId ? 'saved' : 'added'}.`);
    if (editingSectionId) navigate('tds');
    else render();
    return;
  }

  if (form.id === 'tax-challan-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = addTaxChallan(active, {
      kind: data.get('kind'),
      date: data.get('date'),
      amount: data.get('amount'),
      reference: data.get('reference'),
      bsrCode: data.get('bsrCode'),
      sectionId: data.get('sectionId'),
    });
    if (!result.ok) {
      showFormError(result.error, 'challan-error');
      return;
    }
    logAudit(
      'tds.challan',
      `Recorded ${result.challan.kind} challan ${result.challan.reference || result.challan.id} for ${money(result.challan.amount)}.`,
      active,
      result.challan.reference || result.challan.kind,
    );
    persist();
    setFlash(`${result.challan.kind} challan recorded for ${money(result.challan.amount)}.`);
    render();
    return;
  }

  if (form.id === 'payroll-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = savePayrollSettings(active, { enabled: data.get('enabled') === 'on' });
    if (!result.ok) {
      showFormError(result.error, 'payroll-error');
      return;
    }
    logAudit(
      'payroll.settings',
      `${result.payroll.enabled ? 'Enabled' : 'Disabled'} payroll${result.created.length ? `; created ${result.created.join(', ')}` : ''}.`,
      active,
      'Payroll settings',
    );
    persist();
    setFlash(
      result.payroll.enabled
        ? `Payroll enabled${result.created.length ? ` · created ${result.created.join(', ')}` : ''}.`
        : 'Payroll disabled. Existing runs and payslips are unchanged.',
    );
    render();
    return;
  }

  if (form.id === 'payroll-head-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = addPayHead(active, {
      name: data.get('name'),
      kind: data.get('kind'),
      statutory: data.get('statutory'),
      ledgerId: data.get('ledgerId'),
    });
    if (!result.ok) {
      showFormError(result.error, 'payroll-head-error');
      return;
    }
    logAudit('payroll.head', `Added ${result.payHead.kind.toLowerCase()} pay head "${result.payHead.name}".`, active, result.payHead.name);
    persist();
    setFlash(`Pay head "${result.payHead.name}" added.`);
    render();
    return;
  }

  if (form.id === 'payroll-report-form') {
    const data = new FormData(form);
    filters.payroll = { ...filters.payroll, from: data.get('from'), to: data.get('to') };
    render();
    return;
  }

  if (form.id === 'employee-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const pay = (active.payroll?.payHeads ?? []).map((head) => ({
      payHeadId: head.id,
      amount: data.get(`pay_${head.id}`) || 0,
    }));
    const payload = {
      name: data.get('name'),
      code: data.get('code'),
      designation: data.get('designation'),
      pan: data.get('pan'),
      bankName: data.get('bankName'),
      bankAccount: data.get('bankAccount'),
      ifsc: data.get('ifsc'),
      dateOfJoining: data.get('dateOfJoining'),
      dateOfExit: data.get('dateOfExit'),
      active: data.get('active') === 'on',
      pay,
    };
    const editingId = view.employeeId;
    const result = editingId ? updateEmployee(active, editingId, payload) : addEmployee(active, payload);
    if (!result.ok) {
      showFormError(result.error, 'employee-error');
      return;
    }
    logAudit(
      editingId ? 'employee.update' : 'employee.create',
      `${editingId ? 'Updated' : 'Added'} employee "${result.employee.name}".`,
      active,
      result.employee.name,
    );
    persist();
    setFlash(`Employee "${result.employee.name}" ${editingId ? 'updated' : 'added'}.`);
    navigate('payroll');
    return;
  }

  if (form.id === 'payroll-run-form') {
    if (!can('voucher.write')) {
      requirePermission('voucher.write');
      return;
    }
    const data = new FormData(form);
    const paidDays = {};
    for (const input of form.querySelectorAll('[data-payroll-paid]')) {
      paidDays[input.dataset.payrollPaid] = input.value;
    }
    const result = runPayroll(active, { month: data.get('month'), date: data.get('date'), paidDays });
    if (!result.ok) {
      showFormError(result.error, 'payroll-run-error');
      return;
    }
    logAudit(
      'payroll.run',
      `Ran payroll for ${result.run.month}: ${result.run.totals.employees} employee(s), ${money(result.run.totals.gross)} gross and ${money(result.run.totals.net)} net, posted as Journal ${result.voucher.no}.`,
      active,
      `${result.run.month}`,
    );
    persist();
    setFlash(
      `Payroll for ${payrollMonthLabel(result.run.month)} posted · ${money(result.run.totals.net)} net to Salary Payable.`,
    );
    navigate('payrollRun', { id: result.run.id });
    return;
  }

  if (form.id === 'currency-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = addCurrency(active, {
      code: data.get('code'),
      name: data.get('name'),
      symbol: data.get('symbol'),
      date: data.get('date'),
      rate: data.get('rate'),
    });
    if (!result.ok) {
      showFormError(result.error, 'currency-error');
      return;
    }
    logAudit('currency.create', `Added currency ${result.currency.code} at ${money(result.currency.rates[0].rate)}.`, active, result.currency.code);
    persist();
    setFlash(`Currency ${result.currency.code} added.`);
    render();
    return;
  }

  if (form.id === 'currency-rate-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const editingCode = view.editingRateCode;
    const result = editingCode
      ? updateCurrencyRate(active, editingCode, view.editingRateDate, {
          date: data.get('date'),
          rate: data.get('rate'),
        })
      : addCurrencyRate(active, data.get('code'), {
          date: data.get('date'),
          rate: data.get('rate'),
        });
    if (!result.ok) {
      showFormError(result.error, 'currency-rate-error');
      return;
    }
    logAudit(
      editingCode ? 'currency.rate.update' : 'currency.rate',
      `${editingCode ? 'Updated' : 'Set'} ${result.currency.code} rate ${money(result.rate.rate)} from ${dateLabel(result.rate.date)}.`,
      active,
      result.currency.code,
    );
    persist();
    setFlash(`${result.currency.code} rate ${editingCode ? 'updated' : 'saved'} for ${dateLabel(result.rate.date)}.`);
    if (editingCode) navigate('masters');
    else render();
    return;
  }

  if (form.id === 'cost-category-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const editingCategoryId = view.editingCostCategoryId;
    const result = editingCategoryId
      ? updateCostCategory(active, editingCategoryId, { name: data.get('name') })
      : addCostCategory(active, { name: data.get('name') });
    if (!result.ok) {
      showFormError(result.error, 'cost-category-error');
      return;
    }
    logAudit(
      editingCategoryId ? 'costCategory.update' : 'costCategory.create',
      `${editingCategoryId ? 'Renamed' : 'Added'} cost category "${result.category.name}".`,
      active,
      result.category.name,
    );
    persist();
    setFlash(`Cost category "${result.category.name}" ${editingCategoryId ? 'saved' : 'added'}.`);
    if (editingCategoryId) navigate('costCentres');
    else render();
    return;
  }

  if (form.id === 'cost-centre-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const editingCentreId = view.editingCostCentreId;
    const payload = { name: data.get('name'), categoryId: data.get('categoryId') };
    const result = editingCentreId
      ? updateCostCentre(active, editingCentreId, payload)
      : addCostCentre(active, payload);
    if (!result.ok) {
      showFormError(result.error, 'cost-centre-error');
      return;
    }
    logAudit(
      editingCentreId ? 'costCentre.update' : 'costCentre.create',
      `${editingCentreId ? 'Updated' : 'Added'} cost centre "${result.centre.name}".`,
      active,
      result.centre.name,
    );
    persist();
    setFlash(`Cost centre "${result.centre.name}" ${editingCentreId ? 'saved' : 'added'}.`);
    if (editingCentreId) navigate('costCentres');
    else render();
    return;
  }

  if (form.id === 'voucher-form') {
    if (!can('voucher.write')) {
      requirePermission('voucher.write');
      return;
    }
    const editingId = view.editId;
    const pendingEdit = Boolean(view.pendingEdit && editingId);
    const submitted = readVoucherForm();
    const submittedTotal = round2(
      submitted.lines
        .filter((line) => line.side === 'Dr')
        .reduce((sum, line) => sum + (parseAmount(line.amount) ?? 0), 0),
    );
    const pendingApproval = Boolean(
      !editingId && authRequired && authUser?.role !== 'owner' && approvalRequiredForAmount(active, submittedTotal),
    );
    const input = {
      ...submitted,
      pending: pendingEdit || pendingApproval,
      submittedBy: authUser
        ? { id: authUser.id, username: authUser.username, name: authUser.name }
        : { id: 'local', username: 'local', name: 'Local user' },
    };
    const result = pendingEdit
      ? updatePendingVoucher(active, editingId, input, currentProfile() || {})
      : editingId
        ? updateVoucher(active, editingId, input)
        : addVoucher(active, input);
    if (!result.ok) {
      showFormError(result.error);
      return;
    }
    clearVoucherDraft(active, draft.type);
    const instrumentNote = result.voucher.instrument
      ? ` · ${result.voucher.instrument.kind} ${result.voucher.instrument.number} dated ${dateLabel(result.voucher.instrument.date)}`
      : '';
    logAudit(
      pendingEdit ? 'voucher.pending.update' : editingId ? 'voucher.update' : 'voucher.create',
      `${pendingEdit ? 'Revised pending' : editingId ? 'Altered' : 'Created'} ${voucherAuditLabel(result.voucher)}${instrumentNote}.`,
      active,
      `${result.voucher.type} ${result.voucher.no ?? 'pending'}`,
    );
    await persist();
    if (workspaceMode && workspaceSaveError) return;
    await releaseActiveLease();
    draft = null;
    if (result.pending) {
      setFlash(
        pendingEdit
          ? `${voucherLabel(result.voucher.type)} updated and still awaiting owner approval.`
          : `${voucherLabel(result.voucher.type)} submitted for owner approval.`,
      );
      navigate('vouchers');
      return;
    }
    setFlash(
      `${voucherLabel(result.voucher.type)} ${result.voucher.no} ${editingId ? 'updated' : 'accepted'}.`,
    );
    navigate('voucherView', { id: result.voucher.id });
    return;
  }

  if (form.id === 'period-form') {
    const data = new FormData(form);
    filters.period = { from: data.get('from') || '', to: data.get('to') || '' };
    render();
    return;
  }

  if (form.id === 'cashbook-form') {
    const data = new FormData(form);
    filters.cashBook = {
      ledgerId: data.get('ledgerId') || '',
      from: data.get('from') || '',
      to: data.get('to') || '',
    };
    render();
    return;
  }

  if (form.id === 'register-form') {
    const data = new FormData(form);
    filters.register = {
      type: data.get('type') || 'Sales',
      from: data.get('from') || '',
      to: data.get('to') || '',
    };
    render();
    return;
  }

  if (form.id === 'budget-report-form') {
    const data = new FormData(form);
    filters.budget = { yearId: data.get('yearId') || '', asOn: data.get('asOn') || '' };
    render();
    return;
  }

  if (form.id === 'forex-report-form') {
    const data = new FormData(form);
    filters.forex = { asOn: data.get('asOn') || '' };
    render();
    return;
  }

  if (form.id === 'gst-report-form') {
    const data = new FormData(form);
    filters.gst = { from: data.get('from') || '', to: data.get('to') || '' };
    render();
    return;
  }

  if (form.id === 'tds-report-form') {
    const data = new FormData(form);
    filters.tds = {
      kind: data.get('kind') === 'TCS' ? 'TCS' : 'TDS',
      from: data.get('from') || '',
      to: data.get('to') || '',
    };
    render();
    return;
  }

  if (form.id === 'einvoice-report-form' || form.id === 'taxaudit-report-form') {
    const data = new FormData(form);
    const key = form.id === 'einvoice-report-form' ? 'einvoice' : 'taxAudit';
    filters[key] = { from: data.get('from') || '', to: data.get('to') || '' };
    render();
    return;
  }

  if (form.id === 'eway-partb-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const voucherId = String(data.get('voucherId') ?? '');
    const result = setEwayPartB(active, voucherId, {
      transporterName: data.get('transporterName'),
      transporterId: data.get('transporterId'),
      vehicleNo: data.get('vehicleNo'),
      distance: data.get('distance'),
    });
    if (!result.ok) {
      showFormError(result.error, 'eway-partb-error');
      return;
    }
    const voucher = active.vouchers.find((entry) => entry.id === voucherId);
    logAudit(
      'eway.partb.save',
      `Saved e-way Part B details for Sales ${voucher?.no ?? ''}.`,
      active,
      voucherId,
    );
    persist();
    view.ewayPartBId = null;
    setFlash('Part B details saved.');
    render();
    return;
  }

  if (form.id === 'ewaybill-report-form') {
    const data = new FormData(form);
    filters.ewaybill = {
      from: data.get('from') || '',
      to: data.get('to') || '',
      threshold: data.get('threshold') || '50000',
    };
    render();
    return;
  }

  if (form.id === 'cost-report-form') {
    const data = new FormData(form);
    filters.costCentres = { from: data.get('from') || '', to: data.get('to') || '' };
    render();
    return;
  }

  if (form.id === 'postdated-form') {
    const data = new FormData(form);
    filters.postDated = {
      from: data.get('from') || '',
      to: data.get('to') || '',
      asOn: data.get('asOn') || '',
      status: data.get('status') || 'All',
    };
    render();
    return;
  }

  if (form.id === 'outstanding-form') {
    const data = new FormData(form);
    filters.outstanding = {
      side: data.get('side') === 'payable' ? 'payable' : 'receivable',
      asOn: data.get('asOn') || '',
    };
    render();
    return;
  }

  if (form.id === 'bill-register-form') {
    const data = new FormData(form);
    filters.billRegister = {
      side: data.get('side') === 'payable' ? 'payable' : 'receivable',
      from: data.get('from') || '',
      to: data.get('to') || '',
      asOn: data.get('asOn') || '',
      status: data.get('status') || 'All',
    };
    render();
    return;
  }

  if (form.id === 'party-statement-form') {
    const data = new FormData(form);
    filters.partyStatement = {
      side: data.get('side') === 'payable' ? 'payable' : 'receivable',
      ledgerId: data.get('ledgerId') || '',
      from: data.get('from') || '',
      to: data.get('to') || '',
    };
    navigate('partyStatement');
    return;
  }

  if (form.id === 'daybook-form') {
    const data = new FormData(form);
    const size = data.get('pageSize');
    filters.daybook = {
      type: data.get('type'),
      from: data.get('from'),
      to: data.get('to'),
      pageSize: size === 'all' ? 'all' : [100, 250, 500].includes(Number(size)) ? Number(size) : 250,
      page: 1,
    };
    navigate('daybook');
    return;
  }

  if (form.id === 'statement-form') {
    const data = new FormData(form);
    filters.statement = { from: data.get('from'), to: data.get('to') };
    navigate('ledger', { id: view.id });
  }
}

export function csvCell(value) {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function reportExportData() {
  const active = company();
  if (!active) return null;
  const title = REPORT_TITLES[view.screen] ?? 'Report';
  const rows = [
    [title],
    ['Company', active.name],
    ['Period', reportPeriodLabel()],
    ['Generated', dateLabel(todayIso())],
    [],
  ];
  if (view.screen === 'daybook') {
    const current = filters.daybook;
    const from = current.from || active.fyStart;
    const to = current.to || active.fyEnd;
    const vouchers = dayBook(active, { type: current.type, from, to });
    rows.push(['Date', 'Voucher', 'Type', 'Particulars', 'Amount']);
    for (const voucher of vouchers) {
      rows.push([
        dateLabel(voucher.date),
        String(voucher.no),
        voucherLabel(voucher.type),
        voucherSummary(active, voucher),
        money(voucher.total),
      ]);
    }
    rows.push([]);
    rows.push([
      `${vouchers.length} voucher${vouchers.length === 1 ? '' : 's'}`,
      '',
      '',
      '',
      money(round2(vouchers.reduce((sum, voucher) => sum + voucher.total, 0))),
    ]);
    return { title, rows };
  }
  const kpis = [...document.querySelectorAll('.mis-kpis .mis-kpi')];
  if (kpis.length) {
    rows.push(['MIS summary'], ['Metric', 'Value', 'Note']);
    for (const kpi of kpis) {
      rows.push([
        kpi.querySelector('span')?.textContent.trim() ?? '',
        kpi.querySelector('strong')?.textContent.trim() ?? '',
        kpi.querySelector('small')?.textContent.trim() ?? '',
      ]);
    }
    rows.push([]);
  }
  for (const section of document.querySelectorAll('main section.panel')) {
    const heading = section.querySelector('.panel-head h2')?.textContent.trim();
    const tables = [...section.querySelectorAll('table')].filter(
      (table) => table.querySelectorAll('tbody tr').length > 0,
    );
    for (const table of tables) {
      if (heading) rows.push([heading]);
      const header = [...table.querySelectorAll('thead th')].map((cell) => cell.textContent);
      if (header.length) rows.push(header);
      for (const bodyRow of table.querySelectorAll('tbody tr')) {
        rows.push([...bodyRow.querySelectorAll('td')].map((cell) => cell.textContent));
      }
      for (const footRow of table.querySelectorAll('tfoot tr')) {
        rows.push([...footRow.querySelectorAll('td')].map((cell) => cell.textContent));
      }
      rows.push([]);
    }
  }
  while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
  return { title, rows };
}

export function exportReportCsv() {
  const report = reportExportData();
  if (!report) return;
  const { title, rows } = report;
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ZledgerCraft-${title.replace(/[^a-z0-9]+/gi, '-')}-${todayIso()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setFlash(`Exported ${title} as CSV.`);
  render();
}

export function exportReportXlsx() {
  const report = reportExportData();
  if (!report) return;
  const { title, rows } = report;
  const blob = new Blob([buildXlsx([{ name: title, rows }])], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ZledgerCraft-${title.replace(/[^a-z0-9]+/gi, '-')}-${todayIso()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setFlash(`Exported ${title} as Excel.`);
  render();
}

async function handleClick(event) {
  const trigger = event.target.closest('[data-screen], [data-action]');
  if (!trigger) return;

  if (trigger.dataset.screen) {
    navigate(trigger.dataset.screen);
    return;
  }

  const action = trigger.dataset.action;
  switch (action) {
    case 'new-voucher':
      openVoucher(trigger.dataset.type);
      break;
    case 'select-company':
      state.activeCompanyId = trigger.dataset.id;
      if (!authRequired || can('voucher.write')) persist();
      setFlash(`Opened ${company()?.name ?? 'company'}.`);
      navigate('gateway');
      break;
    case 'select-year': {
      const active = company();
      if (!active) break;
      const result = selectYear(active, trigger.dataset.id);
      if (result.ok) {
        resetPeriodFilters();
        if (!authRequired || can('voucher.write')) persist();
      }
      setFlash(
        result.ok
          ? `Viewing ${dateLabel(result.year.start)} to ${dateLabel(result.year.end)}.`
          : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'add-year': {
      if (!can('year.manage')) {
        requirePermission('year.manage');
        break;
      }
      const active = company();
      if (!active) break;
      const result = addFinancialYear(active);
      logAudit(
        'year.add',
        `Added financial year ${dateLabel(result.year.start)} to ${dateLabel(result.year.end)}.`,
        active,
        result.year.id,
      );
      persist();
      setFlash(`Financial year ${dateLabel(result.year.start)} to ${dateLabel(result.year.end)} added.`);
      navigate('companies');
      break;
    }
    case 'close-year': {
      if (!can('year.manage')) {
        requirePermission('year.manage');
        break;
      }
      const active = company();
      if (!active) break;
      if (!window.confirm('Close this financial year? Its vouchers become read-only.')) break;
      const result = closeFinancialYear(active, trigger.dataset.id);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      logAudit(
        'year.close',
        `Closed financial year ${dateLabel(result.year.start)} to ${dateLabel(result.year.end)}; next year is ${dateLabel(result.next.start)} to ${dateLabel(result.next.end)}.`,
        active,
        result.year.id,
      );
      persist();
      setFlash(
        `${dateLabel(result.year.start)} to ${dateLabel(result.year.end)} closed. Now viewing ${dateLabel(result.next.start)} to ${dateLabel(result.next.end)}.`,
      );
      navigate('companies');
      break;
    }
    case 'reopen-year': {
      if (!can('year.manage')) {
        requirePermission('year.manage');
        break;
      }
      const active = company();
      if (!active) break;
      if (!window.confirm('Reopen this financial year for editing?')) break;
      const result = reopenFinancialYear(active, trigger.dataset.id);
      if (result.ok) {
        logAudit(
          'year.reopen',
          `Reopened financial year ${dateLabel(result.year.start)} to ${dateLabel(result.year.end)}.`,
          active,
          result.year.id,
        );
        persist();
      }
      setFlash(
        result.ok
          ? `${dateLabel(result.year.start)} to ${dateLabel(result.year.end)} reopened.`
          : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'pick-ledger':
      filters.statement = { from: '', to: '' };
      navigate('ledger', { id: trigger.dataset.id });
      break;
    case 'open-party-statement':
      filters.partyStatement = {
        side: trigger.dataset.side === 'payable' ? 'payable' : 'receivable',
        ledgerId: trigger.dataset.id,
        from: '',
        to: '',
      };
      navigate('partyStatement', { id: trigger.dataset.id });
      break;
    case 'pick-group':
      navigate('groupVouchers', { groupId: trigger.dataset.id });
      break;
    case 'alter-voucher':
      await openAlter(trigger.dataset.id);
      break;
    case 'daybook-page': {
      const page = Number(trigger.dataset.page);
      if (!Number.isInteger(page) || page < 1) break;
      filters.daybook = { ...filters.daybook, page };
      render();
      break;
    }
    case 'duplicate-voucher':
      duplicateVoucher(trigger.dataset.id);
      break;
    case 'print-cheque':
      navigate('chequePrint', { id: trigger.dataset.id });
      break;
    case 'set-instrument-status': {
      if (!can('voucher.write')) {
        requirePermission('voucher.write');
        break;
      }
      const active = company();
      if (!active) break;
      const status = trigger.dataset.status ?? '';
      const result = setInstrumentStatus(active, trigger.dataset.id, status);
      if (result.ok) {
        logAudit(
          'instrument.status',
          `${status ? `Marked ${active.vouchers.find((voucher) => voucher.id === trigger.dataset.id)?.instrument?.kind ?? 'instrument'} ${status.toLowerCase()}` : 'Restored automatic instrument status'}.`,
          active,
          trigger.dataset.id,
        );
      }
      persist();
      setFlash(
        result.ok
          ? status
            ? `Instrument marked ${status.toLowerCase()}.`
            : 'Instrument status restored to automatic.'
          : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'open-cost-centre':
      navigate('costCentreDetail', { id: trigger.dataset.id });
      break;
    case 'edit-ledger':
      navigate('masters', { editingLedgerId: trigger.dataset.id });
      break;
    case 'cancel-ledger-edit':
      navigate('masters');
      break;
    case 'delete-ledger': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active) break;
      if (!window.confirm('Delete this ledger?')) break;
      const result = deleteLedger(active, trigger.dataset.id);
      if (result.ok) logAudit('ledger.delete', `Deleted ledger "${result.ledger.name}".`, active, result.ledger.name);
      persist();
      setFlash(result.ok ? `Ledger "${result.ledger.name}" deleted.` : result.error, result.ok ? 'ok' : 'warn');
      navigate('masters');
      break;
    }
    case 'edit-group':
      navigate('masters', { editingGroupId: trigger.dataset.id });
      break;
    case 'cancel-group-edit':
      navigate('masters');
      break;
    case 'delete-budget': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active) break;
      if (!window.confirm('Delete this budget?')) break;
      const result = deleteBudget(active, trigger.dataset.id);
      if (result.ok) logAudit('budget.delete', `Deleted budget "${result.budget.name}".`, active, result.budget.name);
      persist();
      setFlash(result.ok ? `Budget "${result.budget.name}" deleted.` : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'delete-currency': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active) break;
      if (!window.confirm('Delete this currency and all of its rates?')) break;
      const result = deleteCurrency(active, trigger.dataset.id);
      if (result.ok) logAudit('currency.delete', `Deleted currency ${result.currency.code}.`, active, result.currency.code);
      persist();
      setFlash(result.ok ? `Currency ${result.currency.code} deleted.` : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'edit-tds-section':
      navigate('tds', { editingTdsSectionId: trigger.dataset.id });
      break;
    case 'cancel-tds-section-edit':
      navigate('tds');
      break;
    case 'delete-tds-section': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active) break;
      const result = deleteTdsSection(active, trigger.dataset.id);
      if (result.ok) logAudit('tds.section.delete', `Deleted ${result.section.kind} section ${result.section.code}.`, active, `${result.section.kind} ${result.section.code}`);
      persist();
      setFlash(result.ok ? `Section ${result.section.code} deleted.` : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'delete-challan': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active) break;
      const result = deleteTaxChallan(active, trigger.dataset.id);
      if (result.ok) logAudit('tds.challan.delete', `Deleted ${result.challan.kind} challan ${result.challan.reference || result.challan.id}.`, active, result.challan.kind);
      persist();
      setFlash(result.ok ? 'Challan deleted.' : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'edit-employee':
      navigate('payroll', { employeeId: trigger.dataset.id });
      break;
    case 'cancel-employee-edit':
      navigate('payroll');
      break;
    case 'delete-employee': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active) break;
      if (!window.confirm('Delete this employee? Past runs keep their stored snapshot.')) break;
      const result = deleteEmployee(active, trigger.dataset.id);
      if (result.ok) logAudit('employee.delete', `Deleted employee "${result.employee.name}".`, active, result.employee.name);
      persist();
      setFlash(result.ok ? `Employee "${result.employee.name}" deleted.` : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'delete-pay-head': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active) break;
      const result = deletePayHead(active, trigger.dataset.id);
      if (result.ok) logAudit('payroll.head.delete', `Deleted pay head "${result.payHead.name}".`, active, result.payHead.name);
      persist();
      setFlash(result.ok ? `Pay head "${result.payHead.name}" deleted.` : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'open-payroll-run':
      navigate('payrollRun', { id: trigger.dataset.id });
      break;
    case 'open-payslip':
      navigate('payslip', { runId: trigger.dataset.run, employeeId: trigger.dataset.id });
      break;
    case 'download-payroll-bank': {
      const active = company();
      if (!active) break;
      const result = payrollBankTransferRows(active, trigger.dataset.id);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        break;
      }
      const rows = [
        ['Month', 'Employee', 'Code', 'Bank', 'Account number', 'IFSC', 'Net pay'],
        ...result.rows.map((row) => [
          result.run.month,
          row.name,
          row.code,
          row.bankName,
          row.accountNumber,
          row.ifsc,
          row.net,
        ]),
      ];
      const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
      const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ZledgerCraft-Bank-transfer-${result.run.month}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFlash(
        result.missing.length
          ? `Bank transfer file for ${result.run.month} exported; ${result.missing.length} employee(s) have no account/IFSC.`
          : `Bank transfer file for ${result.run.month} exported.`,
        result.missing.length ? 'warn' : 'ok',
      );
      break;
    }
    case 'delete-payroll-run': {
      if (!can('voucher.delete')) {
        requirePermission('voucher.delete');
        break;
      }
      const active = company();
      if (!active) break;
      if (!window.confirm('Delete this payroll run and its journal voucher?')) break;
      const result = deletePayrollRun(active, trigger.dataset.id);
      if (result.ok) {
        logAudit(
          'payroll.run.delete',
          `Deleted payroll for ${result.run.month} and its journal voucher.`,
          active,
          result.run.month,
        );
      }
      persist();
      setFlash(result.ok ? 'Payroll run deleted.' : result.error, result.ok ? 'ok' : 'warn');
      navigate('payroll');
      break;
    }
    case 'edit-gst-rate':
      navigate('gst', { editingGstRateId: trigger.dataset.id });
      break;
    case 'cancel-gst-rate-edit':
      navigate('gst');
      break;
    case 'delete-gst-rate': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active) break;
      const result = deleteGstRate(active, trigger.dataset.id);
      if (result.ok) logAudit('gst.rate.delete', `Deleted GST rate ${result.rate.label}.`, active, result.rate.label);
      persist();
      setFlash(result.ok ? `GST rate ${result.rate.label} deleted.` : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'edit-cost-category':
      navigate('costCentres', { editingCostCategoryId: trigger.dataset.id });
      break;
    case 'cancel-cost-category-edit':
      navigate('costCentres');
      break;
    case 'edit-cost-centre':
      navigate('costCentres', { editingCostCentreId: trigger.dataset.id });
      break;
    case 'cancel-cost-centre-edit':
      navigate('costCentres');
      break;
    case 'delete-cost-category': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active) break;
      if (!window.confirm('Delete this cost category?')) break;
      const result = deleteCostCategory(active, trigger.dataset.id);
      if (result.ok) logAudit('costCategory.delete', `Deleted cost category "${result.category.name}".`, active, result.category.name);
      persist();
      setFlash(result.ok ? `Cost category "${result.category.name}" deleted.` : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'delete-cost-centre': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active) break;
      if (!window.confirm('Delete this cost centre?')) break;
      const result = deleteCostCentre(active, trigger.dataset.id);
      if (result.ok) logAudit('costCentre.delete', `Deleted cost centre "${result.centre.name}".`, active, result.centre.name);
      persist();
      setFlash(result.ok ? `Cost centre "${result.centre.name}" deleted.` : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'delete-group': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active) break;
      if (!window.confirm('Delete this group?')) break;
      const result = deleteGroup(active, trigger.dataset.id);
      if (result.ok) logAudit('group.delete', `Deleted group "${result.group.name}".`, active, result.group.name);
      persist();
      setFlash(result.ok ? `Group "${result.group.name}" deleted.` : result.error, result.ok ? 'ok' : 'warn');
      navigate('masters');
      break;
    }
    case 'edit-company':
      navigate('companies', { editingCompanyId: trigger.dataset.id });
      break;
    case 'cancel-company-edit':
      navigate('companies');
      break;
    case 'delete-company': {
      if (!can('company.manage')) {
        requirePermission('company.manage');
        break;
      }
      if (!window.confirm('Delete this company and all its vouchers? This cannot be undone.')) break;
      const result = deleteCompany(state, trigger.dataset.id);
      if (result.ok) {
        logAudit(
          'company.delete',
          `Deleted company "${result.company.name}" and all its vouchers.`,
          result.company,
          result.company.name,
        );
      }
      persist();
      setFlash(result.ok ? `Company "${result.company.name}" deleted.` : result.error, result.ok ? 'ok' : 'warn');
      navigate('companies');
      break;
    }
    case 'open-voucher':
      navigate('voucherView', { id: trigger.dataset.id });
      break;
    case 'save-snapshot': {
      const saved = saveSnapshot(state, 'manual');
      setFlash(
        saved ? `Manual snapshot saved. The last ${SNAPSHOT_LIMIT} are listed below.` : 'Could not save a snapshot in this browser.',
        saved ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'restore-snapshot': {
      if (!can('data.restore')) {
        requirePermission('data.restore');
        break;
      }
      const snapshot = loadSnapshots()[Number(trigger.dataset.index)];
      if (!snapshot) {
        setFlash('That snapshot is no longer available.', 'warn');
        render();
        break;
      }
      if (!window.confirm(`Restore the snapshot from ${new Date(snapshot.at).toLocaleString('en-IN')}? Current data will be snapshotted first.`)) break;
      const result = importState(snapshot.payload);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      saveSnapshot(state, 'pre-restore');
      applyRestoredState(
        result.state,
        `Restored snapshot from ${new Date(snapshot.at).toLocaleString('en-IN')}.`,
      );
      setFlash('Snapshot restored.');
      navigate('gateway');
      break;
    }
    case 'import-bank-statement': {
      if (!can('recon.write')) {
        requirePermission('recon.write');
        break;
      }
      const active = company();
      const ledgerId = selectedBankLedgerId();
      if (!active || !ledgerId) {
        setFlash('Create a bank ledger first.', 'warn');
        render();
        break;
      }
      const text = document.getElementById('bank-statement-csv')?.value ?? '';
      const parsed = parseBankStatementCsv(text);
      if (!parsed.ok) {
        setFlash(parsed.error, 'warn');
        render();
        break;
      }
      if (active.bankReconciliations?.[ledgerId] && !window.confirm('Replace the current bank statement and its matches?')) break;
      const result = saveBankStatement(active, ledgerId, parsed.lines, {
        source: 'CSV import',
        openingBalance: document.getElementById('bank-opening-balance')?.value ?? '',
        closingBalance: document.getElementById('bank-closing-balance')?.value ?? '',
      });
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      logAudit(
        'bankRecon.import',
        `Imported ${result.count} statement line${result.count === 1 ? '' : 's'} for "${active.ledgers.find((ledger) => ledger.id === ledgerId)?.name ?? 'Bank'}".`,
        active,
        ledgerId,
      );
      persist();
      setFlash(`Imported ${result.count} bank statement line${result.count === 1 ? '' : 's'}.`);
      navigate('bankRecon', { bankLedgerId: ledgerId });
      break;
    }
    case 'recon-auto': {
      if (!can('recon.write')) {
        requirePermission('recon.write');
        break;
      }
      const active = company();
      const ledgerId = selectedBankLedgerId();
      if (!active || !ledgerId) break;
      const result = autoMatchBank(active, ledgerId);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      logAudit('bankRecon.auto', `Auto-matched ${result.count} bank statement line${result.count === 1 ? '' : 's'}.`, active, ledgerId);
      persist();
      setFlash(`Auto-matched ${result.count} line${result.count === 1 ? '' : 's'}.`);
      navigate('bankRecon', { bankLedgerId: ledgerId });
      break;
    }
    case 'recon-match': {
      if (!can('recon.write')) {
        requirePermission('recon.write');
        break;
      }
      const active = company();
      const ledgerId = selectedBankLedgerId();
      const lineId = trigger.dataset.line;
      const select = document.querySelector(`select.recon-voucher[data-line="${lineId}"]`);
      const voucherId = select?.value ?? '';
      if (!active || !ledgerId || !voucherId) {
        setFlash('Choose an unmatched voucher first.', 'warn');
        render();
        break;
      }
      const result = setBankMatch(active, ledgerId, lineId, voucherId);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      logAudit(
        'bankRecon.match',
        `Matched ${voucherAuditLabel(result.voucher)} to statement line ${dateLabel(result.line.date)} · ${result.line.description || 'no description'}.`,
        active,
        ledgerId,
      );
      persist();
      setFlash('Statement line matched.');
      navigate('bankRecon', { bankLedgerId: ledgerId });
      break;
    }
    case 'recon-unmatch': {
      if (!can('recon.write')) {
        requirePermission('recon.write');
        break;
      }
      const active = company();
      const ledgerId = selectedBankLedgerId();
      const lineId = trigger.dataset.line;
      if (!active || !ledgerId) break;
      const line = active.bankReconciliations?.[ledgerId]?.statement.lines.find((entry) => entry.id === lineId);
      const result = unsetBankMatch(active, ledgerId, lineId);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      logAudit(
        'bankRecon.unmatch',
        `Unmatched statement line ${line ? `${dateLabel(line.date)} · ${line.description || 'no description'}` : lineId}.`,
        active,
        ledgerId,
      );
      persist();
      setFlash('Statement line unmatched.');
      navigate('bankRecon', { bankLedgerId: ledgerId });
      break;
    }
    case 'recon-clear': {
      if (!can('recon.write')) {
        requirePermission('recon.write');
        break;
      }
      const active = company();
      const ledgerId = selectedBankLedgerId();
      if (!active || !ledgerId) break;
      if (!window.confirm('Clear this bank statement and all its matches? Vouchers are not changed.')) break;
      const result = clearBankStatement(active, ledgerId);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      logAudit('bankRecon.clear', 'Cleared the imported bank statement and its matches.', active, ledgerId);
      persist();
      setFlash('Bank statement cleared. Vouchers were not changed.');
      navigate('bankRecon', { bankLedgerId: ledgerId });
      break;
    }
    case 'import-ledgers': {
      if (!can('master.write')) {
        requirePermission('master.write');
        break;
      }
      const text = document.getElementById('ledger-csv')?.value ?? '';
      const result = importLedgerCsv(text);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      logAudit('ledger.import', `Imported ${result.count} ledger${result.count === 1 ? '' : 's'} from CSV.`);
      persist();
      setFlash(`Imported ${result.count} ledger${result.count === 1 ? '' : 's'}.`);
      render();
      break;
    }
    case 'import-vouchers': {
      if (!can('voucher.write')) {
        requirePermission('voucher.write');
        break;
      }
      const text = document.getElementById('voucher-csv')?.value ?? '';
      const result = importVoucherCsv(text);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      logAudit('voucher.import', `Imported ${result.count} voucher${result.count === 1 ? '' : 's'} from CSV.`);
      persist();
      setFlash(`Imported ${result.count} voucher${result.count === 1 ? '' : 's'}.`);
      render();
      break;
    }
    case 'import-tally': {
      if (!can('master.write') || !can('voucher.write')) {
        requirePermission(!can('master.write') ? 'master.write' : 'voucher.write');
        break;
      }
      const active = company();
      if (!active) break;
      const text = document.getElementById('tally-xml')?.value ?? '';
      const result = importTallyXml(active, text);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      const parts = [];
      if (result.groups) parts.push(`${result.groups} account group${result.groups === 1 ? '' : 's'}`);
      if (result.ledgers) parts.push(`${result.ledgers} ledger${result.ledgers === 1 ? '' : 's'}`);
      if (result.stockGroups) {
        parts.push(`${result.stockGroups} stock group${result.stockGroups === 1 ? '' : 's'}`);
      }
      if (result.stockItems) parts.push(`${result.stockItems} stock item${result.stockItems === 1 ? '' : 's'}`);
      if (result.batches) parts.push(`${result.batches} opening batch${result.batches === 1 ? '' : 'es'}`);
      if (result.vouchers) parts.push(`${result.vouchers} voucher${result.vouchers === 1 ? '' : 's'}`);
      if (result.stockLines) parts.push(`${result.stockLines} stock line${result.stockLines === 1 ? '' : 's'}`);
      const summary = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0] || 'no entries';
      const skipped = result.stockLinesSkipped
        ? ` Skipped ${result.stockLinesSkipped} stock line${result.stockLinesSkipped === 1 ? '' : 's'}: ${result.stockWarning}`
        : '';
      logAudit('tally.import', `Imported ${summary} from Tally XML.${skipped}`);
      persist();
      setFlash(`Imported ${summary} from Tally XML.${skipped}`, skipped ? 'warn' : 'ok');
      render();
      break;
    }
    case 'enable-workspace': {
      if (!can('data.restore')) {
        requirePermission('data.restore');
        break;
      }
      if (!workspaceAvailable()) {
        setFlash('Server workspaces need the HTTP server.', 'warn');
        render();
        break;
      }
      try {
        const response = await fetch('/api/workspace', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Workspace unavailable.');
        let imported = null;
        if (payload.state) {
          const result = importState(JSON.stringify(payload.state));
          if (!result.ok) throw new Error(result.error);
          imported = result.state;
          const when = payload.updatedAt ? new Date(payload.updatedAt).toLocaleString('en-IN') : 'an earlier session';
          if (!window.confirm(`Load the server workspace saved ${when}? Current browser data will be snapshotted first.`)) break;
        }
        workspaceMode = true;
        workspaceRev = Number(payload.rev) || 0;
        workspaceUpdatedAt = payload.updatedAt ?? null;
        workspaceStorage = payload.storage ?? null;
        workspaceRemote = null;
        localStorage.setItem(WORKSPACE_KEY, 'server');
        startWorkspaceWatch();
        if (imported) {
          saveSnapshot(state, 'pre-restore');
          applyRestoredState(imported, 'Loaded the local server workspace.');
        } else {
          await queueWorkspaceSave();
        }
        setFlash(
          workspaceMode
            ? 'Server workspace active. Changes are saved outside this browser profile.'
            : 'Could not save the server workspace.',
          workspaceMode ? 'ok' : 'warn',
        );
        navigate('backup');
      } catch (error) {
        workspaceMode = false;
        try {
          localStorage.removeItem(WORKSPACE_KEY);
        } catch {
          // Ignore storage failures.
        }
        setFlash(`Server workspace unavailable: ${error.message}`, 'warn');
        render();
      }
      break;
    }
    case 'disable-workspace':
      workspaceMode = false;
      stopWorkspaceWatch();
      workspaceRemote = null;
      workspaceRev = 0;
      workspaceUpdatedAt = null;
      workspaceStorage = null;
      try {
        localStorage.removeItem(WORKSPACE_KEY);
      } catch {
        // Ignore storage failures.
      }
      setFlash('This browser is using its own local storage again. The server copy was left untouched.');
      navigate('backup');
      break;
    case 'reload-workspace': {
      if (!can('data.restore')) {
        requirePermission('data.restore');
        break;
      }
      if (!workspaceMode) break;
      if (!window.confirm('Reload the server workspace? Changes that were not saved to the server will be replaced. A local snapshot will be kept.')) break;
      try {
        const response = await fetch('/api/workspace', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload.ok || !payload.state) throw new Error(payload.error || 'Server workspace unavailable.');
        const imported = importState(JSON.stringify(payload.state));
        if (!imported.ok) throw new Error(imported.error);
        saveSnapshot(state, 'pre-restore');
        workspaceRev = Number(payload.rev) || 0;
        workspaceUpdatedAt = payload.updatedAt ?? null;
        workspaceStorage = payload.storage ?? workspaceStorage;
        workspaceRemote = null;
        applyRestoredState(imported.state, 'Reloaded the server workspace.');
        setFlash('Server workspace reloaded.');
        navigate('backup');
      } catch (error) {
        setFlash(`Could not reload the server workspace: ${error.message}`, 'warn');
        render();
      }
      break;
    }
    case 'logout-server':
      logoutServer();
      break;
    case 'download-encrypted-backup': {
      const form = document.getElementById('encrypted-backup-form');
      if (!form) break;
      const data = new FormData(form);
      const passphrase = String(data.get('passphrase') ?? '');
      if (passphrase.length < 8) {
        showFormError('Use a passphrase of at least 8 characters.', 'encrypted-backup-error');
        break;
      }
      if (passphrase !== String(data.get('confirm') ?? '')) {
        showFormError('The passphrase confirmation does not match.', 'encrypted-backup-error');
        break;
      }
      try {
        const envelope = await encryptBackup(exportState(state), passphrase);
        downloadJsonFile(`zledgercraft-backup-${todayIso()}.encrypted.json`, envelope);
        form.reset();
        setFlash('Encrypted backup downloaded. Store its passphrase separately; it cannot be recovered.');
        render();
      } catch (error) {
        showFormError(error.message, 'encrypted-backup-error');
      }
      break;
    }
    case 'restore-server-backup': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      if (!window.confirm(`Restore ${trigger.dataset.id}? The current server workspace will be backed up first. Server accounts and passwords are not changed.`)) break;
      fetch(`/api/backups/${encodeURIComponent(trigger.dataset.id)}/restore`, { method: 'POST' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Restore failed.');
          window.alert(`Restored ${payload.backup.name}. A pre-restore backup was saved as ${payload.preRestore.name}.`);
          location.reload();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'create-server-backup': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      fetch('/api/backups', { method: 'POST' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Backup failed.');
          await refreshServerBackups();
          const offsite = payload.backup.offsite;
          const message = offsite?.ok
            ? `Server backup ${payload.backup.name} created and uploaded to R2.`
            : offsite?.error
              ? `Server backup ${payload.backup.name} created locally; R2 upload failed: ${offsite.error}`
              : `Server backup ${payload.backup.name} created.`;
          setFlash(message, offsite?.error ? 'warn' : '');
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'save-report-settings': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      const form = document.getElementById('report-settings-form');
      if (!form) break;
      fetch('/api/reports/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: Boolean(form.elements.enabled?.checked),
          recipients: form.elements.recipients?.value || '',
        }),
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not save report settings.');
          await refreshReportSettings();
          setFlash('Scheduled report settings saved.');
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'send-report-now': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      fetch('/api/reports/send', { method: 'POST' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not send the report.');
          await refreshReportSettings();
          setFlash(`Daily summary sent to ${payload.recipients?.length || 0} recipient(s).`);
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'preview-report': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      fetch('/api/reports/preview', { method: 'POST' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not create a report preview.');
          window.open(payload.url, '_blank', 'noopener');
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'revoke-api-token': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      const apiToken = authApiTokens.find((item) => item.id === trigger.dataset.id);
      if (!apiToken) break;
      if (!window.confirm(`Revoke the API token "${apiToken.name}"? Apps using it will stop working immediately.`)) break;
      fetch(`/api/auth/api-tokens/${encodeURIComponent(apiToken.id)}`, { method: 'DELETE' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not revoke the API token.');
          await refreshApiTokens();
          setFlash(`API token "${apiToken.name}" revoked.`);
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'refresh-api-tokens': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      refreshApiTokens()
        .then(() => render())
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'refresh-server-backups': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      refreshServerBackups()
        .then(() => render())
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'revoke-server-sessions': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      const account = authAccounts.find((item) => item.id === trigger.dataset.id);
      if (!account) break;
      if (!window.confirm(`Sign out every session for @${account.username}?`)) break;
      fetch(`/api/auth/users/${encodeURIComponent(account.id)}/sessions`, { method: 'DELETE' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not sign out sessions.');
          setFlash(`Signed out ${payload.removed || 0} session(s) for @${account.username}.`);
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'refresh-auth-logins': {
      refreshAuthLogins()
        .then(() => render())
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'refresh-auth-sessions': {
      refreshAuthSessions()
        .then(() => render())
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'revoke-server-session': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      if (!window.confirm('Revoke this session? That browser will be signed out.')) break;
      fetch(`/api/auth/sessions/${encodeURIComponent(trigger.dataset.id)}`, { method: 'DELETE' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not revoke the session.');
          await refreshAuthSessions();
          setFlash('Session revoked.');
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'refresh-server-audit': {
      refreshServerAudit()
        .then(() => render())
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'delete-server-user': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      const account = authAccounts.find((item) => item.id === trigger.dataset.id);
      if (!account) break;
      if (!window.confirm(`Remove the server account @${account.username}? Their sessions will end.`)) break;
      fetch(`/api/auth/users/${encodeURIComponent(account.id)}`, { method: 'DELETE' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Account removal failed.');
          await refreshAuthAccounts();
          setFlash(`Server account @${account.username} removed.`);
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'enable-server-mfa': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      const account = authAccounts.find((item) => item.id === trigger.dataset.id);
      if (!account) break;
      if (!window.confirm(`Enable authenticator-based two-step verification for @${account.username}?`)) break;
      fetch(`/api/auth/users/${encodeURIComponent(account.id)}/mfa`, { method: 'POST' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not enable two-step verification.');
          await refreshAuthAccounts();
          window.alert(`Two-step verification enabled for @${account.username}.\n\nSecret: ${payload.secret}\n\nRecovery code: ${payload.recoveryCode}\n\nAuthenticator URI: ${payload.uri}\n\nCopy the secret or URI into the account holder's authenticator app and store the recovery code separately. They are not shown again.`);
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'disable-server-mfa': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      const account = authAccounts.find((item) => item.id === trigger.dataset.id);
      if (!account) break;
      if (!window.confirm(`Disable two-step verification for @${account.username}?`)) break;
      fetch(`/api/auth/users/${encodeURIComponent(account.id)}/mfa`, { method: 'DELETE' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not disable two-step verification.');
          await refreshAuthAccounts();
          setFlash(`Two-step verification disabled for @${account.username}.`);
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'require-server-mfa':
    case 'unrequire-server-mfa': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      const account = authAccounts.find((item) => item.id === trigger.dataset.id);
      if (!account) break;
      const required = trigger.dataset.action === 'require-server-mfa';
      if (!window.confirm(`${required ? 'Require' : 'Stop requiring'} two-step verification for @${account.username}?`)) break;
      fetch(`/api/auth/users/${encodeURIComponent(account.id)}/mfa-required`, { method: required ? 'POST' : 'DELETE' })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not change the two-step requirement.');
          await refreshAuthAccounts();
          setFlash(`Two-step ${required ? 'required' : 'no longer required'} for @${account.username}.`);
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'set-server-email': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      const account = authAccounts.find((item) => item.id === trigger.dataset.id);
      if (!account) break;
      const email = window.prompt(
        `Email for @${account.username} (used for password-reset links; leave blank to remove):`,
        account.email || '',
      );
      if (email === null) break;
      fetch(`/api/auth/users/${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not update email.');
          await refreshAuthAccounts();
          setFlash(`Email updated for @${account.username}.`);
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'reset-server-password': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      const account = authAccounts.find((item) => item.id === trigger.dataset.id);
      if (!account) break;
      const password = window.prompt(`New password for @${account.username} (at least 8 characters):`);
      if (password === null) break;
      fetch(`/api/auth/users/${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Password reset failed.');
          setFlash(`Password reset for @${account.username}. Existing sessions were signed out.`);
          render();
        })
        .catch((error) => {
          setFlash(error.message, 'warn');
          render();
        });
      break;
    }
    case 'delete-user': {
      if (!can('user.manage')) {
        requirePermission('user.manage');
        break;
      }
      const user = (state.users ?? []).find((item) => item.id === trigger.dataset.id);
      if (!user) {
        setFlash('Profile not found.', 'warn');
        render();
        break;
      }
      if (!window.confirm(`Remove the ${roleLabel(user.role)} profile "${user.name}"?`)) break;
      const result = deleteUser(state, user.id);
      if (result.ok) {
        logAudit(
          'user.delete',
          `Removed ${roleLabel(result.user.role)} profile "${result.user.name}".`,
          company(),
          result.user.name,
        );
        persist();
      }
      setFlash(result.ok ? `Profile "${result.user.name}" removed.` : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'new-ledger-inline':
      captureDraft();
      inlineLedger = Number(trigger.dataset.index);
      render();
      break;
    case 'cancel-inline-ledger':
      inlineLedger = null;
      render();
      break;
    case 'create-inline-ledger': {
      if (!can('master.write')) {
        requirePermission('master.write');
        break;
      }
      const active = company();
      if (!active || inlineLedger === null) break;
      captureDraft();
      const block = document.getElementById('inline-ledger');
      if (!block) break;
      const result = addLedger(active, {
        name: block.querySelector('[name="inlineLedgerName"]').value,
        groupId: block.querySelector('[name="inlineLedgerGroup"]').value,
        opening: block.querySelector('[name="inlineLedgerOpening"]').value || 0,
        openingType: block.querySelector('[name="inlineLedgerOpeningType"]').value,
      });
      if (!result.ok) {
        showFormError(result.error, 'inline-ledger-error');
        break;
      }
      logAudit(
        'ledger.create',
        `Created ledger "${result.ledger.name}" from voucher entry.`,
        active,
        result.ledger.name,
      );
      persist();
      const lineIndex = inlineLedger;
      if (draft?.lines[lineIndex]) draft.lines[lineIndex].ledgerId = result.ledger.id;
      inlineLedger = null;
      setFlash(`Ledger "${result.ledger.name}" created.`);
      render();
      document.querySelectorAll('#voucher-form input.amount')[lineIndex]?.focus();
      break;
    }
    case 'print-report':
      window.print();
      break;
    case 'export-xlsx':
      exportReportXlsx();
      break;
    case 'export-csv':
      exportReportCsv();
      break;
    case 'download-einvoice': {
      const active = company();
      if (!active) break;
      const report = eInvoiceRegister(active, {
        from: filters.einvoice.from || active.fyStart,
        to: filters.einvoice.to || active.fyEnd,
      });
      const row = report.rows.find((entry) => entry.id === trigger.dataset.id);
      if (!row?.payload) {
        setFlash('This invoice has no e-invoice draft. Add a buyer GSTIN first.', 'warn');
        break;
      }
      downloadJsonFile(`e-invoice-${String(row.ref || row.no).replace(/[^a-z0-9]+/gi, '-')}.json`, row.payload);
      setFlash(`Downloaded e-invoice draft for ${row.ref}. Nothing was transmitted.`);
      break;
    }
    case 'use-recurring-voucher': {
      if (!requirePermission('voucher.write')) break;
      const active = company();
      const template = (active?.recurringVouchers ?? []).find((entry) => entry.id === trigger.dataset.id);
      if (!active || !template) {
        setFlash('Recurring template not found.', 'warn');
        break;
      }
      prepareDraft(template.type, { ...template, date: template.nextDate });
      navigate('voucherNew', { type: template.type });
      setFlash(`Prefilled "${template.name}". Review and accept it.`, 'ok');
      break;
    }

    case 'delete-recurring-voucher': {
      if (!requirePermission('voucher.write')) break;
      const active = company();
      if (!active || !window.confirm('Delete this recurring voucher template?')) break;
      const result = deleteRecurringVoucher(active, trigger.dataset.id);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        break;
      }
      logAudit('recurring.delete', `Deleted recurring voucher template "${result.template.name}".`, active, trigger.dataset.id);
      persist();
      setFlash('Recurring template deleted.');
      render();
      break;
    }

    case 'payment-reminder': {
      view.reminderPartyId = trigger.dataset.id;
      render();
      break;
    }

    case 'close-payment-reminder': {
      view.reminderPartyId = null;
      render();
      break;
    }

    case 'edit-compliance-task': {
      if (!can('master.write')) {
        requirePermission('master.write');
        break;
      }
      view.complianceTaskId = trigger.dataset.id;
      render();
      break;
    }

    case 'cancel-compliance-task': {
      view.complianceTaskId = null;
      render();
      break;
    }

    case 'toggle-compliance-task': {
      if (!can('master.write')) {
        requirePermission('master.write');
        break;
      }
      const active = company();
      if (!active) break;
      const task = (active.complianceTasks ?? []).find((entry) => entry.id === trigger.dataset.id);
      if (!task) {
        setFlash('Compliance task not found.', 'warn');
        break;
      }
      const nextStatus = task.status === 'Done' ? 'Open' : 'Done';
      const result = setComplianceTaskStatus(active, task.id, nextStatus);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        break;
      }
      logAudit(
        'compliance.status',
        `Marked compliance task "${task.title}" as ${nextStatus}.`,
        active,
        task.id,
      );
      persist();
      setFlash(nextStatus === 'Done' ? 'Compliance task marked done.' : 'Compliance task reopened.');
      render();
      break;
    }

    case 'delete-compliance-task': {
      if (!can('master.write')) {
        requirePermission('master.write');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Delete this compliance task?')) break;
      const task = (active.complianceTasks ?? []).find((entry) => entry.id === trigger.dataset.id);
      const result = deleteComplianceTask(active, trigger.dataset.id);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        break;
      }
      if (view.complianceTaskId === trigger.dataset.id) view.complianceTaskId = null;
      logAudit(
        'compliance.delete',
        `Deleted compliance task "${task?.title ?? result.task.title}".`,
        active,
        trigger.dataset.id,
      );
      persist();
      setFlash('Compliance task deleted.');
      render();
      break;
    }

    case 'edit-eway-partb': {
      if (!can('master.write')) {
        requirePermission('master.write');
        break;
      }
      view.ewayPartBId = trigger.dataset.id;
      render();
      break;
    }

    case 'cancel-eway-partb': {
      view.ewayPartBId = null;
      render();
      break;
    }

    case 'clear-eway-partb': {
      if (!can('master.write')) {
        requirePermission('master.write');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Remove the saved Part B details from this invoice?')) break;
      const result = setEwayPartB(active, trigger.dataset.id, {});
      if (!result.ok) {
        setFlash(result.error, 'warn');
        break;
      }
      logAudit(
        'eway.partb.clear',
        'Removed e-way Part B details from a sales invoice.',
        active,
        trigger.dataset.id,
      );
      persist();
      view.ewayPartBId = null;
      setFlash('Part B details removed.');
      render();
      break;
    }

    case 'download-ewaybill': {
      const active = company();
      if (!active) break;
      const report = ewayBillRegister(active, {
        from: filters.ewaybill.from || active.fyStart,
        to: filters.ewaybill.to || active.fyEnd,
        threshold: Number(filters.ewaybill.threshold) || 50000,
      });
      const row = report.rows.find((entry) => entry.id === trigger.dataset.id);
      if (!row?.payload) {
        setFlash('This invoice has no e-way bill draft.', 'warn');
        break;
      }
      downloadJsonFile(`e-way-bill-${String(row.ref || row.no).replace(/[^a-z0-9]+/gi, '-')}.json`, row.payload);
      setFlash(
        row.partBReady
          ? `Downloaded e-way bill draft for ${row.ref} with saved Part B details. Submit it in the portal.`
          : `Downloaded e-way bill Part A draft for ${row.ref}. Add Part B before portal submission.`,
      );
      break;
    }
    case 'delete-voucher': {
      if (!can('voucher.delete')) {
        requirePermission('voucher.delete');
        break;
      }
      captureDraft();
      const active = company();
      if (!active) break;
      if (active.approvalsRequired && authRequired && authUser?.role !== 'owner') {
        setFlash('Owner approval is required before staff can delete posted vouchers.', 'warn');
        render();
        break;
      }
      const settled = allocationsAgainst(active, trigger.dataset.id);
      if (settled.size > 0) {
        setFlash('This bill is settled by other vouchers. Remove those allocations first.', 'warn');
        render();
        break;
      }
      if (!window.confirm('Delete this voucher?')) break;
      const removedVoucher = active.vouchers.find((voucher) => voucher.id === trigger.dataset.id) ?? null;
      const removed = deleteVoucher(active, trigger.dataset.id);
      if (removed && removedVoucher) {
        logAudit(
          'voucher.delete',
          `Deleted ${voucherAuditLabel(removedVoucher)}.`,
          active,
          `${removedVoucher.type} ${removedVoucher.no}`,
        );
      }
      persist();
      setFlash(removed ? 'Voucher deleted.' : 'Voucher not found.');
      navigate('daybook');
      break;
    }
    case 'edit-pending-voucher': {
      if (!can('voucher.write')) {
        requirePermission('voucher.write');
        break;
      }
      openPendingVoucher(trigger.dataset.id);
      break;
    }
    case 'withdraw-pending-voucher': {
      if (!can('voucher.write')) {
        requirePermission('voucher.write');
        break;
      }
      const active = company();
      if (!active) break;
      const pending = (active.pendingVouchers ?? []).find((voucher) => voucher.id === trigger.dataset.id);
      if (!pending) break;
      if (!window.confirm('Withdraw this pending voucher? It will be removed without posting.')) break;
      const result = withdrawPendingVoucher(active, trigger.dataset.id, currentProfile() || {});
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      logAudit(
        'voucher.pending.withdraw',
        `Withdrew a pending ${voucherLabel(result.voucher.type)} before approval.`,
        active,
        voucherLabel(result.voucher.type),
      );
      persist();
      setFlash('Pending voucher withdrawn. Nothing was posted.');
      render();
      break;
    }
    case 'approve-pending-voucher': {
      if (!can('voucher.approve')) {
        requirePermission('voucher.approve');
        break;
      }
      const active = company();
      if (!active) break;
      const result = approvePendingVoucher(active, trigger.dataset.id, currentProfile() || {});
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      logAudit(
        'voucher.approve',
        `Approved ${voucherAuditLabel(result.voucher)} for posting.`,
        active,
        `${result.voucher.type} ${result.voucher.no}`,
      );
      persist();
      setFlash(`${voucherLabel(result.voucher.type)} ${result.voucher.no} approved and posted.`);
      render();
      break;
    }
    case 'reject-pending-voucher': {
      if (!can('voucher.approve')) {
        requirePermission('voucher.approve');
        break;
      }
      const active = company();
      if (!active) break;
      const note = window.prompt('Reason for rejecting this voucher (optional):', '');
      if (note === null) break;
      const result = rejectPendingVoucher(active, trigger.dataset.id, currentProfile() || {}, note);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      logAudit(
        'voucher.reject',
        `Rejected a submitted ${voucherLabel(result.voucher.type)}${note.trim() ? `: ${note.trim()}` : '.'}`,
        active,
        voucherLabel(result.voucher.type),
      );
      persist();
      setFlash('Voucher rejected. It was not posted to the books.');
      render();
      break;
    }
    case 'delete-pending-voucher': {
      if (!can('voucher.approve')) {
        requirePermission('voucher.approve');
        break;
      }
      const active = company();
      if (!active) break;
      if (!window.confirm('Remove this rejected voucher from the approval queue?')) break;
      const result = deletePendingVoucher(active, trigger.dataset.id);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        render();
        break;
      }
      persist();
      setFlash('Rejected voucher removed from the queue.');
      render();
      break;
    }
    case 'add-line': {
      captureDraft();
      draft.lines.push({ ledgerId: '', side: 'Dr', amount: '' });
      render();
      const inputs = document.querySelectorAll('#voucher-form input.ledger');
      inputs[inputs.length - 1]?.focus();
      break;
    }
    case 'add-item': {
      captureDraft();
      draft.items = draft.items ?? [];
      draft.items.push({ stockItemId: '', qty: '', rate: '' });
      render();
      const selects = document.querySelectorAll('#stock-items select.item');
      selects[selects.length - 1]?.focus();
      break;
    }
    case 'remove-item': {
      captureDraft();
      draft.items.splice(Number(trigger.dataset.index), 1);
      render();
      break;
    }
    case 'stock-movements':
      navigate('inventory', { stockItemId: trigger.dataset.id });
      break;
    case 'close-stock-movements':
      navigate('inventory');
      break;
    case 'edit-stock-item':
      navigate('inventory', { editingItemId: trigger.dataset.id });
      break;
    case 'cancel-stock-item':
      navigate('inventory');
      break;
    case 'delete-stock-item': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Delete this stock item?')) break;
      const result = deleteStockItem(active, trigger.dataset.id);
      if (result.ok) {
        logAudit('stockItem.delete', `Deleted stock item "${result.item.name}".`, active, result.item.name);
        persist();
      }
      setFlash(
        result.ok ? `Stock item "${result.item.name}" deleted.` : result.error,
        result.ok ? 'ok' : 'warn',
      );
      navigate('inventory');
      break;
    }
    case 'delete-godown': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Delete this godown?')) break;
      const result = deleteGodown(active, trigger.dataset.id);
      if (result.ok) {
        logAudit('godown.delete', `Deleted godown "${result.godown.name}".`, active, result.godown.name);
        persist();
      }
      setFlash(
        result.ok ? `Godown "${result.godown.name}" deleted.` : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'view-stock-count': {
      view.stockCountId = view.stockCountId === trigger.dataset.id ? null : trigger.dataset.id;
      render();
      break;
    }

    case 'cancel-stock-count': {
      view.stockCountDraft = null;
      render();
      break;
    }

    case 'post-forex': {
      if (!can('voucher.write')) {
        requirePermission('voucher.write');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Post a forex revaluation journal for this date? This posts unrealised gain or loss to the ledger.')) break;
      const report = forexRevaluation(active, { asOn: trigger.dataset.date });
      const result = postForexRevaluation(active, { date: report.asOn, rows: report.rows });
      if (result.ok) {
        logAudit(
          'forex.post',
          `Posted forex revaluation for ${report.asOn} as voucher ${result.voucher.no}.`,
          active,
          `Journal ${result.voucher.no}`,
        );
        persist();
      }
      setFlash(
        result.ok ? `Forex revaluation posted as Journal ${result.voucher.no}.` : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }

    case 'post-stock-count': {
      if (!can('master.write')) {
        requirePermission('master.write');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Post the counted differences as a stock adjustment? This changes on-hand quantities but does not post a ledger entry.')) break;
      const result = postStockCount(active, trigger.dataset.id);
      if (result.ok) {
        logAudit(
          'stockCount.post',
          `Posted stock count SC-${result.count.no} as SADJ-${result.adjustment.no}.`,
          active,
          `SADJ-${result.adjustment.no}`,
        );
        persist();
      }
      setFlash(
        result.ok
          ? `Stock count SC-${result.count.no} posted as SADJ-${result.adjustment.no}.`
          : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }

    case 'delete-stock-count': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Delete this stock count? Stock and ledger balances will not change.')) break;
      const result = deleteStockCount(active, trigger.dataset.id);
      if (result.ok) {
        logAudit(
          'stockCount.delete',
          `Deleted stock count SC-${result.count.no}.`,
          active,
          `SC-${result.count.no}`,
        );
        if (view.stockCountId === result.count.id) view.stockCountId = null;
        persist();
      }
      setFlash(
        result.ok ? `Stock count SC-${result.count.no} deleted.` : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }

    case 'delete-stock-transfer': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Delete this stock transfer? Balances will change.')) break;
      const result = deleteStockTransfer(active, trigger.dataset.id);
      if (result.ok) {
        logAudit(
          'stockTransfer.delete',
          `Deleted stock transfer ST-${result.transfer.no}.`,
          active,
          `ST-${result.transfer.no}`,
        );
        persist();
      }
      setFlash(
        result.ok ? `Stock transfer ST-${result.transfer.no} deleted.` : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'edit-currency-rate':
      navigate('masters', {
        editingRateCode: trigger.dataset.code,
        editingRateDate: trigger.dataset.date,
      });
      break;
    case 'cancel-rate-edit':
      navigate('masters');
      break;
    case 'delete-currency-rate': {
      if (!can('master.write')) {
        requirePermission('master.write');
        break;
      }
      const active = company();
      if (!active || !window.confirm(`Delete the ${trigger.dataset.code} rate for ${dateLabel(trigger.dataset.date)}?`)) break;
      const result = deleteCurrencyRate(active, trigger.dataset.code, trigger.dataset.date);
      if (result.ok) {
        logAudit(
          'currency.rate.delete',
          `Deleted ${trigger.dataset.code} rate for ${dateLabel(trigger.dataset.date)}.`,
          active,
          trigger.dataset.code,
        );
        persist();
      }
      setFlash(result.ok ? 'Exchange rate deleted.' : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'edit-budget':
      navigate('masters', { editingBudgetId: trigger.dataset.id });
      break;
    case 'cancel-budget-edit':
      navigate('masters');
      break;
    case 'duplicate-budget': {
      if (!can('master.write')) {
        requirePermission('master.write');
        break;
      }
      const active = company();
      if (!active) break;
      const result = duplicateBudget(active, trigger.dataset.id);
      if (result.ok) {
        logAudit(
          'budget.duplicate',
          `Duplicated budget as "${result.budget.name}".`,
          active,
          result.budget.name,
        );
        persist();
      }
      setFlash(
        result.ok ? `Budget duplicated as "${result.budget.name}".` : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'add-opening-batch': {
      const container = document.getElementById('stock-item-batches');
      if (container) container.insertAdjacentHTML('beforeend', stockOpeningBatchRow());
      break;
    }
    case 'remove-opening-batch':
      trigger.closest('.opening-batch-row')?.remove();
      break;
    case 'add-order-line': {
      const container = document.getElementById('order-lines');
      const active = company();
      if (container && active) container.insertAdjacentHTML('beforeend', orderItemRow(active));
      break;
    }
    case 'add-quotation-line': {
      const container = document.getElementById('quotation-lines');
      const active = company();
      if (container && active) container.insertAdjacentHTML('beforeend', orderItemRow(active));
      break;
    }
    case 'order-delivery-note': {
      if (!can('voucher.write')) {
        requirePermission('voucher.write');
        break;
      }
      const active = company();
      if (!active) break;
      const result = addDeliveryNote(active, trigger.dataset.id, todayIso());
      if (!result.ok) {
        setFlash(result.error, 'warn');
        break;
      }
      logAudit(
        'delivery.create',
        `Created ${result.note.kind === 'DeliveryNote' ? 'delivery note' : 'goods receipt'} ${result.note.no} from order ${result.note.sourceOrderNo}.`,
        active,
        result.note.id,
      );
      persist();
      setFlash(`${result.note.kind === 'DeliveryNote' ? 'Delivery note' : 'Goods receipt'} ${result.note.no} created.`);
      navigate('orders');
      break;
    }

    case 'convert-quotation': {
      if (!can('voucher.write')) {
        requirePermission('voucher.write');
        break;
      }
      const active = company();
      if (!active) break;
      const result = convertQuotationToOrder(active, trigger.dataset.id);
      if (!result.ok) {
        setFlash(result.error, 'warn');
        break;
      }
      logAudit(
        'quotation.convert',
        `Converted quotation QTN-${result.quotation.no} to sales order SO-${result.order.no}.`,
        active,
        `QTN-${result.quotation.no}`,
      );
      persist();
      setFlash(`Quotation converted to sales order SO-${result.order.no}.`);
      navigate('orders');
      break;
    }
    case 'remove-order-line':
      trigger.closest('.order-row')?.remove();
      break;
    case 'add-stock-transfer-line': {
      const container = document.getElementById('stock-transfer-lines');
      const active = company();
      if (container && active) {
        container.insertAdjacentHTML('beforeend', stockTransferItemRow(active));
      }
      break;
    }
    case 'remove-transfer-line':
      trigger.closest('.transfer-row')?.remove();
      break;
    case 'add-bom-component': {
      const container = document.getElementById('bom-components');
      const active = company();
      if (container && active) container.insertAdjacentHTML('beforeend', bomComponentRow(active));
      break;
    }
    case 'remove-bom-component':
      trigger.closest('.bom-row')?.remove();
      break;
    case 'delete-bom': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Delete this BOM?')) break;
      const result = deleteBom(active, trigger.dataset.id);
      if (result.ok) {
        logAudit('bom.delete', `Deleted BOM "${result.bom.name}".`, active, result.bom.name);
        persist();
      }
      setFlash(result.ok ? `BOM "${result.bom.name}" deleted.` : result.error, result.ok ? 'ok' : 'warn');
      render();
      break;
    }
    case 'delete-manufacture': {
      if (!can('voucher.delete')) {
        requirePermission('voucher.delete');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Delete this production entry? Stock balances will change.')) break;
      const result = deleteManufacture(active, trigger.dataset.id);
      if (result.ok) {
        logAudit(
          'manufacture.delete',
          `Deleted production MFG-${result.manufacture.no}.`,
          active,
          `MFG-${result.manufacture.no}`,
        );
        persist();
      }
      setFlash(
        result.ok ? `Production MFG-${result.manufacture.no} deleted.` : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'order-to-voucher':
      orderToVoucher(trigger.dataset.id);
      break;
    case 'order-status': {
      if (!can('voucher.write')) {
        requirePermission('voucher.write');
        break;
      }
      const active = company();
      if (!active) break;
      const result = setOrderStatus(active, trigger.dataset.id, trigger.dataset.status);
      if (result.ok) {
        logAudit(
          'order.status',
          `Marked ${result.order.type === 'Sales' ? 'SO' : 'PO'}-${result.order.no} ${result.order.status.toLowerCase()}.`,
          active,
          `${result.order.type === 'Sales' ? 'SO' : 'PO'}-${result.order.no}`,
        );
        persist();
      }
      setFlash(
        result.ok ? `Order marked ${result.order.status.toLowerCase()}.` : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'delete-order': {
      if (!can('voucher.delete')) {
        requirePermission('voucher.delete');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Delete this order?')) break;
      const result = deleteOrder(active, trigger.dataset.id);
      if (result.ok) {
        logAudit(
          'order.delete',
          `Deleted ${result.order.type === 'Sales' ? 'SO' : 'PO'}-${result.order.no}.`,
          active,
          `${result.order.type === 'Sales' ? 'SO' : 'PO'}-${result.order.no}`,
        );
        persist();
      }
      setFlash(
        result.ok ? 'Order deleted.' : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'delete-unit': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Delete this unit?')) break;
      const result = deleteUnit(active, trigger.dataset.id);
      if (result.ok) {
        logAudit('unit.delete', `Deleted unit "${result.unit.name}".`, active, result.unit.name);
        persist();
      }
      setFlash(
        result.ok ? `Unit "${result.unit.name}" deleted.` : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'delete-stock-group': {
      if (!can('master.delete')) {
        requirePermission('master.delete');
        break;
      }
      const active = company();
      if (!active || !window.confirm('Delete this stock group?')) break;
      const result = deleteStockGroup(active, trigger.dataset.id);
      if (result.ok) {
        logAudit('stockGroup.delete', `Deleted stock group "${result.group.name}".`, active, result.group.name);
        persist();
      }
      setFlash(
        result.ok ? `Stock group "${result.group.name}" deleted.` : result.error,
        result.ok ? 'ok' : 'warn',
      );
      render();
      break;
    }
    case 'remove-line': {
      captureDraft();
      const index = Number(trigger.dataset.index);
      draft.lines.splice(index, 1);
      if (draft.lines.length === 0) draft.lines.push({ ledgerId: '', side: 'Dr', amount: '' });
      render();
      break;
    }
    default:
      break;
  }
}

export function resetPeriodFilters() {
  filters.period = { from: '', to: '' };
  filters.statement = { from: '', to: '' };
  filters.daybook = { ...filters.daybook, from: '', to: '' };
  filters.register = { ...filters.register, from: '', to: '' };
  filters.stock = { from: '', to: '' };
  filters.orders = { from: '', to: '', status: 'All' };
  filters.cashBook = { ...filters.cashBook, from: '', to: '' };
  filters.outstanding = { ...filters.outstanding, asOn: '' };
  filters.billRegister = { ...filters.billRegister, from: '', to: '' };
  filters.partyStatement = { ...filters.partyStatement, from: '', to: '' };
  filters.forex = { asOn: '' };
  filters.gst = { from: '', to: '' };
  filters.tds = { ...filters.tds, from: '', to: '' };
}

export function handleChange(event) {
  const target = event.target;
  if (target.closest?.('#voucher-form')) scheduleVoucherDraftSave();
  if (target.matches?.('input[type="file"][data-xlsx-target]')) {
    const file = target.files?.[0];
    if (!file) return;
    const areaId = target.dataset.xlsxTarget;
    target.value = '';
    file
      .arrayBuffer()
      .then((buffer) => xlsxToCsv(buffer, target.dataset.xlsxSheet))
      .then((result) => {
        if (!result.rows) throw new Error(`Sheet "${result.sheetName}" has no data rows.`);
        setFlash(
          `Loaded ${result.rows} row${result.rows === 1 ? '' : 's'} from "${result.sheetName}". Review the box, then import.`,
        );
        render();
        const area = document.getElementById(areaId);
        if (area) {
          area.value = result.csv;
          area.focus();
        }
      })
      .catch((error) => {
        setFlash(error?.message || 'Could not read that Excel workbook.', 'warn');
        render();
      });
    return;
  }

  if (target.matches?.('input[type="file"][data-csv-target]')) {
    const file = target.files?.[0];
    if (!file) return;
    const area = document.getElementById(target.dataset.csvTarget);
    file
      .text()
      .then((text) => {
        if (area) area.value = text;
      })
      .catch(() => setFlash('Could not read that CSV file.', 'warn'));
    target.value = '';
    return;
  }

  if (target.id === 'bank-ledger-select') {
    view = { ...view, bankLedgerId: target.value };
    render();
    return;
  }

  if (target.id === 'user-select') {
    const result = setCurrentUser(state, target.value);
    if (result.ok) {
      persist();
      setFlash(`Now using ${result.user.name} · ${roleLabel(result.user.role)}.`);
    }
    render();
    return;
  }

  if (target.id === 'year-select') {
    const active = company();
    if (!active) return;
    const result = selectYear(active, target.value);
    if (result.ok) {
      resetPeriodFilters();
      persist();
      setFlash(`Viewing ${dateLabel(result.year.start)} to ${dateLabel(result.year.end)}.`);
    }
    render();
    return;
  }
  if (target.matches('#manufacture-form select[name="bomId"]')) {
    const active = company();
    const bom = (active?.boms ?? []).find((entry) => entry.id === target.value);
    const qty = document.querySelector('#manufacture-form [name="outputQty"]');
    if (bom && qty) qty.value = fmtQty(bom.outputQty);
    return;
  }
  if (view.screen !== 'voucherNew' || !draft) return;
  if (target.matches('#voucher-form input.ledger')) {
    refreshSettlement();
    return;
  }
  if (target.matches('#voucher-form [name="currencyCode"]')) {
    captureDraft();
    draft.currencyCode = target.value;
    const active = company();
    draft.exchangeRate = target.value === 'INR'
      ? ''
      : String(rateForCurrency(active, target.value, draft.date) ?? '');
    render();
    return;
  }
  if (target.matches('#voucher-form [name="date"]')) {
    const due = document.getElementById('voucher-form')?.querySelector('[name="billDueDate"]');
    if (due) due.min = target.value;
    refreshSettlement();
    return;
  }
  if (target.matches('#stock-items select.item')) {
    const row = target.closest('tr.item-line');
    const item = (company()?.stockItems ?? []).find((entry) => entry.id === target.value);
    const batch = row?.querySelector('input.batch');
    const expiry = row?.querySelector('input.expiry');
    if (batch) {
      batch.disabled = !item?.batchTracking;
      if (batch.disabled) batch.value = '';
    }
    if (expiry) {
      expiry.disabled = !item?.batchTracking;
      if (expiry.disabled) expiry.value = '';
    }
    return;
  }
  if (
    target.matches(
      '#voucher-form [name="gstRate"], #voucher-form [name="gstPlaceOfSupply"], #voucher-form [name="gstPartyGstin"], #voucher-form [name="gstReverseCharge"], #voucher-form [name="tdsSection"], #voucher-form [name="tdsPan"]',
    )
  ) {
    updateVoucherTotals();
    return;
  }
  if (target.matches('select.alloc-bill') && target.value) {
    const row = target.closest('tr.bill-allocation');
    const amountInput = row?.querySelector('input.alloc-amount');
    if (!row || !amountInput || amountInput.value.trim()) return;
    const line = draft.lines[Number(row.dataset.line)];
    if (!line) return;
    const open = partyOpenBills(company(), line.ledgerId, {
      asOn: draft.date,
      excludeVoucherId: view.editId,
    }).find((bill) => bill.voucherId === target.value);
    const suggested = Math.min(parseAmount(line.amount) ?? 0, open?.remaining ?? 0);
    if (suggested > 0) amountInput.value = suggested.toFixed(2);
  }
}

export let ledgerRefreshTimer = null;

export function previewRestore(payload) {
  const target = document.getElementById('restore-preview');
  if (!target) return;
  if (!payload.trim()) {
    target.textContent = '';
    return;
  }
  if (isEncryptedBackup(payload)) {
    target.textContent = 'Encrypted backup. Enter its passphrase to restore.';
    return;
  }
  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed.companies)) {
      target.textContent = 'This JSON has no companies array.';
      return;
    }
    const vouchers = parsed.companies.reduce((sum, item) => sum + (item.vouchers?.length ?? 0), 0);
    const ledgers = parsed.companies.reduce((sum, item) => sum + (item.ledgers?.length ?? 0), 0);
    target.textContent = `Contains ${parsed.companies.length} company${parsed.companies.length === 1 ? '' : 'ies'}, ${ledgers} ledger${ledgers === 1 ? '' : 's'} and ${vouchers} voucher${vouchers === 1 ? '' : 's'}.`;
  } catch {
    target.textContent = 'Not valid JSON yet.';
  }
}

export function handleInput(event) {
  const target = event.target;
  if (target.closest?.('#voucher-form')) scheduleVoucherDraftSave();
  if (target.matches('#restore-form textarea')) {
    previewRestore(target.value);
    return;
  }
  if (target.matches('#voucher-form input.ledger')) {
    if (ledgerRefreshTimer) clearTimeout(ledgerRefreshTimer);
    ledgerRefreshTimer = setTimeout(() => {
      if (view.screen !== 'voucherNew') return;
      const input = [...document.querySelectorAll('#voucher-form input.ledger')].find(
        (entry) => entry.value.trim() === target.value.trim(),
      );
      if (input && ledgerIdByName(input.value)) refreshSettlement();
    }, 250);
    return;
  }
  if (
    target.closest('#voucher-form') &&
    (target.classList.contains('amount') ||
      target.classList.contains('qty') ||
      target.classList.contains('rate') ||
      target.name === 'exchangeRate')
  ) {
    updateVoucherTotals();
    return;
  }
  if (target.id === 'ledger-search') {
    view.search = target.value;
    filterLedgerRows(target.value);
  }
}

export const SCREEN_KEYS = {
  k: 'masters',
  i: 'inventory',
  d: 'daybook',
  l: 'ledgerPick',
  t: 'trial',
  b: 'balanceSheet',
  p: 'pnl',
  v: 'vouchers',
  c: 'cashBank',
  r: 'registers',
  o: 'outstanding',
  g: 'groupSummary',
  f: 'cashFlow',
  y: 'ratios',
  s: 'statistics',
};

export const VOUCHER_KEYS = {
  F4: 'Contra',
  F5: 'Payment',
  F6: 'Receipt',
  F7: 'Journal',
  F8: 'Sales',
  F9: 'Purchase',
};

export function handleKeydown(event) {
  if (event.key === 'Enter' && event.target.closest?.('#inline-ledger')) {
    event.preventDefault();
    document.querySelector('[data-action="create-inline-ledger"]')?.click();
    return;
  }

  if (event.key === 'Escape') {
    if (view.screen !== 'gateway') {
      event.preventDefault();
      navigate('gateway');
    }
    return;
  }

  if (event.altKey && event.key === 'F2') {
    event.preventDefault();
    const first = document.querySelector('[data-period]');
    if (first) first.focus();
    return;
  }

  if (event.altKey && event.key.toLowerCase() === 's') {
    if (view.screen === 'voucherNew') {
      event.preventDefault();
      document.getElementById('voucher-form')?.requestSubmit();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && (event.key === 'F8' || event.key === 'F9')) {
    event.preventDefault();
    openVoucher(event.key === 'F8' ? 'CreditNote' : 'DebitNote');
    return;
  }

  if (event.ctrlKey || event.metaKey) return;

  if (event.key === 'F2') {
    event.preventDefault();
    const date = document.querySelector('#voucher-form [name="date"]');
    if (date) date.focus();
    return;
  }
  if (event.key === 'F3') {
    event.preventDefault();
    navigate('companies');
    return;
  }
  if (VOUCHER_KEYS[event.key]) {
    event.preventDefault();
    openVoucher(VOUCHER_KEYS[event.key]);
    return;
  }

  const target = event.target;
  if (target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;

  const screen = SCREEN_KEYS[event.key.toLowerCase()];
  if (screen) {
    event.preventDefault();
    if (screen === 'gateway' || company()) navigate(screen);
    else {
      setFlash('Create a company first.', 'warn');
      navigate('companies');
    }
  }
}

export async function startUI() {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app root element');
  root.addEventListener('click', handleClick);
  root.addEventListener('submit', handleSubmit);
  root.addEventListener('input', handleInput);
  root.addEventListener('change', handleChange);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('pagehide', () => {
    void releaseActiveLease();
  });

  await loadAuthState();
  if (authRequired && !authUser) {
    const params = new URLSearchParams(location.search);
    const resetToken = params.get('token') || params.get('reset') || '';
    if (resetToken === '1') {
      renderLogin('Open the reset link from your email to choose a new password.', 'muted small');
      return;
    }
    if (resetToken) renderPasswordReset(resetToken);
    else renderLogin();
    return;
  }
  if (authUser?.role === 'owner') await refreshAuthAccounts();
  if (authUser?.role === 'owner') await refreshApiTokens();
  if (authUser?.role === 'owner') await refreshServerBackups();
  if (authUser?.role === 'owner') await refreshReportSettings();
  if (authUser?.role === 'owner') await refreshAuthLogins();
  if (authUser?.role === 'owner') await refreshAuthSessions();
  if (authUser?.role === 'owner') await refreshServerAudit();
  if (authRequired) {
    state = emptyState();
    state.users = [];
    state.currentUserId = null;
  }

  const remoteState = await loadServerWorkspace();
  if (authRequired && !workspaceMode) {
    renderLogin('The server workspace could not be loaded. Sign in again or check the server.');
    return;
  }
  if (remoteState) {
    state = remoteState;
    if (!authRequired) saveState(state);
  }
  render();
  maybeAutoSnapshot();
  if (workspaceMode && !remoteState) queueWorkspaceSave();
}

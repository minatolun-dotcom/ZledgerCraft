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
import { xlsxToCsv } from './xlsx.js';

const WORKSPACE_KEY = 'zledgercraft.workspace.v1';
let state = loadState();
let workspaceMode = false;
let workspaceQueue = Promise.resolve();
let workspaceRev = 0;
let workspaceUpdatedAt = null;
let workspaceStorage = null;
let workspaceRemote = null;
let workspaceWatchTimer = null;
let view = { screen: 'gateway' };
let draft = null;
let flash = null;
let flashTimer = null;
let filters = {
  daybook: { type: 'All', from: '', to: '' },
  statement: { from: '', to: '' },
  period: { from: '', to: '' },
  register: { type: 'Sales', from: '', to: '' },
  outstanding: { side: 'receivable', asOn: '' },
  billRegister: { side: 'receivable', from: '', to: '', status: 'All' },
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

const HOTKEYS = [
  ['Esc', 'Gateway'],
  ['K', 'Masters'],
  ['V', 'Vouchers'],
  ['D', 'Day Book'],
  ['L', 'Ledger'],
  ['T', 'Trial Balance'],
  ['P', 'Profit & Loss'],
  ['B', 'Balance Sheet'],
  ['C', 'Cash & Bank'],
  ['R', 'Registers'],
  ['O', 'Outstanding'],
  ['I', 'Inventory'],
  ['G', 'Group Summary'],
  ['F', 'Cash Flow'],
  ['Y', 'Ratios'],
  ['S', 'Statistics'],
  ['Alt+F2', 'Period'],
];

function voucherLabel(type) {
  return VOUCHER_TYPES[type]?.label ?? type;
}

function fmtQty(value) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(rounded);
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function company() {
  return activeCompany(state);
}

const ROLE_PERMISSIONS = {
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
  ],
  accountant: ['voucher.write', 'voucher.delete', 'master.write', 'master.delete', 'recon.write'],
  viewer: [],
};

function currentProfile() {
  return activeUser(state);
}

function roleLabel(role) {
  return USER_ROLES[role]?.label ?? 'Viewer';
}

function can(action) {
  return (ROLE_PERMISSIONS[currentProfile()?.role] ?? []).includes(action);
}

function requirePermission(action) {
  if (can(action)) return true;
  setFlash(`${roleLabel(currentProfile()?.role)} profiles cannot make this change.`, 'warn');
  render();
  return false;
}

function workspaceAvailable() {
  return typeof location !== 'undefined' && ['http:', 'https:'].includes(location.protocol);
}

function workspaceRequested() {
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

function queueWorkspaceSave() {
  if (!workspaceMode) return workspaceQueue;
  const snapshot = JSON.parse(exportState(state));
  workspaceQueue = workspaceQueue
    .catch(() => {})
    .then(async () => {
      if (workspaceRemote?.conflict) return;
      const baseRev = workspaceRev;
      const response = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: snapshot, baseRev }),
      });
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        // Keep the status-based error below.
      }
      if (response.status === 409) {
        workspaceRemote = {
          rev: Number(payload.rev) || workspaceRev,
          updatedAt: payload.updatedAt ?? null,
          conflict: true,
        };
        const error = new Error(payload.error || 'The server workspace changed.');
        error.conflict = true;
        throw error;
      }
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Server workspace returned ${response.status}.`);
      }
      workspaceRev = Number(payload.rev) || baseRev + 1;
      workspaceUpdatedAt = payload.updatedAt ?? workspaceUpdatedAt;
      workspaceStorage = payload.storage ?? workspaceStorage;
      workspaceRemote = null;
      refreshWorkspaceBanner();
    })
    .catch((error) => {
      if (error.conflict) {
        refreshWorkspaceBanner();
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

function persist() {
  saveState(state);
  maybeAutoSnapshot();
  if (workspaceMode) queueWorkspaceSave();
}

function workspaceBannerHtml() {
  if (!workspaceMode || !workspaceRemote) return '';
  const when = workspaceRemote.updatedAt
    ? new Date(workspaceRemote.updatedAt).toLocaleString('en-IN')
    : 'an unknown time';
  const action = can('data.restore')
    ? '<button class="btn small" type="button" data-action="reload-workspace">Reload server copy</button>'
    : '';
  return workspaceRemote.conflict
    ? `<div class="role-banner warn" role="status">Server workspace changed at ${esc(when)} (revision ${workspaceRemote.rev}). The last change was kept in this browser but was not saved to the server. ${action}</div>`
    : `<div class="role-banner" role="status">A newer server workspace is available, saved ${esc(when)} (revision ${workspaceRemote.rev}). ${action}</div>`;
}

function refreshWorkspaceBanner() {
  const holder = document.getElementById('workspace-banner');
  if (holder) holder.innerHTML = workspaceBannerHtml();
}

function stopWorkspaceWatch() {
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

function startWorkspaceWatch() {
  if (workspaceWatchTimer || !workspaceMode) return;
  workspaceWatchTimer = setInterval(checkWorkspaceMeta, 8000);
  setTimeout(checkWorkspaceMeta, 1000);
}

async function loadServerWorkspace() {
  if (!workspaceRequested()) return null;
  workspaceMode = true;
  try {
    const response = await fetch('/api/workspace', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Workspace unavailable.');
    workspaceRev = Number(payload.rev) || 0;
    workspaceUpdatedAt = payload.updatedAt ?? null;
    workspaceStorage = payload.storage ?? null;
    workspaceRemote = null;
    localStorage.setItem(WORKSPACE_KEY, 'server');
    startWorkspaceWatch();
    if (payload.state) {
      const imported = importState(JSON.stringify(payload.state));
      if (!imported.ok) throw new Error(imported.error);
      return imported.state;
    }
    return null;
  } catch {
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

function logAudit(action, summary, active = company(), entity = '', actor = currentProfile()) {
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

function mergeAuditEntries(current, incoming) {
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
function applyRestoredState(nextState, summary) {
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
  if (nextState.users.some((user) => user.id === previousUserId)) {
    nextState.currentUserId = previousUserId;
  }
  state = nextState;
  const active = activeCompany(state);
  logAudit('data.restore', summary, active, '', actor);
  persist();
}

function voucherAuditLabel(voucher) {
  return `${voucherLabel(voucher.type)} ${voucher.no} · ${dateLabel(voucher.date)} · ${money(voucher.total)}`;
}

function setFlash(message, tone = 'ok') {
  flash = { message, tone };
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flash = null;
    document.querySelector('.flash')?.remove();
  }, 3200);
}

function money(value) {
  return fmtMoney(value);
}

function balanceLabel(value) {
  const rounded = round2(value);
  if (Math.abs(rounded) < 0.005) return `${money(0)}`;
  return `${money(Math.abs(rounded))} ${rounded > 0 ? 'Dr' : 'Cr'}`;
}

function navigate(screen, extra = {}) {
  view = { screen, ...extra };
  if (screen !== 'voucherNew') draft = null;
  render();
}

function requireCompany() {
  if (company()) return true;
  setFlash('Create a company first.', 'warn');
  navigate('companies');
  return false;
}

function ledgerNameById(ledgerId) {
  return company()?.ledgers.find((ledger) => ledger.id === ledgerId)?.name ?? '';
}

function ledgerIdByName(name) {
  const target = String(name ?? '').trim().toLowerCase();
  if (!target) return '';
  return company()?.ledgers.find((ledger) => ledger.name.trim().toLowerCase() === target)?.id ?? '';
}

function ledgerDatalistHtml() {
  const active = company();
  if (!active) return '';
  return `<datalist id="ledger-options">${ledgerOptions(active)
    .map((ledger) => `<option value="${esc(ledger.name)}">${esc(ledger.groupName)}</option>`)
    .join('')}</datalist>`;
}

function groupSelectOptions(selectedId) {
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

function reportPeriod(active) {
  return {
    from: filters.period.from || active.fyStart,
    to: filters.period.to || active.fyEnd,
  };
}

function periodBar(formId, from, to, extra = '') {
  return `<form id="${formId}" class="filter-bar">
    <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
    <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
    ${extra}
    <button class="btn small" type="submit">Apply</button>
  </form>`;
}

function asOnBar(formId, to) {
  return `<form id="${formId}" class="filter-bar">
    <label class="field inline-field"><span>As on</span><input name="to" type="date" value="${esc(to)}" data-period></label>
    <button class="btn small" type="submit">Apply</button>
  </form>`;
}

function groupParentOptions(selectedId = '', excludeId = null) {
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

function costCentreSelectOptions(active, selectedId) {
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

function bankLedgerSelectOptions(active, selectedId) {
  const banks = active.ledgers
    .filter((ledger) => groupChainKeys(active, ledger.groupId).includes('bank'))
    .sort((a, b) => a.name.localeCompare(b.name));
  return banks
    .map(
      (ledger) => `<option value="${esc(ledger.id)}"${ledger.id === selectedId ? ' selected' : ''}>${esc(ledger.name)}</option>`,
    )
    .join('');
}

function suggestedLedger(groupKey) {
  const active = company();
  if (!active) return '';
  const match = active.ledgers.find((ledger) => primaryKeyOf(active, ledger.groupId) === groupKey);
  return match ? match.id : '';
}

function voucherFormLines(type) {
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

function prepareDraft(type, source = null) {
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

function openVoucher(type) {
  if (!requirePermission('voucher.write')) return;
  if (!requireCompany()) return;
  prepareDraft(type);
  navigate('voucherNew', { type });
}

function openAlter(voucherId) {
  const active = company();
  if (!active) return;
  const voucher = active.vouchers.find((item) => item.id === voucherId);
  if (!voucher) {
    setFlash('Voucher not found.', 'warn');
    return;
  }
  prepareDraft(voucher.type, voucher);
  navigate('voucherNew', { type: voucher.type, editId: voucher.id });
}

function duplicateVoucher(voucherId) {
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

function orderToVoucher(orderId) {
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
  prepareDraft(type);
  draft.date = order.date;
  draft.lines = type === 'Sales'
    ? [
        { ledgerId: party.id, side: 'Dr', amount: order.total },
        { ledgerId: controlId, side: 'Cr', amount: order.total },
      ]
    : [
        { ledgerId: controlId, side: 'Dr', amount: order.total },
        { ledgerId: party.id, side: 'Cr', amount: order.total },
      ];
  draft.items = order.items.map((line) => ({ ...line }));
  draft.narration = `Against ${order.type === 'Sales' ? 'SO' : 'PO'}-${order.no}${order.narration ? ` · ${order.narration}` : ''}`;
  navigate('voucherNew', { type });
  setFlash(`Prefilled a ${type.toLowerCase()} voucher from ${order.type === 'Sales' ? 'SO' : 'PO'}-${order.no}. Review and accept it.`);
}

function formLines(form) {
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

function formBill(form) {
  const ref = form.querySelector('[name="billRef"]');
  const dueDate = form.querySelector('[name="billDueDate"]');
  return {
    ref: ref ? ref.value : '',
    dueDate: dueDate ? dueDate.value : '',
  };
}

function formInstrument(form) {
  const kind = form.querySelector('[name="instrumentKind"]');
  if (!kind) return null;
  return {
    kind: kind.value,
    number: form.querySelector('[name="instrumentNumber"]')?.value ?? '',
    date: form.querySelector('[name="instrumentDate"]')?.value ?? '',
    bankLedgerId: form.querySelector('[name="instrumentBank"]')?.value ?? '',
  };
}

function formGst(form) {
  const rate = form.querySelector('[name="gstRate"]');
  if (!rate) return null;
  return {
    rateId: rate.value,
    partyGstin: form.querySelector('[name="gstPartyGstin"]')?.value ?? '',
    placeOfSupply: form.querySelector('[name="gstPlaceOfSupply"]')?.value ?? '',
    reverseCharge: Boolean(form.querySelector('[name="gstReverseCharge"]')?.checked),
  };
}

function formTds(form) {
  const section = form.querySelector('[name="tdsSection"]');
  if (!section) return null;
  return {
    sectionId: section.value,
    pan: form.querySelector('[name="tdsPan"]')?.value ?? '',
  };
}

function tdsVoucherBlock(active) {
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

function gstVoucherBlock(active) {
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

function captureDraft() {
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

function readVoucherForm() {
  const form = document.getElementById('voucher-form');
  const itemTable = document.getElementById('stock-items');
  return {
    type: draft.type,
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

function stockItemSelectOptions(active, selectedId) {
  const units = new Map((active.units ?? []).map((unit) => [unit.id, unit]));
  let html = '<option value="">Select item…</option>';
  for (const item of active.stockItems ?? []) {
    const unit = units.get(item.unitId)?.symbol ?? '';
    html += `<option value="${esc(item.id)}"${item.id === selectedId ? ' selected' : ''}>${esc(item.name)}${unit ? ` · ${esc(unit)}` : ''}</option>`;
  }
  return html;
}

function godownSelectOptions(active, selectedId) {
  const main = defaultGodownId(active);
  return (active.godowns ?? [])
    .map(
      (godown) => `<option value="${esc(godown.id)}"${(selectedId || main) === godown.id ? ' selected' : ''}>${esc(godown.name)}</option>`,
    )
    .join('');
}

function itemLineAmount(line) {
  const qty = parseQty(line.qty) ?? 0;
  const rate = parseAmount(line.rate) ?? 0;
  return round2(qty * rate);
}

function gstTaxableValue(form, active) {
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

function tdsBaseValue(form) {
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

function updateVoucherTotals() {
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

function headerHtml(active) {
  return `
    <header class="topbar">
      <div class="brand">Zledger<span>CRAFT</span></div>
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
        <label class="user-picker" title="Local profile — access control, not authentication">
          <span class="label">User</span>
          <select id="user-select" aria-label="Active user">
            ${(state.users ?? [])
              .map(
                (user) => `<option value="${esc(user.id)}"${user.id === state.currentUserId ? ' selected' : ''}>${esc(user.name)} · ${esc(roleLabel(user.role))}</option>`,
              )
              .join('')}
          </select>
        </label>
        <span class="today">${esc(dateLabel(todayIso()))}</span>
        <button class="btn ghost" data-screen="companies" type="button">Company <kbd>F3</kbd></button>
      </div>
    </header>`;
}

function asideHtml(active) {
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
      <nav>
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
      <p class="side-note">${workspaceMode ? 'Local server workspace. Data stays on this machine.' : 'Local-only. Data stays in this browser.'}</p>
    </aside>`;
}

function footerHtml() {
  const hints = [...HOTKEYS];
  if (view.screen === 'voucherNew') hints.push(['Alt+S', 'Save voucher']);
  return `<footer class="statusbar">
    ${hints.map(([key, label]) => `<span class="hint"><kbd>${key}</kbd> ${label}</span>`).join('')}
  </footer>`;
}

function flashHtml() {
  if (!flash) return '';
  return `<div class="flash ${flash.tone}" role="status" aria-live="polite">${esc(flash.message)}</div>`;
}

function roleBannerHtml() {
  const user = currentProfile();
  if (!user || user.role === 'owner') return '';
  if (user.role === 'viewer') {
    return `<div class="role-banner warn" role="status">Viewer profile — read-only. Reports, search, print and CSV are available; switching profile is not a sign-in.</div>`;
  }
  return `<div class="role-banner" role="status">Accountant profile — vouchers and masters are editable; companies, financial years, users and restores are owner-only.</div>`;
}

const REPORT_SCREENS = new Set([
  'daybook',
  'ledger',
  'trial',
  'pnl',
  'balanceSheet',
  'cashBank',
  'registers',
  'outstanding',
  'billRegister',
  'partyStatement',
  'groupSummary',
  'groupVouchers',
  'cashFlow',
  'ratios',
  'statistics',
  'inventory',
  'orders',
  'yearComparison',
  'audit',
  'postDated',
  'costCentres',
  'costCentreDetail',
  'budgets',
  'forex',
  'gst',
  'tds',
  'einvoice',
  'ewaybill',
  'taxAudit',
  'payrollRegister',
  'payslip',
]);

const REPORT_TITLES = {
  daybook: 'Day Book',
  ledger: 'Ledger statement',
  trial: 'Trial Balance',
  pnl: 'Profit & Loss',
  balanceSheet: 'Balance Sheet',
  cashBank: 'Cash & Bank',
  registers: 'Registers',
  outstanding: 'Outstanding',
  billRegister: 'Bill-wise register',
  partyStatement: 'Party statement',
  groupSummary: 'Group Summary',
  groupVouchers: 'Group vouchers',
  cashFlow: 'Cash Flow',
  ratios: 'Ratio Analysis',
  statistics: 'Statistics',
  inventory: 'Inventory',
  orders: 'Orders',
  yearComparison: 'Year comparison',
  audit: 'Audit trail',
  postDated: 'Cheque / DD register',
  costCentres: 'Cost centre summary',
  costCentreDetail: 'Cost centre break-up',
  budgets: 'Budget vs Actual',
  forex: 'Forex Revaluation',
  gst: 'GST returns',
  tds: 'TDS / TCS register',
  einvoice: 'E-invoice register',
  ewaybill: 'E-way bill register',
  taxAudit: 'Tax audit working papers',
  payrollRegister: 'Salary register',
  payslip: 'Payslip',
};

const AUDIT_ACTION_LABELS = {
  'company.create': 'Company created',
  'company.update': 'Company updated',
  'company.delete': 'Company deleted',
  'ledger.create': 'Ledger created',
  'ledger.update': 'Ledger updated',
  'ledger.delete': 'Ledger deleted',
  'group.create': 'Group created',
  'group.update': 'Group updated',
  'group.delete': 'Group deleted',
  'budget.create': 'Budget created',
  'budget.delete': 'Budget deleted',
  'currency.create': 'Currency created',
  'currency.rate': 'Exchange rate saved',
  'currency.delete': 'Currency deleted',
  'costCategory.create': 'Cost category created',
  'costCategory.delete': 'Cost category deleted',
  'costCentre.create': 'Cost centre created',
  'costCentre.delete': 'Cost centre deleted',
  'order.create': 'Order recorded',
  'order.status': 'Order status changed',
  'order.delete': 'Order deleted',
  'godown.create': 'Godown created',
  'godown.delete': 'Godown deleted',
  'stockTransfer.create': 'Stock transfer recorded',
  'stockTransfer.delete': 'Stock transfer deleted',
  'stockItem.create': 'Stock item created',
  'stockItem.update': 'Stock item updated',
  'stockItem.delete': 'Stock item deleted',
  'stockGroup.create': 'Stock group created',
  'stockGroup.delete': 'Stock group deleted',
  'unit.create': 'Unit created',
  'unit.delete': 'Unit deleted',
  'voucher.create': 'Voucher created',
  'voucher.update': 'Voucher altered',
  'voucher.delete': 'Voucher deleted',
  'year.add': 'Financial year added',
  'year.close': 'Financial year closed',
  'year.reopen': 'Financial year reopened',
  'ledger.import': 'Ledgers imported',
  'voucher.import': 'Vouchers imported',
  'bankRecon.import': 'Bank statement imported',
  'bankRecon.auto': 'Bank auto-match run',
  'bankRecon.match': 'Bank line matched',
  'bankRecon.unmatch': 'Bank line unmatched',
  'bankRecon.clear': 'Bank statement cleared',
  'data.restore': 'Data restored',
  'payroll.settings': 'Payroll settings saved',
  'payroll.head': 'Pay head created',
  'payroll.head.delete': 'Pay head deleted',
  'employee.create': 'Employee created',
  'employee.update': 'Employee updated',
  'employee.delete': 'Employee deleted',
  'payroll.run': 'Payroll run posted',
  'payroll.run.delete': 'Payroll run deleted',
};

function auditActionLabel(action) {
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];
  return String(action || 'Activity')
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function reportPeriodLabel() {
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
    return `${span(filters.billRegister.from, to)} · status as on ${dateLabel(to)}`;
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

function reportToolbarHtml() {
  if (!REPORT_SCREENS.has(view.screen) || !company()) return '';
  const title = REPORT_TITLES[view.screen] ?? 'Report';
  return `<div class="report-toolbar">
    <span class="muted">${esc(title)} · ${esc(reportPeriodLabel())}</span>
    <div class="toolbar-actions">
      <button class="btn small ghost" type="button" data-action="print-report">Print</button>
      <button class="btn small ghost" type="button" data-action="export-csv">Export CSV</button>
    </div>
  </div>`;
}

function printHeaderHtml() {
  if (!REPORT_SCREENS.has(view.screen) || !company()) return '';
  const title = REPORT_TITLES[view.screen] ?? 'Report';
  return `<div class="print-only print-head">
    <strong>${esc(company().name)}</strong>
    <span>${esc(title)} · ${esc(reportPeriodLabel())}</span>
  </div>`;
}

function panel(title, body, subtitle = '') {
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

function emptyCompanyScreen(title) {
  return panel(
    title,
    `<p class="muted">Open or create a company to use this screen.</p>
     <button class="btn primary" type="button" data-screen="companies">Go to Company Info <kbd>F3</kbd></button>`,
  );
}

function kpisHtml(stats) {
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

function gatewayScreen() {
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

function financialYearsPanel(active) {
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
    <div class="table-scroll"><table class="data-table compact year-table">
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

function usersPanel() {
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

function companiesScreen() {
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
        ? `<div class="table-scroll"><table class="data-table companies-table">
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

function budgetTargetOptions(active, selected = '') {
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

function budgetMastersPanel(active) {
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
      ? `<div class="table-scroll"><table class="data-table compact budget-table">
          <thead><tr><th>Budget</th><th>Target</th><th>Year</th><th class="num">Amount</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No budgets yet. Add one above, then open Budget vs Actual.</p>'}`,
  );
}

function costCentreMastersPanel(active) {
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

function currencyMastersPanel(active) {
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

function mastersScreen() {
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

function vouchersScreen() {
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

function settlementContentHtml(active) {
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

function applyPartyGstDefaults() {
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

function refreshSettlement() {
  const container = document.getElementById('bill-settlement');
  if (!container) return;
  applyPartyGstDefaults();
  captureDraft();
  container.innerHTML = settlementContentHtml(company());
  updateVoucherTotals();
}

function inlineLedgerBlock(active) {
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

let inlineLedger = null;

function voucherNewScreen() {
  if (!company()) return emptyCompanyScreen('New voucher');
  if (!draft || draft.type !== view.type) return '';
  const active = company();
  const meta = VOUCHER_TYPES[draft.type];
  const editing = view.editId ? active.vouchers.find((item) => item.id === view.editId) : null;
  const nextNo = editing ? editing.no : (active.counters[draft.type] ?? 0) + 1;

  const rows = draft.lines
    .map(
      (line, index) => `
      <tr class="line">
        <td><div class="ledger-field">
          <input class="ledger" list="ledger-options" autocomplete="off" value="${esc(ledgerNameById(line.ledgerId))}"
            placeholder="Start typing a ledger…" aria-label="Line ${index + 1} ledger">
          <button type="button" class="icon-btn" data-action="new-ledger-inline" data-index="${index}"
            title="Create a ledger and use it here" aria-label="Create ledger for line ${index + 1}">+</button>
        </div></td>
        <td>
          <select class="side" aria-label="Line ${index + 1} side">
            <option${line.side === 'Dr' ? ' selected' : ''}>Dr</option>
            <option${line.side === 'Cr' ? ' selected' : ''}>Cr</option>
          </select>
        </td>
        <td class="num"><input class="amount" inputmode="decimal" placeholder="0.00" value="${esc(line.amount)}"
          aria-label="Line ${index + 1} amount"></td>
        <td><select class="cost-centre" aria-label="Line ${index + 1} cost centre">${costCentreSelectOptions(active, line.costCentreId)}</select></td>
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
        <td><select class="item" aria-label="Item ${index + 1}">${stockItemSelectOptions(active, line.stockItemId)}</select></td>
        <td><select class="godown" aria-label="Item ${index + 1} godown">${godownSelectOptions(active, line.godownId)}</select></td>
        <td><input class="batch" maxlength="30" placeholder="Batch" value="${esc(line.batchNo ?? '')}"
          aria-label="Item ${index + 1} batch"${stockItems.find((item) => item.id === line.stockItemId)?.batchTracking ? '' : ' disabled'}>
          <input class="expiry" type="date" value="${esc(line.expiryDate ?? '')}"
            aria-label="Item ${index + 1} expiry"${stockItems.find((item) => item.id === line.stockItemId)?.batchTracking ? '' : ' disabled'}></td>
        <td class="num"><input class="qty" inputmode="decimal" placeholder="0" value="${esc(line.qty)}"
          aria-label="Item ${index + 1} quantity"></td>
        <td class="num"><input class="rate" inputmode="decimal" placeholder="0.00" value="${esc(line.rate)}"
          aria-label="Item ${index + 1} rate"></td>
        <td class="num item-amount">${money(itemLineAmount(line))}</td>
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
          ? `<table class="lines-table" id="stock-items">
              <thead><tr><th>Item</th><th>Godown</th><th>Batch / expiry</th><th class="num">Quantity</th><th class="num">Rate</th><th class="num">Amount</th><th></th></tr></thead>
              <tbody>${itemRows}</tbody>
            </table>
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
          <p class="eyebrow">${editing ? 'Voucher alteration' : 'Voucher entry'}</p>
          <h1>${editing ? 'Alter' : 'New'} ${esc(meta.label)} voucher <span class="badge">${meta.shortcut}</span></h1>
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
      <table class="lines-table">
        <thead><tr><th>Particulars</th><th>Dr/Cr</th><th class="num">Amount${foreign ? ` (${esc(draft.currencyCode)})` : ''}</th><th>Cost centre</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
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
        <button class="btn primary" type="submit">${editing ? 'Update voucher' : 'Accept'} <kbd>Alt+S</kbd></button>
        <button class="btn ghost" type="button" data-screen="gateway">Esc · Gateway</button>
        <button class="btn ghost" type="button" data-screen="daybook">Day Book</button>
      </div>
    </form>`;
}

function voucherViewScreen() {
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

function daybookScreen() {
  if (!company()) return emptyCompanyScreen('Day Book');
  const active = company();
  const current = filters.daybook;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const rows = dayBook(active, { ...current, from, to });
  const total = round2(rows.reduce((sum, voucher) => sum + voucher.total, 0));
  const typeOptions = ['All', ...Object.keys(VOUCHER_TYPES)]
    .map(
      (type) =>
        `<option value="${type}"${current.type === type ? ' selected' : ''}>${type === 'All' ? 'All voucher types' : esc(voucherLabel(type))}</option>`,
    )
    .join('');

  return panel(
    'Day Book',
    `<form id="daybook-form" class="filter-bar">
      <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}"></label>
      <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}"></label>
      <label class="field inline-field"><span>Type</span><select name="type">${typeOptions}</select></label>
      <button class="btn small" type="submit">Apply</button>
      <button class="btn small ghost" type="button" data-action="new-voucher" data-type="Payment"${can('voucher.write') ? '' : ' disabled'}>New voucher <kbd>F5</kbd></button>
    </form>
    ${rows.length
      ? `<table class="data-table">
          <thead><tr><th>Date</th><th>Voucher</th><th>Type</th><th>Particulars</th><th class="num">Amount</th></tr></thead>
          <tbody>${rows
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
          <tfoot><tr><td colspan="4">${rows.length} voucher${rows.length === 1 ? '' : 's'}</td><td class="num">${money(total)}</td></tr></tfoot>
        </table>`
      : '<p class="muted">No vouchers in this range.</p>'}`,
    'Click a row to open the voucher.',
  );
}

function ledgerPickScreen() {
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

function ledgerScreen() {
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

function trialScreen() {
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

function pnlScreen() {
  if (!company()) return emptyCompanyScreen('Profit & Loss');
  const active = company();
  const { from, to } = reportPeriod(active);
  const report = profitAndLoss(active, { from, to });
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
      `${primaryName('sales')} less ${primaryName('purchase')} and direct expenses · ${esc(dateLabel(report.from))} to ${esc(dateLabel(report.to))}`,
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
    )}`;
}

function balanceSheetScreen() {
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

function cashBankScreen() {
  if (!company()) return emptyCompanyScreen('Cash & Bank Book');
  const active = company();
  const current = filters.cashBook;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const report = cashBankBook(active, { from, to, ledgerId: current.ledgerId || undefined });
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

  return panel(
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
  );
}

function registersScreen() {
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

function outstandingScreen() {
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
        <td><strong>${esc(party.name)}</strong></td>
        ${AGE_BUCKETS.map(
          (bucket) => `<td class="num">${cell(
            party.bills.filter((bill) => bill.bucket === bucket.key).reduce((sum, bill) => sum + bill.amount, 0),
          )}</td>`,
        ).join('')}
        <td class="num">${money(party.outstanding)}</td>
        <td class="num">${cell(party.advance)}</td>
      </tr>`,
    )
    .join('');

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
            <thead><tr><th>${partyLabel}</th>${AGE_BUCKETS.map((bucket) => `<th class="num">${esc(bucket.label)}</th>`).join('')}<th class="num">Outstanding</th><th class="num">Advance</th></tr></thead>
            <tbody>${partyRows}</tbody>
            <tfoot><tr><td>Total</td>${AGE_BUCKETS.map((bucket) => `<td class="num">${money(report.buckets[bucket.key])}</td>`).join('')}<td class="num">${money(report.total)}</td><td class="num">${money(report.advances)}</td></tr></tfoot>
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
      : ''}`;
}

function partyLedgerList(active, side) {
  const key = side === 'payable' ? 'sundryCreditors' : 'sundryDebtors';
  return active.ledgers
    .filter((ledger) => inGroupKey(active, ledger, key))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function billStatusBadge(status) {
  const tone = status === 'Overdue' ? 'overdue' : status === 'Part-paid' ? 'attention' : '';
  return `<span class="badge${tone ? ` ${tone}` : ''}">${esc(status)}</span>`;
}

function billRegisterScreen() {
  if (!company()) return emptyCompanyScreen('Bill-wise register');
  const active = company();
  const current = filters.billRegister;
  const side = current.side === 'payable' ? 'payable' : 'receivable';
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const status = current.status || 'All';
  const report = billWiseRegister(active, { side, from, to, status });
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
        </td>
        <td>${esc(dateLabel(row.date))}</td>
        <td>${row.dueDate ? esc(dateLabel(row.dueDate)) : '<span class="muted">—</span>'}</td>
        <td class="num">${money(row.original)}</td>
        <td class="num">${money(row.settled)}</td>
        <td class="num">${money(row.amount)}</td>
        <td>${billStatusBadge(row.status)}</td>
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
      <label class="field inline-field"><span>Status</span><select name="status">${statusOptions}</select></label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    ${report.rows.length
      ? `<div class="table-scroll"><table class="data-table compact bill-register-table">
          <thead><tr><th>${partyLabel}</th><th>Bill</th><th>Bill date</th><th>Due date</th><th class="num">Bill amount</th><th class="num">Settled</th><th class="num">Outstanding</th><th>Status</th><th class="num">Overdue days</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4">${report.count} bill${report.count === 1 ? '' : 's'} · ${report.partyCount} part${report.partyCount === 1 ? 'y' : 'ies'}${report.overdueCount ? ` · ${report.overdueCount} overdue` : ''}</td><td class="num">${money(report.totalOriginal)}</td><td class="num">${money(report.totalSettled)}</td><td class="num">${money(report.totalOutstanding)}</td><td colspan="2"></td></tr></tfoot>
        </table></div>`
      : `<p class="muted">No ${side === 'receivable' ? 'customer' : 'supplier'} bills in this period${status === 'All' ? '' : ` with status ${esc(status)}`}.</p>`}`,
    `Bills dated ${esc(dateLabel(from))} to ${esc(dateLabel(to))} · status as on ${esc(dateLabel(to))}. Fully settled bills remain listed. Click a party for its statement, or a bill to open the voucher.`,
  );
}

function partyStatementScreen() {
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
            ? `<div class="table-scroll"><table class="data-table compact bill-register-table">
                <thead><tr><th>Bill</th><th>Bill date</th><th>Due date</th><th class="num">Bill amount</th><th class="num">Settled</th><th class="num">Outstanding</th><th>Status</th><th class="num">Overdue days</th></tr></thead>
                <tbody>${billRows}</tbody>
                <tfoot><tr><td colspan="3">${report.billCount} bill${report.billCount === 1 ? '' : 's'}</td><td class="num">${money(report.billOriginal)}</td><td class="num">${money(report.billSettled)}</td><td class="num">${money(report.billOutstanding)}</td><td colspan="2"></td></tr></tfoot>
              </table></div>`
            : '<p class="muted">No sales or purchase bills for this party up to the report date.</p>',
          `All bills up to ${esc(dateLabel(to))}; fully settled bills are included.`,
        )
      : ''}`;
}

function groupSummaryScreen() {
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

function groupVouchersScreen() {
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

function cashFlowScreen() {
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

function ratiosScreen() {
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

function auditScreen() {
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
      ? `<div class="table-scroll"><table class="data-table compact audit-table">
          <thead><tr><th>When</th><th>Action</th><th>By</th><th>Company</th><th>Details</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No activity matches this filter.</p>'}`,
    'Backups preserve this log; restoring data adds a restore event instead of erasing history.',
  );
}

function yearComparisonScreen() {
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
    `<div class="table-scroll"><table class="data-table year-compare">
      <thead><tr><th>Metric</th>${head}</tr></thead>
      <tbody>${body}<tr><td>Vouchers</td>${voucherCells}</tr></tbody>
    </table></div>`,
    'Profit and loss covers each year on its own; assets, liabilities and balances are cumulative at each year end.',
  );
}

function statisticsScreen() {
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
    ${panel(
      'Monthly MIS',
      `<div class="mis-chart" role="img" aria-label="Monthly sales and purchases">
        <div class="mis-legend"><span><i class="mis-dot sales"></i>Sales</span><span><i class="mis-dot purchases"></i>Purchases</span></div>
        <div class="mis-grid">${trend}</div>
      </div>
      <div class="table-scroll"><table class="data-table compact">
        <thead><tr><th>Month</th><th class="num">Sales</th><th class="num">Returns</th><th class="num">Net sales</th><th class="num">Purchases</th><th class="num">Purchase returns</th><th class="num">Net purchases</th><th class="num">Receipts</th><th class="num">Payments</th><th class="num">Net cash</th></tr></thead>
        <tbody>${misRows}</tbody>
        <tfoot><tr><td>Financial year</td><td class="num">${money(total.sales)}</td><td class="num">${money(total.creditNotes)}</td><td class="num">${money(netSales)}</td><td class="num">${money(total.purchases)}</td><td class="num">${money(total.debitNotes)}</td><td class="num">${money(netPurchases)}</td><td class="num">${money(total.receipts)}</td><td class="num">${money(total.payments)}</td><td class="num">${money(netCash)}</td></tr></tfoot>
      </table></div>`,
      'Net sales and purchases deduct credit/debit notes. Net cash is receipts minus payments. Journal and contra vouchers are excluded from the trend.',
    )}
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

function allPartyLedgerOptions(active, selectedId) {
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

function ordersScreen() {
  if (!company()) return emptyCompanyScreen('Orders');
  const active = company();
  const current = filters.orders;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const status = current.status || 'All';
  const orders = [...(active.orders ?? [])]
    .filter((order) => order.date >= from && order.date <= to)
    .filter((order) => status === 'All' || order.status === status)
    .sort((a, b) => b.date.localeCompare(a.date) || b.no - a.no);
  const parties = new Map((active.ledgers ?? []).map((ledger) => [ledger.id, ledger]));
  const items = new Map((active.stockItems ?? []).map((item) => [item.id, item]));
  const units = new Map((active.units ?? []).map((unit) => [unit.id, unit]));
  const openOrders = orders.filter((order) => order.status === 'Open');
  const openValue = round2(openOrders.reduce((sum, order) => sum + order.total, 0));

  const rows = orders
    .map((order) => {
      const line = order.items?.[0];
      const item = items.get(line?.stockItemId);
      const unit = units.get(item?.unitId)?.symbol ?? '';
      const party = parties.get(order.partyLedgerId);
      const prefix = order.type === 'Sales' ? 'SO' : 'PO';
      const actions = [
        order.status === 'Open'
          ? `<button class="btn small" type="button" data-action="order-to-voucher" data-id="${esc(order.id)}">Create voucher</button>`
          : '',
        order.status === 'Open'
          ? `<button class="btn small ghost" type="button" data-action="order-status" data-id="${esc(order.id)}" data-status="Closed">Close</button>`
          : '',
        order.status === 'Open'
          ? `<button class="btn small ghost" type="button" data-action="order-status" data-id="${esc(order.id)}" data-status="Cancelled">Cancel</button>`
          : '',
        order.status !== 'Open'
          ? `<button class="btn small ghost" type="button" data-action="order-status" data-id="${esc(order.id)}" data-status="Open">Reopen</button>`
          : '',
        `<button class="btn small danger" type="button" data-action="delete-order" data-id="${esc(order.id)}">Delete</button>`,
      ].join(' ');
      const tone = order.status === 'Open' ? '' : order.status === 'Cancelled' ? 'overdue' : 'attention';
      return `<tr>
        <td><strong>${prefix}-${order.no}</strong><div class="muted small">${esc(dateLabel(order.date))}</div></td>
        <td>${esc(party?.name ?? 'Unknown party')}<div class="muted small">${order.type}</div></td>
        <td>${order.deliveryDate ? esc(dateLabel(order.deliveryDate)) : '<span class="muted">—</span>'}</td>
        <td>${esc(item?.name ?? 'Unknown item')}${line?.batchNo ? `<div class="muted small">Batch ${esc(line.batchNo)}</div>` : ''}</td>
        <td class="num">${fmtQty(line?.qty ?? 0)} ${esc(unit)}</td>
        <td class="num">${money(order.total)}</td>
        <td><span class="badge${tone ? ` ${tone}` : ''}">${esc(order.status)}</span></td>
        <td class="row-actions">${actions}</td>
      </tr>`;
    })
    .join('');

  return `${panel(
    'Orders',
    `<form id="orders-filter" class="filter-bar">
      <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}"></label>
      <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}"></label>
      <label class="field inline-field"><span>Status</span><select name="status">${['All', 'Open', 'Closed', 'Cancelled'].map((value) => `<option${status === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    <div class="gst-grid">
      <div class="ratio-card"><span class="ratio-label">Orders</span><strong>${orders.length}</strong><span class="muted small">In this period</span></div>
      <div class="ratio-card"><span class="ratio-label">Open</span><strong>${openOrders.length}</strong><span class="muted small">Not closed or cancelled</span></div>
      <div class="ratio-card"><span class="ratio-label">Open value</span><strong>${money(openValue)}</strong><span class="muted small">Across open orders</span></div>
    </div>
    ${orders.length
      ? `<table class="data-table compact">
          <thead><tr><th>Order</th><th>Party</th><th>Delivery</th><th>Item</th><th class="num">Quantity</th><th class="num">Value</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : '<p class="muted">No orders in this period. Record one below; orders do not post to the ledger or move stock.</p>'}`,
    'Open orders can prefill a sales or purchase voucher. Creating the voucher does not change the order status.',
  )}
  ${panel(
    'New order',
    `<form id="order-form" class="form-grid" novalidate>
      <label class="field"><span>Order type</span><select name="type"><option>Sales</option><option>Purchase</option></select></label>
      <label class="field"><span>Order date</span><input name="date" type="date" value="${esc(to <= todayIso() ? to : todayIso())}" min="${esc(booksStart(active))}" required></label>
      <label class="field"><span>Party</span><select name="partyLedgerId">${allPartyLedgerOptions(active, '')}</select></label>
      <label class="field"><span>Expected delivery</span><input name="deliveryDate" type="date"></label>
      <label class="field"><span>Item</span><select name="stockItemId">${stockItemSelectOptions(active, '')}</select></label>
      <label class="field"><span>Godown</span><select name="godownId">${godownSelectOptions(active, '')}</select></label>
      <label class="field"><span>Batch (if tracked)</span><input name="batchNo" maxlength="30" placeholder="e.g. LOT-24"></label>
      <label class="field"><span>Expiry (if tracked)</span><input name="expiryDate" type="date"></label>
      <label class="field"><span>Quantity</span><input name="qty" inputmode="decimal" placeholder="0" required></label>
      <label class="field"><span>Rate</span><input name="rate" inputmode="decimal" placeholder="0.00" required></label>
      <label class="field"><span>Narration</span><input name="narration" maxlength="400" placeholder="Optional note"></label>
      <div class="field form-actions"><button class="btn primary" type="submit">Record order</button></div>
      <p id="order-error" class="form-error" role="alert"></p>
    </form>`,
    'One item per order for now; create another order for additional lines.',
  )}`;
}

function bomComponentRow(active) {
  return `<div class="bom-row">
    <label class="field"><span>Component item</span><select name="componentItemId">${stockItemSelectOptions(active, '')}</select></label>
    <label class="field"><span>Quantity</span><input name="componentQty" inputmode="decimal" placeholder="0" aria-label="Component quantity"></label>
    <button class="btn small ghost" type="button" data-action="remove-bom-component">Remove</button>
  </div>`;
}

function inventoryScreen() {
  if (!company()) return emptyCompanyScreen('Inventory');
  const active = company();
  const period = filters.stock;
  const from = period.from || active.fyStart;
  const to = period.to || active.fyEnd;
  const report = stockSummary(active, { from, to });
  const godownReport = godownStockSummary(active, { from, to });
  const batchReport = batchStockSummary(active, { from, to });
  const transfers = [...(active.stockTransfers ?? [])].sort(
    (a, b) => b.date.localeCompare(a.date) || b.no - a.no,
  );
  const boms = [...(active.boms ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const manufactures = [...(active.manufactures ?? [])].sort(
    (a, b) => b.date.localeCompare(a.date) || b.no - a.no,
  );
  const units = active.units ?? [];
  const groups = active.stockGroups ?? [];
  const items = active.stockItems ?? [];
  const godowns = active.godowns ?? [];
  const selectedItem = view.stockItemId ? items.find((item) => item.id === view.stockItemId) : null;
  const movement = selectedItem ? stockMovements(active, selectedItem.id, { from, to }) : null;
  const editing = view.editingItemId ? items.find((item) => item.id === view.editingItemId) : null;

  const summaryRows = report.rows
    .map(
      (row) => `<tr class="clickable" data-action="stock-movements" data-id="${esc(row.itemId)}">
        <td><strong>${esc(row.name)}</strong></td>
        <td class="muted">${esc(row.groupName)}</td>
        <td>${esc(row.unit)}</td>
        <td class="num">${fmtQty(row.openingQty)}</td>
        <td class="num">${row.inQty ? fmtQty(row.inQty) : '—'}</td>
        <td class="num">${row.outQty ? fmtQty(row.outQty) : '—'}</td>
        <td class="num ${row.closingQty < 0 ? 'neg' : ''}"><strong>${fmtQty(row.closingQty)}</strong></td>
        <td class="num">${money(row.averageRate)}</td>
        <td class="num">${money(row.closingValue)}</td>
      </tr>`,
    )
    .join('');

  const movementRows = movement
    ? movement.rows
        .map(
          (row) => `<tr>
            <td>${esc(dateLabel(row.date))}</td>
            <td><strong>${esc(row.label ?? `${voucherLabel(row.type)} ${row.no}`)}</strong></td>
            <td class="muted">${esc(row.narration || '—')}</td>
            <td class="num">${row.inQty ? fmtQty(row.inQty) : ''}</td>
            <td class="num">${row.outQty ? fmtQty(row.outQty) : ''}</td>
            <td class="num">${money(row.rate)}</td>
            <td class="num ${row.balanceQty < 0 ? 'neg' : ''}">${fmtQty(row.balanceQty)}</td>
            <td class="num">${money(row.balanceValue)}</td>
          </tr>`,
        )
        .join('')
    : '';

  const itemRows = items
    .map((item) => {
      const group = groups.find((entry) => entry.id === item.stockGroupId);
      const unit = units.find((entry) => entry.id === item.unitId);
      return `<tr>
        <td><strong>${esc(item.name)}</strong></td>
        <td class="muted">${esc(group?.name ?? 'Primary')}</td>
        <td>${esc(unit?.symbol ?? '')}</td>
        <td>${item.hsn ? esc(item.hsn) : '<span class="muted">—</span>'}</td>
        <td>${item.batchTracking ? 'Yes' : '<span class="muted">No</span>'}</td>
        <td class="num">${fmtQty(item.openingQty)}</td>
        <td class="num">${money(item.openingRate)}</td>
        <td class="row-actions">
          <button class="btn small" type="button" data-action="edit-stock-item" data-id="${esc(item.id)}">Edit</button>
          <button class="btn small danger" type="button" data-action="delete-stock-item" data-id="${esc(item.id)}">Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  const unitRows = units
    .map(
      (unit) => `<tr>
        <td>${esc(unit.name)}</td>
        <td class="muted">${esc(unit.symbol)}</td>
        <td class="row-actions"><button class="btn small danger" type="button" data-action="delete-unit" data-id="${esc(unit.id)}">Delete</button></td>
      </tr>`,
    )
    .join('');

  const groupRows = groups
    .map(
      (group) => `<tr>
        <td>${esc(group.name)}${group.primary ? ' <span class="badge">primary</span>' : ''}</td>
        <td class="row-actions">
          <button class="btn small danger" type="button" data-action="delete-stock-group" data-id="${esc(group.id)}"
            ${group.primary ? 'disabled' : ''}>Delete</button>
        </td>
      </tr>`,
    )
    .join('');

  const godownRows = godowns
    .map(
      (godown) => `<tr>
        <td>${esc(godown.name)}${godown.primary ? ' <span class="badge">primary</span>' : ''}</td>
        <td class="row-actions"><button class="btn small danger" type="button" data-action="delete-godown" data-id="${esc(godown.id)}"
          ${godown.primary ? 'disabled' : ''}>Delete</button></td>
      </tr>`,
    )
    .join('');

  const godownBalanceRows = godownReport.rows
    .map(
      (row) => `<tr>
        <td>${esc(row.godownName)}</td>
        <td><strong>${esc(row.name)}</strong></td>
        <td>${esc(row.unit)}</td>
        <td class="num">${fmtQty(row.openingQty)}</td>
        <td class="num">${row.inQty ? fmtQty(row.inQty) : '—'}</td>
        <td class="num">${row.outQty ? fmtQty(row.outQty) : '—'}</td>
        <td class="num ${row.closingQty < 0 ? 'neg' : ''}"><strong>${fmtQty(row.closingQty)}</strong></td>
        <td class="num">${money(row.closingValue)}</td>
      </tr>`,
    )
    .join('');

  const batchRows = batchReport.rows
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.name)}</strong></td>
        <td>${esc(row.batchNo)}</td>
        <td>${row.expiryDate ? esc(dateLabel(row.expiryDate)) : '<span class="muted">—</span>'}</td>
        <td>${esc(row.unit)}</td>
        <td class="num">${fmtQty(row.openingQty)}</td>
        <td class="num">${row.inQty ? fmtQty(row.inQty) : '—'}</td>
        <td class="num">${row.outQty ? fmtQty(row.outQty) : '—'}</td>
        <td class="num ${row.closingQty < 0 ? 'neg' : ''}"><strong>${fmtQty(row.closingQty)}</strong></td>
        <td class="num">${money(row.closingValue)}</td>
      </tr>`,
    )
    .join('');

  const transferRows = transfers
    .map((transfer) => {
      const line = transfer.items?.[0];
      const item = items.find((entry) => entry.id === line?.stockItemId);
      const unit = units.find((entry) => entry.id === item?.unitId)?.symbol ?? '';
      const source = godowns.find((entry) => entry.id === transfer.fromGodownId)?.name ?? '—';
      const destination = godowns.find((entry) => entry.id === transfer.toGodownId)?.name ?? '—';
      return `<tr>
        <td>${esc(dateLabel(transfer.date))}</td>
        <td><strong>ST-${transfer.no}</strong></td>
        <td>${esc(source)} → ${esc(destination)}</td>
        <td>${esc(item?.name ?? 'Unknown item')}${line?.batchNo ? `<div class="muted small">Batch ${esc(line.batchNo)}</div>` : ''}</td>
        <td class="num">${fmtQty(line?.qty ?? 0)} ${esc(unit)}</td>
        <td class="muted">${esc(transfer.narration || '—')}</td>
        <td class="row-actions"><button class="btn small danger" type="button" data-action="delete-stock-transfer" data-id="${esc(transfer.id)}">Delete</button></td>
      </tr>`;
    })
    .join('');

  const bomRows = boms
    .map((bom) => {
      const output = items.find((item) => item.id === bom.outputItemId);
      const unit = units.find((entry) => entry.id === output?.unitId)?.symbol ?? '';
      const components = (bom.components ?? [])
        .map((line) => {
          const item = items.find((entry) => entry.id === line.stockItemId);
          const componentUnit = units.find((entry) => entry.id === item?.unitId)?.symbol ?? '';
          return `${esc(item?.name ?? 'Unknown item')} ${fmtQty(line.qty)} ${esc(componentUnit)}`.trim();
        })
        .join(' · ');
      return `<tr>
        <td><strong>${esc(bom.name)}</strong></td>
        <td>${esc(output?.name ?? 'Unknown item')}</td>
        <td class="num">${fmtQty(bom.outputQty)} ${esc(unit)}</td>
        <td class="muted">${components}</td>
        <td class="row-actions"><button class="btn small danger" type="button" data-action="delete-bom" data-id="${esc(bom.id)}">Delete</button></td>
      </tr>`;
    })
    .join('');

  const manufactureRows = manufactures
    .map((manufacture) => {
      const output = items.find((item) => item.id === manufacture.outputItemId);
      const unit = units.find((entry) => entry.id === output?.unitId)?.symbol ?? '';
      const components = (manufacture.components ?? [])
        .map((line) => {
          const item = items.find((entry) => entry.id === line.stockItemId);
          return `${esc(item?.name ?? 'Unknown item')} ${fmtQty(line.qty)}`.trim();
        })
        .join(', ');
      const componentGodown = godowns.find((entry) => entry.id === manufacture.componentGodownId)?.name ?? '—';
      const outputGodown = godowns.find((entry) => entry.id === manufacture.outputGodownId)?.name ?? '—';
      return `<tr>
        <td>${esc(dateLabel(manufacture.date))}</td>
        <td><strong>MFG-${manufacture.no}</strong></td>
        <td>${esc(manufacture.bomName)}</td>
        <td><strong>${esc(output?.name ?? 'Unknown item')}</strong><div class="muted small">${components}</div></td>
        <td class="num">${fmtQty(manufacture.outputQty)} ${esc(unit)}${manufacture.outputBatchNo ? `<div class="muted small">Batch ${esc(manufacture.outputBatchNo)}</div>` : ''}</td>
        <td class="muted">${esc(componentGodown)} → ${esc(outputGodown)}</td>
        <td class="muted">${esc(manufacture.narration || '—')}</td>
        <td class="row-actions"><button class="btn small danger" type="button" data-action="delete-manufacture" data-id="${esc(manufacture.id)}">Delete</button></td>
      </tr>`;
    })
    .join('');

  return `
    ${panel(
      'Stock Summary',
      `<form id="stock-form" class="filter-bar">
        <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}"></label>
        <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}"></label>
        <button class="btn small" type="submit">Apply</button>
      </form>
      ${report.rows.some((row) => row.closingQty < 0)
        ? `<p class="off-text">Negative stock: ${report.rows
            .filter((row) => row.closingQty < 0)
            .map((row) => esc(row.name))
            .join(', ')}. Record a purchase to bring the balance back to zero or more.</p>`
        : ''}
      ${report.rows.length
        ? `<table class="data-table">
            <thead><tr><th>Item</th><th>Group</th><th>Unit</th><th class="num">Opening</th><th class="num">Inward</th><th class="num">Outward</th><th class="num">Closing</th><th class="num">Rate</th><th class="num">Value</th></tr></thead>
            <tbody>${summaryRows}</tbody>
            <tfoot><tr><td colspan="8">Closing stock value</td><td class="num">${money(report.totals.closingValue)}</td></tr></tfoot>
          </table>`
        : '<p class="muted">No stock items yet. Add one below to start tracking quantities.</p>'}`,
      'Click an item to see its voucher-wise movement.',
    )}
    ${panel(
      'Godown balances',
      godownReport.rows.length
        ? `<table class="data-table compact">
            <thead><tr><th>Godown</th><th>Item</th><th>Unit</th><th class="num">Opening</th><th class="num">Inward</th><th class="num">Outward</th><th class="num">Closing</th><th class="num">Value</th></tr></thead>
            <tbody>${godownBalanceRows}</tbody>
            <tfoot><tr><td colspan="7">Godown closing stock value</td><td class="num">${money(godownReport.totals.closingValue)}</td></tr></tfoot>
          </table>`
        : '<p class="muted">No godown quantities in this period.</p>',
      'Opening stock sits in the primary godown. Transfers count as outward from the source and inward to the destination.',
    )}
    ${batchReport.rows.length
      ? panel(
          'Batch balances',
          `<table class="data-table compact">
            <thead><tr><th>Item</th><th>Batch</th><th>Expiry</th><th>Unit</th><th class="num">Opening</th><th class="num">Inward</th><th class="num">Outward</th><th class="num">Closing</th><th class="num">Value</th></tr></thead>
            <tbody>${batchRows}</tbody>
          </table>`,
          'Batch balances are quantity-based; values use the item weighted-average cost. Expiry is the latest date entered on a batch line.',
        )
      : ''}
    ${panel(
      'Stock transfers',
      `<form id="stock-transfer-form" class="form-grid" novalidate>
        <label class="field"><span>Date</span><input name="date" type="date" value="${esc(todayIso() >= booksStart(active) && todayIso() <= to ? todayIso() : active.fyStart)}" min="${esc(booksStart(active))}" required></label>
        <label class="field"><span>From godown</span><select name="fromGodownId">${godownSelectOptions(active, defaultGodownId(active))}</select></label>
        <label class="field"><span>To godown</span><select name="toGodownId">${godownSelectOptions(active, godowns.find((godown) => !godown.primary)?.id ?? defaultGodownId(active))}</select></label>
        <label class="field"><span>Item</span><select name="stockItemId">${stockItemSelectOptions(active, '')}</select></label>
        <label class="field"><span>Batch (if tracked)</span><input name="batchNo" maxlength="30" placeholder="e.g. LOT-24"></label>
        <label class="field"><span>Quantity</span><input name="qty" inputmode="decimal" placeholder="0" required></label>
        <label class="field"><span>Narration</span><input name="narration" maxlength="400" placeholder="Optional reason or vehicle"></label>
        <div class="field form-actions"><button class="btn primary" type="submit">Record transfer</button></div>
        <p id="stock-transfer-error" class="form-error" role="alert"></p>
      </form>
      ${transfers.length
        ? `<table class="data-table compact">
            <thead><tr><th>Date</th><th>No.</th><th>Movement</th><th>Item</th><th class="num">Quantity</th><th>Narration</th><th></th></tr></thead>
            <tbody>${transferRows}</tbody>
          </table>`
        : '<p class="muted">No stock transfers yet. Add a second godown below, then move stock between them.</p>'}`,
      'Transfers move quantity and cost between godowns. They do not change the total stock value or post to the ledger.',
    )}
    ${panel(
      'Bills of materials',
      `<form id="bom-form" class="form-grid" novalidate>
        <label class="field"><span>BOM name</span><input name="name" maxlength="80" placeholder="e.g. Shirt bundle" required></label>
        <label class="field"><span>Finished item</span><select name="outputItemId">${stockItemSelectOptions(active, '')}</select></label>
        <label class="field"><span>Output quantity</span><input name="outputQty" inputmode="decimal" placeholder="1" required></label>
        <div class="bom-components">
          <span class="muted small">Components consumed per output quantity</span>
          <div id="bom-components">${bomComponentRow(active)}${bomComponentRow(active)}</div>
          <button class="btn small" type="button" data-action="add-bom-component">Add component</button>
        </div>
        <div class="field form-actions"><button class="btn primary" type="submit">Create BOM</button></div>
        <p id="bom-error" class="form-error" role="alert"></p>
      </form>
      ${boms.length
        ? `<table class="data-table compact">
            <thead><tr><th>BOM</th><th>Finished item</th><th class="num">Output</th><th>Components</th><th></th></tr></thead>
            <tbody>${bomRows}</tbody>
          </table>`
        : '<p class="muted">No BOMs yet. Add one to define what a finished item consumes.</p>'}`,
      'Components must be non-batch-tracked stock items. BOMs are quantity recipes; they do not reserve stock.',
    )}
    ${panel(
      'Production',
      boms.length
        ? `<form id="manufacture-form" class="form-grid" novalidate>
            <label class="field"><span>Date</span><input name="date" type="date" value="${esc(todayIso() >= booksStart(active) && todayIso() <= to ? todayIso() : active.fyStart)}" min="${esc(booksStart(active))}" required></label>
            <label class="field"><span>BOM</span><select name="bomId">${boms.map((bom) => `<option value="${esc(bom.id)}">${esc(bom.name)}</option>`).join('')}</select></label>
            <label class="field"><span>Production quantity</span><input name="outputQty" inputmode="decimal" value="${esc(fmtQty(boms[0]?.outputQty ?? 0))}" required></label>
            <label class="field"><span>Components from</span><select name="componentGodownId">${godownSelectOptions(active, defaultGodownId(active))}</select></label>
            <label class="field"><span>Finished goods to</span><select name="outputGodownId">${godownSelectOptions(active, defaultGodownId(active))}</select></label>
            <label class="field"><span>Output batch (if tracked)</span><input name="outputBatchNo" maxlength="30" placeholder="e.g. LOT-25"></label>
            <label class="field"><span>Expiry (if tracked)</span><input name="expiryDate" type="date"></label>
            <label class="field"><span>Narration</span><input name="narration" maxlength="400" placeholder="Optional production note"></label>
            <div class="field form-actions"><button class="btn primary" type="submit">Record production</button></div>
            <p id="manufacture-error" class="form-error" role="alert"></p>
          </form>
          ${manufactures.length
            ? `<table class="data-table compact">
                <thead><tr><th>Date</th><th>No.</th><th>BOM</th><th>Output / components</th><th class="num">Quantity</th><th>Godowns</th><th>Narration</th><th></th></tr></thead>
                <tbody>${manufactureRows}</tbody>
              </table>`
            : '<p class="muted">No production entries yet. Consumption and finished goods appear in stock reports.</p>'}`
        : '<p class="muted">Create a BOM above before recording production.</p>',
      'Production consumes components and brings finished goods in at component cost. It does not post a ledger entry or create a WIP account.',
    )}
    ${panel(
      'Godowns',
      `<form id="godown-form" class="inline-form" novalidate>
        <input name="name" maxlength="80" placeholder="Godown name" aria-label="Godown name" required>
        <button class="btn small" type="submit">Add godown</button>
        <p id="godown-error" class="form-error" role="alert"></p>
      </form>
      <table class="data-table compact"><thead><tr><th>Godown</th><th></th></tr></thead><tbody>${godownRows}</tbody></table>`,
      'Opening stock is held at the primary godown. A godown in use cannot be deleted.',
    )}
    ${movement
      ? panel(
          `Movements · ${esc(movement.item.name)}`,
          `<p class="muted">Opening ${fmtQty(movement.openingQty)} ${esc(movement.unit)} worth ${money(movement.openingValue)}.</p>
          ${movement.rows.length
            ? `<table class="data-table compact">
                <thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th class="num">In</th><th class="num">Out</th><th class="num">Rate</th><th class="num">Balance qty</th><th class="num">Balance value</th></tr></thead>
                <tbody>${movementRows}</tbody>
                <tfoot><tr><td colspan="5">Closing ${fmtQty(movement.closingQty)} ${esc(movement.unit)}</td><td></td><td class="num">${fmtQty(movement.closingQty)}</td><td class="num">${money(movement.closingValue)}</td></tr></tfoot>
              </table>`
            : '<p class="muted">No stock movement in this period.</p>'}
          <div class="form-actions">
            <button class="btn ghost" type="button" data-action="close-stock-movements">Close</button>
          </div>`,
        )
      : ''}
    ${panel(
      editing ? `Alter stock item · ${esc(editing.name)}` : 'New stock item',
      `<form id="stock-item-form" class="form-grid" novalidate>
        <label class="field">
          <span>Item name</span>
          <input name="name" maxlength="80" placeholder="e.g. Cotton shirt" value="${esc(editing?.name ?? '')}" required>
        </label>
        <label class="field">
          <span>Under stock group</span>
          <select name="stockGroupId">
            ${groups.map((group) => `<option value="${esc(group.id)}"${(editing?.stockGroupId ?? groups[0]?.id) === group.id ? ' selected' : ''}>${esc(group.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Unit</span>
          <select name="unitId">
            ${units.map((unit) => `<option value="${esc(unit.id)}"${(editing?.unitId ?? units[0]?.id) === unit.id ? ' selected' : ''}>${esc(unit.name)} (${esc(unit.symbol)})</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Opening quantity</span>
          <input name="openingQty" inputmode="decimal" placeholder="0" value="${esc(editing ? fmtQty(editing.openingQty) : '')}">
        </label>
        <label class="field">
          <span>Opening rate</span>
          <input name="openingRate" inputmode="decimal" placeholder="0.00" value="${esc(editing?.openingRate ?? '')}">
        </label>
        <label class="field">
          <span>HSN / SAC</span>
          <input name="hsn" maxlength="8" placeholder="e.g. 6109" value="${esc(editing?.hsn ?? '')}">
        </label>
        <label class="field gst-check">
          <input type="checkbox" name="batchTracking"${editing?.batchTracking ? ' checked' : ''}>
          <span>Track batches and expiry</span>
        </label>
        <div class="field form-actions">
          <button class="btn primary" type="submit">${editing ? 'Save item' : 'Create item'}</button>
          ${editing ? '<button class="btn ghost" type="button" data-action="cancel-stock-item">Cancel</button>' : ''}
        </div>
        <p id="stock-item-error" class="form-error" role="alert"></p>
      </form>
      ${items.length
        ? `<table class="data-table">
            <thead><tr><th>Item</th><th>Stock group</th><th>Unit</th><th>HSN / SAC</th><th>Batches</th><th class="num">Opening qty</th><th class="num">Opening rate</th><th></th></tr></thead>
            <tbody>${itemRows}</tbody>
          </table>`
        : '<p class="muted">No stock items yet. Create units and a stock group first if you need them.</p>'}`,
    )}
    ${panel(
      'Units &amp; stock groups',
      `<div class="split-grid">
        <div>
          <h3>Units</h3>
          <form id="unit-form" class="inline-form" novalidate>
            <input name="name" maxlength="40" placeholder="Unit name" aria-label="Unit name" required>
            <input name="symbol" maxlength="8" placeholder="Symbol" aria-label="Unit symbol" required>
            <button class="btn small" type="submit">Add unit</button>
            <p id="unit-error" class="form-error" role="alert"></p>
          </form>
          ${units.length
            ? `<table class="data-table compact"><thead><tr><th>Unit</th><th>Symbol</th><th></th></tr></thead><tbody>${unitRows}</tbody></table>`
            : '<p class="muted">No units yet.</p>'}
        </div>
        <div>
          <h3>Stock groups</h3>
          <form id="stock-group-form" class="inline-form" novalidate>
            <input name="name" maxlength="80" placeholder="Stock group name" aria-label="Stock group name" required>
            <button class="btn small" type="submit">Add group</button>
            <p id="stock-group-error" class="form-error" role="alert"></p>
          </form>
          ${groups.length
            ? `<table class="data-table compact"><thead><tr><th>Stock group</th><th></th></tr></thead><tbody>${groupRows}</tbody></table>`
            : '<p class="muted">No stock groups yet.</p>'}
        </div>
      </div>`,
      'Units and stock groups are masters shared by every stock item.',
    )}`;
}

const SNAPSHOT_KEY = 'zledgercraft.snapshots.v1';
const SNAPSHOT_LIMIT = 10;

function loadSnapshots() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SNAPSHOT_KEY) : null;
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSnapshot(currentState, kind = 'manual') {
  try {
    const snapshots = loadSnapshots();
    snapshots.unshift({
      at: new Date().toISOString(),
      kind,
      companies: currentState.companies.length,
      vouchers: currentState.companies.reduce((sum, item) => sum + item.vouchers.length, 0),
      payload: exportState(currentState),
    });
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots.slice(0, SNAPSHOT_LIMIT)));
    return true;
  } catch {
    return false;
  }
}

function localDay(iso = new Date().toISOString()) {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** One automatic snapshot per day, once there is at least one voucher. */
function maybeAutoSnapshot() {
  const vouchers = state.companies.reduce((sum, item) => sum + item.vouchers.length, 0);
  if (vouchers === 0) return false;
  const today = localDay();
  const latest = loadSnapshots().find((snapshot) => snapshot.kind === 'auto');
  if (latest && localDay(latest.at) === today) return false;
  return saveSnapshot(state, 'auto');
}

function snapshotHtml() {
  const snapshots = loadSnapshots();
  return panel(
    'Automatic snapshots',
    `<p class="muted">A daily snapshot is taken after the first meaningful change, and every restore saves the current data first. The last ${SNAPSHOT_LIMIT} are kept in this browser.</p>
    ${snapshots.length
      ? `<table class="data-table compact">
          <thead><tr><th>Saved</th><th>Type</th><th class="num">Companies</th><th class="num">Vouchers</th><th></th></tr></thead>
          <tbody>${snapshots
            .map(
              (snapshot, index) => `<tr>
                <td>${esc(new Date(snapshot.at).toLocaleString('en-IN'))}</td>
                <td><span class="badge">${esc(snapshot.kind === 'auto' ? 'daily' : snapshot.kind === 'pre-restore' ? 'pre-restore' : 'manual')}</span></td>
                <td class="num">${snapshot.companies}</td>
                <td class="num">${snapshot.vouchers}</td>
                <td class="row-actions">${can('data.restore') ? `<button class="btn small" type="button" data-action="restore-snapshot" data-index="${index}">Restore</button>` : ''}</td>
              </tr>`,
            )
            .join('')}</tbody>
        </table>`
      : '<p class="muted">No snapshots yet. One is saved after the first voucher and before any restore.</p>'}
    <div class="form-actions">
      <button class="btn small" type="button" data-action="save-snapshot">Save manual snapshot</button>
    </div>`,
  );
}

function workspacePanel() {
  const available = workspaceAvailable();
  return panel(
    'Storage',
    `<p class="muted">${workspaceMode
      ? 'The server workspace is active. Every change is saved to the local server and shared with browser profiles that open it.'
      : available
        ? 'Data is currently stored in this browser only. A server workspace shares it across browser profiles on this machine.'
        : 'This single-file build stores data in this browser only. Run <code>node app/serve.mjs</code> to enable a server workspace.'}</p>
    <p class="muted small">${available
      ? 'The workspace endpoint is local, unauthenticated and intended for this machine only. Saves are revision-checked so two sessions cannot silently overwrite each other.'
      : 'Server workspaces require the HTTP server; opening the HTML file directly uses browser storage.'}</p>
    ${workspaceMode
      ? `<p class="muted small">${workspaceStorage === 'sqlite' ? 'SQLite backend' : 'JSON file backend'} · server revision ${workspaceRev}${workspaceUpdatedAt ? ` · last saved ${esc(new Date(workspaceUpdatedAt).toLocaleString('en-IN'))}` : ''}.${workspaceRemote ? ' A newer server copy is available.' : ''}</p>`
      : ''}
    <div class="form-actions">
      ${available
        ? workspaceMode
          ? `<button class="btn small" type="button" data-action="disable-workspace">Switch to browser storage</button>${workspaceRemote ? '<button class="btn small primary" type="button" data-action="reload-workspace">Reload server copy</button>' : ''}`
          : '<button class="btn small primary" type="button" data-action="enable-workspace">Use server workspace</button>'
        : ''}
    </div>`,
    workspaceMode ? 'Server workspace active' : 'Browser storage active',
  );
}

function backupScreen() {
  const payload = exportState(state);
  return `
    ${workspacePanel()}
    ${panel(
      'Download backup',
      `<p class="muted">Save this file somewhere safe. It contains every company, ledger and voucher stored in ${workspaceMode ? 'this server workspace' : 'this browser'}.</p>
      <textarea class="backup-box" readonly rows="10">${esc(payload)}</textarea>
      <div class="form-actions">
        <a class="btn primary" download="zledgercraft-backup-${todayIso()}.json" href="data:application/json;charset=utf-8,${encodeURIComponent(payload)}">Download JSON</a>
      </div>`,
    )}
    ${snapshotHtml()}
    ${panel(
      'Import data',
      `<p class="muted">Bring in ledgers or balanced vouchers from CSV. Imports are all-or-nothing and can be repeated only with new names and voucher numbers.</p>
      <div class="form-actions"><button class="btn" type="button" data-screen="importData">Open CSV import</button></div>`,
    )}
    ${can('data.restore')
      ? panel(
          'Restore backup',
          `<p class="muted">Paste a backup below. Restoring replaces all companies currently stored in this browser.</p>
          <form id="restore-form" novalidate>
            <label class="field">
              <span>Backup JSON</span>
              <textarea name="payload" class="backup-box" rows="10" placeholder='{ "companies": [ ... ] }'></textarea>
            </label>
            <p id="restore-preview" class="muted" aria-live="polite"></p>
            <p id="form-error" class="form-error" role="alert"></p>
            <div class="form-actions">
              <button class="btn danger" type="submit">Restore and replace</button>
            </div>
          </form>`,
        )
      : '<p class="muted">Only an owner can restore a backup.</p>'}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => String(cell).trim() !== ''));
}

function csvObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, error: 'Add a header row and at least one data row.' };
  const header = rows[0].map((cell) => String(cell).trim().toLowerCase());
  const objects = rows.slice(1).map((cells, index) => {
    const record = { __row: index + 2 };
    for (const [column, name] of header.entries()) record[name] = String(cells[column] ?? '').trim();
    return record;
  });
  return { ok: true, header, rows: objects };
}

function importLedgerCsv(text) {
  const active = company();
  if (!active) return { ok: false, error: 'Open a company first.' };
  const parsed = csvObjects(text);
  if (!parsed.ok) return parsed;
  const nameKey = parsed.header.includes('name') ? 'name' : parsed.header.includes('ledger') ? 'ledger' : null;
  const groupKey = parsed.header.includes('group') ? 'group' : parsed.header.includes('under') ? 'under' : null;
  if (!nameKey || !groupKey) return { ok: false, error: 'Ledger CSV needs Name and Group columns.' };

  const clone = JSON.parse(JSON.stringify(active));
  const additions = [];
  for (const record of parsed.rows) {
    const name = record[nameKey];
    const groupName = record[groupKey];
    if (!name || !groupName) return { ok: false, error: `Row ${record.__row}: name and group are required.` };
    const group = clone.groups.find((item) => item.name.trim().toLowerCase() === groupName.toLowerCase());
    if (!group) return { ok: false, error: `Row ${record.__row}: group "${groupName}" was not found.` };
    const result = addLedger(clone, {
      name,
      groupId: group.id,
      opening: record.opening || 0,
      openingType: record.type || record['dr/cr'] || 'Dr',
    });
    if (!result.ok) return { ok: false, error: `Row ${record.__row}: ${result.error}` };
    additions.push({ name, groupId: group.id, opening: record.opening || 0, openingType: record.type || record['dr/cr'] || 'Dr' });
  }
  for (const addition of additions) {
    const result = addLedger(active, addition);
    if (!result.ok) return { ok: false, error: result.error };
  }
  return { ok: true, count: additions.length };
}

function importVoucherCsv(text) {
  const active = company();
  if (!active) return { ok: false, error: 'Open a company first.' };
  const parsed = csvObjects(text);
  if (!parsed.ok) return parsed;
  for (const column of ['date', 'type', 'no', 'ledger', 'side', 'amount']) {
    if (!parsed.header.includes(column)) return { ok: false, error: `Voucher CSV needs a ${column} column.` };
  }

  const typeByName = new Map();
  for (const [key, meta] of Object.entries(VOUCHER_TYPES)) {
    typeByName.set(key.toLowerCase(), key);
    typeByName.set(meta.label.toLowerCase().replace(/\s+/g, ''), key);
  }
  const groups = new Map();
  for (const record of parsed.rows) {
    const type = typeByName.get(record.type.toLowerCase().replace(/\s+/g, ''));
    if (!type) return { ok: false, error: `Row ${record.__row}: unknown voucher type "${record.type}".` };
    if (!record.no) return { ok: false, error: `Row ${record.__row}: voucher no is required so its lines can be grouped.` };
    const side = /^(c|cr|credit)$/i.test(record.side) ? 'Cr' : /^(d|dr|debit)$/i.test(record.side) ? 'Dr' : null;
    if (!side) return { ok: false, error: `Row ${record.__row}: side must be Dr or Cr.` };
    const key = [record.date, type, record.no].join('|');
    if (!groups.has(key)) {
      groups.set(key, { date: record.date, type, no: record.no, narration: record.narration || '', lines: [] });
    }
    groups.get(key).lines.push({ ledgerName: record.ledger, side, amount: record.amount });
  }

  const clone = JSON.parse(JSON.stringify(active));
  const vouchers = [];
  for (const group of groups.values()) {
    const lines = [];
    for (const line of group.lines) {
      const ledger = clone.ledgers.find((item) => item.name.trim().toLowerCase() === line.ledgerName.toLowerCase());
      if (!ledger) return { ok: false, error: `Voucher ${group.type} ${group.no}: ledger "${line.ledgerName}" was not found.` };
      lines.push({ ledgerId: ledger.id, side: line.side, amount: line.amount });
    }
    const result = addVoucher(clone, {
      type: group.type,
      date: group.date,
      narration: group.narration,
      lines,
    });
    if (!result.ok) return { ok: false, error: `Voucher ${group.type} ${group.no}: ${result.error}` };
    vouchers.push({ type: group.type, date: group.date, narration: group.narration, lines });
  }
  for (const voucher of vouchers) {
    const result = addVoucher(active, voucher);
    if (!result.ok) return { ok: false, error: result.error };
  }
  return { ok: true, count: vouchers.length };
}

function parseStatementDate(raw) {
  const text = String(raw ?? '').trim();
  let iso = text;
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === iso ? iso : null;
}

function parseBankStatementCsv(text) {
  const parsed = csvObjects(text);
  if (!parsed.ok) return parsed;
  const find = (...names) => names.find((name) => parsed.header.includes(name)) ?? null;
  const dateKey = find('date', 'txn date', 'transaction date');
  const descriptionKey = find('description', 'narration', 'particulars');
  const referenceKey = find('reference', 'ref', 'cheque', 'cheque no');
  const debitKey = find('debit', 'withdrawal', 'withdrawals');
  const creditKey = find('credit', 'deposit', 'deposits');
  const amountKey = find('amount');
  const typeKey = find('type', 'dr/cr');
  if (!dateKey) return { ok: false, error: 'Statement CSV needs a Date column.' };
  if (!(debitKey || creditKey) && !amountKey) {
    return { ok: false, error: 'Statement CSV needs Debit/Credit columns, or Amount and Type.' };
  }

  const lines = [];
  for (const record of parsed.rows) {
    const date = parseStatementDate(record[dateKey]);
    if (!date) return { ok: false, error: `Row ${record.__row}: date must be YYYY-MM-DD or DD/MM/YYYY.` };
    let amount = null;
    if (debitKey || creditKey) {
      const debitRaw = debitKey ? record[debitKey] ?? '' : '';
      const creditRaw = creditKey ? record[creditKey] ?? '' : '';
      const debit = debitRaw ? parseAmount(debitRaw) : null;
      const credit = creditRaw ? parseAmount(creditRaw) : null;
      if (debitRaw && (debit === null || debit <= 0)) return { ok: false, error: `Row ${record.__row}: debit must be a positive number.` };
      if (creditRaw && (credit === null || credit <= 0)) return { ok: false, error: `Row ${record.__row}: credit must be a positive number.` };
      if (debit && credit) return { ok: false, error: `Row ${record.__row}: use either debit or credit, not both.` };
      amount = credit ? credit : debit ? -debit : null;
    } else {
      const parsedAmount = parseAmount(record[amountKey]);
      if (parsedAmount === null || parsedAmount === 0) return { ok: false, error: `Row ${record.__row}: amount must be a non-zero number.` };
      const direction = String(record[typeKey] ?? '').trim().toLowerCase();
      if (/^(credit|cr|deposit|in)$/.test(direction)) amount = Math.abs(parsedAmount);
      else if (/^(debit|dr|withdrawal|out)$/.test(direction)) amount = -Math.abs(parsedAmount);
      else return { ok: false, error: `Row ${record.__row}: type must be Credit or Debit.` };
    }
    if (amount === null) return { ok: false, error: `Row ${record.__row}: enter a debit or credit.` };
    lines.push({
      date,
      description: descriptionKey ? record[descriptionKey] ?? '' : '',
      reference: referenceKey ? record[referenceKey] ?? '' : '',
      amount,
    });
  }
  if (!lines.length) return { ok: false, error: 'The statement has no data rows.' };
  return { ok: true, lines };
}

function budgetsScreen() {
  if (!company()) return emptyCompanyScreen('Budget vs Actual');
  const active = company();
  const years = [...(active.years ?? [])].sort((a, b) => b.start.localeCompare(a.start));
  const current = filters.budget;
  const yearId = years.some((year) => year.id === current.yearId) ? current.yearId : active.yearId;
  const report = budgetVsActual(active, { yearId, asOn: current.asOn });
  const asOnValue = current.asOn || report.asOn;
  const yearOptions = years
    .map((year) => `<option value="${esc(year.id)}"${year.id === yearId ? ' selected' : ''}>${esc(dateLabel(year.start))} – ${esc(dateLabel(year.end))}</option>`)
    .join('');
  const rows = report.rows
    .map((row) => {
      const used = row.usedPercent === null ? 0 : Math.max(0, Math.min(100, row.usedPercent));
      return `<tr>
        <td><strong>${esc(row.name)}</strong><div class="muted small">${esc(row.targetType === 'group' ? 'Group' : 'Ledger')} · ${esc(row.nature)}</div></td>
        <td>${esc(row.target)}</td>
        <td class="num">${money(row.amount)}</td>
        <td class="num">${money(row.actual)}</td>
        <td class="num ${row.variance < 0 ? 'neg' : ''}">${money(row.variance)}</td>
        <td class="budget-used">
          <div class="budget-meter"><span style="width:${used}%"></span></div>
          <span class="muted small">${row.usedPercent === null ? 'No budget' : `${fmtQty(row.usedPercent)}%`}</span>
        </td>
        <td><span class="badge ${row.over ? 'overdue' : ''}">${row.over ? 'Over budget' : 'Within budget'}</span></td>
      </tr>`;
    })
    .join('');

  return panel(
    'Budget vs Actual',
    `<form id="budget-report-form" class="filter-bar">
      <label class="field inline-field"><span>Financial year</span><select name="yearId">${yearOptions}</select></label>
      <label class="field inline-field"><span>As on</span><input name="asOn" type="date" min="${esc(report.year.start)}" max="${esc(report.year.end)}" value="${esc(asOnValue)}" data-period></label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    <div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Budget</span><strong>${money(report.totalBudget)}</strong><span class="muted small">${report.count} budget${report.count === 1 ? '' : 's'}</span></div>
      <div class="ratio-card"><span class="ratio-label">Actual</span><strong>${money(report.totalActual)}</strong><span class="muted small">To ${esc(dateLabel(report.asOn))}</span></div>
      <div class="ratio-card"><span class="ratio-label">Variance</span><strong class="${report.totalVariance < 0 ? 'neg' : ''}">${money(report.totalVariance)}</strong><span class="muted small">Budget less actual</span></div>
      <div class="ratio-card"><span class="ratio-label">Over budget</span><strong>${report.overCount}</strong><span class="muted small">Budget${report.count === 1 ? '' : 's'} exceeded</span></div>
    </div>
    ${report.rows.length
      ? `<div class="table-scroll"><table class="data-table compact budget-report-table">
          <thead><tr><th>Budget</th><th>Target</th><th class="num">Budget</th><th class="num">Actual</th><th class="num">Variance</th><th>Used</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No budgets for this financial year. Add year-wise budgets in Masters.</p>'}`,
    'Variance is budget less actual. Totals add each budget, so overlapping group and ledger budgets can double-count.',
  );
}

function forexScreen() {
  if (!company()) return emptyCompanyScreen('Forex Revaluation');
  const active = company();
  const years = [...(active.years ?? [])].sort((a, b) => a.start.localeCompare(b.start));
  const lastEnd = years.length ? years[years.length - 1].end : active.fyEnd;
  const asOnValue = filters.forex.asOn || todayIso();
  const report = forexRevaluation(active, { asOn: asOnValue });
  const rows = report.rows
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.ledger)}</strong><div class="muted small">${esc(row.group)}</div></td>
        <td class="muted">${esc(row.nature)}</td>
        <td>${esc(row.currencyCode)}</td>
        <td class="num">${round2(row.foreignBalance).toFixed(2)}</td>
        <td class="num">${money(row.bookBalance)}</td>
        <td class="num">${money(row.rate)}</td>
        <td class="num">${money(row.revalued)}</td>
        <td class="num ${row.gain ? 'pos' : ''}">${row.gain ? money(row.gain) : '—'}</td>
        <td class="num ${row.loss ? 'neg' : ''}">${row.loss ? money(row.loss) : '—'}</td>
      </tr>`,
    )
    .join('');
  return panel(
    'Forex Revaluation',
    `<p class="muted">Revalues foreign-currency asset and liability balances at the latest rate dated on or before the as-on date. Profit &amp; loss ledgers are not revalued. This report does not post a journal.</p>
    <form id="forex-report-form" class="filter-bar">
      <label class="field inline-field"><span>As on</span><input name="asOn" type="date" min="${esc(booksStart(active))}" max="${esc(lastEnd)}" value="${esc(asOnValue)}" data-period></label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    <div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Unrealised gain</span><strong class="pos">${money(report.gain)}</strong><span class="muted small">${report.count} ledger balance${report.count === 1 ? '' : 's'}</span></div>
      <div class="ratio-card"><span class="ratio-label">Unrealised loss</span><strong class="neg">${money(report.loss)}</strong><span class="muted small">${report.currencies.length} currenc${report.currencies.length === 1 ? 'y' : 'ies'}</span></div>
      <div class="ratio-card"><span class="ratio-label">Net difference</span><strong class="${report.net < 0 ? 'neg' : 'pos'}">${money(report.net)}</strong><span class="muted small">Gain less loss</span></div>
    </div>
    ${report.rows.length
      ? `<div class="table-scroll"><table class="data-table compact">
          <thead><tr><th>Ledger</th><th>Nature</th><th>Currency</th><th class="num">Foreign balance</th><th class="num">Book value</th><th class="num">Rate</th><th class="num">Revalued</th><th class="num">Gain</th><th class="num">Loss</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No foreign-currency asset or liability balances as on this date. Record a foreign voucher in Vouchers first.</p>'}`,
    'Foreign balances are signed: debit positive, credit negative. Only foreign vouchers build these balances; a base-currency settlement does not reduce them yet. The report is informational until a revaluation journal is posted manually.',
  );
}

function gstDocumentSubtitle(row) {
  const fallback = `${voucherLabel(row.type)} ${row.no}`;
  return row.ref === fallback ? '' : fallback;
}

function gstScreen() {
  if (!company()) return emptyCompanyScreen('GST');
  const active = company();
  const gst = active.gst ?? {};
  const taxLedgers = gstTaxLedgers(active);
  const current = filters.gst;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const report = gstReturns(active, { from, to });
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

  const rateRows = (gst.rates ?? [])
    .map((rate) => {
      const used = active.vouchers.filter((voucher) => voucher.gst?.rateId === rate.id).length;
      return `<tr>
        <td><strong>${esc(rate.label)}</strong></td>
        <td class="num">${rate.rate}%</td>
        <td class="num">${rate.cess ? `${rate.cess}%` : '—'}</td>
        <td class="num">${used}</td>
        <td class="row-actions">
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
    <div class="table-scroll"><table class="data-table compact">
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
      <input name="label" maxlength="40" placeholder="Label (optional)" aria-label="GST rate label">
      <input name="rate" inputmode="decimal" placeholder="Rate %" aria-label="GST rate percent" required>
      <input name="cess" inputmode="decimal" placeholder="Cess %" aria-label="Cess percent">
      <button class="btn small" type="submit">Add rate</button>
      <p id="gst-rate-error" class="form-error" role="alert"></p>
    </form>
    <div class="table-scroll"><table class="data-table compact">
      <thead><tr><th>Rate</th><th class="num">GST</th><th class="num">Cess</th><th class="num">Vouchers</th><th></th></tr></thead>
      <tbody>${rateRows}</tbody>
    </table></div>`,
    'One rate applies to the whole invoice. Rates used by vouchers cannot be deleted.',
  );

  const rateTable = report.gstr1.rateRows.length
    ? `<div class="table-scroll"><table class="data-table compact gst-report-table">
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
      <div class="table-scroll"><table class="data-table compact gst-report-table">
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
      <div class="table-scroll"><table class="data-table compact gst-report-table">
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
        ? `<div class="table-scroll"><table class="data-table compact">
            <thead><tr><th>HSN / SAC</th><th class="num">Quantity</th><th class="num">Taxable</th><th class="num">Tax</th></tr></thead>
            <tbody>${hsnRows}</tbody>
          </table></div>`
        : '<p class="muted">No stock-item invoices with GST in this period. Add an HSN/SAC code to stock items to build this summary.</p>',
      'Outward stock lines only. Tax is apportioned from each invoice rate; quantities can mix units.',
    )}
    ${panel(
      'GSTR-3B · summary return',
      `<div class="table-scroll"><table class="data-table compact gst-report-table">
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
        ? `<div class="table-scroll"><table class="data-table compact gst-report-table">
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

  return `${setupPanel}${ratesPanel}${gst.enabled || report.count ? reportPanels : ''}`;
}

function readinessBadge(ready, label = 'Ready') {
  return ready
    ? `<span class="badge">${esc(label)}</span>`
    : `<span class="badge overdue">Review</span>`;
}

function issueList(issues, limit = 3) {
  if (!issues.length) return '<span class="muted">—</span>';
  const shown = issues.slice(0, limit).map((issue) => `<div>${esc(issue)}</div>`).join('');
  const more = issues.length > limit ? `<div class="muted small">+${issues.length - limit} more</div>` : '';
  return `<div class="muted small">${shown}${more}</div>`;
}

function eInvoiceScreen() {
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
        ? `<div class="table-scroll"><table class="data-table compact">
            <thead><tr><th>Invoice</th><th>Buyer</th><th>Place of supply</th><th class="num">Taxable</th><th class="num">Invoice total</th><th>Status</th><th>Readiness notes</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`
        : '<p class="muted">No sales invoices carry GST in this period.</p>'}`,
      'Draft JSON follows the NIC e-invoice field names for review and manual upload. No IRN, QR code or IRP acknowledgement is generated.',
    )}`;
}

function ewayBillScreen() {
  if (!company()) return emptyCompanyScreen('E-way bill');
  const active = company();
  const current = filters.ewaybill;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const threshold = Number(current.threshold) > 0 ? Number(current.threshold) : 50000;
  const report = ewayBillRegister(active, { from, to, threshold });
  const rows = report.rows
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.ref)}</strong><div class="muted small nowrap">${esc(dateLabel(row.date))}</div></td>
        <td>${esc(row.buyer.legalName || row.party)}<div class="muted small">${row.buyer.gstin ? esc(row.buyer.gstin) : 'URP'} · ${esc(row.buyer.stateName || row.buyer.stateCode || 'State not set')}</div></td>
        <td class="num">${money(row.taxable)}</td>
        <td class="num">${money(row.total)}</td>
        <td>${readinessBadge(row.ready, 'Ready')}</td>
        <td>${issueList(row.warnings)}</td>
        <td class="row-actions">
          <button class="btn small ghost" type="button" data-action="open-voucher" data-id="${esc(row.id)}">Open</button>
          <button class="btn small ghost" type="button" data-action="download-ewaybill" data-id="${esc(row.id)}">Part A JSON</button>
        </td>
      </tr>`,
    )
    .join('');

  return panel(
    'E-way bill register',
    `<form id="ewaybill-report-form" class="filter-bar">
      <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
      <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
      <label class="field inline-field"><span>Minimum invoice value</span><input name="threshold" inputmode="decimal" value="${esc(threshold)}"></label>
      <button class="btn small" type="submit">Apply</button>
    </form>
    <div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Consignments</span><strong>${report.count}</strong><span class="muted small">At or above ${money(report.threshold)}</span></div>
      <div class="ratio-card"><span class="ratio-label">Invoice value</span><strong>${money(report.value)}</strong><span class="muted small">Outward sales in this period</span></div>
      <div class="ratio-card"><span class="ratio-label">Part A ready</span><strong>${report.rows.filter((row) => row.ready).length}</strong><span class="muted small">Seller and buyer state captured</span></div>
      <div class="ratio-card"><span class="ratio-label">Part B gaps</span><strong>${report.rows.length}</strong><span class="muted small">Transporter and vehicle not captured</span></div>
    </div>
    ${report.rows.length
      ? `<div class="table-scroll"><table class="data-table compact">
          <thead><tr><th>Invoice</th><th>Consignee / destination</th><th class="num">Taxable</th><th class="num">Invoice total</th><th>Status</th><th>Notes</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : `<p class="muted">No outward invoice at or above ${money(report.threshold)} in this period.</p>`}
    <p class="muted small">${esc(report.note)} The default threshold is ₹50,000; change it only when a different state or goods rule applies.</p>`,
    'Part A only. The draft is for the e-way bill portal; distance, transporter, vehicle number and Part B are not stored.',
  );
}

function taxAuditScreen() {
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
      `<div class="table-scroll"><table class="data-table compact">
        <thead><tr><th>Particulars</th><th class="num">Amount</th></tr></thead>
        <tbody>${turnoverRows}</tbody>
      </table></div>`,
      'A difference can be legitimate: non-GST sales, timing, or a sales ledger outside Sales Accounts. Investigate before signing.',
    )}
    ${panel(
      'GST liability and ITC reconciliation',
      `<div class="table-scroll"><table class="data-table compact">
        <thead><tr><th>Particulars</th><th class="num">Books / ledgers</th><th class="num">GSTR-3B</th><th class="num">Difference</th></tr></thead>
        <tbody>${taxRows}</tbody>
      </table></div>`,
      'Books figures are net movements on GST-role ledgers. GSTR-3B figures come from the same voucher tax detail, so a difference points to manual tax journals or missing ledger tags.',
    )}
    ${panel(
      'TDS / TCS position',
      `<div class="table-scroll"><table class="data-table compact">
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
      <div class="table-scroll"><table class="data-table compact">
        <thead><tr><th>Clause</th><th>Disclosure</th><th>Status</th><th>Evidence / action</th></tr></thead>
        <tbody>${clauseRows}</tbody>
      </table></div>`,
      'Checklist only: clause numbers are a guide to Form 3CD, not a filed return or an audit opinion.',
    )}`;
}

function tdsScreen() {
  if (!company()) return emptyCompanyScreen('TDS / TCS');
  const active = company();
  const tds = active.tds ?? {};
  const kind = filters.tds.kind === 'TCS' ? 'TCS' : 'TDS';
  const from = filters.tds.from || active.fyStart;
  const to = filters.tds.to || active.fyEnd;
  const report = withholdingSummary(active, { kind, from, to });
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
    <div class="table-scroll"><table class="data-table compact">
      <thead><tr><th>Tax ledger</th><th>Ledger</th><th class="num">Closing (as on ${esc(dateLabel(to))})</th></tr></thead>
      <tbody>${ledgerRows}</tbody>
    </table></div>`,
    tds.enabled
      ? `TDS/TCS is enabled${tds.tan ? ` for TAN ${esc(tds.tan)}` : ''}.`
      : 'TDS/TCS is off. Vouchers cannot deduct tax until settings are saved with it enabled.',
  );

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
          <button class="btn small danger" type="button" data-action="delete-tds-section" data-id="${esc(section.id)}"
            ${used > 0 ? 'disabled' : ''}>Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  const sectionsPanel = panel(
    `Section master <span class="count">${sections.length}</span>`,
    `<form id="tds-section-form" class="inline-form" novalidate>
      <select name="kind" aria-label="Section kind">
        <option value="TDS"${kind === 'TDS' ? ' selected' : ''}>TDS</option>
        <option value="TCS"${kind === 'TCS' ? ' selected' : ''}>TCS</option>
      </select>
      <input name="code" maxlength="12" placeholder="Section code" aria-label="Section code" required>
      <input name="label" maxlength="60" placeholder="Description (optional)" aria-label="Section description">
      <input name="rate" inputmode="decimal" placeholder="Rate %" aria-label="Section rate" required>
      <input name="threshold" inputmode="decimal" placeholder="Threshold" aria-label="Section threshold">
      <button class="btn small" type="submit">Add section</button>
      <p id="tds-section-error" class="form-error" role="alert"></p>
    </form>
    <div class="table-scroll"><table class="data-table compact tds-report-table">
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
      ? `<div class="table-scroll"><table class="data-table compact">
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
          <div class="table-scroll"><table class="data-table compact tds-report-table">
            <thead><tr><th>Section</th><th>Description</th><th class="num">Rate</th><th class="num">Vouchers</th><th class="num">Base</th><th class="num">${kind}</th></tr></thead>
            <tbody>${sectionSummary}</tbody>
            <tfoot><tr><td colspan="3">Total</td><td class="num">${report.count}</td><td class="num">${money(report.periodBase)}</td><td class="num">${money(report.periodAmount)}</td></tr></tfoot>
          </table></div>`
        : '<p class="muted">No tax deducted or collected in this period.</p>'}
      ${report.parties.length
        ? `<h3 class="section-title">Party summary</h3>
          <div class="table-scroll"><table class="data-table compact tds-report-table">
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
      <div class="table-scroll"><table class="data-table compact tds-report-table">
        <thead><tr><th>Section</th><th class="num">Rate</th><th class="num">Threshold</th><th class="num">Base to date</th><th>Status</th></tr></thead>
        <tbody>${thresholdRows}</tbody>
      </table></div>
      ${report.documents.length
        ? `<h3 class="section-title">${kind} vouchers</h3>
          <div class="table-scroll"><table class="data-table compact tds-report-table">
            <thead><tr><th>Date</th><th>Voucher</th><th>Party</th><th>Section</th><th class="num">Rate</th><th class="num">Base</th><th class="num">${kind}</th><th>Quarter</th></tr></thead>
            <tbody>${reportRows}</tbody>
          </table></div>`
        : ''}`,
      `Period ${esc(dateLabel(from))} to ${esc(dateLabel(to))}${report.tan ? ` · TAN ${esc(report.tan)}` : ''}. Working papers only — deductions, thresholds and challans are tracked locally and nothing is filed.`,
    )}`;

  return `${setupPanel}${sectionsPanel}${challanPanel}${tds.enabled || report.count ? reportPanels : ''}`;
}

function payrollMonthLabel(month) {
  const [year, index] = String(month ?? '').split('-').map(Number);
  if (!year || !index) return String(month ?? '');
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function defaultPayrollMonth(active) {
  const today = todayIso().slice(0, 7);
  if (today >= active.fyStart.slice(0, 7) && today <= active.fyEnd.slice(0, 7)) return today;
  return active.fyStart.slice(0, 7);
}

function employeeMonthlyTotals(employee, headMap) {
  let gross = 0;
  let deductions = 0;
  for (const entry of employee.pay ?? []) {
    const head = headMap.get(entry.payHeadId);
    if (!head) continue;
    if (head.kind === 'Earning') gross += entry.amount;
    else deductions += entry.amount;
  }
  return { gross: round2(gross), deductions: round2(deductions), net: round2(gross - deductions) };
}

function payrollScreen() {
  if (!company()) return emptyCompanyScreen('Payroll');
  const active = company();
  const payroll = active.payroll ?? { enabled: false, payHeads: [], employees: [], runs: [] };
  const heads = payroll.payHeads ?? [];
  const employees = payroll.employees ?? [];
  const editing = employees.find((employee) => employee.id === view.employeeId) ?? null;
  const headMap = new Map(heads.map((head) => [head.id, head]));
  const closings = ledgerTotals(active, { to: active.fyEnd });
  const ledgers = payrollLedgers(active);
  const month = filters.payroll.month || defaultPayrollMonth(active);
  const runDate = filters.payroll.date || payrollMonthEnd(month) || active.fyEnd;
  const from = filters.payroll.from || active.fyStart;
  const to = filters.payroll.to || active.fyEnd;
  const report = payrollSummary(active, { from, to });

  const ledgerRows = [['Salaries expense', ledgers.salaries], ['Salary Payable', ledgers.payable]]
    .map(([label, ledger]) => `<tr>
      <td>${label}</td>
      <td>${ledger ? esc(ledger.name) : '<span class="badge overdue">missing</span>'}</td>
      <td class="num">${ledger ? balanceLabel(closings.get(ledger.id)?.closing ?? 0) : '—'}</td>
    </tr>`)
    .join('');
  const statutoryLedgerIds = new Set(heads.filter((head) => head.statutory && head.ledgerId).map((head) => head.ledgerId));
  const statutoryRows = [...statutoryLedgerIds]
    .map((ledgerId) => {
      const ledger = active.ledgers.find((item) => item.id === ledgerId);
      if (!ledger) return '';
      const tags = [...new Set(heads.filter((head) => head.ledgerId === ledgerId).map((head) => head.statutory))].join(' / ');
      return `<tr>
        <td>${esc(tags)} payable</td>
        <td>${esc(ledger.name)}</td>
        <td class="num">${balanceLabel(closings.get(ledger.id)?.closing ?? 0)}</td>
      </tr>`;
    })
    .join('');

  const setupPanel = panel(
    'Payroll setup',
    `<form id="payroll-form" class="form-grid" novalidate>
      <label class="field gst-check">
        <input type="checkbox" name="enabled"${payroll.enabled ? ' checked' : ''}>
        <span>Run payroll for employees and post salary journals</span>
      </label>
      <div class="field form-actions">
        <button class="btn primary" type="submit">Save payroll settings</button>
      </div>
      <p id="payroll-error" class="form-error" role="alert"></p>
    </form>
    <p class="muted small">Enabling payroll creates or reuses Salaries and Salary Payable ledgers, plus Provident Fund Payable, ESI Payable and Professional Tax Payable. A payroll run posts one Journal voucher for the month; payslips are local working copies and no statutory return or challan is filed.</p>
    <div class="table-scroll"><table class="data-table compact">
      <thead><tr><th>Payroll ledger</th><th>Ledger</th><th class="num">Closing (as on ${esc(dateLabel(active.fyEnd))})</th></tr></thead>
      <tbody>${ledgerRows}${statutoryRows}</tbody>
    </table></div>`,
    payroll.enabled
      ? `Payroll is on with ${employees.length} employee${employees.length === 1 ? '' : 's'} and ${heads.length} pay head${heads.length === 1 ? '' : 's'}.`
      : 'Payroll is off. Save the setup with it enabled to create the salary ledgers.',
  );

  const headRows = heads
    .map((head) => {
      const used = employees.filter((employee) => (employee.pay ?? []).some((entry) => entry.payHeadId === head.id)).length;
      const ledger = active.ledgers.find((item) => item.id === head.ledgerId);
      return `<tr>
        <td><strong>${esc(head.name)}</strong></td>
        <td><span class="badge">${esc(head.kind)}</span></td>
        <td class="muted small">${head.statutory ? esc(head.statutory) : '—'}</td>
        <td>${ledger ? esc(ledger.name) : '<span class="badge overdue">choose a ledger</span>'}</td>
        <td class="num">${used}</td>
        <td class="row-actions">
          <button class="btn small danger" type="button" data-action="delete-pay-head" data-id="${esc(head.id)}" ${used > 0 ? 'disabled' : ''}>Delete</button>
        </td>
      </tr>`;
    })
    .join('');
  const ledgerChoice = [
    '<option value="">Choose a ledger</option>',
    ...ledgerOptions(active).map(
      (ledger) => `<option value="${esc(ledger.id)}">${esc(ledger.name)} — ${esc(ledger.groupName)}</option>`,
    ),
  ].join('');
  const headsPanel = panel(
    `Pay heads <span class="count">${heads.length}</span>`,
    `<form id="payroll-head-form" class="inline-form" novalidate>
      <input name="name" maxlength="60" placeholder="Pay head name" aria-label="Pay head name" required>
      <select name="kind" aria-label="Pay head kind">
        <option value="Earning">Earning</option>
        <option value="Deduction">Deduction</option>
      </select>
      <select name="statutory" aria-label="Statutory tag">
        <option value="">No statutory tag</option>
        <option value="PF">PF</option>
        <option value="ESI">ESI</option>
        <option value="PT">PT</option>
        <option value="TDS">TDS</option>
      </select>
      <select name="ledgerId" aria-label="Pay head ledger" required>${ledgerChoice}</select>
      <button class="btn small" type="submit">Add pay head</button>
      <p id="payroll-head-error" class="form-error" role="alert"></p>
    </form>
    ${heads.length
      ? `<div class="table-scroll"><table class="data-table compact payroll-table">
          <thead><tr><th>Pay head</th><th>Kind</th><th>Statutory</th><th>Ledger</th><th class="num">Employees</th><th></th></tr></thead>
          <tbody>${headRows}</tbody>
        </table></div>`
      : '<p class="muted">No pay heads yet.</p>'}`,
    'Earnings debit their ledger, deductions credit theirs. Statutory tags group PF, ESI, PT and TDS in the register.',
  );

  const payFields = heads
    .map((head) => {
      const entry = editing?.pay?.find((item) => item.payHeadId === head.id);
      return `<label class="field">
        <span>${esc(head.name)} <span class="muted small">${esc(head.kind)}</span></span>
        <input name="pay_${esc(head.id)}" inputmode="decimal" value="${entry ? esc(entry.amount) : ''}" placeholder="0.00">
      </label>`;
    })
    .join('');
  const employeeForm = heads.length
    ? `<form id="employee-form" class="form-grid" novalidate>
        <label class="field"><span>Name</span><input name="name" maxlength="80" value="${esc(editing?.name ?? '')}" required></label>
        <label class="field"><span>Code</span><input name="code" maxlength="20" value="${esc(editing?.code ?? '')}" placeholder="Optional"></label>
        <label class="field"><span>Designation</span><input name="designation" maxlength="60" value="${esc(editing?.designation ?? '')}" placeholder="Optional"></label>
        <label class="field"><span>PAN</span><input name="pan" maxlength="10" value="${esc(editing?.pan ?? '')}" placeholder="Optional"></label>
        <label class="field"><span>Date of joining</span><input name="dateOfJoining" type="date" value="${esc(editing?.dateOfJoining ?? '')}"></label>
        <label class="field gst-check">
          <input type="checkbox" name="active"${editing && editing.active === false ? '' : ' checked'}>
          <span>Include in payroll runs</span>
        </label>
        <div class="pay-heads-block">
          <p class="muted small">Monthly amounts. Leave a pay head blank when it does not apply.</p>
          <div class="pay-grid">${payFields}</div>
        </div>
        <div class="field form-actions">
          <button class="btn primary" type="submit">${editing ? 'Save employee' : 'Add employee'}</button>
          ${editing ? '<button class="btn ghost" type="button" data-action="cancel-employee-edit">Cancel</button>' : ''}
        </div>
        <p id="employee-error" class="form-error" role="alert"></p>
      </form>`
    : '<p class="muted">Add at least one pay head before adding employees.</p>';

  const employeeRows = employees
    .map((employee) => {
      const totals = employeeMonthlyTotals(employee, headMap);
      return `<tr class="${employee.active === false ? 'muted' : ''}">
        <td><strong>${esc(employee.name)}</strong>${employee.active === false ? ' <span class="badge">inactive</span>' : ''}</td>
        <td class="muted small">${esc(employee.code || '—')}</td>
        <td class="muted small">${esc(employee.designation || '—')}</td>
        <td class="muted small">${employee.pan ? esc(employee.pan) : '—'}</td>
        <td class="num">${money(totals.gross)}</td>
        <td class="num">${money(totals.deductions)}</td>
        <td class="num">${money(totals.net)}</td>
        <td class="row-actions">
          <button class="btn small ghost" type="button" data-action="edit-employee" data-id="${esc(employee.id)}">Edit</button>
          <button class="btn small danger" type="button" data-action="delete-employee" data-id="${esc(employee.id)}">Delete</button>
        </td>
      </tr>`;
    })
    .join('');
  const employeesPanel = panel(
    editing ? `Edit employee · ${esc(editing.name)}` : `Employees <span class="count">${employees.length}</span>`,
    `${employeeForm}
    ${employees.length
      ? `<h3 class="column-title">Monthly pay structure</h3>
        <div class="table-scroll"><table class="data-table compact payroll-table">
          <thead><tr><th>Employee</th><th>Code</th><th>Designation</th><th>PAN</th><th class="num">Earnings</th><th class="num">Deductions</th><th class="num">Net</th><th></th></tr></thead>
          <tbody>${employeeRows}</tbody>
        </table></div>`
      : '<p class="muted">No employees yet.</p>'}`,
    'Amounts are entered per employee for the month; the run posts them as salary journals and stores the snapshot.',
  );

  const runRows = report.runs
    .map(
      (item) => `<tr>
        <td><strong>${esc(payrollMonthLabel(item.month))}</strong></td>
        <td>${esc(dateLabel(item.date))}</td>
        <td class="num">${item.employees}</td>
        <td class="num">${money(item.gross)}</td>
        <td class="num">${money(item.deductions)}</td>
        <td class="num">${money(item.net)}</td>
        <td>${item.voucherId ? `<button class="link-button" type="button" data-action="open-voucher" data-id="${esc(item.voucherId)}">Journal ${item.voucherNo}</button>` : '<span class="muted small">no voucher</span>'}</td>
        <td class="row-actions">
          <button class="btn small ghost" type="button" data-action="open-payroll-run" data-id="${esc(item.id)}">Payslips</button>
          <button class="btn small danger" type="button" data-action="delete-payroll-run" data-id="${esc(item.id)}">Delete</button>
        </td>
      </tr>`,
    )
    .join('');
  const runsPanel = panel(
    'Payroll runs',
    `<form id="payroll-run-form" class="inline-form" novalidate>
      <label class="field inline-field"><span>Month</span><input name="month" type="month" value="${esc(month)}" required></label>
      <label class="field inline-field"><span>Post date</span><input name="date" type="date" value="${esc(runDate)}" required></label>
      <button class="btn small" type="submit">Run payroll and post journal</button>
      <p id="payroll-run-error" class="form-error" role="alert"></p>
    </form>
    <p class="muted small">One run is allowed per month. The journal debits each earning ledger, credits each deduction ledger and credits Salary Payable with the net pay.</p>
    ${report.runs.length
      ? `<div class="table-scroll"><table class="data-table compact payroll-table">
          <thead><tr><th>Month</th><th>Posted</th><th class="num">Employees</th><th class="num">Gross</th><th class="num">Deductions</th><th class="num">Net</th><th>Voucher</th><th></th></tr></thead>
          <tbody>${runRows}</tbody>
        </table></div>`
      : '<p class="muted">No payroll runs in this period.</p>'}`,
    `Selected period ${esc(dateLabel(from))} to ${esc(dateLabel(to))}.`,
  );

  const payHeadRows = report.payHeads
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.name)}</strong></td>
        <td><span class="badge">${esc(row.kind)}</span></td>
        <td class="muted small">${row.statutory ? esc(row.statutory) : '—'}</td>
        <td class="num">${row.count}</td>
        <td class="num">${money(row.amount)}</td>
      </tr>`,
    )
    .join('');
  const statutoryTotalRows = report.statutory
    .map((row) => `<tr><td><strong>${esc(row.tag)}</strong></td><td class="num">${money(row.amount)}</td></tr>`)
    .join('');
  const reportEmployeeRows = report.employees
    .map(
      (row) => `<tr>
        <td>${esc(row.name)}</td>
        <td class="num">${row.months}</td>
        <td class="num">${money(row.gross)}</td>
        <td class="num">${money(row.deductions)}</td>
        <td class="num">${money(row.net)}</td>
      </tr>`,
    )
    .join('');
  const summaryPanel = salaryRegisterPanel(report, from, to);

  if (!payroll.enabled) return setupPanel;
  return `${setupPanel}${headsPanel}${employeesPanel}${runsPanel}${report.count ? summaryPanel : ''}`;
}

function salaryRegisterPanel(report, from, to, standalone = false) {
  const payHeadRows = report.payHeads
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.name)}</strong></td>
        <td><span class="badge">${esc(row.kind)}</span></td>
        <td class="muted small">${row.statutory ? esc(row.statutory) : '—'}</td>
        <td class="num">${row.count}</td>
        <td class="num">${money(row.amount)}</td>
      </tr>`,
    )
    .join('');
  const statutoryTotalRows = report.statutory
    .map((row) => `<tr><td><strong>${esc(row.tag)}</strong></td><td class="num">${money(row.amount)}</td></tr>`)
    .join('');
  const reportEmployeeRows = report.employees
    .map(
      (row) => `<tr>
        <td>${esc(row.name)}</td>
        <td class="num">${row.months}</td>
        <td class="num">${money(row.gross)}</td>
        <td class="num">${money(row.deductions)}</td>
        <td class="num">${money(row.net)}</td>
      </tr>`,
    )
    .join('');
  return panel(
    'Salary register',
    `<form id="payroll-report-form" class="inline-form" novalidate>
      <label class="field inline-field"><span>From</span><input name="from" type="date" value="${esc(from)}" data-period></label>
      <label class="field inline-field"><span>To</span><input name="to" type="date" value="${esc(to)}" data-period></label>
      <button class="btn small" type="submit">Apply</button>
      ${standalone ? '<button class="btn small ghost" type="button" data-screen="payroll">Back to payroll</button>' : '<button class="btn small ghost" type="button" data-screen="payrollRegister">Open full register</button>'}
    </form>
    <div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Gross earnings</span><strong>${money(report.totals.gross)}</strong><span class="muted small">${report.count} run${report.count === 1 ? '' : 's'}</span></div>
      <div class="ratio-card"><span class="ratio-label">Deductions</span><strong>${money(report.totals.deductions)}</strong><span class="muted small">PF, ESI, PT and other pay heads</span></div>
      <div class="ratio-card"><span class="ratio-label">Net pay</span><strong>${money(report.totals.net)}</strong><span class="muted small">Credited to Salary Payable</span></div>
      <div class="ratio-card"><span class="ratio-label">Employees paid</span><strong>${report.totals.employees}</strong><span class="muted small">Distinct employees in the period</span></div>
    </div>
    ${report.payHeads.length
      ? `<h3 class="section-title">Pay head totals</h3>
        <div class="table-scroll"><table class="data-table compact payroll-table">
          <thead><tr><th>Pay head</th><th>Kind</th><th>Statutory</th><th class="num">Employee-months</th><th class="num">Amount</th></tr></thead>
          <tbody>${payHeadRows}</tbody>
        </table></div>`
      : ''}
    ${report.statutory.length
      ? `<h3 class="section-title">Statutory deductions</h3>
        <table class="data-table compact payroll-table">
          <thead><tr><th>Tag</th><th class="num">Deducted</th></tr></thead>
          <tbody>${statutoryTotalRows}</tbody>
        </table>`
      : ''}
    ${report.employees.length
      ? `<h3 class="section-title">Employee totals</h3>
        <div class="table-scroll"><table class="data-table compact payroll-table">
          <thead><tr><th>Employee</th><th class="num">Months</th><th class="num">Gross</th><th class="num">Deductions</th><th class="num">Net</th></tr></thead>
          <tbody>${reportEmployeeRows}</tbody>
        </table></div>`
      : ''}`,
    'Working papers for the selected period. Amounts come from the stored run snapshots, so later pay-head changes do not rewrite history.',
  );
}

function payrollRegisterScreen() {
  if (!company()) return emptyCompanyScreen('Salary register');
  const active = company();
  const from = filters.payroll.from || active.fyStart;
  const to = filters.payroll.to || active.fyEnd;
  const report = payrollSummary(active, { from, to });
  return salaryRegisterPanel(report, from, to, true);
}

function payrollRunScreen() {
  if (!company()) return emptyCompanyScreen('Payroll run');
  const active = company();
  const run = (active.payroll?.runs ?? []).find((item) => item.id === view.id);
  if (!run) {
    return panel(
      'Payroll run',
      '<p class="muted">That payroll run no longer exists.</p><button class="btn" type="button" data-screen="payroll">Back to payroll</button>',
    );
  }
  const voucher = active.vouchers.find((item) => item.id === run.voucherId);
  const rows = run.rows
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.name)}</strong>${row.code ? ` <span class="muted small">${esc(row.code)}</span>` : ''}</td>
        <td class="num">${money(row.gross)}</td>
        <td class="num">${money(row.deductionTotal)}</td>
        <td class="num">${money(row.net)}</td>
        <td class="row-actions">
          <button class="btn small ghost" type="button" data-action="open-payslip" data-run="${esc(run.id)}" data-id="${esc(row.employeeId)}">Payslip</button>
        </td>
      </tr>`,
    )
    .join('');
  return panel(
    `${payrollMonthLabel(run.month)} payroll`,
    `<div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Employees</span><strong>${run.totals.employees}</strong><span class="muted small">Posted ${esc(dateLabel(run.date))}</span></div>
      <div class="ratio-card"><span class="ratio-label">Gross earnings</span><strong>${money(run.totals.gross)}</strong><span class="muted small">Debited to salary ledgers</span></div>
      <div class="ratio-card"><span class="ratio-label">Deductions</span><strong>${money(run.totals.deductions)}</strong><span class="muted small">Credited to deduction ledgers</span></div>
      <div class="ratio-card"><span class="ratio-label">Net pay</span><strong>${money(run.totals.net)}</strong><span class="muted small">Credited to Salary Payable</span></div>
    </div>
    <div class="table-scroll"><table class="data-table compact payroll-table">
      <thead><tr><th>Employee</th><th class="num">Gross</th><th class="num">Deductions</th><th class="num">Net</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="form-actions">
      <button class="btn" type="button" data-screen="payroll">Back to payroll</button>
      ${voucher ? `<button class="btn ghost" type="button" data-action="open-voucher" data-id="${esc(voucher.id)}">Open journal ${voucher.no}</button>` : ''}
      <button class="btn danger" type="button" data-action="delete-payroll-run" data-id="${esc(run.id)}">Delete this run</button>
    </div>`,
    `One journal voucher${voucher ? ` · ${esc(voucherLabel(voucher.type))} ${voucher.no}` : ''} · stored snapshot of each employee's earnings and deductions.`,
  );
}

function payslipScreen() {
  if (!company()) return emptyCompanyScreen('Payslip');
  const active = company();
  const run = (active.payroll?.runs ?? []).find((item) => item.id === view.runId);
  const row = run?.rows.find((item) => item.employeeId === view.employeeId);
  if (!run || !row) {
    return panel(
      'Payslip',
      '<p class="muted">That payslip no longer exists.</p><button class="btn" type="button" data-screen="payroll">Back to payroll</button>',
    );
  }
  const employee = (active.payroll?.employees ?? []).find((item) => item.id === row.employeeId);
  const voucher = active.vouchers.find((item) => item.id === run.voucherId);
  const earningRows = row.earnings
    .map((line) => `<tr><td>${esc(line.name)}</td><td class="num">${money(line.amount)}</td></tr>`)
    .join('');
  const deductionRows = row.deductions.length
    ? row.deductions
        .map((line) => `<tr><td>${esc(line.name)}</td><td class="num">${money(line.amount)}</td></tr>`)
        .join('')
    : '<tr><td class="muted">No deductions</td><td class="num">—</td></tr>';
  return `<section class="panel payslip">
    <div class="payslip-head">
      <div>
        <h2>Payslip</h2>
        <p class="muted">${esc(payrollMonthLabel(run.month))} · ${esc(active.name)}</p>
      </div>
      <div class="payslip-meta">
        <span>${esc(row.name)}${employee?.code ? ` · ${esc(employee.code)}` : ''}</span>
        <span class="muted small">Posted ${esc(dateLabel(run.date))}${voucher ? ` · Journal ${voucher.no}` : ''}</span>
      </div>
    </div>
    <div class="pay-grid payslip-meta-grid">
      <div><span class="muted small">Designation</span><strong>${esc(employee?.designation || '—')}</strong></div>
      <div><span class="muted small">PAN</span><strong>${esc(employee?.pan || '—')}</strong></div>
      <div><span class="muted small">Date of joining</span><strong>${esc(employee?.dateOfJoining ? dateLabel(employee.dateOfJoining) : '—')}</strong></div>
      <div><span class="muted small">Pay period</span><strong>${esc(payrollMonthLabel(run.month))}</strong></div>
    </div>
    <div class="payslip-grid">
      <table class="data-table compact">
        <thead><tr><th>Earnings</th><th class="num">Amount</th></tr></thead>
        <tbody>${earningRows}</tbody>
        <tfoot><tr><td>Gross earnings</td><td class="num">${money(row.gross)}</td></tr></tfoot>
      </table>
      <table class="data-table compact">
        <thead><tr><th>Deductions</th><th class="num">Amount</th></tr></thead>
        <tbody>${deductionRows}</tbody>
        <tfoot><tr><td>Total deductions</td><td class="num">${money(row.deductionTotal)}</td></tr></tfoot>
      </table>
    </div>
    <div class="payslip-net">
      <span>Net pay</span>
      <strong>${money(row.net)}</strong>
      <span class="muted small">${esc(amountInWords(row.net))}</span>
    </div>
    <p class="muted small">Local working copy. PF, ESI, PT and TDS are the deduction pay heads entered for this employee; no return, certificate or challan is generated.</p>
    <div class="form-actions">
      <button class="btn" type="button" data-screen="payroll">Back to payroll</button>
      <button class="btn ghost" type="button" data-action="open-payroll-run" data-id="${esc(run.id)}">Back to month</button>
    </div>
  </section>`;
}

function costCentresScreen() {
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
    <div class="table-scroll"><table class="data-table compact">
      <thead><tr><th>Category</th><th class="num">Centres</th><th class="num">Vouchers</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table></div>
    <h3 class="column-title">By cost centre</h3>
    ${report.centreRows.length
      ? `<div class="table-scroll"><table class="data-table compact cost-centre-table">
          <thead><tr><th>Cost centre</th><th>Category</th><th class="num">Vouchers</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead>
          <tbody>${centreRows}</tbody>
        </table></div>`
      : '<p class="muted">No cost centres yet. Create them in Masters, then choose one on a voucher line.</p>'}`,
    'Only voucher lines with a cost centre are included. Click a centre to see its vouchers.',
  );
}

function costCentreDetailScreen() {
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
      ? `<div class="table-scroll"><table class="data-table compact">
          <thead><tr><th>Date</th><th>Voucher</th><th>Ledger</th><th>Side</th><th class="num">Amount</th><th>Narration</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No voucher lines are allocated to this centre in the selected period.</p>'}`,
    'Click a row to open its voucher.',
  );
}

function postDatedScreen() {
  if (!company()) return emptyCompanyScreen('Cheque / DD register');
  const active = company();
  const current = filters.postDated;
  const from = current.from || active.fyStart;
  const to = current.to || active.fyEnd;
  const asOn = current.asOn || todayIso();
  const report = postDatedRegister(active, { from, to, asOn, status: current.status });
  const statusOptions = ['All', 'Post-dated', 'Due', 'Cleared']
    .map((status) => `<option value="${status}"${current.status === status ? ' selected' : ''}>${status === 'All' ? 'All instruments' : status}</option>`)
    .join('');
  const rows = report.rows
    .map((row) => {
      const timing =
        row.status === 'Cleared'
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
        <td><span class="badge ${row.status === 'Post-dated' ? 'attention' : row.status === 'Due' ? 'overdue' : ''}">${esc(row.status)}</span><div class="muted small">${esc(timing)}</div></td>
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
      <div class="ratio-card"><span class="ratio-label">Instruments</span><strong>${report.count}</strong><span class="muted small">${money(report.total)} value</span></div>
    </div>
    ${report.rows.length
      ? `<div class="table-scroll"><table class="data-table compact postdated-table">
          <thead><tr><th>Instrument date</th><th>Instrument</th><th>Party</th><th>Voucher</th><th>Status</th><th class="num">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No cheque or DD instruments in this period. Add instrument details on a payment, receipt or contra voucher.</p>'}`,
    'Post-dated means the instrument date is after the as-on date. Cleared means the voucher is matched in Bank Reconciliation.',
  );
}

function chequePrintScreen() {
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

function selectedBankLedgerId() {
  const active = company();
  if (!active) return '';
  const banks = active.ledgers
    .filter((ledger) => groupChainKeys(active, ledger.groupId).includes('bank'))
    .sort((a, b) => a.name.localeCompare(b.name));
  return banks.some((ledger) => ledger.id === view.bankLedgerId) ? view.bankLedgerId : banks[0]?.id ?? '';
}

function bankReconScreen() {
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
          <textarea id="bank-statement-csv" class="backup-box import-box" rows="7" placeholder="Date,Description,Reference,Debit,Credit\n10/05/2026,Customer receipt,R1,,1000\n11/05/2026,Supplier payment,P1,500,"></textarea>
          <div class="form-actions"><button class="btn small primary" type="button" data-action="import-bank-statement">Import statement</button></div>`,
        )
      : ''}
    ${panel(
      'Statement lines',
      report.lines.length
        ? `<div class="table-scroll"><table class="data-table compact recon-table">
            <thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th><th>Match</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`
        : '<p class="muted">No statement imported yet. Paste or choose a CSV above.</p>',
    )}
    ${panel(
      `Unmatched bank entries <span class="count">${report.unmatchedEntries.length}</span>`,
      report.unmatchedEntries.length
        ? `<div class="table-scroll"><table class="data-table compact recon-table">
            <thead><tr><th>Date</th><th>Voucher</th><th>Narration</th><th class="num">Amount</th></tr></thead>
            <tbody>${unmatchedRows}</tbody>
          </table></div>`
        : '<p class="muted">Every bank voucher is matched to a statement line.</p>',
      'Bank amounts are signed from the bank ledger: debit positive, credit negative.',
    )}`;
}

function importScreen() {
  if (!company()) return emptyCompanyScreen('Import data');
  return `${panel(
    'Import ledgers from CSV or Excel',
    `<p class="muted">Header: <code>Name, Group, Opening, Type</code>. Type is Dr or Cr. The group must already exist. The whole file is rejected if any row fails. An .xlsx workbook can be loaded into the box below for review first; it uses the <code>Ledgers</code> sheet when present, otherwise the first sheet.</p>
    <label class="field"><span>CSV file</span><input type="file" accept=".csv,text/csv" data-csv-target="ledger-csv"></label>
    <label class="field"><span>Excel workbook (.xlsx)</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-xlsx-target="ledger-csv" data-xlsx-sheet="Ledgers"></label>
    <textarea id="ledger-csv" class="backup-box import-box" rows="7" placeholder="Name,Group,Opening,Type\nSharma Traders,Sundry Debtors,0,Dr\nRent,Indirect Expenses,0,Dr"></textarea>
    <div class="form-actions"><button class="btn small primary" type="button" data-action="import-ledgers"${can('master.write') ? '' : ' disabled'}>Import ledgers</button></div>`,
  )}
  ${panel(
    'Import vouchers from CSV or Excel',
    `<p class="muted">Header: <code>Date, Type, No, Ledger, Side, Amount, Narration</code>. Use one row per voucher line and repeat Date, Type and No for lines of the same voucher. Dates use YYYY-MM-DD. Stock items and bill allocations are not imported; use the voucher screen for those. An .xlsx workbook can be loaded into the box below for review first; it uses the <code>Vouchers</code> sheet when present, otherwise the first sheet.</p>
    <label class="field"><span>CSV file</span><input type="file" accept=".csv,text/csv" data-csv-target="voucher-csv"></label>
    <label class="field"><span>Excel workbook (.xlsx)</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-xlsx-target="voucher-csv" data-xlsx-sheet="Vouchers"></label>
    <textarea id="voucher-csv" class="backup-box import-box" rows="9" placeholder="Date,Type,No,Ledger,Side,Amount,Narration\n2026-04-10,Sales,1,Cash,Dr,1000,\n2026-04-10,Sales,1,Sales,Cr,1000,"></textarea>
    <div class="form-actions"><button class="btn small primary" type="button" data-action="import-vouchers"${can('voucher.write') ? '' : ' disabled'}>Import vouchers</button></div>`,
  )}
  ${panel(
    'Import from Tally XML',
    `<p class="muted">Paste an All Masters export to create account groups, ledgers, stock groups and stock items, a voucher export to create vouchers, or all together. Custom account groups need an existing standard parent; custom top-level groups and units must already exist here. Stock groups are created automatically. Opening stock quantity and rate are imported. Stock lines attach when their total matches the voucher and the item/godown exists; batch names and expiry attach when the local item is batch-tracked. Otherwise the accounting voucher imports and skipped stock lines are reported. Tally voucher numbers are regenerated; bill allocations, GST and TDS details are not imported.</p>
    <label class="field"><span>Tally XML file</span><input type="file" accept=".xml,text/xml,application/xml" data-csv-target="tally-xml"></label>
    <textarea id="tally-xml" class="backup-box import-box" rows="10" placeholder="<ENVELOPE>\n  <BODY>\n    <TALLYMESSAGE>\n      <LEDGER NAME=&quot;Sharma Traders&quot;>\n        <PARENT>Sundry Debtors</PARENT>\n        <OPENINGBALANCE>0</OPENINGBALANCE>\n      </LEDGER>\n    </TALLYMESSAGE>\n  </BODY>\n</ENVELOPE>"></textarea>
    <div class="form-actions"><button class="btn small primary" type="button" data-action="import-tally"${can('master.write') && can('voucher.write') ? '' : ' disabled'}>Import Tally XML</button></div>`,
  )}`;
}

function screenHtml() {
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

function render() {
  const root = document.getElementById('app');
  if (!root) return;
  if (view.screen === 'voucherNew' && !draft) {
    const source = view.editId
      ? company()?.vouchers.find((item) => item.id === view.editId) ?? null
      : null;
    prepareDraft(view.type || 'Payment', source);
  }
  const active = company();
  const wasSearch = view.screen === 'ledgerPick';
  root.innerHTML = `
    <div class="app-shell">
      ${headerHtml(active)}
      ${asideHtml(active)}
      <main class="main${view.screen === 'chequePrint' ? ' cheque-print' : ''}">
        ${flashHtml()}
        <div id="workspace-banner">${workspaceBannerHtml()}</div>
        ${roleBannerHtml()}
        ${printHeaderHtml()}
        ${reportToolbarHtml()}
        ${screenHtml()}
      </main>
      ${footerHtml()}
    </div>`;
  if (view.screen === 'voucherNew') updateVoucherTotals();
  if (wasSearch) {
    const input = document.getElementById('ledger-search');
    if (input) input.value = view.search || '';
    filterLedgerRows(view.search || '');
  }
}

function filterLedgerRows(term) {
  const needle = term.trim().toLowerCase();
  for (const row of document.querySelectorAll('.ledger-row')) {
    row.hidden = needle !== '' && !row.dataset.search.includes(needle);
  }
}

function showFormError(message, targetId = 'form-error') {
  const target = document.getElementById(targetId);
  if (target) target.textContent = message;
}

function submitPayload(data) {
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

function handleSubmit(event) {
  const form = event.target;
  event.preventDefault();

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
    const result = importState(data.get('payload'));
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
    const result = updateCompany(active, { name: data.get('name'), fyStart: data.get('fyStart') });
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
    const payload = {
      name: data.get('name'),
      stockGroupId: data.get('stockGroupId'),
      unitId: data.get('unitId'),
      openingQty: data.get('openingQty') || 0,
      openingRate: data.get('openingRate') || 0,
      hsn: data.get('hsn') || '',
      batchTracking: data.get('batchTracking') === 'on',
    };
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

  if (form.id === 'order-form') {
    if (!can('voucher.write')) {
      requirePermission('voucher.write');
      return;
    }
    const data = new FormData(form);
    const result = addOrder(active, {
      type: data.get('type'),
      date: data.get('date'),
      partyLedgerId: data.get('partyLedgerId'),
      deliveryDate: data.get('deliveryDate'),
      stockItemId: data.get('stockItemId'),
      godownId: data.get('godownId'),
      batchNo: data.get('batchNo'),
      expiryDate: data.get('expiryDate'),
      qty: data.get('qty'),
      rate: data.get('rate'),
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

  if (form.id === 'stock-transfer-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = addStockTransfer(active, {
      date: data.get('date'),
      fromGodownId: data.get('fromGodownId'),
      toGodownId: data.get('toGodownId'),
      stockItemId: data.get('stockItemId'),
      batchNo: data.get('batchNo'),
      qty: data.get('qty'),
      narration: data.get('narration'),
    });
    if (!result.ok) {
      showFormError(result.error, 'stock-transfer-error');
      return;
    }
    logAudit(
      'stockTransfer.create',
      `Transferred ${result.transfer.items[0].qty} of stock as ST-${result.transfer.no}.`,
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
    const result = addBudget(active, {
      name: data.get('name'),
      targetType,
      targetId: targetParts.join(':'),
      yearId: data.get('yearId'),
      amount: data.get('amount'),
    });
    if (!result.ok) {
      showFormError(result.error, 'budget-error');
      return;
    }
    logAudit('budget.create', `Added budget "${result.budget.name}".`, active, result.budget.name);
    persist();
    setFlash(`Budget "${result.budget.name}" added.`);
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
    const result = addGstRate(active, {
      label: data.get('label'),
      rate: data.get('rate'),
      cess: data.get('cess') || 0,
    });
    if (!result.ok) {
      showFormError(result.error, 'gst-rate-error');
      return;
    }
    logAudit('gst.rate', `Added GST rate ${result.rate.label}.`, active, result.rate.label);
    persist();
    setFlash(`GST rate ${result.rate.label} added.`);
    render();
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
    const result = addTdsSection(active, {
      kind: data.get('kind'),
      code: data.get('code'),
      label: data.get('label'),
      rate: data.get('rate'),
      threshold: data.get('threshold') || 0,
    });
    if (!result.ok) {
      showFormError(result.error, 'tds-section-error');
      return;
    }
    logAudit(
      'tds.section',
      `Added ${result.section.kind} section ${result.section.code} at ${result.section.rate}%.`,
      active,
      `${result.section.kind} ${result.section.code}`,
    );
    persist();
    setFlash(`${result.section.kind} section ${result.section.code} added.`);
    render();
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
      dateOfJoining: data.get('dateOfJoining'),
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
    const result = runPayroll(active, { month: data.get('month'), date: data.get('date') });
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
    const result = addCurrencyRate(active, data.get('code'), {
      date: data.get('date'),
      rate: data.get('rate'),
    });
    if (!result.ok) {
      showFormError(result.error, 'currency-rate-error');
      return;
    }
    logAudit('currency.rate', `Set ${result.currency.code} rate ${money(result.rate.rate)} from ${dateLabel(result.rate.date)}.`, active, result.currency.code);
    persist();
    setFlash(`${result.currency.code} rate saved for ${dateLabel(result.rate.date)}.`);
    render();
    return;
  }

  if (form.id === 'cost-category-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = addCostCategory(active, { name: data.get('name') });
    if (!result.ok) {
      showFormError(result.error, 'cost-category-error');
      return;
    }
    logAudit('costCategory.create', `Added cost category "${result.category.name}".`, active, result.category.name);
    persist();
    setFlash(`Cost category "${result.category.name}" added.`);
    render();
    return;
  }

  if (form.id === 'cost-centre-form') {
    if (!can('master.write')) {
      requirePermission('master.write');
      return;
    }
    const data = new FormData(form);
    const result = addCostCentre(active, {
      name: data.get('name'),
      categoryId: data.get('categoryId'),
    });
    if (!result.ok) {
      showFormError(result.error, 'cost-centre-error');
      return;
    }
    logAudit('costCentre.create', `Added cost centre "${result.centre.name}".`, active, result.centre.name);
    persist();
    setFlash(`Cost centre "${result.centre.name}" added.`);
    render();
    return;
  }

  if (form.id === 'voucher-form') {
    if (!can('voucher.write')) {
      requirePermission('voucher.write');
      return;
    }
    const input = readVoucherForm();
    const editingId = view.editId;
    const result = editingId ? updateVoucher(active, editingId, input) : addVoucher(active, input);
    if (!result.ok) {
      showFormError(result.error);
      return;
    }
    const instrumentNote = result.voucher.instrument
      ? ` · ${result.voucher.instrument.kind} ${result.voucher.instrument.number} dated ${dateLabel(result.voucher.instrument.date)}`
      : '';
    logAudit(
      editingId ? 'voucher.update' : 'voucher.create',
      `${editingId ? 'Altered' : 'Created'} ${voucherAuditLabel(result.voucher)}${instrumentNote}.`,
      active,
      `${result.voucher.type} ${result.voucher.no}`,
    );
    persist();
    draft = null;
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
    filters.daybook = {
      type: data.get('type'),
      from: data.get('from'),
      to: data.get('to'),
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

function csvCell(value) {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadJsonFile(filename, payload) {
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

function exportReportCsv() {
  const active = company();
  if (!active) return;
  const title = REPORT_TITLES[view.screen] ?? 'Report';
  const rows = [
    [title],
    ['Company', active.name],
    ['Period', reportPeriodLabel()],
    ['Generated', dateLabel(todayIso())],
    [],
  ];
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
      persist();
      setFlash(`Opened ${company()?.name ?? 'company'}.`);
      navigate('gateway');
      break;
    case 'select-year': {
      const active = company();
      if (!active) break;
      const result = selectYear(active, trigger.dataset.id);
      if (result.ok) {
        resetPeriodFilters();
        persist();
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
      openAlter(trigger.dataset.id);
      break;
    case 'duplicate-voucher':
      duplicateVoucher(trigger.dataset.id);
      break;
    case 'print-cheque':
      navigate('chequePrint', { id: trigger.dataset.id });
      break;
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
      const result = saveBankStatement(active, ledgerId, parsed.lines);
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
      downloadJsonFile(`e-way-bill-partA-${String(row.ref || row.no).replace(/[^a-z0-9]+/gi, '-')}.json`, row.payload);
      setFlash(`Downloaded e-way bill Part A draft for ${row.ref}. Add Part B in the portal.`);
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

function resetPeriodFilters() {
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

function handleChange(event) {
  const target = event.target;
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

let ledgerRefreshTimer = null;

function previewRestore(payload) {
  const target = document.getElementById('restore-preview');
  if (!target) return;
  if (!payload.trim()) {
    target.textContent = '';
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

function handleInput(event) {
  const target = event.target;
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

const SCREEN_KEYS = {
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

const VOUCHER_KEYS = {
  F4: 'Contra',
  F5: 'Payment',
  F6: 'Receipt',
  F7: 'Journal',
  F8: 'Sales',
  F9: 'Purchase',
};

function handleKeydown(event) {
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
  const remoteState = await loadServerWorkspace();
  if (remoteState) {
    state = remoteState;
    saveState(state);
  }
  root.addEventListener('click', handleClick);
  root.addEventListener('submit', handleSubmit);
  root.addEventListener('input', handleInput);
  root.addEventListener('change', handleChange);
  document.addEventListener('keydown', handleKeydown);
  render();
  maybeAutoSnapshot();
  if (workspaceMode && !remoteState) queueWorkspaceSave();
}

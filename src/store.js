// ZledgerCraft - data model, validation and persistence.
// Signed-balance convention: debit is positive, credit is negative.

export const STORAGE_KEY = 'zledgercraft.state.v1';
export const SCHEMA_VERSION = 1;

export const GROUP_DEFS = [
  { key: 'capital', name: 'Capital Account', parent: null, nature: 'Liabilities' },
  { key: 'loansLiability', name: 'Loans (Liability)', parent: null, nature: 'Liabilities' },
  { key: 'securedLoans', name: 'Secured Loans', parent: 'loansLiability', nature: 'Liabilities' },
  { key: 'unsecuredLoans', name: 'Unsecured Loans', parent: 'loansLiability', nature: 'Liabilities' },
  { key: 'bankOd', name: 'Bank OD A/c', parent: 'loansLiability', nature: 'Liabilities' },
  { key: 'currentLiabilities', name: 'Current Liabilities', parent: null, nature: 'Liabilities' },
  { key: 'sundryCreditors', name: 'Sundry Creditors', parent: 'currentLiabilities', nature: 'Liabilities' },
  { key: 'dutiesTaxes', name: 'Duties & Taxes', parent: 'currentLiabilities', nature: 'Liabilities' },
  { key: 'provisions', name: 'Provisions', parent: 'currentLiabilities', nature: 'Liabilities' },
  { key: 'reserves', name: 'Reserves & Surplus', parent: null, nature: 'Liabilities' },
  { key: 'suspense', name: 'Suspense Account', parent: null, nature: 'Liabilities' },
  { key: 'currentAssets', name: 'Current Assets', parent: null, nature: 'Assets' },
  { key: 'cash', name: 'Cash-in-Hand', parent: 'currentAssets', nature: 'Assets' },
  { key: 'bank', name: 'Bank Accounts', parent: 'currentAssets', nature: 'Assets' },
  { key: 'sundryDebtors', name: 'Sundry Debtors', parent: 'currentAssets', nature: 'Assets' },
  { key: 'loansAdvances', name: 'Loans & Advances (Asset)', parent: 'currentAssets', nature: 'Assets' },
  { key: 'deposits', name: 'Deposits (Asset)', parent: 'currentAssets', nature: 'Assets' },
  { key: 'stockInHand', name: 'Stock-in-Hand', parent: 'currentAssets', nature: 'Assets' },
  { key: 'miscExpenses', name: 'Misc. Expenses (Asset)', parent: 'currentAssets', nature: 'Assets' },
  { key: 'fixedAssets', name: 'Fixed Assets', parent: null, nature: 'Assets' },
  { key: 'investments', name: 'Investments', parent: null, nature: 'Assets' },
  { key: 'sales', name: 'Sales Accounts', parent: null, nature: 'Income' },
  { key: 'directIncomes', name: 'Direct Incomes', parent: null, nature: 'Income' },
  { key: 'indirectIncomes', name: 'Indirect Incomes', parent: null, nature: 'Income' },
  { key: 'purchase', name: 'Purchase Accounts', parent: null, nature: 'Expense' },
  { key: 'directExpenses', name: 'Direct Expenses', parent: null, nature: 'Expense' },
  { key: 'indirectExpenses', name: 'Indirect Expenses', parent: null, nature: 'Expense' },
];

export const VOUCHER_TYPES = {
  Contra: { label: 'Contra', shortcut: 'F4', blurb: 'Cash and bank transfers' },
  Payment: { label: 'Payment', shortcut: 'F5', blurb: 'Money paid out' },
  Receipt: { label: 'Receipt', shortcut: 'F6', blurb: 'Money received' },
  Journal: { label: 'Journal', shortcut: 'F7', blurb: 'Adjustments and transfers' },
  Sales: { label: 'Sales', shortcut: 'F8', blurb: 'Goods or services sold on credit' },
  Purchase: { label: 'Purchase', shortcut: 'F9', blurb: 'Goods or services bought on credit' },
  CreditNote: { label: 'Credit Note', shortcut: 'Ctrl+F8', blurb: 'Sales return credited to a customer' },
  DebitNote: { label: 'Debit Note', shortcut: 'Ctrl+F9', blurb: 'Purchase return debited to a supplier' },
};

// Voucher types that settle through cash or bank rather than a party account.
export const CASH_VOUCHERS = ['Contra', 'Payment', 'Receipt'];
export const RETURN_VOUCHERS = ['CreditNote', 'DebitNote'];

// Voucher types that may carry inventory lines.
export const INVENTORY_TYPES = ['Sales', 'Purchase', 'CreditNote', 'DebitNote'];

export const USER_ROLES = {
  owner: { label: 'Owner', blurb: 'Full access, including companies, years, users and restores' },
  accountant: { label: 'Accountant', blurb: 'Vouchers and masters; no company, year, user or restore settings' },
  viewer: { label: 'Viewer', blurb: 'Read-only access to books, reports and exports' },
};

export const BASE_CURRENCY_CODE = 'INR';

// GST state codes used for registration, place of supply and intra/inter state tax.
export const GST_STATES = [
  ['01', 'Jammu & Kashmir'],
  ['02', 'Himachal Pradesh'],
  ['03', 'Punjab'],
  ['04', 'Chandigarh'],
  ['05', 'Uttarakhand'],
  ['06', 'Haryana'],
  ['07', 'Delhi'],
  ['08', 'Rajasthan'],
  ['09', 'Uttar Pradesh'],
  ['10', 'Bihar'],
  ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'],
  ['13', 'Nagaland'],
  ['14', 'Manipur'],
  ['15', 'Mizoram'],
  ['16', 'Tripura'],
  ['17', 'Meghalaya'],
  ['18', 'Assam'],
  ['19', 'West Bengal'],
  ['20', 'Jharkhand'],
  ['21', 'Odisha'],
  ['22', 'Chhattisgarh'],
  ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'],
  ['26', 'Dadra & Nagar Haveli and Daman & Diu'],
  ['27', 'Maharashtra'],
  ['29', 'Karnataka'],
  ['30', 'Goa'],
  ['31', 'Lakshadweep'],
  ['32', 'Kerala'],
  ['33', 'Tamil Nadu'],
  ['34', 'Puducherry'],
  ['35', 'Andaman & Nicobar Islands'],
  ['36', 'Telangana'],
  ['37', 'Andhra Pradesh'],
  ['38', 'Ladakh'],
  ['97', 'Other Territory'],
];

export const GST_ROLES = { cgst: 'CGST', sgst: 'SGST', igst: 'IGST', cess: 'Cess' };

// One rate per voucher; the seeded list can be extended in the GST screen.
export const GST_SEED_RATES = [
  { label: 'Nil / Exempt', rate: 0, cess: 0 },
  { label: '5%', rate: 5, cess: 0 },
  { label: '12%', rate: 12, cess: 0 },
  { label: '18%', rate: 18, cess: 0 },
  { label: '28%', rate: 28, cess: 0 },
];

export const GST_VOUCHER_TYPES = ['Sales', 'Purchase', 'CreditNote', 'DebitNote'];

// TDS is deducted from purchase payments; TCS is collected on sales.
export const WITHHOLDING_TYPES = { TDS: 'Purchase', TCS: 'Sales' };
export const WITHHOLDING_LEDGERS = { TDS: 'TDS Payable', TCS: 'TCS Payable' };

export const TDS_SEED_SECTIONS = [
  { kind: 'TDS', code: '194C', label: 'Contractor / sub-contractor payments', rate: 2, threshold: 30000 },
  { kind: 'TDS', code: '194J', label: 'Professional or technical fees', rate: 10, threshold: 30000 },
  { kind: 'TDS', code: '194I', label: 'Rent of land, building or machinery', rate: 10, threshold: 240000 },
  { kind: 'TDS', code: '194H', label: 'Commission or brokerage', rate: 5, threshold: 15000 },
  { kind: 'TCS', code: '206C(1H)', label: 'Sale of goods above turnover threshold', rate: 0.1, threshold: 5000000 },
  { kind: 'TCS', code: '206C(1)', label: 'Scrap and other specified goods', rate: 1, threshold: 0 },
];

// The side that carries the taxable value on each GST voucher type.
export const GST_TAXABLE_SIDE = {
  Sales: 'Cr',
  CreditNote: 'Dr',
  Purchase: 'Dr',
  DebitNote: 'Cr',
};

export const UNIT_SEED = [
  { name: 'Numbers', symbol: 'Nos' },
  { name: 'Kilograms', symbol: 'Kg' },
  { name: 'Litres', symbol: 'Ltr' },
  { name: 'Boxes', symbol: 'Box' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let memoryState = null;

export function uid(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function round3(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

export function parseQty(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? round3(raw) : null;
  const cleaned = String(raw ?? '')
    .replace(/[\s,]/g, '')
    .trim();
  if (cleaned === '' || !/^-?\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? round3(value) : null;
}

export function fmtMoney(value) {
  const rounded = round2(value);
  const text = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(rounded));
  return rounded < 0 ? `-${text}` : text;
}

export function dateLabel(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  const [, month, day] = iso.split('-');
  return `${day}-${MONTHS[Number(month) - 1]}-${iso.slice(0, 4)}`;
}

export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function defaultFyStart(now = new Date()) {
  const year = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
}

export function fyEndFor(fyStart) {
  const [year, month, day] = fyStart.split('-').map(Number);
  const end = new Date(Date.UTC(year + 1, month - 1, day));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

function nextDay(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** First day covered by the books (the earliest financial year). */
export function booksStart(company) {
  const starts = (company.years ?? []).map((year) => year.start).filter(isValidIsoDate).sort();
  return starts[0] ?? company.fyStart;
}

export function yearById(company, yearId) {
  return (company.years ?? []).find((year) => year.id === yearId) ?? null;
}

export function yearForDate(company, iso) {
  return (company.years ?? []).find((year) => iso >= year.start && iso <= year.end) ?? null;
}

/** Adds the single year used by older companies, and syncs the selected year. */
export function normalizeApprovals(company) {
  company.approvalsRequired = Boolean(company.approvalsRequired);
  const threshold = Number(company.approvalThreshold);
  company.approvalThreshold = Number.isFinite(threshold) && threshold > 0 ? round2(threshold) : 0;
  return company;
}

export function approvalRequiredForAmount(company, amount) {
  if (!company?.approvalsRequired) return false;
  const threshold = Math.max(0, Number(company.approvalThreshold) || 0);
  return round2(Number(amount) || 0) >= threshold;
}

export function seedYears(company) {
  if (!Array.isArray(company.years) || company.years.length === 0) {
    company.years = [
      {
        id: uid('fy'),
        start: company.fyStart,
        end: isValidIsoDate(company.fyEnd) ? company.fyEnd : fyEndFor(company.fyStart),
        closed: false,
      },
    ];
  }
  company.years = company.years
    .filter((year) => year && isValidIsoDate(year.start))
    .map((year) => ({
      id: year.id || uid('fy'),
      start: year.start,
      end: isValidIsoDate(year.end) ? year.end : fyEndFor(year.start),
      closed: Boolean(year.closed),
      ...(year.closedAt ? { closedAt: year.closedAt } : {}),
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
  if (company.years.length === 0) {
    company.years = [{ id: uid('fy'), start: company.fyStart, end: fyEndFor(company.fyStart), closed: false }];
  }
  if (!company.years.some((year) => year.id === company.yearId)) {
    const matching = company.years.find(
      (year) => company.fyStart >= year.start && company.fyStart <= year.end,
    );
    company.yearId = (matching ?? company.years[company.years.length - 1]).id;
  }
  const selected = yearById(company, company.yearId);
  if (selected) {
    company.fyStart = selected.start;
    company.fyEnd = selected.end;
  } else {
    company.yearId = company.years[0].id;
    company.fyStart = company.years[0].start;
    company.fyEnd = company.years[0].end;
  }
  return company;
}

export function selectYear(company, yearId) {
  const year = yearById(company, yearId);
  if (!year) return { ok: false, error: 'Financial year not found.' };
  company.yearId = year.id;
  company.fyStart = year.start;
  company.fyEnd = year.end;
  return { ok: true, year };
}

/** Appends the year immediately after the latest one and selects it. */
export function addFinancialYear(company) {
  seedYears(company);
  const latest = company.years[company.years.length - 1];
  const start = nextDay(latest.end);
  const year = { id: uid('fy'), start, end: fyEndFor(start), closed: false };
  company.years.push(year);
  selectYear(company, year.id);
  return { ok: true, year };
}

export function closeFinancialYear(company, yearId) {
  const year = yearById(company, yearId);
  if (!year) return { ok: false, error: 'Financial year not found.' };
  if (year.closed) return { ok: false, error: `${dateLabel(year.start)} – ${dateLabel(year.end)} is already closed.` };
  year.closed = true;
  year.closedAt = new Date().toISOString();
  const future = company.years.filter((entry) => entry.start > year.end);
  const next =
    future.find((entry) => !entry.closed) ??
    future[0] ??
    addFinancialYear(company).year;
  selectYear(company, next.id);
  return { ok: true, year, next };
}

export function reopenFinancialYear(company, yearId) {
  const year = yearById(company, yearId);
  if (!year) return { ok: false, error: 'Financial year not found.' };
  year.closed = false;
  delete year.closedAt;
  return { ok: true, year };
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseAmount(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? round2(raw) : null;
  const cleaned = String(raw ?? '')
    .replace(/[\s,\u20b9]/g, '')
    .trim();
  if (cleaned === '' || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? round2(value) : null;
}

export function normalizeUsers(users) {
  if (!Array.isArray(users)) return [];
  const seen = new Set();
  return users
    .filter((user) => user && typeof user === 'object')
    .map((user) => ({
      id: String(user.id || uid('user')).slice(0, 80),
      name: String(user.name || '').trim().slice(0, 80),
      role: USER_ROLES[user.role] ? user.role : 'viewer',
      createdAt: user.createdAt ? String(user.createdAt) : new Date().toISOString(),
    }))
    .filter((user) => {
      if (!user.name || seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    });
}

/** Every installation has at least one local owner profile. */
export function seedUsers(state) {
  state.users = normalizeUsers(state.users);
  if (state.users.length === 0) {
    state.users = [
      {
        id: uid('user'),
        name: 'Local owner',
        role: 'owner',
        createdAt: new Date().toISOString(),
      },
    ];
  }
  if (!state.users.some((user) => user.id === state.currentUserId)) {
    const owner = state.users.find((user) => user.role === 'owner') ?? state.users[0];
    state.currentUserId = owner.id;
  }
  return state;
}

export function activeUser(state) {
  return (state.users ?? []).find((user) => user.id === state.currentUserId) ?? state.users?.[0] ?? null;
}

export function addUser(state, input = {}) {
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'User name is required.' };
  if (name.length > 80) return { ok: false, error: 'User name must be 80 characters or fewer.' };
  const role = USER_ROLES[input.role] ? input.role : null;
  if (!role) return { ok: false, error: 'Choose a valid role.' };
  if ((state.users ?? []).some((user) => user.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `A profile named "${name}" already exists.` };
  }
  const user = { id: uid('user'), name, role, createdAt: new Date().toISOString() };
  if (!Array.isArray(state.users)) state.users = [];
  state.users.push(user);
  return { ok: true, user };
}

function bankGroupChain(company, groupId) {
  let group = groupById(company, groupId);
  let guard = 0;
  while (group && guard < 32) {
    if (group.key === 'bank') return true;
    group = group.parentId ? groupById(company, group.parentId) : null;
    guard += 1;
  }
  return false;
}

function isBankLedger(company, ledgerId) {
  const ledger = company.ledgers.find((item) => item.id === ledgerId);
  return Boolean(ledger && bankGroupChain(company, ledger.groupId));
}

function bankEntryForVoucher(company, ledgerId, voucherId, amount) {
  const voucher = company.vouchers.find((item) => item.id === voucherId);
  if (!voucher) return null;
  return (
    (voucher.lines ?? []).find((line) => {
      if (line.ledgerId !== ledgerId) return false;
      const signed = line.side === 'Cr' ? -round2(line.amount) : round2(line.amount);
      return Math.abs(signed - round2(amount)) < 0.005;
    }) ?? null
  );
}

/** Drops malformed cheque/DD details without touching the voucher itself. */
export function normalizeInstruments(company) {
  for (const voucher of company.vouchers ?? []) {
    if (!voucher.instrument) continue;
    const instrument = voucher.instrument;
    if (!['Payment', 'Receipt', 'Contra'].includes(voucher.type) || !['Cheque', 'DD'].includes(instrument.kind)) {
      delete voucher.instrument;
      continue;
    }
    const number = String(instrument.number ?? '').trim().slice(0, 30);
    const date = String(instrument.date || voucher.date);
    if (!number || !isValidIsoDate(date)) {
      delete voucher.instrument;
      continue;
    }
    const bankLineIds = (voucher.lines ?? [])
      .filter((line) => isBankLedger(company, line.ledgerId))
      .map((line) => line.ledgerId);
    const bankLedgerId = instrument.bankLedgerId || bankLineIds[0];
    if (!bankLedgerId || !bankLineIds.includes(bankLedgerId)) {
      delete voucher.instrument;
      continue;
    }
    const status = ['Cleared', 'Stopped', 'Cancelled'].includes(instrument.status)
      ? instrument.status
      : null;
    voucher.instrument = {
      kind: instrument.kind,
      number,
      date,
      bankLedgerId,
      ...(status ? { status } : {}),
    };
  }
  return company;
}

/** Sets or clears a manual cheque/DD status; an empty status returns to the derived one. */
export function setInstrumentStatus(company, voucherId, status = '') {
  const voucher = (company.vouchers ?? []).find((entry) => entry.id === voucherId);
  if (!voucher?.instrument) return { ok: false, error: 'Cheque/DD details not found on that voucher.' };
  const allowed = ['', 'Cleared', 'Stopped', 'Cancelled'];
  if (!allowed.includes(status)) return { ok: false, error: 'Unknown cheque/DD status.' };
  if (status) voucher.instrument.status = status;
  else delete voucher.instrument.status;
  voucher.updatedAt = new Date().toISOString();
  return { ok: true, voucher, status };
}

/** Keeps statement lines and matches consistent with vouchers and bank ledgers. */
export function normalizeBankReconciliations(company) {
  const source = company.bankReconciliations;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    company.bankReconciliations = {};
    return company;
  }
  const ledgerIds = new Set(company.ledgers.map((ledger) => ledger.id));
  const next = {};
  for (const [ledgerId, config] of Object.entries(source)) {
    if (!ledgerIds.has(ledgerId) || !isBankLedger(company, ledgerId) || !config || typeof config !== 'object') continue;
    const rawLines = Array.isArray(config.statement?.lines) ? config.statement.lines : [];
    const lines = [];
    const seen = new Set();
    for (const line of rawLines.slice(0, 5000)) {
      if (!line || !isValidIsoDate(line.date)) continue;
      const amount = round2(Number(line.amount));
      if (!Number.isFinite(amount) || amount === 0) continue;
      const id = String(line.id || uid('stmt')).slice(0, 80);
      if (seen.has(id)) continue;
      seen.add(id);
      lines.push({
        id,
        date: line.date,
        description: String(line.description || '').slice(0, 200),
        reference: String(line.reference || '').slice(0, 100),
        amount,
      });
    }
    const opening = parseAmount(config.statement?.balances?.opening);
    const closing = parseAmount(config.statement?.balances?.closing);
    const balances = opening !== null && closing !== null
      ? { opening: round2(opening), closing: round2(closing) }
      : null;
    const matches = {};
    for (const [lineId, voucherId] of Object.entries(config.matches ?? {})) {
      const line = lines.find((entry) => entry.id === lineId);
      if (!line) continue;
      if (!bankEntryForVoucher(company, ledgerId, String(voucherId), line.amount)) continue;
      matches[lineId] = String(voucherId);
    }
    next[ledgerId] = {
      statement: {
        importedAt: config.statement?.importedAt || new Date().toISOString(),
        lines,
        ...(balances ? { balances } : {}),
      },
      matches,
    };
  }
  company.bankReconciliations = next;
  return company;
}

export function saveBankStatement(company, ledgerId, lines, meta = {}) {
  if (!isBankLedger(company, ledgerId)) {
    return { ok: false, error: 'Choose a bank ledger under Bank Accounts.' };
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: 'The statement has no lines.' };
  }
  if (lines.length > 5000) return { ok: false, error: 'Import at most 5,000 statement lines at a time.' };
  const readBalance = (value, label) => {
    if (value === undefined || value === null || String(value).trim() === '') return { ok: true, value: null };
    const amount = parseAmount(value);
    if (amount === null) return { ok: false, error: `${label} must be a valid amount.` };
    return { ok: true, value: round2(amount) };
  };
  const opening = readBalance(meta.openingBalance, 'Opening balance');
  if (!opening.ok) return opening;
  const closing = readBalance(meta.closingBalance, 'Closing balance');
  if (!closing.ok) return closing;
  if ((opening.value === null) !== (closing.value === null)) {
    return { ok: false, error: 'Provide both opening and closing balances, or neither.' };
  }
  const normalized = [];
  const seen = new Set();
  for (const [index, line] of lines.entries()) {
    if (!isValidIsoDate(String(line.date ?? ''))) {
      return { ok: false, error: `Statement line ${index + 1}: date must be YYYY-MM-DD.` };
    }
    const amount = round2(Number(line.amount));
    if (!Number.isFinite(amount) || amount === 0) {
      return { ok: false, error: `Statement line ${index + 1}: amount must be a non-zero number.` };
    }
    const id = String(line.id || uid('stmt')).slice(0, 80);
    if (seen.has(id)) return { ok: false, error: `Statement line ${index + 1}: duplicate id.` };
    seen.add(id);
    normalized.push({
      id,
      date: String(line.date),
      description: String(line.description || '').trim().slice(0, 200),
      reference: String(line.reference || '').trim().slice(0, 100),
      amount,
    });
  }
  company.bankReconciliations = company.bankReconciliations ?? {};
  company.bankReconciliations[ledgerId] = {
    statement: {
      importedAt: new Date().toISOString(),
      source: String(meta.source || '').slice(0, 120),
      lines: normalized,
      ...(opening.value !== null
        ? { balances: { opening: opening.value, closing: closing.value } }
        : {}),
    },
    matches: {},
  };
  return { ok: true, count: normalized.length };
}

export function clearBankStatement(company, ledgerId) {
  if (!company.bankReconciliations?.[ledgerId]) return { ok: false, error: 'No statement to clear.' };
  delete company.bankReconciliations[ledgerId];
  return { ok: true };
}

export function setBankMatch(company, ledgerId, lineId, voucherId) {
  const config = company.bankReconciliations?.[ledgerId];
  if (!config) return { ok: false, error: 'Import a bank statement first.' };
  const line = config.statement.lines.find((entry) => entry.id === lineId);
  if (!line) return { ok: false, error: 'Statement line not found.' };
  const voucher = company.vouchers.find((entry) => entry.id === voucherId);
  if (!voucher) return { ok: false, error: 'Voucher not found.' };
  if (config.matches[lineId]) return { ok: false, error: 'Unmatch this statement line first.' };
  if (Object.values(config.matches).includes(voucherId)) {
    return { ok: false, error: 'That voucher is already matched to another statement line.' };
  }
  if (!bankEntryForVoucher(company, ledgerId, voucherId, line.amount)) {
    return { ok: false, error: `Voucher ${voucher.type} ${voucher.no} does not have a matching bank amount.` };
  }
  config.matches[lineId] = voucherId;
  return { ok: true, line, voucher };
}

export function postBankAdjustment(company, ledgerId, lineId, offsetLedgerId) {
  const config = company.bankReconciliations?.[ledgerId];
  if (!config) return { ok: false, error: 'Import a bank statement first.' };
  const line = config.statement.lines.find((entry) => entry.id === lineId);
  if (!line) return { ok: false, error: 'Statement line not found.' };
  if (config.matches[lineId]) return { ok: false, error: 'Unmatch this statement line before posting an adjustment.' };
  if (!isBankLedger(company, ledgerId)) return { ok: false, error: 'Choose a bank ledger.' };
  const offset = (company.ledgers ?? []).find((ledger) => ledger.id === offsetLedgerId);
  if (!offset) return { ok: false, error: 'Choose an adjustment ledger.' };
  if (offset.id === ledgerId) return { ok: false, error: 'The adjustment ledger cannot be the bank ledger itself.' };
  const amount = round2(Math.abs(Number(line.amount) || 0));
  if (amount <= 0) return { ok: false, error: 'The statement line has no amount to post.' };
  const posted = addVoucher(company, {
    type: 'Journal',
    date: line.date,
    narration: `Bank adjustment: ${line.description || line.reference || 'statement line'}`,
    lines: [
      { ledgerId, side: line.amount > 0 ? 'Dr' : 'Cr', amount },
      { ledgerId: offset.id, side: line.amount > 0 ? 'Cr' : 'Dr', amount },
    ],
  });
  if (!posted.ok) return posted;
  config.matches[lineId] = posted.voucher.id;
  posted.voucher.bankAdjustmentLineId = lineId;
  return { ok: true, voucher: posted.voucher, line, offset };
}

export function unsetBankMatch(company, ledgerId, lineId) {
  const config = company.bankReconciliations?.[ledgerId];
  if (!config?.matches?.[lineId]) return { ok: false, error: 'That line is not matched.' };
  delete config.matches[lineId];
  return { ok: true };
}

function statementDayGap(a, b) {
  return Math.abs(new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000;
}

/** Greedy one-to-one match by signed amount, preferring the nearest date. */
export function autoMatchBank(company, ledgerId) {
  const config = company.bankReconciliations?.[ledgerId];
  if (!config) return { ok: false, error: 'Import a bank statement first.' };
  const used = new Set(Object.values(config.matches));
  const entries = [];
  for (const voucher of company.vouchers) {
    for (const line of voucher.lines ?? []) {
      if (line.ledgerId !== ledgerId) continue;
      entries.push({
        voucherId: voucher.id,
        date: voucher.date,
        no: Number(voucher.no) || 0,
        amount: line.side === 'Cr' ? -round2(line.amount) : round2(line.amount),
      });
    }
  }
  let matched = 0;
  const lines = [...config.statement.lines].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const line of lines) {
    if (config.matches[line.id]) continue;
    const candidates = entries
      .filter((entry) => !used.has(entry.voucherId) && Math.abs(entry.amount - line.amount) < 0.005)
      .map((entry) => ({ ...entry, gap: statementDayGap(line.date, entry.date) }))
      .filter((entry) => entry.gap <= 7)
      .sort((a, b) => a.gap - b.gap || a.date.localeCompare(b.date) || a.no - b.no);
    const candidate = candidates[0];
    if (!candidate) continue;
    config.matches[line.id] = candidate.voucherId;
    used.add(candidate.voucherId);
    matched += 1;
  }
  return { ok: true, count: matched };
}

export function pruneBankReconciliations(company) {
  if (!company.bankReconciliations) return company;
  const allowed = new Set(
    company.ledgers.filter((ledger) => bankGroupChain(company, ledger.groupId)).map((ledger) => ledger.id),
  );
  for (const [ledgerId, config] of Object.entries(company.bankReconciliations)) {
    if (!allowed.has(ledgerId) || !config?.statement?.lines) {
      delete company.bankReconciliations[ledgerId];
      continue;
    }
    for (const [lineId, voucherId] of Object.entries(config.matches ?? {})) {
      const line = config.statement.lines.find((entry) => entry.id === lineId);
      if (!line || !bankEntryForVoucher(company, ledgerId, voucherId, line.amount)) {
        delete config.matches[lineId];
      }
    }
  }
  return company;
}

export function deleteUser(state, userId) {
  const user = (state.users ?? []).find((item) => item.id === userId);
  if (!user) return { ok: false, error: 'Profile not found.' };
  const owners = (state.users ?? []).filter((item) => item.role === 'owner');
  if (user.role === 'owner' && owners.length <= 1) {
    return { ok: false, error: 'Keep at least one owner profile.' };
  }
  state.users = state.users.filter((item) => item.id !== userId);
  if (state.currentUserId === userId) {
    state.currentUserId = (state.users.find((item) => item.role === 'owner') ?? state.users[0]).id;
  }
  return { ok: true, user };
}

export function setCurrentUser(state, userId) {
  const user = (state.users ?? []).find((item) => item.id === userId);
  if (!user) return { ok: false, error: 'Profile not found.' };
  state.currentUserId = user.id;
  return { ok: true, user };
}

/** Append-only activity log. Entries are never edited or removed by the app. */
export function normalizeAudit(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const at = new Date(entry.at);
      return {
        id: String(entry.id || uid('aud')).slice(0, 80),
        at: Number.isNaN(at.getTime()) ? new Date().toISOString() : at.toISOString(),
        action: String(entry.action || 'unknown').slice(0, 60),
        entity: String(entry.entity || '').slice(0, 120),
        summary: String(entry.summary || '').trim().slice(0, 500),
        companyId: entry.companyId ? String(entry.companyId).slice(0, 80) : '',
        companyName: String(entry.companyName || '').slice(0, 80),
        actorId: entry.actorId ? String(entry.actorId).slice(0, 80) : '',
        actorName: String(entry.actorName || '').slice(0, 80),
        actorRole: USER_ROLES[entry.actorRole] ? entry.actorRole : '',
      };
    })
    .filter((entry) => entry.summary)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function recordAudit(state, input) {
  if (!Array.isArray(state.audit)) state.audit = [];
  const entry = {
    id: uid('aud'),
    at: new Date().toISOString(),
    action: String(input.action || 'unknown').slice(0, 60),
    entity: String(input.entity || '').slice(0, 120),
    summary: String(input.summary || '').trim().slice(0, 500),
    companyId: input.companyId ? String(input.companyId) : '',
    companyName: String(input.companyName || '').slice(0, 80),
    actorId: input.actorId ? String(input.actorId).slice(0, 80) : '',
    actorName: String(input.actorName || '').slice(0, 80),
    actorRole: USER_ROLES[input.actorRole] ? input.actorRole : '',
  };
  if (!entry.summary) return null;
  state.audit.push(entry);
  return entry;
}

export function auditEntries(state) {
  return (state.audit ?? [])
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.at.localeCompare(a.entry.at) || b.index - a.index)
    .map(({ entry }) => entry);
}

export function emptyState() {
  const state = {
    version: SCHEMA_VERSION,
    activeCompanyId: null,
    companies: [],
    audit: [],
    users: [],
    currentUserId: null,
  };
  seedUsers(state);
  return state;
}

export function loadState() {
  let parsed = null;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!parsed && memoryState) parsed = memoryState;
  if (!parsed || !Array.isArray(parsed.companies)) return emptyState();
  parsed.version = SCHEMA_VERSION;
  parsed.companies = parsed.companies.filter((company) => company && Array.isArray(company.ledgers));
  for (const company of parsed.companies) {
    normalizeApprovals(company);
    seedYears(company);
    seedInventoryMasters(company);
  }
  if (!parsed.companies.some((company) => company.id === parsed.activeCompanyId)) {
    parsed.activeCompanyId = parsed.companies[0]?.id ?? null;
  }
  for (const company of parsed.companies) normalizeCostMasters(company);
  for (const company of parsed.companies) normalizeBudgets(company);
  for (const company of parsed.companies) normalizeCurrencies(company);
  for (const company of parsed.companies) normalizeGst(company);
  for (const company of parsed.companies) normalizeTds(company);
  for (const company of parsed.companies) normalizePayroll(company);
  for (const company of parsed.companies) normalizeInstruments(company);
  for (const company of parsed.companies) normalizeBankReconciliations(company);
  for (const company of parsed.companies) normalizeStockCounts(company);
  for (const company of parsed.companies) normalizeEwayPartB(company);
  for (const company of parsed.companies) normalizeComplianceTasks(company);
  for (const company of parsed.companies) normalizeRecurringVouchers(company);
  parsed.audit = normalizeAudit(parsed.audit);
  seedUsers(parsed);
  return parsed;
}

export function saveState(state) {
  memoryState = state;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Storage can be unavailable (private mode, quota). Keep the in-memory copy.
  }
}

export function activeCompany(state) {
  return state.companies.find((company) => company.id === state.activeCompanyId) ?? null;
}

export function groupById(company, groupId) {
  return company.groups.find((group) => group.id === groupId) ?? null;
}

export function primaryGroupOf(company, groupId) {
  let group = groupById(company, groupId);
  let guard = 0;
  while (group && group.parentId && guard < 32) {
    group = groupById(company, group.parentId);
    guard += 1;
  }
  return group;
}

export function ledgerOptions(company) {
  return company.ledgers
    .map((ledger) => {
      const group = groupById(company, ledger.groupId);
      return { ...ledger, groupName: group ? group.name : 'Unknown group' };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function findLedgerByName(company, name) {
  const target = name.trim().toLowerCase();
  return company.ledgers.find((ledger) => ledger.name.trim().toLowerCase() === target) ?? null;
}

/** True for ledgers anywhere under Sundry Debtors or Sundry Creditors. */
export function isPartyLedger(company, ledgerId) {
  const ledger = company.ledgers.find((item) => item.id === ledgerId);
  if (!ledger) return false;
  let group = groupById(company, ledger.groupId);
  let guard = 0;
  while (group && guard < 32) {
    if (group.key === 'sundryDebtors' || group.key === 'sundryCreditors') return true;
    group = group.parentId ? groupById(company, group.parentId) : null;
    guard += 1;
  }
  return false;
}

export function billLabel(voucher) {
  if (voucher.bill?.ref) return voucher.bill.ref;
  return `${voucher.type === 'Sales' ? 'Sales' : 'Purchase'} ${voucher.no ?? ''}`.trim();
}

/**
 * Open bills for one party ledger as of a date. A bill is a sales or purchase
 * voucher touching that ledger; stored allocations from other vouchers reduce it.
 * Unallocated settlements are handled separately by the ageing engine (FIFO).
 */
export function partyOpenBills(company, ledgerId, options = {}) {
  const asOn = options.asOn || company.fyEnd;
  const excludeVoucherId = options.excludeVoucherId ?? null;
  const relevant = company.vouchers
    .filter((voucher) => voucher.date <= asOn && voucher.id !== excludeVoucherId)
    .sort((a, b) => a.date.localeCompare(b.date) || (Number(a.no) || 0) - (Number(b.no) || 0));

  const allocatedTo = new Map();
  for (const voucher of relevant) {
    for (const line of voucher.lines ?? []) {
      if (line.ledgerId !== ledgerId) continue;
      for (const allocation of line.allocations ?? []) {
        allocatedTo.set(allocation.voucherId, round2((allocatedTo.get(allocation.voucherId) ?? 0) + allocation.amount));
      }
    }
  }

  const bills = [];
  for (const voucher of relevant) {
    if (voucher.type !== 'Sales' && voucher.type !== 'Purchase') continue;
    const line = (voucher.lines ?? []).find((entry) => entry.ledgerId === ledgerId);
    if (!line) continue;
    const remaining = round2(line.amount - (allocatedTo.get(voucher.id) ?? 0));
    if (remaining <= 0.005) continue;
    bills.push({
      voucherId: voucher.id,
      no: voucher.no,
      type: voucher.type,
      date: voucher.date,
      ref: billLabel(voucher),
      dueDate: voucher.bill?.dueDate || null,
      amount: round2(line.amount),
      remaining,
    });
  }
  bills.sort((a, b) => a.date.localeCompare(b.date) || a.no - b.no);
  return bills;
}

// Existing companies from older versions have no cost-centre masters yet.
function seedCostMasters(company) {
  if (!Array.isArray(company.costCategories) || company.costCategories.length === 0) {
    company.costCategories = [
      { id: uid('ccat'), name: 'Primary Cost Category', createdAt: new Date().toISOString() },
    ];
  }
  if (!Array.isArray(company.costCentres)) company.costCentres = [];
  return company;
}

/** Keeps cost masters and voucher-line references internally consistent. */
export function normalizeCostMasters(company) {
  seedCostMasters(company);
  const seenCategories = new Set();
  const seenNames = new Set();
  company.costCategories = company.costCategories
    .filter((category) => category && typeof category === 'object')
    .map((category) => ({
      id: String(category.id || uid('ccat')).slice(0, 80),
      name: String(category.name || '').trim().slice(0, 80),
      createdAt: category.createdAt ? String(category.createdAt) : new Date().toISOString(),
    }))
    .filter((category) => {
      const key = category.name.toLowerCase();
      if (!category.name || seenCategories.has(category.id) || seenNames.has(key)) return false;
      seenCategories.add(category.id);
      seenNames.add(key);
      return true;
    });
  if (company.costCategories.length === 0) {
    company.costCategories = [
      { id: uid('ccat'), name: 'Primary Cost Category', createdAt: new Date().toISOString() },
    ];
  }

  const seenCentres = new Set();
  const seenCentreNames = new Set();
  company.costCentres = (Array.isArray(company.costCentres) ? company.costCentres : [])
    .filter((centre) => centre && typeof centre === 'object')
    .map((centre) => ({
      id: String(centre.id || uid('cc')).slice(0, 80),
      name: String(centre.name || '').trim().slice(0, 80),
      categoryId: String(centre.categoryId || ''),
      createdAt: centre.createdAt ? String(centre.createdAt) : new Date().toISOString(),
    }))
    .filter((centre) => {
      const key = centre.name.toLowerCase();
      if (
        !centre.name ||
        seenCentres.has(centre.id) ||
        seenCentreNames.has(key) ||
        !seenCategories.has(centre.categoryId)
      ) {
        return false;
      }
      seenCentres.add(centre.id);
      seenCentreNames.add(key);
      return true;
    });

  const centreIds = new Set(company.costCentres.map((centre) => centre.id));
  for (const voucher of company.vouchers ?? []) {
    for (const line of voucher.lines ?? []) {
      if (line.costCentreId && !centreIds.has(line.costCentreId)) delete line.costCentreId;
    }
  }
  return company;
}

export const BASE_CURRENCY = Object.freeze({
  code: BASE_CURRENCY_CODE,
  name: 'Indian Rupee',
  symbol: '₹',
  base: true,
});

export function currencyByCode(company, code) {
  const clean = String(code || BASE_CURRENCY_CODE).trim().toUpperCase();
  if (clean === BASE_CURRENCY_CODE) return BASE_CURRENCY;
  return (company.currencies ?? []).find((currency) => currency.code === clean) ?? null;
}

/** Latest rate on or before a date. Base currency is always 1. */
export function rateForCurrency(company, code, date) {
  const currency = currencyByCode(company, code);
  if (!currency) return null;
  if (currency.base) return 1;
  const effective = [...(currency.rates ?? [])]
    .filter((rate) => isValidIsoDate(rate.date) && rate.date <= date && Number(rate.rate) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .pop();
  return effective ? round2(effective.rate) : null;
}

export function normalizeCurrencies(company) {
  const seenIds = new Set();
  const seenCodes = new Set();
  company.currencies = (Array.isArray(company.currencies) ? company.currencies : [])
    .filter((currency) => currency && typeof currency === 'object')
    .map((currency) => {
      const code = String(currency.code ?? '').trim().toUpperCase();
      const name = String(currency.name ?? '').trim();
      const rates = (Array.isArray(currency.rates) ? currency.rates : [])
        .filter((rate) => rate && isValidIsoDate(rate.date) && parseAmount(rate.rate) !== null && parseAmount(rate.rate) > 0)
        .map((rate) => ({ date: rate.date, rate: parseAmount(rate.rate) }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .filter((rate, index, all) => index === 0 || rate.date !== all[index - 1].date);
      if (!/^[A-Z]{2,5}$/.test(code) || code === BASE_CURRENCY_CODE || !name || rates.length === 0) return null;
      return {
        id: String(currency.id || uid('cur')).slice(0, 80),
        code,
        name: name.slice(0, 60),
        symbol: String(currency.symbol ?? code).trim().slice(0, 8) || code,
        rates,
        createdAt: currency.createdAt ? String(currency.createdAt) : new Date().toISOString(),
      };
    })
    .filter((currency) => {
      if (!currency) return false;
      if (seenIds.has(currency.id) || seenCodes.has(currency.code)) return false;
      seenIds.add(currency.id);
      seenCodes.add(currency.code);
      return true;
    });
  return company;
}

export function addCurrency(company, input = {}) {
  const code = String(input.code ?? '').trim().toUpperCase();
  const name = String(input.name ?? '').trim();
  const symbol = String(input.symbol ?? '').trim() || code;
  const date = String(input.date ?? todayIso());
  const rate = parseAmount(input.rate);
  if (!/^[A-Z]{2,5}$/.test(code) || code === BASE_CURRENCY_CODE) {
    return { ok: false, error: 'Currency code must be 2–5 letters and cannot be INR.' };
  }
  if (!name) return { ok: false, error: 'Currency name is required.' };
  if (name.length > 60) return { ok: false, error: 'Currency name must be 60 characters or fewer.' };
  if (symbol.length > 8) return { ok: false, error: 'Currency symbol must be 8 characters or fewer.' };
  if (rate === null || rate <= 0) return { ok: false, error: 'Exchange rate must be greater than zero.' };
  if (!isValidIsoDate(date)) return { ok: false, error: 'Enter a valid exchange-rate date.' };
  company.currencies = company.currencies ?? [];
  if (company.currencies.some((currency) => currency.code === code)) {
    return { ok: false, error: `Currency ${code} already exists.` };
  }
  if (company.currencies.some((currency) => currency.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `A currency named "${name}" already exists.` };
  }
  const currency = {
    id: uid('cur'),
    code,
    name,
    symbol,
    rates: [{ date, rate }],
    createdAt: new Date().toISOString(),
  };
  company.currencies.push(currency);
  return { ok: true, currency };
}

export function addCurrencyRate(company, code, input = {}) {
  const currency = currencyByCode(company, code);
  if (!currency || currency.base) return { ok: false, error: 'Choose a foreign currency first.' };
  const date = String(input.date ?? todayIso());
  const rate = parseAmount(input.rate);
  if (!isValidIsoDate(date)) return { ok: false, error: 'Enter a valid exchange-rate date.' };
  if (rate === null || rate <= 0) return { ok: false, error: 'Exchange rate must be greater than zero.' };
  if (currency.rates.some((entry) => entry.date === date)) {
    return { ok: false, error: `A rate for ${currency.code} already exists on ${dateLabel(date)}.` };
  }
  currency.rates.push({ date, rate });
  currency.rates.sort((a, b) => a.date.localeCompare(b.date));
  return { ok: true, currency, rate: { date, rate } };
}

export function updateCurrencyRate(company, code, originalDate, input = {}) {
  const currency = currencyByCode(company, code);
  if (!currency || currency.base) return { ok: false, error: 'Choose a foreign currency first.' };
  const rateEntry = (currency.rates ?? []).find((entry) => entry.date === originalDate);
  if (!rateEntry) return { ok: false, error: 'Exchange rate not found.' };
  const date = String(input.date ?? rateEntry.date);
  if (!isValidIsoDate(date)) return { ok: false, error: 'Enter a valid exchange-rate date.' };
  const rate = parseAmount(input.rate === undefined ? rateEntry.rate : input.rate);
  if (rate === null || rate <= 0) return { ok: false, error: 'Exchange rate must be greater than zero.' };
  if (
    date !== originalDate &&
    (currency.rates ?? []).some((entry) => entry.date === date)
  ) {
    return { ok: false, error: `A rate for ${currency.code} already exists on ${dateLabel(date)}.` };
  }
  rateEntry.date = date;
  rateEntry.rate = rate;
  currency.rates.sort((a, b) => a.date.localeCompare(b.date));
  return { ok: true, currency, rate: rateEntry };
}

export function deleteCurrencyRate(company, code, date) {
  const currency = currencyByCode(company, code);
  if (!currency || currency.base) return { ok: false, error: 'Choose a foreign currency first.' };
  const before = (currency.rates ?? []).length;
  currency.rates = (currency.rates ?? []).filter((entry) => entry.date !== date);
  if (currency.rates.length === before) return { ok: false, error: 'Exchange rate not found.' };
  return { ok: true, currency, date };
}

export function deleteCurrency(company, currencyId) {
  const currency = (company.currencies ?? []).find((item) => item.id === currencyId);
  if (!currency) return { ok: false, error: 'Currency not found.' };
  const used = (company.vouchers ?? []).filter((voucher) => voucher.currencyCode === currency.code).length;
  if (used > 0) {
    return { ok: false, error: `${currency.code} is used by ${used} voucher(s). Delete those vouchers first.` };
  }
  company.currencies = company.currencies.filter((item) => item.id !== currencyId);
  return { ok: true, currency };
}

export function gstStateName(code) {
  return GST_STATES.find(([value]) => value === String(code ?? ''))?.[1] ?? '';
}

/** Structural GSTIN check: state code, PAN, entity code, Z and checksum. */
export function isValidGstin(value) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(value ?? '').trim().toUpperCase());
}

export function gstRateLabel(rate, cess = 0) {
  const base = Number(rate) === 0 ? 'Nil / Exempt' : `${Number(rate)}%`;
  return Number(cess) > 0 ? `${base} + ${Number(cess)}% cess` : base;
}

function seedGstRates() {
  return GST_SEED_RATES.map((rate) => ({ id: uid('gst'), ...rate }));
}

/** Tax ledgers are ordinary Duties & Taxes ledgers tagged with a GST role. */
export function gstTaxLedgers(company) {
  const map = {};
  for (const ledger of company.ledgers ?? []) {
    if (ledger.gstRole && GST_ROLES[ledger.gstRole] && !map[ledger.gstRole]) map[ledger.gstRole] = ledger;
  }
  return map;
}

function ensureGstLedger(company, role) {
  const existing = company.ledgers.find((ledger) => ledger.gstRole === role);
  if (existing) return { ledger: existing, created: false };
  const name = GST_ROLES[role];
  const clash = findLedgerByName(company, name);
  if (clash) {
    clash.gstRole = role;
    return { ledger: clash, created: false };
  }
  const group =
    company.groups.find((entry) => entry.key === 'dutiesTaxes') ??
    company.groups.find((entry) => entry.key === 'currentLiabilities');
  if (!group) return { error: 'The Duties & Taxes group is missing from this company.' };
  const result = addLedger(company, {
    name,
    groupId: group.id,
    opening: 0,
    openingType: 'Cr',
  });
  if (!result.ok) return { error: result.error };
  result.ledger.gstRole = role;
  return { ledger: result.ledger, created: true };
}

/** Normalises the GST registration, rate master, ledger tags and voucher tax detail. */
export function normalizeGst(company) {
  const source = company.gst && typeof company.gst === 'object' ? company.gst : {};
  const seenRates = new Set();
  const rates = (Array.isArray(source.rates) ? source.rates : [])
    .filter((rate) => rate && typeof rate === 'object')
    .map((rate) => {
      const value = parseAmount(rate.rate);
      const cess = parseAmount(rate.cess ?? 0);
      if (value === null || value < 0 || value > 50) return null;
      if (cess === null || cess < 0 || cess > 50) return null;
      return {
        id: String(rate.id || uid('gst')).slice(0, 80),
        label: String(rate.label ?? '').trim().slice(0, 40) || gstRateLabel(value, cess),
        rate: value,
        cess,
      };
    })
    .filter((rate) => {
      if (!rate) return false;
      const key = `${rate.rate}:${rate.cess}`;
      if (seenRates.has(key)) return false;
      seenRates.add(key);
      return true;
    });

  const stateCode = GST_STATES.some(([code]) => code === String(source.stateCode))
    ? String(source.stateCode)
    : '';
  const gstin = isValidGstin(source.gstin) ? String(source.gstin).trim().toUpperCase() : '';
  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);
  company.gst = {
    enabled: Boolean(source.enabled),
    gstin,
    legalName: clean(source.legalName, 120),
    tradeName: clean(source.tradeName, 120),
    address: clean(source.address, 200),
    city: clean(source.city, 80),
    pin: /^[0-9]{6}$/.test(String(source.pin ?? '').trim()) ? String(source.pin).trim() : '',
    stateCode: stateCode || (gstin ? gstin.slice(0, 2) : ''),
    rates: rates.length ? rates : seedGstRates(),
  };

  const seenRoles = new Set();
  for (const ledger of company.ledgers ?? []) {
    if (ledger.gstRole && (!GST_ROLES[ledger.gstRole] || seenRoles.has(ledger.gstRole))) {
      delete ledger.gstRole;
    } else if (ledger.gstRole) {
      seenRoles.add(ledger.gstRole);
    }
    if (ledger.gstin !== undefined) {
      const value = String(ledger.gstin ?? '').trim().toUpperCase();
      if (isValidGstin(value)) ledger.gstin = value;
      else delete ledger.gstin;
    }
    if (ledger.stateCode !== undefined) {
      const value = String(ledger.stateCode ?? '');
      if (GST_STATES.some(([code]) => code === value)) ledger.stateCode = value;
      else delete ledger.stateCode;
    }
    for (const [field, limit] of [['address', 200], ['city', 80]]) {
      if (ledger[field] === undefined) continue;
      const value = String(ledger[field] ?? '').trim().slice(0, limit);
      if (value) ledger[field] = value;
      else delete ledger[field];
    }
    if (ledger.pin !== undefined) {
      const value = String(ledger.pin ?? '').trim();
      if (/^[0-9]{6}$/.test(value)) ledger.pin = value;
      else delete ledger.pin;
    }
  }

  const ledgerIds = new Set((company.ledgers ?? []).map((ledger) => ledger.id));
  for (const voucher of company.vouchers ?? []) {
    if (!voucher.gst) continue;
    const entry = voucher.gst;
    const taxable = parseAmount(entry.taxable);
    if (!GST_VOUCHER_TYPES.includes(voucher.type) || taxable === null || taxable < 0) {
      delete voucher.gst;
      continue;
    }
    const amount = (value) => Math.max(0, parseAmount(value ?? 0) ?? 0);
    voucher.gst = {
      rateId: String(entry.rateId ?? '').slice(0, 80),
      rate: amount(entry.rate),
      cessRate: amount(entry.cessRate),
      supplyType: entry.supplyType === 'Inter' ? 'Inter' : 'Intra',
      placeOfSupply: GST_STATES.some(([code]) => code === String(entry.placeOfSupply))
        ? String(entry.placeOfSupply)
        : company.gst.stateCode,
      partyGstin: isValidGstin(entry.partyGstin) ? String(entry.partyGstin).trim().toUpperCase() : '',
      ...(ledgerIds.has(entry.partyLedgerId) ? { partyLedgerId: entry.partyLedgerId } : {}),
      reverseCharge: Boolean(entry.reverseCharge),
      taxable: round2(taxable),
      cgst: amount(entry.cgst),
      sgst: amount(entry.sgst),
      igst: amount(entry.igst),
      cess: amount(entry.cess),
    };
  }
  return company;
}

export function saveGstSettings(company, input = {}) {
  const enabled = input.enabled === true || input.enabled === 'true' || input.enabled === 'on';
  const existing = company.gst && typeof company.gst === 'object' ? company.gst : {};
  const gstin = String(input.gstin ?? '').trim().toUpperCase();
  const legalName = String(input.legalName ?? '').trim();
  const stateCode = String(input.stateCode ?? '').trim();
  const tradeName = String(input.tradeName !== undefined ? input.tradeName : existing.tradeName ?? '').trim();
  const address = String(input.address !== undefined ? input.address : existing.address ?? '').trim();
  const city = String(input.city !== undefined ? input.city : existing.city ?? '').trim();
  const pin = String(input.pin !== undefined ? input.pin : existing.pin ?? '').trim();

  if (legalName.length > 120) return { ok: false, error: 'Legal name must be 120 characters or fewer.' };
  if (tradeName.length > 120) return { ok: false, error: 'Trade name must be 120 characters or fewer.' };
  if (address.length > 200) return { ok: false, error: 'Address must be 200 characters or fewer.' };
  if (city.length > 80) return { ok: false, error: 'City or location must be 80 characters or fewer.' };
  if (pin && !/^[0-9]{6}$/.test(pin)) return { ok: false, error: 'PIN code must be 6 digits.' };
  if (gstin && !isValidGstin(gstin)) {
    return { ok: false, error: 'GSTIN must be 15 characters: state code, PAN, entity code, Z and checksum.' };
  }
  if (enabled) {
    if (!gstin) return { ok: false, error: 'Enter the company GSTIN before enabling GST.' };
    if (!GST_STATES.some(([code]) => code === stateCode)) {
      return { ok: false, error: 'Choose the home state of this GST registration.' };
    }
    if (gstin.slice(0, 2) !== stateCode) {
      return {
        ok: false,
        error: `The GSTIN starts with state ${gstin.slice(0, 2)} but the home state is ${stateCode}. Fix one of them.`,
      };
    }
  }

  company.gst = company.gst ?? normalizeGst(company).gst;
  company.gst.enabled = enabled;
  company.gst.gstin = gstin;
  company.gst.legalName = legalName;
  company.gst.tradeName = tradeName;
  company.gst.address = address;
  company.gst.city = city;
  company.gst.pin = pin;
  company.gst.stateCode = GST_STATES.some(([code]) => code === stateCode) ? stateCode : '';
  if (enabled && !company.gst.stateCode) company.gst.stateCode = gstin.slice(0, 2);

  const created = [];
  if (enabled) {
    for (const role of Object.keys(GST_ROLES)) {
      const result = ensureGstLedger(company, role);
      if (result.error) return { ok: false, error: result.error };
      if (result.created) created.push(result.ledger.name);
    }
  }
  return { ok: true, gst: company.gst, created };
}

function normalizeEwayPartBEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const transporterName = String(entry.transporterName ?? '').trim().slice(0, 100);
  const transporterId = String(entry.transporterId ?? '').trim().toUpperCase().slice(0, 20);
  const vehicleNo = String(entry.vehicleNo ?? '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 20);
  const distanceNumber = Number(entry.distance);
  const distance = Number.isFinite(distanceNumber) && distanceNumber > 0 ? Math.round(distanceNumber) : 0;
  if (!transporterName && !transporterId && !vehicleNo && !distance) return null;
  const updatedAt =
    typeof entry.updatedAt === 'string' && Number.isFinite(Date.parse(entry.updatedAt))
      ? entry.updatedAt
      : new Date().toISOString();
  return {
    ...(transporterName ? { transporterName } : {}),
    ...(transporterId ? { transporterId } : {}),
    ...(vehicleNo ? { vehicleNo } : {}),
    ...(distance ? { distance } : {}),
    updatedAt,
  };
}

/** Saves the Part B working details for one outward sales invoice. */
export function setEwayPartB(company, voucherId, input = {}) {
  const voucher = (company.vouchers ?? []).find((entry) => entry.id === voucherId);
  if (!voucher) return { ok: false, error: 'Invoice not found.' };
  if (voucher.type !== 'Sales') return { ok: false, error: 'Part B can be saved only for outward sales invoices.' };
  const rawDistance = String(input.distance ?? '').trim();
  if (rawDistance) {
    const distance = Number(rawDistance);
    if (!Number.isFinite(distance) || distance <= 0 || distance > 10000) {
      return { ok: false, error: 'Distance must be between 1 and 10,000 kilometres.' };
    }
  }
  company.ewayPartB = company.ewayPartB && typeof company.ewayPartB === 'object' && !Array.isArray(company.ewayPartB)
    ? company.ewayPartB
    : {};
  const entry = normalizeEwayPartBEntry(input);
  if (!entry) {
    delete company.ewayPartB[voucherId];
    return { ok: true, cleared: true };
  }
  company.ewayPartB[voucherId] = entry;
  return { ok: true, partB: entry, cleared: false };
}

/** Drops Part B details whose invoice no longer exists or is not a sale. */
export function normalizeEwayPartB(company) {
  if (!company.ewayPartB || typeof company.ewayPartB !== 'object' || Array.isArray(company.ewayPartB)) {
    company.ewayPartB = {};
    return company;
  }
  const sales = new Map(
    (company.vouchers ?? []).filter((voucher) => voucher.type === 'Sales').map((voucher) => [voucher.id, voucher]),
  );
  const next = {};
  for (const [voucherId, entry] of Object.entries(company.ewayPartB)) {
    if (!sales.has(voucherId)) continue;
    const normalized = normalizeEwayPartBEntry(entry);
    if (normalized) next[voucherId] = normalized;
  }
  company.ewayPartB = next;
  return company;
}

function seedTdsSections() {
  return TDS_SEED_SECTIONS.map((section) => ({ id: uid('tds'), ...section }));
}

/** TAN check: four letters, five digits and one letter. */
export function isValidTan(value) {
  return /^[A-Z]{4}[0-9]{5}[A-Z]$/.test(String(value ?? '').trim().toUpperCase());
}

export function isValidPan(value) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(value ?? '').trim().toUpperCase());
}

export function withholdingTaxLedgers(company) {
  const map = {};
  for (const ledger of company.ledgers ?? []) {
    if (ledger.tdsRole === 'TDS' && !map.TDS) map.TDS = ledger;
    if (ledger.tdsRole === 'TCS' && !map.TCS) map.TCS = ledger;
  }
  return map;
}

function ensureWithholdingLedger(company, kind) {
  const existing = company.ledgers.find((ledger) => ledger.tdsRole === kind);
  if (existing) return { ledger: existing, created: false };
  const name = WITHHOLDING_LEDGERS[kind];
  const clash = findLedgerByName(company, name);
  if (clash) {
    clash.tdsRole = kind;
    return { ledger: clash, created: false };
  }
  const group =
    company.groups.find((entry) => entry.key === 'dutiesTaxes') ??
    company.groups.find((entry) => entry.key === 'currentLiabilities');
  if (!group) return { error: 'The Duties & Taxes group is missing from this company.' };
  const result = addLedger(company, {
    name,
    groupId: group.id,
    opening: 0,
    openingType: 'Cr',
  });
  if (!result.ok) return { error: result.error };
  result.ledger.tdsRole = kind;
  return { ledger: result.ledger, created: true };
}

/** Normalises TDS/TCS registration, section master, ledger tags and challans. */
export function normalizeTds(company) {
  const source = company.tds && typeof company.tds === 'object' ? company.tds : {};
  const seenSections = new Set();
  const sections = (Array.isArray(source.sections) ? source.sections : [])
    .filter((section) => section && typeof section === 'object')
    .map((section) => {
      const kind = section.kind === 'TCS' ? 'TCS' : section.kind === 'TDS' ? 'TDS' : null;
      const rate = parseAmount(section.rate);
      const threshold = parseAmount(section.threshold ?? 0);
      if (!kind || rate === null || rate < 0 || rate > 100) return null;
      if (threshold === null || threshold < 0) return null;
      const code = String(section.code ?? '').trim().slice(0, 12);
      if (!code) return null;
      return {
        id: String(section.id || uid('tds')).slice(0, 80),
        kind,
        code,
        label: String(section.label ?? '').trim().slice(0, 60) || code,
        rate,
        threshold,
      };
    })
    .filter((section) => {
      if (!section) return false;
      const key = `${section.kind}:${section.code.toUpperCase()}`;
      if (seenSections.has(key)) return false;
      seenSections.add(key);
      return true;
    });

  company.tds = {
    enabled: Boolean(source.enabled),
    tan: isValidTan(source.tan) ? String(source.tan).trim().toUpperCase() : '',
    sections: sections.length ? sections : seedTdsSections(),
  };

  const seenRoles = new Set();
  for (const ledger of company.ledgers ?? []) {
    if (ledger.tdsRole !== undefined) {
      if ((ledger.tdsRole !== 'TDS' && ledger.tdsRole !== 'TCS') || seenRoles.has(ledger.tdsRole)) {
        delete ledger.tdsRole;
      } else {
        seenRoles.add(ledger.tdsRole);
      }
    }
    if (ledger.pan !== undefined) {
      const value = String(ledger.pan ?? '').trim().toUpperCase();
      if (isValidPan(value)) ledger.pan = value;
      else delete ledger.pan;
    }
  }

  for (const voucher of company.vouchers ?? []) {
    if (!voucher.tds) continue;
    const entry = voucher.tds;
    const kind = entry.kind === 'TCS' ? 'TCS' : entry.kind === 'TDS' ? 'TDS' : null;
    const base = parseAmount(entry.base);
    const amount = parseAmount(entry.amount);
    if (!kind || WITHHOLDING_TYPES[kind] !== voucher.type || base === null || base <= 0 || amount === null || amount <= 0) {
      delete voucher.tds;
      continue;
    }
    voucher.tds = {
      kind,
      sectionId: String(entry.sectionId ?? '').slice(0, 80),
      code: String(entry.code ?? '').slice(0, 12),
      label: String(entry.label ?? '').slice(0, 60),
      rate: Math.max(0, parseAmount(entry.rate) ?? 0),
      base: round2(base),
      amount: round2(amount),
      ...(entry.partyLedgerId ? { partyLedgerId: String(entry.partyLedgerId).slice(0, 80) } : {}),
      ...(isValidPan(entry.pan) ? { pan: String(entry.pan).trim().toUpperCase() } : {}),
    };
  }

  const seenChallans = new Set();
  company.taxChallans = (Array.isArray(company.taxChallans) ? company.taxChallans : [])
    .filter((challan) => challan && typeof challan === 'object')
    .map((challan) => {
      const kind = challan.kind === 'TCS' ? 'TCS' : challan.kind === 'TDS' ? 'TDS' : null;
      const amount = parseAmount(challan.amount);
      if (!kind || !isValidIsoDate(String(challan.date ?? '')) || amount === null || amount <= 0) return null;
      const id = String(challan.id || uid('challan')).slice(0, 80);
      if (seenChallans.has(id)) return null;
      seenChallans.add(id);
      const section = (company.tds.sections ?? []).find((entry) => entry.id === challan.sectionId);
      return {
        id,
        kind,
        date: String(challan.date),
        amount: round2(amount),
        reference: String(challan.reference ?? '').trim().slice(0, 40),
        bsrCode: String(challan.bsrCode ?? '').trim().slice(0, 20),
        ...(section ? { sectionId: section.id } : {}),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
  return company;
}

export function saveTdsSettings(company, input = {}) {
  const enabled = input.enabled === true || input.enabled === 'true' || input.enabled === 'on';
  const tan = String(input.tan ?? '').trim().toUpperCase();
  if (tan && !isValidTan(tan)) {
    return { ok: false, error: 'TAN must be 10 characters: four letters, five digits and one letter.' };
  }
  if (enabled && !tan) return { ok: false, error: 'Enter the TAN before enabling TDS/TCS.' };
  company.tds = company.tds ?? normalizeTds(company).tds;
  company.tds.enabled = enabled;
  company.tds.tan = tan;

  const created = [];
  if (enabled) {
    for (const kind of ['TDS', 'TCS']) {
      const result = ensureWithholdingLedger(company, kind);
      if (result.error) return { ok: false, error: result.error };
      if (result.created) created.push(result.ledger.name);
    }
  }
  return { ok: true, tds: company.tds, created };
}

export function addTdsSection(company, input = {}) {
  const kind = input.kind === 'TCS' ? 'TCS' : input.kind === 'TDS' ? 'TDS' : null;
  if (!kind) return { ok: false, error: 'Choose TDS or TCS for the section.' };
  const code = String(input.code ?? '').trim().slice(0, 12);
  if (!code) return { ok: false, error: 'Section code is required.' };
  const rate = parseAmount(input.rate);
  if (rate === null || rate < 0 || rate > 100) {
    return { ok: false, error: 'Section rate must be between 0% and 100%.' };
  }
  const threshold = parseAmount(input.threshold ?? 0);
  if (threshold === null || threshold < 0) {
    return { ok: false, error: 'Threshold must be zero or more.' };
  }
  company.tds = company.tds ?? normalizeTds(company).tds;
  if (company.tds.sections.some((section) => section.kind === kind && section.code.toUpperCase() === code.toUpperCase())) {
    return { ok: false, error: `${kind} section ${code} already exists.` };
  }
  const section = {
    id: uid('tds'),
    kind,
    code,
    label: String(input.label ?? '').trim().slice(0, 60) || code,
    rate,
    threshold,
  };
  company.tds.sections.push(section);
  return { ok: true, section };
}

export function updateTdsSection(company, sectionId, input = {}) {
  const section = (company.tds?.sections ?? []).find((entry) => entry.id === sectionId);
  if (!section) return { ok: false, error: 'TDS/TCS section not found.' };
  const rate = parseAmount(input.rate === undefined ? section.rate : input.rate);
  if (rate === null || rate < 0 || rate > 100) {
    return { ok: false, error: 'Section rate must be between 0% and 100%.' };
  }
  const threshold = parseAmount(input.threshold === undefined ? section.threshold ?? 0 : input.threshold);
  if (threshold === null || threshold < 0) {
    return { ok: false, error: 'Threshold must be zero or more.' };
  }
  section.label = String(input.label ?? '').trim().slice(0, 60) || section.code;
  section.rate = rate;
  section.threshold = threshold;
  return { ok: true, section };
}

export function deleteTdsSection(company, sectionId) {
  const section = (company.tds?.sections ?? []).find((entry) => entry.id === sectionId);
  if (!section) return { ok: false, error: 'TDS/TCS section not found.' };
  const used = (company.vouchers ?? []).filter((voucher) => voucher.tds?.sectionId === sectionId).length;
  if (used > 0) {
    return { ok: false, error: `${section.kind} ${section.code} is used by ${used} voucher(s). Alter those vouchers first.` };
  }
  if ((company.tds.sections ?? []).length <= 1) return { ok: false, error: 'Keep at least one TDS/TCS section.' };
  company.tds.sections = company.tds.sections.filter((entry) => entry.id !== sectionId);
  return { ok: true, section };
}

export function addTaxChallan(company, input = {}) {
  const kind = input.kind === 'TCS' ? 'TCS' : input.kind === 'TDS' ? 'TDS' : null;
  if (!kind) return { ok: false, error: 'Choose TDS or TCS for the challan.' };
  const date = String(input.date ?? '');
  if (!isValidIsoDate(date)) return { ok: false, error: 'Enter a valid challan date.' };
  const amount = parseAmount(input.amount);
  if (amount === null || amount <= 0) return { ok: false, error: 'Challan amount must be greater than zero.' };
  const reference = String(input.reference ?? '').trim().slice(0, 40);
  if (reference.length > 40) return { ok: false, error: 'Challan reference must be 40 characters or fewer.' };
  const bsrCode = String(input.bsrCode ?? '').trim().slice(0, 20);
  const section = (company.tds?.sections ?? []).find((entry) => entry.id === input.sectionId);
  if (section && section.kind !== kind) {
    return { ok: false, error: `${section.code} is a ${section.kind} section; choose a ${kind} section for this challan.` };
  }
  company.taxChallans = company.taxChallans ?? [];
  const challan = {
    id: uid('challan'),
    kind,
    date,
    amount,
    reference,
    bsrCode,
  };
  if (section) challan.sectionId = section.id;
  company.taxChallans.push(challan);
  company.taxChallans.sort((a, b) => a.date.localeCompare(b.date));
  return { ok: true, challan };
}

export function deleteTaxChallan(company, challanId) {
  const challan = (company.taxChallans ?? []).find((entry) => entry.id === challanId);
  if (!challan) return { ok: false, error: 'Challan not found.' };
  company.taxChallans = company.taxChallans.filter((entry) => entry.id !== challanId);
  return { ok: true, challan };
}

export const PAY_HEAD_KINDS = { Earning: 'Earning', Deduction: 'Deduction' };

/** Pay heads seeded when payroll is first enabled; amounts are set per employee. */
export const PAYROLL_SEED_PAY_HEADS = [
  { name: 'Basic Salary', kind: 'Earning' },
  { name: 'House Rent Allowance', kind: 'Earning' },
  { name: 'Conveyance Allowance', kind: 'Earning' },
  { name: 'Provident Fund (Employee)', kind: 'Deduction', statutory: 'PF' },
  { name: 'ESI (Employee)', kind: 'Deduction', statutory: 'ESI' },
  { name: 'Professional Tax', kind: 'Deduction', statutory: 'PT' },
];

function payrollRoleLedger(company, role) {
  return (company.ledgers ?? []).find((ledger) => ledger.payrollRole === role) ?? null;
}

function ensurePayrollLedger(company, name, groupKey, openingType, role = '') {
  const tagged = role ? payrollRoleLedger(company, role) : null;
  if (tagged) return { ledger: tagged, created: false };
  const clash = findLedgerByName(company, name);
  if (clash) {
    if (role) clash.payrollRole = role;
    return { ledger: clash, created: false };
  }
  const group =
    company.groups.find((entry) => entry.key === groupKey) ??
    company.groups.find((entry) => entry.key === 'indirectExpenses');
  if (!group) return { error: 'The group needed for payroll ledgers is missing from this company.' };
  const result = addLedger(company, { name, groupId: group.id, opening: 0, openingType });
  if (!result.ok) return { error: result.error };
  if (role) result.ledger.payrollRole = role;
  return { ledger: result.ledger, created: true };
}

/** Salaries and Salary Payable ledgers, created when payroll is enabled. */
export function payrollLedgers(company) {
  return {
    salaries: payrollRoleLedger(company, 'salaries') ?? findLedgerByName(company, 'Salaries'),
    payable:
      payrollRoleLedger(company, 'salaryPayable') ??
      findLedgerByName(company, 'Salary Payable'),
  };
}

/** Valid YYYY-MM month to its last calendar day. */
export function payrollMonthEnd(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month ?? ''))) return null;
  const [year, index] = String(month).split('-').map(Number);
  const day = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
}

function payrollDaysBetween(start, end) {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const days =
    (Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) /
    86400000;
  return Math.round(days) + 1;
}

/** Normalises payroll setup, pay heads, employee pay structures and past runs. */
export function normalizePayroll(company) {
  const source = company.payroll && typeof company.payroll === 'object' ? company.payroll : {};
  const seenHeads = new Set();
  const payHeads = (Array.isArray(source.payHeads) ? source.payHeads : [])
    .filter((head) => head && typeof head === 'object')
    .map((head) => {
      const name = String(head.name ?? '').trim().slice(0, 60);
      const kind = PAY_HEAD_KINDS[head.kind] ? head.kind : null;
      if (!name || !kind) return null;
      const id = String(head.id || uid('pay')).slice(0, 80);
      if (seenHeads.has(name.toUpperCase())) return null;
      seenHeads.add(name.toUpperCase());
      return {
        id,
        name,
        kind,
        ...(head.ledgerId && (company.ledgers ?? []).some((ledger) => ledger.id === head.ledgerId)
          ? { ledgerId: String(head.ledgerId).slice(0, 80) }
          : {}),
        ...(head.statutory ? { statutory: String(head.statutory).trim().slice(0, 12) } : {}),
      };
    })
    .filter(Boolean);
  const headIds = new Set(payHeads.map((head) => head.id));
  const earningHeads = new Set(payHeads.filter((head) => head.kind === 'Earning').map((head) => head.id));

  const seenEmployees = new Set();
  const employees = (Array.isArray(source.employees) ? source.employees : [])
    .filter((employee) => employee && typeof employee === 'object')
    .map((employee) => {
      const name = String(employee.name ?? '').trim().slice(0, 80);
      if (!name) return null;
      const id = String(employee.id || uid('emp')).slice(0, 80);
      if (seenEmployees.has(name.toUpperCase())) return null;
      seenEmployees.add(name.toUpperCase());
      const pay = (Array.isArray(employee.pay) ? employee.pay : [])
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => {
          const amount = parseAmount(entry.amount);
          if (!entry.payHeadId || !headIds.has(entry.payHeadId) || amount === null || amount <= 0) return null;
          return { payHeadId: String(entry.payHeadId).slice(0, 80), amount: round2(amount) };
        })
        .filter(Boolean);
      return {
        id,
        name,
        ...(employee.code ? { code: String(employee.code).trim().slice(0, 20) } : {}),
        ...(employee.designation ? { designation: String(employee.designation).trim().slice(0, 60) } : {}),
        ...(isValidPan(employee.pan) ? { pan: String(employee.pan).trim().toUpperCase() } : {}),
        ...(isValidIsoDate(String(employee.dateOfJoining ?? '')) ? { dateOfJoining: String(employee.dateOfJoining) } : {}),
        ...(isValidIsoDate(String(employee.dateOfExit ?? '')) ? { dateOfExit: String(employee.dateOfExit) } : {}),
        ...(employee.bankName ? { bankName: String(employee.bankName).trim().slice(0, 60) } : {}),
        ...(/^\d{6,20}$/.test(String(employee.bankAccount ?? '').replace(/\s+/g, ''))
          ? { bankAccount: String(employee.bankAccount).replace(/\s+/g, '') }
          : {}),
        ...(/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(employee.ifsc ?? '').trim().toUpperCase())
          ? { ifsc: String(employee.ifsc).trim().toUpperCase() }
          : {}),
        active: employee.active !== false,
        pay,
        leave: normalizeLeaveBalances(employee.leave),
      };
    })
    .filter(Boolean);

  const seenRunIds = new Set();
  const seenRunMonths = new Set();
  const runs = (Array.isArray(source.runs) ? source.runs : [])
    .filter((run) => run && typeof run === 'object' && payrollMonthEnd(run.month))
    .map((run) => {
      const month = String(run.month);
      const date = String(run.date ?? '');
      if (!isValidIsoDate(date) || date.slice(0, 7) !== month) return null;
      const rows = (Array.isArray(run.rows) ? run.rows : [])
        .filter((row) => row && typeof row === 'object' && row.employeeId)
        .map((row) => {
          const gross = parseAmount(row.gross);
          const deductionTotal = parseAmount(row.deductionTotal);
          const net = parseAmount(row.net);
          if (gross === null || gross <= 0 || deductionTotal === null || deductionTotal < 0 || net === null || net < 0) return null;
          const entries = (list) =>
            (Array.isArray(list) ? list : [])
              .map((entry) => {
                const amount = parseAmount(entry?.amount);
                if (!entry?.payHeadId || !String(entry.name ?? '').trim() || amount === null || amount <= 0) return null;
                return {
                  payHeadId: String(entry.payHeadId).slice(0, 80),
                  name: String(entry.name).trim().slice(0, 60),
                  amount: round2(amount),
                  ...(entry.statutory ? { statutory: String(entry.statutory).slice(0, 12) } : {}),
                };
              })
              .filter(Boolean);
          return {
            employeeId: String(row.employeeId).slice(0, 80),
            name: String(row.name ?? '').trim().slice(0, 80),
            ...(row.code ? { code: String(row.code).slice(0, 20) } : {}),
            earnings: entries(row.earnings),
            deductions: entries(row.deductions),
            gross: round2(gross),
            deductionTotal: round2(deductionTotal),
            net: round2(net),
          };
        })
        .filter(Boolean);
      if (!rows.length) return null;
      const totals = {
        employees: rows.length,
        gross: round2(rows.reduce((sum, row) => sum + row.gross, 0)),
        deductions: round2(rows.reduce((sum, row) => sum + row.deductionTotal, 0)),
        net: round2(rows.reduce((sum, row) => sum + row.net, 0)),
      };
      const id = String(run.id || uid('run')).slice(0, 80);
      if (seenRunIds.has(id) || seenRunMonths.has(month)) return null;
      seenRunIds.add(id);
      seenRunMonths.add(month);
      return {
        id,
        month,
        date,
        rows,
        totals,
        ...(run.voucherId && (company.vouchers ?? []).some((voucher) => voucher.id === run.voucherId)
          ? { voucherId: String(run.voucherId).slice(0, 80) }
          : {}),
        ...(run.createdAt ? { createdAt: String(run.createdAt) } : {}),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.month.localeCompare(b.month));

  const leaveRecords = (Array.isArray(source.leaveRecords) ? source.leaveRecords : [])
    .filter((record) => record && record.id && isValidIsoDate(record.from) && isValidIsoDate(record.to) && record.to >= record.from)
    .filter((record) => employees.some((employee) => employee.id === record.employeeId))
    .map((record) => ({
      id: String(record.id).slice(0, 80),
      employeeId: String(record.employeeId).slice(0, 80),
      type: ['CL', 'SL', 'EL'].includes(record.type) ? record.type : 'CL',
      from: record.from,
      to: record.to,
      days: Math.min(366, Math.max(1, Math.round((new Date(record.to) - new Date(record.from)) / 86400000) + 1)),
      ...(record.notes ? { notes: String(record.notes).slice(0, 200) } : {}),
    }));
  const payable = payrollRoleLedger(company, 'salaryPayable');
  company.payroll = {
    enabled: Boolean(source.enabled),
    payHeads,
    employees,
    runs,
    leaveRecords,
    ...(source.salaryPayableLedgerId &&
    (company.ledgers ?? []).some((ledger) => ledger.id === source.salaryPayableLedgerId)
      ? { salaryPayableLedgerId: String(source.salaryPayableLedgerId).slice(0, 80) }
      : payable
        ? { salaryPayableLedgerId: payable.id }
        : {}),
  };
  if (source.enabled && !company.payroll.payHeads.length) {
    company.payroll.payHeads = PAYROLL_SEED_PAY_HEADS.map((head) => ({ id: uid('pay'), ...head }));
  }
  linkSeedPayHeadLedgers(company);
  return company;
}

/** Re-links seeded pay heads to their ledgers after a load or backup restore. */
function linkSeedPayHeadLedgers(company) {
  const salaries = payrollLedgers(company).salaries;
  for (const head of company.payroll.payHeads) {
    if (head.kind === 'Earning' && !head.ledgerId && salaries) head.ledgerId = salaries.id;
  }
  const byStatutory = {
    PF: findLedgerByName(company, 'Provident Fund Payable'),
    ESI: findLedgerByName(company, 'ESI Payable'),
    PT: findLedgerByName(company, 'Professional Tax Payable'),
  };
  for (const head of company.payroll.payHeads) {
    if (head.kind !== 'Deduction' || head.ledgerId) continue;
    const ledger = head.statutory ? byStatutory[head.statutory] : null;
    if (ledger) head.ledgerId = ledger.id;
  }
}

export function savePayrollSettings(company, input = {}) {
  const enabled = input.enabled === true || input.enabled === 'true' || input.enabled === 'on';
  company.payroll = company.payroll ?? normalizePayroll(company).payroll;
  company.payroll.enabled = enabled;
  const created = [];
  if (!enabled) return { ok: true, payroll: company.payroll, created };

  const salaries = ensurePayrollLedger(company, 'Salaries', 'indirectExpenses', 'Dr', 'salaries');
  if (salaries.error) return { ok: false, error: salaries.error };
  if (salaries.created) created.push(salaries.ledger.name);
  const payable = ensurePayrollLedger(company, 'Salary Payable', 'currentLiabilities', 'Cr', 'salaryPayable');
  if (payable.error) return { ok: false, error: payable.error };
  if (payable.created) created.push(payable.ledger.name);
  const statutory = [
    ['Provident Fund Payable', 'dutiesTaxes'],
    ['ESI Payable', 'dutiesTaxes'],
    ['Professional Tax Payable', 'dutiesTaxes'],
  ];
  for (const [name, group] of statutory) {
    const result = ensurePayrollLedger(company, name, group, 'Cr');
    if (result.error) return { ok: false, error: result.error };
    if (result.created) created.push(result.ledger.name);
  }
  company.payroll.salaryPayableLedgerId = payable.ledger.id;

  if (!company.payroll.payHeads.length) {
    const statutoryLedgers = {
      PF: 'Provident Fund Payable',
      ESI: 'ESI Payable',
      PT: 'Professional Tax Payable',
    };
    company.payroll.payHeads = PAYROLL_SEED_PAY_HEADS.map((head) => {
      const ledger =
        head.kind === 'Earning'
          ? payrollLedgers(company).salaries
          : findLedgerByName(company, statutoryLedgers[head.statutory] ?? '');
      return { id: uid('pay'), ...head, ...(ledger ? { ledgerId: ledger.id } : {}) };
    });
  }
  return { ok: true, payroll: company.payroll, created };
}

export function addPayHead(company, input = {}) {
  if (!company.payroll?.enabled) return { ok: false, error: 'Enable payroll before adding pay heads.' };
  const name = String(input.name ?? '').trim().slice(0, 60);
  if (!name) return { ok: false, error: 'Pay head name is required.' };
  const kind = PAY_HEAD_KINDS[input.kind] ? input.kind : null;
  if (!kind) return { ok: false, error: 'Choose Earning or Deduction for the pay head.' };
  if (company.payroll.payHeads.some((head) => head.name.toUpperCase() === name.toUpperCase())) {
    return { ok: false, error: `A pay head named "${name}" already exists.` };
  }
  const ledger = (company.ledgers ?? []).find((entry) => entry.id === input.ledgerId);
  if (!ledger) return { ok: false, error: 'Choose the ledger this pay head posts to.' };
  const statutory = String(input.statutory ?? '').trim().slice(0, 12).toUpperCase();
  const head = { id: uid('pay'), name, kind, ledgerId: ledger.id };
  if (statutory) head.statutory = statutory;
  company.payroll.payHeads.push(head);
  return { ok: true, payHead: head };
}

export function deletePayHead(company, payHeadId) {
  const head = (company.payroll?.payHeads ?? []).find((entry) => entry.id === payHeadId);
  if (!head) return { ok: false, error: 'Pay head not found.' };
  const used = (company.payroll.employees ?? []).filter((employee) =>
    (employee.pay ?? []).some((entry) => entry.payHeadId === payHeadId),
  ).length;
  if (used > 0) {
    return { ok: false, error: `${head.name} is used by ${used} employee(s). Remove it from their pay structure first.` };
  }
  company.payroll.payHeads = company.payroll.payHeads.filter((entry) => entry.id !== payHeadId);
  return { ok: true, payHead: head };
}

function employeePayEntries(company, input) {
  const list = Array.isArray(input)
    ? input
    : Object.entries(input && typeof input === 'object' ? input : {}).map(([payHeadId, amount]) => ({ payHeadId, amount }));
  const heads = new Map((company.payroll?.payHeads ?? []).map((head) => [head.id, head]));
  const seen = new Set();
  const pay = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') return { error: 'Enter a pay amount for each pay head.' };
    const amount = parseAmount(entry.amount);
    if (amount === null || amount < 0) return { error: 'Pay amounts must be zero or more.' };
    if (amount === 0) continue;
    const head = heads.get(entry.payHeadId);
    if (!head) return { error: 'A pay entry points at a missing pay head.' };
    if (seen.has(head.id)) return { error: `${head.name} appears more than once in the pay structure.` };
    seen.add(head.id);
    pay.push({ payHeadId: head.id, amount: round2(amount) });
  }
  const earnings = pay.filter((entry) => heads.get(entry.payHeadId).kind === 'Earning');
  if (!earnings.length) return { error: 'Give the employee at least one earning pay head amount.' };
  return { pay };
}

function employeeBankFields(input = {}) {
  const bankName = String(input.bankName ?? '').trim().slice(0, 60);
  const accountNumber = String(input.bankAccount ?? '').replace(/\s+/g, '').trim();
  const ifsc = String(input.ifsc ?? '').trim().toUpperCase();
  if (accountNumber && !/^\d{6,20}$/.test(accountNumber)) {
    return { error: 'Employee bank account must be 6 to 20 digits.' };
  }
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return { error: 'Employee IFSC must be 11 characters: four letters, zero and six letters/digits.' };
  }
  return { bankName, accountNumber, ifsc };
}

export function addEmployee(company, input = {}) {
  if (!company.payroll?.enabled) return { ok: false, error: 'Enable payroll before adding employees.' };
  const name = String(input.name ?? '').trim().slice(0, 80);
  if (!name) return { ok: false, error: 'Employee name is required.' };
  if ((company.payroll.employees ?? []).some((employee) => employee.name.toUpperCase() === name.toUpperCase())) {
    return { ok: false, error: `An employee named "${name}" already exists.` };
  }
  const pan = String(input.pan ?? '').trim().toUpperCase();
  if (pan && !isValidPan(pan)) return { ok: false, error: 'Employee PAN must be 10 characters: five letters, four digits and one letter.' };
  const dateOfJoining = String(input.dateOfJoining ?? '').trim();
  if (dateOfJoining && !isValidIsoDate(dateOfJoining)) {
    return { ok: false, error: 'Enter a valid date of joining.' };
  }
  const dateOfExit = String(input.dateOfExit ?? '').trim();
  if (dateOfExit && !isValidIsoDate(dateOfExit)) {
    return { ok: false, error: 'Enter a valid date of exit.' };
  }
  if (dateOfJoining && dateOfExit && dateOfExit < dateOfJoining) {
    return { ok: false, error: 'The date of exit cannot be before the date of joining.' };
  }
  const checked = employeePayEntries(company, input.pay);
  if (checked.error) return { ok: false, error: checked.error };
  const bank = employeeBankFields(input);
  if (bank.error) return { ok: false, error: bank.error };
  const employee = {
    id: uid('emp'),
    name,
    active: input.active !== false && input.active !== 'false',
    pay: checked.pay,
    leave: normalizeLeaveBalances(input.leave),
  };
  const code = String(input.code ?? '').trim().slice(0, 20);
  const designation = String(input.designation ?? '').trim().slice(0, 60);
  if (code) employee.code = code;
  if (designation) employee.designation = designation;
  if (pan) employee.pan = pan;
  if (bank.bankName) employee.bankName = bank.bankName;
  if (bank.accountNumber) employee.bankAccount = bank.accountNumber;
  if (bank.ifsc) employee.ifsc = bank.ifsc;
  if (dateOfJoining) employee.dateOfJoining = dateOfJoining;
  if (dateOfExit) employee.dateOfExit = dateOfExit;
  company.payroll.employees.push(employee);
  return { ok: true, employee };
}

export function updateEmployee(company, employeeId, input = {}) {
  const employee = (company.payroll?.employees ?? []).find((entry) => entry.id === employeeId);
  if (!employee) return { ok: false, error: 'Employee not found.' };
  const name = String(input.name ?? '').trim().slice(0, 80);
  if (!name) return { ok: false, error: 'Employee name is required.' };
  if (
    company.payroll.employees.some(
      (entry) => entry.id !== employeeId && entry.name.toUpperCase() === name.toUpperCase(),
    )
  ) {
    return { ok: false, error: `An employee named "${name}" already exists.` };
  }
  const pan = String(input.pan ?? '').trim().toUpperCase();
  if (pan && !isValidPan(pan)) return { ok: false, error: 'Employee PAN must be 10 characters: five letters, four digits and one letter.' };
  const dateOfJoining = String(input.dateOfJoining ?? '').trim();
  if (dateOfJoining && !isValidIsoDate(dateOfJoining)) {
    return { ok: false, error: 'Enter a valid date of joining.' };
  }
  const dateOfExit = String(input.dateOfExit ?? '').trim();
  if (dateOfExit && !isValidIsoDate(dateOfExit)) {
    return { ok: false, error: 'Enter a valid date of exit.' };
  }
  if (dateOfJoining && dateOfExit && dateOfExit < dateOfJoining) {
    return { ok: false, error: 'The date of exit cannot be before the date of joining.' };
  }
  const checked = employeePayEntries(company, input.pay);
  if (checked.error) return { ok: false, error: checked.error };
  const bank = employeeBankFields(input);
  if (bank.error) return { ok: false, error: bank.error };
  employee.name = name;
  employee.active = input.active !== false && input.active !== 'false';
  employee.pay = checked.pay;
  employee.leave = normalizeLeaveBalances(input.leave);
  const optional = { code: 20, designation: 60 };
  for (const [key, max] of Object.entries(optional)) {
    const value = String(input[key] ?? '').trim().slice(0, max);
    if (value) employee[key] = value;
    else delete employee[key];
  }
  if (pan) employee.pan = pan;
  else delete employee.pan;
  if (bank.bankName) employee.bankName = bank.bankName;
  else delete employee.bankName;
  if (bank.accountNumber) employee.bankAccount = bank.accountNumber;
  else delete employee.bankAccount;
  if (bank.ifsc) employee.ifsc = bank.ifsc;
  else delete employee.ifsc;
  if (dateOfJoining) employee.dateOfJoining = dateOfJoining;
  else delete employee.dateOfJoining;
  if (dateOfExit) employee.dateOfExit = dateOfExit;
  else delete employee.dateOfExit;
  return { ok: true, employee };
}

function normalizeLeaveBalances(input = {}) {
  const result = {};
  for (const type of ['CL', 'SL', 'EL']) {
    const value = parseQty(input?.[type] ?? 0);
    result[type] = value === null || value < 0 ? 0 : round3(value);
  }
  return result;
}

export function employeeLeaveBalance(company, employeeId) {
  const employee = (company.payroll?.employees ?? []).find((entry) => entry.id === employeeId);
  if (!employee) return null;
  const opening = normalizeLeaveBalances(employee.leave);
  const records = (company.payroll?.leaveRecords ?? []).filter((record) => record.employeeId === employeeId);
  const result = {};
  for (const type of ['CL', 'SL', 'EL']) {
    const used = round3(records.filter((record) => record.type === type).reduce((sum, record) => sum + record.days, 0));
    result[type] = { opening: opening[type], used, remaining: round3(opening[type] - used) };
  }
  return result;
}

export function addLeaveRecord(company, input = {}) {
  if (!company.payroll?.enabled) return { ok: false, error: 'Enable payroll before recording leave.' };
  const employee = (company.payroll.employees ?? []).find((entry) => entry.id === input.employeeId);
  if (!employee) return { ok: false, error: 'Choose an employee.' };
  const type = ['CL', 'SL', 'EL'].includes(input.type) ? input.type : null;
  if (!type) return { ok: false, error: 'Choose Casual, Sick or Earned leave.' };
  const from = String(input.from ?? '');
  const to = String(input.to ?? from);
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || to < from) {
    return { ok: false, error: 'Enter a valid leave start and end date.' };
  }
  const days = Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (days > 366) return { ok: false, error: 'A leave record cannot exceed 366 days.' };
  const overlap = (company.payroll.leaveRecords ?? []).some(
    (record) => record.employeeId === employee.id && record.from <= to && record.to >= from,
  );
  if (overlap) return { ok: false, error: 'This leave overlaps an existing leave record.' };
  company.payroll.leaveRecords = company.payroll.leaveRecords ?? [];
  const record = {
    id: uid('leave'),
    employeeId: employee.id,
    type,
    from,
    to,
    days,
    ...(String(input.notes ?? '').trim() ? { notes: String(input.notes).trim().slice(0, 200) } : {}),
  };
  company.payroll.leaveRecords.push(record);
  const balance = employeeLeaveBalance(company, employee.id);
  if (balance[type].remaining < 0) {
    company.payroll.leaveRecords.pop();
    return { ok: false, error: `Only ${balance[type].opening - balance[type].used + days} ${type} day(s) remain for ${employee.name}.` };
  }
  return { ok: true, record, balance };
}

export function deleteLeaveRecord(company, recordId) {
  const record = (company.payroll?.leaveRecords ?? []).find((entry) => entry.id === recordId);
  if (!record) return { ok: false, error: 'Leave record not found.' };
  company.payroll.leaveRecords = company.payroll.leaveRecords.filter((entry) => entry.id !== recordId);
  return { ok: true, record };
}

export function deleteEmployee(company, employeeId) {
  const employee = (company.payroll?.employees ?? []).find((entry) => entry.id === employeeId);
  if (!employee) return { ok: false, error: 'Employee not found.' };
  const used = (company.payroll.runs ?? []).filter((run) =>
    run.rows.some((row) => row.employeeId === employeeId),
  ).length;
  if (used > 0) {
    return { ok: false, error: `${employee.name} appears in ${used} payroll run(s). Deactivate the employee instead.` };
  }
  company.payroll.employees = company.payroll.employees.filter((entry) => entry.id !== employeeId);
  return { ok: true, employee };
}

/** Posts one journal voucher for a month and returns the payroll run. */
export function runPayroll(company, input = {}) {
  if (!company.payroll?.enabled) return { ok: false, error: 'Enable payroll before running it.' };
  const month = String(input.month ?? '');
  const end = payrollMonthEnd(month);
  if (!end) return { ok: false, error: 'Choose the payroll month as YYYY-MM.' };
  if ((company.payroll.runs ?? []).some((run) => run.month === month)) {
    return { ok: false, error: `Payroll for ${month} has already been run.` };
  }
  const date = String(input.date ?? '').trim() || end;
  if (!isValidIsoDate(date) || date.slice(0, 7) !== month) {
    return { ok: false, error: 'The payroll date must fall inside the payroll month.' };
  }
  const heads = new Map((company.payroll.payHeads ?? []).map((head) => [head.id, head]));
  const employees = (company.payroll.employees ?? []).filter((employee) => employee.active);
  if (!employees.length) return { ok: false, error: 'Add an active employee before running payroll.' };

  const monthDays = Number(end.slice(8, 10));
  const monthStart = `${month}-01`;
  const rows = [];
  const paidInput = input.paidDays && typeof input.paidDays === 'object' ? input.paidDays : {};
  for (const employee of employees) {
    const joined = employee.dateOfJoining && employee.dateOfJoining > monthStart ? employee.dateOfJoining : monthStart;
    const exited = employee.dateOfExit && employee.dateOfExit < end ? employee.dateOfExit : end;
    const workedDays = joined > exited ? 0 : payrollDaysBetween(joined, exited);
    if (workedDays === 0) continue;
    let paidDays = workedDays;
    if (Object.prototype.hasOwnProperty.call(paidInput, employee.id)) {
      const value = Number(paidInput[employee.id]);
      if (!Number.isFinite(value) || value < 0 || value > workedDays + 0.0005) {
        return { ok: false, error: `${employee.name}'s paid days must be between 0 and ${workedDays}.` };
      }
      paidDays = round2(value);
    }
    if (paidDays === 0) continue;
    const prorated = paidDays < monthDays;
    const factor = prorated ? paidDays / monthDays : 1;
    const earnings = [];
    const deductions = [];
    for (const entry of employee.pay ?? []) {
      const head = heads.get(entry.payHeadId);
      if (!head) continue;
      const line = {
        payHeadId: head.id,
        name: head.name,
        amount: round2(round2(entry.amount) * factor),
      };
      if (head.statutory) line.statutory = head.statutory;
      if (head.kind === 'Earning') earnings.push(line);
      else deductions.push(line);
    }
    if (!earnings.length) {
      return { ok: false, error: `${employee.name} has no earning amounts. Update the pay structure or deactivate the employee.` };
    }
    const gross = round2(earnings.reduce((sum, line) => sum + line.amount, 0));
    const deductionTotal = round2(deductions.reduce((sum, line) => sum + line.amount, 0));
    if (deductionTotal > gross + 0.005) {
      return { ok: false, error: `${employee.name}'s deductions exceed earnings.` };
    }
    rows.push({
      employeeId: employee.id,
      name: employee.name,
      ...(employee.code ? { code: employee.code } : {}),
      ...(workedDays !== monthDays ? { workedDays } : {}),
      paidDays,
      monthDays,
      earnings,
      deductions,
      gross,
      deductionTotal,
      net: round2(gross - deductionTotal),
    });
  }
  if (!rows.length) {
    return { ok: false, error: `No employee worked during ${month}. Check joining and exit dates.` };
  }

  const totals = {
    employees: rows.length,
    gross: round2(rows.reduce((sum, row) => sum + row.gross, 0)),
    deductions: round2(rows.reduce((sum, row) => sum + row.deductionTotal, 0)),
    net: round2(rows.reduce((sum, row) => sum + row.net, 0)),
  };
  if (totals.gross <= 0) return { ok: false, error: 'Payroll has no earnings to post.' };

  const debitTotals = new Map();
  const creditTotals = new Map();
  const add = (map, ledgerId, amount) => map.set(ledgerId, round2((map.get(ledgerId) ?? 0) + amount));
  for (const row of rows) {
    for (const line of row.earnings) {
      const head = heads.get(line.payHeadId);
      if (!head?.ledgerId) return { ok: false, error: `${line.name} has no ledger. Choose one in the pay-head master.` };
      add(debitTotals, head.ledgerId, line.amount);
    }
    for (const line of row.deductions) {
      const head = heads.get(line.payHeadId);
      if (!head?.ledgerId) return { ok: false, error: `${line.name} has no ledger. Choose one in the pay-head master.` };
      add(creditTotals, head.ledgerId, line.amount);
    }
  }
  const payable =
    (company.ledgers ?? []).find((ledger) => ledger.id === company.payroll.salaryPayableLedgerId) ??
    payrollLedgers(company).payable;
  if (!payable) {
    return { ok: false, error: 'Salary Payable ledger is missing. Save the payroll setup again to recreate it.' };
  }
  if (totals.net > 0) add(creditTotals, payable.id, totals.net);

  const lines = [];
  for (const [ledgerId, amount] of debitTotals) lines.push({ ledgerId, side: 'Dr', amount });
  for (const [ledgerId, amount] of creditTotals) lines.push({ ledgerId, side: 'Cr', amount });
  const posted = addVoucher(company, {
    type: 'Journal',
    date,
    narration: `Payroll for ${month}`,
    lines,
  });
  if (!posted.ok) return posted;

  const run = {
    id: uid('run'),
    month,
    date,
    voucherId: posted.voucher.id,
    rows,
    totals,
    createdAt: new Date().toISOString(),
  };
  posted.voucher.payrollRunId = run.id;
  company.payroll.runs = [...(company.payroll.runs ?? []), run].sort((a, b) => a.month.localeCompare(b.month));
  return { ok: true, run, voucher: posted.voucher };
}

export function payrollBankTransferRows(company, runId) {
  const run = (company.payroll?.runs ?? []).find((entry) => entry.id === runId);
  if (!run) return { ok: false, error: 'Payroll run not found.' };
  const rows = run.rows.map((row) => {
    const employee = (company.payroll?.employees ?? []).find((entry) => entry.id === row.employeeId);
    return {
      employeeId: row.employeeId,
      name: row.name,
      code: row.code ?? employee?.code ?? '',
      bankName: employee?.bankName ?? '',
      accountNumber: employee?.bankAccount ?? '',
      ifsc: employee?.ifsc ?? '',
      net: row.net,
    };
  });
  const missing = rows.filter((row) => !row.accountNumber || !row.ifsc).map((row) => row.name);
  return { ok: true, run, rows, missing };
}

export function deletePayrollRun(company, runId) {
  const run = (company.payroll?.runs ?? []).find((entry) => entry.id === runId);
  if (!run) return { ok: false, error: 'Payroll run not found.' };
  if (run.voucherId) {
    const voucher = (company.vouchers ?? []).find((entry) => entry.id === run.voucherId);
    if (voucher && !deleteVoucher(company, voucher.id)) {
      return { ok: false, error: 'The payroll voucher cannot be deleted. Check whether its financial year is closed.' };
    }
    company.vouchers = company.vouchers.filter((entry) => entry.payrollRunId !== runId && entry.id !== run.voucherId);
  }
  company.vouchers = (company.vouchers ?? []).filter((entry) => entry.payrollRunId !== runId);
  company.payroll.runs = company.payroll.runs.filter((entry) => entry.id !== runId);
  return { ok: true, run };
}

export function addGstRate(company, input = {}) {
  const rate = parseAmount(input.rate);
  const cess = parseAmount(input.cess ?? 0);
  if (rate === null || rate < 0 || rate > 50) return { ok: false, error: 'GST rate must be between 0% and 50%.' };
  if (cess === null || cess < 0 || cess > 50) return { ok: false, error: 'Cess rate must be between 0% and 50%.' };
  company.gst = company.gst ?? normalizeGst(company).gst;
  company.gst.rates = company.gst.rates ?? [];
  if (company.gst.rates.some((entry) => entry.rate === rate && entry.cess === cess)) {
    return { ok: false, error: `${gstRateLabel(rate, cess)} already exists in the rate master.` };
  }
  const label = String(input.label ?? '').trim().slice(0, 40) || gstRateLabel(rate, cess);
  const entry = { id: uid('gst'), label, rate, cess };
  company.gst.rates.push(entry);
  return { ok: true, rate: entry };
}

export function updateGstRate(company, rateId, input = {}) {
  const entry = (company.gst?.rates ?? []).find((rate) => rate.id === rateId);
  if (!entry) return { ok: false, error: 'GST rate not found.' };
  const rate = parseAmount(input.rate === undefined ? entry.rate : input.rate);
  const cess = parseAmount(input.cess === undefined ? entry.cess ?? 0 : input.cess);
  if (rate === null || rate < 0 || rate > 50) return { ok: false, error: 'GST rate must be between 0% and 50%.' };
  if (cess === null || cess < 0 || cess > 50) return { ok: false, error: 'Cess rate must be between 0% and 50%.' };
  if (
    (company.gst.rates ?? []).some(
      (other) => other.id !== rateId && other.rate === rate && (other.cess ?? 0) === cess,
    )
  ) {
    return { ok: false, error: `${gstRateLabel(rate, cess)} already exists in the rate master.` };
  }
  const label = String(input.label ?? '').trim().slice(0, 40) || gstRateLabel(rate, cess);
  entry.label = label;
  entry.rate = rate;
  entry.cess = cess;
  return { ok: true, rate: entry };
}

export function deleteGstRate(company, rateId) {
  const rate = (company.gst?.rates ?? []).find((entry) => entry.id === rateId);
  if (!rate) return { ok: false, error: 'GST rate not found.' };
  const used = (company.vouchers ?? []).filter((voucher) => voucher.gst?.rateId === rateId).length;
  if (used > 0) {
    return { ok: false, error: `${rate.label} is used by ${used} voucher(s). Alter those vouchers first.` };
  }
  if ((company.gst.rates ?? []).length <= 1) return { ok: false, error: 'Keep at least one GST rate.' };
  company.gst.rates = company.gst.rates.filter((entry) => entry.id !== rateId);
  return { ok: true, rate };
}

function normaliseBudgetTargetType(value) {
  return value === 'group' || value === 'ledger' || value === 'costCentre' ? value : null;
}

function budgetTargetOf(company, targetType, targetId) {
  if (targetType === 'group') return (company.groups ?? []).find((group) => group.id === targetId) ?? null;
  if (targetType === 'ledger') return (company.ledgers ?? []).find((ledger) => ledger.id === targetId) ?? null;
  if (targetType === 'costCentre') return (company.costCentres ?? []).find((centre) => centre.id === targetId) ?? null;
  return null;
}

/** Annual budgets by ledger, group or cost centre; one target and year per record. */
export function normalizeBudgets(company) {
  const seenIds = new Set();
  const seenNames = new Set();
  const seenTargets = new Set();
  company.budgets = (Array.isArray(company.budgets) ? company.budgets : [])
    .filter((budget) => budget && typeof budget === 'object')
    .map((budget) => {
      const targetType = normaliseBudgetTargetType(budget.targetType);
      const target = budgetTargetOf(company, targetType, budget.targetId);
      const year = (company.years ?? []).find((item) => item.id === budget.yearId);
      const amount = parseAmount(budget.amount);
      if (!target || !year || amount === null || amount < 0) return null;
      const name = String(budget.name ?? '').trim() || `${target.name} ${year.start.slice(0, 4)}`;
      return {
        id: String(budget.id || uid('budget')).slice(0, 80),
        name: name.slice(0, 80),
        targetType,
        targetId: target.id,
        yearId: year.id,
        amount,
        createdAt: budget.createdAt ? String(budget.createdAt) : new Date().toISOString(),
      };
    })
    .filter((budget) => {
      if (!budget) return false;
      const nameKey = budget.name.toLowerCase();
      const targetKey = `${budget.targetType}:${budget.targetId}:${budget.yearId}`;
      if (seenIds.has(budget.id) || seenNames.has(nameKey) || seenTargets.has(targetKey)) return false;
      seenIds.add(budget.id);
      seenNames.add(nameKey);
      seenTargets.add(targetKey);
      return true;
    });
  return company;
}

export function addBudget(company, input = {}) {
  const targetType = normaliseBudgetTargetType(input.targetType);
  if (!targetType) return { ok: false, error: 'Choose a ledger, group or cost centre for the budget.' };
  const target = budgetTargetOf(company, targetType, input.targetId);
  if (!target) return { ok: false, error: 'Budget target not found.' };
  const year = (company.years ?? []).find((item) => item.id === input.yearId);
  if (!year) return { ok: false, error: 'Choose a financial year for the budget.' };
  const amount = parseAmount(input.amount);
  if (amount === null || amount < 0) return { ok: false, error: 'Budget amount must be zero or more.' };
  const name = String(input.name ?? '').trim() || `${target.name} ${year.start.slice(0, 4)}`;
  if (name.length > 80) return { ok: false, error: 'Budget name must be 80 characters or fewer.' };
  company.budgets = company.budgets ?? [];
  if (company.budgets.some((budget) => budget.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `A budget named "${name}" already exists.` };
  }
  if (company.budgets.some((budget) => budget.targetType === targetType && budget.targetId === target.id && budget.yearId === year.id)) {
    return { ok: false, error: `A budget already exists for "${target.name}" in this financial year.` };
  }
  const budget = {
    id: uid('budget'),
    name,
    targetType,
    targetId: target.id,
    yearId: year.id,
    amount,
    createdAt: new Date().toISOString(),
  };
  company.budgets.push(budget);
  return { ok: true, budget };
}

export function updateBudget(company, budgetId, input = {}) {
  const budget = (company.budgets ?? []).find((item) => item.id === budgetId);
  if (!budget) return { ok: false, error: 'Budget not found.' };
  const targetType = normaliseBudgetTargetType(input.targetType) ?? budget.targetType;
  const targetId = input.targetId ?? budget.targetId;
  const target = budgetTargetOf(company, targetType, targetId);
  if (!target) return { ok: false, error: 'Budget target not found.' };
  const yearId = input.yearId ?? budget.yearId;
  const year = (company.years ?? []).find((item) => item.id === yearId);
  if (!year) return { ok: false, error: 'Choose a financial year for the budget.' };
  const amount = parseAmount(input.amount === undefined ? budget.amount : input.amount);
  if (amount === null || amount < 0) return { ok: false, error: 'Budget amount must be zero or more.' };
  const name = String(input.name ?? '').trim() || budget.name;
  if (name.length > 80) return { ok: false, error: 'Budget name must be 80 characters or fewer.' };
  if (
    (company.budgets ?? []).some(
      (entry) => entry.id !== budgetId && entry.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    return { ok: false, error: `A budget named "${name}" already exists.` };
  }
  if (
    (company.budgets ?? []).some(
      (entry) =>
        entry.id !== budgetId &&
        entry.targetType === targetType &&
        entry.targetId === target.id &&
        entry.yearId === year.id,
    )
  ) {
    return { ok: false, error: `A budget already exists for "${target.name}" in this financial year.` };
  }
  budget.name = name;
  budget.targetType = targetType;
  budget.targetId = target.id;
  budget.yearId = year.id;
  budget.amount = amount;
  budget.updatedAt = new Date().toISOString();
  return { ok: true, budget };
}

function uniqueBudgetName(company, base) {
  const budgets = company.budgets ?? [];
  let name = base.slice(0, 80);
  let attempt = 2;
  while (budgets.some((budget) => budget.name.toLowerCase() === name.toLowerCase())) {
    const suffix = ` (${attempt})`;
    name = `${base.slice(0, 80 - suffix.length)}${suffix}`;
    attempt += 1;
  }
  return name;
}

export function duplicateBudget(company, budgetId, input = {}) {
  const source = (company.budgets ?? []).find((item) => item.id === budgetId);
  if (!source) return { ok: false, error: 'Budget not found.' };
  const years = [...(company.years ?? [])].sort((a, b) => a.start.localeCompare(b.start));
  const sourceYear = years.find((year) => year.id === source.yearId);
  let targetYear = null;
  if (input.yearId) {
    targetYear = years.find((year) => year.id === input.yearId) ?? null;
  } else {
    targetYear = years.find((year) => year.start > (sourceYear?.start ?? '')) ?? null;
  }
  if (!targetYear) {
    return { ok: false, error: 'Add the next financial year before duplicating this budget.' };
  }
  if (
    (company.budgets ?? []).some(
      (budget) =>
        budget.targetType === source.targetType &&
        budget.targetId === source.targetId &&
        budget.yearId === targetYear.id,
    )
  ) {
    return { ok: false, error: 'A budget already exists for this target in the next financial year.' };
  }
  const baseName = `${source.name} ${targetYear.start.slice(0, 4)}`;
  const budget = {
    id: uid('budget'),
    name: uniqueBudgetName(company, baseName),
    targetType: source.targetType,
    targetId: source.targetId,
    yearId: targetYear.id,
    amount: source.amount,
    createdAt: new Date().toISOString(),
  };
  company.budgets = company.budgets ?? [];
  company.budgets.push(budget);
  return { ok: true, budget };
}

export function deleteBudget(company, budgetId) {
  const budget = (company.budgets ?? []).find((item) => item.id === budgetId);
  if (!budget) return { ok: false, error: 'Budget not found.' };
  company.budgets = company.budgets.filter((item) => item.id !== budgetId);
  return { ok: true, budget };
}

export function addCostCategory(company, input = {}) {
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'Cost category name is required.' };
  if (name.length > 80) return { ok: false, error: 'Cost category name must be 80 characters or fewer.' };
  if ((company.costCategories ?? []).some((category) => category.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `A cost category named "${name}" already exists.` };
  }
  company.costCategories = company.costCategories ?? [];
  const category = { id: uid('ccat'), name, createdAt: new Date().toISOString() };
  company.costCategories.push(category);
  return { ok: true, category };
}

export function updateCostCategory(company, categoryId, input = {}) {
  const category = (company.costCategories ?? []).find((item) => item.id === categoryId);
  if (!category) return { ok: false, error: 'Cost category not found.' };
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'Cost category name is required.' };
  if (name.length > 80) return { ok: false, error: 'Cost category name must be 80 characters or fewer.' };
  if (
    (company.costCategories ?? []).some(
      (item) => item.id !== categoryId && item.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    return { ok: false, error: `A cost category named "${name}" already exists.` };
  }
  category.name = name;
  return { ok: true, category };
}

export function deleteCostCategory(company, categoryId) {
  const category = (company.costCategories ?? []).find((item) => item.id === categoryId);
  if (!category) return { ok: false, error: 'Cost category not found.' };
  if ((company.costCategories ?? []).length <= 1) {
    return { ok: false, error: 'Keep at least one cost category.' };
  }
  const used = (company.costCentres ?? []).filter((centre) => centre.categoryId === categoryId).length;
  if (used > 0) return { ok: false, error: `Move or delete the ${used} cost centre(s) in this category first.` };
  company.costCategories = company.costCategories.filter((item) => item.id !== categoryId);
  return { ok: true, category };
}

export function addCostCentre(company, input = {}) {
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'Cost centre name is required.' };
  if (name.length > 80) return { ok: false, error: 'Cost centre name must be 80 characters or fewer.' };
  if ((company.costCentres ?? []).some((centre) => centre.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `A cost centre named "${name}" already exists.` };
  }
  const category = (company.costCategories ?? []).find((item) => item.id === input.categoryId);
  if (!category) return { ok: false, error: 'Choose a cost category for this centre.' };
  company.costCentres = company.costCentres ?? [];
  const centre = { id: uid('cc'), name, categoryId: category.id, createdAt: new Date().toISOString() };
  company.costCentres.push(centre);
  return { ok: true, centre };
}

export function updateCostCentre(company, centreId, input = {}) {
  const centre = (company.costCentres ?? []).find((item) => item.id === centreId);
  if (!centre) return { ok: false, error: 'Cost centre not found.' };
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'Cost centre name is required.' };
  if (name.length > 80) return { ok: false, error: 'Cost centre name must be 80 characters or fewer.' };
  if (
    (company.costCentres ?? []).some(
      (item) => item.id !== centreId && item.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    return { ok: false, error: `A cost centre named "${name}" already exists.` };
  }
  const category = (company.costCategories ?? []).find((item) => item.id === input.categoryId);
  if (!category) return { ok: false, error: 'Choose a cost category for this centre.' };
  centre.name = name;
  centre.categoryId = category.id;
  return { ok: true, centre };
}

export function costCentreUsage(company, centreId) {
  let count = 0;
  for (const voucher of company.vouchers ?? []) {
    for (const line of voucher.lines ?? []) {
      if (line.costCentreId === centreId) count += 1;
    }
  }
  return count;
}

export function deleteCostCentre(company, centreId) {
  const centre = (company.costCentres ?? []).find((item) => item.id === centreId);
  if (!centre) return { ok: false, error: 'Cost centre not found.' };
  const used = costCentreUsage(company, centreId);
  if (used > 0) {
    return { ok: false, error: `"${centre.name}" is used on ${used} voucher line(s). Clear those allocations first.` };
  }
  company.costCentres = company.costCentres.filter((item) => item.id !== centreId);
  return { ok: true, centre };
}

// Existing companies from older versions have no inventory masters yet.
function seedInventoryMasters(company) {
  if (!Array.isArray(company.units) || company.units.length === 0) {
    company.units = UNIT_SEED.map((unit) => ({ id: uid('unit'), ...unit }));
  }
  if (!Array.isArray(company.stockGroups) || company.stockGroups.length === 0) {
    company.stockGroups = [{ id: uid('sgrp'), name: 'Primary', primary: true }];
  }
  if (!Array.isArray(company.stockItems)) company.stockItems = [];
  if (!Array.isArray(company.godowns) || company.godowns.length === 0) {
    company.godowns = [{ id: uid('gdwn'), name: 'Main Location', primary: true }];
  }
  if (!Array.isArray(company.stockTransfers)) company.stockTransfers = [];
  if (!Array.isArray(company.stockCounts)) company.stockCounts = [];
  if (!Array.isArray(company.stockAdjustments)) company.stockAdjustments = [];
  if (!Array.isArray(company.interestPostings)) company.interestPostings = [];
  if (!Array.isArray(company.orders)) company.orders = [];
  if (!Array.isArray(company.boms)) company.boms = [];
  if (!Array.isArray(company.manufactures)) company.manufactures = [];
  company.counters = company.counters ?? {};
  company.counters.__stockTransfer = Math.max(
    Number(company.counters.__stockTransfer) || 0,
    ...company.stockTransfers.map((transfer) => Number(transfer.no) || 0),
  );
  company.counters.__manufacture = Math.max(
    Number(company.counters.__manufacture) || 0,
    ...company.manufactures.map((manufacture) => Number(manufacture.no) || 0),
  );
  company.counters.__stockCount = Math.max(
    Number(company.counters.__stockCount) || 0,
    ...company.stockCounts.map((count) => Number(count.no) || 0),
  );
  company.counters.__stockAdjustment = Math.max(
    Number(company.counters.__stockAdjustment) || 0,
    ...company.stockAdjustments.map((adjustment) => Number(adjustment.no) || 0),
  );
  for (const type of ['Sales', 'Purchase']) {
    const key = type === 'Sales' ? '__salesOrder' : '__purchaseOrder';
    company.counters[key] = Math.max(
      Number(company.counters[key]) || 0,
      ...company.orders
        .filter((order) => order.type === type && order.kind !== 'Quotation')
        .map((order) => Number(order.no) || 0),
    );
  }
  company.counters.__salesQuotation = Math.max(
    Number(company.counters.__salesQuotation) || 0,
    ...company.orders.filter((order) => order.kind === 'Quotation').map((order) => Number(order.no) || 0),
  );
  company.counters.__deliveryNote = Math.max(
    Number(company.counters.__deliveryNote) || 0,
    ...company.orders
      .filter((order) => ['DeliveryNote', 'GoodsReceipt'].includes(order.kind))
      .map((order) => Number(order.no) || 0),
  );
  for (const item of company.stockItems) item.batchTracking = Boolean(item.batchTracking);
  return company;
}

export function defaultGodownId(company) {
  return (company.godowns ?? []).find((godown) => godown.primary)?.id ?? company.godowns?.[0]?.id ?? '';
}

export function addGodown(company, input) {
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'Godown name is required.' };
  if (name.length > 80) return { ok: false, error: 'Godown name must be 80 characters or fewer.' };
  company.godowns = company.godowns ?? [];
  if (nameTaken(company.godowns, name)) {
    return { ok: false, error: `A godown named "${name}" already exists.` };
  }
  const godown = { id: uid('gdwn'), name, primary: false };
  company.godowns.push(godown);
  return { ok: true, godown };
}

export function godownUsage(company, godownId) {
  let count = 0;
  for (const voucher of company.vouchers ?? []) {
    for (const line of voucher.items ?? []) {
      if ((line.godownId || defaultGodownId(company)) === godownId) count += 1;
    }
  }
  for (const transfer of company.stockTransfers ?? []) {
    if (transfer.fromGodownId === godownId || transfer.toGodownId === godownId) count += transfer.items?.length ?? 0;
  }
  for (const manufacture of company.manufactures ?? []) {
    if (manufacture.componentGodownId === godownId || manufacture.outputGodownId === godownId) {
      count += 1;
    }
  }
  return count;
}

export function deleteGodown(company, godownId) {
  const godown = (company.godowns ?? []).find((item) => item.id === godownId);
  if (!godown) return { ok: false, error: 'Godown not found.' };
  if (godown.primary) return { ok: false, error: 'The primary godown cannot be deleted.' };
  const used = godownUsage(company, godownId);
  if (used > 0) {
    return { ok: false, error: `"${godown.name}" is used in ${used} stock line(s). Move or delete those entries first.` };
  }
  company.godowns = company.godowns.filter((item) => item.id !== godownId);
  return { ok: true, godown };
}

export function createCompany(name, fyStart) {
  const cleanName = String(name ?? '').trim();
  if (!cleanName) return { ok: false, error: 'Company name is required.' };
  if (cleanName.length > 80) return { ok: false, error: 'Company name must be 80 characters or fewer.' };
  if (!isValidIsoDate(fyStart)) return { ok: false, error: 'Enter a valid financial year start date.' };

  const company = {
    id: uid('co'),
    name: cleanName,
    fyStart,
    fyEnd: fyEndFor(fyStart),
    years: [{ id: uid('fy'), start: fyStart, end: fyEndFor(fyStart), closed: false }],
    createdAt: new Date().toISOString(),
    groups: [],
    ledgers: [],
    vouchers: [],
    pendingVouchers: [],
    approvalsRequired: false,
    approvalThreshold: 0,
    counters: {},
    bankReconciliations: {},
    costCategories: [],
    costCentres: [],
    budgets: [],
    currencies: [],
    gst: { enabled: false, gstin: '', legalName: '', stateCode: '', rates: seedGstRates() },
    tds: { enabled: false, tan: '', sections: seedTdsSections() },
    taxChallans: [],
    payroll: { enabled: false, payHeads: [], employees: [], runs: [] },
  };

  const byKey = new Map();
  for (const def of GROUP_DEFS) {
    const group = { id: uid('grp'), name: def.name, parentId: null, nature: def.nature, key: def.key };
    byKey.set(def.key, group);
    company.groups.push(group);
  }
  for (const def of GROUP_DEFS) {
    if (def.parent) byKey.get(def.key).parentId = byKey.get(def.parent).id;
  }

  const seed = [
    { name: 'Cash', key: 'cash', opening: 0, openingType: 'Dr' },
    { name: 'Bank', key: 'bank', opening: 0, openingType: 'Dr' },
    { name: 'Sales', key: 'sales', opening: 0, openingType: 'Cr' },
    { name: 'Purchases', key: 'purchase', opening: 0, openingType: 'Dr' },
    { name: 'Capital', key: 'capital', opening: 0, openingType: 'Cr' },
  ];
  for (const item of seed) {
    addLedger(company, {
      name: item.name,
      groupId: byKey.get(item.key).id,
      opening: item.opening,
      openingType: item.openingType,
    });
  }
  company.yearId = company.years[0].id;
  seedYears(company);
  seedInventoryMasters(company);
  seedCostMasters(company);
  normalizeGst(company);
  normalizeTds(company);
  normalizePayroll(company);

  return { ok: true, company };
}

export function addCompany(state, name, fyStart) {
  const result = createCompany(name, fyStart);
  if (!result.ok) return result;
  state.companies.push(result.company);
  state.activeCompanyId = result.company.id;
  return result;
}

export function addLedger(company, input) {
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'Ledger name is required.' };
  if (name.length > 80) return { ok: false, error: 'Ledger name must be 80 characters or fewer.' };
  if (findLedgerByName(company, name)) {
    return { ok: false, error: `A ledger named "${name}" already exists.` };
  }
  const group = groupById(company, input.groupId);
  if (!group) return { ok: false, error: 'Choose a group for the ledger.' };

  const opening = parseAmount(input.opening ?? 0);
  if (opening === null || opening < 0) {
    return { ok: false, error: 'Opening balance must be a number of zero or more.' };
  }
  const openingType = input.openingType === 'Cr' ? 'Cr' : 'Dr';
  const party = ledgerTaxDetails(input);
  if (party.error) return { ok: false, error: party.error };
  const credit = ledgerCreditLimit(input);
  if (credit.error) return { ok: false, error: credit.error };
  const interest = ledgerInterestRate(input);
  if (interest.error) return { ok: false, error: interest.error };

  const ledger = {
    id: uid('led'),
    name,
    groupId: group.id,
    opening: round2(opening),
    openingType,
    ...party.details,
    ...(credit.limit !== null ? { creditLimit: credit.limit } : {}),
    ...(interest.rate !== null ? { interestRate: interest.rate } : {}),
    createdAt: new Date().toISOString(),
  };
  company.ledgers.push(ledger);
  return { ok: true, ledger };
}

function ledgerCreditLimit(input = {}, existing = null) {
  if (input.creditLimit === undefined) {
    return { limit: existing?.creditLimit ?? null };
  }
  const raw = String(input.creditLimit ?? '').trim();
  if (!raw) return { limit: null };
  const value = parseAmount(raw);
  if (value === null || value < 0 || value > 999999999999) {
    return { error: 'Credit limit must be a number of zero or more.' };
  }
  return { limit: round2(value) };
}

/** Optional party GSTIN/state and PAN used for GST and TDS reporting. */
function ledgerInterestRate(input = {}, existing = null) {
  if (input.interestRate === undefined) return { rate: existing?.interestRate ?? null };
  const raw = String(input.interestRate ?? '').trim();
  if (!raw) return { rate: null };
  const value = parseAmount(raw);
  if (value === null || value < 0 || value > 100) {
    return { error: 'Interest rate must be a percentage from 0 to 100.' };
  }
  return { rate: round2(value) };
}

function ledgerTaxDetails(input = {}, existing = null) {
  const details = {};
  if (input.pan !== undefined) {
    const pan = String(input.pan ?? '').trim().toUpperCase();
    if (pan && !isValidPan(pan)) {
      return { error: 'PAN must be 10 characters: five letters, four digits and one letter.' };
    }
    if (pan) details.pan = pan;
  } else if (existing?.pan) {
    details.pan = existing.pan;
  }
  if (input.gstin !== undefined) {
    const gstin = String(input.gstin ?? '').trim().toUpperCase();
    if (gstin && !isValidGstin(gstin)) {
      return { error: 'GSTIN must be 15 characters: state code, PAN, entity code, Z and checksum.' };
    }
    if (gstin) details.gstin = gstin;
  } else if (existing?.gstin) {
    details.gstin = existing.gstin;
  }
  if (input.stateCode !== undefined) {
    const stateCode = String(input.stateCode ?? '').trim();
    if (stateCode && !GST_STATES.some(([code]) => code === stateCode)) {
      return { error: 'Choose a valid GST state for the party.' };
    }
    if (stateCode) details.stateCode = stateCode;
  } else if (existing?.stateCode) {
    details.stateCode = existing.stateCode;
  }
  if (input.address !== undefined) {
    const value = String(input.address ?? '').trim().slice(0, 200);
    if (value) details.address = value;
  } else if (existing?.address) {
    details.address = existing.address;
  }
  if (input.city !== undefined) {
    const value = String(input.city ?? '').trim().slice(0, 80);
    if (value) details.city = value;
  } else if (existing?.city) {
    details.city = existing.city;
  }
  if (input.pin !== undefined) {
    const value = String(input.pin ?? '').trim();
    if (value && !/^[0-9]{6}$/.test(value)) {
      return { error: 'Party PIN code must be 6 digits.' };
    }
    if (value) details.pin = value;
  } else if (existing?.pin) {
    details.pin = existing.pin;
  }
  if (details.gstin && !details.stateCode) details.stateCode = details.gstin.slice(0, 2);
  return { details };
}

export function signedOpening(ledger) {
  return ledger.openingType === 'Cr' ? -round2(ledger.opening) : round2(ledger.opening);
}

export function validateVoucherInput(company, type, input, options = {}) {
  if (!VOUCHER_TYPES[type]) return { ok: false, error: 'Unknown voucher type.' };

  const date = String(input.date ?? '');
  if (!isValidIsoDate(date)) return { ok: false, error: 'Enter a valid voucher date.' };
  seedYears(company);
  const year = yearForDate(company, date);
  if (!year) {
    return {
      ok: false,
      error: `Date must fall inside a financial year of this company (${dateLabel(booksStart(company))} to ${dateLabel(company.years[company.years.length - 1].end)}).`,
    };
  }
  if (year.closed) {
    return {
      ok: false,
      error: `The financial year ${dateLabel(year.start)} to ${dateLabel(year.end)} is closed. Reopen it or use a date in an open year.`,
    };
  }

  const currencyCode = String(input.currencyCode || BASE_CURRENCY_CODE).trim().toUpperCase();
  const currency = currencyByCode(company, currencyCode);
  if (!currency) return { ok: false, error: `Currency ${currencyCode} is not set up. Add it in Masters first.` };
  const foreign = !currency.base;
  let exchangeRate = 1;
  if (foreign) {
    const rawRate = input.exchangeRate === undefined || input.exchangeRate === ''
      ? rateForCurrency(company, currencyCode, date)
      : parseAmount(input.exchangeRate);
    if (rawRate === null || rawRate <= 0) {
      return { ok: false, error: `Enter a valid ${currencyCode} exchange rate for ${dateLabel(date)}.` };
    }
    exchangeRate = rawRate;
  }

  const rawLines = Array.isArray(input.lines) ? input.lines : [];
  const lines = [];
  for (const [index, line] of rawLines.entries()) {
    if (!line.ledgerId) return { ok: false, error: `Line ${index + 1}: choose a ledger.` };
    if (!company.ledgers.some((ledger) => ledger.id === line.ledgerId)) {
      return { ok: false, error: `Line ${index + 1}: that ledger no longer exists.` };
    }
    const rawAmount = parseAmount(line.amount);
    if (rawAmount === null || rawAmount <= 0) {
      return { ok: false, error: `Line ${index + 1}: enter an amount greater than zero.` };
    }
    const amount = foreign ? round2(rawAmount * exchangeRate) : rawAmount;
    if (amount <= 0) return { ok: false, error: `Line ${index + 1}: the converted amount is zero.` };
    const side = line.side === 'Cr' ? 'Cr' : 'Dr';
    const parsed = { ledgerId: line.ledgerId, side, amount };
    if (foreign) parsed.currencyAmount = rawAmount;
    const costCentreId = String(line.costCentreId ?? '').trim();
    if (costCentreId) {
      if (!(company.costCentres ?? []).some((centre) => centre.id === costCentreId)) {
        return { ok: false, error: `Line ${index + 1}: that cost centre no longer exists.` };
      }
      parsed.costCentreId = costCentreId;
    }

    const rawAllocations = Array.isArray(line.allocations) ? line.allocations : [];
    if (rawAllocations.length) {
      if (foreign) {
        return { ok: false, error: 'Bill-wise settlement is not available on foreign-currency vouchers yet. Use a base-currency receipt or payment.' };
      }
      if (!isPartyLedger(company, line.ledgerId)) {
        return { ok: false, error: `Line ${index + 1}: bill allocations are only for debtors and creditors.` };
      }
      const allocations = [];
      let allocated = 0;
      for (const [allocationIndex, allocation] of rawAllocations.entries()) {
        const bill = company.vouchers.find((voucher) => voucher.id === allocation.voucherId);
        if (!bill || (bill.type !== 'Sales' && bill.type !== 'Purchase')) {
          return { ok: false, error: `Line ${index + 1}: choose an open bill to settle.` };
        }
        if (options.excludeVoucherId && bill.id === options.excludeVoucherId) {
          return { ok: false, error: `Line ${index + 1}: a voucher cannot settle its own bill.` };
        }
        if (!(bill.lines ?? []).some((billLine) => billLine.ledgerId === line.ledgerId)) {
          return { ok: false, error: `Line ${index + 1}: that bill belongs to a different party.` };
        }
        if (bill.date > date) {
          return { ok: false, error: `Line ${index + 1}: bill ${billLabel(bill)} is dated after this voucher.` };
        }
        const allocationAmount = parseAmount(allocation.amount);
        if (allocationAmount === null || allocationAmount <= 0) {
          return { ok: false, error: `Line ${index + 1}: enter an amount to settle on bill ${billLabel(bill)}.` };
        }
        allocated = round2(allocated + allocationAmount);
        allocations.push({ voucherId: bill.id, amount: allocationAmount });
        if (allocated > round2(amount + 0.005)) {
          return { ok: false, error: `Line ${index + 1}: bill allocations exceed the line amount.` };
        }
        if (allocationIndex >= 0) {
          const open = partyOpenBills(company, line.ledgerId, { asOn: date, excludeVoucherId: options.excludeVoucherId }).find(
            (entry) => entry.voucherId === bill.id,
          );
          const alreadyInThisVoucher = allocations
            .filter((entry) => entry.voucherId === bill.id)
            .reduce((sum, entry) => sum + entry.amount, 0);
          if (!open || open.remaining + 0.005 < alreadyInThisVoucher) {
            return {
              ok: false,
              error: `Line ${index + 1}: bill ${billLabel(bill)} has only ${fmtMoney(open?.remaining ?? 0)} left to settle.`,
            };
          }
        }
      }
      if (allocations.length) parsed.allocations = allocations;
    }
    lines.push(parsed);
  }

  let gst = null;
  const gstInput = input.gst && typeof input.gst === 'object' ? input.gst : null;
  if (gstInput && String(gstInput.rateId ?? '').trim()) {
    if (!company.gst?.enabled) {
      return { ok: false, error: 'GST is not enabled. Save GST settings before recording tax on invoices.' };
    }
    if (!GST_VOUCHER_TYPES.includes(type)) {
      return { ok: false, error: 'GST applies only to sales, purchase, credit note and debit note vouchers.' };
    }
    if (foreign) {
      return { ok: false, error: 'GST is not available on foreign-currency vouchers yet.' };
    }
    const homeState = String(company.gst.stateCode ?? '');
    if (!GST_STATES.some(([code]) => code === homeState)) {
      return { ok: false, error: 'Save GST settings with a home state before applying GST to vouchers.' };
    }
    const rateEntry = (company.gst.rates ?? []).find((entry) => entry.id === gstInput.rateId);
    if (!rateEntry) return { ok: false, error: 'That GST rate is no longer in the rate master.' };

    const taxLedgers = gstTaxLedgers(company);
    const taxLedgerIds = new Set(Object.values(taxLedgers).map((ledger) => ledger.id));
    const goodsSide = GST_TAXABLE_SIDE[type];
    const balancingSide = goodsSide === 'Dr' ? 'Cr' : 'Dr';

    // Tax lines are always derived from the rate, so any entered tax-role lines are replaced.
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (taxLedgerIds.has(lines[index].ledgerId)) lines.splice(index, 1);
    }
    const balancing = lines.filter((line) => line.side === balancingSide);
    if (balancing.length !== 1) {
      return {
        ok: false,
        error: `A GST invoice needs exactly one ${balancingSide === 'Dr' ? 'debit' : 'credit'} line for the party, cash or bank. Merge split payments into one line.`,
      };
    }
    const taxable = round2(
      lines.filter((line) => line.side === goodsSide).reduce((sum, line) => sum + line.amount, 0),
    );
    if (taxable <= 0) {
      return {
        ok: false,
        error: `Enter the taxable value on the ${goodsSide === 'Dr' ? 'debit' : 'credit'} side before applying GST.`,
      };
    }

    const partyLedger = company.ledgers.find((ledger) => ledger.id === balancing[0].ledgerId) ?? null;
    const placeOfSupply = String(gstInput.placeOfSupply || partyLedger?.stateCode || homeState).trim();
    if (!GST_STATES.some(([code]) => code === placeOfSupply)) {
      return { ok: false, error: 'Choose a valid place of supply state for this invoice.' };
    }
    const partyGstin =
      String(gstInput.partyGstin ?? '').trim().toUpperCase() || partyLedger?.gstin || '';
    if (partyGstin && !isValidGstin(partyGstin)) {
      return { ok: false, error: 'Party GSTIN must be 15 characters, or leave it blank for a B2C invoice.' };
    }

    const supplyType = placeOfSupply === homeState ? 'Intra' : 'Inter';
    const rateValue = round2(rateEntry.rate);
    const cessRate = round2(rateEntry.cess ?? 0);
    const taxTotal = round2((taxable * rateValue) / 100);
    const half = round2(taxTotal / 2);
    const cgst = supplyType === 'Intra' ? half : 0;
    const sgst = supplyType === 'Intra' ? round2(taxTotal - half) : 0;
    const igst = supplyType === 'Inter' ? taxTotal : 0;
    const cess = round2((taxable * cessRate) / 100);
    const gross = round2(taxable + cgst + sgst + igst + cess);

    const components = [
      ['cgst', cgst],
      ['sgst', sgst],
      ['igst', igst],
      ['cess', cess],
    ].filter(([, amount]) => amount > 0);
    const missing = components.filter(([role]) => !taxLedgers[role]).map(([role]) => GST_ROLES[role]);
    if (missing.length) {
      return {
        ok: false,
        error: `GST tax ledgers are missing (${missing.join(', ')}). Save GST settings again to create them.`,
      };
    }

    balancing[0].amount = gross;
    for (const [role, amount] of components) {
      lines.push({ ledgerId: taxLedgers[role].id, side: goodsSide, amount });
    }
    const allocated = round2(
      (balancing[0].allocations ?? []).reduce((sum, allocation) => sum + allocation.amount, 0),
    );
    if (allocated > round2(gross + 0.005)) {
      return { ok: false, error: 'Bill allocations exceed the tax-inclusive invoice total.' };
    }

    gst = {
      rateId: rateEntry.id,
      rate: rateValue,
      cessRate,
      supplyType,
      placeOfSupply,
      partyGstin,
      partyLedgerId: balancing[0].ledgerId,
      reverseCharge: Boolean(gstInput.reverseCharge),
      taxable,
      cgst,
      sgst,
      igst,
      cess,
    };
  }

  let tds = null;
  const tdsInput = input.tds && typeof input.tds === 'object' ? input.tds : null;
  if (tdsInput && String(tdsInput.sectionId ?? '').trim()) {
    if (!company.tds?.enabled) {
      return { ok: false, error: 'TDS/TCS is not enabled. Save TDS/TCS settings before deducting tax.' };
    }
    if (!['Purchase', 'Sales'].includes(type)) {
      return { ok: false, error: 'TDS is deducted on purchase vouchers and TCS is collected on sales vouchers.' };
    }
    if (gst) {
      return { ok: false, error: 'A voucher cannot carry both GST and TDS/TCS yet. Use separate vouchers or a journal.' };
    }
    if (foreign) {
      return { ok: false, error: 'TDS/TCS is not available on foreign-currency vouchers yet.' };
    }
    const kind = type === 'Purchase' ? 'TDS' : 'TCS';
    const section = (company.tds.sections ?? []).find((entry) => entry.id === tdsInput.sectionId);
    if (!section) return { ok: false, error: 'That TDS/TCS section no longer exists.' };
    if (section.kind !== kind) {
      return {
        ok: false,
        error: `${section.code} is a ${section.kind} section. Use a ${kind} section on a ${type.toLowerCase()} voucher.`,
      };
    }

    // The payable line is derived from the section, so replace any stored one.
    const withholdingLedgerIds = new Set(
      Object.values(withholdingTaxLedgers(company)).map((ledger) => ledger.id),
    );
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (withholdingLedgerIds.has(lines[index].ledgerId)) lines.splice(index, 1);
    }

    const goodsSide = kind === 'TDS' ? 'Dr' : 'Cr';
    const balancingSide = goodsSide === 'Dr' ? 'Cr' : 'Dr';
    const balancing = lines.filter((line) => line.side === balancingSide);
    if (balancing.length !== 1) {
      return {
        ok: false,
        error: `A ${kind} voucher needs exactly one ${balancingSide === 'Dr' ? 'debit' : 'credit'} line for the party, cash or bank. Merge split payments into one line.`,
      };
    }
    const base = round2(
      lines.filter((line) => line.side === goodsSide).reduce((sum, line) => sum + line.amount, 0),
    );
    if (base <= 0) {
      return { ok: false, error: `Enter the amount on the ${goodsSide === 'Dr' ? 'debit' : 'credit'} side before applying ${kind}.` };
    }
    const amount = round2((base * section.rate) / 100);
    if (amount <= 0) {
      return { ok: false, error: `Section ${section.code} has a 0% rate, so there is nothing to deduct.` };
    }
    if (base - amount <= 0) {
      return { ok: false, error: `The ${kind} deduction covers the whole party amount. Reduce the rate or enter a larger base.` };
    }

    const ledger = withholdingTaxLedgers(company)[kind];
    if (!ledger) {
      return {
        ok: false,
        error: `${WITHHOLDING_LEDGERS[kind]} ledger is missing. Save TDS/TCS settings again to create it.`,
      };
    }
    const partyLedger = company.ledgers.find((entry) => entry.id === balancing[0].ledgerId) ?? null;
    const pan = String(tdsInput.pan ?? '').trim().toUpperCase() || partyLedger?.pan || '';
    if (pan && !isValidPan(pan)) {
      return { ok: false, error: 'PAN must be 10 characters: five letters, four digits and one letter.' };
    }

    balancing[0].amount = kind === 'TDS' ? round2(base - amount) : round2(base + amount);
    lines.push({ ledgerId: ledger.id, side: 'Cr', amount });
    const allocated = round2(
      (balancing[0].allocations ?? []).reduce((sum, allocation) => sum + allocation.amount, 0),
    );
    if (allocated > round2(balancing[0].amount + 0.005)) {
      return { ok: false, error: 'Bill allocations exceed the party amount after tax deduction.' };
    }

    tds = {
      kind,
      sectionId: section.id,
      code: section.code,
      label: section.label,
      rate: section.rate,
      base,
      amount,
      partyLedgerId: balancing[0].ledgerId,
      ...(pan ? { pan } : {}),
    };
  }

  if (lines.length < 2) return { ok: false, error: 'A voucher needs at least two lines.' };

  const debitTotal = round2(lines.filter((line) => line.side === 'Dr').reduce((sum, line) => sum + line.amount, 0));
  const creditTotal = round2(lines.filter((line) => line.side === 'Cr').reduce((sum, line) => sum + line.amount, 0));
  if (debitTotal === 0 || creditTotal === 0) {
    return { ok: false, error: 'A voucher needs at least one debit line and one credit line.' };
  }
  if (Math.abs(debitTotal - creditTotal) >= 0.01) {
    return { ok: false, error: `Voucher is not balanced: debit ${fmtMoney(debitTotal)} vs credit ${fmtMoney(creditTotal)}.` };
  }

  let instrument = null;
  const rawInstrument = input.instrument && typeof input.instrument === 'object' ? input.instrument : {};
  const instrumentTouched = Boolean(
    rawInstrument.kind || String(rawInstrument.number ?? '').trim() || rawInstrument.date,
  );
  if (instrumentTouched) {
    if (!['Payment', 'Receipt', 'Contra'].includes(type)) {
      return { ok: false, error: 'Cheque/DD details are only available on payment, receipt and contra vouchers.' };
    }
    if (!['Cheque', 'DD'].includes(rawInstrument.kind)) {
      return { ok: false, error: 'Choose Cheque or DD as the instrument type.' };
    }
    const number = String(rawInstrument.number ?? '').trim();
    if (!number) return { ok: false, error: 'Enter the cheque or DD number.' };
    if (number.length > 30) return { ok: false, error: 'Cheque/DD number must be 30 characters or fewer.' };
    const instrumentDate = String(rawInstrument.date || date);
    if (!isValidIsoDate(instrumentDate)) return { ok: false, error: 'Enter a valid cheque/DD date.' };
    const bankLineIds = [...new Set(lines.filter((line) => isBankLedger(company, line.ledgerId)).map((line) => line.ledgerId))];
    if (bankLineIds.length === 0) {
      return { ok: false, error: 'Add a bank ledger line before recording cheque/DD details.' };
    }
    const bankLedgerId = rawInstrument.bankLedgerId || bankLineIds[0];
    if (!bankLineIds.includes(bankLedgerId)) {
      return { ok: false, error: 'The cheque/DD bank must be one of the bank ledgers on this voucher.' };
    }
    instrument = { kind: rawInstrument.kind, number, date: instrumentDate, bankLedgerId };
  }

  const rawItems = Array.isArray(input.items) ? input.items : [];
  const items = [];
  if (rawItems.length) {
    if (foreign) {
      return { ok: false, error: 'Stock items are not available on foreign-currency vouchers yet. Use a base-currency invoice for stock.' };
    }
    if (!INVENTORY_TYPES.includes(type)) {
      return { ok: false, error: 'Only sales, purchase, credit note and debit note vouchers can carry stock items.' };
    }
    for (const [index, line] of rawItems.entries()) {
      const item = (company.stockItems ?? []).find((entry) => entry.id === line.stockItemId);
      if (!item) return { ok: false, error: `Item line ${index + 1}: choose a stock item.` };
      const qty = parseQty(line.qty);
      if (qty === null || qty <= 0) {
        return { ok: false, error: `Item line ${index + 1}: enter a quantity greater than zero.` };
      }
      const rate = parseAmount(line.rate);
      if (rate === null || rate < 0) {
        return { ok: false, error: `Item line ${index + 1}: enter a rate of zero or more.` };
      }
      const godownId = String(line.godownId ?? '').trim() || defaultGodownId(company);
      if (!(company.godowns ?? []).some((godown) => godown.id === godownId)) {
        return { ok: false, error: `Item line ${index + 1}: choose a godown.` };
      }
      const batchNo = String(line.batchNo ?? '').trim().slice(0, 30);
      if (item.batchTracking && !batchNo) {
        return { ok: false, error: `Item line ${index + 1}: batch is required for "${item.name}".` };
      }
      const expiryDate = String(line.expiryDate ?? '').trim();
      if (expiryDate && !isValidIsoDate(expiryDate)) {
        return { ok: false, error: `Item line ${index + 1}: enter a valid expiry date.` };
      }
      items.push({
        stockItemId: item.id,
        qty,
        rate,
        amount: round2(qty * rate),
        godownId,
        ...(batchNo ? { batchNo } : {}),
        ...(expiryDate ? { expiryDate } : {}),
      });
    }
    const itemTotal = round2(items.reduce((sum, line) => sum + line.amount, 0));
    const taxableBase = gst ? gst.taxable : tds ? tds.base : debitTotal;
    if (Math.abs(itemTotal - taxableBase) >= 0.01) {
      return {
        ok: false,
        error: `Stock items total ${fmtMoney(itemTotal)} but the ${gst ? 'GST taxable value' : 'voucher total'} is ${fmtMoney(taxableBase)}. They must match.`,
      };
    }

    if (type === 'Sales' || type === 'DebitNote') {
      const needed = new Map();
      for (const line of items) {
        const key = `${line.stockItemId}:${line.godownId}:${line.batchNo || ''}`;
        const entry = needed.get(key) ?? {
          itemId: line.stockItemId,
          godownId: line.godownId,
          batchNo: line.batchNo || null,
          qty: 0,
        };
        entry.qty = round3(entry.qty + line.qty);
        needed.set(key, entry);
      }
      for (const entry of needed.values()) {
        const stockItem = company.stockItems.find((item) => item.id === entry.itemId);
        const available = stockOnHand(company, entry.itemId, date, {
          excludeVoucherId: options.excludeVoucherId,
          godownId: entry.godownId,
          batchNo: stockItem?.batchTracking ? entry.batchNo ?? '' : null,
        });
        if (entry.qty > available + 0.0005) {
          const unit = (company.units ?? []).find((item) => item.id === stockItem?.unitId)?.symbol ?? '';
          const godown = (company.godowns ?? []).find((item) => item.id === entry.godownId);
          const batchLabel = entry.batchNo ? ` batch ${entry.batchNo}` : '';
          return {
            ok: false,
            error: `Only ${Number(available.toFixed(3))} ${unit} of "${stockItem?.name ?? 'item'}"${batchLabel} in stock at ${godown?.name ?? 'this godown'} on ${dateLabel(date)}; this voucher takes ${Number(entry.qty.toFixed(3))}. Record a purchase or transfer first.`,
          };
        }
      }
    }
  }

  let bill = null;
  if (type === 'Sales' || type === 'Purchase') {
    const ref = String(input.bill?.ref ?? '').trim().slice(0, 40);
    const dueDate = String(input.bill?.dueDate ?? '').trim();
    if (dueDate) {
      if (!isValidIsoDate(dueDate)) return { ok: false, error: 'Enter a valid bill due date.' };
      if (dueDate < date) return { ok: false, error: 'The bill due date cannot be before the voucher date.' };
    }
    if (ref || dueDate) bill = { ref, dueDate: dueDate || null };
  }

  return {
    ok: true,
    date,
    lines,
    items,
    bill,
    instrument,
    gst,
    tds,
    total: debitTotal,
    currencyCode: foreign ? currencyCode : undefined,
    exchangeRate: foreign ? exchangeRate : undefined,
    currencyTotal: foreign ? round2(lines.filter((line) => line.side === 'Dr').reduce((sum, line) => sum + line.currencyAmount, 0)) : undefined,
    narration: String(input.narration ?? '').trim().slice(0, 400),
  };
}

function orderLinkFor(company, type, orderId) {
  if (!orderId) return { ok: true, order: null };
  const order = (company.orders ?? []).find((entry) => entry.id === orderId);
  if (!order) return { ok: false, error: 'The linked order no longer exists.' };
  const label = `${order.type === 'Sales' ? 'SO' : 'PO'}-${order.no}`;
  if (order.kind) {
    return { ok: false, error: 'A quotation or delivery document must become an order before creating a voucher.' };
  }
  if (order.type !== type) {
    return {
      ok: false,
      error: `${label} is a ${order.type.toLowerCase()} order and cannot be linked to a ${type.toLowerCase()} voucher.`,
    };
  }
  if (order.status !== 'Open') {
    return { ok: false, error: `${label} is ${order.status.toLowerCase()}; only an open order can be linked.` };
  }
  return { ok: true, order };
}

const RECURRING_FREQUENCIES = new Set(['Weekly', 'Monthly', 'Quarterly', 'Yearly']);

export function addRecurringVoucher(company, input = {}) {
  const voucher = (company.vouchers ?? []).find((entry) => entry.id === input.voucherId);
  if (!voucher) return { ok: false, error: 'Choose a posted voucher to use as the template.' };
  const name = String(input.name ?? '').trim().slice(0, 100);
  if (!name) return { ok: false, error: 'Enter a template name.' };
  if (!RECURRING_FREQUENCIES.has(input.frequency)) {
    return { ok: false, error: 'Choose a valid repeat frequency.' };
  }
  const nextDate = String(input.nextDate ?? '');
  if (!isValidIsoDate(nextDate)) return { ok: false, error: 'Enter a valid next date.' };
  company.recurringVouchers = Array.isArray(company.recurringVouchers) ? company.recurringVouchers : [];
  if (company.recurringVouchers.length >= 100) {
    return { ok: false, error: 'Keep at most 100 recurring voucher templates.' };
  }
  const copy = JSON.parse(JSON.stringify(voucher));
  const template = {
    id: uid('rtpl'),
    name,
    type: voucher.type,
    frequency: input.frequency,
    nextDate,
    narration: copy.narration ?? '',
    lines: copy.lines ?? [],
    total: copy.total ?? 0,
    ...(copy.items ? { items: copy.items } : {}),
    ...(copy.bill ? { bill: copy.bill } : {}),
    ...(copy.instrument ? { instrument: { ...copy.instrument, status: undefined } } : {}),
    ...(copy.gst ? { gst: copy.gst } : {}),
    ...(copy.tds ? { tds: copy.tds } : {}),
    ...(copy.currencyCode ? { currencyCode: copy.currencyCode, exchangeRate: copy.exchangeRate, currencyTotal: copy.currencyTotal } : {}),
    createdAt: new Date().toISOString(),
  };
  delete template.instrument?.status;
  company.recurringVouchers.push(template);
  return { ok: true, template };
}

function advanceRecurringDate(date, frequency) {
  if (frequency === 'Weekly') {
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 7);
    return next.toISOString().slice(0, 10);
  }
  const months = frequency === 'Quarterly' ? 3 : frequency === 'Yearly' ? 12 : 1;
  const current = new Date(`${date}T00:00:00Z`);
  const day = current.getUTCDate();
  current.setUTCDate(1);
  current.setUTCMonth(current.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate();
  current.setUTCDate(Math.min(day, lastDay));
  return current.toISOString().slice(0, 10);
}

export function postRecurringVoucher(company, templateId) {
  const template = (company.recurringVouchers ?? []).find((entry) => entry.id === templateId);
  if (!template) return { ok: false, error: 'Recurring template not found.' };
  if (approvalRequiredForAmount(company, template.total)) {
    return { ok: false, error: 'This template needs manual approval before posting.' };
  }
  const copy = JSON.parse(JSON.stringify(template));
  const input = {
    type: copy.type,
    date: copy.nextDate,
    narration: copy.narration,
    lines: copy.lines,
    ...(copy.items ? { items: copy.items } : {}),
    ...(copy.bill ? { bill: copy.bill } : {}),
    ...(copy.instrument ? { instrument: copy.instrument } : {}),
    ...(copy.gst ? { gst: copy.gst } : {}),
    ...(copy.tds ? { tds: copy.tds } : {}),
    ...(copy.currencyCode
      ? {
          currencyCode: copy.currencyCode,
          exchangeRate: copy.exchangeRate,
          currencyTotal: copy.currencyTotal,
        }
      : {}),
  };
  const posted = addVoucher(company, input);
  if (!posted.ok) return posted;
  const postedDate = template.nextDate;
  template.nextDate = advanceRecurringDate(postedDate, template.frequency);
  template.lastPostedDate = postedDate;
  template.lastVoucherId = posted.voucher.id;
  return { ok: true, template, voucher: posted.voucher };
}

export function postDueRecurringVouchers(company, asOn = todayIso()) {
  const due = (company.recurringVouchers ?? [])
    .filter((template) => template.nextDate <= asOn)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.name.localeCompare(b.name));
  let posted = 0;
  let blocked = 0;
  const errors = [];
  for (const template of due) {
    const result = postRecurringVoucher(company, template.id);
    if (result.ok) posted += 1;
    else if (/manual approval/i.test(result.error)) blocked += 1;
    else errors.push(`${template.name}: ${result.error}`);
  }
  return { ok: errors.length === 0, posted, blocked, errors, due: due.length };
}

export function deleteRecurringVoucher(company, templateId) {
  const template = (company.recurringVouchers ?? []).find((entry) => entry.id === templateId);
  if (!template) return { ok: false, error: 'Recurring template not found.' };
  company.recurringVouchers = company.recurringVouchers.filter((entry) => entry.id !== templateId);
  return { ok: true, template };
}

export function normalizeRecurringVouchers(company) {
  if (!Array.isArray(company.recurringVouchers)) {
    company.recurringVouchers = [];
    return company;
  }
  const seen = new Set();
  company.recurringVouchers = company.recurringVouchers
    .filter((template) => {
      if (!template || !template.id || seen.has(template.id)) return false;
      if (!VOUCHER_TYPES[template.type] || !RECURRING_FREQUENCIES.has(template.frequency)) return false;
      if (!String(template.name ?? '').trim() || !isValidIsoDate(template.nextDate)) return false;
      if (!Array.isArray(template.lines) || !template.lines.length) return false;
      seen.add(template.id);
      return true;
    })
    .slice(-100);
  return company;
}

export function setNextVoucherNumber(company, type, nextValue) {
  if (!VOUCHER_TYPES[type]) return { ok: false, error: 'Choose a valid voucher type.' };
  const next = Number(nextValue);
  if (!Number.isInteger(next) || next < 1 || next > 999999) {
    return { ok: false, error: 'Next number must be a whole number from 1 to 999,999.' };
  }
  const last = Math.max(
    0,
    ...(company.vouchers ?? []).filter((voucher) => voucher.type === type).map((voucher) => Number(voucher.no) || 0),
    ...(company.pendingVouchers ?? []).filter((voucher) => voucher.type === type).map((voucher) => Number(voucher.no) || 0),
  );
  if (next <= last) {
    return { ok: false, error: `The next ${VOUCHER_TYPES[type].label ?? type} number must be above the last used number, ${last}.` };
  }
  company.counters = company.counters ?? {};
  company.counters[type] = next - 1;
  return { ok: true, next };
}

function ensureNamedLedger(company, name, groupKey) {
  const existing = findLedgerByName(company, name);
  if (existing) return existing;
  const group = company.groups.find((entry) => entry.key === groupKey);
  if (!group) return null;
  const result = addLedger(company, { name, groupId: group.id, opening: 0 });
  return result.ok ? result.ledger : null;
}

/**
 * Post a forex revaluation journal from report rows. Positive differences
 * increase a ledger's debit balance; the balancing side is a gain or loss.
 */
export function postForexRevaluation(company, input = {}) {
  const date = String(input.date ?? '');
  if (!isValidIsoDate(date)) return { ok: false, error: 'Enter a valid revaluation date.' };
  seedYears(company);
  const year = yearForDate(company, date);
  if (!year) return { ok: false, error: 'The revaluation date must fall inside a financial year.' };
  if (year.closed) return { ok: false, error: 'The financial year is closed. Reopen it before posting revaluation.' };
  if ((company.vouchers ?? []).some((voucher) => voucher.fxRevaluationDate === date)) {
    return { ok: false, error: 'A forex revaluation is already posted for this date.' };
  }
  const rows = (Array.isArray(input.rows) ? input.rows : [])
    .map((row) => ({
      ledgerId: String(row.ledgerId ?? ''),
      currencyCode: String(row.currencyCode ?? ''),
      difference: round2(Number(row.difference) || 0),
    }))
    .filter((row) => row.ledgerId && Math.abs(row.difference) >= 0.01);
  if (!rows.length) return { ok: false, error: 'There are no foreign-exchange differences to post.' };
  const ledgers = new Map((company.ledgers ?? []).map((ledger) => [ledger.id, ledger]));
  if (rows.some((row) => !ledgers.has(row.ledgerId))) {
    return { ok: false, error: 'A revaluation ledger no longer exists. Refresh the report.' };
  }
  const gainLedger = ensureNamedLedger(company, 'Forex Gain', 'indirectIncomes');
  const lossLedger = ensureNamedLedger(company, 'Forex Loss', 'indirectExpenses');
  if (!gainLedger || !lossLedger) return { ok: false, error: 'Forex gain/loss ledger groups are missing.' };
  const lines = [];
  let gain = 0;
  let loss = 0;
  for (const row of rows) {
    lines.push({
      ledgerId: row.ledgerId,
      side: row.difference > 0 ? 'Dr' : 'Cr',
      amount: Math.abs(row.difference),
    });
    if (row.difference > 0) gain = round2(gain + row.difference);
    else loss = round2(loss - row.difference);
  }
  if (gain) lines.push({ ledgerId: gainLedger.id, side: 'Cr', amount: gain });
  if (loss) lines.push({ ledgerId: lossLedger.id, side: 'Dr', amount: loss });
  const posted = addVoucher(company, {
    type: 'Journal',
    date,
    narration: `Forex revaluation as on ${date}`,
    lines,
  });
  if (!posted.ok) return posted;
  posted.voucher.fxRevaluationDate = date;
  posted.voucher.fxRevaluationRows = rows.map((row) => ({ ...row }));
  return { ok: true, voucher: posted.voucher, gain, loss };
}

export function postOverdueInterest(company, input = {}) {
  const date = String(input.date ?? '');
  if (!isValidIsoDate(date)) return { ok: false, error: 'Enter a valid interest posting date.' };
  const side = input.side === 'payable' ? 'payable' : 'receivable';
  seedYears(company);
  const year = yearForDate(company, date);
  if (!year) return { ok: false, error: 'The interest date must fall inside a financial year.' };
  if (year.closed) return { ok: false, error: 'The financial year is closed. Reopen it before posting interest.' };
  if ((company.vouchers ?? []).some((voucher) => voucher.interestPostingDate === date && voucher.interestPostingSide === side)) {
    return { ok: false, error: `Overdue interest is already posted for this date (${side}).` };
  }
  const rows = (Array.isArray(input.rows) ? input.rows : [])
    .map((row) => ({
      partyId: String(row.partyId ?? ''),
      bill: String(row.bill ?? ''),
      amount: round2(Number(row.interest) || 0),
    }))
    .filter((row) => row.partyId && row.amount > 0);
  if (!rows.length) return { ok: false, error: 'There is no overdue interest to post.' };
  const ledgers = new Map((company.ledgers ?? []).map((ledger) => [ledger.id, ledger]));
  if (rows.some((row) => !ledgers.has(row.partyId))) {
    return { ok: false, error: 'An interest party no longer exists. Refresh the report.' };
  }
  const income = side === 'receivable' ? ensureNamedLedger(company, 'Interest Income', 'indirectIncomes') : null;
  const expense = side === 'payable' ? ensureNamedLedger(company, 'Interest Expense', 'indirectExpenses') : null;
  if ((side === 'receivable' && !income) || (side === 'payable' && !expense)) {
    return { ok: false, error: 'Interest income/expense ledger groups are missing.' };
  }
  const byParty = new Map();
  for (const row of rows) byParty.set(row.partyId, round2((byParty.get(row.partyId) ?? 0) + row.amount));
  const total = round2(rows.reduce((sum, row) => sum + row.amount, 0));
  const lines = [];
  for (const [partyId, amount] of byParty) {
    lines.push({ ledgerId: partyId, side: side === 'receivable' ? 'Dr' : 'Cr', amount });
  }
  lines.push({
    ledgerId: side === 'receivable' ? income.id : expense.id,
    side: side === 'receivable' ? 'Cr' : 'Dr',
    amount: total,
  });
  const posted = addVoucher(company, {
    type: 'Journal',
    date,
    narration: `Overdue interest ${side === 'receivable' ? 'receivable' : 'payable'} as on ${date}`,
    lines,
  });
  if (!posted.ok) return posted;
  company.interestPostings = company.interestPostings ?? [];
  const postingRows = rows.map((row) => ({
    ...row,
    side,
    date,
    voucherId: posted.voucher.id,
  }));
  company.interestPostings.push(...postingRows);
  posted.voucher.interestPostingDate = date;
  posted.voucher.interestPostingSide = side;
  posted.voucher.interestPostingRows = postingRows.map((row) => ({ ...row }));
  return { ok: true, voucher: posted.voucher, total, rows: postingRows };
}

export function addVoucher(company, input) {
  const type = input.type;
  const checked = validateVoucherInput(company, type, input);
  if (!checked.ok) return checked;
  const orderLink = orderLinkFor(company, type, input.orderId);
  if (!orderLink.ok) return orderLink;

  company.counters = company.counters ?? {};
  const pending = Boolean(input.pending);
  const sequence = pending ? null : (company.counters[type] ?? 0) + 1;
  if (!pending) company.counters[type] = sequence;

  const voucher = {
    id: uid('vch'),
    type,
    no: sequence,
    date: checked.date,
    narration: checked.narration,
    lines: checked.lines,
    total: checked.total,
    createdAt: new Date().toISOString(),
  };
  if (checked.currencyCode) {
    voucher.currencyCode = checked.currencyCode;
    voucher.exchangeRate = checked.exchangeRate;
    voucher.currencyTotal = checked.currencyTotal;
  }
  if (checked.items.length) voucher.items = checked.items;
  if (checked.bill) voucher.bill = checked.bill;
  if (checked.instrument) voucher.instrument = checked.instrument;
  if (checked.gst) voucher.gst = checked.gst;
  if (checked.tds) voucher.tds = checked.tds;
  if (orderLink.order) voucher.orderId = orderLink.order.id;
  if (pending) {
    const submittedBy = input.submittedBy && typeof input.submittedBy === 'object'
      ? {
          id: String(input.submittedBy.id ?? ''),
          username: String(input.submittedBy.username ?? ''),
          name: String(input.submittedBy.name ?? ''),
        }
      : { id: 'local', username: 'local', name: 'Local user' };
    voucher.status = 'pending';
    voucher.submittedBy = submittedBy;
    voucher.submittedAt = new Date().toISOString();
    company.pendingVouchers = company.pendingVouchers ?? [];
    company.pendingVouchers.push(voucher);
    return { ok: true, voucher, pending: true };
  }
  if (input.submittedBy) voucher.submittedBy = input.submittedBy;
  if (input.approval) voucher.approval = input.approval;
  company.vouchers.push(voucher);
  if (orderLink.order) refreshOrderFulfilment(company, orderLink.order);
  return { ok: true, voucher };
}

export function approvePendingVoucher(company, voucherId, actor = {}) {
  const pending = (company.pendingVouchers ?? []).find((voucher) => voucher.id === voucherId);
  if (!pending) return { ok: false, error: 'Pending voucher not found.' };
  if (pending.status !== 'pending') return { ok: false, error: 'This voucher has already been decided.' };
  if (actor.id && pending.submittedBy?.id && actor.id === pending.submittedBy.id) {
    return { ok: false, error: 'You cannot approve a voucher you submitted.' };
  }
  const result = addVoucher(company, {
    ...pending,
    pending: false,
    submittedBy: pending.submittedBy,
    approval: {
      status: 'approved',
      approvedBy: { id: actor.id || '', username: actor.username || '', name: actor.name || '' },
      approvedAt: new Date().toISOString(),
    },
  });
  if (!result.ok) return result;
  company.pendingVouchers = (company.pendingVouchers ?? []).filter((voucher) => voucher.id !== voucherId);
  return { ok: true, voucher: result.voucher };
}

export function rejectPendingVoucher(company, voucherId, actor = {}, note = '') {
  const pending = (company.pendingVouchers ?? []).find((voucher) => voucher.id === voucherId);
  if (!pending) return { ok: false, error: 'Pending voucher not found.' };
  if (pending.status !== 'pending') return { ok: false, error: 'This voucher has already been decided.' };
  if (actor.id && pending.submittedBy?.id && actor.id === pending.submittedBy.id) {
    return { ok: false, error: 'You cannot reject a voucher you submitted.' };
  }
  pending.status = 'rejected';
  pending.rejectedBy = { id: actor.id || '', username: actor.username || '', name: actor.name || '' };
  pending.rejectedAt = new Date().toISOString();
  pending.rejectionNote = String(note || '').trim().slice(0, 400);
  return { ok: true, voucher: pending };
}

function pendingRevisionChanges(before, after) {
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const changes = [];
  const add = (field, label, from, to) => {
    if (!same(from, to)) changes.push({ field, label, from, to });
  };
  add('type', 'Voucher type', before.type, after.type);
  add('date', 'Date', before.date, after.date);
  add('narration', 'Narration', before.narration, after.narration);
  add('total', 'Amount', before.total, after.total);
  add('lines', 'Ledger lines', before.lines, after.lines);
  add('items', 'Stock items', before.items, after.items);
  const addBlock = (field, label) => {
    if (!same(before[field], after[field])) changes.push({ field, label, from: null, to: null });
  };
  addBlock('bill', 'Bill details');
  addBlock('instrument', 'Instrument');
  addBlock('gst', 'GST details');
  addBlock('tds', 'TDS/TCS details');
  add('currency', 'Currency', before.currency, after.currency);
  return changes;
}

function pendingVoucherFields(voucher) {
  return {
    type: voucher.type,
    date: voucher.date,
    narration: voucher.narration ?? '',
    total: voucher.total,
    lines: voucher.lines ?? [],
    items: voucher.items ?? [],
    bill: voucher.bill ?? null,
    instrument: voucher.instrument ?? null,
    gst: voucher.gst ?? null,
    tds: voucher.tds ?? null,
    currency: voucher.currencyCode ?? 'INR',
  };
}

export function updatePendingVoucher(company, voucherId, input = {}, actor = {}) {
  const pending = (company.pendingVouchers ?? []).find((voucher) => voucher.id === voucherId);
  if (!pending) return { ok: false, error: 'Pending voucher not found.' };
  if (pending.status !== 'pending') return { ok: false, error: 'Only a pending voucher can be edited.' };
  const beforeFields = pendingVoucherFields(pending);
  if (!actor.id || pending.submittedBy?.id !== actor.id) {
    return { ok: false, error: 'Only the person who submitted this voucher can edit it.' };
  }
  const type = VOUCHER_TYPES[input.type] ? input.type : pending.type;
  const checked = validateVoucherInput(company, type, input);
  if (!checked.ok) return checked;
  pending.type = type;
  pending.date = checked.date;
  pending.narration = checked.narration;
  pending.lines = checked.lines;
  pending.total = checked.total;
  for (const key of ['currencyCode', 'exchangeRate', 'currencyTotal', 'items', 'bill', 'instrument', 'gst', 'tds']) {
    delete pending[key];
  }
  if (checked.currencyCode) {
    pending.currencyCode = checked.currencyCode;
    pending.exchangeRate = checked.exchangeRate;
    pending.currencyTotal = checked.currencyTotal;
  }
  if (checked.items.length) pending.items = checked.items;
  if (checked.bill) pending.bill = checked.bill;
  if (checked.instrument) pending.instrument = checked.instrument;
  if (checked.gst) pending.gst = checked.gst;
  if (checked.tds) pending.tds = checked.tds;
  pending.editedAt = new Date().toISOString();
  const changes = pendingRevisionChanges(beforeFields, pendingVoucherFields(pending));
  if (changes.length) {
    pending.revisions = pending.revisions ?? [];
    pending.revisions.push({
      at: pending.editedAt,
      by: {
        id: String(actor.id ?? ''),
        username: String(actor.username ?? ''),
        name: String(actor.name ?? ''),
      },
      changes,
    });
  }
  return { ok: true, voucher: pending, pending: true };
}

export function withdrawPendingVoucher(company, voucherId, actor = {}) {
  const pending = (company.pendingVouchers ?? []).find((voucher) => voucher.id === voucherId);
  if (!pending) return { ok: false, error: 'Pending voucher not found.' };
  if (pending.status !== 'pending') return { ok: false, error: 'Only a pending voucher can be withdrawn.' };
  if (!actor.id || pending.submittedBy?.id !== actor.id) {
    return { ok: false, error: 'Only the person who submitted this voucher can withdraw it.' };
  }
  company.pendingVouchers = (company.pendingVouchers ?? []).filter((voucher) => voucher.id !== voucherId);
  return { ok: true, voucher: pending };
}

export function deletePendingVoucher(company, voucherId) {
  const pending = (company.pendingVouchers ?? []).find((voucher) => voucher.id === voucherId);
  if (!pending) return { ok: false, error: 'Pending voucher not found.' };
  if (pending.status === 'pending') return { ok: false, error: 'Approve or reject the voucher before removing it.' };
  company.pendingVouchers = (company.pendingVouchers ?? []).filter((voucher) => voucher.id !== voucherId);
  return { ok: true };
}

export function updateVoucher(company, voucherId, input) {
  const voucher = company.vouchers.find((item) => item.id === voucherId);
  if (!voucher) return { ok: false, error: 'Voucher not found.' };

  const type = VOUCHER_TYPES[input.type] ? input.type : voucher.type;
  const checked = validateVoucherInput(company, type, input, { excludeVoucherId: voucherId });
  if (!checked.ok) return checked;
  if (voucher.orderId) {
    const linkedOrder = (company.orders ?? []).find((order) => order.id === voucher.orderId);
    if (linkedOrder && linkedOrder.type !== type) {
      return {
        ok: false,
        error: `This voucher is linked to ${linkedOrder.type === 'Sales' ? 'SO' : 'PO'}-${linkedOrder.no}; change the voucher type back or remove the link in the order first.`,
      };
    }
  }

  const previousInstrumentStatus = voucher.instrument?.status;
  const settled = allocationsAgainst(company, voucherId);
  if (settled.size > 0) {
    if (type !== 'Sales' && type !== 'Purchase') {
      return { ok: false, error: 'This bill is settled by other vouchers. Change their allocations before changing the voucher type.' };
    }
    for (const [ledgerId, allocated] of settled) {
      const lineTotal = round2(
        checked.lines.filter((line) => line.ledgerId === ledgerId).reduce((sum, line) => sum + line.amount, 0),
      );
      if (allocated > round2(lineTotal + 0.005)) {
        return {
          ok: false,
          error: `This bill is settled by ${fmtMoney(allocated)} in other vouchers. Raise the party line to at least that amount, or change those allocations first.`,
        };
      }
    }
  }

  company.counters = company.counters ?? {};
  if (type !== voucher.type) {
    voucher.no = (company.counters[type] ?? 0) + 1;
    company.counters[type] = voucher.no;
  }
  voucher.type = type;
  if (type !== 'Sales' && company.ewayPartB) delete company.ewayPartB[voucher.id];
  voucher.date = checked.date;
  voucher.narration = checked.narration;
  voucher.lines = checked.lines;
  voucher.total = checked.total;
  if (checked.currencyCode) {
    voucher.currencyCode = checked.currencyCode;
    voucher.exchangeRate = checked.exchangeRate;
    voucher.currencyTotal = checked.currencyTotal;
  } else {
    delete voucher.currencyCode;
    delete voucher.exchangeRate;
    delete voucher.currencyTotal;
  }
  if (checked.items.length) voucher.items = checked.items;
  else delete voucher.items;
  if (checked.bill) voucher.bill = checked.bill;
  else delete voucher.bill;
  if (checked.instrument) {
    voucher.instrument = checked.instrument;
    if (previousInstrumentStatus) voucher.instrument.status = previousInstrumentStatus;
  } else delete voucher.instrument;
  if (checked.gst) voucher.gst = checked.gst;
  else delete voucher.gst;
  if (checked.tds) voucher.tds = checked.tds;
  else delete voucher.tds;
  voucher.updatedAt = new Date().toISOString();
  if (voucher.orderId) {
    const linkedOrder = (company.orders ?? []).find((order) => order.id === voucher.orderId);
    if (linkedOrder) refreshOrderFulfilment(company, linkedOrder);
  }
  pruneBankReconciliations(company);
  return { ok: true, voucher };
}

/** Allocations in other vouchers that settle this bill, grouped by party ledger. */
export function allocationsAgainst(company, voucherId) {
  const totals = new Map();
  for (const voucher of company.vouchers) {
    if (voucher.id === voucherId) continue;
    for (const line of voucher.lines ?? []) {
      for (const allocation of line.allocations ?? []) {
        if (allocation.voucherId !== voucherId) continue;
        totals.set(line.ledgerId, round2((totals.get(line.ledgerId) ?? 0) + allocation.amount));
      }
    }
  }
  return totals;
}

export function deleteVoucher(company, voucherId) {
  if (allocationsAgainst(company, voucherId).size > 0) return false;
  const existing = company.vouchers.find((voucher) => voucher.id === voucherId);
  const year = existing ? yearForDate(company, existing.date) : null;
  if (year?.closed) return false;
  const before = company.vouchers.length;
  company.vouchers = company.vouchers.filter((voucher) => voucher.id !== voucherId);
  if (company.vouchers.length !== before && company.ewayPartB) delete company.ewayPartB[voucherId];
  pruneBankReconciliations(company);
  if (company.vouchers.length !== before && existing?.orderId) {
    const order = (company.orders ?? []).find((entry) => entry.id === existing.orderId);
    if (order) refreshOrderFulfilment(company, order);
  }
  return company.vouchers.length !== before;
}

export function addGroup(company, input) {
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'Group name is required.' };
  if (name.length > 80) return { ok: false, error: 'Group name must be 80 characters or fewer.' };
  if (company.groups.some((group) => group.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `A group named "${name}" already exists.` };
  }
  const parent = groupById(company, input.parentId);
  if (!parent) return { ok: false, error: 'Choose a parent group.' };
  const primary = primaryGroupOf(company, parent.id);
  if (!primary) return { ok: false, error: 'That parent group has no primary classification.' };

  const group = {
    id: uid('grp'),
    name,
    parentId: parent.id,
    nature: primary.nature,
    key: `custom_${uid('k')}`,
    custom: true,
  };
  company.groups.push(group);
  return { ok: true, group };
}

function nameTaken(list, name, ignoreId) {
  const target = name.trim().toLowerCase();
  return list.some((item) => item.id !== ignoreId && item.name.trim().toLowerCase() === target);
}

export function addUnit(company, input) {
  const name = String(input.name ?? '').trim();
  const symbol = String(input.symbol ?? '').trim();
  if (!name) return { ok: false, error: 'Unit name is required.' };
  if (!symbol) return { ok: false, error: 'Unit symbol is required.' };
  if (name.length > 40 || symbol.length > 8) {
    return { ok: false, error: 'Keep the unit name under 40 and the symbol under 8 characters.' };
  }
  company.units = company.units ?? [];
  if (nameTaken(company.units, name) || nameTaken(company.units, symbol)) {
    return { ok: false, error: `A unit named "${name}" or symbol "${symbol}" already exists.` };
  }
  const unit = { id: uid('unit'), name, symbol };
  company.units.push(unit);
  return { ok: true, unit };
}

export function unitInUse(company, unitId) {
  return (company.stockItems ?? []).filter((item) => item.unitId === unitId).length;
}

export function deleteUnit(company, unitId) {
  const unit = (company.units ?? []).find((item) => item.id === unitId);
  if (!unit) return { ok: false, error: 'Unit not found.' };
  const used = unitInUse(company, unitId);
  if (used > 0) {
    return { ok: false, error: `"${unit.name}" is used by ${used} stock item(s). Change those items first.` };
  }
  company.units = company.units.filter((item) => item.id !== unitId);
  return { ok: true, unit };
}

export function addStockGroup(company, input) {
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'Stock group name is required.' };
  if (name.length > 80) return { ok: false, error: 'Stock group name must be 80 characters or fewer.' };
  company.stockGroups = company.stockGroups ?? [];
  if (nameTaken(company.stockGroups, name)) {
    return { ok: false, error: `A stock group named "${name}" already exists.` };
  }
  const group = { id: uid('sgrp'), name, primary: false };
  company.stockGroups.push(group);
  return { ok: true, group };
}

export function deleteStockGroup(company, groupId) {
  const group = (company.stockGroups ?? []).find((item) => item.id === groupId);
  if (!group) return { ok: false, error: 'Stock group not found.' };
  if (group.primary) return { ok: false, error: 'The primary stock group cannot be deleted.' };
  const used = (company.stockItems ?? []).filter((item) => item.stockGroupId === groupId).length;
  if (used > 0) {
    return { ok: false, error: `Move the ${used} stock item(s) in this group first.` };
  }
  company.stockGroups = company.stockGroups.filter((item) => item.id !== groupId);
  return { ok: true, group };
}

function normaliseOpeningBatches(raw) {
  if (raw === undefined || raw === null) return { ok: true, batches: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'Opening batches must be a list.' };
  if (raw.length > 200) return { ok: false, error: 'A stock item can have at most 200 opening batches.' };
  const batches = [];
  const seen = new Set();
  for (const entry of raw) {
    const batchNo = String(entry?.batchNo ?? '').trim().slice(0, 30);
    if (!batchNo) return { ok: false, error: 'Every opening batch needs a batch name.' };
    const key = batchNo.toLowerCase();
    if (seen.has(key)) return { ok: false, error: `Opening batch "${batchNo}" is repeated.` };
    const qty = parseQty(entry?.qty);
    if (qty === null || qty <= 0) {
      return { ok: false, error: `Opening batch "${batchNo}" needs a quantity greater than zero.` };
    }
    const expiryDate = String(entry?.expiryDate ?? '').trim();
    if (expiryDate && !isValidIsoDate(expiryDate)) {
      return { ok: false, error: `Opening batch "${batchNo}" has an invalid expiry date.` };
    }
    seen.add(key);
    batches.push({ batchNo, qty: round3(qty), ...(expiryDate ? { expiryDate } : {}) });
  }
  return { ok: true, batches };
}

function validateStockItemInput(company, input, ignoreId) {
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'Stock item name is required.' };
  if (name.length > 80) return { ok: false, error: 'Stock item name must be 80 characters or fewer.' };
  company.stockItems = company.stockItems ?? [];
  if (nameTaken(company.stockItems, name, ignoreId)) {
    return { ok: false, error: `A stock item named "${name}" already exists.` };
  }
  const group = (company.stockGroups ?? []).find((item) => item.id === input.stockGroupId);
  if (!group) return { ok: false, error: 'Choose a stock group for the item.' };
  const unit = (company.units ?? []).find((item) => item.id === input.unitId);
  if (!unit) return { ok: false, error: 'Choose a unit for the item.' };
  const batches = normaliseOpeningBatches(input.openingBatches);
  if (!batches.ok) return batches;
  const batchTracking = Boolean(input.batchTracking) || batches.batches.length > 0;
  let openingQty = parseQty(input.openingQty ?? 0);
  if (openingQty === null || openingQty < 0) {
    return { ok: false, error: 'Opening quantity must be zero or more.' };
  }
  if (batches.batches.length) {
    const batchQty = round3(batches.batches.reduce((sum, batch) => sum + batch.qty, 0));
    const supplied = input.openingQty !== undefined && input.openingQty !== '' && openingQty > 0;
    if (supplied && Math.abs(openingQty - batchQty) >= 0.0005) {
      return {
        ok: false,
        error: `Opening quantity ${openingQty} does not match the ${batchQty} in its batches.`,
      };
    }
    openingQty = batchQty;
  }
  const openingRate = parseAmount(input.openingRate ?? 0);
  if (openingRate === null || openingRate < 0) {
    return { ok: false, error: 'Opening rate must be zero or more.' };
  }
  const hsn = String(input.hsn ?? '').trim().toUpperCase();
  if (hsn && !/^[0-9A-Z]{4,8}$/.test(hsn)) {
    return { ok: false, error: 'HSN/SAC must be 4–8 letters or digits.' };
  }
  const reorderLevel = parseQty(input.reorderLevel ?? 0);
  if (reorderLevel === null || reorderLevel < 0) {
    return { ok: false, error: 'Reorder level must be zero or more.' };
  }
  const sellingPrice = parseAmount(input.sellingPrice ?? 0);
  if (sellingPrice === null || sellingPrice < 0) {
    return { ok: false, error: 'Selling price must be zero or more.' };
  }
  const purchasePrice = parseAmount(input.purchasePrice ?? 0);
  if (purchasePrice === null || purchasePrice < 0) {
    return { ok: false, error: 'Purchase price must be zero or more.' };
  }
  return {
    ok: true,
    name,
    group,
    unit,
    openingQty,
    openingRate,
    hsn,
    reorderLevel,
    sellingPrice,
    purchasePrice,
    batchTracking,
    openingBatches: batches.batches,
  };
}

export function addStockItem(company, input) {
  const checked = validateStockItemInput(company, input);
  if (!checked.ok) return checked;
  const item = {
    id: uid('item'),
    name: checked.name,
    stockGroupId: checked.group.id,
    unitId: checked.unit.id,
    openingQty: checked.openingQty,
    openingRate: checked.openingRate,
    batchTracking: checked.batchTracking,
    ...(checked.reorderLevel > 0 ? { reorderLevel: checked.reorderLevel } : {}),
    ...(checked.sellingPrice > 0 ? { sellingPrice: checked.sellingPrice } : {}),
    ...(checked.purchasePrice > 0 ? { purchasePrice: checked.purchasePrice } : {}),
    ...(checked.openingBatches.length ? { openingBatches: checked.openingBatches } : {}),
    ...(checked.hsn ? { hsn: checked.hsn } : {}),
    createdAt: new Date().toISOString(),
  };
  company.stockItems.push(item);
  return { ok: true, item };
}

export function updateStockItem(company, itemId, input) {
  const item = (company.stockItems ?? []).find((entry) => entry.id === itemId);
  if (!item) return { ok: false, error: 'Stock item not found.' };
  let requestedBatches = input.openingBatches;
  if (requestedBatches === undefined && item.openingBatches?.length) {
    const nextQty = parseQty(input.openingQty ?? item.openingQty);
    const batchQty = round3(
      item.openingBatches.reduce((sum, batch) => sum + (Number(batch.qty) || 0), 0),
    );
    if (nextQty === null || Math.abs(batchQty - nextQty) >= 0.0005) requestedBatches = [];
  }
  const checked = validateStockItemInput(company, {
    name: input.name ?? item.name,
    stockGroupId: input.stockGroupId ?? item.stockGroupId,
    unitId: input.unitId ?? item.unitId,
    openingQty: input.openingQty ?? item.openingQty,
    openingRate: input.openingRate ?? item.openingRate,
    hsn: input.hsn ?? item.hsn,
    reorderLevel: input.reorderLevel ?? item.reorderLevel,
    sellingPrice: input.sellingPrice ?? item.sellingPrice,
    purchasePrice: input.purchasePrice ?? item.purchasePrice,
    batchTracking: input.batchTracking ?? item.batchTracking,
    openingBatches: requestedBatches ?? item.openingBatches,
  }, itemId);
  if (!checked.ok) return checked;
  item.name = checked.name;
  item.stockGroupId = checked.group.id;
  item.unitId = checked.unit.id;
  item.openingQty = checked.openingQty;
  item.openingRate = checked.openingRate;
  item.batchTracking = checked.batchTracking;
  if (checked.reorderLevel > 0) item.reorderLevel = checked.reorderLevel;
  else delete item.reorderLevel;
  if (checked.sellingPrice > 0) item.sellingPrice = checked.sellingPrice;
  else delete item.sellingPrice;
  if (checked.purchasePrice > 0) item.purchasePrice = checked.purchasePrice;
  else delete item.purchasePrice;
  if (checked.openingBatches.length) item.openingBatches = checked.openingBatches;
  else delete item.openingBatches;
  if (checked.hsn) item.hsn = checked.hsn;
  else delete item.hsn;
  return { ok: true, item };
}

export const OPENING_BATCH = 'Opening';

/**
 * Net quantity of an item on a date. Opening stock sits in the primary godown
 * and the Opening batch. Transfers move quantity between godowns without
 * changing the item total.
 */
export function stockOnHand(company, itemId, asOn, options = {}) {
  const item = (company.stockItems ?? []).find((entry) => entry.id === itemId);
  if (!item) return 0;
  const mainGodown = defaultGodownId(company);
  const godownFilter = options.godownId || '';
  const batchFilter = options.batchNo ?? null;
  const openingInGodown = !godownFilter || godownFilter === mainGodown;
  const openingBatches = item.openingBatches ?? [];
  let qty = openingInGodown ? round3(item.openingQty ?? 0) : 0;
  if (batchFilter !== null) {
    if (openingBatches.length) {
      const batch = openingBatches.find((entry) => entry.batchNo === batchFilter);
      qty = openingInGodown && batch ? round3(batch.qty) : 0;
    } else if (batchFilter !== OPENING_BATCH) {
      qty = 0;
    }
  }
  const vouchers = company.vouchers
    .filter((voucher) => voucher.date <= asOn && voucher.id !== options.excludeVoucherId)
    .sort((a, b) => a.date.localeCompare(b.date) || (Number(a.no) || 0) - (Number(b.no) || 0));
  for (const voucher of vouchers) {
    if (!INVENTORY_TYPES.includes(voucher.type)) continue;
    const direction = voucher.type === 'Purchase' || voucher.type === 'CreditNote' ? 1 : -1;
    for (const line of voucher.items ?? []) {
      if (line.stockItemId !== itemId) continue;
      if (godownFilter && (line.godownId || mainGodown) !== godownFilter) continue;
      if (batchFilter !== null && (line.batchNo || OPENING_BATCH) !== batchFilter) continue;
      qty = round3(qty + direction * (Number(line.qty) || 0));
    }
  }
  const transfers = (company.stockTransfers ?? [])
    .filter((transfer) => transfer.date <= asOn && transfer.id !== options.excludeTransferId)
    .sort((a, b) => a.date.localeCompare(b.date) || (Number(a.no) || 0) - (Number(b.no) || 0));
  for (const transfer of transfers) {
    for (const line of transfer.items ?? []) {
      if (line.stockItemId !== itemId) continue;
      if (batchFilter !== null && (line.batchNo || OPENING_BATCH) !== batchFilter) continue;
      const qtyMoved = Number(line.qty) || 0;
      if (!godownFilter || transfer.fromGodownId === godownFilter) qty = round3(qty - qtyMoved);
      if (!godownFilter || transfer.toGodownId === godownFilter) qty = round3(qty + qtyMoved);
    }
  }
  for (const adjustment of company.stockAdjustments ?? []) {
    if (adjustment.date > asOn) continue;
    for (const line of adjustment.rows ?? []) {
      if (line.stockItemId !== itemId) continue;
      if (godownFilter && adjustment.godownId !== godownFilter) continue;
      if (batchFilter !== null && (line.batchNo || OPENING_BATCH) !== batchFilter) continue;
      qty = round3(qty + (Number(line.difference) || 0));
    }
  }
  const manufactures = (company.manufactures ?? [])
    .filter((manufacture) => manufacture.date <= asOn)
    .sort((a, b) => a.date.localeCompare(b.date) || (Number(a.no) || 0) - (Number(b.no) || 0));
  for (const manufacture of manufactures) {
    for (const line of manufacture.components ?? []) {
      if (line.stockItemId !== itemId) continue;
      if (batchFilter !== null && batchFilter !== OPENING_BATCH) continue;
      if (!godownFilter || manufacture.componentGodownId === godownFilter) {
        qty = round3(qty - (Number(line.qty) || 0));
      }
    }
    if (manufacture.outputItemId !== itemId) continue;
    if (batchFilter !== null && (manufacture.outputBatchNo || OPENING_BATCH) !== batchFilter) continue;
    if (!godownFilter || manufacture.outputGodownId === godownFilter) {
      qty = round3(qty + (Number(manufacture.outputQty) || 0));
    }
  }
  return qty;
}

export function stockItemUsage(company, itemId) {
  const voucherUse = company.vouchers.filter((voucher) =>
    (voucher.items ?? []).some((line) => line.stockItemId === itemId),
  ).length;
  const transferUse = (company.stockTransfers ?? []).filter((transfer) =>
    (transfer.items ?? []).some((line) => line.stockItemId === itemId),
  ).length;
  const bomUse = (company.boms ?? []).filter(
    (bom) =>
      bom.outputItemId === itemId ||
      (bom.components ?? []).some((line) => line.stockItemId === itemId),
  ).length;
  const manufactureUse = (company.manufactures ?? []).filter(
    (manufacture) =>
      manufacture.outputItemId === itemId ||
      (manufacture.components ?? []).some((line) => line.stockItemId === itemId),
  ).length;
  return voucherUse + transferUse + bomUse + manufactureUse;
}

export function addStockTransfer(company, input) {
  const date = String(input.date ?? '');
  if (!isValidIsoDate(date)) return { ok: false, error: 'Enter a valid transfer date.' };
  seedYears(company);
  const year = yearForDate(company, date);
  if (!year) return { ok: false, error: 'The transfer date must fall inside a financial year.' };
  if (year.closed) return { ok: false, error: 'The financial year is closed. Reopen it before recording a transfer.' };
  const from = (company.godowns ?? []).find((godown) => godown.id === input.fromGodownId);
  const to = (company.godowns ?? []).find((godown) => godown.id === input.toGodownId);
  if (!from || !to) return { ok: false, error: 'Choose both the source and destination godown.' };
  if (from.id === to.id) return { ok: false, error: 'Source and destination godowns must be different.' };
  const requested = Array.isArray(input.items)
    ? input.items
    : [{ stockItemId: input.stockItemId, qty: input.qty, batchNo: input.batchNo }];
  if (!requested.length) return { ok: false, error: 'Add at least one item to the transfer.' };
  if (requested.length > 50) return { ok: false, error: 'A transfer can carry at most 50 item lines.' };
  const lines = [];
  const totals = new Map();
  for (const raw of requested) {
    const item = (company.stockItems ?? []).find((entry) => entry.id === raw?.stockItemId);
    if (!item) return { ok: false, error: 'Choose a stock item for every transfer line.' };
    const qty = parseQty(raw?.qty);
    if (qty === null || qty <= 0) {
      return { ok: false, error: `Transfer quantity for "${item.name}" must be greater than zero.` };
    }
    const batchNo = String(raw?.batchNo ?? '').trim().slice(0, 30);
    if (item.batchTracking && !batchNo) {
      return { ok: false, error: `Batch is required for "${item.name}".` };
    }
    const key = `${item.id}\u0000${item.batchTracking ? batchNo : ''}`;
    const existing = totals.get(key);
    if (existing) {
      existing.qty = round3(existing.qty + qty);
    } else {
      const line = {
        stockItemId: item.id,
        qty,
        ...(item.batchTracking && batchNo ? { batchNo } : {}),
      };
      totals.set(key, { ...line, item });
      lines.push(line);
    }
  }
  for (const total of totals.values()) {
    const available = stockOnHand(company, total.stockItemId, date, {
      godownId: from.id,
      batchNo: total.item.batchTracking ? total.batchNo : null,
    });
    if (total.qty > available + 0.0005) {
      const unit = (company.units ?? []).find((entry) => entry.id === total.item.unitId)?.symbol ?? '';
      return {
        ok: false,
        error: `Only ${Number(available.toFixed(3))} ${unit} of "${total.item.name}" in ${from.name} on ${dateLabel(date)}.`,
      };
    }
  }
  for (const line of lines) {
    const total = totals.get(`${line.stockItemId}\u0000${line.batchNo ?? ''}`);
    line.qty = round3(total.qty);
  }
  company.stockTransfers = company.stockTransfers ?? [];
  company.counters = company.counters ?? {};
  const sequence = (company.counters.__stockTransfer ?? 0) + 1;
  company.counters.__stockTransfer = sequence;
  const transfer = {
    id: uid('xfer'),
    no: sequence,
    date,
    fromGodownId: from.id,
    toGodownId: to.id,
    items: lines,
    narration: String(input.narration ?? '').trim().slice(0, 400),
    createdAt: new Date().toISOString(),
  };
  company.stockTransfers.push(transfer);
  return { ok: true, transfer };
}

export function deleteStockTransfer(company, transferId) {
  const transfer = (company.stockTransfers ?? []).find((item) => item.id === transferId);
  if (!transfer) return { ok: false, error: 'Stock transfer not found.' };
  company.stockTransfers = (company.stockTransfers ?? []).filter((item) => item.id !== transferId);
  return { ok: true, transfer };
}

/**
 * Records a physical stock count. Book quantities are snapped at the count
 * date and godown, but counting never moves stock or posts an adjustment.
 */
/** Batch numbers with a non-zero book quantity for one item and godown. */
export function stockBatchesOnHand(company, itemId, asOn, options = {}) {
  const item = (company.stockItems ?? []).find((entry) => entry.id === itemId);
  if (!item?.batchTracking) return [];
  const candidates = new Set();
  const openingBatches = (item.openingBatches ?? []).filter(
    (batch) => String(batch.batchNo ?? '').trim() && Number(batch.qty) > 0,
  );
  if (openingBatches.length) {
    for (const batch of openingBatches) candidates.add(batch.batchNo);
  } else if ((item.openingQty ?? 0) > 0) {
    candidates.add(OPENING_BATCH);
  }
  for (const voucher of company.vouchers ?? []) {
    if (voucher.date > asOn || !INVENTORY_TYPES.includes(voucher.type)) continue;
    for (const line of voucher.items ?? []) {
      if (line.stockItemId === itemId) candidates.add(line.batchNo || OPENING_BATCH);
    }
  }
  for (const transfer of company.stockTransfers ?? []) {
    if (transfer.date > asOn) continue;
    for (const line of transfer.items ?? []) {
      if (line.stockItemId === itemId) candidates.add(line.batchNo || OPENING_BATCH);
    }
  }
  for (const manufacture of company.manufactures ?? []) {
    if (manufacture.date > asOn) continue;
    if (manufacture.outputItemId === itemId) candidates.add(manufacture.outputBatchNo || OPENING_BATCH);
    if ((manufacture.components ?? []).some((line) => line.stockItemId === itemId)) {
      candidates.add(OPENING_BATCH);
    }
  }
  return [...candidates]
    .map((batchNo) => ({
      batchNo,
      qty: round3(stockOnHand(company, itemId, asOn, { ...options, batchNo })),
    }))
    .filter((batch) => Math.abs(batch.qty) >= 0.0005)
    .sort((a, b) => a.batchNo.localeCompare(b.batchNo));
}

export function addStockCount(company, input) {
  const date = String(input.date ?? '');
  if (!isValidIsoDate(date)) return { ok: false, error: 'Enter a valid count date.' };
  seedYears(company);
  const year = yearForDate(company, date);
  if (!year) return { ok: false, error: 'The count date must fall inside a financial year.' };
  if (year.closed) return { ok: false, error: 'The financial year is closed. Reopen it before recording a count.' };
  const godown = (company.godowns ?? []).find((entry) => entry.id === input.godownId);
  if (!godown) return { ok: false, error: 'Choose the godown that was counted.' };
  const requested = Array.isArray(input.rows) ? input.rows : [];
  if (!requested.length) return { ok: false, error: 'Add at least one stock item to the count.' };
  if (requested.length > 500) return { ok: false, error: 'A stock count can carry at most 500 item lines.' };
  const rows = [];
  const seen = new Set();
  for (const raw of requested) {
    const item = (company.stockItems ?? []).find((entry) => entry.id === raw?.stockItemId);
    if (!item) return { ok: false, error: 'Choose a stock item for every count line.' };
    const batchNo = item.batchTracking ? String(raw?.batchNo ?? '').trim().slice(0, 30) : '';
    const key = `${item.id}:${batchNo}`;
    if (seen.has(key)) {
      return {
        ok: false,
        error: batchNo
          ? `"${item.name}" batch ${batchNo} appears twice in the count.`
          : `"${item.name}" appears twice in the count.`,
      };
    }
    seen.add(key);
    const countedQty = parseQty(raw?.countedQty);
    if (countedQty === null || countedQty < 0) {
      return { ok: false, error: `Counted quantity for "${item.name}" must be zero or more.` };
    }
    if (item.batchTracking && !batchNo) {
      if (countedQty === 0) continue;
      return { ok: false, error: `Enter the batch or lot for the unlisted "${item.name}" stock.` };
    }
    const systemQty = round3(
      stockOnHand(company, item.id, date, { godownId: godown.id, ...(batchNo ? { batchNo } : {}) }),
    );
    rows.push({
      stockItemId: item.id,
      name: item.name,
      ...(batchNo ? { batchNo } : {}),
      unit: (company.units ?? []).find((unit) => unit.id === item.unitId)?.symbol ?? '',
      systemQty,
      countedQty,
      difference: round3(countedQty - systemQty),
    });
  }
  if (!rows.length) return { ok: false, error: 'Enter a counted quantity or an unlisted batch to save this count.' };
  company.stockCounts = company.stockCounts ?? [];
  company.counters = company.counters ?? {};
  company.counters.__stockCount = Math.max(
    Number(company.counters.__stockCount) || 0,
    ...company.stockCounts.map((count) => Number(count.no) || 0),
  ) + 1;
  const count = {
    id: uid('scnt'),
    no: company.counters.__stockCount,
    date,
    godownId: godown.id,
    godownName: godown.name,
    narration: String(input.narration ?? '').trim().slice(0, 200),
    rows,
    createdAt: new Date().toISOString(),
  };
  company.stockCounts.push(count);
  return { ok: true, count };
}

export function postStockCount(company, countId) {
  const count = (company.stockCounts ?? []).find((entry) => entry.id === countId);
  if (!count) return { ok: false, error: 'Stock count not found.' };
  if (count.adjustmentId) return { ok: false, error: 'This stock count has already been posted.' };
  seedYears(company);
  const year = yearForDate(company, count.date);
  if (!year) return { ok: false, error: 'The count date must fall inside a financial year.' };
  if (year.closed) return { ok: false, error: 'The financial year is closed. Reopen it before posting the adjustment.' };
  const rows = (count.rows ?? [])
    .filter((row) => Math.abs(Number(row.difference) || 0) >= 0.0005)
    .map((row) => ({
      stockItemId: row.stockItemId,
      ...(row.batchNo ? { batchNo: row.batchNo } : {}),
      difference: round3(row.difference),
    }));
  if (!rows.length) return { ok: false, error: 'This count has no differences to post.' };
  company.stockAdjustments = company.stockAdjustments ?? [];
  company.counters = company.counters ?? {};
  company.counters.__stockAdjustment = Math.max(
    Number(company.counters.__stockAdjustment) || 0,
    ...company.stockAdjustments.map((adjustment) => Number(adjustment.no) || 0),
  ) + 1;
  const adjustment = {
    id: uid('sadj'),
    no: company.counters.__stockAdjustment,
    date: count.date,
    godownId: count.godownId,
    countId: count.id,
    countNo: count.no,
    rows,
    createdAt: new Date().toISOString(),
  };
  company.stockAdjustments.push(adjustment);
  count.adjustmentId = adjustment.id;
  count.adjustmentNo = adjustment.no;
  count.postedAt = adjustment.createdAt;
  return { ok: true, count, adjustment };
}

export function deleteStockCount(company, countId) {
  const count = (company.stockCounts ?? []).find((entry) => entry.id === countId);
  if (!count) return { ok: false, error: 'Stock count not found.' };
  if (count.adjustmentId) {
    return { ok: false, error: 'This count has posted a stock adjustment and cannot be deleted.' };
  }
  company.stockCounts = (company.stockCounts ?? []).filter((entry) => entry.id !== countId);
  return { ok: true, count };
}

/** Repairs saved stock counts after load or backup import. */
export function normalizeStockCounts(company) {
  if (!Array.isArray(company.stockCounts)) {
    company.stockCounts = [];
    return company;
  }
  const items = new Map((company.stockItems ?? []).map((item) => [item.id, item]));
  const units = new Map((company.units ?? []).map((unit) => [unit.id, unit]));
  company.stockCounts = company.stockCounts
    .filter((count) => count && count.id && isValidIsoDate(count.date))
    .slice(-1000)
    .map((count) => {
      const rows = (Array.isArray(count.rows) ? count.rows : [])
        .filter((row) => row && Number.isFinite(Number(row.countedQty)) && Number(row.countedQty) >= 0)
        .map((row) => {
          const item = items.get(row.stockItemId);
          const countedQty = round3(Number(row.countedQty));
          const systemQty = round3(Number(row.systemQty) || 0);
          const batchNo = item?.batchTracking ? String(row.batchNo ?? '').trim().slice(0, 30) : '';
          return {
            stockItemId: String(row.stockItemId ?? ''),
            name: item?.name ?? String(row.name ?? 'Unknown item'),
            ...(batchNo ? { batchNo } : {}),
            unit: item ? units.get(item.unitId)?.symbol ?? '' : String(row.unit ?? ''),
            systemQty,
            countedQty,
            difference: round3(countedQty - systemQty),
          };
        });
      return {
        id: String(count.id),
        no: Number(count.no) || 0,
        date: count.date,
        godownId: String(count.godownId ?? ''),
        godownName: String(count.godownName ?? ''),
        narration: String(count.narration ?? '').slice(0, 200),
        rows,
        createdAt: String(count.createdAt ?? new Date().toISOString()),
      };
    })
    .filter((count) => count.rows.length > 0);
  company.counters = company.counters ?? {};
  company.counters.__stockCount = Math.max(
    Number(company.counters.__stockCount) || 0,
    ...company.stockCounts.map((count) => Number(count.no) || 0),
  );
  return company;
}

const COMPLIANCE_CATEGORIES = new Set(['GST', 'TDS', 'Payroll', 'Other']);

function complianceTaskInput(input = {}) {
  const title = String(input.title ?? '').trim().slice(0, 100);
  if (!title) return { error: 'Enter a compliance task title.' };
  const dueDate = String(input.dueDate ?? '');
  if (!isValidIsoDate(dueDate)) return { error: 'Enter a valid due date.' };
  const category = COMPLIANCE_CATEGORIES.has(input.category) ? input.category : 'Other';
  const notes = String(input.notes ?? '').trim().slice(0, 200);
  const filedOn = String(input.filedOn ?? '').trim();
  if (filedOn && !isValidIsoDate(filedOn)) return { error: 'Enter a valid filed-on date.' };
  const reference = String(input.reference ?? '').trim().slice(0, 80);
  return { title, dueDate, category, notes, filedOn, reference };
}

export function addComplianceTask(company, input = {}) {
  const checked = complianceTaskInput(input);
  if (checked.error) return { ok: false, error: checked.error };
  company.complianceTasks = Array.isArray(company.complianceTasks) ? company.complianceTasks : [];
  if (company.complianceTasks.length >= 1000) {
    return { ok: false, error: 'Keep at most 1,000 compliance tasks.' };
  }
  const task = {
    id: uid('ctask'),
    title: checked.title,
    category: checked.category,
    dueDate: checked.dueDate,
    notes: checked.notes,
    ...(checked.filedOn ? { filedOn: checked.filedOn } : {}),
    ...(checked.reference ? { reference: checked.reference } : {}),
    status: 'Open',
    createdAt: new Date().toISOString(),
  };
  company.complianceTasks.push(task);
  return { ok: true, task };
}

export function updateComplianceTask(company, taskId, input = {}) {
  const task = (company.complianceTasks ?? []).find((entry) => entry.id === taskId);
  if (!task) return { ok: false, error: 'Compliance task not found.' };
  const checked = complianceTaskInput(input);
  if (checked.error) return { ok: false, error: checked.error };
  task.title = checked.title;
  task.category = checked.category;
  task.dueDate = checked.dueDate;
  task.notes = checked.notes;
  if (checked.filedOn) task.filedOn = checked.filedOn;
  else delete task.filedOn;
  if (checked.reference) task.reference = checked.reference;
  else delete task.reference;
  return { ok: true, task };
}

export function setComplianceTaskStatus(company, taskId, status) {
  const task = (company.complianceTasks ?? []).find((entry) => entry.id === taskId);
  if (!task) return { ok: false, error: 'Compliance task not found.' };
  if (status !== 'Open' && status !== 'Done') return { ok: false, error: 'Choose Open or Done.' };
  task.status = status;
  if (status === 'Done') task.completedAt = new Date().toISOString();
  else delete task.completedAt;
  return { ok: true, task };
}

export function deleteComplianceTask(company, taskId) {
  const task = (company.complianceTasks ?? []).find((entry) => entry.id === taskId);
  if (!task) return { ok: false, error: 'Compliance task not found.' };
  company.complianceTasks = (company.complianceTasks ?? []).filter((entry) => entry.id !== taskId);
  return { ok: true, task };
}

/** Repairs saved compliance tasks after load or backup import. */
export function normalizeComplianceTasks(company) {
  if (!Array.isArray(company.complianceTasks)) {
    company.complianceTasks = [];
    return company;
  }
  const seen = new Set();
  company.complianceTasks = company.complianceTasks
    .filter((task) => {
      if (!task || typeof task !== 'object') return false;
      const id = String(task.id ?? '').slice(0, 80);
      const checked = complianceTaskInput(task);
      if (!id || checked.error || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(-1000)
    .map((task) => ({
      id: String(task.id).slice(0, 80),
      title: String(task.title).trim().slice(0, 100),
      category: COMPLIANCE_CATEGORIES.has(task.category) ? task.category : 'Other',
      dueDate: task.dueDate,
      notes: String(task.notes ?? '').trim().slice(0, 200),
      ...(isValidIsoDate(task.filedOn) ? { filedOn: task.filedOn } : {}),
      ...(task.reference ? { reference: String(task.reference).slice(0, 80) } : {}),
      status: task.status === 'Done' ? 'Done' : 'Open',
      ...(task.status === 'Done' && task.completedAt ? { completedAt: String(task.completedAt) } : {}),
      createdAt: String(task.createdAt ?? new Date().toISOString()),
    }));
  return company;
}

export function addOrder(company, input) {
  const type = input.type === 'Purchase' ? 'Purchase' : input.type === 'Sales' ? 'Sales' : '';
  if (!type) return { ok: false, error: 'Choose a sales or purchase order.' };
  const quotation = input.kind === 'Quotation';
  if (quotation && type !== 'Sales') return { ok: false, error: 'A quotation must be a sales document.' };
  const date = String(input.date ?? '');
  if (!isValidIsoDate(date)) return { ok: false, error: 'Enter a valid order date.' };
  seedYears(company);
  const year = yearForDate(company, date);
  if (!year) return { ok: false, error: 'The order date must fall inside a financial year.' };
  if (year.closed) return { ok: false, error: 'The financial year is closed. Reopen it before adding an order.' };
  const party = (company.ledgers ?? []).find((ledger) => ledger.id === input.partyLedgerId);
  if (!party || !isPartyLedger(company, party.id)) {
    return { ok: false, error: 'Choose a customer or supplier for the order.' };
  }
  const deliveryDate = String(input.deliveryDate ?? '').trim();
  if (deliveryDate && !isValidIsoDate(deliveryDate)) return { ok: false, error: 'Enter a valid delivery date.' };
  if (deliveryDate && deliveryDate < date) return { ok: false, error: 'The delivery date cannot be before the order date.' };
  const requested = Array.isArray(input.items)
    ? input.items
    : [{
        stockItemId: input.stockItemId,
        qty: input.qty,
        rate: input.rate,
        godownId: input.godownId,
        batchNo: input.batchNo,
        expiryDate: input.expiryDate,
      }];
  if (!requested.length) return { ok: false, error: 'Add at least one item to the order.' };
  if (requested.length > 50) return { ok: false, error: 'An order can carry at most 50 item lines.' };
  const lines = [];
  let total = 0;
  for (const raw of requested) {
    const item = (company.stockItems ?? []).find((entry) => entry.id === raw?.stockItemId);
    if (!item) return { ok: false, error: 'Choose a stock item for every order line.' };
    const qty = parseQty(raw?.qty);
    if (qty === null || qty <= 0) {
      return { ok: false, error: `Order quantity for "${item.name}" must be greater than zero.` };
    }
    const rate = parseAmount(raw?.rate);
    if (rate === null || rate < 0) {
      return { ok: false, error: `Order rate for "${item.name}" must be zero or more.` };
    }
    const godownId = String(raw?.godownId ?? '').trim() || defaultGodownId(company);
    if (!(company.godowns ?? []).some((godown) => godown.id === godownId)) {
      return { ok: false, error: `Choose a godown for "${item.name}".` };
    }
    const batchNo = String(raw?.batchNo ?? '').trim().slice(0, 30);
    if (item.batchTracking && !batchNo) {
      return { ok: false, error: `Batch is required for "${item.name}".` };
    }
    const expiryDate = String(raw?.expiryDate ?? '').trim();
    if (expiryDate && !isValidIsoDate(expiryDate)) {
      return { ok: false, error: `Enter a valid batch expiry date for "${item.name}".` };
    }
    const amount = round2(qty * rate);
    total = round2(total + amount);
    lines.push({
      stockItemId: item.id,
      qty,
      rate,
      amount,
      fulfilledQty: 0,
      godownId,
      ...(item.batchTracking && batchNo ? { batchNo } : {}),
      ...(item.batchTracking && expiryDate ? { expiryDate } : {}),
    });
  }
  if (total <= 0) return { ok: false, error: 'The order value must be greater than zero.' };
  company.orders = company.orders ?? [];
  company.counters = company.counters ?? {};
  const key = quotation ? '__salesQuotation' : type === 'Sales' ? '__salesOrder' : '__purchaseOrder';
  const sequence = (Number(company.counters[key]) || 0) + 1;
  company.counters[key] = sequence;
  const order = {
    id: uid(quotation ? 'qtn' : 'ord'),
    ...(quotation ? { kind: 'Quotation' } : {}),
    type,
    no: sequence,
    date,
    partyLedgerId: party.id,
    deliveryDate: deliveryDate || null,
    items: lines,
    total,
    status: 'Open',
    narration: String(input.narration ?? '').trim().slice(0, 400),
    createdAt: new Date().toISOString(),
  };
  company.orders.push(order);
  return { ok: true, order };
}

export function orderRemainingItems(order) {
  return (order.items ?? [])
    .map((line) => {
      const qty = round3(Math.max(0, Number(line.qty) - Number(line.fulfilledQty ?? 0)));
      return { ...line, qty, amount: round2(qty * Number(line.rate ?? 0)) };
    })
    .filter((line) => line.qty > 0.0005);
}

/** Recomputes an order's fulfilled quantities from every linked voucher. */
export function refreshOrderFulfilment(company, order) {
  if (!order || order.status === 'Cancelled' || order.kind) return order;
  for (const line of order.items ?? []) line.fulfilledQty = 0;
  const vouchers = (company.vouchers ?? []).filter((voucher) => voucher.orderId === order.id);
  for (const voucher of vouchers) {
    for (const item of voucher.items ?? []) {
      let qty = round3(item.qty);
      for (const line of order.items ?? []) {
        if (qty <= 0.0005 || line.stockItemId !== item.stockItemId) continue;
        if (line.batchNo && item.batchNo && line.batchNo !== item.batchNo) continue;
        const open = round3(Number(line.qty) - Number(line.fulfilledQty ?? 0));
        if (open <= 0.0005) continue;
        const used = Math.min(open, qty);
        line.fulfilledQty = round3(Number(line.fulfilledQty ?? 0) + used);
        qty = round3(qty - used);
      }
    }
  }
  const complete = (order.items ?? []).every(
    (line) => Number(line.fulfilledQty ?? 0) >= Number(line.qty) - 0.0005,
  );
  if (complete && order.status === 'Open') {
    order.status = 'Closed';
    order.closedByFulfilment = true;
  } else if (!complete && order.status === 'Closed' && order.closedByFulfilment) {
    order.status = 'Open';
    delete order.closedByFulfilment;
  }
  return order;
}

export function addDeliveryNote(company, orderId, date) {
  const order = (company.orders ?? []).find((entry) => entry.id === orderId && !entry.kind);
  if (!order) return { ok: false, error: 'Only a sales or purchase order can produce a delivery document.' };
  const remaining = orderRemainingItems(order);
  if (!remaining.length) return { ok: false, error: 'This order has no remaining quantity to deliver.' };
  const noteDate = String(date ?? '').trim() || new Date().toISOString().slice(0, 10);
  if (!isValidIsoDate(noteDate)) return { ok: false, error: 'Enter a valid delivery-note date.' };
  company.orders = company.orders ?? [];
  company.counters = company.counters ?? {};
  const sequence = (Number(company.counters.__deliveryNote) || 0) + 1;
  company.counters.__deliveryNote = sequence;
  const note = {
    id: uid('dn'),
    kind: order.type === 'Sales' ? 'DeliveryNote' : 'GoodsReceipt',
    type: order.type,
    no: sequence,
    date: noteDate,
    partyLedgerId: order.partyLedgerId,
    sourceOrderId: order.id,
    sourceOrderNo: order.no,
    items: remaining.map((line) => ({ ...line, fulfilledQty: 0 })),
    total: round2(remaining.reduce((sum, line) => sum + line.amount, 0)),
    status: 'Open',
    createdAt: new Date().toISOString(),
  };
  company.orders.push(note);
  return { ok: true, note };
}

export function convertQuotationToOrder(company, quotationId) {
  const quotation = (company.orders ?? []).find(
    (entry) => entry.id === quotationId && entry.kind === 'Quotation',
  );
  if (!quotation) return { ok: false, error: 'Quotation not found.' };
  if (quotation.status !== 'Open') return { ok: false, error: 'Only an open quotation can be converted.' };
  const result = addOrder(company, {
    type: 'Sales',
    date: quotation.date,
    partyLedgerId: quotation.partyLedgerId,
    deliveryDate: quotation.deliveryDate,
    items: (quotation.items ?? []).map((line) => ({
      stockItemId: line.stockItemId,
      qty: line.qty,
      rate: line.rate,
      godownId: line.godownId,
      ...(line.batchNo ? { batchNo: line.batchNo } : {}),
      ...(line.expiryDate ? { expiryDate: line.expiryDate } : {}),
    })),
    narration: quotation.narration ? `From quotation ${quotation.no}: ${quotation.narration}` : `From quotation ${quotation.no}`,
  });
  if (!result.ok) return result;
  quotation.status = 'Converted';
  quotation.convertedOrderId = result.order.id;
  quotation.convertedAt = new Date().toISOString();
  return { ok: true, quotation, order: result.order };
}

export function setOrderStatus(company, orderId, status) {
  const order = (company.orders ?? []).find((entry) => entry.id === orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (!['Open', 'Closed', 'Cancelled'].includes(status)) {
    return { ok: false, error: 'Choose a valid order status.' };
  }
  order.status = status;
  delete order.closedByFulfilment;
  return { ok: true, order };
}

export function deleteOrder(company, orderId) {
  const order = (company.orders ?? []).find((entry) => entry.id === orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  const linked = [...(company.vouchers ?? []), ...(company.pendingVouchers ?? [])].some(
    (voucher) => voucher.orderId === orderId,
  );
  if (linked) {
    return { ok: false, error: 'This order is linked to a voucher. Delete that voucher before deleting the order.' };
  }
  company.orders = (company.orders ?? []).filter((entry) => entry.id !== orderId);
  return { ok: true, order };
}

export function addBom(company, input) {
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: 'BOM name is required.' };
  if (name.length > 80) return { ok: false, error: 'BOM name must be 80 characters or fewer.' };
  company.boms = company.boms ?? [];
  if (nameTaken(company.boms, name)) {
    return { ok: false, error: `A BOM named "${name}" already exists.` };
  }
  const output = (company.stockItems ?? []).find((item) => item.id === input.outputItemId);
  if (!output) return { ok: false, error: 'Choose the finished stock item for this BOM.' };
  const outputQty = parseQty(input.outputQty);
  if (outputQty === null || outputQty <= 0) {
    return { ok: false, error: 'BOM output quantity must be greater than zero.' };
  }
  const rawComponents = Array.isArray(input.components) ? input.components : [];
  if (rawComponents.length === 0) return { ok: false, error: 'Add at least one component to the BOM.' };
  if (rawComponents.length > 20) return { ok: false, error: 'A BOM can have at most 20 components.' };
  const components = [];
  const seen = new Set();
  for (const raw of rawComponents) {
    const component = (company.stockItems ?? []).find((item) => item.id === raw.stockItemId);
    if (!component) return { ok: false, error: 'Choose a stock item for every BOM component.' };
    if (component.id === output.id) {
      return { ok: false, error: 'The finished item cannot also be a BOM component.' };
    }
    if (seen.has(component.id)) {
      return { ok: false, error: `"${component.name}" appears twice in the BOM. Combine its quantities.` };
    }
    if (component.batchTracking) {
      return {
        ok: false,
        error: `Batch-tracked item "${component.name}" cannot be a BOM component yet. Untrack its batches first.`,
      };
    }
    const qty = parseQty(raw.qty);
    if (qty === null || qty <= 0) {
      return { ok: false, error: `Component quantity for "${component.name}" must be greater than zero.` };
    }
    seen.add(component.id);
    components.push({ stockItemId: component.id, qty });
  }
  const bom = {
    id: uid('bom'),
    name,
    outputItemId: output.id,
    outputQty,
    components,
    createdAt: new Date().toISOString(),
  };
  company.boms.push(bom);
  return { ok: true, bom };
}

export function bomUsage(company, bomId) {
  return (company.manufactures ?? []).filter((manufacture) => manufacture.bomId === bomId).length;
}

export function deleteBom(company, bomId) {
  const bom = (company.boms ?? []).find((entry) => entry.id === bomId);
  if (!bom) return { ok: false, error: 'BOM not found.' };
  const used = bomUsage(company, bomId);
  if (used > 0) {
    return { ok: false, error: `BOM "${bom.name}" is used by ${used} production entry(s). Delete those first.` };
  }
  company.boms = (company.boms ?? []).filter((entry) => entry.id !== bomId);
  return { ok: true, bom };
}

export function addManufacture(company, input) {
  const date = String(input.date ?? '');
  if (!isValidIsoDate(date)) return { ok: false, error: 'Enter a valid production date.' };
  seedYears(company);
  const year = yearForDate(company, date);
  if (!year) return { ok: false, error: 'The production date must fall inside a financial year.' };
  if (year.closed) return { ok: false, error: 'The financial year is closed. Reopen it before recording production.' };
  const bom = (company.boms ?? []).find((entry) => entry.id === input.bomId);
  if (!bom) return { ok: false, error: 'Choose a bill of materials.' };
  const output = (company.stockItems ?? []).find((item) => item.id === bom.outputItemId);
  if (!output) return { ok: false, error: 'The BOM finished item no longer exists.' };
  const outputQty = parseQty(input.outputQty);
  if (outputQty === null || outputQty <= 0) {
    return { ok: false, error: 'Production quantity must be greater than zero.' };
  }
  const wastageQty = parseQty(input.wastageQty ?? 0);
  if (wastageQty === null || wastageQty < 0) {
    return { ok: false, error: 'Wastage quantity must be zero or more.' };
  }
  const componentGodown = (company.godowns ?? []).find((godown) => godown.id === input.componentGodownId);
  const outputGodown = (company.godowns ?? []).find((godown) => godown.id === input.outputGodownId);
  if (!componentGodown || !outputGodown) return { ok: false, error: 'Choose both the component and output godown.' };
  const outputBatchNo = String(input.outputBatchNo ?? '').trim().slice(0, 30);
  if (output.batchTracking && !outputBatchNo) {
    return { ok: false, error: `Batch is required for finished item "${output.name}".` };
  }
  const expiryDate = String(input.expiryDate ?? '').trim();
  if (expiryDate && !isValidIsoDate(expiryDate)) return { ok: false, error: 'Enter a valid batch expiry date.' };
  const factor = (outputQty + wastageQty) / bom.outputQty;
  const components = [];
  for (const line of bom.components ?? []) {
    const item = (company.stockItems ?? []).find((entry) => entry.id === line.stockItemId);
    if (!item) return { ok: false, error: 'A BOM component no longer exists.' };
    const qty = round3(line.qty * factor);
    if (qty <= 0) return { ok: false, error: `Consumption of "${item.name}" rounds to zero.` };
    const available = stockOnHand(company, item.id, date, { godownId: componentGodown.id });
    if (qty > available + 0.0005) {
      const unit = (company.units ?? []).find((entry) => entry.id === item.unitId)?.symbol ?? '';
      return {
        ok: false,
        error: `Only ${Number(available.toFixed(3))} ${unit} of "${item.name}" in ${componentGodown.name} on ${dateLabel(date)}; production needs ${qty}.`,
      };
    }
    components.push({ stockItemId: item.id, qty });
  }
  company.manufactures = company.manufactures ?? [];
  company.counters = company.counters ?? {};
  const sequence = (Number(company.counters.__manufacture) || 0) + 1;
  company.counters.__manufacture = sequence;
  const manufacture = {
    id: uid('mfg'),
    no: sequence,
    date,
    bomId: bom.id,
    bomName: bom.name,
    bomOutputQty: bom.outputQty,
    outputItemId: output.id,
    outputQty,
    ...(wastageQty ? { wastageQty } : {}),
    componentGodownId: componentGodown.id,
    outputGodownId: outputGodown.id,
    components,
    ...(output.batchTracking && outputBatchNo ? { outputBatchNo } : {}),
    ...(output.batchTracking && expiryDate ? { expiryDate } : {}),
    narration: String(input.narration ?? '').trim().slice(0, 400),
    createdAt: new Date().toISOString(),
  };
  company.manufactures.push(manufacture);
  return { ok: true, manufacture };
}

export function deleteManufacture(company, manufactureId) {
  const manufacture = (company.manufactures ?? []).find((entry) => entry.id === manufactureId);
  if (!manufacture) return { ok: false, error: 'Production entry not found.' };
  company.manufactures = (company.manufactures ?? []).filter((entry) => entry.id !== manufactureId);
  return { ok: true, manufacture };
}

export function deleteStockItem(company, itemId) {
  const item = (company.stockItems ?? []).find((entry) => entry.id === itemId);
  if (!item) return { ok: false, error: 'Stock item not found.' };
  const used = stockItemUsage(company, itemId);
  if (used > 0) {
    return {
      ok: false,
      error: `"${item.name}" is used in ${used} voucher(s). Delete those vouchers first.`,
    };
  }
  company.stockItems = company.stockItems.filter((entry) => entry.id !== itemId);
  return { ok: true, item };
}

function descendantGroupIds(company, groupId) {
  const ids = new Set([groupId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of company.groups) {
      if (group.parentId && ids.has(group.parentId) && !ids.has(group.id)) {
        ids.add(group.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function updateGroup(company, groupId, input) {
  const group = groupById(company, groupId);
  if (!group) return { ok: false, error: 'Group not found.' };

  const name = String(input.name ?? group.name).trim();
  if (!name) return { ok: false, error: 'Group name is required.' };
  if (name.length > 80) return { ok: false, error: 'Group name must be 80 characters or fewer.' };
  if (
    company.groups.some(
      (item) => item.id !== group.id && item.name.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    return { ok: false, error: `A group named "${name}" already exists.` };
  }

  const parentId = input.parentId === undefined ? group.parentId : input.parentId || null;
  if (parentId !== group.parentId && !group.custom) {
    return { ok: false, error: 'Only custom groups can be moved.' };
  }
  if (parentId === group.id) return { ok: false, error: 'A group cannot be its own parent.' };
  if (parentId) {
    const parent = groupById(company, parentId);
    if (!parent) return { ok: false, error: 'Choose a valid parent group.' };
    if (descendantGroupIds(company, group.id).has(parent.id)) {
      return { ok: false, error: 'A group cannot be moved under its own descendant.' };
    }
  }

  const primary = parentId ? primaryGroupOf(company, parentId) : group;
  group.name = name;
  group.parentId = parentId;
  if (primary) group.nature = primary.nature;
  return { ok: true, group };
}

export function groupInUse(company, groupId) {
  const inTree = new Set([groupId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of company.groups) {
      if (group.parentId && inTree.has(group.parentId) && !inTree.has(group.id)) {
        inTree.add(group.id);
        changed = true;
      }
    }
  }
  return {
    ledgers: company.ledgers.filter((ledger) => inTree.has(ledger.groupId)).length,
    subgroups: company.groups.filter((group) => group.id !== groupId && inTree.has(group.id)).length,
  };
}

export function deleteGroup(company, groupId) {
  const group = groupById(company, groupId);
  if (!group) return { ok: false, error: 'Group not found.' };
  if (!group.custom) return { ok: false, error: 'Standard groups cannot be deleted.' };
  const usage = groupInUse(company, groupId);
  if (usage.ledgers > 0) {
    return { ok: false, error: `Move the ${usage.ledgers} ledger(s) in this group first.` };
  }
  if (usage.subgroups > 0) {
    return { ok: false, error: `Delete the ${usage.subgroups} sub-group(s) first.` };
  }
  const budgeted = (company.budgets ?? []).filter(
    (budget) => budget.targetType === 'group' && budget.targetId === groupId,
  ).length;
  if (budgeted > 0) {
    return { ok: false, error: `"${group.name}" is used by ${budgeted} budget(s). Delete those budgets first.` };
  }
  company.groups = company.groups.filter((item) => item.id !== groupId);
  return { ok: true, group };
}

export function updateLedger(company, ledgerId, input) {
  const ledger = company.ledgers.find((item) => item.id === ledgerId);
  if (!ledger) return { ok: false, error: 'Ledger not found.' };

  const name = String(input.name ?? ledger.name).trim();
  if (!name) return { ok: false, error: 'Ledger name is required.' };
  if (name.length > 80) return { ok: false, error: 'Ledger name must be 80 characters or fewer.' };
  const clash = findLedgerByName(company, name);
  if (clash && clash.id !== ledger.id) {
    return { ok: false, error: `A ledger named "${name}" already exists.` };
  }

  const group = groupById(company, input.groupId ?? ledger.groupId);
  if (!group) return { ok: false, error: 'Choose a group for the ledger.' };

  const opening = parseAmount(input.opening ?? ledger.opening);
  if (opening === null || opening < 0) {
    return { ok: false, error: 'Opening balance must be a number of zero or more.' };
  }

  const party = ledgerTaxDetails(input, ledger);
  if (party.error) return { ok: false, error: party.error };
  const credit = ledgerCreditLimit(input, ledger);
  if (credit.error) return { ok: false, error: credit.error };
  const interest = ledgerInterestRate(input, ledger);
  if (interest.error) return { ok: false, error: interest.error };

  ledger.name = name;
  ledger.groupId = group.id;
  ledger.opening = round2(opening);
  ledger.openingType = input.openingType === 'Cr' ? 'Cr' : 'Dr';
  if (credit.limit !== null) ledger.creditLimit = credit.limit;
  else delete ledger.creditLimit;
  if (interest.rate !== null) ledger.interestRate = interest.rate;
  else delete ledger.interestRate;
  if (input.gstin !== undefined) {
    if (party.details.gstin) ledger.gstin = party.details.gstin;
    else delete ledger.gstin;
  }
  if (input.stateCode !== undefined) {
    if (party.details.stateCode) ledger.stateCode = party.details.stateCode;
    else delete ledger.stateCode;
  }
  if (input.pan !== undefined) {
    if (party.details.pan) ledger.pan = party.details.pan;
    else delete ledger.pan;
  }
  for (const field of ['address', 'city', 'pin']) {
    if (input[field] === undefined) continue;
    if (party.details[field]) ledger[field] = party.details[field];
    else delete ledger[field];
  }
  pruneBankReconciliations(company);
  return { ok: true, ledger };
}

export function ledgerUsage(company, ledgerId) {
  return company.vouchers.filter((voucher) =>
    (voucher.lines ?? []).some((line) => line.ledgerId === ledgerId),
  ).length;
}

export function deleteLedger(company, ledgerId) {
  const ledger = company.ledgers.find((item) => item.id === ledgerId);
  if (!ledger) return { ok: false, error: 'Ledger not found.' };
  const used = ledgerUsage(company, ledgerId);
  if (used > 0) {
    return {
      ok: false,
      error: `"${ledger.name}" is used in ${used} voucher${used === 1 ? '' : 's'}. Delete those vouchers first.`,
    };
  }
  const budgeted = (company.budgets ?? []).filter(
    (budget) => budget.targetType === 'ledger' && budget.targetId === ledgerId,
  ).length;
  if (budgeted > 0) {
    return { ok: false, error: `"${ledger.name}" is used by ${budgeted} budget(s). Delete those budgets first.` };
  }
  company.ledgers = company.ledgers.filter((item) => item.id !== ledgerId);
  if (company.bankReconciliations) delete company.bankReconciliations[ledgerId];
  return { ok: true, ledger };
}

export function updateCompany(company, input) {
  const name = String(input.name ?? company.name).trim();
  if (!name) return { ok: false, error: 'Company name is required.' };
  if (name.length > 80) return { ok: false, error: 'Company name must be 80 characters or fewer.' };

  seedYears(company);
  const fyStart = input.fyStart ?? company.fyStart;
  if (!isValidIsoDate(fyStart)) return { ok: false, error: 'Enter a valid financial year start date.' };
  if (fyStart !== company.years[0].start) {
    if (company.years.length > 1) {
      return { ok: false, error: 'This company has multiple financial years. Rename it here and manage years in the Financial years panel.' };
    }
    if (company.vouchers.length > 0) {
      return { ok: false, error: 'The first financial year cannot move once vouchers exist.' };
    }
    if (fyStart > company.years[0].end) {
      return { ok: false, error: 'The financial year start must not be after its end.' };
    }
    company.years[0].start = fyStart;
    company.years[0].end = fyEndFor(fyStart);
    selectYear(company, company.years[0].id);
  }

  company.name = name;
  if (input.requireApproval !== undefined) {
    company.approvalsRequired = Boolean(input.requireApproval);
  }
  if (input.approvalThreshold !== undefined) {
    const threshold = Number(input.approvalThreshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1_000_000_000_000) {
      return { ok: false, error: 'Approval threshold must be zero or a positive amount.' };
    }
    company.approvalThreshold = round2(threshold);
  }
  return { ok: true, company };
}

export function deleteCompany(state, companyId) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) return { ok: false, error: 'Company not found.' };
  state.companies = state.companies.filter((item) => item.id !== companyId);
  if (state.activeCompanyId === companyId) {
    state.activeCompanyId = state.companies[0]?.id ?? null;
  }
  return { ok: true, company };
}

export function exportState(state) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

function validateImportedCompany(company) {
  if (!company || typeof company !== 'object') return 'A company entry is not an object.';
  const name = String(company.name ?? '').trim();
  if (!name) return 'A company is missing its name.';
  if (!isValidIsoDate(company.fyStart)) return `Company "${name}" has an invalid financial year.`;
  if (company.years !== undefined) {
    if (!Array.isArray(company.years) || company.years.length === 0) {
      return `Company "${name}" has invalid financial years.`;
    }
    const seenYears = new Set();
    const sorted = [...company.years].sort((a, b) => String(a?.start).localeCompare(String(b?.start)));
    for (const [index, year] of sorted.entries()) {
      if (!year || !isValidIsoDate(year.start) || !isValidIsoDate(year.end) || year.start > year.end) {
        return `Company "${name}" has a financial year with invalid dates.`;
      }
      if (year.id && seenYears.has(year.id)) return `Company "${name}" has duplicate financial year ids.`;
      if (year.id) seenYears.add(year.id);
      const previous = sorted[index - 1];
      if (previous && year.start <= previous.end) {
        return `Company "${name}" has overlapping financial years.`;
      }
    }
  }
  const currencyCodes = new Set();
  if (company.currencies !== undefined) {
    if (!Array.isArray(company.currencies)) return `Company "${name}" has invalid currencies.`;
    const seenCurrencyIds = new Set();
    const seenCurrencyNames = new Set();
    for (const currency of company.currencies) {
      const code = String(currency?.code ?? '').trim().toUpperCase();
      const currencyName = String(currency?.name ?? '').trim();
      if (!currency?.id || !/^[A-Z]{2,5}$/.test(code) || code === BASE_CURRENCY_CODE || !currencyName) {
        return `Company "${name}" has an invalid currency.`;
      }
      if (seenCurrencyIds.has(currency.id) || currencyCodes.has(code) || seenCurrencyNames.has(currencyName.toLowerCase())) {
        return `Company "${name}" has duplicate currencies.`;
      }
      if (!Array.isArray(currency.rates) || currency.rates.length === 0) {
        return `Company "${name}": currency ${code} has no exchange rates.`;
      }
      const rateDates = new Set();
      for (const rate of currency.rates) {
        if (!isValidIsoDate(rate?.date) || parseAmount(rate.rate) === null || parseAmount(rate.rate) <= 0) {
          return `Company "${name}": currency ${code} has an invalid exchange rate.`;
        }
        if (rateDates.has(rate.date)) return `Company "${name}": currency ${code} has duplicate rate dates.`;
        rateDates.add(rate.date);
      }
      seenCurrencyIds.add(currency.id);
      currencyCodes.add(code);
      seenCurrencyNames.add(currencyName.toLowerCase());
    }
  }

  const costCategoryIds = new Set();
  const costCategoryNames = new Set();
  if (company.costCategories !== undefined) {
    if (!Array.isArray(company.costCategories)) {
      return `Company "${name}" has invalid cost categories.`;
    }
    for (const category of company.costCategories) {
      const categoryName = String(category?.name ?? '').trim();
      if (!category?.id || !categoryName) {
        return `Company "${name}" has a cost category without an id or name.`;
      }
      const key = categoryName.toLowerCase();
      if (costCategoryIds.has(category.id) || costCategoryNames.has(key)) {
        return `Company "${name}" has duplicate cost categories.`;
      }
      costCategoryIds.add(category.id);
      costCategoryNames.add(key);
    }
  }
  const costCentreIds = new Set();
  const costCentreNames = new Set();
  if (company.costCentres !== undefined) {
    if (!Array.isArray(company.costCentres)) {
      return `Company "${name}" has invalid cost centres.`;
    }
    for (const centre of company.costCentres) {
      const centreName = String(centre?.name ?? '').trim();
      if (!centre?.id || !centreName || !costCategoryIds.has(centre.categoryId)) {
        return `Company "${name}" has a cost centre with an invalid category.`;
      }
      const key = centreName.toLowerCase();
      if (costCentreIds.has(centre.id) || costCentreNames.has(key)) {
        return `Company "${name}" has duplicate cost centres.`;
      }
      costCentreIds.add(centre.id);
      costCentreNames.add(key);
    }
  }
  for (const field of ['groups', 'ledgers', 'vouchers']) {
    if (!Array.isArray(company[field])) return `Company "${name}" is missing its ${field}.`;
  }

  const groupIds = new Set();
  for (const group of company.groups) {
    if (!group || !group.id || !String(group.name ?? '').trim()) {
      return `Company "${name}" has a group without an id or name.`;
    }
    if (groupIds.has(group.id)) return `Company "${name}" has duplicate group ids.`;
    groupIds.add(group.id);
  }
  for (const group of company.groups) {
    if (group.parentId && !groupIds.has(group.parentId)) {
      return `Company "${name}": group "${group.name}" points at a missing parent.`;
    }
  }

  const ledgerIds = new Set();
  for (const ledger of company.ledgers) {
    if (!ledger || !ledger.id || !String(ledger.name ?? '').trim()) {
      return `Company "${name}" has a ledger without an id or name.`;
    }
    if (ledgerIds.has(ledger.id)) return `Company "${name}" has duplicate ledger ids.`;
    if (ledger.creditLimit !== undefined) {
      const limit = parseAmount(ledger.creditLimit);
      if (limit === null || limit < 0) {
        return `Company "${name}": ledger "${ledger.name}" has an invalid credit limit.`;
      }
    }
    if (ledger.interestRate !== undefined) {
      const rate = parseAmount(ledger.interestRate);
      if (rate === null || rate < 0 || rate > 100) {
        return `Company "${name}": ledger "${ledger.name}" has an invalid interest rate.`;
      }
    }
    if (!groupIds.has(ledger.groupId)) {
      return `Company "${name}": ledger "${ledger.name}" points at a missing group.`;
    }
    ledgerIds.add(ledger.id);
  }

  const seenGstRoles = new Set();
  const seenTdsRoles = new Set();
  for (const ledger of company.ledgers) {
    if (ledger.gstRole !== undefined) {
      if (!GST_ROLES[ledger.gstRole] || seenGstRoles.has(ledger.gstRole)) {
        return `Company "${name}": ledger "${ledger.name}" has an invalid or duplicate GST role.`;
      }
      seenGstRoles.add(ledger.gstRole);
    }
    if (ledger.tdsRole !== undefined) {
      if (!['TDS', 'TCS'].includes(ledger.tdsRole) || seenTdsRoles.has(ledger.tdsRole)) {
        return `Company "${name}": ledger "${ledger.name}" has an invalid or duplicate TDS/TCS role.`;
      }
      seenTdsRoles.add(ledger.tdsRole);
    }
    if (ledger.pan !== undefined && !isValidPan(ledger.pan)) {
      return `Company "${name}": ledger "${ledger.name}" has an invalid PAN.`;
    }
    if (ledger.address !== undefined && String(ledger.address ?? '').length > 200) {
      return `Company "${name}": ledger "${ledger.name}" has an address longer than 200 characters.`;
    }
    if (ledger.city !== undefined && String(ledger.city ?? '').length > 80) {
      return `Company "${name}": ledger "${ledger.name}" has a city longer than 80 characters.`;
    }
    if (ledger.pin !== undefined && ledger.pin !== '' && !/^[0-9]{6}$/.test(String(ledger.pin))) {
      return `Company "${name}": ledger "${ledger.name}" has an invalid PIN code.`;
    }
  }

  if (company.gst !== undefined) {
    const gst = company.gst;
    if (!gst || typeof gst !== 'object' || Array.isArray(gst)) {
      return `Company "${name}" has invalid GST settings.`;
    }
    if (gst.enabled !== undefined && typeof gst.enabled !== 'boolean') {
      return `Company "${name}" has an invalid GST enabled flag.`;
    }
    if (gst.gstin && !isValidGstin(gst.gstin)) {
      return `Company "${name}" has an invalid GSTIN.`;
    }
    if (gst.enabled && !gst.gstin) return `Company "${name}" has GST enabled without a GSTIN.`;
    if (gst.stateCode && !GST_STATES.some(([code]) => code === String(gst.stateCode))) {
      return `Company "${name}" has an invalid GST home state.`;
    }
    if (gst.pin !== undefined && gst.pin !== '' && !/^[0-9]{6}$/.test(String(gst.pin))) {
      return `Company "${name}" has an invalid GST PIN code.`;
    }
    if (gst.address !== undefined && String(gst.address ?? '').length > 200) {
      return `Company "${name}" has a GST address longer than 200 characters.`;
    }
    if (!Array.isArray(gst.rates) || gst.rates.length === 0) {
      return `Company "${name}" has no GST rate master.`;
    }
    const seenRateIds = new Set();
    const seenRateValues = new Set();
    for (const rate of gst.rates) {
      const value = parseAmount(rate?.rate);
      const cess = parseAmount(rate?.cess ?? 0);
      if (!rate?.id || !String(rate.label ?? '').trim() || String(rate.label).length > 40) {
        return `Company "${name}" has an invalid GST rate entry.`;
      }
      if (value === null || value < 0 || value > 50 || cess === null || cess < 0 || cess > 50) {
        return `Company "${name}" has a GST rate outside 0–50%.`;
      }
      const key = `${value}:${cess}`;
      if (seenRateIds.has(rate.id) || seenRateValues.has(key)) {
        return `Company "${name}" has duplicate GST rates.`;
      }
      seenRateIds.add(rate.id);
      seenRateValues.add(key);
    }
  }

  if (company.tds !== undefined) {
    const tds = company.tds;
    if (!tds || typeof tds !== 'object' || Array.isArray(tds)) {
      return `Company "${name}" has invalid TDS/TCS settings.`;
    }
    if (tds.enabled !== undefined && typeof tds.enabled !== 'boolean') {
      return `Company "${name}" has an invalid TDS/TCS enabled flag.`;
    }
    if (tds.tan && !isValidTan(tds.tan)) return `Company "${name}" has an invalid TAN.`;
    if (tds.enabled && !tds.tan) return `Company "${name}" has TDS/TCS enabled without a TAN.`;
    if (!Array.isArray(tds.sections) || tds.sections.length === 0) {
      return `Company "${name}" has no TDS/TCS section master.`;
    }
    const seenSectionIds = new Set();
    const seenSectionCodes = new Set();
    for (const section of tds.sections) {
      if (!section?.id || !String(section.code ?? '').trim() || String(section.code).length > 12) {
        return `Company "${name}" has an invalid TDS/TCS section.`;
      }
      if (!['TDS', 'TCS'].includes(section.kind)) {
        return `Company "${name}": section ${section.code} has an invalid kind.`;
      }
      if (!String(section.label ?? '').trim() || String(section.label).length > 60) {
        return `Company "${name}": section ${section.code} has an invalid label.`;
      }
      const rate = parseAmount(section.rate);
      const threshold = parseAmount(section.threshold ?? 0);
      if (rate === null || rate < 0 || rate > 100 || threshold === null || threshold < 0) {
        return `Company "${name}": section ${section.code} has an invalid rate or threshold.`;
      }
      const codeKey = `${section.kind}:${String(section.code).toUpperCase()}`;
      if (seenSectionIds.has(section.id) || seenSectionCodes.has(codeKey)) {
        return `Company "${name}" has duplicate TDS/TCS sections.`;
      }
      seenSectionIds.add(section.id);
      seenSectionCodes.add(codeKey);
    }
  }

  if (company.taxChallans !== undefined) {
    if (!Array.isArray(company.taxChallans)) return `Company "${name}" has invalid tax challans.`;
    const seenChallanIds = new Set();
    for (const challan of company.taxChallans) {
      const amount = parseAmount(challan?.amount);
      if (!challan?.id || !['TDS', 'TCS'].includes(challan.kind) || !isValidIsoDate(String(challan.date ?? ''))) {
        return `Company "${name}" has an invalid tax challan.`;
      }
      if (amount === null || amount <= 0) {
        return `Company "${name}": a tax challan has an invalid amount.`;
      }
      if (seenChallanIds.has(challan.id)) return `Company "${name}" has duplicate tax challans.`;
      seenChallanIds.add(challan.id);
    }
  }

  if (company.payroll !== undefined) {
    const payroll = company.payroll;
    if (!payroll || typeof payroll !== 'object' || Array.isArray(payroll)) {
      return `Company "${name}" has invalid payroll settings.`;
    }
    if (payroll.enabled !== undefined && typeof payroll.enabled !== 'boolean') {
      return `Company "${name}" has an invalid payroll enabled flag.`;
    }
    if (!Array.isArray(payroll.payHeads)) return `Company "${name}" has invalid pay heads.`;
    const seenHeadIds = new Set();
    const seenHeadNames = new Set();
    const earningHeadIds = new Set();
    for (const head of payroll.payHeads) {
      const headName = String(head?.name ?? '').trim();
      if (!head?.id || !headName || headName.length > 60 || seenHeadIds.has(head.id)) {
        return `Company "${name}" has an invalid pay head.`;
      }
      if (seenHeadNames.has(headName.toUpperCase())) return `Company "${name}" has duplicate pay heads.`;
      if (!PAY_HEAD_KINDS[head.kind]) return `Company "${name}": pay head "${headName}" has an invalid kind.`;
      if (head.ledgerId && !ledgerIds.has(head.ledgerId)) {
        return `Company "${name}": pay head "${headName}" points at a missing ledger.`;
      }
      if (head.statutory !== undefined && String(head.statutory).length > 12) {
        return `Company "${name}": pay head "${headName}" has an invalid statutory tag.`;
      }
      seenHeadIds.add(head.id);
      seenHeadNames.add(headName.toUpperCase());
      if (head.kind === 'Earning') earningHeadIds.add(head.id);
    }
    if (!Array.isArray(payroll.employees)) return `Company "${name}" has invalid employee data.`;
    const seenEmployeeIds = new Set();
    const seenEmployeeNames = new Set();
    for (const employee of payroll.employees) {
      const employeeName = String(employee?.name ?? '').trim();
      if (!employee?.id || !employeeName || employeeName.length > 80 || seenEmployeeIds.has(employee.id)) {
        return `Company "${name}" has an invalid employee.`;
      }
      if (seenEmployeeNames.has(employeeName.toUpperCase())) return `Company "${name}" has duplicate employees.`;
      seenEmployeeIds.add(employee.id);
      seenEmployeeNames.add(employeeName.toUpperCase());
      if (employee.pan && !isValidPan(employee.pan)) {
        return `Company "${name}": employee "${employeeName}" has an invalid PAN.`;
      }
      if (employee.dateOfJoining && !isValidIsoDate(employee.dateOfJoining)) {
        return `Company "${name}": employee "${employeeName}" has an invalid date of joining.`;
      }
      if (!Array.isArray(employee.pay)) return `Company "${name}": employee "${employeeName}" has no pay structure.`;
      let earns = false;
      for (const entry of employee.pay) {
        const amount = parseAmount(entry?.amount);
        if (!entry?.payHeadId || !seenHeadIds.has(entry.payHeadId) || amount === null || amount <= 0) {
          return `Company "${name}": employee "${employeeName}" has an invalid pay entry.`;
        }
        if (earningHeadIds.has(entry.payHeadId)) earns = true;
      }
      if (employee.active !== false && !earns) {
        return `Company "${name}": employee "${employeeName}" has no earnings.`;
      }
    }
    if (payroll.salaryPayableLedgerId && !ledgerIds.has(payroll.salaryPayableLedgerId)) {
      return `Company "${name}" has a missing Salary Payable ledger.`;
    }
    if (!Array.isArray(payroll.runs)) return `Company "${name}" has invalid payroll runs.`;
    const payrollVoucherIds = new Set(company.vouchers.map((voucher) => voucher.id));
    const runIds = new Set();
    const runMonths = new Set();
    for (const run of payroll.runs) {
      if (!run?.id || runIds.has(run.id) || !payrollMonthEnd(run.month)) {
        return `Company "${name}" has an invalid payroll run.`;
      }
      if (runMonths.has(run.month)) return `Company "${name}" has duplicate payroll months.`;
      if (!isValidIsoDate(String(run.date ?? '')) || String(run.date).slice(0, 7) !== run.month) {
        return `Company "${name}": payroll run ${run.month} has an invalid date.`;
      }
      if (run.voucherId && !payrollVoucherIds.has(run.voucherId)) {
        return `Company "${name}": payroll run ${run.month} points at a missing voucher.`;
      }
      if (!Array.isArray(run.rows) || !run.rows.length) {
        return `Company "${name}": payroll run ${run.month} has no employee rows.`;
      }
      let gross = 0;
      let deductions = 0;
      let net = 0;
      for (const row of run.rows) {
        const rowGross = parseAmount(row?.gross);
        const rowDeductions = parseAmount(row?.deductionTotal);
        const rowNet = parseAmount(row?.net);
        if (!row?.employeeId || rowGross === null || rowDeductions === null || rowNet === null) {
          return `Company "${name}": payroll run ${run.month} has an invalid employee row.`;
        }
        if (rowGross <= 0 || rowDeductions < 0 || rowNet < 0 || Math.abs(round2(rowGross - rowDeductions) - rowNet) >= 0.01) {
          return `Company "${name}": payroll run ${run.month} does not reconcile an employee row.`;
        }
        gross = round2(gross + rowGross);
        deductions = round2(deductions + rowDeductions);
        net = round2(net + rowNet);
      }
      const totals = run.totals ?? {};
      if (
        Math.abs((parseAmount(totals.gross) ?? 0) - gross) >= 0.01 ||
        Math.abs((parseAmount(totals.deductions) ?? 0) - deductions) >= 0.01 ||
        Math.abs((parseAmount(totals.net) ?? 0) - net) >= 0.01
      ) {
        return `Company "${name}": payroll run ${run.month} has inconsistent totals.`;
      }
      runIds.add(run.id);
      runMonths.add(run.month);
    }
  }

  if (company.budgets !== undefined) {
    if (!Array.isArray(company.budgets)) return `Company "${name}" has invalid budgets.`;
    const seenBudgetIds = new Set();
    const seenBudgetNames = new Set();
    const seenBudgetTargets = new Set();
    const yearIds = new Set((company.years ?? []).map((year) => year.id));
    for (const budget of company.budgets) {
      const budgetName = String(budget?.name ?? '').trim();
      const targetType = budget?.targetType;
      if (!budget?.id || !budgetName || !['ledger', 'group'].includes(targetType)) {
        return `Company "${name}" has an invalid budget.`;
      }
      if (targetType === 'group' && !groupIds.has(budget.targetId)) {
        return `Company "${name}": budget "${budgetName}" points at a missing group.`;
      }
      if (targetType === 'ledger' && !ledgerIds.has(budget.targetId)) {
        return `Company "${name}": budget "${budgetName}" points at a missing ledger.`;
      }
      if (!yearIds.has(budget.yearId)) {
        return `Company "${name}": budget "${budgetName}" points at a missing financial year.`;
      }
      if (parseAmount(budget.amount) === null || parseAmount(budget.amount) < 0) {
        return `Company "${name}": budget "${budgetName}" has an invalid amount.`;
      }
      const nameKey = budgetName.toLowerCase();
      const targetKey = `${targetType}:${budget.targetId}:${budget.yearId}`;
      if (seenBudgetIds.has(budget.id) || seenBudgetNames.has(nameKey) || seenBudgetTargets.has(targetKey)) {
        return `Company "${name}" has duplicate budgets.`;
      }
      seenBudgetIds.add(budget.id);
      seenBudgetNames.add(nameKey);
      seenBudgetTargets.add(targetKey);
    }
  }

  const unitIds = new Set();
  for (const unit of company.units ?? []) {
    if (!unit || !unit.id || !String(unit.name ?? '').trim() || !String(unit.symbol ?? '').trim()) {
      return `Company "${name}" has a unit without an id, name or symbol.`;
    }
    if (unitIds.has(unit.id)) return `Company "${name}" has duplicate unit ids.`;
    unitIds.add(unit.id);
  }

  const godownIds = new Set();
  const importedGodowns = Array.isArray(company.godowns) ? company.godowns : [];
  const godowns = importedGodowns.length
    ? importedGodowns
    : [{ id: '__main__', name: 'Main Location', primary: true }];
  for (const godown of godowns) {
    if (!godown || !godown.id || !String(godown.name ?? '').trim()) {
      return `Company "${name}" has a godown without an id or name.`;
    }
    if (godownIds.has(godown.id)) return `Company "${name}" has duplicate godown ids.`;
    godownIds.add(godown.id);
  }

  const stockGroupIds = new Set();
  const stockGroups = company.stockGroups ?? [];
  for (const group of stockGroups) {
    if (!group || !group.id || !String(group.name ?? '').trim()) {
      return `Company "${name}" has a stock group without an id or name.`;
    }
    if (stockGroupIds.has(group.id)) return `Company "${name}" has duplicate stock group ids.`;
    stockGroupIds.add(group.id);
  }

  const stockItemIds = new Set();
  const stockItems = company.stockItems ?? [];
  for (const item of stockItems) {
    if (!item || !item.id || !String(item.name ?? '').trim()) {
      return `Company "${name}" has a stock item without an id or name.`;
    }
    if (stockItemIds.has(item.id)) return `Company "${name}" has duplicate stock item ids.`;
    if (!unitIds.has(item.unitId)) {
      return `Company "${name}": stock item "${item.name}" points at a missing unit.`;
    }
    if (!stockGroupIds.has(item.stockGroupId)) {
      return `Company "${name}": stock item "${item.name}" points at a missing stock group.`;
    }
    if (parseQty(item.openingQty ?? 0) === null || parseQty(item.openingQty ?? 0) < 0) {
      return `Company "${name}": stock item "${item.name}" has an invalid opening quantity.`;
    }
    if (parseAmount(item.openingRate ?? 0) === null || parseAmount(item.openingRate ?? 0) < 0) {
      return `Company "${name}": stock item "${item.name}" has an invalid opening rate.`;
    }
    if (item.openingBatches !== undefined) {
      if (!Array.isArray(item.openingBatches)) {
        return `Company "${name}": stock item "${item.name}" has invalid opening batches.`;
      }
      if (item.openingBatches.length && !item.batchTracking) {
        return `Company "${name}": stock item "${item.name}" has opening batches but does not track batches.`;
      }
      const names = new Set();
      let total = 0;
      for (const batch of item.openingBatches) {
        const batchNo = String(batch?.batchNo ?? '').trim();
        const qty = parseQty(batch?.qty);
        if (!batchNo || qty === null || qty <= 0) {
          return `Company "${name}": stock item "${item.name}" has an invalid opening batch.`;
        }
        if (names.has(batchNo.toLowerCase())) {
          return `Company "${name}": stock item "${item.name}" repeats opening batch "${batchNo}".`;
        }
        if (batch.expiryDate && !isValidIsoDate(batch.expiryDate)) {
          return `Company "${name}": stock item "${item.name}" has an invalid opening batch expiry.`;
        }
        names.add(batchNo.toLowerCase());
        total += qty;
      }
      if (
        item.openingBatches.length &&
        Math.abs(round3(total) - (parseQty(item.openingQty ?? 0) ?? 0)) >= 0.0005
      ) {
        return `Company "${name}": stock item "${item.name}" opening batches do not add up to its opening quantity.`;
      }
    }
    if (item.hsn !== undefined && !/^[0-9A-Z]{4,8}$/.test(String(item.hsn))) {
      return `Company "${name}": stock item "${item.name}" has an invalid HSN/SAC.`;
    }
    stockItemIds.add(item.id);
  }

  const voucherIds = new Set();
  for (const voucher of company.vouchers) {
    if (voucher && voucher.id) voucherIds.add(voucher.id);
  }

  for (const voucher of company.vouchers) {
    if (!voucher || !voucher.id || !VOUCHER_TYPES[voucher.type]) {
      return `Company "${name}" has a voucher of an unknown type.`;
    }
    if (!isValidIsoDate(voucher.date)) {
      return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid date.`;
    }
    if (
      Array.isArray(company.years) &&
      company.years.length > 0 &&
      !company.years.some((year) => voucher.date >= year.start && voucher.date <= year.end)
    ) {
      return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} falls outside every financial year.`;
    }
    if (!Array.isArray(voucher.lines) || voucher.lines.length < 2) {
      return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has too few lines.`;
    }
    let debit = 0;
    let credit = 0;
    for (const line of voucher.lines) {
      if (!ledgerIds.has(line.ledgerId)) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} uses a missing ledger.`;
      }
      if (line.costCentreId && !costCentreIds.has(line.costCentreId)) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} uses a missing cost centre.`;
      }
      const amount = parseAmount(line.amount);
      if (amount === null || amount <= 0) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has a non-positive amount.`;
      }
      if (line.side === 'Cr') credit = round2(credit + amount);
      else debit = round2(debit + amount);
      if (line.allocations !== undefined) {
        if (!Array.isArray(line.allocations)) {
          return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has invalid bill allocations.`;
        }
        let allocated = 0;
        for (const allocation of line.allocations) {
          if (!voucherIds.has(allocation.voucherId)) {
            return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} settles a missing bill.`;
          }
          const allocationAmount = parseAmount(allocation.amount);
          if (allocationAmount === null || allocationAmount <= 0) {
            return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid bill allocation amount.`;
          }
          allocated = round2(allocated + allocationAmount);
        }
        if (allocated > round2(amount + 0.005)) {
          return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} allocates more than its party line.`;
        }
      }
    }
    if (voucher.instrument !== undefined) {
      const instrument = voucher.instrument;
      if (!instrument || !['Payment', 'Receipt', 'Contra'].includes(voucher.type)) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has cheque/DD details on an unsupported voucher.`;
      }
      if (!['Cheque', 'DD'].includes(instrument.kind)) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid instrument type.`;
      }
      if (!String(instrument.number ?? '').trim() || !isValidIsoDate(String(instrument.date ?? ''))) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid cheque/DD number or date.`;
      }
      if (instrument.status !== undefined && !['Cleared', 'Stopped', 'Cancelled'].includes(instrument.status)) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid cheque/DD status.`;
      }
      if (
        !ledgerIds.has(instrument.bankLedgerId) ||
        !isBankLedger(company, instrument.bankLedgerId) ||
        !(voucher.lines ?? []).some((line) => line.ledgerId === instrument.bankLedgerId)
      ) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has cheque/DD details for a bank not on the voucher.`;
      }
    }
    if (voucher.bill !== undefined) {
      if (!voucher.bill || typeof voucher.bill.ref !== 'string' || String(voucher.bill.ref).length > 40) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid bill reference.`;
      }
      if (voucher.bill.dueDate && !isValidIsoDate(voucher.bill.dueDate)) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid bill due date.`;
      }
    }
    if (voucher.currencyCode !== undefined) {
      const code = String(voucher.currencyCode ?? '').trim().toUpperCase();
      const rate = parseAmount(voucher.exchangeRate);
      if (!currencyCodes.has(code) || code === BASE_CURRENCY_CODE) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} uses a missing currency.`;
      }
      if (rate === null || rate <= 0) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid exchange rate.`;
      }
      let foreignDebit = 0;
      for (const line of voucher.lines) {
        const foreignAmount = parseAmount(line.currencyAmount);
        if (foreignAmount === null || foreignAmount <= 0) {
          return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid foreign amount.`;
        }
        if (Math.abs(round2(foreignAmount * rate) - parseAmount(line.amount)) >= 0.01) {
          return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} does not convert at its exchange rate.`;
        }
        if (line.allocations?.length) {
          return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has bill allocations on a foreign-currency voucher.`;
        }
        if (line.side !== 'Cr') foreignDebit = round2(foreignDebit + foreignAmount);
      }
      if (voucher.items !== undefined) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has stock items on a foreign-currency voucher.`;
      }
      if (Math.abs(foreignDebit - (parseAmount(voucher.currencyTotal) ?? 0)) >= 0.01) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid foreign total.`;
      }
    } else if (voucher.lines.some((line) => line.currencyAmount !== undefined)) {
      return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has a foreign amount without a currency.`;
    }
    if (Math.abs(debit - credit) >= 0.01) {
      return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} is not balanced.`;
    }
    if (voucher.tds !== undefined) {
      const entry = voucher.tds;
      const label = `${voucher.type} ${voucher.no ?? ''}`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return `Company "${name}": voucher ${label} has invalid TDS/TCS details.`;
      }
      if (!['TDS', 'TCS'].includes(entry.kind) || WITHHOLDING_TYPES[entry.kind] !== voucher.type) {
        return `Company "${name}": voucher ${label} has TDS/TCS on an unsupported voucher.`;
      }
      if (voucher.gst) {
        return `Company "${name}": voucher ${label} carries both GST and TDS/TCS.`;
      }
      const base = parseAmount(entry.base);
      const amount = parseAmount(entry.amount);
      if (base === null || base <= 0 || amount === null || amount <= 0) {
        return `Company "${name}": voucher ${label} has an invalid TDS/TCS base or amount.`;
      }
      if (!(company.tds?.sections ?? []).some((section) => section.id === entry.sectionId)) {
        return `Company "${name}": voucher ${label} points at a missing TDS/TCS section.`;
      }
      if (entry.pan && !isValidPan(entry.pan)) {
        return `Company "${name}": voucher ${label} has an invalid deductee PAN.`;
      }
      if (entry.partyLedgerId && !ledgerIds.has(entry.partyLedgerId)) {
        return `Company "${name}": voucher ${label} has TDS/TCS for a missing party ledger.`;
      }
      const ledger = company.ledgers.find((item) => item.tdsRole === entry.kind);
      if (!ledger || !voucher.lines.some((line) => line.ledgerId === ledger.id && line.side === 'Cr' && Math.abs((parseAmount(line.amount) ?? 0) - amount) < 0.01)) {
        return `Company "${name}": voucher ${label} is missing its ${WITHHOLDING_LEDGERS[entry.kind]} line.`;
      }
      const total = parseAmount(voucher.total);
      const expected = entry.kind === 'TDS' ? base : round2(base + amount);
      if (total !== null && Math.abs(total - expected) >= 0.01) {
        return `Company "${name}": voucher ${label} does not reconcile its TDS/TCS deduction with its total.`;
      }
    }

    if (voucher.gst !== undefined) {
      const gst = voucher.gst;
      const label = `${voucher.type} ${voucher.no ?? ''}`;
      if (!gst || typeof gst !== 'object' || Array.isArray(gst) || !GST_VOUCHER_TYPES.includes(voucher.type)) {
        return `Company "${name}": voucher ${label} has GST details on an unsupported voucher.`;
      }
      const taxable = parseAmount(gst.taxable);
      if (taxable === null || taxable <= 0) {
        return `Company "${name}": voucher ${label} has an invalid GST taxable value.`;
      }
      const components = [];
      for (const role of ['cgst', 'sgst', 'igst', 'cess']) {
        const amount = parseAmount(gst[role] ?? 0);
        if (amount === null || amount < 0) {
          return `Company "${name}": voucher ${label} has an invalid ${GST_ROLES[role]} amount.`;
        }
        components.push([role, amount]);
      }
      for (const key of ['rate', 'cessRate']) {
        const value = parseAmount(gst[key] ?? 0);
        if (value === null || value < 0 || value > 50) {
          return `Company "${name}": voucher ${label} has an invalid GST rate.`;
        }
      }
      if (!['Intra', 'Inter'].includes(gst.supplyType)) {
        return `Company "${name}": voucher ${label} has an invalid GST supply type.`;
      }
      if (!GST_STATES.some(([code]) => code === String(gst.placeOfSupply))) {
        return `Company "${name}": voucher ${label} has an invalid GST place of supply.`;
      }
      if (gst.partyGstin && !isValidGstin(gst.partyGstin)) {
        return `Company "${name}": voucher ${label} has an invalid party GSTIN.`;
      }
      if (gst.partyLedgerId && !ledgerIds.has(gst.partyLedgerId)) {
        return `Company "${name}": voucher ${label} has GST details for a missing party ledger.`;
      }
      if (gst.rateId && !(company.gst?.rates ?? []).some((rate) => rate.id === gst.rateId)) {
        return `Company "${name}": voucher ${label} points at a missing GST rate.`;
      }
      const taxTotal = round2(components.reduce((sum, [, amount]) => sum + amount, 0));
      const total = parseAmount(voucher.total);
      if (total !== null && Math.abs(round2(taxable + taxTotal) - total) >= 0.01) {
        return `Company "${name}": voucher ${label} does not reconcile its GST taxable value and tax with its total.`;
      }
      const taxableSide = GST_TAXABLE_SIDE[voucher.type];
      for (const [role, amount] of components) {
        if (amount <= 0) continue;
        const ledger = company.ledgers.find((entry) => entry.gstRole === role);
        if (
          !ledger ||
          !voucher.lines.some(
            (line) =>
              line.ledgerId === ledger.id &&
              line.side === taxableSide &&
              Math.abs((parseAmount(line.amount) ?? 0) - amount) < 0.01,
          )
        ) {
          return `Company "${name}": voucher ${label} is missing its ${GST_ROLES[role]} tax line.`;
        }
      }
    }

    if (voucher.items !== undefined) {
      if (!Array.isArray(voucher.items)) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has invalid inventory lines.`;
      }
      let itemTotal = 0;
      for (const line of voucher.items) {
        if (!stockItemIds.has(line.stockItemId)) {
          return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} uses a missing stock item.`;
        }
        if (line.godownId && !godownIds.has(line.godownId)) {
          return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} uses a missing godown.`;
        }
        const stockItem = stockItems.find((item) => item.id === line.stockItemId);
        if (stockItem?.batchTracking && !String(line.batchNo ?? '').trim()) {
          return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} is missing a batch for "${stockItem.name}".`;
        }
        if (line.expiryDate !== undefined && !isValidIsoDate(line.expiryDate)) {
          return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid batch expiry date.`;
        }
        const qty = parseQty(line.qty);
        const rate = parseAmount(line.rate);
        if (qty === null || qty <= 0 || rate === null || rate < 0) {
          return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} has an invalid stock quantity or rate.`;
        }
        itemTotal = round2(itemTotal + qty * rate);
      }
      const taxableBase = voucher.gst
        ? parseAmount(voucher.gst.taxable) ?? debit
        : voucher.tds
          ? parseAmount(voucher.tds.base) ?? debit
          : debit;
      if (Math.abs(itemTotal - taxableBase) >= 0.01) {
        return `Company "${name}": voucher ${voucher.type} ${voucher.no ?? ''} does not reconcile its stock items with its total.`;
      }
    }
  }
  const transferIds = new Set();
  for (const transfer of company.stockTransfers ?? []) {
    if (!transfer || !transfer.id || !isValidIsoDate(transfer.date)) {
      return `Company "${name}" has an invalid stock transfer.`;
    }
    if (transferIds.has(transfer.id)) return `Company "${name}" has duplicate stock transfer ids.`;
    transferIds.add(transfer.id);
    if (!godownIds.has(transfer.fromGodownId) || !godownIds.has(transfer.toGodownId)) {
      return `Company "${name}": stock transfer ${transfer.no ?? ''} points at a missing godown.`;
    }
    if (transfer.fromGodownId === transfer.toGodownId) {
      return `Company "${name}": stock transfer ${transfer.no ?? ''} has the same source and destination.`;
    }
    if (!Array.isArray(transfer.items) || transfer.items.length === 0) {
      return `Company "${name}": stock transfer ${transfer.no ?? ''} has no items.`;
    }
    for (const line of transfer.items) {
      if (!stockItemIds.has(line.stockItemId)) {
        return `Company "${name}": stock transfer ${transfer.no ?? ''} uses a missing stock item.`;
      }
      const stockItem = stockItems.find((item) => item.id === line.stockItemId);
      if (stockItem?.batchTracking && !String(line.batchNo ?? '').trim()) {
        return `Company "${name}": stock transfer ${transfer.no ?? ''} is missing a batch for "${stockItem.name}".`;
      }
      const qty = parseQty(line.qty);
      if (qty === null || qty <= 0) {
        return `Company "${name}": stock transfer ${transfer.no ?? ''} has an invalid quantity.`;
      }
    }
  }

  const countIds = new Set();
  for (const count of company.stockCounts ?? []) {
    if (!count || !count.id || !isValidIsoDate(count.date)) {
      return `Company "${name}" has an invalid stock count.`;
    }
    if (countIds.has(count.id)) return `Company "${name}" has duplicate stock count ids.`;
    countIds.add(count.id);
    if (!godownIds.has(count.godownId)) {
      return `Company "${name}": stock count ${count.no ?? ''} points at a missing godown.`;
    }
    if (!Array.isArray(count.rows) || count.rows.length === 0) {
      return `Company "${name}": stock count ${count.no ?? ''} has no lines.`;
    }
    const countItems = new Set();
    for (const row of count.rows) {
      if (!stockItemIds.has(row.stockItemId)) {
        return `Company "${name}": stock count ${count.no ?? ''} uses a missing stock item.`;
      }
      const rowKey = `${row.stockItemId}:${String(row.batchNo ?? '').trim()}`;
      if (countItems.has(rowKey)) {
        return `Company "${name}": stock count ${count.no ?? ''} lists an item or batch twice.`;
      }
      countItems.add(rowKey);
      if (String(row.batchNo ?? '').length > 30) {
        return `Company "${name}": stock count ${count.no ?? ''} has an invalid batch.`;
      }
      const countedQty = parseQty(row.countedQty);
      const systemQty = parseQty(row.systemQty ?? 0);
      if (countedQty === null || countedQty < 0 || systemQty === null || systemQty < 0) {
        return `Company "${name}": stock count ${count.no ?? ''} has an invalid quantity.`;
      }
    }
  }

  const adjustmentIds = new Set();
  for (const adjustment of company.stockAdjustments ?? []) {
    if (!adjustment || !adjustment.id || !isValidIsoDate(adjustment.date)) {
      return `Company "${name}" has an invalid stock adjustment.`;
    }
    if (adjustmentIds.has(adjustment.id)) {
      return `Company "${name}" has duplicate stock adjustment ids.`;
    }
    adjustmentIds.add(adjustment.id);
    if (!godownIds.has(adjustment.godownId)) {
      return `Company "${name}": stock adjustment ${adjustment.no ?? ''} points at a missing godown.`;
    }
    if (!Array.isArray(adjustment.rows) || adjustment.rows.length === 0) {
      return `Company "${name}": stock adjustment ${adjustment.no ?? ''} has no lines.`;
    }
    for (const row of adjustment.rows) {
      if (!stockItemIds.has(row.stockItemId) || parseQty(row.difference) === null) {
        return `Company "${name}": stock adjustment ${adjustment.no ?? ''} has an invalid line.`;
      }
    }
  }

  if (company.recurringVouchers !== undefined) {
    if (!Array.isArray(company.recurringVouchers) || company.recurringVouchers.length > 100) {
      return `Company "${name}" has invalid recurring voucher templates.`;
    }
    const templateIds = new Set();
    for (const template of company.recurringVouchers) {
      if (!template || !template.id || templateIds.has(template.id)) {
        return `Company "${name}" has a duplicate or missing recurring template id.`;
      }
      templateIds.add(template.id);
      if (String(template.name ?? '').trim().length === 0 || String(template.name).length > 100) {
        return `Company "${name}" has a recurring template with an invalid name.`;
      }
      if (!VOUCHER_TYPES[template.type] || !['Weekly', 'Monthly', 'Quarterly', 'Yearly'].includes(template.frequency)) {
        return `Company "${name}" has a recurring template with an invalid type or frequency.`;
      }
      if (!isValidIsoDate(template.nextDate)) {
        return `Company "${name}" has a recurring template with an invalid next date.`;
      }
      if (!Array.isArray(template.lines) || !template.lines.length) {
        return `Company "${name}" has a recurring template without lines.`;
      }
    }
  }

  if (company.complianceTasks !== undefined) {
    if (!Array.isArray(company.complianceTasks) || company.complianceTasks.length > 1000) {
      return `Company "${name}" has invalid compliance tasks.`;
    }
    const taskIds = new Set();
    for (const task of company.complianceTasks) {
      if (!task || !task.id || taskIds.has(task.id)) {
        return `Company "${name}" has a duplicate or missing compliance task id.`;
      }
      taskIds.add(task.id);
      if (String(task.title ?? '').trim().length === 0 || String(task.title).length > 100) {
        return `Company "${name}" has a compliance task with an invalid title.`;
      }
      if (!isValidIsoDate(task.dueDate)) {
        return `Company "${name}" has a compliance task with an invalid due date.`;
      }
      if (!['GST', 'TDS', 'Payroll', 'Other'].includes(task.category)) {
        return `Company "${name}" has a compliance task with an invalid category.`;
      }
      if (task.status !== 'Open' && task.status !== 'Done') {
        return `Company "${name}" has a compliance task with an invalid status.`;
      }
      if (String(task.notes ?? '').length > 200) {
        return `Company "${name}" has compliance task notes that are too long.`;
      }
      if (task.filedOn && !isValidIsoDate(task.filedOn)) {
        return `Company "${name}" has a compliance task with an invalid filed-on date.`;
      }
      if (String(task.reference ?? '').length > 80) {
        return `Company "${name}" has a compliance reference that is too long.`;
      }
    }
  }

  if (company.ewayPartB !== undefined) {
    if (!company.ewayPartB || typeof company.ewayPartB !== 'object' || Array.isArray(company.ewayPartB)) {
      return `Company "${name}" has invalid e-way Part B data.`;
    }
    for (const [voucherId, entry] of Object.entries(company.ewayPartB)) {
      const voucher = company.vouchers.find((item) => item.id === voucherId);
      if (!voucherIds.has(voucherId) || voucher?.type !== 'Sales') {
        return `Company "${name}" has e-way Part B data for a non-sales voucher.`;
      }
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return `Company "${name}" has invalid e-way Part B details.`;
      }
      if (String(entry.transporterName ?? '').length > 100 || String(entry.transporterId ?? '').length > 20) {
        return `Company "${name}" has e-way transporter details that are too long.`;
      }
      if (String(entry.vehicleNo ?? '').length > 20) {
        return `Company "${name}" has an e-way vehicle number that is too long.`;
      }
      if (entry.distance !== undefined) {
        const distance = parseAmount(entry.distance);
        if (distance === null || distance <= 0 || distance > 10000) {
          return `Company "${name}" has an invalid e-way distance.`;
        }
      }
    }
  }

  const orderIds = new Set();
  for (const order of company.orders ?? []) {
    if (!order || !order.id || !['Sales', 'Purchase'].includes(order.type) || !isValidIsoDate(order.date)) {
      return `Company "${name}" has an invalid order.`;
    }
    if (orderIds.has(order.id)) return `Company "${name}" has duplicate order ids.`;
    orderIds.add(order.id);
    if (!['Open', 'Closed', 'Cancelled', 'Converted'].includes(order.status)) {
      return `Company "${name}": order ${order.no ?? ''} has an invalid status.`;
    }
    if (!ledgerIds.has(order.partyLedgerId)) {
      return `Company "${name}": order ${order.no ?? ''} points at a missing party ledger.`;
    }
    if (order.deliveryDate && (!isValidIsoDate(order.deliveryDate) || order.deliveryDate < order.date)) {
      return `Company "${name}": order ${order.no ?? ''} has an invalid delivery date.`;
    }
    if (!Array.isArray(order.items) || order.items.length === 0) {
      return `Company "${name}": order ${order.no ?? ''} has no items.`;
    }
    let total = 0;
    for (const line of order.items) {
      if (!stockItemIds.has(line.stockItemId)) {
        return `Company "${name}": order ${order.no ?? ''} uses a missing stock item.`;
      }
      if (line.godownId && !godownIds.has(line.godownId)) {
        return `Company "${name}": order ${order.no ?? ''} uses a missing godown.`;
      }
      const stockItem = stockItems.find((item) => item.id === line.stockItemId);
      if (stockItem?.batchTracking && !String(line.batchNo ?? '').trim()) {
        return `Company "${name}": order ${order.no ?? ''} is missing a batch for "${stockItem.name}".`;
      }
      const qty = parseQty(line.qty);
      const rate = parseAmount(line.rate);
      if (qty === null || qty <= 0 || rate === null || rate < 0) {
        return `Company "${name}": order ${order.no ?? ''} has an invalid quantity or rate.`;
      }
      if (line.fulfilledQty !== undefined) {
        const fulfilled = parseQty(line.fulfilledQty);
        if (fulfilled === null || fulfilled < 0 || fulfilled > qty + 0.0005) {
          return `Company "${name}": order ${order.no ?? ''} has an invalid fulfilled quantity.`;
        }
      }
      total = round2(total + qty * rate);
    }
    if (Math.abs(total - (parseAmount(order.total) ?? 0)) >= 0.01) {
      return `Company "${name}": order ${order.no ?? ''} total does not reconcile.`;
    }
  }

  const bomIds = new Set();
  for (const bom of company.boms ?? []) {
    if (!bom || !bom.id || !String(bom.name ?? '').trim()) {
      return `Company "${name}" has an invalid BOM.`;
    }
    if (bomIds.has(bom.id)) return `Company "${name}" has duplicate BOM ids.`;
    bomIds.add(bom.id);
    if (!stockItemIds.has(bom.outputItemId)) {
      return `Company "${name}": BOM "${bom.name}" points at a missing finished item.`;
    }
    const outputQty = parseQty(bom.outputQty);
    if (outputQty === null || outputQty <= 0) {
      return `Company "${name}": BOM "${bom.name}" has an invalid output quantity.`;
    }
    if (!Array.isArray(bom.components) || bom.components.length === 0) {
      return `Company "${name}": BOM "${bom.name}" has no components.`;
    }
    const componentIds = new Set();
    for (const line of bom.components) {
      if (!stockItemIds.has(line.stockItemId)) {
        return `Company "${name}": BOM "${bom.name}" uses a missing component item.`;
      }
      if (line.stockItemId === bom.outputItemId || componentIds.has(line.stockItemId)) {
        return `Company "${name}": BOM "${bom.name}" has a duplicate or self-referencing component.`;
      }
      const stockItem = stockItems.find((item) => item.id === line.stockItemId);
      if (stockItem?.batchTracking) {
        return `Company "${name}": BOM "${bom.name}" uses batch-tracked component "${stockItem.name}".`;
      }
      const qty = parseQty(line.qty);
      if (qty === null || qty <= 0) {
        return `Company "${name}": BOM "${bom.name}" has an invalid component quantity.`;
      }
      componentIds.add(line.stockItemId);
    }
  }

  const manufactureIds = new Set();
  for (const manufacture of company.manufactures ?? []) {
    if (!manufacture || !manufacture.id || !isValidIsoDate(manufacture.date)) {
      return `Company "${name}" has an invalid production entry.`;
    }
    if (manufactureIds.has(manufacture.id)) {
      return `Company "${name}" has duplicate production ids.`;
    }
    manufactureIds.add(manufacture.id);
    const bom = (company.boms ?? []).find((entry) => entry.id === manufacture.bomId);
    if (!bom) return `Company "${name}": production ${manufacture.no ?? ''} points at a missing BOM.`;
    if (manufacture.outputItemId !== bom.outputItemId) {
      return `Company "${name}": production ${manufacture.no ?? ''} does not match its BOM output item.`;
    }
    if (!godownIds.has(manufacture.componentGodownId) || !godownIds.has(manufacture.outputGodownId)) {
      return `Company "${name}": production ${manufacture.no ?? ''} points at a missing godown.`;
    }
    const outputQty = parseQty(manufacture.outputQty);
    if (outputQty === null || outputQty <= 0) {
      return `Company "${name}": production ${manufacture.no ?? ''} has an invalid output quantity.`;
    }
    const stockItem = stockItems.find((item) => item.id === manufacture.outputItemId);
    if (stockItem?.batchTracking && !String(manufacture.outputBatchNo ?? '').trim()) {
      return `Company "${name}": production ${manufacture.no ?? ''} is missing a batch for "${stockItem.name}".`;
    }
    const wastageQty = parseQty(manufacture.wastageQty ?? 0);
    if (wastageQty === null || wastageQty < 0) {
      return `Company "${name}": production ${manufacture.no ?? ''} has an invalid wastage quantity.`;
    }
    if (manufacture.expiryDate !== undefined && !isValidIsoDate(manufacture.expiryDate)) {
      return `Company "${name}": production ${manufacture.no ?? ''} has an invalid batch expiry date.`;
    }
    const factor = (outputQty + wastageQty) / parseQty(bom.outputQty);
    const expected = new Map(
      (bom.components ?? []).map((line) => [line.stockItemId, round3((parseQty(line.qty) ?? 0) * factor)]),
    );
    if (!Array.isArray(manufacture.components) || manufacture.components.length !== expected.size) {
      return `Company "${name}": production ${manufacture.no ?? ''} does not match its BOM components.`;
    }
    const seenManufactureComponents = new Set();
    for (const line of manufacture.components) {
      if (!expected.has(line.stockItemId) || seenManufactureComponents.has(line.stockItemId)) {
        return `Company "${name}": production ${manufacture.no ?? ''} has an unexpected or duplicate component.`;
      }
      seenManufactureComponents.add(line.stockItemId);
      const qty = parseQty(line.qty);
      if (qty === null || Math.abs(qty - expected.get(line.stockItemId)) >= 0.001) {
        return `Company "${name}": production ${manufacture.no ?? ''} has a component quantity that does not match its BOM.`;
      }
    }
  }

  if (company.bankReconciliations !== undefined) {
    if (!company.bankReconciliations || typeof company.bankReconciliations !== 'object' || Array.isArray(company.bankReconciliations)) {
      return `Company "${name}" has invalid bank reconciliation data.`;
    }
    for (const [ledgerId, config] of Object.entries(company.bankReconciliations)) {
      if (!ledgerIds.has(ledgerId) || !isBankLedger(company, ledgerId)) {
        return `Company "${name}" has bank reconciliation data for a non-bank ledger.`;
      }
      if (!config || !Array.isArray(config.statement?.lines) || config.statement.lines.length > 5000) {
        return `Company "${name}": bank ledger "${ledgerId}" has invalid statement lines.`;
      }
      for (const line of config.statement.lines) {
        if (!line?.id || !isValidIsoDate(line.date) || !Number.isFinite(Number(line.amount)) || Number(line.amount) === 0) {
          return `Company "${name}": a bank statement line is invalid.`;
        }
      }
      if (config.statement.balances !== undefined) {
        const balances = config.statement.balances;
        if (
          !balances ||
          !Number.isFinite(Number(balances.opening)) ||
          !Number.isFinite(Number(balances.closing))
        ) {
          return `Company "${name}": bank statement balances are invalid.`;
        }
      }
      for (const [lineId, voucherId] of Object.entries(config.matches ?? {})) {
        if (!config.statement.lines.some((line) => line.id === lineId) || !voucherIds.has(voucherId)) {
          return `Company "${name}": a bank reconciliation match is invalid.`;
        }
      }
    }
  }
  return null;
}

export function importState(json) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(json ?? ''));
  } catch {
    return { ok: false, error: 'That backup is not valid JSON.' };
  }
  if (!parsed || !Array.isArray(parsed.companies) || parsed.companies.length === 0) {
    return { ok: false, error: 'That backup contains no companies.' };
  }

  const seenCompanyIds = new Set();
  for (const company of parsed.companies) {
    const problem = validateImportedCompany(company);
    if (problem) return { ok: false, error: problem };
    if (seenCompanyIds.has(company.id)) return { ok: false, error: 'That backup has duplicate company ids.' };
    seenCompanyIds.add(company.id);
  }

  const companies = parsed.companies.map((company) => {
    const counters = {};
    for (const voucher of company.vouchers) {
      counters[voucher.type] = Math.max(counters[voucher.type] ?? 0, Number(voucher.no) || 0);
    }
    const mapped = {
      ...company,
      id: company.id || uid('co'),
      fyStart: company.fyStart,
      fyEnd: isValidIsoDate(company.fyEnd) ? company.fyEnd : fyEndFor(company.fyStart),
      groups: company.groups,
      ledgers: company.ledgers.map((ledger) => ({
        ...ledger,
        opening: parseAmount(ledger.opening ?? 0) ?? 0,
        openingType: ledger.openingType === 'Cr' ? 'Cr' : 'Dr',
      })),
      units: company.units,
      stockGroups: company.stockGroups,
      stockItems: (company.stockItems ?? []).map((item) => ({
        ...item,
        openingQty: parseQty(item.openingQty ?? 0) ?? 0,
        openingRate: parseAmount(item.openingRate ?? 0) ?? 0,
      })),
      costCategories: company.costCategories,
      costCentres: company.costCentres,
      budgets: company.budgets,
      currencies: company.currencies,
      vouchers: company.vouchers.map((voucher) => ({
        ...voucher,
        ...(voucher.currencyCode
          ? {
              currencyCode: String(voucher.currencyCode).trim().toUpperCase(),
              exchangeRate: parseAmount(voucher.exchangeRate) ?? 0,
              currencyTotal: parseAmount(voucher.currencyTotal) ?? 0,
            }
          : {}),
        lines: voucher.lines.map((line) => ({
          ledgerId: line.ledgerId,
          side: line.side === 'Cr' ? 'Cr' : 'Dr',
          amount: parseAmount(line.amount) ?? 0,
          ...(line.currencyAmount !== undefined ? { currencyAmount: parseAmount(line.currencyAmount) ?? 0 } : {}),
          ...(line.costCentreId ? { costCentreId: line.costCentreId } : {}),
          ...(Array.isArray(line.allocations) && line.allocations.length
            ? {
                allocations: line.allocations.map((allocation) => ({
                  voucherId: allocation.voucherId,
                  amount: parseAmount(allocation.amount) ?? 0,
                })),
              }
            : {}),
        })),
        ...(voucher.bill
          ? {
              bill: {
                ref: String(voucher.bill.ref ?? '').trim().slice(0, 40),
                dueDate: isValidIsoDate(voucher.bill.dueDate) ? voucher.bill.dueDate : null,
              },
            }
          : {}),
        ...(voucher.items
          ? {
              items: voucher.items.map((line) => ({
                stockItemId: line.stockItemId,
                qty: parseQty(line.qty) ?? 0,
                rate: parseAmount(line.rate) ?? 0,
                amount: round2((parseQty(line.qty) ?? 0) * (parseAmount(line.rate) ?? 0)),
                ...(line.godownId ? { godownId: line.godownId } : {}),
                ...(line.batchNo ? { batchNo: String(line.batchNo).trim().slice(0, 30) } : {}),
                ...(line.expiryDate ? { expiryDate: line.expiryDate } : {}),
              })),
            }
          : {}),
        total: parseAmount(voucher.total) ?? 0,
      })),
      counters,
    };
    normalizeApprovals(mapped);
    seedYears(mapped);
    seedInventoryMasters(mapped);
    normalizeCostMasters(mapped);
    normalizeBudgets(mapped);
    normalizeCurrencies(mapped);
    normalizeGst(mapped);
    normalizeTds(mapped);
    normalizePayroll(mapped);
    normalizeInstruments(mapped);
    normalizeBankReconciliations(mapped);
    normalizeStockCounts(mapped);
    normalizeEwayPartB(mapped);
    normalizeComplianceTasks(mapped);
    normalizeRecurringVouchers(mapped);
    return mapped;
  });

  const activeCompanyId = companies.some((company) => company.id === parsed.activeCompanyId)
    ? parsed.activeCompanyId
    : companies[0].id;

  const restored = {
    version: SCHEMA_VERSION,
    activeCompanyId,
    companies,
    audit: normalizeAudit(parsed.audit),
    users: normalizeUsers(parsed.users),
    currentUserId: parsed.currentUserId ?? null,
  };
  seedUsers(restored);
  return { ok: true, state: restored };
}

export function vouchersSorted(company) {
  return [...company.vouchers].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.no - a.no;
  });
}

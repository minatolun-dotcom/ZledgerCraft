// ZledgerCraft - relational workspace storage.
// Companies, account groups, financial years, cost masters, inventory masters,
// budgets, currencies, stock transfers, orders, BOMs, production runs, tax
// challans, ledgers, vouchers and stock items are canonical rows. Nested arrays
// (transfer lines, order lines, BOM components and production components) stay
// in the record JSON. Expiring leases provide advisory-but-enforced record
// ownership.
import { createHash, randomBytes } from 'node:crypto';
import { deepEqual, mergeWorkspaceStates, repairVoucherNumbers } from './server-merge.js';

const SCHEMA_VERSION = 11;
const HISTORY_LIMIT = 20;
// Header fields that are useful as typed columns. The complete JSON is still
// kept for compatibility, but these values are removed from it when present.
const PROMOTED_COMPANY_FIELDS = [
  ['name', 'name'],
  ['fy_start', 'fyStart'],
  ['fy_end', 'fyEnd'],
  ['year_id', 'yearId'],
  ['created_at', 'createdAt'],
];
const PROMOTED_STOCK_FIELDS = [
  ['name', 'name'],
  ['stock_group_id', 'stockGroupId'],
  ['unit_id', 'unitId'],
  ['hsn', 'hsn'],
  ['opening_qty', 'openingQty'],
  ['opening_rate', 'openingRate'],
  ['batch_tracking', 'batchTracking'],
  ['created_at', 'createdAt'],
];
const PROMOTED_GROUP_FIELDS = [
  ['name', 'name'],
  ['parent_id', 'parentId'],
  ['nature', 'nature'],
  ['group_key', 'key'],
];
const PROMOTED_YEAR_FIELDS = [
  ['start_date', 'start'],
  ['end_date', 'end'],
  ['closed', 'closed'],
];
const PROMOTED_COST_MASTER_FIELDS = [['created_at', 'createdAt']];
const PROMOTED_UNIT_FIELDS = [
  ['name', 'name'],
  ['symbol', 'symbol'],
];
const PROMOTED_STOCK_GROUP_FIELDS = [
  ['name', 'name'],
  ['is_primary', 'primary'],
];
const PROMOTED_GODOWN_FIELDS = [
  ['name', 'name'],
  ['is_primary', 'primary'],
];
const PROMOTED_BUDGET_FIELDS = [
  ['name', 'name'],
  ['target_type', 'targetType'],
  ['target_id', 'targetId'],
  ['year_id', 'yearId'],
  ['amount', 'amount'],
  ['created_at', 'createdAt'],
];
const PROMOTED_CURRENCY_FIELDS = [
  ['code', 'code'],
  ['name', 'name'],
  ['symbol', 'symbol'],
  ['created_at', 'createdAt'],
];
const PROMOTED_STOCK_TRANSFER_FIELDS = [
  ['no', 'no'],
  ['date', 'date'],
  ['from_godown_id', 'fromGodownId'],
  ['to_godown_id', 'toGodownId'],
  ['narration', 'narration'],
  ['created_at', 'createdAt'],
];
const PROMOTED_ORDER_FIELDS = [
  ['type', 'type'],
  ['no', 'no'],
  ['date', 'date'],
  ['party_ledger_id', 'partyLedgerId'],
  ['delivery_date', 'deliveryDate'],
  ['total', 'total'],
  ['status', 'status'],
  ['narration', 'narration'],
  ['created_at', 'createdAt'],
];
const PROMOTED_BOM_FIELDS = [
  ['name', 'name'],
  ['output_item_id', 'outputItemId'],
  ['output_qty', 'outputQty'],
  ['created_at', 'createdAt'],
];
const PROMOTED_MANUFACTURE_FIELDS = [
  ['no', 'no'],
  ['date', 'date'],
  ['bom_id', 'bomId'],
  ['bom_name', 'bomName'],
  ['bom_output_qty', 'bomOutputQty'],
  ['output_item_id', 'outputItemId'],
  ['output_qty', 'outputQty'],
  ['component_godown_id', 'componentGodownId'],
  ['output_godown_id', 'outputGodownId'],
  ['output_batch_no', 'outputBatchNo'],
  ['expiry_date', 'expiryDate'],
  ['narration', 'narration'],
  ['created_at', 'createdAt'],
];
const PROMOTED_TAX_CHALLAN_FIELDS = [
  ['kind', 'kind'],
  ['date', 'date'],
  ['amount', 'amount'],
  ['reference', 'reference'],
  ['bsr_code', 'bsrCode'],
  ['section_id', 'sectionId'],
];
const PROMOTED_COMPANY_COLUMNS = [['created_at', 'TEXT']];
const PROMOTED_STOCK_COLUMNS = [['created_at', 'TEXT']];
const PROMOTED_LEDGER_COLUMNS = [
  ['opening', 'REAL'],
  ['opening_type', 'TEXT'],
  ['gstin', 'TEXT'],
  ['state_code', 'TEXT'],
  ['pan', 'TEXT'],
  ['address', 'TEXT'],
  ['city', 'TEXT'],
  ['pin', 'TEXT'],
  ['gst_role', 'TEXT'],
  ['created_at', 'TEXT'],
];
const DEFAULT_LEASE_MS = 2 * 60 * 1000;
const MAX_LEASE_MS = 10 * 60 * 1000;

// Every top-level company collection now has its own table. The generic record
// table remains for older workspaces and is drained during migration.
const RECORD_COLLECTIONS = [];

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value) {
  const valueText = text(value);
  return valueText || null;
}

function tokenHash(token) {
  return createHash('sha256').update(String(token ?? '')).digest('hex');
}

function leaseHolder(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username,
    acquiredAt: row.acquired_at,
    expiresAt: row.expires_at,
  };
}

function recordHint(collection, item) {
  const parent =
    item.parentId ?? item.stockGroupId ?? item.categoryId ?? item.targetId ?? item.groupId ?? '';
  const reference = item.unitId ?? item.yearId ?? item.ledgerId ?? item.voucherId ?? '';
  const amount =
    collection === 'budgets'
      ? item.amount
      : item.opening ?? item.openingQty ?? item.total ?? null;
  return {
    name: text(item.name),
    parent: text(parent),
    reference: text(reference),
    amount: optionalNumber(amount),
  };
}

function collectionRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, new Map());
    const collections = byCompany.get(row.company_id);
    if (!collections.has(row.collection)) collections.set(row.collection, []);
    collections.get(row.collection).push(JSON.parse(row.data));
  }
  return byCompany;
}

function groupRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const group = { ...data, id: row.id };
    for (const [column, field] of PROMOTED_GROUP_FIELDS) {
      if (row[column] !== null && row[column] !== undefined && row[column] !== '') {
        group[field] = row[column];
      }
    }
    byCompany.get(row.company_id).push(group);
  }
  return byCompany;
}

function yearRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    byCompany.get(row.company_id).push({
      ...data,
      id: row.id,
      start: row.start_date ?? data.start,
      end: row.end_date ?? data.end,
      closed:
        row.closed === null || row.closed === undefined ? Boolean(data.closed) : Boolean(row.closed),
    });
  }
  return byCompany;
}

function costCategoryRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const category = { ...data, id: row.id, name: row.name ?? data.name };
    if (row.created_at !== null && row.created_at !== undefined && row.created_at !== '') {
      category.createdAt = row.created_at;
    }
    byCompany.get(row.company_id).push(category);
  }
  return byCompany;
}

function costCentreRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const centre = {
      ...data,
      id: row.id,
      name: row.name ?? data.name,
      categoryId: row.category_id ?? data.categoryId,
    };
    if (row.created_at !== null && row.created_at !== undefined && row.created_at !== '') {
      centre.createdAt = row.created_at;
    }
    byCompany.get(row.company_id).push(centre);
  }
  return byCompany;
}

function unitRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const unit = { ...data, id: row.id, name: row.name ?? data.name, symbol: row.symbol ?? data.symbol };
    byCompany.get(row.company_id).push(unit);
  }
  return byCompany;
}

function stockGroupRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const group = { ...data, id: row.id, name: row.name ?? data.name };
    group.primary =
      row.is_primary === null || row.is_primary === undefined
        ? Boolean(data.primary)
        : Boolean(row.is_primary);
    byCompany.get(row.company_id).push(group);
  }
  return byCompany;
}

function godownRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const godown = { ...data, id: row.id, name: row.name ?? data.name };
    godown.primary =
      row.is_primary === null || row.is_primary === undefined
        ? Boolean(data.primary)
        : Boolean(row.is_primary);
    byCompany.get(row.company_id).push(godown);
  }
  return byCompany;
}

function budgetRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const budget = {
      ...data,
      id: row.id,
      name: row.name ?? data.name,
      targetType: row.target_type ?? data.targetType,
      targetId: row.target_id ?? data.targetId,
      yearId: row.year_id ?? data.yearId,
      amount: row.amount === null || row.amount === undefined ? number(data.amount) : number(row.amount),
    };
    if (row.created_at !== null && row.created_at !== undefined && row.created_at !== '') {
      budget.createdAt = row.created_at;
    }
    byCompany.get(row.company_id).push(budget);
  }
  return byCompany;
}

function currencyRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const currency = {
      ...data,
      id: row.id,
      code: row.code ?? data.code,
      name: row.name ?? data.name,
      symbol: row.symbol ?? data.symbol,
    };
    if (row.created_at !== null && row.created_at !== undefined && row.created_at !== '') {
      currency.createdAt = row.created_at;
    }
    byCompany.get(row.company_id).push(currency);
  }
  return byCompany;
}

function stockTransferRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const transfer = {
      ...data,
      id: row.id,
      no: row.no === null || row.no === undefined ? number(data.no) : number(row.no),
      date: row.date ?? data.date,
      fromGodownId: row.from_godown_id ?? data.fromGodownId,
      toGodownId: row.to_godown_id ?? data.toGodownId,
    };
    if (row.narration !== null && row.narration !== undefined) transfer.narration = row.narration;
    if (row.created_at !== null && row.created_at !== undefined && row.created_at !== '') {
      transfer.createdAt = row.created_at;
    }
    byCompany.get(row.company_id).push(transfer);
  }
  return byCompany;
}

function orderRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const order = {
      ...data,
      id: row.id,
      type: row.type ?? data.type,
      no: row.no === null || row.no === undefined ? number(data.no) : number(row.no),
      date: row.date ?? data.date,
      partyLedgerId: row.party_ledger_id ?? data.partyLedgerId,
      total: row.total === null || row.total === undefined ? number(data.total) : number(row.total),
      status: row.status ?? data.status,
    };
    if (row.delivery_date !== null && row.delivery_date !== undefined && row.delivery_date !== '') {
      order.deliveryDate = row.delivery_date;
    }
    if (row.narration !== null && row.narration !== undefined) order.narration = row.narration;
    if (row.created_at !== null && row.created_at !== undefined && row.created_at !== '') {
      order.createdAt = row.created_at;
    }
    byCompany.get(row.company_id).push(order);
  }
  return byCompany;
}

function bomRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const bom = {
      ...data,
      id: row.id,
      name: row.name ?? data.name,
      outputItemId: row.output_item_id ?? data.outputItemId,
      outputQty:
        row.output_qty === null || row.output_qty === undefined
          ? number(data.outputQty)
          : number(row.output_qty),
    };
    if (row.created_at !== null && row.created_at !== undefined && row.created_at !== '') {
      bom.createdAt = row.created_at;
    }
    byCompany.get(row.company_id).push(bom);
  }
  return byCompany;
}

function manufactureRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const manufacture = {
      ...data,
      id: row.id,
      no: row.no === null || row.no === undefined ? number(data.no) : number(row.no),
      date: row.date ?? data.date,
      bomId: row.bom_id ?? data.bomId,
      bomName: row.bom_name ?? data.bomName,
      bomOutputQty:
        row.bom_output_qty === null || row.bom_output_qty === undefined
          ? number(data.bomOutputQty)
          : number(row.bom_output_qty),
      outputItemId: row.output_item_id ?? data.outputItemId,
      outputQty:
        row.output_qty === null || row.output_qty === undefined
          ? number(data.outputQty)
          : number(row.output_qty),
      componentGodownId: row.component_godown_id ?? data.componentGodownId,
      outputGodownId: row.output_godown_id ?? data.outputGodownId,
    };
    for (const [column, field] of [
      ['output_batch_no', 'outputBatchNo'],
      ['expiry_date', 'expiryDate'],
    ]) {
      if (row[column] !== null && row[column] !== undefined && row[column] !== '') {
        manufacture[field] = row[column];
      }
    }
    if (row.narration !== null && row.narration !== undefined) {
      manufacture.narration = row.narration;
    }
    if (row.created_at !== null && row.created_at !== undefined && row.created_at !== '') {
      manufacture.createdAt = row.created_at;
    }
    byCompany.get(row.company_id).push(manufacture);
  }
  return byCompany;
}

function taxChallanRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const challan = {
      ...data,
      id: row.id,
      kind: row.kind ?? data.kind,
      date: row.date ?? data.date,
      amount: row.amount === null || row.amount === undefined ? number(data.amount) : number(row.amount),
    };
    for (const [column, field] of [
      ['reference', 'reference'],
      ['bsr_code', 'bsrCode'],
    ]) {
      if (row[column] !== null && row[column] !== undefined) challan[field] = row[column];
    }
    if (row.section_id !== null && row.section_id !== undefined && row.section_id !== '') {
      challan.sectionId = row.section_id;
    }
    byCompany.get(row.company_id).push(challan);
  }
  return byCompany;
}

function stockRows(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    if (!byCompany.has(row.company_id)) byCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const item = {
      ...data,
      id: row.id,
      name: row.name ?? data.name,
      stockGroupId: row.stock_group_id ?? data.stockGroupId,
      unitId: row.unit_id ?? data.unitId,
      openingQty:
        row.opening_qty === null || row.opening_qty === undefined
          ? number(data.openingQty)
          : number(row.opening_qty),
      openingRate:
        row.opening_rate === null || row.opening_rate === undefined
          ? number(data.openingRate)
          : number(row.opening_rate),
      batchTracking:
        row.batch_tracking === null || row.batch_tracking === undefined
          ? Boolean(data.batchTracking)
          : Boolean(row.batch_tracking),
    };
    for (const [column, field] of [
      ['hsn', 'hsn'],
      ['created_at', 'createdAt'],
    ]) {
      if (row[column] !== null && row[column] !== undefined && row[column] !== '') {
        item[field] = row[column];
      }
    }
    byCompany.get(row.company_id).push(item);
  }
  return byCompany;
}

function stateFromRows({
  meta,
  users,
  log,
  companies,
  ledgers,
  vouchers,
  lines,
  groups = [],
  years = [],
  costCategories = [],
  costCentres = [],
  units = [],
  stockGroups = [],
  godowns = [],
  budgets = [],
  currencies = [],
  stockTransfers = [],
  orders = [],
  boms = [],
  manufactures = [],
  taxChallans = [],
  records = [],
  stockItems = [],
}) {
  const state = {
    ...JSON.parse(meta.meta),
    activeCompanyId: meta.active_company_id ?? null,
    companies: [],
    users: users.map((row) => JSON.parse(row.data)),
    audit: log.map((row) => JSON.parse(row.data)),
    currentUserId: meta.current_user_id ?? null,
  };
  const ledgersByCompany = new Map();
  const vouchersByCompany = new Map();
  const linesByVoucher = new Map();
  const groupsByCompany = groupRows(groups);
  const yearsByCompany = yearRows(years);
  const costCategoriesByCompany = costCategoryRows(costCategories);
  const costCentresByCompany = costCentreRows(costCentres);
  const unitsByCompany = unitRows(units);
  const stockGroupsByCompany = stockGroupRows(stockGroups);
  const godownsByCompany = godownRows(godowns);
  const budgetsByCompany = budgetRows(budgets);
  const currenciesByCompany = currencyRows(currencies);
  const stockTransfersByCompany = stockTransferRows(stockTransfers);
  const ordersByCompany = orderRows(orders);
  const bomsByCompany = bomRows(boms);
  const manufacturesByCompany = manufactureRows(manufactures);
  const taxChallansByCompany = taxChallanRows(taxChallans);
  const recordsByCompany = collectionRows(records);
  const stockByCompany = stockRows(stockItems);

  for (const row of ledgers) {
    if (!ledgersByCompany.has(row.company_id)) ledgersByCompany.set(row.company_id, []);
    const data = JSON.parse(row.data);
    const ledger = {
      ...data,
      id: row.id,
      name: row.name,
      groupId: row.group_id,
      opening: row.opening === null || row.opening === undefined ? number(data.opening) : number(row.opening),
      openingType: (row.opening_type ?? data.openingType) === 'Cr' ? 'Cr' : 'Dr',
    };
    for (const [column, field] of [
      ['gstin', 'gstin'],
      ['state_code', 'stateCode'],
      ['pan', 'pan'],
      ['address', 'address'],
      ['city', 'city'],
      ['pin', 'pin'],
      ['gst_role', 'gstRole'],
      ['created_at', 'createdAt'],
    ]) {
      if (row[column] !== null && row[column] !== undefined && row[column] !== '') {
        ledger[field] = row[column];
      }
    }
    ledgersByCompany.get(row.company_id).push(ledger);
  }
  for (const row of vouchers) {
    if (!vouchersByCompany.has(row.company_id)) vouchersByCompany.set(row.company_id, []);
    vouchersByCompany.get(row.company_id).push({
      ...JSON.parse(row.data),
      id: row.id,
      type: row.type,
      no: number(row.no),
      date: row.date,
      total: number(row.total),
    });
  }
  for (const row of lines) {
    if (!linesByVoucher.has(row.voucher_id)) linesByVoucher.set(row.voucher_id, []);
    linesByVoucher.get(row.voucher_id).push({
      ...JSON.parse(row.data),
      ledgerId: row.ledger_id,
      side: row.side,
      amount: number(row.amount),
    });
  }

  for (const row of companies) {
    const data = JSON.parse(row.data);
    const company = { ...data, id: row.id };
    for (const [column, field] of PROMOTED_COMPANY_FIELDS) {
      if (row[column] !== null && row[column] !== undefined && row[column] !== '') {
        company[field] = row[column];
      }
    }
    // Empty arrays stay in company.data so their presence survives a round trip.
    // Non-empty ones are reconstructed from their ordered rows.
    const storedCollections = recordsByCompany.get(row.id);
    if (storedCollections) {
      for (const [collection, items] of storedCollections) company[collection] = items;
    }
    const storedGroups = groupsByCompany.get(row.id);
    if (storedGroups) company.groups = storedGroups;
    const storedYears = yearsByCompany.get(row.id);
    if (storedYears) company.years = storedYears;
    const storedCostCategories = costCategoriesByCompany.get(row.id);
    if (storedCostCategories) company.costCategories = storedCostCategories;
    const storedCostCentres = costCentresByCompany.get(row.id);
    if (storedCostCentres) company.costCentres = storedCostCentres;
    const storedUnits = unitsByCompany.get(row.id);
    if (storedUnits) company.units = storedUnits;
    const storedStockGroups = stockGroupsByCompany.get(row.id);
    if (storedStockGroups) company.stockGroups = storedStockGroups;
    const storedGodowns = godownsByCompany.get(row.id);
    if (storedGodowns) company.godowns = storedGodowns;
    const storedBudgets = budgetsByCompany.get(row.id);
    if (storedBudgets) company.budgets = storedBudgets;
    const storedCurrencies = currenciesByCompany.get(row.id);
    if (storedCurrencies) company.currencies = storedCurrencies;
    const storedStockTransfers = stockTransfersByCompany.get(row.id);
    if (storedStockTransfers) company.stockTransfers = storedStockTransfers;
    const storedOrders = ordersByCompany.get(row.id);
    if (storedOrders) company.orders = storedOrders;
    const storedBoms = bomsByCompany.get(row.id);
    if (storedBoms) company.boms = storedBoms;
    const storedManufactures = manufacturesByCompany.get(row.id);
    if (storedManufactures) company.manufactures = storedManufactures;
    const storedTaxChallans = taxChallansByCompany.get(row.id);
    if (storedTaxChallans) company.taxChallans = storedTaxChallans;
    const storedStockItems = stockByCompany.get(row.id);
    if (storedStockItems) company.stockItems = storedStockItems;
    company.ledgers = ledgersByCompany.get(row.id) ?? [];
    company.vouchers = (vouchersByCompany.get(row.id) ?? []).map((voucher) => ({
      ...voucher,
      lines: linesByVoucher.get(voucher.id) ?? [],
    }));
    state.companies.push(company);
  }
  return { state, rev: Number(meta.rev), updatedAt: meta.updated_at };
}

function optionalRows(db, sql) {
  try {
    return db.prepare(sql).all();
  } catch {
    // Older backups do not have the newer collection and lease tables.
    return [];
  }
}

export function readWorkspaceSnapshot(db) {
  let meta = null;
  try {
    meta = db.prepare('SELECT * FROM workspace_meta WHERE id = 1').get();
  } catch {
    // Older backups may only have the whole-workspace blob.
  }
  if (meta) {
    const select = (sql) => db.prepare(sql).all();
    return stateFromRows({
      meta,
      users: select('SELECT data FROM workspace_users ORDER BY position'),
      log: select('SELECT data FROM workspace_log ORDER BY position'),
      companies: select('SELECT * FROM companies ORDER BY position'),
      groups: optionalRows(db, 'SELECT * FROM account_groups ORDER BY company_id, position'),
      years: optionalRows(db, 'SELECT * FROM financial_years ORDER BY company_id, position'),
      costCategories: optionalRows(
        db,
        'SELECT * FROM cost_categories ORDER BY company_id, position',
      ),
      costCentres: optionalRows(db, 'SELECT * FROM cost_centres ORDER BY company_id, position'),
      units: optionalRows(db, 'SELECT * FROM units ORDER BY company_id, position'),
      stockGroups: optionalRows(db, 'SELECT * FROM stock_groups ORDER BY company_id, position'),
      godowns: optionalRows(db, 'SELECT * FROM godowns ORDER BY company_id, position'),
      budgets: optionalRows(db, 'SELECT * FROM budgets ORDER BY company_id, position'),
      currencies: optionalRows(db, 'SELECT * FROM currencies ORDER BY company_id, position'),
      stockTransfers: optionalRows(
        db,
        'SELECT * FROM stock_transfers ORDER BY company_id, position',
      ),
      orders: optionalRows(db, 'SELECT * FROM orders ORDER BY company_id, position'),
      boms: optionalRows(db, 'SELECT * FROM boms ORDER BY company_id, position'),
      manufactures: optionalRows(db, 'SELECT * FROM manufactures ORDER BY company_id, position'),
      taxChallans: optionalRows(db, 'SELECT * FROM tax_challans ORDER BY company_id, position'),
      ledgers: select('SELECT * FROM ledgers ORDER BY position'),
      vouchers: select('SELECT * FROM vouchers ORDER BY position'),
      lines: select('SELECT * FROM voucher_lines ORDER BY position'),
      records: optionalRows(db, 'SELECT * FROM company_records ORDER BY company_id, collection, position'),
      stockItems: optionalRows(db, 'SELECT * FROM stock_items ORDER BY company_id, position'),
    });
  }
  let legacy = null;
  try {
    legacy = db.prepare('SELECT rev, updated_at, state FROM workspace WHERE id = 1').get();
  } catch {
    return null;
  }
  if (!legacy) return null;
  const state = JSON.parse(legacy.state);
  if (!state || !Array.isArray(state.companies)) return null;
  return {
    state,
    rev: Number(legacy.rev) || 0,
    updatedAt: legacy.updated_at || null,
  };
}

export class WorkspaceStore {
  constructor(db) {
    this.db = db;
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS workspace_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        rev INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        active_company_id TEXT,
        current_user_id TEXT,
        meta TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_users (
        position INTEGER PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_log (
        position INTEGER PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_revisions (
        rev INTEGER PRIMARY KEY,
        state TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL,
        name TEXT NOT NULL,
        fy_start TEXT,
        fy_end TEXT,
        year_id TEXT,
        created_at TEXT,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS account_groups (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        parent_id TEXT,
        nature TEXT,
        group_key TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS financial_years (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        start_date TEXT,
        end_date TEXT,
        closed INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS cost_categories (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        created_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS cost_centres (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        category_id TEXT,
        created_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS units (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        symbol TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS stock_groups (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS godowns (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS budgets (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        target_type TEXT,
        target_id TEXT,
        year_id TEXT,
        amount REAL,
        created_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS currencies (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        code TEXT,
        name TEXT,
        symbol TEXT,
        created_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS stock_transfers (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        no INTEGER,
        date TEXT,
        from_godown_id TEXT,
        to_godown_id TEXT,
        narration TEXT,
        created_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS orders (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        type TEXT,
        no INTEGER,
        date TEXT,
        party_ledger_id TEXT,
        delivery_date TEXT,
        total REAL,
        status TEXT,
        narration TEXT,
        created_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS boms (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        output_item_id TEXT,
        output_qty REAL,
        created_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS manufactures (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        no INTEGER,
        date TEXT,
        bom_id TEXT,
        bom_name TEXT,
        bom_output_qty REAL,
        output_item_id TEXT,
        output_qty REAL,
        component_godown_id TEXT,
        output_godown_id TEXT,
        output_batch_no TEXT,
        expiry_date TEXT,
        narration TEXT,
        created_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS tax_challans (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        kind TEXT,
        date TEXT,
        amount REAL,
        reference TEXT,
        bsr_code TEXT,
        section_id TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS ledgers (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        group_id TEXT,
        opening REAL,
        opening_type TEXT,
        gstin TEXT,
        state_code TEXT,
        pan TEXT,
        address TEXT,
        city TEXT,
        pin TEXT,
        gst_role TEXT,
        created_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS vouchers (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        type TEXT,
        no INTEGER,
        date TEXT,
        total REAL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS voucher_lines (
        voucher_id TEXT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        ledger_id TEXT,
        side TEXT,
        amount REAL,
        data TEXT NOT NULL,
        PRIMARY KEY (voucher_id, position)
      );
      CREATE TABLE IF NOT EXISTS company_records (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        parent_id TEXT,
        reference_id TEXT,
        amount REAL,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, collection, id)
      );
      CREATE TABLE IF NOT EXISTS stock_items (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        stock_group_id TEXT,
        unit_id TEXT,
        hsn TEXT,
        opening_qty REAL,
        opening_rate REAL,
        batch_tracking INTEGER NOT NULL DEFAULT 0,
        created_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, id)
      );
      CREATE TABLE IF NOT EXISTS workspace_leases (
        company_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        record_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        acquired_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        PRIMARY KEY (company_id, record_type, record_id)
      );
      CREATE INDEX IF NOT EXISTS account_groups_company ON account_groups(company_id, position);
      CREATE INDEX IF NOT EXISTS account_groups_parent ON account_groups(company_id, parent_id);
      CREATE INDEX IF NOT EXISTS financial_years_company ON financial_years(company_id, position);
      CREATE INDEX IF NOT EXISTS financial_years_dates ON financial_years(company_id, start_date, end_date);
      CREATE INDEX IF NOT EXISTS cost_categories_company ON cost_categories(company_id, position);
      CREATE INDEX IF NOT EXISTS cost_centres_company ON cost_centres(company_id, position);
      CREATE INDEX IF NOT EXISTS cost_centres_category ON cost_centres(company_id, category_id);
      CREATE INDEX IF NOT EXISTS units_company ON units(company_id, position);
      CREATE INDEX IF NOT EXISTS stock_groups_company ON stock_groups(company_id, position);
      CREATE INDEX IF NOT EXISTS godowns_company ON godowns(company_id, position);
      CREATE INDEX IF NOT EXISTS budgets_company ON budgets(company_id, position);
      CREATE INDEX IF NOT EXISTS budgets_target ON budgets(company_id, target_type, target_id, year_id);
      CREATE INDEX IF NOT EXISTS currencies_company ON currencies(company_id, position);
      CREATE INDEX IF NOT EXISTS currencies_code ON currencies(company_id, code);
      CREATE INDEX IF NOT EXISTS stock_transfers_company ON stock_transfers(company_id, position);
      CREATE INDEX IF NOT EXISTS stock_transfers_dates ON stock_transfers(company_id, date);
      CREATE INDEX IF NOT EXISTS orders_company ON orders(company_id, position);
      CREATE INDEX IF NOT EXISTS orders_party ON orders(company_id, party_ledger_id, date);
      CREATE INDEX IF NOT EXISTS orders_status ON orders(company_id, type, status);
      CREATE INDEX IF NOT EXISTS boms_company ON boms(company_id, position);
      CREATE INDEX IF NOT EXISTS boms_output ON boms(company_id, output_item_id);
      CREATE INDEX IF NOT EXISTS manufactures_company ON manufactures(company_id, position);
      CREATE INDEX IF NOT EXISTS manufactures_bom ON manufactures(company_id, bom_id);
      CREATE INDEX IF NOT EXISTS manufactures_dates ON manufactures(company_id, date);
      CREATE INDEX IF NOT EXISTS tax_challans_company ON tax_challans(company_id, position);
      CREATE INDEX IF NOT EXISTS tax_challans_dates ON tax_challans(company_id, date);
      CREATE INDEX IF NOT EXISTS tax_challans_kind ON tax_challans(company_id, kind, date);
      CREATE INDEX IF NOT EXISTS ledgers_company ON ledgers(company_id, position);
      CREATE INDEX IF NOT EXISTS vouchers_company ON vouchers(company_id, position);
      CREATE INDEX IF NOT EXISTS voucher_lines_voucher ON voucher_lines(voucher_id, position);
      CREATE INDEX IF NOT EXISTS company_records_collection ON company_records(company_id, collection, position);
      CREATE INDEX IF NOT EXISTS company_records_name ON company_records(company_id, collection, name);
      CREATE INDEX IF NOT EXISTS stock_items_group ON stock_items(company_id, stock_group_id, position);
      CREATE INDEX IF NOT EXISTS stock_items_name ON stock_items(company_id, name);
      CREATE INDEX IF NOT EXISTS workspace_leases_expiry ON workspace_leases(expires_at);
    `);
    for (const [table, promoted] of [
      ['companies', PROMOTED_COMPANY_COLUMNS],
      ['ledgers', PROMOTED_LEDGER_COLUMNS],
      ['stock_items', PROMOTED_STOCK_COLUMNS],
    ]) {
      const existing = new Set(
        this.db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name),
      );
      for (const [name, type] of promoted) {
        if (!existing.has(name)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
      }
    }

    this.meta = this.db.prepare('SELECT * FROM workspace_meta WHERE id = 1');
    this.users = this.db.prepare('SELECT data FROM workspace_users ORDER BY position');
    this.log = this.db.prepare('SELECT data FROM workspace_log ORDER BY position');
    this.companies = this.db.prepare('SELECT * FROM companies ORDER BY position');
    this.groups = this.db.prepare('SELECT * FROM account_groups ORDER BY company_id, position');
    this.years = this.db.prepare('SELECT * FROM financial_years ORDER BY company_id, position');
    this.costCategories = this.db.prepare(
      'SELECT * FROM cost_categories ORDER BY company_id, position',
    );
    this.costCentres = this.db.prepare('SELECT * FROM cost_centres ORDER BY company_id, position');
    this.units = this.db.prepare('SELECT * FROM units ORDER BY company_id, position');
    this.stockGroups = this.db.prepare('SELECT * FROM stock_groups ORDER BY company_id, position');
    this.godowns = this.db.prepare('SELECT * FROM godowns ORDER BY company_id, position');
    this.budgets = this.db.prepare('SELECT * FROM budgets ORDER BY company_id, position');
    this.currencies = this.db.prepare('SELECT * FROM currencies ORDER BY company_id, position');
    this.stockTransfers = this.db.prepare(
      'SELECT * FROM stock_transfers ORDER BY company_id, position',
    );
    this.orders = this.db.prepare('SELECT * FROM orders ORDER BY company_id, position');
    this.boms = this.db.prepare('SELECT * FROM boms ORDER BY company_id, position');
    this.manufactures = this.db.prepare('SELECT * FROM manufactures ORDER BY company_id, position');
    this.taxChallans = this.db.prepare('SELECT * FROM tax_challans ORDER BY company_id, position');
    this.ledgers = this.db.prepare('SELECT * FROM ledgers ORDER BY position');
    this.vouchers = this.db.prepare('SELECT * FROM vouchers ORDER BY position');
    this.lines = this.db.prepare('SELECT * FROM voucher_lines ORDER BY position');
    this.records = this.db.prepare('SELECT * FROM company_records ORDER BY company_id, collection, position');
    this.stockItems = this.db.prepare('SELECT * FROM stock_items ORDER BY company_id, position');
    this.insertMeta = this.db.prepare(`
      INSERT INTO workspace_meta
        (id, rev, updated_at, schema_version, active_company_id, current_user_id, meta)
      VALUES (1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        rev = excluded.rev,
        updated_at = excluded.updated_at,
        schema_version = excluded.schema_version,
        active_company_id = excluded.active_company_id,
        current_user_id = excluded.current_user_id,
        meta = excluded.meta
    `);
    this.insertUser = this.db.prepare('INSERT INTO workspace_users (position, data) VALUES (?, ?)');
    this.insertLog = this.db.prepare('INSERT INTO workspace_log (position, data) VALUES (?, ?)');
    this.insertCompany = this.db.prepare(`
      INSERT INTO companies (id, position, name, fy_start, fy_end, year_id, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertGroup = this.db.prepare(`
      INSERT INTO account_groups
        (company_id, id, position, name, parent_id, nature, group_key, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertYear = this.db.prepare(`
      INSERT INTO financial_years
        (company_id, id, position, start_date, end_date, closed, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertCostCategory = this.db.prepare(`
      INSERT INTO cost_categories (company_id, id, position, name, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.insertCostCentre = this.db.prepare(`
      INSERT INTO cost_centres (company_id, id, position, name, category_id, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertUnit = this.db.prepare(`
      INSERT INTO units (company_id, id, position, name, symbol, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.insertStockGroup = this.db.prepare(`
      INSERT INTO stock_groups (company_id, id, position, name, is_primary, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.insertGodown = this.db.prepare(`
      INSERT INTO godowns (company_id, id, position, name, is_primary, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.insertBudget = this.db.prepare(`
      INSERT INTO budgets
        (company_id, id, position, name, target_type, target_id, year_id, amount, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertCurrency = this.db.prepare(`
      INSERT INTO currencies (company_id, id, position, code, name, symbol, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertStockTransfer = this.db.prepare(`
      INSERT INTO stock_transfers
        (company_id, id, position, no, date, from_godown_id, to_godown_id, narration, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertOrder = this.db.prepare(`
      INSERT INTO orders
        (company_id, id, position, type, no, date, party_ledger_id, delivery_date,
         total, status, narration, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertBom = this.db.prepare(`
      INSERT INTO boms
        (company_id, id, position, name, output_item_id, output_qty, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertManufacture = this.db.prepare(`
      INSERT INTO manufactures
        (company_id, id, position, no, date, bom_id, bom_name, bom_output_qty,
         output_item_id, output_qty, component_godown_id, output_godown_id,
         output_batch_no, expiry_date, narration, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertTaxChallan = this.db.prepare(`
      INSERT INTO tax_challans
        (company_id, id, position, kind, date, amount, reference, bsr_code, section_id, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertLedger = this.db.prepare(`
      INSERT INTO ledgers
        (company_id, id, position, name, group_id, opening, opening_type,
         gstin, state_code, pan, address, city, pin, gst_role, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertVoucher = this.db.prepare(`
      INSERT INTO vouchers (company_id, id, position, type, no, date, total, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertLine = this.db.prepare(`
      INSERT INTO voucher_lines (voucher_id, position, ledger_id, side, amount, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.insertRecord = this.db.prepare(`
      INSERT INTO company_records
        (company_id, collection, id, position, name, parent_id, reference_id, amount, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertStockItem = this.db.prepare(`
      INSERT INTO stock_items
        (company_id, id, position, name, stock_group_id, unit_id, hsn, opening_qty,
         opening_rate, batch_tracking, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.revision = this.db.prepare('SELECT state FROM workspace_revisions WHERE rev = ?');
    this.insertRevision = this.db.prepare('INSERT INTO workspace_revisions (rev, state) VALUES (?, ?)');
    this.pruneRevisions = this.db.prepare('DELETE FROM workspace_revisions WHERE rev < ?');
    this.clearRevisions = this.db.prepare('DELETE FROM workspace_revisions');
    this.clearCompanies = this.db.prepare('DELETE FROM companies');
    this.clearGroups = this.db.prepare('DELETE FROM account_groups');
    this.clearYears = this.db.prepare('DELETE FROM financial_years');
    this.clearCostCategories = this.db.prepare('DELETE FROM cost_categories');
    this.clearCostCentres = this.db.prepare('DELETE FROM cost_centres');
    this.clearUnits = this.db.prepare('DELETE FROM units');
    this.clearStockGroups = this.db.prepare('DELETE FROM stock_groups');
    this.clearGodowns = this.db.prepare('DELETE FROM godowns');
    this.clearBudgets = this.db.prepare('DELETE FROM budgets');
    this.clearCurrencies = this.db.prepare('DELETE FROM currencies');
    this.clearStockTransfers = this.db.prepare('DELETE FROM stock_transfers');
    this.clearOrders = this.db.prepare('DELETE FROM orders');
    this.clearBoms = this.db.prepare('DELETE FROM boms');
    this.clearManufactures = this.db.prepare('DELETE FROM manufactures');
    this.clearTaxChallans = this.db.prepare('DELETE FROM tax_challans');
    this.clearRecords = this.db.prepare('DELETE FROM company_records');
    this.clearStockItems = this.db.prepare('DELETE FROM stock_items');
    this.clearUsers = this.db.prepare('DELETE FROM workspace_users');
    this.clearLog = this.db.prepare('DELETE FROM workspace_log');
    this.clearMeta = this.db.prepare('DELETE FROM workspace_meta');
    this.clearLeases = this.db.prepare('DELETE FROM workspace_leases');
    this.selectLease = this.db.prepare(
      'SELECT * FROM workspace_leases WHERE company_id = ? AND record_type = ? AND record_id = ?',
    );
    this.insertLease = this.db.prepare(`
      INSERT INTO workspace_leases
        (company_id, record_type, record_id, token_hash, user_id, username, acquired_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.deleteLease = this.db.prepare(
      'DELETE FROM workspace_leases WHERE company_id = ? AND record_type = ? AND record_id = ?',
    );
    this.pruneLeases = this.db.prepare('DELETE FROM workspace_leases WHERE expires_at <= ?');
    this.selectLegacy = this.db.prepare('SELECT rev, updated_at, state FROM workspace WHERE id = 1');
    this.clearLegacy = this.db.prepare('DELETE FROM workspace WHERE id = 1');

    this.migrateSchema();
  }

  migrateSchema() {
    const meta = this.meta.get();
    if (!meta || Number(meta.schema_version) >= SCHEMA_VERSION) return false;
    const state = this.read().state;
    if (!state) return false;
    this.replace(state, Number(meta.rev), meta.updated_at, null, { skipRevision: true });
    return true;
  }

  migrateLegacy() {
    let legacy;
    try {
      legacy = this.selectLegacy.get();
    } catch {
      return false;
    }
    if (!legacy || this.meta.get()) return false;
    let state;
    try {
      state = JSON.parse(legacy.state);
    } catch {
      throw new Error('The legacy workspace contains invalid JSON.');
    }
    if (!state || !Array.isArray(state.companies)) {
      throw new Error('The legacy workspace has no company state.');
    }
    const rev = Math.max(1, Number(legacy.rev) || 0);
    this.replace(state, rev, legacy.updated_at || new Date().toISOString());
    // The normalized rows are canonical after this point. Keeping the old blob
    // would let a later clear or failed upgrade resurrect stale books.
    this.clearLegacy.run();
    return true;
  }

  read() {
    const meta = this.meta.get();
    if (!meta) return { state: null, rev: 0, updatedAt: null };
    return stateFromRows({
      meta,
      users: this.users.all(),
      log: this.log.all(),
      companies: this.companies.all(),
      groups: this.groups.all(),
      years: this.years.all(),
      costCategories: this.costCategories.all(),
      costCentres: this.costCentres.all(),
      units: this.units.all(),
      stockGroups: this.stockGroups.all(),
      godowns: this.godowns.all(),
      budgets: this.budgets.all(),
      currencies: this.currencies.all(),
      stockTransfers: this.stockTransfers.all(),
      orders: this.orders.all(),
      boms: this.boms.all(),
      manufactures: this.manufactures.all(),
      taxChallans: this.taxChallans.all(),
      ledgers: this.ledgers.all(),
      vouchers: this.vouchers.all(),
      lines: this.lines.all(),
      records: this.records.all(),
      stockItems: this.stockItems.all(),
    });
  }

  revisionState(rev) {
    const row = this.revision.get(Number(rev));
    if (!row) return null;
    try {
      return JSON.parse(row.state);
    } catch {
      return null;
    }
  }

  ensureHistory() {
    const meta = this.meta.get();
    if (!meta || this.revision.get(meta.rev)) return false;
    const state = this.read().state;
    if (!state) return false;
    this.transaction(() => this.insertRevision.run(Number(meta.rev), JSON.stringify(state)));
    return true;
  }

  write(state, baseRev, { updatedAt, validate, afterWrite } = {}) {
    const meta = this.meta.get();
    const currentRev = meta ? Number(meta.rev) : 0;
    let nextState = state;
    let merged = false;
    let mergeError = '';
    let mergeDetails = null;
    let renumbered = 0;

    if (currentRev !== baseRev) {
      const baseRow = this.revision.get(baseRev);
      if (!baseRow) {
        return { conflict: true, rev: currentRev, updatedAt: meta?.updated_at ?? null };
      }
      let baseState;
      try {
        baseState = JSON.parse(baseRow.state);
      } catch {
        return { conflict: true, rev: currentRev, updatedAt: meta?.updated_at ?? null };
      }
      const currentState = this.read().state;
      const result = mergeWorkspaceStates(baseState, state, currentState);
      if (!result.ok) {
        mergeError = result.reason || 'The changes overlap. Reload the server copy.';
        return { conflict: true, rev: currentRev, updatedAt: meta?.updated_at ?? null, mergeError };
      }
      nextState = result.state;
      merged = true;
      mergeDetails = result.mergeDetails ?? null;
      renumbered = repairVoucherNumbers(nextState);
      if (deepEqual(nextState, currentState)) {
        return {
          conflict: false,
          rev: currentRev,
          updatedAt: meta?.updated_at ?? null,
          merged: true,
          mergeDetails,
          renumbered,
          state: currentState,
        };
      }
    }

    if (validate) {
      const previous = meta ? this.read().state : null;
      const error = validate(previous, nextState);
      if (error) return { forbidden: true, error };
    }
    const rev = currentRev + 1;
    this.replace(nextState, rev, updatedAt, afterWrite);
    return {
      conflict: false,
      rev,
      updatedAt,
      merged,
      mergeDetails,
      renumbered,
      state: merged ? nextState : undefined,
      mergeError,
    };
  }

  clear() {
    this.transaction(() => {
      this.clearRecords.run();
      this.clearStockItems.run();
      this.clearGroups.run();
      this.clearYears.run();
      this.clearCostCategories.run();
      this.clearCostCentres.run();
      this.clearUnits.run();
      this.clearStockGroups.run();
      this.clearGodowns.run();
      this.clearBudgets.run();
      this.clearCurrencies.run();
      this.clearStockTransfers.run();
      this.clearOrders.run();
      this.clearBoms.run();
      this.clearManufactures.run();
      this.clearTaxChallans.run();
      this.clearCompanies.run();
      this.clearUsers.run();
      this.clearLog.run();
      this.clearRevisions.run();
      this.clearLeases.run();
      this.clearMeta.run();
      this.clearLegacy.run();
    });
  }

  replace(state, rev, updatedAt, afterWrite = null, { skipRevision = false } = {}) {
    const meta = { ...state };
    delete meta.activeCompanyId;
    delete meta.companies;
    delete meta.users;
    delete meta.audit;
    delete meta.currentUserId;
    this.transaction(() => {
      this.clearRecords.run();
      this.clearStockItems.run();
      this.clearGroups.run();
      this.clearYears.run();
      this.clearCostCategories.run();
      this.clearCostCentres.run();
      this.clearUnits.run();
      this.clearStockGroups.run();
      this.clearGodowns.run();
      this.clearBudgets.run();
      this.clearCurrencies.run();
      this.clearStockTransfers.run();
      this.clearOrders.run();
      this.clearBoms.run();
      this.clearManufactures.run();
      this.clearTaxChallans.run();
      this.clearCompanies.run();
      this.clearUsers.run();
      this.clearLog.run();
      this.insertMeta.run(
        rev,
        updatedAt,
        SCHEMA_VERSION,
        text(state.activeCompanyId) || null,
        text(state.currentUserId) || null,
        JSON.stringify(meta),
      );
      if (!skipRevision) {
        this.insertRevision.run(rev, JSON.stringify(state));
        this.pruneRevisions.run(Math.max(0, rev - HISTORY_LIMIT));
      }
      for (const [position, user] of (state.users ?? []).entries()) {
        this.insertUser.run(position, JSON.stringify(user));
      }
      for (const [position, entry] of (state.audit ?? []).entries()) {
        this.insertLog.run(position, JSON.stringify(entry));
      }
      for (const [companyPosition, company] of (state.companies ?? []).entries()) {
        const companyData = { ...company };
        delete companyData.id;
        delete companyData.ledgers;
        delete companyData.vouchers;
        for (const [, field] of PROMOTED_COMPANY_FIELDS) delete companyData[field];
        // Empty arrays stay in companyData; non-empty arrays are reconstructed
        // from rows so there is only one canonical copy.
        for (const collection of RECORD_COLLECTIONS) {
          if (Array.isArray(company[collection]) && company[collection].length > 0) {
            delete companyData[collection];
          }
        }
        const hasGroups = Array.isArray(company.groups) && company.groups.length > 0;
        if (hasGroups) delete companyData.groups;
        const hasYears = Array.isArray(company.years) && company.years.length > 0;
        if (hasYears) delete companyData.years;
        const hasCostCategories =
          Array.isArray(company.costCategories) && company.costCategories.length > 0;
        if (hasCostCategories) delete companyData.costCategories;
        const hasCostCentres =
          Array.isArray(company.costCentres) && company.costCentres.length > 0;
        if (hasCostCentres) delete companyData.costCentres;
        const hasUnits = Array.isArray(company.units) && company.units.length > 0;
        if (hasUnits) delete companyData.units;
        const hasStockGroups =
          Array.isArray(company.stockGroups) && company.stockGroups.length > 0;
        if (hasStockGroups) delete companyData.stockGroups;
        const hasGodowns = Array.isArray(company.godowns) && company.godowns.length > 0;
        if (hasGodowns) delete companyData.godowns;
        const hasBudgets = Array.isArray(company.budgets) && company.budgets.length > 0;
        if (hasBudgets) delete companyData.budgets;
        const hasCurrencies = Array.isArray(company.currencies) && company.currencies.length > 0;
        if (hasCurrencies) delete companyData.currencies;
        const hasStockTransfers =
          Array.isArray(company.stockTransfers) && company.stockTransfers.length > 0;
        if (hasStockTransfers) delete companyData.stockTransfers;
        const hasOrders = Array.isArray(company.orders) && company.orders.length > 0;
        if (hasOrders) delete companyData.orders;
        const hasBoms = Array.isArray(company.boms) && company.boms.length > 0;
        if (hasBoms) delete companyData.boms;
        const hasManufactures =
          Array.isArray(company.manufactures) && company.manufactures.length > 0;
        if (hasManufactures) delete companyData.manufactures;
        const hasTaxChallans =
          Array.isArray(company.taxChallans) && company.taxChallans.length > 0;
        if (hasTaxChallans) delete companyData.taxChallans;
        const hasStockItems = Array.isArray(company.stockItems) && company.stockItems.length > 0;
        if (hasStockItems) delete companyData.stockItems;
        this.insertCompany.run(
          text(company.id),
          companyPosition,
          text(company.name),
          text(company.fyStart) || null,
          text(company.fyEnd) || null,
          text(company.yearId) || null,
          optionalText(company.createdAt),
          JSON.stringify(companyData),
        );
        if (hasGroups) {
          for (const [position, group] of company.groups.entries()) {
            const groupData = { ...group };
            delete groupData.id;
            for (const [, field] of PROMOTED_GROUP_FIELDS) delete groupData[field];
            this.insertGroup.run(
              text(company.id),
              text(group.id) || `groups-${position}`,
              position,
              text(group.name) || null,
              text(group.parentId) || null,
              text(group.nature) || null,
              text(group.key) || null,
              JSON.stringify(groupData),
            );
          }
        }
        if (hasYears) {
          for (const [position, year] of company.years.entries()) {
            const yearData = { ...year };
            delete yearData.id;
            for (const [, field] of PROMOTED_YEAR_FIELDS) delete yearData[field];
            this.insertYear.run(
              text(company.id),
              text(year.id) || `years-${position}`,
              position,
              text(year.start) || null,
              text(year.end) || null,
              year.closed ? 1 : 0,
              JSON.stringify(yearData),
            );
          }
        }
        if (hasCostCategories) {
          for (const [position, category] of company.costCategories.entries()) {
            const categoryData = { ...category };
            delete categoryData.id;
            delete categoryData.name;
            for (const [, field] of PROMOTED_COST_MASTER_FIELDS) delete categoryData[field];
            this.insertCostCategory.run(
              text(company.id),
              text(category.id) || `costCategories-${position}`,
              position,
              text(category.name) || null,
              optionalText(category.createdAt),
              JSON.stringify(categoryData),
            );
          }
        }
        if (hasCostCentres) {
          for (const [position, centre] of company.costCentres.entries()) {
            const centreData = { ...centre };
            delete centreData.id;
            delete centreData.name;
            delete centreData.categoryId;
            for (const [, field] of PROMOTED_COST_MASTER_FIELDS) delete centreData[field];
            this.insertCostCentre.run(
              text(company.id),
              text(centre.id) || `costCentres-${position}`,
              position,
              text(centre.name) || null,
              text(centre.categoryId) || null,
              optionalText(centre.createdAt),
              JSON.stringify(centreData),
            );
          }
        }
        if (hasUnits) {
          for (const [position, unit] of company.units.entries()) {
            const unitData = { ...unit };
            delete unitData.id;
            for (const [, field] of PROMOTED_UNIT_FIELDS) delete unitData[field];
            this.insertUnit.run(
              text(company.id),
              text(unit.id) || `units-${position}`,
              position,
              text(unit.name) || null,
              text(unit.symbol) || null,
              JSON.stringify(unitData),
            );
          }
        }
        if (hasStockGroups) {
          for (const [position, group] of company.stockGroups.entries()) {
            const groupData = { ...group };
            delete groupData.id;
            for (const [, field] of PROMOTED_STOCK_GROUP_FIELDS) delete groupData[field];
            this.insertStockGroup.run(
              text(company.id),
              text(group.id) || `stockGroups-${position}`,
              position,
              text(group.name) || null,
              group.primary ? 1 : 0,
              JSON.stringify(groupData),
            );
          }
        }
        if (hasGodowns) {
          for (const [position, godown] of company.godowns.entries()) {
            const godownData = { ...godown };
            delete godownData.id;
            for (const [, field] of PROMOTED_GODOWN_FIELDS) delete godownData[field];
            this.insertGodown.run(
              text(company.id),
              text(godown.id) || `godowns-${position}`,
              position,
              text(godown.name) || null,
              godown.primary ? 1 : 0,
              JSON.stringify(godownData),
            );
          }
        }
        if (hasBudgets) {
          for (const [position, budget] of company.budgets.entries()) {
            const budgetData = { ...budget };
            delete budgetData.id;
            for (const [, field] of PROMOTED_BUDGET_FIELDS) delete budgetData[field];
            this.insertBudget.run(
              text(company.id),
              text(budget.id) || `budgets-${position}`,
              position,
              text(budget.name) || null,
              text(budget.targetType) || null,
              text(budget.targetId) || null,
              text(budget.yearId) || null,
              optionalNumber(budget.amount),
              optionalText(budget.createdAt),
              JSON.stringify(budgetData),
            );
          }
        }
        if (hasCurrencies) {
          for (const [position, currency] of company.currencies.entries()) {
            const currencyData = { ...currency };
            delete currencyData.id;
            for (const [, field] of PROMOTED_CURRENCY_FIELDS) delete currencyData[field];
            this.insertCurrency.run(
              text(company.id),
              text(currency.id) || `currencies-${position}`,
              position,
              text(currency.code) || null,
              text(currency.name) || null,
              text(currency.symbol) || null,
              optionalText(currency.createdAt),
              JSON.stringify(currencyData),
            );
          }
        }
        if (hasStockTransfers) {
          for (const [position, transfer] of company.stockTransfers.entries()) {
            const transferData = { ...transfer };
            delete transferData.id;
            for (const [, field] of PROMOTED_STOCK_TRANSFER_FIELDS) delete transferData[field];
            this.insertStockTransfer.run(
              text(company.id),
              text(transfer.id) || `stockTransfers-${position}`,
              position,
              optionalNumber(transfer.no),
              text(transfer.date) || null,
              text(transfer.fromGodownId) || null,
              text(transfer.toGodownId) || null,
              transfer.narration === undefined ? null : text(transfer.narration),
              optionalText(transfer.createdAt),
              JSON.stringify(transferData),
            );
          }
        }
        if (hasOrders) {
          for (const [position, order] of company.orders.entries()) {
            const orderData = { ...order };
            delete orderData.id;
            for (const [, field] of PROMOTED_ORDER_FIELDS) delete orderData[field];
            this.insertOrder.run(
              text(company.id),
              text(order.id) || `orders-${position}`,
              position,
              text(order.type) || null,
              optionalNumber(order.no),
              text(order.date) || null,
              text(order.partyLedgerId) || null,
              text(order.deliveryDate) || null,
              optionalNumber(order.total),
              text(order.status) || null,
              order.narration === undefined ? null : text(order.narration),
              optionalText(order.createdAt),
              JSON.stringify(orderData),
            );
          }
        }
        if (hasBoms) {
          for (const [position, bom] of company.boms.entries()) {
            const bomData = { ...bom };
            delete bomData.id;
            for (const [, field] of PROMOTED_BOM_FIELDS) delete bomData[field];
            this.insertBom.run(
              text(company.id),
              text(bom.id) || `boms-${position}`,
              position,
              text(bom.name) || null,
              text(bom.outputItemId) || null,
              optionalNumber(bom.outputQty),
              optionalText(bom.createdAt),
              JSON.stringify(bomData),
            );
          }
        }
        if (hasManufactures) {
          for (const [position, manufacture] of company.manufactures.entries()) {
            const manufactureData = { ...manufacture };
            delete manufactureData.id;
            for (const [, field] of PROMOTED_MANUFACTURE_FIELDS) delete manufactureData[field];
            this.insertManufacture.run(
              text(company.id),
              text(manufacture.id) || `manufactures-${position}`,
              position,
              optionalNumber(manufacture.no),
              text(manufacture.date) || null,
              text(manufacture.bomId) || null,
              text(manufacture.bomName) || null,
              optionalNumber(manufacture.bomOutputQty),
              text(manufacture.outputItemId) || null,
              optionalNumber(manufacture.outputQty),
              text(manufacture.componentGodownId) || null,
              text(manufacture.outputGodownId) || null,
              text(manufacture.outputBatchNo) || null,
              text(manufacture.expiryDate) || null,
              manufacture.narration === undefined ? null : text(manufacture.narration),
              optionalText(manufacture.createdAt),
              JSON.stringify(manufactureData),
            );
          }
        }
        if (hasTaxChallans) {
          for (const [position, challan] of company.taxChallans.entries()) {
            const challanData = { ...challan };
            delete challanData.id;
            for (const [, field] of PROMOTED_TAX_CHALLAN_FIELDS) delete challanData[field];
            this.insertTaxChallan.run(
              text(company.id),
              text(challan.id) || `taxChallans-${position}`,
              position,
              text(challan.kind) || null,
              text(challan.date) || null,
              optionalNumber(challan.amount),
              challan.reference === undefined ? null : text(challan.reference),
              challan.bsrCode === undefined ? null : text(challan.bsrCode),
              text(challan.sectionId) || null,
              JSON.stringify(challanData),
            );
          }
        }
        for (const collection of RECORD_COLLECTIONS) {
          const items = company[collection];
          if (!Array.isArray(items) || items.length === 0) continue;
          for (const [position, item] of items.entries()) {
            const hint = recordHint(collection, item);
            this.insertRecord.run(
              text(company.id),
              collection,
              text(item.id) || `${collection}-${position}`,
              position,
              hint.name || null,
              hint.parent || null,
              hint.reference || null,
              hint.amount,
              JSON.stringify(item),
            );
          }
        }
        if (hasStockItems) {
          for (const [position, item] of company.stockItems.entries()) {
            const itemData = { ...item };
            delete itemData.id;
            for (const [, field] of PROMOTED_STOCK_FIELDS) delete itemData[field];
            this.insertStockItem.run(
              text(company.id),
              text(item.id) || `stockItems-${position}`,
              position,
              text(item.name) || null,
              text(item.stockGroupId) || null,
              text(item.unitId) || null,
              text(item.hsn) || null,
              optionalNumber(item.openingQty),
              optionalNumber(item.openingRate),
              item.batchTracking ? 1 : 0,
              optionalText(item.createdAt),
              JSON.stringify(itemData),
            );
          }
        }
        for (const [position, ledger] of (company.ledgers ?? []).entries()) {
          const ledgerData = { ...ledger };
          for (const field of [
            'id',
            'name',
            'groupId',
            'opening',
            'openingType',
            'gstin',
            'stateCode',
            'pan',
            'address',
            'city',
            'pin',
            'gstRole',
            'createdAt',
          ]) {
            delete ledgerData[field];
          }
          this.insertLedger.run(
            text(company.id),
            text(ledger.id),
            position,
            text(ledger.name),
            text(ledger.groupId) || null,
            number(ledger.opening),
            ledger.openingType === 'Cr' ? 'Cr' : 'Dr',
            optionalText(ledger.gstin),
            optionalText(ledger.stateCode),
            optionalText(ledger.pan),
            optionalText(ledger.address),
            optionalText(ledger.city),
            optionalText(ledger.pin),
            optionalText(ledger.gstRole),
            optionalText(ledger.createdAt),
            JSON.stringify(ledgerData),
          );
        }
        for (const [position, voucher] of (company.vouchers ?? []).entries()) {
          const voucherData = { ...voucher };
          delete voucherData.id;
          delete voucherData.lines;
          this.insertVoucher.run(
            text(company.id),
            text(voucher.id),
            position,
            text(voucher.type),
            number(voucher.no),
            text(voucher.date) || null,
            number(voucher.total),
            JSON.stringify(voucherData),
          );
          for (const [linePosition, line] of (voucher.lines ?? []).entries()) {
            const lineData = { ...line };
            delete lineData.ledgerId;
            delete lineData.side;
            delete lineData.amount;
            this.insertLine.run(
              text(voucher.id),
              linePosition,
              text(line.ledgerId) || null,
              text(line.side),
              number(line.amount),
              JSON.stringify(lineData),
            );
          }
        }
      }
      if (afterWrite) afterWrite(rev);
    });
  }

  leaseFor(companyId, recordType, recordId, now = Date.now()) {
    const row = this.selectLease.get(text(companyId), text(recordType), text(recordId));
    if (!row) return null;
    if (Date.parse(row.expires_at) <= now) {
      this.deleteLease.run(text(companyId), text(recordType), text(recordId));
      return null;
    }
    return row;
  }

  acquireLease({ companyId, recordType, recordId, user, token = '', ttlMs = DEFAULT_LEASE_MS }) {
    const ttl = Math.min(MAX_LEASE_MS, Math.max(10_000, Number(ttlMs) || DEFAULT_LEASE_MS));
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expiresAt = new Date(now + ttl).toISOString();
    return this.transaction(() => {
      this.pruneLeases.run(nowIso);
      const existing = this.selectLease.get(text(companyId), text(recordType), text(recordId));
      const presented = tokenHash(token);
      if (existing && Date.parse(existing.expires_at) > now && existing.token_hash !== presented) {
        return { ok: false, locked: true, holder: leaseHolder(existing) };
      }
      if (existing && existing.token_hash === presented) {
        this.deleteLease.run(text(companyId), text(recordType), text(recordId));
        this.insertLease.run(
          text(companyId),
          text(recordType),
          text(recordId),
          existing.token_hash,
          existing.user_id,
          existing.username,
          existing.acquired_at,
          expiresAt,
        );
        return {
          ok: true,
          token,
          renewed: true,
          lease: {
            userId: existing.user_id,
            username: existing.username,
            acquiredAt: existing.acquired_at,
            expiresAt,
          },
        };
      }
      // An expired lease is pruned above. A new owner receives a fresh token.
      const fresh = randomBytes(24).toString('hex');
      this.deleteLease.run(text(companyId), text(recordType), text(recordId));
      this.insertLease.run(
        text(companyId),
        text(recordType),
        text(recordId),
        tokenHash(fresh),
        text(user.id),
        text(user.username || user.name || user.id),
        nowIso,
        expiresAt,
      );
      return {
        ok: true,
        token: fresh,
        renewed: false,
        lease: {
          userId: text(user.id),
          username: text(user.username || user.name || user.id),
          acquiredAt: nowIso,
          expiresAt,
        },
      };
    });
  }

  releaseLease({ companyId, recordType, recordId, token }) {
    return this.transaction(() => {
      const existing = this.selectLease.get(text(companyId), text(recordType), text(recordId));
      if (!existing) return { ok: true, released: false };
      if (existing.token_hash !== tokenHash(token)) {
        return { ok: false, locked: true, holder: leaseHolder(existing) };
      }
      this.deleteLease.run(text(companyId), text(recordType), text(recordId));
      return { ok: true, released: true };
    });
  }

  transaction(task) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = task();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // The transaction may already have rolled back.
      }
      throw error;
    }
  }
}

export { RECORD_COLLECTIONS, SCHEMA_VERSION };

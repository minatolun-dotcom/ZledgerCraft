// ZledgerCraft - accounting engine. Pure functions over a company object.
import {
  VOUCHER_TYPES,
  billLabel,
  booksStart,
  groupById,
  gstStateName,
  gstinChecksumValid,
  isValidIsoDate,
  orderRemainingItems,
  primaryGroupOf,
  rateForCurrency,
  round2,
  round3,
  signedOpening,
  vouchersSorted,
} from './store.js';

export const EPSILON = 0.01;

export function dateRange(company, filters = {}) {
  return { from: filters.from || company.fyStart, to: filters.to || company.fyEnd };
}

/** Balances as of `filters.to`, with period movements when `filters.from` is set. */
export function ledgerTotals(company, filters = {}) {
  const to = filters.to || company.fyEnd;
  const from = filters.from || null;
  const totals = new Map();
  for (const ledger of company.ledgers) {
    totals.set(ledger.id, {
      ledgerId: ledger.id,
      name: ledger.name,
      groupId: ledger.groupId,
      opening: signedOpening(ledger),
      debit: 0,
      credit: 0,
      periodDebit: 0,
      periodCredit: 0,
      closing: 0,
    });
  }
  for (const voucher of company.vouchers) {
    if (voucher.date > to) continue;
    for (const line of voucher.lines ?? []) {
      const entry = totals.get(line.ledgerId);
      if (!entry) continue;
      if (line.side === 'Cr') {
        entry.credit = round2(entry.credit + line.amount);
      } else {
        entry.debit = round2(entry.debit + line.amount);
      }
      if (from && voucher.date >= from) {
        if (line.side === 'Cr') entry.periodCredit = round2(entry.periodCredit + line.amount);
        else entry.periodDebit = round2(entry.periodDebit + line.amount);
      }
    }
  }
  for (const entry of totals.values()) {
    entry.closing = round2(entry.opening + entry.debit - entry.credit);
  }
  return totals;
}

export function openingDifference(company) {
  return round2(company.ledgers.reduce((sum, ledger) => sum + signedOpening(ledger), 0));
}

export function groupNature(company, groupId) {
  const group = groupById(company, groupId);
  if (group) return group.nature;
  const primary = primaryGroupOf(company, groupId);
  return primary ? primary.nature : 'Assets';
}

export function isDirectGroup(company, groupId) {
  const primary = primaryGroupOf(company, groupId);
  return Boolean(primary && ['sales', 'directIncomes', 'purchase', 'directExpenses'].includes(primary.key));
}

export function primaryKeyOf(company, groupId) {
  return primaryGroupOf(company, groupId)?.key ?? 'currentAssets';
}

/** Keys of the group and all its ancestors, e.g. [cash, currentAssets]. */
export function groupChainKeys(company, groupId) {
  const keys = [];
  let group = groupById(company, groupId);
  let guard = 0;
  while (group && guard < 32) {
    keys.push(group.key);
    group = group.parentId ? groupById(company, group.parentId) : null;
    guard += 1;
  }
  return keys;
}

/** True when the ledger sits in the group with this key, or below it. */
export function inGroupKey(company, ledger, key) {
  return groupChainKeys(company, ledger.groupId).includes(key);
}

function primaryNameOf(company, groupId) {
  return primaryGroupOf(company, groupId)?.name ?? 'Current Assets';
}

function sectionize(company, rows) {
  const order = [];
  const buckets = new Map();
  for (const row of rows) {
    const key = primaryKeyOf(company, row.groupId);
    if (!buckets.has(key)) {
      buckets.set(key, { key, title: primaryNameOf(company, row.groupId), rows: [], total: 0 });
      order.push(key);
    }
    const bucket = buckets.get(key);
    bucket.rows.push(row);
    bucket.total = round2(bucket.total + row.amount);
  }
  return order.map((key) => buckets.get(key));
}

export function trialBalance(company, filters = {}) {
  const to = filters.to || company.fyEnd;
  const totals = ledgerTotals(company, { to });
  const rows = [];
  let debitTotal = 0;
  let creditTotal = 0;
  for (const entry of totals.values()) {
    if (Math.abs(entry.closing) < EPSILON) continue;
    const debit = entry.closing > 0 ? entry.closing : 0;
    const credit = entry.closing < 0 ? -entry.closing : 0;
    rows.push({
      ledgerId: entry.ledgerId,
      name: entry.name,
      groupName: primaryNameOf(company, entry.groupId),
      debit: round2(debit),
      credit: round2(credit),
    });
    debitTotal = round2(debitTotal + debit);
    creditTotal = round2(creditTotal + credit);
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));

  // Net debit openings mean the debit column is short by that amount, so the
  // adjusting row belongs on the credit side (and vice versa).
  const difference = openingDifference(company);
  if (Math.abs(difference) >= EPSILON) {
    rows.push({
      ledgerId: null,
      name: 'Difference in Opening Balances',
      groupName: 'Suspense',
      debit: difference < 0 ? round2(-difference) : 0,
      credit: difference > 0 ? round2(difference) : 0,
    });
    if (difference > 0) creditTotal = round2(creditTotal + difference);
    else debitTotal = round2(debitTotal - difference);
  }

  return {
    asOn: to,
    rows,
    debitTotal,
    creditTotal,
    difference: round2(debitTotal - creditTotal),
    balanced: Math.abs(debitTotal - creditTotal) < EPSILON,
  };
}

export function profitAndLoss(company, filters = {}) {
  const { from, to } = dateRange(company, filters);
  // Opening balances belong to the first day of the books, not to every year.
  const includeOpening = from <= booksStart(company);
  const totals = ledgerTotals(company, { from: includeOpening ? null : from, to });
  const directIncome = [];
  const directExpense = [];
  const indirectIncome = [];
  const indirectExpense = [];

  for (const entry of totals.values()) {
    const nature = groupNature(company, entry.groupId);
    if (nature !== 'Income' && nature !== 'Expense') continue;
    const net = nature === 'Income'
      ? (includeOpening ? -entry.closing : entry.periodCredit - entry.periodDebit)
      : (includeOpening ? entry.closing : entry.periodDebit - entry.periodCredit);
    const amount = round2(net);
    if (Math.abs(amount) < EPSILON) continue;
    const row = {
      ledgerId: entry.ledgerId,
      name: entry.name,
      groupId: entry.groupId,
      groupName: primaryNameOf(company, entry.groupId),
      amount,
    };
    if (nature === 'Income') (isDirectGroup(company, entry.groupId) ? directIncome : indirectIncome).push(row);
    else (isDirectGroup(company, entry.groupId) ? directExpense : indirectExpense).push(row);
  }

  const sum = (rows) => round2(rows.reduce((total, row) => total + row.amount, 0));
  const directIncomeTotal = sum(directIncome);
  const directExpenseTotal = sum(directExpense);
  const indirectIncomeTotal = sum(indirectIncome);
  const indirectExpenseTotal = sum(indirectExpense);

  const grossProfit = round2(directIncomeTotal - directExpenseTotal);
  const netProfit = round2(grossProfit + indirectIncomeTotal - indirectExpenseTotal);

  return {
    from,
    to,
    includeOpening,
    direct: {
      sections: sectionize(company, directIncome),
      incomeTotal: directIncomeTotal,
      expenseSections: sectionize(company, directExpense),
      expenseTotal: directExpenseTotal,
    },
    indirect: {
      sections: sectionize(company, indirectIncome),
      incomeTotal: indirectIncomeTotal,
      expenseSections: sectionize(company, indirectExpense),
      expenseTotal: indirectExpenseTotal,
    },
    grossProfit,
    netProfit,
    isProfit: netProfit >= 0,
  };
}

export function balanceSheet(company, filters = {}) {
  const to = filters.to || company.fyEnd;
  const totals = ledgerTotals(company, { to });
  const assetRows = [];
  const liabilityRows = [];

  for (const entry of totals.values()) {
    const nature = groupNature(company, entry.groupId);
    if (nature === 'Assets') {
      assetRows.push({
        ledgerId: entry.ledgerId,
        name: entry.name,
        groupId: entry.groupId,
        amount: entry.closing,
      });
    } else if (nature === 'Liabilities') {
      liabilityRows.push({
        ledgerId: entry.ledgerId,
        name: entry.name,
        groupId: entry.groupId,
        amount: round2(-entry.closing),
      });
    }
  }

  const pnl = profitAndLoss(company, { from: booksStart(company), to });
  const profitGroup = company.groups.find((group) => group.key === 'reserves')?.id
    ?? company.groups[0]?.id;
  const profitRow = {
    ledgerId: null,
    name: 'Profit & Loss A/c',
    groupId: profitGroup,
    amount: Math.abs(pnl.netProfit),
  };
  if (pnl.netProfit >= 0) liabilityRows.push(profitRow);
  else assetRows.push(profitRow);

  // Excess debit openings leave assets above liabilities, so the balancing
  // line sits on the liabilities side (and vice versa).
  const difference = openingDifference(company);
  if (Math.abs(difference) >= EPSILON) {
    const row = {
      ledgerId: null,
      name: 'Difference in Opening Balances',
      groupId: company.groups.find((group) => group.key === 'suspense')?.id,
      amount: Math.abs(difference),
    };
    if (difference > 0) liabilityRows.push(row);
    else assetRows.push(row);
  }

  assetRows.sort((a, b) => a.name.localeCompare(b.name));
  liabilityRows.sort((a, b) => a.name.localeCompare(b.name));

  const assetTotal = round2(assetRows.reduce((sum, row) => sum + row.amount, 0));
  const liabilityTotal = round2(liabilityRows.reduce((sum, row) => sum + row.amount, 0));

  return {
    asOn: to,
    assets: { sections: sectionize(company, assetRows), total: assetTotal },
    liabilities: { sections: sectionize(company, liabilityRows), total: liabilityTotal },
    netProfit: pnl.netProfit,
    difference: round2(assetTotal - liabilityTotal),
    balanced: Math.abs(assetTotal - liabilityTotal) < EPSILON,
  };
}

/** Company-wise totals across a group of companies; no inter-company elimination. */
export function consolidationSummary(companies, filters = {}) {
  const asOn = filters.asOn || '';
  const rows = (companies ?? []).map((company) => {
    const to = asOn && asOn >= company.fyStart && asOn <= company.fyEnd ? asOn : company.fyEnd;
    const pnl = profitAndLoss(company, { from: company.fyStart, to });
    const sheet = balanceSheet(company, { to });
    const receivable = outstanding(company, { side: 'receivable', asOn: to });
    const payable = outstanding(company, { side: 'payable', asOn: to });
    const totals = ledgerTotals(company, { to });
    const cash = round2(
      cashBankLedgers(company).reduce((sum, ledger) => sum + (totals.get(ledger.id)?.closing ?? 0), 0),
    );
    return {
      id: company.id,
      name: company.name,
      asOn: to,
      income: round2(pnl.direct.incomeTotal + pnl.indirect.incomeTotal),
      expenses: round2(pnl.direct.expenseTotal + pnl.indirect.expenseTotal),
      netProfit: pnl.netProfit,
      assets: sheet.assets.total,
      liabilities: sheet.liabilities.total,
      receivable: receivable.total,
      payable: payable.total,
      cash,
    };
  });
  const sum = (key) => round2(rows.reduce((total, row) => total + row[key], 0));
  return {
    rows,
    totals: {
      income: sum('income'),
      expenses: sum('expenses'),
      netProfit: sum('netProfit'),
      assets: sum('assets'),
      liabilities: sum('liabilities'),
      receivable: sum('receivable'),
      payable: sum('payable'),
      cash: sum('cash'),
    },
  };
}

/** Side-by-side P&L and balance-sheet figures for every financial year. */
export function yearComparison(company) {
  const years = [...(company.years ?? [])].sort((a, b) => a.start.localeCompare(b.start));
  return years.map((year) => {
    const pnl = profitAndLoss(company, { from: year.start, to: year.end });
    const sheet = balanceSheet(company, { to: year.end });
    const totals = ledgerTotals(company, { to: year.end });
    let cash = 0;
    let bank = 0;
    for (const ledger of company.ledgers) {
      const entry = totals.get(ledger.id);
      if (!entry) continue;
      if (inGroupKey(company, ledger, 'cash')) cash = round2(cash + entry.closing);
      if (inGroupKey(company, ledger, 'bank')) bank = round2(bank + entry.closing);
    }
    const receivable = outstanding(company, { side: 'receivable', asOn: year.end });
    const payable = outstanding(company, { side: 'payable', asOn: year.end });
    return {
      id: year.id,
      start: year.start,
      end: year.end,
      closed: Boolean(year.closed),
      selected: year.id === company.yearId,
      vouchers: company.vouchers.filter((voucher) => voucher.date >= year.start && voucher.date <= year.end).length,
      directIncome: pnl.direct.incomeTotal,
      directExpense: pnl.direct.expenseTotal,
      grossProfit: pnl.grossProfit,
      indirectIncome: pnl.indirect.incomeTotal,
      indirectExpense: pnl.indirect.expenseTotal,
      netProfit: pnl.netProfit,
      assets: sheet.assets.total,
      liabilities: sheet.liabilities.total,
      cash,
      bank,
      receivables: receivable.total,
      payables: payable.total,
    };
  });
}

/** Bank statement matching status for one bank ledger. */
export function bankReconciliation(company, ledgerId) {
  const ledger = company.ledgers.find((item) => item.id === ledgerId) ?? null;
  if (!ledger) return null;
  const config = company.bankReconciliations?.[ledgerId] ?? null;
  const matches = config?.matches ?? {};
  const entries = [];
  const vouchers = [...company.vouchers].sort(
    (a, b) => a.date.localeCompare(b.date) || (Number(a.no) || 0) - (Number(b.no) || 0),
  );
  for (const voucher of vouchers) {
    for (const [lineIndex, line] of (voucher.lines ?? []).entries()) {
      if (line.ledgerId !== ledgerId) continue;
      const matchedLineId = Object.entries(matches).find(([, voucherId]) => voucherId === voucher.id)?.[0] ?? null;
      entries.push({
        voucherId: voucher.id,
        lineIndex,
        type: voucher.type,
        no: voucher.no,
        date: voucher.date,
        narration: voucher.narration ?? '',
        amount: line.side === 'Cr' ? -round2(line.amount) : round2(line.amount),
        matchedLineId,
      });
    }
  }
  const lines = (config?.statement?.lines ?? []).map((line) => ({
    ...line,
    matchedVoucherId: matches[line.id] ?? null,
    matchedEntry: entries.find((entry) => entry.voucherId === matches[line.id]) ?? null,
  }));
  const matchedLines = lines.filter((line) => line.matchedVoucherId);
  const unmatchedEntries = entries.filter((entry) => !entry.matchedLineId);
  const opening = signedOpening(ledger);
  const bookBalance = round2(opening + entries.reduce((sum, entry) => sum + entry.amount, 0));
  const balances = config?.statement?.balances ?? null;
  const statementNet = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  const statementDifference = balances
    ? round2(balances.closing - (balances.opening + statementNet))
    : null;

  return {
    ledger,
    importedAt: config?.statement?.importedAt ?? null,
    lines,
    entries,
    unmatchedEntries,
    matchedCount: matchedLines.length,
    unmatchedCount: lines.length - matchedLines.length,
    matchedAmount: round2(matchedLines.reduce((sum, line) => sum + Math.abs(line.amount), 0)),
    unmatchedStatementAmount: round2(
      lines.filter((line) => !line.matchedVoucherId).reduce((sum, line) => sum + Math.abs(line.amount), 0),
    ),
    unmatchedBookAmount: round2(unmatchedEntries.reduce((sum, entry) => sum + Math.abs(entry.amount), 0)),
    inflow: round2(lines.filter((line) => line.amount > 0).reduce((sum, line) => sum + line.amount, 0)),
    outflow: round2(lines.filter((line) => line.amount < 0).reduce((sum, line) => sum + line.amount, 0)),
    opening,
    bookBalance,
    balances,
    statementNet,
    statementDifference,
    matchedPercent: lines.length ? Math.round((matchedLines.length / lines.length) * 100) : 0,
  };
}

export function dayBook(company, filters = {}) {
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  return vouchersSorted(company).filter((voucher) => {
    if (voucher.date < from || voucher.date > to) return false;
    if (filters.type && filters.type !== 'All' && voucher.type !== filters.type) return false;
    return true;
  });
}

export function ledgerStatement(company, ledgerId, filters = {}) {
  const ledger = company.ledgers.find((item) => item.id === ledgerId);
  if (!ledger) return null;
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const group = groupById(company, ledger.groupId);

  let opening = signedOpening(ledger);
  for (const voucher of company.vouchers) {
    if (voucher.date >= from) continue;
    for (const line of voucher.lines ?? []) {
      if (line.ledgerId !== ledgerId) continue;
      opening = round2(opening + (line.side === 'Cr' ? -line.amount : line.amount));
    }
  }

  const entries = [];
  for (const voucher of company.vouchers) {
    if (voucher.date < from || voucher.date > to) continue;
    for (const [index, line] of (voucher.lines ?? []).entries()) {
      if (line.ledgerId !== ledgerId) continue;
      const others = voucher.lines
        .filter((_, otherIndex) => otherIndex !== index)
        .map((other) => company.ledgers.find((item) => item.id === other.ledgerId)?.name ?? 'Unknown')
        .join(', ');
      entries.push({
        voucherId: voucher.id,
        date: voucher.date,
        voucher: `${voucher.type} ${voucher.no}`,
        type: voucher.type,
        particulars: others || voucher.narration || voucher.type,
        narration: voucher.narration,
        debit: line.side === 'Dr' ? round2(line.amount) : 0,
        credit: line.side === 'Cr' ? round2(line.amount) : 0,
      });
    }
  }
  entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.voucher.localeCompare(b.voucher);
  });

  let running = opening;
  let debitTotal = 0;
  let creditTotal = 0;
  for (const entry of entries) {
    running = round2(running + entry.debit - entry.credit);
    entry.balance = running;
    debitTotal = round2(debitTotal + entry.debit);
    creditTotal = round2(creditTotal + entry.credit);
  }

  return {
    ledger,
    groupName: group ? group.name : 'Unknown group',
    from,
    to,
    opening: round2(opening),
    rows: entries,
    debitTotal,
    creditTotal,
    closing: running,
  };
}

export function dashboard(company) {
  const totals = ledgerTotals(company);
  let cash = 0;
  let bank = 0;
  for (const ledger of company.ledgers) {
    const entry = totals.get(ledger.id);
    if (!entry) continue;
    if (inGroupKey(company, ledger, 'cash')) cash = round2(cash + entry.closing);
    if (inGroupKey(company, ledger, 'bank')) bank = round2(bank + entry.closing);
  }
  const pnl = profitAndLoss(company);
  const receivable = outstanding(company, { side: 'receivable', asOn: company.fyEnd });
  const payable = outstanding(company, { side: 'payable', asOn: company.fyEnd });

  const now = new Date();
  const localDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = localDate(now);
  const from = monthStart < company.fyStart ? company.fyStart : monthStart;
  const to = today > company.fyEnd ? company.fyEnd : today;
  let salesThisMonth = 0;
  let vouchersThisMonth = 0;
  for (const voucher of company.vouchers) {
    if (voucher.date < from || voucher.date > to) continue;
    vouchersThisMonth += 1;
    if (voucher.type === 'Sales') salesThisMonth = round2(salesThisMonth + voucher.total);
    if (voucher.type === 'CreditNote') salesThisMonth = round2(salesThisMonth - voucher.total);
  }

  const stock = stockSummary(company);
  const outOfStock = stock.rows.filter((row) => row.closingQty <= 0);

  return {
    cash,
    bank,
    vouchers: company.vouchers.length,
    ledgers: company.ledgers.length,
    netProfit: pnl.netProfit,
    receivables: receivable.total,
    payables: payable.total,
    salesThisMonth,
    vouchersThisMonth,
    outOfStock: outOfStock.length,
    outOfStockNames: outOfStock.slice(0, 4).map((row) => row.name),
    monthLabel: from.slice(0, 7),
  };
}

export function voucherSummary(company, voucher) {
  return (voucher.lines ?? [])
    .map((line) => {
      const ledger = company.ledgers.find((item) => item.id === line.ledgerId);
      return `${line.side} ${ledger ? ledger.name : 'Unknown'}`;
    })
    .join(' / ');
}

function groupIdsUnder(company, groupId) {
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

function ledgersUnderGroup(company, groupId) {
  const ids = groupIdsUnder(company, groupId);
  return company.ledgers.filter((ledger) => ids.has(ledger.groupId));
}

/** Ledgers where cash or bank is the primary group. */
export function cashBankLedgers(company) {
  return company.ledgers
    .filter((ledger) => inGroupKey(company, ledger, 'cash') || inGroupKey(company, ledger, 'bank'))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Cash Book / Bank Book: receipts, payments and running balance per cash-bank ledger. */
export function cashBankBook(company, filters = {}) {
  const { from, to } = dateRange(company, filters);
  const ledgers = filters.ledgerId
    ? company.ledgers.filter((ledger) => ledger.id === filters.ledgerId)
    : cashBankLedgers(company);

  const sections = ledgers
    .map((ledger) => {
      const statement = ledgerStatement(company, ledger.id, { from, to });
      if (!statement) return null;
      return {
        ledgerId: ledger.id,
        name: ledger.name,
        groupName: statement.groupName,
        opening: statement.opening,
        rows: statement.rows.map((row) => ({
          voucherId: row.voucherId,
          date: row.date,
          voucher: row.voucher,
          particulars: row.particulars,
          receipt: row.debit,
          payment: row.credit,
          balance: row.balance,
        })),
        receiptTotal: statement.debitTotal,
        paymentTotal: statement.creditTotal,
        closing: statement.closing,
      };
    })
    .filter(Boolean);

  return {
    from,
    to,
    sections,
    opening: round2(sections.reduce((sum, section) => sum + section.opening, 0)),
    receiptTotal: round2(sections.reduce((sum, section) => sum + section.receiptTotal, 0)),
    paymentTotal: round2(sections.reduce((sum, section) => sum + section.paymentTotal, 0)),
    closing: round2(sections.reduce((sum, section) => sum + section.closing, 0)),
  };
}

function partyForVoucher(company, voucher) {
  const lines = (voucher.lines ?? []).map((line) => ({
    ...line,
    ledger: company.ledgers.find((item) => item.id === line.ledgerId),
  }));
  const outside = (side, excludedKeys) =>
    lines.find(
      (line) =>
        line.side === side &&
        line.ledger &&
        !excludedKeys.includes(primaryKeyOf(company, line.ledger.groupId)),
    );
  let party = null;
  if (voucher.type === 'Sales') {
    party = outside('Dr', ['sales', 'directIncomes']) ?? lines.find((line) => line.side === 'Dr');
  } else if (voucher.type === 'CreditNote') {
    party = outside('Cr', ['sales', 'directIncomes']) ?? lines.find((line) => line.side === 'Cr');
  } else if (voucher.type === 'Purchase') {
    party = outside('Cr', ['purchase', 'directExpenses']) ?? lines.find((line) => line.side === 'Cr');
  } else if (voucher.type === 'DebitNote') {
    party = outside('Dr', ['purchase', 'directExpenses']) ?? lines.find((line) => line.side === 'Dr');
  } else if (voucher.type === 'Payment') {
    party = lines.find((line) => line.side === 'Dr');
  } else if (voucher.type === 'Receipt') {
    party = lines.find((line) => line.side === 'Cr');
  }
  return party?.ledger?.name ?? lines.map((line) => line.ledger?.name ?? 'Unknown').join(' / ');
}

/** Sales / purchase / credit note / debit note registers. */
export function voucherRegister(company, filters = {}) {
  const { from, to } = dateRange(company, filters);
  const wanted = filters.types?.length
    ? filters.types
    : filters.type && filters.type !== 'All'
      ? [filters.type]
      : null;

  const rows = vouchersSorted(company)
    .filter((voucher) => voucher.date >= from && voucher.date <= to)
    .filter((voucher) => !wanted || wanted.includes(voucher.type))
    .map((voucher) => ({
      voucherId: voucher.id,
      date: voucher.date,
      type: voucher.type,
      no: voucher.no,
      party: partyForVoucher(company, voucher),
      particulars: voucherSummary(company, voucher),
      narration: voucher.narration ?? '',
      total: voucher.total,
    }));

  return {
    from,
    to,
    rows,
    count: rows.length,
    total: round2(rows.reduce((sum, row) => sum + row.total, 0)),
  };
}

const NUMBER_ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const NUMBER_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(number) {
  if (number < 20) return NUMBER_ONES[number];
  return `${NUMBER_TENS[Math.floor(number / 10)]}${number % 10 ? `-${NUMBER_ONES[number % 10]}` : ''}`;
}

function threeDigitWords(number) {
  const hundred = Math.floor(number / 100);
  const rest = number % 100;
  return [hundred ? `${NUMBER_ONES[hundred]} Hundred` : '', rest ? twoDigitWords(rest) : '']
    .filter(Boolean)
    .join(' ');
}

function integerWords(number) {
  if (number === 0) return 'Zero';
  const crore = Math.floor(number / 10000000);
  const lakh = Math.floor((number % 10000000) / 100000);
  const thousand = Math.floor((number % 100000) / 1000);
  const rest = number % 1000;
  return [
    crore ? `${integerWords(crore)} Crore` : '',
    lakh ? `${twoDigitWords(lakh)} Lakh` : '',
    thousand ? `${twoDigitWords(thousand)} Thousand` : '',
    rest ? threeDigitWords(rest) : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Indian-numbering amount in words, e.g. "One Thousand Rupees and Fifty Paise Only". */
export function amountInWords(value) {
  const paiseTotal = Math.round(Math.abs(Number(value) || 0) * 100);
  const rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  const rupeeWords = `${integerWords(rupees)} ${rupees === 1 ? 'Rupee' : 'Rupees'}`;
  return `${rupeeWords}${paise ? ` and ${twoDigitWords(paise)} Paise` : ''} Only`;
}

/** Cheque/DD instruments with reconciliation-aware status. */
function compareInstrumentNumber(a, b) {
  const left = Number(String(a).trim());
  const right = Number(String(b).trim());
  if (Number.isFinite(left) && Number.isFinite(right) && String(a).trim() && String(b).trim()) {
    return left - right;
  }
  return String(a).trim().localeCompare(String(b).trim(), undefined, { numeric: true });
}

export function postDatedRegister(company, filters = {}) {
  const { from, to } = dateRange(company, filters);
  const asOn = filters.asOn || new Date().toISOString().slice(0, 10);
  const clearedVoucherIds = new Set();
  for (const config of Object.values(company.bankReconciliations ?? {})) {
    for (const voucherId of Object.values(config.matches ?? {})) clearedVoucherIds.add(voucherId);
  }

  const rows = (company.vouchers ?? [])
    .filter((voucher) => voucher.instrument)
    .filter((voucher) => voucher.instrument.date >= from && voucher.instrument.date <= to)
    .map((voucher) => {
      const instrument = voucher.instrument;
      const bank = company.ledgers.find((ledger) => ledger.id === instrument.bankLedgerId);
      const manualStatus = ['Cleared', 'Stopped', 'Cancelled'].includes(instrument.status)
        ? instrument.status
        : '';
      const status = manualStatus
        ? manualStatus
        : clearedVoucherIds.has(voucher.id)
          ? 'Cleared'
          : instrument.date > asOn
            ? 'Post-dated'
            : 'Due';
      const gapDays = Math.round(
        (new Date(`${instrument.date}T00:00:00Z`) - new Date(`${asOn}T00:00:00Z`)) / 86400000,
      );
      return {
        voucherId: voucher.id,
        type: voucher.type,
        no: voucher.no,
        voucherDate: voucher.date,
        party: partyForVoucher(company, voucher),
        bankLedgerId: instrument.bankLedgerId,
        bank: bank?.name ?? 'Unknown bank',
        kind: instrument.kind,
        number: instrument.number,
        instrumentDate: instrument.date,
        amount: round2(voucher.total),
        status,
        manualStatus,
        statusHistory: Array.isArray(instrument.statusHistory) ? instrument.statusHistory : [],
        daysFromAsOn: gapDays,
      };
    })
    .filter((row) => !filters.status || filters.status === 'All' || row.status === filters.status)
    .filter((row) => !filters.bankLedgerId || row.bankLedgerId === filters.bankLedgerId)
    .filter((row) => !filters.party || row.party.toLowerCase().includes(String(filters.party).toLowerCase()))
    .filter((row) => !filters.numberFrom || compareInstrumentNumber(row.number, filters.numberFrom) >= 0)
    .filter((row) => !filters.numberTo || compareInstrumentNumber(row.number, filters.numberTo) <= 0)
    .sort(
      (a, b) =>
        b.instrumentDate.localeCompare(a.instrumentDate) ||
        (Number(b.no) || 0) - (Number(a.no) || 0),
    );

  const sum = (status) =>
    round2(rows.filter((row) => row.status === status).reduce((total, row) => total + row.amount, 0));
  return {
    from,
    to,
    asOn,
    rows,
    count: rows.length,
    total: round2(rows.reduce((total, row) => total + row.amount, 0)),
    postDatedCount: rows.filter((row) => row.status === 'Post-dated').length,
    dueCount: rows.filter((row) => row.status === 'Due').length,
    clearedCount: rows.filter((row) => row.status === 'Cleared').length,
    cancelledCount: rows.filter((row) => row.status === 'Cancelled').length,
    stoppedCount: rows.filter((row) => row.status === 'Stopped').length,
    postDatedTotal: sum('Post-dated'),
    dueTotal: sum('Due'),
    clearedTotal: sum('Cleared'),
    cancelledTotal: sum('Cancelled'),
    stoppedTotal: sum('Stopped'),
  };
}

/** Cost-centre totals for the period, grouped by category. */
export function costCentreSummary(company, filters = {}) {
  const { from, to } = dateRange(company, filters);
  const categories = company.costCategories ?? [];
  const byCategory = new Map(
    categories.map((category) => [
      category.id,
      { categoryId: category.id, category: category.name, debit: 0, credit: 0, centreCount: 0, vouchers: new Set() },
    ]),
  );
  const byCentre = new Map(
    (company.costCentres ?? []).map((centre) => [
      centre.id,
      {
        centreId: centre.id,
        centre: centre.name,
        categoryId: centre.categoryId,
        category: categories.find((category) => category.id === centre.categoryId)?.name ?? 'Unknown category',
        debit: 0,
        credit: 0,
        vouchers: new Set(),
      },
    ]),
  );

  const unallocated = new Map();
  const unallocatedVouchers = new Set();
  for (const voucher of vouchersSorted(company)) {
    if (voucher.date < from || voucher.date > to) continue;
    for (const line of voucher.lines ?? []) {
      if (!line.costCentreId) {
        const key = line.ledgerId;
        const entry = unallocated.get(key) ?? { ledgerId: key, debit: 0, credit: 0 };
        if (line.side === 'Cr') entry.credit = round2(entry.credit + round2(line.amount));
        else entry.debit = round2(entry.debit + round2(line.amount));
        unallocated.set(key, entry);
        unallocatedVouchers.add(voucher.id);
        continue;
      }
      const centre = byCentre.get(line.costCentreId);
      if (!centre) continue;
      const category = byCategory.get(centre.categoryId);
      const amount = round2(line.amount);
      if (line.side === 'Cr') {
        centre.credit = round2(centre.credit + amount);
        if (category) category.credit = round2(category.credit + amount);
      } else {
        centre.debit = round2(centre.debit + amount);
        if (category) category.debit = round2(category.debit + amount);
      }
      centre.vouchers.add(voucher.id);
      if (category) category.vouchers.add(voucher.id);
    }
  }

  for (const category of byCategory.values()) {
    category.centreCount = [...byCentre.values()].filter((centre) => centre.categoryId === category.categoryId).length;
  }
  const centreRows = [...byCentre.values()]
    .map((centre) => ({
      centreId: centre.centreId,
      centre: centre.centre,
      categoryId: centre.categoryId,
      category: centre.category,
      debit: centre.debit,
      credit: centre.credit,
      net: round2(centre.debit - centre.credit),
      voucherCount: centre.vouchers.size,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.centre.localeCompare(b.centre));
  const categoryRows = [...byCategory.values()]
    .map((category) => ({
      categoryId: category.categoryId,
      category: category.category,
      debit: category.debit,
      credit: category.credit,
      net: round2(category.debit - category.credit),
      centreCount: category.centreCount,
      voucherCount: category.vouchers.size,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));

  const unallocatedRows = [...unallocated.values()]
    .map((row) => ({
      ledgerId: row.ledgerId,
      ledger: company.ledgers.find((ledger) => ledger.id === row.ledgerId)?.name ?? 'Unknown ledger',
      debit: row.debit,
      credit: row.credit,
      net: round2(row.debit - row.credit),
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.ledger.localeCompare(b.ledger));
  return {
    from,
    to,
    centreRows,
    categoryRows,
    unallocatedRows,
    unallocatedDebit: round2(unallocatedRows.reduce((sum, row) => sum + row.debit, 0)),
    unallocatedCredit: round2(unallocatedRows.reduce((sum, row) => sum + row.credit, 0)),
    unallocatedNet: round2(unallocatedRows.reduce((sum, row) => sum + row.net, 0)),
    unallocatedVoucherCount: unallocatedVouchers.size,
    totalDebit: round2(centreRows.reduce((sum, row) => sum + row.debit, 0)),
    totalCredit: round2(centreRows.reduce((sum, row) => sum + row.credit, 0)),
    totalNet: round2(centreRows.reduce((sum, row) => sum + row.net, 0)),
    voucherCount: new Set(
      [...byCentre.values()].flatMap((centre) => [...centre.vouchers]),
    ).size,
  };
}

/** Profit and loss from voucher lines allocated to cost centres, grouped by category. */
export function costCategoryPnl(company, filters = {}) {
  const { from, to } = dateRange(company, filters);
  const categories = company.costCategories ?? [];
  const centreCategory = new Map(
    (company.costCentres ?? []).map((centre) => [centre.id, centre.categoryId]),
  );
  const ledgerById = new Map((company.ledgers ?? []).map((ledger) => [ledger.id, ledger]));
  const byCategory = new Map(
    categories.map((category) => [
      category.id,
      {
        categoryId: category.id,
        category: category.name,
        directIncome: 0,
        directExpense: 0,
        indirectIncome: 0,
        indirectExpense: 0,
        vouchers: new Set(),
      },
    ]),
  );
  for (const voucher of vouchersSorted(company)) {
    if (voucher.date < from || voucher.date > to) continue;
    for (const line of voucher.lines ?? []) {
      const categoryId = centreCategory.get(line.costCentreId);
      if (!categoryId) continue;
      const category = byCategory.get(categoryId);
      const ledger = ledgerById.get(line.ledgerId);
      if (!category || !ledger) continue;
      const nature = groupNature(company, ledger.groupId);
      if (nature !== 'Income' && nature !== 'Expense') continue;
      const amount = round2(line.amount);
      const direct = isDirectGroup(company, ledger.groupId);
      if (nature === 'Income') {
        const net = line.side === 'Cr' ? amount : -amount;
        if (direct) category.directIncome = round2(category.directIncome + net);
        else category.indirectIncome = round2(category.indirectIncome + net);
      } else {
        const net = line.side === 'Dr' ? amount : -amount;
        if (direct) category.directExpense = round2(category.directExpense + net);
        else category.indirectExpense = round2(category.indirectExpense + net);
      }
      category.vouchers.add(voucher.id);
    }
  }

  const rows = [...byCategory.values()]
    .map((row) => {
      const directNet = round2(row.directIncome - row.directExpense);
      const indirectNet = round2(row.indirectIncome - row.indirectExpense);
      return {
        categoryId: row.categoryId,
        category: row.category,
        directIncome: row.directIncome,
        directExpense: row.directExpense,
        directNet,
        indirectIncome: row.indirectIncome,
        indirectExpense: row.indirectExpense,
        indirectNet,
        net: round2(directNet + indirectNet),
        voucherCount: row.vouchers.size,
      };
    })
    .filter((row) =>
      Math.abs(row.directIncome) + Math.abs(row.directExpense) +
        Math.abs(row.indirectIncome) + Math.abs(row.indirectExpense) > EPSILON,
    )
    .sort((a, b) => a.category.localeCompare(b.category));
  const total = (key) => round2(rows.reduce((sum, row) => sum + row[key], 0));
  return {
    from,
    to,
    rows,
    totalDirectIncome: total('directIncome'),
    totalDirectExpense: total('directExpense'),
    totalDirectNet: total('directNet'),
    totalIndirectIncome: total('indirectIncome'),
    totalIndirectExpense: total('indirectExpense'),
    totalIndirectNet: total('indirectNet'),
    totalNet: total('net'),
    voucherCount: new Set(
      [...byCategory.values()].flatMap((row) => [...row.vouchers]),
    ).size,
  };
}

/** Voucher lines allocated to one cost centre. */
export function costCentreBreakup(company, centreId, filters = {}) {
  const centre = (company.costCentres ?? []).find((item) => item.id === centreId);
  if (!centre) return null;
  const category = (company.costCategories ?? []).find((item) => item.id === centre.categoryId);
  const { from, to } = dateRange(company, filters);
  const ledgerById = new Map((company.ledgers ?? []).map((ledger) => [ledger.id, ledger]));
  const byLedger = new Map();
  const rows = [];
  for (const voucher of vouchersSorted(company)) {
    if (voucher.date < from || voucher.date > to) continue;
    for (const line of voucher.lines ?? []) {
      if (line.costCentreId !== centreId) continue;
      const ledger = ledgerById.get(line.ledgerId);
      const ledgerName = ledger?.name ?? 'Unknown';
      const amount = round2(line.amount);
      rows.push({
        voucherId: voucher.id,
        date: voucher.date,
        type: voucher.type,
        no: voucher.no,
        narration: voucher.narration ?? '',
        ledgerId: line.ledgerId,
        ledger: ledgerName,
        side: line.side,
        amount,
      });
      const summary = byLedger.get(line.ledgerId) ?? {
        ledgerId: line.ledgerId,
        ledger: ledgerName,
        debit: 0,
        credit: 0,
      };
      if (line.side === 'Cr') summary.credit = round2(summary.credit + amount);
      else summary.debit = round2(summary.debit + amount);
      byLedger.set(line.ledgerId, summary);
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || (Number(a.no) || 0) - (Number(b.no) || 0));
  const debit = round2(rows.filter((row) => row.side === 'Dr').reduce((sum, row) => sum + row.amount, 0));
  const credit = round2(rows.filter((row) => row.side === 'Cr').reduce((sum, row) => sum + row.amount, 0));
  const ledgerRows = [...byLedger.values()]
    .map((row) => ({ ...row, net: round2(row.debit - row.credit) }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.ledger.localeCompare(b.ledger));
  return {
    centre,
    category: category?.name ?? 'Unknown category',
    from,
    to,
    rows,
    ledgerRows,
    ledgerCount: ledgerRows.length,
    count: rows.length,
    debit,
    credit,
    net: round2(debit - credit),
  };
}

/** Unrealised forex revaluation of foreign-currency balance-sheet ledgers. */
export function forexRevaluation(company, filters = {}) {
  const asOn = filters.asOn || new Date().toISOString().slice(0, 10);
  const buckets = new Map();
  for (const voucher of company.vouchers ?? []) {
    if (!voucher.currencyCode || voucher.currencyCode === 'INR' || voucher.date > asOn) continue;
    for (const line of voucher.lines ?? []) {
      const ledger = company.ledgers.find((item) => item.id === line.ledgerId);
      if (!ledger) continue;
      const nature = groupNature(company, ledger.groupId);
      if (nature !== 'Assets' && nature !== 'Liabilities') continue;
      const key = `${line.ledgerId}|${voucher.currencyCode}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          ledgerId: ledger.id,
          ledger: ledger.name,
          groupId: ledger.groupId,
          group: groupById(company, ledger.groupId)?.name ?? '',
          nature,
          currencyCode: voucher.currencyCode,
          foreignBalance: 0,
          bookBalance: 0,
        });
      }
      const bucket = buckets.get(key);
      const foreignAmount = Number(line.currencyAmount) || 0;
      const baseAmount = Number(line.amount) || 0;
      if (line.side === 'Cr') {
        bucket.foreignBalance = round2(bucket.foreignBalance - foreignAmount);
        bucket.bookBalance = round2(bucket.bookBalance - baseAmount);
      } else {
        bucket.foreignBalance = round2(bucket.foreignBalance + foreignAmount);
        bucket.bookBalance = round2(bucket.bookBalance + baseAmount);
      }
    }
  }

  for (const voucher of company.vouchers ?? []) {
    if (!voucher.fxRevaluationDate || voucher.fxRevaluationDate > asOn) continue;
    for (const row of voucher.fxRevaluationRows ?? []) {
      const bucket = buckets.get(`${row.ledgerId}|${row.currencyCode}`);
      if (bucket) bucket.bookBalance = round2(bucket.bookBalance + row.difference);
    }
  }

  const rows = [...buckets.values()]
    .filter((bucket) => Math.abs(bucket.foreignBalance) >= 0.005)
    .map((bucket) => {
      const rate = rateForCurrency(company, bucket.currencyCode, asOn);
      if (rate === null) return null;
      const revalued = round2(bucket.foreignBalance * rate);
      const difference = round2(revalued - bucket.bookBalance);
      return {
        ...bucket,
        rate,
        revalued,
        difference,
        gain: difference > 0 ? difference : 0,
        loss: difference < 0 ? -difference : 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode) || a.ledger.localeCompare(b.ledger));

  const gain = round2(rows.reduce((sum, row) => sum + row.gain, 0));
  const loss = round2(rows.reduce((sum, row) => sum + row.loss, 0));
  return {
    asOn,
    rows,
    count: rows.length,
    gain,
    loss,
    net: round2(gain - loss),
    currencies: [...new Set(rows.map((row) => row.currencyCode))],
  };
}

/** Annual budget vs actual by ledger or group. */
export function budgetVsActual(company, filters = {}) {
  const includeOpening = Boolean(filters.includeOpening);
  const year =
    (company.years ?? []).find((item) => item.id === filters.yearId) ??
    (company.years ?? []).find((item) => item.id === company.yearId) ??
    (company.years ?? [])[0] ??
    { id: company.yearId, start: company.fyStart, end: company.fyEnd };
  const today = new Date().toISOString().slice(0, 10);
  const requested = filters.asOn && filters.asOn >= year.start && filters.asOn <= year.end ? filters.asOn : today;
  const asOn = requested < year.start ? year.start : requested > year.end ? year.end : requested;
  const openingTotals = includeOpening
    ? ledgerTotals(company, { to: addIsoDays(year.start, -1) })
    : null;
  const rows = (company.budgets ?? [])
    .filter((budget) => budget.yearId === year.id)
    .map((budget) => {
      const target =
        budget.targetType === 'group'
          ? company.groups.find((group) => group.id === budget.targetId)
          : budget.targetType === 'costCentre'
            ? (company.costCentres ?? []).find((centre) => centre.id === budget.targetId)
            : budget.targetType === 'costCategory'
              ? (company.costCategories ?? []).find((category) => category.id === budget.targetId)
              : company.ledgers.find((ledger) => ledger.id === budget.targetId);
      if (!target) return null;
      const costCentre = budget.targetType === 'costCentre';
      const costCategory = budget.targetType === 'costCategory';
      const categoryByCentre = costCategory
        ? new Map((company.costCentres ?? []).map((centre) => [centre.id, centre.categoryId]))
        : null;
      const ledgerIds = costCentre || costCategory
        ? null
        : budget.targetType === 'group'
          ? new Set(ledgersUnderGroup(company, target.id).map((ledger) => ledger.id))
          : new Set([target.id]);
      let debit = 0;
      let credit = 0;
      for (const voucher of company.vouchers ?? []) {
        if (voucher.date < year.start || voucher.date > asOn) continue;
        for (const line of voucher.lines ?? []) {
          const matches = costCentre
            ? line.costCentreId === target.id
            : costCategory
              ? categoryByCentre.get(line.costCentreId) === target.id
              : ledgerIds.has(line.ledgerId);
          if (!matches) continue;
          if (line.side === 'Cr') credit = round2(credit + line.amount);
          else debit = round2(debit + line.amount);
        }
      }
      const nature = costCentre
        ? 'Cost centre'
        : costCategory
          ? 'Cost category'
          : budget.targetType === 'group'
            ? groupNature(company, target.id)
            : groupNature(company, target.groupId);
      let opening = 0;
      if (openingTotals && !costCentre && !costCategory) {
        for (const ledgerId of ledgerIds) {
          const entry = openingTotals.get(ledgerId);
          if (!entry) continue;
          opening = round2(
            opening +
              (nature === 'Income' || nature === 'Liabilities'
                ? -entry.closing
                : entry.closing),
          );
        }
      }
      const actual = round2(
        opening +
          (costCentre || costCategory
            ? debit - credit
            : nature === 'Income' || nature === 'Liabilities'
              ? credit - debit
              : debit - credit),
      );
      return {
        budgetId: budget.id,
        name: budget.name,
        targetType: budget.targetType,
        targetId: budget.targetId,
        target: target.name,
        nature,
        amount: round2(budget.amount),
        actual,
        variance: round2(budget.amount - actual),
        usedPercent: budget.amount > 0 ? round2((actual / budget.amount) * 100) : null,
        over: actual > round2(budget.amount + 0.005),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  const groupBudgetTargets = new Set(
    rows.filter((row) => row.targetType === 'group').map((row) => row.targetId),
  );
  const categoryBudgetTargets = new Set(
    rows.filter((row) => row.targetType === 'costCategory').map((row) => row.targetId),
  );
  const groupOrAncestorBudgeted = (groupId) => {
    let group = groupById(company, groupId);
    let guard = 0;
    while (group && guard < 32) {
      if (groupBudgetTargets.has(group.id)) return true;
      group = group.parentId ? groupById(company, group.parentId) : null;
      guard += 1;
    }
    return false;
  };
  for (const row of rows) {
    if (row.targetType === 'group') {
      const target = groupById(company, row.targetId);
      row.nested = Boolean(target?.parentId && groupOrAncestorBudgeted(target.parentId));
    } else if (row.targetType === 'costCategory') {
      row.nested = false;
    } else if (row.targetType === 'costCentre') {
      const centre = (company.costCentres ?? []).find((entry) => entry.id === row.targetId);
      row.nested = Boolean(centre && categoryBudgetTargets.has(centre.categoryId));
    } else {
      const ledger = (company.ledgers ?? []).find((entry) => entry.id === row.targetId);
      row.nested = Boolean(ledger && groupOrAncestorBudgeted(ledger.groupId));
    }
  }
  const topRows = rows.filter((row) => !row.nested);

  return {
    year,
    asOn,
    includeOpening,
    rows,
    count: rows.length,
    overlapCount: rows.length - topRows.length,
    totalBudget: round2(topRows.reduce((sum, row) => sum + row.amount, 0)),
    totalActual: round2(topRows.reduce((sum, row) => sum + row.actual, 0)),
    totalVariance: round2(topRows.reduce((sum, row) => sum + row.variance, 0)),
    overCount: rows.filter((row) => row.over).length,
  };
}

/** Closing balances for every primary group, with the ledgers underneath. */
export function groupSummary(company, filters = {}) {
  const to = filters.to || company.fyEnd;
  const totals = ledgerTotals(company, { to });
  const roots = company.groups.filter((group) => !group.parentId);

  const sections = roots
    .map((root) => {
      const rows = ledgersUnderGroup(company, root.id)
        .map((ledger) => totals.get(ledger.id))
        .filter(Boolean)
        .map((entry) => ({
          ledgerId: entry.ledgerId,
          name: entry.name,
          groupName: groupById(company, entry.groupId)?.name ?? '',
          debit: entry.debit,
          credit: entry.credit,
          closing: entry.closing,
        }));
      return {
        key: root.key,
        groupId: root.id,
        name: root.name,
        nature: root.nature,
        rows,
        debit: round2(rows.reduce((sum, row) => sum + row.debit, 0)),
        credit: round2(rows.reduce((sum, row) => sum + row.credit, 0)),
        closing: round2(rows.reduce((sum, row) => sum + row.closing, 0)),
      };
    })
    .filter((section) => section.rows.length > 0);

  return {
    asOn: to,
    sections,
    total: round2(sections.reduce((sum, section) => sum + section.closing, 0)),
  };
}

/** Vouchers that touch any ledger inside a group and its sub-groups. */
export function groupVouchers(company, groupId, filters = {}) {
  const group = groupById(company, groupId);
  if (!group) return null;
  const { from, to } = dateRange(company, filters);
  const ledgerIds = new Set(ledgersUnderGroup(company, groupId).map((ledger) => ledger.id));

  const rows = [];
  for (const voucher of vouchersSorted(company)) {
    if (voucher.date < from || voucher.date > to) continue;
    const lines = (voucher.lines ?? []).filter((line) => ledgerIds.has(line.ledgerId));
    if (lines.length === 0) continue;
    rows.push({
      voucherId: voucher.id,
      date: voucher.date,
      type: voucher.type,
      no: voucher.no,
      particulars: voucherSummary(company, voucher),
      debit: round2(lines.filter((line) => line.side === 'Dr').reduce((sum, line) => sum + line.amount, 0)),
      credit: round2(lines.filter((line) => line.side === 'Cr').reduce((sum, line) => sum + line.amount, 0)),
    });
  }

  return {
    group,
    from,
    to,
    rows,
    debitTotal: round2(rows.reduce((sum, row) => sum + row.debit, 0)),
    creditTotal: round2(rows.reduce((sum, row) => sum + row.credit, 0)),
  };
}

export const AGE_BUCKETS = [
  { key: '0-30', label: '0–30 days', max: 30 },
  { key: '31-60', label: '31–60 days', max: 60 },
  { key: '61-90', label: '61–90 days', max: 90 },
  { key: '90+', label: 'Over 90 days', max: Number.POSITIVE_INFINITY },
];

export function ageBucketFor(days) {
  return AGE_BUCKETS.find((bucket) => days <= bucket.max)?.key ?? '90+';
}

function daysBetween(fromIso, toIso) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.max(0, Math.round((to - from) / 86400000));
}

/**
 * Bill and settlement state for one party ledger. Bills are the party-side lines
 * on sales/purchase invoices; other same-side entries are kept as adjustments so
 * existing outstanding totals do not change. Stored allocations settle a named
 * bill first, then anything left settles the oldest open bill (FIFO).
 */
function billMovementStatus(dueDate, at, remaining, settled) {
  const overdue = Boolean(dueDate && dueDate < at && remaining > EPSILON);
  return remaining <= EPSILON
    ? 'Settled'
    : overdue
      ? 'Overdue'
      : settled > EPSILON
        ? 'Part-paid'
        : 'Open';
}

function partyBillLedger(company, ledger, side, asOn) {
  const billSide = side === 'receivable' ? 'Dr' : 'Cr';
  const invoiceType = side === 'receivable' ? 'Sales' : 'Purchase';
  const openingSigned = signedOpening(ledger);
  const openingInDirection = billSide === 'Dr' ? openingSigned : -openingSigned;
  const entries = [];
  let hasEntries = false;

  if (Math.abs(openingInDirection) >= EPSILON) {
    entries.push({
      voucherId: null,
      type: 'Opening',
      no: 0,
      date: booksStart(company),
      dueDate: null,
      ref: 'Opening balance',
      original: round2(openingInDirection),
      amount: round2(openingInDirection),
      remaining: round2(openingInDirection),
      settled: 0,
      isBill: false,
      opening: true,
      events: [],
    });
    hasEntries = true;
  }

  const settlements = [];
  for (const voucher of [...vouchersSorted(company)].reverse()) {
    if (voucher.date > asOn) continue;
    for (const [lineIndex, line] of (voucher.lines ?? []).entries()) {
      if (line.ledgerId !== ledger.id) continue;
      if (line.side === billSide) {
        entries.push({
          voucherId: voucher.id,
          type: voucher.type,
          no: voucher.no,
          date: voucher.date,
          dueDate: voucher.bill?.dueDate || null,
          ref: billLabel(voucher),
          original: round2(line.amount),
          amount: round2(line.amount),
          remaining: round2(line.amount),
          settled: 0,
          isBill: voucher.type === invoiceType,
          opening: false,
          events: [
            {
              date: voucher.date,
              kind: 'raised',
              voucherId: voucher.id,
              type: voucher.type,
              no: voucher.no,
              ref: billLabel(voucher),
              amount: round2(line.amount),
              settledAfter: 0,
              remainingAfter: round2(line.amount),
              statusAfter: billMovementStatus(voucher.bill?.dueDate || null, voucher.date, round2(line.amount), 0),
            },
          ],
        });
      } else {
        settlements.push({
          date: voucher.date,
          no: Number(voucher.no) || 0,
          lineIndex,
          voucherId: voucher.id,
          type: voucher.type,
          ref: billLabel(voucher),
          amount: round2(line.amount),
          allocations: Array.isArray(line.allocations) ? line.allocations : [],
        });
      }
      hasEntries = true;
    }
  }

  settlements.sort((a, b) => a.date.localeCompare(b.date) || a.no - b.no || a.lineIndex - b.lineIndex);
  for (const settlement of settlements) {
    let left = settlement.amount;
    for (const allocation of settlement.allocations) {
      const bill = entries.find(
        (entry) => !entry.opening && entry.voucherId && entry.voucherId === allocation.voucherId,
      );
      if (!bill || bill.remaining <= EPSILON || left <= EPSILON) continue;
      const applied = Math.min(bill.remaining, allocation.amount, left);
      bill.remaining = round2(bill.remaining - applied);
      bill.settled = round2(bill.settled + applied);
      bill.events.push({
        date: settlement.date,
        kind: 'settlement',
        voucherId: settlement.voucherId,
        type: settlement.type,
        no: settlement.no,
        ref: settlement.ref,
        amount: round2(applied),
        settledAfter: bill.settled,
        remainingAfter: bill.remaining,
        statusAfter: billMovementStatus(bill.dueDate, settlement.date, bill.remaining, bill.settled),
      });
      left = round2(left - applied);
    }
    for (const bill of entries) {
      if (left <= EPSILON) break;
      if (bill.remaining <= EPSILON) continue;
      const applied = Math.min(bill.remaining, left);
      bill.remaining = round2(bill.remaining - applied);
      bill.settled = round2(bill.settled + applied);
      bill.events.push({
        date: settlement.date,
        kind: 'settlement',
        voucherId: settlement.voucherId,
        type: settlement.type,
        no: settlement.no,
        ref: settlement.ref,
        amount: round2(applied),
        settledAfter: bill.settled,
        remainingAfter: bill.remaining,
        statusAfter: billMovementStatus(bill.dueDate, settlement.date, bill.remaining, bill.settled),
      });
      left = round2(left - applied);
    }
    if (left > EPSILON) {
      entries.push({
        voucherId: null,
        type: 'On account',
        no: 0,
        date: settlement.date,
        dueDate: null,
        ref: 'On account',
        original: 0,
        amount: 0,
        remaining: -left,
        settled: 0,
        isBill: false,
        onAccount: true,
      });
    }
  }

  const allBills = entries
    .filter((entry) => !entry.onAccount)
    .map((bill) => {
      const dueDate = bill.dueDate || null;
      const bucketDate = dueDate || bill.date;
      const ageDays = daysBetween(bucketDate, asOn);
      const overdueDays = dueDate ? daysBetween(dueDate, asOn) : 0;
      const overdue = Boolean(dueDate && dueDate < asOn && bill.remaining > EPSILON);
      const status = billMovementStatus(dueDate, asOn, bill.remaining, bill.settled);
      const events = [...bill.events];
      if (dueDate && dueDate < asOn && !events.some((event) => event.date === dueDate && event.kind === 'settlement')) {
        const settledByDue = events
          .filter((event) => event.kind === 'settlement' && event.date <= dueDate)
          .reduce((_, event) => event.settledAfter, 0);
        if (round2(bill.original - settledByDue) > EPSILON) {
          events.push({
            date: dueDate,
            kind: 'due',
            amount: 0,
            settledAfter: settledByDue,
            remainingAfter: round2(bill.original - settledByDue),
            statusAfter: 'Overdue',
          });
        }
      }
      events.sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.kind === 'raised' ? 0 : 1) - (b.kind === 'raised' ? 0 : 1),
      );
      return {
        voucherId: bill.voucherId,
        type: bill.type,
        no: bill.no,
        ref: bill.ref,
        date: bill.date,
        dueDate,
        original: bill.original,
        settled: bill.settled,
        amount: bill.remaining,
        ageDays,
        overdueDays,
        overdue,
        bucket: ageBucketFor(ageDays),
        status,
        isBill: bill.isBill,
        events,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));

  const openBills = allBills.filter((bill) => bill.amount > EPSILON);
  const advances = round2(
    entries.filter((entry) => entry.remaining < -EPSILON).reduce((sum, entry) => sum - entry.remaining, 0),
  );

  return { allBills, openBills, advances, hasEntries };
}

/**
 * Receivables / payables ageing. Invoices with a bill reference keep their own
 * identity and due date; settlements use stored bill allocations first and the
 * oldest open bill (FIFO) for anything left unallocated.
 */
export function outstanding(company, filters = {}) {
  const asOn = filters.asOn || company.fyEnd;
  const side = filters.side === 'payable' ? 'payable' : 'receivable';
  const groupKey = side === 'receivable' ? 'sundryDebtors' : 'sundryCreditors';
  const buckets = Object.fromEntries(AGE_BUCKETS.map((bucket) => [bucket.key, 0]));
  const parties = [];
  let advances = 0;

  for (const ledger of company.ledgers) {
    if (!inGroupKey(company, ledger, groupKey)) continue;
    const data = partyBillLedger(company, ledger, side, asOn);
    if (!data.hasEntries) continue;
    const openBills = data.openBills;
    for (const bill of openBills) {
      buckets[bill.bucket] = round2(buckets[bill.bucket] + bill.amount);
    }

    const advance = data.advances;
    const openTotal = round2(openBills.reduce((sum, bill) => sum + bill.amount, 0));
    if (openTotal < EPSILON && advance < EPSILON) continue;

    advances = round2(advances + advance);
    const creditLimit = round2(ledger.creditLimit ?? 0);
    parties.push({
      ledgerId: ledger.id,
      name: ledger.name,
      outstanding: openTotal,
      advance,
      creditLimit,
      available: creditLimit ? round2(creditLimit - openTotal) : 0,
      overLimit: creditLimit > 0 && openTotal > creditLimit + 0.005,
      bills: openBills,
    });
  }

  parties.sort((a, b) => a.name.localeCompare(b.name));
  const total = round2(parties.reduce((sum, party) => sum + party.outstanding, 0));

  return {
    side,
    asOn,
    parties,
    buckets,
    total,
    advances,
    net: round2(total - advances),
    count: parties.length,
  };
}

/** Simple overdue interest working paper; it never posts a journal. */
export function interestWorkingPaper(company, filters = {}) {
  const asOn = filters.asOn || company.fyEnd;
  const side = filters.side === 'payable' ? 'payable' : 'receivable';
  const report = outstanding(company, { side, asOn });
  const ledgers = new Map((company.ledgers ?? []).map((ledger) => [ledger.id, ledger]));
  const posted = new Map();
  for (const posting of company.interestPostings ?? []) {
    if (posting.side !== side || posting.date > asOn) continue;
    const key = `${posting.partyId}|${posting.bill}`;
    posted.set(key, round2((posted.get(key) ?? 0) + (Number(posting.amount) || 0)));
  }
  const rows = [];
  for (const party of report.parties) {
    const rate = round2(ledgers.get(party.ledgerId)?.interestRate ?? 0);
    if (rate <= 0) continue;
    for (const bill of party.bills) {
      if (!bill.overdue || !bill.dueDate) continue;
      const days = Math.max(0, Number(bill.overdueDays) || 0);
      const accrued = round2((bill.amount * rate * days) / 36500);
      const alreadyPosted = posted.get(`${party.ledgerId}|${bill.ref}`) ?? 0;
      const interest = round2(Math.max(0, accrued - alreadyPosted));
      if (interest <= 0) continue;
      rows.push({
        partyId: party.ledgerId,
        party: party.name,
        bill: bill.ref,
        dueDate: bill.dueDate,
        overdueDays: days,
        amount: bill.amount,
        rate,
        accrued,
        alreadyPosted,
        interest,
      });
    }
  }
  rows.sort((a, b) => a.party.localeCompare(b.party) || a.dueDate.localeCompare(b.dueDate));
  return {
    asOn,
    side,
    rows,
    totals: {
      principal: round2(rows.reduce((sum, row) => sum + row.amount, 0)),
      interest: round2(rows.reduce((sum, row) => sum + row.interest, 0)),
    },
  };
}

/** Sales/purchase bills in a period, including fully settled bills. */
export function billWiseRegister(company, filters = {}) {
  const side = filters.side === 'payable' ? 'payable' : 'receivable';
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const status = ['Open', 'Settled', 'Overdue'].includes(filters.status) ? filters.status : 'All';
  const asOn = isValidIsoDate(String(filters.asOn ?? '')) ? String(filters.asOn) : to;
  const requestedCompare = String(filters.compareAsOn ?? '');
  const compareAsOn = isValidIsoDate(requestedCompare) && requestedCompare <= asOn
    ? requestedCompare
    : null;
  const groupKey = side === 'receivable' ? 'sundryDebtors' : 'sundryCreditors';
  const rows = [];

  for (const ledger of company.ledgers) {
    if (!inGroupKey(company, ledger, groupKey)) continue;
    const data = partyBillLedger(company, ledger, side, asOn);
    const priorBills = compareAsOn
      ? new Map(
          partyBillLedger(company, ledger, side, compareAsOn).allBills
            .filter((bill) => bill.isBill)
            .map((bill) => [bill.voucherId, bill]),
        )
      : null;
    for (const bill of data.allBills) {
      if (!bill.isBill || bill.date < from || bill.date > to) continue;
      if (status === 'Open' && bill.status === 'Settled') continue;
      if (status === 'Settled' && bill.status !== 'Settled') continue;
      if (status === 'Overdue' && !bill.overdue) continue;
      const prior = priorBills?.get(bill.voucherId) ?? null;
      const priorSettled = compareAsOn && prior ? prior.settled : 0;
      const priorStatus = compareAsOn
        ? bill.date > compareAsOn
          ? 'Not raised'
          : prior?.status ?? 'Not raised'
        : null;
      rows.push({
        partyId: ledger.id,
        party: ledger.name,
        ...bill,
        ...(compareAsOn
          ? {
              priorSettled: round2(priorSettled),
              settledDuring: round2(bill.settled - priorSettled),
              priorStatus,
              openedDuring: bill.date > compareAsOn,
              statusChanged: priorStatus !== bill.status,
            }
          : {}),
      });
    }
  }

  rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.party.localeCompare(b.party) ||
      a.ref.localeCompare(b.ref),
  );
  const sum = (key) => round2(rows.reduce((total, row) => total + row[key], 0));

  return {
    side,
    from,
    to,
    asOn,
    compareAsOn,
    rows,
    count: rows.length,
    partyCount: new Set(rows.map((row) => row.partyId)).size,
    openCount: rows.filter((row) => row.status !== 'Settled').length,
    settledCount: rows.filter((row) => row.status === 'Settled').length,
    overdueCount: rows.filter((row) => row.overdue).length,
    openedCount: compareAsOn ? rows.filter((row) => row.openedDuring).length : 0,
    closedCount: compareAsOn
      ? rows.filter((row) => row.priorStatus !== 'Settled' && row.status === 'Settled').length
      : 0,
    statusChangeCount: compareAsOn ? rows.filter((row) => row.statusChanged).length : 0,
    totalOriginal: sum('original'),
    totalSettled: sum('settled'),
    totalOutstanding: sum('amount'),
    totalSettledDuring: round2(
      rows.reduce((total, row) => total + (row.settledDuring ?? 0), 0),
    ),
  };
}

/** Ledger statement for one party, with bill references and bill-wise detail. */
export function partyStatement(company, ledgerId, filters = {}) {
  const ledger = company.ledgers.find((item) => item.id === ledgerId);
  if (!ledger) return null;
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const statement = ledgerStatement(company, ledgerId, { from, to });
  const side = inGroupKey(company, ledger, 'sundryDebtors')
    ? 'receivable'
    : inGroupKey(company, ledger, 'sundryCreditors')
      ? 'payable'
      : null;
  const billSide = side === 'receivable' ? 'Dr' : 'Cr';
  const vouchersById = new Map(company.vouchers.map((voucher) => [voucher.id, voucher]));
  const rows = statement.rows.map((row) => {
    const voucher = vouchersById.get(row.voucherId);
    const line = (voucher?.lines ?? []).find((entry) => entry.ledgerId === ledgerId) ?? null;
    const isBillLine = Boolean(side && line && line.side === billSide);
    const allocations = (line?.allocations ?? []).map((allocation) => {
      const target = vouchersById.get(allocation.voucherId);
      return {
        voucherId: allocation.voucherId,
        ref: target ? billLabel(target) : 'Unknown bill',
        amount: round2(allocation.amount),
      };
    });
    return {
      ...row,
      billRef: isBillLine && (voucher?.type === 'Sales' || voucher?.type === 'Purchase') ? billLabel(voucher) : '',
      billDueDate: isBillLine ? voucher?.bill?.dueDate || null : null,
      allocations,
      isBillLine,
    };
  });

  const data = side
    ? partyBillLedger(company, ledger, side, to)
    : { allBills: [], advances: 0 };
  const bills = data.allBills.filter((bill) => bill.isBill);
  const sum = (key) => round2(bills.reduce((total, bill) => total + bill[key], 0));

  return {
    ...statement,
    rows,
    side,
    bills,
    advances: data.advances,
    billCount: bills.length,
    billOriginal: sum('original'),
    billSettled: sum('settled'),
    billOutstanding: sum('amount'),
  };
}

function addSection(map, key, title, name, amount) {
  if (!map.has(key)) map.set(key, { key, title, total: 0, rows: new Map() });
  const section = map.get(key);
  section.total = round2(section.total + amount);
  section.rows.set(name, round2((section.rows.get(name) ?? 0) + amount));
}

function finishSections(map) {
  return [...map.values()]
    .map((section) => ({
      key: section.key,
      title: section.title,
      total: section.total,
      rows: [...section.rows.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.total - a.total);
}

/** Cash flow: where cash came from and where it went, grouped by primary group. */
function addIsoDays(iso, days) {
  return new Date(Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)) + days,
  )).toISOString().slice(0, 10);
}

/** Projected cash from open bills, without posting anything. */
export function cashForecast(company, filters = {}) {
  const asOn = filters.asOn || company.fyEnd;
  const horizon = Math.max(1, Math.min(365, Number(filters.days) || 30));
  const totals = ledgerTotals(company, { to: asOn });
  const opening = round2(
    cashBankLedgers(company).reduce((sum, ledger) => sum + (totals.get(ledger.id)?.closing ?? 0), 0),
  );
  const receivable = outstanding(company, { side: 'receivable', asOn });
  const payable = outstanding(company, { side: 'payable', asOn });
  const expected = (bill) => (bill.dueDate && bill.dueDate > asOn ? bill.dueDate : asOn);
  const end = addIsoDays(asOn, horizon);
  const buckets = [
    { label: 'Due now', from: asOn, to: asOn },
    { label: '1–7 days', from: addIsoDays(asOn, 1), to: addIsoDays(asOn, 7) },
    { label: '8–14 days', from: addIsoDays(asOn, 8), to: addIsoDays(asOn, 14) },
    { label: '15–30 days', from: addIsoDays(asOn, 15), to: addIsoDays(asOn, 30) },
  ];
  if (horizon > 30) {
    buckets.push({ label: `31–${horizon} days`, from: addIsoDays(asOn, 31), to: end });
  }

  const collect = (sideReport) =>
    sideReport.parties.flatMap((party) =>
      party.bills.map((bill) => ({ party: party.name, amount: bill.amount, date: expected(bill), ref: bill.ref })),
    );
  const receipts = collect(receivable).filter((row) => row.date <= end);
  const payments = collect(payable).filter((row) => row.date <= end);
  const sum = (rows, from, to) =>
    round2(rows.filter((row) => row.date >= from && row.date <= to).reduce((total, row) => total + row.amount, 0));

  let running = opening;
  const rows = buckets.map((bucket) => {
    const receipt = sum(receipts, bucket.from, bucket.to);
    const payment = sum(payments, bucket.from, bucket.to);
    const net = round2(receipt - payment);
    running = round2(running + net);
    return { ...bucket, receipts: receipt, payments: payment, net, closing: running };
  });
  return {
    asOn,
    days: horizon,
    opening,
    rows,
    totals: {
      receipts: round2(rows.reduce((sum, row) => sum + row.receipts, 0)),
      payments: round2(rows.reduce((sum, row) => sum + row.payments, 0)),
      closing: running,
    },
  };
}

export function cashFlow(company, filters = {}) {
  const { from, to } = dateRange(company, filters);
  const ledgers = cashBankLedgers(company);
  const cashIds = new Set(ledgers.map((ledger) => ledger.id));
  const opening = round2(
    ledgers.reduce((sum, ledger) => sum + (ledgerStatement(company, ledger.id, { from, to })?.opening ?? 0), 0),
  );

  const inflowMap = new Map();
  const outflowMap = new Map();

  for (const voucher of company.vouchers) {
    if (voucher.date < from || voucher.date > to) continue;
    const lines = voucher.lines ?? [];
    const cashNet = round2(
      lines
        .filter((line) => cashIds.has(line.ledgerId))
        .reduce((sum, line) => sum + (line.side === 'Dr' ? line.amount : -line.amount), 0),
    );
    if (Math.abs(cashNet) < EPSILON) continue;

    const counterSide = cashNet > 0 ? 'Cr' : 'Dr';
    const counters = lines.filter((line) => !cashIds.has(line.ledgerId) && line.side === counterSide);
    const counterTotal = round2(counters.reduce((sum, line) => sum + line.amount, 0));
    if (counters.length === 0 || counterTotal < EPSILON) continue;

    const target = cashNet > 0 ? inflowMap : outflowMap;
    let left = Math.abs(cashNet);
    counters.forEach((line, index) => {
      const share = index === counters.length - 1
        ? left
        : round2((Math.abs(cashNet) * line.amount) / counterTotal);
      left = round2(left - share);
      if (share <= EPSILON) return;
      const ledger = company.ledgers.find((item) => item.id === line.ledgerId);
      if (!ledger) return;
      const group = groupById(company, ledger.groupId);
      addSection(
        target,
        group?.key ?? group?.id ?? 'other',
        group?.name ?? 'Other',
        ledger.name,
        share,
      );
    });
  }

  const inflows = finishSections(inflowMap);
  const outflows = finishSections(outflowMap);
  const totalIn = round2(inflows.reduce((sum, section) => sum + section.total, 0));
  const totalOut = round2(outflows.reduce((sum, section) => sum + section.total, 0));

  return {
    from,
    to,
    opening,
    closing: round2(opening + totalIn - totalOut),
    inflows,
    outflows,
    totalIn,
    totalOut,
    net: round2(totalIn - totalOut),
  };
}

/** Ratio analysis, following TallyPrime's principal ratios where the data allows. */
export function ratioAnalysis(company, filters = {}) {
  const to = filters.to || company.fyEnd;
  const totals = ledgerTotals(company, { to });
  const pnl = profitAndLoss(company, { from: company.fyStart, to });

  const sumPrimary = (keys) =>
    round2(
      [...totals.values()]
        .filter((entry) => keys.includes(primaryKeyOf(company, entry.groupId)))
        .reduce((sum, entry) => sum + entry.closing, 0),
    );

  const currentAssets = sumPrimary(['currentAssets']);
  const currentLiabilities = round2(-sumPrimary(['currentLiabilities']));
  const stock = round2(
    ledgersUnderGroup(company, company.groups.find((group) => group.key === 'stockInHand')?.id ?? '')
      .reduce((sum, ledger) => sum + (totals.get(ledger.id)?.closing ?? 0), 0),
  );
  const loans = round2(-sumPrimary(['loansLiability']));
  const equity = round2(-sumPrimary(['capital', 'reserves']));
  const assets = sumPrimary(['currentAssets', 'fixedAssets', 'investments']);

  const ratio = (numerator, denominator, unit, label, hint) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label,
    unit,
    hint,
    value: Math.abs(denominator) < EPSILON ? null : round2(numerator / denominator),
  });

  const percent = (numerator, denominator, label, hint) => ({
    ...ratio(numerator, denominator, '%', label, hint),
    value:
      Math.abs(denominator) < EPSILON ? null : round2((numerator / denominator) * 100),
  });

  return {
    asOn: to,
    sales: pnl.direct.incomeTotal,
    grossProfit: pnl.grossProfit,
    netProfit: pnl.netProfit,
    workingCapital: round2(currentAssets - currentLiabilities),
    ratios: [
      ratio(currentAssets, currentLiabilities, 'x', 'Current ratio', 'Current assets ÷ current liabilities'),
      ratio(currentAssets - stock, currentLiabilities, 'x', 'Quick ratio', '(Current assets − stock) ÷ current liabilities'),
      ratio(loans, equity, 'x', 'Debt / equity', 'Loans (liability) ÷ capital and reserves'),
      percent(pnl.grossProfit, pnl.direct.incomeTotal, 'Gross profit %', 'Gross profit ÷ direct income'),
      percent(pnl.netProfit, pnl.direct.incomeTotal, 'Net profit %', 'Net profit ÷ direct income'),
      percent(pnl.netProfit, assets, 'Return on assets %', 'Net profit ÷ total assets'),
    ],
  };
}

// --- Inventory ---------------------------------------------------------------

import { OPENING_BATCH } from './store.js';

const STOCK_IN_TYPES = new Set(['Purchase', 'CreditNote']);
const STOCK_OUT_TYPES = new Set(['Sales', 'DebitNote']);

function stockMovementEvents(company, to) {
  const events = [];
  for (const voucher of company.vouchers ?? []) {
    if (voucher.date > to || !Array.isArray(voucher.items) || !voucher.items.length) continue;
    if (!STOCK_IN_TYPES.has(voucher.type) && !STOCK_OUT_TYPES.has(voucher.type)) continue;
    events.push({ kind: 'voucher', date: voucher.date, no: Number(voucher.no) || 0, voucher });
  }
  for (const transfer of company.stockTransfers ?? []) {
    if (transfer.date > to) continue;
    events.push({ kind: 'transfer', date: transfer.date, no: Number(transfer.no) || 0, transfer });
  }
  for (const adjustment of company.stockAdjustments ?? []) {
    if (adjustment.date > to) continue;
    events.push({
      kind: 'adjustment',
      date: adjustment.date,
      no: Number(adjustment.no) || 0,
      adjustment,
    });
  }
  for (const manufacture of company.manufactures ?? []) {
    if (manufacture.date > to) continue;
    events.push({
      kind: 'manufacture',
      date: manufacture.date,
      no: Number(manufacture.no) || 0,
      manufacture,
    });
  }
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.no - b.no ||
      a.kind.localeCompare(b.kind),
  );
}

function openingStockState(item) {
  const qty = round3(item.openingQty ?? 0);
  const rate = round2(item.openingRate ?? 0);
  return { qty, value: round2(qty * rate), lastCost: rate };
}

function moveOut(state, qty) {
  const value = round2(qty * state.lastCost);
  state.qty = round3(state.qty - qty);
  state.value = round2(state.value - value);
  if (state.qty <= 0) {
    if (Math.abs(state.qty) < 0.0005) state.qty = 0;
    state.value = state.qty === 0 ? 0 : round2(state.qty * state.lastCost);
  }
  return value;
}

/** Applies one voucher's line for an item to a running stock state. */
function applyStockLine(state, voucher, itemId) {
  const isIn = STOCK_IN_TYPES.has(voucher.type);
  if (!isIn && !STOCK_OUT_TYPES.has(voucher.type)) return null;
  let moved = null;
  for (const line of voucher.items ?? []) {
    if (line.stockItemId !== itemId) continue;
    const qty = round3(line.qty);
    if (isIn) {
      // Purchases enter at their bill rate; a sales return re-enters at cost.
      const rate = voucher.type === 'Purchase' ? round2(line.rate) : state.lastCost;
      state.qty = round3(state.qty + qty);
      state.value = round2(state.value + qty * rate);
      if (state.qty > 0) state.lastCost = round2(state.value / state.qty);
      moved = moved ?? emptyMovement();
      moved.inQty = round3(moved.inQty + qty);
      moved.inValue = round2(moved.inValue + qty * rate);
    } else {
      const value = moveOut(state, qty);
      moved = moved ?? emptyMovement();
      moved.outQty = round3(moved.outQty + qty);
      moved.outValue = round2(moved.outValue + value);
    }
  }
  return moved;
}

function emptyMovement() {
  return { inQty: 0, inValue: 0, outQty: 0, outValue: 0 };
}

/** Applies one event and returns per-item quantity/value movements. */
function applyStockEvent(states, event) {
  const moves = new Map();
  const add = (itemId, move) => {
    const current = moves.get(itemId) ?? emptyMovement();
    current.inQty = round3(current.inQty + move.inQty);
    current.inValue = round2(current.inValue + move.inValue);
    current.outQty = round3(current.outQty + move.outQty);
    current.outValue = round2(current.outValue + move.outValue);
    moves.set(itemId, current);
  };

  if (event.kind === 'voucher') {
    const touched = new Set((event.voucher.items ?? []).map((line) => line.stockItemId));
    for (const itemId of touched) {
      const state = states.get(itemId);
      if (!state) continue;
      const moved = applyStockLine(state, event.voucher, itemId);
      if (moved) add(itemId, moved);
    }
    return moves;
  }

  if (event.kind === 'adjustment') {
    for (const line of event.adjustment.rows ?? []) {
      const state = states.get(line.stockItemId);
      if (!state) continue;
      const diff = round3(line.difference);
      if (diff > 0) {
        const value = round2(diff * state.lastCost);
        state.qty = round3(state.qty + diff);
        state.value = round2(state.value + value);
        if (state.qty > 0) state.lastCost = round2(state.value / state.qty);
        add(line.stockItemId, { inQty: diff, inValue: value, outQty: 0, outValue: 0 });
      } else if (diff < 0) {
        const qty = round3(Math.abs(diff));
        const value = moveOut(state, qty);
        add(line.stockItemId, { inQty: 0, inValue: 0, outQty: qty, outValue: value });
      }
    }
    return moves;
  }

  if (event.kind === 'manufacture') {
    const manufacture = event.manufacture;
    let cost = 0;
    for (const line of manufacture.components ?? []) {
      const state = states.get(line.stockItemId);
      if (!state) continue;
      const value = moveOut(state, round3(line.qty));
      cost = round2(cost + value);
      add(line.stockItemId, { inQty: 0, inValue: 0, outQty: round3(line.qty), outValue: value });
    }
    const conversionCost = round2(Number(manufacture.labourCost ?? 0) + Number(manufacture.overheadCost ?? 0));
    cost = round2(cost + conversionCost);
    const output = states.get(manufacture.outputItemId);
    if (output) {
      const qty = round3(manufacture.outputQty);
      output.qty = round3(output.qty + qty);
      output.value = round2(output.value + cost);
      if (output.qty > 0) output.lastCost = round2(output.value / output.qty);
      add(manufacture.outputItemId, { inQty: qty, inValue: cost, outQty: 0, outValue: 0 });
    }
    return moves;
  }

  return moves;
}

/**
 * Stock summary for a period. Opening is the position at `from`, movements are
 * valued at weighted-average cost, and closing is the position at `to`.
 * Production consumes components at cost and brings finished goods in at the
 * same component cost, so total stock value is preserved.
 */
export function stockSummary(company, filters = {}) {
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const reserved = openSalesOrderReservations(company, to);
  const items = company.stockItems ?? [];
  const units = new Map((company.units ?? []).map((unit) => [unit.id, unit]));
  const stockGroups = new Map((company.stockGroups ?? []).map((group) => [group.id, group]));
  const states = new Map(items.map((item) => [item.id, openingStockState(item)]));
  const events = stockMovementEvents(company, to);

  for (const event of events) {
    if (event.date >= from) break;
    applyStockEvent(states, event);
  }
  const opening = new Map(items.map((item) => [item.id, { ...states.get(item.id) }]));
  const accumulated = new Map();
  for (const event of events) {
    if (event.date < from) continue;
    for (const [itemId, move] of applyStockEvent(states, event)) {
      const current = accumulated.get(itemId) ?? emptyMovement();
      current.inQty = round3(current.inQty + move.inQty);
      current.inValue = round2(current.inValue + move.inValue);
      current.outQty = round3(current.outQty + move.outQty);
      current.outValue = round2(current.outValue + move.outValue);
      accumulated.set(itemId, current);
    }
  }

  const rows = items.map((item) => {
    const state = states.get(item.id);
    const start = opening.get(item.id);
    const moved = accumulated.get(item.id) ?? emptyMovement();
    return {
      itemId: item.id,
      name: item.name,
      groupName: stockGroups.get(item.stockGroupId)?.name ?? 'Primary',
      unit: units.get(item.unitId)?.symbol ?? '',
      openingQty: start.qty,
      openingValue: start.value,
      inQty: moved.inQty,
      inValue: moved.inValue,
      outQty: moved.outQty,
      outValue: moved.outValue,
      closingQty: state.qty,
      closingValue: state.value,
      averageRate: state.qty > 0 ? round2(state.value / state.qty) : state.lastCost,
      reorderLevel: round3(item.reorderLevel ?? 0),
      reservedQty: round3(reserved.get(item.id) ?? 0),
      availableQty: round3(state.qty - (reserved.get(item.id) ?? 0)),
      lowStock: (item.reorderLevel ?? 0) > 0 && state.qty <= (item.reorderLevel ?? 0),
    };
  });

  rows.sort(
    (a, b) => a.groupName.localeCompare(b.groupName) || a.name.localeCompare(b.name),
  );

  return {
    from,
    to,
    rows,
    totals: {
      openingValue: round2(rows.reduce((sum, row) => sum + row.openingValue, 0)),
      inValue: round2(rows.reduce((sum, row) => sum + row.inValue, 0)),
      outValue: round2(rows.reduce((sum, row) => sum + row.outValue, 0)),
      closingValue: round2(rows.reduce((sum, row) => sum + row.closingValue, 0)),
    },
  };
}

export function reorderReport(company, filters = {}) {
  const summary = stockSummary(company, {
    from: filters.from || company.fyStart,
    to: filters.to || company.fyEnd,
  });
  const items = new Map((company.stockItems ?? []).map((item) => [item.id, item]));
  const rows = summary.rows
    .filter((row) => row.lowStock || (row.reorderLevel > 0 && row.availableQty <= row.reorderLevel))
    .map((row) => {
      const item = items.get(row.itemId);
      const shortfall = round3(Math.max(0, row.reorderLevel - row.availableQty));
      return {
        ...row,
        shortfall,
        sellingPrice: round2(item?.sellingPrice ?? 0),
        purchasePrice: round2(item?.purchasePrice ?? 0),
        estimatedCost: round2(shortfall * (item?.purchasePrice || row.averageRate || 0)),
      };
    });
  return {
    from: summary.from,
    to: summary.to,
    rows,
    totals: {
      items: rows.length,
      estimatedCost: round2(rows.reduce((sum, row) => sum + row.estimatedCost, 0)),
    },
  };
}

export function stockValueAnalysis(company, filters = {}) {
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const summary = stockSummary(company, { from, to });
  const godown = godownStockSummary(company, { from, to });
  const groups = new Map();
  for (const row of summary.rows) {
    const key = row.groupName;
    const current = groups.get(key) ?? { groupName: key, items: 0, closingValue: 0, lowStock: 0 };
    current.items += 1;
    current.closingValue = round2(current.closingValue + row.closingValue);
    if (row.lowStock) current.lowStock += 1;
    groups.set(key, current);
  }
  const totalValue = summary.totals.closingValue;
  const byGroup = [...groups.values()]
    .map((row) => ({
      ...row,
      share: totalValue > 0 ? round2((row.closingValue / totalValue) * 100) : 0,
    }))
    .sort((a, b) => b.closingValue - a.closingValue || a.groupName.localeCompare(b.groupName));
  const byGodown = [...godown.rows.reduce((map, row) => {
    const current = map.get(row.godownId) ?? {
      godownId: row.godownId,
      godownName: row.godownName,
      items: new Set(),
      closingQty: 0,
      closingValue: 0,
    };
    current.items.add(row.itemId);
    current.closingQty = round3(current.closingQty + row.closingQty);
    current.closingValue = round2(current.closingValue + row.closingValue);
    map.set(row.godownId, current);
    return map;
  }, new Map()).values()]
    .map((row) => ({ ...row, items: row.items.size }))
    .sort((a, b) => b.closingValue - a.closingValue || a.godownName.localeCompare(b.godownName));
  return { from, to, byGroup, byGodown, totalValue };
}

/** Item-level price list. `priceType` is `selling` or `purchase`. */
export function priceList(company, filters = {}) {
  const priceType = filters.priceType === 'purchase' ? 'purchase' : 'selling';
  const field = priceType === 'purchase' ? 'purchasePrice' : 'sellingPrice';
  const groups = new Map((company.stockGroups ?? []).map((group) => [group.id, group]));
  const units = new Map((company.units ?? []).map((unit) => [unit.id, unit]));
  const rows = [...(company.stockItems ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      groupName: groups.get(item.stockGroupId)?.name ?? 'Primary',
      unit: units.get(item.unitId)?.symbol ?? '',
      hsn: item.hsn ?? '',
      price: round2(item[field] ?? 0),
      hasPrice: Number(item[field] ?? 0) > 0,
    }));
  return { priceType, rows, priced: rows.filter((row) => row.hasPrice).length };
}

export function openSalesOrderReservations(company, to = company.fyEnd) {
  const reservations = new Map();
  for (const order of company.orders ?? []) {
    if (order.kind || order.type !== 'Sales' || order.status !== 'Open' || order.date > to) continue;
    for (const line of orderRemainingItems(order)) {
      reservations.set(
        line.stockItemId,
        round3((reservations.get(line.stockItemId) ?? 0) + line.qty),
      );
    }
  }
  return reservations;
}

function stockQuantityEvents(company, to) {
  return stockMovementEvents(company, to);
}

function quantityMapAdd(map, key, qty) {
  map.set(key, round3((map.get(key) ?? 0) + qty));
}

/**
 * Quantity by item and godown for a period. Transfers count as outward from
 * the source godown and inward to the destination. Values use the item's
 * closing weighted-average cost; godowns are quantity locations, not separate
 * cost layers.
 */
export function godownStockSummary(company, filters = {}) {
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const main = (company.godowns ?? []).find((godown) => godown.primary)?.id ?? company.godowns?.[0]?.id ?? '';
  const units = new Map((company.units ?? []).map((unit) => [unit.id, unit]));
  const godowns = new Map((company.godowns ?? []).map((godown) => [godown.id, godown]));
  const valuation = new Map(stockSummary(company, { from, to }).rows.map((row) => [row.itemId, row]));
  const events = stockQuantityEvents(company, to);
  const rows = [];

  for (const item of company.stockItems ?? []) {
    const opening = new Map();
    const inward = new Map();
    const outward = new Map();
    if ((item.openingQty ?? 0) > 0) opening.set(main, round3(item.openingQty));

    for (const event of events) {
      if (event.kind === 'voucher') {
        const direction = STOCK_IN_TYPES.has(event.voucher.type) ? 1 : -1;
        for (const line of event.voucher.items ?? []) {
          if (line.stockItemId !== item.id) continue;
          const godownId = line.godownId || main;
          const qty = round3(line.qty);
          if (event.date < from) quantityMapAdd(opening, godownId, direction * qty);
          else if (direction > 0) quantityMapAdd(inward, godownId, qty);
          else quantityMapAdd(outward, godownId, qty);
        }
      } else if (event.kind === 'transfer') {
        for (const line of event.transfer.items ?? []) {
          if (line.stockItemId !== item.id) continue;
          const qty = round3(line.qty);
          if (event.date < from) {
            quantityMapAdd(opening, event.transfer.fromGodownId, -qty);
            quantityMapAdd(opening, event.transfer.toGodownId, qty);
          } else {
            quantityMapAdd(outward, event.transfer.fromGodownId, qty);
            quantityMapAdd(inward, event.transfer.toGodownId, qty);
          }
        }
      } else if (event.kind === 'adjustment') {
        for (const line of event.adjustment.rows ?? []) {
          if (line.stockItemId !== item.id) continue;
          const qty = round3(line.difference);
          if (event.date < from) quantityMapAdd(opening, event.adjustment.godownId, qty);
          else if (qty >= 0) quantityMapAdd(inward, event.adjustment.godownId, qty);
          else quantityMapAdd(outward, event.adjustment.godownId, -qty);
        }
      } else if (event.kind === 'manufacture') {
        const manufacture = event.manufacture;
        for (const line of manufacture.components ?? []) {
          if (line.stockItemId !== item.id) continue;
          const qty = round3(line.qty);
          if (event.date < from) quantityMapAdd(opening, manufacture.componentGodownId, -qty);
          else quantityMapAdd(outward, manufacture.componentGodownId, qty);
        }
        if (manufacture.outputItemId === item.id) {
          const qty = round3(manufacture.outputQty);
          if (event.date < from) quantityMapAdd(opening, manufacture.outputGodownId, qty);
          else quantityMapAdd(inward, manufacture.outputGodownId, qty);
        }
      }
    }

    const valuationRow = valuation.get(item.id);
    const rate = valuationRow?.averageRate ?? item.openingRate ?? 0;
    const keys = new Set([...opening.keys(), ...inward.keys(), ...outward.keys(), main]);
    for (const godownId of keys) {
      const openingQty = round3(opening.get(godownId) ?? 0);
      const inQty = round3(inward.get(godownId) ?? 0);
      const outQty = round3(outward.get(godownId) ?? 0);
      const closingQty = round3(openingQty + inQty - outQty);
      if (openingQty === 0 && inQty === 0 && outQty === 0) continue;
      rows.push({
        itemId: item.id,
        name: item.name,
        godownId,
        godownName: godowns.get(godownId)?.name ?? 'Unknown godown',
        unit: units.get(item.unitId)?.symbol ?? '',
        openingQty,
        inQty,
        outQty,
        closingQty,
        rate,
        closingValue: round2(closingQty * rate),
      });
    }
  }

  rows.sort((a, b) => a.godownName.localeCompare(b.godownName) || a.name.localeCompare(b.name));
  return {
    from,
    to,
    rows,
    totals: { closingQty: round3(rows.reduce((sum, row) => sum + row.closingQty, 0)), closingValue: round2(rows.reduce((sum, row) => sum + row.closingValue, 0)) },
  };
}

/** Batch quantities at the end of a period for batch-tracked items. */
export function batchStockSummary(company, filters = {}) {
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const main = (company.godowns ?? []).find((godown) => godown.primary)?.id ?? company.godowns?.[0]?.id ?? '';
  const units = new Map((company.units ?? []).map((unit) => [unit.id, unit]));
  const valuation = new Map(stockSummary(company, { from, to }).rows.map((row) => [row.itemId, row]));
  const events = stockQuantityEvents(company, to);
  const rows = [];

  for (const item of company.stockItems ?? []) {
    if (!item.batchTracking) continue;
    const opening = new Map();
    const inward = new Map();
    const outward = new Map();
    const expiry = new Map();
    const liveQty = new Map();
    const liveValue = new Map();
    const fallbackRate = valuation.get(item.id)?.averageRate ?? item.openingRate ?? 0;
    const batchCost = (key) => {
      const qty = liveQty.get(key) ?? 0;
      return qty > 0.0005 ? (liveValue.get(key) ?? 0) / qty : fallbackRate;
    };
    const moveBatch = (key, qty, rate) => {
      liveQty.set(key, round3((liveQty.get(key) ?? 0) + qty));
      liveValue.set(key, round2((liveValue.get(key) ?? 0) + qty * rate));
    };
    const openingBatches = (item.openingBatches ?? []).filter(
      (batch) => String(batch.batchNo ?? '').trim() && Number(batch.qty) > 0,
    );
    if (openingBatches.length) {
      for (const batch of openingBatches) {
        opening.set(batch.batchNo, round3(batch.qty));
        liveQty.set(batch.batchNo, round3(batch.qty));
        liveValue.set(batch.batchNo, round2(batch.qty * (item.openingRate ?? 0)));
        if (batch.expiryDate) expiry.set(batch.batchNo, batch.expiryDate);
      }
    } else if ((item.openingQty ?? 0) > 0) {
      opening.set(OPENING_BATCH, round3(item.openingQty));
      liveQty.set(OPENING_BATCH, round3(item.openingQty));
      liveValue.set(OPENING_BATCH, round2(item.openingQty * (item.openingRate ?? 0)));
    }
    const keyFor = (batchNo) => batchNo || OPENING_BATCH;

    for (const event of events) {
      if (event.kind === 'voucher') {
        const direction = STOCK_IN_TYPES.has(event.voucher.type) ? 1 : -1;
        for (const line of event.voucher.items ?? []) {
          if (line.stockItemId !== item.id) continue;
          const key = keyFor(line.batchNo);
          const qty = round3(line.qty);
          if (line.expiryDate) expiry.set(key, line.expiryDate);
          const unitCost = direction > 0 && event.voucher.type === 'Purchase' && Number(line.rate) > 0
            ? Number(line.rate)
            : batchCost(key);
          moveBatch(key, direction * qty, unitCost);
          if (event.date < from) quantityMapAdd(opening, key, direction * qty);
          else if (direction > 0) quantityMapAdd(inward, key, qty);
          else quantityMapAdd(outward, key, qty);
        }
      } else if (event.kind === 'transfer') {
        for (const line of event.transfer.items ?? []) {
          if (line.stockItemId !== item.id) continue;
          const key = keyFor(line.batchNo);
          const qty = round3(line.qty);
          if (event.date < from) {
            quantityMapAdd(opening, key, -qty);
            quantityMapAdd(opening, key, qty);
          } else {
            quantityMapAdd(outward, key, qty);
            quantityMapAdd(inward, key, qty);
          }
        }
      } else if (event.kind === 'adjustment') {
        for (const line of event.adjustment.rows ?? []) {
          if (line.stockItemId !== item.id) continue;
          const key = keyFor(line.batchNo);
          const qty = round3(line.difference);
          moveBatch(key, qty, batchCost(key));
          if (event.date < from) quantityMapAdd(opening, key, qty);
          else if (qty >= 0) quantityMapAdd(inward, key, qty);
          else quantityMapAdd(outward, key, -qty);
        }
      } else if (event.kind === 'manufacture') {
        const manufacture = event.manufacture;
        if (manufacture.outputItemId === item.id) {
          const key = keyFor(manufacture.outputBatchNo);
          const qty = round3(manufacture.outputQty);
          if (manufacture.expiryDate) expiry.set(key, manufacture.expiryDate);
          moveBatch(key, qty, fallbackRate);
          if (event.date < from) quantityMapAdd(opening, key, qty);
          else quantityMapAdd(inward, key, qty);
        }
      }
    }

    const keys = new Set([...opening.keys(), ...inward.keys(), ...outward.keys(), ...liveQty.keys()]);
    for (const key of keys) {
      const openingQty = round3(opening.get(key) ?? 0);
      const inQty = round3(inward.get(key) ?? 0);
      const outQty = round3(outward.get(key) ?? 0);
      const closingQty = round3(openingQty + inQty - outQty);
      if (openingQty === 0 && inQty === 0 && outQty === 0) continue;
      rows.push({
        itemId: item.id,
        name: item.name,
        batchNo: key,
        expiryDate: expiry.get(key) ?? null,
        unit: units.get(item.unitId)?.symbol ?? '',
        openingQty,
        inQty,
        outQty,
        closingQty,
        rate: round2(closingQty > 0 ? (liveValue.get(key) ?? 0) / closingQty : fallbackRate),
        closingValue: closingQty > 0 ? round2(liveValue.get(key) ?? 0) : 0,
      });
    }
  }

  rows.sort((a, b) => a.name.localeCompare(b.name) || a.batchNo.localeCompare(b.batchNo));
  const byItem = new Map();
  for (const row of rows) {
    const entry = byItem.get(row.itemId) ?? { itemId: row.itemId, name: row.name, unit: row.unit, batches: 0, closingQty: 0, closingValue: 0 };
    entry.batches += 1;
    entry.closingQty = round3(entry.closingQty + row.closingQty);
    entry.closingValue = round2(entry.closingValue + row.closingValue);
    byItem.set(row.itemId, entry);
  }
  return {
    from,
    to,
    rows,
    items: [...byItem.values()].sort((a, b) => a.name.localeCompare(b.name)),
    totals: {
      closingQty: round3(rows.reduce((sum, row) => sum + row.closingQty, 0)),
      closingValue: round2(rows.reduce((sum, row) => sum + row.closingValue, 0)),
    },
  };
}

function consumeAgeLayers(layers, qty) {
  let left = round3(qty);
  while (left > 0 && layers.length) {
    const layer = layers[0];
    const used = Math.min(left, layer.qty);
    layer.qty = round3(layer.qty - used);
    left = round3(left - used);
    if (layer.qty <= 0.0005) layers.shift();
  }
}

/**
 * Approximate closing-stock age using a FIFO walk of receipts and issues.
 * Transfers are ignored because they do not change total quantity; opening
 * stock is treated as the oldest layer.
 */
export function stockAgeing(company, filters = {}) {
  const asOn = filters.asOn || company.fyEnd;
  const summary = stockSummary(company, { from: booksStart(company), to: asOn });
  const layers = new Map();
  const layersFor = (itemId) => {
    if (!layers.has(itemId)) layers.set(itemId, []);
    return layers.get(itemId);
  };
  const records = new Map((company.stockItems ?? []).map((item) => [item.id, item]));
  for (const item of company.stockItems ?? []) {
    const qty = round3(item.openingQty ?? 0);
    if (qty > 0) layersFor(item.id).push({ date: booksStart(company), qty });
  }

  for (const event of stockMovementEvents(company, asOn)) {
    if (event.kind === 'voucher') {
      const direction = STOCK_IN_TYPES.has(event.voucher.type) ? 1 : -1;
      for (const line of event.voucher.items ?? []) {
        if (!records.has(line.stockItemId)) continue;
        const qty = round3(line.qty);
        if (direction > 0) layersFor(line.stockItemId).push({ date: event.date, qty });
        else consumeAgeLayers(layersFor(line.stockItemId), qty);
      }
    } else if (event.kind === 'adjustment') {
      for (const line of event.adjustment.rows ?? []) {
        if (!records.has(line.stockItemId)) continue;
        const qty = round3(line.difference);
        if (qty > 0) layersFor(line.stockItemId).push({ date: event.date, qty });
        else consumeAgeLayers(layersFor(line.stockItemId), -qty);
      }
    } else if (event.kind === 'manufacture') {
      const manufacture = event.manufacture;
      for (const line of manufacture.components ?? []) {
        if (records.has(line.stockItemId)) consumeAgeLayers(layersFor(line.stockItemId), round3(line.qty));
      }
      if (records.has(manufacture.outputItemId)) {
        layersFor(manufacture.outputItemId).push({ date: event.date, qty: round3(manufacture.outputQty) });
      }
    }
  }

  const bucketKeys = ['0-30', '31-60', '61-90', '91-180', 'Over 180'];
  const rows = summary.rows.map((row) => {
    const remaining = (layers.get(row.itemId) ?? []).filter((layer) => layer.qty > 0.0005);
    const buckets = Object.fromEntries(bucketKeys.map((key) => [key, 0]));
    for (const layer of remaining) {
      const days = Math.max(0, batchDaysBetween(layer.date, asOn));
      const key = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : days <= 180 ? '91-180' : 'Over 180';
      buckets[key] = round3(buckets[key] + layer.qty);
    }
    return {
      itemId: row.itemId,
      name: row.name,
      unit: row.unit,
      closingQty: row.closingQty,
      closingValue: row.closingValue,
      oldestDate: remaining[0]?.date ?? null,
      buckets,
    };
  });
  return {
    asOn,
    rows,
    bucketKeys,
    totals: {
      closingQty: round3(rows.reduce((sum, row) => sum + row.closingQty, 0)),
      closingValue: round2(rows.reduce((sum, row) => sum + row.closingValue, 0)),
      buckets: Object.fromEntries(bucketKeys.map((key) => [key, round3(rows.reduce((sum, row) => sum + row.buckets[key], 0))])),
    },
  };
}

function batchDaysBetween(from, to) {
  const start = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const end = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((end - start) / 86400000);
}

/** Batch stock whose expiry falls within the next `days`, including expired lots. */
export function expiringBatches(company, filters = {}) {
  const asOn = filters.asOn || new Date().toISOString().slice(0, 10);
  const days = Number.isFinite(Number(filters.days)) ? Math.max(0, Number(filters.days)) : 90;
  const limitDate = new Date(Date.UTC(
    Number(asOn.slice(0, 4)),
    Number(asOn.slice(5, 7)) - 1,
    Number(asOn.slice(8, 10)) + days,
  )).toISOString().slice(0, 10);
  const summary = batchStockSummary(company, { to: asOn });
  const rows = summary.rows
    .filter((row) => row.expiryDate && row.closingQty > 0 && row.expiryDate <= limitDate)
    .map((row) => ({
      ...row,
      daysLeft: batchDaysBetween(asOn, row.expiryDate),
      expired: row.expiryDate < asOn,
    }))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.name.localeCompare(b.name));
  return {
    asOn,
    days,
    rows,
    totals: {
      count: rows.length,
      expired: rows.filter((row) => row.expired).length,
      closingQty: round3(rows.reduce((sum, row) => sum + row.closingQty, 0)),
      closingValue: round2(rows.reduce((sum, row) => sum + row.closingValue, 0)),
    },
  };
}

/** Voucher-wise movement for one stock item, with a running balance. */
export function stockMovements(company, itemId, filters = {}) {
  const item = (company.stockItems ?? []).find((entry) => entry.id === itemId);
  if (!item) return null;
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const states = new Map((company.stockItems ?? []).map((entry) => [entry.id, openingStockState(entry)]));
  const events = stockMovementEvents(company, to);

  for (const event of events) {
    if (event.date >= from) break;
    applyStockEvent(states, event);
  }
  const state = states.get(item.id);
  const openingQty = state.qty;
  const openingValue = state.value;

  const rows = [];
  for (const event of events) {
    if (event.date < from) continue;
    const beforeQty = state.qty;
    const beforeValue = state.value;
    const moved = applyStockEvent(states, event).get(item.id);
    if (!moved) continue;
    rows.push({
      voucherId: event.kind === 'voucher' ? event.voucher.id : event[event.kind].id,
      type:
        event.kind === 'manufacture'
          ? 'Manufacture'
          : event.kind === 'adjustment'
            ? 'Stock adjustment'
            : event.kind === 'voucher'
              ? event.voucher.type
              : 'Transfer',
      no: event.kind === 'voucher' ? event.voucher.no : null,
      label:
        event.kind === 'manufacture'
          ? `MFG-${event.no}`
          : event.kind === 'adjustment'
            ? `SADJ-${event.no}`
            : null,
      date: event.date,
      narration:
        event.kind === 'voucher'
          ? event.voucher.narration ?? ''
          : event.kind === 'manufacture'
            ? event.manufacture.narration ?? event.manufacture.bomName
            : event.kind === 'adjustment'
              ? `Stock count SC-${event.adjustment.countNo}`
              : event.transfer.narration ?? '',
      inQty: moved.inQty,
      inValue: moved.inValue,
      outQty: moved.outQty,
      outValue: moved.outValue,
      rate: Math.abs(moved.inQty) > 0
        ? round2(moved.inValue / moved.inQty)
        : round2(moved.outValue / moved.outQty),
      balanceQty: state.qty,
      balanceValue: state.value,
      beforeQty,
      beforeValue,
    });
  }

  return {
    item: { ...item, unit: (company.units ?? []).find((unit) => unit.id === item.unitId)?.symbol ?? '' },
    unit: (company.units ?? []).find((unit) => unit.id === item.unitId)?.symbol ?? '',
    groupName:
      (company.stockGroups ?? []).find((group) => group.id === item.stockGroupId)?.name ?? 'Primary',
    from,
    to,
    openingQty,
    openingValue,
    rows,
    closingQty: state.qty,
    closingValue: state.value,
  };
}

function gstBucket() {
  return { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, count: 0 };
}

function gstAdd(bucket, entry, sign = 1) {
  bucket.taxable = round2(bucket.taxable + sign * entry.taxable);
  for (const role of ['cgst', 'sgst', 'igst', 'cess']) {
    bucket[role] = round2(bucket[role] + sign * entry[role]);
  }
  bucket.count += 1;
  return bucket;
}

function gstSum(entries) {
  const total = gstBucket();
  for (const entry of entries) gstAdd(total, entry, 1);
  return total;
}

function gstSumBuckets(buckets) {
  const total = gstBucket();
  for (const bucket of buckets) {
    total.taxable = round2(total.taxable + bucket.taxable);
    for (const role of ['cgst', 'sgst', 'igst', 'cess']) {
      total[role] = round2(total[role] + bucket[role]);
    }
    total.count += bucket.count;
  }
  return total;
}

function gstRateBucket(map, entry) {
  const key = `${entry.rate}:${entry.cessRate}`;
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { ...gstBucket(), rate: entry.rate, cessRate: entry.cessRate };
    map.set(key, bucket);
  }
  return bucket;
}

const GST_RATE_SORT = (a, b) => a.rate - b.rate || a.cessRate - b.cessRate;

/**
 * GST working papers: outward supplies for GSTR-1, an HSN summary and the
 * GSTR-3B liability/ITC summary. Credit notes reduce outward supplies and
 * debit notes reduce input tax credit. Nothing is filed or transmitted.
 */
export function gstReturns(company, filters = {}) {
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const stateCode = company.gst?.stateCode ?? '';
  const ledgerName = (ledgerId) =>
    company.ledgers.find((ledger) => ledger.id === ledgerId)?.name ?? '';

  const rows = (company.vouchers ?? [])
    .filter((voucher) => voucher.gst && voucher.date >= from && voucher.date <= to)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (Number(a.no) || 0) - (Number(b.no) || 0),
    );

  const outward = gstBucket();
  const purchases = gstBucket();
  const creditNotes = gstBucket();
  const debitNotes = gstBucket();
  const rcm = gstBucket();
  const outwardRates = new Map();
  const inwardRates = new Map();
  const b2cRates = new Map();
  const hsnMap = new Map();
  const b2b = [];
  const documents = [];

  for (const voucher of rows) {
    const gst = voucher.gst;
    const taxTotal = round2(gst.cgst + gst.sgst + gst.igst + gst.cess);
    const document = {
      id: voucher.id,
      type: voucher.type,
      no: voucher.no,
      date: voucher.date,
      ref: voucher.bill?.ref || `${VOUCHER_TYPES[voucher.type]?.label ?? voucher.type} ${voucher.no}`,
      party: ledgerName(gst.partyLedgerId),
      partyGstin: gst.partyGstin || '',
      placeOfSupply: gst.placeOfSupply,
      placeOfSupplyName: gstStateName(gst.placeOfSupply),
      supplyType: gst.supplyType,
      rate: gst.rate,
      cessRate: gst.cessRate,
      reverseCharge: Boolean(gst.reverseCharge),
      taxable: gst.taxable,
      cgst: gst.cgst,
      sgst: gst.sgst,
      igst: gst.igst,
      cess: gst.cess,
      taxTotal,
      total: round2(gst.taxable + taxTotal),
    };
    documents.push(document);

    if (voucher.type === 'Sales') {
      gstAdd(outward, document, 1);
      gstAdd(gstRateBucket(outwardRates, document), document, 1);
      if (document.partyGstin) b2b.push(document);
      else gstAdd(gstRateBucket(b2cRates, document), document, 1);
    } else if (voucher.type === 'CreditNote') {
      gstAdd(creditNotes, document, 1);
      gstAdd(outward, document, -1);
      gstAdd(gstRateBucket(outwardRates, document), document, -1);
    } else if (voucher.type === 'Purchase') {
      gstAdd(purchases, document, 1);
      gstAdd(gstRateBucket(inwardRates, document), document, 1);
      if (document.reverseCharge) gstAdd(rcm, document, 1);
    } else if (voucher.type === 'DebitNote') {
      gstAdd(debitNotes, document, 1);
      gstAdd(purchases, document, -1);
      gstAdd(gstRateBucket(inwardRates, document), document, -1);
      if (document.reverseCharge) gstAdd(rcm, document, -1);
    }

    // HSN summary covers outward invoices and their credit notes.
    if ((voucher.type === 'Sales' || voucher.type === 'CreditNote') && voucher.items?.length) {
      const direction = voucher.type === 'Sales' ? 1 : -1;
      for (const line of voucher.items) {
        const item = (company.stockItems ?? []).find((entry) => entry.id === line.stockItemId);
        const hsn = item?.hsn || 'Unclassified';
        const unit = uqcFor(company, item?.unitId);
        const key = `${hsn}|${unit}`;
        let bucket = hsnMap.get(key);
        if (!bucket) {
          bucket = { hsn, unit, description: item?.name ?? '', qty: 0, taxable: 0, tax: 0 };
          hsnMap.set(key, bucket);
        } else if (!bucket.description && item?.name) {
          bucket.description = item.name;
        }
        const lineAmount = round2(line.amount ?? round2((line.qty ?? 0) * (line.rate ?? 0)));
        const share = gst.taxable > 0 ? lineAmount / gst.taxable : 0;
        bucket.qty = round3(bucket.qty + direction * (line.qty ?? 0));
        bucket.taxable = round2(bucket.taxable + direction * lineAmount);
        bucket.tax = round2(bucket.tax + direction * round2(taxTotal * share));
      }
    }
  }

  const outwardTax = {
    cgst: outward.cgst,
    sgst: outward.sgst,
    igst: outward.igst,
    cess: outward.cess,
  };
  const rcmTax = { cgst: rcm.cgst, sgst: rcm.sgst, igst: rcm.igst, cess: rcm.cess };
  const itc = {
    cgst: purchases.cgst,
    sgst: purchases.sgst,
    igst: purchases.igst,
    cess: purchases.cess,
  };
  const liability = {
    cgst: round2(outward.cgst + rcm.cgst),
    sgst: round2(outward.sgst + rcm.sgst),
    igst: round2(outward.igst + rcm.igst),
    cess: round2(outward.cess + rcm.cess),
  };
  const net = {
    cgst: round2(liability.cgst - itc.cgst),
    sgst: round2(liability.sgst - itc.sgst),
    igst: round2(liability.igst - itc.igst),
    cess: round2(liability.cess - itc.cess),
  };
  const sumHeads = (heads) => round2(heads.cgst + heads.sgst + heads.igst + heads.cess);

  return {
    from,
    to,
    enabled: Boolean(company.gst?.enabled),
    gstin: company.gst?.gstin ?? '',
    stateCode,
    stateName: gstStateName(stateCode),
    count: documents.length,
    documents,
    outward,
    creditNotes,
    debitNotes,
    purchases,
    rcm,
    gstr1: {
      b2b,
      b2bTotal: gstSum(b2b),
      b2c: [...b2cRates.values()].sort(GST_RATE_SORT),
      b2cTotal: gstSumBuckets([...b2cRates.values()]),
      cdnr: documents.filter((entry) => entry.type === 'CreditNote'),
      cdnrTotal: creditNotes,
      rateRows: [...outwardRates.values()].sort(GST_RATE_SORT),
      hsn: [...hsnMap.values()].sort(
        (a, b) => a.hsn.localeCompare(b.hsn) || a.unit.localeCompare(b.unit),
      ),
    },
    itcRateRows: [...inwardRates.values()].sort(GST_RATE_SORT),
    gstr3b: {
      outwardTaxable: outward.taxable,
      outwardTax,
      outwardTaxTotal: sumHeads(outwardTax),
      rcmTaxable: rcm.taxable,
      rcmTax,
      rcmTaxTotal: sumHeads(rcmTax),
      itcTaxable: purchases.taxable,
      itc,
      itcTotal: sumHeads(itc),
      liability,
      liabilityTotal: sumHeads(liability),
      net,
      netTotal: sumHeads(net),
    },
    totals: {
      taxable: outward.taxable,
      tax: sumHeads(outwardTax),
      gross: round2(outward.taxable + sumHeads(outwardTax)),
    },
  };
}

export function gstAnnualSummary(company, filters = {}) {
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const rows = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7)) - 1;
  const endYear = Number(to.slice(0, 4));
  const endMonth = Number(to.slice(5, 7)) - 1;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    const monthEnd = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
    const start = monthStart < from ? from : monthStart;
    const finish = monthEnd > to ? to : monthEnd;
    const report = gstReturns(company, { from: start, to: finish });
    rows.push({
      from: start,
      to: finish,
      label: `${names[month]} ${year}`,
      outwardTaxable: report.gstr3b.outwardTaxable,
      outwardTax: report.gstr3b.outwardTaxTotal,
      itc: report.gstr3b.itcTotal,
      net: report.gstr3b.netTotal,
    });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return {
    from,
    to,
    rows,
    totals: {
      outwardTaxable: round2(rows.reduce((sum, row) => sum + row.outwardTaxable, 0)),
      outwardTax: round2(rows.reduce((sum, row) => sum + row.outwardTax, 0)),
      itc: round2(rows.reduce((sum, row) => sum + row.itc, 0)),
      net: round2(rows.reduce((sum, row) => sum + row.net, 0)),
    },
  };
}

function withholdingQuarter(date) {
  const month = Number(String(date).slice(5, 7));
  if (month >= 4 && month <= 6) return { key: 'Q1', label: 'Q1 · Apr–Jun' };
  if (month >= 7 && month <= 9) return { key: 'Q2', label: 'Q2 · Jul–Sep' };
  if (month >= 10 && month <= 12) return { key: 'Q3', label: 'Q3 · Oct–Dec' };
  return { key: 'Q4', label: 'Q4 · Jan–Mar' };
}

/**
 * TDS or TCS working papers: deductee register, section and party summaries,
 * quarterly totals, challan payments and a threshold watch. Nothing is filed.
 */
export function withholdingSummary(company, filters = {}) {
  const kind = filters.kind === 'TCS' ? 'TCS' : 'TDS';
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const ledgerName = (ledgerId) =>
    company.ledgers.find((ledger) => ledger.id === ledgerId)?.name ?? '';

  const all = (company.vouchers ?? [])
    .filter((voucher) => voucher.tds?.kind === kind)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (Number(a.no) || 0) - (Number(b.no) || 0),
    );
  const period = all.filter((voucher) => voucher.date >= from && voucher.date <= to);

  const documents = period.map((voucher) => {
    const entry = voucher.tds;
    const quarter = withholdingQuarter(voucher.date);
    return {
      id: voucher.id,
      type: voucher.type,
      no: voucher.no,
      date: voucher.date,
      ref: voucher.bill?.ref || `${VOUCHER_TYPES[voucher.type]?.label ?? voucher.type} ${voucher.no}`,
      party: ledgerName(entry.partyLedgerId),
      pan: entry.pan || '',
      sectionId: entry.sectionId,
      code: entry.code,
      label: entry.label,
      rate: entry.rate,
      base: entry.base,
      amount: entry.amount,
      quarter: quarter.key,
      quarterLabel: quarter.label,
    };
  });

  const sectionMap = new Map();
  const partyMap = new Map();
  const quarters = [
    { key: 'Q1', label: 'Q1 · Apr–Jun' },
    { key: 'Q2', label: 'Q2 · Jul–Sep' },
    { key: 'Q3', label: 'Q3 · Oct–Dec' },
    { key: 'Q4', label: 'Q4 · Jan–Mar' },
  ].map((entry) => ({ ...entry, base: 0, amount: 0, count: 0 }));

  for (const document of documents) {
    let section = sectionMap.get(document.sectionId);
    if (!section) {
      section = {
        sectionId: document.sectionId,
        code: document.code,
        label: document.label,
        rate: document.rate,
        base: 0,
        amount: 0,
        count: 0,
      };
      sectionMap.set(document.sectionId, section);
    }
    section.base = round2(section.base + document.base);
    section.amount = round2(section.amount + document.amount);
    section.count += 1;

    const partyKey = document.party || 'Unassigned';
    let deductee = partyMap.get(partyKey);
    if (!deductee) {
      deductee = { party: document.party || 'Unassigned', pan: '', base: 0, amount: 0, count: 0 };
      partyMap.set(partyKey, deductee);
    }
    if (document.pan) deductee.pan = document.pan;
    deductee.base = round2(deductee.base + document.base);
    deductee.amount = round2(deductee.amount + document.amount);
    deductee.count += 1;

    const quarter = quarters.find((entry) => entry.key === document.quarter);
    if (quarter) {
      quarter.base = round2(quarter.base + document.base);
      quarter.amount = round2(quarter.amount + document.amount);
      quarter.count += 1;
    }
  }

  const challans = (company.taxChallans ?? [])
    .filter((challan) => challan.kind === kind && challan.date >= from && challan.date <= to)
    .map((challan) => {
      const section = (company.tds?.sections ?? []).find((entry) => entry.id === challan.sectionId);
      return {
        id: challan.id,
        date: challan.date,
        amount: challan.amount,
        reference: challan.reference,
        bsrCode: challan.bsrCode,
        section: section ? `${section.code} · ${section.label}` : 'Not linked',
      };
    });

  const payableToDate = round2(
    all.filter((voucher) => voucher.date <= to).reduce((sum, voucher) => sum + voucher.tds.amount, 0),
  );
  const paidToDate = round2(
    (company.taxChallans ?? [])
      .filter((challan) => challan.kind === kind && challan.date <= to)
      .reduce((sum, challan) => sum + challan.amount, 0),
  );
  const periodBase = round2(documents.reduce((sum, document) => sum + document.base, 0));
  const periodAmount = round2(documents.reduce((sum, document) => sum + document.amount, 0));

  const yearRows = all.filter((voucher) => voucher.date >= company.fyStart && voucher.date <= to);
  const thresholdRows = (company.tds?.sections ?? [])
    .filter((section) => section.kind === kind)
    .map((section) => {
      const base = round2(
        yearRows
          .filter((voucher) => voucher.tds.sectionId === section.id)
          .reduce((sum, voucher) => sum + voucher.tds.base, 0),
      );
      return {
        sectionId: section.id,
        code: section.code,
        label: section.label,
        rate: section.rate,
        threshold: section.threshold,
        base,
        crossed: section.threshold > 0 ? base >= section.threshold : base > 0,
      };
    });

  return {
    kind,
    from,
    to,
    enabled: Boolean(company.tds?.enabled),
    tan: company.tds?.tan ?? '',
    documents,
    sections: [...sectionMap.values()].sort((a, b) => a.code.localeCompare(b.code)),
    parties: [...partyMap.values()].sort((a, b) => b.amount - a.amount || a.party.localeCompare(b.party)),
    quarters,
    count: documents.length,
    periodBase,
    periodAmount,
    payableToDate,
    paidToDate,
    outstanding: round2(payableToDate - paidToDate),
    challans,
    challanTotal: round2(challans.reduce((sum, challan) => sum + challan.amount, 0)),
    thresholdRows,
  };
}

/** Deductee-wise certificate working paper, one row per party and quarter. */
export function withholdingCertificates(company, filters = {}) {
  const summary = withholdingSummary(company, filters);
  const map = new Map();
  for (const document of summary.documents) {
    const key = `${document.party}|${document.pan}|${document.quarter}`;
    let row = map.get(key);
    if (!row) {
      row = {
        party: document.party || 'Unassigned',
        pan: document.pan,
        quarter: document.quarter,
        quarterLabel: document.quarterLabel,
        base: 0,
        amount: 0,
        count: 0,
        sections: new Set(),
      };
      map.set(key, row);
    }
    row.base = round2(row.base + document.base);
    row.amount = round2(row.amount + document.amount);
    row.count += 1;
    row.sections.add(document.code);
  }
  const rows = [...map.values()]
    .map((row) => ({ ...row, sections: [...row.sections].sort().join(', ') }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter) || a.party.localeCompare(b.party));
  return {
    kind: summary.kind,
    from: summary.from,
    to: summary.to,
    tan: summary.tan,
    rows,
    totals: {
      base: round2(rows.reduce((sum, row) => sum + row.base, 0)),
      amount: round2(rows.reduce((sum, row) => sum + row.amount, 0)),
    },
  };
}

/** Payroll register for a period: runs, employees, pay heads and statutory tags. */
export function payrollSummary(company, { from, to } = {}) {
  const runs = (company.payroll?.runs ?? [])
    .filter((run) => (!from || run.date >= from) && (!to || run.date <= to))
    .sort((a, b) => a.month.localeCompare(b.month));

  const headMap = new Map();
  const employeeMap = new Map();
  const statutoryMap = new Map();
  const rows = [];

  for (const run of runs) {
    for (const row of run.rows) {
      rows.push({
        runId: run.id,
        month: run.month,
        date: run.date,
        employeeId: row.employeeId,
        employee: row.name,
        gross: row.gross,
        deductions: row.deductionTotal,
        net: row.net,
      });
      let employee = employeeMap.get(row.employeeId);
      if (!employee) {
        employee = { employeeId: row.employeeId, name: row.name, months: 0, gross: 0, deductions: 0, net: 0 };
        employeeMap.set(row.employeeId, employee);
      }
      employee.months += 1;
      employee.gross = round2(employee.gross + row.gross);
      employee.deductions = round2(employee.deductions + row.deductionTotal);
      employee.net = round2(employee.net + row.net);

      for (const line of row.earnings) {
        const key = `Earning:${line.payHeadId}`;
        let head = headMap.get(key);
        if (!head) {
          head = { payHeadId: line.payHeadId, name: line.name, kind: 'Earning', statutory: '', amount: 0, count: 0 };
          headMap.set(key, head);
        }
        head.amount = round2(head.amount + line.amount);
        head.count += 1;
      }
      for (const line of row.deductions) {
        const key = `Deduction:${line.payHeadId}`;
        let head = headMap.get(key);
        if (!head) {
          head = {
            payHeadId: line.payHeadId,
            name: line.name,
            kind: 'Deduction',
            statutory: line.statutory ?? '',
            amount: 0,
            count: 0,
          };
          headMap.set(key, head);
        }
        head.amount = round2(head.amount + line.amount);
        head.count += 1;
        if (line.statutory) {
          statutoryMap.set(line.statutory, round2((statutoryMap.get(line.statutory) ?? 0) + line.amount));
        }
      }
    }
  }

  const totals = {
    employees: employeeMap.size,
    gross: round2(rows.reduce((sum, row) => sum + row.gross, 0)),
    deductions: round2(rows.reduce((sum, row) => sum + row.deductions, 0)),
    net: round2(rows.reduce((sum, row) => sum + row.net, 0)),
  };

  return {
    from: from ?? '',
    to: to ?? '',
    enabled: Boolean(company.payroll?.enabled),
    count: runs.length,
    runs: runs.map((run) => {
      const voucher = (company.vouchers ?? []).find((entry) => entry.id === run.voucherId);
      return {
        id: run.id,
        month: run.month,
        date: run.date,
        employees: run.totals.employees,
        gross: run.totals.gross,
        deductions: run.totals.deductions,
        net: run.totals.net,
        voucherId: run.voucherId ?? '',
        voucherNo: voucher?.no ?? '',
      };
    }),
    payHeads: [...headMap.values()].sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
    ),
    employees: [...employeeMap.values()].sort((a, b) => b.net - a.net || a.name.localeCompare(b.name)),
    statutory: [...statutoryMap.entries()]
      .map(([tag, amount]) => ({ tag, amount }))
      .sort((a, b) => a.tag.localeCompare(b.tag)),
    rows,
    totals,
  };
}

function financialYearMonths(start, end) {
  const months = [];
  let year = Number(String(start).slice(0, 4));
  let month = Number(String(start).slice(5, 7));
  const last = String(end).slice(0, 7);
  if (!year || !month) return months;
  while (months.length < 48) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (key > last) break;
    months.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** Statistics: voucher/master counts plus monthly MIS movements. */
export function statistics(company, filters = {}) {
  // Sales and purchase statistics are accounting values, not tax-inclusive
  // cash totals: GST and TDS/TCS are collected on behalf of the government.
  const netVoucherValue = (voucher) =>
    voucher.gst?.taxable ?? voucher.tds?.base ?? voucher.total;

  const voucherCounts = Object.keys(VOUCHER_TYPES).map((type) => {
    const items = company.vouchers.filter((voucher) => voucher.type === type);
    return {
      type,
      label: VOUCHER_TYPES[type].label,
      count: items.length,
      total: round2(items.reduce((sum, voucher) => sum + voucher.total, 0)),
    };
  });

  const monthly = financialYearMonths(company.fyStart, company.fyEnd).map((month) => ({
    month,
    sales: 0,
    purchases: 0,
    creditNotes: 0,
    debitNotes: 0,
    receipts: 0,
    payments: 0,
  }));
  const byMonth = new Map(monthly.map((row) => [row.month, row]));
  for (const voucher of company.vouchers) {
    if (voucher.date < company.fyStart || voucher.date > company.fyEnd) continue;
    const row = byMonth.get(voucher.date.slice(0, 7));
    if (!row) continue;
    if (voucher.type === 'Sales') row.sales = round2(row.sales + netVoucherValue(voucher));
    else if (voucher.type === 'Purchase') row.purchases = round2(row.purchases + netVoucherValue(voucher));
    else if (voucher.type === 'CreditNote') row.creditNotes = round2(row.creditNotes + netVoucherValue(voucher));
    else if (voucher.type === 'DebitNote') row.debitNotes = round2(row.debitNotes + netVoucherValue(voucher));
    else if (voucher.type === 'Receipt') row.receipts = round2(row.receipts + voucher.total);
    else if (voucher.type === 'Payment') row.payments = round2(row.payments + voucher.total);
  }

  const asOn = filters.asOn || new Date().toISOString().slice(0, 10);
  const cutoffMonth = asOn.slice(0, 7);
  const basis = monthly.filter((row) => row.month < cutoffMonth).slice(-3);
  let forecast = null;
  if (
    basis.length &&
    cutoffMonth >= company.fyStart.slice(0, 7) &&
    cutoffMonth <= company.fyEnd.slice(0, 7)
  ) {
    const nextMonths = financialYearMonths(`${cutoffMonth}-01`, company.fyEnd).slice(0, 3);
    const average = (key, returns) =>
      round2(
        basis.reduce((sum, row) => sum + row[key] - row[returns], 0) / basis.length,
      );
    const sales = average('sales', 'creditNotes');
    const purchases = average('purchases', 'debitNotes');
    forecast = {
      asOn,
      basis: basis.map((row) => row.month),
      months: nextMonths.map((month) => ({ month, sales, purchases })),
    };
  }

  const topParties = (types, groupKey) => {
    const totals = new Map();
    for (const voucher of company.vouchers) {
      if (!types.includes(voucher.type)) continue;
      if (voucher.date < company.fyStart || voucher.date > company.fyEnd) continue;
      const partyLine = (voucher.lines ?? []).find((line) => {
        const ledger = company.ledgers.find((entry) => entry.id === line.ledgerId);
        return ledger ? inGroupKey(company, ledger, groupKey) : false;
      });
      if (!partyLine) continue;
      const value = netVoucherValue(voucher);
      const signed = voucher.type === 'CreditNote' || voucher.type === 'DebitNote' ? -value : value;
      const current = totals.get(partyLine.ledgerId) ?? { ledgerId: partyLine.ledgerId, amount: 0 };
      current.amount = round2(current.amount + signed);
      totals.set(partyLine.ledgerId, current);
    }
    const total = round2([...totals.values()].reduce((sum, row) => sum + Math.max(0, row.amount), 0));
    return [...totals.values()]
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        name: company.ledgers.find((ledger) => ledger.id === row.ledgerId)?.name ?? 'Unknown party',
        share: total > 0 ? round2((row.amount / total) * 100) : 0,
      }));
  };

  let stock = null;
  if ((company.stockItems ?? []).length) {
    const valuation = stockSummary(company, { from: company.fyStart, to: company.fyEnd });
    const held = valuation.rows.filter((row) => row.closingQty > 0 && row.closingValue > 0);
    const heldValue = round2(held.reduce((sum, row) => sum + row.closingValue, 0));
    const item = (row) => ({
      itemId: row.itemId,
      name: row.name,
      unit: row.unit,
      closingQty: row.closingQty,
      closingValue: row.closingValue,
      share: heldValue > 0 ? round2((row.closingValue / heldValue) * 100) : 0,
    });
    const idle = held.filter((row) => row.outQty === 0).sort((a, b) => b.closingValue - a.closingValue);
    stock = {
      closingValue: valuation.totals.closingValue,
      itemCount: held.length,
      topItems: held.sort((a, b) => b.closingValue - a.closingValue).slice(0, 5).map(item),
      idleCount: idle.length,
      idleValue: round2(idle.reduce((sum, row) => sum + row.closingValue, 0)),
      idleItems: idle.slice(0, 5).map(item),
    };
  }

  const pnl = (company.vouchers ?? []).length ? profitAndLoss(company) : null;
  const expenseRows = pnl
    ? [...pnl.direct.expenseSections, ...pnl.indirect.expenseSections].flatMap((section) => section.rows)
    : [];
  const expenseTotal = round2(expenseRows.reduce((sum, row) => sum + Math.max(0, row.amount), 0));
  const topExpenses = expenseRows
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((row) => ({
      ledgerId: row.ledgerId,
      name: row.name,
      groupName: row.groupName,
      amount: row.amount,
      share: expenseTotal > 0 ? round2((row.amount / expenseTotal) * 100) : 0,
    }));

  const totals = ledgerTotals(company, { to: company.fyEnd });
  let cash = 0;
  let bank = 0;
  for (const ledger of company.ledgers) {
    const entry = totals.get(ledger.id);
    if (!entry) continue;
    if (inGroupKey(company, ledger, 'cash')) cash = round2(cash + entry.closing);
    if (inGroupKey(company, ledger, 'bank')) bank = round2(bank + entry.closing);
  }
  const receivables = outstanding(company, { side: 'receivable', asOn: company.fyEnd }).total;
  const payables = outstanding(company, { side: 'payable', asOn: company.fyEnd }).total;
  const stockValue = stock?.closingValue ?? 0;
  const workingCapital = {
    asOn: company.fyEnd,
    receivables,
    payables,
    stock: stockValue,
    cash,
    bank,
    net: round2(receivables + stockValue + cash + bank - payables),
  };

  const sorted = vouchersSorted(company);
  return {
    voucherCounts,
    stock,
    workingCapital,
    netProfit: pnl?.netProfit ?? 0,
    expenseTotal,
    topExpenses,
    forecast,
    topCustomers: topParties(['Sales', 'CreditNote'], 'sundryDebtors'),
    topSuppliers: topParties(['Purchase', 'DebitNote'], 'sundryCreditors'),
    voucherTotal: company.vouchers.length,
    ledgerCount: company.ledgers.length,
    groupCount: company.groups.length,
    customGroupCount: company.groups.filter((group) => group.custom).length,
    firstDate: sorted[sorted.length - 1]?.date ?? null,
    lastDate: sorted[0]?.date ?? null,
    monthly,
    groups: company.groups.map((group) => ({
      id: group.id,
      name: group.name,
      nature: group.nature,
      ledgers: company.ledgers.filter((ledger) => ledger.groupId === group.id).length,
    })),
  };
}

// NIC e-invoice and e-way bill payloads need UQC codes, not free-text units.
const UQC_BY_SYMBOL = {
  nos: 'NOS',
  pcs: 'PCS',
  kg: 'KGS',
  gms: 'GMS',
  ltr: 'LTR',
  mtr: 'MTR',
  sqm: 'SQM',
  box: 'BOX',
  doz: 'DOZ',
  set: 'SET',
  bag: 'BAG',
  ton: 'TON',
};

export const EWAY_BILL_THRESHOLD = 50000;
const EINVOICE_TURNOVER_NOTE = 'E-invoice applicability by aggregate turnover is not tested; all B2B sales invoices are listed for review.';

function uqcFor(company, unitId) {
  const unit = (company.units ?? []).find((entry) => entry.id === unitId);
  const symbol = String(unit?.symbol ?? unit?.name ?? '').trim().toLowerCase();
  return UQC_BY_SYMBOL[symbol] ?? 'OTH';
}

function gstDate(value) {
  const [year, month, day] = String(value ?? '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
}

function sellerProfile(company) {
  const gst = company.gst ?? {};
  return {
    gstin: gst.gstin ?? '',
    legalName: gst.legalName || company.name || '',
    tradeName: gst.tradeName || gst.legalName || company.name || '',
    address: gst.address ?? '',
    city: gst.city ?? '',
    pin: gst.pin ?? '',
    stateCode: gst.stateCode ?? '',
    stateName: gstStateName(gst.stateCode),
  };
}

function buyerProfile(company, voucher, document) {
  const ledger = (company.ledgers ?? []).find((entry) => entry.id === voucher?.gst?.partyLedgerId);
  const gstin = document.partyGstin || ledger?.gstin || '';
  return {
    ledgerId: ledger?.id ?? '',
    gstin,
    legalName: ledger?.name || document.party || '',
    tradeName: ledger?.name || document.party || '',
    address: ledger?.address ?? '',
    city: ledger?.city ?? '',
    pin: ledger?.pin ?? '',
    stateCode: ledger?.stateCode || gstin.slice(0, 2) || document.placeOfSupply || '',
    stateName: gstStateName(ledger?.stateCode || gstin.slice(0, 2) || document.placeOfSupply),
  };
}

function partyIssues(label, party) {
  const issues = [];
  if (!party.legalName) issues.push(`${label} legal name is missing.`);
  if (!party.address) issues.push(`${label} address is missing.`);
  if (!party.city) issues.push(`${label} city / location is missing.`);
  if (!party.pin) issues.push(`${label} PIN code is missing.`);
  else if (!/^[0-9]{6}$/.test(party.pin)) issues.push(`${label} PIN code is not 6 digits.`);
  return issues;
}

function eInvoiceLineRows(company, voucher, document) {
  const items = voucher.items ?? [];
  if (!items.length) {
    return [
      {
        description: document.ref || 'As per invoice',
        hsn: '',
        qty: 1,
        unit: 'OTH',
        unitPrice: document.taxable,
        taxable: document.taxable,
        missingHsn: true,
      },
    ];
  }
  return items.map((line) => {
    const item = (company.stockItems ?? []).find((entry) => entry.id === line.stockItemId);
    const taxable = round2(line.amount ?? round2((line.qty ?? 0) * (line.rate ?? 0)));
    return {
      description: item?.name || 'Stock item',
      hsn: item?.hsn || '',
      qty: line.qty ?? 0,
      unit: uqcFor(company, item?.unitId),
      unitPrice: line.rate ?? 0,
      taxable,
      missingHsn: !item?.hsn,
    };
  });
}

function eInvoicePayload(company, document, voucher, seller, buyer, lines) {
  const intra = document.supplyType === 'Intra';
  const gstRate = Number(document.rate) || 0;
  const cessRate = Number(document.cessRate) || 0;
  const itemList = lines.map((line, index) => {
    const tax = round2((line.taxable * gstRate) / 100);
    const cess = round2((line.taxable * cessRate) / 100);
    return {
      SlNo: String(index + 1),
      PrdDesc: line.description,
      IsServc: line.hsn ? 'N' : 'Y',
      HsnCd: line.hsn,
      Qty: Number(line.qty) || 0,
      Unit: line.unit,
      UnitPrice: round2(line.unitPrice),
      TotAmt: round2(line.taxable),
      Discount: 0,
      PreTaxVal: 0,
      AssAmt: round2(line.taxable),
      GstRt: gstRate,
      IgstAmt: intra ? 0 : tax,
      CgstAmt: intra ? round2(tax / 2) : 0,
      SgstAmt: intra ? round2(tax / 2) : 0,
      CesRt: cessRate,
      CesAmt: cess,
      CesNonAdvlAmt: 0,
      StateCesRt: 0,
      StateCesAmt: 0,
      StateCesNonAdvlAmt: 0,
      OthChrg: 0,
      TotItemVal: round2(line.taxable + tax + cess),
    };
  });

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: buyer.gstin ? 'B2B' : 'B2C',
      RegRev: document.reverseCharge ? 'Y' : 'N',
      IgstOnIntra: 'N',
    },
    DocDtls: { Typ: 'INV', No: String(document.ref || document.no), Dt: gstDate(document.date) },
    SellerDtls: {
      Gstin: seller.gstin,
      LglNm: seller.legalName,
      TrdNm: seller.tradeName,
      Addr1: seller.address,
      Addr2: '',
      Loc: seller.city,
      Pin: seller.pin,
      Stcd: seller.stateCode,
      Ph: '',
      Em: '',
    },
    BuyerDtls: {
      Gstin: buyer.gstin || 'URP',
      LglNm: buyer.legalName,
      TrdNm: buyer.tradeName,
      Pos: document.placeOfSupply,
      Addr1: buyer.address,
      Addr2: '',
      Loc: buyer.city,
      Pin: buyer.pin,
      Stcd: buyer.stateCode,
      Ph: '',
      Em: '',
    },
    ItemList: itemList,
    ValDtls: {
      AssVal: document.taxable,
      CgstVal: document.cgst,
      SgstVal: document.sgst,
      IgstVal: document.igst,
      CesVal: document.cess,
      StCesVal: 0,
      Discount: 0,
      OthChrg: 0,
      RndOffAmt: 0,
      TotInvVal: document.total,
    },
  };
}

/**
 * E-invoice working papers: every outward sales invoice, its buyer/seller
 * profile, readiness checks and a draft NIC-style JSON payload. Nothing is
 * registered with an IRP and no IRN is generated.
 */
export function eInvoiceRegister(company, filters = {}) {
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const returns = gstReturns(company, { from, to });
  const seller = sellerProfile(company);
  const sales = returns.documents.filter((document) => document.type === 'Sales');
  const rows = sales.map((document) => {
    const voucher = (company.vouchers ?? []).find((entry) => entry.id === document.id);
    const buyer = buyerProfile(company, voucher, document);
    const lines = voucher ? eInvoiceLineRows(company, voucher, document) : [];
    const blockers = [];
    if (!company.gst?.enabled) blockers.push('GST is not enabled for this company.');
    if (!seller.gstin) blockers.push('Seller GSTIN is missing.');
    if (!document.partyGstin) blockers.push('Buyer GSTIN is missing, so this is a B2C invoice.');
    blockers.push(...partyIssues('Seller', seller));
    if (document.partyGstin) blockers.push(...partyIssues('Buyer', buyer));
    if (!document.placeOfSupply) blockers.push('Place of supply is missing.');
    const warnings = [];
    if (!lines.length) warnings.push('No stock lines; a single service line is assumed.');
    if (lines.some((line) => !line.hsn)) warnings.push('HSN / SAC is missing on one or more lines.');
    if (lines.some((line) => line.unit === 'OTH')) warnings.push('A stock unit has no UQC mapping; OTH is used.');
    if (seller.gstin && !gstinChecksumValid(seller.gstin)) warnings.push('Seller GSTIN checksum does not match.');
    if (document.partyGstin && !gstinChecksumValid(document.partyGstin)) warnings.push('Buyer GSTIN checksum does not match.');
    if (document.partyGstin && document.placeOfSupply && document.partyGstin.slice(0, 2) !== document.placeOfSupply) {
      warnings.push('Buyer GSTIN state does not match the place of supply.');
    }
    return {
      ...document,
      voucherId: document.id,
      eligible: Boolean(document.partyGstin && company.gst?.enabled),
      seller,
      buyer,
      lines,
      blockers,
      warnings,
      ready: Boolean(document.partyGstin && company.gst?.enabled) && blockers.length === 0,
      payload: voucher && document.partyGstin
        ? eInvoicePayload(company, document, voucher, seller, buyer, lines)
        : null,
    };
  });
  const eligible = rows.filter((row) => row.eligible);
  return {
    from,
    to,
    seller,
    rows,
    count: rows.length,
    eligibleCount: eligible.length,
    readyCount: eligible.filter((row) => row.ready).length,
    blockedCount: eligible.filter((row) => !row.ready).length,
    b2cCount: rows.length - eligible.length,
    total: round2(rows.reduce((sum, row) => sum + row.total, 0)),
    eligibleValue: round2(eligible.reduce((sum, row) => sum + row.total, 0)),
    note: EINVOICE_TURNOVER_NOTE,
  };
}

function ewayPayload(company, document, voucher, seller, buyer, lines, partB = null) {
  const items = lines.map((line, index) => ({
    itemNo: index + 1,
    productName: line.description,
    productDesc: line.description,
    hsnCode: line.hsn,
    quantity: Number(line.qty) || 0,
    qtyUnit: line.unit,
    cgstRate: document.supplyType === 'Intra' ? (Number(document.rate) || 0) / 2 : 0,
    sgstRate: document.supplyType === 'Intra' ? (Number(document.rate) || 0) / 2 : 0,
    igstRate: document.supplyType === 'Inter' ? Number(document.rate) || 0 : 0,
    cessRate: Number(document.cessRate) || 0,
    taxableAmount: round2(line.taxable),
  }));

  return {
    Version: '1.0.0620',
    BillLists: [
      {
        userGstin: seller.gstin,
        supplyType: 'O',
        subSupplyType: 1,
        docType: 'INV',
        docNo: String(document.ref || document.no),
        docDate: gstDate(document.date),
        fromGstin: seller.gstin,
        fromTrdName: seller.tradeName,
        fromAddr1: seller.address,
        fromAddr2: '',
        fromPlace: seller.city,
        fromPincode: Number(seller.pin) || 0,
        fromStateCode: Number(seller.stateCode) || 0,
        toGstin: buyer.gstin || 'URP',
        toTrdName: buyer.tradeName,
        toAddr1: buyer.address,
        toAddr2: '',
        toPlace: buyer.city,
        toPincode: Number(buyer.pin) || 0,
        toStateCode: Number(buyer.stateCode) || 0,
        transDistance: partB?.distance ? String(partB.distance) : '',
        transporterName: partB?.transporterName ?? '',
        transporterId: partB?.transporterId ?? '',
        vehicleNo: partB?.vehicleNo ?? '',
        totalValue: document.total,
        cgstValue: document.cgst,
        sgstValue: document.sgst,
        igstValue: document.igst,
        cessValue: document.cess,
        totNonAdvolVal: 0,
        itemList: items,
      },
    ],
  };
}

/** E-way bill working papers, with Part A and any saved Part B details. */
export function ewayBillRegister(company, filters = {}) {
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const threshold = Number(filters.threshold) > 0 ? round2(filters.threshold) : EWAY_BILL_THRESHOLD;
  const returns = gstReturns(company, { from, to });
  const seller = sellerProfile(company);
  const rows = returns.documents
    .filter((document) => document.type === 'Sales' && document.total >= threshold)
    .map((document) => {
      const voucher = (company.vouchers ?? []).find((entry) => entry.id === document.id);
      const buyer = buyerProfile(company, voucher, document);
      const lines = voucher ? eInvoiceLineRows(company, voucher, document) : [];
      const partB = company.ewayPartB?.[document.id] ?? null;
      const partBReady = Boolean(
        partB?.transporterName && partB?.distance > 0 && (partB?.vehicleNo || partB?.transporterId),
      );
      const warnings = [];
      if (!partBReady) {
        warnings.push(
          partB
            ? 'Part B is incomplete: add transporter name, distance and either a vehicle number or transporter ID.'
            : 'Part B (transporter, vehicle and distance) is not captured; add it here or in the portal.',
        );
      }
      if (!seller.address || !seller.city || !seller.pin) warnings.push('Seller address or PIN is incomplete.');
      if (!buyer.address || !buyer.city || !buyer.pin) warnings.push('Buyer address or PIN is incomplete.');
      if (lines.some((line) => !line.hsn)) warnings.push('HSN / SAC is missing on one or more lines.');
      return {
        ...document,
        voucherId: document.id,
        seller,
        buyer,
        lines,
        threshold,
        warnings,
        partB,
        partBReady,
        ready: Boolean(
          seller.gstin && seller.address && seller.city && seller.pin &&
            buyer.address && buyer.city && buyer.pin && buyer.stateCode,
        ),
        payload: voucher
          ? ewayPayload(company, document, voucher, seller, buyer, lines, partB)
          : null,
      };
    });
  return {
    from,
    to,
    threshold,
    seller,
    rows,
    count: rows.length,
    value: round2(rows.reduce((sum, row) => sum + row.total, 0)),
    note: 'Invoices below the threshold are excluded. Part A is derived from the invoice; saved Part B details are working data, not a portal submission.',
  };
}

const TAX_AUDIT_CLAUSES = [
  ['9', 'Nature of business', 'Describe the business and principal products or services.'],
  ['11', 'Books of account', 'Presumptive taxation, books maintained and audit trail.'],
  ['13', 'Method of accounting', 'Mercantile or cash, and any change during the year.'],
  ['20(b)', 'GST input tax credit', 'Reconcile ITC claimed with books and GSTR-3B.'],
  ['21', 'Amounts not credited to profit', 'List amounts credited outside the profit and loss account.'],
  ['22', 'MSME dues', 'Outstanding dues to micro and small enterprises beyond the limit.'],
  ['26', 'Section 43B payments', 'Payments claimed on actual payment basis.'],
  ['31', 'Loans, deposits and advances', 'Details of loans, deposits and advances requiring disclosure.'],
  ['34', 'TDS / TCS compliance', 'Deducted, collected, paid and outstanding tax.'],
  ['44', 'Expenditure details', 'Break-up of expenses requiring clause 44 disclosure.'],
];

/**
 * Tax-audit working papers: turnover, GST liability and ITC reconciliations,
 * TDS/TCS position, and a Form 3CD-style clause checklist. Informational only.
 */
export function taxAuditSummary(company, filters = {}) {
  const from = filters.from || company.fyStart;
  const to = filters.to || company.fyEnd;
  const gst = gstReturns(company, { from, to });
  const totals = ledgerTotals(company, { from, to });
  const ledgerRows = company.ledgers.map((ledger) => ({
    ledger,
    total: totals.get(ledger.id),
  }));
  const periodNet = (ledger) => {
    const total = totals.get(ledger.id);
    return total ? round2(total.periodCredit - total.periodDebit) : 0;
  };

  const salesRows = ledgerRows
    .filter(({ ledger }) => inGroupKey(company, ledger, 'sales'))
    .map(({ ledger, total }) => ({
      ledgerId: ledger.id,
      name: ledger.name,
      amount: round2((total?.periodCredit ?? 0) - (total?.periodDebit ?? 0)),
    }))
    .filter((row) => Math.abs(row.amount) >= EPSILON);
  const booksTurnover = round2(salesRows.reduce((sum, row) => sum + row.amount, 0));
  const otherIncomeRows = ledgerRows
    .filter(({ ledger }) => inGroupKey(company, ledger, 'directIncomes'))
    .map(({ ledger, total }) => ({
      ledgerId: ledger.id,
      name: ledger.name,
      amount: round2((total?.periodCredit ?? 0) - (total?.periodDebit ?? 0)),
    }))
    .filter((row) => Math.abs(row.amount) >= EPSILON);

  const taxRows = company.ledgers
    .filter((ledger) => ledger.gstRole)
    .map((ledger) => ({
      role: ledger.gstRole,
      name: ledger.name,
      amount: periodNet(ledger),
    }));
  const outputTaxBooks = round2(
    taxRows.reduce((sum, row) => sum + Math.max(0, row.amount), 0),
  );
  const itcBooks = round2(
    taxRows.reduce((sum, row) => sum + Math.max(0, -row.amount), 0),
  );
  const outputTaxReturns = gst.gstr3b.liabilityTotal;
  const itcReturns = gst.gstr3b.itcTotal;
  const difference = (books, returns) => round2(books - returns);

  const tds = withholdingSummary(company, { kind: 'TDS', from, to });
  const tcs = withholdingSummary(company, { kind: 'TCS', from, to });
  const voucherCount = (company.vouchers ?? []).filter(
    (voucher) => voucher.date >= from && voucher.date <= to,
  ).length;

  const statusFor = (amount) => (Math.abs(amount) < 1 ? 'Ready' : 'Review');
  const clauses = TAX_AUDIT_CLAUSES.map(([clause, title, description]) => {
    if (clause === '20(b)') {
      return {
        clause,
        title,
        description,
        status: statusFor(difference(itcBooks, itcReturns)),
        evidence: `Books ${round2(itcBooks)} vs GSTR-3B ${round2(itcReturns)}`,
      };
    }
    if (clause === '34') {
      const outstanding = round2(tds.outstanding + tcs.outstanding);
      return {
        clause,
        title,
        description,
        status: Math.abs(outstanding) < EPSILON ? 'Ready' : 'Review',
        evidence: `TDS outstanding ${tds.outstanding}, TCS outstanding ${tcs.outstanding}`,
      };
    }
    if (clause === '11') {
      return {
        clause,
        title,
        description,
        status: voucherCount ? 'Review' : 'Ready',
        evidence: `${voucherCount} voucher${voucherCount === 1 ? '' : 's'} in the period; audit trail is maintained`,
      };
    }
    if (clause === '13') {
      return { clause, title, description, status: 'Ready', evidence: 'Mercantile method assumed from voucher posting' };
    }
    if (clause === '9') {
      return {
        clause,
        title,
        description,
        status: company.gst?.legalName ? 'Review' : 'Manual',
        evidence: company.gst?.legalName || 'Registered legal name is not set',
      };
    }
    return { clause, title, description, status: 'Manual', evidence: 'Requires documents outside this app' };
  });

  return {
    from,
    to,
    enabled: Boolean(company.gst?.enabled),
    turnover: {
      books: booksTurnover,
      salesRows,
      otherIncome: round2(otherIncomeRows.reduce((sum, row) => sum + row.amount, 0)),
      otherIncomeRows,
      gstTaxable: gst.outward.taxable,
      gstGross: gst.totals.gross,
      difference: difference(booksTurnover, gst.outward.taxable),
      threshold: 10000000,
      highThreshold: 100000000,
      status: booksTurnover > 100000000 ? 'Review high threshold' : booksTurnover > 10000000 ? 'Review' : 'Below ₹1 crore',
    },
    outputTax: {
      books: outputTaxBooks,
      returns: outputTaxReturns,
      difference: difference(outputTaxBooks, outputTaxReturns),
      rows: taxRows,
    },
    itc: {
      books: itcBooks,
      returns: itcReturns,
      difference: difference(itcBooks, itcReturns),
    },
    taxPosition: {
      tds: { deducted: tds.periodAmount, paid: tds.challanTotal, outstanding: tds.outstanding },
      tcs: { collected: tcs.periodAmount, paid: tcs.challanTotal, outstanding: tcs.outstanding },
    },
    clauses,
    clauseSummary: {
      ready: clauses.filter((clause) => clause.status === 'Ready').length,
      review: clauses.filter((clause) => clause.status === 'Review').length,
      manual: clauses.filter((clause) => clause.status === 'Manual').length,
    },
    note: 'Informational working papers only. Form 3CD, audit applicability and disclosures must be completed by a chartered accountant.',
  };
}

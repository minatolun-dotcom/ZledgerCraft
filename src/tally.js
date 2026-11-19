// Tally XML import helpers. Parses common All Masters and voucher exports
// without adding an XML dependency, then applies the data all-or-nothing.
import {
  INVENTORY_TYPES,
  addGroup,
  addLedger,
  addStockGroup,
  addStockItem,
  addVoucher,
  defaultGodownId,
  isValidIsoDate,
  parseAmount,
  parseQty,
  round2,
} from './store.js';

const MAX_TALLY_CHARS = 20 * 1024 * 1024;

const VOUCHER_ALIASES = {
  sales: 'Sales',
  purchase: 'Purchase',
  payment: 'Payment',
  receipt: 'Receipt',
  contra: 'Contra',
  journal: 'Journal',
  creditnote: 'CreditNote',
  debitnote: 'DebitNote',
};

function xmlCodePoint(value, radix) {
  const code = parseInt(value, radix);
  if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return '\uFFFD';
  if (code >= 0xd800 && code <= 0xdfff) return '\uFFFD';
  return String.fromCodePoint(code);
}

function decodeXml(value) {
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => xmlCodePoint(hex, 16))
    .replace(/&#([0-9]+);/g, (_, code) => xmlCodePoint(code, 10))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function cleanXmlText(value) {
  return decodeXml(
    String(value ?? '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]*>/g, ''),
  ).trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tagText(xml, name) {
  const tag = escapeRegExp(name);
  const match = String(xml ?? '').match(
    new RegExp(`<\\s*${tag}\\b[^>]*>([\\s\\S]*?)<\\s*/\\s*${tag}\\s*>`, 'i'),
  );
  return match ? cleanXmlText(match[1]) : '';
}

function attrValue(attrs, name) {
  const tag = escapeRegExp(name);
  const match = String(attrs ?? '').match(
    new RegExp(`\\b${tag}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'),
  );
  return match ? decodeXml(match[1] ?? match[2] ?? '').trim() : '';
}

function isoFromTallyDate(raw) {
  const text = String(raw ?? '').trim();
  let iso = text;
  if (/^\d{8}$/.test(text)) iso = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  else {
    const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return isValidIsoDate(iso) ? iso : null;
}

function normaliseVoucherType(raw) {
  const key = String(raw ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return VOUCHER_ALIASES[key] ?? null;
}

/** Tally quantities and rates can carry a unit suffix, e.g. "10 Nos" or "100/Nos". */
function tallyNumber(raw, parser) {
  const text = cleanXmlText(raw).replace(/,/g, '');
  const match = text.match(/^-?\d+(?:\.\d+)?/);
  return match ? parser(match[0]) : null;
}

/**
 * Resolves parsed Tally inventory rows against a company. Stock enrichment is
 * optional: an error means the voucher should keep its accounting lines only.
 */
function resolveInventory(target, voucher) {
  if (voucher.inventoryError) return { error: voucher.inventoryError };
  if (!voucher.inventory?.length) return { items: [] };
  if (!INVENTORY_TYPES.includes(voucher.type)) {
    return { error: `Stock lines are not supported on ${voucher.type} vouchers.` };
  }
  const items = [];
  let total = 0;
  for (const line of voucher.inventory) {
    const item = (target.stockItems ?? []).find(
      (entry) => entry.name.trim().toLowerCase() === line.itemName.trim().toLowerCase(),
    );
    if (!item) return { error: `Stock item "${line.itemName}" does not exist here.` };
    const godown = line.godownName
      ? (target.godowns ?? []).find(
          (entry) => entry.name.trim().toLowerCase() === line.godownName.trim().toLowerCase(),
        )
      : (target.godowns ?? []).find((entry) => entry.id === defaultGodownId(target));
    if (!godown) {
      return {
        error: line.godownName
          ? `Godown "${line.godownName}" does not exist here.`
          : 'This company has no godown for the stock line.',
      };
    }
    const batchNo = item.batchTracking ? String(line.batchNo ?? '').trim() : '';
    if (item.batchTracking && !batchNo) {
      return { error: `Batch is required for stock item "${item.name}".` };
    }
    const expiryDate = item.batchTracking ? String(line.expiryDate ?? '').trim() : '';
    if (expiryDate && !isValidIsoDate(expiryDate)) {
      return { error: `Expiry date for stock item "${item.name}" is invalid.` };
    }
    const amount = round2(line.qty * line.rate);
    total = round2(total + amount);
    items.push({
      stockItemId: item.id,
      qty: line.qty,
      rate: line.rate,
      godownId: godown.id,
      ...(batchNo ? { batchNo } : {}),
      ...(expiryDate ? { expiryDate } : {}),
    });
  }
  const voucherTotal = round2(
    (voucher.lines ?? voucher.entries ?? [])
      .filter((line) => line.side === 'Dr')
      .reduce((sum, line) => sum + line.amount, 0),
  );
  if (Math.abs(total - voucherTotal) >= 0.01) {
    return {
      error: `Stock lines total ${total.toFixed(2)} but the voucher is ${voucherTotal.toFixed(2)}; use the voucher screen for this GST or discount split.`,
    };
  }
  return { items };
}

/**
 * Parses the subset of Tally XML used by All Masters and voucher exports.
 * It returns raw ledgers and vouchers; company validation happens in
 * importTallyXml so a bad row can never leave a half-applied import.
 */
export function parseTallyXml(xml) {
  const text = String(xml ?? '').trim();
  if (!text) return { ok: false, error: 'Paste or choose a Tally XML export.' };
  if (text.length > MAX_TALLY_CHARS) {
    return { ok: false, error: 'The Tally XML is larger than the 20 MB import limit.' };
  }
  if (!/<[A-Za-z][^>]*>/.test(text)) return { ok: false, error: 'That does not look like Tally XML.' };

  const groups = [];
  for (const match of text.matchAll(/<GROUP\b([^>]*?)(?:\/>|>([\s\S]*?)<\/GROUP\s*>)/gi)) {
    const body = match[2] ?? '';
    const name = attrValue(match[1], 'NAME') || tagText(body, 'NAME');
    if (!name) return { ok: false, error: 'A Tally account group is missing its NAME attribute.' };
    groups.push({ name, parent: tagText(body, 'PARENT') });
  }

  const stockGroups = [];
  for (const match of text.matchAll(/<STOCKGROUP\b([^>]*)>([\s\S]*?)<\/STOCKGROUP\s*>/gi)) {
    const name = attrValue(match[1], 'NAME') || tagText(match[2], 'NAME');
    if (!name) return { ok: false, error: 'A Tally stock group is missing its NAME attribute.' };
    stockGroups.push({ name, parent: tagText(match[2], 'PARENT') });
  }

  const stockItems = [];
  for (const match of text.matchAll(/<STOCKITEM\b([^>]*)>([\s\S]*?)<\/STOCKITEM\s*>/gi)) {
    const body = match[2];
    const name = attrValue(match[1], 'NAME') || tagText(body, 'NAME');
    if (!name) return { ok: false, error: 'A Tally stock item is missing its NAME attribute.' };
    const parent = tagText(body, 'PARENT');
    if (!parent) return { ok: false, error: `Tally stock item "${name}" is missing its stock group.` };
    const unitName = tagText(body, 'BASEUNITS');
    if (!unitName) return { ok: false, error: `Tally stock item "${name}" is missing its base unit.` };
    const openingRaw = tagText(body, 'OPENINGBALANCE').replace(/,/g, '');
    const openingQty = openingRaw ? parseQty(openingRaw) : 0;
    if (openingQty === null || openingQty < 0) {
      return { ok: false, error: `Tally stock item "${name}" has an invalid opening quantity.` };
    }
    const rateRaw = tagText(body, 'OPENINGRATE').replace(/,/g, '');
    let openingRate = rateRaw ? parseAmount(rateRaw) : 0;
    if (openingRate === null || openingRate < 0) {
      return { ok: false, error: `Tally stock item "${name}" has an invalid opening rate.` };
    }
    if (!rateRaw && openingQty > 0) {
      const valueRaw = tagText(body, 'OPENINGVALUE').replace(/,/g, '');
      const openingValue = valueRaw ? parseAmount(valueRaw) : null;
      if (openingValue !== null && openingValue >= 0) openingRate = round2(openingValue / openingQty);
    }
    stockItems.push({
      name,
      parent,
      unitName,
      openingQty,
      openingRate,
      hsn: tagText(body, 'HSNCODE') || tagText(body, 'HSN'),
    });
  }

  const ledgers = [];
  for (const match of text.matchAll(/<LEDGER\b([^>]*)>([\s\S]*?)<\/LEDGER\s*>/gi)) {
    const attrs = match[1];
    const body = match[2];
    const name = attrValue(attrs, 'NAME') || tagText(body, 'NAME');
    if (!name) return { ok: false, error: 'A Tally ledger is missing its NAME attribute.' };
    const parent = tagText(body, 'PARENT');
    if (!parent) return { ok: false, error: `Tally ledger "${name}" is missing its PARENT group.` };
    const openingRaw = tagText(body, 'OPENINGBALANCE').replace(/,/g, '');
    const openingAmount = openingRaw ? parseAmount(openingRaw) : 0;
    if (openingAmount === null) {
      return { ok: false, error: `Tally ledger "${name}" has an invalid opening balance.` };
    }
    const deemed = tagText(body, 'ISDEEMEDPOSITIVE').toLowerCase();
    const openingType = deemed === 'no' || (!deemed && openingAmount < 0) ? 'Cr' : 'Dr';
    ledgers.push({
      name,
      parent,
      opening: Math.abs(openingAmount),
      openingType,
      gstin: tagText(body, 'PARTYGSTIN') || tagText(body, 'GSTIN'),
      pan: tagText(body, 'INCOMETAXNUMBER'),
    });
  }

  const vouchers = [];
  for (const match of text.matchAll(/<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER\s*>/gi)) {
    const attrs = match[1];
    const body = match[2];
    const rawType = attrValue(attrs, 'VCHTYPE') || tagText(body, 'VOUCHERTYPENAME');
    const type = normaliseVoucherType(rawType);
    if (!type) {
      return { ok: false, error: `Unsupported Tally voucher type "${rawType || 'unknown'}".` };
    }
    const date = isoFromTallyDate(tagText(body, 'DATE'));
    if (!date) return { ok: false, error: `Tally ${type} voucher has an invalid or missing date.` };
    const narration = tagText(body, 'NARRATION');
    const lines = [];
    for (const entry of body.matchAll(
      /<(?:ALL)?LEDGERENTRIES\.LIST\b[^>]*>([\s\S]*?)<\/(?:ALL)?LEDGERENTRIES\.LIST>/gi,
    )) {
      const entryBody = entry[1];
      const ledgerName = tagText(entryBody, 'LEDGERNAME');
      if (!ledgerName) return { ok: false, error: `Tally ${type} voucher has an entry without a ledger.` };
      const amountRaw = tagText(entryBody, 'AMOUNT').replace(/,/g, '');
      const amount = parseAmount(amountRaw);
      if (amount === null || amount === 0) {
        return { ok: false, error: `Tally ${type} voucher has an invalid amount for "${ledgerName}".` };
      }
      const deemed = tagText(entryBody, 'ISDEEMEDPOSITIVE').toLowerCase();
      const side = deemed === 'yes' ? 'Dr' : deemed === 'no' ? 'Cr' : amount < 0 ? 'Cr' : 'Dr';
      lines.push({ ledgerName, side, amount: Math.abs(amount) });
    }
    if (lines.length < 2) {
      return { ok: false, error: `Tally ${type} voucher dated ${date} needs at least two ledger entries.` };
    }

    const inventory = [];
    let inventoryError = '';
    entries: for (const entry of body.matchAll(
      /<INVENTORYENTRIES\.LIST\b[^>]*>([\s\S]*?)<\/INVENTORYENTRIES\.LIST>/gi,
    )) {
      const entryBody = entry[1];
      const itemName = tagText(entryBody, 'STOCKITEMNAME');
      if (!itemName) {
        inventoryError = `Tally ${type} voucher dated ${date} has an inventory line without a stock item.`;
        break;
      }
      const qty =
        tallyNumber(tagText(entryBody, 'ACTUALQTY'), parseQty) ??
        tallyNumber(tagText(entryBody, 'BILLEDQTY'), parseQty);
      if (qty === null || qty === 0) {
        inventoryError = `Tally stock item "${itemName}" has an invalid quantity.`;
        break;
      }
      let rate = tallyNumber(tagText(entryBody, 'RATE'), parseAmount);
      const amount = tallyNumber(tagText(entryBody, 'AMOUNT'), parseAmount);
      if (rate === null && amount !== null && qty !== 0) {
        rate = round2(Math.abs(amount) / Math.abs(qty));
      }
      if (rate === null || rate < 0) {
        inventoryError = `Tally stock item "${itemName}" has an invalid rate.`;
        break;
      }
      const entryQty = Math.abs(qty);
      const godownName = tagText(entryBody, 'GODOWNNAME');
      const batches = [
        ...entryBody.matchAll(/<BATCHALLOCATIONS\.LIST\b[^>]*>([\s\S]*?)<\/BATCHALLOCATIONS\.LIST>/gi),
      ];
      if (batches.length) {
        for (const batch of batches) {
          const batchQty = Math.abs(tallyNumber(tagText(batch[1], 'ACTUALQTY'), parseQty) ?? 0);
          if (!batchQty) {
            inventoryError = `Tally stock item "${itemName}" has a batch without a quantity.`;
            break entries;
          }
          const expiryRaw = tagText(batch[1], 'EXPIRYDATE');
          const expiryDate = expiryRaw ? isoFromTallyDate(expiryRaw) : '';
          if (expiryRaw && !expiryDate) {
            inventoryError = `Tally stock item "${itemName}" has an invalid batch expiry date.`;
            break entries;
          }
          inventory.push({
            itemName,
            qty: batchQty,
            rate,
            godownName: tagText(batch[1], 'GODOWNNAME') || godownName,
            batchNo: tagText(batch[1], 'BATCHNAME'),
            expiryDate,
          });
        }
      } else {
        inventory.push({ itemName, qty: entryQty, rate, godownName, batchNo: '', expiryDate: '' });
      }
    }

    vouchers.push({ type, date, narration, lines, inventory, inventoryError });
  }

  if (!groups.length && !ledgers.length && !vouchers.length && !stockGroups.length && !stockItems.length) {
    return {
      ok: false,
      error: 'No Tally account groups, ledgers, stock masters or vouchers were found. Export All Masters or vouchers as XML.',
    };
  }
  return { ok: true, groups, ledgers, vouchers, stockGroups, stockItems };
}

/**
 * Validates and applies a Tally XML import to a company clone first. The live
 * company is changed only after every ledger and voucher passes validation.
 */
export function importTallyXml(company, xml) {
  if (!company) return { ok: false, error: 'Open a company first.' };
  const parsed = parseTallyXml(xml);
  if (!parsed.ok) return parsed;

  const clone = JSON.parse(JSON.stringify(company));
  const groupPayloads = [];
  const existingGroupNames = new Set(
    (clone.groups ?? []).map((group) => group.name.trim().toLowerCase()),
  );
  const pendingGroups = parsed.groups.slice();
  while (pendingGroups.length) {
    let progress = false;
    for (let index = 0; index < pendingGroups.length; ) {
      const group = pendingGroups[index];
      const key = group.name.trim().toLowerCase();
      if (existingGroupNames.has(key)) {
        pendingGroups.splice(index, 1);
        progress = true;
        continue;
      }
      const parentKey = group.parent.trim().toLowerCase();
      if (!parentKey) {
        return {
          ok: false,
          error: `Tally group "${group.name}" has no PARENT; top-level groups must already exist here.`,
        };
      }
      if (!existingGroupNames.has(parentKey)) {
        index += 1;
        continue;
      }
      const parent = (clone.groups ?? []).find(
        (entry) => entry.name.trim().toLowerCase() === parentKey,
      );
      const result = addGroup(clone, { name: group.name, parentId: parent?.id });
      if (!result.ok) return { ok: false, error: `Tally group "${group.name}": ${result.error}` };
      existingGroupNames.add(key);
      groupPayloads.push({ name: group.name, parentName: parent.name });
      pendingGroups.splice(index, 1);
      progress = true;
    }
    if (!progress) {
      const group = pendingGroups[0];
      return {
        ok: false,
        error: `Tally group "${group.name}" uses parent "${group.parent}", which does not exist here.`,
      };
    }
  }

  const stockGroupNames = [];
  for (const group of parsed.stockGroups) {
    const existing = (clone.stockGroups ?? []).find(
      (entry) => entry.name.trim().toLowerCase() === group.name.trim().toLowerCase(),
    );
    if (existing) continue;
    const result = addStockGroup(clone, { name: group.name });
    if (!result.ok) return { ok: false, error: `Tally stock group "${group.name}": ${result.error}` };
    stockGroupNames.push(group.name);
  }

  const stockItemPayloads = [];
  for (const item of parsed.stockItems) {
    const group = (clone.stockGroups ?? []).find(
      (entry) => entry.name.trim().toLowerCase() === item.parent.trim().toLowerCase(),
    );
    if (!group) {
      return {
        ok: false,
        error: `Tally stock item "${item.name}" uses stock group "${item.parent}", which does not exist here.`,
      };
    }
    const unit = (clone.units ?? []).find(
      (entry) =>
        entry.name.trim().toLowerCase() === item.unitName.trim().toLowerCase() ||
        entry.symbol.trim().toLowerCase() === item.unitName.trim().toLowerCase(),
    );
    if (!unit) {
      return {
        ok: false,
        error: `Tally stock item "${item.name}" uses unit "${item.unitName}", which does not exist here.`,
      };
    }
    const result = addStockItem(clone, {
      name: item.name,
      stockGroupId: group.id,
      unitId: unit.id,
      openingQty: item.openingQty,
      openingRate: item.openingRate,
      hsn: item.hsn,
    });
    if (!result.ok) return { ok: false, error: `Tally stock item "${item.name}": ${result.error}` };
    stockItemPayloads.push(item);
  }

  const ledgerPayloads = [];
  for (const ledger of parsed.ledgers) {
    const group = (clone.groups ?? []).find(
      (entry) => entry.name.trim().toLowerCase() === ledger.parent.trim().toLowerCase(),
    );
    if (!group) {
      return {
        ok: false,
        error: `Tally ledger "${ledger.name}" uses group "${ledger.parent}", which does not exist here.`,
      };
    }
    const payload = {
      name: ledger.name,
      groupName: ledger.parent,
      opening: ledger.opening,
      openingType: ledger.openingType,
      ...(ledger.gstin ? { gstin: ledger.gstin } : {}),
      ...(ledger.pan ? { pan: ledger.pan } : {}),
    };
    const result = addLedger(clone, { ...payload, groupId: group.id });
    if (!result.ok) return { ok: false, error: `Tally ledger "${ledger.name}": ${result.error}` };
    ledgerPayloads.push(payload);
  }

  const resolveLines = (target, voucher) => {
    const lines = [];
    for (const line of voucher.lines ?? voucher.entries ?? []) {
      const ledger = (target.ledgers ?? []).find(
        (entry) => entry.name.trim().toLowerCase() === line.ledgerName.trim().toLowerCase(),
      );
      if (!ledger) {
        return {
          error: `Tally ${voucher.type} voucher dated ${voucher.date} uses missing ledger "${line.ledgerName}".`,
        };
      }
      lines.push({ ledgerId: ledger.id, side: line.side, amount: line.amount });
    }
    return { lines };
  };

  const voucherPayloads = [];
  const stockWarnings = [];
  let stockLines = 0;
  let stockLinesSkipped = 0;
  for (const voucher of parsed.vouchers) {
    const resolved = resolveLines(clone, voucher);
    if (resolved.error) return { ok: false, error: resolved.error };
    const stock = resolveInventory(clone, voucher);
    let items = stock.items ?? [];
    if (stock.error) {
      stockLinesSkipped += voucher.inventory?.length || 1;
      if (!stockWarnings.includes(stock.error)) stockWarnings.push(stock.error);
      items = [];
    }
    const payload = {
      type: voucher.type,
      date: voucher.date,
      narration: voucher.narration,
      entries: voucher.lines,
      inventory: voucher.inventory,
      inventoryError: voucher.inventoryError,
      ...(stock.error ? { stockSkipped: true } : {}),
    };
    let result = addVoucher(clone, { ...payload, lines: resolved.lines, items });
    if (!result.ok && items.length) {
      // Keep the accounting voucher when stock detail cannot be applied, as in
      // the pre-stock importer, but report every skipped stock line.
      if (!stockWarnings.includes(result.error)) stockWarnings.push(result.error);
      stockLinesSkipped += items.length;
      items = [];
      payload.stockSkipped = true;
      result = addVoucher(clone, { ...payload, lines: resolved.lines });
    }
    if (!result.ok) {
      return { ok: false, error: `Tally ${voucher.type} voucher dated ${voucher.date}: ${result.error}` };
    }
    if (items.length) stockLines += items.length;
    payload.items = items;
    voucherPayloads.push(payload);
  }

  for (const payload of groupPayloads) {
    const parent = (company.groups ?? []).find(
      (entry) => entry.name.trim().toLowerCase() === payload.parentName.trim().toLowerCase(),
    );
    const result = addGroup(company, { name: payload.name, parentId: parent?.id });
    if (!result.ok) return { ok: false, error: result.error };
  }
  for (const name of stockGroupNames) {
    const result = addStockGroup(company, { name });
    if (!result.ok) return { ok: false, error: result.error };
  }
  for (const item of stockItemPayloads) {
    const group = (company.stockGroups ?? []).find(
      (entry) => entry.name.trim().toLowerCase() === item.parent.trim().toLowerCase(),
    );
    const unit = (company.units ?? []).find(
      (entry) =>
        entry.name.trim().toLowerCase() === item.unitName.trim().toLowerCase() ||
        entry.symbol.trim().toLowerCase() === item.unitName.trim().toLowerCase(),
    );
    const result = addStockItem(company, {
      name: item.name,
      stockGroupId: group?.id,
      unitId: unit?.id,
      openingQty: item.openingQty,
      openingRate: item.openingRate,
      hsn: item.hsn,
    });
    if (!result.ok) return { ok: false, error: result.error };
  }
  for (const payload of ledgerPayloads) {
    const group = (company.groups ?? []).find(
      (entry) => entry.name.trim().toLowerCase() === payload.groupName.trim().toLowerCase(),
    );
    const result = addLedger(company, { ...payload, groupId: group?.id });
    if (!result.ok) return { ok: false, error: result.error };
  }
  for (const payload of voucherPayloads) {
    const resolved = resolveLines(company, payload);
    if (resolved.error) return { ok: false, error: resolved.error };
    const stock = payload.stockSkipped ? { items: [] } : resolveInventory(company, payload);
    if (stock.error) return { ok: false, error: stock.error };
    const result = addVoucher(company, {
      type: payload.type,
      date: payload.date,
      narration: payload.narration,
      lines: resolved.lines,
      items: stock.items,
    });
    if (!result.ok) {
      return { ok: false, error: `Tally ${payload.type} voucher dated ${payload.date}: ${result.error}` };
    }
  }
  return {
    ok: true,
    groups: groupPayloads.length,
    ledgers: ledgerPayloads.length,
    vouchers: voucherPayloads.length,
    stockGroups: stockGroupNames.length,
    stockItems: stockItemPayloads.length,
    stockLines,
    stockLinesSkipped,
    stockWarning: stockWarnings[0] ?? '',
  };
}

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addBom,
  addDeliveryNote,
  addGodown,
  addLedger,
  addManufacture,
  addOrder,
  addStockCount,
  addStockGroup,
  addStockItem,
  addStockTransfer,
  addUnit,
  addVoucher,
  convertQuotationToOrder,
  createCompany,
  deleteBom,
  deleteGodown,
  deleteManufacture,
  deleteOrder,
  deleteStockCount,
  deleteStockGroup,
  deleteStockItem,
  deleteStockTransfer,
  deleteUnit,
  deleteVoucher,
  defaultGodownId,
  emptyState,
  exportState,
  findLedgerByName,
  importState,
  orderRemainingItems,
  setOrderStatus,
  stockBatchesOnHand,
  stockOnHand,
  updateStockItem,
  updateVoucher,
} from '../src/store.js';
import {
  balanceSheet,
  batchStockSummary,
  expiringBatches,
  godownStockSummary,
  statistics,
  stockAgeing,
  stockMovements,
  stockSummary,
  trialBalance,
} from '../src/accounting.js';

function inventoryFixture() {
  const company = createCompany('Stock Traders', '2026-04-01').company;
  const unit = company.units.find((entry) => entry.symbol === 'Nos');
  const group = company.stockGroups[0];
  const item = addStockItem(company, {
    name: 'Cotton Shirt',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 10,
    openingRate: 100,
  }).item;
  const cash = findLedgerByName(company, 'Cash');
  const purchases = findLedgerByName(company, 'Purchases');
  const sales = findLedgerByName(company, 'Sales');

  const purchase = (date, qty, rate) => {
    const total = Math.round(qty * rate * 100) / 100;
    const result = addVoucher(company, {
      type: 'Purchase',
      date,
      lines: [
        { ledgerId: purchases.id, side: 'Dr', amount: total },
        { ledgerId: cash.id, side: 'Cr', amount: total },
      ],
      items: [{ stockItemId: item.id, qty, rate }],
    });
    assert.equal(result.ok, true, result.error);
    return result.voucher;
  };
  const sale = (date, qty, rate) => {
    const total = Math.round(qty * rate * 100) / 100;
    const result = addVoucher(company, {
      type: 'Sales',
      date,
      lines: [
        { ledgerId: cash.id, side: 'Dr', amount: total },
        { ledgerId: sales.id, side: 'Cr', amount: total },
      ],
      items: [{ stockItemId: item.id, qty, rate }],
    });
    assert.equal(result.ok, true, result.error);
    return result.voucher;
  };

  return { company, unit, group, item, cash, purchases, sales, purchase, sale };
}

test('a new company starts with units, a primary stock group and no items', () => {
  const company = createCompany('Fresh Co', '2026-04-01').company;
  assert.equal(company.units.length, 4);
  assert.deepEqual(
    company.units.map((unit) => unit.symbol),
    ['Nos', 'Kg', 'Ltr', 'Box'],
  );
  assert.equal(company.stockGroups.length, 1);
  assert.equal(company.stockGroups[0].name, 'Primary');
  assert.equal(company.stockGroups[0].primary, true);
  assert.deepEqual(company.stockItems, []);
});

test('units and stock groups validate, and deletes are guarded', () => {
  const { company, unit, group, item } = inventoryFixture();

  const duplicate = addUnit(company, { name: 'Numbers', symbol: 'Pcs' });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /already exists/);

  const dozen = addUnit(company, { name: 'Dozens', symbol: 'Dz' });
  assert.equal(dozen.ok, true);
  assert.equal(deleteUnit(company, dozen.unit.id).ok, true);

  const noSymbol = addUnit(company, { name: 'Metres', symbol: '  ' });
  assert.equal(noSymbol.ok, false);

  const usedUnit = deleteUnit(company, unit.id);
  assert.equal(usedUnit.ok, false);
  assert.match(usedUnit.error, /stock item/);

  const clothing = addStockGroup(company, { name: 'Clothing' });
  assert.equal(clothing.ok, true);
  const duplicateGroup = addStockGroup(company, { name: 'clothing' });
  assert.equal(duplicateGroup.ok, false);

  assert.equal(deleteStockGroup(company, group.id).ok, false);
  assert.match(deleteStockGroup(company, group.id).error, /primary/i);

  const newGroup = addStockGroup(company, { name: 'Accessories' }).group;
  assert.equal(deleteStockGroup(company, newGroup.id).ok, true);

  const clothingGroup = clothing.group;
  addStockItem(company, {
    name: 'Scarf',
    stockGroupId: clothingGroup.id,
    unitId: unit.id,
    openingQty: 1,
    openingRate: 50,
  });
  const usedGroup = deleteStockGroup(company, clothingGroup.id);
  assert.equal(usedGroup.ok, false);
  assert.match(usedGroup.error, /stock item/);
});

test('stock items validate their masters and can be altered', () => {
  const { company, unit, group, item } = inventoryFixture();

  const duplicate = addStockItem(company, {
    name: 'cotton shirt',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 1,
    openingRate: 1,
  });
  assert.equal(duplicate.ok, false);

  const noUnit = addStockItem(company, {
    name: 'Scarf',
    stockGroupId: group.id,
    unitId: 'missing',
    openingQty: 1,
    openingRate: 1,
  });
  assert.equal(noUnit.ok, false);
  assert.match(noUnit.error, /unit/i);

  const negative = addStockItem(company, {
    name: 'Scarf',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: -2,
    openingRate: 1,
  });
  assert.equal(negative.ok, false);

  const updated = updateStockItem(company, item.id, {
    name: 'Cotton Shirt XL',
    openingQty: 12,
    openingRate: 90,
  });
  assert.equal(updated.ok, true, updated.error);
  assert.equal(updated.item.name, 'Cotton Shirt XL');
  assert.equal(updated.item.openingQty, 12);
  assert.equal(updated.item.openingRate, 90);
  assert.equal(updated.item.unitId, unit.id);
});

test('reorder levels flag items at or below the level', () => {
  const { company, item } = inventoryFixture();
  assert.equal(stockSummary(company).rows[0].lowStock, false);

  const low = updateStockItem(company, item.id, { reorderLevel: 12 });
  assert.equal(low.ok, true, low.error);
  assert.equal(low.item.reorderLevel, 12);
  const report = stockSummary(company);
  assert.equal(report.rows[0].reorderLevel, 12);
  assert.equal(report.rows[0].closingQty, 10);
  assert.equal(report.rows[0].lowStock, true);

  const adequate = updateStockItem(company, item.id, { reorderLevel: 5 });
  assert.equal(adequate.ok, true, adequate.error);
  assert.equal(stockSummary(company).rows[0].lowStock, false);

  const cleared = updateStockItem(company, item.id, { reorderLevel: 0 });
  assert.equal(cleared.ok, true, cleared.error);
  assert.equal(cleared.item.reorderLevel, undefined);
  assert.equal(updateStockItem(company, item.id, { reorderLevel: -1 }).ok, false);
});

test('stock counts snapshot book quantities without moving stock', () => {
  const { company, item, purchase } = inventoryFixture();
  purchase('2026-04-02', 4, 100);
  const godownId = defaultGodownId(company);

  const count = addStockCount(company, {
    date: '2026-04-30',
    godownId,
    narration: 'Month end',
    rows: [{ stockItemId: item.id, countedQty: 12 }],
  });
  assert.equal(count.ok, true, count.error);
  assert.equal(count.count.no, 1);
  assert.equal(count.count.rows[0].systemQty, 14);
  assert.equal(count.count.rows[0].countedQty, 12);
  assert.equal(count.count.rows[0].difference, -2);
  assert.equal(stockOnHand(company, item.id, '2026-04-30', { godownId }), 14);
  assert.equal(stockSummary(company).rows[0].closingQty, 14);

  const warehouse = addGodown(company, { name: 'Warehouse' }).godown;
  const empty = addStockCount(company, {
    date: '2026-04-30',
    godownId: warehouse.id,
    rows: [{ stockItemId: item.id, countedQty: 2 }],
  });
  assert.equal(empty.ok, true, empty.error);
  assert.equal(empty.count.rows[0].systemQty, 0);
  assert.equal(empty.count.rows[0].difference, 2);

  assert.equal(
    addStockCount(company, { date: '2026-04-30', godownId, rows: [] }).ok,
    false,
  );
  assert.equal(
    addStockCount(company, { date: '2026-04-30', godownId, rows: [{ stockItemId: item.id, countedQty: -1 }] }).ok,
    false,
  );
  assert.equal(
    addStockCount(company, { date: '2026-04-30', godownId, rows: [{ stockItemId: 'missing', countedQty: 1 }] }).ok,
    false,
  );
  assert.equal(
    addStockCount(company, {
      date: '2026-04-30',
      godownId,
      rows: [
        { stockItemId: item.id, countedQty: 1 },
        { stockItemId: item.id, countedQty: 2 },
      ],
    }).ok,
    false,
  );

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  const restoredCounts = restored.state.companies[0].stockCounts;
  assert.equal(restoredCounts.length, 2);
  assert.equal(restoredCounts[0].rows[0].difference, -2);
  assert.equal(restoredCounts[0].narration, 'Month end');

  const removed = deleteStockCount(company, count.count.id);
  assert.equal(removed.ok, true, removed.error);
  assert.equal(company.stockCounts.length, 1);
});

test('stock counts split batch-tracked items lot by lot', () => {
  const company = createCompany('Batch Count Co', '2026-04-01').company;
  const unit = company.units.find((entry) => entry.symbol === 'Nos');
  const item = addStockItem(company, {
    name: 'Batch Syrup',
    stockGroupId: company.stockGroups[0].id,
    unitId: unit.id,
    openingRate: 40,
    batchTracking: true,
    openingBatches: [
      { batchNo: 'LOT-A', qty: 3 },
      { batchNo: 'LOT-B', qty: 2 },
    ],
  }).item;
  const godownId = defaultGodownId(company);
  const batches = stockBatchesOnHand(company, item.id, '2026-04-30', { godownId });
  assert.deepEqual(
    batches.map((batch) => [batch.batchNo, batch.qty]),
    [['LOT-A', 3], ['LOT-B', 2]],
  );

  const needsBatch = addStockCount(company, {
    date: '2026-04-30',
    godownId,
    rows: [{ stockItemId: item.id, countedQty: 1 }],
  });
  assert.equal(needsBatch.ok, false);
  assert.match(needsBatch.error, /batch or lot/);

  const count = addStockCount(company, {
    date: '2026-04-30',
    godownId,
    rows: [
      { stockItemId: item.id, batchNo: 'LOT-A', countedQty: 2 },
      { stockItemId: item.id, batchNo: 'LOT-B', countedQty: 2 },
      { stockItemId: item.id, batchNo: 'LOT-C', countedQty: 4 },
      { stockItemId: item.id, countedQty: 0 },
    ],
  });
  assert.equal(count.ok, true, count.error);
  assert.equal(count.count.rows.length, 3, 'the empty unlisted row is skipped');
  const lotA = count.count.rows.find((row) => row.batchNo === 'LOT-A');
  assert.equal(lotA.systemQty, 3);
  assert.equal(lotA.difference, -1);
  const lotC = count.count.rows.find((row) => row.batchNo === 'LOT-C');
  assert.equal(lotC.systemQty, 0);
  assert.equal(lotC.difference, 4);
  assert.equal(stockOnHand(company, item.id, '2026-04-30', { batchNo: 'LOT-A' }), 3);
  assert.equal(stockOnHand(company, item.id, '2026-04-30'), 5);

  const duplicate = addStockCount(company, {
    date: '2026-04-30',
    godownId,
    rows: [
      { stockItemId: item.id, batchNo: 'LOT-A', countedQty: 1 },
      { stockItemId: item.id, batchNo: 'LOT-A', countedQty: 2 },
    ],
  });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /batch LOT-A appears twice/);

  const state = emptyState();
  state.companies = [company];
  state.activeCompanyId = company.id;
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  const restoredCount = restored.state.companies[0].stockCounts[0];
  assert.equal(restoredCount.rows.find((row) => row.batchNo === 'LOT-A').difference, -1);
  assert.equal(restoredCount.rows.find((row) => row.batchNo === 'LOT-C').countedQty, 4);
});

test('voucher inventory lines must match the voucher total and the item masters', () => {
  const { company, item, cash, sales } = inventoryFixture();

  const mismatch = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-06',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 900 },
      { ledgerId: sales.id, side: 'Cr', amount: 900 },
    ],
    items: [{ stockItemId: item.id, qty: 5, rate: 100 }],
  });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.error, /must match/);

  const missingItem = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-06',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 500 },
      { ledgerId: sales.id, side: 'Cr', amount: 500 },
    ],
    items: [{ stockItemId: 'nope', qty: 5, rate: 100 }],
  });
  assert.equal(missingItem.ok, false);

  const journalWithItems = addVoucher(company, {
    type: 'Journal',
    date: '2026-04-06',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 500 },
      { ledgerId: sales.id, side: 'Cr', amount: 500 },
    ],
    items: [{ stockItemId: item.id, qty: 5, rate: 100 }],
  });
  assert.equal(journalWithItems.ok, false);
  assert.match(journalWithItems.error, /sales, purchase/i);

  const zeroQty = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-06',
    lines: [
      { ledgerId: findLedgerByName(company, 'Purchases').id, side: 'Dr', amount: 100 },
      { ledgerId: cash.id, side: 'Cr', amount: 100 },
    ],
    items: [{ stockItemId: item.id, qty: 0, rate: 100 }],
  });
  assert.equal(zeroQty.ok, false);
});

test('stock summary values purchases, sales and returns at average cost', () => {
  const { company, item, purchase, sale, cash, sales } = inventoryFixture();

  purchase('2026-04-02', 10, 110);
  sale('2026-04-05', 5, 150);

  const credit = addVoucher(company, {
    type: 'CreditNote',
    date: '2026-04-08',
    lines: [
      { ledgerId: sales.id, side: 'Dr', amount: 300 },
      { ledgerId: cash.id, side: 'Cr', amount: 300 },
    ],
    items: [{ stockItemId: item.id, qty: 2, rate: 150 }],
  });
  assert.equal(credit.ok, true, credit.error);

  const debit = addVoucher(company, {
    type: 'DebitNote',
    date: '2026-04-10',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 330 },
      { ledgerId: findLedgerByName(company, 'Purchases').id, side: 'Cr', amount: 330 },
    ],
    items: [{ stockItemId: item.id, qty: 3, rate: 110 }],
  });
  assert.equal(debit.ok, true, debit.error);

  const report = stockSummary(company);
  assert.equal(report.rows.length, 1);
  const [row] = report.rows;
  assert.equal(row.openingQty, 10);
  assert.equal(row.openingValue, 1000);
  assert.equal(row.inQty, 12);
  assert.equal(row.inValue, 1310);
  assert.equal(row.outQty, 8);
  assert.equal(row.outValue, 840);
  assert.equal(row.closingQty, 14);
  assert.equal(row.closingValue, 1470);
  assert.equal(row.averageRate, 105);
  assert.equal(report.totals.closingValue, 1470);
});

test('stock ageing buckets remaining stock by FIFO receipt date', () => {
  const { company, item, purchase, sale } = inventoryFixture();
  purchase('2026-04-20', 5, 100);
  sale('2026-05-10', 4, 150);
  const report = stockAgeing(company, { asOn: '2026-05-20' });
  const row = report.rows.find((entry) => entry.itemId === item.id);
  assert.equal(row.closingQty, 11);
  assert.equal(row.buckets['31-60'], 6, 'the remaining opening layer is 49 days old');
  assert.equal(row.buckets['0-30'], 5, 'the later purchase layer is 30 days old');
  assert.equal(row.oldestDate, '2026-04-01');
  assert.equal(report.totals.closingQty, 11);
  assert.equal(report.totals.buckets['31-60'], 6);
});

test('statistics summarises closing stock and items with no issues', () => {
  const { company, group, unit, purchase, sale } = inventoryFixture();
  purchase('2026-04-02', 10, 110);
  sale('2026-04-05', 5, 150);
  addStockItem(company, {
    name: 'Leather Belt',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 5,
    openingRate: 200,
  });

  const stats = statistics(company);
  assert.equal(stats.stock.closingValue, 2575);
  assert.equal(stats.stock.itemCount, 2);
  assert.equal(stats.stock.topItems[0].name, 'Cotton Shirt');
  assert.equal(stats.stock.topItems[0].closingValue, 1575);
  assert.equal(stats.stock.topItems[0].share, 61.17);
  assert.equal(stats.stock.idleCount, 1);
  assert.equal(stats.stock.idleValue, 1000);
  assert.equal(stats.stock.idleItems[0].name, 'Leather Belt');
});

test('stock summary and movements honour a date range', () => {
  const { company, item, purchase, sale } = inventoryFixture();
  purchase('2026-04-02', 10, 110);
  sale('2026-04-05', 5, 150);
  purchase('2026-05-02', 6, 120);

  const early = stockSummary(company, { to: '2026-04-03' });
  assert.equal(early.rows[0].closingQty, 20);
  assert.equal(early.rows[0].closingValue, 2100);
  assert.equal(early.rows[0].inQty, 10);

  const apr = stockSummary(company, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(apr.rows[0].closingQty, 15);
  assert.equal(apr.rows[0].outQty, 5);
  assert.equal(apr.rows[0].inQty, 10);

  const may = stockSummary(company, { from: '2026-05-01', to: '2026-05-31' });
  assert.equal(may.rows[0].openingQty, 15);
  assert.equal(may.rows[0].closingQty, 21);

  const movement = stockMovements(company, item.id);
  assert.equal(movement.openingQty, 10);
  assert.equal(movement.openingValue, 1000);
  assert.equal(movement.rows.length, 3);
  assert.deepEqual(
    movement.rows.map((row) => [row.type, row.balanceQty, row.balanceValue]),
    [
      ['Purchase', 20, 2100],
      ['Sales', 15, 1575],
      ['Purchase', 21, 2295],
    ],
  );
  assert.equal(movement.closingQty, 21);
  assert.equal(movement.closingValue, 2295);
});

test('altering a voucher replaces its stock lines and recomputes the summary', () => {
  const { company, item, purchase } = inventoryFixture();
  const voucher = purchase('2026-04-02', 10, 110);

  const changed = updateVoucher(company, voucher.id, {
    type: 'Purchase',
    date: '2026-04-02',
    lines: [
      { ledgerId: findLedgerByName(company, 'Purchases').id, side: 'Dr', amount: 1200 },
      { ledgerId: findLedgerByName(company, 'Cash').id, side: 'Cr', amount: 1200 },
    ],
    items: [{ stockItemId: item.id, qty: 10, rate: 120 }],
  });
  assert.equal(changed.ok, true, changed.error);
  assert.equal(changed.voucher.items[0].rate, 120);
  assert.equal(stockSummary(company).rows[0].closingValue, 2200);

  const noItems = updateVoucher(company, voucher.id, {
    type: 'Purchase',
    date: '2026-04-02',
    lines: [
      { ledgerId: findLedgerByName(company, 'Purchases').id, side: 'Dr', amount: 1200 },
      { ledgerId: findLedgerByName(company, 'Cash').id, side: 'Cr', amount: 1200 },
    ],
    items: [],
  });
  assert.equal(noItems.ok, true, noItems.error);
  assert.equal(noItems.voucher.items, undefined);
  assert.equal(stockSummary(company).rows[0].closingValue, 1000);
});

test('a stock item used in a voucher cannot be deleted', () => {
  const { company, item, purchase } = inventoryFixture();
  purchase('2026-04-02', 1, 100);
  const blocked = deleteStockItem(company, item.id);
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /voucher/);
  assert.equal(company.stockItems.length, 1);
});

test('inventory quantities do not disturb the financial statements', () => {
  const { company, purchase, sale } = inventoryFixture();
  purchase('2026-04-02', 10, 110);
  sale('2026-04-05', 5, 150);

  const trial = trialBalance(company);
  assert.equal(trial.balanced, true);
  const sheet = balanceSheet(company);
  assert.equal(sheet.balanced, true);
});

test('stock transfers move quantity between godowns and are guarded', () => {
  const { company, item } = inventoryFixture();
  const main = defaultGodownId(company);
  const warehouse = addGodown(company, { name: 'Warehouse' }).godown;
  assert.equal((company.godowns ?? []).length, 2);

  const transfer = addStockTransfer(company, {
    date: '2026-04-03',
    fromGodownId: main,
    toGodownId: warehouse.id,
    stockItemId: item.id,
    qty: 4,
    narration: 'Moved to warehouse',
  });
  assert.equal(transfer.ok, true, transfer.error);

  assert.equal(stockSummary(company).rows[0].closingQty, 10, 'total stock is unchanged');
  const byGodown = godownStockSummary(company);
  const mainRow = byGodown.rows.find((row) => row.godownId === main);
  const warehouseRow = byGodown.rows.find((row) => row.godownId === warehouse.id);
  assert.equal(mainRow.closingQty, 6);
  assert.equal(mainRow.outQty, 4);
  assert.equal(warehouseRow.closingQty, 4);
  assert.equal(warehouseRow.inQty, 4);
  assert.equal(byGodown.totals.closingQty, 10);

  const tooMuch = addStockTransfer(company, {
    date: '2026-04-04',
    fromGodownId: main,
    toGodownId: warehouse.id,
    stockItemId: item.id,
    qty: 99,
  });
  assert.equal(tooMuch.ok, false);
  assert.match(tooMuch.error, /Only 6/);

  assert.equal(deleteGodown(company, warehouse.id).ok, false);
  assert.match(deleteGodown(company, warehouse.id).error, /used/);
  assert.equal(deleteStockTransfer(company, transfer.transfer.id).ok, true);
  assert.equal(deleteGodown(company, warehouse.id).ok, true);
});

test('a transfer can carry several items and validates every line before writing', () => {
  const { company, item } = inventoryFixture();
  const main = defaultGodownId(company);
  const warehouse = addGodown(company, { name: 'Warehouse' }).godown;
  const unit = company.units.find((entry) => entry.symbol === 'Nos');
  const second = addStockItem(company, {
    name: 'Cotton Sock',
    stockGroupId: company.stockGroups[0].id,
    unitId: unit.id,
    openingQty: 6,
    openingRate: 40,
  }).item;

  const partial = addStockTransfer(company, {
    date: '2026-04-03',
    fromGodownId: main,
    toGodownId: warehouse.id,
    items: [
      { stockItemId: item.id, qty: 2 },
      { stockItemId: second.id, qty: 99 },
    ],
  });
  assert.equal(partial.ok, false);
  assert.match(partial.error, /Only 6/);
  assert.equal((company.stockTransfers ?? []).length, 0, 'a bad line writes nothing');

  const transfer = addStockTransfer(company, {
    date: '2026-04-03',
    fromGodownId: main,
    toGodownId: warehouse.id,
    items: [
      { stockItemId: item.id, qty: 2 },
      { stockItemId: second.id, qty: 1 },
      { stockItemId: item.id, qty: 3 },
    ],
    narration: 'Two lines',
  });
  assert.equal(transfer.ok, true, transfer.error);
  assert.equal(transfer.transfer.items.length, 2, 'duplicate item lines are merged');
  assert.equal(transfer.transfer.items[0].qty, 5);
  assert.equal(transfer.transfer.items[1].qty, 1);

  const byGodown = godownStockSummary(company);
  const mainQty = byGodown.rows
    .filter((row) => row.godownId === main)
    .reduce((sum, row) => sum + row.closingQty, 0);
  assert.equal(mainQty, 10);
  const totalQty = stockSummary(company).rows.reduce((sum, row) => sum + row.closingQty, 0);
  assert.equal(totalQty, 16);
  assert.equal(stockOnHand(company, second.id, '2026-04-03', { godownId: warehouse.id }), 1);
});

test('batch-tracked items require batches and report batch balances', () => {
  const company = createCompany('Batch Co', '2026-04-01').company;
  const unit = company.units.find((entry) => entry.symbol === 'Nos');
  const item = addStockItem(company, {
    name: 'Cough Syrup',
    stockGroupId: company.stockGroups[0].id,
    unitId: unit.id,
    openingQty: 5,
    openingRate: 80,
    batchTracking: true,
  }).item;
  const warehouse = addGodown(company, { name: 'Cold Room' }).godown;
  const cash = findLedgerByName(company, 'Cash');
  const purchases = findLedgerByName(company, 'Purchases');
  const sales = findLedgerByName(company, 'Sales');

  const noBatch = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-02',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 300 },
      { ledgerId: cash.id, side: 'Cr', amount: 300 },
    ],
    items: [{ stockItemId: item.id, qty: 3, rate: 100 }],
  });
  assert.equal(noBatch.ok, false);
  assert.match(noBatch.error, /batch is required/i);

  const purchase = addVoucher(company, {
    type: 'Purchase',
    date: '2026-04-02',
    lines: [
      { ledgerId: purchases.id, side: 'Dr', amount: 300 },
      { ledgerId: cash.id, side: 'Cr', amount: 300 },
    ],
    items: [{
      stockItemId: item.id,
      qty: 3,
      rate: 100,
      godownId: warehouse.id,
      batchNo: 'LOT-A',
      expiryDate: '2027-03-31',
    }],
  });
  assert.equal(purchase.ok, true, purchase.error);

  const sale = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-05',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 240 },
      { ledgerId: sales.id, side: 'Cr', amount: 240 },
    ],
    items: [{ stockItemId: item.id, qty: 2, rate: 120, godownId: warehouse.id, batchNo: 'LOT-A' }],
  });
  assert.equal(sale.ok, true, sale.error);

  const wrongPlace = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-06',
    lines: [
      { ledgerId: cash.id, side: 'Dr', amount: 120 },
      { ledgerId: sales.id, side: 'Cr', amount: 120 },
    ],
    items: [{ stockItemId: item.id, qty: 1, rate: 120, batchNo: 'LOT-A' }],
  });
  assert.equal(wrongPlace.ok, false, 'LOT-A is only in the cold room');
  assert.match(wrongPlace.error, /in stock at Main Location/);

  const batches = batchStockSummary(company);
  const lot = batches.rows.find((row) => row.batchNo === 'LOT-A');
  const opening = batches.rows.find((row) => row.batchNo === 'Opening');
  assert.equal(lot.closingQty, 1);
  assert.equal(lot.expiryDate, '2027-03-31');
  assert.equal(opening.closingQty, 5);
  assert.equal(batches.totals.closingQty, 6);
});test('opening batches split opening stock and survive an opening quantity edit', () => {
  const company = createCompany('Opening Batch Co', '2026-04-01').company;
  const unit = company.units.find((entry) => entry.symbol === 'Nos');
  const item = addStockItem(company, {
    name: 'Capsule Box',
    stockGroupId: company.stockGroups[0].id,
    unitId: unit.id,
    openingRate: 20,
    batchTracking: true,
    openingBatches: [
      { batchNo: 'LOT-A', qty: 3, expiryDate: '2027-01-31' },
      { batchNo: 'LOT-B', qty: 2 },
    ],
  }).item;
  assert.equal(item.openingQty, 5, 'opening quantity comes from the batches');
  assert.equal(stockOnHand(company, item.id, '2026-04-01', { batchNo: 'LOT-A' }), 3);
  assert.equal(stockOnHand(company, item.id, '2026-04-01', { batchNo: 'LOT-B' }), 2);
  assert.equal(stockOnHand(company, item.id, '2026-04-01', { batchNo: 'Other' }), 0);

  const rows = batchStockSummary(company).rows;
  assert.equal(rows.find((row) => row.batchNo === 'LOT-A').expiryDate, '2027-01-31');
  assert.equal(rows.find((row) => row.batchNo === 'LOT-B').closingQty, 2);

  assert.equal(updateStockItem(company, item.id, { openingQty: 8 }).ok, true);
  assert.equal(item.openingBatches, undefined, 'an edited total falls back to the Opening batch');
  const after = batchStockSummary(company).rows;
  assert.equal(after.length, 1);
  assert.equal(after[0].batchNo, 'Opening');
  assert.equal(after[0].openingQty, 8);
});

test('expiring batches reports lots inside the window and marks expired ones', () => {
  const company = createCompany('Expiry Co', '2026-04-01').company;
  const unit = company.units.find((entry) => entry.symbol === 'Nos');
  const item = addStockItem(company, {
    name: 'Expiring Syrup',
    stockGroupId: company.stockGroups[0].id,
    unitId: unit.id,
    openingRate: 50,
    batchTracking: true,
    openingBatches: [
      { batchNo: 'SOON', qty: 2, expiryDate: '2026-05-01' },
      { batchNo: 'LATER', qty: 3, expiryDate: '2027-05-01' },
    ],
  }).item;
  assert.equal(item.openingQty, 5);

  const upcoming = expiringBatches(company, { asOn: '2026-04-15', days: 30 });
  assert.equal(upcoming.rows.length, 1);
  assert.equal(upcoming.rows[0].batchNo, 'SOON');
  assert.equal(upcoming.rows[0].daysLeft, 16);
  assert.equal(upcoming.rows[0].expired, false);
  assert.equal(upcoming.rows[0].closingQty, 2);
  assert.equal(upcoming.totals.count, 1);
  assert.equal(upcoming.totals.closingValue, 100);

  const expired = expiringBatches(company, { asOn: '2026-06-01', days: 30 });
  assert.equal(expired.rows[0].batchNo, 'SOON');
  assert.equal(expired.rows[0].expired, true);
  assert.equal(expired.rows[0].daysLeft, -31);
  assert.equal(expired.totals.expired, 1);

  const wide = expiringBatches(company, { asOn: '2026-04-15', days: 400 });
  assert.equal(wide.rows.length, 2, 'both lots fall inside a wide window');
  assert.equal(wide.rows[1].batchNo, 'LATER');
});

test('orders record sales and purchase commitments without moving stock', () => {
  const { company, item, cash } = inventoryFixture();
  const customer = addLedger(company, {
    name: 'Order Customer',
    groupId: company.groups.find((group) => group.key === 'sundryDebtors').id,
    opening: 0,
  }).ledger;
  const before = stockSummary(company).rows[0].closingQty;

  const order = addOrder(company, {
    type: 'Sales',
    date: '2026-04-05',
    partyLedgerId: customer.id,
    deliveryDate: '2026-04-20',
    stockItemId: item.id,
    qty: 3,
    rate: 150,
    narration: 'Customer order',
  });
  assert.equal(order.ok, true, order.error);
  assert.equal(order.order.no, 1);
  assert.equal(order.order.total, 450);
  assert.equal(order.order.status, 'Open');
  assert.equal(stockSummary(company).rows[0].closingQty, before, 'orders do not move stock');

  const wrongParty = addOrder(company, {
    type: 'Purchase',
    date: '2026-04-05',
    partyLedgerId: cash.id,
    stockItemId: item.id,
    qty: 1,
    rate: 100,
  });
  assert.equal(wrongParty.ok, false);
  assert.match(wrongParty.error, /customer or supplier/i);

  const lateDelivery = addOrder(company, {
    type: 'Sales',
    date: '2026-04-05',
    partyLedgerId: customer.id,
    deliveryDate: '2026-04-01',
    stockItemId: item.id,
    qty: 1,
    rate: 100,
  });
  assert.equal(lateDelivery.ok, false);
  assert.match(lateDelivery.error, /delivery date/i);

  const closed = setOrderStatus(company, order.order.id, 'Closed');
  assert.equal(closed.ok, true);
  assert.equal(closed.order.status, 'Closed');
  assert.equal(setOrderStatus(company, order.order.id, 'Unknown').ok, false);

  const purchase = addOrder(company, {
    type: 'Purchase',
    date: '2026-04-06',
    partyLedgerId: addLedger(company, {
      name: 'Order Supplier',
      groupId: company.groups.find((group) => group.key === 'sundryCreditors').id,
      opening: 0,
    }).ledger.id,
    stockItemId: item.id,
    qty: 2,
    rate: 90,
  });
  assert.equal(purchase.ok, true, purchase.error);
  assert.equal(purchase.order.no, 1, 'purchase orders have their own sequence');
  assert.equal(deleteOrder(company, purchase.order.id).ok, true);
});

test('a delivery note copies remaining order quantity without moving stock', () => {
  const { company, item } = inventoryFixture();
  const customer = addLedger(company, {
    name: 'Delivery Customer',
    groupId: company.groups.find((group) => group.key === 'sundryDebtors').id,
    opening: 0,
  }).ledger;
  const order = addOrder(company, {
    type: 'Sales',
    date: '2026-04-05',
    partyLedgerId: customer.id,
    stockItemId: item.id,
    qty: 3,
    rate: 150,
  }).order;
  const before = stockOnHand(company, item.id, '2026-04-10');
  const note = addDeliveryNote(company, order.id, '2026-04-10');
  assert.equal(note.ok, true, note.error);
  assert.equal(note.note.kind, 'DeliveryNote');
  assert.equal(note.note.no, 1);
  assert.equal(note.note.sourceOrderId, order.id);
  assert.equal(note.note.items[0].qty, 3);
  assert.equal(note.note.total, 450);
  assert.equal(stockOnHand(company, item.id, '2026-04-10'), before);
  assert.equal(addDeliveryNote(company, 'missing', '2026-04-10').ok, false);
});

test('a quotation converts into a sales order and keeps its own sequence', () => {
  const { company, item } = inventoryFixture();
  const customer = addLedger(company, {
    name: 'Quotation Customer',
    groupId: company.groups.find((group) => group.key === 'sundryDebtors').id,
    opening: 0,
  }).ledger;
  const quotation = addOrder(company, {
    kind: 'Quotation',
    type: 'Sales',
    date: '2026-04-05',
    partyLedgerId: customer.id,
    deliveryDate: '2026-04-30',
    stockItemId: item.id,
    qty: 2,
    rate: 150,
  });
  assert.equal(quotation.ok, true, quotation.error);
  assert.equal(quotation.order.kind, 'Quotation');
  assert.equal(quotation.order.no, 1);
  assert.equal(Number(company.counters.__salesOrder) || 0, 0);
  assert.equal(stockOnHand(company, item.id, '2026-04-05'), 10);

  const converted = convertQuotationToOrder(company, quotation.order.id);
  assert.equal(converted.ok, true, converted.error);
  assert.equal(converted.quotation.status, 'Converted');
  assert.equal(converted.order.no, 1);
  assert.equal(converted.order.type, 'Sales');
  assert.equal(converted.order.items[0].qty, 2);
  assert.equal(converted.quotation.convertedOrderId, converted.order.id);
  assert.equal(convertQuotationToOrder(company, quotation.order.id).ok, false);
});

test('an order tracks partial fulfilment across linked vouchers', () => {
  const { company, item } = inventoryFixture();
  const customer = addLedger(company, {
    name: 'Partial Customer',
    groupId: company.groups.find((group) => group.key === 'sundryDebtors').id,
    opening: 0,
  }).ledger;
  const sales = findLedgerByName(company, 'Sales');
  const order = addOrder(company, {
    type: 'Sales',
    date: '2026-04-05',
    partyLedgerId: customer.id,
    stockItemId: item.id,
    qty: 5,
    rate: 100,
  }).order;

  const first = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-06',
    orderId: order.id,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 200 },
      { ledgerId: sales.id, side: 'Cr', amount: 200 },
    ],
    items: [{ stockItemId: item.id, qty: 2, rate: 100 }],
  });
  assert.equal(first.ok, true, first.error);
  assert.equal(order.status, 'Open');
  assert.equal(order.items[0].fulfilledQty, 2);
  assert.deepEqual(orderRemainingItems(order).map((line) => line.qty), [3]);

  const second = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-07',
    orderId: order.id,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 300 },
      { ledgerId: sales.id, side: 'Cr', amount: 300 },
    ],
    items: [{ stockItemId: item.id, qty: 3, rate: 100 }],
  });
  assert.equal(second.ok, true, second.error);
  assert.equal(order.status, 'Closed');
  assert.equal(order.closedByFulfilment, true);
  assert.deepEqual(orderRemainingItems(order), []);

  assert.equal(deleteVoucher(company, second.voucher.id), true);
  assert.equal(order.status, 'Open');
  assert.equal(order.items[0].fulfilledQty, 2);
  assert.equal(order.closedByFulfilment, undefined);
});

test('an order can carry several item lines and validates each one', () => {
  const { company, item } = inventoryFixture();
  const customer = addLedger(company, {
    name: 'Multi Line Customer',
    groupId: company.groups.find((group) => group.key === 'sundryDebtors').id,
    opening: 0,
  }).ledger;
  const unit = company.units.find((entry) => entry.symbol === 'Nos');
  const sock = addStockItem(company, {
    name: 'Order Sock',
    stockGroupId: company.stockGroups[0].id,
    unitId: unit.id,
    openingQty: 5,
    openingRate: 40,
  }).item;

  const bad = addOrder(company, {
    type: 'Sales',
    date: '2026-04-05',
    partyLedgerId: customer.id,
    items: [
      { stockItemId: item.id, qty: 1, rate: 100 },
      { stockItemId: sock.id, qty: 0, rate: 40 },
    ],
  });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Order Sock/);
  assert.equal((company.orders ?? []).length, 0, 'a bad line writes nothing');

  const order = addOrder(company, {
    type: 'Sales',
    date: '2026-04-05',
    partyLedgerId: customer.id,
    items: [
      { stockItemId: item.id, qty: 2, rate: 100 },
      { stockItemId: sock.id, qty: 3, rate: 40 },
    ],
  });
  assert.equal(order.ok, true, order.error);
  assert.equal(order.order.items.length, 2);
  assert.equal(order.order.items[0].amount, 200);
  assert.equal(order.order.items[1].amount, 120);
  assert.equal(order.order.total, 320);
});

test('a voucher created from an order links it, closes it and reopens it on delete', () => {
  const { company, item } = inventoryFixture();
  const customer = addLedger(company, {
    name: 'Linked Customer',
    groupId: company.groups.find((group) => group.key === 'sundryDebtors').id,
    opening: 0,
  }).ledger;
  const sales = findLedgerByName(company, 'Sales');
  const order = addOrder(company, {
    type: 'Sales',
    date: '2026-04-05',
    partyLedgerId: customer.id,
    stockItemId: item.id,
    qty: 3,
    rate: 150,
  }).order;

  const voucher = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-05',
    orderId: order.id,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 450 },
      { ledgerId: sales.id, side: 'Cr', amount: 450 },
    ],
    items: [{ stockItemId: item.id, qty: 3, rate: 150 }],
  });
  assert.equal(voucher.ok, true, voucher.error);
  assert.equal(voucher.voucher.orderId, order.id);
  assert.equal(order.status, 'Closed');

  const again = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-06',
    orderId: order.id,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 150 },
      { ledgerId: sales.id, side: 'Cr', amount: 150 },
    ],
  });
  assert.equal(again.ok, false);
  assert.match(again.error, /already linked|only an open order/);

  const wrongType = addOrder(company, {
    type: 'Purchase',
    date: '2026-04-06',
    partyLedgerId: addLedger(company, {
      name: 'Linked Supplier',
      groupId: company.groups.find((group) => group.key === 'sundryCreditors').id,
      opening: 0,
    }).ledger.id,
    stockItemId: item.id,
    qty: 1,
    rate: 100,
  }).order;
  const mismatch = addVoucher(company, {
    type: 'Sales',
    date: '2026-04-06',
    orderId: wrongType.id,
    lines: [
      { ledgerId: customer.id, side: 'Dr', amount: 100 },
      { ledgerId: sales.id, side: 'Cr', amount: 100 },
    ],
  });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.error, /purchase order/);

  assert.equal(deleteOrder(company, order.id).ok, false, 'a linked order is protected');
  assert.equal(deleteVoucher(company, voucher.voucher.id), true);
  assert.equal(order.status, 'Open', 'deleting the voucher reopens the order');
  assert.equal(deleteOrder(company, order.id).ok, true);
});

test('orders survive a backup round trip and keep their sequences', () => {
  const { company, item } = inventoryFixture();
  const customer = addLedger(company, {
    name: 'Backup Customer',
    groupId: company.groups.find((group) => group.key === 'sundryDebtors').id,
    opening: 0,
  }).ledger;
  addOrder(company, {
    type: 'Sales',
    date: '2026-04-05',
    partyLedgerId: customer.id,
    stockItemId: item.id,
    qty: 2,
    rate: 120,
  });
  const state = { version: 1, activeCompanyId: company.id, companies: [company] };
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  assert.equal(copy.orders.length, 1);
  assert.equal(copy.orders[0].total, 240);
  assert.equal(copy.counters.__salesOrder, 1);
  const next = addOrder(copy, {
    type: 'Sales',
    date: '2026-04-06',
    partyLedgerId: customer.id,
    stockItemId: item.id,
    qty: 1,
    rate: 120,
  });
  assert.equal(next.ok, true, next.error);
  assert.equal(next.order.no, 2);
});

test('godowns, transfers and batches survive a backup round trip', () => {
  const { company, item } = inventoryFixture();
  const warehouse = addGodown(company, { name: 'Overflow' }).godown;
  const transfer = addStockTransfer(company, {
    date: '2026-04-04',
    fromGodownId: defaultGodownId(company),
    toGodownId: warehouse.id,
    stockItemId: item.id,
    qty: 2,
  });
  assert.equal(transfer.ok, true, transfer.error);

  const state = { version: 1, activeCompanyId: company.id, companies: [company] };
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  assert.equal(copy.godowns.length, 2);
  assert.equal(copy.stockTransfers.length, 1);
  assert.equal(copy.stockTransfers[0].items[0].qty, 2);
  assert.equal(godownStockSummary(copy).rows.find((row) => row.godownId === warehouse.id).closingQty, 2);
});

test('backup round-trips inventory masters and item lines, and validates them', () => {
  const fixture = inventoryFixture();
  fixture.purchase('2026-04-02', 10, 110);
  const state = { version: 1, activeCompanyId: fixture.company.id, companies: [fixture.company] };
  const json = exportState(state);

  const restored = importState(json);
  assert.equal(restored.ok, true, restored.error);
  const company = restored.state.companies[0];
  assert.equal(company.stockItems.length, 1);
  assert.equal(company.stockItems[0].name, 'Cotton Shirt');
  assert.equal(company.units.length, 4);
  assert.equal(company.vouchers[0].items[0].qty, 10);
  assert.equal(stockSummary(company).rows[0].closingValue, 2100);

  const brokenItem = JSON.parse(json);
  brokenItem.companies[0].stockItems[0].unitId = 'missing';
  const brokenResult = importState(JSON.stringify(brokenItem));
  assert.equal(brokenResult.ok, false);
  assert.match(brokenResult.error, /unit/);

  const brokenLine = JSON.parse(json);
  brokenLine.companies[0].vouchers[0].items[0].qty = 1;
  const brokenLineResult = importState(JSON.stringify(brokenLine));
  assert.equal(brokenLineResult.ok, false);
  assert.match(brokenLineResult.error, /does not reconcile/);
});

test('a BOM and production consume components and preserve stock value', () => {
  const { company, unit, group } = inventoryFixture();
  const raw = addStockItem(company, {
    name: 'Cotton Fabric',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 20,
    openingRate: 50,
  }).item;
  const finished = addStockItem(company, {
    name: 'Finished Shirt',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 0,
    openingRate: 0,
  }).item;
  const bom = addBom(company, {
    name: 'Shirt recipe',
    outputItemId: finished.id,
    outputQty: 2,
    components: [{ stockItemId: raw.id, qty: 4 }],
  });
  assert.equal(bom.ok, true, bom.error);
  const production = addManufacture(company, {
    date: '2026-04-10',
    bomId: bom.bom.id,
    outputQty: 4,
    componentGodownId: defaultGodownId(company),
    outputGodownId: defaultGodownId(company),
  });
  assert.equal(production.ok, true, production.error);
  assert.equal(production.manufacture.components[0].qty, 8);
  assert.equal(stockOnHand(company, raw.id, '2026-04-10'), 12);
  assert.equal(stockOnHand(company, finished.id, '2026-04-10'), 4);

  const summary = stockSummary(company);
  const rawRow = summary.rows.find((row) => row.itemId === raw.id);
  const finishedRow = summary.rows.find((row) => row.itemId === finished.id);
  assert.equal(rawRow.closingQty, 12);
  assert.equal(rawRow.closingValue, 600);
  assert.equal(finishedRow.closingQty, 4);
  assert.equal(finishedRow.closingValue, 400);
  assert.equal(summary.totals.closingValue, 2000);
});

test('production wastage consumes extra components without inflating finished stock', () => {
  const { company, unit, group } = inventoryFixture();
  const raw = addStockItem(company, {
    name: 'Waste Fabric',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 20,
    openingRate: 50,
  }).item;
  const finished = addStockItem(company, {
    name: 'Waste Shirt',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 0,
    openingRate: 0,
  }).item;
  const bom = addBom(company, {
    name: 'Waste recipe',
    outputItemId: finished.id,
    outputQty: 2,
    components: [{ stockItemId: raw.id, qty: 4 }],
  }).bom;
  const production = addManufacture(company, {
    date: '2026-04-10',
    bomId: bom.id,
    outputQty: 4,
    wastageQty: 2,
    componentGodownId: defaultGodownId(company),
    outputGodownId: defaultGodownId(company),
  });
  assert.equal(production.ok, true, production.error);
  assert.equal(production.manufacture.wastageQty, 2);
  assert.equal(production.manufacture.components[0].qty, 12);
  assert.equal(stockOnHand(company, raw.id, '2026-04-10'), 8);
  assert.equal(stockOnHand(company, finished.id, '2026-04-10'), 4);
  const summary = stockSummary(company);
  assert.equal(summary.totals.closingValue, 2000, 'wastage cost stays in finished goods value');
  assert.equal(addManufacture(company, {
    date: '2026-04-11',
    bomId: bom.id,
    outputQty: 1,
    wastageQty: -1,
    componentGodownId: defaultGodownId(company),
    outputGodownId: defaultGodownId(company),
  }).ok, false);
});

test('production checks component stock and requires a batch for tracked output', () => {
  const { company, unit, group } = inventoryFixture();
  const raw = addStockItem(company, {
    name: 'Raw Syrup',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 5,
    openingRate: 10,
  }).item;
  const finished = addStockItem(company, {
    name: 'Bottled Syrup',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 0,
    openingRate: 0,
    batchTracking: true,
  }).item;
  const bom = addBom(company, {
    name: 'Bottle recipe',
    outputItemId: finished.id,
    outputQty: 1,
    components: [{ stockItemId: raw.id, qty: 2 }],
  });
  assert.equal(bom.ok, true, bom.error);

  const noBatch = addManufacture(company, {
    date: '2026-04-10',
    bomId: bom.bom.id,
    outputQty: 1,
    componentGodownId: defaultGodownId(company),
    outputGodownId: defaultGodownId(company),
  });
  assert.equal(noBatch.ok, false);
  assert.match(noBatch.error, /Batch/);

  const production = addManufacture(company, {
    date: '2026-04-10',
    bomId: bom.bom.id,
    outputQty: 1,
    componentGodownId: defaultGodownId(company),
    outputGodownId: defaultGodownId(company),
    outputBatchNo: 'LOT-A',
  });
  assert.equal(production.ok, true, production.error);
  assert.equal(stockOnHand(company, finished.id, '2026-04-10', { batchNo: 'LOT-A' }), 1);

  const tooMuch = addManufacture(company, {
    date: '2026-04-11',
    bomId: bom.bom.id,
    outputQty: 3,
    componentGodownId: defaultGodownId(company),
    outputGodownId: defaultGodownId(company),
    outputBatchNo: 'LOT-B',
  });
  assert.equal(tooMuch.ok, false);
  assert.match(tooMuch.error, /Only 3 .*Raw Syrup/);
});

test('BOMs and production survive backup validation and protect their links', () => {
  const { company, unit, group } = inventoryFixture();
  const raw = addStockItem(company, {
    name: 'Steel Sheet',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 10,
    openingRate: 20,
  }).item;
  const finished = addStockItem(company, {
    name: 'Steel Box',
    stockGroupId: group.id,
    unitId: unit.id,
    openingQty: 0,
    openingRate: 0,
  }).item;
  const bom = addBom(company, {
    name: 'Box recipe',
    outputItemId: finished.id,
    outputQty: 1,
    components: [{ stockItemId: raw.id, qty: 2 }],
  });
  const production = addManufacture(company, {
    date: '2026-04-10',
    bomId: bom.bom.id,
    outputQty: 2,
    componentGodownId: defaultGodownId(company),
    outputGodownId: defaultGodownId(company),
  });
  assert.equal(production.ok, true, production.error);

  const state = { version: 1, activeCompanyId: company.id, companies: [company] };
  const restored = importState(exportState(state));
  assert.equal(restored.ok, true, restored.error);
  const copy = restored.state.companies[0];
  assert.equal(copy.boms.length, 1);
  assert.equal(copy.manufactures.length, 1);
  assert.equal(copy.manufactures[0].components[0].qty, 4);
  assert.equal(copy.counters.__manufacture, 1);
  assert.equal(deleteBom(copy, copy.boms[0].id).ok, false);
  assert.equal(deleteManufacture(copy, copy.manufactures[0].id).ok, true);
  assert.equal(deleteBom(copy, copy.boms[0].id).ok, true);

  const broken = JSON.parse(exportState(state));
  broken.companies[0].manufactures[0].components[0].qty = 3;
  const brokenResult = importState(JSON.stringify(broken));
  assert.equal(brokenResult.ok, false);
  assert.match(brokenResult.error, /does not match its BOM/);
});

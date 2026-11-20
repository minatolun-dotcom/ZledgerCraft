// ZledgerCraft - Orders, bills of materials and inventory screens.
// Screen functions read the live UI state exported by ui.js.
import {
  booksStart,
  dateLabel,
  defaultGodownId,
  round2,
  stockBatchesOnHand,
  stockOnHand,
  todayIso,
} from './store.js';
import {
  batchStockSummary,
  expiringBatches,
  godownStockSummary,
  stockMovements,
  stockSummary,
} from './accounting.js';
import {
  view,
  filters,
  voucherLabel,
  fmtQty,
  esc,
  company,
  can,
  money,
  stockItemSelectOptions,
  godownSelectOptions,
  panel,
  emptyCompanyScreen,
} from './ui.js';
import { allPartyLedgerOptions } from './ui-reports.js';

export function ordersScreen() {
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
      const lines = order.items ?? [];
      const itemCell = lines
        .map((line) => {
          const item = items.get(line.stockItemId);
          return `${esc(item?.name ?? 'Unknown item')}${line.batchNo ? `<div class="muted small">Batch ${esc(line.batchNo)}</div>` : ''}`;
        })
        .join('<br>');
      const qtyCell = lines
        .map((line) => {
          const unit = units.get(items.get(line.stockItemId)?.unitId)?.symbol ?? '';
          return `${fmtQty(line.qty)} ${esc(unit)}`.trim();
        })
        .join('<br>');
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
        <td>${lines.length ? itemCell : '<span class="muted">No items</span>'}</td>
        <td class="num">${qtyCell}</td>
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
      <div class="bom-components">
        <span class="muted small">Order lines</span>
        <div id="order-lines">${orderItemRow(active)}</div>
        <button class="btn small" type="button" data-action="add-order-line">Add item</button>
      </div>
      <label class="field"><span>Narration</span><input name="narration" maxlength="400" placeholder="Optional note"></label>
      <div class="field form-actions"><button class="btn primary" type="submit">Record order</button></div>
      <p id="order-error" class="form-error" role="alert"></p>
    </form>`,
    'Each order can carry several item lines. Create voucher copies them all and closes the order.',
  )}`;
}

export function stockOpeningBatchRow(batch = {}) {
  return `<div class="bom-row opening-batch-row">
    <label class="field"><span>Batch name</span><input name="openingBatchNo" maxlength="30" placeholder="e.g. LOT-24" value="${esc(batch.batchNo ?? '')}" aria-label="Opening batch name"></label>
    <label class="field"><span>Quantity</span><input name="openingBatchQty" inputmode="decimal" placeholder="0" value="${esc(batch.qty ?? '')}" aria-label="Opening batch quantity"></label>
    <label class="field"><span>Expiry</span><input name="openingBatchExpiry" type="date" value="${esc(batch.expiryDate ?? '')}" aria-label="Opening batch expiry"></label>
    <button class="btn small ghost" type="button" data-action="remove-opening-batch">Remove</button>
  </div>`;
}

export function orderItemRow(active) {
  return `<div class="bom-row order-row">
    <label class="field"><span>Item</span><select name="orderItemId">${stockItemSelectOptions(active, '')}</select></label>
    <label class="field"><span>Godown</span><select name="orderGodownId">${godownSelectOptions(active, '')}</select></label>
    <label class="field"><span>Batch / expiry</span>
      <span class="inline-pair">
        <input name="orderBatchNo" maxlength="30" placeholder="Batch" aria-label="Batch">
        <input name="orderExpiryDate" type="date" aria-label="Expiry">
      </span>
    </label>
    <label class="field"><span>Quantity</span><input name="orderQty" inputmode="decimal" placeholder="0" aria-label="Order quantity"></label>
    <label class="field"><span>Rate</span><input name="orderRate" inputmode="decimal" placeholder="0.00" aria-label="Order rate"></label>
    <button class="btn small ghost" type="button" data-action="remove-order-line">Remove</button>
  </div>`;
}

export function stockTransferItemRow(active) {
  return `<div class="bom-row transfer-row">
    <label class="field"><span>Item</span><select name="transferItemId">${stockItemSelectOptions(active, '')}</select></label>
    <label class="field"><span>Batch (if tracked)</span><input name="transferBatchNo" maxlength="30" placeholder="e.g. LOT-24" aria-label="Batch"></label>
    <label class="field"><span>Quantity</span><input name="transferQty" inputmode="decimal" placeholder="0" aria-label="Transfer quantity"></label>
    <button class="btn small ghost" type="button" data-action="remove-transfer-line">Remove</button>
  </div>`;
}

export function bomComponentRow(active) {
  return `<div class="bom-row">
    <label class="field"><span>Component item</span><select name="componentItemId">${stockItemSelectOptions(active, '')}</select></label>
    <label class="field"><span>Quantity</span><input name="componentQty" inputmode="decimal" placeholder="0" aria-label="Component quantity"></label>
    <button class="btn small ghost" type="button" data-action="remove-bom-component">Remove</button>
  </div>`;
}

export function inventoryScreen() {
  if (!company()) return emptyCompanyScreen('Inventory');
  const active = company();
  const period = filters.stock;
  const from = period.from || active.fyStart;
  const to = period.to || active.fyEnd;
  const report = stockSummary(active, { from, to });
  const godownReport = godownStockSummary(active, { from, to });
  const batchReport = batchStockSummary(active, { from, to });
  const expiryReport = expiringBatches(active, { asOn: to, days: 90 });
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
  const stockCounts = [...(active.stockCounts ?? [])].sort(
    (a, b) => b.date.localeCompare(a.date) || b.no - a.no,
  );
  const selectedCount = view.stockCountId
    ? stockCounts.find((count) => count.id === view.stockCountId) ?? null
    : null;
  const countDraft = view.stockCountDraft ?? null;
  const countDraftRows = countDraft
    ? items.flatMap((item) => {
        const unit = (active.units ?? []).find((entry) => entry.id === item.unitId)?.symbol ?? '';
        if (!item.batchTracking) {
          return [{
            item,
            unit,
            batchNo: '',
            systemQty: stockOnHand(active, item.id, countDraft.date, { godownId: countDraft.godownId }),
          }];
        }
        return [
          ...stockBatchesOnHand(active, item.id, countDraft.date, {
            godownId: countDraft.godownId,
          }).map((batch) => ({ item, unit, batchNo: batch.batchNo, systemQty: batch.qty })),
          { item, unit, batchNo: '', systemQty: 0, unlisted: true },
        ];
      })
    : [];

  const stockCountRows = stockCounts
    .map((count) => {
      const differences = count.rows.filter((row) => Math.abs(row.difference) >= 0.0005).length;
      return `<tr>
        <td><strong>SC-${count.no}</strong></td>
        <td>${esc(dateLabel(count.date))}</td>
        <td>${esc(count.godownName || count.godownId)}</td>
        <td class="num">${count.rows.length}</td>
        <td class="num">${differences || '—'}</td>
        <td class="row-actions">
          <button class="btn small ghost" type="button" data-action="view-stock-count" data-id="${esc(count.id)}">View</button>
          <button class="btn small danger" type="button" data-action="delete-stock-count" data-id="${esc(count.id)}">Delete</button>
        </td>
      </tr>`;
    })
    .join('');
  const stockCountDetailRows = selectedCount
    ? selectedCount.rows
        .map((row) => {
          const diff = Math.abs(row.difference) >= 0.0005 ? row.difference : 0;
          return `<tr>
            <td>${esc(row.name)}</td>
            <td>${row.batchNo ? esc(row.batchNo) : '—'}</td>
            <td>${esc(row.unit)}</td>
            <td class="num">${fmtQty(row.systemQty)}</td>
            <td class="num">${fmtQty(row.countedQty)}</td>
            <td class="num ${diff < 0 ? 'neg' : ''}">${diff > 0 ? '+' : ''}${fmtQty(diff)}</td>
          </tr>`;
        })
        .join('')
    : '';
  const countDraftForm = countDraft
    ? `<form id="stock-count-form" novalidate>
        <input type="hidden" name="date" value="${esc(countDraft.date)}">
        <input type="hidden" name="godownId" value="${esc(countDraft.godownId)}">
        <p class="muted">Counting <strong>${esc(godowns.find((godown) => godown.id === countDraft.godownId)?.name ?? 'godown')}</strong> on ${esc(dateLabel(countDraft.date))}. Counted quantities start at the book quantity; change the ones that differ. Batch-tracked items are counted lot by lot; use the unlisted row to record stock found in a lot that is not shown.</p>
        ${countDraftRows.length
          ? `<div class="table-wrap"><table class="data-table compact">
              <thead><tr><th>Item</th><th>Batch</th><th>Unit</th><th class="num">Book qty</th><th class="num">Counted qty</th></tr></thead>
              <tbody>${countDraftRows
                .map(
                  ({ item, unit, batchNo, systemQty, unlisted }, index) => `<tr>
                    <td>${esc(item.name)}</td>
                    <td>${unlisted
                      ? `<input name="batch-${index}" data-count-batch-input="${esc(item.id)}" maxlength="30" placeholder="Unlisted lot" aria-label="Batch for unlisted ${esc(item.name)} stock">`
                      : esc(batchNo)}</td>
                    <td>${esc(unit)}</td>
                    <td class="num">${fmtQty(systemQty)}</td>
                    <td class="num"><input name="counted-${index}" data-count-item="${esc(item.id)}" data-count-batch="${esc(batchNo)}" inputmode="decimal" value="${systemQty}" aria-label="Counted quantity for ${esc(item.name)}${batchNo ? ` batch ${esc(batchNo)}` : unlisted ? ' unlisted lot' : ''}"></td>
                  </tr>`,
                )
                .join('')}</tbody>
            </table></div>
            <label class="field"><span>Narration</span><input name="narration" maxlength="200" placeholder="Count team or notes"></label>
            <div class="form-actions">
              <button class="btn primary" type="submit">Save count</button>
              <button class="btn ghost" type="button" data-action="cancel-stock-count">Cancel</button>
            </div>`
          : '<p class="muted">There is no book stock to count in this godown. Post a purchase or transfer first, or add a stock item.</p>'}
        <p id="stock-count-error" class="form-error" role="alert"></p>
      </form>`
    : `<form id="stock-count-start-form" class="filter-bar" novalidate>
        <label class="field inline-field"><span>Count date</span><input name="date" type="date" value="${esc(todayIso())}"></label>
        <label class="field inline-field"><span>Godown</span><select name="godownId">${godownSelectOptions(defaultGodownId(active))}</select></label>
        <button class="btn small" type="submit">Start count</button>
      </form>
      <p class="muted small">A count snapshots the book quantity by godown and records what was physically found. It does not move stock or post an adjustment.</p>`;

  const summaryRows = report.rows
    .map(
      (row) => `<tr class="clickable" data-action="stock-movements" data-id="${esc(row.itemId)}">
        <td><strong>${esc(row.name)}</strong></td>
        <td class="muted">${esc(row.groupName)}</td>
        <td>${esc(row.unit)}</td>
        <td class="num">${fmtQty(row.openingQty)}</td>
        <td class="num">${row.inQty ? fmtQty(row.inQty) : '—'}</td>
        <td class="num">${row.outQty ? fmtQty(row.outQty) : '—'}</td>
        <td class="num ${row.closingQty < 0 ? 'neg' : ''}"><strong>${fmtQty(row.closingQty)}</strong>${row.lowStock ? ' <span class="badge attention">Low</span>' : ''}</td>
        <td class="num">${row.reorderLevel ? fmtQty(row.reorderLevel) : '—'}</td>
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
        <td>${item.batchTracking ? 'Yes' : '<span class="muted">No</span>'}${item.openingBatches?.length ? `<div class="muted small">${item.openingBatches.length} opening</div>` : ''}</td>
        <td class="num">${fmtQty(item.openingQty)}</td>
        <td class="num">${item.reorderLevel ? fmtQty(item.reorderLevel) : '—'}</td>
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
      const source = godowns.find((entry) => entry.id === transfer.fromGodownId)?.name ?? '—';
      const destination = godowns.find((entry) => entry.id === transfer.toGodownId)?.name ?? '—';
      const lines = transfer.items ?? [];
      const lineNames = lines
        .map((line) => {
          const item = items.find((entry) => entry.id === line.stockItemId);
          return `${esc(item?.name ?? 'Unknown item')}${line.batchNo ? ` <span class="muted small">Batch ${esc(line.batchNo)}</span>` : ''}`;
        })
        .join('<br>');
      const lineQtys = lines
        .map((line) => {
          const item = items.find((entry) => entry.id === line.stockItemId);
          const unit = units.find((entry) => entry.id === item?.unitId)?.symbol ?? '';
          return `${fmtQty(line.qty)} ${esc(unit)}`.trim();
        })
        .join('<br>');
      return `<tr>
        <td>${esc(dateLabel(transfer.date))}</td>
        <td><strong>ST-${transfer.no}</strong></td>
        <td>${esc(source)} → ${esc(destination)}</td>
        <td>${lines.length ? lineNames : '<span class="muted">No items</span>'}</td>
        <td class="num">${lineQtys}</td>
        <td class="muted">${esc(transfer.narration || '—')}</td>
        <td class="row-actions"><button class="btn small danger" type="button" data-action="delete-stock-transfer" data-id="${esc(transfer.id)}">Delete</button></td>
      </tr>`;
    })
    .join('');

  const expiryRows = expiryReport.rows
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.name)}</strong></td>
        <td>${esc(row.batchNo)}</td>
        <td>${esc(dateLabel(row.expiryDate))}</td>
        <td class="${row.expired ? 'neg' : ''}">${row.expired ? `Expired ${Math.abs(row.daysLeft)} day${Math.abs(row.daysLeft) === 1 ? '' : 's'} ago` : `${row.daysLeft} day${row.daysLeft === 1 ? '' : 's'}`}</td>
        <td class="num">${fmtQty(row.closingQty)} ${esc(row.unit)}</td>
        <td class="num">${money(row.closingValue)}</td>
      </tr>`,
    )
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
      ${report.rows.some((row) => row.lowStock)
        ? `<p class="muted small">At or below reorder level: ${report.rows
            .filter((row) => row.lowStock)
            .map((row) => esc(row.name))
            .join(', ')}.</p>`
        : ''}
      ${report.rows.length
        ? `<table class="data-table">
            <thead><tr><th>Item</th><th>Group</th><th>Unit</th><th class="num">Opening</th><th class="num">Inward</th><th class="num">Outward</th><th class="num">Closing</th><th class="num">Reorder</th><th class="num">Rate</th><th class="num">Value</th></tr></thead>
            <tbody>${summaryRows}</tbody>
            <tfoot><tr><td colspan="9">Closing stock value</td><td class="num">${money(report.totals.closingValue)}</td></tr></tfoot>
          </table>`
        : '<p class="muted">No stock items yet. Add one below to start tracking quantities.</p>'}`,
      'Click an item to see its voucher-wise movement.',
    )}
    ${panel(
      'Stock counts',
      `${countDraftForm}
      ${selectedCount
        ? `<div class="stock-count-detail">
            <h3>SC-${selectedCount.no} · ${esc(dateLabel(selectedCount.date))} · ${esc(selectedCount.godownName || selectedCount.godownId)}</h3>
            ${selectedCount.narration ? `<p class="muted">${esc(selectedCount.narration)}</p>` : ''}
            <table class="data-table compact">
              <thead><tr><th>Item</th><th>Batch</th><th>Unit</th><th class="num">Book qty</th><th class="num">Counted</th><th class="num">Difference</th></tr></thead>
              <tbody>${stockCountDetailRows}</tbody>
            </table>
          </div>`
        : ''}
      ${stockCounts.length
        ? `<table class="data-table compact">
            <thead><tr><th>Count</th><th>Date</th><th>Godown</th><th class="num">Lines</th><th class="num">Differences</th><th></th></tr></thead>
            <tbody>${stockCountRows}</tbody>
          </table>`
        : '<p class="muted">No stock counts recorded yet.</p>'}`,
      'Counts are working papers. Differences are informational and do not change stock, stock value or the ledger.',
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
    ${expiryReport.rows.length
      ? panel(
          'Expiring batches',
          `<p class="muted">${expiryReport.totals.count} batch${expiryReport.totals.count === 1 ? '' : 'es'} with stock expire within 90 days of ${esc(dateLabel(to))}${expiryReport.totals.expired ? `; ${expiryReport.totals.expired} already expired` : ''}.</p>
          <table class="data-table compact">
            <thead><tr><th>Item</th><th>Batch</th><th>Expiry</th><th>Days</th><th class="num">Quantity</th><th class="num">Value</th></tr></thead>
            <tbody>${expiryRows}</tbody>
            <tfoot><tr><td colspan="4">Value at risk</td><td class="num">${fmtQty(expiryReport.totals.closingQty)}</td><td class="num">${money(expiryReport.totals.closingValue)}</td></tr></tfoot>
          </table>`,
          'Uses batch expiry dates from stock lines and opening batches. Move, sell or write off expiring lots before they lapse; the app does not post a write-off automatically.',
        )
      : ''}
    ${panel(
      'Stock transfers',
      `<form id="stock-transfer-form" class="form-grid" novalidate>
        <label class="field"><span>Date</span><input name="date" type="date" value="${esc(todayIso() >= booksStart(active) && todayIso() <= to ? todayIso() : active.fyStart)}" min="${esc(booksStart(active))}" required></label>
        <label class="field"><span>From godown</span><select name="fromGodownId">${godownSelectOptions(active, defaultGodownId(active))}</select></label>
        <label class="field"><span>To godown</span><select name="toGodownId">${godownSelectOptions(active, godowns.find((godown) => !godown.primary)?.id ?? defaultGodownId(active))}</select></label>
        <label class="field"><span>Narration</span><input name="narration" maxlength="400" placeholder="Optional reason or vehicle"></label>
        <div class="bom-components">
          <span class="muted small">Items moved between the godowns</span>
          <div id="stock-transfer-lines">${stockTransferItemRow(active)}</div>
          <button class="btn small" type="button" data-action="add-stock-transfer-line">Add item</button>
        </div>
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
        <label class="field">
          <span>Reorder level</span>
          <input name="reorderLevel" inputmode="decimal" placeholder="0 = no alert" value="${esc(editing?.reorderLevel ?? '')}">
        </label>
        <label class="field gst-check">
          <input type="checkbox" name="batchTracking"${editing?.batchTracking ? ' checked' : ''}>
          <span>Track batches and expiry</span>
        </label>
        <div class="bom-components">
          <span class="muted small">Opening batches (optional; their quantities must add up to the opening quantity)</span>
          <div id="stock-item-batches">${(editing?.openingBatches ?? []).map(stockOpeningBatchRow).join('')}</div>
          <button class="btn small" type="button" data-action="add-opening-batch">Add batch</button>
        </div>
        <div class="field form-actions">
          <button class="btn primary" type="submit">${editing ? 'Save item' : 'Create item'}</button>
          ${editing ? '<button class="btn ghost" type="button" data-action="cancel-stock-item">Cancel</button>' : ''}
        </div>
        <p id="stock-item-error" class="form-error" role="alert"></p>
      </form>
      ${items.length
        ? `<table class="data-table">
            <thead><tr><th>Item</th><th>Stock group</th><th>Unit</th><th>HSN / SAC</th><th>Batches</th><th class="num">Opening qty</th><th class="num">Reorder</th><th class="num">Opening rate</th><th></th></tr></thead>
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



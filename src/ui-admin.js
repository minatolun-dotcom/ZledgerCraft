// ZledgerCraft - Snapshots, backup, import, budgets and forex screens.
// Screen functions read the live UI state exported by ui.js.
import {
  VOUCHER_TYPES,
  booksStart,
  addCostCategory,
  addCostCentre,
  addCurrency,
  addCurrencyRate,
  addGodown,
  addPayHead,
  addLedger,
  addStockGroup,
  addStockItem,
  addUnit,
  addVoucher,
  dateLabel,
  exportState,
  parseAmount,
  round2,
  todayIso,
} from './store.js';
import {
  budgetVsActual,
  forexRevaluation,
} from './accounting.js';
import { backupEncryptionAvailable } from './backup-crypto.js';
import {
  SNAPSHOT_KEY,
  SNAPSHOT_LIMIT,
  state,
  workspaceMode,
  workspaceRev,
  workspaceUpdatedAt,
  workspaceStorage,
  workspaceRemote,
  authRequired,
  filters,
  fmtQty,
  esc,
  company,
  can,
  workspaceAvailable,
  money,
  panel,
  emptyCompanyScreen,
} from './ui.js';

export function loadSnapshots() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SNAPSHOT_KEY) : null;
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSnapshot(currentState, kind = 'manual') {
  if (authRequired) return false;
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

export function localDay(iso = new Date().toISOString()) {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** One automatic snapshot per day, once there is at least one voucher. */
export function maybeAutoSnapshot() {
  if (authRequired) return false;
  const vouchers = state.companies.reduce((sum, item) => sum + item.vouchers.length, 0);
  if (vouchers === 0) return false;
  const today = localDay();
  const latest = loadSnapshots().find((snapshot) => snapshot.kind === 'auto');
  if (latest && localDay(latest.at) === today) return false;
  return saveSnapshot(state, 'auto');
}

export function snapshotHtml() {
  if (authRequired) {
    return panel(
      'Server backups',
      '<p class="muted">Browser snapshots are disabled in LAN mode so books are not copied into device storage. Download a JSON backup below, and back up <code>data/workspace.sqlite</code> on the server machine.</p>',
    );
  }
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

export function workspacePanel() {
  const available = workspaceAvailable();
  return panel(
    'Storage',
    `<p class="muted">${workspaceMode
      ? authRequired
        ? 'The LAN server workspace is active. Every change is saved to the server database and shared with signed-in users on the network.'
        : 'The server workspace is active. Every change is saved to the local server and shared with browser profiles that open it.'
      : available
        ? 'Data is currently stored in this browser only. A server workspace shares it across devices on the local network.'
        : 'This single-file build stores data in this browser only. Run <code>node app/serve.mjs</code> to enable a server workspace.'}</p>
    <p class="muted small">${authRequired
      ? 'Access requires a server account. Passwords are hashed; sessions use an HttpOnly cookie. Saves are revision-checked so two sessions cannot silently overwrite each other.'
      : available
        ? 'The localhost development server does not require authentication. Enable LAN mode with HOST=0.0.0.0 for signed-in network access.'
        : 'Server workspaces require the HTTP server; opening the HTML file directly uses browser storage.'}</p>
    ${workspaceMode
      ? `<p class="muted small">${workspaceStorage === 'sqlite' ? 'SQLite backend' : 'JSON file backend'} · server revision ${workspaceRev}${workspaceUpdatedAt ? ` · last saved ${esc(new Date(workspaceUpdatedAt).toLocaleString('en-IN'))}` : ''}.${workspaceRemote ? ' A newer server copy is available.' : ''}</p>`
      : ''}
    <div class="form-actions">
      ${available
        ? workspaceMode
          ? `<button class="btn small" type="button" data-action="logout-server"${authRequired ? '' : ' hidden'}>Sign out</button>${authRequired ? '' : '<button class="btn small" type="button" data-action="disable-workspace">Switch to browser storage</button>'}${workspaceRemote ? '<button class="btn small primary" type="button" data-action="reload-workspace">Reload server copy</button>' : ''}`
          : '<button class="btn small primary" type="button" data-action="enable-workspace">Use server workspace</button>'
        : ''}
    </div>`,
    workspaceMode ? 'Server workspace active' : 'Browser storage active',
  );
}

export function backupScreen() {
  const payload = exportState(state);
  const canEncrypt = backupEncryptionAvailable();
  return `
    ${workspacePanel()}
    ${panel(
      'Download backup',
      `<p class="muted">Save this file somewhere safe. It contains every company, ledger and voucher stored in ${workspaceMode ? 'this server workspace' : 'this browser'}.</p>
      <textarea class="backup-box" readonly rows="10" aria-label="Backup JSON">${esc(payload)}</textarea>
      <div class="form-actions">
        <a class="btn primary" download="zledgercraft-backup-${todayIso()}.json" href="data:application/json;charset=utf-8,${encodeURIComponent(payload)}">Download JSON</a>
      </div>`,
    )}
    ${panel(
      'Encrypted backup',
      canEncrypt
        ? `<p class="muted">Download a passphrase-protected copy of the same data. The file is encrypted in this browser with AES-256-GCM; the passphrase is never uploaded or stored, and it cannot be recovered if lost.</p>
      <form id="encrypted-backup-form" class="form-grid" novalidate>
        <label class="field"><span>Passphrase</span><input name="passphrase" type="password" minlength="8" autocomplete="new-password" required aria-label="Encrypted backup passphrase"></label>
        <label class="field"><span>Confirm passphrase</span><input name="confirm" type="password" minlength="8" autocomplete="new-password" required aria-label="Confirm encrypted backup passphrase"></label>
        <p id="encrypted-backup-error" class="form-error" role="alert"></p>
        <div class="form-actions">
          <button class="btn primary" type="button" data-action="download-encrypted-backup">Download encrypted JSON</button>
        </div>
      </form>`
        : '<p class="muted">Encrypted downloads need HTTPS or localhost because browsers expose Web Crypto only in secure contexts. A plain-HTTP LAN server is not a secure context; enable TLS or use the server-backup flow instead.</p>',
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
          `<p class="muted">Paste a plain or encrypted backup below. Restoring replaces all companies currently stored in this browser.</p>
          <form id="restore-form" novalidate>
            <label class="field">
              <span>Backup JSON</span>
              <textarea name="payload" class="backup-box" rows="10" placeholder='{ "companies": [ ... ] }' aria-label="Restore JSON payload"></textarea>
            </label>
            <label class="field">
              <span>Passphrase for encrypted backups</span>
              <input name="passphrase" type="password" autocomplete="current-password" aria-label="Encrypted backup passphrase">
            </label>
            <p class="muted small">Leave the passphrase blank for an unencrypted backup.</p>
            <p id="restore-preview" class="muted" aria-live="polite"></p>
            <p id="form-error" class="form-error" role="alert"></p>
            <div class="form-actions">
              <button class="btn danger" type="submit">Restore and replace</button>
            </div>
          </form>`,
        )
      : '<p class="muted">Only an owner can restore a backup.</p>'}`;
}

export function parseCsvChecked(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let quoteClosed = false;
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        quoteClosed = true;
      } else {
        field += char;
      }
    } else if (char === '"') {
      if (field.length || quoteClosed) {
        return { ok: false, error: 'CSV has a quote inside an unquoted field.' };
      }
      quoted = true;
    } else if (char === ',') {
      row.push(field.replace(/\r$/, ''));
      field = '';
      quoteClosed = false;
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
      quoteClosed = false;
    } else {
      if (quoteClosed && !/\s/.test(char)) {
        return { ok: false, error: 'CSV has unexpected text after a closing quote.' };
      }
      field += char;
    }
  }
  if (quoted) return { ok: false, error: 'CSV has an unclosed quoted field.' };
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return {
    ok: true,
    rows: rows.filter((entry) => entry.some((cell) => String(cell).trim() !== '')),
  };
}

export function parseCsv(text) {
  const parsed = parseCsvChecked(text);
  return parsed.ok ? parsed.rows : [];
}

export function csvObjects(text) {
  const parsed = parseCsvChecked(text);
  if (!parsed.ok) return parsed;
  const rows = parsed.rows;
  if (rows.length < 2) return { ok: false, error: 'Add a header row and at least one data row.' };
  const header = rows[0].map((cell) => String(cell).trim().toLowerCase());
  if (header.some((name) => !name)) return { ok: false, error: 'CSV header columns cannot be empty.' };
  if (new Set(header).size !== header.length) {
    return { ok: false, error: 'CSV header has duplicate column names.' };
  }
  const objects = rows.slice(1).map((cells, index) => {
    const record = { __row: index + 2 };
    for (const [column, name] of header.entries()) record[name] = String(cells[column] ?? '').trim();
    return record;
  });
  return { ok: true, header, rows: objects };
}

export function importLedgerCsv(text) {
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

export function importCurrencyRateCsv(text, target = null) {
  const active = target ?? company();
  if (!active) return { ok: false, error: 'Open a company first.' };
  const parsed = csvObjects(text);
  if (!parsed.ok) return parsed;
  for (const column of ['code', 'date', 'rate']) {
    if (!parsed.header.includes(column)) return { ok: false, error: `Currency-rate CSV needs a ${column} column.` };
  }
  const clone = JSON.parse(JSON.stringify(active));
  const additions = [];
  for (const record of parsed.rows) {
    const code = String(record.code ?? '').trim().toUpperCase();
    const date = parseStatementDate(record.date);
    if (!date) return { ok: false, error: `Row ${record.__row}: date must be YYYY-MM-DD.` };
    const result = addCurrencyRate(clone, code, { date, rate: record.rate });
    if (!result.ok) return { ok: false, error: `Row ${record.__row}: ${result.error}` };
    additions.push({ code, date, rate: record.rate });
  }
  for (const addition of additions) {
    const result = addCurrencyRate(active, addition.code, addition);
    if (!result.ok) return { ok: false, error: result.error };
  }
  return { ok: true, count: additions.length };
}

export function importMasterCsv(text, type, target = null) {
  const active = target ?? company();
  if (!active) return { ok: false, error: 'Open a company first.' };
  const label = {
    units: 'unit',
    stockGroups: 'stock group',
    godowns: 'godown',
    costCategories: 'cost category',
    costCentres: 'cost centre',
    payHeads: 'pay head',
    currencies: 'currency',
  }[type];
  if (!label) return { ok: false, error: 'Choose a valid master-data type.' };
  const parsed = csvObjects(text);
  if (!parsed.ok) return parsed;
  if (!parsed.header.includes('name')) return { ok: false, error: `The ${label} CSV needs a Name column.` };
  const clone = JSON.parse(JSON.stringify(active));
  const additions = [];
  for (const record of parsed.rows) {
    const name = String(record.name ?? '').trim();
    if (!name) return { ok: false, error: `Row ${record.__row}: ${label} name is required.` };
    let result;
    if (type === 'units') {
      const symbol = String(record.symbol ?? '').trim();
      result = addUnit(clone, { name, symbol });
      if (result.ok) additions.push({ name, symbol });
    } else if (type === 'stockGroups') {
      result = addStockGroup(clone, { name });
      if (result.ok) additions.push({ name });
    } else if (type === 'godowns') {
      result = addGodown(clone, { name });
      if (result.ok) additions.push({ name });
    } else if (type === 'costCategories') {
      result = addCostCategory(clone, { name });
      if (result.ok) additions.push({ name });
    } else if (type === 'costCentres') {
      const categoryName = String(record.category ?? '').trim();
      const category = clone.costCategories.find((item) => item.name.toLowerCase() === categoryName.toLowerCase());
      if (!category) return { ok: false, error: `Row ${record.__row}: cost category "${categoryName}" was not found.` };
      result = addCostCentre(clone, { name, categoryId: category.id });
      if (result.ok) additions.push({ name, categoryId: category.id });
    } else if (type === 'payHeads') {
      const ledgerName = String(record.ledger ?? '').trim();
      const ledger = clone.ledgers.find((item) => item.name.toLowerCase() === ledgerName.toLowerCase());
      if (!ledger) return { ok: false, error: `Row ${record.__row}: ledger "${ledgerName}" was not found.` };
      const input = {
        name,
        kind: String(record.kind ?? '').trim(),
        ledgerId: ledger.id,
        statutory: String(record.statutory ?? '').trim(),
      };
      result = addPayHead(clone, input);
      if (result.ok) additions.push(input);
    } else {
      const input = {
        code: String(record.code ?? '').trim().toUpperCase(),
        name,
        symbol: String(record.symbol ?? '').trim(),
        date: parseStatementDate(record.date) || undefined,
        rate: record.rate,
      };
      result = addCurrency(clone, input);
      if (result.ok) additions.push(input);
    }
    if (!result.ok) return { ok: false, error: `Row ${record.__row}: ${result.error}` };
  }
  const builders = {
    units: (input) => addUnit(active, input),
    stockGroups: (input) => addStockGroup(active, input),
    godowns: (input) => addGodown(active, input),
    costCategories: (input) => addCostCategory(active, input),
    costCentres: (input) => addCostCentre(active, input),
    payHeads: (input) => addPayHead(active, input),
    currencies: (input) => addCurrency(active, input),
  };
  for (const input of additions) {
    const result = builders[type](input);
    if (!result.ok) return { ok: false, error: result.error };
  }
  return { ok: true, count: additions.length, type };
}

export function importStockItemCsv(text, target = null) {
  const active = target ?? company();
  if (!active) return { ok: false, error: 'Open a company first.' };
  const parsed = csvObjects(text);
  if (!parsed.ok) return parsed;
  if (!parsed.header.includes('name')) return { ok: false, error: 'Stock item CSV needs a Name column.' };
  const value = (record, ...keys) => {
    const key = keys.find((entry) => parsed.header.includes(entry));
    return key ? String(record[key] ?? '').trim() : '';
  };
  const clone = JSON.parse(JSON.stringify(active));
  const inputs = [];
  for (const record of parsed.rows) {
    const name = value(record, 'name', 'item');
    if (!name) return { ok: false, error: `Row ${record.__row}: item name is required.` };
    const groupName = value(record, 'group', 'stock group') || 'Primary';
    const unitName = value(record, 'unit', 'uom');
    const group = clone.stockGroups.find((entry) => entry.name.toLowerCase() === groupName.toLowerCase());
    if (!group) return { ok: false, error: `Row ${record.__row}: stock group "${groupName}" was not found.` };
    const unit = clone.units.find(
      (entry) =>
        entry.symbol.toLowerCase() === unitName.toLowerCase() ||
        entry.name.toLowerCase() === unitName.toLowerCase(),
    );
    if (!unit) return { ok: false, error: `Row ${record.__row}: unit "${unitName}" was not found.` };
    const input = {
      name,
      stockGroupId: group.id,
      unitId: unit.id,
      openingQty: value(record, 'opening', 'opening qty', 'quantity') || 0,
      openingRate: value(record, 'rate', 'opening rate') || 0,
      hsn: value(record, 'hsn', 'hsn/sac', 'sac'),
      reorderLevel: value(record, 'reorder', 'reorder level') || 0,
      sellingPrice: value(record, 'selling', 'selling price') || 0,
      purchasePrice: value(record, 'purchase', 'purchase price') || 0,
      batchTracking: /^(1|true|yes|y)$/i.test(value(record, 'batch', 'batch tracking')),
    };
    const checked = addStockItem(clone, input);
    if (!checked.ok) return { ok: false, error: `Row ${record.__row}: ${checked.error}` };
    inputs.push(input);
  }
  for (const input of inputs) {
    const result = addStockItem(active, input);
    if (!result.ok) return { ok: false, error: result.error };
  }
  return { ok: true, count: inputs.length };
}

export function importVoucherCsv(text) {
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

export function parseStatementDate(raw) {
  const text = String(raw ?? '').trim();
  let iso = text;
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === iso ? iso : null;
}

function statementDateFromDigits(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return parseStatementDate(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`);
}

export function parseOfxStatement(text) {
  const source = String(text ?? '');
  const blocks = source.match(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi) ?? [];
  const lines = [];
  for (const block of blocks) {
    const fields = {};
    for (const match of block.matchAll(/<([A-Z0-9]+)>([^<\r\n]*)/gi)) {
      fields[match[1].toUpperCase()] = match[2].trim();
    }
    const date = statementDateFromDigits(fields.DTPOSTED || fields.DTUSER);
    const amount = parseAmount(fields.TRNAMT);
    if (!date) return { ok: false, error: 'An OFX transaction has an invalid post date.' };
    if (amount === null || amount === 0) return { ok: false, error: 'An OFX transaction has an invalid amount.' };
    const description = [fields.NAME, fields.MEMO].filter(Boolean).join(' · ').slice(0, 200);
    lines.push({
      date,
      description,
      reference: String(fields.FITID || fields.CHECKNUM || '').slice(0, 100),
      amount: round2(amount),
    });
  }
  if (!lines.length) return { ok: false, error: 'No OFX transactions were found.' };
  return { ok: true, lines };
}

export function parseQifStatement(text) {
  const blocks = String(text ?? '').split(/^\^\s*$/m);
  const lines = [];
  for (const block of blocks) {
    const fields = {};
    for (const line of block.split(/\r?\n/)) {
      const key = line.trim().slice(0, 1).toUpperCase();
      if (['D', 'T', 'P', 'M', 'N'].includes(key)) fields[key] = line.trim().slice(1).trim();
    }
    if (!fields.D && !fields.T) continue;
    const normalizedDate = String(fields.D ?? '').replace(/'/g, '/');
    const qifDate = normalizedDate.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    const date = qifDate
      ? parseStatementDate(`${qifDate[3]}-${qifDate[1].padStart(2, '0')}-${qifDate[2].padStart(2, '0')}`)
      : parseStatementDate(normalizedDate);
    const amount = parseAmount(fields.T);
    if (!date) return { ok: false, error: 'A QIF transaction has an invalid date.' };
    if (amount === null || amount === 0) return { ok: false, error: 'A QIF transaction has an invalid amount.' };
    lines.push({
      date,
      description: String(fields.P || fields.M || '').slice(0, 200),
      reference: String(fields.N || '').slice(0, 100),
      amount: round2(amount),
    });
  }
  if (!lines.length) return { ok: false, error: 'No QIF transactions were found.' };
  return { ok: true, lines };
}

export function parseMt940Statement(text) {
  const sourceLines = String(text ?? '').split(/\r?\n/);
  const lines = [];
  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index].trim();
    if (!line.startsWith(':61:')) continue;
    const match = line.slice(4).match(/^(\d{6})(\d{4})?((?:C|D|CR|DR))([\d,]+)/i);
    if (!match) return { ok: false, error: 'An MT940 :61: line has an invalid date or amount.' };
    const year = 2000 + Number(match[1].slice(0, 2));
    const month = match[1].slice(2, 4);
    const day = match[1].slice(4, 6);
    const date = parseStatementDate(`${year}-${month}-${day}`);
    const amount = parseAmount(match[4].replace(',', '.'));
    if (!date) return { ok: false, error: 'An MT940 transaction has an invalid date.' };
    if (amount === null || amount === 0) return { ok: false, error: 'An MT940 transaction has an invalid amount.' };
    let description = '';
    for (let next = index + 1; next < sourceLines.length; next += 1) {
      const detail = sourceLines[next].trim();
      if (detail.startsWith(':86:')) {
        description = detail.slice(4).trim();
        break;
      }
      if (detail.startsWith(':')) break;
    }
    const reference = line.slice(4).match(/\/\/(.+)$/)?.[1]?.trim() ?? '';
    const credit = /^(C|CR)$/i.test(match[3]);
    lines.push({
      date,
      description: description.slice(0, 200),
      reference: reference.slice(0, 100),
      amount: round2(credit ? amount : -amount),
    });
  }
  if (!lines.length) return { ok: false, error: 'No MT940 :61: transactions were found.' };
  return { ok: true, lines };
}

export function parseBankStatement(text) {
  const source = String(text ?? '');
  if (/<OFX>|<STMTTRN>/i.test(source)) return parseOfxStatement(source);
  if (/^:61:/m.test(source)) return parseMt940Statement(source);
  if (/^!Type:/im.test(source) || /^D\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/m.test(source)) {
    return parseQifStatement(source);
  }
  return parseBankStatementCsv(source);
}

export function parseBankStatementCsv(text) {
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

export function budgetsScreen() {
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
        <td><strong>${esc(row.name)}</strong><div class="muted small">${esc(row.targetType === 'group' ? 'Group' : row.targetType === 'costCentre' ? 'Cost centre' : 'Ledger')} · ${esc(row.nature)}</div></td>
        <td>${esc(row.target)}</td>
        <td class="num">${money(row.amount)}</td>
        <td class="num">${money(row.actual)}</td>
        <td class="num ${row.variance < 0 ? 'neg' : ''}">${money(row.variance)}</td>
        <td class="budget-used">
          <div class="budget-meter"><span style="width:${used}%"></span></div>
          <span class="muted small">${row.usedPercent === null ? 'No budget' : `${fmtQty(row.usedPercent)}%`}</span>
        </td>
        <td><span class="badge ${row.over ? 'overdue' : ''}">${row.over ? 'Over budget' : 'Within budget'}</span>${row.nested ? '<div class="muted small">Inside a group budget</div>' : ''}</td>
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
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact budget-report-table">
          <thead><tr><th>Budget</th><th>Target</th><th class="num">Budget</th><th class="num">Actual</th><th class="num">Variance</th><th>Used</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No budgets for this financial year. Add year-wise budgets in Masters.</p>'}`,
    `Variance is budget less actual. Totals exclude ${report.overlapCount || 'no'} budget${report.overlapCount === 1 ? '' : 's'} nested inside a group budget, so overlapping targets are not double-counted.`,
  );
}

export function forexScreen() {
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
    `<p class="muted">Revalues foreign-currency asset and liability balances at the latest rate dated on or before the as-on date. Profit &amp; loss ledgers are not revalued.</p>
    <form id="forex-report-form" class="filter-bar">
      <label class="field inline-field"><span>As on</span><input name="asOn" type="date" min="${esc(booksStart(active))}" max="${esc(lastEnd)}" value="${esc(asOnValue)}" data-period></label>
      <button class="btn small" type="submit">Apply</button>
      ${report.rows.length && can('voucher.write')
        ? `<button class="btn small primary" type="button" data-action="post-forex" data-date="${esc(report.asOn)}">Post revaluation</button>`
        : ''}
    </form>
    <div class="ratio-grid">
      <div class="ratio-card"><span class="ratio-label">Unrealised gain</span><strong class="pos">${money(report.gain)}</strong><span class="muted small">${report.count} ledger balance${report.count === 1 ? '' : 's'}</span></div>
      <div class="ratio-card"><span class="ratio-label">Unrealised loss</span><strong class="neg">${money(report.loss)}</strong><span class="muted small">${report.currencies.length} currenc${report.currencies.length === 1 ? 'y' : 'ies'}</span></div>
      <div class="ratio-card"><span class="ratio-label">Net difference</span><strong class="${report.net < 0 ? 'neg' : 'pos'}">${money(report.net)}</strong><span class="muted small">Gain less loss</span></div>
    </div>
    ${report.rows.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact">
          <thead><tr><th>Ledger</th><th>Nature</th><th>Currency</th><th class="num">Foreign balance</th><th class="num">Book value</th><th class="num">Rate</th><th class="num">Revalued</th><th class="num">Gain</th><th class="num">Loss</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="muted">No foreign-currency asset or liability balances as on this date. Record a foreign voucher in Vouchers first.</p>'}`,
    'Foreign balances are signed: debit positive, credit negative. Posting creates one Journal that adjusts the foreign ledgers and books the net difference to Forex Gain or Forex Loss. Only one revaluation can be posted per date; the report itself remains a working paper until posted.',
  );
}


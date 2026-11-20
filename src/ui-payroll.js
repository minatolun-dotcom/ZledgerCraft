// ZledgerCraft - Payroll, salary register, run and payslip screens.
// Screen functions read the live UI state exported by ui.js.
import {
  dateLabel,
  ledgerOptions,
  payrollBankTransferRows,
  employeeLeaveBalance,
  employeePayComponents,
  payrollLedgers,
  parseAmount,
  payrollMonthEnd,
  payrollStatutoryRows,
  round2,
  todayIso,
} from './store.js';
import {
  amountInWords,
  ledgerTotals,
  payrollSummary,
} from './accounting.js';
import {
  view,
  filters,
  voucherLabel,
  esc,
  company,
  can,
  fmtQty,
  money,
  balanceLabel,
  panel,
  emptyCompanyScreen,
} from './ui.js';

export function parseAttendanceCsv(text, employees = []) {
  const rows = String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return { ok: false, error: 'Attendance CSV is empty.' };
  const split = (line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
  const header = split(rows[0]).map((cell) => cell.toLowerCase().replace(/\s+/g, ''));
  const employeeKey = header.findIndex((cell) => ['employee', 'name', 'code'].includes(cell));
  const daysKey = header.findIndex((cell) => ['paiddays', 'days', 'paid'].includes(cell));
  if (employeeKey < 0 || daysKey < 0) {
    return { ok: false, error: 'Attendance CSV needs Employee and PaidDays columns.' };
  }
  const byKey = new Map();
  for (const employee of employees) {
    byKey.set(employee.name.toLowerCase(), employee.id);
    if (employee.code) byKey.set(employee.code.toLowerCase(), employee.id);
  }
  const paidDays = {};
  for (const [index, line] of rows.slice(1).entries()) {
    const cells = split(line);
    const key = String(cells[employeeKey] ?? '').toLowerCase();
    const employeeId = byKey.get(key);
    if (!employeeId) return { ok: false, error: `Row ${index + 2}: employee "${cells[employeeKey]}" was not found.` };
    const days = parseAmount(cells[daysKey]);
    if (days === null || days < 0 || days > 31) {
      return { ok: false, error: `Row ${index + 2}: paid days must be between 0 and 31.` };
    }
    if (paidDays[employeeId] !== undefined) {
      return { ok: false, error: `Row ${index + 2}: employee "${cells[employeeKey]}" appears twice.` };
    }
    paidDays[employeeId] = days;
  }
  if (!Object.keys(paidDays).length) return { ok: false, error: 'Attendance CSV has no employee rows.' };
  return { ok: true, paidDays, count: Object.keys(paidDays).length };
}

export function payrollMonthLabel(month) {
  const [year, index] = String(month ?? '').split('-').map(Number);
  if (!year || !index) return String(month ?? '');
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

export function defaultPayrollMonth(active) {
  const today = todayIso().slice(0, 7);
  if (today >= active.fyStart.slice(0, 7) && today <= active.fyEnd.slice(0, 7)) return today;
  return active.fyStart.slice(0, 7);
}

export function employeeMonthlyTotals(employee, headMap) {
  const totals = employeePayComponents(employee, headMap);
  return { gross: totals.gross, deductions: totals.deductionTotal, net: totals.net };
}

export function payrollScreen() {
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
  const runMonthEnd = payrollMonthEnd(month) || active.fyEnd;
  const runMonthStart = `${month}-01`;
  const runMonthDays = Number(runMonthEnd.slice(8, 10));
  const attendanceRows = employees
    .filter((employee) => employee.active)
    .map((employee) => {
      const joined = employee.dateOfJoining && employee.dateOfJoining > runMonthStart ? employee.dateOfJoining : runMonthStart;
      const exited = employee.dateOfExit && employee.dateOfExit < runMonthEnd ? employee.dateOfExit : runMonthEnd;
      const available = joined > exited
        ? 0
        : Math.round((Date.parse(`${exited}T00:00:00Z`) - Date.parse(`${joined}T00:00:00Z`)) / 86400000) + 1;
      const prefilled = view.payrollAttendance?.[employee.id];
      return `<tr><td><strong>${esc(employee.name)}</strong>${employee.code ? `<div class="muted small">${esc(employee.code)}</div>` : ''}</td><td class="num">${available}</td><td class="num"><input name="paid-${esc(employee.id)}" data-payroll-paid="${esc(employee.id)}" inputmode="decimal" value="${prefilled ?? available}" max="${available}" aria-label="Paid days for ${esc(employee.name)}"></td></tr>`;
    })
    .join('');

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
      <label class="field"><span>PF rate %</span><input name="pfRate" inputmode="decimal" value="${esc(payroll.statutory?.pfRate ?? 12)}"></label>
      <label class="field"><span>PF wage ceiling</span><input name="pfCeiling" inputmode="decimal" value="${esc(payroll.statutory?.pfCeiling ?? 15000)}"></label>
      <label class="field"><span>ESI rate %</span><input name="esiRate" inputmode="decimal" value="${esc(payroll.statutory?.esiRate ?? 0.75)}"></label>
      <label class="field"><span>ESI wage ceiling</span><input name="esiCeiling" inputmode="decimal" value="${esc(payroll.statutory?.esiCeiling ?? 21000)}"></label>
      <label class="field"><span>Professional tax</span><input name="ptAmount" inputmode="decimal" value="${esc(payroll.statutory?.ptAmount ?? 200)}"></label>
      <div class="field form-actions">
        <button class="btn primary" type="submit">Save payroll settings</button>
      </div>
      <p id="payroll-error" class="form-error" role="alert"></p>
    </form>
    <p class="muted small">Enabling payroll creates or reuses Salaries and Salary Payable ledgers, plus Provident Fund Payable, ESI Payable and Professional Tax Payable. A payroll run posts one Journal voucher for the month; payslips are local working copies and no statutory return or challan is filed.</p>
    <div class="table-scroll" tabindex="0"><table class="data-table compact">
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
        <td class="muted small">${head.statutory ? esc(head.statutory) : head.percentOfBasic ? `${head.percentOfBasic}% of Basic` : 'Fixed'}</td>
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
      <input name="percentOfBasic" inputmode="decimal" placeholder="% of Basic (optional)" aria-label="Percent of Basic">
      <select name="ledgerId" aria-label="Pay head ledger" required>${ledgerChoice}</select>
      <button class="btn small" type="submit">Add pay head</button>
      <p id="payroll-head-error" class="form-error" role="alert"></p>
    </form>
    ${heads.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact payroll-table">
          <thead><tr><th>Pay head</th><th>Kind</th><th>Basis</th><th>Ledger</th><th class="num">Employees</th><th></th></tr></thead>
          <tbody>${headRows}</tbody>
        </table></div>`
      : '<p class="muted">No pay heads yet.</p>'}`,
    'Earnings debit their ledger, deductions credit theirs. Statutory tags group PF, ESI, PT and TDS in the register.',
  );

  const payFields = heads
    .map((head) => {
      const entry = editing?.pay?.find((item) => item.payHeadId === head.id);
      return `<label class="field">
        <span>${esc(head.name)} <span class="muted small">${esc(head.kind)}${head.percentOfBasic ? ` · default ${head.percentOfBasic}% of Basic` : ''}</span></span>
        <input name="pay_${esc(head.id)}" inputmode="decimal" value="${esc(entry ? entry.amount : head.percentOfBasic ?? '')}" placeholder="${head.percentOfBasic ? 'Percent' : '0.00'}">
      </label>`;
    })
    .join('');
  const employeeForm = heads.length
    ? `<form id="employee-form" class="form-grid" novalidate>
        <label class="field"><span>Name</span><input name="name" maxlength="80" value="${esc(editing?.name ?? '')}" required></label>
        <label class="field"><span>Code</span><input name="code" maxlength="20" value="${esc(editing?.code ?? '')}" placeholder="Optional"></label>
        <label class="field"><span>Designation</span><input name="designation" maxlength="60" value="${esc(editing?.designation ?? '')}" placeholder="Optional"></label>
        <label class="field"><span>PAN</span><input name="pan" maxlength="10" value="${esc(editing?.pan ?? '')}" placeholder="Optional"></label>
        <label class="field"><span>Bank name</span><input name="bankName" maxlength="60" value="${esc(editing?.bankName ?? '')}" placeholder="Optional"></label>
        <label class="field"><span>Bank account</span><input name="bankAccount" maxlength="20" inputmode="numeric" value="${esc(editing?.bankAccount ?? '')}" placeholder="Optional"></label>
        <label class="field"><span>IFSC</span><input name="ifsc" maxlength="11" value="${esc(editing?.ifsc ?? '')}" placeholder="Optional"></label>
        <label class="field"><span>Leave balance · Casual</span><input name="leaveCL" inputmode="decimal" value="${esc(editing?.leave?.CL ?? 0)}"></label>
        <label class="field"><span>Leave balance · Sick</span><input name="leaveSL" inputmode="decimal" value="${esc(editing?.leave?.SL ?? 0)}"></label>
        <label class="field"><span>Leave balance · Earned</span><input name="leaveEL" inputmode="decimal" value="${esc(editing?.leave?.EL ?? 0)}"></label>
        <label class="field"><span>Date of joining</span><input name="dateOfJoining" type="date" value="${esc(editing?.dateOfJoining ?? '')}"></label>
        <label class="field"><span>Date of exit</span><input name="dateOfExit" type="date" value="${esc(editing?.dateOfExit ?? '')}"><span class="muted small">Optional. Pay is prorated by calendar days in the joining and exit months.</span></label>
        ${editing ? '<label class="field"><span>Revision date</span><input name="revisionDate" type="date"><span class="muted small">Used only when pay amounts change; defaults to today.</span></label>' : ''}
        <label class="field gst-check">
          <input type="checkbox" name="active"${editing && editing.active === false ? '' : ' checked'}>
          <span>Include in payroll runs</span>
        </label>
        <div class="pay-heads-block">
          <p class="muted small">Monthly amounts. A percentage pay head starts at its default percent of Basic and can be changed per employee; leave it blank when it does not apply.</p>
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
  const revisionRows = (editing?.revisions ?? [])
    .slice()
    .reverse()
    .map((revision) => `<tr>
      <td>${esc(dateLabel(revision.date))}</td>
      <td class="muted small">${(revision.pay ?? [])
        .map((entry) => `${esc(headMap.get(entry.payHeadId)?.name ?? 'Removed head')}: ${money(entry.amount)}`)
        .join(' · ') || 'No amounts'}</td>
    </tr>`)
    .join('');
  const employeesPanel = panel(
    editing ? `Edit employee · ${esc(editing.name)}` : `Employees <span class="count">${employees.length}</span>`,
    `${employeeForm}
    ${editing && revisionRows
      ? `<h3 class="column-title">Salary revisions</h3>
        <div class="table-scroll" tabindex="0"><table class="data-table compact payroll-table">
          <thead><tr><th>Recorded</th><th>Pay structure</th></tr></thead>
          <tbody>${revisionRows}</tbody>
        </table></div>`
      : ''}
    ${employees.length
      ? `<h3 class="column-title">Monthly pay structure</h3>
        <div class="table-scroll" tabindex="0"><table class="data-table compact payroll-table">
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
  const statutory = payrollStatutoryRows(active, month);
  const statutoryTable = statutory
    .map((row) => `<tr>
      <td><strong>${esc(row.name)}</strong>${row.code ? `<div class="muted small">${esc(row.code)}</div>` : ''}</td>
      <td class="num">${money(row.basic)}</td>
      <td class="num">${money(row.gross)}</td>
      <td class="num">${money(row.pf)}</td>
      <td class="num">${money(row.esi)}</td>
      <td class="num">${money(row.pt)}</td>
      <td class="num">${money(row.total)}</td>
    </tr>`)
    .join('');
  const statutoryPanel = panel(
    'Statutory calculator',
    `${statutory.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact payroll-table">
          <thead><tr><th>Employee</th><th class="num">Basic</th><th class="num">Gross</th><th class="num">PF</th><th class="num">ESI</th><th class="num">PT</th><th class="num">Total</th></tr></thead>
          <tbody>${statutoryTable}</tbody>
        </table></div>
        <div class="form-actions"><button class="btn small" type="button" data-action="apply-statutory">Apply to pay structures</button></div>`
      : '<p class="muted">Add active employees with earnings to compute PF, ESI and PT.</p>'}`,
    'PF uses Basic up to the wage ceiling, ESI applies to gross within its ceiling, and PT uses the fixed amount. Applying updates employee deduction amounts; a payroll run still posts explicitly.',
  );

  const runsPanel = panel(
    'Payroll runs',
    `<form id="payroll-run-form" class="form-grid" novalidate>
      <label class="field"><span>Month</span><input name="month" type="month" value="${esc(month)}" required></label>
      <label class="field"><span>Post date</span><input name="date" type="date" value="${esc(runDate)}" required></label>
      <div class="field"><span class="muted small">Paid days (attendance and leave)</span>
        ${attendanceRows
          ? `<table class="data-table compact"><thead><tr><th>Employee</th><th class="num">Available days</th><th class="num">Paid days</th></tr></thead><tbody>${attendanceRows}</tbody></table>`
          : '<p class="muted small">No active employees.</p>'}
        <label class="field"><span>Attendance CSV</span><input type="file" accept=".csv,text/csv" data-csv-target="attendance-csv"></label>
        <textarea id="attendance-csv" class="backup-box import-box" rows="4" placeholder="Employee,PaidDays\nAsha Menon,26"></textarea>
        <div class="form-actions"><button class="btn small" type="button" data-action="load-attendance">Load attendance</button><button class="btn small ghost" type="button" data-action="fill-attendance-template">Fill employee template</button></div>
      </div>
      <div class="field form-actions"><button class="btn small" type="submit">Run payroll and post journal</button></div>
      <p id="payroll-run-error" class="form-error" role="alert"></p>
    </form>
    <p class="muted small">One run is allowed per month. Paid days default to the calendar days available between joining and exit; reduce them for unpaid absence. The journal debits each earning ledger, credits each deduction ledger and credits Salary Payable with the net pay.</p>
    ${report.runs.length
      ? `<div class="table-scroll" tabindex="0"><table class="data-table compact payroll-table">
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
  const leaveRecords = [...(payroll.leaveRecords ?? [])].sort(
    (a, b) => b.from.localeCompare(a.from) || a.employeeId.localeCompare(b.employeeId),
  );
  const leaveRows = leaveRecords
    .map((record) => {
      const employee = employees.find((entry) => entry.id === record.employeeId);
      return `<tr><td>${esc(employee?.name ?? 'Unknown')}</td><td><span class="badge">${esc(record.type)}</span></td><td>${esc(dateLabel(record.from))}</td><td>${esc(dateLabel(record.to))}</td><td class="num">${fmtQty(record.days)}</td><td class="muted small">${esc(record.notes || '—')}</td><td class="row-actions"><button class="btn small danger" type="button" data-action="delete-leave" data-id="${esc(record.id)}"${can('master.write') ? '' : ' disabled'}>Delete</button></td></tr>`;
    })
    .join('');
  const leavePanel = panel(
    'Leave register',
    `<form id="leave-form" class="form-grid" novalidate>
      <label class="field"><span>Employee</span><select name="employeeId">${employees.map((employee) => `<option value="${esc(employee.id)}">${esc(employee.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Leave type</span><select name="type"><option value="CL">Casual leave</option><option value="SL">Sick leave</option><option value="EL">Earned leave</option></select></label>
      <label class="field"><span>From</span><input name="from" type="date" required></label>
      <label class="field"><span>To</span><input name="to" type="date" required></label>
      <label class="field"><span>Notes</span><input name="notes" maxlength="200" placeholder="Optional"></label>
      <div class="form-actions"><button class="btn primary" type="submit"${can('master.write') ? '' : ' disabled'}>Record leave</button></div>
      <p id="leave-error" class="form-error" role="alert"></p>
    </form>
    <p class="muted small">Balances: ${employees.map((employee) => { const balance = employeeLeaveBalance(active, employee.id); return `${esc(employee.name)} CL ${fmtQty(balance.CL.remaining)}, SL ${fmtQty(balance.SL.remaining)}, EL ${fmtQty(balance.EL.remaining)}`; }).join(' · ') || 'No employees'}.</p>
    ${leaveRecords.length
      ? `<table class="data-table compact"><thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th class="num">Days</th><th>Notes</th><th></th></tr></thead><tbody>${leaveRows}</tbody></table>`
      : '<p class="muted">No leave recorded yet.</p>'}`,
    'Leave reduces available balances only; payroll paid days remain a separate attendance decision.',
  );

  if (!payroll.enabled) return setupPanel;
  return `${setupPanel}${headsPanel}${employeesPanel}${leavePanel}${statutoryPanel}${runsPanel}${report.count ? summaryPanel : ''}`;
}

export function salaryRegisterPanel(report, from, to, standalone = false) {
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
        <div class="table-scroll" tabindex="0"><table class="data-table compact payroll-table">
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
        <div class="table-scroll" tabindex="0"><table class="data-table compact payroll-table">
          <thead><tr><th>Employee</th><th class="num">Months</th><th class="num">Gross</th><th class="num">Deductions</th><th class="num">Net</th></tr></thead>
          <tbody>${reportEmployeeRows}</tbody>
        </table></div>`
      : ''}`,
    'Working papers for the selected period. Amounts come from the stored run snapshots, so later pay-head changes do not rewrite history.',
  );
}

export function payrollRegisterScreen() {
  if (!company()) return emptyCompanyScreen('Salary register');
  const active = company();
  const from = filters.payroll.from || active.fyStart;
  const to = filters.payroll.to || active.fyEnd;
  const report = payrollSummary(active, { from, to });
  return salaryRegisterPanel(report, from, to, true);
}

export function payrollRunScreen() {
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
  const bank = payrollBankTransferRows(active, run.id);
  const rows = run.rows
    .map(
      (row) => `<tr>
        <td><strong>${esc(row.name)}</strong>${row.code ? ` <span class="muted small">${esc(row.code)}</span>` : ''}</td>
        <td class="num">${row.paidDays ?? row.workedDays ?? row.monthDays}/${row.monthDays}</td>
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
    <div class="table-scroll" tabindex="0"><table class="data-table compact payroll-table">
      <thead><tr><th>Employee</th><th class="num">Paid days</th><th class="num">Gross</th><th class="num">Deductions</th><th class="num">Net</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="form-actions">
      <button class="btn" type="button" data-screen="payroll">Back to payroll</button>
      ${voucher ? `<button class="btn ghost" type="button" data-action="open-voucher" data-id="${esc(voucher.id)}">Open journal ${voucher.no}</button>` : ''}
      <button class="btn ghost" type="button" data-action="download-payroll-bank" data-id="${esc(run.id)}">Bank transfer CSV</button>
      <button class="btn danger" type="button" data-action="delete-payroll-run" data-id="${esc(run.id)}">Delete this run</button>
    </div>
    ${bank.missing.length
      ? `<p class="muted small">${bank.missing.length} employee${bank.missing.length === 1 ? '' : 's'} (${esc(bank.missing.join(', '))}) have no bank account/IFSC; those rows are included with blank bank fields.</p>`
      : '<p class="muted small">Bank transfer CSV includes each employee\'s bank name, account number and IFSC with net pay. It is a working file, not a bank-validated payment instruction.</p>'}`,
    `One journal voucher${voucher ? ` · ${esc(voucherLabel(voucher.type))} ${voucher.no}` : ''} · stored snapshot of each employee's earnings and deductions.`,
  );
}

export function payslipScreen() {
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
      <div><span class="muted small">Bank</span><strong>${esc(employee?.bankName || '—')}${employee?.bankAccount ? ` · ${esc(employee.bankAccount.slice(-4).padStart(employee.bankAccount.length, '•'))}` : ''}${employee?.ifsc ? ` · ${esc(employee.ifsc)}` : ''}</strong></div>
      <div><span class="muted small">Date of joining</span><strong>${esc(employee?.dateOfJoining ? dateLabel(employee.dateOfJoining) : '—')}</strong></div>
      <div><span class="muted small">Date of exit</span><strong>${esc(employee?.dateOfExit ? dateLabel(employee.dateOfExit) : '—')}</strong></div>
      <div><span class="muted small">Pay period</span><strong>${esc(payrollMonthLabel(run.month))}${row.paidDays ?? row.workedDays ? ` · ${row.paidDays ?? row.workedDays}/${row.monthDays} paid days` : ''}</strong></div>
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


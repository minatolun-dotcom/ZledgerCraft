# ZledgerCraft roadmap and status

Last updated: 2026-11-21

This file is the source of truth for **where the app stands** and **what gets
built next**. Every completed task updates the tracker below and the final task
report names the completed stage plus the next stage. Deferred limits are kept
separately in [KNOWN_LIMITS.md](KNOWN_LIMITS.md).

## Current stage

**Stage 1 — Production safety complete (5 of 5). Stage 2 — Daily operations
complete (6 of 6). Stage 3 — Compliance complete (4 of 4): GST setup, voucher
tax and returns, TDS/TCS deduction and challans, payroll runs with payslips,
and e-invoice/e-way bill plus tax-audit working papers are done. Stage 4 —
Depth and scale has delivered inventory depth, alternate units, per-line
GST/TDS, multiple instruments, stock/WIP posting, forex balances, bulk vouchers,
supplementary payroll and statutory exports; remaining depth is tracked in the
active local backlog. Inventory depth includes godowns, batches, stock
transfers, orders, BOMs and manufacturing; the
server workspace now uses a local SQLite database where every top-level company
collection has its own table; company headers, account groups, financial years,
stock-item fields and common ledger columns are typed, along with transfer,
order, BOM, production and challan fields, plus server accounts, sign-in
sessions, role enforcement, company-level access scoping, revision-checked
saves and enforced voucher edit leases. Tally XML
account groups, ledgers, stock masters, vouchers with matching stock lines and
Excel `.xlsx` ledgers/vouchers can be imported through a hardened parser path.
Conservative merge is implemented for independent changes. Neon Postgres now
stores the workspace, revisions, leases, audit rows, profiles, sessions and
account lockout state, and Neon Managed Auth handles credentials in cloud mode.
The production API is deployed as a Neon Function behind the
`books.lengkhawm.online` Cloudflare Worker proxy.** The single-user accounting core is complete,
and LAN or Neon mode adds authenticated multi-user access, but the app is still
an advanced local MVP, not production or statutory ready.

**Current position:** the accounting core, reporting, GST/TDS/payroll working
papers, inventory depth, SQLite and Neon Postgres workspaces, LAN authentication,
Neon Auth sign-in, MFA in SQLite mode, company scoping, conservative merge,
backup/restore, shared Postgres profiles/sessions and hash-chained server audit
are implemented and tested. Exported JSON backups can be passphrase-encrypted
in the browser, and new server/R2 backups can be encrypted at rest with
`ZL_BACKUP_PASSPHRASE`, while the live workspace remains plaintext. The app is suitable for a trusted single-office LAN
or a shared Neon-backed team with an operator who understands its limits. The
Cloudflare Pages site and Neon Function API are live at
`https://books.lengkhawm.online/` with HTTPS, secure HttpOnly session cookies
and R2 backup upload verified. It is still not suitable for regulated filing or
unreviewed internet exposure; the remaining limits and operator duties are in
`KNOWN_LIMITS.md`.

**Recommended next work:** choose from the
[active local backlog](KNOWN_LIMITS.md#active-local-backlog). The highest-leverage
lanes are GST model depth (exports/SEZ, composition, RCM, openings and split
balancing), e-invoice line depth, forex/cost-centre depth and inventory
batch/FIFO manufacturing. Live-workspace encryption, nested-field querying, write
APIs/webhooks and offline mode remain larger platform projects. Voucher
approvals, the SQLite/LAN per-account 2FA policy and branded PDF reports are
complete.

Working now:

- Companies, groups, ledgers, opening balances and multiple financial years.
- Eight voucher types with multi-line balanced entry, alteration, duplication,
  deletion, bill-wise details, allocations and optional inventory lines.
- Day book, ledger, trial balance, P&L, balance sheet, cash/bank book, registers,
  receivables/payables ageing, group summary, cash flow, ratios, statistics,
  inventory summary/movements and year comparison.
- Inventory depth: units, stock groups/items, HSN/SAC codes, item lines,
  weighted-average valuation, negative-stock blocking, multiple godowns,
  optional batch/expiry tracking, godown and batch balance reports, stock
  transfers with source-godown availability checks, sales/purchase order
  registers with statuses and voucher prefill, BOM recipes, and production that
  consumes components and brings finished goods in at component cost.
- Multi-FY selector, close/reopen, automatic next year and cumulative
  carry-forward.
- Print/CSV/Excel, JSON backup/restore with snapshots, dashboard KPIs and keyboard-first
  navigation.
- Append-only local audit trail for companies, masters, vouchers, users,
  financial years and data restores, with actor attribution, search, company
  filter, Print/CSV and backup merging.
- Local owner/accountant/viewer profiles with a header switcher and enforced
  role permissions in localhost/browser mode. These are access-control
  profiles, not authentication.
- Optional local server workspace in `data/workspace.sqlite`, shared across
  browser profiles on the same machine, with browser storage as the fallback and
  local mirror. Companies, account groups, financial years, cost masters,
  inventory masters, budgets, currencies, stock transfers, orders, BOMs,
  production runs, tax challans, ledgers, vouchers and voucher lines are
  relational rows; nested lines and settings stay in each row's JSON. Legacy `workspace.json` and
  the old whole-workspace blob are migrated automatically and removed. Saves
  carry a revision; a stale session gets a conflict banner and must reload
  instead of overwriting another session. The workspace database is excluded
  from static serving and git.
- LAN mode with password-backed server accounts, scrypt hashes, HttpOnly
  sessions, owner/accountant/viewer enforcement, company-level access scoping,
  a hash-chained server save audit, recent sign-in history, active-session
  revocation, TOTP two-step verification with recovery codes, self-service
  password changes, per-account/source lockout, optional IPv4 allowlisting and
  optional TLS. The first owner is seeded from `ZL_OWNER_PASSWORD`; later
  accounts are managed under Companies → Server accounts. LAN mode never writes
  books or snapshots to browser storage.
- Daily automatic snapshots after the first voucher of the day, ten-snapshot
  retention, and manual/pre-restore labels. The server also writes verified
  daily SQLite backups, retains seven by default, and lets an owner create,
  download or restore backups from the server account panel. Restoring keeps a
  pre-restore snapshot and preserves server accounts.
- All-or-nothing CSV import for ledgers and balanced multi-line vouchers, plus
  `.xlsx` workbook loading into the same reviewed CSV path. Tally XML imports
  account groups, ledgers, stock groups, stock items with opening stock,
  balanced accounting vouchers and matching stock lines, with batch names and
  expiry for locally batch-tracked items, plus audit events. Stock lines that
  cannot be matched are reported and skipped without rolling back the voucher.
  Batch masters, bill allocations, GST/TDS detail and voucher numbers are not
  imported yet.
- Bank reconciliation: CSV statement import, signed auto-matching within seven
  days, one-to-one manual match/unmatch, unmatched book entries and statement
  lines, book balance and audit events. Matching never changes a voucher.
- Cheque/DD details on payment, receipt and contra vouchers, a post-dated/due/
  cleared register with reconciliation-aware status, and a printable cheque
  preview with Indian-numbering amount words.
- Cost categories and centres, optional cost centre on any voucher line, and
  cost centre/category summaries with period filtering and voucher drill-down.
- Annual budgets per ledger or group with a Budget vs Actual report, as-on date,
  variance, used percentage and over-budget status.
- Foreign currency masters with dated INR rates, voucher-level currency and
  exchange rate, base-amount posting with retained foreign amounts, currency
  ledger balances, FIFO settlement matching, a postable realised forex
  difference and a Forex Revaluation report for foreign asset/liability balances.
- Bill-wise register for customer/supplier bills with original, settled and
  outstanding amounts, status, overdue days and drill-down; party statement with
  bill references, allocation detail and every bill up to the report date.
- GST registration (GSTIN, legal/trade name, address, city, PIN and home state),
  a rate master with optional cess and CGST/SGST/IGST/Cess tax ledgers under
  Duties & Taxes. Sales, purchase, credit-note and debit-note vouchers carry one
  rate and a place of supply, with CGST+SGST or IGST computed from the taxable
  side, posted to the tax ledgers and balanced into the party/cash line; reverse
  charge and Nil/Exempt are recorded. Stock items carry HSN/SAC codes and party
  ledgers carry GSTIN/state/address/PIN.
- GST returns as working papers for a period: GSTR-1 outward supplies by rate
  (sales less credit notes), B2B invoices, B2C by rate, credit notes, HSN summary
  and a GSTR-3B summary with reverse charge, ITC and net payable per head.
- TDS/TCS registration (TAN, section master with rates and thresholds) and
  payable ledgers. TDS is deducted on purchase vouchers and TCS collected on
  sales vouchers at one section per voucher, with the party PAN captured from the
  ledger; the register shows section, party and quarterly totals, a financial-year
  threshold watch and voucher drill-down, and tax challans track payable, paid
  and outstanding amounts.
- Payroll setup with Salaries and Salary Payable ledgers, a pay-head master
  (earning/deduction, optional PF/ESI/PT/TDS tag, posting ledger) and employee
  masters with fixed monthly amounts per pay head. A payroll run posts one
  balanced Journal for the month — earnings debited, deductions credited and net
  pay credited to Salary Payable — and stores an employee snapshot. Payslips are
  printable, and the salary register totals pay heads, statutory deductions and
  employees for a period with CSV export.
- E-invoice working papers: a seller profile from GST registration, every B2B/B2C
  sales invoice for a period, buyer details from the party ledger, readiness
  blockers/warnings for missing GSTIN, address, PIN, HSN/SAC or UQC, and a draft
  NIC-style JSON download per B2B invoice. E-way bill Part A working papers list
  outward invoices at or above a configurable ₹50,000 threshold and download a
  draft Part A JSON; Part B transporter/vehicle details are not captured.
- Tax-audit working papers: books turnover by Sales Accounts versus GST outward
  taxable, output-tax and ITC reconciliation between GST-role ledgers and
  GSTR-3B, TDS/TCS deducted/paid/outstanding, the ₹1 crore and ₹10 crore audit
  thresholds, and a ten-clause Form 3CD-style checklist with Ready/Review/Manual
  status plus Print/CSV.
- Local monthly MIS: a dependency-free sales/purchase bar chart for the financial
  year, with sales/purchase returns, net sales and purchases, receipts, payments,
  net cash and a year-to-date row; summary cards for net sales, net purchases,
  net profit, working capital and closing stock; a three-month run-rate outlook;
  top-five customer and supplier concentration tables; a stock position with
  closing value, top items by value and items with no issues during the year;
  working capital; top expense heads; plus Print/CSV/Excel from the Statistics
  screen.
- Verification: 249/249 engine tests, including server scoping, scoped merge,
  login history, lockout, single-use MFA, save/event audit chains and
  backup/restore coverage plus encrypted JSON and server-backup round trips,
  wrong-passphrase, missing-key and tamper checks, and ledger column promotion
  from schema v2 JSON; the existing browser suites were not rerun in this phase;
  single-file build 880.5 kB.

Why it is not production-ready: browser mode still lives in one browser's local
storage with unprotected access-control profiles, the app audit trail is not
tamper-proof, the live workspace is not encrypted, and LAN mode is one
same-machine SQLite server with voucher leases but no field-level history. Bank
reconciliation has no split/many-to-one matching, payroll has no statutory
return files, and inventory lacks FIFO/expiry costing,
batch-tracked BOM components, partial-completion WIP and several automatic
stock journals. Mobile use, report layout, import recovery and large-workspace
performance are also deliberately limited. The full deferred list is in
[KNOWN_LIMITS.md](KNOWN_LIMITS.md).

## Missing feature inventory

Status: **Done**, **Partial**, **Missing**.

### Taxation and statutory — Partial

| Feature | Status |
| --- | --- |
| GST registration, tax ledgers, HSN/SAC and rate setup | Done (Stage 3; GSTIN, home state, rate master, tax ledgers and HSN on stock items; no SAC master) |
| GST on vouchers: CGST/SGST/IGST, cess, reverse charge, exempt/nil | Partial — voucher and per-line rates, cess, RCM flag and Nil/Exempt; no exports/SEZ, composition or ITC reversal |
| GSTR-1, GSTR-3B, GSTR-2B reconciliation and annual returns | Partial — GSTR-1 outward working papers, HSN summary, GSTR-3B liability/ITC summary, GSTR-2B B2B import/reconciliation, GSTR-9 annual working paper/JSON, a late-fee/interest estimator, a monthly GSTR-1 JSON export and a hand-entered filing/ARN register; no CMP-08/GSTR-4 or other return formats |
| E-invoice and e-way bill generation | Partial — B2B e-invoice readiness and draft NIC-style JSON for invoices, credit notes and debit notes, with mixed-rate line splitting; e-way working papers, Part B transporter/vehicle details, distance-based validity and draft JSON at a configurable threshold; no IRN/QR, consolidated e-way bill, e-invoice discounts/charges or amendment |
| TDS/TCS sections, thresholds, challans, returns and certificates | Partial — TAN, section/rate/threshold master, TDS on purchases, TCS on sales, party PAN, register with quarterly and threshold views, challan tracking and downloadable 26Q/27Q/27EQ working papers; no signed certificates, TRACES, threshold enforcement, higher-rate/no-PAN logic or journal deductions |
| Tax audit, reconciliation and statutory registers | Partial — turnover, output-tax/ITC and TDS/TCS reconciliations plus a Form 3CD-style checklist and a user-managed compliance calendar; no Form 3CD, audit opinion, statutory registers or consolidation |
| Immutable audit trail | Done (Stage 1, app-level append-only; not tamper-proof against browser-storage edits) |

### Payroll and statutory deductions — Partial

| Feature | Status |
| --- | --- |
| Employee, pay-head and salary-structure masters | Done (Stage 3; fixed monthly amounts, PAN, joining date, active flag, ledger-linked pay heads) |
| Payroll runs and salary journal | Done (Stage 3; one regular run per month plus supplementary and signed adjustment runs, each posting a balanced Journal and storing its employee snapshot) |
| Payslips and salary register | Done (Stage 3; printable payslip and period register with pay-head, statutory and employee totals, CSV) |
| Attendance, leave, overtime, arrears, bonus and gratuity | Partial — attendance CSV, leave register, bonus/arrears adjustments and proration; no overtime or gratuity |
| PF/ESI/PT computation, employer contributions, ECR/returns and Form 24Q/16 | Partial — configurable PF/ESI calculator, employer share posting and PT amount; no state PT slabs, ECR/ESI return files, Form 24Q or Form 16 |
| Salary payments, advances, loans and reimbursements | Missing |
| CTC, increment history and full-and-final settlement | Missing |

### Banking and treasury — Missing

| Feature | Status |
| --- | --- |
| Bank reconciliation, statement import and auto-match | Done (Stage 2, CSV import and manual/auto matching) |
| Cheque/DD details, cheque printing, post-dated cheques | Done (Stage 2; cheque preview/print, DD details and post-dated status) |
| Cheque and post-dated registers | Done (Stage 2; period/as-on/status filters and bank-reconciliation clearing) |
| Payment reminders and credit limits | Missing |
| Interest receivable/payable | Missing |
| Fund flow and cash forecasting | Missing (historical cash flow only) |

### Inventory and manufacturing — Partial

| Feature | Status |
| --- | --- |
| Units, stock groups/items, weighted-average summary | Done |
| Item lines on sales, purchase, credit/debit notes | Done |
| Negative-stock blocking and negative-balance flags | Done |
| Godowns/locations and stock transfers | Done — godown master, transfer register, source availability and godown balances; no physical stock count or inter-branch accounting |
| Batches and expiry dates | Partial — optional batch tracking, batch/expiry entry on item lines, batch balances; no batch-wise costing or expiry alerts |
| BOM, manufacturing journal, production, wastage, job work | Partial — BOM recipes, scaled component consumption, finished-goods output, output batches and automatic stock/WIP production journals; no partial-completion WIP, by-products or job work |
| Quotations, orders, delivery/receipt notes, rejection notes | Partial — sales/purchase orders with status and voucher prefill; no quotations, delivery/receipt notes, rejection notes or fulfilment tracking |
| Reorder levels, price lists, discounts, additional costs | Missing |
| Stock ageing, godown, reorder and movement-analysis reports | Missing/Partial |
| Alternate and compound units | Missing |
| Stock value posting into P&L/balance sheet | Missing by design |

### Accounting depth — Partial

| Feature | Status |
| --- | --- |
| Double entry, eight voucher types, bill-wise allocation | Done |
| Multi-FY closing and carry-forward | Done |
| Cost centres/categories and reports | Done (Stage 2; one centre per line, no split allocation) |
| Budgets and budget-vs-actual | Done (Stage 2; annual ledger/group budgets, no phasing or revisions) |
| Multi-currency and forex gain/loss | Done (Stage 2; voucher-level currency, dated rates, currency balances, FIFO settlement matching, realized gain/loss posting and unrealised revaluation; no per-ledger currency or foreign openings) |
| Post-dated, memorandum, optional and reversing vouchers | Missing |
| Bill-wise register and party statement | Done (Stage 2; register and party statement with bill detail) |
| Custom document numbering | Missing |
| Recurring vouchers and approval workflows | Missing |
| Company consolidation/group reporting | Missing |

### Reports and MIS — Partial

| Feature | Status |
| --- | --- |
| Core statements, registers, ageing, ratios and statistics | Done |
| Year comparison | Done |
| Comparative multi-period P&L/balance sheet, multi-column reports | Missing |
| Bill register and party statement with bill detail | Done (Stage 2) |
| Cheque, post-dated and exception registers | Partial — Cheque / DD register with post-dated, due and cleared status; no exception register |
| Cost centre and category summaries, break-up | Done (Stage 2) |
| Annual budget vs actual | Done (Stage 2; no monthly phasing or approval workflow) |
| Forex revaluation | Done (Stage 2; foreign asset/liability balances at dated rates) |
| Stock ageing, godown, reorder and price-list reports | Partial — godown and batch balance reports exist; no stock ageing, reorder or price-list reports |
| Audit trail report | Done (Stage 1) |
| Charts, trends and forecasts | Partial — monthly sales/purchase chart and a three-month run-rate; no seasonality, growth or statistical forecasts |
| Excel, branded PDF and scheduled email reports | Partial — Excel export, Resend scheduled daily summaries and a branded PDF attachment exist; deeper forecasts are missing |
| Custom print-layout designer | Missing |

### Security, platform and operations — Missing

| Feature | Status |
| --- | --- |
| Login, users, roles and company-level permissions | Partial — LAN server accounts, passwords, sessions, TOTP MFA with recovery codes, a per-account 2FA requirement, per-company voucher approvals, session management, lockout, optional IP allowlisting, owner/accountant/viewer enforcement, company-level scoping and optional Resend forgot-password links are done; browser-only mode still has no login |
| Encryption/vault protection | Missing |
| Immutable audit/edit log | Done (Stage 1, local append-only; not cryptographic) |
| Backend database instead of browser storage | Partial — local SQLite with a dedicated table for every top-level company collection, atomic revisioned saves and automatic legacy migration; no offsite persistence |
| Multi-user concurrency and cloud sync | Partial — LAN auth, revision checks, conservative merge (including scoped accounts), normalized collection rows and enforced voucher edit leases are done; no field-level conflict history or cloud sync |
| Scheduled/offsite backups and retention | Partial — verified daily backups, retention, manual backup/download/restore, pre-restore snapshots, R2 upload, remote listing/download/restore and failure email are done; no client-side backup encryption |
| Tally XML and Excel master/voucher import | Partial — Tally XML account groups, ledgers, stock groups, stock items with opening stock, balanced vouchers and matching voucher stock lines import; batch names/expiry attach to locally batch-tracked items and batch masters create opening batches; Excel `.xlsx` ledgers and vouchers load into the reviewed CSV path; custom Tally groups need a standard parent and units must pre-exist; skipped stock lines do not roll back the voucher; no bill allocations, cost centres, GST/TDS detail, voucher numbers, APIs or webhooks |
| API/webhooks and integrations | Missing |
| Mobile-first layout | Partial (responsive desktop web) |

## Maturity snapshot

| Area | Approximate completeness |
| --- | --- |
| Core accounting | 90–95% of intended scope |
| Multi-FY and reporting | 65–70% |
| Inventory | 55–60% |
| Banking/treasury | 30% |
| Taxation/statutory | 35–40% |
| Payroll | 25–30% |
| Security/platform | 55% |
| Overall TallyPrime-style breadth | Roughly one-third, mature accounting core |

Deferred limits and their IDs are in [KNOWN_LIMITS.md](KNOWN_LIMITS.md).

## Build order

### Stage 1 — Production safety (complete)

- [x] Immutable append-only audit trail with viewer and export — 2026-11-17
- [x] Local users and roles with actor attribution — 2026-11-17
- [x] Durable storage beyond a single browser profile — 2026-11-17 (same-machine server workspace; no cloud/offsite)
- [x] Scheduled/automatic backups with retention — 2026-11-17
- [x] Data import for masters and vouchers — 2026-11-17 (CSV ledgers and vouchers)

### Stage 2 — Daily operations (complete)

- [x] Bank reconciliation with statement import and auto-match — 2026-11-18
- [x] Cheque/DD details, cheque printing and post-dated register — 2026-11-18
- [x] Cost centres and cost-category reports — 2026-11-18
- [x] Budgets and budget-vs-actual — 2026-11-18
- [x] Multi-currency and forex gain/loss — 2026-11-18 (voucher-level foreign currency, dated rates, currency balances, FIFO settlement matching and realized/unrealised posting)
- [x] Bill-wise register and party statement — 2026-11-18

### Stage 3 — Compliance (complete)

- [x] GST setup, voucher tax computation and GST returns — 2026-11-18 (working papers; no filing, 2B, e-invoice or per-item rates)
- [x] TDS/TCS — 2026-11-18 (sections, deduction/collection, register and challans; no returns, certificates or threshold enforcement)
- [x] Payroll and statutory deductions — 2026-11-18 (employees, pay heads, monthly runs, journal, payslips and salary register; no attendance, PF/ESI computation, returns or payments)
- [x] E-invoice/e-way bill and tax audit reports — 2026-11-18 (working papers and draft JSON; no IRP/e-way portal submission, IRN/QR, Part B or Form 3CD)

### Stage 4 — Depth and scale

- [x] Inventory: godowns, batches, BOM/manufacturing, orders, transfers — 2026-11-18 (batch/expiry, transfers, orders, production, counts, wastage and stock/WIP posting)
- [ ] Cloud sync, backend database and multi-user concurrency — SQLite backend, normalized collection rows, conservative three-way merge (including scoped accounts), revision-checked writes, conflict/reload flow, enforced voucher edit leases, LAN server authentication and company-level scoping done 2026-11-19; Neon Postgres workspace, Postgres profiles/sessions/login state, shared Postgres login/reset rate limits, Postgres JSON backups with R2 listing/restore, Neon Auth login, same-origin auth proxy, Neon Function deployment, Cloudflare Worker API proxy, branch integration test, production smoke test and field-level merge audit done 2026-11-19
- [ ] Tally XML/Excel import, APIs and integrations — Tally XML account group, ledger, stock group/item, voucher, stock-line and batch detail import plus Excel `.xlsx` ledger/voucher loading done 2026-11-18; read-only token API with company-scoped tokens, shared rate limits and OpenAPI contract added 2026-11-19; GST/discount stock-line splits, write APIs and webhooks pending
- [ ] Advanced MIS, charts, scheduled email/Excel exports — local monthly MIS chart, summary cards, party/stock/working-capital/expense tables, three-month run-rate, Excel export, Resend scheduled daily summaries and a branded PDF attachment done 2026-11-19; deeper forecasts pending

## Progress log

Phase numbers below are a sequential work log, not a plan of 17+ items. The
plan is the four stages in **Build order** above; phases record increments
inside those stages.

### 2026-11-21 — Phase 67: local statutory depth and GST/TDS coexistence

- Added GSTR-2B B2B JSON import, stored per period, with supplier-GSTIN,
  invoice-number and value reconciliation against purchases and inward debit
  notes, including both-way missing lists and tax-at-risk totals.
- Added a GSTR-9 annual working paper and JSON download, plus a GST late-fee
  and simple-interest estimator for GSTR-1, GSTR-3B and GSTR-9.
- Added quarterly 26Q, 27Q and 27EQ CSV/JSON working papers from the local TDS/TCS
  register, with missing-PAN counts and challan summaries.
- GST and TDS/TCS can now share a purchase or sale voucher; withholding uses the
  taxable value while the party line stays tax-inclusive.
- E-way working papers now calculate distance-based validity and its expiry date.
- Verification: 378 tests (377 pass, 1 skipped); 1,361.4 kB build.

### 2026-11-21 — Phase 66: external dependency parking and local backlog audit

- Recorded third-party-dependent scopes under parked dependencies P-01–P-07 and
  removed them from the active backlog.
- Added the active local backlog of fixable product gaps, grouped by lane with
  related limit IDs and rough size.
- Corrected stale register entries: per-line GST is resolved; GST filing
  history and local statutory gaps are stated separately.

### 2026-11-21 — Phase 67: e-invoice notes and mixed-rate lines

- E-invoice drafts now cover outward credit and debit notes as CRN/DBN
  documents, with the linked original invoice number and date.
- Mixed-rate invoices allocate item value across the stored GST rate buckets,
  so each e-invoice and e-way draft item carries its own GST rate and matching
  tax amount.
- Verification: 383 tests (382 pass, 1 skipped); 1,381.3 kB build.

### 2026-11-21 — Phase 66: payroll statutory working papers

- Employees now store optional 12-digit UAN and 10–17-digit ESIC numbers with
  the same validation on add, edit and backup restore.
- Payroll run rows snapshot PAN, UAN, ESIC, PF wages and ESI wages, so later
  employee changes do not rewrite the ECR or ESI history.
- The payroll screen downloads monthly EPF ECR and ESI, quarterly Form 24Q and
  annual employee Form 16 CSV/JSON working papers. Each carries a local-paper
  note; nothing is uploaded or acknowledged.
- Verification: 381 tests (380 pass, 1 skipped); 1,378.8 kB build.

### 2026-11-21 — Phase 65: manual GST filing acknowledgements

- The GST screen records GSTR-1, GSTR-3B and GSTR-9 acknowledgements with a
  return period, filed date, optional ARN and notes, and supports removal.
- Duplicate return/period records are rejected, and the register survives
  backup export/import.
- This records a user's manual portal filing; no GSTN call, validation or
  automatic acceptance is implied.
- Verification: 364 tests (363 pass, 1 skipped); 1,323.5 kB build.

### 2026-11-21 — Phase 64: GSTR-1 manual JSON export

- A single-month GSTR-1 JSON export emits GSTN-style b2b (grouped by GSTIN with
  rate-wise item details), b2cs, cdnr/cdnur and HSN sections.
- The exporter validates GST enablement, GSTIN and a single-month period, and
  returns a download payload without calling any portal.
- Verification: 363 tests (362 pass, 1 skipped); 1,316.2 kB build.

### 2026-11-21 — Phase 63: supplementary and adjustment payroll runs

- Supplementary runs cover only active employees not already paid in the month,
  with the normal proration and employer statutory calculation.
- Adjustment runs allocate explicit signed deltas by employee and pay head,
  supporting bonus/arrears additions and negative corrections with one balanced
  Journal per run.
- Run kinds, reasons, paid-day snapshots, employer totals and reversal details
  now survive backup normalization; a month can hold multiple non-regular runs.
- Verification: 362 tests (361 pass, 1 skipped); 1,310.6 kB build.

### 2026-11-21 — Phase 62: atomic bulk voucher grid

- A row grid posts Journal, Payment, Receipt and Contra vouchers together with
  date, debit/credit ledger, amount, source reference and narration.
- Rows validate against an isolated company copy; errors stay on their row and
  no voucher is posted unless the entire batch passes.
- Repeated in-batch references and already posted references reject the batch.
- Verification: 358 tests (357 pass, 1 skipped); 1,295.9 kB build.

### 2026-11-21 — Phase 61: currency ledger balances and forex settlements

- Every ledger touched by a foreign voucher reports foreign debit, credit,
  balance, book value, average/latest rate and revalued value by currency.
- Same-currency party receipts, payments and notes are matched FIFO to invoices;
  realised gain/loss is posted once through Forex Gain/Loss, and a posted
  revaluation moves the carrying rate so later settlement does not double count.
- P&L and balance sheet disclose posted realised/unrealised forex and open
  currency exposure.
- Verification: 353 tests (352 pass, 1 skipped); 1,286.4 kB build.

### 2026-11-21 — Phase 60: stock/WIP posting

- Production posts a balanced journal: components leave Stock in Hand for WIP,
  labour and overhead are capitalised, and finished goods return to Stock in Hand.
- Stock in Hand, Work in Progress, Production Labour and Production Overhead
  ledgers are created automatically; deleting a run removes its journal.
- Inventory reconciles the posted stock ledger against operational stock and
  shows the unposted opening/adjustment difference.
- Verification: production journal balances and deletion test; full suite 348
  tests (347 pass, 1 skipped); 1,257.9 kB build.

### 2026-11-21 — Phase 59: multiple instruments

- Vouchers accept an allocated instrument array with bank, number, date and
  amount; complete amount allocation is required when split.
- The voucher form adds and removes instrument rows, and the register targets
  manual status changes at the selected instrument.
- Instrument totals must reconcile to the bank-line total, the first instrument
  remains the compatible primary, and the register flattens every instrument.
- Verification: split-instrument payment, register rows and per-row status;
  full suite 347 tests (346 pass, 1 skipped); 1,247.8 kB build.

### 2026-11-21 — Phase 58: per-line TDS sections

- Taxable purchase/sales lines can select their own TDS/TCS section or be marked
  exempt; the voucher section remains the default.
- Deductions aggregate by section into one payable ledger line, and withholding
  summaries flatten the section breakdown.
- Verification: mixed 194C/194J purchase with an exempt line and withholding
  summary buckets; full suite 345 tests (344 pass, 1 skipped); 1,239.6 kB build.

### 2026-11-21 — Phase 57: per-line GST rates

- Ledger lines can carry their own GST rate while retaining the voucher-level
  default.
- GST is calculated per taxable line, then aggregated into CGST/SGST/IGST/Cess
  and stored as a rate breakup.
- GSTR-1/GSTR-3B rate rows split mixed-rate invoices instead of reporting the
  whole invoice under one rate.
- Verification: mixed 5% and 18% intra-state invoice, tax aggregation and return
  buckets; full suite 344 tests (343 pass, 1 skipped); 1,236.6 kB build.

### 2026-11-21 — Phase 56: alternate units

- Stock items can carry one alternate unit and a six-decimal conversion factor.
- Voucher item lines select the base or alternate unit; quantities convert to
  base stock while entered quantity/rate are retained.
- Line amounts are stored exactly and stock valuation uses them, avoiding
  conversion rounding drift.
- Verification: alternate-unit purchase conversion, base stock quantity and
  value; full suite 343 tests (342 pass, 1 skipped); 1,233.2 kB build.

### 2026-11-21 — Phase 55: payroll reversal

- A payroll run can be reversed with an opposite Journal, a reversal date and a
  link to the original run. A second reversal is refused, payroll summaries
  exclude reversed runs, and deleting the run removes both journals.
- Verification: payroll reversal test, full suite 342 tests (341 pass, 1 skipped),
  1,227.3 kB build.

### 2026-11-21 — Phase 54: architectural backlog pass

- BOMs now explode nested sub-assemblies into raw components, merge repeated
  components, reject recursive recipes and protect a sub-assembly BOM while a
  parent uses it.
- Cheque books store a bank, prefix, range and next number, reject overlapping
  ranges and block deletion while recorded instruments fall inside the range.
- Backup restore can replace one named company and keep the other current
  companies, while still snapshotting before the restore.
- Budgets can carry an optional four-quarter phasing that must equal the annual
  amount; Budget vs Actual exposes the phases and elapsed-quarter budget.
- Verification: full suite 341 tests (340 pass, 1 skipped); focused inventory,
  bank and budget suites (66 tests); 1,224.3 kB build.

### 2026-11-21 — Phase 53: cumulative local-backlog pass

- GST registration and party ledgers now carry optional phone/email, exported
  into draft e-invoice seller and buyer details.
- Altered vouchers now keep their own local draft, separate from a new voucher
  of the same type, and restore it when the voucher is reopened.
- TDS/TCS challans can record optional late fee and interest, with totals and a
  combined outlay in the withholding register.
- GST tax ledgers can be created or renamed from the registration panel without
  losing their role tags.
- Service ledgers can carry a SAC code; service-only GST invoices now feed the
  HSN/SAC summary, and the SAC flows into e-invoice lines.
- Bank auto-match accepts a configurable date window and amount tolerance and
  ranks candidates by narration-word overlap before date and amount.
- Optional employer PF/ESI rates are calculated and posted to the payable
  ledgers in the payroll journal.
- Credit/debit notes can link to one matching original invoice, shown in the
  GSTR-1 credit-note working paper.
- Open orders can be short-closed with the remaining quantity written off and
  an optional reason; reopening restores the remainder.
- Verification: full suite 339 tests (338 pass, 1 skipped), focused contact,
  draft, challan, GST ledger/SAC/link, bank, payroll and order tests; 1,204.1 kB
  build.

### 2026-11-21 — Phase 52: integrity and rate-window bundle

- Deleting a stock transfer is now refused when later destination-godown
  activity would make stock negative without it, including batch balances; a
  refused delete leaves every transfer untouched.
- Bill-register comparison totals settlements across every bill, including
  bills outside the selected bill period, and reports how many movement bills
  sit outside that period.
- GST rates support optional effective-from and effective-to dates, with date
  order validation, duplicate-window detection and a window display in the rate
  master; posted vouchers still keep their saved rate snapshot.
- TDS/TCS sections gained effective-date windows and a capped edit history, with
  date-window selection on vouchers and earlier rate/threshold values shown in
  the section master.
- Tax audit now calculates the digital-receipt percentage from bank versus cash
  receipts and flags whether the 95% test is met.
- Compliance tasks can carry late-fee and interest amounts, with totals shown on
  the calendar beside the overdue and due-soon counts.
- Verification: transfer dependency, all-bill movement total, GST rate window,
  TDS section window/history, digital-receipt and compliance late-fee tests; 335
  tests (334 pass, 1 skipped) and a 1,184.3 kB build.

### 2026-11-20 — Phase 51: compliance filing history

- Compliance tasks can store an optional filed-on date and acknowledgement or
  portal reference, shown in the task list and preserved through backups.
- These are local working notes; the app still does not file or fetch
  acknowledgements from any portal.
- Verification: validation, edit and backup round trip; 300 tests (299 pass,
  1 skipped) and a 1,044.1 kB build.

### 2026-11-20 — Phase 50: delivery notes and goods receipts

- Sales orders can produce delivery notes and purchase orders goods receipts
  carrying the remaining quantity, party, source order and value.
- Documents use a shared DN/GRN sequence and are explicitly non-posting: they do
  not move stock, create a voucher or acknowledge receipt.
- Verification: remaining-quantity copy, numbering, source link and unchanged
  stock; 300 tests (299 pass, 1 skipped) and a 1,042.6 kB build.

### 2026-11-20 — Phase 49: quotations

- Sales quotations carry party, validity date and the same item lines as an
  order, with their own QTN sequence and Open/Converted/Cancelled status.
- An open quotation converts to a linked sales order and retains the source
  quotation reference; conversion does not create a voucher or move stock.
- Verification: quotation creation, independent numbering, conversion and
  duplicate-conversion rejection; 299 tests (298 pass, 1 skipped) and a
  1,038.8 kB build.

### 2026-11-20 — Phase 48: attendance, wastage and consolidation

- Payroll runs accept paid days per employee, defaulting to the calendar days
  available between joining and exit; every earning and deduction is prorated
  against the month and impossible paid days are rejected.
- Production accepts a wastage quantity that consumes extra BOM components while
  finished-good output stays as entered, so wastage cost remains in finished
  goods and total stock value is preserved.
- A company consolidation report aggregates each company's income, expenses,
  assets, liabilities, receivables, payables and cash with combined totals,
  without inter-company elimination.
- Verification: paid-days proration and validation, wastage consumption/value,
  consolidation totals; 298 tests (297 pass, 1 skipped) and a 1,031.8 kB build.

### 2026-11-20 — Phase 47: forecasting and statutory working papers

- Treasury: a 30-day cash-flow forecast from cash/bank balances and open
  receivable/payable bills, bucketed into due-now, weekly and 15–30-day periods.
- Vouchers: recurring templates copied from posted vouchers with weekly, monthly,
  quarterly or yearly frequency; Use prefills a draft and never auto-posts.
- GST: a month-by-month financial-year working paper with outward taxable value,
  output tax, ITC and net tax, explicitly not GSTR-9 or a filing.
- TDS/TCS: a deductee-and-quarter certificate working paper with PAN, sections,
  base and tax, explicitly not a generated or TRACES-filed certificate.
- Verification: cash buckets, recurring validation, annual monthly totals and
  certificate grouping; full suite 295 tests (294 pass, 1 skipped) and a
  1,023.8 kB build.

### 2026-11-20 — Phase 46: operational depth bundle

- Inventory: approximate FIFO stock ageing by receipt bucket, and partial order
  fulfilment across multiple linked vouchers with remaining-quantity prefill.
- Receivables: optional party credit limits, over-limit and available-credit
  display, a printable payment reminder, and a simple overdue-interest working
  paper at each party's stored annual rate.
- Reporting: current-versus-previous-period P&L and an exception register for
  negative stock, over-limit customers, receivables over 90 days and late open
  orders.
- Masters: next-number control per voucher type without renumbering existing
  vouchers, plus credit-limit and interest-rate fields on ledgers.
- Verification: stock-age buckets, partial fulfilment/reopen, credit limit and
  over-limit, overdue interest, next-number validation, full suite 291 tests
  (290 pass, 1 skipped) and a 1,006.5 kB build.

### 2026-11-20 — Phase 45: compliance calendar

- A new Compliance calendar screen keeps user-managed GST, TDS, payroll and
  other filing tasks with due dates and notes. Open tasks are sorted by due date
  and flagged overdue or due within seven days; tasks can be edited, completed,
  reopened and deleted, with audit events and backup validation.
- The app does not calculate statutory due dates, file anything or store
  acknowledgements; the calendar is a reminder and working-note register.
- Verification: validation and category fallback, edit/status/delete flow and
  backup round trip; 286 tests (285 pass, 1 skipped) and a 982.5 kB build pass.

### 2026-11-20 — Phase 44: batch-level stock counts

- Physical stock counts now snapshot batch-tracked items lot by lot in the
  selected godown, with batch numbers stored on count lines and shown in the
  count register. An unlisted-lot row lets a counter record stock found outside
  the listed batches after naming the lot.
- Blank unlisted rows at zero count are skipped; duplicate item/batch lines and
  unlisted positive counts without a lot are rejected. Counts remain working
  papers and never move stock or post an adjustment.
- Verification: batch lot lookup, per-lot book/counted differences, unlisted lot
  handling, duplicate rejection and backup round trip; 285 tests (284 pass,
  1 skipped) and a 970.0 kB build pass.

### 2026-11-20 — Phase 43: e-way Part B details

- Outward sales invoices can store Part B transporter name, transporter ID,
  vehicle number and distance from the e-way register. Values are normalised,
  validated, included in the draft JSON and preserved through backups; stale or
  non-sales entries are dropped on load.
- The register shows separate Part A and Part B readiness, and the Part B gaps
  card counts invoices missing transporter/vehicle/distance details.
- Verification: save/readiness/payload, invalid voucher and distance, clearing
  and backup round trip; 284 tests (283 pass, 1 skipped) and a 966.1 kB build pass.

### 2026-11-20 — Phase 42: DD advice and deposit slips

- The instrument print screen now covers cheque payments, DD payments and
  receipt instruments. DD payments print an advice and receipts a deposit slip,
  both with payer/payee, amount in words and bank details; the voucher screen
  offers the matching print action.
- Verification: the build passes at 956.6 kB; no ledger or data logic changed.

### 2026-11-20 — Phase 41: physical stock counts

- Dated count sheets by godown snapshot each item's book quantity, default the
  counted quantity to it, and save counted quantities with the difference in a
  count register. Counts can be viewed and deleted without touching stock.
- Counts validate the date, financial year, godown, line limit, duplicate items
  and non-negative quantities; they survive backup normalisation.
- Verification: book-quantity snapshot and difference, empty godown, invalid
  lines, backup round trip and deletion; 284 tests (283 pass, 1 skipped) and a
  954.4 kB build pass.

### 2026-11-20 — Phase 40: statement balance validation

- Bank statement import can take optional opening and closing balances; both
  are required together and must be valid amounts. They are stored with the
  statement and survive backup normalisation.
- Bank Reconciliation shows the balances, statement movement and the difference,
  with a warning when opening plus movement does not equal closing.
- Verification: balanced and unbalanced statements, one-sided and non-numeric
  balances, no-balance import and backup round trip; 283 tests (282 pass, 1
  skipped) and a 940.0 kB build pass.

### 2026-11-20 — Phase 39: stock reorder levels

- Stock items carry an optional reorder level (zero clears it), editable in the
  item form and validated as a non-negative quantity.
- Stock Summary shows the reorder level, a Low badge and a warning line whenever
  closing quantity is at or below the level; the item master table shows the
  level too.
- Verification: low/adequate/cleared levels, invalid negative level and summary
  flags; 282 tests (281 pass, 1 skipped) and a 937.0 kB build pass.

### 2026-11-20 — Phase 38: manual instrument statuses

- A cheque/DD in the register can be marked cleared, stopped or cancelled, or
  restored to the automatic status (post-dated/due/bank-reconciliation cleared).
  The flag is stored on the instrument, survives voucher edits and backup import,
  and never changes the voucher or posts entries.
- The register adds status filters and counts for stopped/cancelled instruments
  and keeps the manual status visible in the row.
- Verification: status transitions and counts, filtering, voucher-edit
  preservation, invalid/missing cases and backup round trip; 281 tests (280 pass,
  1 skipped) and a 935.7 kB build pass.

### 2026-11-20 — Phase 37: salary bank-transfer file

- Employees can store an optional bank name, account number (6–20 digits) and
  IFSC, validated on add/update and preserved through backup import.
- A payroll run can export a CSV bank-transfer working file with month,
  employee, code, bank, account, IFSC and net pay. Employees without bank
  details are included with blank fields and named in a warning.
- Verification: field validation, cleaned account/IFSC values, transfer rows and
  missing-detail list, missing run and backup round trip; 279 tests (278 pass, 1
  skipped) and a 932.0 kB build pass.

### 2026-11-20 — Phase 36: editable TDS/TCS sections

- A TDS/TCS section's description, rate and threshold can be edited in place,
  with the 0–100% rate bound and non-negative threshold rule. Kind and code stay
  fixed, and posted vouchers keep their saved rate/label snapshot.
- The section master gains Edit and Cancel actions with a prefilled form; an
  empty description falls back to the section code.
- Verification: edit, posted-voucher snapshot, invalid rate/threshold and
  missing-section cases; 278 tests (277 pass, 1 skipped) and a 926.8 kB build
  pass.

### 2026-11-20 — Phase 35: HSN summary by unit

- The GSTR-1 HSN/SAC summary now groups stock lines by HSN/SAC and unit quantity
  code (UQC) instead of summing quantities across mixed units, using the same
  symbol-to-UQC mapping as e-invoice and e-way drafts (OTH fallback).
- The summary table shows the UQC column, and the existing totals still add up
  across rows.
- Verification: a single invoice with two items sharing an HSN but using Nos and
  Kg produces two rows with separate quantities and apportioned tax; 277 tests
  (276 pass, 1 skipped) and a 924.6 kB build pass.

### 2026-11-20 — Phase 34: editable cost masters

- Cost categories can be renamed and cost centres renamed or moved to another
  category, with the usual non-empty and unique-name checks. Voucher lines, cost
  centre budgets and reports keep pointing at the same IDs.
- The cost-centre master screen gains Edit and Cancel actions and prefilled
  forms; duplicate names are rejected case-insensitively.
- Verification: rename, duplicate, empty name, missing master, move category,
  invalid category and allocation preservation; 276 tests (275 pass, 1 skipped)
  and a 924.4 kB build pass.

### 2026-11-20 — Phase 33: joining and exit proration

- Employees can carry an optional date of exit (validated as a real date not
  before joining), shown in the employee form and payslip.
- A payroll run now prorates every earning and deduction by calendar days when
  an employee joins or exits inside the payroll month, recording
  `workedDays`/`monthDays` on the row. Employees who did not work that month are
  skipped, and a run with no remaining rows fails with a clear message.
- Verification: mid-month joining and exit totals away from full-month pay,
  exit-before-month skipping, exit-date validation and backup round trip; 275
  tests (274 pass, 1 skipped) and a 920.5 kB build pass.

### 2026-11-20 — Phase 32: editable GST rates

- The GST rate master now supports editing the label, rate and cess in place,
  with the same 0–50% bounds and unique rate/cess rule as adding. Posted
  vouchers keep the rate snapshot they were saved with.
- Editing a rate still in use is allowed; deleting one still needs zero vouchers,
  and an empty label falls back to the computed rate label.
- Verification: edit, duplicate, bounds, missing rate, relabel and
  posted-voucher-snapshot cases; 273 tests (272 pass, 1 skipped) and a 918.1 kB build pass.

### 2026-11-20 — Phase 31: cost-centre budgets

- Budget targets now include cost centres. The master picker lists them under
  their own group, and Budget vs Actual measures spend from voucher lines tagged
  to the centre (debit less credit) rather than all ledger activity.
- One budget per target/year, edit, duplicate-next-year and name rules apply to
  cost-centre budgets too; they are independent targets, so they are never
  treated as nested.
- Verification: tagged-vs-untagged spend, variance, duplicate and missing-centre
  cases; 272 tests (271 pass, 1 skipped) and a 915.9 kB build pass.

### 2026-11-20 — Phase 30: no double-counted budget totals

- Budget vs Actual still lists every budget, but totals now use only top-level
  targets: a ledger budget inside a budgeted group, or a subgroup inside a
  budgeted parent, is marked "Inside a group budget" and left out of the totals.
- Over-budget counts still consider every row, so a nested budget can still be
  flagged even though it does not inflate the summary cards.
- Verification: three-budget overlap, nested flags, row count and top-level total;
  271 tests (270 pass, 1 skipped) and a 914.8 kB build pass.

### 2026-11-20 — Phase 29: bill register status date

- The bill-wise register now has a separate status-as-on date, so a bill period
  can end in April while settlement and overdue status are reviewed at a later
  date. An invalid date falls back to the period end.
- The report caption, overdue days and totals follow the as-on date while the
  listed bills still come from the bill-date period.
- Verification: open-at-period-end, settled-after-receipt, fallback and existing
  register cases; 270 tests (269 pass, 1 skipped) and a 913.7 kB build pass.

### 2026-11-20 — Phase 28: exchange-rate history editing

- The currency master now lists every dated rate and can edit its value, move it
  to another date (rejecting a date that already has a rate) or delete it. Rates
  stay sorted and are still applied as the latest rate on or before a voucher.
- Base-currency and missing-rate edits are rejected, and future vouchers simply
  fall back to the previous rate when a later one is deleted.
- Verification: edit, redate, sort, clash, invalid date/rate, missing rate and
  deletion cases; 269 tests (268 pass, 1 skipped) and a 913.3 kB build pass.

### 2026-11-20 — Phase 27: budget editing and duplication

- Budget masters can now be edited in place (name, target, year and amount) and
  duplicated into the next financial year at the same amount, with the target
  year appended to the name when the name is free.
- Edit saves still enforce one budget per target per year and unique names; a
  duplicate refuses to overwrite an existing target/year and asks for the next
  financial year to exist first.
- Verification: edit, clash, invalid amount, no-next-year, duplicate, repeat and
  explicit-year cases; 268 tests (267 pass, 1 skipped) and a 908.4 kB build pass.

### 2026-11-20 — Phase 26: unfinished-voucher recovery

- A new voucher draft is written to browser storage shortly after typing stops
  and restored when the same company and voucher type are reopened, with a
  "Restored your unsaved voucher draft" notice. Saving clears it.
- The draft key is per company and voucher type, is size-capped, and ignores
  corrupt or mismatched payloads. Editing an existing voucher, or working in a
  browser without storage, simply skips the feature.
- Verification: read/ignore/oversize/clear helper tests, full suite and build;
  267 tests (266 pass, 1 skipped) and a 902.8 kB build pass. The browser UI wiring
  itself has no automated test.

### 2026-11-20 — Phase 25: expiring-batch report

- Inventory now shows batches with stock whose expiry falls within 90 days of
  the report end date, including already-expired lots, sorted by expiry, with
  days remaining, quantity and value at risk.
- The report reads the same batch balances as the batch panel, so opening
  batches, purchases, sales, transfers and production output all count.
- Verification: upcoming, expired and wide-window cases; 264 tests (263 pass,
  1 skipped) and a 900.7 kB build pass.

### 2026-11-20 — Phase 24: editable opening batches

- Stock items can now have their opening stock split across batch names, with
  optional expiry dates, directly in the item form instead of only through a
  Tally import. Adding rows switches the item to batch tracking.
- The items table shows how many opening batches an item has. Clearing every
  row removes the split and falls back to the `Opening` batch; changing the
  opening quantity without matching rows drops the stale split.
- Verification: existing opening-batch store and batch-balance tests still
  pass, and the browser build includes the new form rows; 263 tests (262 pass,
  1 skipped) and a 897.6 kB build pass.

### 2026-11-20 — Phase 23: multi-line orders

- Sales and purchase orders now carry up to 50 item lines instead of one, each
  with its own item, godown, batch, expiry, quantity and rate. The order total
  is the sum of the line amounts.
- Every line is validated before anything is written, so a missing item, zero
  quantity, invalid rate, godown, batch or expiry rejects the whole order.
- The order form has add/remove line rows, the register lists every item and
  quantity, and Create voucher copies all lines into the prefilled voucher.
- Verification: line validation, line amounts/total and a single-item
  compatibility test; 263 tests (262 pass, 1 skipped) and a 895.4 kB build pass.

### 2026-11-20 — Phase 22: order-to-voucher linking

- A voucher created from an order now stores `orderId`, closes the order when
  the voucher is accepted and reopens it if that voucher is deleted.
- The link is validated before writing: the order must exist, be open, match the
  voucher type and not already be linked. A pending-approval voucher keeps the
  order open until it is approved.
- A linked order cannot be deleted; delete its voucher first. Changing a linked
  voucher to the other type is rejected.
- The voucher form shows the order it came from, and the order register already
  hides Create voucher once an order is closed.
- Verification: link/close/reopen, duplicate link, type mismatch and delete
  guard tests; 262 tests (261 pass, 1 skipped) and an 893.0 kB build pass.

### 2026-11-20 — Phase 21: Tally batch masters and opening batches

- Tally `<BATCH>` masters import with their stock item, opening quantity,
  opening rate and expiry date. Each imported item is marked batch-tracked and
  its opening stock is split into those batches instead of one `Opening` row.
- Added `openingBatches` to stock items. Opening stock remains one total;
  batch splits must add up to it, and `stockOnHand`/batch balances read the
  split by batch. Editing an item's opening quantity drops a stale split back to
  the `Opening` batch rather than leaving mismatched quantities.
- Import validation rejects unknown stock-item parents, duplicate batch names,
  non-positive quantities and invalid expiry dates before writing anything.
- Verification: batch master import, expiry, per-batch balances, all-or-nothing
  rejection and opening-quantity edit tests; 261 tests (260 pass, 1 skipped) and
  a 890.6 kB build pass.

### 2026-11-20 — Phase 20: multi-line stock transfers

- A stock transfer now carries up to 50 item lines instead of one item. Each
  line has its own item, batch and quantity, and repeated item/batch pairs merge
  so stock is checked once per batch.
- Every line is validated against the source godown before anything is written,
  so one short line rejects the whole transfer. The single-item call shape still
  works for old callers and backups.
- The Inventory transfer form gained add/remove line rows, and the transfer
  register lists every line and quantity.
- Verification: multi-line validation, duplicate merging, godown balances and
  backup round-trip tests; 258 tests (257 pass, 1 skipped) and an 883.1 kB build
  pass.

### 2026-11-20 — Phase 19: BOM, production and tax-challan normalization

- Moved BOMs, production runs and TDS/TCS challans out of the generic collection
  table into `boms`, `manufactures` and `tax_challans`.
- BOM name, output item and output quantity; production run number, date, BOM
  link, component/output godowns, output item/quantity, batch and expiry; and
  challan kind, date, amount, reference, BSR code and section are typed
  columns. Components and other nested detail stay JSON.
- Raised the schema to version 11. A version-10 database migrates in place; an
  empty `company_records` table remains only for older backups.
- Verification: v10-to-v11 migration, nested component preservation, write-side
  synchronization and full round-trip tests; 257 tests (256 pass, 1 skipped)
  and an 880.5 kB build pass.

### 2026-11-20 — Phase 18: stock-transfer and order normalization

- Moved stock transfers and sales/purchase orders into dedicated
  `stock_transfers` and `orders` tables. Transfer number, date, source and
  destination godown and narration; order type, number, date, party, delivery
  date, total, status and narration are typed columns.
- Raised the schema to version 10. Version-9 databases migrate in place; the
  transfer and order line JSON is preserved because lines are still read by the
  stock and order registers as a single object.
- Verification: v9-to-v10 migration, line preservation, typed column restoration
  and full round-trip tests; 256 tests (255 pass, 1 skipped) and an 880.5 kB
  build pass.

### 2026-11-20 — Phase 17: budget and currency normalization

- Moved budgets and currencies out of the generic `company_records` collection
  table into dedicated `budgets` and `currencies` tables. Budget names, targets,
  financial-year links and amounts, and currency codes, names and symbols are
  typed columns; creation times are typed too. Remaining record JSON is kept as
  a compatibility fallback, including currency rate history.
- Raised the normalized SQLite schema to version 9. Version-8 databases migrate
  in place: both collections are read from the old collection rows, written to
  the new tables, and the old rows are removed.
- Reads preserve budget and currency order and rebuild the same arrays used by
  budget variance, forex entry, voucher conversion and guarded deletes. Backups
  without the new tables still fall back to `company_records` and company JSON.
- Postgres remains one JSONB workspace document; this phase changes SQLite
  storage only.
- Verification: v8-to-v9 migration, typed target/amount/code restoration, JSON
  stripping, rate-history preservation, unpromoted JSON preservation,
  write-side synchronization and full round-trip tests; 255 tests (254 pass, 1
  skipped) and an 880.5 kB single-file build pass.

### 2026-11-20 — Phase 16: inventory-master normalization

- Moved units, stock groups and godowns out of the generic `company_records`
  collection table into dedicated `units`, `stock_groups` and `godowns` tables.
  Unit names and symbols, master names and primary flags are typed columns; the
  remaining record JSON is kept as a compatibility fallback for unpromoted
  fields such as imported group codes.
- Raised the normalized SQLite schema to version 8. Version-7 databases migrate
  in place: all three masters are read from the old collection rows, written to
  the new tables, and the old rows are removed.
- Reads preserve unit, stock-group and godown order and rebuild the same arrays
  used by item entry, transfers, orders and production. Backups without the new
  tables still fall back to `company_records` and company JSON.
- Postgres remains one JSONB workspace document; this phase changes SQLite
  storage only.
- Verification: v7-to-v8 migration, typed name/symbol/primary restoration, JSON
  stripping, unpromoted JSON preservation, write-side synchronization and full
  round-trip tests; 254 tests (253 pass, 1 skipped) and an 880.5 kB single-file
  build pass.

### 2026-11-20 — Phase 15: cost-master normalization

- Moved cost categories and cost centres out of the generic `company_records`
  collection table into dedicated `cost_categories` and `cost_centres` tables.
  Names, centre category links and creation times are typed columns; the
  remaining record JSON is kept as a compatibility fallback.
- Raised the normalized SQLite schema to version 7. Version-6 databases migrate
  in place: both masters are read from the old collection rows, written to the
  new tables, and the old rows are removed.
- Reads preserve category and centre order and rebuild the same arrays used by
  cost-centre entry, summaries and guarded deletes. Backups without the new
  tables still fall back to `company_records` and company JSON.
- Postgres remains one JSONB workspace document; this phase changes SQLite
  storage only.
- Verification: v6-to-v7 migration, typed name/category/creation restoration,
  JSON  stripping, write-side synchronization and full round-trip tests; 253 tests
  (252 pass, 1 skipped) and an 880.5 kB single-file build pass.

### 2026-11-20 — Phase 14: financial-year normalization

- Moved financial years out of the generic `company_records` collection table
  into a dedicated `financial_years` table with typed start date, end date and
  closed flag columns. Year JSON now holds only unpromoted fields.
- Raised the normalized SQLite schema to version 6. Version-5 databases migrate
  in place: years are read from the old collection rows, written to the new
  table, and the old rows are removed. Backups without the new table still fall
  back to `company_records` and company JSON.
- Reads preserve financial-year order and reconstruct the same `years` array and
  closed/open state for the accounting engine.
- Postgres remains one JSONB workspace document; this phase changes SQLite
  storage only.
- Verification: v5-to-v6 migration, typed date/closed restoration, JSON
  stripping, write-side synchronization and full round-trip tests; 252 tests
  (251 pass, 1 skipped) and an 880.5 kB single-file build pass.

### 2026-11-20 — Phase 13: account-group normalization

- Moved account groups out of the generic `company_records` collection table
  into a dedicated `account_groups` table with typed name, parent, nature and
  key columns. Group JSON now holds only fields that are not promoted.
- Raised the normalized SQLite schema to version 5. Version-4 databases are
  migrated in place: groups are read from the old collection rows, written to
  the new table, and the old rows are removed. Backups without the new table
  still fall back to `company_records` and company JSON.
- Reads prefer `account_groups`, including parent-child ordering, while the
  reconstructed company object keeps the same shape for the accounting engine.
- Postgres remains one JSONB workspace document; this phase changes SQLite
  storage only.
- Verification: v4-to-v5 migration, empty-group preservation, JSON fallback,
  write-side synchronization and full round-trip tests; 251/251 engine tests and
  an 880.5 kB single-file build pass.

### 2026-11-20 — Phase 12: company and stock-item column promotion

- Made the existing company-header and stock-item columns authoritative instead
  of leaving duplicate values in JSON. Company name, financial-year dates,
  current year and creation time, plus each stock item's identity, group, unit,
  HSN, opening quantity/rate, batch flag and creation time, now come from typed
  SQLite columns.
- Raised the normalized SQLite schema to version 4. Rows written by versions 2
  and 3 are re-written during migration, while reads fall back to JSON when a
  column is empty so old rows and old backups remain readable.
- The stock-item read path now actually uses `stock_items` columns; previously
  it reconstructed items from JSON even though the columns were populated.
- Postgres still stores the whole workspace as one JSONB document; this phase
  changes the normalized SQLite layout only.
- Verification: v3 migration with null stock-item columns and company creation
  time, JSON fallback, write-side synchronization and full round-trip tests;
  250/250 engine tests and an 880.5 kB single-file build pass.

### 2026-11-20 — Phase 11: ledger master-column promotion

- Promoted ledger opening, opening type, GSTIN, GST state, PAN, address, city,
  PIN, GST role and creation time into typed SQLite columns. The remaining
  ledger fields stay in its JSON row, so older data and the accounting engine
  keep their shape.
- Raised the normalized SQLite schema to version 3. Existing databases add the
  columns in place and are re-written from the JSON fallback during migration;
  no backup restore or manual migration is required.
- Reads prefer the typed columns but fall back to old JSON when a column is
  empty, which keeps pre-promotion rows and restored backups readable.
- Postgres continues to store the whole workspace as one JSONB document; this
  phase changes the normalized SQLite layout only.
- Verification: schema-v2 promotion, JSON fallback, write-side column sync and
  full round-trip tests; 249/249 engine tests and an 880.5 kB single-file build
  pass.

### 2026-11-20 — Phase 10: encrypted server backups

- New SQLite and Postgres server backup files are encrypted at rest when
  `ZL_BACKUP_PASSPHRASE` (12+ characters) is configured. The server derives a
  key with scrypt and seals each file with AES-256-GCM, including R2 uploads.
- Encrypted backups use a `.enc` suffix, keep downloads encrypted, and restore
  only with the same passphrase. Existing plaintext backups still restore.
- The owner backup panel marks encrypted files and explains whether encryption
  is configured. Plaintext temporary files from interrupted encrypted
  backup/restore runs are cleaned up instead of being listed or served.
- Missing keys fail restore with a clear error rather than falling back to
  plaintext. The live SQLite/Postgres workspace is still not encrypted.
- Verification: server backup crypto and end-to-end encrypted create/list/
  download/restore-without-key tests; 247/247 engine tests and an 880.5 kB
  single-file build pass.

### 2026-11-20 — Phase 9: encrypted backup downloads

- Added a passphrase-encrypted JSON backup download to **Backup & restore**.
  The browser uses PBKDF2-SHA-256 and AES-256-GCM through Web Crypto, stores no
  passphrase and keeps the live SQLite/Postgres workspace unchanged. Encrypted
  download requires HTTPS or localhost; a plain-HTTP LAN page explains why the
  form is unavailable.
- Restore accepts plain or encrypted backups and reports a wrong passphrase or
  modified file without changing current books.
- Added round-trip, fresh-salt/IV, wrong-passphrase, tamper-detection and
  parameter-validation tests. This was the first app-level-encryption slice;
  Phase 10 added optional server/R2 backup encryption, while the live workspace
  remains unencrypted at rest.

### 2026-11-19 — Phase 8: API usage visibility

- API token rows retain rate-limit windows for 24 hours and aggregate them into
  request counts for the last 24 hours and current hour.
- The owner token panel shows both counts, making integration activity visible
  without storing request paths or response bodies.

### 2026-11-19 — Phase 7: approval thresholds

- Companies can keep approval for every staff voucher (`0`) or require it only
  at or above a configured amount; smaller vouchers post directly.
- The submission UI applies the threshold and the server recomputes voucher
  totals, rejects direct postings at or above it, and blocks accountants from
  changing the policy. The API company payload exposes the threshold.

### 2026-11-19 — Phase 6: multi-user merge visibility

- Accepted stale saves now record a hash-chained `workspace.merge` event with
  the field paths submitted, changed on the server, and set by both sides.
- Owners can see which companies, collections and record ids were auto-merged
  in the server audit instead of only a generic merged flag.

### 2026-11-19 — Phase 4D: pending voucher revision

- The submitter can revise or withdraw an undecided voucher from the approval
  queue. The server keeps the id, submitter and submission time fixed, rejects
  a voucher number before approval, and still blocks edits to another person's
  submission.
- Revised pending vouchers remain outside posted books and reports until an
  owner approves them. Each revision stores changed fields with old/new values
  and editor attribution; the queue shows a collapsible history and the server
  rejects rewriting earlier entries.

### 2026-11-19 — Phase 5A: scoped API tokens and shared limits

- API tokens can be restricted to selected companies; `/api/v1` responses are
  filtered and out-of-scope company ids return 404.
- API rate-limit windows are stored in SQLite/Postgres, so multiple function
  instances share one per-token budget. `ZL_API_RATE_LIMIT` sets the limit.
- The owner token form now chooses all or selected companies, and the OpenAPI
  contract describes company restrictions.

### 2026-11-19 — Phase 4C: read-only API and OpenAPI

- Added owner-created API tokens stored as SHA-256 hashes in SQLite/Postgres,
  with the `books:read` scope and a 120-requests/minute per-token limit.
- Added versioned `/api/v1` read endpoints for companies, trial balance,
  outstanding parties and paginated posted vouchers, plus an OpenAPI 3.0.3
  contract at `/api/v1/openapi.json`.
- Token revocation is immediate, tokens are shown once, and create/revoke events
  join the hash-chained server audit. The API remains read-only.

### 2026-11-19 — Phase 4B: voucher approvals

- Added a per-company owner-approval policy and a separate pending-voucher
  queue, so unapproved staff vouchers never enter posted books or reports.
- Owners approve or reject with attribution; proposers cannot decide their own
  vouchers. The server blocks accountant direct posting while approvals are on.
- Pending vouchers can now be revised or withdrawn by their submitter; there
  is still no multi-level approval matrix or dedicated pending-queue merge
  policy, so the normal workspace conflict flow applies.

### 2026-11-19 — Phase 4A: per-account MFA requirement (SQLite/LAN)

- Added `require_mfa` to SQLite/LAN accounts, with an owner control to require
  enrolled TOTP and block sign-in if enrollment is missing.
- Disabling 2FA is rejected while required; recovery codes clear both MFA and
  the requirement to avoid locking the account out.
- The policy is unavailable in Neon Managed Auth mode and the route returns 501.

### 2026-11-19 — Phase 3: scheduled daily reports and alerts

- Added a signed, expiring read-only daily management summary rendered from the
  live workspace. Links default to seven days and reject tampered/expired
  tokens.
- Added owner settings for recipients/enabled, send-now and preview, plus
  `report_settings`/`zl_report_settings` persistence.
- Declared a Neon Function Trigger (`30 2 * * *` UTC) that runs the daily backup
  check and report delivery; local/LAN servers use an hourly due check.
- Resend delivers the summary; no full workspace dump is built in a Worker cron.
- Persisted report attempt time/error in SQLite and Postgres and surfaced the
  latest failure beside the owner report controls; live production delivery was
  accepted by Resend for the test recipient.
- A failed scheduled report now sends one Resend alert per UTC day to the
  configured operations address.
- Added a dependency-free branded PDF summary and attached it to report emails.
- Added recent report-attempt history with source, recipients, result and error,
  retained in SQLite/Postgres and shown in the owner panel.
- Added matching backup-attempt history for manual/daily runs, offsite warnings
  and failures, with the newest ten attempts shown beside the backup list.
- Verification: report unit and API tests pass, including signed-link retrieval,
  Resend payload, outage error and failure alert, scheduler authorization and
  Postgres settings persistence.

### 2026-11-19 — Shared source limits and durable R2 recovery

- Moved short login/reset IP limits from process memory into the shared auth
  store. SQLite and Postgres use the same options; Postgres instances now block
  each other's abusers instead of each keeping a separate counter.
- Added signed R2 list/download/delete support and merged remote objects into
  the owner backup list. Restore now downloads and verifies an R2 snapshot when
  the current instance has no local copy.
- Verification: focused auth/cloud tests pass, including cross-instance
  Postgres rate limiting and remote-only backup restore.

### 2026-11-19 — Phase 2: Neon Function and production API

- Exported `requestHandler` from `serve.mjs` and guarded `server.listen` so the
  same Node API runs as a Neon Function; `neon-function.mjs` translates Web
  `Request`/`Response` to the existing handler.
- Added `neon.ts` function declarations and environment bindings; deployed
  `zledgercraft` to Neon branch `production` (Node 24, `aws-us-east-2`).
- Added `cf-api-worker.mjs` and `wrangler.toml` to proxy
  `books.lengkhawm.online/api/*` to the function with forwarded host/protocol,
  secure cookies and HSTS.
- Added `npm run test:neon`: creates a temporary Neon branch, runs the Postgres
  workspace integration test against it and deletes the branch. Added the
  production smoke test through the custom domain.
- Verification: production register/login/session/workspace passed; a branch
  Postgres save/reload/lease/audit test passed; `npm test` passed 219 with one
  conditional branch-test skip, and `npm run test:neon` passed against a fresh
  branch; static build 835.7 kB. Smoke users and test workspace rows were
  removed, leaving an empty production workspace.

### 2026-11-19 — Optional R2 backups, Resend reset email and Pages output

- Added `server-r2.js` with dependency-free SigV4 signing and R2 S3 uploads of
  verified SQLite snapshots. Failed uploads keep the local backup and can email
  `ZL_ALERT_EMAIL` through Resend.
- Added optional account emails and a hashed, single-use, 30-minute
  forgot-password flow. `POST /api/auth/forgot` and `/api/auth/reset` return
  generic responses, rate-limit reset requests and revoke sessions on use.
- Added login-screen forgot/reset forms and owner controls for account email.
- `node build.mjs` now emits `dist/index.html` for Cloudflare Pages as well as
  `dist/ZledgerCraft.html`.
- Verification: 219/219 engine tests; Chromium and Firefox pass 117 core + 105
  advanced + 7 render + 9 login/reset + 6 axe screens + workspace merge; build
  833.0 kB. The full trace is in `docs/CLOUD_INTEGRATION_PLAN.md`.

### 2026-11-19 — Collection rows, leases, paging and import hardening

- Raised the SQLite workspace schema to v2 and migrated v1 workspaces.
  Companies, ledgers, vouchers and lines stay relational; every remaining
  top-level company collection now gets one ordered `company_records` row per
  record, and stock items get a dedicated `stock_items` table for inventory
  queries.
- Added hashed, expiring voucher leases with acquire/renew/release endpoints.
  The UI renews while a voucher is open and releases on save/cancel; a changed
  voucher leased by another session is rejected with HTTP 423 and a clear
  conflict screen. Leases are enforced server-side.
- Split the 5,073-line screen module into coherent screen, report, inventory,
  tax, payroll, banking and admin modules without changing function names.
- Paged the Day Book at 100/250/500/all rows with a total count. CSV and Excel
  exports still use the full filtered period. A 10,000-voucher Day Book render
  measured a 35.5 ms median after paging (roughly 1.5–2.0 s before).
- Added a dev-only `tools/browser` Playwright/axe/benchmark workspace, a
  Chromium/Firefox/WebKit CI matrix and the existing browser suites there.
- Hardened CSV, Tally XML and XLSX imports: unclosed quotes, text after a
  quote, duplicate/empty headers, impossible Tally dates, invalid XML entities,
  ZIP duplicate entries and cells beyond Excel's 16,384-column limit now fail
  with clear errors. Added real CSV/Tally fixtures and deterministic malformed
  input/fuzz tests.
- Verification: 207/207 engine tests; Chromium and Firefox browser suites pass
  (117 core + 105 advanced + 7 render + 6 axe screens + workspace merge); the
  10,000-voucher benchmark passes; build 827.0 kB.

### 2026-11-19 — Audit remediation

- Fixed the malformed-`Host` request that crashed the server; added a raw-socket
  regression test.
- Added CSP, `nosniff`, frame denial, referrer, permissions and TLS-only HSTS
  headers to static, JSON, download and error responses.
- Added a hash-chained server-event audit for account create/update/delete,
  password reset/change, session revocation, MFA changes, workspace clear,
  restore and manual backup. Shown to owners beside the save audit.
- Made TOTP codes single-use by persisting the last accepted counter. Replayed
  sign-ins are rejected; password changes consume the next time step.
- Fixed 390px document overflow across all 31 screens: contained report tables,
  labelled voucher line cards on phones, a two-column voucher type grid, an
  active-item-scrolling nav and AA contrast for warnings and side notes.
- Added a skip link, screen-level h1s, per-screen document titles, accessible
  names, focus-visible styling and mobile touch targets.
- Fixed the login `CRAFT` wordmark, undefined `--muted`, reduced-motion handling,
  transient login-map growth, static symlink escapes and reflected 404 text.
- Split `ui.js` into a router/handler module, `ui-screens.js` for all 81 screen
  renderers, `ui-constants.js` for navigation/labels and `ui-server.js` for the
  owner server panel. The screen module reads live state from `ui.js`; the
  single-file build order is explicit.
- Verification: 195 engine tests, 27 browser suites, 31-screen responsive sweep
  at 1440/1024/768/390 and a clean single-file build (815.8 kB).

### 2026-11-19 — Server restore, sessions and MFA

- Added owner-only restore for server backups. Restore verifies the snapshot,
  writes it atomically, preserves server accounts, and creates a pre-restore
  SQLite backup first.
- Added active-session listing/revocation and self-service password changes.
  Passwords now use a new session after the change and revoke the old sessions.
- Added persistent lockout for ten failed sign-ins per account/source in a
  fifteen-minute window, alongside the short per-IP rate limit.
- Added TOTP two-step verification with a one-time recovery code. Owners enable
  it per account and receive the secret/URI once; recovery disables MFA so the
  account can re-enroll.
- Added an optional IPv4/CIDR allowlist (`ZL_ALLOWED_IPS`), enforced for every
  HTTP request.
- Hash-chained the server save audit and added chain verification to the owner
  audit view. This is tamper-evident, not immutable against a database
  administrator.
- All 195 engine tests and 27 browser suites pass; build 815.8 kB.

### 2026-11-19 — Company scopes, scoped merge and server operations

- Added nullable company scopes to server accounts. Owners choose all, selected
  or no companies; the server filters workspace reads, audit and company lists,
  rejects forged hidden-company writes, and preserves hidden companies on save.
  Existing accounts and accounts created without a scope retain all access.
- Enabled conservative three-way merge for company-scoped stale saves. The
  merge runs only over visible companies and current hidden companies are
  preserved; same-field conflicts still return the normal reload response.
- Added verified daily SQLite backups with retention and owner manual backups,
  plus owner-only backup listing, download and restore. Restore creates a
  pre-restore snapshot, replaces books atomically and preserves server
  accounts. These copies stay on the server; an owner can download one for
  separate storage.
- Added server-side sign-in history, per-account session sign-out and an
  owner-only view of the server save audit. Login failures are rate-limited and
  recorded without passwords.
- Added engine tests for account scopes, cross-company reads/writes, scoped
  merge, login events, session revocation and backup creation. All 190 engine
  tests, 26 browser suites and a LAN admin smoke test pass; build 798.5 kB.

### 2026-11-19 — Conservative workspace merge

- Added `server-merge.js`: a conservative three-way merge for stale workspace
  saves. Arrays with stable ids merge by id; objects merge field-by-field;
  voucher lines and other unkeyed arrays are treated as atomic, so overlapping
  edits conflict instead of being guessed.
- Added `workspace_revisions` history retention for the last 20 revisions. The
  server now merges a stale save against the retained base revision, returns the
  merged state to the client, and keeps the conflict/reload path when history
  is unavailable or changes overlap.
- Concurrent additions of the same voucher type and number are renumbered in
  the merged workspace, and the client reports how many numbers changed.
- Fixed the workspace snapshot path so `exportedAt` no longer creates false
  merge conflicts.
- Added merge unit tests for independent additions, same-record field merges,
  deletion conflicts, atomic voucher lines, audit merging and renumbering; the
  HTTP test now covers two stale sessions. All 187 engine tests and 26 browser
  suites pass; build 786.1 kB and the offline dist check pass.

### 2026-11-19 — Normalized SQLite storage

- Added `server-workspace.js`: companies, ledgers, vouchers and voucher lines
  are canonical relational rows; company subsidiary masters and top-level
  profile/audit records retain their JSON shape so the existing accounting
  engine continues to work unchanged.
- Added a one-time migration from the old whole-workspace blob and legacy
  `workspace.json`; the old blob row is removed after a successful migration so
  stale books cannot be resurrected. Clearing the workspace removes both the
  normalized rows and the legacy row.
- Workspace writes remain revision-checked and transactional, with the server
  save-audit row written in the same transaction as the normalized replacement.
  Non-owner role validation still runs against the previous reconstructed
  workspace.
- Added storage round-trip, migration, conflict, rollback and legacy-removal
  tests. All 179 engine tests and 26 browser suites pass.

### 2026-11-19 — LAN multi-user access

- Added `server-auth.js`: scrypt password hashes, SQLite `auth_users` and
  `auth_sessions` tables, 7-day HttpOnly sessions, owner/accountant/viewer
  account management, and guards against deleting the last owner or the
  signed-in account.
- LAN mode now binds to a non-loopback `HOST`, requires a server account and
  seeds the first owner from `ZL_OWNER_PASSWORD`. `ZL_AUTH=1` enables the same
  login flow on localhost; the existing localhost workflow remains available
  without a login.
- Workspace reads and writes require a session in LAN mode. Viewers are
  read-only; accountants cannot change users, companies, financial years or
  audit history; owner-only workspace clears remain enforced server-side.
- Added a login screen, session-expiry return to login, server account panel,
  owner/accountant/viewer labels, disabled browser book mirroring and snapshots
  in LAN mode, and optional `TLS_CERT_PATH`/`TLS_KEY_PATH` support.
- Added HTTP API and auth-store tests, including static data-file denial and
  server-side role checks. All 175 engine tests and 26 browser suites pass;
  single-file build 785.3 kB and the offline dist check passes.

### 2026-11-18 — Local monthly MIS

- Added a monthly MIS panel to Statistics: twelve financial-year columns, a
  sales/purchase bar chart, sales and purchase returns, net sales/purchases,
  receipts, payments, net cash and a financial-year total row.
- Kept it dependency-free with CSS bars on the existing report surface; Print and
  CSV use the normal report toolbar.
- Extended the statistics engine test for monthly sales, purchases, receipts,
  payments and credit notes (all 168 engine tests and 26 browser suites pass;
  build 752.7 kB).
- Tightened the small-screen header so the Statistics/MIS view has no document
  overflow at 390 px; the MIS table remains horizontally scrollable.
- Added top-five customer and supplier concentration tables, with returns netted
  off and share of the year's party totals (build 755.1 kB; all 168 engine tests
  and 26 browser suites pass).
- Added a stock-position panel: closing stock value and item count, top five
  items by value, and stock with no outward movement during the year, with
  quantity, value and share (build 757.7 kB; all 169 engine tests pass).
- Added expense concentration: total expenses and the top five expense ledgers
  by net amount, including purchases, with share of total expenses (build
  759.2 kB; all 169 engine tests pass).
- Added a working-capital panel: receivables, stock, cash and bank less
  payables, with net working capital at the financial year end (build 760.9 kB;
  all 169 engine tests pass).
- Added MIS summary cards for net sales, net purchases, net profit, working
  capital and closing stock at the top of Statistics (build 762.3 kB; all 169
  engine tests pass).
- Added dependency-free Excel export to every report screen. The workbook uses
  inline strings and stored ZIP entries, includes the MIS summary cards and all
  visible report tables, and was round-trip tested through the app's XLSX reader
  (build 771.1 kB; all 170 engine tests pass).
- Added a three-month run-rate outlook from the last three completed months,
  with an explicit warning that it ignores seasonality, growth, orders and
  one-offs (build 773.0 kB; all 170 engine tests pass).
- **Stage 4 item 4 remains partial:** local charting, MIS summary, party
  concentration, stock position, working capital, expense concentration, Excel
  export and a run-rate outlook are present; scheduled email delivery and
  deeper forecasts remain (KL-29, KL-30). Scheduled delivery needs a backend or
  mail service.

### 2026-11-18 — Local-only static release

- Published the standalone `app/` contents as the public
  `minatolun-dotcom/ZledgerCraft` repository and enabled GitHub Pages at
  `https://minatolun-dotcom.github.io/ZledgerCraft/`.
- Added `.nojekyll` so the ES modules are served directly. The Pages build uses
  browser storage; the optional Node/SQLite server remains local-only.
- Verified the live Pages app creates a company, persists it across reload and
  loads without page errors or failed requests.
- Cloud authentication/sync and scheduled delivery are explicitly deferred; they
  require an external account and are not part of the free local-only release.

### 2026-11-18 — Stage 4: Tally stock lines and batches

- Added Tally voucher inventory parsing: stock item, quantity (including unit
  suffixes), rate and amount, godown, and multiple batch allocations with batch
  name and expiry date.
- Stock lines attach to the voucher when the local item and godown resolve and
  the line total matches the voucher's debit total. They reuse the normal
  voucher stock rules, including godown/batch availability and sales/purchase
  direction.
- Stock items created by the same import resolve by name on both the validation
  clone and the live company, so their new live IDs are used correctly.
- If stock detail cannot be applied—missing item/godown, missing batch on a
  batch-tracked item, insufficient stock, or a GST/discount split where the
  item total differs from the voucher—the accounting voucher still imports.
  The result reports the skipped line count and reason instead of silently
  losing stock or rejecting the voucher. This behaviour is recorded in KL-112.
- Batch names and expiry are preserved only when the local stock item is already
  batch-tracked; Tally batch masters and opening batches are not created.
- Added three engine tests for matching stock lines, same-import item IDs and
  mismatched-total skipping; extended the import browser suite with a Tally
  voucher stock-line inventory check (all 168 engine tests and 26 browser
  suites pass; build 745.6 kB).
- **Stage 4 item 3 remains partial:** Tally batch masters/opening batches,
  GST/discount stock-line splits, APIs and webhooks remain (KL-109, KL-110,
  KL-112).

### 2026-11-18 — Stage 4: Tally account groups

- Added Tally `<GROUP>` parsing and all-or-nothing import. Standard groups are
  reused, while custom groups are created under an existing parent with the
  parent's accounting nature.
- Groups are ordered parent-first even when the XML lists a child before its
  parent. A missing parent, or a custom top-level group with no standard
  parent, rejects the whole file.
- Ledger payloads now resolve their group by name on the live company as well
  as the validation clone, so ledgers land in newly created custom groups with
  the correct live group ID.
- Added two engine tests for nested groups, ledger placement and missing-parent
  rollback; expanded the import browser suite with a custom group/ledger check
  (all 165 engine tests and 26 browser suites pass; build 738.8 kB).
- Tally batches, stock lines, bill allocations, GST/TDS detail and original
  voucher numbers remain outside the import (KL-109).
- At that point Stage 4 item 3 still needed Tally stock lines, batches, APIs and
  webhooks; stock lines and batch detail followed in the next entry. Excel
  ledgers/vouchers were done (KL-110, KL-111).

### 2026-11-18 — Stage 4: Excel workbook import

- Added a dependency-free `.xlsx` reader: ZIP central-directory parsing, stored
  and deflated entries through `DecompressionStream`, shared/inline strings,
  cached numeric/formula values and date-styled serial cells.
- Ledger and voucher panels accept an `.xlsx` workbook and load it into the
  existing CSV review box. The `Ledgers`/`Vouchers` sheet is preferred, with the
  first worksheet as fallback. Users review the converted rows before importing.
- Kept the existing all-or-nothing CSV validation as the single import path, so
  Excel does not create a second set of validation rules.
- Added four engine tests for shared/inline strings, date styles, sheet choice,
  CSV quoting and invalid ZIP files; expanded the import browser suite with
  Excel ledger and voucher checks (all 163 engine tests and 26 browser suites
  pass; build 736.1 kB).
- `.xlsx` only: no `.xls`, `.ods`, formula recalculation, multi-sheet merge,
  macros, passwords or ZIP64. Limits are recorded in KL-111.
- **Stage 4 item 3 remained partial at that point:** Tally ledger/stock/voucher
  and Excel ledger/voucher import were done; Tally account groups followed in
  the next entry, while batches, stock lines, APIs and webhooks remained
  (KL-109, KL-110, KL-111).

### 2026-11-18 — Stage 4: Tally XML import

- Added a dependency-free Tally XML parser for common All Masters and voucher
  exports, including XML entities, Tally dates, voucher-type aliases and
  `ISDEEMEDPOSITIVE`/signed-amount debit-credit detection.
- Added all-or-nothing import: ledgers and vouchers are validated against a
  company clone first, and the live books change only if every row passes.
- Added a Tally XML panel and file picker to Import data, with audit events and
  permission checks.
- Fixed the single-file build to use replacement functions, so `$&` sequences in
  the new regex escape helper no longer inject the script tag into the bundle.
  The `file://` bundle now passes both inventory and Tally import checks.
- Extended the same import to Tally stock groups and stock items: a new group
  is created when absent, opening quantity and rate are imported, and a missing
  group or unit rejects the whole file. Existing groups are reused.
- At that point Tally account groups and units had to already exist; batch
  detail, stock lines, bill allocations, GST/TDS detail and Tally voucher numbers
  were not imported. Account-group import followed later.
- Added six engine tests and expanded the import browser suite with Tally
  master/voucher, invalid-group and stock-opening checks (all 159 engine tests
  and 26 browser suites passed at that point; build 721.5 kB).
- At that point Stage 4 item 3 still needed Excel, Tally account groups, batches,
  stock lines, APIs and webhooks (KL-109, KL-110). Excel followed in the entry
  above.

### 2026-11-18 — Stage 4: SQLite server workspace

- Replaced the JSON workspace with a local SQLite database through Node's
  built-in `node:sqlite` module: one `workspace` table with revision, timestamp
  and serialised state, WAL journaling and transaction-guarded writes.
- Added automatic migration from the existing `data/workspace.json`,
  including its revision, and renamed the old file to
  `workspace.json.migrated`. Invalid legacy JSON stops startup rather than being
  silently ignored.
- Kept a revisioned JSON fallback for Node releases without `node:sqlite`.
- Added the storage backend to the workspace API (`storage: "sqlite"|"json"`)
  and to the Storage panel.
- Verified migration manually: a revision-4 legacy workspace loaded intact from
  SQLite and the old file was renamed.
- Updated the workspace and workspace-conflict browser suites; the conflict
  suite now also verifies SQLite storage and database files are not served.
- **Stage 4 item 2 remains partial:** SQLite backend and concurrency are done;
  authenticated users, automatic merge, record locking and cloud hosting remain
  (KL-02, KL-03, KL-108).

### 2026-11-18 — Stage 4: server workspace concurrency guard

- Added a revision to the server workspace envelope. Saves send the revision
  they loaded, are serialised through one server write queue, and return HTTP
  409 instead of overwriting a newer copy.
- Added client-side revision tracking, a newer-copy banner with a Reload server
  copy action, and an eight-second metadata poll. A stale save no longer
  silently disables server mode or overwrites another session.
- The Storage panel shows the current server revision and last save time, and
  keeps a snapshot before replacing local state on reload.
- Existing JSON workspaces without a revision load as revision 0 and upgrade on
  the next save.
- Added the workspace-conflict browser suite and updated the existing workspace
  suite for the revision contract. Screenshot:
  `/tmp/visual/shots/77-workspace-conflict.png`.
- **At this point Stage 4 item 2 was partial:** concurrency safety was done;
  the database followed in the next entry.

### 2026-11-18 — Stage 4: BOM and manufacturing (inventory depth complete)

- Added BOM recipes with a finished item, output quantity and one to twenty
  component items. Component quantities scale with the production quantity.
  Batch-tracked items cannot be BOM components yet, and a finished item cannot
  be its own component.
- Added production entries with a date, BOM, production quantity, component
  godown, output godown, optional output batch/expiry and narration.
- Production checks component availability in the selected godown, consumes the
  scaled components and brings the finished quantity into the output godown.
  Stock value is preserved: components leave at weighted-average cost and the
  finished quantity enters at the same total component cost.
- Added production to the Stock Summary, godown balances, batch balances, item
  movements and backup validation. Output batches appear in the batch report.
- Production and BOM links are protected from deletion while referenced.
- Recorded limits KL-103 and KL-105–KL-107.
- Verified with 153 engine tests (3 new) and the inventory-depth browser suite
  (18 checks), including BOM creation and production in the UI.
- **Stage 4 inventory depth is complete (1 of 4 Stage 4 items).** Next:
  cloud/backend multi-user work, then Tally XML/Excel/APIs and advanced MIS.

### 2026-11-18 — Stage 4: godowns, batches, transfers and orders

- Added a seeded primary godown, a godown master (add/delete, delete blocked
  while referenced) and a godown selector on every stock line. Existing data and
  old backups default to the primary godown.
- Added optional batch tracking per stock item, with batch number and expiry
  date on voucher lines. Batch-tracked items require a batch on purchases,
  sales, returns and transfers; batch balances show opening/inward/outward,
  closing quantity, latest expiry and value at the item average cost.
- Added stock transfers between godowns with date validation, source-godown and
  batch availability checks, a transfer register, audit events and deletion.
  Transfers move quantity and cost but do not change total stock value or post
  to the ledger.
- Added godown balances with opening, inward (including transfers in), outward
  (including transfers out), closing quantity and value, plus the existing total
  Stock Summary unchanged.
- Added sales and purchase orders with party, delivery date, item, godown,
  batch, quantity, rate, status (Open/Closed/Cancelled), filters, voucher
  prefill, audit events and deletion. Orders do not post to the ledger or move
  stock.
- Extended backup validation and round-tripping for godowns, transfers, batches
  and orders; older backups without godowns still restore.
- Recorded limits KL-100–KL-104 and narrowed KL-42, KL-43 and KL-45.
- Verified with 150 engine tests (5 new) and the new browser suite (14 checks),
  then the full engine and browser suites and the `file://` bundle check.
  Screenshots: `/tmp/visual/shots/74-inventory-depth.png` and
  `/tmp/visual/shots/75-orders.png`.
- At this point inventory depth stood at 4 of 5; BOM/manufacturing followed in
  the next entry.

### 2026-11-18 — Stage 3: e-invoice/e-way bill and tax-audit working papers

- Added optional trade name, registered address, city and PIN to the GST
  registration, and optional address, city and PIN to party ledgers, with
  normalisation and backup validation. The GST and ledger forms expose them.
- Added `eInvoiceRegister`: every outward sales invoice in a period, seller and
  buyer blocks, B2B/B2C eligibility, readiness blockers (GSTIN, address, city,
  PIN, place of supply) and warnings (missing HSN/SAC, unmapped UQC, assumed
  service line), plus a draft NIC-style JSON payload per B2B invoice.
- Added `ewayBillRegister`: outward invoices at or above a configurable threshold
  (default ₹50,000), seller/buyer/consignee details, item HSN, quantity and UQC,
  and a draft Part A JSON payload. Part B transporter/vehicle/distance fields are
  deliberately absent and flagged.
- Added `taxAuditSummary`: books turnover from Sales Accounts versus GST outward
  taxable, output-tax and ITC reconciliation between GST-role ledger movements
  and GSTR-3B, TDS/TCS deducted/paid/outstanding, ₹1 crore/₹10 crore thresholds,
  and a ten-clause Form 3CD-style checklist with Ready/Review/Manual status.
- Added three report screens (E-invoice, E-way bill, Tax audit) with period
  filters, summary cards, drill-down, Print/CSV and JSON downloads; wired them
  into the sidebar, report titles, period labels and routing.
- Recorded limits KL-94–KL-99 and resolved KL-48; narrowed KL-51 to the remaining
  statutory registers, consolidation and compliance calendar.
- Verified with 145 engine tests (5 new compliance tests), the new browser suite
  (29 checks), the full existing browser suites and the `file://` bundle check.
  Screenshots: `/tmp/visual/shots/70-gst-address.png`,
  `/tmp/visual/shots/71-einvoice.png`, `/tmp/visual/shots/72-ewaybill.png` and
  `/tmp/visual/shots/73-tax-audit.png`.
- **Stage 3 is complete (4 of 4).** Next: **Stage 4 — depth and scale**, starting
  with inventory depth (godowns, batches, BOM/manufacturing, orders, transfers).

### 2026-11-18 — Stage 3: payroll runs, payslips and salary register

- Added `company.payroll` with an enabled flag, a pay-head master (earning or
  deduction, optional PF/ESI/PT/TDS tag and a posting ledger) and employee
  masters (name, code, designation, PAN, date of joining, active flag and fixed
  monthly amounts per pay head).
- Enabling payroll creates or reuses Salaries, Salary Payable, Provident Fund
  Payable, ESI Payable and Professional Tax Payable ledgers, and seeds six pay
  heads linked to them.
- Added `runPayroll`: one run per month, only active employees, earnings debited,
  deductions credited, net credited to Salary Payable. The run posts one Journal
  voucher, stores the employee snapshot and supports deleting the run with its
  voucher (blocked in a closed year).
- Added a payroll screen with setup and ledger status, pay-head and employee
  masters, monthly runs, a printable payslip per employee and a salary register
  with pay-head, statutory and employee totals plus Print/CSV.
- Added backup validation and normalisation for payroll settings, pay heads,
  employees, run snapshots, totals and voucher links.
- Recorded limits KL-89–KL-93 and resolved KL-50: fixed monthly amounts, no
  attendance/leave/arrears, PF/ESI/PT as manual deduction pay heads, one run per
  month, no salary payment workflow and no statutory returns or employer
  contributions.
- Verified with 140 engine tests, the new payroll browser suite (25 checks), all
  23 browser suites (including the workspace server on port 4174), the `file://`
  bundle check and inline-script parsing. Screenshots:
  `/tmp/visual/shots/65-payroll-setup.png`,
  `/tmp/visual/shots/66-payroll-employees.png`,
  `/tmp/visual/shots/67-payroll-run.png`,
  `/tmp/visual/shots/68-payslip.png` and
  `/tmp/visual/shots/69-payroll-register.png`.
- **After this task Stage 3 was 3 of 4.** The next Stage 3 task was
  **e-invoice/e-way bill and tax audit reports** (completed above).

### 2026-11-18 — Stage 3: TDS/TCS deduction, register and challans

- Added `company.tds` with a TAN, an enabled flag and a section master (kind,
  code, description, rate, threshold), seeded with 194C/194J/194I/194H and two
  TCS sections plus add/delete. Enabling TDS/TCS creates or reuses TDS Payable
  and TCS Payable ledgers under Duties & Taxes, tagged with a TDS/TCS role.
- Added `ledger.pan` for deductee reporting and PAN prefilling, validated as a
  structural 10-character PAN.
- Added invoice-level TDS on purchase vouchers and TCS on sales vouchers: one
  section per voucher, the deduction computed from the taxable side and posted to
  the payable ledger, with the party/cash line reduced (TDS) or increased (TCS).
  GST and TDS/TCS are mutually exclusive on one voucher for now.
- Added the TDS / TCS screen: registration and payable-ledger status, section
  master, tax challans (add/delete, with payable/paid/outstanding), and a period
  register with section and party summaries, quarterly totals, a financial-year
  threshold watch and a voucher list. Print/CSV work through the report toolbar.
- Added backup validation and normalisation for TDS/TCS settings, sections,
  voucher deductions, PANs, payable roles and tax challans.
- Recorded limits KL-81–KL-88 and resolved KL-49: voucher scope (purchases and
  sales only), one section per voucher, informational thresholds, challans as
  tracking records, no GST+TDS on one voucher, single balancing line, one TAN and
  a local section template.
- Verified with 130 engine tests, the new TDS/TCS browser suite (23 checks), the
  GST suite and seven existing browser suites, the `file://` bundle check and
  inline-script parsing. Screenshots: `/tmp/visual/shots/61-tds-setup.png`,
  `/tmp/visual/shots/62-tds-voucher.png`,
  `/tmp/visual/shots/63-tds-register.png` and
  `/tmp/visual/shots/64-tcs-register.png`.
- **Stage 3 is 2 of 4.** Next Stage 3 task: **payroll and statutory deductions**.

### 2026-11-18 — Stage 3: GST setup, voucher tax computation and GST returns

- Added `company.gst` with GSTIN, legal name, home state, a rate master
  (add/delete, optional cess) and normalisation. Enabling GST creates or reuses
  CGST, SGST, IGST and Cess ledgers under Duties & Taxes, tagged with a GST role.
- Party ledgers can carry a GSTIN and GST state; stock items can carry an
  HSN/SAC code.
- Added invoice-level GST to Sales, Purchase, Credit Note and Debit Note
  vouchers: one rate and place of supply per voucher, CGST+SGST for an
  intra-state supply or IGST for an inter-state supply, optional cess, a
  reverse-charge flag and a Nil/Exempt rate. Tax is computed from the taxable
  side, posted as ordinary voucher lines and balanced into the party/cash line;
  stock-item totals are checked against the taxable value.
- Added the GST screen: registration and tax-ledger status, rate master, and
  period GST returns — GSTR-1 outward supplies by rate, B2B invoices, B2C by
  rate, credit notes, HSN summary and GSTR-3B with outward tax, RCM, ITC and net
  payable per head, plus a GST voucher list. All panels support Print/CSV.
- Added voucher-form tax preview, GSTIN/place-of-supply defaults from the party
  ledger, voucher-view GST detail, and backup validation/normalisation for GST
  settings, rates, voucher tax and tax lines.
- Known gaps recorded as KL-72–KL-80: one rate per invoice, working papers only,
  simplified supply classification, RCM as a flag, structural GSTIN checks,
  aggregate HSN summary, single balancing line, no GST openings/CDNR linkage and
  an add/delete-only rate master. KL-47 is resolved.
- Verified with 118 engine tests, the new GST browser suite (24 checks), seven
  existing browser suites, the `file://` bundle check and inline-script parsing.
  Screenshots: `/tmp/visual/shots/58-gst-setup.png`,
  `/tmp/visual/shots/59-gst-voucher.png` and
  `/tmp/visual/shots/60-gst-returns.png`.
- **Stage 3 is 1 of 4.** Next Stage 3 task: **TDS/TCS**.

### 2026-11-18 — Stage 2 complete: bill-wise register and party statement

- Extracted the existing bill settlement engine into one party ledger model and
  added settled/original amounts, per-line allocation detail and a shared
  status calculation. Ageing totals and FIFO/explicit allocation behaviour remain
  unchanged.
- Added a Bill-wise register for receivables or payables with bill-date period,
  status filter, original/settled/outstanding amounts, overdue days, totals and
  drill-down to the voucher or party statement. Fully settled bills remain in the
  register.
- Added a Party statement with the normal ledger statement plus bill references,
  allocation detail, and a bill-wise table for every Sales/Purchase bill up to
  the report date.
- Added sidebar/gateway/report-toolbar integration, Print/CSV support, status
  badges and a responsive table. Known gaps: KL-70 (non-invoice journal
  adjustments are not bills) and KL-71 (status is as on the period end).
- Verified with 106 engine tests, the new bill-register browser suite, five
  existing browser suites, inline-script syntax check and `file://` bundle check.
  Screenshots: `/tmp/visual/shots/56-bill-register.png` and
  `/tmp/visual/shots/57-party-statement.png`.
- **Stage 2 complete.** Next Stage 3 task: **GST setup, voucher tax computation
  and GST returns**.

### 2026-11-18 — Stage 2: multi-currency and forex revaluation

- Added `company.currencies` foreign-currency masters with 2–5 letter codes,
  names, symbols and multiple dated INR rates. Rates are append-only and a
  voucher uses the latest rate on or before its date.
- Added a currency selector and exchange-rate field to voucher entry. Foreign
  amounts are entered in the voucher currency, stored as `currencyAmount`, and
  posted to the ledger as base INR `amount`; the base amount remains the
  accounting truth for every existing report.
- Added baseline validation for unknown currencies, missing rates, zero base
  amounts, foreign bill allocations and foreign stock lines, plus backup
  validation and legacy normalisation.
- Added the Forex Revaluation report with an as-on date, foreign and book
  balances, latest rate, revalued base value, unrealised gain/loss and totals.
  It revalues only asset and liability ledgers and never posts a journal.
- Added Masters currency/rate panels, guarded currency deletion, audit events,
  README coverage and limits KL-64–KL-70.
- Verified with 101 engine tests, nineteen browser suites, inline-script syntax
  check and `file://` bundle check. Screenshot:
  `/tmp/visual/shots/55-forex-revaluation.png`.
- Next Stage 2 task: **bill-wise register and party statement**.

### 2026-11-18 — Stage 2: budgets and budget-vs-actual

- Added annual `company.budgets` records targeting one ledger or group for one
  financial year, with add/delete masters, unique target/year enforcement,
  backup validation and normalisation of orphaned records.
- Added Budget vs Actual with year and as-on filters, budget/actual/variance,
  used percentage, over-budget status, totals and Print/CSV export.
- Actuals use period voucher movement on the target's natural side (debit for
  expenses/assets, credit for income/liabilities) and exclude opening balances.
- Group budgets include sub-group ledgers. Overlapping group and ledger budgets
  are allowed and their totals can double-count; that caveat is displayed in the
  report and recorded as KL-60.
- Recorded the annual-only, no-phasing/no-revision and no-cost-centre-budget
  limits in [KNOWN_LIMITS.md](KNOWN_LIMITS.md) (KL-21, KL-60–KL-63).
- Verified with 93 engine tests, seventeen browser suites, inline-script syntax
  check and `file://` bundle check.
- Next Stage 2 task: **multi-currency and forex gain/loss**.

### 2026-11-18 — Stage 2: cost centres and reports

- Added company-level cost categories and cost centres with add/delete masters,
  a seeded primary category, backup round-trips and normalisation of orphaned
  masters and line references.
- Added an optional cost-centre selector to every voucher line and preserved the
  selection through alteration, voucher view, backup and restore. One centre per
  line is supported; split allocations remain deferred (KL-22/KL-23).
- Added cost centre summary by category and centre (debit, credit, net, voucher
  counts, period filter) and a voucher-line break-up with drill-down.
- Added audit entries and guarded deletion for cost categories and cost centres.
- Added the persistent [KNOWN_LIMITS.md](KNOWN_LIMITS.md) register covering the
  current platform, security, import, reporting, banking, inventory, statutory
  and UX gaps.
- Verified with 86 engine tests, sixteen browser suites, inline-script syntax
  check and `file://` bundle check.
- Next Stage 2 task: **budgets and budget-vs-actual**.

### 2026-11-18 — Stage 2: cheque/DD details and register

- Added optional `voucher.instrument` on Payment, Receipt and Contra vouchers:
  Cheque/DD kind, number, instrument date and bank ledger, validated against a
  bank line on the same voucher and normalized on load and restore.
- Added instrument entry to the voucher form and alteration flow, with the
  details shown on the voucher and included in voucher audit summaries.
- Added the Cheque / DD register with period, as-on and status filters, totals,
  post-dated/due/cleared status, party and bank detail, and voucher drill-down.
  Cleared means the voucher is matched in Bank Reconciliation.
- Added a printable cheque preview for cheque payments with payee, bank, cheque
  number, date, figures, Indian-numbering amount words and A/c Payee crossing.
- Backups now validate cheque/DD fields. Malformed legacy details are dropped
  without changing the voucher.
- Verified with 80 engine tests, fifteen browser suites, inline-script syntax
  check and `file://` bundle check.
- Next Stage 2 task: **cost centres and cost-category reports**.

### 2026-11-18 — Stage 2: bank reconciliation

- Added `company.bankReconciliations[ledgerId]` with imported statement lines
  and one-to-one voucher matches, normalized on load and backup restore.
- Added CSV statement import (`Date,Description,Reference,Debit,Credit` or
  `Amount,Type`), signed amounts (credit +, debit −) and DD/MM/YYYY or ISO dates.
- Added greedy auto-match by exact signed amount within seven days, manual
  match/unmatch, statement clearing, matched/unmatched totals and book balance.
- Matching is stored separately from vouchers; editing or deleting a matched
  voucher, deleting a bank ledger or restoring a backup drops stale matches.
- Added the `recon.write` permission, Bank Reconciliation report screen and audit
  events for import, auto-match, match, unmatch and clear.
- Verified with 73 engine tests, fourteen browser suites, inline-script syntax
  check and `file://` bundle check.
- Next Stage 2 task: **cheque/DD details, cheque printing and post-dated
  register**.

### 2026-11-17 — Stage 1: audit trail

- Added `state.audit` with normalized append-only entries, backup persistence and
  deduplicating merge on restore.
- Recorded company, ledger, group, stock group, stock item, unit, voucher,
  financial-year and restore events.
- Added the Audit trail report with company/text filters, CSV/print and no edit or
  delete controls.
- Verified with 59 engine tests, nine browser suites, inline-script syntax check
  and `file://` bundle check.
- Next Stage 1 task at that point was **local users and roles**.

### 2026-11-17 — Stage 1: local users and roles

- Added owner/accountant/viewer profiles, seeding, validation and backup
  round-trips. Existing backups without profiles receive a local owner.
- Added the Users & access panel and the header profile switcher.
- Enforced permissions on vouchers, masters, companies, financial years, users
  and restores; owner-only controls are hidden from other roles.
- Audit entries now record actor id, name and role; restore history keeps the
  acting profile.
- Verified with 64 engine tests, ten browser suites, inline-script syntax check
  and `file://` bundle check.
- Next Stage 1 task at that point was **durable storage**.

### 2026-11-17 — Stage 1: durable local workspace

- Added an optional server workspace at `GET/PUT/DELETE /api/workspace`, writing
  `data/workspace.json` atomically with size and shape validation.
- Added an opt-in Storage panel; enabling it can migrate current browser data,
  load an existing workspace after a snapshot, or switch back to browser storage
  with a local mirror.
- Blocked `/data/` from static serving and ignored it in git; the endpoint stays
  local and unauthenticated by design.
- Verified cross-profile loading in two isolated browser contexts, forbidden
  workspace-file access, invalid-save rejection and single-file fallback.
- Next Stage 1 task at that point was **scheduled/automatic backups**.

### 2026-11-17 — Stage 1: automatic backups and CSV import

- Added daily automatic snapshots after the first voucher of the day, ten-item
  retention, and manual/pre-restore labels. Restores still snapshot current data.
- Added CSV import for ledgers and multi-line balanced vouchers. Validation is
  dry-run on a cloned company, so one bad row rejects the whole file.
- Imported vouchers support date, type, grouping number, ledger, side, amount and
  narration; stock items and bill allocations remain manual.
- Verified with 64 engine tests and browser coverage for daily deduplication,
  next-day snapshots, retention, valid imports, invalid-row rollback, unbalanced
  voucher rollback and audit events.
- **Stage 1 complete.** Next Stage 2 task: **bank reconciliation with statement
  import and auto-match**.

## Rule for task reports

At the end of every completed task:

1. Update this roadmap's stage checkboxes and status snapshot.
2. State which stage and which item was completed.
3. State the next unfinished item in the build order.
4. List the verification actually run.

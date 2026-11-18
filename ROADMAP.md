# ZledgerCraft roadmap and status

Last updated: 2026-11-18

This file is the source of truth for **where the app stands** and **what gets
built next**. Every completed task updates the tracker below and the final task
report names the completed stage plus the next stage. Deferred limits are kept
separately in [KNOWN_LIMITS.md](KNOWN_LIMITS.md).

## Current stage

**Stage 1 — Production safety complete (5 of 5). Stage 2 — Daily operations
complete (6 of 6). Stage 3 — Compliance complete (4 of 4): GST setup, voucher
tax and returns, TDS/TCS deduction and challans, payroll runs with payslips,
and e-invoice/e-way bill plus tax-audit working papers are done. Stage 4 —
Depth and scale is in progress (1 of 4 complete): inventory depth is complete
with godowns, batches, stock transfers, orders, BOMs and manufacturing; the
server workspace now uses a local SQLite database with revision-checked saves,
and Tally XML account groups, ledgers, stock masters, vouchers with matching
stock lines and Excel `.xlsx` ledgers/vouchers can be imported. Authentication,
cloud hosting and APIs remain.** The single-user accounting core is
complete, but the app is still an advanced local MVP, not production or
statutory ready.

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
- Print/CSV, JSON backup/restore with snapshots, dashboard KPIs and keyboard-first
  navigation.
- Append-only local audit trail for companies, masters, vouchers, users,
  financial years and data restores, with actor attribution, search, company
  filter, Print/CSV and backup merging.
- Local owner/accountant/viewer profiles with a header switcher and enforced
  role permissions. These are access-control profiles, not authentication.
- Optional local server workspace in `data/workspace.sqlite`, shared across
  browser profiles on the same machine, with browser storage as the fallback and
  local mirror. Legacy `workspace.json` is migrated automatically. Saves carry a
  revision; a stale session gets a conflict banner and must reload instead of
  overwriting another session. The workspace database is excluded from static
  serving and git.
- Daily automatic snapshots after the first voucher of the day, ten-snapshot
  retention, and manual/pre-restore labels.
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
  exchange rate, base-amount posting with retained foreign amounts, and a Forex
  Revaluation report for foreign asset/liability balances.
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
  net cash and a year-to-date row; top-five customer and supplier concentration
  tables; a stock position with closing value, top items by value and items with
  no issues during the year; top expense heads; plus Print/CSV from the
  Statistics screen.
- Verification: 168/168 engine tests (12 GST, 12 TDS/TCS, 10 payroll, 5
  compliance, 18 inventory, 11 Tally import, 4 XLSX); all 26 browser suites,
  including the godown/batch/transfer/order/manufacturing suite (18 checks), the
  workspace conflict suite (8 checks) and the expanded import suite, exit
  successfully with no page errors; single-file build 759.2 kB.

Why it is not production-ready: data lives in one browser's local storage, the
audit trail is app-level rather than tamper-proof, profiles are not
password-protected, the workspace is one same-machine SQLite database with
revision conflicts but no authenticated writers, merge or offsite copy, bank
reconciliation has no live/OFX/QIF feed,
GST returns, e-invoice/e-way drafts and TDS/TCS records are unfiled working
papers, no IRN/QR or portal acknowledgement is produced, the tax-audit checklist
is not a Form 3CD or an audit opinion, payroll has no attendance, PF/ESI
computation or statutory returns, and inventory has no physical stock count,
batch-wise costing, WIP accounting, wastage or job work. The full deferred list
is in [KNOWN_LIMITS.md](KNOWN_LIMITS.md).

## Missing feature inventory

Status: **Done**, **Partial**, **Missing**.

### Taxation and statutory — Partial

| Feature | Status |
| --- | --- |
| GST registration, tax ledgers, HSN/SAC and rate setup | Done (Stage 3; GSTIN, home state, rate master, tax ledgers and HSN on stock items; no SAC master) |
| GST on vouchers: CGST/SGST/IGST, cess, reverse charge, exempt/nil | Partial — one rate per invoice, cess, RCM flag and Nil/Exempt; no per-item rates, exports/SEZ or ITC reversal |
| GSTR-1, GSTR-3B, GSTR-2B reconciliation and annual returns | Partial — GSTR-1 outward working papers, HSN summary and GSTR-3B liability/ITC summary; no filing, GSTR-1 JSON export, 2B reconciliation or annual return |
| E-invoice and e-way bill generation | Partial — B2B e-invoice readiness and draft NIC-style JSON; e-way Part A working papers and draft JSON at a configurable threshold; no IRP/e-way portal submission, IRN/QR, Part B, transporter/vehicle, cancellation or amendment |
| TDS/TCS sections, thresholds, challans, returns and certificates | Partial — TAN, section/rate/threshold master, TDS on purchases, TCS on sales, party PAN, register with quarterly and threshold views, and challan tracking; no returns, certificates, threshold enforcement, higher-rate/no-PAN logic or journal deductions |
| Tax audit, reconciliation and statutory registers | Partial — turnover, output-tax/ITC and TDS/TCS reconciliations plus a Form 3CD-style checklist; no Form 3CD, audit opinion, statutory registers, consolidation or compliance calendar |
| Immutable audit trail | Done (Stage 1, app-level append-only; not tamper-proof against browser-storage edits) |

### Payroll and statutory deductions — Partial

| Feature | Status |
| --- | --- |
| Employee, pay-head and salary-structure masters | Done (Stage 3; fixed monthly amounts, PAN, joining date, active flag, ledger-linked pay heads) |
| Payroll runs and salary journal | Done (Stage 3; one run per month, one balanced Journal, stored employee snapshot) |
| Payslips and salary register | Done (Stage 3; printable payslip and period register with pay-head, statutory and employee totals, CSV) |
| Attendance, leave, overtime, arrears, bonus and gratuity | Missing |
| PF/ESI/PT computation, employer contributions, ECR/returns and Form 24Q/16 | Missing (PF/ESI/PT are manually entered deduction pay heads) |
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
| BOM, manufacturing journal, production, wastage, job work | Partial — BOM recipes, scaled component consumption, finished-goods output and output batches; no multi-level BOM, wastage, by-products, job work or WIP accounting |
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
| Multi-currency and forex gain/loss | Done (Stage 2; voucher-level currency, dated rates and unrealised revaluation report; no realized gain/loss posting) |
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
| Charts, trends and forecasts | Missing |
| Excel, branded PDF and scheduled email reports | Missing |
| Custom print-layout designer | Missing |

### Security, platform and operations — Missing

| Feature | Status |
| --- | --- |
| Login, users, roles and company-level permissions | Partial — local role profiles and permission enforcement; no login/password or company-level scoping, and no authenticated identity for server writes (Stage 1) |
| Encryption/vault protection | Missing |
| Immutable audit/edit log | Done (Stage 1, local append-only; not cryptographic) |
| Backend database instead of browser storage | Partial — local SQLite workspace with atomic revisioned saves and legacy JSON migration; no offsite persistence |
| Multi-user concurrency and cloud sync | Partial — revision checks reject stale whole-workspace writes and clients can reload a newer copy; no merge, record locks, authentication or cloud sync |
| Scheduled/offsite backups and retention | Missing |
| Tally XML and Excel master/voucher import | Partial — Tally XML account groups, ledgers, stock groups, stock items with opening stock, balanced vouchers and matching voucher stock lines import; batch names/expiry attach to locally batch-tracked items; Excel `.xlsx` ledgers and vouchers load into the reviewed CSV path; custom Tally groups need a standard parent and units must pre-exist; skipped stock lines do not roll back the voucher; no batch masters, bill allocations, cost centres, GST/TDS detail, voucher numbers, APIs or webhooks |
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
| Security/platform | 45% |
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
- [x] Multi-currency and forex gain/loss — 2026-11-18 (voucher-level foreign currency, dated rates and unrealised revaluation; realized differences deferred)
- [x] Bill-wise register and party statement — 2026-11-18

### Stage 3 — Compliance (complete)

- [x] GST setup, voucher tax computation and GST returns — 2026-11-18 (working papers; no filing, 2B, e-invoice or per-item rates)
- [x] TDS/TCS — 2026-11-18 (sections, deduction/collection, register and challans; no returns, certificates or threshold enforcement)
- [x] Payroll and statutory deductions — 2026-11-18 (employees, pay heads, monthly runs, journal, payslips and salary register; no attendance, PF/ESI computation, returns or payments)
- [x] E-invoice/e-way bill and tax audit reports — 2026-11-18 (working papers and draft JSON; no IRP/e-way portal submission, IRN/QR, Part B or Form 3CD)

### Stage 4 — Depth and scale

- [x] Inventory: godowns, batches, BOM/manufacturing, orders, transfers — 2026-11-18 (batch/expiry, transfers, orders and production; no physical count, wastage, job work or WIP posting)
- [ ] Cloud sync, backend database and multi-user concurrency — SQLite backend, revision-checked writes and conflict/reload flow done 2026-11-18; authentication and cloud hosting pending
- [ ] Tally XML/Excel import, APIs and integrations — Tally XML account group, ledger, stock group/item, voucher, stock-line and batch detail import plus Excel `.xlsx` ledger/voucher loading done 2026-11-18; Tally batch masters/opening batches, GST/discount stock-line splits, APIs and webhooks pending
- [ ] Advanced MIS, charts, scheduled email/Excel exports — local monthly MIS chart and table done 2026-11-18; scheduled email/Excel and further dashboards pending

## Progress log

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
- **Stage 4 item 4 remains partial:** local charting, party concentration,
  stock position and expense concentration are present; scheduled email/Excel
  delivery, additional dashboards and forecast reports remain (KL-29, KL-30).

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

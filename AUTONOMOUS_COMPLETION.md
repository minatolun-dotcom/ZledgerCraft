# Autonomous completion ledger

Updated: 2026-11-21

This file records the architectural completion pass. It is deliberately factual:
a project is only marked complete when the engine, persistence, UI (where
applicable), tests and documentation all exist.

## Discovery

The repository has 117 numbered limits in `KNOWN_LIMITS.md` (some resolved) and
the eight architectural projects named in the assignment. The app is a vanilla
ES-module application with an append-only audit log, a single-file build, a
SQLite/Postgres workspace mirror and node:test regression suites.

## Architectural projects

| # | Project | Status | Implemented | Remaining |
| --- | --- | --- | --- | --- |
| 1 | Alternate units | Complete | One alternate unit per stock item with a six-decimal factor; voucher lines select base/alternate unit; quantities convert to base, entered values are retained and exact line amounts drive valuation. | Compound/multiple alternate units and unit-specific pricing remain out of scope. |
| 2 | Per-line GST/TDS | Complete | Ledger lines can carry `gstRateId` and `tdsSectionId`; GST and TDS/TCS calculate per line, aggregate by rate/section, and split GSTR-1 and withholding summaries. Exempt lines and voucher-level defaults remain supported. | E-invoice line-rate export remains tracked under KL-98, outside this project's return integration. |
| 3 | Multiple instruments per voucher | Complete | Vouchers store an allocated `instruments` array with per-instrument bank/date/number/amount; validation enforces complete amounts and bank-total reconciliation; the voucher form adds/removes rows, the register flattens rows and targets status changes per instrument, and the primary instrument stays backward compatible. | Automatic instrument numbering and a full issued-instrument lifecycle remain out of scope. |
| 4 | Stock/WIP posting | Complete | Production posts a balanced component/conversion journal through Stock in Hand and Work in Progress, creates the four posting ledgers, records the journal on the production entry, removes it with the run, and reports stock-ledger reconciliation against operational stock. | Partial-completion WIP balances, by-products and automatic opening-stock journals remain out of scope. |
| 5 | Foreign-currency ledger balances | Complete | Every foreign-currency ledger balance is reported by currency with book value, average and latest rates; party receipts and payments are matched FIFO to invoices, realised gain/loss is posted once through Forex Gain/Loss, posted revaluation adjusts the carrying rate to prevent double counting, and P&L/balance-sheet notes disclose realised, unrealised and open exposure. | Per-ledger currency, foreign opening balances, explicit bill-wise foreign allocations and foreign inventory remain out of scope. |
| 6 | Bulk voucher grid | Complete | A grid posts Journal, Payment, Receipt and Contra vouchers row by row with date, type, debit/credit ledger, amount, source reference and narration. The whole batch is validated on an isolated company copy, errors are attached to their rows, nothing is posted unless every row passes, and source references stop repeated rows or re-posts. | Spreadsheet clipboard paste, bulk alteration of existing vouchers, column chooser and saved views remain out of scope. |
| 7 | Full payroll reversal and supplementary runs | Complete | Reversal posts an opposite Journal, marks the run, blocks double reversal, removes both vouchers on delete and excludes reversed runs from payroll summaries. A supplementary run pays only uncovered active employees after the regular run; an adjustment run posts explicit signed deltas by employee and pay head, including negative reversals, and run kinds, reversal state and restored totals survive backups. | Bulky payroll upload, bank payment matching and statutory return filing remain outside this project. |
| 8 | Statutory portal filing | Externally blocked | Local returns, e-invoice/e-way drafts, challans and compliance calendar exist. A monthly GSTR-1 JSON export now carries GSTN-style b2b, b2cs, cdnr/cdnur and HSN sections for manual upload, and a local filing register stores the ARN, period, date and notes after a user files on the portal. Nothing is transmitted or represented as portal-verified. | Credentialed GSTN/IRP/TRACES submission, acknowledgements and filing status feeds. |

## Other completed architectural work in this pass

- Recursive phantom BOMs with cycle detection and parent-BOM deletion guards.
- Cheque-book master with bank/prefix/range/next number, overlap validation and
  recorded-instrument deletion protection.
- Single-company restore while preserving the rest of the workspace.
- Optional quarterly budget phasing with elapsed-quarter budget-to-date.
- Alternate-unit master, line conversion and amount-preserving valuation.
- Full test suite and release verification recorded below.

## Database migrations

No new relational table was required. New data is stored in existing company
JSON rows and is validated during `importState`. The workspace schema version
remains 11. A future alternate-unit/WIP/currency model will need schema v12.

## Verification

- Full suite: 364 tests (363 pass, 1 skipped), 0 failures.
- Build: 1,323.5 kB.
- Targeted suites: inventory, bank, budgets, currency, bulk vouchers, payroll.
- Latest deployment: https://1c51254f.zledgercraft.pages.dev (HTTP 200).
- Projects 1–7 are complete; no code project remains open.

## Statutory filing boundary

Project 8 cannot be completed in this environment. Credentialed GSTN/GSP,
IRP/e-invoice and TRACES/TAN access plus an authorised filing environment are
required. The app keeps local returns, e-invoice/e-way drafts, challans and the
compliance calendar, but no portal submission, acknowledgement or filing-status
feed was simulated. A maintainer with those credentials can build the provider
adapters without changing the existing local working papers.

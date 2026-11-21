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
| 8 | Statutory portal filing | Parked | Local returns, e-invoice/e-way drafts, challans, compliance calendar, GSTR-1 JSON export and a filing/ARN register exist. Direct portal submission is recorded under parked external dependencies P-01–P-04. | Removed from the active backlog. |

## Other completed architectural work in this pass

- Recursive phantom BOMs with cycle detection and parent-BOM deletion guards.
- Cheque-book master with bank/prefix/range/next number, overlap validation and
  recorded-instrument deletion protection.
- Single-company restore while preserving the rest of the workspace.
- Cost-centre amount splits per voucher line, with validated shares and
  split-aware summaries, break-ups, budgets and master merges.
- Many-to-one bank statement matching: manual groups require same-direction
  vouchers with an exact signed total, auto-match groups up to three after
  one-to-one fails, and grouped matches survive backups and clear every
  instrument in the group.
- Atomic bulk bank adjustments: selected unmatched statement lines post one
  Journal each against a shared adjustment ledger, with no voucher or match
  committed if any line fails.
- Optional quarterly budget phasing with elapsed-quarter budget-to-date.
- Alternate-unit master, line conversion and amount-preserving valuation.
- Full test suite and release verification recorded below.

## Database migrations

No new relational table was required. New data is stored in existing company
JSON rows and is validated during `importState`. The workspace schema version
remains 11. A future alternate-unit/WIP/currency model will need schema v12.

## Verification

- Full suite: 394 tests (393 pass, 1 skipped), 0 failures.
- Build: 1,430.8 kB.
- Targeted suites: GST, GSTR-2B, GSTR-9, late fee, TDS returns, inventory, bank, budgets, currency, bulk vouchers, payroll.
- Latest deployment: https://c1b84a6b.zledgercraft.pages.dev (HTTP 200); custom domain https://zledgercraft.pages.dev/ also HTTP 200.
- Projects 1–7 are complete. Project 8’s local work is complete; its parked
  external dependencies are excluded from the active backlog.

## Statutory filing boundary

Project 8 remains parked at the external dependency boundary. The app keeps
local returns, GSTR-2B reconciliation, GSTR-9 and GSTR-1 exports, the late-fee
estimator, 26Q/27Q/27EQ working papers, payroll EPF ECR/ESI/24Q/16 working
papers, e-invoice/e-way drafts, challans, the compliance calendar and the
filing/ARN register. Additional local return formats remain tracked by lane in
`KNOWN_LIMITS.md`.

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
| 4 | Stock/WIP posting | Open | Operational stock valuation and production cost only. | WIP/stock ledgers, production journals, reversals, stock-to-ledger reconciliation. |
| 5 | Foreign-currency ledger balances | Open | Voucher-level foreign amounts and revaluation working paper. | Currency-aware ledger balances, realised/unrealised differences, settlement matching, statements. |
| 6 | Bulk voucher grid | Open | Single voucher entry and all-or-nothing CSV/Tally import. | Spreadsheet grid, row validation, atomic batch posting, duplicate prevention. |
| 7 | Full payroll reversal and supplementary runs | Partial | Reversal posts an opposite Journal, marks the run, blocks double reversal, removes both vouchers on delete and excludes reversed runs from payroll summaries. | Supplementary/adjustment runs and explicit delta allocation. |
| 8 | Statutory portal filing | Externally blocked | Local returns, e-invoice/e-way drafts, challans and compliance calendar exist. | Credentialed GSTN/IRP/TRACES submission, acknowledgements and filing status feeds. |

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

- Full suite: 347 tests (346 pass, 1 skipped), 0 failures.
- Build: 1,247.8 kB.
- Targeted suites: inventory, bank, budgets, payroll.

## Exact next action

Continue with stock/WIP posting depth. Statutory filing
cannot be completed without GSTN/IRP/TRACES credentials and authorization; do not
simulate submission.

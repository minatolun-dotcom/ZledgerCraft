# ZledgerCraft known limits and deferred work

Last updated: 2026-11-18

This is the persistent register of limits that are known but **not being fixed in
the current task**. It complements `ROADMAP.md`: the roadmap records what is
built and what is next, while this file records what is deliberately shallow,
deferred, or absent so it is not forgotten.

When a limit is removed, mark it resolved here and update the roadmap and
README. When a new limit is introduced, add it here in the same change.

## Platform, storage and operations

| ID | Limit | Current behaviour / consequence |
| --- | --- | --- |
| KL-01 | Browser storage is the default | Data lives in one browser profile's local storage. Clearing site data removes it. |
| KL-02 | Server workspace is optional, local and unauthenticated | `data/workspace.sqlite` is shared on one machine only. Saves are revision-checked and a stale session is rejected, but there is no user authentication, record-level locking or automatic merge; a user must reload the server copy. |
| KL-03 | Local database only; no cloud sync | Node's built-in SQLite stores the whole workspace locally; older Node versions fall back to `workspace.json`. There is no cloud hosting, multi-device sync, offline merge or company/record-level concurrency. |
| KL-04 | No scheduled or offsite backups | Up to ten daily/manual/pre-restore snapshots stay in the same browser. There is no email, cloud, network share or retention schedule. |
| KL-05 | Workspace size and statement limits | Workspace saves are capped at 20 MB; a bank statement is capped at 5,000 lines. There is no pagination or archival strategy. |
| KL-06 | Single-file build has no server workspace | `dist/ZledgerCraft.html` works from `file://` but cannot use the optional workspace API. |

## Access, security and audit

| ID | Limit | Current behaviour / consequence |
| --- | --- | --- |
| KL-07 | Profiles are not authentication | Owner/accountant/viewer are local access-control profiles. Anyone with the browser can switch profiles; there are no passwords, sessions or MFA. |
| KL-08 | No company-level scoping | A profile can open every company in the installation. |
| KL-09 | No vault or encryption at rest | Browser storage, the SQLite workspace (or JSON fallback) and backups are unencrypted. There is no TallyVault-style encryption. |
| KL-10 | Audit trail is app-level | The log is append-only inside the app but is not cryptographic or tamper-proof against direct browser/workspace/backup edits. |
| KL-11 | No user activity/session controls | No login history, forced logout, IP/device restrictions, lockout or approval workflow. |
| KL-12 | No API or webhooks | No external integrations, service API, webhooks or automation surface. |

## Backup, restore and import

| ID | Limit | Current behaviour / consequence |
| --- | --- | --- |
| KL-13 | JSON backup only | There is no scheduled backup, cloud backup, automatic export, branded PDF or Excel workbook backup. |
| KL-14 | CSV import is deliberately narrow | Imports ledgers, balanced multi-line vouchers and bank statements only. |
| KL-15 | Missing from CSV import | Stock items, bill allocations, cheque/DD details, cost-centre allocations, currency masters/rates, GST details, TDS/TCS details and arbitrary masters are not imported from CSV. Excel `.xlsx` ledgers/vouchers use the same CSV schema; Tally XML covers ledgers, stock groups/items and vouchers. |
| KL-16 | Import is all-or-nothing | One invalid row rejects the whole file; there is no partial import wizard, mapping UI or dry-run report beyond the error. |
| KL-17 | Restore is whole-installation | A restore replaces the active data set; there is no company-only, period-only or merge restore. |
| KL-18 | Backup format is version 1 | No migration framework beyond tolerant normalisation. Older backups may lose unsupported fields. |
| KL-19 | Snapshot scope | Snapshots are browser-local, not encrypted, not exportable individually, and capped at ten. |

## Accounting and reporting

| ID | Limit | Current behaviour / consequence |
| --- | --- | --- |
| KL-20 | Resolved — multi-currency added 2026-11-18 | INR remains the base currency, with voucher-level foreign currency and a Forex Revaluation report. Remaining currency gaps are KL-64–KL-69. |
| KL-21 | Budgets are annual and single-target | One budget per ledger/group per financial year. No monthly/quarterly phasing, revisions, approval workflow, locking or carry-forward. |
| KL-22 | Cost centres are single-allocation per line | Each voucher line can carry one cost centre; there is no split across multiple centres or percentage allocation. |
| KL-23 | Unallocated lines are excluded | Cost-centre summary and break-up include only lines with a centre. There is no unallocated-cost reconciliation. |
| KL-24 | No cost-centre budgets or cost categories in P&L | Cost reports are allocation summaries; there is no cost-category P&L, budget comparison or cost-centre closing. |
| KL-59 | Cost masters are add/delete only | Cost categories and centres cannot be renamed, merged or moved between categories after creation. |
| KL-60 | Overlapping budgets can double-count totals | A group budget and a ledger budget inside it can both exist; the report totals add each budget independently. |
| KL-61 | Budget actuals exclude openings | Actual is net voucher movement from the financial-year start to the as-on date; ledger opening balances and prior-year activity are excluded. |
| KL-62 | Budget masters are add/delete only | Budgets cannot be edited, duplicated across years or versioned; create a new budget and delete the old one. |
| KL-63 | No cost-centre budgets | Budgets target a ledger or group only; they cannot target a cost centre or compare by cost category. |
| KL-64 | Foreign vouchers are all-or-nothing | Every line on a foreign voucher is entered in the same foreign currency. There is no per-ledger currency or mixed foreign/base lines, so a cash/bank line included on a foreign voucher is also treated as a foreign balance by revaluation. |
| KL-65 | Realised forex differences are not computed | A base-currency receipt or payment that settles a foreign balance does not reduce the foreign balance in the revaluation report and does not calculate or post an exchange gain/loss. The report builds foreign balances only from foreign vouchers, so settled balances can look larger than they are. Only the unrealised as-on revaluation report exists. |
| KL-66 | Forex revaluation does not post | The report is informational. It does not create an adjustment voucher, reverse prior revaluation, produce a tax effect, or keep a revaluation history. |
| KL-67 | Foreign inventory and bill allocations are blocked | Foreign vouchers cannot carry stock items or bill-wise allocations; use a base-currency invoice for stock or settlement. |
| KL-68 | Exchange rates are manual and append-only | Rates have a date and an INR-per-unit value; there is no rate editing/deletion, live feed, inverse/cross-rate, rate spread or rate audit beyond the app log. A voucher uses the latest rate dated on or before its date. |
| KL-69 | No foreign openings or ledger currency | Ledger opening balances are base INR only. Ledgers do not carry a currency, and there is no foreign-currency bank/cash account model. |
| KL-70 | Bill detail covers Sales/Purchase invoices only | The Bill-wise register and Party statement bill table list Sales and Purchase invoices. Same-side journal or adjustment lines remain in the ledger statement and can still look bill-like to the ageing engine; they are not shown as bills in the new detail. |
| KL-71 | Bill register status is as on the period end | The register has one From/To period and uses To as the status date. There is no separate as-on date, so reviewing an old period shows status and overdue days at that period's end. |
| KL-25 | Resolved — bill-wise register and party statement added 2026-11-18 | Bill references, due dates, allocations, ageing, a settled/open bill register and a party statement with bill detail are available. Remaining bill limits are KL-31 and KL-70/KL-71. |
| KL-26 | No advanced voucher types | No post-dated voucher type, memorandum, optional, reversing, recurring or approval vouchers. The Cheque / DD register is a report over ordinary vouchers. |
| KL-27 | No custom document numbering | Counters are automatic per voucher type; no prefixes, suffixes, series or manual numbering rules. |
| KL-28 | No interest, fund forecasting or consolidation | No interest calculation, fund-flow forecast, company consolidation or group reporting. |
| KL-29 | Limited comparatives | Year comparison exists, and Statistics has one monthly sales/purchase trend chart plus customer/supplier, stock-position, working-capital and expense-head tables. There are no multi-period report columns, configurable chart ranges, other chart types, dashboard customisation or forecasts. |
| KL-30 | Report presentation is fixed | Every report shares the app's screen and browser print layout. There is no custom print-layout designer, branded PDF, scheduled email or Excel export. |
| KL-31 | Opening balances are simple | Opening balances are ledger-level Dr/Cr with no bill-wise or cost-centre opening allocation. |

## Banking, cheques and reconciliation

| ID | Limit | Current behaviour / consequence |
| --- | --- | --- |
| KL-32 | Bank statement import is CSV only | No OFX, QIF, MT940, Excel or live bank feed. |
| KL-33 | Auto-match is narrow | Exact signed amount, one-to-one voucher, and a seven-day date window. No fuzzy narration, tolerance, split matching or many-to-one matching. |
| KL-34 | Reconciliation does not post adjustments | Matched/unmatched is a separate layer. There are no bank charges, interest or adjustment vouchers created from the statement. |
| KL-35 | No statement balance validation | The statement has no opening/closing balance fields, so the import cannot prove it is complete. |
| KL-36 | No manual clearing/cancellation status | A match is the only "cleared" signal. There is no stale cheque, cancelled cheque, stop-payment or manual cleared flag. |
| KL-37 | One instrument per voucher | A voucher can carry one cheque/DD. There are no cheque books, multiple instruments, split payments by cheque, or instrument history. |
| KL-38 | Cheque print is a browser preview | Only cheque payments can be printed. Alignment depends on the browser and printer; there are no MICR, bank-specific stationery presets, overlay calibration or cheque-number pre-printing. |
| KL-39 | DD and receipt printing are absent | DD details and receipt instruments are recorded but not printed as a DD advice or deposit slip. |
| KL-40 | Register scope | Cheque / DD register covers post-dated, due and cleared instruments. No separate exception, stale, cancelled, issued-cheque-book or party-wise cheque register. |

## Inventory and manufacturing

| ID | Limit | Current behaviour / consequence |
| --- | --- | --- |
| KL-41 | Inventory is still shallow | Units, stock groups/items, item lines on four voucher types and weighted-average valuation, now with godowns, batches, transfers, orders, BOMs and production. No physical stock count, batch-wise cost layers, WIP or stock posting to the financial statements. |
| KL-42 | Godowns and batches added; physical stock and batch costing missing | Godowns, transfers, optional batch tracking and expiry dates exist. There is no physical stock count, batch-wise valuation, FIFO/expiry consumption, reorder level, wastage or job work. BOM components cannot be batch-tracked. |
| KL-43 | Orders added; full order cycle missing | Sales/purchase orders carry one item, status and voucher prefill. There are no quotations, delivery/receipt notes, rejection notes, fulfilment/part-shipment tracking, reorder levels, price lists, discounts or additional costs. |
| KL-44 | Stock is operational only | Stock value, including manufactured output, is not posted into the P&L or balance sheet; those statements stay ledger-driven. Labour, overhead and WIP adjustments would need an explicit journal until stock posting is implemented. |
| KL-45 | Limited stock reporting | Stock Summary, godown balances, batch balances and per-item movements exist. No stock ageing, reorder, price-list, batch-cost or value-analysis reports. |
| KL-46 | Simple units only | No alternate, compound or conversion units. |

## Statutory and missing modules

| ID | Limit | Current behaviour / consequence |
| --- | --- | --- |
| KL-47 | Resolved — GST setup, voucher tax and returns added 2026-11-18 | GSTIN/home state, a rate master, CGST/SGST/IGST/Cess tax ledgers, invoice-level tax on four voucher types, HSN codes and GSTR-1/GSTR-3B working papers exist. Remaining GST gaps are KL-72–KL-80. |
| KL-48 | Resolved — e-invoice/e-way bill and tax-audit working papers added 2026-11-18 | B2B e-invoice readiness with draft NIC-style JSON, e-way Part A drafts and tax-audit reconciliations exist. Remaining gaps are KL-94–KL-99. |
| KL-49 | Resolved — TDS/TCS deduction, register and challans added 2026-11-18 | TAN, section/rate/threshold master, TDS on purchases, TCS on sales, party PAN, a register with section/party/quarterly/threshold views and challan tracking exist. Remaining gaps are KL-81–KL-88. |
| KL-50 | Resolved — payroll runs, payslips and salary register added 2026-11-18 | Employee and pay-head masters, fixed monthly salary structures, one journal-posting run per month, printable payslips and a salary register exist. Remaining gaps are KL-89–KL-93. |
| KL-51 | Statutory registers still absent | Tax-audit reconciliations and a Form 3CD-style checklist exist, but there are no statutory registers, company consolidation, compliance calendar or filing history. |
| KL-72 | One GST rate per voucher | Tax is computed at a single rate on the whole taxable value. There are no per-item or per-line rates, and a mixed-rate invoice needs separate vouchers or a manual journal. |
| KL-73 | GST returns are working papers | GSTR-1, the HSN summary and GSTR-3B are screen/CSV reports computed from vouchers. There is no portal filing, GSTN/JSON upload, GSTR-2B reconciliation, annual return, due-date or late-fee tracking, and no filing history. |
| KL-74 | Simplified supply classification | CGST+SGST versus IGST is derived from place of supply against the home state. There is no export/SEZ/zero-rated/deemed-export treatment, bill-to/ship-to, composition scheme, e-commerce operator rule, GST TDS or ITC reversal/reversal rules. |
| KL-75 | Reverse charge is a flag only | RCM tax is posted to the same tax ledgers and reported in both liability and ITC, so it nets to zero. There is no separate RCM payable ledger, cash payment tracking, self-invoice or RCM-specific register. |
| KL-76 | GSTIN checks are structural | GSTINs are validated for format and home-state prefix only; there is no checksum or portal verification, and a party ledger's GSTIN/state pair is not cross-checked. Tax ledgers are ordinary Duties & Taxes ledgers tagged with a role and cannot be created or renamed from a dedicated tax-ledger screen. |
| KL-77 | HSN summary is aggregate | HSN codes live on stock items only (no SAC master for service ledgers). The summary groups by code with quantity, taxable value and proportionally apportioned tax; it does not split by unit quantity code and sums quantities across mixed units. |
| KL-78 | GST needs one balancing line | A GST voucher must have exactly one line for the party, cash or bank on the balancing side; split payments must be merged. GST is not available on foreign-currency vouchers, journals or settlement vouchers. |
| KL-79 | No GST openings or document linkage | Opening GST/ITC carry-forward is not modelled, and credit/debit notes reduce returns by rate without linking to the original invoice (no CDNR matching, amendments, or invoice-wise reconciliation). |
| KL-80 | Rate master is add/delete | GST rates can be added or deleted (when unused) but not edited, versioned or dated, so a rate change means a new rate row; there is no GST rate history. |
| KL-81 | TDS/TCS voucher scope | TDS is deducted only on purchase vouchers and TCS collected only on sales vouchers. Journals, credit/debit notes, receipts, payments and advances cannot carry a deduction, and TDS on an advance or a part-payment must be journalled manually. Bill settlements cannot exceed the net party amount after deduction. |
| KL-82 | One section per voucher | A voucher carries one section and one rate on the whole taxable value. There are no per-line or per-party sections, no multiple deductees on one voucher, and no higher-rate logic for a missing or invalid PAN — the PAN is recorded, not enforced. |
| KL-83 | Thresholds are informational | Section thresholds are shown in a financial-year threshold watch but never enforced on a voucher. Aggregate-payment thresholds must be judged by the user, and the watch uses the selected financial year to date. |
| KL-84 | Challans are tracking records | Challans are stored separately from vouchers: they do not post entries or reconcile against deductions, and there is no interest, late fee, Form 26Q/27Q/27EQ, TRACES, Form 16/16A certificate or filing history. |
| KL-85 | GST and TDS/TCS are mutually exclusive | A voucher cannot carry both GST and TDS/TCS yet; the deduction must be recorded on a separate voucher or journal, so the party balance is split across documents. |
| KL-86 | TDS/TCS needs one balancing line | A TDS/TCS voucher must have exactly one party, cash or bank line on the balancing side; split payments must be merged. TDS/TCS is not available on foreign-currency vouchers. |
| KL-87 | Single TAN and no section history | One TAN per company, no deductor PAN or multiple registrations. Sections and rates are add/delete only with no effective dates or revision history. |
| KL-88 | Local section template | Seeded sections, rates and thresholds are a convenience template, not verified statutory rates. Surcharge, health-and-education cess and section-specific exemptions are not calculated. |
| KL-89 | Fixed monthly payroll only | Each employee carries fixed monthly amounts per pay head. There is no attendance, leave, loss of pay, overtime, arrears, bonus, gratuity, increment history or joining/exit proration, so part-month salary must be adjusted by altering the employee's amounts or passing a journal. |
| KL-90 | PF/ESI/PT are entered, not computed | PF, ESI and professional tax are deduction pay heads with manually entered amounts and a reporting tag. There are no wage ceilings, contribution rates, rounding rules, employer contributions, ECR/ESI returns, challans, Form 24Q or Form 16. |
| KL-91 | One run per month, one journal | A month can be run once and posts a single Journal for all employees. There is no supplementary run, reversal, salary payment matching, bank transfer file or payslip email/PDF; undoing a run deletes its journal and is blocked in a closed year. |
| KL-92 | Flat employee master | Employees are a single list with optional code, designation, PAN and joining date. There are no departments, designations or locations masters, bank details, advances, loans, reimbursements, multi-currency pay or CTC history. |
| KL-93 | Pay heads are labels plus a ledger | Pay heads have a fixed monthly amount, a posting ledger and an optional PF/ESI/PT/TDS tag. There are no formulas, percentages of basic, effective dates, pay-head groups, rounding rules or statutory rate tables. |
| KL-94 | E-invoice JSON is a draft only | The download follows NIC field names but is not validated by a schema, signed, registered with an IRP or acknowledged. There is no IRN, QR code, cancellation, amendment, consolidated B2B reporting, credit/debit-note e-invoice or IRP error handling. The aggregate-turnover applicability test is not applied, so every B2B invoice is listed for review. |
| KL-95 | E-way bills are Part A only | No Part B transporter/vehicle/distance, no portal submission, extension, cancellation, consolidated e-way bill, multi-vehicle movement or validity tracking. The threshold is a configurable working value, not a state/goods rule engine. |
| KL-96 | GST address data is optional | Trade name, registered address, city and PIN, and party address/city/PIN, are optional free-text fields. Missing values block e-invoice readiness but are not enforced on vouchers; there is no phone, email, ship-to/bill-to, export/SEZ or address master. |
| KL-97 | Tax-audit reports are informational | Turnover, GST/ITC and TDS/TCS reconciliations plus the ten-clause checklist are working papers, not a Form 3CD, audit opinion, 44AB applicability decision or disclosure set. The ₹1 crore/₹10 crore thresholds are flags only; the 95% digital-receipts test is not calculated. |
| KL-98 | E-invoice lines are invoice-rate only | Every item uses the voucher's single GST rate and proportional tax; there is no per-item rate, discount, shipping/other charge, pre-tax value, cess non-advalorem, state cess or service SAC master. Unit mapping is limited to common symbols and falls back to OTH. |
| KL-99 | No filing or compliance calendar | There is no GST/TDS/e-way filing, acknowledgement storage, due-date calendar, late-fee/interest tracking or statutory register set. |
| KL-100 | Transfers are single-line and cannot be edited | Each stock transfer carries one item and defaults to the current financial year's dates. Deleting a transfer can make later source-godown balances negative; there is no reversal, edit, multi-line transfer or inter-branch accounting entry. |
| KL-101 | Batch cost is item-level | Batch balances are quantities valued at the item weighted-average cost. There is no batch-wise cost layer, FIFO/expiry picking, expiry alert or automatic batch selection on sales. |
| KL-102 | Orders do not fulfil or link | Orders carry one item and do not reserve stock, record part-delivery, link to the created voucher or close automatically. Creating a voucher leaves the order Open until it is closed manually. |
| KL-103 | Single-level BOM and simple production only | BOMs have one finished item and up to twenty components; production consumes components and outputs finished goods. There are no sub-assemblies/multi-level BOMs, alternative components, by-products, wastage, scrap, rework or job work. |
| KL-105 | BOM components cannot be batch-tracked | A batch-tracked stock item cannot be used as a BOM component, so raw materials must be untracked. Finished output may be batch-tracked. BOMs are also fixed recipes with no revisions or effective dates. |
| KL-106 | Production cost is component cost only | Output enters stock at the consumed components' weighted-average cost. Labour, machine, power and overhead costs are not added, there is no WIP or variance account, and no journal is posted. |
| KL-107 | Production is single-godown and deletable | All components must come from one godown and all output goes to one godown. Deleting a production entry can make later component balances negative; there is no reversal, edit or approval workflow. |
| KL-108 | Whole-workspace conflict, no merge | Every server save replaces the whole workspace under one revision. If another session saved first, the stale save is rejected and the user must reload; there is no field-level merge, lock ownership or conflict diff. Reload snapshots the local copy before replacing it. |
| KL-109 | Tally XML import is accounting plus stock | Account groups, ledgers, stock groups, stock items with opening quantity/rate, balanced accounting vouchers and matching voucher stock lines import. Custom account groups need an existing standard parent; custom top-level groups and units must already exist. Account-group nesting is preserved parent-first. Stock groups are imported flat, so their Tally parent hierarchy is ignored. Batch allocations import as names/expiry on lines for locally batch-tracked items; batch masters and opening batches are not created. Bill allocations, cost centres, GST/TDS detail and original voucher numbers do not import. Imported vouchers are renumbered. Tally APIs and webhooks are absent. |
| KL-110 | Tally XML parser is a subset | The parser handles common All Masters and voucher exports with regexes, not a full namespace-aware XML parser. Unusual Tally templates, multi-currency vouchers, inventory layouts and XML exports with nested optional blocks may be rejected or lose fields. Stock lines that cannot be mapped are skipped while the accounting voucher imports (KL-112). |
| KL-111 | Excel import is one reviewed worksheet | Only `.xlsx` (Office Open XML) is read, not legacy `.xls`, `.ods`, CSV-as-Excel or password/ZIP64 workbooks. One sheet per import: `Ledgers`/`Vouchers` when present, otherwise the first worksheet; there is no multi-sheet merge. It reads cached cell values and does not recalculate formulas. Merged cells, hidden-sheet intent, tables, autofilters and macros are ignored. Dates must be date-styled cells or YYYY-MM-DD text; un-styled serial numbers stay numeric. The converted rows land in the normal CSV review box and obey the same all-or-nothing import rules. |
| KL-112 | Tally stock lines are best-effort | The accounting voucher imports even when its stock lines are skipped. Stock lines are skipped when the item/godown is missing, a batch is missing on a locally batch-tracked item, stock is insufficient, or the item total differs from the voucher because of GST/discount splits. The skipped count and first reason are reported. Stock is not rolled back with the voucher and Tally batch masters/opening batches, batch-wise costing and item-level GST/discount allocation are not modelled. |
| KL-104 | Godown quantity is not a valuation layer | Godown balances use the item average cost; transfers do not create a separate godown valuation. Closing stock value is still one company-wide item value. |

## UX, localisation and quality

| ID | Limit | Current behaviour / consequence |
| --- | --- | --- |
| KL-52 | Desktop-first layout | Responsive enough for tablet/desktop widths, but not a mobile-first or touch-first experience. |
| KL-53 | India/INR assumptions | Indian numbering, rupee wording, Apr–Mar default year and en-IN formatting. Foreign currencies are supported on vouchers, but INR is always the base/reporting currency. No locale switcher, multi-language UI or alternative fiscal calendars. |
| KL-54 | Date input display follows the browser | Stored dates are ISO, printed labels are `DD-Mon-YYYY`, but native date inputs display in the browser locale. |
| KL-55 | No autosave of an unfinished voucher | Leaving voucher entry discards the draft; there is no recovery of unsaved entry. |
| KL-56 | No bulk edit or vouchers grid | Vouchers are altered one at a time; no spreadsheet-style bulk edit, column chooser or saved views. |
| KL-57 | No formal performance benchmark | No load test beyond the engine/browser suites. Very large voucher sets, statement imports and workspaces have no measured target. |
| KL-58 | Print alignment is not automated | Browser tests cover the preview and screen state, not physical printer or cheque stationery alignment. |

## How to use this register

1. Pick a limit by ID when planning the next stage; do not silently widen scope.
2. Add a new row when a new deliberate limitation is introduced.
3. When resolved, change the row to **Resolved** with the date and release/commit
   reference, and update `ROADMAP.md` and `README.md`.
4. Keep this file focused on known gaps, not wishes that have no product decision.

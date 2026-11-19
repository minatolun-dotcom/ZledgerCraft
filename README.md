# ZledgerCraft

A local-first, keyboard-first double-entry accounting app in the TallyPrime
mould: companies, groups and ledgers, balanced vouchers, the usual books and
inventory with godowns, batches, transfers, orders and production. No browser
dependencies and no build tooling beyond Node. By default everything lives in
`localStorage`; the bundled Node server can share one SQLite workspace with
signed-in users on a trusted local network. Setting `DATABASE_URL` and
`NEON_AUTH_BASE_URL` switches the server to Neon Postgres and Neon Managed Auth;
without those variables the app stays local.

See [ROADMAP.md](ROADMAP.md) for the current stage and build order, and
[KNOWN_LIMITS.md](KNOWN_LIMITS.md) for the persistent register of deferred
product, storage, reporting and compliance limits. The register also records
free/self-hosted options for the remaining production limits and a recommended
order for tackling them.

## Run

```bash
npm install
npm start
# http://127.0.0.1:4173/
```

`server-env.js` loads `.env.local` and then `.env` without overriding variables
already set in the process. Tests deliberately skip both files.

Open **Backup & restore → Storage** to enable the server workspace. With no
cloud variables it stores a local SQLite database at `data/workspace.sqlite`,
shares the same books across browser profiles on this machine, uses revision
checks and conservative merge, and falls back to browser storage for the
single-file build. An older `data/workspace.json` is migrated on first start and
renamed `workspace.json.migrated`. Node releases without `node:sqlite` fall back
to the revisioned JSON file. With `DATABASE_URL` set, companies, ledgers,
vouchers, revisions, leases and server audit live in Neon Postgres; an existing
SQLite workspace is copied into an empty Postgres branch on the first start.

### LAN mode with server accounts

Bind to the LAN and set the first owner password:

```bash
HOST=0.0.0.0 ZL_OWNER_PASSWORD='replace with a strong password' \
  ZL_OWNER_NAME='Owner' node serve.mjs
# other devices: http://<server-ip>:4173/
```

On first LAN start the server creates an owner account. Sign in, open
**Companies → Server accounts**, and create accountant and viewer accounts.
Passwords are stored as scrypt hashes and sessions use an HttpOnly,
SameSite=Strict cookie. Accountants can edit vouchers and masters; viewers are
read-only; only owners can manage companies, years, accounts and restores.
Owners can restrict a non-owner account to selected companies; the server filters
reads and rejects writes outside that set, including forged company ids. Scoped
saves still merge independent changes, but hidden companies are preserved and
never sent to the scoped browser. The same panel shows recent sign-in attempts,
active sessions, the server-side save audit, and creates/downloads/restores
server backups. Owners can enable authenticator-based two-step verification
(TOTP) for an account and receive a one-time recovery code; an account can also
be marked as requiring 2FA, which blocks sign-in until TOTP is enrolled and
prevents disabling it until the requirement is cleared. Users can change their
own password. Repeated failed sign-ins lock that account/source for 15 minutes. Server-audit rows are hash-chained, so out-of-band database edits are
detected by the owner audit view. These password and TOTP controls are the
SQLite/LAN path; Neon mode delegates credentials to Neon Auth, which does not
support TOTP/MFA on the managed branch.

**Voucher approvals**

A company can require owner approval for vouchers entered by staff. Enable
**Require owner approval for staff vouchers** while editing the company. Staff
vouchers then wait in the Voucher approvals queue and do not post to ledgers,
reports or inventory until an owner approves them. The submitter can revise a
pending voucher or withdraw it before a decision; the server accepts only the
original submitter's pending edits and rejects changes to another person's
submission. Owners can approve (which assigns the real voucher number) or reject
with a note; proposers cannot decide their own vouchers, and the server blocks
accountant attempts to post directly or alter existing submissions while the
policy is on.

- `HOST=127.0.0.1` (the default) needs no login, which keeps the existing local
dev workflow. Set `ZL_AUTH=1` to require login on localhost as well.
- `ZL_OWNER_USER` changes the seeded username (default `owner`). The bootstrap
  password is only used when the auth database has no accounts.
- `ZL_DATA_DIR=/path` moves `workspace.sqlite` and its auth/session tables.
- `ZL_ALLOWED_IPS=192.168.1.0/24,127.0.0.1` restricts every HTTP request to
  these IPv4 addresses/CIDR ranges. Leave it unset to allow any client that can
  reach the bound interface.
- `ZL_BACKUP_DIR=/path` moves server backups (default `data/backups`).
  `ZL_BACKUP_KEEP` controls retention (default 7) and `ZL_BACKUP_HOURS` controls
  the check interval (default 24). A daily SQLite or Postgres JSON backup is
  created after the first save of the day and verified; owners can
  also create, download or restore one from **Companies → Server accounts**.
  Restoring replaces the books with that snapshot, creates a pre-restore
  backup first, and leaves server accounts and passwords unchanged. These
  copies stay on the server, so download one or copy it to separate storage for
  disaster recovery.
- LAN traffic is HTTP by default, so passwords and books are readable on the
  network path. For HTTPS, set `TLS_CERT_PATH` and `TLS_KEY_PATH`. Use this only
  on a trusted private network; do not forward the port from the internet.
- In signed-in LAN mode the browser does not keep a book mirror or browser
  snapshots. Download a JSON backup from **Backup & restore**, and keep the
  server backups or an off-server copy.

## Build a single file

```bash
node build.mjs
# dist/ZledgerCraft.html — open it directly in a browser
# dist/index.html        — Cloudflare Pages entry point
```

## Test

```bash
node --test tests/
```

The reproducible Chromium/Firefox/WebKit browser and accessibility tooling is a
dev-only workspace under `tools/browser`; it is not part of the app build.

```bash
cd tools/browser && npm ci
BROWSER=chromium npm test
BROWSER=firefox npm test
BROWSER=chromium npm run bench   # 10,000-voucher Day Book render benchmark
```

`.github/workflows/verify.yml` runs the engine/build job plus the browser matrix
and installs the CI WebKit host libraries.

## Deploy

The static app is published from the repository root with GitHub Pages at
`https://minatolun-dotcom.github.io/ZledgerCraft/`. The Pages site uses browser
storage because GitHub Pages cannot run the optional Node/SQLite server. The
Cloudflare custom domain is the hosted configuration with the Neon API.

Cloudflare Pages hosts the same static bundle under the `zledgercraft` project:

```bash
node build.mjs
npx wrangler@latest pages deploy dist --project-name zledgercraft --branch main
```

The Pages deployment is `https://zledgercraft.pages.dev/`; the custom domain is
`https://books.lengkhawm.online/`. Pages serves the single-file app. The
production API runs as a Neon Function (Node 24) and is reached through a
same-origin Cloudflare Worker route:

```bash
npx neon@latest deploy --env .env.local   # API function zledgercraft
npx wrangler@latest deploy                # /api/* proxy -> Neon Function
```

The function is declared in `neon.ts`; its Web-Request adapter is
`neon-function.mjs`. `cf-api-worker.mjs` and `wrangler.toml` forward
`books.lengkhawm.online/api/*` while preserving cookies and setting the
forwarded host/protocol headers plus the real client IP for shared rate limits.
The Worker and Function are both optional for
local/LAN use. Cloud infrastructure work and verification are recorded in
[`docs/CLOUD_INTEGRATION_PLAN.md`](docs/CLOUD_INTEGRATION_PLAN.md).

## Optional cloud integrations

These are optional; missing configuration leaves the server on its existing
local-only behaviour.

**Neon Postgres and Neon Auth**

`npx neon@latest deploy` writes the connection and Auth variables to
`.env.local`, applies the schema and deploys the `zledgercraft` function. Postgres
stores the workspace as a JSONB document plus revision history, leases and
hash-chained audit rows. Neon Auth owns email/password credentials; the app maps
the Neon user to its existing role/company-scope profile and issues its own
HttpOnly session. Profiles, sessions, login history, account lockout and the
short login/reset source-rate limits live in Neon Postgres when `DATABASE_URL`
is set, so they are shared by every function instance. The SQLite tables remain the
local/LAN fallback, and an existing SQLite auth store is copied into an empty
Postgres auth store on first startup.

For a branch-based integration check (creates and deletes a temporary Neon
branch):

```bash
npm run test:neon
```

```bash
DATABASE_URL=postgresql://...              # pooled app connection
DATABASE_URL_UNPOOLED=postgresql://...     # migrations/recovery
NEON_AUTH_BASE_URL=https://.../neondb/auth
ZL_PUBLIC_URL=https://books.example.com    # trusted reset-link origin
```

In Neon mode the TOTP/MFA endpoints return 501, password changes use the Neon
Auth reset link, and the owner account management screen creates role profiles
by email before the person signs up. The local SQLite mode keeps its existing
password, MFA, lockout and session features.

**R2 offsite backups**

When configured, every verified SQLite or Postgres JSON snapshot is uploaded
through R2's S3-compatible API after its local integrity check. The owner backup
list merges R2 objects with the current instance, so a replacement function
instance can still list, download and restore an offsite snapshot. A failed
upload keeps the local snapshot, skips local pruning for that run and can send an
alert.

```bash
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...          # scoped to one bucket
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=zledgercraft-backups
R2_PREFIX=zledgercraft        # optional
R2_ENDPOINT=...               # optional; defaults to the account R2 endpoint
ZL_ALERT_EMAIL=ops@example.com
```

Use an R2 lifecycle rule for retention. The upload is a copy of the verified
snapshot, not a live database file. The owner restore flow downloads the R2 copy
when the local file is unavailable, verifies it and creates a pre-restore backup
before replacing the books. The owner panel also keeps the ten most recent backup
attempts with source, result, offsite status and error.

**Scheduled daily reports**

Owners can enable a daily management summary under **Companies → Server
accounts → Scheduled reports**. It is sent through Resend after the daily backup
check, either from the local server timer or from the Neon Function schedule
trigger (`30 2 * * *` UTC). Each email contains the summary, a branded PDF
attachment and a signed, read-only link that expires after seven days by
default. The link renders a small HTML summary; it does not expose a workspace
dump or require a login.
Owners can also send immediately or preview the signed link. The panel keeps
the last successful send, the latest delivery error and the ten most recent
attempts with source, recipients and result, so a Resend outage is visible
without checking server logs. A failed scheduled report also emails
`ZL_ALERT_EMAIL` once per UTC day when Resend is configured. Set
`ZL_REPORT_SECRET` for a stable signing key and `ZL_REPORT_TTL_HOURS` to change
the default lifetime. Without Resend or a signing secret, scheduled reports are
disabled.

```bash
ZL_REPORT_SECRET=...           # stable HMAC key for report links
ZL_REPORT_TTL_HOURS=168        # optional; 1–720
ZL_SCHEDULER_SECRET=...        # optional manual scheduler credential (Bearer token)
```

**Read-only API**

Owners can create named API tokens under **Companies → Server accounts →
Read-only API tokens**. A token is shown once and stored as a SHA-256 hash in
SQLite or Postgres; it carries only the `books:read` scope, can be restricted to
selected companies, is limited to 120 requests per minute per token, and can be
revoked immediately. Limit counters are stored in SQLite/Postgres, so every
server instance sees the same budget. Send a token as
`Authorization: Bearer <token>` to the versioned endpoints:

- `GET /api/v1/companies`
- `GET /api/v1/companies/{id}`
- `GET /api/v1/companies/{id}/trial-balance?asOn=YYYY-MM-DD`
- `GET /api/v1/companies/{id}/parties?side=receivable|payable&asOn=YYYY-MM-DD`
- `GET /api/v1/companies/{id}/vouchers?from=&to=&type=&limit=&offset=`

The OpenAPI 3.0.3 contract is public at `GET /api/v1/openapi.json`. The API is
read-only: it cannot post vouchers, edit masters or change settings, and there
are no webhooks yet. Token create/revoke events appear in the hash-chained
server audit. `ZL_API_RATE_LIMIT` overrides the per-minute token limit (default
120, maximum 10000).

**Resend email**

Resend powers backup-failure alerts (and, in SQLite/LAN mode, forgotten-password
reset links). The server calls the HTTP API directly, so no SDK is installed.
The verified sender is `ZledgerCraft <noreply@lengkhawm.online>`. Resend accepted
a test message from that address for the configured account owner.

```bash
RESEND_API_KEY=re_...
RESEND_FROM='ZledgerCraft <noreply@lengkhawm.online>'
ZL_PUBLIC_URL=https://books.lengkhawm.online         # trusted origin
ZL_OWNER_EMAIL=owner@example.com                    # optional initial owner email
ZL_ALERT_EMAIL=ops@example.com                      # backup-failure recipient
```

In SQLite/LAN mode, accounts may have no email; owner-initiated password reset
remains available. Reset tokens are hashed, expire after 30 minutes, work once
and revoke existing sessions. In Neon mode Neon Auth sends its own reset email.
Without `RESEND_API_KEY`, `RESEND_FROM` and `ZL_PUBLIC_URL`, Resend features are
disabled.

## What it does

**Company & masters**
- Create, rename and delete companies; switch the open company; financial year
  Apr–Mar by default, editable while the vouchers still fit.
- Local owner, accountant and viewer profiles with role-based access and a
  profile switcher in the header. Owner manages companies, years, users and
  restores; accountant manages vouchers, masters and bank reconciliation;
  viewer is read-only. These browser profiles are not authentication; LAN mode
  replaces them with real server accounts and a sign-in screen.
- Multiple financial years per company with a year selector in the header.
  Closing a year locks its vouchers and creates/selects the next one; closed
  years can be reopened. Reports reset to the selected year when you switch.
- All standard Tally groups, plus custom groups under any group (they inherit
  the nature of their primary group).
- Cost categories and cost centres with add/delete masters. Categories without
  centres and centres used by vouchers are protected from deletion.
- Annual budgets per ledger or group for a financial year, with add/delete
  masters. One budget per target per year is enforced.
- Foreign currencies with a code, name, symbol and dated INR exchange rates.
  INR remains the base currency; voucher amounts can be entered in a foreign
  currency and are posted to the books in INR. Currencies used by vouchers
  cannot be deleted.
- GST registration with GSTIN, legal/trade name, registered address, city, PIN
  and home state, plus a rate master (add/delete, optional cess). Enabling GST
  creates or reuses CGST, SGST, IGST and Cess ledgers under Duties & Taxes.
- TDS/TCS registration with a TAN and a section master (kind, code, description,
  rate and threshold; seeded with common 194C/194J/194I/194H and two TCS
  sections). Enabling it creates or reuses TDS Payable and TCS Payable ledgers.
- Payroll with a pay-head master (earning or deduction, posting ledger and an
  optional PF/ESI/PT tag) and an employee master (code, designation, PAN and
  joining date). Enabling payroll creates or reuses the Salaries and Salary
  Payable ledgers and seeds Basic Salary, HRA, conveyance, PF, ESI and
  professional tax pay heads; each employee stores a fixed monthly amount per
  pay head.
- Ledgers with opening Dr/Cr, optional party GSTIN/GST state, optional party
  address/city/PIN for e-invoices and optional PAN for deductee reporting. Alter
  a ledger's name, group or opening; delete a ledger only when no voucher uses
  it.

**Vouchers**
- Contra, Payment, Receipt, Journal, Sales, Purchase, **Credit Note** and
  **Debit Note** (`Ctrl+F8` / `Ctrl+F9`).
- Multi-line entry with live Dr/Cr totals; the voucher is rejected unless debits
  equal credits, every amount is positive, and the date falls in the year.
- Alter any voucher in place (numbering is kept unless the type changes),
  duplicate it, or delete it.
- Cheque/DD details on payment, receipt and contra vouchers: instrument type,
  number, instrument date and bank ledger. The selected bank must also appear on
  a voucher line. Instrument dates later than the voucher are marked post-dated.
- Cost centre on any voucher line (one centre per line), with the centre shown
  on the accepted voucher. Unallocated lines remain valid and stay outside
  cost-centre reports.
- Bill-wise details: a bill number and due date on sales and purchases, and
  receipts, payments, journals and returns can settle a specific bill. Anything
  unallocated still settles the oldest bill, then becomes an advance. The
  Bill-wise register lists settled and open customer/supplier bills, and the
  Party statement combines a ledger statement with bill and allocation detail.
- Ledger entry has type-ahead from the ledger masters and a `+` button that
  creates a missing ledger without losing the voucher.
- Foreign-currency entry: choose a currency and an exchange rate, enter line
  amounts in that currency, and the voucher posts the converted INR amount. The
  voucher view keeps both the foreign amount and the base value. Stock items and
  bill-wise settlement are not available on foreign vouchers yet, and a foreign
  voucher line is still base-ledger accounting, not a separate foreign-currency
  ledger balance.
- GST on Sales, Purchase, Credit Note and Debit Note vouchers: choose a rate
  and place of supply, add the party GSTIN for B2B, and flag reverse charge.
  Tax is computed from the taxable side, CGST+SGST or IGST plus cess are posted
  to the tax ledgers, and the party/cash line becomes the tax-inclusive total.
  The voucher form previews taxable value, tax split and gross before saving;
  the voucher view records the rate, supply type and GSTIN.
- TDS on purchase vouchers and TCS on sales vouchers: choose a section and the
  deductee PAN (prefilled from the party ledger). The deduction is computed from
  the taxable side, posted to TDS Payable or TCS Payable, and the party/cash line
  is reduced (TDS) or increased (TCS). GST and TDS/TCS cannot be combined on one
  voucher yet.

**Payroll**
- Run payroll for a month: the run debits each earning ledger, credits each
  deduction ledger, credits Salary Payable with net pay and posts one Journal
  voucher. One run is allowed per month and the run stores the amounts and
  voucher lines as a snapshot.
- Printable payslips for a run with company, employee, earnings, deductions and
  net pay, and a salary register by month, employee and pay head with Print/CSV/Excel.
  PF, ESI and professional tax are manually entered deductions with reporting
  tags; no return, challan or certificate is produced.

**Inventory**
- Units of measure, stock groups, stock items (opening quantity, rate and
  optional HSN/SAC code), a primary godown and additional godowns. Opening stock
  is held in the primary godown.
- Optional item lines on Sales, Purchase, Credit Note and Debit Note vouchers,
  each with a godown and, for batch-tracked items, a batch number and expiry
  date. Quantities use up to three decimal places and the item total must equal
  the voucher amount (or the GST taxable value when tax applies).
- Sales and debit notes cannot take more stock than is on hand in the selected
  godown and batch on the voucher date; returns, purchases, transfers and edits
  are checked the same way. Negative closing balances are flagged.
- Stock transfers between godowns with source availability checks, a transfer
  register, audit events and deletion. Transfers move quantity and cost but do
  not change total stock value or post to the ledger.
- Stock Summary with opening, inward, outward, closing quantity and value at
  weighted-average cost; Godown balances with transfer-aware quantities; Batch
  balances with expiry and value at item average cost; and a per-item movement
  report with running balances.
- Sales and purchase orders with party, delivery date, item, godown, batch,
  quantity, rate, status (Open/Closed/Cancelled), filters and a Create voucher
  action that prefills the matching invoice. Orders do not post to the ledger or
  move stock.
- BOM recipes with a finished item, output quantity and up to twenty component
  items. Production consumes components in proportion to the output quantity
  from a chosen godown and brings finished goods into a chosen godown, with an
  optional output batch and expiry. Component availability is checked first.
- Production preserves total stock value: components leave at weighted-average
  cost and finished goods enter at the same total component cost. It is a
  quantity/cost working paper, not a WIP journal; labour and overheads are not
  added and no ledger entry is posted.
- Stock is valued operationally: it does not post stock value into the P&L or
  balance sheet, which stay driven by ledger balances only.

**Reports**
- Day Book, with type and date filters and paging (100/250/500 rows or all);
  CSV/Excel exports include the whole filtered period, not just the visible page.
- Ledger statement with opening balance, running balance and closing balance.
- Trial Balance, Trading/P&L Account and Balance Sheet, each with an as-on date.
- Cash Book / Bank Book, per ledger or combined.
- Bank Reconciliation for any ledger under Bank Accounts: import a statement
  (`Date,Description,Reference,Debit,Credit`), auto-match by signed amount and a
  seven-day date window, match or unmatch manually, and see matched, unmatched
  statement lines, unmatched bank vouchers, inflow/outflow and book balance.
  Matching never alters a voucher; editing or deleting a matched voucher drops
  the stale match.
- Cheque / DD register with period and as-on filters, post-dated/due/cleared
  status, instrument and party detail, totals and drill-down to the voucher.
  Cleared status comes from Bank Reconciliation matches.
- Cheque preview and print for payment vouchers: bank, cheque number, date,
  payee, Indian-numbering amount in words, figures and A/c Payee crossing.
- Cost centre summary by category and centre, with debit/credit/net, voucher
  counts, period filter and click-through to a cost-centre break-up of voucher
  lines.
- Budget vs Actual by ledger or group for a financial year and as-on date:
  budget, actual, variance, used percentage, over-budget status and Print/CSV.
  Actuals use period voucher movement and exclude opening balances.
- TDS/TCS register for a period: deducted or collected amounts, section and
  party summaries, quarterly totals, a threshold watch for the financial year to
  date, and a voucher list with PAN and drill-down. Tax challans can be recorded
  and deleted, with payable to date, challans paid and outstanding shown. Nothing
  is filed and no certificates are generated.
- GST returns as working papers for a period: GSTR-1 outward supplies by rate
  (sales less credit notes), B2B invoices with GSTIN and place of supply, B2C
  supplies by rate, credit notes, an HSN/SAC summary with quantity, taxable
  value and apportioned tax, and a GSTR-3B summary with outward tax, reverse
  charge, input tax credit and net payable per head. Totals are shown for every
  section and the lump-sum GST voucher list links back to the vouchers. Nothing
  is filed, uploaded or reconciled with GSTR-2B.
- E-invoice register for a period: seller profile from GST registration, every
  outward sales invoice with buyer GSTIN/address, B2B eligibility, readiness
  blockers and warnings for missing GSTIN, address, PIN, HSN/SAC or unit, and a
  draft NIC-style JSON download per B2B invoice. No IRN, QR code or IRP response
  is produced and the aggregate-turnover test is not applied.
- E-way bill register for a period: outward invoices at or above a configurable
  minimum (₹50,000 by default), consignee, destination state, taxable and invoice
  value, Part A readiness notes and a draft Part A JSON download. Transporter,
  vehicle, distance and Part B are not captured.
- Tax audit working papers for a period: books turnover from Sales Accounts
  versus GST outward taxable, output-tax and input-credit reconciliation between
  GST-role ledgers and GSTR-3B, TDS/TCS deducted, paid and outstanding, the
  ₹1 crore/₹10 crore threshold flags and a ten-clause Form 3CD-style checklist
  with Ready/Review/Manual status. Informational only; not a Form 3CD or audit
  opinion.
- Forex Revaluation as on a date: foreign balance, book INR value, latest rate,
  revalued INR value and unrealised gain/loss for foreign asset and liability
  ledgers. It is informational and does not post an adjustment journal;
  realised exchange differences on settlement are not calculated separately and
  a base-currency settlement does not reduce the foreign balance shown.
- Salary register for a payroll month: employee-wise earnings, deductions by
  pay head, PF/ESI/PT totals and net pay, with a run list and drill-down to the
  posting voucher and printable payslips.
- Sales, purchase, credit note and debit note registers (or all vouchers).
- Receivables and payables ageing (0–30 / 31–60 / 61–90 / 90+ days) using
  stored bill allocations, with FIFO fallback, due-date-based buckets, customer
  advances and a drill-down list of open bills with references and overdue days.
- Bill-wise register by customer or supplier and bill-date period: original,
  settled and outstanding amounts, status, overdue days, totals and drill-down
  to the voucher or the party statement. Fully settled bills remain listed.
- Party statement for a customer or supplier: the normal ledger statement with
  bill references and allocation detail, followed by every bill up to the report
  date with original, settled, outstanding and overdue status.
- Group Summary with group vouchers drill-down.
- Cash Flow (receipts and payments grouped by ledger group) and Ratio Analysis
  (current, quick, debt/equity, gross and net margin, return on assets).
- Statistics: a monthly MIS chart of sales and purchases with returns, net sales/purchases, receipts, payments and net cash, plus summary cards, a three-month run-rate outlook, top-five customer and supplier concentration tables, a stock position with top items by value and items with no issues, working capital, top expense heads, voucher counts/values by type and ledger counts by group. Print, CSV and Excel cover the statistics screen.
- Audit trail: append-only history of company, master, voucher, user,
  financial-year and restore actions, including who made the change, filterable
  by company or text. Print, CSV and Excel are available. The
  log is carried in backups; restoring preserves current history and adds a
  restore event. It is append-only in the app, but not tamper-proof against
  direct edits to browser storage.
- Year comparison: each financial year side by side for direct income and
  expenses, gross and net profit, assets, liabilities, cash, bank, receivables,
  payables and voucher counts. P&L is scoped per year; balance-sheet figures are
  cumulative at each year end.
- Every report has Print, CSV and Excel export, with a company/period header on the
  printed page.
- The gateway doubles as a dashboard: cash, bank, net P&L, this month's sales,
  receivables, payables and out-of-stock items, all clickable.

**Data**
- JSON backup download and restore, validated on import (structure, ledger
  references, positive amounts, voucher balance, bill allocations, inventory
  masters, HSN codes and item lines, cheque/DD details, cost categories/centres
  and voucher-line references, annual budgets, currencies/rates, foreign voucher
  conversions, GST registration/rates/voucher tax and tax lines, GST seller
  address/PIN and party ledger address/PIN, godowns, stock transfers, batches,
  orders, TDS/TCS
  registration/sections/voucher deductions/PANs and tax challans, payroll
  pay heads, employees, monthly amounts and run snapshots, bank statements
  and their matches) before anything is replaced.
- Restore shows a preview of what the backup contains and snapshots the current
  data first; the last ten manual, daily and pre-restore snapshots can be
  restored or superseded.
- Backups include profiles and the audit trail. A restore keeps existing local
  profiles, merges the current log with the backup's log and appends a restore
  event rather than erasing history.
- When R2 is configured, the verified server snapshot is also uploaded offsite;
  the local snapshot is kept if the upload fails. R2 is not a live database.

**Storage**
- Browser storage remains the default and is the only mode in the single-file
  build.
- The optional server workspace persists to `data/workspace.sqlite` through
  Node's built-in SQLite module, or to Neon Postgres when `DATABASE_URL` is set.
  In SQLite mode, companies, ledgers, vouchers and voucher lines are relational
  tables; every remaining top-level company collection (groups, stock, GST, TDS,
  payroll, banking, budgets, currencies and settings) is stored one row per
  record in `company_records`, with stock items also indexed in `stock_items`.
  Nested configuration stays JSON inside its row so the current accounting
  engine keeps its shape. In Postgres mode the whole workspace is a JSONB
  document with revision history, leases and Postgres audit tables. An older
  whole-workspace blob is migrated once, then removed. On localhost the
  workspace is shared by browser profiles on the same machine without a login.
  In LAN mode the SQLite database also holds server accounts, sessions and the
  server save audit; Neon mode keeps profiles, sessions, login history and
  lockout state in Postgres while Neon Auth owns credentials. Older Node
  versions fall back to `data/workspace.json`.
- Each server save carries the revision the browser loaded. If another session
  saved first, the server attempts a conservative three-way merge when it still
  has the base revision. Independent company, ledger and voucher changes merge;
  overlapping edits or voucher-line edits return a conflict, keep the local
  copy, and offer **Reload server copy**. A company-scoped account merges only
  its visible companies; hidden companies are preserved from the current server
  state and are never returned or overwritten. Duplicate voucher numbers from
  concurrent entry are reassigned. A voucher edit also acquires a hashed,
  expiring lease, renewed while the form is open; saving a changed voucher that
  another session leases is rejected with HTTP 423. Leases are server-local and
  cover vouchers only. The last 20 revisions are retained, with no field-level
  history beyond that window. Reload snapshots local state first.
- Localhost server mode keeps a browser-local mirror so switching back to
  browser storage does not lose the latest state. Signed-in LAN mode disables
  that mirror and browser snapshots.
- CSV import for ledgers (`Name,Group,Opening,Type`), multi-line balanced
  vouchers (`Date,Type,No,Ledger,Side,Amount,Narration`) and bank statements
  (`Date,Description,Reference,Debit,Credit`). Excel `.xlsx` workbooks can load
  ledgers or vouchers into the same review box: the `Ledgers`/`Vouchers` sheet
  is used when present, otherwise the first worksheet. Date-styled cells become
  YYYY-MM-DD. The workbook is converted to the same CSV text and imported
  through the same all-or-nothing path.
- Tally XML import for account groups, ledgers, stock groups, stock items with
  opening stock, balanced accounting vouchers, and voucher stock lines. Common
  All Masters and voucher exports are supported, with Tally dates, entities and
  debit/credit signs. Custom account groups need an existing standard parent;
  custom top-level groups and units must already exist, and stock groups are
  created automatically. Stock lines attach when the item and godown exist and
  their total matches the voucher; batch names and expiry attach when the local
  item is batch-tracked. Otherwise the accounting voucher imports and skipped
  stock lines are reported. Batch masters/opening batches, bill allocations,
  cost centres, GST/TDS detail, original voucher numbers and APIs are not
  imported. Cost-centre allocations, cheque/DD details, currency masters/rates
  and bank matches are also outside CSV and Excel import.
- A daily automatic snapshot is taken after the first voucher of the day, and
  the last ten manual, daily and pre-restore snapshots are kept in the browser.

## Shortcuts

| Key | Action |
| --- | --- |
| `Esc` | Gateway of ZledgerCraft |
| `F2` | Jump to the voucher date (entry) / period fields (reports) |
| `Alt+F2` | Jump to the report's period |
| `F3` | Company info |
| `F4`–`F9` | Contra, Payment, Receipt, Journal, Sales, Purchase |
| `Ctrl+F8` / `Ctrl+F9` | Credit Note / Debit Note |
| `K` | Masters |
| `V` | Vouchers |
| `D` | Day Book |
| `L` | Ledger |
| `T` | Trial Balance |
| `P` | Profit & Loss |
| `B` | Balance Sheet |
| `C` | Cash & Bank Book |
| `R` | Registers |
| `O` | Outstanding |
| `I` | Inventory / Stock Summary |
| `G` | Group Summary |
| `F` | Cash Flow |
| `Y` | Ratio Analysis |
| `S` | Statistics |
| `Alt+S` | Save voucher |

## Compared with TallyPrime

Covered here: the accounting core — chart of accounts, the eight accounting
voucher types, voucher alteration, day book, ledgers, trial balance, P&L,
balance sheet, cash/bank books, registers, receivables/payables with ageing,
group summary, cash flow, ratio analysis, statistics, period selection,
bill-wise receivables, bill-wise register and party statement, godowns, batches,
stock transfers, sales/purchase orders, BOMs and production, GST tax on
invoices with GSTR-1/GSTR-3B working papers, e-invoice/e-way bill drafts and
tax-audit reconciliations, TDS/TCS deduction with registers
and challan tracking, payroll runs with payslips and a salary register, report
export, backup snapshots,
an append-only audit trail, bank statement reconciliation, foreign-currency
vouchers with dated rates and unrealised forex revaluation, and multiple
financial years with year-end closing.

Deliberately not covered (each is a specialist area, and some are statutory):

| TallyPrime area | Status |
| --- | --- |
| Inventory | Partial — units, stock groups/items, item lines on four voucher types, weighted-average stock summary and item movements, godowns, stock transfers, optional batch/expiry tracking, godown/batch balances, sales/purchase orders, BOM recipes and production; no multi-level BOM, wastage, job work, physical stock count, batch-wise costing, WIP accounting or stock posting to the financial statements |
| GST registration, rates and tax on vouchers | Partial — GSTIN and home state, rate master with cess, CGST/SGST/IGST tax ledgers, HSN on stock items and invoice-level tax on four voucher types; no per-item rates, exports/SEZ, composition scheme, ITC reversal or GST on advances |
| GST returns, e-invoice / e-way bill, GST reconciliation | Partial — GSTR-1 outward working papers, HSN summary and GSTR-3B liability/ITC summary with net payable, B2B e-invoice readiness with draft NIC-style JSON, e-way Part A drafts and tax-audit reconciliations; no portal filing, GSTR-1 JSON export, IRP/e-way submission, IRN/QR, Part B, GSTR-2B reconciliation, annual return or Form 3CD |
| TDS/TCS deduction, sections and challans | Partial — TAN, section/rate/threshold master, deduction on purchases and collection on sales, party PAN, register with quarterly and threshold views, and challan tracking; no returns or certificates, threshold enforcement, higher-rate/no-PAN logic, journal deductions or GST+TDS on one voucher |
| Payroll, statutory deductions | Partial — pay heads, employee master with fixed monthly amounts, one journal-posting run per month, employee-wise salary register and printable payslips; no attendance/leave/arrears, formula or percentage pay heads, PF/ESI/PT computation, employer contributions, ECR/returns, Form 24Q/16 or salary payment workflow |
| Bank reconciliation and statement import | Covered — CSV statement import, auto/manual matching and book balance; no OFX/QIF or live bank feeds |
| Cheque/DD details, cheque printing and post-dated registers | Covered — instrument fields on cash/bank vouchers, cheque preview/print and a reconciliation-aware Cheque / DD register; no magnetic-ink cheque stationery presets |
| Cost centres and cost-category reports | Covered — categories, centres, one centre per voucher line, summary and break-up; no split allocations or unallocated reconciliation |
| Annual budgets and budget-vs-actual | Covered — ledger/group budgets, period actuals, variance and over-budget status; no phased, revised, approval or cost-centre budgets |
| Multi-currency and interest calculation | Partial — foreign currency masters, dated rates, foreign voucher entry with INR posting and an unrealised forex revaluation report; no realised gain/loss posting, foreign inventory/bill allocations or interest calculation |
| Multiple financial years per company, year-end closing and carry-forward | Covered — year selector, close/reopen and automatic next year; no closing journal is written because balances are cumulative |
| Bill-wise entry and allocation | Covered — bill refs, due dates, explicit/FIFO settlements, ageing, bill-wise register and party statement with bill detail; no bill-wise opening allocation or bill interest |
| User roles, TallyVault, edit log, cloud sync | Partial — local profiles plus password-backed LAN accounts or Neon Auth, owner/accountant/viewer roles, company-level server scoping, TOTP MFA in SQLite mode, hash-chained server audit, append-only app audit, SQLite or Neon Postgres workspace with conservative and scoped merge; Neon Auth mode has no MFA and uses Postgres profiles/sessions; no vault encryption |
| Tally XML and Excel import | Partial — Tally XML account groups, ledgers, stock groups, stock items with opening stock, balanced vouchers and matching voucher stock lines import; batch names/expiry attach to locally batch-tracked items; Excel `.xlsx` ledgers and vouchers load into the reviewed CSV path; custom Tally groups need a standard parent and units must pre-exist; skipped stock lines do not roll back the voucher; no batch masters, bill allocations, cost centres, GST/TDS detail, voucher numbers, APIs or webhooks |
| Custom printing layouts | Print view plus CSV and Excel export; no layout designer |

Semantic notes: sub-period P&L excludes ledger opening balances (they belong to
the year, not the slice); receivables ageing settles the oldest invoice first
when a party has both invoices and receipts; and stock valuation is
informational only — purchases, sales and stock value reach the books through
the ledger lines you enter, not through the item lines. Closing a year does not
delete or rewrite anything: ledger totals and prior-year profit carry into the
next year cumulatively, and closed years simply reject new or altered vouchers.

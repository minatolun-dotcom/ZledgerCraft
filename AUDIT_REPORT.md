# ZledgerCraft audit report

Date: 2026-11-19

Scope: the current dependency-free app in this repository — server, auth,
workspace storage/merge, accounting engine, UI, CSS and browser flows. This
report began as an audit; the findings below were then remediated in priority
order. The status of each item reflects the current tree.

## Baseline

| Check | Result |
| --- | --- |
| `node --check` on server, auth, workspace, merge and UI modules | pass |
| `node --test tests/` | 219/219 pass |
| Import fixtures and deterministic malformed-input tests | pass for CSV, Tally XML and XLSX |
| Playwright suites | 27 feature suites pass; CA core 117/117, CA advanced 105/105, render 7/7, login/reset 9/9 and axe 6 screens pass in Chromium and Firefox |
| 31-screen responsive sweep at 1440/1024/768/390 | no document overflow, no page errors |
| 48 voucher/viewport responsive cases | no document overflow at 1440/1024/900/768/600/390 |
| Novice/adversarial button crawl | 33 screens, 254 enabled buttons, 0 page errors |
| Invalid and empty form passes | 127 invalid submissions across 32 screens; 37 empty forms; 0 page errors |
| All-screen stored-XSS sweep | 32 screens; 0 injected elements after the P&L fix |
| LAN server-account and login UI smoke tests | pass |
| Single-file build | 833.0 kB; `dist/ZledgerCraft.html` and Pages `dist/index.html` |
| XSS smoke test with hostile company, ledger and narration values | no script injection; content rendered as text |
| Malformed `Host` request | rejected; server stays up (regression test) |
| Response headers on `/`, JSON and 404 | CSP, nosniff, frame denial, referrer and permissions policies present |

## Code audit

### P0 — Unauthenticated malformed Host crashes the server — **FIXED**

**Location:** `serve.mjs` request handler

`requestHandler` builds the request URL with the client-supplied `Host` header:

```js
new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`)
```

A request with `Host: [` throws `TypeError: Invalid URL` before any route runs.
The async request handler has no catch-all, so Node exits. Verified over a raw TCP
request against a LAN-mode server; the process printed the stack and stopped.
This is a denial-of-service vulnerability against the whole server, reachable
without authentication.

**Applied fix:** the request URL is built with a fixed `http://localhost` base
because only `pathname` and `searchParams` are used. The server callback also
catches any rejected request promise so one handler failure cannot terminate the
process. A raw-socket test sends `Host: [` and then verifies `/api/workspace`
still returns 200 and the server process has not exited.

### P1 — No HTTP security headers — **FIXED**

**Locations:** every response passes through `requestHandler`; JSON also applies
the same headers directly.

Responses currently set only content type and cache policy. There is no:

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options` / `frame-ancestors`
- `Referrer-Policy`
- `Permissions-Policy`
- HSTS when TLS is enabled

Verified with `curl -I http://127.0.0.1:4180/`. The UI renders data through
`innerHTML`; escaped output prevents the tested XSS, but CSP is the missing
defence-in-depth layer. Clickjacking protection is also absent.

**Applied fix:** one `securityHeaders()` helper now sets CSP, `nosniff`, frame
denial, `no-referrer`, a restrictive permissions policy and HSTS when the app
itself terminates TLS. The regression test checks static, JSON and 404 paths.

### P2 — Server-side audit does not cover every privileged action — **FIXED**

**Locations:** `serve.mjs` auth and workspace handlers; new `server_events`
hash chain.

Workspace saves are hash-chained, but:

- `DELETE /api/workspace` clears the workspace without a server-audit row.
- Creating, updating, deleting, resetting and MFA-changing server accounts do not
  write to the server audit.
- A password change creates a new session but the account action itself is not
  recorded in the server audit.

Login events cover sign-in attempts. A separate `server_events` table now records
account create/update/delete, password reset/change, session revocation, MFA
enable/disable, workspace clear/restore and manual backups. It has its own
SHA-256 hash chain, owner-only endpoint fields and a visible owner panel. The
server API test asserts create/MFA/backup/restore/clear events and chain validity.

### P2 — TOTP codes are not single-use — **FIXED**

**Location:** `server-auth.js` (`totpCounter`, `verifyMfaCode`)

`verifyTotp` accepts any valid code in the ±1 counter window and does not remember
the last accepted counter. A code observed or replayed within that window can be
used again. `AuthStore.verifyMfaCode` now persists `mfa_last_counter` and consumes
the matching counter atomically; login and password-change both use it. Tests
assert a replayed API login is rejected while the next time step succeeds.

### P2 — `src/ui.js` is a 9,395-line monolith — **FIXED**

**Location:** `src/ui.js`, new `src/ui-screens.js`, `src/ui-constants.js` and
`src/ui-server.js`

The file is now split by responsibility:

- `ui.js` — state, auth/workspace lifecycle, event handlers, exports and the
  screen router (about 4,700 lines).
- `ui-screens.js` — all 81 screen renderers and screen-specific helpers (about
  5,100 lines), reading live state exported by `ui.js`.
- `ui-constants.js` — navigation, report titles and audit labels.
- `ui-server.js` — the owner-only server account/audit/backup panel.

The screens module imports live read-only state from `ui.js`, while `ui.js`
imports the screen functions. This is a deliberate circular module boundary; it
is safe because the screen module only defines functions at evaluation time and
all state access happens on later render calls. The single-file build lists
`ui-screens.js` before `ui.js`. All 27 browser suites and the 31-screen sweep pass
after the split.

### P3 — Smaller server hardening items

| Location | Finding | Status |
| --- | --- | --- |
| `serve.mjs` login map | In-memory `loginAttempts` map could accumulate and was not shared by multiple instances. | **Fixed:** login/reset source limits now use the shared SQLite/Postgres `auth_login_limits` table with expiring windows and locks. |
| `server-auth.js` | `scryptSync` blocks the event loop during login. | **Open:** strict rate limits reduce exposure; converting to async `scrypt` would ripple through the synchronous auth API. |
| `serve.mjs` static files | Lexical path validation followed symlinks. | **Fixed:** `realpath` must remain under the app root. |
| `serve.mjs` 404 | Body reflected `request.url`. | **Fixed:** fixed “Not found” body. |
| workspace clear | No server audit row. | **Fixed:** `workspace.clear` event in the server-event chain. |

## UI audit

The surface is **Operate**, not a marketing page. Per the repository’s
`AGENTS.md`, the `design-taste-frontend` landing-page patterns are not applied to
the accounting workspace; its visual-quality criteria were used as a secondary
lens. Impeccable’s Operate guidance and craft-floor checks were applied directly.

### Audit health score

| # | Dimension | Score | Key finding |
| --- | --- | --- | --- |
| 1 | Accessibility | 3/4 | Contrast, skip link, page-level h1s, document title, accessible names and focus tokens are fixed; a full axe scan is still not available and error-to-field associations are partial. |
| 2 | Performance | 3/4 | Lean 833.0 kB build, no runtime dependencies or images; Day Book is paged and a 10,000-voucher benchmark exists, but other screens still use full-tree `innerHTML` renders. |
| 3 | Theming | 3/4 | `--muted` is defined, warning contrast is corrected and reduced motion is respected; many hard-coded colors and light-only theming remain. |
| 4 | Responsive Design | 3/4 | All 31 screens stay within the viewport at 1440, 1024, 768 and 390px; some dense tables use contained horizontal scrolling rather than full card layouts. |
| 5 | Implementation Integrity | 3/4 | Coherent, product-specific Tally-like system; login branding fixed, UI split into router/screens/constants/server modules, live-state coupling remains. |
| **Total** | | **15/20** | **Good — remaining work is incremental** |

### P1 — Mobile accounting screens overflow the viewport — **FIXED**

**Evidence before the fix:** Playwright at 390×844:

- Day Book: document width **476px**
- Voucher entry: document width **796px**
- Outstanding: **790px**
- Party statement: **655px**
- Cash & Bank: **579px**
- Masters: **538px**
- 768px: Outstanding is **793px**
- 1024px: Outstanding is **1031px**

The voucher line table (`src/ui.js:2859`, `styles.css:1144-1220`) has inputs and
selects whose min-content width exceeds the viewport. Many report tables in
`src/ui.js` (for example `:2996`, `:3038`, `:3076`) are not wrapped in the existing
`.table-scroll` container. The mobile navigation at `styles.css:1419` is a
horizontal flex row without a constrained parent, so it also expands the
document.

**Applied fix:** report panels are contained scroll regions at tablet widths;
`.sidebar` and its nav are constrained; voucher lines and stock lines become
labelled cards at 600px; the voucher type grid becomes two columns; the active
nav item is scrolled into view and the nav is labelled. The post-fix sweep of all
31 screens at 1440, 1024, 768 and 390px reports no document overflow and no page
errors.

### P1 — Warning and secondary text fail WCAG AA contrast — **FIXED**

Computed from the CSS tokens:

- `.role-banner.warn`: `#b97713` on `#fdf6e7` = **3.42:1** (normal text; fails 4.5:1). This is used for important viewer/accountant/security warnings at `styles.css:2007`.
- `.side-note`: `#8794aa` on `#f7f9fc` = **2.91:1** (0.72rem; fails 4.5:1).

Other checked pairs pass: muted text on white 7.76:1, muted on the app background
6.74:1, navy topbar text 7.72–15.36:1, success badge 4.73:1.

**Applied fix:** warning foreground is now `#7a4b00` on `#fdf6e7` (**6.89:1**)
and `.side-note` uses `var(--ink-soft)` (**7.36:1**). Verified by calculation and
browser rendering.

### P1 — Stored XSS in the Profit & Loss subtitle — **FIXED**

**Location:** `src/ui-screens.js:1616` (`pnlScreen()`)

The Trading Account subtitle interpolated editable group names directly:

```js
`${primaryName('sales')} less ${primaryName('purchase')} and direct expenses …`
```

`primaryName()` returns `active.groups[…].name`; custom groups can be renamed in
the UI and arrive from imported workspaces/backups. A name such as
`<img src=x onerror=…>` therefore became live markup. Under the served app the
CSP blocked the inline handler, but CSP is not output encoding, and the
single-file `dist` build has no response headers, so the same stored value would
execute there.

A new sweep seeded the payload into company, group, ledger, stock-item, godown
and user names and visited 32 screens. Only Profit & Loss created injected
elements: 2 live `<img>` nodes, each accompanied by a CSP violation. The earlier
XSS smoke test did not catch this because it varied company, ledger and narration
values but not group names and did not open the P&L. Both `primaryName()` calls
are now wrapped in `esc()`. The same sweep reports `xss 0, imgs 0, errors 0`; run
again against the built single-file app, where no CSP is present, it also reports
0 executed payloads across all 32 screens.

### P1 — Statistics used GST/TDS-inclusive voucher totals — **FIXED**

**Location:** `src/accounting.js` (`statistics()`)

The Statistics screen's monthly sales, purchases and returns, and its top-party
concentration, summed `voucher.total`. That total includes GST output tax, input
credit and TDS/TCS payable, so tax collections were reported as turnover and tax
liabilities inflated supplier volume. In the CA scenario the screen showed sales
of **5,60,600.00** and purchases of **2,74,400.00**, while the ledgers carried
**5,08,000.00** and **2,45,000.00**. The sales difference of 52,600.00 was GST
output of 52,500.00 plus TCS of 100.00; the purchase difference of 29,400.00 was
input tax credit.

**Applied fix:** statistics use the accounting value of each voucher —
`voucher.gst.taxable ?? voucher.tds.base ?? voucher.total` — with credit/debit
notes still netted. The core scenario now asserts net sales of 5,08,000.00 and
net purchases of 2,45,000.00 and rejects the old tax-inclusive figures. A
regression test (`statistics use accounting values, not GST or TDS-inclusive
totals`) covers the same distinction in the engine suite.

The corrected purchase KPI is all Purchase-voucher spend net of debit notes. It
includes the 50,000.00 professional-fee purchase, so it differs from the
Trading Account's Purchases line of 1,95,000.00, which excludes that indirect
expense. The figure is now tax-correct; the broad KPI label is noted below.

### P2 — Mobile navigation hides the active screen — **FIXED**

The horizontal nav is now a contained scroller, has `aria-label="Primary"`, and
`render()` scrolls the active item into view without moving the page.

### P2 — Login brand loses “CRAFT” — **FIXED**

**Location:** `styles.css` auth-card brand rule.

The auth card now sets an accent color on the `CRAFT` span; the login screenshot
shows the full “ZledgerCRAFT” wordmark.

### P2 — Missing document semantics and form labels — **FIXED**

- A skip link now precedes the app shell and targets `#main-content`.
- Screens without a visible h1 receive a screen-reader-only page h1; visible h1s
  are retained on Gateway, Vouchers and voucher entry. `document.title` follows
  the current screen.
- The backup and import textareas now have explicit accessible names; login
  fields reference the login error.
- Remaining field-level error associations are incremental, not blocking.

### P2 — Focus and touch affordances — **FIXED**

A `:focus-visible` token is applied to buttons, links, summaries and tabbable
controls; small buttons and icon buttons get a 44px minimum on phones.

### P2 — 1024px voucher header overflow — **FIXED**

**Location:** `styles.css:1215` (`.voucher-meta`)

The voucher header meta row was a non-wrapping flex row. At 1024px it forced a
12px document overflow and clipped the voucher date field. The row now has
`flex-wrap: wrap`, `min-width: 0` and `max-width: 100%`. All 48 voucher
type/viewport combinations report zero overflow at 1440, 1024, 900, 768, 600 and
390px.

### P3 — Bank Reconciliation showed a raw screen key — **FIXED**

**Location:** `src/ui-constants.js:99`

The screen had no report-title entry, so its fallback title was the literal
`bankRecon`. Added `bankRecon: 'Bank Reconciliation'`; the panel heading and
`document.title` now use the human label.

### P3 — Statistics purchase KPI label is broader than the P&L — **FIXED**

The Statistics label “Net purchases” was all Purchase-voucher spend, including
service purchases, while the Trading Account's “Purchases” line is trading stock
only. Both figures are correct for their definitions, but the dashboard label
could be misread by a reviewer comparing it with the P&L. The KPI is now labelled
**Purchase spend**, with “All purchase vouchers, after returns” underneath, and
the CA scenario asserts the new label and figure at 1440px and 390px.

### P3 — Theming and visual polish — **PARTIALLY ADDRESSED**

- `--muted` is now defined as `var(--ink-soft)`; the undefined-token bug is gone.
- Hard-coded colors remain outside the token system (warning, status, table
  backgrounds, cheque paper), and there is no dark theme. This is acceptable for
  the current light-only Operate surface but should be intentional.
- The empty Gateway leaves a large dead area under the shorter right column at
  1440px; the first screen is more sparse than the dense report screens.
- A `prefers-reduced-motion` branch now disables the card/button/nav transition.

## Novice and adversarial browser pass

Playwright was used as an external test tool only (installed under `/tmp/visual`);
the app remains dependency-free. Cases ran against fresh data directories and
snapshot/restored `localStorage` around destructive actions.

| Area | Cases | Result |
| --- | --- | --- |
| Buttons and navigation | 33 screens; 254 enabled buttons; 50 downloads; 14 dialogs | 0 page/console errors; 25 state changes |
| Form validation | 127 invalid submissions across 32 screens (blank required, letters in numeric fields, bad dates, overlong text) | 0 page/console errors; 14 state changes |
| Empty forms | 37 forms submitted untouched | 0 errors; only payroll/GST/TDS settings toggled disabled; no records created |
| Numeric abuse | `abc`, `NaN`, `Infinity`, `1e309`, negatives, zero, `0.001`, `1e308`, whitespace | rejected; `1,000` normalised to `1,000.00`; `1.005` rounded to `1.01` |
| Accounting scenario | 7 vouchers across sales, purchase, receipt, payment, journal, credit/debit note; independent numbering | day book 43,000.00; trial balance 32,000.00; P&L 4,500.00; balance sheet 27,000.00; receivables 3,500.00; payables 2,500.00; cash/bank 23,500.00 |
| Mutation | altered sale; deleted rent voucher | P&L 6,500.00 / balance sheet 29,000.00; then P&L 7,500.00, cash/bank 24,500.00, balance sheet 30,000.00 |
| Double submit | Create voucher twice via repeated submit | exactly one voucher |
| XSS | hostile company, group, ledger, stock-item, godown and user names; 32 screens | 0 injected elements after the P&L fix; no dialogs |
| Responsive | 31 sidebar screens at four widths; 48 voucher cases at six widths | zero document overflow; no page errors |
| Existing feature suites | 22 suites (`app-flow`, backup/import/export, bank, bills, budgets, cheque, cost centres, currency, gateway, GST, inventory, payroll, responsive, TDS, users, years) | pass |

Limitations of the original novice pass were file-upload inputs, unparsed
downloads, auto-accepted dialogs and Chromium-only testing. The later CA pass
closed those gaps: imports were loaded through real file inputs, the GST,
trial-balance and backup downloads were parsed, all confirmation text was
asserted, and the full core scenario passed in both Chromium and Firefox. `window.print()` remains stubbed,
and no axe-core scan was run.

## Professional CA pass

A second browser pass acted as a practising chartered accountant running a
synthetic Maharashtra manufacturing company for 2026-27: opening balances,
capital, loans, fixed assets, raw material and finished goods, GST, TDS, TCS,
payroll, cost centres, budgets, bank accounts, cheques, bills and orders. The CA
work ran as two suites: a 117-check core books/reports scenario, executed in both
Chromium and Firefox, and a 105-check advanced controls and adversarial scenario
against the core scenario's saved workspace. A separate two-context run checked
concurrent server workspace saves.
Playwright remained an external tool under `/tmp/visual`; the app has no added
dependency.

| Area | Coverage | Result |
| --- | --- | --- |
| Vouchers and books | 22 vouchers across all eight voucher types (sales, purchase, receipt, payment, journal, credit note, debit note, contra), plus a payroll run; domestic and export GST, TDS, TCS, forex, inventory, cost centres and narrations | 117/117 checks in each browser; 0 page or console errors; 2 CSV exports parsed |
| Reports and masters | Day Book, Trial Balance, P&L, Balance Sheet, Cash & Bank, Bank Book, Receivables/Payables, Party Statement, GST summary, TDS, Payroll, Stock, Cost Centre, Budget and Audit reports; master creation, validation and deletion guards | figures reconciled to ledgers and source vouchers |
| Orders and year-end | Create, close, reopen, cancel, filter and delete orders; order-to-voucher prefill; add, close and reopen financial years; closed-year posting and deletion guards | pass; closing 2026-27 created and selected 2027-28 with a zero P&L and carried 83,300.00 as the P&L reserve |
| Data controls | Backup download parsed before restore, corrupt restore, invalid restore, manual snapshot; second company; CSV ledger and voucher imports through file inputs; Tally XML through a file input; trial-balance tally; unbalanced import rollback | pass |
| Roles and security | Viewer, accountant and owner permissions and permission-denied controls | pass; denied actions stayed denied |
| Concurrent sessions | Two isolated browser contexts sharing the SQLite workspace; overlapping writes; independent additions; save after merge | overlapping write rejected with 409; one client merged both additions and saved again; 0 page errors |
| Adversarial entry | Over-selling, back-dated stock, unknown batch, return above stock, negative amounts, unbalanced vouchers, GST+TDS together, invalid PAN/GSTIN, future dates, over-allocation, duplicate ledger, and deletion of used ledgers, stock items, godowns and cost centres | all rejected or blocked; no corruption or page errors |
| Bank reconciliation | Auto-match, unmatch, manual rematch and clear | pass; 10 of 11 items auto-matched, with the unmatched item reconciled manually |

Core accounting results after the CA scenario:

| Measure | Amount / result |
| --- | --- |
| Day Book total | 15,83,300.00 |
| Trial Balance | 40,04,400.00 debit and credit |
| P&L net profit | 83,300.00 |
| Balance Sheet total | 35,62,700.00 |
| Cash and bank | 15,17,200.00 |
| Receivables / payables | 5,60,500.00 / 2,50,000.00 |
| GST output / ITC / net | 52,500.00 / 29,400.00 / 23,100.00 |
| Payroll gross / deductions / net | 1,01,200.00 / 9,920.00 / 91,280.00 |
| Closing stock | 2,32,500.00 |
| Bank Book | 13,92,100.00 |
| Statistics net sales / purchase spend | 5,08,000.00 / 2,45,000.00 after the fix |

Advanced controls produced 105/105 checks, 0 page or console errors, 10 native
dialogs and 1 parsed backup. Instead of blindly accepting dialogs, the run now
asserts their exact text for order, voucher, master and year deletion, year
closure and reopening, backup replacement, and bank-statement clearing. Ledger,
voucher, Tally XML and bank-statement imports were loaded through their file
inputs and confirmed in the review box before import. The backup download was
parsed and then used to recover the 22-voucher books.

The only product defect found by this pass was the tax-inclusive Statistics
calculation, now fixed and covered by the engine regression test. The purchase
KPI label ambiguity was also corrected. The core scenario passed all 117 checks
in Chromium and Firefox, including parsed GST and trial-balance CSV exports and a
390px Statistics layout with no document overflow.

GST, TDS, e-invoice and e-way outputs were validated as internal reports, register
rows and draft JSON payloads. Live portal filing and IRP/e-way submission are
declared product exclusions in `KNOWN_LIMITS.md` (KL-73 and KL-94–KL-99), not
untested branches of this build; exercising them would require registered API
credentials and acknowledgements.

## Positive findings

- The accounting UI has a coherent, product-specific identity: navy/amber,
  Tally-like density, keyboard hints and consistent panel/table vocabulary. It
  does not read as a generic generated dashboard.
- User-supplied company, ledger and narration values rendered safely in the XSS
  smoke test; the later all-screen sweep found one group-name sink in P&L, which
  is fixed, and now reports zero injected elements across 32 screens.
- A deterministic accounting scenario produced 7 vouchers, a day-book total of
  43,000.00, independent numbering and balanced statements; edits and deletions
  moved P&L, balance sheet and cash/bank totals exactly as expected.
- A novice-style crawl exercised 254 enabled buttons and 127 invalid field
  submissions with no page or console errors, no double-submitted vouchers and
  no unintended records from empty forms.
- Server permissions, company scoping, login lockout, session revocation, MFA,
  backup restore, hash-chained save audit and the new server-event audit have
  engine coverage.
- The dependency-free constraint is respected; no runtime packages, images or
  external assets.
- 196 engine tests, 27 feature suites, the two CA scenario suites in Chromium
  and Firefox, and the two-client workspace merge test provide a strong
  regression baseline; the 31-screen responsive sweep is clean at all four
  target widths.
- `ui.js` is split into a router/handler module, screen family, constants and
  owner-server panel without changing the single-file build or runtime API.

## Recommended order — completed

1. **P0:** malformed-Host crash fixed; raw-socket regression test added.
2. **P1:** security headers applied to all paths; mobile containment and voucher
   cards added; warning/side-note contrast fixed.
3. **P2:** server-event audit, single-use TOTP, skip link, page h1s, accessible
   names, focus tokens, login branding and mobile-nav visibility fixed.
4. **P3:** `--muted` defined, transient login map pruned, static symlinks rejected
   and 404 reflection removed. `scryptSync` remains synchronous by design.
5. **Novice/adversarial pass:** escaped P&L group names, fixed the 1024px voucher
   header overflow and the Bank Reconciliation title; expanded the XSS sweep to
   all screens and entity types.
6. **Professional CA pass:** fixed Statistics to use net accounting values rather
   than GST/TDS-inclusive totals, added the engine regression test, renamed the
   broad purchase KPI to “Purchase spend”, and reconciled all statements for a
   22-voucher manufacturing scenario.
7. **Coverage closure:** repeated the full core scenario in Firefox, drove imports
   through file inputs, parsed downloaded CSVs and backups, asserted every native
   dialog, and exercised concurrent workspace sessions and merge.
8. **Follow-up quality work:** add a full axe browser pass when a dependency-free
   or vendored option is acceptable, and consider converting auth hashing to async
   `scrypt` if login latency becomes material.

## Deferred verification and integration work

These are the two items this audit could not close. They are recorded so they
can be picked up deliberately rather than being mistaken for passing coverage.

| ID | Item | Current state | Next step |
| --- | --- | --- | --- |
| D-01 | WebKit/Safari browser coverage | The browser runner supports `BROWSER=webkit` and CI installs the host libraries, but this local host still lacks `libicu74`, `libxml2`, `libavif16`, `libharfbuzz-icu0`, `libmanette-0.2-0` and `libhyphen0`, so the engine cannot launch here. | Let CI complete the WebKit matrix, or install the same host libraries locally. The source app is unchanged; this is test-environment work. |
| D-02 | Live GSTN, IRP and e-way submission | The app produces GST working papers, draft NIC-style e-invoice JSON and e-way Part A drafts, but does not file, sign, register an IRN/QR or store portal acknowledgements. This is already registered as `RL-10` and `KL-73`/`KL-94`–`KL-99`. | Treat it as a separate credentialed integration: filing checklist and acknowledgement storage first, then a portal adapter with sandbox credentials. Do not represent draft exports as filed returns. |

## Verification limitations

- Accessibility now has a dev-only axe check in `tools/browser/axe.cjs` across
  six representative screens; it is not an exhaustive audit of every screen and
  state.
- The browser audit now covers all 31 screens at 1440, 1024, 768 and 390 widths,
  plus 48 voucher cases down to 390px. Dense tables may still scroll inside their
  panel; the document itself does not overflow.
- The core CA path ran in Chromium and Firefox. Playwright's WebKit engine was
  downloaded, but this host lacks `libicu74`, `libxml2`, `libavif16`,
  `libharfbuzz-icu0`, `libmanette-0.2-0` and `libhyphen0`, so WebKit could not
  launch without system-level package installation. File-input imports and
  confirmation-dialog assertions were exercised in Chromium; the full core
  workflow, including CSV download parsing, was repeated in Firefox.
- Live GSTN, IRP and e-way portal submission is not implemented and was not
  attempted; see deferred item D-02 and the declared product scope gaps.
- The taste skill is scoped to public-facing pages in this repository; its
  landing-page structure was intentionally not applied to the workspace.
- The malformed-Host and header checks were run against an HTTP server; TLS/HSTS
  behavior was not exercised because no certificate was available.
- The full server-event chain test exercises create, MFA, backup, restore and
  clear; it does not simulate physical tampering with the SQLite file.

## 2026-11-21 adversarial security audit

Scope: black-box HTTP attacks against isolated local servers plus source review
of the Node server, Cloudflare Worker, Neon Function adapter, auth, workspace,
backup, report and static-file code. Production was not touched during the audit;
the fixes were deployed afterward with explicit authorization (see the
deployment record below).

### Findings and remediation

| ID | Severity | Finding | Evidence and status |
| --- | --- | --- | --- |
| SEC-01 | P1 | Client-supplied `X-ZL-Client-IP`, `X-Forwarded-For` or `CF-Connecting-IP` bypassed `ZL_ALLOWED_IPS` and the per-source login lockout. | Before: `/api/auth/me` returned 403 without a header and 200 with `X-ZL-Client-IP: 192.0.2.10`; rotating the header produced twelve `401` responses and no `429`. After: spoofed headers without `ZL_PROXY_SECRET` stay 403, and rotating headers over twelve bad logins produced `401 × 8` then `429 × 4`. **Fixed** by trusting forwarding headers only when the proxy proves a shared secret. |
| SEC-02 | P1 | `POST /api/internal/scheduler` accepted any request carrying `X-Neon-Trigger-Invocation-Id`, so an unauthenticated caller could force backups and report sends. | Before: a forged header returned `200 {"ok":true}`. After: forged header 401; correct Bearer token and trigger path token 200; no configured secret always 401. **Fixed** with a required `ZL_SCHEDULER_SECRET`; the Neon trigger uses a path token because Neon rejects query strings in trigger paths. |
| SEC-03 | P2 | The static server exposed server source, configuration, tests and `node_modules`. | Before: `/serve.mjs`, `/server-auth.js`, `/server-env.js`, `/package.json`, `/wrangler.toml`, `/tests/server-auth.test.mjs` and `/node_modules/pg/package.json` all returned 200. After: all return 403; app assets still return 200. **Fixed** with an explicit public-asset allowlist plus a real-path check. |
| SEC-04 | P2 | `data/` was `755` and `workspace.sqlite`, `-wal` and `-shm` were `644`, exposing books, password hashes and MFA secrets to other local accounts. | Before: `755`/`644`. After: `700`/`600`. **Fixed** with a restrictive umask, startup chmod and private JSON writes. |
| SEC-05 | P2 | Public signed-report HTML responses omitted the server security headers. | Invalid and valid report responses now carry CSP, `nosniff`, frame denial, referrer and permissions policies. **Fixed.** |
| SEC-06 | P2 | Report-link HMAC keys silently fell back to `DATABASE_URL` or the owner password. A leaked report link could therefore be used as an offline password-guessing oracle, and key rotation was coupled to unrelated secrets. | `reportSecret()` now requires a dedicated `ZL_REPORT_SECRET`; a regression test asserts the fallback is gone. **Fixed.** |
| SEC-07 | P3 | Authentication JSON bodies could consume up to the 20 MB workspace limit. | Auth endpoints now cap bodies at 64 KiB and reject an oversized declared `Content-Length` before reading. **Fixed.** |

### Checks that did not find a vulnerability

- **Stored/reflected XSS:** the hostile-data sweep seeded script and event-handler
  payloads into user-controlled fields and visited all 32 screens. It found 35
  checks with zero injected DOM nodes and zero script execution, both against the
  Node server and the single-file `file://` build.
- **CSV formula injection:** exported cells beginning with `=`, `+`, `-` or `@`
  are prefixed with a single quote; the XLSX writer uses inline strings.
- **SQL injection:** workspace, auth and audit queries use bound parameters and
  reject unknown identifiers.
- **Path traversal and symlink escape:** traversal is normalised, the public
  allowlist is applied after normalisation, and the resolved real path must stay
  inside an allowed public directory.
- **Workspace authorisation:** non-owner reads and writes are company-scoped;
  forged company ids and out-of-scope saves are rejected.
- **Session and credential handling:** session tokens are hashed at rest,
  cookies are `HttpOnly` and `SameSite=Strict`, sessions are revocable, TOTP
  counters are single-use, and login/reset limits are stored server-side.
- **Dependencies and secrets:** `npm audit --omit=dev` in the app and `npm audit`
  in `tools/browser` reported 0 vulnerabilities. No `.env*` file is tracked, no
  secret-like value was found in git history, and `.env.local`, `data/` and
  `.neon` are ignored.

### Residual risk and decisions

- **Neon Auth email verification (needs a deployment decision).**
  `ensureNeonUser()` links a Neon identity to an existing invited profile by
  email, and `neonSignUp` creates an app session immediately. If the Neon Auth
  project has `requireEmailVerification` disabled (the installed Neon defaults
  do), an attacker who knows an invited email could sign up first and inherit
  that role. Enable email verification in Neon Auth or delay profile linking
  until the address is verified.
- **Plain HTTP on a LAN.** Cookies omit `Secure` when the server is reached over
  HTTP, which is expected but leaves passwords and books readable on the wire.
  Use TLS or keep the port on a trusted private network.
- **The Neon trigger carries the scheduler secret in its URL path.** The
  invocation header is not an authentication signal. Keep function/URL logs
  access-controlled, and rotate `ZL_SCHEDULER_SECRET` if they are exposed.
- **No dedicated rate limit on `/api/reports/daily`.** A token must verify first
  and report generation is cheap relative to the HMAC check, but a public
  endpoint still benefits from edge rate limiting.
- **Local no-auth mode is intentional.** Binding to `127.0.0.1` without
  `ZL_AUTH=1` remains an unauthenticated local-development mode; do not
  port-forward it.

### Verification run

- `node --test tests/`: 400 tests, 399 pass, 1 skip (the existing Postgres
  test, skipped when `TEST_DATABASE_URL` is not set), 0 fail.
- `tests/security-hardening.test.mjs`: proxy-secret, scheduler, static allowlist,
  file-permission, report-header and auth-body regressions pass.
- Manual probes against a fresh isolated server reproduced every before/after
  result in the table above.
- The Chromium browser suites, build and hostile-data XSS sweep were not rerun
  in this pass; this change set does not touch the UI or accounting engine.

### Production deployment and verification

- Cloudflare Worker `zledgercraft-api` has an encrypted `ZL_PROXY_SECRET`
  binding and runs version `54bbd846-fefb-4d44-a73a-9fa9018899e2` (deployed
  2026-11-21 09:15 UTC).
- Neon Function `zledgercraft` runs deployment **#35** (2026-11-21 09:16 UTC)
  with both `ZL_PROXY_SECRET` and `ZL_SCHEDULER_SECRET` present.
- The `daily-operations` trigger is enabled at `30 2 * * *`, next run
  2026-11-22 02:30 UTC, and points at the path-token scheduler route.
- `GET https://books.lengkhawm.online/api/auth/me` returned 200 with
  `storage: "postgres"`, `neonAuth: true` and `postgres: true`.
- `POST /api/internal/scheduler` returned 401 with no credential or a forged
  Neon invocation header; a wrong path token returned 401; `GET` returned 405.
- A valid scheduler invocation was deliberately not sent to production because
  it would create a real backup and may send a report. Its authentication path
  is covered by the regression tests.
- The first trigger deployment printed the path token in deployment output. The
  token was rotated immediately and the Function and trigger were redeployed;
  the exposed value is no longer valid.

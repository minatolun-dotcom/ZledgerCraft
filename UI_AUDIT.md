# ZledgerCraft UI/UX audit and redesign

November 2026 · implementation report

## 1. Scope and skill availability

This was a UI/UX audit and frontend redesign, not an accounting change. The
vanilla HTML/CSS/ES-module architecture, routing, ledger and voucher logic,
calculations, storage schemas, API contracts, permissions and keyboard shortcuts
were left intact.

**Impeccable:** `SKILL.md` and its operate, craft-floor, typeset, layout, audit
and polish references were loaded and used. The launcher/engine required for
`concept-seed`, the detector and stored critique was not present in this
workspace, so those commands were not run. No result is claimed for them.

**Taste:** `SKILL.md` was loaded. The skill is explicitly scoped to
public-facing pages; this is an internal accounting workspace, so it was used
only as a quality-control reference for composition, hierarchy and restraint,
not as a page-layout recipe. Its gate/scripts were not available.

The visual audit therefore combined the written design guidance with direct
inspection of every screen, measured viewport checks and Playwright.

## 2. Method

1. Read `README.md`, `AGENTS.md`, `ROADMAP.md`, `KNOWN_LIMITS.md`, the screen
   constants, UI modules and the complete stylesheet.
2. Captured before screenshots of the gateway, masters, companies, vouchers,
   day book, trial balance, GST, inventory, ledger pick, backup and voucher entry
   at 1440×900, plus the gateway, masters, day book, trial and GST at 390×844.
3. Measured the actual document, shell, sidebar and main-surface geometry.
4. Established tokens, shell rules and component rules in `DESIGN.md`.
5. Implemented the shell, navigation, dashboard, theme, table and responsive
   changes.
6. Re-measured at 1440×900, 1280×800, 1024×768 and 390×844.
7. Ran syntax checks, engine tests, the build and the complete Chromium browser
   suite, including the axe accessibility gate.

Before screenshots are in
`tools/browser/.artifacts/redesign-before/`; after screenshots are in
`tools/browser/.artifacts/redesign-after/`. Both are development artifacts and
are ignored by Git.

## 3. Before state

### Measured

| Viewport | Body size | Result |
| --- | --- | --- |
| 1440×900 | 1440×1775 | The whole page scrolled; the shell did not contain the viewport |
| 390×844 | 390×9303 | The mobile page was a long website scroll; the top bar wrapped badly |

The mobile sidebar became a horizontally clipped row of links; KPI rows
overflowed; the footer and header moved with the page.

### Findings

| Area | Finding | Severity |
| --- | --- | --- |
| Shell | `min-height: 100vh` let the document grow; no fixed working frame | High |
| Shell | Table content expanded the page instead of scrolling inside a panel | High |
| Navigation | 9 primary links plus 23 report links in one ungrouped column | High |
| Navigation | Mobile nav was a horizontal strip with clipped labels | High |
| Dashboard | “Masters & reports” repeated 29 links already present in the sidebar, adding a long duplicate block | High |
| Dashboard | KPI/type cards all had the same 10px radius and shadow, producing a generic SaaS surface | Medium |
| Theme | Light-only; no theme control or dark tokens | Medium |
| Typography | Mixed rem sizing, weak label hierarchy, no consistent tabular treatment | Medium |
| Tables | No sticky headers, no internal vertical scroll, no consistent numeric alignment | High |
| Tables | Report tables could widen the main surface on mobile | High |
| Forms | Wide fixed grids clipped long legal names and addresses | Medium |
| Forms | Voucher entry lines were cramped at 1024px | Medium |
| Mobile | KPI cards and voucher types stacked one per row, creating unnecessary scroll | Medium |
| Accessibility | Ochre wordmark and muted labels did not meet AA contrast | High |
| Feedback | Theme change required a full render (would discard focus and unsaved form state) | Medium |

## 4. Design direction

The chosen direction is a **ledger desk**: deep forest ink shell, warm paper
surfaces, ochre posting marks, tabular figures, flat panels and grouped
navigation. It is deliberately closer to a bound account book and a professional
desktop application than to a generic admin template.

The one signature move is the ochre posting line: a 2px rule under the top bar,
a short mark beside the active nav item and the brand suffix. It is not used as a
large fill.

Full tokens and component rules are in [`DESIGN.md`](DESIGN.md).

## 5. Implemented changes

### Application shell

- Fixed `100dvh` grid shell with a 244px sidebar, top bar and 30px status bar.
- `body`, `html` and `#app` no longer scroll; `.main` is the working surface.
- Sidebar scrolls independently; the status bar stays fixed.
- `minmax(0, 1fr)` constraints prevent flex/grid children from forcing width.
- Mobile: fixed drawer, scrim, close button, Escape close and close-on-navigate.
- The drawer is inert on desktop.

### Navigation

- Grouped into Books, Financial statements, Receivables & payables, Tax &
  compliance and Operations.
- Group headers are collapsible toggles with an item count and chevron. Choices
  persist in `localStorage`; navigating to a screen from a shortcut auto-opens
  its group. Groups start open for discoverability.
- Added the missing destinations (`yearComparison`, `compliance`,
  `consolidation`) to the sidebar groups so existing screens are reachable.
- Active states now map subscreens to their parent section: voucher entry/view
  to Vouchers, ledger statements to Ledger, payroll run to Payroll, instrument
  printing to the instrument register.
- Curated the status-bar hints to ten primary shortcuts (plus Save on voucher
  entry) so the bar never overflows; every existing shortcut still works.
- Sidebar “Books at a glance” figures remain on desktop and are hidden on the
  narrow drawer to preserve working height.

### Dashboard

- Removed the 29-row duplicate “Masters & reports” link list. Those destinations
  remain in the grouped sidebar; no route was removed.
- Kept the four working KPIs, all eight voucher types and a compact two-column
  quick-access panel.
- Added a short “How it works” panel and a clear pointer to the grouped reports.
- Reduced gateway height enough to fit a 1440×900 and 1024×768 viewport without
  page scroll.

### Theme

- Added light and dark token sets, a header toggle, system-preference detection
  and a stored user choice (`zledgercraft.theme`).
- The toggle updates `data-theme`, `color-scheme` and `theme-color` without
  rerendering, so focus and unsaved voucher input survive.
- Focus rings, table heads, inputs, panels, navigation and status colors all
  have dark equivalents.

### Tables

- Added a render-pass wrapper for any `table.data-table` that is not already
  inside `.table-scroll`.
- Tables now scroll inside their panel with `max-height`, keep their headers
  sticky and expose a focusable scroll region.
- Numeric columns are right-aligned and tabular; totals use a stronger rule.
- The page no longer widens for report tables at any tested width.
- Day book date cells stay on one line on narrow screens.
- At ≤600px, report tables become labeled cards using generated `data-label`
  values. The header row is removed from the card layout and each row becomes a
  bordered card, so Trial Balance, Day Book, GST, Inventory and Statistics no
  longer require horizontal scrolling on a phone. Tables with a grouped header
  (`colspan` in the last header row) keep the contained scroll-table fallback.

### Forms and controls

- Unified 32–36px controls, 5px radii, focus rings, disabled states and compact
  form grids.
- Voucher line inputs are tighter but aligned; stock, GST, TDS and bill panels
  share the same surface and heading rules.
- Long forms scroll inside `.main` rather than expanding the document.
- The voucher form ends with a sticky command bar so Accept/Update, Escape and
  Day Book remain visible while the form scrolls. Focus and unsaved input survive
  the theme toggle, and the bar does not change the posting flow.
- Filter bars stack cleanly on mobile; primary actions remain visible in the
  form flow.
- Fixed a pre-existing mobile overflow in the inventory BOM editor by letting
  the component rows shrink (`minmax(0, 1fr)` and a narrower quantity column).

### Typography and numbers

- Standardized the type scale, field labels, table heads and metadata.
- Applied tabular numerals to money, quantities, dates and report figures.
- Replaced oversized/gradient header styling with a compact flat top bar.

### Accessibility fixes found by axe

- Lightened the brand suffix to `#d9a45a` on forest ink.
- Darkened the light-theme muted token from `#65756c` to `#5a6a61`.
- After the fixes the axe gate reports zero serious/critical violations on
  gateway, day book, vouchers, masters, trial balance and statistics.

## 6. After state

| Viewport | Document body | Shell | Main surface | Sidebar | Status |
| --- | --- | --- | --- | --- | --- |
| 1440×900 | 1440×900 | 1440×900 | 1196×814, scrolls | 244×814, scrolls | 30px |
| 1280×800 | 1280×800 | 1280×800 | 1027×714, scrolls | 244×714, scrolls | 30px |
| 1024×768 | 1024×768 | 1024×768 | 771×682, scrolls | 244×682, scrolls | 30px |
| 390×844 | 390×844 | 390×844 | 381×765, scrolls | 318px drawer, scrolls | hidden |

Verified:

- Body and document scroll width/height exactly match the viewport at all four
  sizes.
- Main-surface scroll width equals client width at all four sizes.
- Trial balance and day book tables have their own scroll containers; computed
  table-head position is `sticky`.
- Mobile report cards are 333px wide inside the 333px content column; the main
  surface stays 381×765 and the page body stays 390×844. No horizontal scroll.
- The voucher command bar stays visible at scroll top and while scrolled; the
  sidebar group toggles update `aria-expanded`, hide/show their items, persist,
  and auto-open when navigating to a member screen.
- The status bar has no overflow at 1440 or 1024 after hint curation.
- The mobile drawer opens to 318px, is labelled `aria-expanded="true"`, and
  covers the working surface with a scrim.
- Theme toggle preserves an unsaved narration value exactly.

## 7. Testing report

### Engine and build

| Check | Result |
| --- | --- |
| `node --check src/ui.js` | Pass |
| `node --check src/ui-screens.js` | Pass |
| `node --check src/ui-reports.js` | Pass |
| `node --check src/main.js` | Pass |
| `node --test tests/` | 400 tests: 399 pass, 1 skipped, 0 fail |
| `node build.mjs` | Pass; `dist/ZledgerCraft.html` and `dist/index.html` rebuilt |

### Browser suites (Chromium and Firefox)

`npm test` in `tools/browser` passed end to end in Chromium. The identical suite
also passed end to end in Firefox:

- `ca-core.cjs` — 117-check chartered-accounting workflow.
- `ca-advanced.cjs` — 107-check advanced workflow with real file inputs.
- `ca-workflows.cjs` — 33-check cost-centre, budget, bank, payroll, stock and
  quotation workflows.
- `ca-screens.cjs` — 125 checks across 36 screens, including print and CSV/Excel
  export on every report; 58 downloads.
- `render.cjs` — 1,000-voucher day book paging/export regression.
- `login-reset.cjs` — login, forgot-password and reset-token UI.
- `axe.cjs` — WCAG 2 A/AA serious/critical checks on 6 screens: 0 violations.
- `workspace-conflict.cjs` — two-context SQLite workspace merge and conflict.

The follow-up pass (collapsible groups, sticky voucher command bar, mobile
report cards and the BOM overflow fix) was verified by rerunning the full suite
in Chromium and Firefox; all checks above still pass in both browsers. WebKit
could not launch because this host is missing its native libraries.

### Visual checks

Playwright captured and inspected the gateway, masters, companies, day book,
trial balance, GST, inventory and voucher entry at desktop sizes, plus gateway,
drawer, day book and trial at 390×844. No page errors or console errors were
recorded during the visual passes. Light and dark voucher/trial screens were
inspected; dark muted and brand-accent contrast was checked separately against
the dark surfaces.

### Not tested

- WebKit. The browser binary is installed, but this host is missing required
  native libraries (`libicu74`, `libxml2`, `libavif16`, `libharfbuzz-icu0`,
  `libmanette-0.2-0`, `libhyphen0`). No system packages were installed.
- Print preview/pagination in a real print dialog. Print-specific CSS was
  written and existing print actions pass in both tested browser suites.
- Physical touch devices and screen readers. Keyboard focus, labels and axe
  checks were exercised.
- Full authenticated server/Neon workflows; login-reset and workspace-conflict
  regressions passed.

## 8. Remaining issues

1. **Grouped report headers.** The mobile card view needs a simple header row.
   A report table whose final header row uses `colspan` falls back to the
   contained horizontal scroll table rather than risk mislabeled cards.
2. **Sidebar defaults.** All groups start open for discoverability. Users can
   collapse them and the choice persists, but there is no sidebar search or
   “collapse all” control yet.
3. **Sticky command bar height.** The bar takes about 52px of the form viewport
   while scrolling. It is intentional; a compact mode could reduce it further.
4. **Legacy CSS remains.** The v2 block overrides the original 2,500-line
   stylesheet. A future consolidation could remove dead screen-specific rules,
   but that is a larger, riskier refactor than this UI pass.
5. **Table auto-wrap is generic.** New report tables inherit the scroll wrapper
   and card annotation automatically. A table that depends on a direct parent
   selector should be checked when added.
6. **Theme preference.** There is no “System / Light / Dark” three-way control;
   the first visit follows the system, then the toggle stores an explicit choice.
7. **No modal system.** The app uses inline forms rather than dialogs. If a
   dialog is added later, it must follow the viewport rules in `DESIGN.md`.
8. **Mobile status bar.** It is hidden below 600px to preserve working height.
   All shortcuts remain active and primary hints remain in the sidebar/desktop
   bar.

## 9. Git safety

No commit or push was made. Unrelated pre-existing changes in the working tree
were left untouched. The rebuilt `dist/ZledgerCraft.html` and `dist/index.html`
reflect the source changes.

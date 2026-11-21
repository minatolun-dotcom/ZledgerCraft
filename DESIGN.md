# ZledgerCraft design system

Version 2 · November 2026

ZledgerCraft is a working accounting desk, not a marketing site. The interface
should feel like a well-kept ledger: quiet surfaces, precise figures, grouped
navigation, and controls that stay where the accountant expects them.

The implementation is vanilla CSS appended to `styles.css` as a `v2` override
block. The existing HTML, ES modules, routing, calculations, storage and API
contracts are unchanged. No frontend framework, reset library or runtime
dependency was added.

## 1. Direction

**Forest ink, warm paper, ochre posting marks.**

- **Forest ink** anchors the shell and primary actions. It is close to the
  deep green of a bound ledger and avoids the generic navy-gradient dashboard.
- **Warm paper** gives dense tables and forms a readable, low-glare ground.
- **Ochre** is the one signature move: a 2px posting line under the top bar, a
  short mark beside the active nav item, and the brand suffix. It is never used
  as a large fill.
- **Flat panels, thin rules, tabular figures.** Depth comes from borders and
  spacing, not stacked shadows.
- **Density with air.** The base text size is 14px; financial tables use 12px
  and tabular numerals. Row heights are deliberately compact.

This is an *operate* surface: familiar controls, dense information, restrained
palette. The world contributes type, palette, density and one mark; it does not
get to redesign navigation or hide accounting actions.

## 2. Application shell

The shell is a fixed desktop frame:

```css
.app-shell {
  height: 100dvh;
  display: grid;
  grid-template-columns: 244px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}
```

- `body`, `html` and `#app` are `overflow: hidden`; the document never scrolls.
- The top bar and status bar stay fixed.
- `.main` is the only general content scroller: `min-height: 0; overflow: auto`.
- The sidebar scrolls independently when the grouped navigation exceeds the
  viewport.
- Tables inside `.table-scroll` scroll independently with sticky headers. The
  render pass wraps any `table.data-table` that was not already wrapped, so new
  report tables inherit the behaviour automatically.
- At ≤900px the sidebar becomes a fixed drawer with a scrim. It is opened from
  the menu button, closed by Escape, the close button, the scrim, or navigating.
- At ≤600px the status bar is hidden to preserve working height. All shortcuts
  remain active; the primary ones remain visible in the sidebar and on desktop.

### Viewport rules

- Never allow horizontal page scroll. Wide tables scroll inside their panel.
- Prefer compact filters and 2-column form grids over full-width fields.
- Long voucher forms, report tables and settings panels scroll inside `.main`.
- There are no modal dialogs in the current app. If one is added, it must use
  `max-height: calc(100dvh - 2rem)` and scroll its body internally.

## 3. Color tokens

Tokens live on `:root` and are replaced under `[data-theme="dark"]`.

### Light

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#e9ede8` | App background |
| `--surface` | `#fffdf8` | Panels, inputs, tables |
| `--surface-subtle` | `#f2f4ef` | Sidebar, table heads, status bar |
| `--ink` | `#18241f` | Primary text |
| `--ink-soft` | `#4d5f56` | Secondary text |
| `--muted` | `#5a6a61` | Labels, periods, hints |
| `--line` | `#d3dad4` | Panel and row rules |
| `--line-strong` | `#b6c1ba` | Input borders, table header rule |
| `--brand` | `#0e3b31` | Top bar, primary button |
| `--brand-accent` | `#d9a45a` | Brand suffix on forest ink |
| `--accent` | `#c07a2a` | Posting mark, active nav mark |
| `--positive` | `#176b50` | Balanced, profit, success |
| `--negative` | `#a33a2d` | Shortfall, loss, destructive |
| `--info` | `#2d5f88` | Links and informational state |
| `--warning` | `#8b5a18` | Attention / stale data |
| `--focus` | `#2d6f96` | Keyboard focus ring |

### Dark

| Token | Value |
| --- | --- |
| `--canvas` | `#0d1612` |
| `--surface` | `#131f1a` |
| `--surface-subtle` | `#182720` |
| `--ink` | `#e7eee9` |
| `--ink-soft` | `#afbdb4` |
| `--muted` | `#8c9d93` |
| `--line` | `#2e4037` |
| `--line-strong` | `#435a4d` |
| `--brand` | `#081f19` |
| `--brand-accent` | `#e0ac62` |
| `--accent` | `#d49a4a` |
| `--positive` | `#65c39d` |
| `--negative` | `#ee8a7b` |
| `--info` | `#8ab9dd` |
| `--warning` | `#e0ac62` |
| `--focus` | `#8ab9dd` |

The theme follows the operating-system preference on first load, then a stored
choice in `localStorage` (`zledgercraft.theme`). The header toggle changes the
theme without rerendering the screen, so unsaved voucher input and focus survive.
`color-scheme` and the `theme-color` meta tag are updated with the theme.

Contrast targets:

- Body and table text: ≥ 7:1 on surfaces.
- Secondary labels: ≥ 4.5:1 against canvas and surface.
- Focus rings: ≥ 3:1 against adjacent colors.
- Positive/negative values are not distinguished by color alone; signs and
  labels carry the meaning too.

## 4. Typography

Font stack: `"Inter", "Segoe UI", system-ui, -apple-system, sans-serif`.

No web-font request is added. The stack uses the operating system's best UI
face and degrades cleanly if Inter is unavailable.

| Role | Size | Weight | Notes |
| --- | --- | --- | --- |
| Screen title | 24px | 680 | One per screen, sentence case |
| Gateway title | 26px | 700 | Only on the gateway |
| Panel heading | 15px | 680 | `h2` / `.panel-head h2` |
| Voucher title | 19px | 680 | Voucher entry |
| Body | 14px | 400 | Application base |
| Table body | 12px | 400 | Tabular numerals |
| Table head | 9.5px | 750 | Uppercase, 0.075em tracking |
| Field label | 10.5px | 650 | Sentence/label case |
| Metadata / period | 11.5px | 400–600 | Muted |
| Status bar | 10.5px | 400–650 | Single line |

Rules:

- Use tabular numerals (`font-variant-numeric: tabular-nums`) for every money,
  quantity, date and report figure.
- Right-align numeric columns and totals. Never center financial figures.
- Use sentence case for actions and headings. Uppercase is reserved for short
  labels and table heads.
- Do not use display fonts, oversized marketing headings or negative tracking
  below -0.03em.

## 5. Spacing, sizing and shape

Base spacing scale: `4, 8, 12, 16, 20, 24` (`--space-1` … `--space-6`).

- Main padding: 16px 20px 22px on desktop; 12px on mobile.
- Panel padding: 14px 16px 16px; 11–12px on mobile.
- Panel gap: 12–13px.
- Control height: 34px standard, 28px small, 32–36px on touch layouts.
- Table row padding: 6px 9px; compact 5px 8px.
- Radii: 7px panels, 5px controls, 3px badges and keys.
- Shadows: only `--shadow` for fine separation and `--shadow-raised` for the
  authentication card. Panels are flat by default.

Avoid pill-shaped buttons, 10px+ card radii, decorative gradients and cards
inside cards.

## 6. Components

### Navigation

- Sidebar groups: Books, Financial statements, Receivables & payables, Tax &
  compliance, Operations.
- Each group header is a toggle with an item count and chevron. Collapsed groups
  are remembered in `localStorage`; shortcut navigation auto-opens the group for
  the destination screen.
- Each item is a 29px row with an optional keyboard hint.
- Active state: surface fill, thin border, 3px ochre mark, stronger weight.
- Subscreens map to their parent section (`voucherNew` and `voucherView` to
  Vouchers, `ledger` to Ledger, `payrollRun` to Payroll, `chequePrint` to the
  instrument register).
- The sidebar scrolls independently; the top bar and main surface do not move.

### Buttons

- Default: paper surface, 1px strong border, 32px height.
- Primary: forest ink fill, paper text. One primary action per local area.
- Ghost: transparent until hover; used for report exports and secondary exits.
- Small: 26px, used in toolbars and table rows.
- Danger: negative text and border, transparent ground.
- Every button has a visible keyboard focus ring. Disabled controls use 45%
  opacity and `cursor: default`.

### Forms

- Labels sit above controls; 10.5px, 650 weight.
- Inputs are 32px, paper surface, 1px strong border, 5px radius.
- Focus uses a 2px translucent focus ring plus a solid focus border.
- Form grids use `repeat(auto-fit, minmax(220px, 1fr))`; mobile drops to 180px.
- Filters sit in a rule-separated `.filter-bar`; they do not float in cards.
- Errors are inline, negative-colored and `role="alert"` where already present.
- Long forms scroll inside `.main` rather than expanding the document.
- The voucher form ends with a sticky command bar so Accept/Update, Escape and
  Day Book stay visible while the form scrolls. It uses the form surface and a
  single top rule; it is not a floating toolbar.

### Tables

- Table heads are sticky within `.table-scroll`, 9.5px uppercase, subtle ground.
- Body rows are separated by `--line-soft`; no zebra striping by default.
- Hover is a faint ochre wash, not a strong highlight.
- Numeric cells are right-aligned and tabular.
- Totals use a 2px top rule and subtle ground.
- Tables always scroll horizontally inside their own container on narrow screens;
  the page itself never widens.
- At ≤600px, report tables become labeled cards: the header row is visually
  removed, each row becomes a bordered card, and each cell shows its column name
  from a generated `data-label`. This removes horizontal scrolling from reports.
  Tables whose last header row contains `colspan` keep the scroll-table fallback.
- `.table-scroll` is focusable so keyboard users can scroll it.
- The mobile slab/card mode applies to report screens only; voucher line tables,
  masters and company administration keep their dedicated mobile layouts.

### Panels and headings

- Panels are flat paper with a 1px rule and 7px radius.
- `.panel-head` pairs a title and one-line explanation with an optional action.
- `.column-title` is a small uppercase rule label, not a second hero heading.
- The gateway dashboard deliberately avoids a second copy of the sidebar link
  list. It shows four KPIs, the eight voucher types and a compact quick-access
  list; all reports remain in the grouped sidebar.

### States

- **Positive / balanced:** positive token plus explicit "tallies" / "balanced"
  wording.
- **Negative / short:** negative token plus a signed value or "difference".
- **Warning:** warning token plus a text explanation; never color alone.
- **Empty:** a short sentence explaining what is missing and the action that
  creates it.
- **Loading:** the app is local-first; existing synchronous states have no
  skeleton screens. Server workspace banners carry their own status text.
- **Flash messages:** a thin inline bar above the workspace, not a floating toast.

### Keyboard

- Existing shortcuts are preserved.
- The status bar shows a curated primary set so it never overflows: Escape,
  Masters, Vouchers, Day Book, Ledger, Trial Balance, P&L, Balance Sheet,
  Inventory, Period, plus Save on voucher entry.
- `kbd` hints are quiet, 9–9.5px, and never look like buttons.
- Escape closes the mobile drawer before returning to the gateway.
- Focus rings use `--focus` and are never removed without a replacement.

## 7. Financial conventions

- Money is displayed with the existing `money()` helper; do not reformat figures
  in CSS.
- Debit and credit columns are separate and right-aligned.
- Negative values carry a minus sign and negative color.
- Dates use the app's existing `dateLabel()` output. Inputs remain native
  `type="date"`.
- Report period is shown once in the screen header and once in the report filter,
  not repeated in every row.
- Totals are visually stronger than rows but never larger than the screen title.
- Print output removes the shell, navigation, toolbars and status bar; tables
  lose their internal max-height and print in full.

## 8. Responsive behaviour

| Width | Shell |
| --- | --- |
| ≥1180px | 244px fixed sidebar; full top bar; status bar visible |
| 901–1179px | Sidebar remains fixed; company metadata condenses |
| ≤900px | Single-column shell; sidebar becomes a drawer; top bar wraps to two rows; status bar remains until 600px |
| ≤600px | Drawer navigation; two-column KPI/type grids; full-width filter controls; report tables become labeled cards; status bar hidden; 36px touch controls |

At every width the body and document remain exactly viewport-sized. Only
`.main`, `.sidebar` and `.table-scroll` may scroll.

## 9. Implementation rules

- Keep screen-specific CSS. Add shared changes to the v2 block rather than
  rewriting legacy rules in place.
- Do not add a CSS framework, icon package or web font.
- Do not use `overflow: hidden` on `.main`; long forms need to scroll.
- Do not put `overflow: auto` on the app shell or body.
- Do not set a fixed height on table content; use `max-height` plus `min-height: 0`.
- Do not change accounting helpers, posting logic, storage schemas or API calls
  for visual work.
- When adding a new report table, leave it as `table.data-table`; the render pass
  wraps it, gives it a sticky header, and annotates it for the mobile card view
  automatically. Use a simple header row (no `colspan` in the last header row)
  if you want the card view.
- When adding a new screen, add it to a sidebar group and map any subscreen to
  its parent for the active state.

# TiddlyWiki 5 Productivity Suite — Master Design System & CSS Architecture (`MASTER.md`)

> **Scope:** Cross-plugin UI/UX audit, Zero-Dependency CSS Custom Property Contract, Shared Component Blueprints, Standalone vs. Slipstream Integration Strategy, and Plugin-by-Plugin Migration Checklist across:
> 1. **Slipstream** ([`tiddlywiki-slipstream`](file:///Users/mblackman/workspace/gh/tiddlywiki-slipstream)) — App shell, command topbar, mobile bar & responsive layout orchestrator
> 2. **Task Manager / Projectify** ([`Projectify`](file:///Users/mblackman/workspace/gh/Projectify)) — Inbox, projects, list & Kanban boards
> 3. **Journal** ([`tiddlywiki-journal`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal)) — Editorial writing, habit tracking & chronological timeline/calendar
> 4. **Coffee Tracker** ([`tiddlywiki-coffee-tracker`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker)) — Countertop brew logging, numeric steppers & bean inventory
> 5. **Media Importer** ([`tiddlywiki-media-importer`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer)) — Dropzones, staging queues, API search & batch metadata

---

## Part 1: Cross-Plugin Stylesheet, DOM & Viewport Audit

### 1.1 Architectural Root Cause: Stylesheet MIME Types & Token Layer Split

The single largest source of visual drift and palette fragility across the five plugins is **how each plugin authors and parses its `$:/tags/Stylesheet` tiddlers**:

| Plugin | Primary Stylesheet(s) | Content Type (`type`) | Color Resolution Mechanism | Standalone / Cross-Theme Failure Mode |
| :--- | :--- | :--- | :--- | :--- |
| **Slipstream** | [`core.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-slipstream/plugins/mblackman/slipstream/styles/core.css#L1-L130) | `text/css` | `--mn-*` custom properties backed by `--tpc-*` with static hex fallbacks (`var(--tpc-background, #ffffff)`) | `text/css` does **not** evaluate `<<colour ...>>` macros. Relies on TiddlyWiki 5.4+ `--tpc-*` variables or static light-mode hex fallbacks. |
| **Task Manager** | [`stylesheet.tid`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/stylesheet.tid#L1-L35), [`cards.tid`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/cards.tid#L1-L82), [`form-control.tid`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/form-control.tid#L1-L67), [`utils.tid`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/utils.tid#L1-L185) | `text/vnd.tiddlywiki` (`\rules only ...`) | Hybrid `var(--tpc-*, <<colour ...>>)` + `color-mix(in srgb, ...)` + 24 hardcoded hexes | Good fallback pattern on base surfaces, but status colors (`#2da562`, `#e73939`, `#e77a39`, `#2563eb`) and shadows are hardcoded inline. |
| **Journal** | [`index.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/index.css#L1-L1110), [`habit.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/habit.css#L1-L241) | `text/css` | Bare `var(--tpc-*)` with **zero fallbacks** (`var(--tpc-code-background)`, `var(--tpc-table-border)`) | Completely unstyled borders/backgrounds on TiddlyWiki `< 5.4.0` where `--tpc-*` variables are not emitted by core. |
| **Coffee Tracker** | [`index.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker/src/coffee-tracker/index.css#L1-L1705) (`.meta` sets `text/vnd.tiddlywiki`) | `text/vnd.tiddlywiki` | Raw `<<colour ...>>` macros only; zero CSS custom properties | Calls non-existent palette keys (`<<colour positive-alert-banner-background>>`, `<<colour alert-banner-background>>`) that evaluate to **empty strings** under [`SlipstreamLight.tid`](file:///Users/mblackman/workspace/gh/tiddlywiki-slipstream/plugins/mblackman/slipstream/palettes/SlipstreamLight.tid) and [`SlipstreamDark.tid`](file:///Users/mblackman/workspace/gh/tiddlywiki-slipstream/plugins/mblackman/slipstream/palettes/SlipstreamDark.tid). |
| **Media Importer** | [`index.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/index.css#L1-L1826) (`.meta` sets `text/vnd.tiddlywiki`) | `text/vnd.tiddlywiki` | Raw `<<colour ...>>` macros + hardcoded `#f59e0b` / `#ef4444` | TS widgets ([`media-importer-ui.ts`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/widgets/media-importer-ui.ts#L139), [`media-library.ts`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/widgets/media-library.ts#L210)) inject literal `style="... color: <<colour foreground>>;"` into DOM nodes where TiddlyWiki macro parsing never runs. |

---

### 1.2 Side-by-Side Card & Surface Hierarchy Audit (`1440x900` Desktop & `390x844` Mobile)

Comparing the four primary domain cards inside Slipstream's Desktop Document Mode ([`core.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-slipstream/plugins/mblackman/slipstream/styles/core.css#L3052-L3090), where `.tc-tiddler-frame` is transparent) and standard TiddlyWiki river mode reveals competing surface colors, border weights, radii, and elevation models:

| Dimension | Slipstream Base Card (`.mn-card`) | Task Manager Kanban Card (`.py-board-cards .py-todo-item-wrapper`) & Project Card (`.py-card`) | Coffee Tracker Bean Card (`.ct-card.ct-bean-card`) | Media Importer Queued / Search Card (`.mi-card`) | Journal Entry / Panel Card (`.journal-card-panel`, `.journal-otd-card`, `.journal-day-card`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Source File** | [`core.css#L2796-L2822`](file:///Users/mblackman/workspace/gh/tiddlywiki-slipstream/plugins/mblackman/slipstream/styles/core.css#L2796-L2822) | [`stylesheet.tid#L1002-L1089`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/stylesheet.tid#L1002-L1089), [`cards.tid#L18-L45`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/cards.tid#L18-L45) | [`index.css#L473-L618`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker/src/coffee-tracker/index.css#L473-L618) | [`index.css#L583-L621`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/index.css#L583-L621) | [`index.css#L204-L320`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/index.css#L204-L320), [`index.css#L622-L633`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/index.css#L622-L633) |
| **Background Surface** | `--mn-bg-card` (`color-mix(in srgb, bg 96.5%, fg 3.5%)`) | Kanban: `--tpc-tiddler-background`<br>Project card: `color-mix(bg 93%, muted 7%)` | `<<colour tiddler-background>>` (while `.ct-section` uses `<<colour message-background>>` — bright blue `#ecf2ff` in vanilla TW!) | `<<colour tiddler-background>>` (while staging/queue bars use `<<colour tiddler-editor-background>>`) | `var(--tpc-code-background)` (renders **purple-tinted** `#f5f4f8` / `#25232e` in Slipstream palettes!) |
| **Border** | `1px solid var(--mn-border-subtle)` (`9%` fg mix) | Kanban: `1px solid color-mix(muted 20%, transparent)` + `3px` left status bar | `1px solid <<colour table-border>>` + `4px solid <<colour primary>>` left bar on active beans | `1px solid <<colour table-border>>` (`2px solid #f59e0b` when staged) | `1px solid var(--tpc-table-border)` |
| **Border Radius** | `14px` (`--mn-radius-card`) | `8px` (`10px` on `.py-board-column`) | `8px` (`12px` on `.ct-stat-card`, `10px` on `.ct-rating-box`) | `8px` (`10px` on `.mi-dropzone` & `.mi-segmented-bar`) | `10px` on panels/tiles, `8px` on `.journal-day-card`, `12px` on `.journal-nav` |
| **Box Shadow** | `0 4px 16px -4px rgba(15,23,42,0.035), 0 1px 3px -1px rgba(15,23,42,0.015)` | Kanban: `0 1px 3px rgba(0,0,0,0.05)`<br>`.py-card`: harsh `0 1px 5px 0 rgba(0,0,0,0.2)` | `0 2px 4px rgba(0,0,0,0.05)` | `none` | `none` (`inset 0 0 0 1px var(--tpc-primary)` on today cell) |
| **Padding (Desktop / Mobile)** | `1.1rem 1.25rem` (`17.6px 20px`) | Kanban: `10px 12px`<br>`.py-card`: `4px 12px` | `16px` (`14px` mobile) | `10px 12px` (search) / `12px` (library) | `16px 18px` (`.journal-card-panel`) / `14px` (`.journal-otd-card`) |
| **Hover Transform** | `translateY(-2px)` + `--mn-border-strong` | Kanban: border-color `38%` mix + `0 2px 6px rgba(0,0,0,0.08)` (no translate) | `translateY(-2px)` + `0 4px 8px rgba(0,0,0,0.1)` | Border color only (no shadow or translate) | `.journal-day-card:hover` swaps entire surface to `--tpc-selection-background` |

---

### 1.3 Interactive Controls, Typography & Breakpoint Discrepancies

#### 1. Buttons & Segmented Controls
- **Text Casing Drift**: Media Importer ([`index.css#L87`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/index.css#L87)) sets `text-transform: uppercase; letter-spacing: 0.02em;` on all `.mi-btn` elements. Every other plugin in the suite uses sentence/title case.
- **Shape & Radius Drift**:
  - Slipstream (`.mn-btn-primary`, `.mn-pill-btn`) and Projectify (`.py-btn`) use **full pills** (`9999px` / `1.5em`).
  - Coffee Tracker uses `20px` on `.ct-btn` ([`index.css#L62`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker/src/coffee-tracker/index.css#L62)), `16px` on `.ct-btn-sm` ([`index.css#L79`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker/src/coffee-tracker/index.css#L79)), `6px` on `.ct-card-action-btn` ([`index.css#L748`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker/src/coffee-tracker/index.css#L748)), and `4px` on `.ct-theme-button` ([`index.css#L23`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker/src/coffee-tracker/index.css#L23)).
  - Journal (`.journal-btn` at [`index.css#L655`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/index.css#L655)) and Media Importer (`.mi-btn` at [`index.css#L76`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/index.css#L76)) use `8px` rounded rectangles.
- **Primary Button Hover Inversion Bug**: Media Importer's `.mi-btn-primary:hover` ([`index.css#L114-L118`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/index.css#L114-L118)) swaps `background` to `<<colour tiddler-editor-background>>` and `color` to `<<colour primary>>`, making the primary CTA look disabled/hollow on hover instead of elevating or brightening.

#### 2. Inputs, Selects & Steppers
- **Missing Select Chevron in Journal**: In [`index.css#L984-L993`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/index.css#L984-L993), `select.journal-input, select.habit-input` sets `appearance: none; -webkit-appearance: none; padding-right: 28px;` **without** providing a `background-image` SVG chevron. Dropdowns look identical to plain text inputs.
- **Hardcoded Select Chevron Color in Media Importer**: In [`index.css#L180`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/index.css#L180), `select.mi-input` uses a data-URI SVG with hardcoded `stroke='%23888888'`.
- **Input Heights & Radii**:
  - Projectify `input.py-input` ([`form-control.tid#L4-L21`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/form-control.tid#L4-L21)): `border-radius: 4px`, fixed `width: 300px` default, `padding: 8px`.
  - Coffee Tracker `.ct-input` ([`index.css#L127-L143`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker/src/coffee-tracker/index.css#L127-L143)): `min-height: 44px` on desktop, `border-radius: 6px`, no `:focus-visible` ring.
  - Journal `.journal-input` ([`index.css#L636-L652`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/index.css#L636-L652)): `min-height: 38px`, `border-radius: 8px`, focus ring uses `--tpc-selection-background`.
  - Media Importer `.mi-input` ([`index.css#L156-L176`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/index.css#L156-L176)): `min-height: 38px`, `border-radius: 6px`, focus uses hard `outline: 2px solid <<colour primary>>`.

#### 3. Typography & Missing `tabular-nums`
- **Font Family Override in Coffee Tracker**: `.ct-dashboard-container` ([`index.css#L11`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker/src/coffee-tracker/index.css#L11)) hardcodes `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;` and `.ct-brew-log-container` ([`index.css#L196`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker/src/coffee-tracker/index.css#L196)) hardcodes `font-family: sans-serif;`, overriding Slipstream's `--mn-font-sans` (`Inter`) or the user's custom TiddlyWiki font.
- **Zero `font-variant-numeric: tabular-nums` Across Suite**:
  - Coffee Tracker's live stepper inputs (`.ct-metric-input`), brew ratios (`.ct-calculated-metric-value`), stat counters (`.ct-stat-value`), and bean weights jitter horizontally as digits change.
  - Journal's ISO dates (`.journal-recent-iso`, `.journal-day-card-date`), calendar grid numbers, and habit streak pills (`.habit-streak-pill`) lack `tabular-nums`.
  - Task Manager's badge counts (`.py-count`), column counters (`.py-board-column-count`), and due dates (`.py-due-date`) lack `tabular-nums`.

#### 4. Mobile Breakpoints & Touch Target Audit (`390x844`)
- **4 Different Mobile Breakpoints**:
  - Slipstream: `@media (max-width: 1023px)` (shell collapse) and `@media (max-width: 639px)` (mobile phone).
  - Projectify: `@media (max-width: {{$:/themes/tiddlywiki/vanilla/metrics/sidebarbreakpoint}})` (`960px` default).
  - Media Importer: `@media (max-width: 700px)`.
  - Journal & Coffee Tracker: `@media (max-width: 640px)`.
- **Sub-44px Mobile Touch Targets**:
  - Journal mobile `.journal-btn` ([`index.css#L1028-L1032`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/index.css#L1028-L1032)) is `min-height: 40px` (`< 44px`).
  - Projectify mobile `.py-todo-menu .py-btn` ([`stylesheet.tid#L1217-L1222`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/stylesheet.tid#L1217-L1222)) is `38px × 38px`, and `.py-board-tab` ([`stylesheet.tid#L1309`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/stylesheet.tid#L1309)) is `min-height: 34px`.
  - Coffee Tracker `.ct-stepper-btn-sm` ([`index.css#L1065-L1069`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker/src/coffee-tracker/index.css#L1065-L1069)) is `38px × 38px`.
  - Media Importer `.mi-batch-checkbox` ([`index.css#L1735-L1738`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/index.css#L1735-L1738)) is `32px × 32px` on mobile (`24px × 24px` on desktop).

---

### 1.4 Light & Dark Palette Contrast Verification (WCAG AA `>= 4.5:1`)

| Surface / Token Combination | `SlipstreamLight` (`#faf9f5` / `#ffffff`) | `SlipstreamDark` (`#111113` / `#18181b`) | Vanilla TW Light / Dark Fallback | Audit Status & Required Fix |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Text on Card** (`foreground` on `tiddler-background`) | `#1c1e21` on `#ffffff` (**16.8:1** PASS) | `#e4e4e7` on `#18181b` (**13.9:1** PASS) | Passes in all core palettes | **PASS** |
| **Muted Text on Subtle Surface** (`muted-foreground` on `--suite-surface-subtle`) | `#65686c` on `#f3f2ee` (**5.02:1** PASS) | `#a1a1aa` on `#202024` (**6.8:1** PASS) | Vanilla `muted-foreground` (`#999999`) on `#ffffff` is **2.85:1** FAIL | **FIX**: Mix `foreground 68% + muted-foreground 32%` in token contract so standalone wikis pass `>= 4.5:1`. |
| **Coffee Tracker `.ct-badge-success` / `.ct-badge-danger`** (`positive-alert-banner-*` / `alert-banner-*`) | **BROKEN** (palette keys undefined in Slipstream; falls back to transparent bg + inherited text) | **BROKEN** (palette keys undefined in Slipstream) | Only defined in subset of vanilla palettes | **FIX**: Replace with `--suite-status-success-*` and `--suite-status-danger-*` tokens. |
| **Media Importer Warning Text** (`#f59e0b` on `#ffffff` light card) | `#f59e0b` on `#ffffff` (**2.15:1** FAIL) | `#f59e0b` on `#18181b` (**7.8:1** PASS) | Fails WCAG AA in all light themes | **FIX**: Separate `--suite-status-warning-accent` (`#f59e0b` for icons/stars/bars) from `--suite-status-warning-fg` (`#b45309` light / `#fbbf24` dark, **5.0:1+**). |
| **Projectify Category Cards** (`.py-card-red`, `.py-card-blue`, etc. in [`cards.tid#L54-L72`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/cards.tid#L54-L72)) | Hardcoded `#1f2937` text on pastel hexes (**11.2:1** PASS) | Pastel hexes do not adapt cleanly to dark mode | Jarring high-luminance blocks in dark mode | **FIX**: Provide dark-aware `color-mix` category tints or scope under `--suite-surface-card`. |

---

## Part 2: The CSS Token Contract (`:root` / `.tc-page-container`)

To satisfy both the `--tw-suite-*` namespace and the `--suite-*` shorthand across all five plugins:
- Every token is defined as `--suite-*` (canonical shorthand) and mirrored to `--tw-suite-*` so either prefix works seamlessly.
- When **Slipstream** is active, it declares these tokens on `:root, .tc-page-container` with elevated surface mixing, refined shadows, and dark-mode overrides.
- When a plugin runs **standalone**, its embedded `:where(:root, .tc-page-container)` block provides zero-specificity defaults backed by TiddlyWiki 5.4 `--tpc-*` variables and TiddlyWiki 5.3 `<<colour ...>>` macros.

```css
/* ==========================================================================
   TW5 PRODUCTIVITY SUITE — CANONICAL CSS TOKEN CONTRACT
   Scope: :root, .tc-page-container
   ========================================================================== */

:where(:root, .tc-page-container) {
  /* ------------------------------------------------------------------------
     1. SURFACE & ELEVATION TOKENS
     ------------------------------------------------------------------------ */
  /* App background canvas (behind tiddlers/cards) */
  --suite-bg-canvas: var(
    --mn-bg-app,
    var(--tpc-page-background, <<colour page-background>>)
  );

  /* Primary Tiddler / Workspace Surface */
  --suite-surface-primary: var(
    --mn-bg-surface,
    var(--tpc-tiddler-background, <<colour tiddler-background>>)
  );

  /* Card Surface (Kanban card, Bean card, Media card, Journal panel) */
  --suite-surface-card: var(
    --mn-bg-card,
    color-mix(
      in srgb,
      var(--tpc-tiddler-background, <<colour tiddler-background>>) 96.5%,
      var(--tpc-foreground, <<colour foreground>>) 3.5%
    )
  );

  /* Subtle / Recessed Surface (Kanban columns, filter bars, recipe boxes, roll-ups) */
  --suite-surface-subtle: var(
    --mn-bg-subtle,
    color-mix(
      in srgb,
      var(--tpc-tiddler-background, <<colour tiddler-background>>) 93%,
      var(--tpc-foreground, <<colour foreground>>) 7%
    )
  );

  /* Elevated Surface (Popovers, dropdown menus, modals, drawers, sticky toolbars) */
  --suite-surface-elevated: var(
    --mn-bg-elevated,
    color-mix(
      in srgb,
      var(--tpc-tiddler-background, <<colour tiddler-background>>) 90%,
      var(--tpc-foreground, <<colour foreground>>) 10%
    )
  );

  /* Input / Field Background */
  --suite-surface-input: var(
    --tpc-tiddler-background,
    <<colour tiddler-background>>
  );

  /* Interactive States (Hover, Active, Selected, Dropzone Highlight) */
  --suite-surface-hover: var(
    --mn-bg-hover,
    color-mix(
      in srgb,
      var(--tpc-foreground, <<colour foreground>>) 5.5%,
      var(--tpc-tiddler-background, <<colour tiddler-background>>)
    )
  );
  --suite-surface-active: var(
    --mn-bg-active,
    color-mix(
      in srgb,
      var(--tpc-foreground, <<colour foreground>>) 9%,
      var(--tpc-tiddler-background, <<colour tiddler-background>>)
    )
  );
  --suite-surface-selected: var(
    --mn-accent-soft,
    color-mix(
      in srgb,
      var(--tpc-primary, <<colour primary>>) 12%,
      var(--tpc-tiddler-background, <<colour tiddler-background>>)
    )
  );
  --suite-surface-dropzone: color-mix(
    in srgb,
    var(--tpc-primary, <<colour primary>>) 8%,
    var(--suite-surface-subtle)
  );
  --suite-scrim: var(--mn-scrim, rgba(15, 23, 42, 0.45));

  /* ------------------------------------------------------------------------
     2. TEXT & FOREGROUND HIERARCHY (WCAG AA >= 4.5:1 Guaranteed)
     ------------------------------------------------------------------------ */
  --suite-fg-primary: var(
    --mn-fg-primary,
    var(--tpc-foreground, <<colour foreground>>)
  );
  --suite-fg-secondary: var(
    --mn-fg-secondary,
    color-mix(
      in srgb,
      var(--tpc-foreground, <<colour foreground>>) 72%,
      var(--tpc-muted-foreground, <<colour muted-foreground>>) 28%
    )
  );
  --suite-fg-muted: var(
    --mn-fg-muted,
    color-mix(
      in srgb,
      var(--tpc-foreground, <<colour foreground>>) 58%,
      var(--tpc-muted-foreground, <<colour muted-foreground>>) 42%
    )
  );
  --suite-fg-on-accent: #ffffff;

  /* ------------------------------------------------------------------------
     3. BORDER, DIVIDER & RADIUS SCALE
     ------------------------------------------------------------------------ */
  --suite-border-width: 1px;
  --suite-border-width-accent: 3px;

  --suite-border-hairline: var(
    --mn-border-hairline,
    color-mix(in srgb, var(--suite-fg-primary) 7%, transparent)
  );
  --suite-border-subtle: var(
    --mn-border-subtle,
    color-mix(in srgb, var(--suite-fg-primary) 12%, transparent)
  );
  --suite-border-strong: var(
    --mn-border-strong,
    color-mix(in srgb, var(--suite-fg-primary) 22%, transparent)
  );

  /* Unified Radius Scale */
  --suite-radius-xs: 6px;     /* Inner chips, checkboxes, kbd badges, calendar dots */
  --suite-radius-sm: 8px;     /* Inputs, buttons, steppers, compact list rows */
  --suite-radius-md: 10px;    /* Standard domain cards (Kanban, Bean, Media, Journal) */
  --suite-radius-lg: 14px;    /* Dashboard containers, hero banners, dropzones, modals */
  --suite-radius-xl: 18px;    /* Tiddler frames (River mode) */
  --suite-radius-pill: 9999px;/* Status pills, filter chips, omnibar */

  /* Shadows & Focus Ring */
  --suite-shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
  --suite-shadow-sm: var(
    --mn-shadow-card,
    0 2px 8px -2px rgba(15, 23, 42, 0.06),
    0 1px 3px -1px rgba(15, 23, 42, 0.04)
  );
  --suite-shadow-md: 0 6px 16px -4px rgba(15, 23, 42, 0.10),
    0 2px 6px -1px rgba(15, 23, 42, 0.05);
  --suite-shadow-lg: var(
    --mn-shadow-popover,
    0 12px 32px -4px rgba(15, 23, 42, 0.16),
    0 4px 12px -2px rgba(15, 23, 42, 0.08)
  );
  --suite-focus-ring: 0 0 0 3px color-mix(
    in srgb,
    var(--suite-accent) 28%,
    transparent
  );

  /* ------------------------------------------------------------------------
     4. SPACING, SIZING & DENSITY SCALE (Desktop Default)
     ------------------------------------------------------------------------ */
  --suite-space-1: 0.25rem;   /* 4px */
  --suite-space-2: 0.5rem;    /* 8px */
  --suite-space-3: 0.75rem;   /* 12px */
  --suite-space-4: 1rem;      /* 16px */
  --suite-space-5: 1.25rem;   /* 20px */
  --suite-space-6: 1.5rem;    /* 24px */
  --suite-space-8: 2rem;      /* 32px */

  /* Component Density Tokens */
  --suite-card-padding-sm: 0.625rem 0.75rem; /* 10px 12px — Kanban & compact media cards */
  --suite-card-padding-md: 0.875rem 1rem;    /* 14px 16px — Bean, Journal & Library cards */
  --suite-card-padding-lg: 1.125rem 1.25rem; /* 18px 20px — Dashboard sections & hero panels */
  --suite-card-gap: 0.75rem;                 /* 12px grid gap */
  --suite-section-gap: 1.25rem;              /* 20px vertical stack gap */

  /* Interactive Control Sizing (Desktop: 36px, Mobile: 44px via media query) */
  --suite-control-height-sm: 30px;
  --suite-control-height-md: 36px;
  --suite-control-height-lg: 44px;
  --suite-touch-target: 36px;

  /* Layout & Reading Measure */
  --suite-measure-reading: 65ch;
  --suite-width-reading: var(--mn-reading-width, 840px);
  --suite-width-wide: var(--mn-wide-width, 1120px);

  /* ------------------------------------------------------------------------
     5. TYPOGRAPHY & TABULAR NUMERALS
     ------------------------------------------------------------------------ */
  --suite-font-sans: var(
    --mn-font-sans,
    -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif
  );
  --suite-font-mono: var(
    --mn-font-mono,
    "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace
  );

  --suite-text-xs: 0.75rem;     /* 12px — Badges, uppercase labels, timestamps */
  --suite-text-sm: 0.84rem;     /* 13.4px — Buttons, inputs, card metadata */
  --suite-text-base: 0.9375rem; /* 15px — Card titles, list items */
  --suite-text-lg: 1.125rem;    /* 18px — Section headers */
  --suite-text-xl: 1.375rem;    /* 22px — Dashboard titles & hero metrics */

  --suite-tracking-label: 0.04em;
  --suite-leading-tight: 1.25;
  --suite-leading-normal: 1.5;
  --suite-leading-relaxed: 1.68;

  /* ------------------------------------------------------------------------
     6. SEMANTIC STATUS & ACCENT TOKENS (Light/Dark Resilient Triads)
     ------------------------------------------------------------------------ */
  /* Primary Brand Accent */
  --suite-accent: var(--mn-accent, var(--tpc-primary, <<colour primary>>));
  --suite-accent-hover: var(
    --mn-accent-hover,
    color-mix(in srgb, var(--suite-accent) 86%, var(--suite-fg-primary))
  );
  --suite-accent-bg: var(
    --mn-accent-soft,
    color-mix(in srgb, var(--suite-accent) 12%, var(--suite-surface-primary))
  );
  --suite-accent-border: color-mix(in srgb, var(--suite-accent) 30%, transparent);

  /* Success (Completed tasks, optimal brew extraction, imported media, win tags) */
  --suite-status-success-accent: #10b981;
  --suite-status-success-fg: color-mix(
    in srgb,
    #059669 82%,
    var(--suite-fg-primary)
  );
  --suite-status-success-bg: color-mix(
    in srgb,
    #10b981 13%,
    var(--suite-surface-primary)
  );
  --suite-status-success-border: color-mix(in srgb, #10b981 32%, transparent);

  /* Warning (Priority 2, waiting tasks, staged media, star ratings, low bean stock) */
  --suite-status-warning-accent: #f59e0b; /* Use for star icons & left accent bars */
  --suite-status-warning-fg: color-mix(
    in srgb,
    #d97706 82%,
    var(--suite-fg-primary)
  );
  --suite-status-warning-bg: color-mix(
    in srgb,
    #f59e0b 14%,
    var(--suite-surface-primary)
  );
  --suite-status-warning-border: color-mix(in srgb, #f59e0b 35%, transparent);

  /* Danger (Overdue, Priority 3, blocked tasks, sour/bitter brew extremes, delete/error) */
  --suite-status-danger-accent: var(
    --mn-danger,
    var(--tpc-alert-highlight, #ef4444)
  );
  --suite-status-danger-fg: color-mix(
    in srgb,
    var(--suite-status-danger-accent) 85%,
    var(--suite-fg-primary)
  );
  --suite-status-danger-bg: color-mix(
    in srgb,
    var(--suite-status-danger-accent) 12%,
    var(--suite-surface-primary)
  );
  --suite-status-danger-border: color-mix(
    in srgb,
    var(--suite-status-danger-accent) 32%,
    transparent
  );

  /* Info (Priority 1, scheduled dates, external file storage badge, active habits) */
  --suite-status-info-accent: #3b82f6;
  --suite-status-info-fg: color-mix(
    in srgb,
    #2563eb 82%,
    var(--suite-fg-primary)
  );
  --suite-status-info-bg: color-mix(
    in srgb,
    #3b82f6 12%,
    var(--suite-surface-primary)
  );
  --suite-status-info-border: color-mix(in srgb, #3b82f6 30%, transparent);

  /* ------------------------------------------------------------------------
     7. NAMESPACE ALIASES (--tw-suite-* -> --suite-*)
     ------------------------------------------------------------------------ */
  --tw-suite-bg-canvas: var(--suite-bg-canvas);
  --tw-suite-surface-primary: var(--suite-surface-primary);
  --tw-suite-surface-card: var(--suite-surface-card);
  --tw-suite-surface-subtle: var(--suite-surface-subtle);
  --tw-suite-surface-elevated: var(--suite-surface-elevated);
  --tw-suite-surface-hover: var(--suite-surface-hover);
  --tw-suite-surface-active: var(--suite-surface-active);
  --tw-suite-surface-dropzone: var(--suite-surface-dropzone);
  --tw-suite-fg-primary: var(--suite-fg-primary);
  --tw-suite-fg-secondary: var(--suite-fg-secondary);
  --tw-suite-fg-muted: var(--suite-fg-muted);
  --tw-suite-border-subtle: var(--suite-border-subtle);
  --tw-suite-border-strong: var(--suite-border-strong);
  --tw-suite-radius-sm: var(--suite-radius-sm);
  --tw-suite-radius-md: var(--suite-radius-md);
  --tw-suite-radius-lg: var(--suite-radius-lg);
  --tw-suite-radius-pill: var(--suite-radius-pill);
  --tw-suite-accent: var(--suite-accent);
}

/* Mobile Responsive Density & Touch Target Promotion (Unified 640px Breakpoint) */
@media (max-width: 640px) {
  :where(:root, .tc-page-container) {
    --suite-control-height-sm: 36px;
    --suite-control-height-md: 44px;
    --suite-touch-target: 44px;
    --suite-card-padding-md: 0.75rem 0.875rem; /* 12px 14px */
    --suite-card-padding-lg: 0.875rem 1rem;    /* 14px 16px */
    --suite-card-gap: 0.625rem;                /* 10px */
    --suite-section-gap: 1rem;                 /* 16px */
  }
}
```

---

## Part 3: Shared Component Blueprints (CSS Class Patterns)

Each plugin retains its domain prefix (`.py-*`, `.ct-*`, `.mi-*`, `.journal-*`, `.mn-*`) while Either applying the shared `.suite-*` utility classes or mapping its existing component classes directly to the blueprints below.

### 3.1 Cards & Containers (`.suite-card`)

Unifies **Kanban Todo Cards** (`.py-todo-item-wrapper`), **Project Cards** (`.py-card`), **Coffee Bean & Brew Cards** (`.ct-card`), **Media Search / Queue / Library Cards** (`.mi-card`, `.mi-library-card`), and **Journal Panels / Day Cards** (`.journal-card-panel`, `.journal-otd-card`, `.journal-day-card`).

```css
/* Base Card Anatomy */
.suite-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--suite-space-2);
  background: var(--suite-surface-card);
  color: var(--suite-fg-primary);
  border: var(--suite-border-width) solid var(--suite-border-subtle);
  border-radius: var(--suite-radius-md);
  padding: var(--suite-card-padding-md);
  box-shadow: var(--suite-shadow-xs);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

/* Compact variant for Kanban cards & Media search result rows */
.suite-card--compact {
  padding: var(--suite-card-padding-sm);
}

/* Interactive / Clickable Card Variant */
.suite-card--interactive {
  cursor: pointer;
}
.suite-card--interactive:hover {
  border-color: var(--suite-border-strong);
  box-shadow: var(--suite-shadow-sm);
  transform: translateY(-1px);
}
.suite-card--interactive:focus-visible {
  outline: none;
  box-shadow: var(--suite-focus-ring);
}

/* Left Status Bar Accent Variants (Kanban priority, Active Coffee Bag, Staged Media) */
.suite-card--accent-primary {
  border-left: var(--suite-border-width-accent) solid var(--suite-accent);
}
.suite-card--accent-success {
  border-left: var(--suite-border-width-accent) solid var(--suite-status-success-accent);
}
.suite-card--accent-warning {
  border-left: var(--suite-border-width-accent) solid var(--suite-status-warning-accent);
}
.suite-card--accent-danger {
  border-left: var(--suite-border-width-accent) solid var(--suite-status-danger-accent);
}

/* Card Structural Slots */
.suite-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--suite-space-2);
}
.suite-card__title {
  margin: 0;
  font-size: var(--suite-text-base);
  font-weight: 600;
  line-height: var(--suite-leading-tight);
  color: var(--suite-fg-primary);
}
.suite-card__body {
  font-size: var(--suite-text-sm);
  line-height: var(--suite-leading-normal);
  color: var(--suite-fg-secondary);
}
.suite-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--suite-space-2);
  margin-top: auto;
  padding-top: var(--suite-space-2);
  border-top: 1px solid var(--suite-border-hairline);
  font-size: var(--suite-text-xs);
  color: var(--suite-fg-muted);
}

/* Recessed Panel / Board Column (Kanban Column, Coffee Recipe Summary, Journal Roll-up) */
.suite-panel-subtle {
  background: var(--suite-surface-subtle);
  border: 1px solid var(--suite-border-hairline);
  border-radius: var(--suite-radius-md);
  padding: var(--suite-card-padding-md);
}
```

### 3.2 Pills & Badges (`.suite-badge` & `.suite-pill`)

Unifies **Task status/priority pills** (`.py-pill`, `.py-todo-status-pill`), **Coffee tasting notes, brew method & extraction badges** (`.ct-tag`, `.ct-meta-badge`, `.ct-badge-*`), **Journal streak & roll-up badges** (`.habit-streak-pill`, `.journal-roll-up-tag`), and **Media Importer storage/staged badges** (`.mi-badge`, `.mi-storage-badge`, `.mi-imported-pill`).

```css
/* Non-interactive Metadata / Status Badge */
.suite-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.55rem;
  border-radius: var(--suite-radius-pill);
  font-family: var(--suite-font-sans);
  font-size: var(--suite-text-xs);
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  background: var(--suite-surface-subtle);
  color: var(--suite-fg-secondary);
  border: 1px solid var(--suite-border-subtle);
  font-variant-numeric: tabular-nums;
}

/* Semantic Status Variants */
.suite-badge--accent {
  background: var(--suite-accent-bg);
  color: var(--suite-accent);
  border-color: var(--suite-accent-border);
}
.suite-badge--success {
  background: var(--suite-status-success-bg);
  color: var(--suite-status-success-fg);
  border-color: var(--suite-status-success-border);
}
.suite-badge--warning {
  background: var(--suite-status-warning-bg);
  color: var(--suite-status-warning-fg);
  border-color: var(--suite-status-warning-border);
}
.suite-badge--danger {
  background: var(--suite-status-danger-bg);
  color: var(--suite-status-danger-fg);
  border-color: var(--suite-status-danger-border);
}
.suite-badge--info {
  background: var(--suite-status-info-bg);
  color: var(--suite-status-info-fg);
  border-color: var(--suite-status-info-border);
}

/* Interactive Filter / Toggle Chip (Coffee Compass, Ratio Chips, Media Genre/Segmented Pills) */
.suite-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: var(--suite-control-height-sm);
  padding: 0.25rem 0.75rem;
  border-radius: var(--suite-radius-pill);
  font-size: var(--suite-text-xs);
  font-weight: 600;
  background: var(--suite-surface-subtle);
  color: var(--suite-fg-secondary);
  border: 1px solid var(--suite-border-subtle);
  cursor: pointer;
  user-select: none;
  transition: all 0.14s ease;
}
.suite-chip:hover {
  background: var(--suite-surface-hover);
  color: var(--suite-fg-primary);
  border-color: var(--suite-border-strong);
}
.suite-chip.is-active,
.suite-chip[aria-pressed="true"] {
  background: var(--suite-accent);
  color: var(--suite-fg-on-accent);
  border-color: var(--suite-accent);
}
```

### 3.3 Inputs, Buttons, Selects & Steppers

Standardizes desktop height (`36px`) and mobile touch-target height (`44px`), removes `text-transform: uppercase` from buttons, restores custom SVG chevrons on `<select>`, and applies `tabular-nums` to all numeric steppers and metrics.

```css
/* Base Action Button */
.suite-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: var(--suite-control-height-md);
  padding: 0 0.875rem;
  border-radius: var(--suite-radius-sm);
  border: 1px solid var(--suite-border-subtle);
  background: var(--suite-surface-card);
  color: var(--suite-fg-primary);
  font-family: var(--suite-font-sans);
  font-size: var(--suite-text-sm);
  font-weight: 600;
  line-height: 1;
  text-transform: none; /* Override Media Importer uppercase */
  letter-spacing: normal;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease,
    box-shadow 0.14s ease;
}
.suite-btn:hover {
  background: var(--suite-surface-hover);
  border-color: var(--suite-border-strong);
}
.suite-btn:focus-visible {
  outline: none;
  box-shadow: var(--suite-focus-ring);
}

/* Primary CTA Button */
.suite-btn--primary {
  background: var(--suite-accent);
  color: var(--suite-fg-on-accent);
  border-color: var(--suite-accent);
}
.suite-btn--primary:hover {
  background: var(--suite-accent-hover);
  border-color: var(--suite-accent-hover);
  color: var(--suite-fg-on-accent);
}

/* Danger / Destructive Button */
.suite-btn--danger {
  background: transparent;
  color: var(--suite-status-danger-fg);
  border-color: var(--suite-status-danger-border);
}
.suite-btn--danger:hover {
  background: var(--suite-status-danger-bg);
  border-color: var(--suite-status-danger-accent);
}

/* Text, Number & Date Inputs */
.suite-input,
.suite-select,
.suite-textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: var(--suite-control-height-md);
  padding: 0.45rem 0.75rem;
  border-radius: var(--suite-radius-sm);
  border: 1px solid var(--suite-border-subtle);
  background: var(--suite-surface-input);
  color: var(--suite-fg-primary);
  font-family: var(--suite-font-sans);
  font-size: var(--suite-text-sm);
  line-height: 1.4;
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}
.suite-input:focus,
.suite-select:focus,
.suite-textarea:focus {
  outline: none;
  border-color: var(--suite-accent);
  box-shadow: var(--suite-focus-ring);
}

/* Unified Select with Theme-Resilient Chevron */
.suite-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 2.25rem;
  background-image: linear-gradient(45deg, transparent 50%, var(--suite-fg-muted) 50%),
                    linear-gradient(135deg, var(--suite-fg-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 16px) calc(50% - 2px),
    calc(100% - 11px) calc(50% - 2px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}

/* Countertop Numeric Stepper & Tabular Figures Utility */
.suite-tabular-nums {
  font-variant-numeric: tabular-nums;
}

.suite-stepper {
  display: inline-flex;
  align-items: center;
  gap: var(--suite-space-1);
  background: var(--suite-surface-subtle);
  padding: 3px;
  border-radius: var(--suite-radius-sm);
  border: 1px solid var(--suite-border-subtle);
}
.suite-stepper__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--suite-touch-target);
  height: var(--suite-touch-target);
  border-radius: var(--suite-radius-xs);
  border: 1px solid var(--suite-border-subtle);
  background: var(--suite-surface-card);
  color: var(--suite-fg-primary);
  font-weight: 700;
  cursor: pointer;
}
.suite-stepper__input {
  width: 4.5rem;
  text-align: center;
  font-family: var(--suite-font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--suite-fg-primary);
}
```

### 3.4 Empty States & Dropzones (`.suite-empty-state` & `.suite-dropzone`)

Unifies **Empty Kanban Columns** (`.py-board-empty`), **Projectify Welcome Banner** (`.py-welcome`), **Empty Journal Roll-ups / On This Day** (`.journal-empty-state`), **Coffee Empty Inventory** (`.ct-empty-state`), and **Media Importer Dropzones** (`.mi-dropzone`).

```css
.suite-empty-state,
.suite-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--suite-space-2);
  padding: var(--suite-space-6) var(--suite-space-4);
  background: var(--suite-surface-subtle);
  border: 1.5px dashed var(--suite-border-strong);
  border-radius: var(--suite-radius-lg);
  color: var(--suite-fg-muted);
  font-size: var(--suite-text-sm);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.suite-dropzone {
  cursor: pointer;
}
.suite-dropzone:hover,
.suite-dropzone.is-dragover {
  background: var(--suite-surface-dropzone);
  border-color: var(--suite-accent);
  border-style: solid;
  color: var(--suite-fg-primary);
}
```

---

## Part 4: Standalone vs. Slipstream Integration Strategy

### 4.1 How the Zero-Dependency Fallback Pattern Works
1. **Why `type: text/vnd.tiddlywiki` is required for the token bridge**:
   In TiddlyWiki 5, `<<colour ...>>` macros are only parsed when a stylesheet tiddler has `type: text/vnd.tiddlywiki` (or no `type` field) and includes `\rules only filteredtranscludeinline transcludeinline macrodef macrocallinline`. Pure `type: text/css` tiddlers (like Journal's [`index.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/index.css)) emit literal `<<colour ...>>` strings into the browser DOM if macros are used directly.
2. **Zero-Specificity `:where(:root, .tc-page-container)` Fallbacks in Feature Plugins**:
   Each feature plugin (Task Manager, Journal, Coffee Tracker, Media Importer) ships a compact token header inside a `type: text/vnd.tiddlywiki` stylesheet wrapped in `:where(:root, .tc-page-container) { ... }` (specificity `0,0,0`).
3. **Automatic Slipstream Elevation**:
   When **Slipstream** is installed, its [`core.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-slipstream/plugins/mblackman/slipstream/styles/core.css) defines the `--suite-*` and `--tw-suite-*` tokens on `:root, .tc-page-container` (specificity `0,1,0`) and `.mn-dark-mode` / `.mn-light-mode` (specificity `0,1,0`). Because `0,1,0` beats `:where(...)` (`0,0,0`) regardless of stylesheet load order, Slipstream automatically takes over as the root theme orchestrator without a single `!important`.

### 4.2 Exact `$:/tags/Stylesheet` Boilerplate for Every Feature Plugin

Include this block at the top of a `type: text/vnd.tiddlywiki` stylesheet in each plugin (or as a dedicated `styles/suite-tokens.tid` tagged `$:/tags/Stylesheet` for plugins like Journal that prefer keeping their main CSS file as `type: text/css`):

```css
title: $:/plugins/mblackman/<plugin-id>/styles/suite-tokens
tags: $:/tags/Stylesheet
type: text/vnd.tiddlywiki

\rules only filteredtranscludeinline transcludeinline macrodef macrocallinline

/* Standalone-safe fallback contract (specificity 0,0,0 via :where).
   Automatically overridden when Slipstream ($:/plugins/mblackman/slipstream) is active. */
:where(:root, .tc-page-container) {
  --suite-bg-canvas: var(--mn-bg-app, var(--tpc-page-background, <<colour page-background>>));
  --suite-surface-primary: var(--mn-bg-surface, var(--tpc-tiddler-background, <<colour tiddler-background>>));
  --suite-surface-card: var(--mn-bg-card, color-mix(in srgb, var(--tpc-tiddler-background, <<colour tiddler-background>>) 96.5%, var(--tpc-foreground, <<colour foreground>>) 3.5%));
  --suite-surface-subtle: var(--mn-bg-subtle, color-mix(in srgb, var(--tpc-tiddler-background, <<colour tiddler-background>>) 93%, var(--tpc-foreground, <<colour foreground>>) 7%));
  --suite-surface-elevated: var(--mn-bg-elevated, color-mix(in srgb, var(--tpc-tiddler-background, <<colour tiddler-background>>) 90%, var(--tpc-foreground, <<colour foreground>>) 10%));
  --suite-surface-input: var(--tpc-tiddler-background, <<colour tiddler-background>>);
  --suite-surface-hover: var(--mn-bg-hover, color-mix(in srgb, var(--tpc-foreground, <<colour foreground>>) 5.5%, var(--tpc-tiddler-background, <<colour tiddler-background>>)));
  --suite-surface-active: var(--mn-bg-active, color-mix(in srgb, var(--tpc-foreground, <<colour foreground>>) 9%, var(--tpc-tiddler-background, <<colour tiddler-background>>)));
  --suite-surface-selected: var(--mn-accent-soft, color-mix(in srgb, var(--tpc-primary, <<colour primary>>) 12%, var(--tpc-tiddler-background, <<colour tiddler-background>>)));
  --suite-surface-dropzone: color-mix(in srgb, var(--tpc-primary, <<colour primary>>) 8%, var(--suite-surface-subtle));

  --suite-fg-primary: var(--mn-fg-primary, var(--tpc-foreground, <<colour foreground>>));
  --suite-fg-secondary: var(--mn-fg-secondary, color-mix(in srgb, var(--tpc-foreground, <<colour foreground>>) 72%, var(--tpc-muted-foreground, <<colour muted-foreground>>) 28%));
  --suite-fg-muted: var(--mn-fg-muted, color-mix(in srgb, var(--tpc-foreground, <<colour foreground>>) 58%, var(--tpc-muted-foreground, <<colour muted-foreground>>) 42%));
  --suite-fg-on-accent: #ffffff;

  --suite-border-hairline: var(--mn-border-hairline, color-mix(in srgb, var(--suite-fg-primary) 7%, transparent));
  --suite-border-subtle: var(--mn-border-subtle, color-mix(in srgb, var(--suite-fg-primary) 12%, transparent));
  --suite-border-strong: var(--mn-border-strong, color-mix(in srgb, var(--suite-fg-primary) 22%, transparent));

  --suite-radius-xs: 6px;
  --suite-radius-sm: 8px;
  --suite-radius-md: 10px;
  --suite-radius-lg: 14px;
  --suite-radius-pill: 9999px;

  --suite-control-height-sm: 30px;
  --suite-control-height-md: 36px;
  --suite-touch-target: 36px;

  --suite-font-sans: var(--mn-font-sans, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif);
  --suite-font-mono: var(--mn-font-mono, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace);

  --suite-accent: var(--mn-accent, var(--tpc-primary, <<colour primary>>));
  --suite-accent-hover: var(--mn-accent-hover, color-mix(in srgb, var(--suite-accent) 86%, var(--suite-fg-primary)));
  --suite-accent-bg: var(--mn-accent-soft, color-mix(in srgb, var(--suite-accent) 12%, var(--suite-surface-primary)));
  --suite-accent-border: color-mix(in srgb, var(--suite-accent) 30%, transparent);

  --suite-status-success-accent: #10b981;
  --suite-status-success-fg: color-mix(in srgb, #059669 82%, var(--suite-fg-primary));
  --suite-status-success-bg: color-mix(in srgb, #10b981 13%, var(--suite-surface-primary));
  --suite-status-success-border: color-mix(in srgb, #10b981 32%, transparent);

  --suite-status-warning-accent: #f59e0b;
  --suite-status-warning-fg: color-mix(in srgb, #d97706 82%, var(--suite-fg-primary));
  --suite-status-warning-bg: color-mix(in srgb, #f59e0b 14%, var(--suite-surface-primary));
  --suite-status-warning-border: color-mix(in srgb, #f59e0b 35%, transparent);

  --suite-status-danger-accent: var(--mn-danger, var(--tpc-alert-highlight, #ef4444));
  --suite-status-danger-fg: color-mix(in srgb, var(--suite-status-danger-accent) 85%, var(--suite-fg-primary));
  --suite-status-danger-bg: color-mix(in srgb, var(--suite-status-danger-accent) 12%, var(--suite-surface-primary));
  --suite-status-danger-border: color-mix(in srgb, var(--suite-status-danger-accent) 32%, transparent);

  --suite-status-info-accent: #3b82f6;
  --suite-status-info-fg: color-mix(in srgb, #2563eb 82%, var(--suite-fg-primary));
  --suite-status-info-bg: color-mix(in srgb, #3b82f6 12%, var(--suite-surface-primary));
  --suite-status-info-border: color-mix(in srgb, #3b82f6 30%, transparent);

  --suite-focus-ring: 0 0 0 3px color-mix(in srgb, var(--suite-accent) 28%, transparent);
}

@media (max-width: 640px) {
  :where(:root, .tc-page-container) {
    --suite-control-height-sm: 36px;
    --suite-control-height-md: 44px;
    --suite-touch-target: 44px;
  }
}
```

---

## Part 5: Plugin-by-Plugin Migration Checklist

### 5.1 Slipstream (`tiddlywiki-slipstream`)
- [x] **[`plugins/mblackman/slipstream/styles/core.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-slipstream/plugins/mblackman/slipstream/styles/core.css#L1-L195)**:
  - Export the canonical `--suite-*` and `--tw-suite-*` token contract inside `:root, .mn-app-shell` mapped to `--mn-*` tokens so Slipstream acts as the root theme orchestrator for all installed suite plugins while preserving Invariant 6 scoping.
  - Consolidate hardcoded `#ef4444` danger fallbacks to `var(--suite-status-danger-accent)`.
  - Align `.mn-card` and `.mn-prop-pill` with `--suite-radius-md` (`10px`) / `--suite-radius-lg` (`14px`) and `font-variant-numeric: tabular-nums`.
- [x] **[`plugins/mblackman/slipstream/palettes/SlipstreamLight.tid`](file:///Users/mblackman/workspace/gh/tiddlywiki-slipstream/plugins/mblackman/slipstream/palettes/SlipstreamLight.tid) & [`SlipstreamDark.tid`](file:///Users/mblackman/workspace/gh/tiddlywiki-slipstream/plugins/mblackman/slipstream/palettes/SlipstreamDark.tid)**:
  - Add `positive-alert-banner-background`, `positive-alert-banner-foreground`, `alert-banner-background`, and `alert-banner-foreground` keys to both palettes for backwards compatibility with third-party TiddlyWiki plugins.

### 5.2 Task Manager / Projectify (`Projectify`)
- [x] **[`plugins/mblackman/projectify/styles/stylesheet.tid`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/stylesheet.tid)**:
  - Add the `:where(:root, .tc-page-container)` token contract header.
  - Replace all hardcoded semantic hexes (`#2da562`, `#e73939`, `#e77a39`, `#2563eb`) with `--suite-status-success-*`, `--suite-status-danger-*`, `--suite-status-warning-*`, and `--suite-status-info-*`.
  - Align `.py-board-column` to `background: var(--suite-surface-subtle); border-radius: var(--suite-radius-md);`.
  - Align `.py-board-cards .py-todo-item-wrapper` to `--suite-surface-card`, `--suite-radius-md`, and `--suite-shadow-xs`.
  - Apply `font-variant-numeric: tabular-nums` to `.py-count`, `.py-board-column-count`, and `.py-due-date`.
  - Promote mobile `.py-todo-menu .py-btn` and `.py-board-tab` to `min-height: var(--suite-touch-target)` (`44px` on mobile).
- [x] **[`plugins/mblackman/projectify/styles/cards.tid`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/cards.tid#L18-L72)**:
  - Replace `.py-card` harsh `box-shadow: 0 1px 5px 0 rgba(0, 0, 0, 0.2)` with `var(--suite-shadow-xs)` and `--suite-radius-md`.
- [x] **[`plugins/mblackman/projectify/styles/form-control.tid`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/form-control.tid#L4-L21) & [`utils.tid`](file:///Users/mblackman/workspace/gh/Projectify/plugins/mblackman/projectify/styles/utils.tid#L140-L185)**:
  - Upgrade `input.py-input` from `border-radius: 4px` to `var(--suite-radius-sm)` (`8px`) and `min-height: var(--suite-control-height-md)`.
  - Replace `#df3f3f` on `.py-count-alert` and `.py-pill` with `--suite-status-danger-*`.

### 5.3 Journal (`tiddlywiki-journal`)
- [x] **Create [`plugins/mblackman/journal/styles/suite-tokens.tid`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/suite-tokens.tid)** (`type: text/vnd.tiddlywiki`, tagged `$:/tags/Stylesheet`):
  - Provide the `:where(:root, .tc-page-container)` token fallback block so Journal no longer breaks on TiddlyWiki versions/palettes without `--tpc-*`.
- [x] **[`plugins/mblackman/journal/styles/index.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/index.css) & [`habit.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/styles/habit.css)**:
  - Replace all `var(--tpc-code-background)` surface assignments on `.journal-nav`, `.journal-roll-up-item`, `.journal-rollup-day-card`, `.journal-focus-banner`, `.journal-otd-card`, `.journal-activity-item`, `.journal-card-panel`, `.journal-quick-capture-box`, `.journal-history-section`, and `.habit-card-item` with `var(--suite-surface-card)` (for cards) and `var(--suite-surface-subtle)` (for recessed banners/toolbars), eliminating the purple code-block tint in Slipstream palettes.
  - Replace `.journal-day-card:hover`, `.journal-dashboard-tile:hover`, and `.journal-recent-item:hover` (`var(--tpc-selection-background)`) with `var(--suite-surface-hover)`.
  - Add missing `.journal-roll-up-tag-challenge` styling ([referenced in `daily-journal.tid#L113`](file:///Users/mblackman/workspace/gh/tiddlywiki-journal/plugins/mblackman/journal/templates/daily-journal.tid#L113)) using `--suite-status-warning-*`, and map `.journal-roll-up-tag-win` to `--suite-status-success-*`.
  - Fix `select.journal-input, select.habit-input` by adding the `.suite-select` chevron `background-image`.
  - Apply `font-variant-numeric: tabular-nums` to `.journal-day-card-date`, `.journal-recent-iso`, `.journal-otd-badge`, and `.habit-streak-pill`.
  - Update mobile `.journal-btn` from `min-height: 40px` to `var(--suite-control-height-md)` (`44px` on mobile).

### 5.4 Coffee Tracker (`tiddlywiki-coffee-tracker`)
- [x] **[`src/coffee-tracker/index.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-coffee-tracker/src/coffee-tracker/index.css)**:
  - Add the `:where(:root, .tc-page-container)` token contract at the top of `index.css`.
  - Remove hardcoded `font-family` declarations on `.ct-dashboard-container` and `.ct-brew-log-container`, replacing with `font-family: var(--suite-font-sans)`.
  - Replace all `<<colour message-background>>` and `<<colour message-border>>` calls on `.ct-action-toolbar`, `.ct-section`, `.ct-rating-box`, `.ct-stat-card`, `.ct-quick-stats`, and `.ct-calculated-pill` with `var(--suite-surface-subtle)` and `var(--suite-border-subtle)` so sections do not render bright alert-blue in vanilla TiddlyWiki.
  - Replace broken `<<colour positive-alert-banner-background>>` / `<<colour alert-banner-background>>` calls and `<<colour dirty-indicator>>` status hacks with `--suite-status-success-*`, `--suite-status-warning-*`, and `--suite-status-danger-*`.
  - Standardize `.ct-btn` and `.ct-input` to `min-height: var(--suite-control-height-md)` (`36px` desktop / `44px` mobile), `border-radius: var(--suite-radius-sm)` (`8px`), and `:focus-visible` ring `var(--suite-focus-ring)`.
  - Apply `font-variant-numeric: tabular-nums` to `.ct-metric-input`, `.ct-calculated-metric-value`, `.ct-stat-value`, `.ct-score-pill`, and `.ct-ratio-chip`.
  - Promote `.ct-stepper-btn-sm` to `44px × 44px` on `@media (max-width: 640px)`.

### 5.5 Media Importer (`tiddlywiki-media-importer`)
- [x] **[`src/media-importer/index.css`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/index.css)**:
  - Add the `:where(:root, .tc-page-container)` token contract at the top of `index.css`.
  - Remove `text-transform: uppercase; letter-spacing: 0.02em;` from `.mi-btn` to match sentence/title case across the suite.
  - Fix `.mi-btn-primary:hover` to use `background: var(--suite-accent-hover); border-color: var(--suite-accent-hover); color: var(--suite-fg-on-accent);` instead of inverting to editor-background.
  - Replace hardcoded `#f59e0b` and `#ef4444` with `--suite-status-warning-*` (using `--suite-status-warning-fg` for text and `--suite-status-warning-accent` for star icons/borders) and `--suite-status-danger-*`.
  - Align `.mi-card` and `.mi-library-card` to `--suite-surface-card`, `--suite-radius-md` (`10px`), and `--suite-shadow-xs`.
  - Align `.mi-dropzone` to `.suite-dropzone` (`--suite-surface-subtle`, `--suite-radius-lg`, hover `--suite-surface-dropzone`).
  - Align mobile media query from `@media (max-width: 700px)` to `@media (max-width: 640px)`.
- [x] **[`src/media-importer/widgets/media-importer-ui.ts`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/widgets/media-importer-ui.ts#L139) & [`src/media-importer/widgets/media-library.ts`](file:///Users/mblackman/workspace/gh/tiddlywiki-media-importer/src/media-importer/widgets/media-library.ts#L210)**:
  - Replace unparsed inline `style="... color: <<colour foreground>>;"` in DOM element creation with `color: var(--suite-fg-primary);`.

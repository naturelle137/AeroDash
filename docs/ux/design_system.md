# AeroDash Design System (UX/UI Framework)

This document establishes the global usability, accessibility, and interaction rules that govern all AeroDash modules, fulfilling the requirements specified in `docs/requirements/usability_quality.md`.

---

## 1. Usability & Quality (UQ) Constants

<!-- @DES-UQ-001@ (FROM: @REQ-UQ-001@, @REQ-UQ-003@, @REQ-UQ-005@)-->

### 1.1 Input Ergonomics

AeroDash operates natively in cockpit environments. Inputs must be frictionless:

- **Touch Targets:** Minimum `44x44px` for all interactive elements (steppers, buttons, sliders).
- **Explicit Units:** Every input field must definitively display its active unit statically adjacent to the number (e.g., `kg`, `L`, `km/h`).
- **Precision:** Data fields auto-format to a decimal precision appropriate to the active unit, ensuring a physical resolution of at least 1mm for lengths and 0.1 units for mass/volume. Standard precisions: `m`=3, `cm`=1, `mm`=0, `in`=2, `kg`/`lb`/`L`/`gal`=1.

<!-- @DES-UQ-002@ (FROM: @REQ-UQ-002@)-->

### 1.2 Layout Responsiveness

- **Mobile/Cockpit Tablet (Max-width: 768px):** Single-column stacked layout. Navigation and critical alert banners top, scrolling configuration inputs middle, interactive visualization (e.g. Charts) bottom. Go/No-Go Summaries must be sticky at the viewport bottom.
- **Desktop/Planning Station (Min-width: 769px):** Split-pane layout. Left pane (40%) contains scrolling inputs. Right pane (60%) is a fixed position staging ground for charts and results.

---

## 2. Interaction State Taxonomy

<!-- @DES-UX-003@ (FROM: @REQ-SYS-007@, @REQ-UI-015@) -->

Component states strictly map to the Reactivity State Machine defined in [`docs/architecture/frontend_state_machine.md`](../architecture/frontend_state_machine.md) and the centralized Notification Schema.

1. **INITIAL:** Module mounted, no data context loaded. Inputs disabled. Connectivity indicator (Online/Offline) visible.
2. **LOADING:** Fetching aircraft profiles or performing async setup. Prevents race conditions.
3. **UNCONFIGURED:** Profile loaded but mandatory fields are still missing or untouched. Inputs enabled; math core may run on partial data. Export/Save **blocked**.
4. **UNVERIFIED:** All mandatory fields have values but the user has not yet confirmed them. Safety math runs on complete data. Export/Save gated behind a confirmation modal.
5. **VERIFIED_SAFE (Success):** Validation passes. System renders in clean native colors (Green/Neutral primary). Action/Export buttons fully enabled.
6. **WARNING:** User inputs technically valid but outside standard ranges `[WARN-UI-001]`. Field borders turn **Yellow/Orange** and display a warning icon (e.g., `!`). Helper text inline. Does _not_ block execution.
7. **ERROR_CRITICAL:** Mathematical safety limit crossed (e.g., MTOM exceeded `[CRIT-MB-002]`). Active visualization elements turn **Red** and change their physical shape or use pattern-fills. Triggers a global flashing banner or overlay Modal with redundant text. Blocking transition to Export `[CRIT-UI-001]`.

---

## 3. Accessibility (a11y) Standards

### 3.1 ARIA Assertions for Safety

Safety-critical notifications must bypass visual reliance for screen readers:

- **Critical Breaches (e.g., Out of Bounds):** The global banner or modal must trigger `aria-live="assertive"` so screen reading technology announces the failure immediately and interrupts current flow.
- **Soft Warnings (e.g., Input Out of Range):** The field-level helper text must trigger `aria-live="polite"` to announce the warning without interrupting the active typing flow.

### 3.2 Night Operations (Dark Mode / Contrast)

<!-- @DES-UX-004@ (FROM: @REQ-UI-011@, @REQ-UI-012@) -->

- **Contrast Ratios:** The UI must support a togglable dark mode for night vision preservation. Both modes must meet **WCAG AAA** contrast styling, particularly for the Red (Unsafe) and Green (Safe) status highlights allowing instant parsing in extreme sun glare or pitch-black cockpit environments.
- **Keyboard Parity:** All steppers, complex field `[i]` tooltips, and export functions must be fully tabbable in logical descending order.

### 3.3 Color Independence

Color must never be the sole indicator of application state or physical safety.

- **Form Fields:** Warning or Error input fields must feature an explicit, bold icon (e.g., `!` or `X`) integrated into the input box or helper text, redundantly reinforcing the colored border.
- **Visualizations (Charts/Graphs):** Data elements conveying an unsafe state must alter their physical characteristics. For example, a boundary-violating chart point must change from a standard circle to an explicit `X` or Triangle. Erroneous bounding areas (polygons) must use a crosshatched pattern-fill, ensuring the breach is definitively readable by color-blind users or in monochrome environments.
  - **CG envelope chart mapping (`IMP-MB-UI-009`):** mass points render SAFE → circle, WARNING → triangle (▲), CRITICAL → cross (×); the CRITICAL envelope fill uses a dense crosshatch. Severity is never colour-only. Each severity's marker colour clears WCAG AAA (≥ 7:1) against the dark chart backdrop (`--color-surface-card`, `#252525`).

---

## 4. Error-Recovery Standards

In a safety-critical context, the UX must provide explicit escape hatches when systems fail or data becomes corrupted.

### 4.1 Fatal Error Boundaries (The "Crash Screen")

If a Vue component throws a fatal rendering error (e.g., expecting an array but receiving `undefined` from a corrupted store), the app must not "white screen."

- A global Error Boundary component must catch the exception.
- The UI shall present a high-contrast "Application Error" screen overriding the viewport.
- **Recovery Action:** A prominent "Restart Application" button that clears volatile Pinia memory and forces a `window.location.reload()`.

### 4.2 Graceful Degradation

<!-- @DES-UX-005@ (FROM: @REQ-SYS-001@, @REQ-SYS-010@) -->

- If a secondary API fails (e.g., Weather TAF timeout), the core app must continue functioning.
- **Recovery Action:** The specific API-driven UI block (e.g., Auto-Wind input) must default to unlocked manual input fields, allowing the pilot to read the wind from an external source and type it in manually without blocking the M&B calculations.

### 4.3 Explicit User Resets

- To prevent users from fighting complex, compounding validation errors, all major configuration forms must feature a "Clear All" or "Reset to Defaults" button explicitly visible in the UI layout to instantly zero out local state.

---

## 5. Design System Tokens & Foundations

To ensure a consistent UI experience and facilitate automated visual regression testing, AeroDash relies on a strict, centrally defined token system (CSS Variables).

### 5.1 Color System (Teal Primary)

The brand and primary action color is **Teal**, chosen for its high visibility and psychological association with clarity/calm in high-stress environments.

Implementation: `frontend/src/assets/theme.css`.

#### 5.1.1 Primitive Tokens (The Palette)

Primitives define raw hue/value steps. They are **never** used directly in component CSS — always through semantic tokens.

| Token | Hex | Usage context |
| --- | --- | --- |
| `--teal-50` | `#e0f2f1` | Light-mode primary backgrounds |
| `--teal-100` | `#b2dfdb` | Subtle tints |
| `--teal-200` | `#80cbc4` | Dark-mode hover states, selection |
| `--teal-300` | `#4db6ac` | Dark-mode primary (7.3:1 on #1e1e1e) |
| `--teal-400` | `#26a69a` | Dark-mode focus ring |
| `--teal-500` | `#009688` | Mid-range teal |
| `--teal-600` | `#00897b` | Light-mode focus ring |
| `--teal-700` | `#00796b` | Light-mode primary (4.85:1 on white) |
| `--teal-800` | `#00695c` | Light-mode primary hover (5.74:1) |
| `--teal-900` | `#004d40` | Deepest teal accent |

| Token | Hex | Usage context |
| --- | --- | --- |
| `--neutral-0` | `#ffffff` | White |
| `--neutral-50` | `#fafafa` | Page bg |
| `--neutral-100` | `#f5f5f5` | Alt surface |
| `--neutral-200` | `#eeeeee` | Grid lines |
| `--neutral-300` | `#e0e0e0` | Borders |
| `--neutral-400` | `#bdbdbd` | Axis lines |
| `--neutral-500` | `#9e9e9e` | Disabled |
| `--neutral-600` | `#757575` | Secondary txt |
| `--neutral-700` | `#616161` | Chart labels |
| `--neutral-800` | `#424242` | Body text |
| `--neutral-900` | `#212121` | Primary text |
| `--neutral-950` | `#121212` | Dark bg |

Status primitives: `--red-{50,200,600,700,900}`, `--amber-{50,200,600,700}`, `--green-{50,200,600,700}`.

#### 5.1.2 Semantic Tokens (The Application)

UI components must **exclusively** use semantic tokens. This allows seamless Dark Mode flipping and guarantees WCAG AAA contrast ratios. Tokens are defined under `:root` (light, default) and `[data-theme="dark"]`.

**Surfaces & Backgrounds:**

| Token | Light | Dark |
| --- | --- | --- |
| `--color-surface` | `#ffffff` | `#1e1e1e` |
| `--color-surface-alt` | `#f5f5f5` | `#2a2a2a` |
| `--color-surface-hover` | `#e0e0e0` | `#3a3a3a` |
| `--color-bg` | `#fafafa` | `#121212` |

**Brand / Primary Action:**

| Token | Light | Dark | Contrast |
| --- | --- | --- | --- |
| `--color-primary` | `--teal-700` | `--teal-300` | 4.85 / 7.3:1 |
| `--color-primary-hover` | `--teal-800` | `--teal-200` | 5.74 / 9.5:1 |
| `--color-primary-text` | white | `#121212` | matched |
| `--color-primary-bg` | `--teal-50` | `#0d302d` | subtle |

**Text Hierarchy:**

| Token | Light | Dark | Contrast on surface |
| --- | --- | --- | --- |
| `--color-text-primary` | `#212121` | `#e8e8e8` | 16.1 / 13.5:1 |
| `--color-text-secondary` | `#757575` | `#a0a0a0` | 4.6 / 6.2:1 |
| `--color-text` | `#424242` | `#d0d0d0` | 10.4 / 10.6:1 |

**Borders & Focus:**

| Token | Light | Dark |
| --- | --- | --- |
| `--color-border` | `#e0e0e0` | `#3a3a3a` |
| `--color-focus` | teal-600 | teal-400 |

**Status — each pair background + foreground:**

| Semantic | Light fg / bg | Dark fg / bg |
| --- | --- | --- |
| Success | `#388e3c` / `#e8f5e9` | `#a5d6a7` / `#1b2e1b` |
| Warning | `#ef6c00` / `#fff3e0` | `#ffcc80` / `#332200` |
| Critical | `#c62828` / `#ffebee` | `#ef9a9a` / `#2e1515` |

All status pairs maintain ≥ 4.5:1 contrast. Color is **never** the sole indicator of state — icons and shape changes are mandatory (see §3.3).

**Chart Tokens:** `--chart-grid`, `--chart-axis`, `--chart-tick-text`, `--chart-label` — see `theme.css` for exact values per theme.

#### 5.1.3 Logo & Favicon

- **Source SVG:** `frontend/public/favicon.svg` — teal circle (`#00796b`) with white compass/arrow motif.
- **ICO fallback:** `frontend/public/favicon.ico` — 32 × 32 pixel legacy format.
- **Inline SVG logo:** rendered in `App.vue` header using `currentColor` so it inherits `--color-primary` in both themes.
- PWA manifest icons: to be added when `vite-plugin-pwa` is integrated per ADR-310.

### 5.2 Typography

Typography must prioritize legibility (at varying viewing angles and distances) over stylistic flair.

- **Font Family:** `Inter`, `Roboto`, or system-sans-serif. Explicitly non-serif.
- **Tabular Numerals:** All numeric outputs (weights, CG, fuel) must use `font-variant-numeric: tabular-nums;` to prevent layout jitter during real-time recalculations.
- **Scale:**
  - `--text-xs`: 0.75rem (Helper text, explicit units)
  - `--text-sm`: 0.875rem (Secondary labels)
  - `--text-base`: 1rem (Standard input text, body)
  - `--text-lg`: 1.125rem (Card Headers)
  - `--text-2xl`: 1.5rem (Critical Summaries, TOM, ZFM)

### 5.3 Spacing System

A consistent 4px (0.25rem) base scale ensures rhythm and touch-target compliance.

- `--space-1`: 0.25rem (4px)
- `--space-2`: 0.5rem (8px - minimal padding)
- `--space-4`: 1rem (16px - standard padding/gap)
- `--space-6`: 1.5rem (24px - card padding)
- `--space-8`: 2rem (32px - section spacing)

### 5.4 Motion & Animation Principles

<!-- @DES-UX-006@ (FROM: @REQ-UI-009@, @REQ-MB-003@) -->

Motion is strictly functional. It must draw attention to state changes without causing motion sickness or introducing perceptible delay.

- **Duration Constraints:** Maximum `200ms` for all UI transitions (modals, color fades, hover states).
- **Easing:** Real-world physics (`ease-out` for entering elements, `ease-in` for exiting).
- **Prohibited:** Indeterminate spinners blocking synchronous math. Lengthy layout animations that shift interactive touch-targets while the user is actively attempting to tap them.

### 5.5 Shadow Tokens

Elevation is expressed through a five-step shadow scale. Dark mode shadows are deeper and more dramatic to compensate for the lower ambient contrast.

| Token | Use case |
| --- | --- |
| `--shadow-xs` | Subtle card lift, sticky header |
| `--shadow-sm` | Standard module cards, nav items |
| `--shadow-md` | Raised dialogs, CTA buttons |
| `--shadow-lg` | Floating overlays, mobile bottom nav |
| `--shadow-xl` | Full-screen modals |

In dark mode an additional `--glow-primary` token (`0 0 24px rgba(77,182,172,0.18)`) is available for active elements to provide a teal ambient glow. It evaluates to `none` in light mode.

### 5.6 Border Radius Tokens

| Token | Value | Use case |
| --- | --- | --- |
| `--radius-sm` | `0.25rem` | Tight badges, tags |
| `--radius-md` | `0.5rem` | Input fields, small buttons |
| `--radius-lg` | `0.75rem` | Standard buttons, nav items, icon containers |
| `--radius-xl` | `1rem` | Module cards, prep cards |
| `--radius-2xl` | `1.5rem` | Hero sections |
| `--radius-full` | `9999px` | Pills, step badges, avatar circles |

### 5.7 Navigation Dimension Tokens

Fixed dimensions for the app shell layout. Set on `:root` only — they do not change between themes.

| Token | Value | Purpose |
| --- | --- | --- |
| `--nav-sidebar-width` | `220px` | Expanded desktop sidebar width |
| `--nav-sidebar-collapsed` | `64px` | Collapsed/icon-only sidebar width |
| `--nav-header-height` | `56px` | Fixed top header height |
| `--nav-bottom-height` | `56px` | Mobile bottom tab bar height |

### 5.8 Transition Tokens

| Token | Value | Use case |
| --- | --- | --- |
| `--transition-fast` | `0.1s ease-out` | Hover colour/border changes |
| `--transition-normal` | `0.2s ease-out` | Sidebar collapse, panel open/close |
| `--transition-slow` | `0.3s ease-out` | Prep card unlock animation |

### 5.9 Additional Surface & Nav Color Tokens

These tokens extend the core surface set and are required by the navigation shell.

**Light / Dark:**

| Token | Purpose |
| --- | --- |
| `--color-surface-card` | Card and prep-card backgrounds |
| `--color-surface-sunken` | Recessed areas (e.g., locked section placeholder) |
| `--color-surface-raised` | Elevated panels |
| `--color-divider` | Horizontal rules, sidebar borders |
| `--color-nav-bg` | Header and sidebar background |
| `--color-nav-active-bg` | Active nav item background tint |
| `--color-nav-active-text` | Active nav item label/icon color |
| `--color-nav-text` | Default nav item label/icon color |
| `--color-tag-soon-bg` | "Soon" pill background |
| `--color-tag-soon-text` | "Soon" pill label color |

---

## 6. Navigation Shell

<!-- @DES-UX-007@ (FROM: @REQ-UI-011@, @REQ-SYS-001@) -->

### 6.1 App Shell Layout

The app shell uses a CSS Grid layout with two primary breakpoints.

**Desktop (≥ 768 px):** Three-area grid — fixed header spanning full width, left sidebar, and main content area.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  header (56 px, sticky, z-index 200)                                        │
├──────────────────┬──────────────────────────────────────────────────────────┤
│  sidebar         │  main content (RouterView)                               │
│  (220 px / 64px) │                                                          │
│  sticky, scrolls │                                                          │
└──────────────────┴──────────────────────────────────────────────────────────┘
```

**Mobile (< 768 px):** Single-column grid — header, main content (full width), and a fixed bottom tab bar.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  header (56 px, sticky)                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  main content (RouterView)                                                  │
│  (padding-bottom = nav-bottom-height to clear the tab bar)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  bottom tab bar (56 px, fixed, z-index 200)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Desktop Sidebar

- **Width:** `--nav-sidebar-width` (220 px) expanded; `--nav-sidebar-collapsed` (64 px) when collapsed.
- **Collapse trigger:** Hamburger button in the header. State held in a local `ref` — no Pinia store required.
- **Collapsed state:** Labels and "Soon" badges are hidden; icon-only layout. The logo in the header switches to icon-only mode via `:icon-only="sidebarCollapsed"`.
- **Narrow desktop (768–1023 px):** Sidebar auto-collapses to 64 px regardless of toggle state.
- **Background:** `--color-nav-bg`; right border `--color-divider`.
- **Position:** `sticky`, top = `--nav-header-height`, height = `calc(100vh - --nav-header-height)`.

### 6.3 Mobile Bottom Tab Bar

- Shows the first four nav items (Home, Flight Prep, Fleet, Weather).
- `display: none` on desktop; `display: block` on `< 768 px` via `position: fixed`.
- Each tab: icon (22 px) stacked above a micro-label (uppercase, `0.625rem`).
- Active state uses `--color-nav-active-text`; disabled/soon items drop to `0.4` opacity.

### 6.4 Nav Item States

| State | Visual treatment |
| --- | --- |
| Default | `--color-nav-text`, no background |
| Hover (active links only) | `--color-surface-hover` background, `--color-text-primary` text |
| Active (current route) | `--color-nav-active-bg` background, `--color-nav-active-text` text, `font-weight: 600`, dark-mode glow |
| Soon / disabled | `opacity: 0.5` (sidebar), `opacity: 0.4` (bottom tab); rendered as `<span>`, not `<RouterLink>`; `aria-disabled="true"` |

### 6.5 AppLogo Component

`frontend/src/shared/components/AppLogo.vue` — tagged `@IMP-UI-SHARED-001@`.

Accepts two props:

- `iconOnly: boolean` — when `true`, hides the wordmark (used in collapsed sidebar header).
- `size: number` — icon mark size in px (default `32`).

The SVG mark is a stylised "A" letterform with an aircraft silhouette and a runway sweep curve replacing the traditional crossbar. It renders with `currentColor` so it inherits `--color-primary` in both themes.

The wordmark splits into two `<span>` elements: `.app-logo__word-aero` (primary color) and `.app-logo__word-dash` (secondary text color).

---

## 7. HomeView Layout Pattern

<!-- @DES-UX-008@ (FROM: @REQ-UI-011@, @REQ-SYS-001@) -->

`frontend/src/views/HomeView.vue` — tagged `@IMP-UI-VIEW-001@`.

The dashboard home page is structured as three vertically stacked sections with a `max-width: 900px` centered container.

### 7.1 Hero Section

- Card with `--radius-2xl` and a radial gradient accent in the top-left corner (`--color-primary-bg`).
- Contains: time-of-day greeting (computed from `new Date().getHours()`), headline "Ready for departure?", and guiding principle sub-text.
- Primary CTA button linking to `/mass-balance` ("Start Flight Preparation"), minimum height 44 px, labeled for screen readers.
- Advisory disclaimer rendered below the CTA in a warning-tinted `<p role="note">`.

### 7.2 Active Modules Grid

- `auto-fill` CSS grid, minimum column width 260 px.
- Each active module renders as a `<RouterLink>` module card with: icon container (44 × 44 px, teal background), title, description, and a chevron arrow.
- Hover: border turns `--color-primary`, card lifts `2px`, glow applied in dark mode.

### 7.3 Coming Soon Modules Grid

- Same grid layout but cards are rendered as `<div>` (not links), `border-style: dashed`, `opacity: 0.55`.
- A "Soon" pill (`.soon-pill`) replaces the chevron arrow.
- Module list: Performance, Weather, Fuel & Endurance, Fleet Management, Airport Database.

### 7.4 Mobile Adaptations

Below 768 px the hero collapses to a single column (logo and copy stack vertically), and all grids become single-column. Padding reduces from `--space-8 --space-6` to `--space-4`.

---

## 8. Prep Card Pattern

<!-- @DES-UX-009@ (FROM: @REQ-UI-011@, @REQ-MB-003@) -->

The Flight Preparation view (`MassBalanceView.vue`) introduces the **prep card** as a reusable UI pattern for presenting numbered workflow steps.

### 8.1 Anatomy

Each prep card is a `<section>` with:

| Element | Class | Purpose |
| --- | --- | --- |
| Step badge | `.prep-card__badge` | Circular pill with two-digit step number (01–05) |
| Title | `.prep-card__title` | Section name |
| Status badge | `.state-badge` / `.locked-badge` / `.soon-pill` | Contextual state indicator |
| Body | varies | Section-specific content |

### 8.2 Card States

| State | Visual treatment | When applied |
| --- | --- | --- |
| Active (aircraft card) | `border-left: 3px solid --color-primary` | Always (section 01) |
| Unlocked M&B | `border-left: 3px solid --color-primary` | Aircraft selected |
| Locked M&B | `border-left: 3px solid --color-border`, `opacity: 0.7`, lock overlay | No aircraft selected |
| Coming soon | `border-style: dashed`, `opacity: 0.5` | Sections 03–05 |

### 8.3 Lock / Unlock Transition

When the user selects an aircraft:

1. Store state transitions `INITIAL → LOADING → UNCONFIGURED`.
2. `viewModel.mbLocked` becomes `false`.
3. The locked overlay (`v-if="viewModel.mbLocked"`) is removed and M&B inputs mount.
4. The border color transitions from `--color-border` to `--color-primary` via `transition: border-color --transition-normal`.

The step badge color distinguishes active steps (teal badge, `--color-primary-bg` / `--color-primary`) from coming-soon steps (muted badge, `--color-tag-soon-bg` / `--color-tag-soon-text`).

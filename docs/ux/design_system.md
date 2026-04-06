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

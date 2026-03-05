# AeroDash Design System (UX/UI Framework)

This document establishes the global usability, accessibility, and interaction rules that govern all AeroDash modules, fulfilling the requirements specified in `docs/requirements/usability_quality.md`.

---

## 1. Usability & Quality (UQ) Constants

### 1.1 Input Ergonomics (REQ-UQ-001, REQ-UQ-005)

AeroDash operates natively in cockpit environments. Inputs must be frictionless:

- **Touch Targets:** Minimum `44x44px` for all interactive elements (steppers, buttons, sliders).
- **Explicit Units:** Every input field must definitively display its active unit statically adjacent to the number (e.g., `kg`, `L`, `km/h`).
- **Precision (REQ-UQ-003):** Data fields auto-format to a decimal precision appropriate to the active unit, ensuring a physical resolution of at least 1mm for lengths and 0.1 units for mass/volume. Standard precisions: `m`=3, `cm`=1, `mm`=0, `in`=2, `kg`/`lb`/`L`/`gal`=1.

### 1.2 Layout Responsiveness (REQ-UQ-002)

- **Mobile/Cockpit Tablet (Max-width: 768px):** Single-column stacked layout. Navigation and critical alert banners top, scrolling configuration inputs middle, interactive visualization (e.g. Charts) bottom. Go/No-Go Summaries must be sticky at the viewport bottom.
- **Desktop/Planning Station (Min-width: 769px):** Split-pane layout. Left pane (40%) contains scrolling inputs. Right pane (60%) is a fixed position staging ground for charts and results.

---

## 2. Interaction State Taxonomy

Component states strictly map to the Reactivity State Machine defined in [`docs/architecture/frontend_state_machine.md`](../architecture/frontend_state_machine.md) and the centralized Notification Schema (`REQ-SYS-007`).

1. **INITIAL:** Module mounted, no data context loaded. Inputs disabled. Connectivity indicator (Online/Offline) visible.
2. **LOADING:** Fetching aircraft profiles or performing async setup. Prevents race conditions.
3. **UNCONFIGURED:** Profile loaded but mandatory fields are still missing or untouched. Inputs enabled; math core may run on partial data. Export/Save **blocked**.
4. **UNVERIFIED:** All mandatory fields have values but the user has not yet confirmed them. Safety math runs on complete data. Export/Save gated behind a confirmation modal (`REQ-UI-015`).
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

- **Contrast Ratios:** The UI must support a togglable dark mode (`REQ-UI-011`) for night vision preservation. Both modes must meet **WCAG AAA** contrast styling, particularly for the Red (Unsafe) and Green (Safe) status highlights allowing instant parsing in extreme sun glare or pitch-black cockpit environments.
- **Keyboard Parity:** All steppers, complex field `[i]` tooltips (`REQ-UI-012`), and export functions must be fully tabbable in logical descending order.

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

- If a secondary API fails (e.g., Weather TAF timeout), the core app must continue functioning `[REQ-SYS-001, REQ-SYS-010]`.
- **Recovery Action:** The specific API-driven UI block (e.g., Auto-Wind input) must default to unlocked manual input fields, allowing the pilot to read the wind from an external source and type it in manually without blocking the M&B calculations.

### 4.3 Explicit User Resets

- To prevent users from fighting complex, compounding validation errors, all major configuration forms must feature a "Clear All" or "Reset to Defaults" button explicitly visible in the UI layout to instantly zero out local state.

---

## 5. Design System Tokens & Foundations

To ensure a consistent UI experience and facilitate automated visual regression testing, AeroDash relies on a strict, centrally defined token system (CSS Variables).

### 5.1 Color System (Teal Primary)

The brand and primary action color is **Teal**, chosen for its high visibility and psychological association with clarity/calm in high-stress environments.

**Primitive Tokens (The Palette):**

- `--color-teal-500`: `#14b8a6` (Primary Light/Dark)
- `--color-teal-600`: `#0d9488` (Hover/Active)
- `--color-slate-900`: `#0f172a` (App Background Dark Mode)
- `--color-slate-50`: `#f8fafc` (App Background Light Mode)
- `--color-red-500`: `#ef4444` (Critical)
- `--color-amber-500`: `#f59e0b` (Warning)
- `--color-emerald-500`: `#10b981` (Safe/Success)

**Semantic Tokens (The Application):**
UI components must exclusively use semantic tokens. This allows seamless Dark Mode flipping and guarantees WCAG AAA contrast ratios.

- `--text-primary`: Pure White (`#ffffff`) in Dark Mode, Slate-900 in Light Mode.
- `--text-muted`: Slate-400 in Dark, Slate-500 in Light.
- `--bg-surface`: Slate-800 in Dark Mode, White (`#ffffff`) in Light Mode (Cards/Modals).
- `--color-status-critical`: Mapped to `--color-red-500`.
- `--color-status-warning`: Mapped to `--color-amber-500`.
- `--color-status-safe`: Mapped to `--color-emerald-500`.
- `--color-action-primary`: Mapped to `--color-teal-500`.

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

Motion is strictly functional. It must draw attention to state changes without causing motion sickness or introducing perceptible delay (`REQ-UI-009`).

- **Duration Constraints:** Maximum `200ms` for all UI transitions (modals, color fades, hover states).
- **Easing:** Real-world physics (`ease-out` for entering elements, `ease-in` for exiting).
- **Prohibited:** Indeterminate spinners blocking synchronous math `[REQ-MB-003]`. Lengthy layout animations that shift interactive touch-targets while the user is actively attempting to tap them.

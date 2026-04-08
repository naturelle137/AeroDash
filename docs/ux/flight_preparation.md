# Flight Preparation Page — UX Pattern

This document describes the unified Flight Preparation page (`MassBalanceView.vue`),
its numbered prep-card section pattern, the aircraft-selection → M&B unlock flow, and
the mapping between UI state machine states and visual presentation.

See also: [`design_system.md §8`](design_system.md) for the prep card anatomy and
[`ADR-005`](../architecture/adr/005-flight-prep-unified-view.md) for the decision
record.

---

## 1. Concept: Numbered Section Progression

The Flight Preparation page presents a pilot's pre-flight workflow as a series of
numbered sections (01–05). Each section corresponds to a domain module:

| Step | Label | Module | Status |
| --- | --- | --- | --- |
| 01 | Aircraft | Aircraft Management | Active |
| 02 | Mass & Balance | Mass & Balance | Active |
| 03 | Performance | Performance | Coming soon |
| 04 | Weather | Weather | Coming soon |
| 05 | Fuel & Endurance | Fuel & Endurance | Coming soon |

The numbering is a **visual roadmap**, not a strict wizard. A pilot who only needs
Mass & Balance can use section 02 without any obligation to visit sections 03–05.
Coming-soon sections are rendered at reduced opacity (`0.5`) with dashed borders to
indicate they are not yet interactive.

This pattern was introduced because the previous design had a single, standalone M&B
view with no context for how additional modules would integrate. The numbered sections
give pilots an immediate mental model of the complete pre-flight workflow.

---

## 2. Aircraft Selection → M&B Unlock Flow

### 2.1 Flow Description

1. The page mounts with `store.uiState = 'INITIAL'`.
2. Section 01 (Aircraft) is always visible and interactive. The pilot selects an
   aircraft from the catalogue dropdown.
3. `onAircraftSelected` is called: the selected profile is validated against
   `AircraftContextSchema` (Zod). If validation fails, an inline `ERROR_CRITICAL`
   alert is shown inside section 01. If it passes, `store.loadProfile(profile)` is
   called.
4. The store transitions `INITIAL → LOADING → UNCONFIGURED`.
5. `viewModel.mbLocked` becomes `false` (it is `true` while state is `INITIAL` or
   `LOADING`).
6. Section 02 (M&B) removes its locked overlay and mounts the station input fields and
   CG envelope chart.

### 2.2 Visual Transition

| Step | Section 02 appearance |
| --- | --- |
| No aircraft selected (`INITIAL`) | `border-left: 3px solid --color-border`, `opacity: 0.7`, padlock icon overlay |
| Loading profile | Padlock overlay still shown; loading spinner inside section 01 |
| Aircraft loaded (`UNCONFIGURED`) | `border-left: 3px solid --color-primary`, full M&B UI mounts |

The border-color transition uses `transition: border-color var(--transition-normal)` —
a 200 ms ease-out — to animate the colour change without layout shift.

### 2.3 Error Handling

If the selected aircraft profile fails Zod validation, an inline `role="alert"` error
banner appears inside section 01. The store state remains `INITIAL`; section 02 stays
locked. The pilot can select a different aircraft to retry.

---

## 3. Section 01 — Aircraft

Always visible. Contains:

- **Aircraft select dropdown:** Lists all aircraft in `AIRCRAFT_CATALOGUE`.
- **Category dropdown:** Shown only when the selected aircraft has more than one
  certification category. Disabled while `viewModel.inputsDisabled` is true.
- **Selected aircraft label:** Displayed in the section 01 header once an aircraft is
  loaded (`registration — manufacturer model`), styled with `--color-primary`.
- **Loading spinner:** `aria-busy="true"` row shown during profile load.

---

## 4. Section 02 — Mass & Balance

Locked until an aircraft is loaded (see §2). Once unlocked:

### 4.1 Header State Badge

The section header displays a contextual badge derived from `viewModel.bannerSeverity`:

| Badge | Condition | Visual |
| --- | --- | --- |
| Padlock + "Select aircraft to unlock" | `mbLocked = true` | Muted icon + text |
| `VERIFIED SAFE` | `state = VERIFIED_SAFE` | Green pill |
| `WARNING` | `state = WARNING` | Amber pill |
| `CRITICAL` | `state = ERROR_CRITICAL` | Red pill |
| (none) | `UNCONFIGURED` / `UNVERIFIED` | No badge |

### 4.2 Status Banner

A full-width alert banner appears when `bannerSeverity` is non-null. It renders all
active store notifications as individual lines. The `role="alert"` attribute is always
set; `aria-live="assertive"` is used for `ERROR_CRITICAL` and `aria-live="polite"` for
other states.

### 4.3 Two-Column Desktop Layout

On viewports ≥ 900 px, the M&B content splits into:

- **Left (42%):** Station input list (`MassStationInput` components inside
  `InputGroupCard`), with a "Reset Payload" button below. The column is independently
  scrollable with `max-height: calc(100vh - 16rem)`.
- **Right (58%):** CG Envelope Chart + Result Summary, `position: sticky` to the
  header so it remains in view as the pilot scrolls through stations.

On narrower viewports the layout stacks vertically, with the Result Summary using
`position: sticky; bottom: var(--nav-bottom-height)` so it stays at the viewport
bottom above the mobile tab bar.

---

## 5. Sections 03–05 — Coming Soon Placeholders

Each placeholder section renders:

- A step badge in the "soon" colour (`--color-tag-soon-bg` / `--color-tag-soon-text`).
- A muted section title (`--color-text-secondary`).
- A "Coming soon" pill.
- A one-sentence description of the upcoming module's purpose.

These sections use `border-style: dashed` and `opacity: 0.5` to visually communicate
their non-interactive state. They are present in the DOM for landmark navigation but
carry no interactive controls. Screen readers see them as labelled `<section>` elements
(e.g., `aria-label="Performance — coming soon"`).

---

## 6. State Machine → UI Mapping

The `viewModel` computed property in `MassBalanceView.vue` is the **single source of
truth** for all rendering decisions. It maps the Pinia store `uiState` to presentational
flags. The full state machine is defined in
[`docs/architecture/frontend_state_machine.md`](../architecture/frontend_state_machine.md).

| `uiState` | `mbLocked` | `inputsDisabled` | `bannerSeverity` | `canExport` |
| --- | --- | --- | --- | --- |
| `INITIAL` | `true` | `true` | `null` | `false` |
| `LOADING` | `true` | `true` | `null` | `false` |
| `UNCONFIGURED` | `false` | `false` | `null` | `false` |
| `UNVERIFIED` | `false` | `false` | `null` | `false`\* |
| `VERIFIED_SAFE` | `false` | `false` | `success` | `true` |
| `WARNING` | `false` | `false` | `warning` | `true` |
| `ERROR_CRITICAL` | `false` | `false` | `critical` | `false` |

\* Export is blocked in `UNVERIFIED`; a confirmation modal is required
(`exportRequiresConfirmation: true`).

---

## 7. Operational Disclaimer

A non-blocking advisory notice is rendered at the bottom of the page (`role="note"`):

> **Advisory only** — verify all results against the official POH/AFM before flight.
> This tool is not a certified aviation device.

It uses `--color-warning-bg` and `--color-warning` border to draw attention without
triggering the `ERROR_CRITICAL` visual treatment. It is always visible, regardless of
state, to reinforce that AeroDash is an advisory tool only.

---

## 8. Page Header

The top of the view renders a page title ("Flight Preparation") and a subtitle listing
the module sequence ("Mass & Balance · Performance · Weather · Fuel") as an orientation
aid. This is distinct from the app shell header and scrolls with the page content.

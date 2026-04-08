# ADR-005: Unified Flight Preparation View with Numbered Prep-Card Sections

- **Status:** Accepted
- **Date:** 2026-04-08

## Context

The original `MassBalanceView.vue` was a standalone page focused exclusively on Mass &
Balance calculations. It had no structural relationship to the other planned modules
(Performance, Weather, Fuel & Endurance). As a result:

- There was no visual workflow for pilots — the M&B form appeared in isolation with no
  indication of where it sat within the broader pre-flight sequence.
- It was unclear how future modules would integrate. Each new module could have become
  a wholly separate route with no shared context or ordering.
- The operational disclaimer was positioned at the top of the view, making it the first
  thing a pilot read rather than a persistent but non-blocking reminder.
- Aircraft selection was buried inside the M&B section rather than being a first-class
  step, creating confusion when the M&B section was locked.

The Interaction State Taxonomy in `docs/ux/design_system.md` already defined a
seven-state machine (`INITIAL → LOADING → UNCONFIGURED → UNVERIFIED → VERIFIED_SAFE /
WARNING / ERROR_CRITICAL`) but the view had no explicit way to communicate these states
at the section level.

## Considered Options

- **Option A — Keep isolated M&B view, add separate routes per module:** Each module
  ships as its own route (e.g., `/performance`, `/weather`). Pilots must navigate
  between routes manually to complete a full pre-flight. State is not shared across
  modules. No unified workflow is presented.

- **Option B — Single scrollable "mega-form" page:** All modules combined into one
  long form with no sectioning. Simple to implement but creates an overwhelming UI as
  modules are added; no progressive disclosure.

- **Option C — Numbered prep-card sections with progressive unlock:** The Flight
  Preparation route (`/mass-balance`) presents a sequence of numbered sections
  (01–05). Each section corresponds to a module. Active sections are fully interactive;
  coming-soon sections are rendered as low-opacity placeholders. Aircraft selection is
  promoted to its own first section (01) that gates the unlock of subsequent sections.

## Decision

We adopt **Option C**.

`MassBalanceView.vue` is restructured as a "Flight Preparation" page with five
`<section>` elements, each using the **prep card** pattern:

- A circular step badge (01–05) identifies the step.
- A section title identifies the module.
- A contextual status badge (locked, VERIFIED SAFE, WARNING, CRITICAL, Coming soon)
  reflects current state without requiring the pilot to scroll to find the result.
- Active sections have a `3px solid --color-primary` left border accent; locked
  sections use `--color-border`; coming-soon sections use a dashed border.

Aircraft selection is extracted from the M&B section body and elevated to **section
01**, always visible and always interactive. This makes it unambiguous that aircraft
selection is a prerequisite for the rest of the workflow.

Section 02 (Mass & Balance) is **locked** (`opacity: 0.7`, padlock overlay) until an
aircraft is loaded. A `viewModel.mbLocked` computed flag, derived from the Pinia store
`uiState`, governs this state. The transition from locked to unlocked is animated via
`transition: border-color var(--transition-normal)`.

Sections 03–05 are rendered as visible but non-interactive placeholders with
descriptive text explaining what each module will provide. They are marked with
`aria-label="… — coming soon"`.

The operational disclaimer is moved to the bottom of the page (`role="note"`) so it is
present but not the first content a pilot encounters.

The `viewModel` computed property on the view is the single source of truth for all
rendering decisions. Tests can set `store.uiState` to any value and snapshot
`viewModel` to verify correctness without mounting the full component tree.

References: `@REQ-UI-011@`, `@REQ-SYS-001@`, `@REQ-MB-003@`.

## Consequences

### Positive

- **Pilot mental model:** The numbered sections mirror the natural pre-flight
  workflow (aircraft → weight & balance → performance → weather → fuel), reducing
  cognitive load.
- **Progressive disclosure:** Sections only become interactive when prerequisites are
  met. This prevents pilots from attempting M&B calculations before an aircraft is
  loaded and receiving confusing empty-state errors.
- **Visible roadmap:** Coming-soon sections communicate the product direction directly
  in the primary UI, reducing the need for external release notes or onboarding
  materials.
- **Extensibility:** Promoting a coming-soon section to an active section requires
  removing the `soon` styling classes and connecting the section body — the structural
  scaffold is already in place.
- **Testable view model:** The `viewModel` computed property provides a single
  deterministic mapping of store state to presentational flags, enabling comprehensive
  unit tests without DOM interaction.

### Negative

- **Single long route:** The Flight Preparation page grows as modules are added.
  Depending on future module complexity, the view may need to be refactored into
  child route components or a tab-based layout.
- **URL does not reflect sub-section:** A pilot deep-linking to the Performance
  section (once active) will land at `/mass-balance`, not `/performance`. Future
  sub-routing or hash-based navigation may be needed.
- **Coming-soon placeholders require maintenance:** As each module ships, the
  placeholder must be replaced with the live section. The placeholders must be kept
  descriptively accurate to avoid misleading pilots.

## Compliance

The lock/unlock mechanism ensures that M&B calculations cannot run without a validated
aircraft profile (`AircraftContextSchema` Zod validation). This enforces the safety
gate defined in `REQ-MB-001` and `REQ-SYS-001` — no safety-core math executes on
unvalidated input. The disclaimer at page bottom reinforces the advisory-only nature
of the tool as required by operational guidance.

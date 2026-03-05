# Frontend Reactivity: State Machine

This document defines the strict state machine governing Vue component reactivity, specifically designed to prevent implicit state transitions, race conditions, and to explicitly bound test execution.

This state machine controls the taxonomy mapped into the UI layer (see `docs/ux/design_system.md`).

## 1. Global UI State Diagram

The following Mermaid diagram outlines the explicit allowed state transitions. Components must strictly enforce these transitions using explicit Pinia store actions, rejecting implicit `v-model` mutations that might bypass validation boundaries.

```mermaid
stateDiagram-v2
    [*] --> INITIAL : Component Mounted

    INITIAL --> LOADING : User selects Aircraft

    LOADING --> UNCONFIGURED : Profile fetched from Local DB (Success)
    LOADING --> INITIAL : Fetch failed (Local DB Error / Not Found)

    UNCONFIGURED --> UNCONFIGURED : User edits input (Mandatory fields still missing)
    UNCONFIGURED --> UNVERIFIED : All mandatory fields populated
    UNCONFIGURED --> WARNING : Soft bounds exceeded (Sync Recalculation)
    UNCONFIGURED --> ERROR_CRITICAL : Math limits crossed (Sync Recalculation)

    UNVERIFIED --> UNCONFIGURED : User clears a mandatory field
    UNVERIFIED --> VERIFIED_SAFE : All mandatory fields confirmed & valid
    UNVERIFIED --> WARNING : Soft bounds exceeded (Sync Recalculation)
    UNVERIFIED --> ERROR_CRITICAL : Math limits crossed (Sync Recalculation)

    VERIFIED_SAFE --> UNCONFIGURED : User clears a mandatory field
    VERIFIED_SAFE --> UNVERIFIED : User edits payload or category
    VERIFIED_SAFE --> WARNING : User edits to soft limits
    VERIFIED_SAFE --> ERROR_CRITICAL : User edits past math limits

    WARNING --> VERIFIED_SAFE : User corrects input
    WARNING --> ERROR_CRITICAL : User edits past math limits
    WARNING --> UNCONFIGURED : User clears a mandatory field
    WARNING --> UNVERIFIED : User resets input

    ERROR_CRITICAL --> WARNING : User partially corrects input
    ERROR_CRITICAL --> VERIFIED_SAFE : User fully corrects input
    ERROR_CRITICAL --> UNCONFIGURED : User clears a mandatory field
    ERROR_CRITICAL --> UNVERIFIED : User resets input

    VERIFIED_SAFE --> [*] : User triggers Export (Success)
```

<!-- @DES-ARCH-003@ (FROM: @REQ-SYS-001@) -->

## 2. State Definitions

### 2.1 INITIAL

- **Condition:** No context loaded. The tool is empty.
- **Reactivity Bound:** All calculation inputs (Weights, Volumes) are `disabled`. The Math Core is asleep.
- **Transitions out:** `LOAD_PROFILE` action dispatched.

### 2.2 LOADING

- **Condition:** Pending asynchronous IndexedDB/Local fetch for aircraft profile geometry. _Note: This is an offline-first app, so this fetch is local, not over the internet._
- **Reactivity Bound:** Input states intentionally "locked." Prevent duplicate clicks/race conditions during `await`.
- **Transitions out:** Promise resolved (`UNCONFIGURED`) or Promise rejected/timeout (`INITIAL` - e.g., corrupted local DB).

### 2.3 UNCONFIGURED

- **Condition:** Aircraft profile loaded, but one or more **mandatory fields** are still missing or untouched (e.g., fresh profile load with empty station weights, or user cleared a critical input).
- **Reactivity Bound:** Inputs are enabled. Math core may run on partial data to show preliminary chart positions, but results are explicitly marked incomplete. Export/Save actions are **blocked**.
- **Transitions out:** When all mandatory fields have values, the state transitions to `UNVERIFIED`. If bounds are exceeded during partial input, it transitions to `WARNING` or `ERROR_CRITICAL`. If the user edits an input but mandatory fields remain empty, the state loops back to `UNCONFIGURED`.

### 2.4 UNVERIFIED

<!-- @DES-ARCH-004@ (FROM: @REQ-UI-015@) -->

- **Condition:** All mandatory fields have values, but the user has **not yet confirmed** them (e.g., they just opened an old configuration and must review it, or they filled in the last required field but haven't explicitly acknowledged the data).
- **Reactivity Bound:** Inputs are enabled. Math core actively calculates with complete data, and the chart reflects the full calculation. Export/Save actions are **gated** behind a confirmation modal.
- **Transitions out:** If the user confirms all fields, it transitions to `VERIFIED_SAFE`. If the user clears a mandatory field, it falls back to `UNCONFIGURED`. If bounds are exceeded, it transitions to `WARNING` or `ERROR_CRITICAL`.

### 2.5 VERIFIED_SAFE (Success)

- **Condition:** All mandatory fields have been explicitly "touched" or confirmed by the user, and the math core returns zero Warnings or Errors. Safety constraints (MTOM, MZFM if specified, Point-in-Polygon) are met.
- **Reactivity Bound:** Export Action unlocked. Chart visuals bound to `color: success`.

### 2.6 WARNING (Soft Violation)

- **Condition:** Math core computes correctly, but inputs are outside standard operational ranges (e.g., Passenger > 120kg `[WARN-UI-001]`).
- **Reactivity Bound:** Form submission allowed. Visuals bound to `color: warning`. Math logic execution continues.

### 2.7 ERROR_CRITICAL (Hard Violation)

- **Condition:** Math core throws a Critical Notification (`CRIT-MB-001` CG Out of Envelope, `CRIT-MB-002` MTOM Exceeded, `CRIT-MB-004` MZFM Exceeded). Aerodynamic or structural safety has failed.
- **Reactivity Bound:** Export Action locked (`disabled=true`). Chart and banner visuals forcibly bound to `color: error`.

---

## 3. Implementation Directives (Vue)

<!-- @DES-ARCH-005@ (FROM: @REQ-MB-001@, @REQ-MB-002@, @REQ-MB-003@, @REQ-UI-009@) -->

To ensure this state machine cannot be bypassed:

1. **Unidirectional Flow:** Vue components shall not edit the calculation store directly via two-way `v-model`.
2. **Synchronous Real-Time Execution:** When a component dispatches an action (e.g. `updateStationWeight`, `changeCategory`), the store must pause state evaluation, run the `core/math` algorithms synchronously, catch the Notification Schema result, and **then** update the formal State Machine pointer in a single reactive tick to ensure real-time chart updates without visual tearing.
3. **Deterministic Testing:** Tests must specifically target hitting each state boundary and transition matrix path defined in the flowchart.

---

## 4. Error-Recovery Strategies

The state machine must account for systemic failures outside of standard operational warnings.

### 4.1 Corrupted Local Database (`LOADING --> INITIAL`)

- **Failure:** The IndexedDB fetch for the aircraft profile fails or returns malformed schema data.
- **Recovery:** The state reverts to `INITIAL`. The system displays a Local Data Error notification and provides a UI action to "Restore Default Profiles" (wiping and reseeding the local database from bundled JSON).

### 4.2 Unhandled Math Exceptions

- **Failure:** The `core/math` algorithms throw an unhandled exception (e.g., `NaN` proliferation due to a corrupted data pointer).
- **Recovery:** The component utilizes Vue's `onErrorCaptured` lifecycle hook (or a global ErrorBoundary wrapper). The error is swallowed, the specific module state is forcefully purged back to `INITIAL`, and a CRITICAL alert prompts the user to re-select the aircraft.

### 4.3 Safe Reset

- **Failure:** The user becomes "lost" in a complex error state (e.g., heavily overloaded and unable to trace which bag caused the CG shift).
- **Recovery:** The UI must always expose a "Clear Payload / Reset to Empty" action that instantly transitions the store from any state back to `UNCONFIGURED` (with empty station weights).

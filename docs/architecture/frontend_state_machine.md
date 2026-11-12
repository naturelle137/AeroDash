# Frontend calculation state

## 1. Data flow

Vue inputs call Pinia actions. The M&B store validates/adapts inputs, invokes pure core calculations, collects notifications, then evaluates the UI state. Numerical correctness belongs in core; the view renders the returned state and geometry.

## 2. State priority

`mass-balance.store.ts::evaluateState()` applies these rules in order:

| Condition | State |
| :--- | :--- |
| No aircraft or active category | `INITIAL` |
| Mandatory fields missing | `UNCONFIGURED` |
| Critical notification | `ERROR_CRITICAL` |
| Input-validation ERROR | `ERROR_CRITICAL` |
| Warning notification | `WARNING` |
| No remaining issue | `VERIFIED_SAFE` |

`LOADING` is a transitional state during profile loading. `UNVERIFIED` remains in the shared type for external-source modules but is not entered by current M&B station evaluation: pilot-entered masses do not require external-source verification. Profile provenance and its selection acknowledgement are separate from these calculation states. “VERIFIED_SAFE” is an internal UI label, not aircraft data certification or operational approval.

## 3. Input and recovery

Validation failure must prevent stale/invalid numbers from appearing as a current accepted calculation. Blank, negative and nonfinite occupant input cannot be sanitized into an empty seat. [Occupancy](optional-occupancy.md) defines legitimate optional-zero behavior.

Reset Payload preserves the selected aircraft and restores configured defaults/minima before recalculation. It need not produce an empty or UNCONFIGURED state. Aircraft switching clears the prior session. Fleet-load errors/timeouts offer retry or fleet-management actions; no automatic database wipe/reseed is implied.

## 4. Verification

Test state priority, invalid-input rejection, warning recovery, category changes, reset and restored sessions. Browser tests also cover fleet selection and acknowledgement. [Testing](../testing/TESTING.md) distinguishes executed evidence from future design goals. Broader error-boundary and API-fallback UX remains in the [design system](../ux/design_system.md).

# ADR-008: Canonical Lowercase Values for Aircraft Profile `status`

<!-- @DES-ARCH-010@ (FROM: @REQ-AC-005@, @H-011@) -->

- **Status:** Accepted
- **Date:** 2026-04-10

## Context

`AircraftProfile.status` implements the draft/verified finite-state machine (REQ-AC-005).
Early implementations used Title Case string literals (`Draft`, `Verified`) in Zod and
IndexedDB. Issue #157 specifies canonical stored values as lowercase (`draft`,
`verified`) for consistency with typical JSON enums and to align implementation with the
task specification.

Existing browsers may hold legacy documents with Title Case `status` fields.

## Decision

1. **Canonical runtime values:** `status` is exclusively `'draft' | 'verified'` after parse.
2. **Zod normalization:** `AircraftProfileSchema` and `AircraftContextSchema` accept legacy
   `Draft` / `Verified` inputs and transform them to lowercase on successful parse.
3. **IndexedDB migration:** Fleet database version is bumped from `1` to `2`. The
   `onupgradeneeded` handler rewrites legacy status strings and re-validates each record
   with `AircraftProfileSchema` before `cursor.update()`.
4. **Mass & Balance gate:** When `AircraftContext.status === 'draft'`, `_runCalculation()`
   prepends notification `WARN-AC-002` (persistent WARNING per notification register) before
   math results are mapped — satisfying the H-011 mitigation at the computation entry point.

## Consequences

### Positive

- Single canonical representation in memory and new writes.
- Backward compatibility for existing IndexedDB rows and exchange files.
- Clear contract for P2 modules (fleet UI labels may still show “Draft” / “Verified”).

### Negative

- One-time DB version bump and migration code path to maintain.
- Documentation and user-facing copy must distinguish display labels from stored literals.

## Compliance

Supports REQ-AC-005 and hazard H-011 (aircraft data integrity): unverified profiles remain
usable for planning while calculations surface an explicit WARNING.

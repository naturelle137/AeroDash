# 320: Explicit optional occupant occupancy

- **Status:** Accepted design; implementation acceptance remains independently gated.
- **Decision:** REQ-UQ-006, H-010, H-011.

## Context

Station kind cannot express whether an occupant station may be empty. Legacy
profiles lack occupancy metadata; inferring from names or seat order is unsafe.

## Decision

Add optional `occupancy: required | optional` metadata to profile and runtime
schemas. `requiresOccupancy` resolves occupant requirements independently of input
state. Omission preserves conservative required occupancy. Only exact numeric
zero exempts an explicitly optional seat from warning and confirmation; positive
mass retains existing safeguards, and invalid entry fails closed. The editor,
IndexedDB, JSON exchange and context mapper retain the field. No automatic name
migration occurs. Combined crew/passenger stations remain required aggregates.

The independent technical preimplementation review approved this contract and
required tests of runtime mapping, strict input/blur handling and persistence.
Detailed contract and test locations: [Configured occupancy](../optional-occupancy.md).

## Consequences

Catalogue/sample passenger positions receive explicit optional metadata; existing
user profiles keep conservative behaviour until edited. Configuration does not
certify legal crew requirements. No math, aircraft limit or performance data
changes. Independent final review, P1 coverage, CI and expected-head integration
remain required under ADR-319.

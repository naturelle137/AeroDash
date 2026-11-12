# Configured occupant occupancy

`LoadPointDefinition.occupancy` is an optional `required | optional` field,
independent of station kind and input touch/verification state. Missing metadata
preserves required-occupant behaviour; existing profiles require no migration.
The profile editor exposes Occupancy on seats. IndexedDB and JSON exchange retain
explicit choices; the fleet-to-M&B mapper forwards them. Names never determine
runtime occupancy, and old profiles are never automatically reclassified.

`requiresOccupancy` resolves only occupant stations. Required occupants at exact
numeric zero produce WARN-UQ-001. An explicitly optional occupant at numeric zero
is empty and needs no input or verification confirmation. Positive optional mass
retains the existing touch/verification contract; M&B still does not introduce
an UNVERIFIED transition. Obligations refresh on calculation, including reset
and session restoration. Baggage confirmation and fuel rules are unchanged.

M&B uses strict decimal entry: blank, incomplete, negative and nonfinite input
cannot become an accepted empty seat through sanitisation or blur clamping.
Invalid entry reaches the adapter as NaN and fails closed; explicit zero repairs
an empty optional seat. Configured quantities retain schema validation.

Catalogue/sample passenger-only rear seats are explicitly optional. Front-seat
and Pilot & Passenger aggregates stay required: one pilot's positive aggregate
mass suffices. This metadata is app configuration, not certification of crew
requirements. No station geometry, mass, performance value or limit is changed.

Validation: station resolver/schema unit tests; editor and exchange tests;
store obligation tests; `occupancy.int.spec.ts` with real input/store/adapter;
solo-loading Chromium scenarios with desktop/mobile screenshots. Execution
results belong in the PR; this list is coverage intent, not a pass claim.

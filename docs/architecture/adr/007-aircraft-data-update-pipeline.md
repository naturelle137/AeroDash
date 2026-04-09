# ADR-007: Aircraft Catalogue Data Update Pipeline

<!-- @DES-ARCH-008@ (FROM: @REQ-AC-001@, @REQ-AC-004@) -->

* **Status:** Accepted
* **Date:** 2026-04-09

## Context

AeroDash maintains a static `AIRCRAFT_MODEL_CATALOGUE` (manufacturer/model/ICAO
type designator) used by the `AircraftModelSelector` component. Aircraft profiles
stored in IndexedDB are **self-contained documents** — they do not hold a foreign
key reference to the catalogue. This design question is: what happens when the
catalogue is updated and a user has stored profiles derived from older catalogue data?

## Considered Options

* **Option 1: FK reference to catalogue:** Profiles store `catalogueId` pointing
  to the catalogue entry. On catalogue update, profiles auto-update. Risk: silent
  data mutation on safety-critical fields.
* **Option 2: Self-contained profiles (chosen):** The profile document contains
  manufacturer/model/ICAO at creation time. Catalogue updates do not touch stored
  profiles. A `WARN-CATALOGUE-001` notification alerts users that their profiles
  may reference outdated data.
* **Option 3: Versioned catalogue snapshots:** Each profile records the catalogue
  version it was derived from. Adds complexity without material safety benefit.

## Decision

Aircraft profiles are **self-contained documents**. There is no foreign key
relationship between a stored `AircraftProfile` and the static `AIRCRAFT_MODEL_CATALOGUE`.

When the catalogue is updated (new models added, ICAO designators corrected):

1. Existing stored profiles are **never auto-mutated** — preventing silent data
   corruption on safety-critical fields (registration, ICAO designator).
2. A `WARN-CATALOGUE-001` notification is emitted on the next app load when the
   catalogue version hash changes, informing the pilot that a catalogue update is
   available and profiles should be reviewed.
3. Pilots who wish to adopt the new data must: (a) set the profile to Draft,
   (b) update fields manually, (c) re-verify.

The static catalogue is embedded in the bundle. Catalogue updates are delivered
via a new application version (standard PWA update flow with service worker).

## Consequences

### Positive

* Profiles are immutable documents — catalogue updates cannot silently alter
  safety-critical baseline data.
* No FK complexity; profiles can be shared (imported/exported) without catalogue
  context.
* Simple implementation: no migration needed when catalogue changes.

### Negative

* Stale profiles are possible if the catalogue corrects a type designator error.
  Mitigated by the `WARN-CATALOGUE-001` notification prompting review.
* Catalogue cannot grow beyond bundle size limits (acceptable for GA fleet sizes).

## Compliance

This decision supports REQ-AC-005 (Draft/Verified FSM): any data change to a
profile — including adopting an updated catalogue value — requires explicit
pilot verification before the profile can be used in safety calculations.

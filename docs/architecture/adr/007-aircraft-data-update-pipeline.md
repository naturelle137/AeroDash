# ADR-007: Aircraft Catalogue Data Update Pipeline

* **Status:** Accepted
* **Date:** 2026-04-10

## Context

AeroDash maintains a static `AIRCRAFT_MODEL_CATALOGUE` (manufacturer/model/ICAO
type designator) used by the `AircraftModelSelector` component. Aircraft profiles
stored in IndexedDB are **self-contained documents** — they do not hold a foreign
key reference to the catalogue. This design question is: what happens when the
catalogue is updated and a user has stored profiles derived from older catalogue data?

## Decision

Aircraft profiles are **self-contained documents**. There is no foreign key
relationship between a stored `AircraftProfile` and the static
`AIRCRAFT_MODEL_CATALOGUE`.

When the catalogue is updated (new models added, ICAO designators corrected):

1. Existing stored profiles are **never auto-mutated** — preventing silent data
   corruption on safety-critical fields (registration, ICAO designator).
2. A `WARN-CATALOGUE-001` notification is emitted on the next app load when the
   catalogue version string changes, informing the pilot that a catalogue update
   is available and profiles should be reviewed.
3. Pilots who wish to adopt the new data must: (a) set the profile to Draft,
   (b) update fields manually, (c) re-verify.

The static catalogue is embedded in the bundle. Catalogue updates are delivered
via a new application version (standard PWA update flow with service worker).

## Current implementation and remaining work

`aircraft-model-catalogue.ts` exports `CATALOGUE_VERSION`. Source at the reset baseline has no consumer implementing the version-comparison/`WARN-CATALOGUE-001` flow above. That notification is design intent, not shipped behavior. Profiles remain self-contained; catalogue changes must not silently rewrite their safety data.

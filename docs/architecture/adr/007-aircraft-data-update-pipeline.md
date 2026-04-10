# ADR-007: Aircraft Catalogue Data Update Pipeline

<!-- @DES-ARCH-008@ (FROM: @REQ-AC-001@, @REQ-AC-004@) -->

* **Status:** Accepted
* **Date:** 2026-04-10

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

## Versioning Strategy

The catalogue exposes a `CATALOGUE_VERSION` constant (semver string, e.g.
`"1.0.0"`) in `aircraft-model-catalogue.ts`. This string:

* Is incremented on every catalogue change (new entries, corrections, removals)
  as part of the PR that modifies the catalogue.
* Is stored in `localStorage` under the key `aerodash.catalogueVersion` after
  the first app load with that version.
* On each subsequent app load the stored version is compared to
  `CATALOGUE_VERSION`. If they differ, `WARN-CATALOGUE-001` is emitted and the
  stored version is updated.

Version comparison is strict string equality — the version is treated as an
opaque label rather than a numeric range, ensuring no accidental skips.

## Update Path for Affected Profiles

When `WARN-CATALOGUE-001` fires, the notification message guides the pilot
through the following manual review path:

1. Navigate to the Fleet Management view.
2. Identify any profile whose `manufacturer`, `model`, or `icaoTypeDesignator`
   was corrected in the catalogue update (described in the app release notes).
3. Use `editVerifiedProfile()` to place the profile back into Draft state.
4. Update the affected fields manually using the `AircraftModelSelector`
   component, which will present the corrected catalogue values.
5. Re-verify the profile to return it to Verified state.

**No automated field patching is performed.** The pilot bears explicit
responsibility for reviewing and re-verifying any profile affected by a
catalogue correction, consistent with REQ-AC-005.

## Notification Mechanism for Affected Profiles

The notification is delivered via the AeroDash notification bus
(`useNotificationStore`) as a persistent `WARNING`-level notification:

| Notification Code | Trigger | Message |
| :---------------- | :------ | :------ |
| `WARN-CATALOGUE-001` | App load, stored version ≠ `CATALOGUE_VERSION` | "Aircraft catalogue updated. Review profiles that use updated manufacturer/model data and re-verify if needed." |

The notification persists until dismissed by the pilot. It is not re-emitted
until the next catalogue version change.

## Consequences

### Positive

* Profiles are immutable documents — catalogue updates cannot silently alter
  safety-critical baseline data.
* No FK complexity; profiles can be shared (imported/exported) without catalogue
  context.
* Simple implementation: no migration needed when catalogue changes.
* Version string in source makes catalogue changes visible in code review diffs.

### Negative

* Stale profiles are possible if the catalogue corrects a type designator error.
  Mitigated by the `WARN-CATALOGUE-001` notification prompting review.
* Catalogue cannot grow beyond bundle size limits (acceptable for GA fleet sizes).
* Pilots must manually re-verify affected profiles; no automated assistance.

## Compliance

This decision supports REQ-AC-005 (Draft/Verified FSM): any data change to a
profile — including adopting an updated catalogue value — requires explicit
pilot verification before the profile can be used in safety calculations.

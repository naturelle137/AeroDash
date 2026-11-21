# Manual runway entry

Performance includes an offline manual-runway form. The pilot copies declared
values from official sources (AIP/aerodrome chart, NOTAM); AeroDash consults no
airport database or online service and labels the entry **user-entered, not
airport-validated**.

The saved summary displays both declared date boundaries, including unknown
dates. The summary, Performance and briefing identify NOTAM/SUP coverage as unknown.

| Field | Contract |
| :--- | :--- |
| Aerodrome, runway designator | Required trimmed text, 1–40 and 1–20 characters, no control characters |
| TORA, LDA | Separate required decimal values, finite and > 0, each with explicit `m` or `ft`; optional TODA uses the same validation |
| Field elevation | Required finite decimal, zero/negative allowed, explicit `m` or `ft` |
| Surface | Required type (paved, grass/unpaved) and a condition from REQ-AP-004/REQ-AP-008 |

Fresh units follow the pilot's preferences; no surface, distance or elevation is inferred. Field
elevation is geometric and is never used as pressure altitude. The pilot may
explicitly copy it into the [QNH derivation](pressure-altitude.md); the stored
declaration is unchanged.

## Tiers

- P1 `core/logic/manual-runway.ts` validates the text draft, defines the strict
  Zod record, normalizes copies and recovers stored records.
- P2 `modules/airport` stores the record (`localStorage`
  `aerodash.performance.manual-runway.v1`), orchestrates edit/save/discard/clear
  in a Pinia store and renders `ManualRunwayPanel.vue` inside Performance.

## Storage and recovery

The record `{schemaVersion: 3, savedAt, runway}` keeps the pilot's original
values and units; normalized values are never persisted. Damaged JSON, any
contract violation or a higher `schemaVersion` is not used and is reported
visibly; saving or clearing replaces it. Write/clear failures are displayed and
the runway is not shown as saved. "Delete all local data" removes the key through
the shared `aerodash` prefix; afterwards the Privacy view re-reads the live runway
store from storage, so the same tab never keeps showing an erased runway as
saved/current, while a key that could not be removed stays visible next to the
"Erasure incomplete" alert.

The five most recently saved or selected aerodromes are stored locally as complete
manual declarations. Selecting one replaces the form after confirmation and retains
the original save time, source and declared dates. Recency does not verify currency.
Malformed history is ignored; local-data erasure removes it.

## Conversion and display

[NIST SP 811 Appendix B.9](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
defines 1 ft = 0.3048 m exactly (`FT_TO_M`). Each value converts independently.
Displayed available distances round **down** to 0.1 m (with a 1e-6 tolerance
for IEEE-754 artefacts); elevation rounds to the nearest 0.1. Arithmetic vectors
(not aerodrome data):

| Original | Displayed copy |
| :--- | :--- |
| 3280 ft | 999.7 m |
| 2000 ft | 609.6 m |
| 1000 ft | 304.8 m |
| −100 ft | −30.5 m |
| −30.48 m | −100.0 ft |

## Assessment boundary

The saved summary appears only while the form is valid and identical to the
saved record; any edit hides it immediately until save or discard. Performance
uses the saved surface only where an accepted source covers the aircraft and
condition. It compares corrected, factored distances with declared TORA or LDA;
when TODA is supplied, takeoff ground roll must also fit TORA. Missing inputs,
unsupported sources and storage errors block the comparison. Raw table values
remain unchanged. A comparison is not operational approval or a go/no-go decision.

## Save time and source currency

`savedAt` serializes the save date supplied by P2 (defaulting to the local clock).
The store's `current` state means valid saved values equal the current form;
it does not mean current source information. No external source is verified.
Publication and NOTAM coverage remain unknown; effective and expiry dates are optional pilot declarations.
Saving, re-saving, editing or offline recovery cannot establish source currency.
The existing Performance and briefing consumers retain manual provenance.

The [AIRAC/source contract](../regulatory/airac-airport-data-contract.md) defines
the future source prerequisite and separate currency/verification boundaries.
It does not infer expiry from AIRAC or the local save date.

## Declared date check

Optional pilot-entered effective and inclusive expiry dates are stored with the runway. The session-only check date defaults to the local date when the runway store is created and can be changed. Performance and briefing carry the same date and check, and a change invalidates the briefing snapshot. Missing dates leave currency unknown. Dates are user declarations, not source verification. A calendar cycle starts every 28 days from 2026-10-29 within the supported published calendar; this date-only indication does not expire a runway or establish NOTAM/SUP coverage. Version 1 and 2 records are recovered into version 3 in memory and remain usable. An optional pilot-declared source reference persists with the runway and appears in Performance and briefing; it is unverified and changes invalidate the saved display.

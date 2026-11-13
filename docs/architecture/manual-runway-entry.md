# Manual runway entry

Performance includes an offline manual-runway form. The pilot copies declared
values from official sources (AIP/aerodrome chart, NOTAM); AeroDash consults no
airport database or online service and labels the entry **user-entered, not
airport-validated**.

| Field | Contract |
| :--- | :--- |
| Aerodrome, runway designator | Required trimmed text, 1–40 and 1–20 characters, no control characters |
| TORA, LDA | Separate required decimal values, finite and > 0, each with explicit `m` or `ft` |
| Field elevation | Required finite decimal, zero/negative allowed, explicit `m` or `ft` |
| Surface | Required type (paved, grass/unpaved) and a condition from REQ-AP-004/REQ-AP-008 |

Nothing has a default: no unit, surface, distance or elevation is inferred. Field
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

The record `{schemaVersion: 1, savedAt, runway}` keeps the pilot's original
values and units; normalized values are never persisted. Damaged JSON, any
contract violation or a higher `schemaVersion` is not used and is reported
visibly; saving or clearing replaces it. Write/clear failures are displayed and
the runway is not shown as saved. "Delete all local data" removes the key through
the shared `aerodash` prefix; afterwards the Privacy view re-reads the live runway
store from storage, so the same tab never keeps showing an erased runway as
saved/current, while a key that could not be removed stays visible next to the
"Erasure incomplete" alert.

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
saved record; any edit hides it immediately until save or discard. The panel
always states that no runway assessment is available. No surface/slope/wind
correction, safety factor, margin or Go result is computed until source-backed
correction selection and operational factors exist. Raw POH table distances are
unchanged by runway entry.

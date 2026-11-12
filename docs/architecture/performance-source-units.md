# Performance source units

Each performance table optionally declares `sourceUnits` with **all four** keys:

```json
{"mass":"lb","pressureAltitude":"m","temperature":"°F","distance":"ft"}
```

Supported spellings are exactly mass `kg`/`lb`, pressure altitude `ft`/`m`,
temperature `°C`/`°F`, distance `m`/`ft`. Each axis is independent, including
between phases and from profile-level M&B `sourceUnit`. Optional `sourceReference`
is a preserved citation/conditions string (manual revision, section/page,
configuration). It is not evidence that AeroDash checked the manual.

Tables and points reject unknown fields; declarations on points, alternative
`units`/`sourceUnit` table keys, extra axes, partial declarations and unsupported
units fail validation visibly. Do not attach pre-normalized duplicate data to a
source table. The four numeric point fields always use that table's source units.

Schema/exchange version 2 protects source metadata from older readers. Imports
accept envelope v1/v2 and bare profiles, migrate v0/v1 on read, force Draft, remove
old verification and assign a new ID. IndexedDB migration stamps v2 without
changing points or inventing declarations. A table without `sourceUnits` keeps
the explicit legacy **kg / ft pressure altitude / °C / m distance** contract;
Fleet labels this absence. No unit is inferred from M&B.

The pure P1 adapter validates and normalizes a copy into kg/ft/°C/m. Fleet shows
both original and normalized points; P2 uses normalized copies for grid/envelope
validation. The P1 distance facade normalizes from source for every computation.
No normalized copy is persisted or fed back as source. Repeated evaluation and
reload therefore cannot double-convert. Nonfinite inputs/conversion results fail.
Verified snapshots remain immutable: edits create a Draft and remove sign-off;
imports of changed sources require review again. Performance clears results on
any selected-profile or lookup-input change. Direct database tampering is not
cryptographically detected by human verification.

## Definitions and reference cases

[NIST SP 811 Appendix B.9](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
and [B.8](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8)
define the international foot, avoirdupois pound and temperature relation:

- 1 ft = 0.3048 m exactly; altitude in m is divided by 0.3048 for ft.
- 1 lb = 0.45359237 kg exactly.
- °C = (°F − 32) / 1.8; temperature offsets are not scale-only conversions.

Independent arithmetic vectors (not aircraft performance data):

| Original mass / altitude / temperature / distance | Expected kg / ft / °C / m |
| :--- | :--- |
| 2000 lb / 304.8 m / 50 °F / 1000 ft | 907.18474 / 1000 / 10 / 304.8 |
| 1 lb / −30.48 m / −40 °F / 1 ft | 0.45359237 / −100 / −40 / 0.3048 |
| 100 lb / 0 m / 32 °F / 100 ft | 45.359237 / 0 / 0 / 30.48 |
| 100 lb / 609.6 m / 212 °F / 0 ft | 45.359237 / 2000 / 100 / 0 |

Zero distance is accepted by the storage adapter but blocked by the visible
positive-distance inspection workflow. IEEE-754 results are tested with numeric
tolerance; displayed source and normalized numbers are not rounded for lookup.
No survey feet, flight levels, atmospheric/QNH conversion, new aircraft values,
configuration inference, extrapolation or operational validation is provided.
The pilot must compare every table and result with the applicable POH/AFM.

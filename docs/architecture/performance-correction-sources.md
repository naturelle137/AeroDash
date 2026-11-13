# Performance correction source assessment

**Module:** Performance (P1 `core/logic/performance.correction-sources.ts`, P2 `CorrectionSourcePanel`)
**Status:** Partial. Source selection and unsupported reasons only; no correction value is applied.

## Purpose

Before any wind, surface or slope correction can enter the
[safety-factor pipeline](performance-safety-factor-pipeline.md), the pilot must see which source
would supply it and why that source applies. The resolver answers that question for the selected
Fleet profile, the saved manual runway and both operations. It never returns a factor or a corrected
distance; raw table inspection stays uncorrected.

## Contract

Input: profile facts (identity, ICAO type designator, highest certificated mass in kg, Verified,
four complete base tables, count of stored legacy surface factors), the saved and unchanged manual
runway (or none), and a register of inspected source candidates.

Output per correction (`wind`, `surface`, `slope`) and operation (`takeoff`, `landing`):

- the requirement the current pipeline imposes: aircraft POH/AFM preferred; one dimensionless
  multiplier; surface and slope act on the ground roll, wind on the whole distance;
- the pilot input AeroDash would still need (wind component, runway slope);
- every relevant candidate with its document identity, revision, section, origin and a list of
  discriminated `UnsupportedReason`s;
- `source-identified` only for a candidate with no reason at all, preferring an aircraft manual.

Rules:

- Missing or invalid base tables block the assessment. No source replaces aircraft distance tables.
- Draft profiles are blocked, as for raw lookup.
- A type-designator match only surfaces a candidate. Configuration (variant, engine, propeller,
  supplements, serial number) and current revision remain explicit gaps; there is no model-name match.
- Mass configuration must match the section (for example 630 kg basic versus 650 kg supplement).
- A missing table cell is `condition-not-covered`, never a unit factor. An AeroDash condition that
  maps to several source rows is `condition-mapping-ambiguous`.
- Generic guidance yields to an aircraft manual for the same correction and operation
  (`aircraft-source-precedence`). A generic surface uplift is refused on a manual whose base
  distances are already for grass (`baseline-conflict`), and otherwise needs the unknown POH
  baseline (`baseline-unknown`).
- Sources stating full distance over an obstacle cannot supply ground-roll corrections
  (`target-mismatch`). Additive metres-per-knot and lift-off-speed-relative wind rules cannot be
  expressed as one multiplier shared by roll and distance; they are unsupported contracts.
- Stored `surfaceConditions` factors carry no target, range, baseline or configuration evidence;
  they are reported as ignored.

The register is injectable so resolver behaviour can be tested with synthetic complete entries.

## Inspected sources (2026-11-13)

The register holds identity and contract shape only, no coefficients. Copies are kept privately; no
redistribution permission is claimed. Every entry carries at least one evidence gap.

| Source | Version, location | Status |
| :-- | :-- | :-- |
| Tecnam P2008 JC AFM, Doc. 2008/100 | Ed. 2 Rev. 7 (30 July 2020); Section 5 (630 kg) and Supplement S4 (650 kg) pp. 5W-7, 5W-15 | Candidate. Third-party mirror; currency and airframe configuration unverified. Grass baseline; additive wind; roll-only paved and slope rules. |
| LBA FSM 3/75 | 1 July 1975, 1995 reprint; Tables C.4, C.5 | Candidate. Authenticity unconfirmed; takeoff only; corrects distance over 15 m, not ground roll. |
| UK CAA Safety Sense 09 | August 2024; pp. 13, 15 | Candidate. UK guidance scope not accepted; distance indicators; tailwind and adverse slope only; missing cells. |

No other aircraft type has an inspected source. Reference arithmetic transcribed from these pages is
used in unit tests only to show contract shape (for example, that an additive tailwind gives different
implied multipliers for roll and distance). It validates no operational result.

## Invalidation

The displayed assessment belongs to one profile snapshot, runway draft and saved record, and lookup
input set. Any change, a runway clear, a reload or local-data erasure removes it. Nothing is persisted.

## Remaining work

Accepting a source needs current configuration evidence, a source-specific numeric contract (target,
order, range, baseline, additive wind) and reuse permission. Only then can corrections and the
operational composition be implemented.

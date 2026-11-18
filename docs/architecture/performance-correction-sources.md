# Performance correction source assessment

**Module:** Performance (P1 `core/logic/performance.correction-sources.ts`, P2 `CorrectionSourcePanel`)
**Status:** Partial. Source selection, unsupported reasons, one accepted source-specific rule set (Tecnam P2008 JC S9, D-EBPN) and its corrected distances in the Performance step with wind and slope input; the runway comparison and margins follow below.

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

## Accepted source: Tecnam P2008 JC Supplement S9, D-EBPN only

AFM Doc. 2008/100 Ed. 2 Rev. 18 (19 May 2026), S9 pages MT5-7 to MT5-9 (take-off, 650/600/550 kg) and MT5-14
(landing, 650 kg): MTV-34 propeller, Rotax 912 S2, 650 kg. Operator-supplied excerpt; serial number blank;
manufacturer-controlled copy not confirmed. Accepted for registration D-EBPN with a 650 kg profile whose mass
and CG limits match page MT6-9. No other airframe matches (`registration-not-covered`).

Rules live in `core/logic/performance.tecnam-s9-corrections.ts` (values in `TECNAM_S9_RULES`):

- Base distances: grass. Paved dry: -10% ground roll. Other surface conditions are unsupported.
- Wind: additive metres per knot on both distance rows; slope: percent of ground roll per percent.
- Applied conservatively: tailwind, uphill take-off slope and downhill landing slope only. Headwind and favourable
  slope are returned as not credited (the page states no range or order).
- Source in-service factor (take-off 1.10, landing 1.67) multiplies the corrected distances.
- Landing table exists for 650 kg only; lower masses use it unchanged.

Not accepted (evidence gaps remain): Tecnam Ed. 2 Rev. 7 Section 5/S4 mirror, LBA FSM 3/75, UK CAA Safety Sense 09.

## Invalidation

The displayed assessment belongs to one profile snapshot, runway draft and saved record, and lookup
input set. Any change, a runway clear, a reload or local-data erasure removes it. Nothing is persisted.

## Corrected distances in the Performance step

`services/corrected-distances.ts` composes the raw POH distance, the saved runway surface, the pilot's headwind
component (kt, negative tailwind) and runway slope (%, positive uphill) per operation, and calls the S9 rules.
A corrected distance appears only when wind, surface and slope are all identified from the S9 source for that
operation and both inputs are entered (empty is never zero; |slope| < 100). Otherwise the operation shows the reason
and only the uncorrected raw distance. Results are rounded up to whole metres, show raw, corrected and final values
with the source revision, and appear in the briefing pack. Any input change invalidates them with the raw result.

## Runway comparison

The final distance over 50 ft (after the source in-service factor, rounded up) is compared with the declared TORA
(take-off; no TODA is entered, so TORA is the conservative bound) or LDA (landing), both rounded down to 0.1 m.
Margin is `available - required` in metres and as `100 × margin / required` (REQ-PF-026). Insufficient length is
shown as an alert; sufficient length is a comparison, not an operational approval. The in-service factor is fixed by the
source, so no user-selected factor or low-factor warning applies.

## Remaining work

Any source needs configuration evidence, a source-specific numeric contract
and reuse permission.

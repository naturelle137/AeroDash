# Performance correction source assessment

**Module:** Performance (P1 `core/logic/performance.correction-sources.ts`, P2 `CorrectionSourcePanel`)
**Status:** Partial. Source selection, unsupported reasons, accepted source-specific rule sets (Tecnam P2008 JC basic, S4 and D-EBPN S9) and its corrected distances in the Performance step with wind and slope input; the runway comparison, TODA and the selectable safety factor follow below.

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
- The pilot selects the applicable P208 manual configuration for each profile session; unknown or other configurations have no supported source. Mass and the D-EBPN registration scope for S9 must also match.
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

The supplied Ed. 2 Rev. 7 basic pages 5-7 to 5-14 and S4 pages 5W-7 to 5W-15 state the same corrections and in-service factors as S9. UK CAA Safety Sense 09 remains unsupported; FSM 3/75 is an estimate only (see below).

## Invalidation

The displayed assessment belongs to one profile snapshot, runway draft and saved record, and lookup
input set. Any change, a runway clear, a reload or local-data erasure removes it. Nothing is persisted.

## Corrected distances in the Performance step

`services/corrected-distances.ts` composes the raw POH distance, the saved runway surface, the pilot's headwind
component (kt, negative tailwind) and runway slope (%, positive uphill) per operation, and calls the shared Tecnam rules.
A corrected distance appears only when wind, surface and slope are all identified from the same applicable Tecnam manual for that
operation and both inputs are entered (empty is never zero; |slope| < 100). Otherwise the operation shows the reason
and only the uncorrected raw distance. Unapplied nonzero wind and slope inputs, saved runway surface and safety factor are identified in the result and briefing pack; favourable Tecnam inputs make the result explicitly partially corrected. Without a manual rule set, the take-off surface and slope fall back to the marked FSM 3/75 estimate below; landing and tailwind stay uncorrected. Results are rounded up to whole metres, show raw, corrected and final values
with the source revision, and appear in the briefing pack. Any input change invalidates them with the raw result.

## Runway comparison

The final distance over 50 ft (corrected distance × the selected safety factor, rounded up) is compared with the
declared TODA when entered, otherwise TORA (take-off), or LDA (landing), all rounded down to 0.1 m. With a TODA
the final ground roll must also fit TORA. Margin is `available - required` in metres and as `100 × margin / required`
(REQ-PF-026). Insufficient length is shown as an alert; sufficient length is a comparison, not an operational approval.

## Safety factor selection

Per operation the pilot selects the factor applied to the corrected distances: the manual's in-service factor
(default, take-off 1.10, landing 1.67), EASA standard, short field or a custom value in 1.00-3.00
(`resolveOsf`). Below the greater of the manual factor and the regulatory baseline (take-off 1.25, landing 1.43)
the result carries an advisory WARN-PF-002 (`osfThreshold`); it never blocks. The manual's own take-off factor
1.10 is therefore below the 1.25 baseline and warns by default.

## FSM 3/75 estimate (REQ-PF-021)

The LBA text (1 July 1975, 1995 reprint, `111 3-985.1/75`) was read from a third-party mirror (segelfliegenausbildung.de); authenticity is unconfirmed. CEO directive 19 accepts the estimation method defined by REQ-PF-003/004/021, so the estimate is applied with visible `ESTIMATED (FSM 3/75)` marking. The source does **not** validate this use: it states take-off percentages for the whole distance to 15 m, not for the ground roll.

Used only when no aircraft manual rule set supplies the corrections (manual first). Implemented in `core/logic/performance.fsm-estimates.ts`; take-off only:

- **Slope:** +10 % of the ground roll per +1 % uphill.
- **Surface:** dry paved adds nothing; dry short grass adds +20 %, chained after slope. The source's dry-paved baseline is not credited, so a POH table already flown on grass is never shortened. The POH surface baseline is unknown and stated in the result.
- **Wind:** not corrected. The source gives no take-off headwind credit and no tailwind value; a tailwind input leaves the distances uncorrected.
- Slope and surface act on the ground roll only (REQ-PF-004); the airborne part is unchanged. No 15 m to 50 ft conversion is made.
- Downhill slope and headwind are not credited and make the result partially corrected. The source states no slope range; the input is applied as entered within the generic |slope| < 100 % validation.
- No manual in-service factor exists, so the safety factor defaults to the regulatory baseline (take-off 1.25).

Not estimated, with the existing unapplied-input disclosure kept: all landing corrections (the source has no landing table), tailwind, and surface conditions without one unambiguous source row (wet or soft ground, long grass, damaged turf, wet or contaminated paved, snow, ice).

Because the source percentages apply to the whole distance, applying them to the ground roll yields a smaller surcharge than the source text; the estimate is therefore a lower bound of the source's own reading and must not be read as conservative against it.

## Remaining work

Other aircraft manuals and landing corrections remain unsupported; they need a validated source. Further FSM rows (damp, soft, damaged turf, long grass, contaminated surfaces) need a rule for combining the chained percentages before they can be estimated.

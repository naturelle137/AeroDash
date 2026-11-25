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
The pilot must enter wind and slope (empty is never zero; |slope| < 100). Available corrections are applied independently; absent corrections are disclosed and make the result partial. When no correction source applies, the selected safety factor still applies to the base distances and the result identifies all missing corrections. Partial results cannot establish runway fit. Without a manual rule set, the take-off surface and slope may fall back to the marked FSM 3/75 estimate below; landing and tailwind remain uncorrected. Results are rounded up to whole metres and appear in the briefing pack. Any input change invalidates them with the raw result.

## Pilot-entered wind multiplier

For each operation the pilot may enter a positive whole-distance multiplier and a manual source and section for the current conditions. It replaces the selected wind correction and multiplies both the ground roll and the total distance after ground-only corrections. This supports only a manual multiplier that is applicable to both distances and compatible with the other corrections; differently ordered rules cannot be entered this way. Alternatively, the pilot may enter a signed additive correction in metres for both distances, applied at the same stage. Only one wind correction may be entered at a time. The source and applicability are unverified, so the result stays partial and cannot establish runway fit. Changes to aircraft, mass, atmosphere, runway, wind, slope or manual configuration clear the entry. Synthetic tests demonstrate wiring, not operational validation.

## Pilot-entered slope correction

A signed additive correction in metres may replace the takeoff or landing slope rule, as an alternative to the existing multiplier. It changes ground roll and total distance by the same amount, after built-in corrections and before pilot-entered wind and safety factors. When both pilot-entered ground corrections are present, the pilot selects surface then slope or slope then surface. A source and section are required; applicability and ordering are unverified. The result remains partial, and changes to conditions clear the entry. Synthetic tests demonstrate wiring only.

## Runway comparison

When a correction source is unavailable, independently identified manual corrections are applied, missing corrections are named, and the result is marked incomplete. The safety factor still applies; the incomplete result must not be used for runway assessment.

The final distance over 50 ft (corrected distance × the selected safety factor, rounded up) is compared with the
declared TODA when entered, otherwise TORA (take-off), or LDA (landing), all rounded down to 0.1 m. With a TODA
the final ground roll must also fit TORA. Margin is `available - required` in metres and as `100 × margin / required`
(REQ-PF-026). Insufficient length is shown as an alert; sufficient length is a comparison, not an operational approval.
When a correction is omitted, a partially corrected result cannot assert a fit or a margin; an insufficient comparison remains critical.

## Safety factor selection

Per operation the pilot selects the factor applied to the corrected distances: the manual's in-service factor
(default, take-off 1.10, landing 1.67), EASA standard, short field or a custom value in 1.00-3.00
(`resolveOsf`). Below the greater of the manual factor and the regulatory baseline (take-off 1.25, landing 1.43)
the result carries an advisory WARN-PF-002 (`osfThreshold`); it never blocks. The manual's own take-off factor
1.10 is therefore below the 1.25 baseline and warns by default.

## FSM 3/75 estimate (REQ-PF-021)

The LBA text (1 July 1975, 1995 reprint, `111 3-985.1/75`) was read from a third-party mirror (segelfliegenausbildung.de); authenticity is unconfirmed. CEO directive 19 accepts the estimation method defined by REQ-PF-003/004/021, so the estimate is applied with visible `ESTIMATED (FSM 3/75)` marking. The source does **not** validate this use: it states take-off percentages for the whole distance to 15 m, not for the ground roll.

Selected independently for each parameter without an applicable aircraft manual correction (manual first). Implemented in `core/logic/performance.fsm-estimates.ts`; take-off only:

- **Slope:** +10 % of the ground roll per +1 % uphill.
- **Surface:** dry paved adds nothing; dry short grass adds +20 %, chained after slope. The source's dry-paved baseline is not credited, so a POH table already flown on grass is never shortened. The POH surface baseline is unknown and stated in the result.
- **Wind:** not corrected. The source gives no take-off headwind credit and no tailwind value; tailwind remains unapplied and makes the result incomplete.
- Slope and surface act on the ground roll only (REQ-PF-004); the airborne part is unchanged. No 15 m to 50 ft conversion is made.
- Downhill slope and headwind are not credited and make the result partially corrected. The source states no slope range; the input is applied as entered within the generic |slope| < 100 % validation.
- When no manual in-service factor exists, the safety factor defaults to the regulatory baseline (take-off 1.25).

Not estimated, with the unapplied-input disclosure kept: all landing corrections (the source has no landing table), tailwind, and surface conditions without one unambiguous source row (wet or soft ground, long grass, damaged turf, wet or contaminated paved, snow, ice).

Because the source percentages apply to the whole distance, applying them to the ground roll yields a smaller surcharge than the source text; the estimate is therefore a lower bound of the source's own reading and must not be read as conservative against it.

## Remaining work

Other aircraft manuals and landing corrections remain unsupported. [CAA Safety Sense 12](https://www.caa.co.uk/publication/download/23582) gives landing slope and surface factors for the whole distance, incompatible with REQ-PF-004, and tailwind relative to lift-off speed, which is not modelled. [FAA AC 91-79B](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_91-79B_FAA.pdf), sections 5.2.7 and 5.2.9, describes landing distance rather than ground-roll slope corrections and gives different tailwind corrections for specific aircraft; it does not establish a general aircraft-independent correction. These sources cannot supply the missing corrections under the current contract. Further FSM rows (damp, soft, damaged turf, long grass, contaminated surfaces) need a rule for combining the chained percentages before they can be estimated.

[CAA Safety Sense 09](https://www.caa.co.uk/media/wcebqozv/ssl09-caa-safety-sense-weight-balance-and-performance.pdf), page 13, likewise gives landing-distance slope guidance and tailwind relative to lift-off speed. [FAA AC 91-79A Change 2](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_91-79A_Chg_2.pdf), appendix 1, gives a whole-landing-distance slope example and wind relative to landing speed. Neither supplies a ground-roll-only landing factor or wind calculation using the currently modelled inputs.

Pilot-entered signed surface corrections in metres may replace the surface rule for either operation, after built-in corrections and before pilot-entered wind and safety factors. They affect ground roll and total distance equally, leaving the airborne segment unchanged. The source and section are required, applicability and ordering are unverified, results remain partial, and condition changes clear the entry. Synthetic tests do not validate aircraft data.

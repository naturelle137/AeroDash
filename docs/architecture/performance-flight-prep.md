# Flight Prep Performance

Flight Prep and the standalone route consume `usePerformanceStep`. The step
combines the existing normalized tables, explicit PA input, manual runway and
correction-source assessment. `PerformancePresentation` in
`modules/performance/services/performance-presentation.ts` is the read-only pack
contract: input identity, aircraft/category, current entered conditions (even when blocked),
conditions actually used, independent phase groups,
runway declaration, operational unavailability with current source assessment/reasons,
and scope. Consumers render current data without calculation.
Read `step.presentation.value` through a live getter before snapshot or print;
compare `inputKey` to invalidate an existing snapshot. Native print guards also read live inputs.

Takeoff uses the current valid M&B takeoff mass. Landing uses only the current
valid fuel-planning trip arrival. Missing/invalid arrival blocks landing while
valid takeoff remains available. The all-usable-fuel-burned endpoint is never an
arrival input. Unsupported arrival CG does not invalidate an independently valid
arrival mass. Invalid M&B blocks both. No second profile or mass entry is needed.

The input key includes profile content, category, loading, raw fuel-plan identity,
both mass sources, PA method/values/provenance, temperature, runway draft/saved
record and units. Changes synchronously recompute the current result, including blocked
partial edits; equal resultant mass does not preserve an older input identity.
Fuel/Endurance precedes Performance in DOM and sticky navigation. Both preparation
and standalone controls calculate live without a submit trigger.

## Lower and upper bounds

This slice narrows the former PF-043 blanket block to reconcile PF-011 with #420.
Each distance uses its own table envelope. In-range intermediate mass continues
trilinear interpolation; it is never rounded down to a breakpoint.

Below-minimum positive mass uses the minimum-mass boundary at the same in-range
PA/temperature only if **every** altitude/temperature row is nondecreasing in
mass. Linear interpolation of such rows preserves this ordering. No extrapolated
shorter distance is calculated. The calculated-distance UI omits the explanatory
cap notice and interpolation/unit boilerplate; no extrapolation acknowledgement is required under the existing extrapolation
contract section 8.4. A decreasing row blocks capping, including when that row is
not at the requested conditions. Single-mass tables have one boundary value.
This is a software benefit cap, not proof of aircraft applicability below the
published mass range or operational approval.

Evidence: existing `performance-extrapolation-control.md` sections 3–6 and 8.4,
PF-002/PF-011, and synthetic independent corner means in
`performance.phase-lookup.spec.ts`. The baseline at `9e4109e` blocked all excursions;
its tests are not evidence for this new policy. No new aircraft manual or accepted
source version has been obtained. Existing profile verification and source-unit
validation remain prerequisites; all four complete positive grids are required.

PA/temperature excursions in either direction and **all** above-maximum masses
remain blocked. The generic P1 +10%/+20% extrapolation contract does not establish
source applicability and is not activated here. No acknowledgement can bypass
these blocks. #420 remains open for unsupported lower PA/temperature and upper
extrapolation; #305 remains held for controlled source evidence. No implicit
factor 1, fallback correction, runway verdict or operational approval is enabled.
CorrectionSourcePanel continues to expose the existing source-specific blockers.

## Units and persistence

No locale/region source exists in the application. The commissioned fallback is
hPa QNH, ft PA, ft elevation and m TORA/LDA; no country matrix is inferred. QNH and
direct PA currently support only those units. A versioned, validated local-storage
preference stores elevation/runway unit choices only. Invalid saved preferences
produce a visible notice and fallback. Numeric QNH, PA and temperature stay
session-only. Persisted runway declarations retain original numeric values/units.

Changing a length selector converts with the existing ft-to-m constant, retaining
four decimal places (at most 0.00005 target units per conversion). Programmatic
restore/copy suppresses conversion. Preferences fill empty fields; entered values
keep their explicit units. Profile changes preserve preferences and invalidate
results. Synthetic fixtures prove conversion and wiring, never operational data.

Supported ranges use the existing display-rounding helpers (mass minimum up,
maximum down to 0.1 kg, other axes at their unit precision). Raw bounds and lookup
comparisons stay unrounded. Numeric/unit pairs stay inline at narrow widths;
unit labels remain accessible. QNH method details start collapsed, while current
QNH advisory warnings accompany every affected distance in the UI and print.

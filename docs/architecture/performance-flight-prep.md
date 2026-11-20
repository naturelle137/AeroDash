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
and standalone controls calculate live without a submit trigger. Corrected phase results
appear before the explicitly labelled uncorrected base table distances.

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

Lower PA/temperature remain blocked. Above-maximum mass, PA and temperature use the accepted software gap-filling method unless the source table declares `extrapolation: "prohibited"`. The method uses
`lookupPhaseDistanceWithExtrapolation` (P1), which composes the extrapolation
control (`performance-extrapolation-control.md`) between the table lookup and
the operational corrections: at most 10 % above the axis maximum, the clamped
boundary distance times the fixed 1.2 penalty, never shorter. It is refused (blocked,
no distance) when any axis passes the 10 % band, the maximum is not positive, or the
table decreases along mass, PA or temperature anywhere, because the penalty is only
conservative for a nondecreasing table. A below-minimum mass still uses the benefit
cap in the same lookup. The constants are software limits: they do not establish that
the aircraft may be operated there, and no POH value is invented. A missing sibling
table is estimated from the penalised distance, so the value carries both markers.

An extrapolated group requires explicit pilot-in-command acknowledgment. Until then the
group shows no distance, correction or runway comparison (so nothing can be exported or
printed); the notice names each extrapolated axis, its value and the table maximum. The
acknowledgment is bound to the exact input key, so any change of input, profile,
mass, runway or units revokes it and it never carries over to another operating
point. Accepted Tecnam configurations support source-specific corrections and runway comparisons; other sources remain unsupported. No implicit factor 1 or operational approval is enabled.

The current shared Performance presentation carries deduplicated critical runway and low-factor notifications. Flight Prep and the briefing pack render these from the same current comparisons and warnings; invalidated inputs remove the corresponding notifications.

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

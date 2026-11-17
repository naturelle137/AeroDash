# Live preparation and warned print evidence

Runtime: `23b9b3dc642483d08135cd2c9b17d146825b9509`, based on develop
`8c4698feeaf58ebe372c69a7d35cf417bfffba88`. This evidence-only follow-up does not
change runtime sources. All aircraft and numeric cases are synthetic software
fixtures, not operational POH/AFM validation.

## Verification

Commands ran in the `web-dev` Distrobox:

- `pnpm lint`: passed.
- `pnpm test:unit`: 2,324 passed.
- `pnpm test:integration`: 223 passed.
- `pnpm build`: passed, including strict TypeScript.
- `pnpm --filter frontend test:p1`: 1,084 passed; no P1 source changed.
- `pnpm --filter frontend check:data-constants` and `comment:check`: passed.
- `CI=1 pnpm test:e2e --project=chromium`: 97 passed, including offline scenarios.
- Full production cached-offline suite: 60 passed at 390/1440 px.

The production suite serves a fresh build, installs the real service worker,
then disables network and reloads the cached app. Session-only fuel and conditions
are re-entered. Native `window.print()` is unmocked; print-media/PDF output uses
the browser's real pagination. No physical printer or real-device claim is made.
Raw logs, screenshots, PDFs and traces remain in the implementation job evidence.

## Visible acceptance

- [390px live distances](mobile-live.png) and [1440px live distances](desktop-live.png):
  current 900 kg takeoff and 880 kg trip-arrival mass, with independent expected
  220/320 m takeoff and 400/500 m landing distances, without a calculation button.
- [320px cached-offline geometry](inline-320.png): numeric controls and units do
  not overlap, with no page overflow; Fuel/Endurance is section 03 and Performance
  section 04. Tests also verify QNH/elevation/runway unit pairs, DOM/sticky order,
  live trip edits, blank/partial/invalid inputs, recovery, both fuel methods,
  profile/category changes and actual unit conversion/persistence.
- [Warned available values](warned-values.pdf), five pages: the exact reserve-budget
  warning accompanies its highlighted budget/shortfall values; the exact QNH
  advisory accompanies all four affected distance values. The requested redundant
  copy is absent, while the method remains expandable and initially collapsed.
- [Warned distance page](warned-distances.png): actual PDF rendering, with print
  backgrounds disabled.
- [Critical M&B stress output](critical-no-backgrounds.pdf), 13 pages: successful
  computed exceedance exports with its exact adjacent MTOM warning, station
  warnings and unverified markers. Eleven zero-occupant rows deliberately carry
  very long source warning text. Repeated headers and complete text remain readable.
- [Critical chart](critical-chart.png): actual PDF page, retaining red markers,
  red envelope and SVG crosshatching with print backgrounds disabled. The suite
  also exports with backgrounds enabled and checks a computed CG exceedance.

All five warned-value PDF pages and all 13 stress pages were rendered and visually
inspected; warning/value associations, color, hatching and pagination are present
without clipped text. Long warnings are retained rather than shortened. Closed
native keyboard printing, invalid loading and same-turn source edits suppress
numeric snapshots; PDF text inspection confirms the closed guard contains only
the unavailable-preview message. Hard adapter/raw fuel failures keep their exact
UI reasons and no successful M&B/arrival/print numbers. Existing adapter-warning
regressions and controlled-source holds remain intact.

The terminal owner commissions the single independent review, checks required CI
and signatures, integrates through branch protection and verifies the merged app.
This branch evidence is not merged-product acceptance. Weather, user profiles,
unsupported corrections and unsupported lookup domains remain outside this change.

# Estimated trip arrival browser evidence

Production build, Chromium at 390 × 1000 and 1440 × 1000, 2026-11-13.
All aircraft and numbers are synthetic software fixtures, not POH/AFM validation.

Run `pnpm --filter frontend exec playwright test --config playwright.offline.config.ts` after `pnpm build`.
The test imports and verifies a local Fleet fixture, edits M&B tank loads and exercises
trip zero/equality/exceedance, reserve shortage, invalid inventory, aircraft reset and
cached offline reload with session-only inputs cleared before recalculation.

| State | Mobile | Desktop |
| --- | --- | --- |
| 600 kg takeoff, 20 kg trip burn, 580 kg arrival, 20 kg usable remaining, 15 kg budget margin | [390](390-plan.png) | [1440](1440-plan.png) |
| All 40 kg usable burned, 560 kg arrival, unmet reserve warning retained | [390](390-shortfall.png) | [1440](1440-shortfall.png) |
| Cached offline reload and recalculation | [390](390-offline.png) | [1440](1440-offline.png) |

All six captures were inspected: arrival values and warning are readable, mobile labels
wrap within the viewport, and offline status is visible. The tests also assert no horizontal overflow.
The existing sticky section headings can cover upper content in scrolled captures.
The separate M&B full-burn endpoint is unchanged; these estimates do not assess trip CG,
the envelope or operational suitability.

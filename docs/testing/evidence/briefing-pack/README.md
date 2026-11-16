# Current briefing pack browser evidence

Candidate runtime: `9e1b44f602a0b4d8b2e74bd679690ad293b7983d`, based on reviewed
slice A integrated as `91b37e0`. Later evidence-only commits do not change runtime
sources. Synthetic `testPohAircraft` fixtures prove software behaviour only.

## Checks

- `pnpm lint`, `pnpm test:unit`: passed (2,259 tests).
- `pnpm test:integration`: passed (203 tests).
- `pnpm build`: passed, including strict TypeScript checking.
- `CI=1 pnpm test:e2e --project=chromium`: 97 passed.
- `pnpm --filter frontend test:p1`: 1,050 passed; no P1 source changed.
- `pnpm --filter frontend check:data-constants` and `comment:check`: passed.
- Production offline suite: 29/30 passed on the candidate run; the existing
  neutral-limit scenario timed out on a Draft acknowledgement after reload.
  Its isolated repeat passed at both widths (2/2); the full confirmation run
  and final CI result are recorded in the PR/HQ1386 handoff.

Commands run in `distrobox enter web-dev`. Offline tests serve a fresh production
build at port 4278, cache it online, then reload with network disabled and re-enter
session-only fuel/PA inputs. Native `window.print()` is not mocked; `beforeprint`
is observed and print-media output is rendered to browser PDFs. This is neither
physical-printer execution nor aircraft-specific operational validation.

## Visible cases

The complete-pack test runs online and offline at 390/1440 px. It verifies current
900 kg takeoff and 880 kg actual trip-arrival masses, independently expected
220/320 m takeoff and 400/500 m landing raw synthetic distances, manual runway
inputs, missing-result reasons, named mass limits and the normalized chart.
Actual document scrolling at top/middle/bottom checks action reachability,
navigation clearance, final-content clearance and keyboard activation. Native
printing immediately after a conditions mutation suppresses old distances.

Fuel/M&B suites cover duration and direct modes, reserve shortfall, unsupported
arrival CG, unconfigured/invalid/impossible trip, named burn sequences,
profile/category/loading changes, source-unit moment normalization, retained
warnings and synchronous native-print guards. Removed source/status and limits
chapters, the requested endpoint paragraph and empty notifications are absent.

- [Mobile top](mobile-top.png), [middle](mobile-middle.png), [bottom](mobile-bottom.png)
- [Desktop bottom](desktop-bottom.png)
- [Complete current pack](complete-pack.pdf): four pages, chart on first page.
- [Long warnings and reserve shortfall](long-warnings.pdf): five pages.

All nine PDF pages were rendered with Poppler and visually inspected: readable
axes/legend, no clipping or blank first page, full long warning retained, table
headers repeated. Raw traces/screenshots/logs remain in HQ1386's job directory.
The terminal owner must independently accept the integrated runtime after the
single B review and green required CI; this Engineer evidence is not product
acceptance. Existing unsupported operational corrections and upper/PA/temperature
lookup paths retain slice A's explicit unavailable reasons.

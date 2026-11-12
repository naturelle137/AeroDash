# Performance source-unit workflow evidence

Captured on 2026-11-12 from this branch's production build in local Chromium.
All aircraft points are synthetic wiring fixtures, not POH/AFM data or operational
validation. Definitions and independent arithmetic vectors are in the
[source-unit contract](../../../architecture/performance-source-units.md).

## Browser flow

All **50 enabled Chromium scenarios passed with retries disabled**, including
21 raw-performance cases. Existing `@wip` scenarios remain excluded and are not
counted as passed. Source-unit cases run at desktop 1440px and mobile 390px:

- Import legacy, declared normalized, imperial and mixed tables independently of M&B units.
- Review original and normalized values while the imported profile remains Draft.
- Explicitly verify and wait for the visible persisted Verified badge before navigation.
- Compute raw distances, clear results on changed inputs and reject out-of-envelope conditions.
- Reload and compare downloaded table metadata, references and numeric source values exactly.
- Re-import changed units/reference as a Draft and block computation pending another review.
- Reject unknown, partial and conflicting unit declarations visibly, without persisting a profile.

The imperial vector is 2000 lb / 304.8 m pressure altitude / 50 °F / 1000 ft
distance, normalized to 907.18474 kg / 1000 ft / 10 °C / 304.8 m. All four phases
use that vector in this screenshot example. The legacy eight-point tests and
mixed-per-phase service test retain four distinct interpolated distances.

| Evidence | Desktop | Mobile |
| :--- | :--- | :--- |
| Original and normalized Draft review | [1440px](review-desktop.png) | [390px](review-mobile.png) |
| Verified raw lookup after reload/export | [1440px](lookup-desktop.png) | [390px](lookup-mobile.png) |
| Visible unsupported/incomplete declaration failure | [1440px](rejected-desktop.png) | [390px](rejected-mobile.png) |

Mobile table regions scroll horizontally; the page itself stays within 390px.
The screenshots were visually inspected. The no-retry run followed correction
of a test-helper persistence race and a mobile help-text overflow found during
verification. Hosted Chromium also exposed a font-dependent 3px overflow of the
Draft badge; the mobile identity row now wraps, retaining the strict page-width
assertion and table scrolling. The named review finding was repaired in the same
PR. Earlier failed/flaky runs are not the final acceptance evidence.

## Reproduction

Use the documented `web-dev` toolbox, frozen lockfile and Node/pnpm versions.
Run `pnpm lint && pnpm test:unit`, `pnpm test:integration`, `pnpm build`,
`pnpm --filter frontend test:p1:coverage`, `pnpm --filter frontend test:mutation`
and `CI=1 pnpm test:e2e --project=chromium --retries=0`.

Local browser execution used a temporary, uncommitted config that changed only
the preview port and base URL to `127.0.0.1:4474`, because another process owned
4173. It ran the production build with the committed BDD feature/steps and
Chromium project. No storage injection or live aviation API supplied the tables.
The standard CI browser config is unchanged.

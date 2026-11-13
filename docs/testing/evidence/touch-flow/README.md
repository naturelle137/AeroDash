# Flight-preparation touch flow

Baseline: `e081ef5f8a89fb338e55e07970c8bf896d040721` (2026-11-13).
Scope: Fleet JSON import, Draft table review and explicit verification, raw distance lookup,
manual runway save/edit/reload/discard/clear, direct and QNH/elevation selection, unsupported
correction sources. Uses the synthetic Test POH fixture; no operational POH/airport validation.

## Criterion and method

Chosen software target: enabled workflow controls have an actionable rectangle at least
44 × 44 CSS pixels. For radios the associated label supplies that rectangle; plain text labels
are not required to be 44 pixels when their input is already large. Native file-selector buttons
are enlarged along with the input. Each target is scrolled to the viewport centre and checked
with `elementFromPoint` at its centre and four inset points (10%/90%). Check horizontal containment
and document width separately. These sampled checks do not prove every pixel or every scroll
position is unobstructed. Disabled controls and the application navigation shell are excluded.

`playwright.touch.config.ts` runs Chromium at 390 × 844 with touch enabled and 1440 × 1000
with desktop input. The new scenarios also join the regular Chromium suite. Real touch taps
activate the QNH label and runway discard/save/clear buttons; desktop Enter and radio arrows
exercise keyboard behavior. Existing browser scenarios retain invalid-input, Draft, offline,
source-unit, stale-result and pressure-altitude regression coverage.

## Findings and change

| Target | Baseline | Repair |
| :--- | :--- | :--- |
| Fleet native file picker | 21 px high | Input and native selector button minimum 44 px |
| Fleet table review summary at desktop | 38 px high | Summary minimum 44 px |
| Fleet → Performance link at desktop | 22 px high | Contiguous inline-flex target, minimum 44 px |
| Performance direct-method label at mobile | 27 px high | Label minimum 44 px with padding |
| Wrapped workflow links at mobile | Bounding rectangle includes non-actionable gaps | Contiguous inline-flex target |

Tracked as [defect 501](https://github.com/naturelle137/AeroDash/issues/501), within
[issue 292](https://github.com/naturelle137/AeroDash/issues/292). Unsupported blanket WCAG/glove
claims were removed from the existing control-style comments. No calculation, factor source,
legal text, or acceptance gate changed. Issues 305/300 and broader 302 remain unfinished.
The checked source-navigation aid is HQ job744's corrected inventory of six native buttons;
job743's original output was rejected and is not runtime evidence.

## Repeat and evidence

From the repo root in `web-dev`:

```sh
pnpm install --frozen-lockfile
pnpm build
CI=1 pnpm --filter frontend exec bddgen
CI=1 pnpm --filter frontend exec playwright test --config playwright.touch.config.ts
```

Preview port 4275 is dedicated to this bounded run. The regular suite uses its existing config.
CI uploads `touch-workflow-evidence` for 14 days, including the HTML report, stage screenshots,
`*-targets.json` measurements and six `trace.zip` files even on success. Attachments describe
the exact run revision. Local baseline failures and post-fix evidence are retained in HQ job745;
the successor records PR CI links and integration results there. Build caches stay in the managed
job worktree, not in source control.

Initial repaired run: 6/6 bounded browser cases, 1867/1867 unit tests and 111/111 integration tests
passed; full lint and production build passed. Final-head and CI status belong to the PR checks.
No `@wip` cases count as passed. Physical glove/turbulence review is unavailable and unvalidated.
Dimensions and automated browser tests establish neither WCAG conformance nor aviation certification.
No field test is assigned to the CEO. Source acceptance for operational corrections stays gated.

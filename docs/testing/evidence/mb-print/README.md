# M&B native print evidence

Synthetic software fixtures only; these captures do not validate aircraft data
or demonstrate a physical printer/spooler run. Browser PDFs are pagination
artifacts, not a downloadable-PDF feature.

Run from the repository root in `web-dev`:

```bash
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm build
CI=1 pnpm test:e2e --project=chromium --workers=2
pnpm --filter frontend exec playwright test --config playwright.offline.config.ts
```

Local results: lint, build/typecheck, 2009 unit tests, 154 integration tests,
97 Chromium E2E scenarios and all six production-cache offline tests passed.
The new print journey runs at 390 and 1440 CSS pixels. It imports a Draft via
Fleet, selects it with acknowledgement, enters loading, opens preview, invokes
the real native `window.print()` (observes `beforeprint`, no print mock), returns
without data loss, and checks category/loading/aircraft changes and critical
blocking. It reloads with the service worker offline, explicitly reselects the
persisted Draft, then previews and invokes native Print again. No preview is
restored on reload.

- [Mobile preview](screen-390.png) and [desktop preview](screen-1440.png).
- [Offline mobile](offline-390.png) and [offline desktop](offline-1440.png).
- Browser-generated A4 output: [mobile](print-390.pdf), [desktop](print-1440.pdf).
- Rendered print pages: [1](print-page-1.png), [2](print-page-2.png), [3](print-page-3.png).

The long-warning fixture deliberately uses twelve long station names. Both
online PDFs and both offline PDFs have three nonblank pages. Visual inspection
confirmed repeated table headers, intact rows/units, complete long warnings,
visible disclaimer and endpoint limitation, without clipped values or a blank
first page. Text extraction checked all station names, warning/disclaimer text
and absence of application navigation and print controls. Invalidated and
critical snapshots produce a one-page guard notice without aircraft/results.
Integration tests also cover expiry at native printing, unattributed/draft/
expired markers, imperial limit normalization, error/loading/missing input
blocking and cancellation. Ordinary CI repeats the browser flows and uploads
traces, screenshots and generated PDFs in its offline-workflow artifact.

Postmerge CI and fresh merged-runtime acceptance belong to the terminal owner;
these branch-local captures do not claim those outcomes.

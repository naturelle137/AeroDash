# Fixed-arm fuel boundary evidence

Synthetic software fixtures only; no aircraft/POH validation or physical-device acceptance.
Implementation revision: `cede2584fa573de77c0a33ecbbcb6f02be540861`, based on
`739596478b6987db2286ba1da232a1cb18398544`. The following evidence commit adds the
browser regression and recorded outputs without changing calculation behavior.

## Reproduce

Run in `web-dev`, from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm build
pnpm --filter frontend test:p1:coverage
pnpm --filter frontend test:mutation --concurrency 4 --reporters dots,clear-text,html
pnpm --filter frontend exec playwright test --config playwright.offline.config.ts fixed-arm-fuel.spec.ts lookup-fuel-mb.spec.ts briefing-pack.spec.ts fuel-print.spec.ts fuel-endurance.spec.ts
pnpm --filter frontend check:data-constants
pnpm --filter frontend comment:check
```

The host route used here was `flatpak-spawn --host distrobox enter web-dev -- bash -lc 'cd "$1" && COMMAND' bash "$PWD"`.
Installation, lint, build, source constants and comment checks exited 0. Unit:
2,275 tests / 109 files. Integration: 218 tests / 23 files. Isolated P1 coverage:
1,062 tests / 34 files; per-file 90% thresholds passed (aggregate statements
98.88%, branches 97.43%, functions 100%, lines 99.36%). The full mutation run passed at 80.07% against the 70% gate (3,416 mutants;
1,814 killed, 10 timed out, 441 survived, 13 uncovered, 1,138 rejected by checkers).
See [machine-readable checks](checks.json), [gate excerpts](gate-summary.log) and
[mutation summary](mutation-summary.log).

[Browser log](browser.log): 10/10 passed, Chromium 390×1000 and 1440×1000, production
Vite preview with real cached service-worker reloads. The focused test imports two
ordinary synthetic exchange profiles. It checks q=30 → 580 kg / 1180 kg·m /
2.034 m, q=9 retained with the tank-specific 10 kg minimum and no summary, CG
markers, arrival or eligible print, q=10 → BEM 560 kg / 1120 kg·m / 2 m, then q=30
recovery. The strengthened [focused rerun](browser-recovery.log) passed 2/2
after adding same-session recovery of the original 570 kg arrival / 2.018 m CG.
It also checks an initially invalid persisted default and cached reload
of an invalid current load. Open print is invalidated synchronously before Vue
renders, with native `beforeprint` and the Print button blocked.

Adapter tests additionally cover q=0/u=10, q=10−1e−6/u=10 (no tolerance), q=0/u=0,
nonfinite/negative quantities, distinct station IDs versus array positions and
exact takeoff/landing/ZFM values without unrelated violations. Store tests cover
raw validation, category exclusion, independent errors/station warnings and the
USG / lb-in equivalent using existing conversion constants, preserving the profile.

## Screenshots and console

These screenshots were opened with the image viewer. Error text and entered
quantity remain visible at both widths; equality clears the boundary error.
Full-page preview screenshots include the underlying page outside the scrollable
dialog; the dialog itself is not a full native-print capture.

| State | Mobile | Desktop |
| --- | --- | --- |
| Retained q=9 and tank minimum | [390](390-below-minimum-viewport.png) | [1440](1440-below-minimum-viewport.png) |
| Offline q=u, BEM only | [390](390-offline-equality-bem-viewport.png) | [1440](1440-offline-equality-bem-viewport.png) |
| Already open print invalidated | [390](390-open-print-invalidated.png) | [1440](1440-open-print-invalidated.png) |
| Recovered offline print | [390](390-offline-recovered-print.png) | [1440](1440-offline-recovered-print.png) |

[Console attachments](console.json) are extracted verbatim from the actual
Playwright report. Both focused runs have zero application/page errors; each has
four known Vite-preview CSP messages because `frame-ancestors` in an HTML meta
element is ignored. An earlier run overlapped a rebuild and timed out awaiting
service-worker readiness on one desktop test; the final frozen-build run above
passed all ten. Raw traces and all screenshots remain in the job worktree's
`frontend/test-results/` and `frontend/playwright-report/offline/`.

## Limits and ownership

Fixed-arm source-unit policy, lookup strict validation and station-limit warnings
remain unchanged. No source/profile/BEM edits, new arrival geometry or burn-path
assessment. Physical device #420 remains **UNEXECUTED**. No merge or issue closure
is claimed; terminal HQ1648 owns the single independent review, at most one fix,
CI/protected integration and merged-runtime acceptance. The implementation commit
has an SSH signature; GitHub currently reports `verified=false`, `reason=no_user`; the available key does not
match either registered GitHub signing key,
so protected integration must check its actual signature requirements.

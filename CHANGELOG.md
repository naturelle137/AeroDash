# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Minimum-safe-version gate (REQ-SYS-006 / H-019) now enforces **offline** — closing the v0.3.0-alpha audit gap CS-011 / TECH-023 where `useAppVersionStore.checkMinSafeVersion()` returned early on `!navigator.onLine`, leaving an explicitly kill-switched bundle free to keep running in exactly the cockpit (unreliable-network) case the requirement exists to mitigate. The store now (a) loads the last-known `minSafeVersion` from a new IndexedDB cache (`frontend/src/stores/app-version.cache.ts`, database `aerodash-app-version`) on every cold start, (b) computes `effectiveMin = max(buildTimeConstant, cachedValue, remoteValue)` and blocks when the running version is below it, (c) opportunistically refreshes the cached value from `/version.json` when online (`frontend/src/stores/app-version.remote.ts` — total contract, every failure mode resolves to `null` so a flaky CDN cannot accidentally unblock a kill-switched build), and (d) re-runs the check on `window.online` via `attachConnectivityRefresh()`. Each cache record carries a `fetchedAt` timestamp; records older than 24 h still enforce, but emit a WARN. A truly fresh install with no cache record (or with IndexedDB itself unreachable — Safari private mode, sandboxed iframe) falls back to the build-time constant only and logs an INFO — the documented and only first-install bypass. The SemVer comparator now lives in `frontend/src/stores/app-version.semver.ts` and implements SemVer §11 ordering correctly: `+build` metadata is stripped before comparison and pre-release identifiers are ordered per spec, so a `+build.7` floor can no longer NaN-collapse the gate and an alpha bundle can no longer keep flying below its stable kill-switch floor. The cache wrapper now resolves `readwrite` ops on `tx.oncomplete` (post-commit) instead of `IDBRequest.onsuccess` (post-queue), so a tab kill cannot silently lose the newly-learned floor; the IDB handle is closed on every completion / error path. The cache reader exposes a discriminated outcome (`absent` / `corrupt` / `unavailable` / `hit`) so the store emits INFO on first install and WARN on a broken storage backend — operators can now triage the cohort. `checkMinSafeVersion()` is single-flight-latched so a fast `online` event cannot race the onMounted call; `attachConnectivityRefresh()` invokes the store action via the Pinia wrapper, restoring observability (`$onAction`, devtools, `vi.spyOn`). Remote fetch refuses oversized bodies pre-flight via `Content-Length` and falls back to a `Promise.race` against a wall-clock timer when `AbortController` is unavailable. The build-time floor moves to `0.3.0-alpha` to match the current pre-release line under the corrected SemVer ordering. Privacy implications of the cold-start fetch are tracked separately in #274 (closes #271)
- Fleet list **Delete** control no longer silently no-ops after the iOS Safari swipe-back gesture (or any other path that restores the Fleet page from the browser back/forward cache). `App.vue` now listens for `pageshow` with `event.persisted === true` (the bfcache restore signal) and re-keys the active `<RouterView>` — scoped via an explicit allowlist (currently `/fleet` only) so multi-step wizards and entry forms keep their partial pilot input on an iOS app-switch — forcing the restored route component to remount cleanly so reactive bindings and template `@click` handlers are re-bound. Standard Chromium SPA back (which does not bfcache the active document) already worked via vue-router's default remount-on-route-change; only the bfcache code path is changed by this fix (refs #232)

### Engineering

- Hazard log gains a Status + Mitigated-By line per `H-xxx` entry, a machine-readable `trace/hazards/hazards.yaml` index, and a hard-fail CI assertion (`frontend/scripts/trace/__tests__/hazard-mitigation.spec.ts`) that scans every requirement's `**Status:**` and fails the unit-test suite whenever a hazard's set of non-deprecated mitigating REQs is empty — closing the v0.3.0-alpha release-audit PR-009 gap where a `Deprecated` REQ could silently un-mitigate a hazard. `pnpm trace check` reports the same gap in its long-form report; the structural-only gate is unchanged. The YAML index is mirror-checked against the scanned REQ→H inversion so a curator cannot quietly drop a mitigator from `mitigated_by:` without the assertion catching it (closes #267)
- Logger PII redaction (issue #263 — DP-004 / CS-012). `redactPayload` now narrows generic allow-list keys (`name` / `type` / `status` / `reason` / `fallback` → `errorName` / `errorType` / `httpStatus` / `advisoryReason` / `fallbackPath`) and removes envelope keys (`message`, `timestamp`, `level`, `context`) from the data allow-list, so a caller passing `{ message: err.message }` can no longer smuggle pilot input into log output via the envelope key name. `redactPayload` gained its own `MAX_DEPTH` guard. Vite env flags `VITE_LOG_DEBUG` and `VITE_LOG_TELEMETRY` (both OFF by default everywhere) gate `logger.debug()` and `logger.telemetryTrace()` respectively; the truthy parser now accepts `true` / `1` / `yes` / `on` (case-insensitive). New `frontend/.env.example` documents both flags (placed in `frontend/` because Vite reads `.env*` from `envDir`, which defaults to the directory holding `vite.config.ts`). `frontend/vite.config.ts` additionally aborts any `pnpm build` whose merged Vite env (`loadEnv('production', envDir, 'VITE_')`, so the guard sees the same values the bundler will inject into `import.meta.env` — including `.env.production` / `.env.local`, not just shell env) carries a truthy `VITE_LOG_TELEMETRY`, so a misconfigured production bundle (which would otherwise bypass the PII redactor by design) cannot ship.
- Document-level traceability registries restored per STC §4.2: `trace/requirements/{module}.yaml` (12 files, 130 REQ entries with titles harvested from the markdown headings and the hazard list propagated from each REQ's `FROM @H-…@` annotation) and `trace/journeys/{phase}.yaml` (7 files, 23 UJ entries with the upstream `REQ` list). The trace CLI parser now distinguishes a tag *declaration* (bare `@TAG@`) from a downstream *citation* inside `(FROM: …)`, so `trace check` no longer reports file-list mismatches for REQs that are cross-referenced from other REQ documents and `findDuplicates` no longer flags citations as INV-008 violations. Registry presence is enforced in two places: `pnpm trace check` exits non-zero when any module/phase lacks its YAML, and a new vitest spec (`frontend/scripts/trace/__tests__/presence.spec.ts`) keeps the unit-test CI gate honest even when `trace check` isn't part of a particular workflow. Resolves PR-002 deferred from the v0.3.0-alpha release audit (closes #264)
- P1 Safety Core coverage gate now enforced **per file** instead of as a global aggregate — `frontend/vitest.config.p1.ts` sets `thresholds.perFile: true`, so a single well-covered P1 file can no longer mask uncovered branches in another P1 file. Defensive branches in `profile-migrations.ts` / `session-migrations.ts` (missing up-function for an intermediate version; throwing up-function) are now reachable from tests via a pure injectable walker, and the legacy Title-Case `Draft → draft` schema arm is covered alongside the already-tested `Verified` arm (closes #262, TECH-019)
- Stryker mutation testing scoped to `frontend/src/core/**` (P1 Safety Core), driven by `vitest.config.p1.ts` for framework-free runs. The gate is a binary pass/fail contract — `thresholds.high`, `thresholds.low` and `thresholds.break` are collapsed onto a single value (`70`) so the score renders as pure green-or-red with no "amber" tier. New `pnpm --filter frontend test:mutation` script and TESTING.md §7 document the runner, exclusions, threshold, and local workflow. CI gate wired up as `.github/workflows/mutation.yml` (P1 Mutation Score check, no `continue-on-error`, HTML report uploaded as artifact): always runs on PRs to `main`, runs on PRs to `develop` only when the diff touches P1 source, the Stryker / Vitest-P1 configs, the lockfile, or the workflow itself. CI invocation uses `--reporters dots,clear-text,html` (quiet logs + survivor summary + uploaded artefact); worker concurrency left at Stryker's `os.cpus().length - 1` default. A score below `thresholds.break` hard-fails the PR (closes #260, TECH-007/PR-015)
- `publish-release.yml` now marks SemVer pre-release tags (`-alpha` / `-beta` / `-rc`) as GitHub pre-releases and stable tags as `latest`, instead of always publishing a stable "latest" release (`gh release create` does not infer this from the tag)
- `pnpm` overrides force patched transitive dev dependencies (`fast-uri` ≥3.1.2, `@babel/plugin-transform-modules-systemjs` ≥7.29.4, `js-cookie` ≥3.0.7), clearing the four high-severity advisories that failed the `pnpm audit --audit-level high` CI gate
- `/issue` command now sets GitHub's native parent/child (sub-issue) relationship for Tasks via the sub-issues API, instead of recording the parent only as body text

## [0.3.0-alpha] - 2026-05-24

### Added

- Aircraft fleet CRUD persisted in IndexedDB with ICAO registration validation and duplicate detection (REQ-AC-001..003, closes #144, #156)
- Draft / Verified profile FSM with immutable versioned snapshots; selecting a Draft profile prepends `WARN-AC-002` to Mass & Balance results (safety-critical, REQ-AC-005, H-011, closes #145, #157)
- Manufacturer / model / ICAO catalogue selector with manufacturer-filtered model dropdown, ICAO auto-fill, and reverse lookup; versioned `aircraft-model-catalogue.json` with stable row IDs (REQ-UI-001..004, closes #146, #158)
- Passenger profiles with standard weights wired into load inputs (REQ-AC-006, REQ-UI-006, closes #147, #159)
- Aircraft profile import from `.aerodash.json` exchange file and download from fleet list as round-trip-safe export; canonical exchange-file format spec (REQ-AC-004, closes #148, #160)
- Supplementary aircraft profile fields: `costPerHour`, `fuelCostIncluded`, reference datum, checklist scaffold; fully-typed `performanceProfiles` with `flightPhase` enum and up to 1000 `PerformanceDataPoint` entries (REQ-AD-006/007/008/009/010, closes #149, #161)
- Native battery-electric aircraft support: `powertrain` discriminator, `batteryPack` sub-entity (usable energy, reserve floor, optional voltage / chemistry) with Zod cross-field guards, dedicated wizard step, "Energy & Endurance" labelling on M&B view, Pipistrel Velis Electro shipped in catalogue; powertrain locked in editor; Battery Pack accordion section in editor (REQ-AD-020/021/022, ADR-009, closes #225)
- 5-step aircraft creation wizard at `/fleet/new`: Identity → Certification & Envelope → Weighing Reports → Load Stations → Review & Save; forward-lock validation, dirty-route guard, Draft save (REQ-AC-001, REQ-UQ-003)
- Accordion-style aircraft profile editor at `/fleet/:id/edit` with Identity, Certification & Envelope, Weighing Reports, Load Stations sections; sticky Save footer; saving a Verified profile creates a new Draft snapshot via `editVerifiedProfile()` (REQ-AC-001, REQ-AC-005, REQ-AD-001..014, REQ-AD-018, REQ-AD-019)
- Per-load-station allowable-categories selector and burn-sequence editor on fuel tanks (REQ-AD-005, REQ-AD-012)
- Reusable `DecimalInput` component (`type="text" inputmode="decimal"`, accepts `.` and `,`) applied to BEM, Empty CG, Arm, Operational Limit, Default Quantity, Unusable Fuel — resolves iOS Safari decimal-entry defect
- Mass & Balance fuel slider per station: capped at unusable (min) and operational limit (max); fuel density applied when tank unit is volume (P1 — 100 L AvGas now = 72 kg, not 100 kg)
- PWA Service Worker app-shell caching via `vite-plugin-pwa` and Workbox; full app shell loads and M&B completes with no network (REQ-SYS-001/002, closes #150, #162)
- `INFO-SYS-001` PWA update notification (in-session updates require pilot confirmation; cold-start updates apply silently, classified via `sessionStorage`) and minimum safe version gate that replaces `<RouterView>` with a full-screen blocked screen below `minSafeVersion` (REQ-SYS-005/006, H-019, ADR-007, ADR-316, closes #151, #163)
- SemVer + build date displayed in sidebar footer (`AppVersion.vue`); injected at build time (REQ-UI-013)
- `AircraftContext.schemaVersion` field for structured IndexedDB migration safety; ADR-008 defines forward-only migration contract (REQ-SYS-002, closes #154, #166)
- Active aircraft hot-swap mid-session without full page reload; M&B store fully detaches stale prior-aircraft data via `clearProfile()` on switch (REQ-AC-005, closes #153, #165)
- Session payload auto-save / restore: debounced `localStorage` persistence of M&B pilot inputs validated by `SessionPayloadSchema`; restored on page reload after fleet hydration; stale payloads (aircraft removed from fleet) discarded; `startWatching()` idempotent across remounts (REQ-SYS-013, closes #152, #164)
- Bilinear interpolation engine in P1 Safety Core for 2-D POH performance table lookups (mass × pressure altitude → distance) covering TOR / TOD / LR / LD with conservative boundary clamping; canonical algorithm contract document (closes #155, #169)
- Fleet-list row actions (Select / Verify / Download / Edit / Delete) as 44 × 44 px (≥48 × 48 px on mobile) icon buttons with distinct colour families and `aria-label` / `aria-pressed` / `sr-only` labels — meets WCAG 2.2 SC 2.5.8 AAA target size (REQ-UQ-003)
- Stacking compressed prep-card headers with smooth tap-to-open and sticky title pinned to top during scroll
- Teal palette, logo / favicon alignment, light / dark design system (closes #173)

### Changed

- Flight Preparation page reads aircraft from IndexedDB fleet (`useFleetStore` + `useActiveAircraftStore`) instead of hardcoded `AIRCRAFT_CATALOGUE`; empty-fleet "Add Aircraft" CTA, `[Draft]` suffix in dropdown, fleet-load Retry button; `<select>` constrained to its parent on narrow viewports (UJ-F-002, REQ-AC-001, REQ-MB-002)
- `FleetManagementView`: inline "Add New Aircraft" form replaced by a single "+ Add New Aircraft" button launching the wizard — the prior form silently created aircraft with unit-square envelope and `mtom: 1`
- `EnvelopeSection` component: certification-category editor with MTOM / MZFM / graph-type and 4–20-point envelope-polygon table; pilots can now enter real POH envelope data (was stubbed unit-square at creation) (REQ-AD-011, REQ-MB-001, H-005, H-006)
- `sourceUnit` field constrained to `kg` | `lb` dropdown (was free-text); `ownerId` removed from forms and system-generated via `uuidv4()` (REQ-AD-019); engineering-only requirement IDs removed from user-facing labels
- `fleetStore.editVerifiedProfile()` replaces the Verified record in place with the new Draft (same `id`) instead of inserting a duplicate row; REQ-AC-005 store-layer immutability still enforced via `VerifiedMutationError`
- CG Envelope Chart: migration-path arrowhead suppressed independently of the line (drawn whenever migration exists; arrowhead only when path ≥ 3× arrow length / 24 px); TOM label staggered above ZFM when within 12 px (electric aircraft frequently have ZFM = TOM = LM)
- M&B station controls: unit label above the field (no longer overlaying the input); fuel stations show unusable quantity and clamp min load; reset payload respects unusable-fuel floor and profile `defaultQuantity`; tank `defaultQuantity` promoted to `unusableFuel` on save
- Mobile portrait: chart + result summary flow below inputs (was sticky footer); station label stacks above stepper under 480 px so `+` is not clipped; iOS double-tap-to-zoom on buttons suppressed via `touch-action: manipulation`
- PWA update banner pinned to top; in-flow card header mirrored on pinned strips
- C182T Skylane ICAO type designator corrected: `C82T` → `C182` (aviation safety data correction)
- ADR-007 enhanced with versioning, update-path, and notification sections documenting the PWA update lifecycle
- Mass & Balance station input gains a coarse step and one-tap weight presets with a wider value field for gloved / turbulence use; destructive actions (delete aircraft, Reset Payload) now require in-app confirmation and offer a 5–10 s undo, with delete disabled for the active aircraft — replaces native `confirm()` via new shared `ConfirmDialog` / `UndoToast` components (release-audit UX-001/002/004, #293)
- `PRIVACY.md` "Current State" rewritten to describe the actual shipped storage surface — IndexedDB `aerodash-fleet`, `localStorage` session payload, `sessionStorage` cold-start flag; data is local-only and unencrypted (previously and incorrectly stated as "no persistent storage") (release-audit DP-001, #293)

### Fixed

- CG migration leaving the envelope during fuel burn-down now triggers the missing out-of-envelope warning (closes #120, REQ-MB-011, H-006)
- Input validation errors now highlight the affected input field (closes #119, REQ-UQ-003)
- CG-out-of-envelope vs MTOM-exceeded notification mismatch resolved (closes #118)
- Mass & Balance now normalizes arm, empty CG, moments, and the CG envelope to SI from each profile's declared units instead of assuming metres — corrects CG position and envelope membership for imperial-unit (in / lb) profiles (safety-critical, release-audit TECH-001/002, #293)
- Math core rejects non-finite (`Infinity` / `NaN`) inputs as invalid instead of returning a successful result containing `NaN`; a failed computation no longer renders "NaN" to the pilot (safety-critical, release-audit TECH-003/004, CS-002, #293)
- Unknown / unrecognized fuel types now fail closed with a warning instead of silently substituting a default density; fuel-type enum unified across profile schema, runtime context, and catalogue (`MOGAS` / `AVGAS` → canonical `MoGas` / `AvGas 100LL`) (safety-critical, release-audit TECH-010/011/013, CS-008/009/010, #293)

### Security

- Strict `Content-Security-Policy` meta tag added (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; `style-src` permits inline for Vue scoped styles) (release-audit CS-005, #293)
- Aircraft-profile import guarded by a 256 KB file-size cap plus MIME / extension checks before the file is read or parsed (release-audit CS-003, #293)
- Numeric profile fields constrained with finite + physical-range validation, blocking absurd magnitudes from reaching the math core (release-audit CS-002, #293)
- `vue-devtools` excluded from production builds and `DEBUG` / `INFO` console output suppressed in production builds (release-audit DP-016 / DP-011, #293)
- `serve` moved from runtime `dependencies` to `devDependencies` to shrink the install surface (release-audit CS-013, #293)

### Engineering

- `trace/` YAML registries populated for REQ-AC, REQ-AD, REQ-SYS, REQ-UI modules (91 milestone REQ refs across 5 implementation registries); CI Traceability Gate workflow (warn-only before v1.0.0); gate documentation in `TESTING.md` and `CONTRIBUTING.md` (closes #71, #170)
- Aircraft profile `status` canonical values lowercased to `draft` / `verified` with Zod normalization of legacy Title Case and IndexedDB v2 migration (ADR-010, closes #157)
- 40 canonical bilinear interpolation unit tests (VEC-TOR-001..015, VEC-TOD-001..004, VEC-LR-001..006, VEC-LD-001..005, VEC-EDGE-001..010) passing in CI P1 isolation
- Unit + integration tests: `fleet.repository.spec.ts` (UT-AC-STORE-034..047), `fleet.store.spec.ts` (UT-AC-STORE-048..067, 080..082), `active-aircraft.store.spec.ts` (UT-AC-STORE-068..083), `useSessionPersistenceStore` (16 tests), `app-version-blocked.spec.ts`, 11 AD core tests (UT-AD-CORE-050..060), editor component tests (UT-AC-VIEW-093, 100..164), `AircraftModelSelector` / `aircraft-model-catalogue` / `FleetList` / `ProfileStatusBadge` tests; offline E2E smoke (`offline-smoke.feature`); `fleet.store.ts` branch coverage 96.66% — all P2 modules ≥ 80% threshold
- Trace ID collisions resolved in `trace/unit_test/ac.yaml`; in-code `@UT-AC-STORE-NNN@` annotations aligned to YAML registry
- Vite upgraded `^7.3.2` → `^8.0.8`; `build.target` pinned to `['chrome107', 'edge107', 'firefox104', 'safari16.0']` to preserve the prior browser-compatibility envelope (continuity for pilots on older iPads / Chromebooks)
- GitHub Actions runners bumped to Node.js 24 (`actions/checkout@v5`, `actions/upload-artifact@v5`, `actions/upload-pages-artifact@v5`, `github/codeql-action@v4`) ahead of the June 2 2026 Node.js 20 cutover
- Transitive dev-dep vulnerability patches via `pnpm.overrides`: `basic-ftp >=5.3.1` (GHSA-rpmf-866q-6p89), `ip-address >=10.1.1` (GHSA-v2v4-37r5-5v8g), `uuid >=11.1.1` (GHSA-w5hq-g745-h8pq) — all dev-only paths, runtime unaffected
- ADRs: 006 (IndexedDB fleet persistence), 007 (aircraft data update pipeline, closes #167), 008 (IndexedDB migration strategy), 009 (powertrain discriminator), 010 (canonical status values), 316 (PWA update lifecycle); `docs/architecture/aircraft-exchange-file-format.md`
- `ASSUMPTIONS.md`: device capabilities, user competence boundaries, catalogue data scope (closes #168)
- `.cursor/` developer tooling migrated to Claude Code primitives under `.claude/`: 5 audit subagents, `/audit.full` orchestrator, skill bundles for `milestone` / `e2e` / `gherkin` / `traceability` / `implement-issue`; `/issue` and `/pr.create` commands; CLAUDE.md trimmed 440 → 173 lines
- `frontend/.stryker-tmp/` excluded from `.gitignore` and `markdownlint-cli2` ignore list
- Milestone 3 issue recovery: backfilled `Closes #` keywords for tasks #71, #156, #157, #158, #159, #160, #161, #162, #163, #165, #166, #167, #170 whose source PRs merged without auto-close
- `Deploy CI Reports to GitHub Pages` workflow repaired so Vitest, coverage, Stryker and Playwright pages stop 404'ing or returning empty reports: `pnpm --filter frontend exec vitest …` (was a missing-script lookup → ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT), `pnpm test:e2e` so `bddgen` compiles `.feature` files before Playwright (was "No tests found"), and rename Stryker `mutation.html` → `index.html` (was no directory index under `/stryker/`)
- Release-audit remediation: 5-domain audit (`.logs/audit.*-2026-05-08.md`) triaged against milestones; 13 blocker bundles fixed for this release and 35 deferred findings filed as milestone-scoped issues #259–#292 / #294 (tracked under #293, closes #293)
- E2E traceability corrected: `@E2E-` tags moved from `.ts` step definitions into `.feature` files, E2E IDs renumbered to the phase namespace (A / B / D), dangling `@UJ-SYS-001` / `@UJ-F-002` references resolved, and the passing fleet-selection + offline-smoke flows un-`@wip` (release-audit PR-001/003/004; TECH-006 partial — remaining M&B-math E2E flows tracked in #294)
- Write-capable remediation subagents `fix-{tech,cybersecurity,dp,process,ux}`, the `release-audit` skill, and the `/release-audit` command added under `.claude/` to process future release audits end-to-end
- `release` skill and `/release` command added under `.claude/` to author the pilot-facing GitHub release description from the changelog + milestone and run the full Gitflow publish end-to-end (PR release→main, signed tag, GitHub Release, back-merge to develop)

## [0.2.0-alpha] - 2026-04-03

### Added

- Root `ARCHITECTURE.md` establishing the high-level PWA design, data flow, and safety constraints
- Standardized API documentation in `docs/api/API.md` detailing offline-first fallback and error schemas
- Online/Offline state detection and feature gating requirements
- Canonical `AircraftProfileSchema` Zod schema as the validation entry gate for the Aircraft Profile aggregate-root, M&B, and future modules
- Vue 3 frontend application shell and modular feature scaffolding for aircraft, mass-balance, weather, performance, export, and sync domains
- End-to-end Mass & Balance user workflow with station inputs, CG envelope charting, and result summary presentation
- Core mass-balance domain logic, aircraft-data adapters, and notification schema validation with comprehensive test coverage

### Fixed

- Mass & balance error handling in the store and UI module

### Engineering

- Dual licensing: EUPL-1.2 for source code (root `LICENSE`) and CC BY-SA 4.0 for documentation (`LICENSE-DOCUMENTATION`); README, DISCLAIMER, and dependency policy updated accordingly
- Added unified `ci.yml` workflow as the required PR gate for `develop`: runs unit tests, type-check, lint (oxlint + ESLint), and build in parallel; merges blocked when any check fails (refs #23)
- Fixed `test` script in `frontend/package.json` to invoke Vitest directly instead of echoing a placeholder notice (refs #23)
- Added `CI / Unit Tests`, `CI / Type Check`, `CI / Lint`, and `CI / Build` as required status checks on `develop` branch protection (refs #23)
- SemVer changelog automation: `release-it` + `@release-it/conventional-changelog` installed; `pnpm run release` script added; `release.yml` CI pipeline triggers on `release/**` and `hotfix/**` branches (refs #22)
- Integrated CodeQL SAST, `pnpm audit` dependency scanning, and Dependabot automated upgrade PRs to protect against vulnerable or malicious third-party packages (refs #29)
- Unified GitHub Pages deployment into a single `deploy-reports.yml` workflow: traceability matrix, Vitest HTML test results, coverage report, Stryker mutation report (gracefully skipped when unavailable), and Playwright E2E report (gracefully skipped when unavailable) are all deployed to organized sub-directories under a landing index page on every push to `main` (refs #107)
- Added CI pipeline for Playwright E2E tests: build frontend, run BDD scenarios on Chromium, upload HTML report and traces as artifacts on failure (refs #106)
- Canonical math test vector framework: Zod-validated JSON vectors for DA40 and P2008 with automated CG algorithm verification against POH-derived values
- Fixed Markdown linting hook to run efficiently on staged files via `lint-staged`
- Implemented P1/P2/P3 architectural dependency isolation with ESLint `no-restricted-imports`, dedicated `vitest.config.p1.ts`, and CONTRIBUTING.md classification guide
- Defined and setup src and testing file structure
- Defined frontend framework (Vue 3) and testing framework (Vitest, Playwright, Playwright-BDD) and initialized them
- Migrated repository dependency management to pnpm workspaces with updated root and frontend tooling configuration
- Added CI pipelines for linting, Vitest execution, and devcontainer build/publish workflows
- Expanded traceability artifacts for unit, integration, and e2e mappings aligned to implemented requirements
- Cursor agent workflow: milestone check command with configurable milestone input; command create/update/optimize helpers and authoring rules for `.cursor` assets
- Implementation roadmap and trace matrices updated for fleet management and mass-balance domains (e2e, unit, and implementation YAML)
- Router unit tests added; unused Vue counter scaffold removed; minor mass-balance UI and aircraft adapter adjustments
- Playwright BDD: certification category switch scenario and consolidated fleet-management step definitions
- Privacy and data protection summary in `PRIVACY.md`
- Root `serve` script to preview production builds locally
- Release-it configuration and Markdown lint rules adjusted so release branches avoid conflicting generated changelogs
- GitHub PR Cursor rules updated to match the repository pull request template
- Implementation roadmap refreshed with audit findings

### Architecture Decision Records

- ADR 002: Frontend framework (Vue 3)
- ADR 309 DEV: Frontend tooling and testing framework (Vitest, Playwright)
- ADR 310 DEV: Vue/Vite plugins (`vite-plugin-pwa`, `vue-chartjs`, `@vite-pwa/assets-generator`)
- ADR 311 DEV: Project directory structure (Modules pattern)
- ADR 312 DEV: End-to-End BDD framework (`playwright-bdd`)

### Action items

- Ref #114 Partial implemented requirements, full implementation deferred to v0.3.0
- Ref #115 Missing implementation, deferred to v0.3.0
- Ref #116 Missing implementation / traceability of designs, deferred to v0.3.0

## [0.1.0-pre-alpha.1] - 2026-02-28

This hotfix resolves a deployment issue with the traceability engine.

### Engineering

- Fixed defective `shtracer` Git submodule with directly tracked repository files to enable successful GitHub Pages deployment in CI.

## [0.1.0-pre-alpha] - 2026-02-27

Initial project foundation. This milestone establishes governance,
developer experience tooling, and the complete product documentation suite.
**No runtime code is included in this release.**

### Added

- Bilingual README and Disclaimer with intended use, system boundaries, PIC authority, and POH primacy clause

### Engineering

- Added full requirements suite (115 REQs across 12 modules), hazard analysis (19 hazards), and user journeys (22 UJs across 7 phases) as developer blueprints
- Added notification system design and domain glossary
- Added bilingual Code of Conduct with aviation Just Culture, contributing guidelines, dependency and licensing policy, and security vulnerability reporting
- Added Gitflow strategy with protected branch rules, PR template with safety and quality checklists, and issue templates (feature, bug, sub-task)
- Added Markdown linting (markdownlint-cli2 in CI), conventional commit enforcement (commitlint + husky hooks), and code ownership rules
- Added shtracer engine integration, automated HTML/JSON matrix generation, and GitHub Pages deployment on release

### Architecture Decision Records

- ADR 001: Notification System
- ADR 300–308 DEV: Documentation as Code, Branching Strategy, Contributing Guidelines, Ticket Workflow, Testing Guidelines, Linting Strategy, Local Hooks, Master Traceability Structure, Traceability Engine

[0.3.0-alpha]: https://github.com/naturelle137/AeroDash/releases/tag/v0.3.0-alpha
[0.2.0-alpha]: https://github.com/naturelle137/AeroDash/releases/tag/v0.2.0-alpha
[0.1.0-pre-alpha.1]: https://github.com/naturelle137/AeroDash/releases/tag/v0.1.0-pre-alpha.1
[0.1.0-pre-alpha]: https://github.com/naturelle137/AeroDash/releases/tag/v0.1.0-pre-alpha

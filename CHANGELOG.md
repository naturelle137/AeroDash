# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Engineering

- Fix `Deploy CI Reports to GitHub Pages` workflow so Vitest, coverage, Stryker and Playwright pages stop 404'ing or returning empty reports: `pnpm --filter frontend exec vitest …` (was a missing-script lookup), `pnpm test:e2e` so `bddgen` runs before Playwright (was "No tests found"), and rename Stryker `mutation.html` → `index.html` (was no directory index)

## [0.3.0-alpha] - 2026-05-07

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

### Fixed

- CG migration leaving the envelope during fuel burn-down now triggers the missing out-of-envelope warning (closes #120, REQ-MB-011, H-006)
- Input validation errors now highlight the affected input field (closes #119, REQ-UQ-003)
- CG-out-of-envelope vs MTOM-exceeded notification mismatch resolved (closes #118)

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

[0.2.0-alpha]: https://github.com/naturelle137/AeroDash/releases/tag/v0.2.0-alpha
[0.1.0-pre-alpha.1]: https://github.com/naturelle137/AeroDash/releases/tag/v0.1.0-pre-alpha.1
[0.1.0-pre-alpha]: https://github.com/naturelle137/AeroDash/releases/tag/v0.1.0-pre-alpha

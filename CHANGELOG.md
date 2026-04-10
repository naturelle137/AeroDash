# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- PWA Service Worker with offline-first app shell caching via `vite-plugin-pwa` and Workbox (closes #150)
- PWA update notification (`INFO-SYS-001`) — no silent auto-update, user must confirm reload (`registerType: 'prompt'`) (closes #151)
- Minimum safe version enforcement on startup (`useAppVersionStore.checkMinSafeVersion`) — blocks execution when local version is below minimum (REQ-SYS-006)
- SemVer and build date injected at build time and displayed in app sidebar footer (`AppVersion.vue`) (REQ-UI-013)
- `ASSUMPTIONS.md`: device capabilities, user competence boundaries, catalogue data scope (closes #168)
- Bilinear interpolation engine (`performance.bilinear-interpolation.ts`) in P1 Safety Core for 2-D POH performance table lookups (mass × pressure altitude → distance); covers TOR, TOD, LR, LD with conservative boundary clamping (closes #155, #169)
- Canonical bilinear interpolation algorithm contract document (`docs/architecture/performance-bilinear-interpolation-contract.md`) with hand-verified test vectors for all four distance types
- `SessionPayloadSchema` Zod schema in P1 core for validating persisted pilot session data before restoration (`session.schema.ts`)
- `useSessionPersistenceStore` Pinia store (P3) that debounces auto-save of M&B pilot inputs to `localStorage`, validates and restores payload on page reload, and clears on aircraft switch (closes #152, #164)
- Aircraft fleet CRUD with IndexedDB persistence, ICAO validation, duplicate detection (closes #144)
- Draft/Verified profile status with immutable versioned snapshots [SAFETY-CRITICAL] (closes #145)
- Aircraft model hierarchy selector (closes #146)
- Passenger profiles with standard weights in load inputs (closes #147)
- Import aircraft profile from exchange file (closes #148)
- Supplementary aircraft profile fields: costPerHour, checklistScaffold (closes #149)
- In-session aircraft switching without full page reload (closes #153)
- AircraftContext schemaVersion field for structured migration safety (closes #154)

### Engineering

- Populated `trace/` YAML registries for REQ-AC, REQ-AD, REQ-SYS, REQ-UI modules (v0.3.0) (closes #170)
- Added CI Traceability Gate workflow (warn-only before v1.0.0) (closes #71)
- Added traceability gate documentation to `docs/testing/TESTING.md` and `CONTRIBUTING.md`
- 33 unit tests (ICAO validation × 16, import × 8, fleet FSM × 9) and 4 IndexedDB integration tests all passing
- verifyProfile() now auto-updates active aircraft context when the verified Draft was in use
- Canonical bilinear interpolation test vectors (TOR, TOD, LR, LD) established and passing in CI — de-risk for v0.4.0 performance distance calculations (closes #155)
- 40 canonical bilinear interpolation unit tests (VEC-TOR-001–015, VEC-TOD-001–004, VEC-LR-001–006, VEC-LD-001–005, VEC-EDGE-001–010) all passing in CI P1 isolation mode
- 16 unit tests for `useSessionPersistenceStore` covering save, restore, clear, debounce, and round-trip scenarios

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

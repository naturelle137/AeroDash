# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Root `ARCHITECTURE.md` establishing the high-level PWA design, data flow, and safety constraints
- Standardized API documentation in `docs/api/API.md` detailing offline-first fallback and error schemas
- Online/Offline state detection and feature gating requirements
- Canonical `AircraftProfileSchema` Zod schema as the validation entry gate for the Aircraft Profile aggregate-root, M&B, and future modules
- Vue 3 frontend application shell and modular feature scaffolding for aircraft, mass-balance, weather, performance, export, and sync domains
- End-to-end Mass & Balance user workflow with station inputs, CG envelope charting, and result summary presentation
- Core mass-balance domain logic, aircraft-data adapters, and notification schema validation with comprehensive test coverage

### Engineering

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

### Architecture Decision Records

- ADR 002: Frontend framework (Vue 3)
- ADR 309 DEV: Frontend tooling and testing framework (Vitest, Playwright)
- ADR 310 DEV: Vue/Vite plugins (`vite-plugin-pwa`, `vue-chartjs`, `@vite-pwa/assets-generator`)
- ADR 311 DEV: Project directory structure (Modules pattern)
- ADR 312 DEV: End-to-End BDD framework (`playwright-bdd`)

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

[unreleased]: https://github.com/naturelle137/AeroDash/compare/v0.1.0-pre-alpha.1...HEAD
[0.1.0-pre-alpha.1]: https://github.com/naturelle137/AeroDash/compare/v0.1.0-pre-alpha...v0.1.0-pre-alpha.1
[0.1.0-pre-alpha]: https://github.com/naturelle137/AeroDash/releases/tag/v0.1.0-pre-alpha

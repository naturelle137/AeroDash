# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Root `ARCHITECTURE.md` establishing the high-level PWA design, Data Flow, and safety constraints
- Standardized API documentation in `docs/api/API.md` detailing offline-first fallback and error schemas
- Online/Offline state detection and feature gating requirements (`system.md`, `user_interface.md`)

### Added

- Canonical `AircraftProfileSchema` Zod schema for the full Aircraft Profile aggregate-root document, providing the validation entry gate for M&B and future modules (Ref #100, REQ-AD-001, REQ-AD-002, REQ-AD-003, REQ-AD-005, REQ-AD-011, REQ-AD-012)

### Engineering

- Canonical math test vector framework: Zod-validated JSON vectors for DA40 and P2008 aircraft with automated test runner verifying CG algorithms against POH-derived values (Ref #95)
- Fixed Markdown linting hook to run efficiently on staged files via `lint-staged` (Ref #78)
- Implemented P1/P2/P3 architectural dependency isolation (Ref #50):
  ESLint `no-restricted-imports` rule blocks framework and higher-layer imports
  from `src/core/`, a dedicated `vitest.config.p1.ts` proves P1 tests pass in
  a pure Node.js environment, and CONTRIBUTING.md §8 provides the classification
  guide and mandatory P1 PR checklist. See ADR 314-DEV-dependency-isolation.
- Defined and setup src and testing file structure
- Defined frontend framework (Vue 3) and testing framework (Vitest, Playwright, Playwright-BDD) and initialized them

### Architecture Decision Records

- ADR 002: Frontend framework (Vue 3)
- ADR 309 DEV: Frontend tooling and testing framework (Vitest, Playwright)
- ADR 310 DEV: Vue/Vite plugins (`vite-plugin-pwa`, `vue-chartjs`, `@vite-pwa/assets-generator`)
- ADR 311 DEV: Project directory structure (Modules pattern)
- ADR 312 DEV: End-to-End BDD framework (`playwright-bdd`)

## [0.1.0-pre-alpha.1] - 2026-02-28

This hotfix resolves a deployment issue with the traceability engine.

### Engineering

- **Fixed:** Replaced defective `shtracer` Git submodule with directly tracked repository files to enable successful GitHub Pages deployment in CI.

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

# CLAUDE.md — AeroDash

## Project Overview

AeroDash is a **Safety-Critical, Offline-First Progressive Web Application (PWA)** for General Aviation flight preparation (Mass & Balance, Performance, Fuel/Endurance). It is a `pnpm` monorepo with a single `frontend/` workspace package. All data persists in the browser via IndexedDB — no backend is required locally.

> **Guiding Principle:** "Don't guess. Know. Flight-grade precision for command decisions."
> A defect in the Safety Core could cause an incorrect Go/No-Go advisory. Correctness always takes priority over speed.

---

## Monorepo Layout

```text
aerodash/              ← repo root (pnpm workspace)
├── frontend/          ← the Vue 3 PWA workspace package
│   └── src/
│       ├── core/      ← 🔴 P1 Safety Core (Pure TS — ZERO framework deps)
│       ├── modules/   ← 🟡 P2 Feature Modules (Vue + Pinia)
│       ├── shared/    ← 🔵 P3 App Shell (Base components, layouts, utils)
│       ├── plugins/   ← 🔵 P3 Cross-cutting services (Notification Bus)
│       ├── stores/    ← 🔵 P3 Global Pinia stores
│       ├── router/    ← 🔵 P3 Vue Router
│       └── assets/
├── docs/              ← Requirements, ADRs, User Journeys, Testing guidelines
├── .tools/shtracer/   ← Traceability engine (DO NOT modify without ADR)
└── trace/             ← Generated traceability reports
```

### Module Directories (`frontend/src/modules/`)

Each module owns its own `components/`, `composables/`, `stores/`, `services/`, and `views/`:

- `mass-balance/` — M&B calculations
- `performance/` — TOLD performance
- `fuel-endurance/` — Fuel & endurance
- `weather/` — METAR/meteorological data
- `aircraft/` — Aircraft management
- `airport/` — Airport database
- `sync/` — Cloud sync (future M6)
- `export/` — Documentation & export

---

## Tech Stack

| Layer | Technology |
| :---- | :--------- |
| Framework | Vue 3 (Composition API, SFCs — **no JSX**) |
| Language | Strict TypeScript |
| Build | Vite |
| State | Pinia |
| Routing | Vue Router |
| Schema/Validation | Zod (P1 only) |
| Unit/Integration tests | Vitest |
| E2E tests | Playwright BDD (`playwright-bdd`) |
| Linting | ESLint + Oxlint + Prettier |
| Docs linting | `markdownlint-cli2` |
| Package manager | pnpm (via Corepack) |
| Git hooks | Husky + commitlint + lint-staged |
| Node.js | `^20.19.0 \|\| >=22.12.0` (devcontainer ships Node 24 LTS) |

---

## Essential Commands

All commands run from the **repo root** unless noted.

```bash
# Development
pnpm dev                          # Vite dev server on :5173

# Build
pnpm build                        # Type-check + Vite production build

# Type-check only
pnpm --filter frontend type-check

# Linting
pnpm lint                         # oxlint + eslint + markdownlint (all)
pnpm lint:md                      # Markdown only
pnpm lint:eslint                  # ESLint only (includes P1-ISOLATION checks)
pnpm lint:oxlint                  # Oxlint only

# Auto-fix markdown
pnpm exec markdownlint-cli2 --fix "**/*.md"

# Testing
pnpm test:unit                    # Vitest unit tests
pnpm test:integration             # Vitest integration tests
pnpm test:e2e --project=chromium  # Playwright E2E (use --project=chromium on Linux VMs)
pnpm test:smoke                   # Smoke suite (@smoke tagged tests)
pnpm coverage:unit                # Unit test coverage report

# P1 Safety Core tests in isolation (Node env, zero framework deps)
pnpm --filter frontend test:p1
pnpm --filter frontend vitest run --config vitest.config.p1.ts --coverage
```

> **Playwright gotcha:** The config includes an `edge` browser project when `CI` env var is not set. On Linux without MS Edge, always use `--project=chromium` or set `CI=true`. Playwright auto-starts the Vite dev server — no manual start needed for E2E.

---

## P1 / P2 / P3 Dependency Tiers — THE CRITICAL CONSTRAINT

This is the most important architectural rule. **Never violate it.**

| Tier | Path | May import from | Must NOT import |
| :--- | :--- | :-------------- | :-------------- |
| **P1** Safety Core | `src/core/` | `node:*`, `zod`, other `src/core/` | `vue`, `pinia`, `vue-router`, ANY `src/modules/`, `src/shared/`, `src/stores/`, `src/plugins/`, `src/router/` |
| **P2** Feature Modules | `src/modules/` | P1 + Vue + Pinia + other modules | `src/shared/`, `src/stores/` (read via Pinia only) |
| **P3** App Shell | `src/shared/`, `src/stores/`, `src/plugins/`, `src/router/` | P1 + P2 + Vue + Pinia + Vue Router | — |

### Decision Rule for New Code

> *"Can a defect here produce an incorrect Go/No-Go advisory?"*
>
> - YES → **P1**
> - Modifies data that feeds P1 → **P2**
> - Otherwise → **P3**

### How P1 Communicates Outward

P1 functions are **pure**: accept validated input, return typed results (`MathCoreResult`, `Violation[]`). They never call back into P2/P3. Contracts P3 must implement (e.g. notification types) are defined as interfaces in `src/core/domain/` — P3 imports them, never the reverse.

### Fixing a `[P1-ISOLATION]` ESLint Error

1. Identify the illegal import in `src/core/`.
2. Move the type/interface to `src/core/domain/` as pure TypeScript.
3. If it needs a framework: the logic does **not** belong in `src/core/` — reclassify to P2.
4. **Never add `// eslint-disable` to suppress a `[P1-ISOLATION]` error** — treated as a critical defect.

---

## Commit Standards (Conventional Commits — Enforced by Husky)

Format: `type(scope): description`

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Allowed scopes:**

| Scope | Module |
| :---- | :----- |
| `ac` | Aircraft Management |
| `ap` | Airport Database |
| `ad` | Detailed Aircraft Data |
| `fe` | Fuel & Endurance |
| `mb` | Mass & Balance |
| `pf` | Performance |
| `wx` | Weather & Meteorological Data |
| `ui` | User Interface |
| `uq` | Usability & Quality |
| `sys` | General System Requirements |
| `doc` | Documentation & Export |
| `sc` | Cloud Sync & Collaboration |
| `repo` | Repository / CI / Meta Tooling |

**Example:** `feat(mb): implement lateral CG calculation bounds (refs #42, REQ-MB-005)`

Reference issue numbers and requirement IDs when applicable.

---

## Branching Strategy (Gitflow)

| Branch | Purpose |
| :----- | :------ |
| `main` | Production only — tagged releases. Never commit directly. |
| `develop` | Integration branch for next release. Never commit directly. |
| `feature/<desc>` or `feature/issue-<n>` | New features and non-critical bug fixes. Branch from `develop`, PR back to `develop`. |
| `release/v<semver>` | Stabilization. Branch from `develop`, merge to `main` + back to `develop`. |
| `hotfix/<desc>` | Critical production bugs. Branch from `main`, merge to `main` + `develop`. |

**Never commit directly to `main` or `develop`.** All changes go through Pull Requests.

---

## Testing Standards (Risk-Based Coverage)

| Tier | Path | Required Coverage |
| :--- | :--- | :---------------- |
| **P1** Safety Core | `frontend/src/core/` | **90%** line + branch + function |
| **P2** Feature Modules | `frontend/src/modules/` | **80%** minimum |
| **P3** UI & Shared | `frontend/src/shared/`, `plugins/`, `stores/` | **60%** minimum |

### Test Types

- **Unit tests (`*.spec.ts`):** Absolute isolation. No network, no DB, no disk. Co-located with source (`core/`, `plugins/`, `stores/`) or in local `__tests__/` (for `modules/`, `shared/`).
- **Integration tests (`*.int.spec.ts`):** Two or more internal modules. External APIs must be mocked (MSW/fixtures). In `__tests__/` folders or `tests/integration/`.
- **E2E tests (`*.feature` + step defs):** BDD via `playwright-bdd`. Driven by `docs/journeys/`. Lives in `tests/e2e/`.
- **Smoke tests:** Tagged `@smoke`. Subset run first in CI.

### Mocking Rules

- Weather (METAR/TAF): Always use hardcoded fixture strings. Never hit live aviation APIs in tests.
- GPS/Location: Use static coordinate fixtures.
- Aircraft profiles: Use standard "Test Aircraft" from `tests/fixtures/`.
- Pinia stores: Mocked in unit tests; real in integration tests.

---

## Traceability Tags (shtracer) — Required in All New Files

Every source file, test file, and E2E feature must carry traceability tags linking to the requirements/implementation chain.

```text
Hazard (H-xxx) → Requirement (REQ-xxx) → User Journey (UJ-xxx) → E2E Test (E2E-xxx)
                                       → Implementation (IMP-xxx)
                                       → Unit Test (UT-xxx) / Integration Test (IT-xxx)
```

| File type | Tag prefix | Placement | Example |
| :-------- | :--------- | :-------- | :------ |
| Source (`*.ts`, `*.vue`) | `@IMP-XX-NNN@` | Inline comment | `// @IMP-MB-001@ (FROM: @REQ-MB-001@)` |
| Unit test (`*.spec.ts`) | `@UT-XX-NNN@` | File comment | `// @UT-SYS-001@ (FROM: @IMP-SYS-001@)` |
| Integration test (`*.int.spec.ts`) | `@IT-XX-NNN@` | File comment | `// @IT-SYS-001@ (FROM: @IMP-SYS-002@)` |
| E2E BDD (`*.feature`) | `@E2E-XX-NNN@` | `#` comment in `.feature` file | `# @E2E-STRESS-001@ (FROM: @UJ-STRESS-001@)` |

> For BDD tests, tags go in the `.feature` file (living documentation), **not** in `.ts` step definitions.

---

## Requirements Engineering

Requirements live in `docs/requirements/` using **EARS syntax** (Easy Approach to Requirements Syntax). Format: `REQ-<MODULE>-<NNN>`.

Priority aligns with code tiers:

- **P1** — Safety-critical (must have 90% coverage + ADR for changes)
- **P2** — Standard operational
- **P3** — Nice-to-have / polish

Module identifiers: `AC`, `AP`, `AD`, `FE`, `MB`, `PF`, `WX`, `UI`, `UQ`, `SYS`, `DOC`, `SC`

---

## Quality Gates

### Pre-commit (Husky — automatic on `git commit`)

- `markdownlint-cli2` on all `*.md` files
- `commitlint` enforces Conventional Commits format + allowed scopes

### Pre-push (lint-staged)

- `oxlint` + `eslint` on `frontend/**/*.{js,ts,vue,json,yaml,yml}`

### CI (GitHub Actions on every PR)

- Full lint suite (`lint:ci:oxlint` + `lint:ci:eslint`)
- Unit + integration + E2E tests
- Coverage thresholds enforced (P1: 90%, P2: 80%, P3: 60%)
- P1-ISOLATION ESLint rule must produce zero violations

---

## P1 Pull Request Checklist (Mandatory for any `src/core/` change)

Before completing a PR that touches `src/core/`, verify:

- [ ] No `vue`, `pinia`, or `vue-router` imports in modified files
- [ ] `pnpm --filter frontend test:p1` passes (Node.js env, zero P2/P3 deps)
- [ ] `pnpm --filter frontend run lint:ci:eslint` — zero `[P1-ISOLATION]` warnings
- [ ] All new exported functions are pure (deterministic, side-effect free)
- [ ] All external inputs validated with Zod before reaching math logic
- [ ] 90% line + branch + function coverage on new P1 code
- [ ] If a new top-level `src/` directory was added, update `no-restricted-imports` in `frontend/eslint.config.ts`
- [ ] An ADR exists or has been updated if the P1 interface surface changed

---

## PR Standards

- Use `.github/pull_request_template.md` — check all applicable boxes
- If changes affect Requirements, Architecture, or Risk Mitigation: update `docs/` in the same PR
- Add entry under `## [Unreleased]` in `CHANGELOG.md` (`### Added`, `### Changed`, `### Fixed`, or `### Engineering`)
- If a P1 requirement is added/modified: verify it is tagged in at least one User Journey in `docs/journeys/`
  - Check: `grep -r "@REQ-XX-YYY@" docs/journeys/`
- P1 changes require ADR (new or updated in `docs/architecture/adr/`)

---

## Markdown Linting

All `.md` files are linted with `markdownlint-cli2`. Run before committing docs:

```bash
# Check
pnpm exec markdownlint-cli2 "**/*.md" "#.tools" "#.logs" "#node_modules"

# Auto-fix
pnpm exec markdownlint-cli2 --fix "**/*.md"
```

Exclusions for lint: `.tools/`, `.logs/`, `node_modules/`

---

## Key Architectural Documents

| Document | Purpose |
| :------- | :------ |
| `ARCHITECTURE.md` | System overview, data flow, layer definitions |
| `CONTRIBUTING.md` | Full contribution rules, P1/P2/P3 guide, commit scopes |
| `docs/requirements/README.md` | Requirements syntax (EARS), module IDs, traceability chain |
| `docs/testing/TESTING.md` | Test tiers, coverage thresholds, mocking rules |
| `docs/development/BRANCHING_STRATEGY.md` | Gitflow rules and CLI commands |
| `docs/architecture/adr/` | All Architectural Decision Records |
| `docs/journeys/` | User Journeys (BDD source of truth for E2E) |
| `docs/risk_management/safety_hazards.md` | Hazard register (H-xxx IDs) |
| `.tools/.shtracer.md` | Traceability engine configuration |

---

## Issue Workflow for Agents

When processing GitHub issues, follow these steps exactly. Full rules in `docs/architecture/adr/303-DEV-ticket-workflow.md`.

### Starting Work on a Ticket

1. Read the issue with `mcp__github__get_issue`.
2. **Set project status to `In Progress`** on the `AeroDash Dashboard` project board before writing any code.
   - Resolve project/item/field IDs via `gh project list`, `gh project item-list`, `gh project field-list`.
   - Update: `gh project item-edit --project-id <ID> --id <ITEM_ID> --field-id <STATUS_ID> --single-select-option-id <IN_PROGRESS_ID>`
3. Implement the work on a `feature/*` branch.

### Creating the PR

1. Use `.github/pull_request_template.md` as the PR body template.
2. Reference the issue with `Closes #<ISSUE_ID>` — this closes the issue automatically on merge to `develop`.
3. **Set project status to `In Verification`** on the project board.

### After PR Merges to `develop`

- GitHub auto-closes the issue and applies the `fixed` label (via `Closes #` keyword).
- Verify the project status moved to `Done`. Correct manually if needed.

### Issue Label Flow

```text
open → accepted → fixed (closed, PR merged to develop)
open → duplicate (closed, link canonical issue)
open → wont do  (closed, rationale documented)
```

There is **no `ready` label** and **no `Ready for Release` status**. Issues close on `develop` merge, not on `main` merge.

### Parent / Sub-Task Rules

- **`Task` (sub-task):** Close with `fixed` when its own PR merges to `develop`.
- **`Feature` / `Bug` (parent):** Close with `fixed` only after **all** child `Task` issues are closed.

---

## What NOT to Do

- **Never** add `vue`, `pinia`, `vue-router`, or any P2/P3 import inside `src/core/`
- **Never** suppress a `[P1-ISOLATION]` ESLint error with `// eslint-disable`
- **Never** commit directly to `main` or `develop`
- **Never** skip Husky hooks (`--no-verify`) — they are safety gates
- **Never** write tests that hit live external APIs (aviation weather, GPS)
- **Never** use JSX — Vue SFCs only
- **Never** put P1 math logic directly inside `src/modules/` — it must live in `src/core/`
- **Never** add `// eslint-disable` comments without documenting the architectural reason in the PR

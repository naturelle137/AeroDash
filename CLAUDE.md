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

When processing GitHub issues, follow these steps exactly. Full rules in `docs/architecture/adr/303-DEV-ticket-workflow.md` and `CONTRIBUTING.md §10`.

### Issue Types

| Type | Meaning | Has children? |
| :--- | :------ | :------------ |
| `Feature` | New functionality or enhancement (product or engineering). | Can have child `Task` issues. |
| `Bug` | Flaw, error, or regression. | Can have child `Task` issues. |
| `Task` | Concrete sub-step of a parent `Feature` or `Bug`. Never stands alone. | No. Always has a parent. |

### Required Labels

Every issue must carry exactly one label from each of the following sets during its lifetime:

| Set | Values | When applied |
| :-- | :----- | :----------- |
| **Type** | `Feature`, `Bug`, `Task` | At creation. |
| **Scope** | `product`, `engineering` | At creation — controls CHANGELOG section. |
| **Status** (open) | `open` → `accepted` | `open` on creation; `accepted` once triaged as valid. |
| **Resolution** (closed) | `fixed`, `duplicate`, `wont do` | Applied **only** at the moment of closing. |
| **Safety** (conditional) | `safety-critical` | If the issue touches P1 Safety Core. |
| **Module scope** (conditional) | `ac`, `ad`, `ap`, `fe`, `mb`, `pf`, `wx`, `ui`, `uq`, `sys`, `doc`, `sc`, `repo` | Matches commit scope of the work. |

### Lifecycle → Board Column → Label Map

| Phase | Board column | Status label | Resolution label | Agent action |
| :---- | :----------- | :----------- | :--------------- | :----------- |
| Created | `Backlog` | `open` | — | Wait for triage. |
| Triaged | `Waiting for Implementation` | `accepted` | — | Pick up when ready. |
| Working | `In Progress` | `accepted` | — | Agent sets this **before writing code**. |
| PR open | `In Verification` | `accepted` | — | Agent sets this **when PR is created**. |
| Merged to `develop` | `Done` | — | `fixed` | GitHub auto-closes via `Closes #`. Verify column moved. |
| Rejected / superseded | removed from board | — | `duplicate` or `wont do` | Document rationale in the closing comment. |

> There is **no `ready` label** and **no `Ready for Release` column**. Issues close on `develop` merge, not on `main` merge.

### Starting Work on a Ticket — Pre-Flight Checks

Before writing any code:

1. `mcp__github__issue_read` (method `get`) — read the issue.
2. **Identify the parent.** If it is a `Task`, read the "Parent Feature / Issue" field and fetch the parent with `mcp__github__issue_read`.
3. **Verify the parent is open.** If the parent is already closed:
   - **STOP.** Do not assume the task is greenfield work.
   - The parent closure is a workflow violation (see ADR-303). The code may already be partially or fully implemented by earlier work.
   - Before touching code: search `git log --all --grep="#<task-number>"` and inspect the DoD checkboxes against the current repo state. Confirm with the user what remains.
4. **Check sibling tasks.** Use `mcp__github__issue_read` with method `get_sub_issues` on the parent to find siblings; their status informs ordering and dependencies.
5. Confirm the issue is `accepted` (not `open` awaiting triage, not already `fixed`).
6. **Set project status to `In Progress`** on the `AeroDash Dashboard` project board before writing code.
   - Resolve project/item/field IDs via `gh project list`, `gh project item-list`, `gh project field-list`.
   - Update: `gh project item-edit --project-id <ID> --id <ITEM_ID> --field-id <STATUS_ID> --single-select-option-id <IN_PROGRESS_ID>`
7. Create a `feature/issue-<n>-<desc>` branch from `develop`.

### Creating the PR

1. Use `.github/pull_request_template.md` as the PR body template.
2. **Target `develop`.** Never target a long-lived integration branch or a parent-feature branch — auto-close only fires when the PR merges to `develop`, `release/*`, or `hotfix/*`.
3. Reference the issue with `Closes #<TASK_ID>`. A PR closing multiple tasks lists them: `Closes #156, closes #157`.
4. **Set project status to `In Verification`** on the project board.

### After PR Merges to `develop`

- GitHub auto-closes each referenced issue and applies the `fixed` label (via `Closes #` keyword).
- Verify the project column moved to `Done`. Correct manually if needed.
- **Do not close the parent automatically.** See parent rules below.

### Parent / Sub-Task Rules — MANDATORY

- **`Task` (sub-task):** Closed with `fixed` when its own PR merges to `develop`. A `Task` closed as `wont do` counts as closed provided the rationale is documented in the closing comment.
- **`Feature` / `Bug` (parent):** May be closed with `fixed` **only after every child `Task` is closed**. A parent closed while any child remains `open` is a workflow defect.

#### Pre-Close Parent Checklist (run every time before closing a parent)

```text
□ List child tasks:    mcp__github__issue_read method=get_sub_issues issue_number=<parent>
□ Every child state == "closed" (status_reason = "completed" or "not_planned")
□ Every child carries exactly one resolution label: fixed, duplicate, or wont do
□ Parent DoD checklist is fully ticked
□ No sibling PR is still open against any child
```

If any box is unchecked: **do not close the parent.** Leave a comment noting the open child and move on.

#### Recovery: Open Task With a Closed Parent (Orphaned Sub-Task)

This is the situation milestone v0.3.0-alpha inherited. If you encounter it:

1. **Do not start coding blind.** The parent `Feature` / `Bug` was closed as `fixed`, which implies its child work was believed done — so the feature's code may already be in the repo, partially or fully.
2. **Audit what exists** before planning new work:
   - `git log --all --grep="#<task-number>"` — find commits that referenced this task (including `closes #` / `refs #`).
   - `git log --all --grep="<REQ-XX-YYY>"` — find commits that cite the task's requirement IDs.
   - Inspect the DoD checkboxes in the issue body against real files, schemas, tests, and `trace/` YAML entries.
   - Check the module's `trace/implementation/*.yaml` for IMP entries corresponding to the task's REQs.
3. **Summarise the gap for the user** before writing code. State what is present, what is missing, and what the minimum diff is to satisfy the DoD.
4. **Do not re-open the parent.** The parent's history is kept accurate as-is; the recovery PR closes the child and, if needed, ships a follow-up `Bug` issue to cover any gap discovered in the parent's scope.
5. If the task is fully satisfied by existing code, open a small PR that only adds the missing traceability / CHANGELOG / trace YAML entries and uses `Closes #<task-number>`. Explain in the PR body why no feature code was necessary.
6. If the task turns out to be a duplicate of already-merged work, close it as `duplicate` with a link to the implementing PR — do not invent a new PR just to satisfy auto-close.

### Issue Label Flow

```text
open → accepted → fixed (closed, PR merged to develop)
open → duplicate (closed, link canonical issue)
open → wont do  (closed, rationale documented)
```

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
- **Never** close a parent `Feature` / `Bug` while any child `Task` is still open — run the Pre-Close Parent Checklist first
- **Never** start coding on a `Task` whose parent is already closed without auditing the repo for existing implementation — see *Recovery: Open Task With a Closed Parent*
- **Never** target a PR at anything other than `develop` (or a `release/*` / `hotfix/*` branch) — `Closes #` auto-close only fires there

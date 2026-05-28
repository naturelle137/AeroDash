# CLAUDE.md — AeroDash

## Project Overview

AeroDash is a **Safety-Critical, Offline-First PWA** for General Aviation flight preparation (Mass & Balance, Performance, Fuel/Endurance). It is a `pnpm` monorepo with a single `frontend/` workspace package. All data persists in the browser via IndexedDB — no backend is required locally.

> **Guiding Principle:** "Don't guess. Know. Flight-grade precision for command decisions."
> A defect in the Safety Core could cause an incorrect Go/No-Go advisory. Correctness always takes priority over speed.

Operational scope: **EASA Part-NCO**, SEP, VFR + private IFR. Not certified. See `README.md` for full disclaimer and what AeroDash explicitly is NOT.

---

## Monorepo Layout

```text
aerodash/
├── frontend/          ← Vue 3 PWA workspace
│   └── src/
│       ├── core/      ← 🔴 P1 Safety Core (Pure TS — ZERO framework deps)
│       ├── modules/   ← 🟡 P2 Feature Modules (Vue + Pinia)
│       ├── shared/    ← 🔵 P3 App Shell
│       ├── plugins/   ← 🔵 P3 Cross-cutting services
│       ├── stores/    ← 🔵 P3 Global Pinia stores
│       └── router/    ← 🔵 P3 Vue Router
├── docs/              ← Requirements, ADRs, User Journeys, Testing
├── .tools/shtracer/   ← Traceability engine (DO NOT modify without ADR)
└── trace/             ← Generated traceability registries
```

Module names (`frontend/src/modules/`): `mass-balance`, `performance`, `fuel-endurance`, `weather`, `aircraft`, `airport`, `sync` (M6, future), `export`.

---

## P1 / P2 / P3 Dependency Tiers — THE CRITICAL CONSTRAINT

This is the most important architectural rule. **Never violate it.**

| Tier | Path | May import | Must NOT import |
| :--- | :--- | :--------- | :-------------- |
| **P1** Safety Core | `src/core/` | `node:*`, `zod`, other `src/core/` | `vue`, `pinia`, `vue-router`, ANY `src/modules/`, `src/shared/`, `src/stores/`, `src/plugins/`, `src/router/` |
| **P2** Feature Modules | `src/modules/` | P1 + Vue + Pinia + other modules | `src/shared/`, `src/stores/` (read via Pinia only) |
| **P3** App Shell | `src/shared/`, `src/stores/`, `src/plugins/`, `src/router/` | P1 + P2 + Vue + Pinia + Vue Router | — |

**Decision rule for new code:** *"Can a defect here produce an incorrect Go/No-Go advisory?"* YES → P1. Modifies data feeding P1 → P2. Otherwise → P3.

**P1 communicates outward** via pure functions returning typed results (`MathCoreResult`, `Violation[]`). Never calls back into P2/P3. Contracts P3 implements (e.g. notification types) are interfaces in `src/core/domain/` — P3 imports them.

For full P1 isolation rules, ESLint fix recipes, and library governance, see `CONTRIBUTING.md §8` and `docs/architecture/adr/314-DEV-dependency-isolation.md`.

---

## Tech Stack

Vue 3 (Composition API, SFCs — **no JSX**) · strict TypeScript · Vite · Pinia · Vue Router · Zod (P1 only) · Vitest · Playwright BDD (`playwright-bdd`) · ESLint + Oxlint + Prettier · markdownlint-cli2 · pnpm (Corepack) · Husky + commitlint + lint-staged.

Node: `>=22.12.0` (devcontainer ships Node 24 LTS).

---

## Essential Commands

All from repo root unless noted.

```bash
pnpm dev                           # Vite dev server :5173
pnpm build                         # type-check + production build
pnpm --filter frontend type-check  # type-check only

pnpm lint                          # oxlint + eslint + markdownlint
pnpm lint:eslint                   # ESLint (incl. P1-ISOLATION)
pnpm exec markdownlint-cli2 --fix "**/*.md"

pnpm test:unit
pnpm test:integration
pnpm test:e2e --project=chromium   # use --project=chromium on Linux
pnpm test:smoke
pnpm coverage:unit

pnpm --filter frontend test:p1     # P1 isolated, Node env, zero framework deps
```

> **Playwright gotcha:** Config includes `edge` project unless `CI=true`. On Linux without MS Edge, always use `--project=chromium`. Playwright auto-starts the dev server — no manual start needed for E2E.

---

## Commit Standards (Conventional Commits — Husky-enforced)

Format: `type(scope): description`

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Scopes:** `ac` (Aircraft), `ap` (Airport), `ad` (Detailed Aircraft Data), `fe` (Fuel/Endurance), `mb` (Mass & Balance), `pf` (Performance), `wx` (Weather), `ui`, `uq` (Usability/Quality), `sys`, `doc`, `sc` (Cloud Sync), `repo` (CI/Meta).

**Example:** `feat(mb): implement lateral CG bounds (refs #42, REQ-MB-005)`

Reference issue numbers and requirement IDs when applicable.

---

## Branching (Gitflow)

`main` (production tags only) · `develop` (integration) · `feature/<desc>` or `feature/issue-<n>` (branch from `develop`, PR back) · `release/v<semver>` · `hotfix/<desc>`.

**Never commit directly to `main` or `develop`.** All changes go through PRs targeting `develop` (or `release/*` / `hotfix/*`). `Closes #` auto-close fires only on those targets.

---

## Coverage Tiers

| Tier | Path | Required |
| :--- | :--- | :------- |
| P1 | `frontend/src/core/` | 90% line + branch + function |
| P2 | `frontend/src/modules/` | 80% min |
| P3 | `frontend/src/shared/`, `plugins/`, `stores/` | 60% min |

**Mocking rules:** weather/METAR → fixture strings only. GPS → static fixtures. Aircraft profiles → standard "Test Aircraft" from `tests/fixtures/`. Pinia: mocked in unit tests, real in integration. **Never hit live aviation APIs.**

Test types: unit (`*.spec.ts`, isolated) · integration (`*.int.spec.ts`, multi-module, mocked external I/O) · E2E (`*.feature` + step defs, BDD via `playwright-bdd`, driven by `docs/journeys/`) · smoke (`@smoke` tag).

---

## Traceability (shtracer) — Required in all new files

Chain: `H-xxx → REQ-xxx → UJ-xxx → E2E-xxx`, plus `REQ → IMP-xxx → UT-xxx | IT-xxx`.

| File | Tag prefix | Placement | Example |
| :--- | :--------- | :-------- | :------ |
| `*.ts`, `*.vue` | `@IMP-XX-NNN@` | inline `//` | `// @IMP-MB-001@ (FROM: @REQ-MB-001@)` |
| `*.spec.ts` | `@UT-XX-NNN@` | file `//` | `// @UT-SYS-001@ (FROM: @IMP-SYS-001@)` |
| `*.int.spec.ts` | `@IT-XX-NNN@` | file `//` | `// @IT-SYS-001@ (FROM: @IMP-SYS-002@)` |
| `*.feature` | `@E2E-XX-NNN@` | `#` comment in feature file | `# @E2E-STRESS-001@ (FROM: @UJ-STRESS-001@)` |

E2E tags go in the `.feature` file (living documentation), **not** in `.ts` step definitions.

Module prefixes: `AC`, `AP`, `AD`, `FE`, `MB`, `PF`, `WX`, `UI`, `UQ`, `SYS`, `DOC`, `SC`. Numbers are zero-padded `NNN`, ascending per prefix namespace, never reused. Each new traced artifact must have a same-commit registry entry under `trace/{requirements|journeys|design|implementation|unit_test|integration_test|e2e}/`.

For full invariants, edge cases, and registry schemas, the `traceability` skill loads on demand. Source-of-truth: `docs/stc.md`.

---

## Key Documents

| Document | Purpose |
| :------- | :------ |
| `ARCHITECTURE.md` | System overview, data flow, layers |
| `CONTRIBUTING.md` | Full P1/P2/P3 guide, commit scopes, quality gates |
| `docs/requirements/README.md` | EARS syntax, module IDs, trace chain |
| `docs/testing/TESTING.md` | Tiers, coverage thresholds, mocking |
| `docs/development/BRANCHING_STRATEGY.md` | Gitflow specifics |
| `docs/architecture/adr/` | All ADRs |
| `docs/journeys/` | UJs (BDD source for E2E) |
| `docs/risk_management/safety_hazards.md` | Hazard register (H-xxx) |
| `docs/stc.md` | Traceability source of truth |

---

## What NOT to Do

- **Never** add `vue`, `pinia`, `vue-router`, or any P2/P3 import inside `src/core/`
- **Never** suppress a `[P1-ISOLATION]` ESLint error with `// eslint-disable`
- **Never** commit directly to `main` or `develop`
- **Never** skip Husky hooks (`--no-verify`) — they are safety gates
- **Never** write tests that hit live external APIs (aviation weather, GPS)
- **Never** use JSX — Vue SFCs only
- **Never** put P1 math directly inside `src/modules/` — it must live in `src/core/`
- **Never** target a PR at anything other than `develop` / `release/*` / `hotfix/*`

---

## Specialized workflows

GitHub issue handling, P1 PR review, milestone planning, E2E authoring, audits, and releases are handled by dedicated subagents/skills/commands under `.claude/`. Invoke directly (`/issue`, `/pr.create`, `/audit.full`, `/release-audit`, `/release`) or describe what you want — relevant skills auto-load.

---

## Concision

> **This section is the single source of truth for the project-wide concision directive.** Reference it as `CLAUDE.md § Concision` from any skill, command, agent, template, or doc instead of restating the rule. Do not duplicate the directive elsewhere — point at this anchor so there is exactly one definition to maintain.

**Principle.** Default to the fewest words that convey intent. Every artifact you produce in this repository — code, comments, commit messages, PR descriptions, code reviews, issue bodies, changelog and requirement entries, and ADRs — is word-efficient by default. Prefer bullets over prose; omit justification, restatement, and design padding unless explicitly asked; say what is needed, then stop. This is a standing default, not a per-artifact opt-in: it governs **all current *and future* skills and document types** automatically, so a new skill or document type inherits it without restating it.

**Concrete defaults** (illustrative applications of the principle, not an exhaustive list — apply the principle to artifact types not named here):

- **Changelogs:** one bullet per change; no narrative paragraphs.
- **Document, requirement, and issue entries:** a single declarative sentence where one suffices.
- **PR reviews:** terse and finding-focused; flag what matters, skip ceremony and long narratives.
- **Definition-of-Done and checklists:** checklist items, not prose.
- **Code comments:** minimal — explain the non-obvious *why*, never restate the *what*.

**Safety carve-out (non-negotiable).** Concision must **never** drop required safety or traceability content for brevity. Hazard references (`H-xxx`), the trace chain and its IDs (`REQ-`, `IMP-`, `UT-`, `IT-`, `E2E-`), Go/No-Go rationale, safety warnings and disclaimers, and mandatory template, DoD, or attestation fields are always retained in full — even when keeping them makes an artifact longer. When brevity and a required safety/traceability fact conflict, the fact always wins.

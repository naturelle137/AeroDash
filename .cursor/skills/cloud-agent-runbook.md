# AeroDash — Cloud Agent Runbook

How to set up, run, and test this codebase in a Cloud Agent environment.

## Project Overview

AeroDash is a **Vue 3 + TypeScript** single-page application for General Aviation
flight preparation (mass & balance, performance, weather). It lives in a **pnpm
monorepo** with the application code under `frontend/`.

Key technology: Vue 3 (Composition API), Vite, Pinia, Zod, Vitest, Playwright
(BDD via `playwright-bdd`), Stryker mutation testing.

---

## 1 — Environment Setup

```bash
# Enable pnpm (ships via corepack with Node ≥ 16)
corepack enable pnpm

# Install all workspace dependencies (root + frontend)
pnpm install

# (Optional) Install Playwright Chromium for E2E tests
pnpm --filter frontend exec playwright install chromium --with-deps
```

**Node version**: `^20.19.0 || >=22.12.0` (devcontainer ships Node 24).
If `corepack` is missing, install pnpm directly: `npm i -g pnpm@10`.

### No login / auth required

The app has no authentication layer. No credentials, tokens, or OAuth flows are
needed to start or test it.

### No feature flags

There are no feature-flag services (LaunchDarkly, Unleash, etc.) in this
codebase. The only meaningful env var consumed at runtime is
`import.meta.env.BASE_URL` (set automatically by Vite). Playwright config
checks `process.env.CI` to toggle headless mode and server commands.

### No backend / database

This is a client-only SPA. No databases, Redis, or backend services to start.

---

## 2 — Running the App

```bash
# Dev server (hot-reload, http://localhost:5173)
pnpm dev                          # or: pnpm --filter frontend dev

# Production build
pnpm build                        # or: pnpm --filter frontend build

# Preview production build (http://localhost:4173)
pnpm --filter frontend preview
```

---

## 3 — Testing by Area

### 3.1 Unit Tests (Vitest)

All unit tests are co-located `*.spec.ts` files. They run in jsdom (general) or
Node.js (P1 core).

```bash
# Run all unit tests
pnpm test:unit

# Run with coverage report
pnpm coverage:unit

# Run only P1 Safety Core tests (pure Node.js, 90 % coverage required)
pnpm --filter frontend test:p1

# Run P1 with coverage enforcement
pnpm --filter frontend test:p1:coverage
```

**Workflow — after editing source code:**

1. Run the relevant unit test command above.
2. If you touched `frontend/src/core/`, always run `test:p1:coverage` and
   confirm 90 % line/branch/function coverage.
3. For other tiers, run `pnpm coverage:unit` and check thresholds (P2 ≥ 80 %,
   P3 ≥ 60 %).

### 3.2 Integration Tests (Vitest)

```bash
pnpm test:integration
```

> **Note**: This script references `vitest.config.int.ts` which does **not yet
> exist**. The command will fail until that config is created. No `tests/integration/`
> directory exists yet either.

### 3.3 End-to-End Tests (Playwright + BDD)

E2E tests use Gherkin `.feature` files under `frontend/tests/e2e/features/` and
step definitions under `frontend/tests/e2e/steps/`. The `bddgen` pre-step
generates Playwright specs from features.

```bash
# Full E2E suite (builds BDD specs, then runs Playwright)
pnpm test:e2e

# Smoke subset only
pnpm test:smoke
```

**Prerequisites**: Chromium must be installed (see Environment Setup).
Playwright auto-starts the Vite dev server on port 5173 (or preview server on
4173 when `CI=true`).

**Workflow — testing a UI change:**

1. `pnpm dev` (or let Playwright auto-start it).
2. `pnpm test:e2e` — runs headful locally; set `CI=true` for headless.
3. For a quick sanity check, use `pnpm test:smoke`.

### 3.4 Mutation Tests (Stryker)

```bash
cd frontend
pnpm exec stryker run
```

Targets P1 core math logic. Slow but useful for verifying test quality.

---

## 4 — Linting & Type-Checking

```bash
# Full lint (ESLint + oxlint + markdownlint)
pnpm lint

# TypeScript type-check only
pnpm --filter frontend type-check

# ESLint only (CI mode, no auto-fix)
pnpm lint:ci:eslint

# oxlint only (CI mode, no auto-fix)
pnpm lint:ci:oxlint

# Markdown lint
pnpm lint:md
```

**Workflow — before committing:**

1. `pnpm lint` — catches lint + markdown issues.
2. `pnpm --filter frontend type-check` — catches type errors.
3. Both are also enforced by Husky pre-commit hooks (if git hooks are active).

---

## 5 — Building & Verifying a Production Build

```bash
pnpm build
pnpm --filter frontend preview    # serves at http://localhost:4173
```

`build` runs `vue-tsc --build` (type-check) and `vite build` in parallel. If
either fails, the build fails.

---

## 6 — Project Layout Quick Reference

```
/                           pnpm workspace root
├── frontend/               Vue 3 app (all source + tests)
│   ├── src/
│   │   ├── core/           P1 — Safety Core (pure TS, no Vue/Pinia)
│   │   ├── modules/        P2 — Feature modules
│   │   ├── shared/         P3 — Shared UI components
│   │   ├── stores/         P3 — Pinia stores
│   │   ├── plugins/        P3 — Vue plugins
│   │   └── router/         P3 — Vue Router config
│   ├── tests/
│   │   ├── e2e/            Playwright BDD features + steps
│   │   └── assets/         Golden-sample aircraft JSON fixtures
│   ├── vitest.config.ts        General unit test config (jsdom)
│   ├── vitest.config.p1.ts     P1 core config (node, 90 % thresholds)
│   ├── playwright.config.ts    E2E config (BDD, Chromium)
│   └── stryker.config.mjs      Mutation testing config
├── docs/                   Requirements, architecture, ADRs, journeys
├── .cursor/rules/          Cursor rule files (.mdc)
└── .github/workflows/      CI: vitest, playwright, linting, deploy
```

### Priority tiers at a glance

| Tier | Path              | Coverage | Environment |
|------|-------------------|----------|-------------|
| P1   | `src/core/`       | 90 %     | Node.js     |
| P2   | `src/modules/`    | 80 %     | jsdom       |
| P3   | `src/shared/`, `src/stores/`, `src/plugins/`, `src/router/` | 60 % | jsdom |

---

## 7 — Common Pitfalls & Tips

- **P1 isolation**: `src/core/` must never import from Vue, Pinia, or any
  P2/P3 directory. Run `pnpm lint:ci:eslint` to catch `[P1-ISOLATION]` errors.
- **Missing `vitest.config.int.ts`**: The `test:integration` script will fail.
  Skip integration tests until the config is added.
- **Playwright needs Chromium**: If `pnpm test:e2e` fails with a browser error,
  run `pnpm --filter frontend exec playwright install chromium --with-deps`.
- **Conventional Commits**: Commit messages must follow
  `type(scope): description` format. Valid scopes: `ac`, `ap`, `ad`, `fe`,
  `mb`, `pf`, `wx`, `ui`, `uq`, `sys`, `doc`, `sc`, `repo`.
- **Traceability tags**: New test files need `@UT-*@`, `@IT-*@`, or `@E2E-*@`
  tags linking to implementation/journey IDs.
- **Fixtures**: Aircraft test data lives in
  `frontend/tests/assets/golden-samples/` and
  `frontend/src/core/logic/__fixtures__/`.
- **No `.env` files**: The project has no `.env` or `.env.example`. Vite
  provides `BASE_URL` automatically.

---

## 8 — CI Workflows

| Workflow | File | Runs |
|----------|------|------|
| Unit tests | `vitest.yml` | `pnpm test:unit` |
| P1 + type-check + lint + build | `ci.yml` | `test:unit`, `test:p1:coverage`, `type-check`, lint, build |
| E2E | `playwright.yml` | `pnpm test:e2e` with Chromium |
| Linting | `linting.yml` | ESLint, oxlint, markdownlint |
| Reports | `deploy-reports.yml` | Vitest HTML + coverage + Stryker + Playwright → GitHub Pages |

---

## 9 — Keeping This Skill Up to Date

When you discover new setup tricks, environment workarounds, or testing patterns
while working on this codebase, add them here so future Cloud agents benefit.

**When to update:**

- A new test tier, config file, or script is added (e.g. `vitest.config.int.ts`).
- A new env var, feature flag, or auth flow is introduced.
- You find a non-obvious workaround for a dev-environment issue.
- CI workflows change in ways that affect local testing.
- New fixture directories or golden-sample data are added.

**How to update:**

1. Edit this file (`.cursor/skills/cloud-agent-runbook.md`).
2. Add the new information in the appropriate numbered section.
3. If a tip is environment-specific (e.g. Cloud Agent VM only), note that.
4. Keep entries concrete and command-oriented — future agents need copy-pasteable
   commands, not prose.

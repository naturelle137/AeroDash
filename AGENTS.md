# AGENTS.md

## Cursor Cloud specific instructions

### Overview

AeroDash is a frontend-only Vue 3 PWA for General Aviation flight preparation (Mass & Balance, Performance). It is a pnpm monorepo with a single `frontend/` workspace package. No backend services or external databases are required — all data persists in the browser via IndexedDB.

### Running services

| Service         | Command        | Port | Notes                        |
| --------------- | -------------- | ---- | ---------------------------- |
| Vite dev server | `pnpm run dev` | 5173 | Auto-reloads on file changes |

### Key commands

All commands can be run from the repo root. See `package.json` and `frontend/package.json` for the full list.

- **Lint:** `pnpm run lint` (runs oxlint + eslint + markdownlint)
- **Unit tests:** `pnpm run test:unit` (Vitest, 376 tests)
- **Integration tests:** `pnpm run test:integration`
- **E2E tests:** `pnpm run test:e2e --project=chromium` (Playwright BDD; use `--project=chromium` in cloud VMs since Microsoft Edge is not available)
- **Build:** `pnpm run build` (type-check + vite build)
- **Type-check only:** `pnpm --filter frontend run type-check`
- **P1 core tests:** `pnpm --filter frontend test:p1` (safety-critical math engine, node env only)

### Gotchas

- The Playwright config (`frontend/playwright.config.ts`) includes an `edge` browser project when `CI` env var is not set. On Linux cloud VMs without MS Edge, run E2E tests with `--project=chromium` to skip edge tests, or set `CI=true` to use CI-mode config.
- Playwright auto-starts the Vite dev server via the `webServer` config; you don't need to start it manually for E2E tests.
- The `pnpm-workspace.yaml` has `onlyBuiltDependencies: [esbuild]` to avoid interactive `pnpm approve-builds` prompts.
- Husky git hooks run `lint-staged` on pre-commit and `commitlint` on commit-msg. Commits must follow Conventional Commits format with AeroDash-specific scopes (see `CONTRIBUTING.md`).

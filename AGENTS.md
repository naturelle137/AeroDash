# AeroDash contributor instructions

AeroDash is a Vue 3 / strict TypeScript PWA for General Aviation flight preparation.
Use [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries and [CONTRIBUTING.md](CONTRIBUTING.md) for delivery.
Current application storage is local; cloud services remain future scope.

## Language and scope

- Write code, requirements and developer documentation in English. Maintain README.md in English and README-DE.md in German.
- Preserve the vision of useful flight preparation, aircraft-specific M&B, performance and endurance workflows; track future capabilities in the roadmap.
- Read [DISCLAIMER.md](DISCLAIMER.md) and [ASSUMPTIONS.md](ASSUMPTIONS.md). Do not change legal terms or claim certification.
- Never invent POH/AFM values or describe synthetic test data as operational validation. Retain source citations, calculation limits, reference cases and meaningful safety tests.

## Architecture and code comments

- P1 `frontend/src/core/` contains pure, deterministic calculations, schemas and domain types; runtime dependencies are limited to Zod and the standard library. No Vue, Pinia or P2/P3 imports; never suppress isolation errors.
- P2 `frontend/src/modules/` consumes P1. P3 shell (`shared/`, global `stores/`, `plugins/`, `router/`) composes features. Keep calculation math out of components. Use Vue SFCs, no JSX.
- Validate external inputs before calculation; use typed failures. Tests use fixed weather/GPS fixtures and synthetic aircraft, never live aviation APIs.
- Comments explain non-obvious constraints or reasons. Avoid restating code or embedding issue/PR/audit IDs; use commit messages and PR descriptions for tracking.

## Commands

Use Corepack/pnpm (version in package.json), Node >=22.12; the local toolbox is `web-dev`.
Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e --project=chromium
pnpm --filter frontend test:p1
pnpm --filter frontend test:p1:coverage
pnpm --filter frontend test:mutation
```

Vite uses port 5173. Playwright starts its own server. Select Chromium on Linux without Edge; scenarios excluded by `@wip` are unfinished, never passed.

## Delivery

- Work on an isolated branch from fresh `origin/develop`; preserve concurrent work. Use signed Conventional Commits and PRs to `develop` (release/hotfix targets follow CONTRIBUTING).
- Keep hooks enabled. Add a concise per-PR Unreleased changelog entry.
- Require one independent fresh-session review, at most one fix round, then integrate with green required CI. Fix real functional, CI, security, safety, data-loss or mandate defects; no final-head re-review ceremony. Never self-approve or bypass branch protection.
- HQ owns agent scheduling. Do not enable competing GitHub workers or paid services. Escalate only product-vision changes, spending, irreversible destruction and legal/safety claims.
- Requirements use ordinary stable REQ IDs and atomic EARS sentences. No tag registries, trace attestation or release ceremony. Functional tests, source checks and P1 isolation remain required.

## Concision

Use the fewest words that preserve intent, acceptance boundaries and safety facts. One obligation per requirement, one bullet per changelog change. Put necessary design context in architecture documents.

# Contributing to AeroDash

Read [AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md), the affected [requirements](docs/requirements/README.md) and [DISCLAIMER.md](DISCLAIMER.md).
Code and developer docs are English; keep the German README aligned.

## 1. Development

Use Node >=22.12 and Corepack/pnpm; install with `pnpm install --frozen-lockfile`.
`pnpm dev` serves the app on port 5173. The local `web-dev` toolbox and the optional [.devcontainer](.devcontainer/README.md) provide development environments.

## 2. Branches and commits

Branch from fresh `origin/develop` into `feature/<description>`, `fix/<description>` or `docs/<description>` and open a PR to `develop`.
`main` holds production releases. Stabilize on `release/v<version>`; hotfixes start from `main`, and return to both `main` and `develop` through PRs. Never push directly to protected branches.
Use signed Conventional Commits: `type(scope): description`.

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- Scopes: `ac`, `ap`, `ad`, `fe`, `mb`, `pf`, `wx`, `ui`, `uq`, `sys`, `doc`, `sc`, `repo`.
- Examples: `fix(mb): reject nonfinite station mass (refs #42, REQ-MB-002)`; `docs(doc): clarify profile verification`.

Keep Husky/commitlint/lint-staged hooks enabled; do not use `--no-verify`.

## 3. Requirements and decisions

Use [atomic EARS requirements](docs/requirements/README.md). Keep original IDs and ordinary links; assign unused IDs for split obligations. Product requirements describe intended behavior, including future capabilities.
Put algorithm contracts and necessary design choices in `docs/architecture/`; use a short ADR for a consequential new decision. Do not create trace registries or mandatory tag chains.

## 4. Code and tests

Keep P1 math pure and isolated from Vue/Pinia and feature/shell code. Validate inputs before invoking calculations. Explain non-obvious reasons in comments; put issue/PR/audit references in commits and PR bodies.
Use deterministic fixtures, reject invalid inputs and test meaningful boundaries. Never call live aviation APIs in tests. Synthetic aircraft/vector success does not validate real POH/AFM data.

Run `pnpm lint && pnpm test:unit` for every change. Run build, integration and Chromium E2E for affected wiring or browser behavior. For P1 changes also run isolated P1 coverage and mutation checks. See [Testing](docs/testing/TESTING.md).

## 5. Pull requests and review

Use the PR template. State the problem, resulting behavior, actual checks and remaining limitations. Explain domain/source assumptions where relevant. Keep changes focused and preserve functional/security checks.
One independent fresh-session reviewer reviews the complete change. Only real defects block; allow at most one fix round, then integrate with green required CI and signatures. No mandatory repeated review of the final commit. Follow live branch protection; never bypass it or fabricate completed checks.

## 6. Changelog

Each PR adds a concise bullet under `## [Unreleased]` in `CHANGELOG.md`, using `### Added`, `### Changed`, `### Fixed`, or `### Engineering` for non-user-facing work. Describe the outcome; useful issue/requirement references are welcome but no trace attestation is required. Move entries into the release section when releasing.

## 7. Issues and releases

Report reproducible bugs or concrete feature proposals with safety impact and observable acceptance conditions. Use the existing GitHub templates. Do not create new Task/sub-task structures; split large work into independent Feature/Bug issues and preserve existing work.
Close issues only when their actual scope is delivered; record unfinished acceptance conditions honestly. Release from a reviewed PR with green functional/security checks; verify source/data limitations and release notes. Publishing a version does not certify aviation suitability.

## 8. Dependency classification

| Tier | Paths | Allowed dependencies |
| :--- | :--- | :--- |
| P1 | `frontend/src/core/` | Standard library, Zod, other core modules |
| P2 | `frontend/src/modules/` | P1, Vue/Pinia, feature modules |
| P3 | `frontend/src/shared/`, `stores/`, `plugins/`, `router/` | P1, P2 and shell/framework code |

P2 must not import shell/shared/global-store implementations. Put shared contracts needed by P1 in `core/domain/`; upper layers import them. Return typed results rather than calling outward. Fix isolation violations by moving a pure contract or calculation to core, not by disabling ESLint. See [ADR-314](docs/architecture/adr/314-DEV-dependency-isolation.md).

# 313-DEV-development-environment-containerization: Docker Dev Container as the Standard Development Environment

- **Status:** Accepted
- **Date:** 2026-03-12

## Context

AeroDash requires a consistent, reproducible development environment across all contributors and CI pipelines. The stack introduces several hard dependencies that are notoriously difficult to satisfy on arbitrary host machines:

- **Node.js 24** — a specific, recent runtime version that may not be present on developer machines.
- **Playwright + Chromium** — E2E testing requires a specific Chromium binary built against exact system library versions (`libgbm`, `libnss3`, etc.). Installation failures on non-standard Linux distros, macOS versions, or Windows are common and time-consuming to diagnose.
- **POSIX shell tooling** — the `shtracer` traceability engine and `generate_matrix.sh` are POSIX shell scripts that behave differently or fail outright on Windows and macOS without a Linux userland.
- **Git hooks** — `husky` + `commitlint` + `lint-staged` must run reliably on every platform, including Windows where line-ending and shell-path issues frequently cause silent failures.

A development environment strategy needed to be selected that satisfies all of the above while minimising onboarding friction and maintaining parity with CI.

## Considered Options

- **Option A — Bare-metal (local install):** Each contributor manually installs the required Node version, npm, Playwright, and system dependencies directly on their host machine.
- **Option B — Bootstrap shell script:** A `scripts/setup.sh` automates tool installation (via `nvm`, `npx playwright install`, etc.) but still runs on the host OS.
- **Option C — Node version manager only (nvm / fnm / Volta):** Pin the Node runtime via `.nvmrc` or `volta` config; all other dependencies are installed locally.
- **Option D — Docker Dev Container (VS Code devcontainer spec):** A fully containerised environment defined in `.devcontainer/`, with the image published to GHCR and reused in CI.
- **Option E — Cloud dev environment (GitHub Codespaces / Gitpod):** The devcontainer image runs remotely; contributors access the IDE through a browser or a thin VS Code tunnel.

## Decision

We have adopted **Option D — Docker Dev Container**, with the environment defined in `.devcontainer/Dockerfile` and `.devcontainer/devcontainer.json`, based on the `node:24-bookworm` (Debian Bookworm) image.

The devcontainer image is published to GHCR via the `publish-devcontainer.yml` workflow and pulled by the `ci-devcontainer.yml` CI workflow, establishing a single source of truth for the development environment used both locally and in CI.

Key environment choices baked into the image:

- Node.js 24 (from the base image)
- Git, sudo, Docker CLI (`docker-ce-cli`, `docker-buildx-plugin`) via `docker-outside-of-docker`
- Playwright Chromium system dependencies pre-installed
- npm dependencies installed at container creation (`postCreateCommand: npm i`)
- VS Code extensions pre-configured (Volar, Vitest, Playwright, ESLint, Prettier, etc.)
- Forwarded ports: `5173` (Vite dev server), `9323` (Playwright)

### Why not the alternatives?

- **Option A (bare-metal):** Rejected because Playwright system library installation is host-dependent and fails unpredictably on diverse machines. POSIX shell scripts in `shtracer` are unreliable on Windows. Node version divergence across contributors introduces subtle breakage.
- **Option B (bootstrap script):** Rejected because a setup script must be maintained and tested per OS, still exposes contributors to host-library divergence for Playwright, and provides no integration with VS Code's one-click onboarding UX.
- **Option C (nvm/fnm/Volta only):** Rejected because pinning the Node version alone does not address the Playwright system-dependency problem, POSIX tooling on Windows, or Git hook reliability. Insufficient for this stack.
- **Option E (cloud dev environments):** Deferred as a complementary option. The `devcontainer.json` is directly Codespaces-compatible. However, running the environment remotely conflicts with AeroDash's offline-first design philosophy, introduces latency for Vite HMR, and adds billing complexity. This may become useful for occasional contributors or code review scenarios in future, but is not the primary workflow.

## Consequences

### Positive

- **Playwright works everywhere, every time.** Chromium and its system dependencies are pre-installed in the image, eliminating the most common source of environment-related test failures.
- **Zero-friction onboarding.** A new contributor clones the repo and clicks "Reopen in Container" — no prerequisite documentation to follow, no manual tool installation.
- **CI/dev environment parity.** The same image pulled from GHCR is used in local development and in `ci-devcontainer.yml`. The "works on my machine" failure class is structurally eliminated.
- **Cross-platform consistency.** Windows developers using VS Code + WSL2 get an identical Linux environment to macOS and Linux contributors. `husky`, `commitlint`, and `shtracer` shell scripts behave uniformly.
- **Forward-compatible with planned backend.** The Docker CLI (`docker-outside-of-docker`) is pre-installed. When the planned REST API backend (weather proxy, OpenAIP adapter, OIDC auth) is added, contributors will be able to run `docker compose up` from inside the devcontainer without any setup changes.
- **Devcontainer image is versioned and cached.** CI pulls the pre-built image from GHCR rather than rebuilding it on every run, keeping pipeline times low.

### Negative

- **WSL2 filesystem performance.** If the repository is checked out on the Windows filesystem (`/mnt/c/...`) rather than the WSL2 filesystem, file I/O across the boundary degrades Vite's HMR speed and `npm install` times significantly. Contributors must keep the repo on the WSL2 filesystem to avoid this.
- **Docker runtime required.** Contributors must have Docker Desktop (or Docker Engine on Linux) installed. This adds a licensing consideration for larger commercial teams using Docker Desktop.
- **RAM and CPU overhead.** Container + Docker daemon consume more resources than a bare-metal process, which is noticeable on lower-spec machines.
- **Container conceptual overhead.** Contributors unfamiliar with Docker face an additional conceptual layer, though the VS Code devcontainer UX abstracts most of it.

## Compliance

n/a

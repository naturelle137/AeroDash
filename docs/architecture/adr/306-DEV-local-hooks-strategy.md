# 306-DEV: Local Hooks Strategy

* **Status:** Accepted
* **Date:** 2026-02-22

## Context

AeroDash operates as a P1 safety-critical project where "Documentation as Code" and strict contribution formatting rules are essential for traceability. Our `CONTRIBUTING.md` defines specific Conventional Commit scopes (e.g., `(mb)`, `(pf)`, `(repo)`) to tie code changes directly back to our safety requirements.

Relying solely on human memory to strictly follow these formatting constraints at the terminal level introduces an unacceptable risk of untraceable commits polluting the `develop` branch. We needed an automated way to physically enforce our local contribution standards *before* code is ever pushed to the origin server.

## Considered Options

1. **Native Git Hooks (Bash scripts directly in `.git/hooks/`)**: Powerful, but do not sync automatically across developer machines on clone.
2. **Husky**: A zero-dependency (for the installer) tool widely used in the JS ecosystem that securely links Git hooks to standard npm scripts and makes them shareable via the repository.
3. **pre-commit framework (Python-based)**: Robust, but introduces a Python ecosystem dependency for structural tasks when our primary frontend tooling is web-based.
4. **Server-side only (GitHub Actions)**: Allows bad commits to exist locally and creates a slow feedback loop via CI/CD pipelines instead of immediate local rejection.

## Decision

We will use **Husky** paired with `@commitlint/cli` for local Git hook enforcement.

* Husky will be tracking our `.husky` directory within the repository.
* A `commit-msg` hook will run the `commitlint` engine against our rigidly defined `CONTRIBUTING.md` configuration.
* A `pre-commit` hook will run our `markdownlint-cli2` checks prior to push to catch documentation errors before CI.

## Consequences

### Positive

* **Immediate Feedback Loop**: Developers are physically stopped from making bad commits *before* waiting on a remote pipeline.
* **Structural Enforcement**: We offload safety-critical rules from human memory to the system architecture.
* **Shared Standards**: Every developer cloning the repository automatically gets the same strict formatting rules initialized via `pnpm install`.

### Negative

* **Dependency Overhead**: Introduces a minor Node.js dependency overhead inside the development environment.
* **Strict DX**: Developers might briefly experience frustration if their local commit is unexpectedly rejected due to a minor formatting typo.

## Compliance

This ADR actively enforces **Section 3: Commit Standards** of `CONTRIBUTING.md` and aligns closely with the project's goal to treat P1-level rules as systemic requirements rather than mere suggestions.

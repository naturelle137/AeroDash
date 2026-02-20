# 301-DEV-branching-strategy: Branching Model (Gitflow)

Date: 2026-02-20

## Status
Accepted

## Context
As the project grows, it is crucial to maintain entirely separate lifecycles for stable production artifacts vs. in-progress integration code. Our development architecture must ensure that the `main` branch remains stable and flight-ready at all times, without hindering the parallel development of features and bug fixes. The branching strategy is an integral architectural decision for the developer experience because it establishes uniform workflows and expectations for every contributor.

## Considered Options

*   Not documented in original ADR

## Decision
We have decided to adopt the **Gitflow** branching model as our standard development architecture.

The core of this model is defined as follows:

- **Perpetual Branches**: 
  - `main`: Exclusively for production-ready, tagged releases.
  - `develop`: The central integration branch for the next release.
- **Supporting Branches**: 
  - `feature/*`: Branched from `develop`, merged back to `develop` via PR. Used for new features and non-critical bug fixes.
  - `release/*`: Branched from `develop`, merged to `main` (tagged) and back to `develop`. Used solely for stabilization before a release.
  - `hotfix/*`: Branched from `main`, merged to `main` (tagged) and back to `develop`. Used exclusively for critical production bugs.

All merges into `develop` or `main` must utilize Pull Requests, complete with necessary safety checklists, and enforce Branch Protection rules.

For a detailed view of the rules, naming conventions, and exact CLI commands to support this workflow, refer to [Developer Branching Strategy & Workflow Guide](../development/BRANCHING_STRATEGY.md).

## Consequences

### Positive
* **Stability:** `main` directly mirrors production releases safely.
* **Separation of Concerns:** Features can be built and tested in isolation on `feature/` branches and integrated into `develop` without destabilizing production.
* **Clear Guidelines:** Developers have an explicit, documented map of which branches to use and how to name them.
* **Release Management:** The explicit `release/` branches allow QA and safety verification to proceed undisturbed without blocking ongoing feature development on `develop`.

### Negative
* **Overhead:** Gitflow can introduce more branching and merging overhead compared to simpler flows (like GitHub Flow), requiring developers to be diligent about back-merging `release` and `hotfix` branches to `develop`.
* **Complexity:** Navigating the exact target branch for a given pull request can initially confuse new contributors, which is mitigated by strict PR templates and checklists.

## Compliance

n/a

# 302-DEV-contributing-guidelines: Safety-First Contributing Guidelines

* **Status:** Accepted
* **Date:** 2026-02-20

## Context

AeroDash is a General Aviation flight-preparation tool where algorithmic correctness directly impacts physical flight safety (e.g., Mass & Balance, Takeoff requirements). Without a unified set of strict contribution rules, the project risks "architectural drift," unverified code entering critical branches, and a loss of traceability. A UI tweak must be treated differently than a core safety calculation, yet both need to pass through a reliable, standardized quality funnel to prevent the silent corruption of critical flight data.

## Considered Options

* **Option 1:** Rely solely on automated CI checks. (Rejected: CI cannot easily enforce philosophical rules like "understanding the Why" or writing meaningful commit messages for traceability).
* **Option 2:** Maintain a loose, "move fast and break things" open-source model. (Rejected: Unacceptable for aviation software where correctness is paramount over speed).
* **Option 3:** Establish formal "Safety-First" contributing guidelines enforced globally via the `CONTRIBUTING.md` root file. (Accepted).

## Decision

We will implement a central `CONTRIBUTING.md` file designed around a "Safety-First" philosophy.

The guidelines mandate the following developer workflows:
1.  **Philosophy:** Explicitly declaring Correctness > Speed.
2.  **Commit Standards:** Enforcing Conventional Commits with specific module scopes (e.g., `mb`, `wx`) and mandatory requirement/issue ID referencing to ensure unbroken traceability.
3.  **Quality Gates:** Defining clear expectations for Local (pre-commit checking), CI (automated test suites and isolation verification), and Release (strict merge-to-main criteria).
4.  **P1 Constraints:** Implementing special rules for the Safety Core (P1), such as mandatory Architectural Decision Records (ADRs) for structural changes and senior peer review.
5.  **Single Source of Truth:** `CONTRIBUTING.md` will not duplicate technical specifications, but instead act as a router, deep-linking to the specific ADRs in `docs/architecture/adr/` or `docs/development/`.

## Consequences

### Positive

*   **Traceability:** Every line of code can be traced back to an issue, a requirement, or an architectural decision.
*   **Quality Consistency:** A unified standard prevents "rogue" code from bypassing quality checks.
*   **Clear Expectations:** New developers immediately understand the gravity of the codebase and the strictness of the review process, reducing friction and rejected PRs.

### Negative

*   **Higher Friction:** The development pace is inherently slower due to the overhead of writing ADRs, formatting commits perfectly, and ensuring traceability links.
*   **Tooling Dependency:** We heavily rely on pre-commit hooks, linters, and CI actions to reliably enforce these rules.

## Compliance

These guidelines form the primary "human quality gate" necessary to maintain the software integrity required by general aviation safety standards.

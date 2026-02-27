# 304-DEV-testing-guidelines: Strict Testing and Coverage Standards

* **Status:** Accepted
* **Date:** 2026-02-20

## Context

AeroDash is a safety-critical tool where an errant calculation could directly compromise flight safety (e.g., incorrect take-off distance or center of gravity). To uphold our "Safety-First" philosophy, we cannot rely solely on manual verification or varying degrees of ad-hoc test quality. We need to formalize what constitutes a valid test, define strict code coverage minimums (especially for P1 Safety Core modules), and establish exact rules for mocking external data sources so that tests remain deterministic.

## Considered Options

* **Option 1 - Ad-Hoc Testing:** Let contributors decide what and how to test, relying heavily on Pull Request peer reviews.
* **Option 2 - Universal 100% Coverage:** Demand 100% test coverage across every single file in the repository, including user interface components and pure styling files.
* **Option 3 - Risk-Based Tiered Strategy:** Establish a tiered strategy based on module priority. Demand 100% rigorous coverage for P1 (Safety Core), robust coverage for P2 (External Data/APIs), and standard guidelines for P3 (UI). Mandate strict, deterministic mocking for external dependencies.

## Decision

We have decided to adopt **Option 3 (Risk-Based Tiered Strategy)**.

To formalize this, we are creating a centralized `TESTING.md` guide that defines:

1. **Types of Tests:** Explicit responsibilities for Unit, Integration, and End-to-End (E2E) testing.
2. **Coverage Minimums:** 100% for P1 modules, 80% for P2, and practical best-efforts for P3.
3. **Mocking External Data:** A strict requirement that all environmental variables (GPS coordinates, METAR, TAF, dynamic API data) must be statically mocked when testing P1 logic to ensure tests are deterministic.

## Consequences

### Positive

* **Verifiable Safety:** P1 core safety algorithms (Mass & Balance, Performance) are mathematically guaranteed against regressions.
* **Clear Contributor Guidelines:** New developers explicitly know what is required to pass the CI phase, reducing PR back-and-forth.
* **Deterministic Builds:** By heavily enforcing mocked environments for unit tests, tests will not fail sporadically due to bad weather API responses or GPS drift.

### Negative

* **Higher Initial Friction:** It takes significantly more time to deliver a feature regarding P1 components, as the testing burden is exceptionally high.
* **Maintenance Overhead:** 100% coverage requirements on P1 mean that even slight, harmless internal refactoring might break test coverage and require test rewrites.

## Compliance

This decision aligns with DO-178C principles for software level constraints, ensuring critical components (comparable to higher design assurance levels) receive maximum verification before production release.

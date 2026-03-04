# 312-DEV-e2e-bdd-framework: End-to-End BDD Framework Selection

- **Status:** Accepted
- **Date:** 2026-03-04

## Context

AeroDash's traceability matrix mandates that System Integration and End-to-End User Experience workflows map directly back to documented User Journeys (`docs/journeys/`). To bridge the gap between human-readable documentation and automated testing, we have chosen to implement Behavior-Driven Development (BDD) using Gherkin syntax (`.feature` files).

Given that Playwright was previously established as our E2E browser automation tool (ADR-309), we must select the optimal method for integrating Gherkin/BDD execution into the Playwright ecosystem.

## Considered Options

### 1. `playwright-bdd` (Native Playwright Integration)

A specialized bridge that reads Gherkin `.feature` files and natively compiles them into standard `*.spec.ts` files that the Playwright runner executes.

- **Pros:** Full access to Playwright's native runner, UI mode, HTML reporters, and trace viewer. Fast parallel execution. Zero wrapper overhead during execution.
- **Cons:** Requires a pre-compilation step (`npx bddgen`) before running tests.

### 2. `@cucumber/cucumber` (Raw Cucumber.js)

The official Cucumber JavaScript implementation.

- **Pros:** The official, standard library for BDD in JS.
- **Cons:** It brings its own test runner. Using it with Playwright requires manually launching the Playwright browser within Cucumber's "World" object. We lose all access to the Playwright Native Runner, UI mode, automatic trace generation, and fixtures parsing.

### 3. Custom Gherkin Parser

Writing a small parser in Node.js to read our specific markdown files or `.feature` files and generate Playwright tests.

- **Pros:** 100% tailored to AeroDash's exact markdown structures.
- **Cons:** Massive maintenance burden. Re-inventing the wheel for parsing Gherkin keywords (`Given`, `When`, `Then`, `Data Tables`).

## Decision

We will adopt **`playwright-bdd`**.

It provides the best of both worlds: standard Gherkin syntax for living documentation (`.feature` files) and native Playwright `.spec.ts` compilation. This means we do not sacrifice Playwright's world-class Developer Experience (Trace Viewer, UI Mode, parallel sharding) just to gain BDD syntax.

Raw `cucumberjs` was rejected because migrating to its runner would rob us of Playwright's core debugging tools, which are critical for stabilizing E2E tests in a highly interactive SPA like AeroDash.

## Consequences

### Positive

- **Traceability:** User Journeys directly map to `.feature` files, fulfilling the Master Traceability Matrix requirements.
- **Developer Experience:** Developers and QA can write tests in Gherkin while retaining the ability to debug step definitions using Playwright UI.
- **Tooling Consistency:** Avoids bloating the project with parallel test runners; everything E2E remains bounded by the Playwright Test Runner.

### Negative

- **Build Pipeline:** Adds a very minor pre-compilation step (`bddgen`) that must be hooked into the test scripts (e.g., executing compilation before `playwright test` is triggered).

## Compliance

- Aligns with the Master Traceability Structure (ADR-307) ensuring E2E code maps to UJs.

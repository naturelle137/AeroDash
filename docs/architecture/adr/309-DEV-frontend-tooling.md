# 309-DEV-frontend-tooling: Vue 3 Project Initialization Configuration

* **Status:** Accepted
* **Date:** 2026-03-02

## Context

Following the decision to use Vue 3 as the core frontend framework ([ADR 002](../002-frontend-framework.md)), we needed to establish the baseline development tooling and initialization configuration for the Single Page Application (SPA).

Modern frontend development requires a robust toolchain encompassing building, routing, state management, testing, and code quality enforcement. The official Vue initialization tool (`create-vue`) offers multiple pathways. We needed to formally document the specific features selected during initialization, the rationale behind these selections, and the specific ecosystem dependencies adopted as a result, ensuring consistency for solo development and alignment with our safety-critical, high-performance constraints.

## Considered Options

The initialization via `create-vue` presented the following key decisions:

* **TypeScript vs. JavaScript:** Pure JS vs. strict typing.
* **JSX Support:** Adding React-like JSX support to Vue templates vs. strict Vue Single-File Components (SFCs).
* **Routing:** `vue-router` vs. custom/none.
* **State Management:** `Pinia` vs. legacy Vuex vs. none.
* **Unit Testing:** `Vitest` vs. Jest.
* **E2E Testing:** Playwright vs. Cypress vs. Nightwatch.
* **Linting & Formatting:** ESLint + Prettier + Oxlint vs. standard defaults.

## Decision

We have initialized the Vue 3 application with the following official ecosystem stack:

1. **TypeScript:** **Yes**. Strict TypeScript is non-negotiable for the "Safety Core" and must extend through the UI layer.
2. **JSX Support:** **No**. We specifically rejected JSX.
    * *Rationale:* Performance and Separation of Concerns. Relying strictly on Vue SFC templates (`<template>`) prevents the accidental mixing of complex business logic inside the UI render functions, enforcing a cleaner architecture.
3. **Router:** **Yes (`vue-router`)**. Required for SPA navigation between different tools (M&B, Performance, Fleet Management).
4. **State Management:** **Yes (`Pinia`)**. Chosen as the modern, type-safe standard for Vue, essential for managing the global state of the aircraft profile and current calculations across different views.
5. **Unit Testing:** **Yes (`Vitest`)**. Chosen for its native Vite integration, extreme speed, and compatibility with our existing backend/core TS testing strategies.
6. **End-to-End Testing:** **Yes (`Playwright`)**. Chosen over Cypress for deeper browser control, speed, and modern architectural support to ensure critical UI flows function correctly.
7. **Code Quality / Linting:** **Yes (ESLint + Oxlint + Prettier)**. A highly aggressive, multi-layered linting setup to catch errors early. Oxlint provides blazing-fast baseline linting, while ESLint (with Vue/TS plugins) handles deep structural rules, and Prettier enforces strict formatting.

## Consequences

### Positive

* **Vendor Alignment:** We are using the exact "golden path" recommended by the Vue core team in 2026, guaranteeing maximum compatibility, documentation availability, and long-term support.
* **Vite Native:** Vitest, Vue, and the dev server all run natively on Vite, resulting in near-instant Hot Module Replacement (HMR) and extremely fast build times, crucial for solo developer velocity.
* **Safety via Strictness:** The combination of pure SFCs (No JSX), strict TypeScript, and a triple-layer linter (Oxlint/ESLint/Prettier) creates a hostile environment for sloppy code, which is highly desirable for an aviation tool.

### Negative

* **Dependency Footprint:** The initial `devDependencies` footprint is quite large (bringing in Playwright, multiple linters, etc.). However, this only affects the development environment and does not impact the final production bundle size sent to the user.
* **Learning Curve for Tooling:** While Vue itself is easy, mastering the interplay between Playwright, Vitest, and complex Vite configurations requires dedicated time.

## Compliance

n/a

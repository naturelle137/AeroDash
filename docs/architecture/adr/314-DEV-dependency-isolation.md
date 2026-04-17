# 314-DEV-dependency-isolation: P1/P2/P3 Dependency Isolation Strategy

* **Status:** Accepted
* **Date:** 2026-03-30
* **Refs:** Issue [#50](https://github.com/naturelle137/AeroDash/issues/50)

## Context

AeroDash separates source code into three priority tiers based on safety impact:

* **P1 — Safety Core (`src/core/`):** Pure TypeScript mathematical logic (Mass &
  Balance, TOLD, unit normalization) and Zod schema validation. A defect here
  could directly cause an incorrect Go/No-Go advisory, making this the highest
  risk zone.
* **P2 — Feature Modules (`src/modules/`):** Domain-specific Vue components,
  Pinia stores, and services. Bugs here can degrade UX but must not alter P1
  outputs.
* **P3 — App Shell (`src/shared/`, `src/plugins/`, `src/stores/`,
  `src/router/`):** Base UI components, cross-cutting plugins (Notification Bus,
  Connectivity detection), global Pinia stores, and routing. Changes here are
  low-risk with respect to calculation correctness.

Without technical enforcement, the dependency flow `P3 → P2 → P1` (higher tiers
consuming lower tiers) is architecturally correct, but the **reverse flow**
(`P1 → P2`, `P1 → P3`) risks propagating non-critical bugs into safety-critical
logic. Empirically, "quick fix" imports of a shared utility or a Pinia store into
a core file are easy to introduce and hard to detect in code review.

The goal of this ADR is to define how the boundary is enforced technically and
procedurally so that architectural drift is caught automatically.

## Considered Options

### Option 1: Developer Discipline Only (Status Quo)

Rely on code review and CONTRIBUTING.md prose to prevent illegal imports.
No tooling enforcement.

* **Pro:** Zero setup cost.
* **Con:** Boundary violations are only detected in code review, if at all.
  Review fatigue means drift accumulates silently over time.
* **Con:** No IDE-time feedback. Developers discover violations only at PR stage.
* **Verdict:** Insufficient for a safety-critical system.

### Option 2: ESLint `no-restricted-imports` Rules (Selected)

Add an ESLint rule block scoped to `src/core/**/*.ts` that prohibits importing
from Vue/Pinia/Router packages and from any `modules/`, `shared/`, `stores/`,
`plugins/`, or `router/` path segment.

* **Pro:** Enforced at IDE-time (editor red squiggles) and in CI (the
  `ci.yml` Lint job already runs ESLint on every PR to `develop`/`main`).
* **Pro:** Minimal friction — no structural refactoring required.
* **Pro:** Clear, actionable error messages pointing to the isolation rule.
* **Con:** Catches import-level coupling only; runtime injection (e.g. passing a
  Vue reactive proxy as a function argument) is not caught.
* **Con:** Only as strong as the patterns maintained in `eslint.config.ts`.

### Option 3: TypeScript Project References

Split the repository into multiple `tsconfig.json` projects with explicit
`references` arrays so that `core/` cannot transitively resolve symbols from
`modules/` or `shared/`.

* **Pro:** Compiler-level enforcement; stronger than ESLint patterns.
* **Pro:** Enables incremental type-checking for large codebases.
* **Con:** Requires significant restructuring of `tsconfig.json` and
  `vite.config.ts`, plus `vue-tsc` build changes.
* **Con:** High setup cost relative to current project size; deferred until the
  project warrants it.
* **Verdict:** Preferred long-term path; adopted as a future enhancement
  candidate (see Consequences).

### Option 4: Separate npm Workspaces / Packages

Publish `core/` as a standalone internal package (`@aerodash/core`). A package
boundary prevents `core` from installing or importing framework packages.

* **Pro:** Strongest isolation — `npm install vue` in `core/` would fail.
* **Con:** Major monorepo restructuring; overhead of inter-package versioning.
* **Con:** Build pipeline and devcontainer must be adapted.
* **Verdict:** Too heavyweight for the current project scale; revisit at
  milestone v1.0.

### Option 5: Runtime Module Federation / Plugin Architecture

Isolate P1 in a Web Worker or separate JS chunk; P2/P3 communicate via
structured messages.

* **Pro:** True runtime isolation; P3 crash cannot reach P1.
* **Con:** Prohibitive complexity; asynchronous messaging overhead in a
  latency-sensitive pre-flight calculation scenario.
* **Verdict:** Out of scope for the current architecture phase.

## Decision

We adopt **Option 2 (ESLint `no-restricted-imports`)** as the primary
technical guardrail for the P1 boundary, backed by:

1. **ESLint rule** scoped to `src/core/**/*.ts` prohibiting imports from Vue,
   Pinia, Vue-Router packages and from any source path segment in
   `modules/`, `shared/`, `stores/`, `plugins/`, or `router/`.
2. **Dependency Inversion (existing pattern):** P1 exposes pure-TypeScript
   interfaces and types in `src/core/domain/` (e.g.
   `notification.types.ts`, `aircraft.types.ts`). P3 plugins *implement*
   these contracts. P1 never calls back into P2/P3 — it returns results and
   violations that upper layers consume. This is the project's established
   Dependency Inversion proof of concept.
3. **P1 Vitest isolation config** (`vitest.config.p1.ts`): A dedicated
   Vitest configuration scoped to `src/core/**/*.spec.ts` with
   `environment: 'node'` proves that P1 tests compile and pass with zero
   framework dependencies.
4. **Procedural quality gates** documented in `CONTRIBUTING.md` §7 (P1
   Constraints) and §10 (new: Dependency Classification Guide), including a
   mandatory P1 PR review checklist.

Option 3 (TypeScript project references) is recorded as the **recommended
future upgrade path** once the codebase grows beyond the current module set or
when stricter compiler-level guarantees are required.

## Consequences

### Positive

* **IDE-time feedback:** ESLint flags illegal P1 imports with a descriptive
  message before code reaches review.
* **CI enforcement:** The Lint job in `ci.yml` enforces the rule on every PR
  to `develop`/`main` without additional pipeline changes.
* **Provable test isolation:** `pnpm --filter frontend test:p1` runs the full
  P1 test suite in a pure Node.js environment, confirming zero framework
  coupling at the test-runner level.
* **Low migration cost:** No structural refactoring of existing source files;
  the existing codebase already respects the boundary by convention.
* **Documented governance:** Contributors have a clear, unambiguous guide for
  classifying new code as P1, P2, or P3, and for handling the rare case where
  P1 must expose a contract to P3.

### Negative

* **Import-level only:** Passing a framework object (e.g. a reactive Ref) as
  a plain `unknown` function argument bypasses ESLint detection. Mitigated by
  the Zod validation requirement for all P1 inputs and by mandatory P1 PR
  review.
* **Pattern maintenance:** If new top-level directories are added to
  `src/`, the ESLint pattern list in `eslint.config.ts` must be updated.
  This is an explicit step in the P1 PR checklist.
* **No transitive library restriction:** A P3-only npm package accidentally
  imported inside `core/` is blocked at the import level (ESLint rule), but
  the `package.json` `dependencies` list has no automated tier separation.
  Mitigated by the third-party library governance policy (CONTRIBUTING.md §10).

## Compliance

This ADR directly addresses the safety isolation requirement stated in Issue #50:
isolation of the P1 calculation core from P2/P3 modules ensures that bugs or
crashes in non-critical features cannot corrupt Mass & Balance or TOLD outputs.
It supports the broader AeroDash safety philosophy of *no silent failures* in
Go/No-Go advisory paths.

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

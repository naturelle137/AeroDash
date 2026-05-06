---
name: e2e
description: Use when authoring, refactoring, or validating Playwright BDD E2E tests in frontend/tests/e2e/ — feature files, step definitions, or trace registries. Triggers on requests like "create an E2E for UJ-X", "validate this feature file", "refactor this E2E slice", "write a smoke test for X", or invocations of /e2e.create-business, /e2e.create-technical, /e2e.refactor, /e2e.validate. Also triggers when editing files matching frontend/tests/e2e/**/*.feature or frontend/tests/e2e/steps/**/*.ts.
---

# E2E test authoring (AeroDash)

This skill bundles four E2E operations + two embedded rule sets. Load only the operation file matching user intent. The rule sub-files are loaded automatically by each operation's procedure.

## Routing

| User intent | Operation file | Slash equivalent |
| :---------- | :------------- | :--------------- |
| New business E2E from a User Journey | `create-business.md` | `/e2e.create-business <UJ-ID \| journey description>` |
| New technical/smoke E2E from system behavior | `create-technical.md` | `/e2e.create-technical <system behavior>` |
| Refactor existing E2E pair (preserve intent + trace) | `refactor.md` | `/e2e.refactor <feature-file> [steps-file]` |
| Audit E2E slice; report violations only | `validate.md` | `/e2e.validate <feature-file> [steps-file]` |

## Reference rule sub-files (loaded by operations)

- `traceability-rules.md` — E2E trace tag schema, registries, edge invariants. Loaded by `create-business`, `create-technical`, `refactor`, `validate`.
- `implementation-rules.md` — Playwright BDD step-definition rules (locators, assertions, imports, isolation). Loaded by `create-business`, `create-technical`, `refactor`.

## Shared safety stance

- criticality: safety-critical aviation
- mode: strict correctness
- verbosity: no explanation unless asked
- clarity > DRY; explicitness > cleverness
- forbid: invented behavior; gherkin-only output; mocking in business E2E; live external API hits

## Procedure

1. Identify operation from user intent.
2. `Read` the matching operation sub-file.
3. The operation will instruct you to also `Read` `traceability-rules.md` and (if writing/refactoring) `implementation-rules.md`. Comply before producing output.
4. Follow the operation's directives strictly. Output style is operation-specific.

## When to defer to the gherkin skill

If the user is editing a `.feature` file but not in an E2E-creation/refactor workflow (e.g. wording cleanup), the lighter-weight `gherkin` skill applies. This skill takes precedence when an explicit E2E operation is requested.

---
description: Audit an existing E2E test slice (feature file + step definitions) and report violations with severity
argument-hint: <feature-file-path> [steps-file-path]
---

# /e2e.validate

You are a QA auditor for a safety-critical aviation application.

Your responsibility is cross-file validation of an E2E test slice.

You produce:

- a structured violation report covering scope consistency, Gherkin quality, step completeness, assertion quality, locator quality, and trace structure
- a clear PASS or FAIL verdict

You do not:

- fix violations (use `/e2e.refactor` for that)
- re-derive the full STC traceability graph (CI handles graph-level invariants)
- validate Gherkin syntax in isolation — `gherkin.mdc` handles single-file enforcement; this command handles cross-file checks that rules cannot perform

## Input Handling

Parse `$ARGUMENTS` as:

- `feature-file-path` required — path to a `.feature` file
- `steps-file-path` optional — path to a `.steps.ts` file

Accepted examples:

- `/e2e.validate frontend/tests/e2e/features/phase-b-flight-preparation/happy-path.feature`
- `/e2e.validate frontend/tests/e2e/features/phase-b-flight-preparation/happy-path.feature frontend/tests/e2e/steps/flight-preparation.steps.ts`

If `steps-file-path` is not provided, locate it automatically by searching `frontend/tests/e2e/steps/` for a file whose step handler strings match steps in the given feature file. If the corresponding steps file cannot be found, note it as a CRITICAL violation and continue all other checks against what is available.

If no argument is provided, stop and return only:
`Usage: /e2e.validate <feature-file-path> [steps-file-path]`

## Required Workspace Discovery

Read both files completely before running any check. Collect all violations from all checks before producing the report.

---

## CHECK 1 — Scope Classification Integrity

Determine the scope type from tags and the trace comment.

Business E2E requires: `@UJ-xxx` tag, `@e2e` tag, trace comment in the form `# @E2E-{PHASE}-{NUMBER}@ (FROM: @UJ-xxx@)`, and no `@smoke` or `@technical-e2e` tags.

Technical E2E requires: `@smoke` or `@technical-e2e` tag (not both), trace comment in the form `# @E2E-{DOMAIN}-{NUMBER}@ (TECHNICAL)`, and no `@UJ-xxx` or `@e2e` tags.

Violations:

- Missing `@UJ-xxx` on a business E2E → CRITICAL
- Missing `@e2e` on a business E2E → CRITICAL
- `@smoke` or `@technical-e2e` present on a business E2E → CRITICAL
- `@UJ-xxx` present on a technical E2E → CRITICAL
- `@e2e` present on a technical E2E → CRITICAL
- Trace comment format does not match the scope type → CRITICAL
- `@UJ-xxx` tag does not match the UJ ID in the trace comment FROM clause → CRITICAL
- Scope type cannot be determined from tags → CRITICAL

---

## CHECK 2 — Gherkin Scope Leakage

Scan every step text in the `.feature` file.

UI leakage (forbidden in all E2E Gherkin):

- Direct interaction verbs: "click", "tap", "press", "check the checkbox", "select from the dropdown" → WARNING
- CSS or HTML vocabulary: "button", "input field", "div", "modal", "tooltip", "scroll" → WARNING
- Color or visual description: "blue button", "red warning", "green checkmark" → WARNING
- Technical jargon: "API", "HTTP", "database", "SQL", "localStorage", "store" → WARNING

Business leakage into technical Gherkin (forbidden in `@smoke` or `@technical-e2e` scenarios):

- Persona language ("the pilot", "the dispatcher") → WARNING
- Aviation domain outcomes ("CG within limits", "MTOM exceeded", "fuel endurance") → CRITICAL

---

## CHECK 3 — Step Completeness

Parse all step texts from the `.feature`. Parse all step handler registration strings from the `.steps.ts`.

For each step text in the `.feature` with no matching handler in the `.steps.ts`:

- No handler in the corresponding steps file → CRITICAL
- No handler in any steps file in `frontend/tests/e2e/steps/` → CRITICAL

For each handler in the `.steps.ts` with no matching step in any `.feature` in `frontend/tests/e2e/features/`:

- Orphan handler → WARNING

For parameter type issues:

- Gherkin uses `"quoted string"` but handler uses `{int}` or bare regex → WARNING
- Handler uses raw regex capture groups instead of typed parameters (`{string}`, `{int}`, `{float}`) → WARNING

---

## CHECK 4 — Playwright Assertion Quality

Scan every `Then` step handler body in the `.steps.ts`.

- `Then` handler has no `expect()` call → CRITICAL
- Assertion uses `.toBeTruthy()` or `.toBeDefined()` for UI state → WARNING
- `page.waitForTimeout()` present anywhere in the file → WARNING
- Absence of a UI element inferred by omitting an assertion instead of using `.toHaveCount(0)` → WARNING

---

## CHECK 5 — Locator Quality

Scan locator usage in the `.steps.ts`.

- CSS class selector based on visual style (`.btn-primary`, `.text-red-500`) → WARNING
- Locator string that appears to be an auto-generated hash → WARNING
- XPath locator with no inline justification comment → WARNING

---

## CHECK 6 — Trace Structure

Verify structural presence without re-deriving the full graph.

- A Scenario has no trace comment on the line immediately above its execution tags → CRITICAL
- A Scenario has no execution tag block → CRITICAL
- Trace comment `@UJ-xxx` ID does not match the `@UJ-xxx` execution tag → CRITICAL
- The `.ts` file contains any `@E2E-xxx@` or `@UJ-xxx@` string → CRITICAL

---

## Output

Return only the following report. No preamble.

```text
E2E Validation Report
═══════════════════════════════════════════════════════
Feature : {path}
Steps   : {path or "not found"}
Scope   : Business E2E | Technical E2E | Unknown

CRITICAL — {count}
  [C1] CHECK {n} | Scenario "{name}" | {violation description}

WARNING — {count}
  [W1] CHECK {n} | {location} | {violation description}

INFO — {count}
  [I1] CHECK {n} | {location} | {improvement note}

───────────────────────────────────────────────────────
Total: {n}  (CRITICAL: {c}  WARNING: {w}  INFO: {i})
Status: PASS | FAIL
```

PASS requires zero CRITICAL violations. Any CRITICAL violation → FAIL.

If no violations are found, return only:

```text
✓ No violations found. The test slice is compliant.
Status: PASS
```

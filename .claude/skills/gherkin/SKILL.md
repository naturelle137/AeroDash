---
name: gherkin
description: Use when authoring or editing Gherkin .feature files (Playwright BDD) — enforces declarative steps, single-behavior scenarios, identifier quoting, no UI mechanics, no technical jargon. Triggers on edits to frontend/tests/e2e/**/*.feature or when the user asks to write/clean a BDD scenario without invoking the full e2e skill.
---

# Gherkin authoring rules

- authority: safety-critical BDD; clarity > DRY; explicitness > cleverness; verbosity per `CLAUDE.md § Concision`
- scope-: unimplemented features; future behavior
- scope+: incomplete feature | scenario => `@wip`
- trace: defer to `e2e/traceability-rules.md` if writing/refactoring trace-bearing files

## Step language

- domain-driven; declarative; present tense; third person; English
- 1 step = 1 action | 1 verifiable outcome
- explicit values only when behavior changes
- quotes for identifiers only; e.g. `"D-EBPN"` `"EDXW"`
- assert behavior; not UI mechanics

forbidden: trailing punctuation; abstract domain identifiers; technical jargon `API|SQL|CSS`

## Feature/scenario structure

- feature: states a user goal
- scenario: 1 specific outcome
- 1 scenario = 1 behavior
- length: 5-7 steps; max 10
- scenarios independent
- background length: <= 2 steps

## When to escalate to the e2e skill

If the request requires:
- creating a new feature file with trace tags
- generating matching step definitions
- refactoring a feature/steps pair as a unit
- running validation

→ stop and invoke the `e2e` skill (it loads this gherkin rule plus `traceability-rules.md` and `implementation-rules.md`). This skill is for in-place feature-file editing only.

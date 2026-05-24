# /e2e.refactor — Refactor E2E slice; preserve intent and trace

- `role`: BDD refactor specialist; safety-critical aviation
- `goal`: improve E2E slice; preserve scope; preserve behavior; preserve trace
- `apply`: also Read `traceability-rules.md` and `implementation-rules.md` before editing.
- `input`: `<feature-file-path> [steps-file-path]`
- `input.examples`:
  - `/e2e.refactor frontend/tests/e2e/features/phase-b-flight-preparation/happy-path.feature`
  - `/e2e.refactor frontend/tests/e2e/features/phase-b-flight-preparation/happy-path.feature frontend/tests/e2e/steps/flight-preparation.steps.ts`
- `stop.no-args`: `Usage: /e2e.refactor <feature-file-path> [steps-file-path]`

## Discovery

1. read feature fully
2. resolve steps path with `/e2e.validate` matching logic if absent
3. read steps fully if found

## Anchors (immutable)

all trace comments; all execution tags; all E2E IDs; scope type; scenario count; behavioral intent per scenario

## Process

- baseline: run `/e2e.validate` mentally first; record all findings
- edit.goal: resolve findings; improve clarity; no coverage expansion
- edit.feature: sharpen feature/scenario titles; convert UI-mechanics wording to domain/system wording; move shared preconditions to `Background`; fix keyword misuse; preserve trace and tags
- edit.ts: resolve rule violations; strengthen assertions; replace weak waits; improve locator semantics; align sections to current feature structure; preserve exact feature-handler sync

## Forbidden

- trace change
- tag change
- scope change
- scenario add | remove
- behavior add | remove
- handler-feature desync
- `@wip` add/remove without explicit user instruction

`fallback.assert-unclear`: add `// TODO: add assertion for {outcome}`; log unresolved.

## Sync invariants

1. every feature step -> matching handler
2. every retained handler -> referenced by updated feature
3. immutable anchors unchanged

## Postcheck

- rerun `/e2e.validate` mentally on refactored pair
- target: all prior `CRITICAL` resolved; no new violations

## Output

1. improved feature path + full content
2. improved steps path + full content
3. change log

### Change log format

Header: `Refactor Change Log`
Fields: `Scope type` | `Behavioral intent: preserved` | `Trace IDs`
Sections: `GHERKIN CHANGES` | `STEP DEFINITION CHANGES` | `UNCHANGED` | `PRE-VALIDATION` | `POST-VALIDATION` | `UNRESOLVED`

Items:
- gherkin: `[G{n}] "{before}" -> "{after}" | {reason}`
- steps: `[S{n}] "{before}" -> "{after}" | {reason}`
- unchanged: trace comments; execution tags; behavioral coverage
- validation: totals + `CRITICAL` + `WARNING`
- unresolved: `[U{n}] {item}`

If clean: `No improvements were necessary. The test slice is already compliant.` + `Run /e2e.validate to confirm.`

`output.style`: no preamble; no commentary

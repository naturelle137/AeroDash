# /e2e.create-business — Generate business E2E slice from UJ

- `role`: BDD author; safety-critical aviation
- `goal`: business E2E slice; `.feature` + `.steps.ts` + registry entry
- `apply`: also Read `traceability-rules.md` and `implementation-rules.md` before writing.
- `forbid`: invented behavior; gherkin-only output; technical scope; smoke scope
- `input`: `<UJ-ID | journey description>`
- `input.accept`: `UJ-{PHASE}-{NNN}` | natural-language journey description
- `input.examples`:
  - `/e2e.create-business UJ-B-005`
  - `/e2e.create-business pilot verifies fuel endurance before departure`
- `stop.no-args`: `Usage: /e2e.create-business <UJ-ID | journey description>`
- `stop.no-id`: ask UJ ID; do not guess

## Discovery

1. locate UJ in `docs/journeys/`
2. derive `phase-letter` from `UJ-{PHASE}-{NNN}`
3. derive `phase-slug` from containing journey file stem; drop numeric prefix; kebab-case
4. extract UJ trace comment; title; persona; goal; outcome; journey rows; upstream `@REQ-*`
5. infer `@module-{module}` from journey domain; align existing phase files if present
6. open `trace/e2e/{phase-slug}.yaml`; next sequential `E2E-{PHASE}-{NNN}`; zero-pad; no reuse; deleted skipped
7. inspect `frontend/tests/e2e/features/phase-{phase-letter}-{phase-slug}/`; reuse file if same feature/domain; else new file
8. inspect `frontend/tests/e2e/steps/`; prefer existing domain step file; else new `frontend/tests/e2e/steps/{domain}.steps.ts`

`stop.uj-missing`: `Blocked: UJ <ID> not found in docs/journeys/. Verify ID or create journey first.`

## Feature file

- path: `frontend/tests/e2e/features/phase-{phase-letter}-{phase-slug}/{scenario-kebab}.feature`
- source: UJ only
- map.context: journey context/shared state -> `Background` or `Given`
- map.action: user action -> `When`
- map.reaction: observable outcome -> `Then`
- map.branch: distinct outcome branch -> distinct `Scenario`
- body: `Feature` title from UJ; narrative from persona/goal/outcome; trace comment above exec tags; exec tags include `@UJ-{ID}` `@phase-{phase-letter}` `@e2e` `@module-{module}`; scenario titles outcome-specific

## Steps file

- path: existing domain file | `frontend/tests/e2e/steps/{domain}.steps.ts`
- sync: every feature step -> exact handler text; case-sensitive; typed params only
- shape: import block from implementation-rules.md; sections by `Background` / scenario / `Then`
- scope: business UI flow only; no mocks; no interception

## Registry

- path: `trace/e2e/{phase-slug}.yaml`
- entry: `E2E-{PHASE}-{NNN}` + `title` + feature file path

## Output (no preamble; no commentary)

1. feature path + full content
2. steps path + full content
3. registry entry
4. assigned `E2E-{PHASE}-{NNN}`

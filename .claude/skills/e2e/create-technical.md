# /e2e.create-technical — Generate technical or smoke E2E slice

- `role`: BDD author; safety-critical aviation
- `goal`: technical E2E slice; `.feature` + `.steps.ts` + registry entry
- `apply`: also Read `traceability-rules.md` and `implementation-rules.md` before writing.
- `input`: `<system behavior description>`; natural language
- `input.examples`:
  - `/e2e.create-technical mass balance page loads without errors`
  - `/e2e.create-technical service worker registers on application startup`
  - `/e2e.create-technical API health endpoint returns 200`
- `stop.no-args`: `Usage: /e2e.create-technical <system behavior description>`

## Classification

- `smoke`: route/page availability; startup without fatal errors; critical UI visible; primary route reachable
- `technical`: health/status endpoint; service worker; console health; browser API; background sync/load
- tie-break: ambiguous -> `@smoke`

`stop.redirect`: business outcome | persona language | user-journey phrasing | aviation decision outcome

`stop.redirect-msg`: `This describes a business E2E scenario. Use /e2e.create-business <UJ-ID>.`

## Forbidden

- UJ input
- `@UJ-*`
- `@e2e`
- business-domain validation
- business scenario generation

## Discovery

1. choose registry `trace/e2e/smoke.yaml` | `trace/e2e/technical.yaml`; create if absent
2. next sequential ID from registry; zero-pad; no reuse; deleted skipped
3. `@smoke` -> `E2E-SMOKE-{NNN}`; `@technical-e2e` -> `E2E-TECH-{NNN}`
4. inspect `frontend/tests/e2e/steps/technical/`; prefer existing domain step file

## Feature file

- path: `frontend/tests/e2e/features/technical/{name}.feature`
- scope: system-level language only
- voice: `the application` | `the runtime` | `the service worker` | `the API endpoint`
- tags.smoke: trace `# @E2E-SMOKE-{NNN}@ (TECHNICAL)`; exec `@smoke @phase-D`
- tags.technical: trace `# @E2E-TECH-{NNN}@ (TECHNICAL)`; exec `@technical-e2e @phase-D @module-sys`
- shape: `Feature` + traced `Scenario` + `Given/When/Then`; outcome-focused titles

## Steps file

- path: existing technical domain file | `frontend/tests/e2e/steps/technical/{domain}.steps.ts`
- sync: every feature step -> exact handler text; case-sensitive; typed params only
- allowed: `page.goto` smoke route checks; `page.request` endpoint checks; console capture; `page.evaluate` browser API checks
- forbid: hardcoded aviation domain values

## Registry

- path: `trace/e2e/smoke.yaml` | `trace/e2e/technical.yaml`
- entry: `E2E-{DOMAIN}-{NNN}` + `title` + feature file path

## Output

1. classification
2. feature path + full content
3. steps path + full content
4. registry entry
5. assigned ID

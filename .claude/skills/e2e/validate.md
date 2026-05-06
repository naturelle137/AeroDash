# /e2e.validate — Audit E2E slice; report violations

- `role`: QA auditor; safety-critical aviation
- `goal`: validate E2E slice; report only; no fixes
- `apply`: also Read `traceability-rules.md` and `implementation-rules.md` before validating.
- `scope`: cross-file + scope integrity + linkage + rule compliance surfacing
- `skip`: full trace-graph derivation
- `input`: `<feature-file-path> [steps-file-path]`
- `input.examples`:
  - `/e2e.validate frontend/tests/e2e/features/phase-b-flight-preparation/happy-path.feature`
  - `/e2e.validate <feature-file> <steps-file>`
- `stop.no-args`: `Usage: /e2e.validate <feature-file-path> [steps-file-path]`

## Discovery

1. read feature fully
2. if steps path absent -> search `frontend/tests/e2e/steps/` by exact handler-string matches to feature steps
3. if unresolved -> `CRITICAL`; continue remaining checks
4. read resolved steps file fully if found

## Checks

### 1. Scope

- classify `Business E2E` | `Technical E2E` | `Unknown`
- business: requires `@UJ-*` + `@e2e` + business trace comment; forbids `@smoke` `@technical-e2e`
- technical: requires exactly one of `@smoke` `@technical-e2e` + `(TECHNICAL)` trace comment; forbids `@UJ-*` `@e2e`
- critical triggers: missing required scope tags; mixed scope tags; trace-format mismatch; tag/trace UJ mismatch; unknown scope

### 2. Feature vs rules

- surface violations from feature against `gherkin` + `traceability-rules.md`; location-aware

### 3. Steps vs rules

- surface violations from steps against `implementation-rules.md`; location-aware

### 4. Step completeness

- every feature step -> matching handler in resolved steps; if missing locally, search all step files; still missing -> `CRITICAL`
- handler unused by all `.feature` files -> `WARNING`
- quoted-string step mapped to non-string handler; raw regex capture groups; typed-param mismatch -> `WARNING`

### 5. Trace structure

- scenario missing trace comment above exec tags; scenario missing exec tags; trace UJ vs exec UJ mismatch; trace tokens inside `.ts` -> `CRITICAL`

### 6. Output status

- `PASS` iff `CRITICAL=0`; else `FAIL`

## Report format (fixed text block)

Header: `E2E Validation Report`
Fields: `Feature` | `Steps` | `Scope`
Sections: `CRITICAL` | `WARNING` | `INFO`

Items:
- critical: `[C{n}] CHECK {n} | {location} | {violation}`
- warning: `[W{n}] CHECK {n} | {location} | {violation}`
- info: `[I{n}] CHECK {n} | {location} | {note}`

Footer: `Total: {n}  (CRITICAL: {c}  WARNING: {w}  INFO: {i})` + `Status: PASS | FAIL`

Clean output: `✓ No violations found. The test slice is compliant.` + `Status: PASS`

`output.style`: no preamble; collect all findings before report

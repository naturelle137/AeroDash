---
name: traceability
description: Use when adding, modifying, or auditing shtracer traceability tags in source files (@H-/@REQ-/@UJ-/@DES-/@IMP-/@UT-/@IT-/@E2E-) or trace/ registry entries. Loads full ID schema, source-file conventions, edge constraints, and DAG invariants. Triggers on requests like "add traceability tag", "where does REQ-MB-005 trace to?", "fix trace registry", "/stc-tag", or any edit that introduces a new tagged artifact.
---

# Traceability (shtracer) — full reference

Source-of-truth: `docs/stc.md`. This skill is the operational summary loaded on demand.

## IDs

- `H = @H-{NNN}@`
- `REQ = @REQ-{MODULE}-{NNN}@`
- `UJ = @UJ-{PHASE}-{NNN}@`
- `DES = @DES-{SUBTYPE}-{NNN}@`
- `IMP|UT|IT = @{PFX}-{MODULE}-{LAYER}-{NNN}@`
- `E2E = @E2E-{PHASE}-{NNN}@`

## Numbers

- `NNN = 001..999`; zero-padded; ascending per prefix namespace; never reused

## Annotation forms

- `@TAG@ (FROM: @UP-1@[, @UP-2@ ...])`
- `@E2E-...@ (TECHNICAL)` — for technical/smoke E2Es

## Edges (allowed)

- `H -> REQ`
- `REQ -> UJ`
- `REQ -> DES`
- `REQ -> IMP`
- `DES -> IMP`
- `IMP -> UT`
- `IMP -> IT`
- `UJ -> E2E`
- `IMP` may cite `REQ` + `DES`

## Edges (forbidden)

- reverse direction
- cycles
- `E2E -> IMP`
- `UT|IT -> REQ|DES`
- `DES -> H`
- `UT -> IT|E2E`
- `IT -> UT|E2E`

## Source-file conventions

### `H` (Hazards)
- files: `docs/risk_management/**/*.md`
- comment: `<!-- ... -->` line above `##|###`
- registry: none
- source-of-truth: `docs/risk_management/safety_hazards.md`

### `REQ`
- files: `docs/requirements/**/*.md`; excl `README.md|traceability_matrix.md`
- comment: `<!-- ... -->` line above `##|###`
- annotation: `FROM: @H-...@`
- registry: `trace/requirements/{module}.yaml`
- fields: `title|hazard|file`

### `UJ`
- files: `docs/journeys/**/*.md`; excl `README.md`
- comment: `<!-- ... -->` line above `##|###`
- annotation: `FROM: @REQ-...@`
- registry: `trace/journeys/{phase}.yaml`
- fields: `title|req|file`

### `DES`
- files: `docs/architecture/**/*.md|docs/ux/**/*.md|docs/api/**/*.md`; excl `000-template.md|README.md`; excl `docs/architecture/adr/`
- comment: `<!-- ... -->` line above `##|###`
- annotation: `FROM: @REQ-...@`
- registry: `trace/design/{subtype}.yaml`
- fields: `title|req|file`

### `IMP`
- files: `frontend/src/**/*.ts`, `frontend/src/**/*.vue`; excl `*.spec.ts|*.int.spec.ts`
- comment: `// ...` line above traced `export|function|statement|branch`
- one tag per logical unit; merge upstreams
- annotation: `FROM: @REQ-...@|@DES-...@`
- registry: `trace/implementation/{module}.yaml`
- fields: `title|req?|des?|files`; `req|des >=1`

### `UT`
- files: `frontend/src/**/*.spec.ts`; excl `*.int.spec.ts`
- comment: `// ...` line above `it|it.each|traced data row`; never `describe`
- annotation: `FROM: @IMP-...@`
- registry: `trace/unit_test/{module}.yaml`
- fields: `title|impl|files`

### `IT`
- files: `frontend/**/*.int.spec.ts`
- comment: `// ...` line above `it|it.each|traced data row`; never `describe`
- annotation: `FROM: @IMP-...@`
- registry: `trace/integration_test/{module}.yaml`
- fields: `title|impl|files`

### `E2E-business`
- files: `frontend/tests/e2e/**/*.feature`
- comment: `# ...` line above exec tags, before `Scenario`
- annotation: `FROM: @UJ-...@`
- exec tags: `@UJ-... @phase-X @e2e`; optional scenario tag
- registry: `trace/e2e/{phase-or-domain}.yaml`
- fields: `title|files`; no upstream dup in registry

### `E2E-technical`
- files: `frontend/tests/e2e/**/*.feature`
- comment: `# @E2E-...@ (TECHNICAL)`; no `FROM`
- exec tags: `@phase-X` + `@smoke|@technical-e2e`
- non-business only

### Placement rule

E2E trace tags live in `.feature` files only — **never** in step definitions `*.ts`.

## Registries

- root: `trace/{requirements|journeys|design|implementation|unit_test|integration_test|e2e}/`
- source-of-truth: `H` hazard log; `REQ|UJ|DES` markdown; `IMP|UT|IT|E2E` source file
- new traced artifact => entry in same commit
- delete => mark `deleted|obsolete`; never remove

## Cross-checks

- every source tag <-> registry entry
- every registry `file|files` path exists

## Invariants

- `001`: every `IMP` >= 1 upstream `REQ|DES`
- `002`: every `UT` >= 1 upstream `IMP`
- `003`: every `IT` >= 1 upstream `IMP`
- `004`: every business `E2E` >= 1 upstream `UJ`
- `005`: every non-deprecated `REQ`-realizing `IMP` >= 1 downstream `UT|IT|E2E via UJ`
- `006`: every `UJ` >= 1 upstream `REQ`
- `007`: unique ID per prefix namespace
- `008`: one defining source file per tag; extra citations ok
- `009`: every `FROM` target exists
- `010`: DAG only
- `011`: allowed edge types only

## Workflow shortcuts

- For tagging changed files in a feature branch end-to-end: see `.claude/skills/stc-tag.md` (the `/stc-tag` skill).
- For E2E-specific tag rules without the global schema overhead: load `.claude/skills/e2e/traceability-rules.md`.

# E2E traceability rules

Source-of-truth rules for E2E trace tags in `*.feature` files and registry entries under `trace/e2e/`.

## IDs and annotation

- ids: `E2E=@E2E-{PHASE}-{NNN}@`
- nums: `NNN=001..999`; zero-pad; ascending per prefix namespace; no reuse
- ann: `@TAG@ (FROM: @UP-1@[, @UP-2@ ...])`
- ann: `@E2E-...@ (TECHNICAL)`

## Edges

- allowed: `UJ -> E2E`
- forbidden: reverse; cycles; `E2E -> IMP`; `UT -> IT|E2E`; `IT -> UT|E2E`

## Source-file conventions

- `UJ`: `docs/journeys/**/*.md`; excl `README.md`
- `UT`: `frontend/src/**/*.spec.ts`; excl `*.int.spec.ts`
- `IT`: `frontend/**/*.int.spec.ts`

## E2E business

- file: `frontend/tests/e2e/**/*.feature`
- comment: `# ...` line above exec tags, before `Scenario`
- annotation: `FROM: @UJ-...@`
- exec tags: `@UJ-... @phase-X @e2e`
- optional scenario tag
- registry: `trace/e2e/{phase-or-domain}.yaml`
- registry fields: `title|files`
- no upstream dup in registry

## E2E technical

- file: `frontend/tests/e2e/**/*.feature`
- trace comment: `# @E2E-...@ (TECHNICAL)`
- no `FROM`
- exec tags: `@phase-X` + `@smoke|@technical-e2e`
- non-business only

## Placement

- E2E trace tags: `.feature` only; **never** in step defs `*.ts`

## Registries

- root: `trace/e2e/`
- type: `UJ` markdown / `E2E` feature
- new traced artifact => entry in same commit
- delete => mark `deleted|obsolete`; never remove

## Cross-checks

- every source tag <-> registry entry
- every registry `file|files` path exists

## Invariants

- `001`: every business `E2E` >= 1 upstream `UJ`
- `002`: unique ID per prefix namespace
- `003`: one defining source file per tag; extra citations ok
- `004`: every `FROM` target exists
- `005`: DAG only
- `006`: allowed edge types only

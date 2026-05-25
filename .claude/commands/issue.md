---
description: Create or update a GitHub issue per AeroDash rules (dedupes, classifies, fills template)
argument-hint: <rough description of the issue>
allowed-tools: Read, Bash, mcp__github__search_issues, mcp__github__list_issues, mcp__github__issue_read, mcp__github__issue_write, mcp__github__add_issue_comment
---

# /issue — AeroDash issue manager

You are the AeroDash Issue Manager. Convert a rough description into a properly classified, deduped, GitHub-ready issue (or update the right existing one).

- `input`: `$ARGUMENTS` — rough issue description
- `input.empty`: return only `Usage: /issue <rough description of the issue>`

## Always-fresh refs (read every invocation, before any GitHub MCP op)

- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`

Use them for: rule constraints, scope mapping, template schema, required/optional fields, title prefix, default labels, valid select options.

- `cache.use`: forbidden
- `hardcode`: forbidden
- `fabricate`: forbidden

## Repo / scope vocabulary (AeroDash-specific)

- repo: `naturelle137/AeroDash`
- types: `Bug`, `Feature` — the `Task` / sub-task type is **discontinued** (see below)
- scope.domain: `product` | `engineering`
- scope.module: `ac` `ap` `ad` `fe` `mb` `pf` `wx` `ui` `uq` `sys` `doc` `sc` `repo`
- safety tag: `safety-critical`
- status (open): `open` | `accepted`
- resolution (closed): `fixed` | `duplicate` | `wont do`

### Type semantics

- `Bug`: flaw | error | failure
- `Feature`: new capability | enhancement | infra | docs | requirements | contributing
- `Task`: **DISCONTINUED — never create one.** Do not create a `Task` issue, apply the
  `Task` label, or create any parent/child sub-issue link. If a `Feature`/`Bug` is
  large, scope it down or split it into **independent** `Feature`/`Bug` issues (no
  parent linkage). A newly-applied `Task` label is auto-stripped by the `Issue Labels`
  workflow. Existing `Task` issues are processed by `/implement-issue` until closed,
  after which the type is removed entirely.

### Lifecycle

- create -> `open`
- `open` -> `accepted` | `duplicate` | `wont do`
- `accepted` -> `fixed` (PR merged to `develop`) | `wont do`
- close `fixed`: PR merged to `develop` | `release/*` | `hotfix/*`; use `Closes #` keyword
- close `duplicate`: link canonical issue
- close `wont do`: rationale required

### Safety classification

- safety.path: `frontend/src/core/`
- safety.match: calculations | formulas | weight balance | performance | Go/No-Go
- on create/update touching safety scope: add `safety-critical`
- unclear: ask user
- omission forbidden on clear P1 impact

## Clarification triggers (ask before proceeding)

- missing required template field
- ambiguous scope module
- unclear safety classification
- unclear update vs create intent

## Branch 1: dedupe & maybe update existing

1. `mcp__github__search_issues` with `$ARGUMENTS` key terms + repo filter + open-state bias
2. show top 5 matches: `issue number | title | labels | state`
3. ask: `update existing` | `create new`

If user picks update:

- ask target issue number
- ask `comment` | `field update`
- read target issue first (`issue_read`)
- draft comment or patch
- review with user
- exec via `add_issue_comment` (comment) or `issue_write method:update` (field)
- never add or change a parent/child sub-issue link (discontinued)
- stop after exec

## Branch 2: create new (no good match OR user chose create)

### Classify

- type: `Bug` | `Feature` only — from `$ARGUMENTS` + rule file; confirm with user
- module scope: from `CONTRIBUTING.md`; ambiguous -> ask
- domain scope: from rules + `CONTRIBUTING.md`
- safety: rules + description + referenced paths/files; unclear -> ask

### Draft (template-driven)

- select template by confirmed type
- fill in template field order: user data first, then ask for unresolved required fields, then optional when known

#### `Bug`

- expand description
- ask if missing: `reproduction` | `severity` | `environment`
- ask if applicable: `hazard_ref`

#### `Feature`

- shape: problem | solution
- ask if missing: `dod`
- ask if applicable: `req_id` | `safety_impact`

### Title

- prefix from template (`[Bug]: `, `[Feat]: `)
- body: concise

### Labels

- start with template defaults (e.g. `Bug` + `open` for bugs)
- add one `scope.module`
- add one `scope.domain`
- add `safety-critical` if applicable
- never apply: `Task`, `fixed`, `duplicate`, `wont do` at creation time

### Review

- show user: title | labels | milestone (if supplied) | body
- loop: revise until approved

### Exec

- `mcp__github__issue_write` `method: create` with `title | body | labels`; optional `milestone` numeric id
- on success show: issue number | title | url | labels

## Parent/child sub-issues — DISCONTINUED

Do **not** create or modify any GitHub parent/child sub-issue relationship, and do
**not** create `Task` issues. The `Task` type and sub-issues are discontinued; new
work is filed as **independent** `Feature`/`Bug` issues. Existing parent/child trees
are processed by `/implement-issue` until closed, then removed entirely.

## Forbidden

- invented types | labels | scopes | template fields
- fabricated hazard refs | requirement IDs | environment values
- skipping dedupe
- creating a `Task` issue or applying the `Task` label — the type is discontinued
- creating or modifying ANY parent/child native sub-issue link

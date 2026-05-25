---
name: implement-issue
description: Use when the user asks to implement, work on, or close out a GitHub issue — including "/implement-issue <ID>", "work on issue #N", "pick up issue 142", "let's tackle the parent feature", or similar. Handles the full AeroDash issue lifecycle: pre-flight ticket reading, parent/child semantics, P1 safety classification, traceability discovery, coverage gates, project-board updates, PR opening, and DoD attestation.
---

# Implement-issue workflow (AeroDash)

You are the lead implementation agent for a safety-first General Aviation flight-prep PWA. Implement the issue end-to-end while preserving rule compliance, traceability, and project-board state.

- `apply`: GitHub-issues conventions per `.claude/commands/issue.md` and `CONTRIBUTING.md §10`
- `input`: `<ISSUE_ID>` — numeric GitHub issue id
- `stop.no-args`: `Usage: /implement-issue <ISSUE_ID>`

## Pre-flight reading

Always read these before classification:
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `docs/testing/TESTING.md`

## Issue intake (parent/child-aware)

1. `mcp__github__issue_read` `get` on the issue
2. `mcp__github__issue_read` `get_labels`
3. `mcp__github__issue_read` `get_sub_issues`
4. **Identify parent.** If this is a `Task`, fetch the parent issue.
5. **Verify parent is open.** If parent is already closed:
   - **STOP** — do not assume greenfield. Audit existing implementation first:
     - `git log --all --grep="#<task-number>"`
     - `git log --all --grep="<REQ-XX-YYY>"`
     - inspect DoD checkboxes vs current repo state
     - check `trace/implementation/*.yaml` for matching IMP entries
   - Summarize the gap to the user before any code change.
   - Do **not** re-open the parent. The recovery PR closes the child only.
6. **Sibling tasks.** Use `get_sub_issues` on parent to determine ordering and dependencies.
7. Confirm issue is `accepted` (not `open` awaiting triage, not already `fixed`).

## Classification

- type: `Bug` | `Feature` | `Task`
- safety: `safety-critical` label present | absent
- coverage: `product` -> gates on; else `engineering`; P1 override on
- boundary:
  - `frontend/src/core/` = `P1`
  - `frontend/src/modules/` = `P2`
  - `frontend/src/shared/|frontend/src/plugins/|frontend/src/stores/` = `P3`

## Sub-issue ordering

- standalone parent task: no sibling fetch
- otherwise fetch open children only; each `issue_read get` + `get_labels`
- order: dependency refs -> P1 -> module -> UI -> parent hints

## Plan presentation

Present a plan with fields: `issue` | `title` | `type` | `safety` | `class` | `coverage-gate` | `scope` | `summary`. Sub-issues table with order and open vs total. Closed children are listed as skipped.

## Project board claim (before any code)

- target project: `AeroDash Dashboard`
- target column: `In Progress`
- resolve IDs: `gh project list --owner naturelle137`; `gh project item-list <PROJECT_NUMBER> --owner naturelle137 --format json`; `gh project field-list <PROJECT_NUMBER> --owner naturelle137 --format json`
- edit: `gh project item-edit --project-id <PROJECT_ID> --id <ITEM_ID> --field-id <STATUS_FIELD_ID> --single-select-option-id <IN_PROGRESS_OPTION_ID>`
- assign parent issue to current user

## P1 safety gating

Detect P1 if any touched `frontend/src/core/` OR any P1 child issue.

P1 constraints:
- pure TypeScript
- no `vue`/`pinia`/UI imports
- deterministic; side-effect free
- Zod validation at boundary

P1 gate: **no code before user approval of FRR (Formal Review Request)**.

FRR fields (present once for all P1 work in this issue):
- `REQ` | `H` | output impact | pure-TS guarantee | deterministic guarantee | Zod plan | formula LaTeX | unit normalization | test plan | `>=3` edge cases | ADR need

## Implementation cycle

A `Feature` is finished only when EVERY child is finished — never partial. Pick the mode:

- **Discovery / scoping ticket** (body says "discovery/scoping", "not an
  implementation ticket", "produce a recommendation", "file follow-up issues"):
  its deliverable is the written recommendation + the filed follow-ups. When those
  exist, it is DONE — its PR `Closes #{ISSUE_ID}`. File the follow-ups as
  **independent** issues that *reference* this one in their body (e.g. "Spawned by
  #{ISSUE_ID}") — do NOT attach them as native sub-issues, and do NOT hold this
  ticket open as an umbrella waiting on them.
- **Standalone issue** (no children): implement it; its PR `Closes #{ISSUE_ID}`.
- **Feature with open children — all-in-one:** implement the feature AND every open
  child on THIS branch, in dependency order; the single PR `Closes` the feature *and*
  every child.
- **Sub-task (`Task`) — incremental:** implement this task; its PR `Closes #{TASK_ID}`.
  If NO sibling remains open afterwards, this is the feature's last task — its PR ALSO
  `Closes #{PARENT_ID}` (attest the parent DoD too). If siblings remain open, close
  only this task and leave the parent open.

Per item: read -> classify boundary -> trace discovery -> edit -> trace update -> registry update -> tests -> commit.

If a child is genuinely blocked: skip it, record the reason, leave the parent open — never fake-close a feature with unfinished children.

## Read-before-write

- all touched source
- all touched registries
- relevant issue bodies

## Code rules

- `ARCHITECTURE.md`, `CONTRIBUTING.md`
- Composition API, Pinia stores
- math delegation to `core/`

## Trace discovery and updates

- inspect issue body, `docs/requirements/`, `trace/`, relevant registries
- next sequential IDs per the `traceability` skill rules
- new traced artifact -> same-commit registry entry
- fully implemented referenced REQ -> update source `docs/requirements/**/*.md` status to `Implemented`
- partial / blocked / unverified / follow-up remains -> do not change requirement status

## Test selection

- P1: `*.spec.ts`; core logic / domain / adapters
- integration: `*.int.spec.ts`; stores / services / cross-module handshakes
- E2E: UI-facing changes (use the `e2e` skill)

Coverage source-of-truth: `docs/testing/TESTING.md`.

Coverage gates:
- `product`: modified-file thresholds mandatory
- `engineering`: no mandatory creation/thresholds unless P1
- P1: `90%` line + branch + function

Bug protocol: failing test first -> minimal fix -> passing verification.

Verify after each logical unit. Coverage cmd: `pnpm --filter frontend vitest run --coverage`. Loop adding tests until gate passes.

## Commits

- conventional commits
- scope: module label
- format: `{type}({scope}): {description} (refs #{ISSUE_ID})`
- one commit per implemented child; standalone issue → one commit
- child id first; parent id optional extra ref
- changelog policy: do **not** update `CHANGELOG.md` here (reserved for release process)

## Issue updates

### Child task done (DoD-attested)
Comment: `changes` + `files` + `trace` + `tests` + `Part of #{PARENT_ID}`. Attest the DoD so EVERY box ends ticked `[x]`: tick items genuinely done; for an item that does not apply, tick it and mark `N/A — <reason>`; NEVER tick an item that applies but is not done (finish it, or split the residue into a follow-up `Task`). The DoD gate rejects a closing PR whose issue still has any unticked box.

### Child task skipped
Comment reason only; no DoD checks. The parent stays open.

### Parent
Attest the parent DoD the same way — every box ends `[x]` (genuinely done, or `N/A — <reason>`); never tick skipped/unverified/manual-flight items. Only close the parent when all children are closed and every parent DoD box is ticked.

Parent comment fields: implementation summary | sub-issue status | files modified | trace ids + upstreams | test results | coverage compliance (if `product`) | DoD status. Omit sub-issues field when none.

## Final state

- read current labels first
- update labels via valid transition only; preserve unrelated labels
- target project column: `In Verification`
- edit via `gh project item-edit ... --single-select-option-id <IN_VERIFICATION_OPTION_ID>`

## Stop conditions

- referenced `REQ` not found
- math/formula change with unclear spec
- Go/No-Go or advisory-output risk
- issue vs code/docs mismatch
- architectural change without ADR
- any moment user guidance is required → pause and ask

## Reference: project board command shape

`gh project item-edit --project-id <PROJECT_ID> --id <ITEM_ID> --field-id <STATUS_FIELD_ID> --single-select-option-id <OPTION_ID>`

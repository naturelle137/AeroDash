---
description: Create or refresh a GitHub PR for the current branch with branch + changelog enforcement
argument-hint: <target-branch> [changelog=yes|no]
allowed-tools: Read, Edit, Bash, mcp__github__get_me, mcp__github__list_branches, mcp__github__search_pull_requests, mcp__github__create_pull_request, mcp__github__update_pull_request
---

# /pr.create — PR publisher (AeroDash)

You are the PR publisher for AeroDash. Safety-first; GitHub MCP-driven.

- `input`: `$ARGUMENTS`
- `input.parse`: `<target-branch> [changelog=yes|no]`
- `input.default.changelog`: `yes`
- `input.invalid`: return only `Usage: /pr.create <target-branch> [changelog=yes|no]`

## Pre-reads (every invocation, before any GitHub op)

- `.github/pull_request_template.md`

## Pre-discovery

- GitHub: `mcp__github__get_me`, `mcp__github__list_branches`
- git: `git branch --show-current`, `git status --short`, `git log --oneline <target-branch>..HEAD`, `git diff --stat <target-branch>...HEAD`

### Block start if

- dirty worktree (modifications outside the staged-and-committed CHANGELOG)
- unresolved merge / rebase / cherry-pick
- no current branch
- no commits ahead of target

## Branch policy

- source allowed: `feature/*`, `release/*`, `hotfix/*`
- source blocked: `main`, `develop`, detached HEAD, invalid names
- target for `feature/*`: `develop` only
- target for `release/*`: `main` | `develop`
- target for `hotfix/*`: `main` | `develop`

Stop on source/target mismatch.

## Issue references

- prefer existing valid `Closes #...` / `Fixes #...` / `Refs #...` from commits in `<target-branch>..HEAD`
- target `develop`: `Closes #<n>` | `Fixes #<n>` (auto-close on merge)
- target `main`: `Ref #<n>` only (issues already closed on develop merge)
- on `develop` target: only issues actually worked in this PR — never inferred-only or agent-created issues
- ambiguous: ask user

## Changelog (`yes` by default)

- file: `CHANGELOG.md`
- input signal: full source-branch change set (commit range + diff + touched docs/code + issue context). **Never** treat commits as the only source.
- target `develop` -> update `## [Unreleased]`
- target `main` -> use existing release section. If source is `release/v*`, version = branch suffix after `release/v`. Otherwise, if version cannot be safely determined → stop and ask.

### Sections (allowed)

- `### Added` (user-facing addition)
- `### Changed` (user-facing change)
- `### Fixed` (user-facing fix)
- `### Engineering` (tooling/docs/process — no user-facing impact)

### Targeting

- user-facing product → `Added | Changed | Fixed`
- tooling / docs / process → `Engineering`

### Writing rules

- one-line entries; short; precise
- no commit list; no per-commit narration
- no copied source-file content; no minor-detail prose
- no GitHub issue ref in entries
- forbid: duplicate version header | duplicate entry | duplicate section | long prose | commits-as-only-source

### Commit changelog edits

- if `CHANGELOG.md` changed → create a **new** conventional commit (never amend)
- push the branch to `origin` after the changelog commit, before opening the PR

## PR existence check

- `mcp__github__search_pull_requests` with `repo:naturelle137/AeroDash is:open head:<current-branch> base:<target-branch>`
- on match → `mcp__github__update_pull_request` (title/body) — never create a duplicate PR

## PR title

concise conventional-commit-style summary derived from commits + diff

## PR body

- start from `.github/pull_request_template.md` — preserve headings, order, checklists
- `### Issue State Management`: keep the bullet if merging to `develop`; delete it if merging to `main`
- remove placeholder `-` / empty list lines under `### Related Issues` once filled

### Checklist disposition (every box ends as `[x]`)

A PR is "ready" only when every checkbox is `[x]`. An unchecked `[ ]` reads as **"open / not done"** even when the row is genuinely N/A — leaving boxes empty misrepresents the PR's state to reviewers and CI gates.

**Done means:** the work was performed, OR the row is genuinely not applicable AND its template line includes `OR N/A` AND a Reason is filled. In **both** cases, the box ends `[x]`.

Negative rules — never violate any of these:

- **Never** `[x]` work that wasn't actually done.
- **Never** `[x]` an N/A row without a Reason.
- **Never** `[x]` N/A on a row that does not allow `OR N/A` (Target Branch, DoD, Review, ADR, Safety bullets are never N/A-eligible — verify or do the work).
- **Never** mark a row N/A when it is actually applicable — do the work or split the PR.

The only legitimate `[ ]` is the post-merge `If merging to <base>…` line under Issue State Management, which stays unchecked until the merge actually happens.

### Body sections (filled honestly)

- summary: brief bullets only
- related: `Closes/Fixes #...` (develop) or `Ref #...` (main) per rules above
- docs: only real updates to requirements / architecture / risk / journeys / code-doc / changelog
- testing: only checks actually run; otherwise `N/A` with reason

## P1 PR additional checklist (when diff touches `frontend/src/core/`)

Before marking ready, verify and document in PR body:

- [ ] No `vue`, `pinia`, or `vue-router` imports in modified files
- [ ] `pnpm --filter frontend test:p1` passes
- [ ] `pnpm --filter frontend run lint:ci:eslint` — zero `[P1-ISOLATION]` warnings
- [ ] All new exported functions are pure (deterministic, side-effect free)
- [ ] All external inputs validated with Zod before reaching math logic
- [ ] 90% line + branch + function coverage on new P1 code
- [ ] If a new top-level `src/` directory was added, update `no-restricted-imports` in `frontend/eslint.config.ts`
- [ ] An ADR exists or has been updated if the P1 interface surface changed

## PR exec

- `mcp__github__create_pull_request` with `owner=naturelle137 repo=AeroDash draft=false maintainer_can_modify=true`

## Final output

- success: `PR #<number>: <url>`
- failure: blocker only — no explanation, no justification

## Temp files

- if a temporary file is needed, use `.tmp/` only

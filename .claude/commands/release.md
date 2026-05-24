---
description: Cut a Gitflow release end-to-end — author a pilot-facing GitHub release description, then publish (PR release→main, signed tag, GitHub Release, back-merge to develop)
argument-hint: [version, e.g. v0.3.0-alpha — empty = derive from the release branch]
allowed-tools: Skill, Read, Grep, Glob, Bash, Edit, Write, AskUserQuestion
---

# /release — author the release description & publish (AeroDash)

Run the **`release`** skill to publish the release for the current `release/*` (or `hotfix/*`) branch.

- `$ARGUMENTS`: optional version (e.g. `v0.3.0-alpha`). Empty → derive from the branch name.

## Procedure

Invoke the `release` skill and follow it exactly:

1. **Resolve & finalize** — version from branch/argument; confirm both `package.json` files match;
   ensure the dated `## [<version>]` CHANGELOG section and its compare link exist.
2. **Readiness gate** — `type-check`, `lint`, `test:unit` + `test:p1`, `build` must be green. Never weaken a gate.
3. **Author the notes** — write/refine `.github/release-notes/v<version>.md` per `release-notes.md` (pilot-facing,
   not a dev changelog). **Get user approval** before it goes public, then commit + push the release branch.
4. **Back-merge release→`develop` FIRST** — `develop` is locked with a self-unapprovable code-owner review,
   so after **confirming**, admin-merge it (`gh pr merge --admin`; PR body uses `Ref #`, never `Closes`, to
   clear the DoD gate). Done before `main` so the release branch still exists.
5. **Publish to `main` LAST** — open the release PR (template; `Ref #` only), wait for `lint-markdown`, admin-merge.
   This triggers `publish-release.yml` and auto-deletes the release branch (`deleteBranchOnMerge`).
6. **Verify & finish** — the workflow tags + publishes from the notes file; check the release body, tag, and
   pre-release flag (manual fallback if it didn't run); then cleanup, optional milestone close, release-URL summary.

Run `/release-audit` first to clear release blockers. Pairs with `/pr.create` for PR conventions.

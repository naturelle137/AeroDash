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
4. **Back-merge release→`develop`** — after publication confirmation, obtain independent
   review, verify gates and signatures, then use `gh pr merge <pr> --merge --match-head-commit <sha>`.
   Preserve the release branch; no administrative bypass.
5. **Publish to `main`** — retain the publication confirmation, verify the target PR review and live preflight.
   Use `gh pr merge <pr> --merge --match-head-commit <sha>` for release and hotfix branches.
   No bypass or queued auto-merge. Verify resulting signature and `publish-release.yml` execution.
6. **Verify & finish** — the workflow tags + publishes from the notes file; check the release body, tag, and
   pre-release flag (manual fallback if it didn't run); then cleanup, optional milestone close, release-URL summary.

Run `/release-audit` first to clear release blockers. Pairs with `/pr.create` for PR conventions.

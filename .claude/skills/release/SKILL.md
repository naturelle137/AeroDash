---
name: release
description: Use to cut a Gitflow release for AeroDash end-to-end — when the user says "release vX.Y.Z", "publish the release", "finish the vX release", "cut a release", "ship it", or invokes /release. Authors a pilot-facing GitHub release description from the CHANGELOG + milestone, then executes the full Gitflow publish (PR release→main, signed tag, GitHub Release, back-merge to develop). Pairs with /release-audit — run that first to clear release blockers.
---

# Release publisher (AeroDash)

Turn a stabilized `release/*` (or `hotfix/*`) branch into a published GitHub release and
get `develop` back in sync. AeroDash is safety-critical and the release is **outward-facing
and hard to reverse** — correctness over speed, two mandatory acceptance gates
under [ADR-319 E3](../../../docs/architecture/adr/319-DEV-agent-review-governance.md#bounded-release-authority-e3).
Legal/safety claims and CEO-name publication still need explicit CEO approval.

- `input`: optional version (e.g. `v0.3.0-alpha`). Empty → derive from the branch.
- `pairs.with`: `/release-audit` (clear audit blockers first), `/pr.create` (PR conventions).

## How the publish actually works

`.github/workflows/publish-release.yml` fires on **push to `main`**. It reads the version
from root `package.json`, creates and pushes the `v<version>` tag if absent, and publishes
a GitHub Release whose body is `.github/release-notes/v<version>.md` (auto-detecting the
pre-release flag from the SemVer suffix). **So the merge to `main` is what releases.** This
skill prepares the inputs that workflow consumes, triggers the merge, then verifies the result.
Inspect live publication guards first: the workflow may be disabled or guarded.
E3 does not authorize restoring GitHub/Netlify publication or bypassing guards
with the fallback in Step 6; stop publication until separately authorized.

## Merging into protected branches (`main` and `develop`) — read before Steps 4 & 6

Follow `docs/architecture/adr/319-DEV-agent-review-governance.md` on each target.
Re-read live protection; historical lock/approval settings are not authority.
Verify every introduced commit signature, local gates, current CI/security,
resolved findings and independent APPROVE naming full head/base.
A head/base refresh requires current CI and signature verification. Never bypass protection,
queue auto-merge, or assume a signed merge repairs unsigned history.

Release and hotfix PRs to either target preserve ancestry. Use `gh pr merge <pr> --merge --match-head-commit <full-head-sha>` only
after final live checks and the acceptance gates below. Verify resulting
signature and integration CI. Preserve the release branch until both target PRs
are complete; inspect branch-deletion settings before merging.

## Always-fresh refs (read every run)

- `docs/development/BRANCHING_STRATEGY.md` (Gitflow publish/back-merge steps)
- `CHANGELOG.md` (the dated section for this version — the notes source)
- `.github/release-notes/` (existing notes; the `.markdownlint.json` override that exempts them)
- `.github/pull_request_template.md` (the PR body to fill)
- `release-notes.md` (sibling — the pilot-facing authoring craft)
- milestone state: `gh api "repos/naturelle137/AeroDash/milestones?state=all"`

## Preconditions — block start if any fail

- current branch is not `release/*` or `hotfix/*` (`git branch --show-current`)
- worktree dirty with unrelated changes (`git status --short`) — release/changelog/notes edits are fine
- unresolved merge / rebase / cherry-pick
- a `/release-audit` was expected but blockers are unaddressed — confirm they are cleared

## Step 1 — Resolve version & finalize the changelog

- **Version**: from a `release/v<version>` branch, `version` = suffix after `release/v`.
  For `hotfix/*`, take it from `$ARGUMENTS` or the bumped `package.json`. Strip the leading `v`.
- **Version consistency**: root and frontend `package.json` must both equal `<version>`:
  `node -p "require('./package.json').version"`, `node -p "require('./frontend/package.json').version"`.
  On mismatch, bump both and commit `chore(repo): bump version to <version>`.
- **Changelog**: ensure a dated `## [<version>] - <YYYY-MM-DD>` section exists (date = today
  unless the user fixes it). If the content is still under `## [Unreleased]`, move it down into
  the dated section and leave an empty `## [Unreleased]` on top.
- **Compare link**: ensure the bottom-of-file reference exists:
  `[<version>]: https://github.com/naturelle137/AeroDash/releases/tag/v<version>`. Add it if missing.
- `pre-release` = version contains `-alpha` / `-beta` / `-rc` / `-pre`. Record it; it drives later steps.

## Step 2 — Readiness gate (fail fast, before anything public)

Run the gate and only proceed when green. Fix or stop — never weaken a gate, never `--no-verify`.

```bash
pnpm --filter frontend type-check
pnpm lint
pnpm test:unit && pnpm --filter frontend test:p1
pnpm build
```

Run integration and applicable Chromium/release browser journeys on the final candidate;
do not assume the existing required-check list covers every mandatory test. If anything fails, stop and report — do not publish a broken build.

## Step 3 — Author the pilot-facing release notes

Write (or refine) `.github/release-notes/v<version>.md` following **`release-notes.md`** exactly
— this is the user's release description, not a developer changelog. Source it from the dated
CHANGELOG section + the milestone theme + roadmap. Keep the established structure and tone of the
shipped `v0.2.0-alpha.md` / `v0.3.0-alpha.md`.

- **Acceptance gate #1 (mandatory):** a fresh independent session accepts the
  full notes draft against its dated CHANGELOG, triage and scope limits. Record
  version, exact notes content/digest, reviewer job and verdict per ADR-319 E3.
  Board-scope wording needs explicit CEO approval; ambiguity stays pending.
  These notes are published verbatim to the public release page.
- Commit the notes (with any version/changelog edits from Step 1) on the release branch with a
  conventional commit (e.g. `docs(repo): add v<version> release notes`), then push the branch:
  `git push origin <branch>`. (`.github/release-notes/**` and `CHANGELOG.md` are markdownlint-exempt.)

## Step 4 — Back-merge to `develop` (do this FIRST, from the release branch)

Merge the **release branch into `develop` before `main`**, so the branch still exists — the merge to
`main` in Step 5 auto-deletes it. This is the canonical Gitflow back-merge (release → develop) done
right, not the `main → develop` workaround forced by the branch being gone.

- **Acceptance gate #2 (mandatory):** before the first merge, record independent
  acceptance of the concrete candidate and committed notes per ADR-319 E3.
  Each target PR needs its full head/base, triage and fresh gate evidence.
  Candidate/notes changes need a scoped acceptance update; a base refresh uses
  Decision 6, not a second full review. Once merged, backing out means reverting.

1. Open the back-merge PR from the release branch (reuse an open `head:<branch> base:develop` PR):
   `gh pr create --base develop --head <branch> --title "chore(repo): back-merge release v<version> to develop"`
   Body: short summary + `Ref #<n>` if useful. **No `Closes`/`Fixes`/`Resolves`** — it closes nothing,
   and a closing keyword trips the DoD gate.
2. Mergeability: `gh pr view <pr> --json mergeable,mergeStateStatus`.
   - `MERGEABLE` → go to 3.
   - If the branch is behind and merges cleanly, use the GitHub PR update-branch
     API with `expected_head_sha`. Verify the new commit signature and repeat CI.
   - If conflicts prevent a signed merge, retain both branches and stop release
     integration until a verified merge-signing path is available. GitHub's
     createCommitOnBranch API creates single-parent commits.
3. Wait for the required `develop` checks (`gh pr checks <pr> --watch`):
   `Lint`, `Type Check`, `Unit Tests`, `Build`, `E2E Tests`.
4. After candidate acceptance above, complete the live ADR-319 preflight and merge
   with `gh pr merge <pr> --merge --match-head-commit <sha>`. Verify resulting signature and CI.
   Preserve the release branch for Step 5.

## Step 5 — Publish to `main` (LAST — this releases and disposes of the branch)

1. Open the release PR using the template (`### Issue State Management` bullet removed for `main`;
   Related Issues use `Ref #` only, never a closing keyword):
   `gh pr create --base main --head <branch> --title "Release v<version>" --body-file <filled-template>`
   Reuse an existing open `head:<branch> base:main` PR instead of duplicating.
2. Wait for all live required checks and applicable release/security gates.
3. Record target-specific candidate acceptance through the single independent
   review and complete the ADR-319 live preflight, including any explicit CEO approval. Run `gh pr merge <pr> --merge --match-head-commit <sha>`; verify signature and resulting CI. Inspect the actual
   `publish-release.yml` result.

## Step 6 — Verify the GitHub Release

The push to `main` triggers `publish-release.yml`. Watch and verify:

- `gh run list --workflow="Publish GitHub Release" --limit 1` → `gh run watch <id>`
- `gh release view v<version>` — body equals `.github/release-notes/v<version>.md`; tag exists.
- Pre-release flag correct: `gh api repos/naturelle137/AeroDash/releases/tags/v<version> --jq .prerelease`.
  If wrong: `gh release edit v<version> --prerelease` (pre-release) or
  `gh release edit v<version> --prerelease=false --latest` (GA).
- **Fallback** (workflow disabled/failed/no tag): create it manually —
  `gh release create v<version> --title "v<version>" --notes-file .github/release-notes/v<version>.md`
  add `--prerelease` for a pre-release tag. (Tag first if needed:
  `git tag -a v<version> -m "Release v<version>" && git push origin v<version>`.)
- Optional: attach a release asset if an audit bundle exists for this version (`gh release upload`).

## Step 7 — Finish

- The `release/*` branch was auto-deleted on its merge to `main` (`deleteBranchOnMerge`) — nothing to
  do; delete any integration branch created in Step 4.
- Confirm both targets hold the release: the tag on `main`, and `develop`'s tip carries the back-merge.
- **Optional, confirm first:** close the milestone once its issues are resolved —
  `gh api -X PATCH repos/naturelle137/AeroDash/milestones/<n> -f state=closed`.
- Output a summary: release URL, tag, pre-release flag, `develop` synced (yes/no), milestone status.

## Guardrails

- Never push directly to `main` or `develop` — always via PR.
- Never `--no-verify`, never weaken or skip a gate to get green.
- Never publish without notes acceptance (gate #1) and target candidate acceptance
  (gate #2); retain explicit CEO approval for board scope under ADR-319 E3.
- Never fabricate changelog/notes entries — everything traces to the dated CHANGELOG section.
- Keep the release notes pilot-facing — defer all wording decisions to `release-notes.md`.
- Administrative bypass and direct protected-branch pushes are forbidden.
- Treat the release as irreversible once published: a wrong tag/body needs `gh release delete` +
  `git push origin --delete v<version>` and a re-run — avoid it by verifying before the merge sequence.
- Temp files (filled PR template, etc.) go in `.tmp/` only.

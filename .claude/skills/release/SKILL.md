---
name: release
description: Use to cut a Gitflow release for AeroDash end-to-end — when the user says "release vX.Y.Z", "publish the release", "finish the vX release", "cut a release", "ship it", or invokes /release. Authors a pilot-facing GitHub release description from the CHANGELOG + milestone, then executes the full Gitflow publish (PR release→main, signed tag, GitHub Release, back-merge to develop). Pairs with /release-audit — run that first to clear release blockers.
---

# Release publisher (AeroDash)

Turn a stabilized `release/*` (or `hotfix/*`) branch into a published GitHub release and
get `develop` back in sync. AeroDash is safety-critical and the release is **outward-facing
and hard to reverse** — correctness over speed, two mandatory confirmation gates, nothing
public the user hasn't approved.

- `input`: optional version (e.g. `v0.3.0-alpha`). Empty → derive from the branch.
- `pairs.with`: `/release-audit` (clear audit blockers first), `/pr.create` (PR conventions).

## How the publish actually works

`.github/workflows/publish-release.yml` fires on **push to `main`**. It reads the version
from root `package.json`, creates and pushes the `v<version>` tag if absent, and publishes
a GitHub Release whose body is `.github/release-notes/v<version>.md` (auto-detecting the
pre-release flag from the SemVer suffix). **So the merge to `main` is what releases.** This
skill prepares the inputs that workflow consumes, triggers the merge, then verifies the result.

## Merging into protected branches (`main` and `develop`) — read before Steps 4 & 6

Both `main` and `develop` are protected identically, and it breaks every release if you forget it:

- **Locked + un-self-approvable review.** Each branch has `lock_branch: true` (read-only) and
  requires **1 code-owner review**; the sole code owner is `@naturelle137`, who cannot approve their
  own PR. A normal merge is therefore **always rejected** for a solo maintainer — this is what failed
  before.
- **Admin override is the merge mechanism.** `enforce_admins` is **false**, so the working path is
  `gh pr merge <pr> --merge --admin` (bypasses the lock + the missing review). This is exactly how the
  v0.2.0 back-merge (PR #138) actually merged — by admin, with `reviewDecision: REVIEW_REQUIRED` and
  zero reviews. **Name the override every time**; it is legitimate only because the maintainer is the
  sole code owner and authored the release. If the operator is not a repo admin, stop and hand the
  merge to the user.
- **Signatures are handled for you.** GitHub signs the merge commit it creates (PR #138's was
  `verified: true`), satisfying `required_signatures` — *provided* you merge through GitHub
  (`gh pr merge`), not a local push. Only locally-authored commits (e.g. conflict resolution) risk an
  unsigned commit; `--admin` bypasses that too, but sign them if you can.
- **Required checks must be green first.** `main` → `lint-markdown`. `develop` → `Lint`, `Type Check`,
  `Unit Tests`, `Build`, `E2E Tests` (these run via `ci.yml` on PRs into `develop`). Non-required
  checks (`pnpm audit`, `verify-dod-attestation`) may show red without blocking — note, don't gate.
- **The DoD Attestation Gate (`dod-gate.yml`) fails any PR body containing `Closes`/`Fixes`/`Resolves #N`.**
  Release and back-merge PRs close nothing (issues already closed on their `develop` feature merges) —
  use `Ref #` only, never a closing keyword, or the gate goes red.
- **`deleteBranchOnMerge: true`.** The `release/*` branch is auto-deleted the instant it merges to
  `main`. So back-merge the release branch into **`develop` first** (Step 4, while it still exists),
  then merge it into **`main` last** (Step 5), which both publishes the release and disposes of the
  branch. Do **not** route the back-merge through `main` — that was only a workaround for the branch
  being gone.

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

E2E and full integration already gate `develop`; re-run them only if the release branch changed
behavior since. If anything fails, stop and report — do not publish a broken build.

## Step 3 — Author the pilot-facing release notes

Write (or refine) `.github/release-notes/v<version>.md` following **`release-notes.md`** exactly
— this is the user's release description, not a developer changelog. Source it from the dated
CHANGELOG section + the milestone theme + roadmap. Keep the established structure and tone of the
shipped `v0.2.0-alpha.md` / `v0.3.0-alpha.md`.

- **Confirmation gate #1 (mandatory):** show the full notes draft and get explicit user approval
  before it goes anywhere. These notes are published verbatim to the public release page.
- Commit the notes (with any version/changelog edits from Step 1) on the release branch with a
  conventional commit (e.g. `docs(repo): add v<version> release notes`), then push the branch:
  `git push origin <branch>`. (`.github/release-notes/**` and `CHANGELOG.md` are markdownlint-exempt.)

## Step 4 — Back-merge to `develop` (do this FIRST, from the release branch)

Merge the **release branch into `develop` before `main`**, so the branch still exists — the merge to
`main` in Step 5 auto-deletes it. This is the canonical Gitflow back-merge (release → develop) done
right, not the `main → develop` workaround forced by the branch being gone.

- **Confirmation gate #2 (mandatory):** the next steps merge the release into `develop` and then
  publish it to `main`. Get an explicit go-ahead **before the first merge** — once `develop` has it,
  backing out means reverting.

1. Open the back-merge PR from the release branch (reuse an open `head:<branch> base:develop` PR):
   `gh pr create --base develop --head <branch> --title "chore(repo): back-merge release v<version> to develop"`
   Body: short summary + `Ref #<n>` if useful. **No `Closes`/`Fixes`/`Resolves`** — it closes nothing,
   and a closing keyword trips the DoD gate.
2. Mergeability: `gh pr view <pr> --json mergeable,mergeStateStatus`.
   - `MERGEABLE` → go to 3.
   - `CONFLICTING` → resolve on an integration branch, never in `develop`:
     `git switch -c chore/back-merge-v<version> origin/develop` → `git merge origin/<branch>` →
     resolve (CHANGELOG = union: develop's `[Unreleased]` **plus** the released `[<version>]` section;
     `package.json` = the released version) → commit (sign it if you can) →
     `git push -u origin chore/back-merge-v<version>` → re-open the PR with `--head chore/back-merge-v<version>`.
3. Wait for the required `develop` checks (`gh pr checks <pr> --watch`):
   `Lint`, `Type Check`, `Unit Tests`, `Build`, `E2E Tests`.
4. Merge via admin override (`develop` is locked + the review can't be self-approved):
   `gh pr merge <pr> --merge --admin`. GitHub signs the merge commit. Delete any integration branch
   after. **Do not delete the release branch — Step 5 needs it.**

## Step 5 — Publish to `main` (LAST — this releases and disposes of the branch)

1. Open the release PR using the template (`### Issue State Management` bullet removed for `main`;
   Related Issues use `Ref #` only, never a closing keyword):
   `gh pr create --base main --head <branch> --title "Release v<version>" --body-file <filled-template>`
   Reuse an existing open `head:<branch> base:main` PR instead of duplicating.
2. Wait for the required check (`lint-markdown`): `gh pr checks <pr> --watch`.
3. Merge via admin override — see "Merging into protected branches":
   `gh pr merge <pr> --merge --admin`. GitHub signs the merge commit, the push to `main` triggers
   `publish-release.yml`, and the `release/*` branch auto-deletes (`deleteBranchOnMerge`) — all expected.
   If the operator is not an admin, hand the merge to the user.

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
- Never publish release notes the user hasn't approved (gate #1); never start the merge sequence
  (Step 4, `develop` → then `main`) without gate #2.
- Never fabricate changelog/notes entries — everything traces to the dated CHANGELOG section.
- Keep the release notes pilot-facing — defer all wording decisions to `release-notes.md`.
- `--admin` merges are the documented bypass **only** because the maintainer is the sole code owner;
  name it each time you use it. If the operator is not an admin, hand the merge to the user.
- Treat the release as irreversible once published: a wrong tag/body needs `gh release delete` +
  `git push origin --delete v<version>` and a re-run — avoid it by verifying before the merge sequence.
- Temp files (filled PR template, etc.) go in `.tmp/` only.

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

## Step 4 — Publish to `main`

1. Open the release PR using the template (`### Issue State Management` bullet removed for `main`;
   Related Issues use `Ref #` only, never `Closes #`):
   `gh pr create --base main --head <branch> --title "Release v<version>" --body-file <filled-template>`
   Reuse an existing open `head:<branch> base:main` PR instead of duplicating.
2. Wait for the required check (`lint-markdown`) to pass: `gh pr checks <pr> --watch`.
3. **Confirmation gate #2 (mandatory):** the next action publishes the release. Confirm with the user
   before merging.
4. Merge. `main` requires a code-owner review (sole owner `@naturelle137`, who cannot approve their
   own PR) and signed commits, but `enforce_admins` is **false**, so an admin merge is the path:
   `gh pr merge <pr> --merge --admin`. The GitHub merge commit is auto-signed, satisfying the
   signature rule. **Flag explicitly** that `--admin` bypasses the review/lock — legitimate only
   because the maintainer is the sole code owner and authored the release. If `--admin` is refused,
   stop and ask the user to approve/merge in the UI. Do **not** delete the release branch yet.

## Step 5 — Verify the GitHub Release

The push to `main` triggers `publish-release.yml`. Watch and verify:

- `gh run list --workflow="Publish GitHub Release" --limit 1` → `gh run watch <id>`
- `gh release view v<version>` — body equals `.github/release-notes/v<version>.md`; tag exists.
- Pre-release flag correct: `gh api repos/naturelle137/AeroDash/releases/tags/v<version> --jq .prerelease`.
  If wrong, fix it: `gh release edit v<version> --prerelease` (pre-release) or
  `gh release edit v<version> --prerelease=false --latest` (GA).
- **Fallback** (workflow disabled/failed/no tag): create it manually —
  `gh release create v<version> --title "v<version>" --notes-file .github/release-notes/v<version>.md`
  add `--prerelease` for a pre-release tag. (Tag first if needed: `git tag -a v<version> -m "Release v<version>" && git push origin v<version>`.)
- Optional: attach a release asset if an audit bundle exists for this version (`gh release upload`).

## Step 6 — Back-merge to `develop`

Gitflow requires the release to land back on `develop` (version bump, changelog, any release fixes).

- `gh pr create --base develop --head <branch> --title "chore(repo): back-merge release v<version> to develop"`
- Resolve conflicts deliberately: keep the released `[<version>]` changelog section and version
  numbers, but preserve any new `## [Unreleased]` entries already on `develop`.
- Wait for the full `develop` CI to pass (`gh pr checks <pr> --watch`).
- Merge (code-owner review applies here too → `gh pr merge <pr> --merge --admin` for the sole maintainer).

## Step 7 — Finish

- Delete the release branch (`deleteBranchOnMerge` may auto-remove it; else `git push origin --delete <branch>`).
- **Optional, confirm first:** close the milestone once its issues are resolved —
  `gh api -X PATCH repos/naturelle137/AeroDash/milestones/<n> -f state=closed`.
- Output a summary: release URL, tag, pre-release flag, `develop` synced (yes/no), milestone status.

## Guardrails

- Never push directly to `main` or `develop` — always via PR.
- Never `--no-verify`, never weaken or skip a gate to get green.
- Never publish release notes the user hasn't approved (gate #1); never merge to `main` without gate #2.
- Never fabricate changelog/notes entries — everything traces to the dated CHANGELOG section.
- Keep the release notes pilot-facing — defer all wording decisions to `release-notes.md`.
- `--admin` merges are the documented bypass **only** because the maintainer is the sole code owner;
  name it each time you use it. If the operator is not an admin, hand the merge to the user.
- Treat the release as irreversible once published: a wrong tag/body needs `gh release delete` +
  `git push origin --delete v<version>` and a re-run — avoid it by verifying before gate #2.
- Temp files (filled PR template, etc.) go in `.tmp/` only.

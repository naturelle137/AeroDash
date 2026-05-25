# 318-DEV-changelog-and-release-versioning: Curated Changelog & Explicit Release Versioning

* **Status:** Proposed
* **Date:** 2026-05-25

## Context

AeroDash is a safety-critical PWA where pilots must be able to tell, at a
glance, *exactly* what changed between two versions and whether a given build
is a pre-release. Clear, accurate release communication is therefore a safety
concern, not a cosmetic one (issue #22, issue #121).

The original automation (`release-it` + `@release-it/conventional-changelog`,
installed under #22) was found to be actively misleading during the
v0.2.0-alpha pipeline run:

1. **Wrong version inference.** The conventional-changelog plugin counted every
   `feat` commit across the full history and proposed a bump to `v1.0.0`,
   ignoring the `0.2.0-alpha` baseline. Pre-release identifiers
   (`-alpha` / `-beta` / `-rc`) were not respected. Publishing a `1.0.0`
   "stable" tag for alpha software is precisely the *accidental use of Beta
   software* hazard #22 set out to prevent.
2. **Noise over signal.** The auto-generated changelog dumped the raw commit
   log into `CHANGELOG.md`. That information already lives in GitHub's commit
   and PR history; duplicating it added no editorial value and buried the few
   lines a pilot actually needs to read.

As a stop-gap the changelog plugin was disabled in `.release-it.json` (git,
npm-publish and github all set to `false`) and `CHANGELOG.md` was maintained by
hand. In parallel, a purpose-built publish workflow
(`.github/workflows/publish-release.yml`) was introduced and has shipped
v0.2.0-alpha and v0.3.0-alpha. That workflow — not `release-it` — is now the de
facto release pipeline, leaving `release-it` installed but unused. The
historical CI entry-point named `release.yml` no longer exists; it was replaced
by `publish-release.yml`.

CONTRIBUTING §7 requires a change to the developer/release workflow to be
governed by an ADR. This ADR formalizes the approach that is already running
and removes the dead scaffolding so the tooling reflects reality.

## Considered Options

* **Option 1: Keep `release-it`, pin the version via `--increment`, no
  changelog plugin (manual `CHANGELOG.md`).** Fixes the wrong-version bug by
  never inferring from commit counts. But it retains a heavyweight dependency
  whose remaining job (editing the `version` field in `package.json`) is a
  one-line manual edit, and it is not actually invoked anywhere in the shipping
  release path.

* **Option 2: Keep `release-it` with `@release-it/bumper` reading the version
  from the branch name (`release/vX.Y.Z`).** Correct version source, but adds a
  *second* plugin and configuration surface to solve a problem the publish
  workflow already solves by reading `package.json`.

* **Option 3: A minimal custom CI workflow.** Bump `package.json` on the
  release branch, push to `main`, and let a workflow tag the commit and create
  the GitHub Release from a manually curated notes file. This is what
  `publish-release.yml` already does.

* **Option 4: Adopt `changesets`.** PR-centric curated change descriptions with
  automated version aggregation. Powerful, but designed for multi-package
  publishing to a registry; AeroDash is a single private app that publishes
  nothing to npm. It would add a workflow and a `.changeset/` process for
  benefits we do not need.

## Decision

We adopt **Option 3** and **retire `release-it` entirely**. The release
approach is:

* **Version is explicit, never inferred from commit history.** The release
  version is chosen by the maintainer and carried by the Gitflow
  `release/vX.Y.Z` branch name; the matching value is written to root
  `package.json` (and kept in sync with `frontend/package.json`) on that
  branch. `publish-release.yml` reads `package.json` as the single source of
  truth for the tag.
* **Pre-releases are honoured.** A version containing a `-alpha` / `-beta` /
  `-rc` suffix is published as a GitHub *pre-release*; only un-suffixed SemVer
  is marked `latest`. `publish-release.yml` derives this from the tag string.
* **The changelog is curated, not generated.** `CHANGELOG.md` follows
  [Keep a Changelog]; entries are written by the maintainer under
  `## [Unreleased]` during development and moved into a dated
  `## [version] - YYYY-MM-DD` section at release time.
* **Per-release pilot-facing notes are curated** in
  `.github/release-notes/v<version>.md`; `publish-release.yml` publishes that
  file verbatim as the GitHub Release body (falling back to auto-generated
  notes only if the file is absent).
* **The pipeline automates tagging, the GitHub Release, and nothing else.** It
  does **not** compute versions, mutate `package.json`, or generate changelog
  prose.

Concretely this removes the `release` npm script, the `release-it` and
`@release-it/conventional-changelog` dev-dependencies, and `.release-it.json`.
The maintainer workflow is documented in
`docs/development/BRANCHING_STRATEGY.md` and operationalized by the `/release`
skill.

## Consequences

### Positive

* The version published can never silently jump (e.g. to `1.0.0`) because no
  tool infers it; the maintainer sets it deliberately on the release branch.
* Pre-release software is always flagged as such on the GitHub Release page,
  directly mitigating the "accidental use of Beta software" concern from #22.
* `CHANGELOG.md` stays short and human-readable — signal, not a commit dump.
* One fewer dev-dependency tree to install, audit, and patch; the tooling now
  matches the actual release path with no dead scaffolding to confuse
  contributors or audits.

### Negative

* Changelog and per-version notes are manual; the maintainer must keep
  `## [Unreleased]` current. Mitigated by the PR template's changelog reminder
  and the `/release` skill, which finalizes the dated section at release time.
* Version bumping is a manual edit on the release branch rather than a command.
  This is a deliberate trade for determinism; the bump is a single line in two
  `package.json` files, verified by the `/release` skill.

## Compliance

This decision serves the safety goal stated in #22 — pilots must not
accidentally treat pre-release software as stable, and must be able to read an
accurate record of what changed. It introduces no flight-critical logic and
touches no P1 Safety Core code. It supersedes the changelog-automation
direction proposed in #22 (closed as `wont do`) and complements
ADR-301-DEV (branching strategy) and ADR-300-DEV (documentation as code).

[Keep a Changelog]: https://keepachangelog.com/en/1.1.0/

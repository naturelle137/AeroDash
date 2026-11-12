# CI foundations promotion

## Scope

Technical hotfix from main `007a559bf82cc4ec592cd4e1d001c720c3278819`.
Source of reviewed CI foundations: develop
`abd33acdbbe591590652548c472ccaaebfdf7d0a`, including merged PR452
`96a62f4863cd83ed7f303e4560146486d7ddb142`.

- Backport CI, aggregate/evaluator tests, reusable security and mutation gates.
- Preserve all mandatory names, main `lint-markdown`, 90% P1 coverage,
  70% mutation floor, high-severity audit blocking and PR-only OSV advisory policy.
- Remove duplicate post-push Playwright workflow; CI runs on both protected pushes.
- Backport dependency security overrides and their Rollup patch; use develop's reviewed dependency manifests/lockfile while keeping main's
  product source and scripts. Main's older direct versions failed the high audit.
  Re-test these versions against main's product baseline.
- Backport mutation runner isolation/configuration needed by reusable mutation CI.
  Exclude its generated `.stryker-tmp` sandbox from linters, matching the actual
  configured directory; product source remains fully linted.
- Explicitly disable the release publishing job for this technical promotion.
  Its literal false condition prevents publication regardless of version/tags.
  E3 owns any independently reviewed restoration under existing confirmations;
  this hotfix grants no publication authority and creates no version or tag.
  Also suppress automatic main-push container publication and Pages deployment;
  their existing explicit manual triggers remain unchanged.
- Block the external Netlify Git integration with root `netlify.toml`:
  unconditional `build.ignore` exits 0 (Netlify cancels the build); the build
  command independently exits 1 so build hooks that bypass ignore cannot publish.
  No context/branch exceptions, dependencies or credentials are needed. This
  inherited guard covers the technical main promotion and subsequent probes.
  E3 owns independently reviewed restoration, alongside the GitHub guards.
  This controls repository-driven builds, not privileged manual artifact uploads
  or historic deploys; no account/access/build settings are changed.
- Do not import develop's product, aircraft/reference data, autonomous workers,
  trace tooling or unrelated safety repairs.

## Ancestry and authority

The hotfix starts at main, with signed single-parent implementation commits.
Independent integration must use a two-parent merge commit, never squash/rebase.
Verify every introduced commit and resulting merge signature through GitHub.
No claim that develop is an ancestor of this intentionally narrow backport.
Main's existing traceability workflow is retained. Later develop's structural
trace/data-constants gates depend on tooling absent from this product baseline;
this promotion does not claim to have backported those unrelated toolchains.

HQ214 completed the one independent review. HQ233 fixes its named Netlify
finding; HQ231 assigned its sole successor HQ237 terminal acceptance and recovery. Protection/access settings remain unchanged here.
Neither draft probes nor this author may activate protection or merge.

## Evidence contract

Record exact PR target/base/head, changed paths, raw Actions job conclusions,
mandatory contexts, mutation decision and durable run links for docs, dependency,
workflow and P1 probes into both targets. Negative evidence must exercise actual
Actions results consumed by the unchanged production aggregate, including failure,
cancellation, timeout, absent job, detector failure and unexpected skip.
Evidence-only probes stay draft, never merge, and close after capture. Never cancel
protected-head CI. A synthetic fixture job is not a successful application gate.
Incomplete evidence blocks activation; evaluator unit tests alone do not qualify.

## External publication evidence correction

The earlier GitHub-only no-publication claim was incomplete. Reviewed head
`ed0144aeac07f666d2f5b3ac23a47940ddf2ebbd` actually published Netlify preview453,
deploy `6af4eb51133b94bf34a274e3`. Historical evidence probes also triggered
external previews; they must not be described as having caused no publication.
The public site API identified production/main at
`007a559bf82cc4ec592cd4e1d001c720c3278819`. Existing deployments are not removed.

Semantics: [Netlify ignore builds](https://docs.netlify.com/build/configure-builds/ignore-builds/)
and [file configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/).
Ignore exit 0 stops Git builds; build hooks bypass ignore, requiring the failing
build-command fallback. Root file configuration takes precedence over UI build
settings. Final-candidate Netlify status and public API snapshots belong in the
PR evidence comment/HQ233 evidence; a local exit-code test alone is not live proof.
No production test deployment, merge, protection activation or CI449 acceptance
is authorized by this fix. HQ237 checks the named finding and current green CI.

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

HQ214 is the preassigned independent review/integration owner; HQ215 owns terminal
acceptance and recovery. Protection/access settings remain unchanged here.
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

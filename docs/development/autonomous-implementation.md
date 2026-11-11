# Agent implementation and review operations

HQ schedules work and independent review under
[ADR-319](../architecture/adr/319-DEV-agent-review-governance.md). The author opens
a Draft PR and enqueues a fresh review session.
Include the PR, full head/base SHAs and evidence links. A bot COMMENT or Ready
state is not approval. P1 design review, sourced reference cases, hazard links,
isolation, coverage and all technical/security gates remain mandatory.

## Signed commits and validation

Use existing registered signing capability, or GitHub's GraphQL
`createCommitOnBranch` with existing authentication. The latter is an available
path for workers without local signing configuration; GitHub supplies the
signature. No new keys, credentials or API subscription are needed.

1. Start an owned branch at the reviewed base. Run the normal local hook checks
   (lint-staged and commitlint) and project gates on the intended changes.
2. Submit explicit file additions/deletions with `expectedHeadOid`; a mismatch
   stops the operation. Never submit secrets or unrelated work.
3. Fetch the result and compare its complete tree to the validated local tree.
   Inspect REST `commits/<sha>`: `commit.verification.verified` must be true.
   Verify **every** introduced commit, not just the eventual squash.
4. Rewriting an owned unsigned branch requires a recoverable old head and an
   explicit expected SHA / `--force-with-lease`. Preserve its intended tree;
   never rewrite protected or another worker's branch.
5. Run final-head gates/CI and request fresh independent review. API signing
   does not run local hooks, establish review, or prove flight suitability.

HQ #20 proved the existing-auth API path on assessment PR #448: signed commit
[`f9750ecac311f2c04974a8f558972463db450893`](https://github.com/naturelle137/AeroDash/commit/f9750ecac311f2c04974a8f558972463db450893)
has GitHub verification `valid` and the identical tree to original unsigned
`41a6e91ba6a23cd891c423bcffd03b0a6dcfaa99`. Subsequent factual updates require
current CI and verification of named findings. This proves commit signing, not a protected merge.

## Legacy GitHub automation audit

Observed 2026-11-11 via Actions workflow/variable APIs and workflow source:

| Worker | Trigger / observed state | HQ handling |
| :----- | :----------------------- | :---------- |
| `overnight-implementation.yml` | Schedule/dispatch; manually disabled; `AUTOMATION_ENABLED=true` | Leave disabled; HQ owns implementation |
| `pr-review-bot.yml` | `workflow_run` after CI, DoD, Security and Mutation; active | Auxiliary Claude review, not independent HQ acceptance |
| `pr-iteration.yml` | API state active, but dispatch-only and job guarded by `if: false` | Inert; keep disabled and do not restore legacy triggers |
| `claude.yml` | Mention-triggered; active | Do not invoke alongside an HQ job |
| `security.yml` | Active; reusable security workflow and dispatch | Verify blocking scans on the PR candidate |

The reviewer uses model alias `sonnet`, not a fixed Opus model. It posts COMMENT
or REQUEST_CHANGES; it does not establish independent review or the ADR-319
head/base verdict contract. Its gating waits for workflow completion; this is
not proof of success. The disabled correction loop's Ready state would also not be acceptance.
The source contains guards for configured authentication and same-repository
review runs; an active workflow flag alone does not prove a model was invoked.

No worker, secret, payment method or repository setting is enabled by this PR.
`AUTOMATION_ENABLED` governs nightly selection only, not all three other workers;
manual dispatch is not a safe global kill switch. Issue label
`automation:opt-out` excludes overnight selection, not every automation path.

HQ #29 / issue #449 owns remaining workflow implementation and CI topology:
coordinate explicit worker ownership/opt-out and provider/head/base handling
before activating overlapping automation, preserve fork/secret restrictions,
and obtain Codex review of Claude implementation. Security restoration belongs
to #446/#449. Do not run duplicate model workers or introduce paid API fallback.

## Integration

The CTO checks live protection, final head/base, all signatures, current CI,
resolved findings/conversations and the independent verdict immediately before
merging. Feature/fix PRs use `--squash --match-head-commit <sha>`. Release/hotfix
PRs to main/develop use `--merge --match-head-commit <sha>` to preserve ancestry. No admin bypass and no queued auto-merge. Any
head/base change requires current gates and signature verification. Verify the resulting commit
signature and integration CI; record evidence in the PR and HQ journal.

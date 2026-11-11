# 319-DEV: Independent agent review and protected integration

* **Status:** Accepted
* **Date:** 2026-11-11
* **Decision:** HQ charter / O-08; issue #447.
* **Supersedes:** ADR-317 operational ownership and human-review requirements;
  ADR-302 human quality-gate wording. Technical and safety gates remain binding.

## Context

The organisation delegates implementation, technical review and integration to
agents. Requiring the CEO to perform routine Lead Developer reviews conflicts
with that mandate. Agents share a GitHub identity, so a formal self-approval
cannot establish independent review. A clean automated COMMENT is insufficient.

## Decision

1. The author works on a branch and opens a Draft PR. HQ assigns review to the
   **other provider**: Codex authors → Claude reviews, Claude authors → Codex
   reviews (`hq enqueue ... review ... --avoid <author-provider>`).
2. P1 and `safety-critical` changes retain their formal design review before
   implementation, now owned by an independent technical agent. Preserve FRR
   fields, hazard/requirement links, P1 isolation, deterministic reference cases,
   source provenance and existing coverage/mutation thresholds. Unresolved
   domain evidence blocks acceptance; agent review is not aviation certification.
3. Run local lint/unit and applicable P1, integration, build/type, browser,
   traceability and security gates. Required CI must succeed for the final
   head/integration candidate. Missing, skipped or neutral mandatory work is not
   evidence of a pass. Resolve all blocking findings and review conversations.
4. Verify GitHub signature verification for **every introduced commit**, using
   existing signing capability or the GitHub-signed commit API with existing
   authentication. A signed squash does not repair unsigned PR history. API
   commits must receive equivalent local hook checks; never skip safety gates.
5. Record this evidence in a PR conversation comment and corroborating HQ job
   result (use full SHAs and durable CI/commit/evidence links):

   ```text
   VERDICT: APPROVE | CHANGES
   PR: <URL>
   Head: <full final head SHA>
   Base: <full reviewed base SHA>
   Author provider: <provider>
   Reviewer provider / HQ job: <other provider> / <job ID>
   Evidence: <links to CI, local results, findings and applicable safety evidence>
   ```

6. Any head change (including signing, rebase or conflict repair) invalidates
   approval. If the base moves, update the branch. Repeat local gates, CI and
   independent review for the new head/base. Draft/Ready status is not approval.
7. The CTO verifies live head/base, protection, signatures, CI, resolved threads
   and independent review immediately before an **immediate** expected-head
   squash merge (`--match-head-commit` or REST `sha`). Never queue auto-merge:
   GitHub would not revalidate a review comment after another push. A race or
   mismatch requires revalidation. Never use admin bypass or push directly to
   protected branches. Verify the resulting signature and integration CI.
8. The CEO decides product vision, expenditure, access and legal/safety claims;
   agents own routine engineering and release operations. Existing publication
   confirmations in the release instructions remain outside this review change. No new credentials,
   paid services or duplicate workers are authorized by this decision.

## Enforcement and live settings

This is a **procedural** independent-review gate, not an implemented GitHub
required check. CODEOWNERS routes ownership; it does not grant repository access
or establish provider independence. Keep write/admin access restricted to the
owner and explicitly approved maintainers. Do not change protections to merge.

Snapshot verified 2026-11-11 (HQ #20, after CEO #66): both `develop` and `main`
are unlocked, require a PR with zero formal approvals and no codeowner approval;
signature, administrator and conversation-resolution enforcement are disabled.
Force pushes and deletion remain disabled. `develop` requires Actions checks
Lint, Type Check, Unit Tests, Build and E2E Tests with strict updates; `main`
requires `lint-markdown` without strict updates. E1 and E2 are resolved. This
snapshot does not waive the procedural signature/review/resolution obligations.
Re-read live rules before integration; do not restore older protection payloads.
Issue #449 owns CI topology and subsequent check activation, not this ADR.

## Automation ownership

HQ is the work scheduler. Existing overnight/review/correction/mention Actions
are legacy optional automation, not the independent HQ approval mechanism.
Audit their state and author provider before running anything; do not enable
paid or duplicate workers. Current observations and remaining implementation
ownership are in the [operator guide](../../development/autonomous-implementation.md).

## Consequences

Routine review no longer waits for the CEO. Provider separation, exact-head
review and merge-time checks must be evidenced by the integration worker until
a separately reviewed technical gate exists. Green software tests do not validate
POH data or certify flight use; [DISCLAIMER](../../../DISCLAIMER.md) still applies.

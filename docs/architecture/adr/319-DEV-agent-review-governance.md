# 319-DEV: Independent agent review and protected integration

* **Status:** Accepted
* **Date:** 2026-11-11
* **Decision:** HQ charter / directive 16; issue #447.
* **Supersedes:** ADR-317 operational ownership and human-review requirements;
  ADR-302 human quality-gate wording. Technical and safety gates remain binding.

## Context

The organisation delegates implementation, technical review and integration to
agents. Requiring the CEO to perform routine Lead Developer reviews conflicts
with that mandate. Agents share a GitHub identity, so a formal self-approval
cannot establish independent review. A clean automated COMMENT is insufficient.

## Decision

1. The author works on a branch and opens a Draft PR. HQ assigns review to a
   fresh session that did not author the change. One independent review per PR.
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
   Head: <full reviewed head SHA>
   Base: <full reviewed base SHA>
   Author provider: <provider>
   Reviewer provider / HQ job: <provider> / <job ID>
   Evidence: <links to CI, local results, findings and applicable safety evidence>
   ```

6. CHANGES gets one repair round. The CTO verifies each named blocker and the
   final candidate's CI. A branch refresh requires current CI and signature
   checks. The independent review remains valid across a base refresh.
7. Verify protected targets, signatures, CI, findings and applicable domain
   evidence before merging. For feature/fix PRs use `gh pr merge <pr> --squash
   --match-head-commit <sha>`. For release/hotfix PRs targeting main or develop
   use `gh pr merge <pr> --merge --match-head-commit <sha>` to retain both
   parents. Verify the resulting signature and integration CI. Preserve branch
   protection and the bounded release acceptance below.
8. The CEO decides product vision, expenditure, access and legal/safety claims;
   agents own routine engineering and release operations under E3 below. No new
   credentials, paid services or duplicate workers are authorized by this decision.

## Bounded release authority (E3)

E3 (explicit CEO answer, 2026-11-11; HQ directive 11/O-14) delegates only
technical triage and routine project releases. Directive 16 governs review:
one fresh independent session, any provider, that did not author the change.

| Decision | Required acceptance |
| :--- | :--- |
| Technical release-audit triage | Independent agent accepts the concrete finding table, evidence and blocker/defer reasons before issue creation or remediation. |
| Routine project release | Independent agent accepts the exact full release notes and concrete target candidate before publication. |
| Legal or safety claims; publication under the CEO's name | Explicit CEO approval of the concrete scope/content, plus technical acceptance. |
| Ambiguous board scope | Pending explicit clarification; elapsed time is not consent. |

Record triage finding IDs, priority overrides and reasons, deferred issue/milestone
links, and the accepted report revision. Never defer a safety blocker merely to
ship. Release acceptance records version, exact notes blob/content digest,
triage report, PR and full head/base SHAs, reviewer session/job, verdict and
local/CI/security/domain evidence in a durable PR comment and HQ result.
Notes acceptance may cover a draft before commit; candidate acceptance must
identify its committed notes and each target PR before merging.

A candidate or notes change needs a documented acceptance update covering the
changed scope. A base refresh retains the single review under Decision 6:
the integrator checks the refreshed candidate, signatures and current CI;
no second full review or provider cross-check. CHANGES gets one repair round,
then verification of the named findings and green final-head CI.

FRR, reference provenance, hazard/requirement traceability, thresholds,
CI/security, signatures and expected-head integration remain mandatory. E3
and this governance PR approve no specific release and grant no spending,
account, access, protection or deletion rights. Milestone/deletion confirmations
remain in force. Existing GitHub/Netlify publication guards require separate
authorization to restore; do not enable them or use a manual fallback to bypass
them. Legal/safety approval never substitutes for technical acceptance.

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

Routine review no longer waits for the CEO. Independent review, final-head CI and merge-time checks must be evidenced by the integration worker until
a separately reviewed technical gate exists. Green software tests do not validate
POH data or certify flight use; [DISCLAIMER](../../../DISCLAIMER.md) still applies.

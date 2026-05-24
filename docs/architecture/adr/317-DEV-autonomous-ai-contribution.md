# 317-DEV-autonomous-ai-contribution: Autonomous AI Contribution via Claude Code GitHub Action

* **Status:** Proposed
* **Date:** 2026-05-24

## Context

Triaged `accepted` + `engineering` issues accumulate faster than they can be
hand-implemented. We want an autonomous agent that picks up accepted issues
overnight, produces **reviewable Draft PRs**, and advances the backlog while the
team is offline — **without ever weakening the Safety-First quality gates**
(issue #316; sub-tasks #317–#320).

This is an AI-in-the-loop change to the developer workflow, which CONTRIBUTING
§7 requires be governed by an ADR. The change is `safety-critical` by nature:
the agent can generate P1 Safety-Core code (Mass & Balance, Performance, Fuel)
that, if merged unreviewed, could yield an **incorrect Go/No-Go advisory**
(H-class hazards). The automation must therefore be designed so that no machine
decision can substitute for the mandatory human Lead Developer review on P1.

Key forces:

* **Throughput vs. safety** — automation should clear engineering backlog but
  never auto-merge, never bypass a gate, and never approve P1.
* **Cost vs. quality** — overnight batch runs consume tokens; the implement↔review
  loop must be bounded in iterations and time/token budget.
* **Determinism vs. autonomy** — issue *selection* must be deterministic,
  explainable, and dependency-aware; issue *implementation* is delegated to the
  agent but fenced by the existing CI gates.
* **Least privilege** — workflows must request the minimum `GITHUB_TOKEN`
  scopes, and secrets must never be exposed to untrusted fork PRs.

## Considered Options

* **Option 1: Claude Code GitHub Action (`anthropics/claude-code-action`),
  Draft-only, gate-fenced.** A scheduled + manually-dispatchable workflow builds
  a deterministic queue, then invokes the action per issue to run the existing
  `/implement-issue` flow on a `feature/issue-<n>` branch and open a **Draft** PR
  to `develop`. A second workflow reviews every new PR. A bounded loop lets the
  implementer revise bot PRs in response to review feedback. Re-uses our existing
  skills/subagents (`/implement-issue`, the `code-review` skill, the P1 PR-review
  subagent) and CI gates verbatim.

* **Option 2: Self-hosted bespoke bot (custom service polling the API).**
  Maximum control, but introduces an always-on service to operate, secure, and
  pay for; duplicates the orchestration GitHub already provides; and diverges
  from our "zero external account / GitHub-native" posture established in
  ADR-315-DEV.

* **Option 3: Third-party autonomous-PR SaaS.** Fastest to adopt but routes our
  source and issue data through an external processor, adds secret/account
  management, and gives us no control over how P1 safety gates are honoured.

## Decision

We adopt **Option 1**. The automation is implemented entirely as GitHub Actions
workflows plus a small, unit-tested selection script, and is constrained by the
following **non-negotiable invariants**:

### Safety invariants (MUST)

1. **Draft-only.** Every PR the automation opens is a **Draft** targeting
   `develop`. The agent never marks a PR ready-for-review and never merges.
2. **No auto-merge anywhere.** No workflow in this feature enables auto-merge.
3. **Human Lead review on P1.** Any PR touching `frontend/src/core/` or carrying
   `safety-critical` requires human Lead Developer approval (CONTRIBUTING §7).
   The automated reviewer is an **aid, never a substitute**, and is forbidden
   from approving such PRs.
4. **Gates are never bypassed.** Husky, ESLint (incl. `[P1-ISOLATION]`),
   traceability tags, unit/integration tests, and the coverage tiers
   (P1 90 % / P2 80 % / P3 60 %, per `docs/testing/TESTING.md`) run unchanged.
   `--no-verify` is forbidden. Failed CI leaves a diagnosed Draft PR.
5. **Bounded effort.** The implement↔review loop is capped at `MAX_ITERATIONS`
   and a per-issue time budget; on exhaustion the Draft PR is handed to humans
   with a summary. No infinite retries.

### Selection invariants (MUST)

1. **Eligibility.** Only `open` issues labelled `accepted`, assigned to the
   **current (active) milestone**, and **not** carrying the opt-out label are
   eligible — across **any scope** (`product` *or* `engineering`). A run may be
   narrowed to a single scope (e.g. engineering-only nightly), but scope is **not**
   a safety boundary: product issues can touch the P1 Safety Core, and the safety
   net is the Draft-only + human-Lead-review-on-P1 + no-auto-merge regime below,
   not this filter. Issues with no milestone or a different milestone are skipped.
2. **Deterministic, dependency-aware ordering.** Selection is computed by a
   pure, unit-tested function (no random choice). Issues blocked by an
   unresolved dependency are deferred until their prerequisites land.
3. **Explainability.** Every run emits an ordered queue with per-issue
   *selected / deferred / skipped* reasons in the run report (job summary).

### Operational defaults (configurable)

| Knob | Default | Where |
| :--- | :------ | :---- |
| Schedule | `0 2 * * *` (02:00 UTC nightly) | `overnight-implementation.yml` `on.schedule` |
| Scope | `any` (product + engineering) | `scope` dispatch input (`any` / `engineering` / `product`) |
| Batch size | `1` | `BATCH_SIZE` env / `batch_size` dispatch input |
| Model | `claude-opus-4-7` | `MODEL` env / `model` dispatch input |
| Max iterations | `3` | `MAX_ITERATIONS` env (`pr-iteration.yml`) |
| Per-issue time budget | `30` min | `timeout-minutes` per job |
| Per-issue turn budget | `40` turns | `--max-turns` in `claude_args` |
| Opt-out label | `automation:opt-out` | selection filter |
| Global kill switch | repo variable `AUTOMATION_ENABLED` ≠ `true` ⇒ no-op | guard step |

### Authentication

The action authenticates with **`CLAUDE_CODE_OAUTH_TOKEN`** (generated via
`claude setup-token`, billed against a Claude subscription) stored as a
repository secret. `ANTHROPIC_API_KEY` (pay-per-use) is a documented
alternative; swap the secret reference in the workflows to switch.

### Guardrails

* **Least privilege:** each workflow declares the minimum `permissions:` block;
  the implementer needs `contents: write`, `pull-requests: write`,
  `issues: write`; the reviewer needs `pull-requests: write`, `contents: read`,
  `issues: read`.
* **Fork safety:** the reviewer triggers on `pull_request` (not
  `pull_request_target`) and only runs the secret-bearing review when
  `head.repo == base.repo`, so forks never receive secrets.
* **Path fence:** the agent's write scope is restricted to product, docs, trace,
  and test paths; it must not edit the automation's own workflow files, secrets,
  or `.github/` security configuration.
* **Concurrency:** a `concurrency` group plus `max-parallel: 1` matrix prevents
  overlapping runs.
* **Pipeline-failure handling:** an **in-scope** failure (the bot's own change
  broke a gate) is corrected inside the bounded loop; an **out-of-scope**
  (pre-existing) failure is filed as a **deduplicated `Bug`** — a new bug is
  opened only if no open bug already tracks the same failure, otherwise the
  existing one is linked/commented.

## Consequences

### Positive

* Backlog of accepted engineering issues advances overnight; mornings start with
  reviewable Draft PRs.
* Every existing safety gate is preserved unchanged; the automation can only ever
  *propose*, never *merge*.
* Selection is deterministic and auditable; runs are reproducible and explainable.
* GitHub-native and subscription-billed: no always-on service, no third-party
  data processor, consistent with ADR-315-DEV.

### Negative

* **Reviewer load:** humans must review machine-authored Draft PRs; low-value PRs
  cost reviewer attention. Mitigated by the batch-size cap and dependency-aware
  deferral.
* **Token/time cost:** overnight runs consume subscription budget. Mitigated by
  the bounded loop, turn budget, and small default batch size.
* **Automation drift risk:** a misconfigured prompt could open noisy PRs.
  Mitigated by Draft-only output, the global kill switch, and `dry_run`.
* **Action version pinning:** depending on `anthropics/claude-code-action`
  couples us to its interface; pinned to a major tag and reviewed via Dependabot.

## Compliance

This decision directly governs the safety risk named in issue #316's "Potential
Safety Impact": machine-generated P1 code must never reach `main` without human
Lead review. Invariants 1–5 above enforce that the automation is **additive to**,
and never a **replacement for**, the P1 review and gate regime defined in
CONTRIBUTING §7 and ADR-314-DEV (dependency isolation). The hazard chain is
unchanged — the agent produces candidate code; humans and CI remain the
authority that admits it.

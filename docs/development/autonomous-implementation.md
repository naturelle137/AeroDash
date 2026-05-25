# Autonomous Overnight Implementation

AeroDash can autonomously implement triaged engineering issues overnight and open
**reviewable Draft PRs**, using the
[Claude Code GitHub Action](https://github.com/anthropics/claude-code-action).
The full design and safety rationale live in
[ADR-317-DEV](../architecture/adr/317-DEV-autonomous-ai-contribution.md).

> **Safety first.** The automation only ever *proposes* code. Every PR is a
> **Draft**, nothing is auto-merged, and any P1 (`frontend/src/core/`) or
> `safety-critical` change still requires human **Lead Developer** approval
> (CONTRIBUTING §7). The automated reviewer is an aid, never a substitute.

## How it works

```text
schedule / dispatch
        │
        ▼
  select  ──► .github/scripts/select-issues.mjs ──► explainable queue (run report)
        │       (open + accepted + current milestone, any scope, dependency-aware)
        ▼
 implement  ──► /implement-issue <n> on feature/issue-<n> ──► Draft PR → develop
        │
        ▼
 CI + automated review ◄────────────┐
        │                           │ correction (≤ MAX_CORRECTIONS, ingests
        ├─ red CI / changes-req. ───┘ review feedback + CI logs)
        │
        └─ CI green + review clean ─► mark Ready for review ─► your review
```

1. **Select** — a deterministic, dependency-aware queue is built from open issues
   labelled `accepted` in the **current milestone**, across **any scope**
   (`product` *and* `engineering`). Issues blocked by an unresolved dependency, or
   parents with still-open child tasks, are deferred. The queue (with selected /
   deferred / skipped reasons) is written to the run's job summary.

   > ⚠️ **Scope is not a safety boundary.** Because `product` issues are included,
   > the bot can draft **P1 Safety-Core** code (Mass & Balance, Performance, Fuel).
   > That is contained by the safety regime below — every such PR is a Draft and
   > requires human **Lead Developer** review; nothing is auto-merged. Narrow a run
   > with the `scope` input, or exclude a specific issue with `automation:opt-out`.
2. **Implement** — for each selected issue, the bot branches `feature/issue-<n>`
   from `develop`, runs the repository's `/implement-issue` flow, and opens a
   **Draft** PR. A genuinely complete issue uses `Closes #<n>` so merging to
   `develop` closes the ticket; an incomplete one uses `Refs #<n>` and flags what
   remains. Every issue is closed by its PR to `develop` — never deferred to `main`.

## Triggers

The workflow [`overnight-implementation.yml`](../../.github/workflows/overnight-implementation.yml)
declares both triggers:

- **Nightly schedule** — `0 2 * * *` (02:00 UTC). Runs only when the kill switch
  is armed (see below).
- **Manual `workflow_dispatch`** — from the **Actions → Overnight Autonomous
  Implementation → Run workflow** button, with inputs:

  | Input | Meaning | Default |
  | :---- | :------ | :------ |
  | `issue_number` | Implement exactly this issue, bypassing selection | (blank ⇒ normal selection) |
  | `batch_size` | Max issues to implement this run | `1` |
  | `model` | Model override (e.g. `claude-opus-4-7`, `claude-sonnet-4-6`) | `claude-opus-4-7` |
  | `scope` | Narrow selection — `any` (product + engineering), `engineering`, or `product` | `any` |
  | `dry_run` | Plan only — compute & report the queue, open no branches/PRs | `false` |

  Use `dry_run: true` first to preview what a run *would* do.

## Required setup (one-time)

Add these in **Settings → Secrets and variables → Actions**:

### Secrets

| Secret | Purpose |
| :----- | :------ |
| `CLAUDE_CODE_OAUTH_TOKEN` | Authenticates the Claude Code Action. Generate with `claude setup-token` (uses your Claude subscription). |
| `AUTOMATION_PAT` *(recommended)* | Fine-grained PAT (or GitHub App token) used to push the branch and open the Draft PR **so that CI and the reviewer bot run on it** — the default `GITHUB_TOKEN` cannot trigger downstream workflows. Scopes: `contents:write`, `pull-requests:write`, `issues:write`. Falls back to `GITHUB_TOKEN` if unset (PR opens, but CI/review won't auto-trigger). |

> **API-key alternative:** to bill per-token instead of via subscription, store
> `ANTHROPIC_API_KEY` and swap the `claude_code_oauth_token:` line for
> `anthropic_api_key:` in the workflow (one line, noted inline).

### Variables

| Variable | Purpose | Default if unset |
| :------- | :------ | :--------------- |
| `AUTOMATION_ENABLED` | **Global kill switch.** Nightly scheduled runs execute only when this equals `true`. | unset ⇒ nightly runs **disabled** (manual dispatch still allowed) |
| `CURRENT_MILESTONE` | Pins the "current milestone" number for selection. | unset ⇒ lowest-numbered open milestone |

The feature **ships disabled**: until you set `AUTOMATION_ENABLED=true`, the
nightly schedule no-ops. Manual `workflow_dispatch` runs are always permitted so
you can test safely.

## Kill switches & opting issues out

- **Disable nightly globally:** set `AUTOMATION_ENABLED` to anything other than
  `true` (or delete it), or disable the workflow from the Actions tab.
- **Opt a single issue out:** add the **`automation:opt-out`** label. The
  selector skips it with a recorded reason; humans can still implement it
  normally.
- **Stop a run in progress:** cancel it from the Actions tab; the
  `concurrency: overnight-implementation` group also prevents overlapping runs.

## Automated PR review

[`pr-review-bot.yml`](../../.github/workflows/pr-review-bot.yml) posts a
structured automated review on **every new PR targeting `develop`** — whether
authored by the overnight bot or a human collaborator.

- Triggers on `pull_request` (`opened` / `synchronize` / `ready_for_review`).
- **Fork safety:** runs only for **same-repo** PRs. PRs from forks do not receive
  secrets, so the review is skipped (not failed) for them.
- **Never approves.** It posts a `COMMENT` review, escalating to
  `REQUEST_CHANGES` when it finds Blocker/Major issues. There is no auto-merge
  anywhere.
- **P1 / `safety-critical`:** the review opens with a bold notice that **human
  Lead Developer review is mandatory** and that the automated review does not
  satisfy it (CONTRIBUTING §7–§8).

Reviewer model defaults to `claude-opus-4-7` (override via the `REVIEW_MODEL`
env in the workflow).

## Bounded iteration & ready-gate

[`pr-iteration.yml`](../../.github/workflows/pr-iteration.yml) drives
**bot-authored Draft PRs** (`feature/issue-*`) toward Ready, ingesting **both**
reviewer feedback and **CI/pipeline** results. It triggers on review submission
**and on CI completion** (`workflow_run`). The flow:

```text
implement → CI + review
   ├─ CI green & review clean (no Blocker/Major) ───► mark Ready for your review
   ├─ review changes-requested OR CI failed ───────► correction (ingests review
   │      (≤ MAX_CORRECTIONS rounds)                 comments + failing CI logs) → CI + review …
   └─ cap reached, still not green/clean ──────────► stay Draft + "awaiting your review" summary
```

- **CI runs on Drafts.** GitHub runs the full pipeline on Draft PRs; Draft only
  blocks *merging*. So the bot gets pipeline feedback while Draft, and you never
  see a PR marked Ready with red CI.
- **Ready-gate:** the PR is flipped to **Ready for review only when CI is green
  *and* a clean (non-changes-requested) review exists**. Any uncertainty (checks
  pending, no review yet, red CI) → it stays Draft (fail-safe). A correction
  temporarily flips it back to Draft.
- **Severity early-exit:** the reviewer emits `changes_requested` only for
  **Blocker/Major** findings; **Minor/Nit** get a `COMMENT` (no correction).
- **Bounded:** at most `MAX_CORRECTIONS` correction rounds (default **2**),
  counted via hidden `<!-- auto-correction:N -->` markers, plus per-round
  `timeout-minutes` and `--max-turns` budgets. Cap reached → handed to you as a
  Draft with a summary; no infinite retries.
- **CI-aware corrections:** a correction is triggered by a `changes_requested`
  review **or a failing CI run**, and fixes both; the implementer also runs the
  local pipeline before committing so CI is usually green on the first push.
- **Out-of-scope failures:** a pre-existing/unrelated CI failure is filed as a
  **deduplicated `Bug`** (linking an existing one if present), not hacked around.
- **Safety:** the loop never merges; marking Ready never bypasses required human
  review; P1 / `safety-critical` PRs still need human **Lead** approval (branch
  protection), and the reviewer never approves them.

> **Requires `AUTOMATION_PAT`.** The ready-gate/correction loop reacts to CI via
> `workflow_run` and pushes follow-up commits; use a PAT (or GitHub App token) so
> those pushes themselves re-trigger CI and review. This path leans on
> `workflow_run` timing — watch the first few live runs.

Tune `MAX_CORRECTIONS` empirically (token efficiency vs. convergence) via the env
in the workflow.

## Guardrails (enforced by design)

- **Least privilege** — the workflow requests only `contents`, `issues`, and
  `pull-requests` write.
- **Path fence** — the agent is instructed never to edit `.github/workflows/**`,
  secrets, or security configuration; it stays within product, docs, trace, and
  test paths.
- **Bounded effort** — `timeout-minutes` (time budget) and `--max-turns` (turn
  budget) per issue; `max-parallel: 1` serialises implementation.
- **Gates never bypassed** — Husky, ESLint (incl. `[P1-ISOLATION]`),
  traceability, tests, and coverage tiers all run unchanged; `--no-verify` is
  forbidden. A failed gate leaves a diagnosed Draft PR.

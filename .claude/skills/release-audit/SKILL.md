---
name: release-audit
description: Use to process a completed release audit end-to-end — when the user says "process the release audit", "the audits are done, triage and fix them", "remediate the .logs audits before release", or invokes /release-audit. Ingests .logs/audit.*-<date>.md reports, triages every finding against GitHub milestones + the roadmap, splits blockers vs deferred, files deferred findings as milestone-assigned issues, dispatches the fix-* remediation team on the blockers, and emits a short release-readiness report. Pairs with /audit.full (which produces the reports).
---

# Release-audit remediation workflow (AeroDash)

Turn a finished audit bundle into a release decision: triage → defer → fix → readiness. AeroDash is safety-critical — correctness over speed, no finding silently dropped.

- `input`: optional date/scope. Empty → newest `.logs/audit.*-*.md` set.
- `pairs.with`: `/audit.full` (produces `.logs/audit.<domain>-<date>.md`).
- `team`: read-only auditors `audit-{tech,cybersecurity,dp,process,ux}` ↔ write-capable fixers `fix-{tech,cybersecurity,dp,process,ux}`.

## Always-fresh refs (read every run)

- the five `.logs/audit.*-<date>.md` reports in scope
- `docs/development/roadmap.md`, `docs/development/implementation-roadmap.md`
- GitHub milestones: `gh api "repos/naturelle137/AeroDash/milestones?state=all"`
- `.claude/commands/issue.md` + `.github/ISSUE_TEMPLATE/*` (issue conventions/labels)
- `CONTRIBUTING.md`, `CLAUDE.md` (tiers, scopes, gates)

## Step 1 — Ingest & inventory

- Parse every finding from each report: `id | severity | category | title | evidence | impact | fix | priority(now/soon/later)`.
- Record counts per domain. Do not trust priority blindly — verify the highest-impact "active defect" claims in code before classifying.

## Step 2 — Triage (blocker vs defer)

Determine the release under test (branch / target milestone) and its **shipped** feature set.

Blocker bar — a finding blocks the release only if it hits a **shipped** feature AND is one of:
1. an active wrong-output / data-loss defect, OR
2. a materially false public statement (privacy/legal/docs), OR
3. a cheap, high-value hardening of the actual release artifact.

Defer (even if an auditor wrote "now") when the fix needs **new heavy infra** (crypto signing, encryption-at-rest, HMAC envelopes, sync DPIA, incident-reporting backend, mutation-CI, regulatory/AIRAC workflows) or is tied to an **unbuilt future feature** → map it to the first milestone that delivers that feature.

Bundle related findings across domains (e.g. all fuel-enum findings → one fix). Present the blocker/defer split as a table and **get user confirmation** before any outward action. Flag every case where you override an auditor's priority, with rationale.

## Step 3 — File deferred findings as issues

Per the `/issue` conventions and `.github/ISSUE_TEMPLATE/*`:
- group related findings into one coherent issue; type `Feature`/`Bug`/`Task`; one `scope.module` + one `scope.domain`; `safety-critical` when it touches `frontend/src/core/` or Go/No-Go; status `open`; **always add `resubmission`** (deferred-from-release).
- assign the milestone that first delivers the relevant feature (resolve numbers from `gh`).
- body: problem + the audit finding id(s)/evidence + proposed fix + DoD checklist (N/A rows end ticked `[x]` per repo convention).
- dedupe against existing issues first.

## Step 4 — Remediate blockers (the fix team)

- **P1 gate:** any blocker touching `frontend/src/core/` needs an approved **FRR** first. Present one consolidated FRR for all P1 work; on approval, proceed.
- Assign each blocker bundle to its `fix-*` agent. **Partition file ownership so concurrently-dispatched agents touch disjoint files** (e.g. CSP→`index.html`/cyber, vue-devtools→`vite.config.ts`/dp). Dispatch non-overlapping agents in one message to run concurrently; sequence the rest.
- Each fixer: minimal change + test (failing-first for bugs) + traceability tag/registry + conventional commit (no `CHANGELOG.md`, no `--no-verify`).
- After all return, run the gate: `pnpm --filter frontend type-check`, `pnpm lint`, `pnpm test:unit`/`test:p1`, `pnpm audit`. Loop fixes until green.

## Step 5 — Release-readiness report

Short and decision-oriented (see `readiness-report.md` for the exact shape). Sections: verdict (go/no-go) · blockers fixed (verified) · deferred risk by milestone · residual risk · recommendation. No filler.

## Guardrails

- Never auto-create issues or write code before the Step 2 confirmation.
- Never tick a DoD/checklist item without evidence; never weaken a gate or skip a hook to pass.
- Keep the audit reports immutable; write outputs to issues, code, and the readiness report only.

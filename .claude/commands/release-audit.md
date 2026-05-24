---
description: Process a completed release audit end-to-end — triage .logs reports vs milestones, file deferred issues, dispatch the fix-* team on blockers, emit a readiness report
argument-hint: [date-or-scope, empty = newest .logs audit set]
allowed-tools: Skill, Agent, Read, Grep, Glob, Bash, Edit, Write
---

# /release-audit — process the release audit & remediate

Run the **`release-audit`** skill on the audit reports in `.logs/`.

- `$ARGUMENTS`: optional date or scope. Empty → newest `.logs/audit.*-*.md` set.

## Procedure

Invoke the `release-audit` skill and follow it exactly:

1. **Ingest** the five `.logs/audit.<domain>-<date>.md` reports; inventory every finding.
2. **Triage** each finding (blocker vs defer) against `gh` milestones + `docs/development/roadmap.md`, using the skill's blocker bar. Verify top "active defect" claims in code. Present the split and **wait for user confirmation**.
3. **File** every deferred finding as a milestone-assigned issue (grouped, `resubmission`-labelled, per `.claude/commands/issue.md`).
4. **Remediate** blockers with the `fix-{tech,cybersecurity,dp,process,ux}` agents — consolidated **FRR** before any `frontend/src/core/` (P1) change; partition files so concurrent fixers don't collide; then run the gate (`type-check`, `lint`, `test:unit`/`test:p1`, `pnpm audit`).
5. **Report** release readiness in the short decision format (`readiness-report.md`).

Pairs with `/audit.full`, which produces the reports this command consumes.

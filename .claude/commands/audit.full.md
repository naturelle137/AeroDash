---
description: Run all five repo audits (dp, cybersecurity, process, tech, ux) in parallel via subagents
argument-hint: [scope-or-paths]
allowed-tools: Agent
---

# /audit.full — Repo full audit bundle

Orchestrate the five domain audit subagents in parallel and return their reports back-to-back.

## Inputs

- `$ARGUMENTS`: optional scope or paths. Empty → full repo.

## Procedure

1. Determine scope from `$ARGUMENTS`. If empty, scope is "full repo".
2. Dispatch the five subagents **in a single message with five Agent tool calls** so they run concurrently:
   - `audit-dp`
   - `audit-cybersecurity`
   - `audit-process`
   - `audit-tech`
   - `audit-ux`
3. Each Agent call gets the same scope. The prompt to each must be self-contained (subagents do not see this conversation): tell them the scope, point them at relevant repo areas if narrow scope was requested, and ask for their report only.
4. When all five return, present their reports in this fixed order: `dp` → `cybersecurity` → `process` → `tech` → `ux`. **No extra synthesis.** No cross-domain summary. No "overall" verdict.

## Output contract

- Header: `Audit bundle | <scope> | <YYYY-MM-DD>`
- Five report blocks separated by `---`, in the order above
- Nothing else

## When to suggest persistence

If the user asked for a full-repo audit, mention at the end that each subagent's report can be saved to `.logs/audit.<domain>-<date>.md` if they want to retain. Do not save unless asked.

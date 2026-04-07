# 303-DEV-ticket-workflow: Issue Tracking and Project Board Lifecycle

* **Status:** Accepted
* **Date:** 2026-02-27
* **Amended:** 2026-04-07

## Context

As AeroDash grows, managing the backlog, tracking in-progress work, and correlating development tasks with production releases becomes complex. Without a rigid, predefined lifecycle for tickets, we risk releasing unverified features, losing track of sub-tasks, or cluttering the project board with stale issues. We need a defined, scalable process to govern how `Features`, `Bugs`, and `Tasks` flow from creation to completion, ensuring the Project Board accurately reflects the state of the codebase.

**Amendment (2026-04-07):** The original workflow required a two-phase close: `ready` on merge to `develop`, then `fixed` + closed on merge to `main`. This created unnecessary overhead and deferred issue closure long past when the work was actually done. The amended workflow closes issues immediately on merge to `develop`, removing the intermediate `ready` state and `Ready for Release` board column.

## Considered Options

* **Option 1:** Ad-hoc issue tracking with standard "Open/Closed" states. (Rejected: insufficient granularity to track when code is actively in development vs. completed).
* **Option 2:** Heavyweight Jira-style workflows requiring dedicated scrum masters. (Rejected: too much overhead for the current team size).
* **Option 3:** Leverage a GitHub Project Board with strict, rule-based column transitions and explicit parent/sub-task relationship requirements. (Accepted).

## Decision

We will use a canonical GitHub Project Board ("AeroDash Dashboard") driven by specific, rule-based transitions.

1. **Issue Type Labels:** All issues must be categorized by Type (`Bug`, `Feature`, `Task`).
2. **Scope Labels:** Issues must indicate their scope via `product` (user-facing functionality) or `engineering` (development environment, tooling, documentation). This distinction determines the changelog section (`### Added`/`Changed`/`Fixed` vs. `### Engineering`).
3. **Safety Label:** Issues impacting the P1 Safety Core must carry the `safety-critical` label, triggering extra scrutiny and ADR traceability.
4. **Status Labels:** Issues progress through status labels reflecting their active lifecycle: `open` → `accepted`. These labels track work in progress.
5. **Resolution Labels:** When an issue is closed, it receives a resolution label: `fixed` (PR merged to `develop`), `duplicate` (link the existing issue), or `wont do` (document the rationale). Resolution labels are not workflow statuses — they are applied at closure.
6. **Board Columns:** The project board uses columns that map to the development lifecycle: `Backlog`, `Waiting for Implementation`, `In Progress`, `In Verification`, `Done`.

7. **Agent Workflow (AI Agents — Claude, Cursor):**
    * When starting work on a ticket, the agent **must** set the project status to `In Progress` before writing any code.
    * When a PR is created, the agent **must** set the project status to `In Verification`.

8. **Issue Closure on Merge to `develop`:**
    * All issue types (`Task`, `Feature`, `Bug`) are closed with the `fixed` label when their PR is merged to `develop` (or `release/*` / `hotfix/*`).
    * PR must use `Closes #` / `Fixes #` keywords so GitHub closes the issue automatically on merge.

9. **Parent/Sub-Task Rules:**
    * `Task` tickets (sub-tasks) are closed individually as soon as their specific PR is merged to `develop`.
    * Parent tickets (`Feature` or `Bug`) are closed with `fixed` and moved to `Done` only when **all** corresponding sub-tasks are closed. *(A sub-task closed as `wont do` counts as closed, provided the rationale is documented.)*

10. **Traceability Checks:** Developers must ensure all Source Code and Test files contain the appropriate `shtracer` tags (e.g., `// @IMP-SYS-001@ (FROM: @REQ-SYS-001@)`) linking back to the Master Traceability Matrix before merging.

## Consequences

### Positive

* **Transparency:** The Project Board reflects the actual state of the codebase without a long-lived "waiting for release" limbo state.
* **Safety Assurance:** By forcing parent features to wait for all sub-tasks, we prevent partial, untested functionality from being marked complete prematurely.
* **Predictability:** Developers and agents know exactly when to move tickets and when they are closed.
* **Reduced Overhead:** Removing the `ready` / `Ready for Release` intermediate state cuts one manual step per issue.

### Negative

* **Manual Overhead:** Developers must remember to manually move tickets (e.g., to "In Verification" when opening a PR) and carefully manage the state of parent tickets versus sub-tasks. Agents automate this step.

## Compliance

This workflow enforces the organizational discipline required for aviation software, ensuring that no requirement or mapped hazard mitigation is "lost" or prematurely marked as completed before being fully integrated.

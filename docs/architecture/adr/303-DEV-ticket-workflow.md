# 303-DEV-ticket-workflow: Issue Tracking and Project Board Lifecycle

* **Status:** Accepted
* **Date:** 2026-02-27

## Context

As AeroDash grows, managing the backlog, tracking in-progress work, and correlating development tasks with production releases becomes complex. Without a rigid, predefined lifecycle for tickets, we risk releasing unverified features, losing track of sub-tasks, or cluttering the project board with stale issues. We need a defined, scalable process to govern how `Features`, `Bugs`, and `Tasks` flow from creation to completion, ensuring the Project Board accurately reflects the safety and release state of the codebase.

## Considered Options

* **Option 1:** Ad-hoc issue tracking with standard "Open/Closed" states. (Rejected: insufficient granularity to track when code is ready for release vs. actively in development).
* **Option 2:** Heavyweight Jira-style workflows requiring dedicated scrum masters. (Rejected: too much overhead for the current team size).
* **Option 3:** Leverage a GitHub Project Board with strict, rule-based column transitions and explicit parent/sub-task relationship requirements. (Accepted).

## Decision

We will use a canonical GitHub Project Board ("AeroDash Backlog") driven by specific, rule-based transitions.

1. **Issue Type Labels:** All issues must be categorized by Type (`Bug`, `Feature`, `Task`).
2. **Scope Labels:** Issues must indicate their scope via `product` (user-facing functionality) or `engineering` (development environment, tooling, documentation). This distinction determines the changelog section (`### Added`/`Changed`/`Fixed` vs. `### Engineering`).
3. **Safety Label:** Issues impacting the P1 Safety Core must carry the `safety-critical` label, triggering extra scrutiny and ADR traceability.
4. **Status Labels:** Issues progress through status labels reflecting their lifecycle: `open` → `accepted` → `ready` → `fixed`.
5. **Resolution Labels:** Issues that are not implemented are closed with a resolution label: `duplicate` (link the existing issue) or `wont do` (document the rationale).
6. **Board Columns:** The project board uses columns that map to the development lifecycle. Not every column transition requires a label change — some columns reflect active work states.

    | Board Column | Label | Meaning |
    | :--- | :--- | :--- |
    | Backlog | `open` | Created, awaiting triage |
    | Waiting for Implementation | `accepted` | Triaged, valid, prioritised |
    | In Progress | — | Actively being worked on |
    | In Verification | — | PR open, under review |
    | Ready for Release | `ready` | PR merged to `develop` |
    | Done | `fixed` | Released on `main`, issue closed |

7. **Parent/Sub-Task Rules:**
    * `Task` tickets (sub-tasks) can be closed as soon as their specific PR is merged to `develop`.
    * Parent tickets (`Feature` or `Bug`) **cannot** advance to `Ready for Release` until **all** corresponding sub-tasks are closed.
    * Parent tickets are only moved to `Done` and labelled `fixed` when the cumulative changes are released on the `main` production branch.
8. **Traceability Checks:** Developers must ensure all Source Code and Test files contain the appropriate `shtracer` tags (e.g., `// @IMP-SYS-001@ (FROM: @REQ-SYS-001@)`) linking back to the Master Traceability Matrix before marking any ticket as `Ready for Release`.

## Consequences

### Positive

* **Transparency:** The Project Board perfectly mirrors the actual state of the codebase and release cycles.
* **Safety Assurance:** By forcing parent features to wait for all sub-tasks, we prevent partial, untested functionality from slipping into a release candidate.
* **Predictability:** Developers know exactly when to move tickets and when they are allowed to close them.

### Negative

* **Manual Overhead:** Developers must remember to manually move tickets (e.g., to "In Verification" when opening a PR) and carefully manage the state of parent tickets versus sub-tasks.

## Compliance

This workflow enforces the organizational discipline required for aviation software, ensuring that no requirement or mapped hazard mitigation is "lost" or prematurely marked as completed before being fully integrated and released.

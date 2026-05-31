# Incident → Regression Workflow

> Closes the feedback loop the v0.3.0 process audit flagged as PR-006: there
> was no in-app incident-reporting path, no privacy-safe diagnostic capture,
> and no route from a real pilot-trial finding into the regression suite.

This document describes how an issue a pilot hits in the cockpit travels
from the device, through the GitHub triage funnel, and ends up pinned in
the regression suite so the defect cannot recur.

## 1. Capture on the device (offline-safe)

| Step | Surface | Storage |
| :--- | :------ | :------ |
| Pilot taps **Report a problem** in the sidebar footer | `ReportProblemDialog.vue` | – |
| Pilot picks a kind, writes a short summary, types a description | – | – |
| Pilot reviews the redacted preview | `redactIncidentText` (P1) | – |
| Pilot taps **Save report** | `useIncidentReportStore.capture` | IndexedDB `aerodash-incidents` |

The capture path is fully offline-safe: the redactor and the queue are both
local. No network call happens at this stage. The pilot can keep flying
and submit later from the **Incident reports** view at `/incidents`.

Each stored report is a Zod-validated
[`IncidentReport`](../../frontend/src/core/domain/incident-report.schema.ts)
containing:

- `id` (UUID v4)
- `createdAt` (ISO-8601)
- `kind` (CALCULATION / DATA / UI / CRASH / OTHER)
- `summary` (≤ 120 chars)
- `redactedDescription` (≤ 4 000 chars — pilot free text, post-redaction)
- `context` (app version, route name, path tail, user-agent slice, online flag)

Pilot-supplied raw text is **never** written to disk. The redactor is the
only producer of the persisted `redactedDescription` string.

## 2. Redaction policy

The P1 redactor (`frontend/src/core/logic/incident-redaction.ts`) is pure
and deterministic. It replaces, in order:

1. URLs (so embedded email/phone in query strings are not double-counted)
2. Email addresses → `[REDACTED-EMAIL]`
3. DMS / decimal geographic coordinates → `[REDACTED-COORD]`
4. Phone numbers (international, grouped) → `[REDACTED-PHONE]`
5. ICAO aircraft registrations + FAA N-numbers → `[REDACTED-REG]`

Aviation numerics (`100 kg`, `50 L`, `MTOM 650 kg`, `1.84 m`) are kept
verbatim — they are the data needed to reproduce a bug. Names, addresses,
and free-form prose are NOT redacted; the preview-before-submit dialog is
the second line of defence.

Public airport ICAO/IATA codes are also kept; they are route-revealing but
the diagnostic value outweighs the privacy cost for this MVP. The pilot
can edit them out in the GitHub draft if they wish.

## 3. Pilot-driven submission to GitHub

When connectivity returns the pilot opens `/incidents` and taps
**Open on GitHub** on a queued report. The store builds a deep link with
[`buildGithubIssueUrl`](../../frontend/src/core/logic/github-issue-url.ts):

```text
https://github.com/naturelle137/AeroDash/issues/new
  ?template=incident_report.yml
  &title=[Incident] <summary>
  &kind=<human label>
  &description=<redacted body + summary>
  &context=<operational metadata>
```

The link opens in a new tab. GitHub renders the
[`.github/ISSUE_TEMPLATE/incident_report.yml`](../../.github/ISSUE_TEMPLATE/incident_report.yml)
form with every field pre-populated; the pilot reviews one last time and
clicks **Submit**.

If the body would push the URL above the GitHub deep-link cap
(`GITHUB_URL_MAX_LEN = 7 500`), the builder truncates the description and
appends a clearly visible marker so the pilot can paste the rest from the
saved report.

No automatic submission ever happens; the pilot must take the action.

## 4. Triage in the issue tracker

A submitted incident issue carries the labels:

- **`open`** — pending triage (auto-applied by the template)
- **`incident-report`** — surfaced as an incident, not a hand-written report

A maintainer triages it within the normal weekly cycle and either:

- relabels it to **`accepted`** + reclassifies as `Bug` / `Feature`
  (the regression chain continues below), or
- closes as `duplicate` / `wont do` with a one-line rationale.

The original pilot is automatically subscribed because they opened the
GitHub issue.

## 5. Reproduction + regression test

Once an incident is accepted as a `Bug`, the standard AeroDash defect
protocol applies:

1. **Failing test first.** Add a `*.spec.ts`, `*.int.spec.ts`, or
   `*.feature` that reproduces the defect from the redacted incident
   payload (the context block lists the aircraft profile / route /
   inputs the pilot used).
2. **Minimal fix.** Implement the smallest change that turns the test
   green.
3. **Trace.** Tag the new test with the next sequential `@UT-…@` /
   `@IT-…@` / `@E2E-…@` id and add the registry entry per
   [STC](../stc.md).
4. **Permanent regression.** Because the test sits in the canonical
   suites, every future build runs it — the defect is bound to the
   regression net for good.

## 6. Local maintenance

Captured reports live alongside the rest of the local data. They are:

- wiped when the pilot uses the **Delete all data** control on the
  Privacy view (REQ-SYS-014),
- excluded from the GDPR bulk export (REQ-SYS-015) — they are
  privacy-redacted operational diagnostics, not personal data,
- droppable one-by-one from the `/incidents` view.

## 7. Hazard linkage

PR-006 is a process gap, not a flight hazard, so the requirements
([REQ-SYS-016](../requirements/system.md#req-sys-016-offline-queued-incident-capture),
[REQ-SYS-017](../requirements/system.md#req-sys-017-incident-report-privacy-redaction),
[REQ-SYS-018](../requirements/system.md#req-sys-018-incident-to-regression-handoff))
do NOT carry a `FROM: @H-…@` link. They do, however, materially reduce
exposure to every flight-prep hazard the regression suite catches —
by ensuring real pilot-trial findings reach that suite at all.

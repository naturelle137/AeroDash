# ADR-013: In-App Contribution Intake — Prefill-and-Confirm for Issues, Link-Only for Security Advisories

* **Status:** Accepted
* **Date:** 2026-05-31

## Context

AeroDash has three first-class intake channels in GitHub: the
[`bug_report.yml`](../../../.github/ISSUE_TEMPLATE/bug_report.yml) issue
template, the
[`feature_request.yml`](../../../.github/ISSUE_TEMPLATE/feature_request.yml)
issue template, and the repository's private
[Security Advisory](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/about-repository-security-advisories)
form. The app itself currently exposes none of them — a pilot who wants to
report a defect or propose a feature has to leave AeroDash, find the GitHub
repository, identify the correct template, and write a structured report
unaided. The target user is a non-developer general-aviation pilot; the
expected outcome is that very few real findings ever reach the regression
suite.

A first attempt at closing this gap (PR #392, issue #281) introduced a
fourth, parallel `incident_report.yml` template plus an in-app, IndexedDB-
queued incident store with a P1 redactor. The project owner rejected both
choices: GitHub already has the right channels, a fourth one fragments
intake, and a parallel app-side store has no purpose if the artefact is
ultimately submitted to GitHub. This ADR records the replacement direction
before any code is written.

The new feature is tracked under issue #395 (supersedes #281).

## Decision

Adopt a **two-channel split** that picks the highest-UX feasible option
per intake type:

* **Bug reports** → Option B (in-app guided form → prefilled GitHub
  issue → confirm on GitHub).
* **Feature requests** → Option B (same pattern, different template and
  fields).
* **Security vulnerabilities** → Option A (in-app explainer + button that
  opens `/security/advisories/new` in a new tab).

The implementation must reuse the **existing** GitHub templates
unchanged. No new issue template is created. The prefill URL is built by
a single pure-TypeScript function in `src/core/` (a P1 module) so that
the mapping between the form field set and the GitHub query string is
unit-testable in isolation from the Vue layer. The UI and any field
collection live in P3 (`src/shared/components/`, `src/views/`).

A small **contribution-promotion card** ships next to the three
buttons, stating that contribution is not only code — issue reporting,
feature ideas, improvement suggestions, and documentation are all
valued — and linking to the public GitHub repository. The design and
copy are specified in `docs/ux/contribution.md` and recorded as
`DES-UX-013` / `DES-ARCH-018`. Three new system requirements (`REQ-SYS-017`
through `REQ-SYS-019`) capture the binding behaviour.

## Consequences

### Positive

* **No new intake channel.** The existing `bug_report.yml` and
  `feature_request.yml` templates remain the single source of truth for
  what an issue needs to contain; the app cannot drift from them.
* **Pilots stay close to plain language inside the app**, then meet a
  prefilled (not blank) GitHub form. The cognitive gap is small enough
  that a non-developer can finish the submission unaided.
* **No backend, no tokens, no in-app store of pilot reports.** The PWA
  architecture (offline-first, client-only) is preserved verbatim.
* **The P1 URL builder is pure, deterministic, and trivially testable.**
  90 % P1 coverage is achievable with unit tests alone; no DOM or fixture
  fabrication is required.
* **Security advisories never travel through a relay.** The link-only
  path keeps vulnerability data in GitHub's private workflow.

### Negative

* **Two integration styles to maintain.** Bug/feature use prefill;
  security uses link-only. The asymmetry has to be explained once in the
  UX (a tooltip on the security card states why it differs).
* **Prefill URLs are tightly coupled to the GitHub template schema.** If
  a template field is renamed in `bug_report.yml` or
  `feature_request.yml`, the prefill silently drops that field on the
  GitHub side. Mitigation: the URL builder is unit-tested against the
  template field IDs, and a lint check (future) can warn if a template
  field ID is removed without the builder being updated. For now the
  coupling is documented in the builder file's tag header and in
  `docs/ux/contribution.md`.
* **The pilot must have a GitHub account** to complete either flow.
  This is a project-wide constraint (no in-app auth), not new to this
  feature.
* **No offline submission.** A pilot drafting a report on the ramp
  without connectivity sees the GitHub tab fail to load on handoff.
  Mitigation: the in-app form gates the "Open GitHub" button on
  connectivity (`navigator.onLine`) and surfaces a "save for later"
  message asking the pilot to retry when online; we deliberately do not
  persist the draft in IndexedDB (would re-introduce the rejected store
  from PR #392). This trade-off is acceptable: incident reporting is
  not a flight-critical workflow, and the airframe-side workflow (Mass &
  Balance, Performance) remains fully offline.

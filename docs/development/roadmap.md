# AeroDash Roadmap

> **Source of truth:** [GitHub Milestones](https://github.com/naturelle137/AeroDash/milestones?state=all)
> — this page is a read-only overview. Scope, priorities, and timelines are managed in the milestones.

| Status | Meaning     |
| :----: | :---------- |
|   ✅   | Done        |
|   🟡   | In progress |
|   🔲   | Planned     |

## Evidence snapshot — 2026-11-12

The latest published release is [v0.3.0-alpha](https://github.com/naturelle137/AeroDash/releases/tag/v0.3.0-alpha),
explicitly a prerelease. v0.2.0-alpha was also published; publication does not
prove completion of every requirement or journey listed below.
[v0.4.0-alpha milestone 5](https://github.com/naturelle137/AeroDash/milestone/5)
is open (22 open / 45 closed issues at this snapshot); there is no v0.4 release.
Issue counts are scope information, not acceptance evidence.

On develop `2c5447c4782aa921cd850aa314886b69cad8672f`, safety repairs
[#470](https://github.com/naturelle137/AeroDash/pull/470) and
[#471](https://github.com/naturelle137/AeroDash/pull/471) are integrated and the
enabled Chromium suite passes 22 scenarios in blocking CI, including all seven
critical M&B math scenarios on a synthetic Draft seed and the six-step wizard.
Decimal (A-005/A-006) and category-switch (A-001) scenarios are enabled by
[#294](https://github.com/naturelle137/AeroDash/issues/294) follow-up; acceptance
stays partial until they pass in integrated blocking CI. See the
[QA293 evidence table](mb-qa-293.md) and the earlier [QA204 baseline](mb-qa-204.md).
The Performance UI is still a placeholder;
core tests do not establish an integrated performance preparation journey.

---

## ✅ [v0.1.0-pre-alpha — Project Foundation](https://github.com/naturelle137/AeroDash/milestone/1)

Establish the core project structure, governance, and developer experience.
LICENSE, CONTRIBUTING, README, linting, CI stubs, and Gitflow branching.

---

## 🟡 [v0.2.0-alpha — Walking Skeleton: Mass & Balance](https://github.com/naturelle137/AeroDash/milestone/2)

Prove the safety-critical math engine with a fully traceable Mass & Balance
computation pipeline. Three predefined aircraft, strict P1/UI separation,
automated test vectors passing in CI.

---

## 🟡 [v0.3.0-alpha — Fleet Management (Local Persistence)](https://github.com/naturelle137/AeroDash/milestone/3)

User-managed aircraft fleet persisted in IndexedDB with immutable profile
versioning, Draft/Verified status, PWA offline capability, and unit switching.

---

## 🟡 [v0.4.0-alpha — Performance Math Core (POH Distance Calculations)](https://github.com/naturelle137/AeroDash/milestone/5)

Bilinear interpolation of POH performance tables for T/O and landing
distances, safety factor application, extrapolation controls, and manual
airport entry with surface condition selection.

---

## 🔲 [v0.5.0-alpha — Fuel Endurance & Offline Go/No-Go](https://github.com/naturelle137/AeroDash/milestone/6)

Complete the offline pre-flight vertical slice: fuel endurance planning,
landing mass calculation, obstacle constraints, and an aggregated Go/No-Go
decision summary.

---

## 🔲 [v0.6.0-alpha — Online Integrations (Weather & Airport)](https://github.com/naturelle137/AeroDash/milestone/7)

METAR/TAF and ICAO airport data with explicit data provenance, surface
condition inference from precipitation, crosswind limit detection, and graceful
offline degradation.

---

## 🔲 [v0.7.0-alpha — Export & Digital Briefing Pack](https://github.com/naturelle137/AeroDash/milestone/11)

Client-side PDF/print export of the complete flight preparation with
`[UNVERIFIED]` markers, disclaimer rendering, notification transcription, and
an export gate requiring explicit pilot acknowledgment.

---

## 🔲 [v0.8.0-alpha — Sync & Auth (Connected Pilot)](https://github.com/naturelle137/AeroDash/milestone/12)

Backend API, OIDC authentication, RBAC, offline-first cloud sync, profile
schema revalidation on ingestion, and share-code generation for ad-hoc fleet
sharing.

---

## 🔲 [v0.9.0-beta — Pre-Release Polishing](https://github.com/naturelle137/AeroDash/milestone/9)

UX hardening for cockpit use: dark mode, 44 px touch targets, 320 px
responsive layout, cross-device offline verification, contextual tooltips, and
a full trace-registry completeness audit.

---

## 🔲 [v1.0.0 — Production Release (Safety Baseline)](https://github.com/naturelle137/AeroDash/milestone/10)

Formal V&V execution, 100 % bi-directional traceability via shtracer, safety
and penetration audits, bilingual EN/DE user manual and legal disclaimers, and
public production release.

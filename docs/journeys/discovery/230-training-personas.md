# Discovery: Flight-Training User Journeys (Students, FI, CRI)

> **Type:** Discovery / scoping analysis (no UJ authored here — see Non-goals).
> **Source issue:** #230 (`[Feat]: Evaluate adding flight-training user journeys`).
> **Date:** 2026-05-25 · **Status:** Proposal (recommendation for triage).
> **Owner module:** `uq` / `doc`.

This document is a written recommendation, not a User Journey. It deliberately
contains **no** `shtracer` `@UJ-…@` tags: proposed journey IDs are written as
plain back-ticked text (e.g. `UJ-H-001`) so the traceability engine does not
register them as real, dangling journeys. Authoring the journeys themselves is
out of scope and is delegated to the follow-up tickets listed in
[§7](#7-follow-up-issues-filed).

---

## 1. Executive summary

The existing journey set (`UJ-A` … `UJ-G`) models a **single pilot-in-command
(PIC)** preparing their own flight, plus a thin **Fleet Admin** thread for
profile setup. Flight-training stakeholders — a large share of the General
Aviation population AeroDash targets (flight schools, aeroclubs) — are not
represented as first-class personas. As a result the E2E suite does not protect
the *training* workflow against regressions, and the `H → REQ → UJ → E2E` chain
has no anchor for any future training-specific requirement.

The discovery confirms the four candidate personas and finds:

- **Most training planning is already covered** by the existing PIC journeys —
  the *flight-prep mechanics* (M&B, performance, fuel, weather) are
  persona-agnostic. The training-specific value lies in **framing** (learning
  emphasis, supervision context) and in **two genuinely new collaboration
  paths** that no current journey exercises.
- **Three gaps are covered by extending existing UJs** (preferred per
  `docs/journeys/README.md` §Journey Design Principles). → 3 follow-up `Task`s.
- **One gap requires a new journey phase** — `UJ-H` "Training & Supervision" —
  because no single-pilot journey exercises a *second user reviewing/approving*
  another pilot's plan, nor a *non-destructive instructor demo*. → 1 follow-up
  `Feature`.
- **Three supporting capabilities are missing** (counter-sign/handover, demo
  mode, didactic annotations). These are surfaced as **candidate** `Feature`s
  only — not built here, and the new `UJ-H` journeys are **blocked** on them.

No code, no requirement-document edits, and no new journeys are produced by this
ticket (all are non-goals — see [§8](#8-non-goals)).

---

## 2. Scope and method

- **In scope:** persona inventory; gap analysis (persona × existing UJ phase);
  per-gap decision (extend / new / no action); justification for any new UJ;
  surfacing of supporting capability gaps; filing the follow-up issues.
- **Method:** every existing journey (`docs/journeys/01_…` … `07_…`) was read in
  full and mapped against each candidate persona's goals, constraints, and
  failure modes. The current role model (`REQ-SC-004`) and persistence model
  (the single-pilot session-persistence work, #229) were reviewed to determine
  which gaps need new product capability versus only new journey framing.
- **Journey phases in scope:** `A` Fleet Management · `B` Flight Preparation ·
  `C` Performance & Safety · `D` System & Usability · `E` Weather &
  Environment · `F` Fuel & Endurance · `G` Onboarding & Sync. *(The
  `08_stress_tests.md` file referenced by the journeys README does not yet
  exist in the repository; stress-test framing is therefore folded into the
  relevant phases above.)*

---

## 3. Persona inventory

Four candidate personas are **confirmed**, with refined definitions. Two further
personas surfaced during discovery and are **deferred** with rationale.

### 3.1 Confirmed personas

#### P-STU-AB — Ab-initio student (PPL phase 1–2)

- **Experience:** very low; learning the *decision process* itself, not
  optimising it. First circuits → first supervised solo / first solo navigation.
- **Supervision:** heavy. Every flight is authorised and (for prep) reviewed by
  an instructor. The student rarely, if ever, is the final authority.
- **Aircraft familiarity:** one trainer type (e.g. Tecnam P2008 JC, Cessna 152,
  Pipistrel Velis Electro). Read-only consumer of a club-verified profile.
- **Planning goal:** produce a *correct, defensible* plan and have it
  counter-signed; build the habit of checking every limit.
- **Key failure modes:** does not recognise a marginal result an experienced PIC
  would catch (e.g. aft-CG migration — relates to #110); treats an `[ESTIMATED]`
  or `[UNVERIFIED]` flag as authoritative; submits an unreviewed plan as if
  approved.

#### P-STU-ADV — Advanced student (PPL phase 3+ / night / IFR / complex / mountain)

- **Experience:** moderate; planning task approaches a PIC's, but still inside an
  instructor-review gate for new ratings/endorsements.
- **Supervision:** medium — solo with authorisation; dual for new environments.
- **Aircraft familiarity:** trainer plus possibly a complex/retractable or a
  second type under training.
- **Planning goal:** plan demanding sorties (night, IFR alternates, hot-and-high
  or mountain strips) correctly and get the dual/solo authorisation gate signed.
- **Key failure modes:** over-confidence at the edges of the envelope
  (extrapolation, crosswind, endurance with reserves); skipping the review gate.

#### P-FI — Flight Instructor (FI)

- **Experience:** high (PIC-level for own flying).
- **Role delta vs. PIC:** **supervises** a *student's* preparation — reviews and
  **counter-signs** the student's M&B/performance, spots didactic opportunities,
  and may **demonstrate** an alternative configuration ("what if we load one
  more passenger?") **without destroying the student's work**.
- **Planning goal:** verify a student's plan quickly and reliably; teach by
  contrast; keep an auditable record of who approved what.
- **Key failure modes:** a broken approval gate lets an *unreviewed* student plan
  read as *approved*; a "demo" silently overwrites the student's saved plan.

#### P-CRI — Class Rating Instructor (CRI)

- **Experience:** high; specialist in **type / class familiarisation**.
- **Role delta vs. FI:** emphasis is on **highlighting aircraft-specific quirks**
  (non-linear CG envelope and CG migration, Normal/Utility category switch,
  unusual or sparse POH charts, fuel-type density, energy-vs-fuel for electric)
  rather than on computing a single Go/No-Go for one flight.
- **Planning goal:** walk a rated pilot through "what is different about *this*
  aircraft", using real configurations to surface the traps.
- **Key failure modes:** the teaching points a CRI relies on (e.g. the
  burn-down polygon, the category-switch envelope tightening) regress unnoticed
  because no journey frames them as a *familiarisation* task.

### 3.2 Surfaced but deferred

- **Examiner / Check Airman** (skill-test / proficiency-check observer): observes
  rather than plans; reuses the PIC and (read-only) FI-review paths. No distinct
  safety-regression risk is identified that the FI counter-sign path would not
  already cover. **Deferred** — revisit if an exam-record/attestation feature is
  ever scoped.
- **Safety pilot** (e.g. for an IFR-currency pilot under the hood): operationally
  a second qualified pilot; planning is PIC-equivalent. **Deferred** — covered by
  existing PIC journeys; no new observable behaviour.

---

## 4. Gap-analysis matrix (persona × UJ phase)

Legend — **covered**: existing PIC/Admin journeys already exercise this path for
this persona; **extend**: extend an existing UJ with persona framing (no new
capability); **new**: requires a new journey (`UJ-H`) and is blocked on a
capability; **n/a**: not a meaningful path for this persona.

| Persona | A Fleet | B Flight Prep | C Perf & Safety | D System/Usability | E Weather | F Fuel | G Onboarding/Sync |
| :------ | :------ | :------------ | :-------------- | :----------------- | :-------- | :----- | :---------------- |
| **P-STU-AB** (ab-initio) | covered (read-only, `UJ-G-001`) | **extend** (`T-AB`) + **new** review gate (`UJ-H`) | n/a (phase 1–2) | covered | covered (+ #110 UX) | covered | covered (`UJ-G-001`) |
| **P-STU-ADV** (advanced) | covered (read-only) | covered + **new** review gate (`UJ-H`) | **extend** (`T-ADV`) | **extend** (`T-ADV`) | covered | covered | covered |
| **P-FI** (instructor) | covered (Fleet Admin, `UJ-A-001/004`) | **new** counter-sign review (`UJ-H`) | covered (own PIC flying) | covered | covered | covered | covered |
| **P-CRI** (class rating) | **extend** (`T-CRI`, `UJ-A-003`) | **extend** (`T-CRI`, `UJ-B-004`) | covered (+ optional framing) | covered | covered | covered | covered |

**Reading the matrix:**

- The dense block of **covered** cells confirms the core finding: flight-prep
  *mechanics* are persona-agnostic and already protected.
- Every **new** cell collapses onto the **same** missing concept — a *second
  user* (FI) reviewing/approving or demonstrating against a *student's* plan.
  That single concept is the entire justification for `UJ-H`.
- Every **extend** cell needs only journey framing, no product change — hence a
  `Task`, not a `Feature`.

---

## 5. Per-gap decisions and justifications

### 5.1 Extend decisions (no new capability) → `Task` follow-ups

#### `T-AB` — Ab-initio student variant of the happy path

- **Decision:** *extend* `UJ-B-005` (the "Textbook" happy-path flight prep).
- **Delta:** add a persona variant in which `P-STU-AB` prepares a first
  supervised solo navigation on a club-verified, read-only trainer profile, with
  explicit *learning* framing (the student reads every active flag, confirms
  every limit). The mechanics are identical to the existing happy path.
- **Why extend, not new:** the journey already exercises the full clean flow; the
  only addition is persona, context, and the expectation that the result is taken
  to an instructor (the approval step itself is `UJ-H`, kept separate).

#### `T-ADV` — Advanced-student variant of demanding-condition prep

- **Decision:** *extend* `UJ-D-001` (night) and `UJ-C-001` (hot-and-high /
  mountain) — optionally `UJ-E-003` (deep winter).
- **Delta:** frame these existing edge-case journeys as a `P-STU-ADV` preparing a
  *supervised* night / mountain sortie for a new endorsement, emphasising the
  pre-solo authorisation context. Operational content is unchanged.
- **Why extend, not new:** the operational math, extrapolation, and acknowledgment
  gates are already covered; the persona adds the supervised-solo context only.

#### `T-CRI` — CRI type-familiarisation framing

- **Decision:** *extend* `UJ-A-003` (certification-category switch) and
  `UJ-B-004` (multi-tank burn-down polygon) — optionally `UJ-C-003` (estimated
  distance provenance).
- **Delta:** frame these as a `P-CRI` walking a newly type-rated pilot through the
  aircraft-specific traps (envelope tightening on Normal→Utility; the
  Alternative burn sequence exiting the aft limit), i.e. teaching by surfacing the
  quirk rather than computing one Go/No-Go.
- **Why extend, not new:** the safety-relevant behaviour (the polygon, the
  envelope redraw) is already the centrepiece of those journeys; only the
  didactic framing is new. *Didactic annotations* (instructor notes on the
  result) are a separate capability — see `CAP-3` — and are **not** required for
  this framing.

### 5.2 New-journey decision (blocked on capability) → `Feature` follow-up

#### `UJ-H` — "Training & Supervision" phase

- **Decision:** *new* journey phase `UJ-H`, comprising at least:
  - `UJ-H-001` — **FI counter-sign review**: a student prepares a plan; the FI
    opens it, reviews the M&B/performance, and either requests changes or
    counter-signs it, producing an auditable approved state.
  - `UJ-H-002` — **Instructor demo / what-if**: the FI/CRI injects an alternative
    configuration ("one more passenger", "drain the forward tank first") to teach,
    **without** mutating the student's saved plan, then discards the scratch copy.
- **Justification (why a new UJ is genuinely required — cannot be an extension):**
  - Every existing journey models exactly **one** user mutating **one** plan in
    place. None exercises a *second* user **reviewing or approving** another
    user's plan, and none exercises a *non-destructive* parallel "demo" plan.
  - **Safety / regression risk the current suite cannot detect:** if a future
    counter-sign gate breaks, an *unreviewed* student plan could be presented as
    *approved* — a training-specific misuse of the Safety Core's outputs that **no
    single-pilot UJ would ever catch**. Likewise, a demo that silently overwrote
    the student's saved plan would corrupt the very work being checked. Anchoring
    `UJ-H` now gives any future training REQ a place to attach the
    `H → REQ → UJ → E2E` chain.
- **Blocked on:** `CAP-1` (counter-sign/handover) and `CAP-2` (demo mode). The
  `Feature` is filed now to anchor the phase; its E2E specs land once the
  capabilities exist (E2E for an unbuilt capability would be unrunnable).

---

## 6. Supporting capability gaps (candidates only — not in scope here)

These are product capabilities the training personas need that the app lacks
today. Per the issue, they are filed as **separate** `Feature` candidates and are
explicitly **not** bundled into this discovery ticket.

| ID | Capability | Why training needs it | Notes / dependencies |
| :-- | :--------- | :-------------------- | :------------------- |
| `CAP-1` | Multi-user **serial handover & counter-sign** (student → FI), incl. training-aware **roles** (Student / Instructor) | An FI must review and approve a student's plan with an auditable record; today the role model (`REQ-SC-004`) has only Org Admin / Fleet Admin / Member, and persistence (#229) is single-pilot | Extends RBAC + persistence; likely post-v0.8.0 (Sync & Auth). Indirect safety: prevents an unreviewed plan reading as approved. Unblocks `UJ-H-001` |
| `CAP-2` | Instructor **non-destructive "demo / what-if"** mode (scratchpad that never overwrites the student's saved plan) | FI/CRI teach by contrast without corrupting the student's work | Unblocks `UJ-H-002`. May reuse existing recompute logic over a cloned in-memory plan |
| `CAP-3` | **Didactic annotations / instructor review notes** on results | FI/CRI attach quirk call-outs and review comments to specific results | Related to but **distinct** from #110 (which concerns *system-generated* limit-indicator UX; `CAP-3` is *instructor-authored* content). Enhances `T-CRI` and `UJ-H` but is not required by them |

---

## 7. Follow-up issues filed

All follow-ups are filed at status `open` (awaiting human triage) with **no
milestone** (backlog), and are attached to #230 as native sub-issues so the
parent thread tracks them. Per `CONTRIBUTING.md` §10, parent #230 closes only
once these children are resolved.

| Decision | Type | Issue | Title (summary) |
| :------- | :--- | :---- | :-------------- |
| `T-AB` extend `UJ-B-005` | `Task` | #331 | Extend UJ-B-005 with an ab-initio-student variant |
| `T-ADV` extend `UJ-D-001`/`UJ-C-001` | `Task` | #332 | Extend UJ-D-001 / UJ-C-001 with an advanced-student variant |
| `T-CRI` extend `UJ-A-003`/`UJ-B-004` | `Task` | #333 | Extend UJ-A-003 / UJ-B-004 with a CRI type-familiarisation framing |
| `UJ-H` new phase | `Feature` | #334 | Establish UJ-H "Training & Supervision" journey phase |
| `CAP-1` capability | `Feature` | #335 | Multi-user serial handover & counter-sign workflow (Student → FI) |
| `CAP-2` capability | `Feature` | #336 | Instructor non-destructive "demo / what-if" mode |
| `CAP-3` capability | `Feature` | #337 | Didactic annotations / instructor review notes on results |

*(Issue numbers are backfilled once the issues are created; the canonical,
always-current list of links is the summary comment on #230.)*

---

## 8. Non-goals

Per #230, the following are explicitly **out of scope** for this ticket and are
left to the follow-ups above:

- Authoring the new journeys themselves (no `@UJ-…@` tags created here).
- Building any training-specific capability (`CAP-1/2/3`).
- Changing persona definitions in the requirements documents (`docs/requirements/`)
  — the refined personas in [§3](#3-persona-inventory) are *proposed*, to be
  applied in follow-ups if accepted.
- Authoring new requirements; any training REQ is deferred to the relevant
  capability follow-up.

---

## 9. References

- `docs/journeys/README.md` — journey authoring rules ("prefer extending", UJ IDs
  per phase, tag format).
- `docs/journeys/01_fleet_management.md` … `07_onboarding_sync.md` — existing UJs.
- `docs/requirements/cloud_sync_collaboration.md` — `REQ-SC-004` role model.
- #110 — UX patterns for marginal limit indicators (ab-initio relevance).
- #225 / #231 — electric-aircraft support (precedent: we design for specific
  populations, not generic pilots).
- #229 — single-pilot session persistence (the model `CAP-1` must extend).
</content>

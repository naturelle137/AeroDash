# Airport freshness: source decision and executable contract for #284

## Kurzfassung für den CEO

AeroDash hat derzeit keinen angebundenen Airport-Datensatz. Die gespeicherten
Runway-Werte stammen aus manuellen Piloteneingaben; ihr Speicherdatum belegt
keine Aktualität der ursprünglichen Quelle. AIRAC regelt Veröffentlichung und
Wirksamwerden bestimmter Änderungen, liefert aber keine pauschale Gültigkeit
für jede Bahnangabe. Ein automatischer Aktualitätstest wäre heute ohne echten
Datensatz und Verbraucher nicht aussagekräftig.

Empfehlung: Jetzt die Anforderungen und Abnahme von #284 präzisieren und den
fehlenden Quellenvertrag ausdrücklich als Voraussetzung festhalten. Den
Offline-Arbeitsablauf mit Kennzeichnung „user-entered, not airport-validated“
erhalten. #284 bleibt bis zur tatsächlichen Datenintegration und sichtbaren
Abnahme offen; diese Recherche ist keine fertige Aktualitätsfunktion.

## Decision, scope and evidence date

Decision: **missing-source disposition; no freshness implementation authorised
by the present evidence**. This is an engineering source decision checked on
2026-11-17, not operational approval, legal advice or certification.

Scope: the existing frontend manual-runway path for flight preparation,
primarily non-commercial fixed-wing GA. No specific flight, licence, aircraft,
registration, operator or jurisdiction was supplied. No operational applicability
for any such combination is asserted. Spanish AIS material below explains its
own publication system; it is not German/EU law or proof of German aerodrome
coverage. EUROCONTROL provides publication guidance, not an airport dataset.

Repository inspected: live remote `develop`
`45a04abd9de9c3b2176f8517a2ea268116c9a38c` (remote ref checked on the evidence
date). All three corrected input rows and all 41 exact citations from the checked
local preparation were compared with this revision. All three frozen-file
SHA-256 hashes match. The original local preparation required rework; only the
checker's single corrected artifact was consumed. No additional repair or
parallel author was used. Machine-readable details are in
[source-decision.json](source-decision.json).

## Primary sources and bounded findings

Two authoritative publications were used; no account, payment, contact, API
integration or new service was used. References below identify sections rather
than treating web extraction line numbers as durable legal citations.

| Source | Date/version observed | Sections and applicability |
| :--- | :--- | :--- |
| [EUROCONTROL: AIRAC dates](https://www.eurocontrol.int/publication/aeronautical-information-regulation-and-control-airac-dates) | Page publication 2020-07-02; live check 2026-11-17 | Introductory publication procedure; international scheduling explanation. Linked PDF/calendar downloads were not consumed. |
| [ENAIRE AIP España GEN 3.1](https://aip.enaire.es/aip/contenido_AIP/GEN/LE_GEN_3_1_en.html) | Live check 2026-11-17; HTML displays header dates 09-JUL-26 / 22-JAN-26 and amendment annotations 408/26 / 402/26 | Sections 2, 3.1–3.5, 4 and 6.1–6.1.2; Spanish AIS. Mixed amendment annotations are retained, not asserted to be a single latest consolidation. |

EUROCONTROL describes dispatch at least 42 days before effect, aiming for
receipt at least 28 days before effect; major changes may warrant 56 days.
These are advance-notice intervals, not expiry rules. [EUROCONTROL](https://www.eurocontrol.int/publication/aeronautical-information-regulation-and-control-airac-dates)

ENAIRE distinguishes regular amendments, AIRAC amendments, supplements with
their own dates, and urgent NOTAM; trigger reminders last 14 days after effect.
Its section 4 schedule provides these publication → effective pairs:
2026-09-17 → 2026-10-29; 2026-10-15 → 2026-11-26;
2026-11-12 → 2026-12-24; 2026-12-10 → 2027-01-21.
The temporary-change exception qualifies the 28-day stability provision.
Section 6 describes digital datasets, metadata and limitations; public aerodrome
files can include thresholds with declared distances. [ENAIRE GEN 3.1, sections 3–4 and 6](https://aip.enaire.es/aip/contenido_AIP/GEN/LE_GEN_3_1_en.html)

Engineering conclusions: publication is not effectiveness; the next calendar
date is not a runway record's expiry. A trigger reminder's end is not the end of
the underlying amendment. A downloaded or newly saved copy does not establish
source completeness, absence of NOTAM restrictions or operational validation.
On the check date, 29 October is the preceding listed effective date and
26 November the next; this identifies calendar position only. The cited table
gives dates, not a verified time-of-day contract, so no midnight conversion is
introduced. No actual airport record, its effective interval, expiry or NOTAM
coverage was established here.

## Actual schema and consumers

Paths and symbols below are at the inspected revision. They describe implemented
behaviour, not the broader architectural roadmap.

| File | Current contract or caller |
| :--- | :--- |
| `frontend/src/core/logic/manual-runway.ts` | Lines 76–107: strict runway schema and strict version-1 record `{schemaVersion, savedAt, runway}`. Runway fields: aerodrome, designator, separate value/unit TORA and LDA, value/unit field elevation, surface type/condition. No source, publication, effective, expiry, AIRAC or parameter verification fields. Lines 231–232 serialize the supplied save date. |
| `frontend/src/modules/airport/services/manual-runway.repository.ts` | `saveManualRunway(runway, now)` passes the save date to the record helper; load/save/clear use localStorage key `aerodash.performance.manual-runway.v1`. This path does not use IndexedDB or fetch airport data. |
| `frontend/src/modules/airport/stores/manual-runway.store.ts` | `save(now = new Date())`; `current` means valid draft equal to saved values with finite normalization. It does not mean current source information. Edits hide the saved declaration; save/discard/clear and storage errors remain local. |
| `frontend/src/modules/airport/components/ManualRunwayPanel.vue` | Presents manual provenance, local save time, fields and saved summary; no airport lookup. |
| `frontend/src/modules/performance/views/PerformanceView.vue` and `components/FlightPrepPerformance.vue` | Both mount the manual panel. |
| `frontend/src/modules/performance/composables/performance-step.ts` | `inputKey` includes saved record, draft and storage state; `runwayPresentation` supplies declared rows and unvalidated note to Performance/briefing presentation. |
| `frontend/src/modules/performance/composables/pressure-altitude-input.ts` | Explicit elevation copy, tagged with manual record save time; later save/change invalidation is not source freshness. |
| `frontend/src/modules/performance/components/CorrectionSourcePanel.vue` | Uses current manual identity/surface; revision tracks draft and savedAt. No external source or currency validation. |
| `frontend/src/views/PrivacyView.vue` | Re-reads runway state after local-data erasure. |
| `docs/architecture/manual-runway-entry.md` | Manual pilot copying from official publications; no integrated airport database or online lookup. |
| `docs/requirements/airport_database.md` | REQ-AP-005 is conditional on future retrieval and requires every retrieved parameter Unverified. REQ-AP-001/-002/-005/-007 remain future scope; -009 through -019 cover the manual path. |

No integrated external airport dataset, ingestion adapter, source manifest,
refresh schedule or production freshness consumer was identified in the airport
module, application references, public assets, scripts or CI workflows. Repository
paths and AIRAC/provider/network searches agree with the explicit manual contract.
Weather or POH data, synthetic tests, the AIRAC calendar and pilot-consulted
publications are not an integrated airport database. ENAIRE's available external
publications are not evidence of an AeroDash integration or eligible reuse.

## Executable disposition now

The original [issue #284](https://github.com/naturelle137/AeroDash/issues/284)
asks for a calendar, CI freshness check and stale external parameters flagged
Unverified. The missing real dataset makes its last two acceptance items
inapplicable today. The finite useful deliverable is a reviewed requirements and
source-contract correction. It must not be reported as completing those items.

The delivery owner should apply this exact scope correction in one docs PR:

1. In `docs/requirements/airport_database.md`, retain REQ-AP-005 verbatim and add
   a scope paragraph: “External airport retrieval and automated freshness checks
   require a named, integrated dataset and production consumer with reviewed
   coverage, reuse permission, publication/version metadata, effective semantics,
   update rules and supersession/expiry semantics where available. The manual
   runway record provides none of these source guarantees. Its savedAt is a local
   persistence timestamp. Calendar position and source freshness shall not set
   parameter verification to Verified or approve operational use.”
2. In `docs/architecture/manual-runway-entry.md`, add a freshness boundary:
   “A saved declaration's current state means equality with the valid current
   form. Source currency, effective date, expiry and dynamic restrictions remain
   unknown to AeroDash. Saving, re-saving, editing or using the declaration
   offline does not establish them. Keep the user-entered, not airport-validated
   marker in every existing consumer.” No schema migration is needed for this
   correction.
3. In `docs/risk_management/safety_hazards.md`, retain H-015 and state that
   manual provenance mitigates misrepresentation only; automatic detection of
   outdated airport data is not implemented. Link this source decision without
   declaring the hazard closed or its residual risk newly accepted.
4. In `docs/development/roadmap.md` and the issue's acceptance description,
   record “source-contract disposition delivered; automatic freshness workflow
   still open pending real source integration.” Record the exact prerequisite
   and event owner below. This research pair can be kept under `docs/research/`;
   any calendar reference under `docs/regulatory/` must retain the same limits.

No runtime freshness classifier, extra timestamp, fake manifest, timer, scheduled
refresh job or CI staleness gate is justified by this disposition. Do not add a
cosmetic badge or calendar-only utility to manufacture product completion.

## Source eligibility and future engineering policy

This section is a proposed engineering acceptance contract, not a claim that an
aviation authority prescribes these application states. It becomes implementable
only after a real named source and actual consumer exist.

| Topic | Required policy |
| :--- | :--- |
| Source identity | Retain provider, publication/record ID, URL/section, jurisdiction, coverage, licence/reuse basis, units, revision and applicable limitations. Check an actual record and its consumer; a generic official web link is insufficient. |
| Time provenance | Keep publication, retrieval/import, local save and source-effective times separate. Preserve source date granularity and timezone. Unknown is explicit, not an invented timestamp. |
| Effective state | Future effect is `not-yet-effective`; no automatic use before its documented boundary. An applicable interval can establish temporal applicability only, never operational approval. |
| Expiry/supersession | Only source-supported expiry, supersession or a reviewed provider-specific update/completeness contract can establish `stale`. Do not assume every record expires at the next AIRAC date. Missing expiry alone is neither infinite validity nor proof of staleness. |
| Unknown | Missing source/version/effect or unconfirmed update/NOTAM coverage remains `unknown`. Unsupported or conflicting metadata must not produce a fresh result. A user-entered date is still a user assertion. |
| Verification | Preserve a separate per-parameter axis. Every externally retrieved parameter starts Unverified under REQ-AP-005, even if temporally applicable. Refresh/replacement or an override invalidates any verification tied to the replaced value. No bulk or automatic approval from time checks. |
| Dynamic restrictions | AIRAC currency never means no NOTAM/SUP restriction. Preserve separate restriction coverage and briefing limitations. No dynamic feed exists today; no green “NOTAM clear” state is possible. |
| Override | Retain source values/provenance and explicit manual override provenance separately. An override cannot repair source freshness or restrictions. The existing manual edit/save/discard path remains usable offline and unvalidated. |
| Offline | Continue existing manual entry and saved-value recovery. Cached metadata may be shown with its known limitations, never represented as a live source or live restriction check. |
| CI | Once a real dataset is shipped and consumed, test its actual manifest/version/coverage and provider-specific update contract. Fail closed on unsupported metadata or incomplete inputs; distinguish unknown from stale. A live network failure is not proof that saved data expired. No fabricated dataset or savedAt-based CI check. |

Future named implementation locations, if that prerequisite is met: a pure
source-specific classifier and schema under `frontend/src/core/logic/`, airport
adapter/repository/store under `frontend/src/modules/airport/`, visible state in
`ManualRunwayPanel.vue` or a distinct external-airport panel, and the same state
through `performance-step.ts` into existing presentation/briefing output. Any
new export/import or persistence schema needs explicit versioned provenance and
backward recovery; there is no current airport-database importer/exporter to
claim completed. Preserve POH and operational-composition boundaries.

## Acceptance and evidence for the delivery owner

For the current docs disposition, verify exact changed requirements, source links,
JSON parsing, unchanged manual schema/runtime, and normal lint/unit/required CI
on the actual candidate. State clearly that UI and freshness behaviour have not
changed. No new UI screenshots or E2E result are claimed by this research.

If a later source-supported runtime increment is proposed, accept it only with
pure synthetic software cases (no invented operational airport/POH values):
unknown source; missing effective metadata; future effect; exact documented
boundary; source-expired; explicitly superseded; unchanged record across a new
AIRAC date; re-save without source change; source-specific date/time ambiguity;
known temporal applicability with Unverified parameters; manual override;
offline/unavailable restriction coverage; unsupported persisted version.

Evidence must exercise real visible consumers at 390 px and 1440 px: save/reload,
edit/discard, storage failure, same-tab erasure, source limits and briefing/print
consistency. Use existing manual-runway E2E and production offline suites as
appropriate: `frontend/tests/e2e/features/phase-b-flight-preparation/manual-runway-entry.feature`,
`frontend/tests/e2e/steps/manual-runway.steps.ts`,
`frontend/tests/offline-production/flight-prep-performance.spec.ts`, and
`frontend/tests/offline-production/briefing-pack.spec.ts`. Cached-offline evidence
requires a production build, established service-worker control, cached reload
with network disabled, and the same user-entered/unvalidated limitations. A dev
server, unit tests or calendar logic alone does not prove it. Browser emulation
is not physical-device acceptance.

Use one fresh independent review with live primary sources, at most one named
fix round, then normal protected PR/required CI and signed expected-head
integration. Record accepted commit/tree and actual integrated results; do not
weaken branch protection or claim the research candidate was merged. The terminal
owner is responsible for that single delivery review, not a duplicate research
review followed by another delivery review.

## Uncertainties, reopening event and ownership

A source must still be chosen and its actual record, reuse permission, coverage,
update/supersession policy, effective-time semantics, limitations and real
AeroDash consumer accepted. ENAIRE is an example of an official source, not a
selected provider; its current full consolidation and German applicability were
not established. No NOTAM collection or flight-specific briefing was performed.
No paid ICAO text was accessed; no ICAO Annex quotation or legal obligation is
claimed from secondhand guidance. A separate Irish guidance PDF could not be
opened through the web tool and was not used as evidence.

The reopening event is **accepted integration of a named eligible airport source
with an actual consumer and reviewed source-specific metadata/limitations**, not
the next AIRAC date or an elapsed polling interval. Until then, #284 remains open
with the missing-source prerequisite. HQ terminal owner **1892** owns this
requirements/source disposition, its one review/integration, all dependency
failures and the next useful AeroDash supply. CPO retains product acceptance;
aviation subject owner checks source applicability; CTO accepts integration.

Preserve the independent holds: #305/HQ638 controlled sources, #300/#302 sourced
composition, and #420 genuine physical-device evidence. This decision clears
none of them. The #301 new-primary-source event and #581 advisory-exception
expiry/removal obligations remain with their established owners. No routine CEO
message, upload, new service, duplicate research job or polling chain follows
from this research.

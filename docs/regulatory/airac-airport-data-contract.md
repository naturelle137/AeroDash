# AIRAC and airport source contract

## Shipped boundary

AeroDash consumes pilot-entered runway values only. No integrated airport dataset,
external-source adapter, source manifest or CI airport-currentness check exists.
The [manual contract](../architecture/manual-runway-entry.md) retains offline
entry and recovery. `savedAt` records local saving, not source publication,
retrieval, effect, expiry or verification. Source currency and NOTAM coverage
remain unknown; entries are **user-entered, not airport-validated**.

This engineering prerequisite for [#284](https://github.com/naturelle137/AeroDash/issues/284)
is not operational approval or regulatory certification. Scope: flight
preparation, primarily non-commercial fixed-wing GA; no specific flight,
operator, licence, aircraft or registration is assessed.

## Official evidence and calendar

The following calendar sources were retrieved on **2026-11-17**:

| Source | Publication/edition | Sections and applicability |
| :--- | :--- | :--- |
| [EUROCONTROL AIRAC dates](https://www.eurocontrol.int/publication/aeronautical-information-regulation-and-control-airac-dates) | Published 2020-07-02 | Introductory publication procedure; scheduling guidance, not an airport dataset or law. |
| [EUROCONTROL AIRAC dates PDF](https://www.eurocontrol.int/sites/default/files/2020-07/airac-cycle-dates-1.1.pdf) | Displayed edition 1.0, 2020-07-02 (despite URL suffix 1.1) | §1 scope; §2 calendar, printed p.2 for 2026–2028. |
| [ENAIRE AIP España GEN 3.1](https://aip.enaire.es/aip/contenido_AIP/GEN/LE_GEN_3_1_en.html) | Displayed dates 09-JUL-26 / 22-JAN-26; AMDT 408/26 / 402/26 | §§2, 3.1–3.5, 4, 6.1–6.1.2; Spanish AIS. Latest full consolidation not established. |

EUROCONTROL describes distribution at least 42 days before effect, targeting
receipt 28 days before effect; major changes warrant 56 days where practicable.
These are advance-notice intervals, not record lifetimes.
[Source: EUROCONTROL introduction](https://www.eurocontrol.int/publication/aeronautical-information-regulation-and-control-airac-dates).

ENAIRE §4 lists these publication/effective pairs; EUROCONTROL PDF §2 confirms
the effective dates:

| Publication date | Effective date |
| :--- | :--- |
| 2026-09-17 | 2026-10-29 |
| 2026-10-15 | 2026-11-26 |
| 2026-11-12 | 2026-12-24 |
| 2026-12-10 | 2027-01-21 |

The app limits its cycle display to 2020-01-02 through 2028-12-21, the first and last dates printed in the referenced calendar. Dates outside that range are unavailable rather than extrapolated.

The table establishes dates only, not a verified effective time or timezone.
ENAIRE §§3.1–3.5 distinguish amendments, supplements and urgent NOTAM. A trigger
NOTAM's 14-day reminder interval does not terminate its underlying amendment.
The §4 stability provision has a temporary-change exception. Sections 6.1–6.1.2
describe digital datasets and metadata; none is selected for AeroDash.
[Source: ENAIRE GEN 3.1](https://aip.enaire.es/aip/contenido_AIP/GEN/LE_GEN_3_1_en.html).

These Spanish AIS descriptions do not establish EU/German law, German airport
coverage or flight-specific applicability. Engineering consequence: publication
is not effect; the next AIRAC date is not automatic expiry. Calendar position
cannot establish completeness or absence of NOTAM/SUP restrictions.
No airport record's effective interval, expiry or restriction coverage was verified.

## Source-first acceptance gate

### Candidate decision: EUROCONTROL EAD Basic

Evaluated 2026-11-20 for the manual runway consumer. Do not integrate.

- [EAD Basic](https://www.ead.eurocontrol.int/cms-eadbasic/opencms/en/ead-solutions/ead-basic/) requires registration and states that it is not connected to the operational database, may not show the latest information, and must not be used for operational purposes.
- [EAD service information](https://www.eurocontrol.int/service/european-ais-database) describes European coverage and periodic data downloads, but service and third-party royalty charges depend on client classification. Reuse rights, costs and an authorised reproducible delivery contract for AeroDash are not established.
- Record-level declared-distance coverage, publication, effective and expiry semantics, update completeness and restrictions for a usable download were not established. NOTAM availability in EAD does not establish coverage in a downloaded snapshot. These remain unknown.

### Candidate decision: OurAirports

Evaluated 2026-11-19 for the existing manual runway comparison consumer. Do not
integrate this candidate into that consumer under the current contract.

- [OurAirports downloads](https://ourairports.com/data/) state that the data is
  public domain without accuracy or fitness guarantees. The global airport and
  runway CSVs cover records on the site, not a guaranteed complete jurisdiction.
- The [data dictionary](https://ourairports.com/help/data-dictionary.html) defines
  persistent internal record IDs, airport references and runway dimensions in
  feet. `length_ft` is the whole physical surface, including displaced thresholds
  and overruns; it is not TORA, TODA, ASDA or LDA. The current consumer requires
  independently declared TORA and LDA. Substituting length would invent them.
- The [provider's download repository](https://github.com/davidmegginson/ourairports-data)
  provides CSV snapshots generated daily. GitHub file dates change only when
  contents change. A commit identifies a snapshot, not the effective date or
  expiry of every record; daily generation does not establish record currency.
- Record effective/expiry and supersession semantics, completeness, and NOTAM/SUP
  coverage for this consumer were not established in those provider documents.
  Offline snapshots cannot establish later changes or restrictions. These remain
  unknown, not fresh or stale by assumption.

### Candidate decision: openAIP

Evaluated 2026-11-19 from public pages only. Do not integrate.

- The [openAIP home page](https://www.openaip.net/) states CC BY-NC 4.0 and permits
  shipping the data in paid applications only if the data is not sold on its own.
  Whether AeroDash's distribution and any future hosting fit that term is not
  established; the terms and legal pages were unreadable.
- The [export page](https://www.openaip.net/data/exports) offers per-country
  airport files in several formats via pre-signed links that expire after 24 hours.
  There is no stable delivery URL for a reproducible, CI-checkable manifest.
- Runway declared distances (TORA/TODA/ASDA/LDA), record-level effective/expiry
  or AIRAC metadata, accuracy/fitness terms and NOTAM coverage were not found.
  They remain unknown, not assumed.

### Candidate decision: FAA NASR

Evaluated 2026-11-20 from the public
[28 Day NASR Subscription page](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/2026-11-26)
and the airport CSV group of the cycle effective 2026-11-26. Do not integrate.

- Strong points: each cycle page states an effective date and the CSV rows carry
  `EFF_DATE`; `APT_RWY_END` has `TKOF_RUN_AVBL`, `TKOF_DIST_AVBL`,
  `ACLT_STOP_DIST_AVBL` and `LNDG_DIST_AVBL` (TORA/TODA/ASDA/LDA equivalents).
  Stable per-cycle download URLs exist.
- Coverage: `APT_BASE` holds about 19,300 US, 82 CA, 26 BS, 14 MH and 5 TC
  records. No European airport is covered, but AeroDash targets EASA Part-NCO
  pilots. A US-only dataset cannot serve the intended consumer jurisdiction.
- Declared distances are populated for only about 2,800 of 39,866 runway ends
  (about 7 %); absent values must stay unknown, never derived from `RWY_LEN`.
- Units are feet. The cycle's `EFF_DATE` is the cycle effective date, not a
  per-record effective or expiry date; whether a record is superseded before the
  next cycle (NOTAMs, NASR amendments) is not established by the data.
- A licence/reuse statement and an accuracy/fitness disclaimer were not found on
  the cycle page or in the CSV README text; they remain unknown, not assumed.
- NOTAM coverage is not part of the dataset and stays unknown.

Reconsider a source when its declared-distance fields, reuse and delivery terms,
record-level temporal semantics and restriction limitations satisfy the gate
below. Until then, retain offline manual input and its unverified provenance.

Before implementing airport freshness, accept a named authorised provider/dataset
and an actual AeroDash consumer, with all of the following documented:

- Record identity, jurisdiction, coverage, units, licence/reuse permission and
  delivery interface, including applicable limitations.
- Source version, publication and effective metadata, date granularity/timezone,
  expiry/supersession and provider-specific update/completeness policy.
- NOTAM/SUP coverage, update failures and offline limitations, separately from
  AIRAC applicability; unresolved facts remain explicit.

This is future engineering acceptance, not shipped behaviour:

| Concern | Acceptance boundary |
| :--- | :--- |
| Time | Preserve publication/effect/expiry separately from retrieval/import and local saving. Do not invent timestamps. |
| Unknown | Absent, unsupported or conflicting metadata remains unknown, never implicitly fresh or automatically stale. |
| Future effect | Identify not-yet-effective records; do not apply them early. |
| Staleness | Require source-supported expiry/supersession or an accepted provider-specific update contract. No blanket 28-day expiry or `savedAt` age rule. |
| Verification | Keep per-parameter verification separate. Retrieved parameters start `Unverified` under REQ-AP-005; calendar freshness cannot verify them. |
| Replacement/override | Retain original source values/provenance and separate manual provenance. Replaced values invalidate prior verification and dependent assessments; overrides cannot renew source currency. |
| Restrictions | Unknown NOTAM coverage stays unknown, including offline; no calendar-derived “NOTAM clear” or operational approval. |
| CI | Only after a real dataset and consumer exist, test their actual manifest, coverage and source-specific update contract. Unsupported/incomplete metadata cannot pass as fresh. Network failure alone does not prove expiry. |

## Future implementation and evidence

After that gate, deterministic classification/validation belongs in P1 with
explicit inputs and typed failures; P2 owns fetching/adaptation, clock inputs,
repository/store and presentation. The separate manual date check uses pilot declarations and does not implement this external-source contract. Later persistence/import/export needs versioned provenance and
backward recovery. Performance and briefing must carry the same source limits
and invalidation state. Preserve the usable manual offline path.

Use fixed synthetic cases for missing/conflicting metadata, future effect, exact
source-supported boundaries, expiry, supersession, an unchanged record across an
AIRAC date, re-save, overrides, unavailable restrictions and unsupported stored
versions. These establish software behaviour, not operational data validity.
Exercise actual consumers at 390 px and 1440 px, including save/reload,
edit/discard, storage failure, same-tab erasure and briefing/print consistency.
Cached-offline evidence requires a production build, established service-worker
control and network-disabled reload. Browser emulation does not establish
physical-device acceptance.

## Open prerequisite and owner

**#284 remains OPEN on source hold.** HQ terminal owner **1892** owns source
acceptance, the single independent review (at most one named fix round),
integration and next AeroDash supply. Reassess on an actual complete accepted
source/consumer contract with the metadata and limitations above, not on a timer
or the next AIRAC date. Calendar documentation alone cannot complete the feature.

This disposition does not change #305/HQ638, #300/#302, #301/1866 or #581's
exception/expiry obligations. #420 genuine-device acceptance remains UNEXECUTED.
H-015 is neither closed nor newly risk-accepted.

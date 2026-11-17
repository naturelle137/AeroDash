# Missing-distance estimation: source eligibility

As of 2026-11-17, no missing-distance derivation is accepted. This contract supports
REQ-PF-005/023/017/032; it does not implement estimation or establish aircraft applicability.

## Bounded source decision

The following official UK CAA publications were checked on 2026-11-17. Page numbers
refer to PDF pages, which match the printed numbering.

| Publication | Version, date and catalogue status | Inspected location and limitation |
| :--- | :--- | :--- |
| [SSL07, Aeroplane Performance](https://www.caa.co.uk/data-and-publications/publications/documents/content/safety-sense-leaflet-07/) | C, 21-Jan-2013; superseded | Catalogue points to SSL09 and offers no original file. Historical contents remain UNKNOWN. |
| [SSL09, Weight, Balance and Performance](https://www.caa.co.uk/data-and-publications/publications/documents/content/safety-sense-leaflet-09/) | A, 22-Aug-2024; current; PDF imprint August 2024 | [PDF](https://www.caa.co.uk/publication/download/12650), p.11 Aircraft data / Distance vs roll, p.14 example and conditions, p.15 Safety factors; no explicit proposed conversion or inverse found in the complete PDF. |
| [SSL12, Strip Flying](https://www.caa.co.uk/data-and-publications/publications/documents/content/safety-sense-leaflet-12/) | 15, 23-Dec-2024; current; PDF imprint May 2024 | [PDF](https://www.caa.co.uk/publication/download/23582), p.7 Takeoff and landing performance, p.8 Distances vs Ground roll, p.15 Recommended performance factors for takeoff; no explicit proposed conversion or inverse found in the complete PDF. |

SSL12's catalogue date differs from its PDF imprint; neither a December content
revision nor equivalence of those dates is inferred.

| Proposed direction | Eligibility in this inspected set |
| :--- | :--- |
| Known TOR → missing TOD: `TOD = TOR × 1.9` | Unsupported; no estimated TOD. |
| Known TOD → missing TOR: `TOR = TOD / 1.9` | Independently unsupported; no estimated TOR. |
| Known LR → missing LD: `LD = LR × 1.67` | Unsupported; no estimated LD. |
| Known LD → missing LR: `LR = LD / 1.67` | Independently unsupported; no estimated LR. |

These findings establish unavailable eligibility in the inspected set, not that no
historical publication anywhere contained a rule. An unavailable SSL07 original
supplies no affirmative evidence. Algebraic inversion alone cannot establish a
permitted inverse direction or conservative bound.

[SSL09 p.11](https://www.caa.co.uk/publication/download/12650) and
[SSL12 p.8](https://www.caa.co.uk/publication/download/23582) distinguish ground roll
from distance including flight to/from a stated height. The reference height is
not universally 50 ft. Their p.15 safety factors are distinct from a missing-distance
conversion; SSL12 conditions additional margins on an unfactored baseline. This
contract accepts no conversion, environmental correction or operational factor.

These are UK guidance sources. They establish neither EU/German legal applicability
nor approval for a particular aircraft or operation. Registration, certification,
configuration, operator and purpose remain unspecified. No legal or certification
claim follows from this source decision.

## Eligibility and provenance for any future estimate

Applicable aircraft-specific AFM/POH data, limitations and supplements take precedence.
Keep supplied distances; never replace them with an estimate. Before a missing value
can be derived, an accepted accessible primary passage must explicitly establish:

- The formula and permitted direction, assessed separately for each direction.
- Aircraft/configuration, technique, operating conditions, range and exclusions.
- Input/output quantities, units and obstacle/reference height.
- Factored or unfactored baseline and included corrections/margins, avoiding double counting.
- Actual publication identity, revision/version, section/page and official URL.

If no eligible rule exists, report the missing distance as unavailable with a reason;
do not multiply, divide, substitute zero or chain an unsupported estimate. Reject
unsupported or unverifiable provenance rather than treating it as POH data. Repository
requirements, issue comments and superseded catalogue labels are not source approval.

Any future accepted estimate carries `ESTIMATED` and its actual source/version/section,
direction and applicability conditions beside each affected value. Preserve that
per-value lineage through every supported persistence, import, export and briefing
path, with validation on import/reload and invalidation when source or inputs change.
Never substitute a fixed CAA attribution for the actual evidence. Raw aircraft/Fleet
exchange retains original source points and units; computed estimates must not become
purported POH source points. This is a future acceptance boundary, not an existing
estimation persistence or export capability.

## Current implementation boundary

[`inspectTables`](../../frontend/src/modules/performance/services/poh-inspection.ts)
requires exactly one positive, complete rectangular grid for each of TOR, TOD, LR and
LD. A missing/duplicate phase, invalid declaration or corrupt/incomplete grid blocks
globally before either takeoff or landing is assessed. That rejection remains intact;
corruption must not be reclassified as an absent phase eligible for estimation.

After successful inspection, `assessGroup` handles subsequent mass/envelope lookup
failures per group. An unavailable landing mass can therefore preserve valid takeoff
results; a missing landing table cannot. The shared presentation feeds standalone
Performance, Flight Prep and the current briefing snapshot. None implements an
accepted missing-distance estimate or its lineage. See [Flight Prep](performance-flight-prep.md)
and [source-unit preservation](performance-source-units.md).

Complete-data POH precedence, global missing/invalid-grid rejection, later independent
group failures, original-unit preservation and current-result invalidation remain
acceptance boundaries. Synthetic software fixtures establish wiring only, not
operational validation. No positive ratio fixture is justified by this source set.

## Source hold and delivery boundary

[Issue #301](https://github.com/naturelle137/AeroDash/issues/301) remains open under the
existing owner (#1866). Reopening estimation requires a new accessible primary passage
explicitly establishing formula, permitted direction, aircraft/conditions, reference
height and factor baseline, personally accepted by that owner. Elapsed time alone does
not restart research or implementation.

This finite documentation correction preserves correction-source work (#305 / HQ #638),
Flight Prep/briefing composition (#300/#302), physical-device acceptance (#420) and
existing #110/#521/#527/#534 history. It neither validates unrelated factor/legal
requirements nor changes their scope. The owner commissions the sole independent
fresh-session review and accepts protected signed integration; this correction does
not close the wider feature or claim a new browser/runtime capability.

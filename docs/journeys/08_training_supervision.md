# User Journeys - Phase H: Training & Supervision

These future journeys describe intended outcomes, not implemented or tested
features. AeroDash currently stores preparations locally and does not provide
editable student/instructor handover, counter-signature or an isolated demo mode.
The briefing pack can be printed or saved locally as an explicitly unapproved
student handover copy for an instructor to review outside the app. It does not
record the review or establish either person's identity.

## <a name="UJ-H-001"></a>UJ-H-001: Instructor counter-sign review

**Personas:** Student pilot and flight instructor (FI).

**Goal:** The instructor reviews the student's prepared flight and either returns
it for changes or records an auditable approval of the reviewed plan.

| Phase | User action | Intended observable outcome |
| :--- | :--- | :--- |
| Preparation | The student prepares and submits a plan. | The plan is identified as submitted and unapproved. |
| Review | The instructor opens the submitted plan and reviews its M&B and performance, including warnings and sources. | The instructor can identify the plan and the state being reviewed. |
| Changes | The instructor requests changes. | The plan is returned without an approved state; the student can correct and resubmit it. |
| Approval | After review, the instructor counter-signs the plan. | An approval record identifies who approved which plan and when. An unreviewed or changed plan must not appear approved. |

**Dependency:** [Counter-sign and handover capability #335](https://github.com/naturelle137/AeroDash/issues/335), including its future requirements. [REQ-SC-004](../requirements/cloud_sync_collaboration.md#req-sc-004-role-based-access-control) is related role-model context; it does not define instructor approval. E2E coverage awaits the capability and its requirements.

## <a name="UJ-H-002"></a>UJ-H-002: Instructor demo / what-if

**Personas:** Student pilot and FI or class rating instructor (CRI).

**Goal:** Demonstrate an alternative without changing the student's saved plan.

| Phase | User action | Intended observable outcome |
| :--- | :--- | :--- |
| Start | The instructor opens a demo from the student's saved plan. | A clearly identified scratch copy starts from the student's plan. |
| Explore | The instructor changes a passenger load or fuel burn order. | Results are recalculated in the demo; the saved plan is not changed. |
| Discard | The instructor discards the demo. | The original saved plan and its results remain unchanged. |

**Requirements:** [REQ-UI-048](../requirements/user_interface.md#req-ui-048-demo-start), [REQ-UI-049](../requirements/user_interface.md#req-ui-049-demo-isolation), [REQ-UI-050](../requirements/user_interface.md#req-ui-050-demo-discard). The offline-local increment covers Mass & Balance loads; fuel burn order and Performance inputs are not yet part of the demo. It involves no instructor identity or approval. Covered by `demo-what-if.feature` and the store isolation test ([#336](https://github.com/naturelle137/AeroDash/issues/336)).

These journeys do not establish operational validation. Pilots must verify
calculations against the aircraft's official documentation as described in the
[disclaimer](../../DISCLAIMER.md).

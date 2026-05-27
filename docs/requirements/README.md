# AeroDash Requirements Engineering

This folder contains the software requirements for the AeroDash project.
The requirements are structured by functional area (modules) to allow modular development and testing.

AeroDash follows a strict requirements engineering process to ensure safety and certification readiness (Project Level: Experimental / EAB, but following DO-178C principles where applicable).

## Requirement Syntax (EARS)

All requirements must be written using the **EARS** (Easy Approach to Requirements Syntax) patterns:

1. **Ubiquitous:** "The system shall..."
2. **Event-Driven:** "When <trigger> the system shall..."
3. **Unwanted Behavior:** "If <trigger>, then the system shall..."
4. **State-Driven:** "While <state>, the system shall..."
5. **Optional Feature:** "Where <feature is included>, the system shall..."
6. **Complex Logic:** "When <trigger>, while <state>, the system shall..."

## Requirement Attributes

Each requirement is defined in a Markdown table with the following columns:

| Attribute                | Description                                                                                                                   |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **Req-ID**               | Unique Identifier (e.g., `REQ-SYS-001`). Format: `REQ-<Module>-<Number>`. HTML anchors `<a name="...">` are used for linking. |
| **Requirement**          | The requirement text using EARS syntax.                                                                                       |
| **Rationale / Context**  | _Why_ this requirement exists. Links to parent requirements or user needs.                                                    |
| **Priority**             | **P1** (Critical/Safety), **P2** (Standard), **P3** (Nice to have / Polish).                                                  |
| **Mitigation Hazard ID** | Link to the specific Hazard ID in `docs/risk_management/safety_hazards.md` if this requirement acts as a control measure.     |
| **Status**               | `Draft`, `Review`, `Approved`, `Deferred`, `Implemented`, `Deprecated`.                                                       |
| **Design Reference**     | Keyword pointing to a specific design document or architectural component (defined at the bottom of the file).                |

### Status Lifecycle

A requirement progresses through a defined lifecycle. The status field is
**not free-form**; it must be one of the values below. Release-readiness
metrics, the hazard-mitigation gate, and the requirement coverage gate all
read this field to decide whether a REQ counts toward the current release.

| Status | Meaning | Counts toward release coverage? | Counts as an active hazard mitigator? |
| :----- | :------ | :------------------------------ | :------------------------------------ |
| `Draft` | Newly captured, wording not yet stable. | Yes (work in progress) | Yes |
| `Review` | Wording stable; awaiting acceptance. | Yes | Yes |
| `Approved` | Accepted; in scope for the current or imminent release cycle. | Yes — the gate expects an IMP chain to land before release. | Yes |
| `Deferred` | Accepted; **explicitly out of scope** for the current release cycle. The REQ is real and traceable but is **not** expected to ship in this version. | **No** — excluded from the "pending REQ" / "unverified P1 REQ" coverage metrics so it does not bloat release-readiness reads. | Yes — a planned (but not-yet-implemented) mitigation still preserves the safety chain. |
| `Implemented` | Implementation merged and verified; IMP chain is present in `trace/implementation/`. | Yes (already done) | Yes |
| `Deprecated` | Withdrawn or absorbed into another REQ. | No (excluded) | **No** — a Deprecated REQ does not mitigate any hazard (this is the bug class issue #267 closed). |

**`Deferred` is the truthful out-of-scope marker.** Marking an unimplemented
REQ `Approved` when it is actually waiting for a future milestone signals
release blockage where there is none — that is the audit gap closed by
issue #269 (release-audit PR-017, v0.3.0-alpha). When the REQ's milestone
becomes the active release cycle, flip the status back to `Approved`.

**Allowed transitions** (any unlisted transition requires explicit
justification in the PR description):

```text
Draft → Review → Approved → { Implemented | Deferred | Deprecated }
Deferred → Approved (when scheduled into the active milestone)
Approved → Deferred (when descoped from the active release cycle)
Implemented → Deprecated (when the REQ is withdrawn or absorbed)
```

## Module Identifiers

- **AC:** Aircraft Management
- **AP:** Airport Database
- **AD:** Detailed Aircraft Data
- **FE:** Fuel & Endurance
- **MB:** Mass & Balance
- **PF:** Performance
- **WX:** Weather & Meteorological Data
- **UI:** User Interface
- **UQ:** Usability & Quality
- **SYS:** General System Requirements
- **DOC:** Documentation & Export
- **SC:** Cloud Sync & Collaboration

## Traceability

### Hazard Mitigation Tags

Requirements that mitigate a safety hazard carry a `FROM` tag in their HTML comment:

```md
<!-- @REQ-MB-011@ (FROM: @H-006@) -->
```

This traces the requirement to the hazard it mitigates in [`safety_hazards.md`](../risk_management/safety_hazards.md).

### Full Traceability Chain

```text
Hazard (H-xxx) → Requirement (REQ-xxx) → User Journey (UJ-xxx) → E2e Test (E2E-xxx)
```

- **Safety:** Requirements linking to a Hazard ID must be traceable in the Safety Traceability Matrix.
- **Verification:** Each requirement implies a test case (Unit, Integration, or E2E). For P1 requirements with user-observable behaviour, at least one UJ must tag the requirement.

### Requirement Lifecycle

When consolidating or deleting a requirement (e.g., absorbing one REQ into another):

1. Update all UJ `FROM` tags that referenced the deleted REQ.
2. Update the [Notification Schema](../architecture/notification_schema.md) if the REQ defined a notification.
3. Verify the hazard traceability chain is preserved — the absorbing REQ must still trace to the original hazard.

---

## Example Table

| Req-ID                                  | Requirement                                                                 | Rationale / Context                       | Priority | Mitigation Hazard ID | Status   | Design Reference               |
| :-------------------------------------- | :-------------------------------------------------------------------------- | :---------------------------------------- | :------: | :------------------: | :------- | :----------------------------- |
| **<a name="REQ-EX-001"></a>REQ-EX-001** | When the engine start is detected, the system shall start the flight timer. | Automatic logging reduces pilot workload. |    P2    |         n/a          | Approved | [Flight Logger](#flightLogger) |

---

## Design References

- **<a name="flightLogger"></a>Flight Logger:** [docs/architecture/placeholder_example.md](../architecture/placeholder_example.md)

---

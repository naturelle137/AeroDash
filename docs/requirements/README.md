# Requirements Engineering - AeroDash

This document describes the requirements engineering of the AeroDash aviation performance tool.

## Status Definitions

| Status | Description |
|:---|:---|
| `Draft` | Requirement is under discussion, not yet approved |
| `Approved` | Requirement is approved and ready for implementation |
| `Rejected` | Requirement is rejected; AI may delete or reformulate it |
| `Implemented` | Code for this requirement exists |
| `Verified` | Tests for this requirement pass |

---

## Priority Definitions

| Level | Classification | Definition |
|:---|:---|:---|
| **P1** | **Critical/Safety** | Essential for flight-safe calculations. The app is unusable without this (e.g., M&B core, interpolation, unit conversion). |
| **P2** | **Operational/Efficiency** | Significant value and error reduction in the cockpit (e.g., METAR-fetch, passenger profiles, wind calculation). |
| **P3** | **Comfort/Future** | Facilitates documentation or administration (e.g., PDF-export, cloud-sync, favorites). |

---

## Sections

| Section | Description |
|:---|:---|
| **AC** | Aircraft Management |
| **AD** | Detailed Aircraft Data |
| **AF** | Airport Database |
| **DOC** | Documentation & Export |
| **FE** | Fuel & Endurance |
| **MB** | Mass & Balance |
| **PF** | Performance |
| **SC** | Cloud, Sync & Collaboration |
| **SYS** | System |
| **UI** | User Interface |
| **UQ** | Usability & Quality |
| **WX** | Weather & Meteorological Data |

---

## Section Format

```markdown
# AeroDash Software Requirements - <Section> (<Section>)

This document defines the <Section> behavior using the **EARS** (Easy Approach to Requirements Syntax) patterns.

### Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| **n/a** | n/a |

---

### Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
```

#### Requirement Format

```markdown
**<a name="REQ-<Section>-<Number>"><Req-ID></a>** | <Requirement> | <Rationale/context> | <Priority> | [<Mitigation Hazard ID>](../risk_management/safety_hazards.md#<Mitigation Hazard ID>) | <Status> |
```

#### Example Requirement Table

```markdown
| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-SYS-003">REQ-SYS-003</a>** | The system shall convert all units internally to SI units (kg, m, l, s) for the internal calculation logic. | Ensure mathematical consistency across mixed fleets. | P1 | [H-001](../risk_management/safety_hazards.md#H-001), [H-002](../risk_management/safety_hazards.md#H-002) | Approved |
```
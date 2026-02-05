# AeroDash Software Requirements - Performance (PF)

## Abbreviations & Definitions

| Term | Definition |
|:---|:---|
| **n/a** | n/a |

---

## Requirements

| Req-ID | Requirement | Rationale / Context | Priority | Mitigation Hazard ID | Status |
|:---|:---|:---|:---|:---|:---|
| **<a name="REQ-SYS-005">REQ-SYS-005</a>** | The system shall calculate the performance result using Bilinear Interpolation between the user-defined Performance Data Points matching the current flight conditions. |  | P1 | n/a | Draft |
| **<a name="REQ-SYS-006">REQ-SYS-006</a>** | If only a Single Data Point is defined (no dependency on conditions), the system shall return this constant value regardless of input conditions. |  | P1 | n/a | Draft |
| **<a name="REQ-SYS-007">REQ-SYS-007</a>** | The system shall apply Performance Correction Factors (multipliers) to the calculated performance result based on runway conditions (Surface, Slope, Contamination). | Enables calculation of real-world distances. | P1 | n/a | Draft |
| **<a name="REQ-SYS-005">REQ-SYS-005</a>** | The system should provide a Visual Graph Helper that allows users to upload an image of a performance chart and visually place data points to generate the Performance Data Points table. | Helps the user in digitalization of graphical performance charts. | P1 | n/a | Draft |
| **<a name="REQ-SYS-005">REQ-SYS-005</a>** | If no aircraft-specific performance data is available for a selected condition (e.g. "Grass"), the system shall apply a configurable Default Safety Factor in accordance with FSM 3/75. | Fallback logic: POH data > Standard Safety Factors. | P1 | n/a | Draft |

---

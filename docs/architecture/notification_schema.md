# AeroDash Architecture - Notification System Schema

<!-- @ARCH-001@ (FROM: @REQ-SYS-007@, @REQ-SYS-008@)-->
**Version:** 1.0
**Date:** 2026-02-19
**Status:** Approved

## 1. Overview

This document defines the interface contract for the **Generic Notification System** referenced by `REQ-SYS-007` and `REQ-SYS-008`.
It explicitly defines the data structure that Logic Modules must emit and the UI Layer must consume.

## 2. Notification Object Schema

Every notification within the AeroDash system shall map to the following JSON structure:

```json
{
  "id": "String (Required)",
  "severity": "Enum (Required)",
  "message": "String (Required)",
  "context": "String (Optional)",
  "persistent": "Boolean (Default: False)",
  "dismissible": "Boolean (Default: True)",
  "action": {
    "label": "String",
    "event": "String",
    "payload": "Object"
  }
}
```

### 2.1 Field Definitions

| Field | Type | Description |
 | :--- | :--- | :--- |
| **`id`** | `String` | Unique identifier (e.g., `WARN-PF-001`) used for deduplication and telemetry keying. |
| **`severity`** | `Enum` | Determines the urgency and interruptive behavior. See Section 3. |
| **`message`** | `String` | Localized, human-readable text to be displayed to the pilot. |
| **`context`** | `String` | Reference to the source input field or module (e.g., `Performance.RunwayAvailable`). Used by the UI to highlight specific fields. |
| **`persistent`** | `Boolean` | If `true`, the notification overrides user dismissal and remains active as long as the Logic State dictates. |
| **`dismissible`** | `Boolean` | If `false`, the user cannot manually close the notification (usually requires an Action to resolve). |
| **`action`** | `Object` | Optional executable command to resolve the issue (e.g., "Reload", "Reset Defaults"). |

## 3. Severity Enums

| Enum | Description | UI Behavior (Reference) |
 | :--- | :--- | :--- |
| **`INFO`** | Neutral system information. | Passive Toast / Banner. |
| **`WARNING`** | Operational alert, flight may proceed with caution. | Dismissible Alert / Field Indicator. |
| **`CRITICAL`** | Safety limit violation, flight should not proceed. | Blocking Modal / Haptic Feedback / Flashing. |

## 4. Implementation Rules

1. **Immutability:** Notification objects are immutable once emitted. Updates require emitting a new object with the same `id`.
2. **Deduplication:** The Notification Service must treat objects with identical `id` as updates to the existing state, not new stacking alerts.
3. **Persistence:** Logic Modules are responsible for emitting a "Clear" signal (or an empty/null object) when a Persistent notification state is resolved.

## 5. Notification Register

This register lists all defined notifications in the system to ensure uniqueness and traceability.

| ID | Title / Message | Severity | Source Requirement | Trigger / Condition |
 | :--- | :--- | :---: | :--- | :--- |
| `WARN-AC-001` | Registration Duplicate | `WARNING` | [REQ-AC-003](../requirements/aircraft_management.md#REQ-AC-003) | If an aircraft registration already exists. |
| `WARN-AC-002` | Draft Profile Active | `WARNING` | [REQ-AC-005](../requirements/aircraft_management.md#REQ-AC-005) | Calculations performed with a `Draft` profile. |
| `WARN-FE-001` | Insufficient Fuel | `WARNING` | [REQ-FE-003](../requirements/fuel_endurance.md#REQ-FE-003) | If the planned flight time (including reserves) exceeds the calculated maximum flight time (Endurance). |
| `CRIT-MB-001` | CG Out of Envelope | `CRITICAL` | [REQ-MB-004](../requirements/mass_balance.md#REQ-MB-004) | If the calculated CG is outside the defined aircraft envelope. |
| `CRIT-MB-002` | MTOM Exceeded | `CRITICAL` | [REQ-MB-005](../requirements/mass_balance.md#REQ-MB-005) | If the total mass exceeds MTOM. |
| `CRIT-MB-003` | CG Migration Limit Exceeded | `CRITICAL` | [REQ-MB-011](../requirements/mass_balance.md#REQ-MB-011) | If the CG migration vector exits the envelope at any point. |
| `WARN-PF-001` | Unverified Obstacle Data | `WARNING` | [REQ-PF-009](../requirements/performance.md#REQ-PF-009) | While a pilot-defined obstacle is active. |
| `CRIT-PF-001` | Crosswind Limit Exceeded | `CRITICAL` | [REQ-PF-014](../requirements/performance.md#REQ-PF-014) | If the calculated crosswind or tailwind component exceeds the POH demonstrated limits. |
| `CRIT-PF-002` | Runway Insufficient | `CRITICAL` | [REQ-PF-015](../requirements/performance.md#REQ-PF-015) | If the Operational Required Distance exceeds the published Available Distance (TORA/LDA). |
| `WARN-PF-002` | Safety Factor Low | `WARNING` | [REQ-PF-016](../requirements/performance.md#REQ-PF-016) | If the user-selected Operational Safety Factor is lower than the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43). |
| `INFO-SYS-001` | Update Available | `INFO` | [REQ-SYS-005](../requirements/system.md#REQ-SYS-005) | When a new software version is detected. |
| `WARN-UI-001` | Input Out of Range | `WARNING` | [REQ-UI-008](../requirements/user_interface.md#REQ-UI-008) | When numeric inputs are outside standard operational ranges. |
| `CRIT-UI-001` | Unverified Data Present | `CRITICAL` | [REQ-UI-015](../requirements/user_interface.md#REQ-UI-015) | When the user triggers the "Save" or "Export" action for a calculation containing parameters with `Unverified` status. |
| `CRIT-UI-002` | Safety Factor Low | `CRITICAL` | [REQ-UI-017](../requirements/user_interface.md#REQ-UI-017) | When the user triggers the "Save" or "Export" action for a calculation containing an Operational Safety Factor below the greater of the POH-mandated factor and the regulatory baseline. |
| `WARN-WX-001` | Wind Limit Exceeded | `WARNING` | [REQ-WX-009](../requirements/weather_meterological_data.md#REQ-WX-009) | If any wind or gust component exceeds the limits of the aircraft. |

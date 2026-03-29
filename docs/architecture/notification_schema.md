# AeroDash Architecture - Notification System Schema

<!-- @DES-ARCH-001@ (FROM: @REQ-SYS-007@, @REQ-SYS-008@)-->

**Version:** 1.0
**Date:** 2026-02-19
**Status:** Approved

## 1. Overview

This document defines the interface contract for the **Generic Notification System**.
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

| Field             | Type      | Description                                                                                                                       |
| :---------------- | :-------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| **`id`**          | `String`  | Unique identifier (e.g., `WARN-PF-001`) used for deduplication and telemetry keying.                                              |
| **`severity`**    | `Enum`    | Determines the urgency and interruptive behavior. See Section 3.                                                                  |
| **`message`**     | `String`  | Localized, human-readable text to be displayed to the pilot.                                                                      |
| **`context`**     | `String`  | Reference to the source input field or module (e.g., `Performance.RunwayAvailable`). Used by the UI to highlight specific fields. |
| **`persistent`**  | `Boolean` | If `true`, the notification overrides user dismissal and remains active as long as the Logic State dictates.                      |
| **`dismissible`** | `Boolean` | If `false`, the user cannot manually close the notification (usually requires an Action to resolve).                              |
| **`action`**      | `Object`  | Optional executable command to resolve the issue (e.g., "Reload", "Reset Defaults").                                              |

## 3. Severity Enums

| Enum           | Description                                                     | UI Behavior (Reference)                      |
| :------------- | :-------------------------------------------------------------- | :------------------------------------------- |
| **`INFO`**     | Neutral system information.                                     | Passive Toast / Banner.                      |
| **`WARNING`**  | Operational alert, flight may proceed with caution.             | Dismissible Alert / Field Indicator.         |
| **`ERROR`**    | Validation failed; user must fix input.                         | Inline Error / Red Outline.                  |
| **`CRITICAL`** | Safety limit violation, flight should not proceed.              | Blocking Modal / Haptic Feedback / Flashing. |

## 4. Implementation Rules

1. **Immutability:** Notification objects are immutable once emitted. Updates require emitting a new object with the same `id`.
2. **Deduplication:** The Notification Service must treat objects with identical `id` as updates to the existing state, not new stacking alerts.
3. **Persistence:** Logic Modules are responsible for emitting a "Clear" signal (or an empty/null object) when a Persistent notification state is resolved.

## 5. Notification Register

This register lists all defined notifications in the system to ensure uniqueness and traceability.

| ID             | Title / Message                    |  Severity  | Source Requirement                                                     | Trigger / Condition                                                                                                                                                                      |
| :------------- | :--------------------------------- | :--------: | :--------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WARN-AC-001`  | Registration Duplicate             | `WARNING`  | [REQ-AC-003](../requirements/aircraft_management.md#REQ-AC-003)        | If an aircraft registration already exists.                                                                                                                                              |
| `WARN-AC-002`  | Draft Profile Active               | `WARNING`  | [REQ-AC-005](../requirements/aircraft_management.md#REQ-AC-005)        | Calculations performed with a `Draft` profile.                                                                                                                                           |
| `WARN-FE-001`  | Insufficient Fuel                  | `WARNING`  | [REQ-FE-003](../requirements/fuel_endurance.md#REQ-FE-003)             | If the planned flight time (including reserves) exceeds the calculated maximum flight time (Endurance).                                                                                  |
| `CRIT-MB-001`  | CG Out of Envelope                 | `CRITICAL` | [REQ-MB-004](../requirements/mass_balance.md#REQ-MB-004)               | If the calculated CG is outside the defined aircraft envelope.                                                                                                                           |
| `CRIT-MB-002`  | MTOM Exceeded                      | `CRITICAL` | [REQ-MB-005](../requirements/mass_balance.md#REQ-MB-005)               | If the total mass exceeds MTOM.                                                                                                                                                          |
| `CRIT-MB-003`  | CG Migration Limit Exceeded        | `CRITICAL` | [REQ-MB-011](../requirements/mass_balance.md#REQ-MB-011)               | If the CG migration vector exits the envelope at any point.                                                                                                                              |
| `CRIT-MB-004`  | MZFM Exceeded                      | `CRITICAL` | [REQ-MB-009](../requirements/mass_balance.md#REQ-MB-009)               | If the Zero Fuel Mass exceeds the aircraft's Maximum Zero Fuel Mass.                                                                                                                     |
| `WARN-PF-001`  | Unverified Obstacle Data           | `WARNING`  | [REQ-PF-009](../requirements/performance.md#REQ-PF-009)                | While a pilot-defined obstacle is active.                                                                                                                                                |
| `WARN-WX-001`  | Wind Limit Exceeded (Demonstrated) | `WARNING`  | [REQ-WX-009](../requirements/weather_meterological_data.md#REQ-WX-009) | If any wind or gust component exceeds a `Demonstrated` limit of the aircraft.                                                                                                            |
| `CRIT-WX-001`  | Wind Limit Exceeded                | `CRITICAL` | [REQ-WX-009](../requirements/weather_meterological_data.md#REQ-WX-009) | If any wind or gust component exceeds a hard `Limit` of the aircraft.                                                                                                                    |
| `CRIT-PF-002`  | Runway Insufficient                | `CRITICAL` | [REQ-PF-015](../requirements/performance.md#REQ-PF-015)                | If the Operational Required Distance exceeds the published Available Distance (TORA/LDA).                                                                                                |
| `WARN-PF-002`  | Safety Factor Low                  | `WARNING`  | [REQ-PF-016](../requirements/performance.md#REQ-PF-016)                | If the user-selected Operational Safety Factor is lower than the greater of the POH-mandated factor and the regulatory baseline (Takeoff: 1.25, Landing: 1.43).                          |
| `INFO-SYS-001` | Update Available                   |   `INFO`   | [REQ-SYS-005](../requirements/system.md#REQ-SYS-005)                   | When a new software version is detected.                                                                                                                                                 |
| `ERR-SYS-001`  | Invalid Input: {field} ({code})    |  `ERROR`   | [REQ-SYS-012](../requirements/system.md#REQ-SYS-012)                   | When module input validation (Zod schema) fails before core logic (REQ-SYS-011). Dynamic: field = field path, code = validation code.                                                    |
| `WARN-UI-001`  | Input Out of Range                 | `WARNING`  | [REQ-UI-008](../requirements/user_interface.md#REQ-UI-008)             | When numeric inputs are outside standard operational ranges.                                                                                                                             |
| `CRIT-UI-001`  | Unverified Data Present            | `CRITICAL` | [REQ-UI-015](../requirements/user_interface.md#REQ-UI-015)             | When the user triggers the "Save" or "Export" action for a calculation containing parameters with `Unverified` status.                                                                   |
| `CRIT-UI-002`  | Safety Factor Low                  | `CRITICAL` | [REQ-UI-017](../requirements/user_interface.md#REQ-UI-017)             | When the user triggers the "Save" or "Export" action for a calculation containing an Operational Safety Factor below the greater of the POH-mandated factor and the regulatory baseline. |
| `INFO-API-003` | Share code could not be created.   |   `INFO`   | [API](../api/API.md)                                                   | When share code generation API request fails while online (e.g., 500).                                                                                                                   |
| `INFO-API-004` | Share code expired or invalid.     |   `INFO`   | [API](../api/API.md)                                                   | When retrieving a profile using a share code fails while online (e.g., 404).                                                                                                             |

## 6. Notification Payload Definitions

This section defines the complete JSON payload for each notification. These payloads are the authoritative design reference that Logic Modules must emit.

### 6.1 Aircraft Management (AC)

#### WARN-AC-001 — Registration Duplicate

```json
{
  "id": "WARN-AC-001",
  "severity": "WARNING",
  "message": "Registration Duplicate",
  "context": "Aircraft.Registration"
}
```

#### WARN-AC-002 — Draft Profile Active

```json
{
  "id": "WARN-AC-002",
  "severity": "WARNING",
  "message": "Draft Profile Active",
  "context": "Aircraft.Status",
  "persistent": true
}
```

### 6.2 Fuel & Endurance (FE)

#### WARN-FE-001 — Insufficient Fuel

```json
{
  "id": "WARN-FE-001",
  "severity": "WARNING",
  "message": "Insufficient Fuel",
  "context": "Fuel.Endurance"
}
```

### 6.3 Mass & Balance (MB)

#### CRIT-MB-001 — CG Out of Envelope

```json
{
  "id": "CRIT-MB-001",
  "severity": "CRITICAL",
  "message": "CG Out of Envelope",
  "context": "MassBalance.CG"
}
```

#### CRIT-MB-002 — MTOM Exceeded

```json
{
  "id": "CRIT-MB-002",
  "severity": "CRITICAL",
  "message": "MTOM Exceeded",
  "context": "MassBalance.Mass"
}
```

#### CRIT-MB-003 — CG Migration Limit Exceeded

```json
{
  "id": "CRIT-MB-003",
  "severity": "CRITICAL",
  "message": "CG Migration Limit Exceeded",
  "context": "MassBalance.CGMigration"
}
```

#### CRIT-MB-004 — MZFM Exceeded

```json
{
  "id": "CRIT-MB-004",
  "severity": "CRITICAL",
  "message": "MZFM Exceeded",
  "context": "MassBalance.ZeroFuelMass"
}
```

### 6.4 Performance (PF)

#### WARN-PF-001 — Unverified Obstacle Data

```json
{
  "id": "WARN-PF-001",
  "severity": "WARNING",
  "message": "Unverified Obstacle Data",
  "context": "Performance.Obstacles",
  "persistent": true
}
```

#### CRIT-PF-002 — Runway Insufficient

```json
{
  "id": "CRIT-PF-002",
  "severity": "CRITICAL",
  "message": "Runway Insufficient",
  "context": "Performance.RunwayLength"
}
```

#### WARN-PF-002 — Safety Factor Low

```json
{
  "id": "WARN-PF-002",
  "severity": "WARNING",
  "message": "Safety Factor Low",
  "context": "Performance.SafetyFactor"
}
```

### 6.5 Weather (WX)

#### WARN-WX-001 — Wind Limit Exceeded (Demonstrated)

```json
{
  "id": "WARN-WX-001",
  "severity": "WARNING",
  "message": "Wind Limit Exceeded (Demonstrated)",
  "context": "Weather.Wind"
}
```

#### CRIT-WX-001 — Wind Limit Exceeded

```json
{
  "id": "CRIT-WX-001",
  "severity": "CRITICAL",
  "message": "Wind Limit Exceeded",
  "context": "Weather.Wind"
}
```

### 6.6 System (SYS)

#### INFO-SYS-001 — Update Available

```json
{
  "id": "INFO-SYS-001",
  "severity": "INFO",
  "message": "Update Available",
  "context": "System.Version",
  "action": {
    "label": "Reload",
    "event": "sys.reload",
    "payload": {
      "targetVersion": "<semver_string>",
      "force": false
    }
  }
}
```

#### ERR-SYS-001 — Invalid Input

```json
{
  "id": "ERR-SYS-001",
  "severity": "ERROR",
  "message": "Invalid Input: {field} ({code})",
  "context": "{Module}.Validation"
}
```

`{field}` is replaced with the invalid field path, `{code}` with the Zod validation code, and `{Module}` with the originating module name (e.g., `MassBalance`).

### 6.7 User Interface (UI)

#### WARN-UI-001 — Input Out of Range

```json
{
  "id": "WARN-UI-001",
  "severity": "WARNING",
  "message": "Input Out of Range",
  "context": "UI.Input"
}
```

#### CRIT-UI-001 — Unverified Data Present

```json
{
  "id": "CRIT-UI-001",
  "severity": "CRITICAL",
  "message": "Unverified Data Present",
  "context": "UI.Validation",
  "dismissible": false,
  "action": {
    "label": "Review",
    "event": "ui.review_unverified",
    "payload": {
      "parameters": ["<list_of_field_paths>"],
      "canForceSave": true
    }
  }
}
```

`parameters` is dynamically populated with all field paths that have `Unverified` status.

#### CRIT-UI-002 — Safety Factor Low

```json
{
  "id": "CRIT-UI-002",
  "severity": "CRITICAL",
  "message": "Safety Factor Low",
  "context": "UI.Validation",
  "dismissible": false,
  "action": {
    "label": "Confirm",
    "event": "ui.confirm_safety_factor",
    "payload": {
      "currentFactor": "<number>",
      "requiredFactor": "<number>",
      "context": "<Takeoff|Landing>"
    }
  }
}
```

`currentFactor` and `requiredFactor` are dynamically populated with the actual factor values; `context` indicates the flight phase.

### 6.8 API

#### INFO-API-003 — Share Code Creation Failed

```json
{
  "id": "INFO-API-003",
  "severity": "INFO",
  "message": "Share code could not be created."
}
```

#### INFO-API-004 — Share Code Expired or Invalid

```json
{
  "id": "INFO-API-004",
  "severity": "INFO",
  "message": "Share code expired or invalid."
}

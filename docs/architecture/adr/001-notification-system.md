# 001-notification-system: Notification System Standardization

Date: 2026-02-19

## Status

Accepted

## Context

The AeroDash project had inconsistent notification handling across its various modules (`Aircraft Management`, `Mass & Balance`, `Performance`, `Weather`, `User Interface`). Notifications were defined in an ad-hoc manner within requirement documents, using varying formats, mixed casing (PascalCase vs camelCase), and lacking a unified identification system.

This inconsistency led to:
-   Difficulty in aggregating notifications for the UI.
-   Potential ID collisions or lack of traceability.
-   Inconsistent user experience (e.g., disparate severity levels).
-   Challenges in validating the "Safety Gate" requirements where critical notifications must block actions.

## Considered Options

*   Not documented in original ADR

## Decision

We have decided to **standardize the Notification System** by enforcing a strict schema and a centralized registry.

KEY DECISIONS:

1.  **Uniform Data Model:** All notifications must adhere to a strict JSON schema defined in `docs/architecture/notification_schema.md`.
    -   **Keys:** `id`, `severity`, `message`, `context`, `persistent`, `dismissible`, `action`.
    -   **Casing:** All keys must be `camelCase`.
    -   **Severity:** strictly `INFO`, `WARNING`, `CRITICAL`.

2.  **Standardized ID Format:** All notifications must have a unique ID following the pattern:
    -   `[SEVERITY]-[MODULE]-[NUMBER]`
    -   Example: `WARN-AC-001` (Warning, Aircraft Module, 001)

3.  **Centralized Registry:** A "Notification Register" is maintained in the `notification_schema.md` file.
    -   This register acts as the single source of truth for all defined notifications.
    -   It maps IDs to their Source Requirement and Trigger Condition.

4.  **Explicit Context:** Every notification must provide a `context` field pointing to the specific data element or logic block (e.g., `MassBalance.CG`) to enable UI highlighting and "Jump-to-issue" functionality.

5.  **Requirement Refactoring:** All existing requirements in `docs/requirements/*.md` have been refactored to replace ad-hoc notification descriptions with the standardized JSON object.

## Consequences

### Positive
-   **Consistency:** The UI can now blindly consume notifications from any module using a single interface.
-   **Traceability:** Every error message in the logs can be instantly traced back to a specific requirement via its ID.
-   **Safety:** The `CRITICAL` severity is rigorously defined, allowing the system to reliably block "Save" or "Export" actions when safety constraints are violated.
-   **Maintainability:** Future developers have a clear template for adding new notifications.

### Negative
-   **Verbosity:** Requirement documents are slightly more verbose due to the full JSON objects.
-   **Maintenance:** The Central Register in `notification_schema.md` must be kept in sync with the individual requirement files. A divergence check might be needed in CI/CD.

## Compliance

All modules must emit notifications strictly matching the schema. The UI layer must implement the rendering logic defined for each Severity level.

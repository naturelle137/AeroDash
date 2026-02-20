# Architecture Decision Records (ADRs)

This directory contains the Architectural Decision Records for the AeroDash project. An ADR is a short text file that captures an important architectural decision made along with its context and consequences.

We embrace a **Documentation as Code** culture. ADRs ensure all major decisions—both for the product and the development process—are transparent, traceable, and persistent.

## Numbering Scheme

We use a specific numbering and naming convention to categorize ADRs:

*   **`0xx-[Name]` (e.g., `001-notification-system`)**: **Product Architecture**. These ADRs govern the core logic, features, data schemas, functional architecture, and anything directly affecting the runtime application.
*   **`3xx-DEV-[Name]` (e.g., `300-DEV-documentation-as-code`)**: **Development Architecture**. These ADRs govern the developer experience (DX), tooling, CI/CD processes, branching strategies, code formatting rules, and everything related to *how* we build the software.

## ADR Lifecycle

1.  **Drafting**: A contributor creates a new ADR file starting with the next available number in the appropriate series (0xx or 3xx), using the [`000-template.md`](000-template.md) as a blueprint. The status is `Proposed`.
2.  **Review**: The ADR is submitted via a Pull Request and reviewed by the team and lead engineers.
3.  **Acceptance**: If approved, the status is changed to `Accepted` and the PR is merged.
4.  **Superseding**: If an older decision is later reversed or replaced, its status is changed to `Deprecated` or `Superseded` (with a link to the new ADR), but the file is **never deleted**. This preserves the history of decisions.

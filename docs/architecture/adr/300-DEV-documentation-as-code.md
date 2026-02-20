# 300-DEV-documentation-as-code.md: Documentation as Code

## Status

Accepted

## Context

In complex, safety-critical projects like AeroDash, the "Why" behind architectural decisions is often lost over time. This leads to architectural drift, where original safety guarantees or structural choices are accidentally bypassed. Furthermore, new contributors lack a historical record to learn from, resulting in a steeper onboarding curve and repeated discussions. We need a way to ensure all architectural decisions—both for the product and the development process—are transparent, traceable, and persistent.

## Considered Options

*   **Option 1: Rely on PR descriptions and issue comments.** (Rejected: Hard to search, lacks a unified structure, and context is easily lost over time.)
*   **Option 2: Use external wiki software (e.g., Confluence, Notion).** (Rejected: Separates documentation from the code it describes, making it harder to keep in sync and requiring context switching.)
*   **Option 3: Architectural Decision Records (ADRs) stored in the repository.** (Accepted: Keeps decisions version-controlled, searchable, and closely tied to the exact state of the codebase.)

## Decision

We will implement a formal Architectural Decision Record (ADR) system within the repository, stored in `docs/architecture/adr/`.

1.  **Standardized Structure**: All ADRs must use the defined `000-template.md` ensuring consistent capture of Context, Decision, Consequences, and Compliance.
2.  **Decision Series**: We utilize a dual numbering scheme: `0xx-` for Product/Functional architecture and `3xx-DEV-` for Development Experience/Process architecture.
3.  **Workflow Integration**: The creation or updating of ADRs will be governed by Pull Requests and explicitly checked during the PR review process via our PULL_REQUEST_TEMPLATE.

## Consequences

### Positive

*   **Traceability & Auditability:** We have a persistent history of *why* algorithms, safeguards, or workflows were implemented in a specific way, crucial for a flight-preparation tool.
*   **Onboarding:** Faster onboarding for new engineers who can read through past decisions to understand the repository's current state and rules.
*   **Decoupled Discussion:** The "Contributor Guide" and other documentation can link to ADRs for the reasoning ("Why") without duplicating text, keeping instructional guides clean.

### Negative

*   **Overhead:** Requires discipline from developers to write ADRs before or during major changes.
*   **Maintenance:** PR templates and review processes must actively enforce the creation of ADRs so the system doesn't fall into disuse.

## Compliance

n/a

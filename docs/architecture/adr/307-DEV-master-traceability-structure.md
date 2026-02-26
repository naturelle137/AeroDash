# 307-DEV: Master Traceability Structure

* **Status:** Accepted
* **Date:** 2026-02-22

## Context

AeroDash is a P1 safety-critical general aviation tool. A mathematical error in weight calculation or runway performance could result in a catastrophic event (S1). Therefore, untraceable code or "undocumented features" represent an unacceptable liability.

To ensure safety and prepare for rigorous evaluation (drawing inspiration from DO-178C principles), we require absolute certainty that:

1. Every identified Hazard is mitigated by a formal Requirement.
2. Every Requirement is anchored in the System Architecture or a User Journey.
3. Every User Journey or Feature is explicitly programmed into the codebase.
4. Every Code Implementation is rigorously verified by Test Cases.

We lacked a documented strategy bridging these artifacts together in our Docs-as-Code ecosystem, leading to the risk of "Orphaned Implementations" (code without requirements) or "Pending Implementations" (requirements with no code).

## Considered Options

1. **Implicit Traceability**: Rely on developer discipline and Jira tickets to link PRs to Requirements manually. (Rejected: Human error inevitably breaks the chain over time).
2. **Post-Development Tracing**: Write tests and code first, then document what was built. (Rejected: Leads to requirement drift and missed safety hazards).
3. **Formal Automated Traceability Chain**: Define a strict hierarchical path that must be followed and verified programmatically.

## Decision

We will implement a formal **Master Traceability Matrix (MTM)** structure. The required traceability hierarchy for all feature development in AeroDash is:

> Hazards (H-xxx) -> Requirements (REQ-xxx) -> Architecture (ADR-xxx) -> User Journeys (UJ-xxx) -> Code (IMP-xxx) -> Test Cases (E2E-xxx)

* **Hazards** (`H-001`): The root of all safety-critical logic. Every Hazard must link to at least one mitigating Requirement.
* **Requirements** (`REQ-SYS-001`): Written in EARS syntax, establishing *what* the system must do to operate safely.
* **Architecture** (`ADR-300-DEV` or *System Module*): Defines *how* the system structurally supports the Requirement.
* **User Journeys** (`UJ-B-001`): Defines the behavioral flow fulfilling the Requirement. E2E tests are derived directly from these Journeys. Coverage rules are documented in [`docs/journeys/README.md`](../../journeys/README.md).
* **Code implementation** (`IMP-SYS-001`): Defined by GitHub Pull Requests tying back to the required Issue.
* **Test Cases** (`E2E-xxx`): Explicitly named Unit, Integration, and E2E tests verifying the mathematical boundaries and logic of the Requirement.

To enforce this, we will move toward an automated Docs-as-Code traceability engine (see ADR 308-DEV) to automatically parse these links and fail CI builds if the chain is broken.

## Consequences

### Positive

* **Safety Assurance**: We can mathematically prove that every hazard identified in `safety_hazards.md` has been mitigated and verified by a test case.
* **Scope Management**: Prevents "Requirement Creep" since code without a formal `REQ-` trace will be flagged and rejected by the tooling.
* **Documentation as Code**: Integrates seamlessly with our markdown-based documentation structure.

### Negative

* **Development Overhead**: Introduces strict rigidity. Developers cannot simply write "cool new features"; every PR must be rigorously tagged and traced back to a defined Requirement and Journey.

## Compliance

This decision aligns closely with the principles of safety-critical aviation software development (e.g., DO-178C traceability requirements) by ensuring a bi-directional trace from system-level hazards down to source code test verification.

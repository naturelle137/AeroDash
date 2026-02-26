# User Journeys (UJs) for End-to-End Testing

This folder contains the primary User Journeys (UJs) used to verify the AeroDash system's operational integrity. Each UJ maps directly to one or more requirements and indirectly verifies the hazard mitigations defined in the Safety Traceability Matrix.

## Coverage Rules

The following rules govern what **must** be covered at the UJ (e2e) level:

| Rule | What | Why |
| :--- | :--- | :--- |
| **P1 REQ Coverage** | All reachable P1 REQs with user-observable behaviour shall be tagged in ≥1 UJ | Safety-critical paths must be verified end-to-end |
| **Hazard Indirect Coverage** | Every hazard (H-xxx) shall have ≥1 mitigating REQ tagged in a UJ | Ensures the H→REQ→UJ→E2E chain is complete |
| **Algorithm Exception** | Internal algorithm REQs (e.g., PF-002, MB-007, MB-012) may be unit-test-only | The algorithm is not user-observable; its outputs are |
| **UQ Exception** | Cross-cutting quality attributes (UQ-001–004) use QA test suites, not individual UJs | Too fragile and broad as individual e2e assertions |

## Traceability Tag Format

Each journey carries a `FROM` tag tracing it to the requirements it demonstrates:

```md
<!-- @UJ-B-001@ (FROM: @REQ-MB-002@, @REQ-MB-008@) -->
```

- The tag goes on the line **immediately before** the `##` heading.
- REQs in the `FROM` tag must be **demonstrably observable** in the journey's phases — do not tag internal algorithm REQs.
- The full safety traceability chain is: `Hazard (H-xxx) → Requirement (REQ-xxx) → User Journey (UJ-xxx) → E2e Test (E2E-xxx)`.

## Journey Design Principles

- **Prefer extending existing UJs** over creating new ones — each UJ becomes an e2e test consuming CI/CD resources.
- **Include at least one happy path** (no warnings/criticals) per functional area as a regression baseline.
- **Stress/edge-case journeys** are valuable but expensive — only add them for safety-critical paths.
- **Use realistic aircraft** (Tecnam P2008JC, DA40, KL107B) and real ICAO codes where possible.

## Journey Index

| ID Prefix | Phase / Domain | File |
| :--- | :--- | :--- |
| **UJ-A-xxx** | **Phase A: Fleet Management** | [01_fleet_management.md](./01_fleet_management.md) |
| **UJ-B-xxx** | **Phase B: Flight Preparation** | [02_flight_preparation.md](./02_flight_preparation.md) |
| **UJ-C-xxx** | **Phase C: Performance & Safety** | [03_performance_safety.md](./03_performance_safety.md) |
| **UJ-D-xxx** | **Phase D: System & Usability** | [04_system_usability.md](./04_system_usability.md) |
| **UJ-E-xxx** | **Phase E: Weather & Environment** | [05_weather_environment.md](./05_weather_environment.md) |
| **UJ-F-xxx** | **Phase F: Fuel & Endurance** | [06_fuel_endurance.md](./06_fuel_endurance.md) |
| **UJ-G-xxx** | **Phase G: Onboarding & Sync** | [07_onboarding_sync.md](./07_onboarding_sync.md) |
| **UJ-STRESS-xxx** | **Stress Tests** | [08_stress_tests.md](./08_stress_tests.md) |

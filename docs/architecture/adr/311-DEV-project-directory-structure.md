# 311: Module structure and core isolation

Keep pure calculation/schema/domain code in `frontend/src/core/` (P1), feature code in `modules/` (P2) and application composition in shell directories (P3). Co-locate unit tests; keep integration and browser suites in their configured test directories. [ADR-314](314-DEV-dependency-isolation.md) defines import boundaries; [ARCHITECTURE.md](../../../ARCHITECTURE.md) describes data flow. Adding a directory must preserve those boundaries and ESLint enforcement.

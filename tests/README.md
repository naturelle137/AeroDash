# AeroDash Testing Directories

> **⚠️ SINGLE SOURCE OF TRUTH:**
> For the comprehensive testing strategy, mocking guidelines, and coverage requirements, always refer to the official document: [`docs/testing/TESTING.md`](../docs/testing/TESTING.md).

## Quick Reference

### Directory Locator

- **`src/**/**tests**/`\*\*: Component/Composable Unit & Component Integration tests.
- **`src/**/`(Co-located)**:`core/`, `stores/`, `plugins/`, `router/` Unit tests.
- **`tests/integration/`**: System-level Integration tests.
- **`tests/e2e/`**: Playwright End-to-End user journeys.

### File Naming Conventions

- `*.spec.ts` → **Unit Test** (Measured in coverage)
- `*.int.spec.ts` → **Integration Test** (Not measured in unit coverage)
- `*.e2e.spec.ts` → **End-to-End Test** (Ignored by Vitest, picked up by Playwright)

### CLI Commands

- `npm run test:unit` → Runs all `*.spec.ts` unit tests.
- `npm run coverage:unit` → Runs unit tests and generates the coverage report.
- `npm run test:integration` → Runs all `*.int.spec.ts` and `tests/integration/` tests.
- `npm run test:e2e` → Runs Playwright End-to-End tests.

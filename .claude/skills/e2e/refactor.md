# E2E: refactor

Read [implementation rules](implementation-rules.md) and AGENTS.md.

Read the feature and all matching steps. Preserve acceptance intent, functional tags and real assertions. Consolidate duplicated steps only when their semantics match. Keep helpers pure and state isolated between tests.

Run `pnpm test:e2e --project=chromium` for the affected scope and record actual results and exclusions. Update the Unreleased changelog per CONTRIBUTING §6 when part of a PR.

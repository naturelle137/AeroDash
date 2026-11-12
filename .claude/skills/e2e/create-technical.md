# E2E: create technical

Read [implementation rules](implementation-rules.md) and AGENTS.md.

Define the system behavior being checked (for example PWA offline loading or navigation). Add a focused feature and matching steps. Keep it separate from numerical/domain acceptance; use request or console checks only when they prove the technical behavior.

Run `pnpm test:e2e --project=chromium` for the affected scope and record actual results and exclusions. Update the Unreleased changelog per CONTRIBUTING §6 when part of a PR.

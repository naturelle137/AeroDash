# E2E: create business

Read [implementation rules](implementation-rules.md) and AGENTS.md.

Read the relevant journey and current UI. Add a focused Given/When/Then scenario with matching real-browser steps. Cover the success path and relevant warning/recovery boundary. Keep test setup deterministic; do not substitute mocked business behavior for the app.

Run `pnpm test:e2e --project=chromium` for the affected scope and record actual results and exclusions. Update the Unreleased changelog per CONTRIBUTING §6 when part of a PR.

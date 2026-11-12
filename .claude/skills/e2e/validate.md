# E2E: validate

Read [implementation rules](implementation-rules.md) and AGENTS.md.

Read the feature and matching steps without changing them. Check that steps exist, Then assertions prove the intended behavior, selectors are accessible, state is isolated and waits are event-driven. Report concrete defects with locations; distinguish excluded scenarios from executed results.

Run `pnpm test:e2e --project=chromium` for the affected scope and record actual results and exclusions. Update the Unreleased changelog per CONTRIBUTING §6 when part of a PR.

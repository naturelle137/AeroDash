# Evidence: #529 single lookup-tank arrival CG (job 1301)

Pre-merge evidence for the u = 0 pilot PR. Synthetic software checks only.

- `source.txt`: source commit `9ec6756579f9bebbfc539b73253a134da8276418` and tree; clean worktree; SHA-256 of the dist manifest.
- `dist-manifest.sha256`: SHA-256 of every file in `frontend/dist` built by `pnpm build` at that commit. The offline suite served exactly this build via `vite preview`.
- `logs/`: install, lint, unit, integration, build, P1 coverage, Chromium E2E and offline-production logs (`exits.txt`). `offline-wip.log` is a superseded intermediate run.
- `traces/`: Playwright traces (`trace: on`) of `fuel-endurance.spec.ts` and `fuel-print.spec.ts` at 390/1440. These include service-worker control, `fromServiceWorker()` offline reloads and every assertion.
- `screenshots/`: all attachments, prefixed with viewport width.

This is not merged-runtime acceptance. Rerun `pnpm --filter frontend test:offline` at the merged commit.

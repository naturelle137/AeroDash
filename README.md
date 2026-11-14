# Pre-merge evidence for #530 (PR #532)

Source: branch `agent/1314-530-reconcile-lookup-fuel-m-b-total-mome`, commit
f666852 (see `logs/source-final.txt` for the full commit and tree). This is
synthetic software evidence only: no aircraft or POH data, no operational
validation, and no merged-runtime acceptance. Merged cached-offline acceptance
at 390/1440 px remains required before #530 closes.

## Gate (web-dev toolbox)

| Step | Result | Log |
| --- | --- | --- |
| frozen install, lint, unit, integration, build, P1 coverage | exit 0 at 52ffc12 (test-only changes since) | `logs/{install,lint,unit,integration,build,p1}.log` |
| Chromium E2E (`CI=1`, headless) | 97 passed | `logs/e2e.log` |
| Production cached-SW offline, 390 + 1440 | 24 passed, 0 skipped at f666852 | `logs/offline.log` |

Superseded runs are kept in `logs/superseded/` and the headed-attempt logs:
- E2E attempts 1–2 were headed (no `CI`); Chromium timed out on every launch. Nothing executed.
- Offline at 52ffc12: 4 failed. The #529 specs still expected q60 to give an M&B result; they were corrected in f666852.
- Offline f666852 run 1: `neutral-exact-limit` at 390 hit a field timeout under load. That spec has no lookup tank. It passed alone (`logs/offline-neutral-rerun.log`) and in run 2.

The dist manifest has 39 files and is identical before and after the run
(`logs/dist-manifest-before.sha256` / `-after-run2.sha256`). `dist/sw.js` has
SHA-256 bbf6f812cabf36a2ed1e24683ffdd6f6924127376f24caa158a41eff21015cb2.

## Traces and screenshots

`traces/` contains the run-2 trace archives for lookup-fuel-mb, fuel-endurance,
fuel-print and mb-print at both widths. `screenshots/` contains every PNG
attached in run 2. Key `lookup-fuel-mb` images:
- q50 arm critical
- q30 arm chart
- q30 print
- blocked states (`*-error.png` are error-centred viewport captures)
- q50 moment critical
- USG/lb·in moment
- fuel print section
- offline print

`artifact-manifest.sha256` hashes every file.

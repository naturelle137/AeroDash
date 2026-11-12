# M&B QA204 baseline evidence — 2026-11-12

Candidate/base: `abd33acdbbe591590652548c472ccaaebfdf7d0a` (develop).
Historical baseline, superseded by [QA293](mb-qa-293.md); the following observations are tied to the candidate above: PR470 and PR471
were open drafts, with independent review/integration owned by HQ275/HQ282.
[Develop CI](https://github.com/naturelle137/AeroDash/actions/runs/43107710431)
is existing hosted evidence; the diagnostic failures below were run locally.
The tested commit is GitHub verified. Documentation commits do not change it.

| Claim / flow | Observed result | Acceptance |
| --- | --- | --- |
| Lint / unit / production build | Pass; 97 files, 1702 unit tests | Baseline only |
| Enabled Chromium suite | Four pass: fleet-delete/browser-back, empty-fleet CTA, catalogue isolation, offline shell/navigation | Preserve successes |
| E2E inventory | 21 declared scenarios; 4 enabled, 17 excluded by script `--grep-invert @wip` | Excluded is not passed |
| Happy path B-001 | Forced diagnostic: missing Select aircraft at background | Not reached math |
| Overweight B-004/005 | Both fail at same empty-fleet background | Not reached MTOM/MZFM |
| Burn polygon B-006/007 | Both fail at same background | Not reached CG migration |
| Burnout B-002/003 | Both fail at same background | Not reached CG migration |
| Wizard A-002/003/004 | Forced diagnostic: duplicate main strict-mode failure on Fleet | Three failures |
| Main landmark, real UI | Two on Fleet and Wizard at 1440 and 390 px | Defect reproduced |
| Current wizard / save | Six steps; saving opens action chooser while URL stays /fleet/new | Old five-step helper is stale |
| Back to Fleet / persistence | Choosing Back to Fleet returns correctly; saved D-EBPN survives reload at both widths | Works |
| Draft selection | Aircraft appears with Draft label; warning initially locks M&B | Works; see runtime evidence |
| Fleet seeding | No background/fixture creates the four registrations for the seven math scenarios | Missing |
| Performance preparation | UI says COMING SOON | No integrated journey acceptance |

The forced diagnostic ran ten scenarios with no retries: ten failed, zero
skipped. It did not change or bypass the regular suite exclusions. The list-only
JSON reports discovery, not runtime skips. No math assertion was reached;
these failures prove infrastructure/navigation gaps, not numerical errors.

The real wizard checks reuse existing TEST_AIRCRAFT literals solely as UI test
data. They do not validate an aircraft definition. Existing canonical vector
files describe simplified/hand-calculated cases; algorithm/unit success is not
a serial-specific POH/AFM reference validation. No operational values were added.

Reproduction and full local artifacts are retained in HQ `var/jobs/204`:
`browser-check.cjs`, `browser-results.json`, `e2e-enabled.log`,
`e2e-inventory.json`, `e2e-diagnostic.json`, gate logs and viewport screenshots.
Reproduce diagnostics after generating BDD with direct `playwright test`
(without the package script's grep-invert), selecting happy-path,
overweight-discovery, burn-sequence-polygon, burnout-check and
 aircraft-wizard-creation. Use Chromium against the production preview.

Current completion status belongs in the [roadmap](roadmap.md). These failures describe this historical candidate and must not be treated as current defects without reproduction.

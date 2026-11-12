# M&B QA293 integrated evidence — 2026-11-12

Candidate: develop `2c5447c4782aa921cd850aa314886b69cad8672f` (GitHub verified),
containing safety repairs [#470](https://github.com/naturelle137/AeroDash/pull/470)
and [#471](https://github.com/naturelle137/AeroDash/pull/471) and the independently
reviewed E2E repair [#478](https://github.com/naturelle137/AeroDash/pull/478).
[Develop CI 43138521794](https://github.com/naturelle137/AeroDash/actions/runs/43138521794):
all six required checks green. Supersedes the [QA204 baseline](mb-qa-204.md).

| Claim / flow | Observed result | Acceptance |
| --- | --- | --- |
| Lint / unit / integration / P1 / build | Pass; 1767 unit, 88 integration, 651 P1 tests | Pass |
| Enabled Chromium suite | 22/22 pass locally (no retries) and in CI | Pass |
| Seven critical M&B scenarios B-001..B-007 | Pass in blocking CI | Pass (synthetic data) |
| Wizard A-002/003/004/007/008 | Pass; six steps, 4-point envelope floor | Pass |
| Draft selection B-009/B-011 | Draft label; WARN-AC-002 acknowledgement required | Pass |
| Main landmark, real UI | One on Fleet, Wizard and Review at 1440 and 390 px | Fixed |
| Save chooser / persistence | Start flight prep, Verify now, Back to Fleet; D-EBPN survives reload | Pass |
| Step indicator at 390 px | Active step 6 scrolled out of view | Defect [#479](https://github.com/naturelle137/AeroDash/issues/479) |
| Still excluded by `@wip` | Decimal A-005/A-006, category switch A-001 | Open in [#294](https://github.com/naturelle137/AeroDash/issues/294) |
| Performance preparation | UI says COMING SOON | No journey acceptance |

The E2E fleet seed copies existing catalogue values as Draft profiles marked
synthetic. Passing scenarios prove app behaviour against synthetic algorithm
data, not a serial-specific POH/AFM validation. No operational values were
added. No flight, POH or certification release is implied.

Artifacts are retained in HQ `var/jobs/293`: gate logs, `e2e.log`,
`browser-check.cjs`, `browser/browser-results.json` and viewport screenshots.

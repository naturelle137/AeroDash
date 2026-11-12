# CI449 evidence index

Promotion: [PR453](https://github.com/naturelle137/AeroDash/pull/453),
`hotfix/ci449-job213` into main
`007a559bf82cc4ec592cd4e1d001c720c3278819`.
Original reviewed-head evidence is in HQ213; the Netlify fix's exact signed
head, current runs and live skip evidence are in PR453's HQ233 evidence comment.
Historical CI success is not final-head acceptance.

## Local candidate

- lint; 973 unit tests; 31 integration tests; type-check; production build: pass.
- P1 coverage: lines 98.62%, branches 99.01%, functions 98.46%, statements 98.77%.
  Existing 90% thresholds retained; canonical vector tests included.
- Dependency audit: no known vulnerabilities after reviewed dependency closure.
- Chromium: 3/3 main-baseline journeys pass; desktop 1440px and mobile 390px
  screenshots captured and inspected (linked below).
- 62 CI contract tests pass: production aggregate, publication guard and real
  mutation-scope regression. Mutation floor remains 70%; final-head CI mutation is authoritative.
  An interrupted local exploratory mutation run is not acceptance evidence.
- Product sources/tests/reference data are byte-identical to main. No domain
  certification or completion of independently owned safety repairs is claimed.

[Desktop](desktop.png) · [Mobile](mobile.png)

## Real target-baseline PR probes

All are draft, evidence-only and forbidden to merge. All four develop CI runs
passed; all four baseline-main CI runs failed with the context gaps below. Signed branches remain
available after closure. Each changes only its named path class; whitespace-only
code/manifest changes trigger real path applicability without changing P1 math.

| Target | Docs only | Dependency path | Workflow path | P1 path |
| --- | --- | --- | --- | --- |
| develop | [454](https://github.com/naturelle137/AeroDash/pull/454) | [455](https://github.com/naturelle137/AeroDash/pull/455) | [456](https://github.com/naturelle137/AeroDash/pull/456) | [457](https://github.com/naturelle137/AeroDash/pull/457) |
| main | [458](https://github.com/naturelle137/AeroDash/pull/458) | [459](https://github.com/naturelle137/AeroDash/pull/459) | [460](https://github.com/naturelle137/AeroDash/pull/460) | [461](https://github.com/naturelle137/AeroDash/pull/461) |

**Acceptance limitation:** baseline-main probes cannot emit `CI Required` or
`lint-markdown`: main does not contain those jobs yet. Their CI failures and
missing contexts are real evidence of this gap, not candidate successes.
Adding CI foundations to each probe would change its actual PR diff from
"docs only" into "workflow + dependencies + docs". Thus pure-path main adoption
needs a staged independent promotion followed by fresh probes before activation.
HQ237 (sole successor of HQ231) owns resolution after the completed HQ214 review and HQ233 fix;
this author neither merges nor waives the prerequisite.

## Real negative Actions results

Signed probe branches replace upstream application commands with cheap fixture
jobs while retaining the production dependency graph, aggregate block and actual
`toJSON(needs)` evaluation. Fixture successes do not validate the application.
Production aggregate block SHA-256:
`95f52d5958a42b2a968981a7f75f091edbad9724d81c7cb2032fe718cc29452c`.
The missing-job probe deliberately removes integration from the graph; the
production wiring invariant test must reject that omission.

| Case | PR | CI run |
| --- | --- | --- |
| Failure | [462](https://github.com/naturelle137/AeroDash/pull/462) | [43110194303](https://github.com/naturelle137/AeroDash/actions/runs/43110194303) |
| Timeout (2 minutes) | [463](https://github.com/naturelle137/AeroDash/pull/463) | [43110196735](https://github.com/naturelle137/AeroDash/actions/runs/43110196735) |
| Missing integration job | [464](https://github.com/naturelle137/AeroDash/pull/464) | [43110207381](https://github.com/naturelle137/AeroDash/actions/runs/43110207381) |
| Failed detector emitting false | [465](https://github.com/naturelle137/AeroDash/pull/465) | [43110217067](https://github.com/naturelle137/AeroDash/actions/runs/43110217067) |
| Successful detector omitting output | [466](https://github.com/naturelle137/AeroDash/pull/466) | [43110226409](https://github.com/naturelle137/AeroDash/actions/runs/43110226409) |
| Unexpected mandatory skip | [467](https://github.com/naturelle137/AeroDash/pull/467) | [43110236020](https://github.com/naturelle137/AeroDash/actions/runs/43110236020) |
| Deliberate cancellation | [468](https://github.com/naturelle137/AeroDash/pull/468) | [43110246798](https://github.com/naturelle137/AeroDash/actions/runs/43110246798) |

Only designated probe468 was deliberately cancelled while its integration job
slept. Integration reported cancelled and CI Required failed. No protected-head
run was cancelled. Raw negative job metadata/logs and the signed-head/path snapshot are retained
in this directory (`run-*.json`, `run-*.txt`, `probe-results.json`). Full evolving
CI snapshots and signature payloads are retained in HQ213 evidence. Every
negative aggregate reported failure; timeout and cancellation report an overall
cancelled run while the aggregate itself fails.

## Netlify correction (review214 / fix233)

Historical probes were evidence-only and unmerged, but not publication-free:
Netlify automatically published previews outside GitHub publication guards.
In particular reviewed head `ed0144aeac07f666d2f5b3ac23a47940ddf2ebbd` published
preview453 (`6af4eb51133b94bf34a274e3`). Production/main was publicly identified
at `007a559bf82cc4ec592cd4e1d001c720c3278819`. No historical deploy is removed.

The new root `netlify.toml` unconditionally cancels Git builds (ignore exit 0)
and blocks the build command (exit 1) even if a build hook bypasses ignore.
Publication contract tests execute both commands across production/preview/branch
contexts from root and frontend directories. Final-head live Netlify evidence,
current gates, browser checks and signatures are recorded in HQ233 and linked
from PR453. Existing GitHub guards are retained. HQ237, already assigned by HQ231, owns terminal checks;
this is neither CI449 completion nor E3/publication authorization.

Fresh HQ233 browser evidence: Chromium 3/3 passed; inspected
[desktop 1440px](fix233-desktop.png) and [mobile 390px](fix233-mobile.png).

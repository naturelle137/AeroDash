# 318-DEV-dependency-major-policy: Dependency Major Version & Pre-release Policy

* **Status:** Accepted
* **Date:** 2026-05-26
* **Refs:** Issue [#261](https://github.com/naturelle137/AeroDash/issues/261),
  audit findings `TECH-009` and `CS-014` (originated in the
  `.logs/audit.tech-*.md` / `.logs/audit.cybersecurity-*.md` reports
  produced by `/audit.full`; the audit logs are gitignored, so the IDs
  are re-stated in §*Context* below for readers without local audit
  artefacts).

## Context

AeroDash is a safety-advisory tool for General Aviation pilots. Computational
correctness in the P1 Safety Core (`frontend/src/core/`) directly affects
Go/No-Go decisions, so the build, test and validation tool-chain on which P1
runs is itself a safety asset. At v0.3.0-alpha the workspace pins several
bleeding-edge majors and one pre-release line:

| Package | Specifier | Resolved | Stable LTS at the time of writing |
| :--- | :--- | :--- | :--- |
| `vue-router` | `^5.0.7` | `5.0.7` | `4.x` (current GA LTS — 5.x line is pre-release / unstable) |
| `typescript` | `~6.0.3` | `6.0.3` | `5.x` series (TS 6 is still very recent) |
| `vite` | `^8.0.14` | `8.0.14` | `7.x` series |
| `vitest` | `^4.1.7` | `4.1.7` | `3.x` series |
| `eslint` | `^10.4.0` | `10.4.0` | `9.x` series |
| `@types/node` | `^25.9.1` | `25.9.1` | `24.x` (matches devcontainer Node 24 LTS) |
| `uuid` | `^14.0.0` | `14.0.0` | `11.x` (most recent broadly-deployed line; a `pnpm.overrides.uuid: ">=11.1.1"` entry at the workspace root floors transitive deps) |
| `zod` | `^4.4.3` | `4.4.3` | `3.x` (Zod 4 changes NaN/Infinity handling — relevant to P1 numerics) |

Two concrete risk classes flow from this posture:

1. **Behavioural surprise.** Pre-release lines (`vue-router 5`) and recently
   cut majors (TS 6, Vite 8, Vitest 4, ESLint 10, Zod 4) carry undocumented
   subtle changes that can silently shift P1 numerical results or test-runner
   behaviour. The Zod 4 NaN / Infinity semantics were explicitly flagged in
   the audit (TECH-009).
2. **Unverifiable CVE coverage.** GitHub Advisory and `pnpm audit` databases
   are slower to populate findings against the very newest majors, so a clean
   `pnpm audit` on a bleeding-edge line is a weaker signal than on a mature
   LTS line (CS-014).

This ADR establishes the policy AeroDash applies to such majors going
forward, records the per-package decisions made today, **and lands the CI
half of the rotation** (`pnpm audit --audit-level=moderate` on the weekly
cron, `osv-scanner` on every trigger, CycloneDX SBOM as a workflow
artefact) — see §*Supply-chain scan in CI* below.

## Considered Options

* **Option A — Blanket downshift to LTS.** Drop every bleeding-edge line back
  to the nearest LTS major (e.g. Vue Router 4, TS 5.x, Vite 7, Vitest 3,
  ESLint 9, `@types/node` 24, `uuid` 11, Zod 3). Lowest behavioural risk; very
  high churn cost: the lockfile, mutation-testing configuration, Stryker
  TypeScript checker, `@vue/eslint-config-typescript`, and several plugin
  peers all need re-pinning together, and at least one cycle of full regression.
  Doing it inside a single PR — labelled `engineering` and *resubmitted* from a
  prior release — is itself a safety risk: large surface, hard to bisect.

* **Option B — Status quo + lockfile pinning.** Keep every version, rely on
  `pnpm-lock.yaml` exact-version pinning, do nothing else. Cheapest. Leaves
  TECH-009 / CS-014 unanswered; provides no governance hook for the *next*
  bleeding-edge upgrade.

* **Option C — Codified policy + per-major ADR justification + pinned
  regression suite + CI scan triple (Selected).** Adopt a written policy
  that pre-release or major-bumped lines may exist only when justified in
  an ADR and only when a named regression suite is pinned against the
  chosen version. Apply the policy retrospectively to today's bleeding-edge
  lines: each is either *retained with justification* or *scheduled to
  downshift* in a tracked follow-up. Layered with the existing CI gates
  (P1 isolation lint, P1 unit test isolation, Stryker mutation gate on the
  Safety Core) and a tightened supply-chain scan rotation (moderate-CVE
  weekly cron + OSV-Scanner + CycloneDX SBOM, landed alongside the
  policy), this provides technical defence against behavioural drift
  without forcing a high-risk bulk downshift in this PR.

## Decision

We adopt **Option C**. The policy and the per-package decision matrix are
recorded below.

### Policy — "Bleeding-edge majors require a justified ADR entry"

1. **A dependency major is *bleeding-edge*** when (a) the line is explicitly
   marked pre-release / alpha / beta / RC by the upstream maintainer, **or**
   (b) the major was cut less than ~6 months before adoption and is not yet
   the default install target for the wider ecosystem (e.g. its peer plugins
   still pin the previous major in their `peerDependencies`), **or**
   (c) it is an ecosystem peer plugin of a (a)/(b) library that has itself
   cut a new major specifically to track that library (e.g. a Vite plugin
   bumped to its own major because it targets Vite 8) — peers inherit the
   bleeding-edge classification of the library they peer with, because they
   share its CVE-coverage gap.
   *Where the bleeding-edge major sits in the dependency tree determines how
   strict the regression-suite subset must be.* Runtime / P1-touching deps
   (today: `zod`, `vue`, `vue-router`, `pinia`, `uuid`) demand at minimum the
   **P1 unit + P1 mutation** gates; build/test/lint tooling (`vite`,
   `vitest`, `eslint`, `typescript`, `@types/node`, jsdom) can rely on
   **type-check + lint + integration suite** as the named subset. The
   per-row entry in the matrix below records which subset applies.
2. **No bleeding-edge major lands without an ADR entry.** A PR introducing a
   bleeding-edge major (new dependency, or a major-bump of an existing one)
   must add or update a row in *this* ADR (§ *Per-Major Decision Matrix*)
   recording: package, resolved version, justification, the pinned
   regression suite that proves no behavioural regression, and the named
   downshift target if/when this major is later replaced.
3. **Each bleeding-edge major must have a pinned regression suite.** The
   suite is the named, executable test set that verifies the major does not
   change P1 numerics, test-runner behaviour, or lint semantics relative to
   the previous LTS line. It is satisfied by the existing AeroDash quality
   gates (see § *Pinned Regression Suite* below) — but each row in the
   matrix must name explicitly which subset is doing the work.
4. **Behavioural-surprise hot-spots get an explicit guard.** Where an
   upstream changelog calls out a numerics or semantics change (today: the
   Zod 4 NaN / Infinity tightening), the row must point to the specific
   guard test that pins the chosen behaviour.
5. **CI does the supply-chain scan.** Scheduled `pnpm audit
   --audit-level=moderate` + `osv-scanner` + CycloneDX SBOM generation in
   `.github/workflows/security.yml` are the second leg of this policy and
   are landed alongside this ADR — see §*Supply-chain scan in CI* below for
   the as-implemented layout.

### Pinned regression suite

The "pinned regression suite" referenced by the matrix is composed of the
already-deployed AeroDash gates, used together:

| Gate | What it pins | CI / local command |
| :--- | :----------- | :----------------- |
| **P1 unit tests, Node env** | P1 math semantics under the chosen TypeScript + Zod + `@types/node` line; framework-free import boundary. | `pnpm --filter frontend test:p1` |
| **P1 mutation gate** (#260) | Behavioural surface of the Safety Core under the chosen test runner. A drift in Vitest/Stryker that weakens mutation kills surfaces here. | `pnpm --filter frontend test:mutation` |
| **P1 ESLint isolation rule** (ADR-314-DEV) | P1 import boundary under the chosen ESLint major. | `pnpm --filter frontend lint:ci:eslint` |
| **Integration suite (jsdom)** | Pinia / Vue / Vue-Router interplay under the chosen Vue + Vue-Router + Vitest lines. | `pnpm --filter frontend test:integration` |
| **Vite build** | Vite plugin graph (incl. `@vitejs/plugin-vue`, `vite-plugin-pwa`) under the chosen Vite + Node lines. | `pnpm --filter frontend build` |
| **Lockfile pinning** (`pnpm-lock.yaml`) | Exact resolved versions for every transitive dep — reproducibility floor for everything above. | `pnpm install --frozen-lockfile` |

A row in the matrix references the subset that proves *that specific*
major's retention, not the whole stack.

### Per-major decision matrix

| # | Package | Resolved | Decision | Justification | Pinned regression suite (subset) | Downshift target |
| - | :------ | :------- | :------- | :------------ | :-------------------------------- | :--------------- |
| 1 | `vue-router` | `5.0.7` | **Retain (review bound to v0.4.0-alpha milestone closure — milestone #5)** | Already wired into the App Shell router config and verified end-to-end by Playwright BDD smoke + integration suites. Vue Router 5's pre-release status is the single largest residual risk in this matrix. **Review trigger:** before [milestone v0.4.0-alpha (#5)](https://github.com/naturelle137/AeroDash/milestone/5) is closed, the row must be re-justified or the named downshift executed; closing the milestone with this cell unchanged is a policy violation. The /milestone.check skill enforces matrix freshness at milestone-exit. | Integration suite + `pnpm --filter frontend test:smoke` | `vue-router@^4` |
| 2 | `typescript` | `6.0.3` | **Retain** | All three vue-tsc / `@vue/eslint-config-typescript` / `@stryker-mutator/typescript-checker` peers resolve against TS 6 without warnings; the P1 unit suite and Stryker mutation gate run clean. | P1 unit + P1 mutation + `type-check` | `typescript@~5.9` |
| 3 | `vite` | `8.0.14` | **Retain** | `@vitejs/plugin-vue@6`, `vite-plugin-pwa@1.3`, and `vite-plugin-vue-devtools@8` all declare Vite 8 in their `peerDependencies` ranges; the production build, dev server and PWA precache list reproduce identically across CI runs. | `pnpm --filter frontend build` + integration suite | `vite@^7` |
| 4 | `vitest` | `4.1.7` | **Retain** | The Stryker Vitest runner is specifier-bound to `@stryker-mutator/vitest-runner@^9.6.1` and lockfile-resolved against Vitest 4; the P1 mutation gate has passed under it on `main`. Downshift would invalidate the mutation gate baseline. | P1 unit + P1 mutation + integration suite | `vitest@^3` |
| 5 | `eslint` | `10.4.0` | **Retain** | `eslint-plugin-vue@10.9`, `eslint-plugin-playwright@2.10`, `eslint-config-prettier@10.1`, `eslint-plugin-oxlint@~1.66`, `@vitest/eslint-plugin@1.6`, and `@vue/eslint-config-typescript@14.7` all declare ESLint 10 compatibility in the lockfile; the P1-ISOLATION rule still fires on synthetic violation samples. | `lint:ci:eslint` (CI Lint job) | `eslint@^9` |
| 6 | `@types/node` | `25.9.1` | **Retain** | The devcontainer ships Node 24 LTS but Node-typed surface used in AeroDash is conservative (`node:*` only inside P1 adapters); `@types/node` 25 is forward-compatible with Node 24's `lib.dom`/`lib.es*` choices. `vue-tsc --build` is clean. | `type-check` + P1 unit | `@types/node@^24` (matches devcontainer) |
| 7 | `uuid` | `14.0.0` | **Retain** | The pnpm root override `uuid: ">=11.1.1"` floors transitive deps at the broadly-deployed 11 line; the top-level `uuid@^14` resolves cleanly and `crypto.randomUUID()` parity is verified by the existing `IndexedDB` schema-migration tests. | Integration suite (schema migration / fleet store) | `uuid@^11` |
| 8 | `zod` | `4.4.3` | **Retain — with explicit NaN/Infinity guard** | Zod 4 tightens default behaviour around `NaN` and `±Infinity` in `z.number()` (TECH-009). AeroDash already normalises numeric inputs at the P1 adapter boundary, and the P1 unit suite pins the chosen behaviour for the affected fields. **A regression here is a P1 numerics defect**, so the mutation gate's per-line / per-branch threshold acts as a second guard. | P1 unit (number-validation specs) + P1 mutation gate | `zod@^3` |

> Rows 1–8 are **Accepted** as of the date above. A row may be re-opened any
> time the row's regression suite begins to drift; doing so triggers either a
> renewed retention justification or execution of the named downshift target.

### Supply-chain scan in CI

The audit findings (TECH-009 / CS-014) also call for tightening the
scheduled supply-chain scan rotation. This PR lands the CI half of that
work in `.github/workflows/security.yml` alongside the policy above, with
explicit human authorisation overriding the autonomous-contribution
workflow-fence laid down (in `Status: Proposed` form) by ADR-317-DEV
§*Guardrails*. The fence is *operational policy*, not a safety invariant,
and the human Lead Developer review still gates the merge.

The as-implemented scan triple (see `.github/workflows/security.yml`):

| # | Gate | Triggers | Severity / failure policy |
| - | :--- | :------- | :------------------------ |
| 1 | `dependency-audit` (`pnpm audit`) | push to `main` / `develop`, PR to either, weekly cron (Mon 07:00 UTC), `workflow_dispatch` | `--audit-level=high` on push / PR (preserves the existing PR gate); raised to `--audit-level=moderate` on the weekly cron via a conditional GitHub-Actions expression on `github.event_name == 'schedule'` — moderate CVEs become a weekly failure without churning every PR. |
| 2 | `osv-scanner` (`google/osv-scanner-action/osv-scanner-action@v2.3.8`, lockfile mode) | same triggers as #1 | Scans `pnpm-lock.yaml` and uploads SARIF to the GitHub Security tab (`security-events: write`). Fails the job on any finding by default. On PR runs the step is `continue-on-error: true` so moderate findings surface as warnings without blocking; on push and schedule the failure is hard. The Action does not publish a floating `@v2` tag, only patch releases — pinned exact and tracked by Dependabot. |
| 3 | CycloneDX SBOM (`anchore/sbom-action@v0`, `cyclonedx-json` format) | same triggers as #1 plus `release: types: [published]` | Generates `aerodash-sbom.cdx.json` (Syft backend, pnpm-aware) and uploads it as a workflow artefact on every run. On `release: published`, additionally attaches it to the GitHub Release via `gh release upload --clobber`, completing the SBOM-with-release artefact chain. |

Notes on the choices made:

* **Why `anchore/sbom-action` rather than `@cyclonedx/cyclonedx-npm`.**
  Issue #356 named `@cyclonedx/cyclonedx-npm` *(or equivalent)*. The
  `cyclonedx-npm` tool reads `package-lock.json`; AeroDash is a pnpm
  workspace, so the equivalent pnpm-aware path is either
  `@cyclonedx/cdxgen` or `anchore/sbom-action` (Syft). The Syft action is
  pinned by major (`@v0`) per the rest of the workflows in this repo,
  detects the pnpm lockfile out of the box, emits CycloneDX-JSON natively,
  and uploads the artefact in the same step — no extra `actions/upload-artifact@v5`
  call. The format on the artefact is the CycloneDX spec the issue asked
  for; only the producer differs.
* **Why osv-scanner runs on PRs as a warning, not a blocker.** Lockfile
  scans against bleeding-edge majors are exactly the place where
  false-positive moderate findings appear first (CVE database lag is the
  premise of `CS-014`). Hard-blocking PRs on those would create churn
  without a corresponding safety win, while the weekly cron and push runs
  *do* hard-fail, so the moderate-CVE feedback loop still closes — just
  not on the PR critical path.
* **Why three jobs, not one consolidated job.** Each has independent
  signal: `pnpm audit` against the NPM Advisory database, OSV-Scanner
  against the OSV.dev cross-ecosystem feed, and the SBOM as a
  reproducibility artefact for downstream auditors. Folding them into one
  job would couple their failure modes; keeping them separate lets a
  reviewer see at a glance which leg detected a regression.
* **Why workflow-file editing here is acceptable.** ADR-317-DEV's
  workflow-file fence (`Status: Proposed`) is an *autonomous-contribution
  default*, not a hard invariant on every PR. The user explicitly
  authorised this PR to edit `.github/workflows/security.yml` so the
  third DoD item on #261 can land in the same commit as the policy it
  serves. When ADR-317-DEV is moved to `Accepted` it should explicitly
  carry the carve-out *"unless the PR is human-initiated and the human
  has explicitly authorised the workflow edit"* — which is what happened
  here.

Inaugural finding (exercise of the rotation in the same PR). The first
OSV-Scanner run after this workflow landed raised one medium-severity
alert: [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26)
/ [CVE-2026-8723](https://osv.dev/CVE-2026-8723) on `qs@6.15.1`, reached
us as a third-level transitive devDependency under
`@stryker-mutator/core@9.6.1` → `typed-rest-client@2.3.0` → `qs`. The
vulnerability requires a specific `qs.stringify` call shape
(`arrayFormat: 'comma'` + `encodeValuesOnly: true` + `null`/`undefined`
array element) that AeroDash source does not exercise — no `qs` import
exists under `frontend/src/**` — and `qs` is not in the production PWA
bundle. Even so, fixing it inside this PR rather than ignoring it via
`osv-scanner.toml` keeps the inaugural exercise of the rotation honest:
a one-line `pnpm.overrides` entry (`"qs": ">=6.15.2"`) floors the
transitive dep at the patched line and clears the alert, demonstrating
the moderate-CVE feedback loop end-to-end.

## Consequences

### Positive

* **Auditable governance.** Every bleeding-edge major now has a named
  justification, named regression suite, and named downshift target. A
  reviewer reading this ADR can answer "why is `vue-router@5` in here?"
  without git archaeology.
* **CS-014's CI half is closed in the same PR as the policy.** The
  scheduled `pnpm audit --audit-level=moderate` cron, the OSV-Scanner job,
  and the CycloneDX SBOM artefact land alongside the matrix, so the policy
  and the rotation that enforces it ship as a single reviewable unit.
* **Defence in depth, mostly with gates that already exist.** The pinned
  regression suite is composed entirely of gates already deployed (P1
  unit, P1 mutation, P1 ESLint isolation, integration, build). The CI
  scan triple is the only new infrastructure, and the two new tools
  (OSV-Scanner, Syft via `anchore/sbom-action`) are GitHub-native and
  require no external account or secret — consistent with the
  zero-external-account posture established in ADR-315-DEV.
* **Forces honesty on the next upgrade.** The next contributor adding a
  bleeding-edge major must touch this file. The diff is the policy enforcer.

### Negative

* **No downshift executed today.** The bleeding-edge surface remains exactly
  where it is. Each retention is a *bet that the regression suite catches
  drift*; if a future Zod / Vitest / Vue Router subtle change slips past the
  matrix's named subset, the bet loses. Mitigated by (a) the row-1
  review-trigger bound to v0.4.0-alpha milestone closure (the only
  pre-release line in the matrix) and (b) the moderate-severity weekly
  cron now tightening the CVE feedback loop.
* **New CI surface area.** Three new jobs (`pnpm audit` at moderate,
  `osv-scanner`, SBOM) add ~2–4 minutes to the weekly cron run and
  introduce two new third-party Actions
  (`google/osv-scanner-action/osv-scanner-action@v2.3.8`,
  `anchore/sbom-action@v0`) to the supply chain of the supply-chain scan.
  Mitigated by version pinning of the Actions (`@v0` matches the existing
  floating-major repo convention; `osv-scanner-action` does not publish a
  floating major so it is pinned exact) and by Dependabot already tracking
  GitHub-Actions updates per ADR-315-DEV.
* **Policy maintenance load.** This ADR is a living document; an out-of-date
  matrix is worse than no matrix because it would falsely attest. Mitigated
  by the milestone-bound row-1 re-review (closing milestone v0.4.0-alpha
  with row 1 unchanged is a policy violation) and by the general
  expectation that any PR touching the deps changes this file.

## Compliance

This ADR addresses audit findings **TECH-009** (bleeding-edge / pre-release
majors in a safety-advisory codebase) and **CS-014** (unverifiable CVE
coverage on very recent majors) end-to-end:

* the **product-side guard** is the policy + per-major decision matrix above
  (every bleeding-edge line carries a named justification, regression
  subset, and downshift target);
* the **CI-side guard** is the scan triple in `.github/workflows/security.yml`
  described in §*Supply-chain scan in CI* (`pnpm audit` raised to moderate
  on the weekly cron, `osv-scanner` for OSV.dev cross-ecosystem coverage,
  CycloneDX SBOM as a workflow artefact and attached to GitHub Releases).

No `frontend/src/core/` source is touched and no P1 math semantics
change, so no new hazards are introduced and no existing mitigation is
weakened. The single residual concentrated risk — `vue-router@5` as the
only pre-release line — is bound to the v0.4.0-alpha milestone-closure
trigger described in row 1, so the re-evaluation cannot silently slip
past that milestone exit.

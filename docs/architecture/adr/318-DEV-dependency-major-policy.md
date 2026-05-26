# 318-DEV-dependency-major-policy: Dependency Major Version & Pre-release Policy

* **Status:** Accepted
* **Date:** 2026-05-26
* **Refs:** Issue [#261](https://github.com/naturelle137/AeroDash/issues/261), audit findings TECH-009 / CS-014.

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
forward, records the per-package decisions made today, and points to the
follow-up work needed in CI (which is intentionally out of scope for this
ADR — see *Consequences*).

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
  regression suite (Selected).** Adopt a written policy that pre-release or
  major-bumped lines may exist only when justified in an ADR and only when a
  named regression suite is pinned against the chosen version. Apply the
  policy retrospectively to today's bleeding-edge lines: each is either
  *retained with justification* or *scheduled to downshift* in a tracked
  follow-up. Layered with the existing CI gates (P1 isolation lint, P1 unit
  test isolation, Stryker mutation gate on the Safety Core) this provides
  technical defence against behavioural drift without forcing a high-risk
  bulk downshift in this PR.

## Decision

We adopt **Option C**. The policy and the per-package decision matrix are
recorded below.

### Policy — "Bleeding-edge majors require a justified ADR entry"

1. **A dependency major is *bleeding-edge*** when (a) the line is explicitly
   marked pre-release / alpha / beta / RC by the upstream maintainer, **or**
   (b) the major was cut less than ~6 months before adoption and is not yet
   the default install target for the wider ecosystem (e.g. its peer plugins
   still pin the previous major in their `peerDependencies`).
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
   --audit-level=moderate` + `osv-scanner` + SBOM generation in
   `.github/workflows/security.yml` are the second leg of this policy. CI
   configuration is intentionally out of scope for this ADR (see
   *Consequences*) — the work is tracked as an independent follow-up issue
   that references #261.

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
| 1 | `vue-router` | `5.0.7` | **Retain (review at next milestone exit)** | Already wired into the App Shell router config and verified end-to-end by Playwright BDD smoke + integration suites. Vue Router 5's pre-release status is the single largest residual risk in this matrix; a planned re-evaluation at the next milestone exit will revisit the downshift. | Integration suite + `pnpm --filter frontend test:smoke` | `vue-router@^4` |
| 2 | `typescript` | `6.0.3` | **Retain** | All three vue-tsc / `@vue/eslint-config-typescript` / `@stryker-mutator/typescript-checker` peers resolve against TS 6 without warnings; the P1 unit suite and Stryker mutation gate run clean. | P1 unit + P1 mutation + `type-check` | `typescript@~5.9` |
| 3 | `vite` | `8.0.14` | **Retain** | `@vitejs/plugin-vue@6`, `vite-plugin-pwa@1.3`, and `vite-plugin-vue-devtools@8` all declare Vite 8 in their `peerDependencies` ranges; the production build, dev server and PWA precache list reproduce identically across CI runs. | `pnpm --filter frontend build` + integration suite | `vite@^7` |
| 4 | `vitest` | `4.1.7` | **Retain** | The Stryker Vitest runner is pinned to `@stryker-mutator/vitest-runner@9.6.1` which targets Vitest 4; the P1 mutation gate has passed under it on `main`. Downshift would invalidate the mutation gate baseline. | P1 unit + P1 mutation + integration suite | `vitest@^3` |
| 5 | `eslint` | `10.4.0` | **Retain** | `eslint-plugin-vue@10.9`, `eslint-plugin-playwright@2.10`, `eslint-config-prettier@10.1`, `eslint-plugin-oxlint@~1.66`, `@vitest/eslint-plugin@1.6`, and `@vue/eslint-config-typescript@14.7` all declare ESLint 10 compatibility in the lockfile; the P1-ISOLATION rule still fires on synthetic violation samples. | `lint:ci:eslint` (CI Lint job) | `eslint@^9` |
| 6 | `@types/node` | `25.9.1` | **Retain** | The devcontainer ships Node 24 LTS but Node-typed surface used in AeroDash is conservative (`node:*` only inside P1 adapters); `@types/node` 25 is forward-compatible with Node 24's `lib.dom`/`lib.es*` choices. `vue-tsc --build` is clean. | `type-check` + P1 unit | `@types/node@^24` (matches devcontainer) |
| 7 | `uuid` | `14.0.0` | **Retain** | The pnpm root override `uuid: ">=11.1.1"` floors transitive deps at the broadly-deployed 11 line; the top-level `uuid@^14` resolves cleanly and `crypto.randomUUID()` parity is verified by the existing `IndexedDB` schema-migration tests. | Integration suite (schema migration / fleet store) | `uuid@^11` |
| 8 | `zod` | `4.4.3` | **Retain — with explicit NaN/Infinity guard** | Zod 4 tightens default behaviour around `NaN` and `±Infinity` in `z.number()` (TECH-009). AeroDash already normalises numeric inputs at the P1 adapter boundary, and the P1 unit suite pins the chosen behaviour for the affected fields. **A regression here is a P1 numerics defect**, so the mutation gate's per-line / per-branch threshold acts as a second guard. | P1 unit (number-validation specs) + P1 mutation gate | `zod@^3` |

> Rows 1–8 are **Accepted** as of the date above. A row may be re-opened any
> time the row's regression suite begins to drift; doing so triggers either a
> renewed retention justification or execution of the named downshift target.

### Supply-chain scan plan

The audit findings (TECH-009 / CS-014) also call for moving the existing
`pnpm audit` from `--audit-level high` to `--audit-level moderate`, adding
`osv-scanner` for cross-ecosystem CVE coverage, and emitting an SBOM. These
are *workflow* changes to `.github/workflows/security.yml` and are
intentionally **not** made in this PR — as an operational policy (codified
by the proposed ADR-317-DEV) autonomous contributions do not edit files
under `.github/workflows/**`, and the scan rotation deserves a
human-reviewed change. The work is filed as an independent follow-up issue
referencing #261, with the recommended layout already drafted in the issue
body:

* extend `dependency-audit` to `--audit-level=moderate` on the existing
  weekly cron;
* add a new `osv-scanner` job using `google/osv-scanner-action`;
* add a CycloneDX SBOM step using `@cyclonedx/cyclonedx-npm` that uploads the
  result as a workflow artefact (and, on tagged releases, attaches it to the
  GitHub Release).

When that follow-up lands, this ADR is updated with a §*Supply-chain scan
in CI* row pointing at the merged workflow.

## Consequences

### Positive

* **Auditable governance.** Every bleeding-edge major now has a named
  justification, named regression suite, and named downshift target. A
  reviewer reading this ADR can answer "why is `vue-router@5` in here?"
  without git archaeology.
* **No high-risk bulk churn.** The PR introducing this ADR is documentation +
  policy only; no source code or build configuration is touched. The
  existing green CI baseline is preserved.
* **Defence in depth without new tooling.** The pinned regression suite is
  composed entirely of gates that already exist (P1 unit, P1 mutation,
  P1 ESLint isolation, integration, build). No new CI infrastructure is
  required for the policy to bite.
* **Forces honesty on the next upgrade.** The next contributor adding a
  bleeding-edge major must touch this file. The diff is the policy enforcer.

### Negative

* **No downshift executed today.** The bleeding-edge surface remains exactly
  where it is. Each retention is a *bet that the regression suite catches
  drift*; if a future Zod / Vitest / Vue Router subtle change slips past the
  matrix's named subset, the bet loses. Mitigated by (a) the per-row review
  trigger at the next milestone exit and (b) the planned supply-chain scan
  rotation tightening the moderate-CVE feedback loop.
* **CI workflow gap.** The scheduled moderate-audit + osv-scanner + SBOM
  work is not done in this PR; until the follow-up issue is implemented and
  merged, CS-014's CI half remains open. Mitigated by the existing weekly
  `pnpm audit --audit-level high` and the policy commitment to revisit.
* **Policy maintenance load.** This ADR is a living document; an out-of-date
  matrix is worse than no matrix because it would falsely attest. Mitigated
  by the explicit "review at next milestone exit" hook on row 1 and by the
  general expectation that any PR touching the deps changes this file.

## Compliance

This ADR partially addresses audit findings **TECH-009** (bleeding-edge /
pre-release majors in a safety-advisory codebase) and **CS-014**
(unverifiable CVE coverage on very recent majors). The product-side guard is
fully in place via the policy + matrix above; the CI-side guard
(`--audit-level=moderate` + osv-scanner + SBOM) is tracked as the named
follow-up. Because the changed surface is documentation-only and no P1
source code is altered, no new hazards are introduced and no existing
mitigation is weakened.

# AeroDash Testing Guidelines

AeroDash operates under a **"Safety-First"** philosophy. A bug in our core logic could lead to incorrect pre-flight calculations and immediately compromise a flight. Therefore, our testing standards are exceptionally rigorous and strictly enforced.

Before submitting a Pull Request, all code must meet the following guidelines.

---

## 🏗️ 1. The Three Tiers of Testing

We utilize a standard testing pyramid, but with strict definitions regarding what belongs where.

### 1.1 Unit Tests (The Mathematical Proofs)

- **Scope:** Individual functions, classes, and atomic algorithms.
- **Rule:** Must execute in absolute isolation. No network calls, no database access, no reading from the local disk.
- **Focus:** Mathematical precision, boundary conditions (what happens exactly at Maximum Takeoff Mass?), and extreme edge cases.
- **Location & Naming:** `*.spec.ts`. Co-located with the source code.
  - For `core/`, `plugins/`, `stores/`, `router/`: Next to the source file (e.g., `core/math/math.spec.ts`).
  - For `modules/` and `shared/`: Inside a local `__tests__` sub-folder (e.g., `modules/weather/components/__tests__/WeatherWidget.spec.ts`).

### 1.2 Integration Tests (The Handshake)

- **Scope:** Interaction between two or more internal modules (e.g., the User Interface passing data to the Mass & Balance calculator).
- **Rule:** Can interact with a local test database or mocked internal services, but **must never** hit a real, external live API over the internet.
- **Focus:** Ensuring data contracts between P1 (Safety Core) and P2/P3 modules are respected.
- **Location & Naming:**
  - Component Integration (Vitest): `*.int.spec.ts`, co-located in the same `__tests__` folders as unit tests.
  - System Integration (Frontend ↔ Backend): Placed in a dedicated `tests/integration/` top-level directory.

### 1.3 End-to-End (E2E) Tests (The User Journey & BDD)

- **Scope:** The entire application stack simulating a real pilot's workflow via Behavior-Driven Development (BDD).
- **Rule:** Driven directly by the User Journeys outlined in the `docs/journeys/` directory.
- **Focus:** System integration and holistic User Experience workflows.
- **Location & Naming:** `*.feature` + Step Definitions (`*.ts`). Placed in the dedicated `tests/e2e/` top-level directory. Translated dynamically via standard Playwright tooling (e.g., `playwright-bdd`).

### 1.4 Smoke Tests (The Sanity Check)

- **Scope:** A fast, high-priority subset of Unit/Integration/E2E tests verifying the system boots, the P1 Core is reachable, and the UI loads.
- **Execution:** Runs as the definitive first gate in the CI/CD pipeline or post-deployment.
- **Location & Naming:** Smoke tests are not custom files. They are standard tests (in any tier) tagged with `@smoke` in their title or Gherkin Feature.
- **Command:** `npm run test:smoke`

### 1.5 Regression Tests (The Full Suite)

- **Scope:** The comprehensive safety verification executed prior to any release.
- **Rule:** If a bug is caught in staging or production, it **must** be reproduced with a failing Unit or E2E test before being fixed, permanently binding the fix to the Regression Suite.
- **Execution:** Regression testing does not require a special script or `@regression` tag. It is simply the union of all tests (`npm run test:unit` + `npm run test:integration` + `npm run test:e2e`).

---

## 🎯 2. Minimum Coverage Requirements (Risk-Based)

Our coverage requirements correlate directly to the Priority (P1, P2, P3) of the code being written. CI gates will automatically reject Pull Requests that drop coverage below these thresholds.

### File-Path-to-Priority Mapping

| Priority | Label | File Path(s) | Coverage |
| :------- | :---------------- | :-------------------------------------------- | :------- |
| **P1** | Safety Core | `frontend/src/core/` | 90% |
| **P2** | Operational Logic | `frontend/src/modules/` | 80% |
| **P3** | UI & Shared | `frontend/src/shared/`, `frontend/src/plugins/`, `frontend/src/stores/` | 60% |

This table is the **single source of truth** for coverage thresholds. All agent workflows, CI gates, and review checklists MUST reference this table rather than hardcoding values.

- **P1 - Safety Core (e.g., Mass & Balance, Flight Performance)**
  - **Requirement:** **90%** Line, Branch, and Function coverage.
  - _Rationale:_ This high threshold ensures the vast majority of mathematical paths are verified while allowing for pragmatic coverage of edge cases that are difficult to exercise in isolation.
- **P2 - Operational Logic (e.g., Weather Parsing, Route APIs)**
  - **Requirement:** **80%** coverage minimum.
  - _Rationale:_ Failures here are highly inconvenient and degrade the tool, but they should be caught by safety boundaries before impacting P1 calculations.
- **P3 - User Interface & Shared**
  - **Requirement:** **60%** coverage minimum, prioritizing critical user input components.
  - _Rationale:_ A visual glitch is acceptable; an incorrect underlying number is not.

### E2e / Journey Coverage Policy

Beyond line/branch/function coverage percentages, the following rules govern what must be verified at the e2e (User Journey) level:

| Rule                         | What                                                                                                   | Why                                                                                |
| :--------------------------- | :----------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| **P1 REQ Coverage**          | All reachable P1 REQs with user-observable behaviour must be tagged in ≥1 UJ                           | Safety-critical paths must be verified end-to-end                                  |
| **Hazard Indirect Coverage** | Every hazard (H-xxx) must have ≥1 mitigating REQ tagged in a UJ                                        | Ensures the full safety chain is testable                                          |
| **Algorithm Exception**      | Internal algorithm REQs (e.g., PF-002 Bilinear Interpolation) may be unit-test-only                    | The algorithm is not user-observable; its outputs are tested via the consuming UJs |
| **UQ Exception**             | Cross-cutting quality attributes (UQ-001–004: touch, responsive, decimal, rounding) use QA test suites | Too fragile and broad as individual e2e assertions                                 |

The full safety traceability chain is:

```text
Hazard (H-xxx) → Requirement (REQ-xxx) → User Journey (UJ-xxx) → E2e Test (E2E-xxx)
```

For the journey coverage rules and tag format, see [`docs/journeys/README.md`](../journeys/README.md).

---

## 🎭 3. Strict Mocking Guidelines & Determinism

### 3.1 Architectural Mocking Strategy

To ensure test reliability and maintain clear boundaries between execution tiers:

- **Unit Tests:** 100% mocked. No real network calls, no local storage, no browser APIs. Pinia stores must be mocked.
- **Integration Tests:** External network mocked (e.g., via MSW or fixture intercepts). Internal Pinia stores and Vue Router are instantiated real.
- **E2E Tests:** Real network calls (against a local staging backend) or high-level Playwright network intercepts for external 3rd-party APIs.

### 3.2 Aviation Data Mocking

Real-world aviation data is incredibly dynamic. A METAR changes every 30-60 minutes. An aircraft's physical weight distribution changes over time. To keep our tests **deterministic** and reliable, you must mock external dependencies.

1. **Weather (METAR/TAF):** When testing how the application reacts to crosswinds, you must feed the function a hardcoded, mocked METAR string (e.g., `EDDF 201420Z 23015G25KT...`). Never allow a test to execute an active fetch request to aviationweather.gov.
2. **Location/GPS:** Any feature relying on the user's location must be tested against a static coordinate fixture.
3. **Aircraft Profiles:** Use standard "Test Aircraft" profiles (stored in `tests/fixtures/`) that have pre-calculated, verified performance envelopes. Do not construct arbitrary aircraft limits inside a specific unit test.

---

## 🚦 4. Running the Tests Locally

All commands run from the **repo root** via `pnpm`. Playwright auto-starts the Vite dev server — no separate server process is needed for E2E.

```bash
# Unit tests (Vitest — Node env, no browser)
pnpm run test:unit

# Integration tests (Vitest — uses fake-indexeddb for IndexedDB)
pnpm run test:integration

# P1 Safety Core tests in strict isolation (no Vue/Pinia allowed)
pnpm --filter frontend test:p1

# E2E tests (Playwright BDD — starts Vite dev server automatically)
# On Linux VMs without MS Edge, always specify --project=chromium
pnpm run test:e2e --project=chromium

# Smoke tests only (fast first-pass gate)
pnpm run test:smoke

# Full coverage report for P1 core (must stay ≥ 90%)
pnpm --filter frontend vitest run --config vitest.config.p1.ts --coverage

# Full coverage report for all tiers
pnpm run coverage:unit
```

If your changes cause coverage to dip below the required threshold (P1: 90%, P2: 80%, P3: 60%), the CI pipeline **will fail your build**.

---

## 🔗 5. Traceability Engine Tags

To fulfill our Docs-as-Code safety obligations, every unit, integration, and E2E test file must include a traceability tag associating the test directly with a specific Code Implementation or User Journey.

We use specific prefixes defined in `.tools/.shtracer.md`:

- **Unit Tests (`*.spec.ts`)**: Must use the `@UT-[A-Z]+-[0-9]+@` prefix.
  - _Example:_ `// @UT-SYS-001@ (FROM: @IMP-SYS-001@)`
- **Integration Tests (`*.int.spec.ts`)**: Must use the `@IT-[A-Z]+-[0-9]+@` prefix.
  - _Example:_ `// @IT-SYS-001@ (FROM: @IMP-SYS-002@)`
- **E2E BDD Tests (`*.feature`)**: Must use the `@E2E-[A-Z]+-[0-9]+@` prefix.
  - **CRITICAL:** For BDD, these tags **must** be placed in the Gherkin `.feature` file (the living documentation), **not** in the `.ts` step definitions. Use the `#` comment syntax.
  - _Example:_ `# @E2E-STRESS-001@ (FROM: @UJ-STRESS-001@)`

This acts as the final verification link in our Master Traceability Matrix, permanently proving that the mitigations required by a safety hazard are verified in code.

---

## 🚦 6. CI Traceability Gate

The `Traceability Gate` GitHub Actions workflow (`.github/workflows/traceability.yml`) runs automatically on every Pull Request targeting `main`. It performs the following checks using the `shtracer` tool (`.tools/shtracer/`) and `jq`:

| Check | What is detected |
| :---- | :--------------- |
| **Duplicate tags** | The same `@IMP-`, `@REQ-`, or other tag is _declared_ in more than one file (citations inside `(FROM: …)` clauses don't count) |
| **Isolated tags** | A tag exists but has no upstream or downstream link in the chain |
| **Dangling FROM refs** | A `(FROM: @TAG@)` references a tag that does not exist |
| **Pending requirements** | A `@REQ-` tag has no downstream IMP or DES link |
| **Orphaned implementations** | An `@IMP-` tag has no upstream `@REQ-` or `@DES-` link |
| **Unmitigated hazards** | An `@H-` tag has no downstream `@REQ-` link |
| **Unverified P1 requirements** | An implemented `@REQ-` has no `@E2E-` anywhere in its chain |
| **Registry drift** | `@IMP-` tags in source files differ from entries in `trace/implementation/` YAMLs |
| **Registry presence** | A module that declares `@REQ-` tags has no `trace/requirements/{module}.yaml`, or a phase that declares `@UJ-` tags has no `trace/journeys/{phase}.yaml` (STC §4.2). Surfaced by `pnpm trace check`; also asserted by `frontend/scripts/trace/__tests__/presence.spec.ts` so the unit-test gate catches it independently. |

### Gate Severity Policy

| Project version | Gate behaviour |
| :-------------- | :------------- |
| Pre-v1.0.0 (current) | **Warn-only** — always exits 0, gaps are reported in the Actions log and PR summary |
| v1.0.0+ | **Hard-fail** — any gap causes the gate to exit non-zero and blocks merge to `main` |

### Running the trace check locally

Prefer the **own trace CLI** (`frontend/scripts/trace/`) — it reports drift, orphans, and dangling refs in a single command and shares the same registry semantics as the CI gate:

```bash
# Single-shot invariant + drift validation (exits 1 on violation)
pnpm trace check

# Warn-only mode — never returns non-zero (matches the pre-v1.0.0 CI gate)
pnpm trace check --warn-only

# Dump the parsed tag graph for ad-hoc jq queries
pnpm trace parse > /tmp/trace.json

# Regenerate the trace/*.yaml registries from source-of-truth scans
pnpm trace sync          # dry-run: prints planned changes only
pnpm trace sync --apply  # write changes to disk
```

The `shtracer` engine is still bundled (`.tools/shtracer/`) for visualisation and remains the back-end the CI workflow uses to generate the `traceability-report` artifact:

```bash
# Verify mode — detect isolated, duplicate, and dangling tags
.tools/shtracer/shtracer -v .tools/.shtracer.md

# Generate full JSON for manual jq inspection
.tools/shtracer/shtracer .tools/.shtracer.md 2>/dev/null > /tmp/trace.json
```

The raw `trace.json` is also uploaded as a GitHub Actions artifact (`traceability-report`) and retained for 30 days on every PR run.

For full CLI documentation see [CONTRIBUTING.md § 5.1 Trace authoring CLI](../../CONTRIBUTING.md#51-trace-authoring-cli).

---

## 🧬 7. Mutation Testing — P1 Safety Core Gate

Line/branch/function coverage proves the unit tests _execute_ every path
through the P1 Safety Core. It does not prove the tests _catch defects_ on
those paths — a test can execute a line while asserting nothing meaningful
about its output. Mutation testing closes that gap: a [Stryker](https://stryker-mutator.io/)
runner introduces small, semantics-changing edits ("mutants") into the
source, then re-runs the unit suite. A mutant that survives is a defect the
tests would have missed in production.

For AeroDash this is a non-negotiable second line of defence on Mass &
Balance, Performance, and Fuel/Endurance math: a surviving mutant in
`frontend/src/core/` can yield an **incorrect Go/No-Go advisory** (H-class
hazard). The gate's runtime cost is acceptable because the scope is narrow.

### Scope (what is mutated)

| Included | Excluded |
| :------- | :------- |
| `frontend/src/core/**/*.ts` (all P1 logic, adapters, domain) | `**/*.spec.ts`, `**/*.int.spec.ts`, `**/*.e2e.spec.ts` (the tests themselves) |
| | `**/*.types.ts` (type-only modules — no executable statements) |
| | `**/__fixtures__/**` (canonical test vectors — mutating these would test the fixtures, not the math) |
| | `**/__tests__/**` (shared test helpers) |
| | Everything outside `src/core/` (P2/P3 — see _Coverage Requirements_ above for their thresholds) |

P2/P3 code is intentionally out of scope: a UI mutation that survives is at
worst an inconvenience; a P1 mutation that survives can sign off an unsafe
flight. Widening the scope would dilute the signal and inflate runtime.

### Threshold

The gate is a **binary pass/fail contract**: the mutation score either
meets the floor or it doesn't. A "near-failure" is operationally identical
to a pass — neither changes what a reviewer does next — so there is no
"amber" tier. `stryker.config.mjs` therefore collapses `thresholds.high`,
`thresholds.low`, and `thresholds.break` onto the same value; the HTML and
clear-text reporters then render the score as pure green-or-red, with no
intermediate "passing but cautionary" colour to interpret.

| Threshold | Value | Behaviour |
| :-------- | :---- | :-------- |
| `break` (= `low` = `high`) | **70** | **Hard fail floor** — CI exits non-zero when the score is below this value (no `continue-on-error`). At or above, the PR passes the gate. |

The floor is calibrated so existing P1 tests can pass it without
rewriting every assertion, while still rejecting tests that merely call
code without inspecting outputs. Tightening the floor post-v1.0.0 is
tracked separately.

### Runner & Runtime

The Stryker config (`frontend/stryker.config.mjs`) drives the
`@stryker-mutator/vitest-runner` against `vitest.config.p1.ts` — the same
isolated, pure-Node configuration that powers `pnpm --filter frontend test:p1`.
This keeps mutation runs framework-free (no Vue, no Pinia, no jsdom) so the
score reflects the math, not the UI shell.

Typical local runtime is in the order of minutes — the run is single-shot,
not interactive. The CI gate is intentionally allowed to be slow (it runs as
its own job and does not block faster gates).

### Running Locally

```bash
# Full P1 mutation run (writes HTML report to frontend/reports/mutation/)
pnpm --filter frontend test:mutation

# Inspect the survivor report
open frontend/reports/mutation/mutation.html  # or your platform equivalent
```

For every surviving mutant, the HTML report shows the source line and the
mutation that escaped — typically the fix is to add or sharpen a test
assertion rather than change the math.

### CI Integration

`.github/workflows/mutation.yml` runs `pnpm --filter frontend test:mutation`
(with `--reporters dots,clear-text,html` for quiet CI logs) on PRs targeting
`develop` and `main`, gated by a small `paths-filter` pre-job:

| PR target branch | Run policy |
| :--------------- | :--------- |
| `main` | **Always run.** Releases ship from `main`, so the mutation score is re-verified as the last quality gate before production regardless of which files the PR touches. |
| `develop` | **Run only when the diff touches paths that can change the score:** `frontend/src/core/**`, `frontend/stryker.config.mjs`, `frontend/vitest.config.p1.ts`, `frontend/tsconfig.stryker.json`, `frontend/package.json`, `pnpm-lock.yaml`, or the workflow file itself. Other diffs (docs, P2/P3 UI tweaks, unrelated workflow polish) cannot move the score, so the expensive job is skipped. |

The step is **not** marked `continue-on-error`: a score below
`thresholds.break = 70` exits Stryker non-zero and fails the **P1 Mutation
Score** check on the PR. The HTML report is uploaded as the
`mutation-report` artifact (14-day retention) so reviewers can triage
survivors even when the gate has just failed.

The `deploy-reports.yml` workflow continues to publish the latest Stryker
HTML report from `main` for visibility — see the
[CI Reports page](https://naturelle137.github.io/AeroDash/stryker/).

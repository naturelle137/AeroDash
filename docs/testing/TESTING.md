# AeroDash Testing Guidelines

AeroDash operates under a **"Safety-First"** philosophy. A bug in our core logic could lead to incorrect pre-flight calculations and immediately compromise a flight. Therefore, our testing standards are exceptionally rigorous and strictly enforced.

Before submitting a Pull Request, all code must meet the following guidelines.

---

## 🏗️ 1. The Three Tiers of Testing

We utilize a standard testing pyramid, but with strict definitions regarding what belongs where.

### 1.1 Unit Tests (The Mathematical Proofs)

* **Scope:** Individual functions, classes, and atomic algorithms.
* **Rule:** Must execute in absolute isolation. No network calls, no database access, no reading from the local disk.
* **Focus:** Mathematical precision, boundary conditions (what happens exactly at Maximum Takeoff Mass?), and extreme edge cases.

### 1.2 Integration Tests (The Handshake)

* **Scope:** Interaction between two or more internal modules (e.g., the User Interface passing data to the Mass & Balance calculator).
* **Rule:** Can interact with a local test database or mocked internal services, but **must never** hit a real, external live API over the internet.
* **Focus:** Ensuring data contracts between P1 (Safety Core) and P2/P3 modules are respected.

### 1.3 End-to-End (E2E) Tests (The User Journey)

* **Scope:** The entire application stack simulating a real pilot's workflow.
* **Rule:** Should follow the exact steps outlined in the `docs/journeys/` directory.
* **Focus:** System integration and holistic User Experience workflows.

---

## 🎯 2. Minimum Coverage Requirements (Risk-Based)

Our coverage requirements correlate directly to the Priority (P1, P2, P3) of the code being written. CI gates will automatically reject Pull Requests that drop coverage below these thresholds.

* **P1 - Safety Core (e.g., Mass & Balance, Flight Performance)**
  * **Requirement:** **100%** Line, Branch, and Function coverage.
  * *Rationale:* There is zero margin for error. Every single mathematical path must be verified.
* **P2 - Operational Logic (e.g., Weather Parsing, Route APIs)**
  * **Requirement:** **80%** coverage minimum.
  * *Rationale:* Failures here are highly inconvenient and degrade the tool, but they should be caught by safety boundaries before impacting P1 calculations.
* **P3 - User Interface & Pure Aesthetics**
  * **Requirement:** Best effort (typically 60%+), prioritizing critical user input components.
  * *Rationale:* A visual glitch is acceptable; an incorrect underlying number is not.

### E2e / Journey Coverage Policy

Beyond line/branch/function coverage percentages, the following rules govern what must be verified at the e2e (User Journey) level:

| Rule | What | Why |
| :--- | :--- | :--- |
| **P1 REQ Coverage** | All reachable P1 REQs with user-observable behaviour must be tagged in ≥1 UJ | Safety-critical paths must be verified end-to-end |
| **Hazard Indirect Coverage** | Every hazard (H-xxx) must have ≥1 mitigating REQ tagged in a UJ | Ensures the full safety chain is testable |
| **Algorithm Exception** | Internal algorithm REQs (e.g., PF-002 Bilinear Interpolation) may be unit-test-only | The algorithm is not user-observable; its outputs are tested via the consuming UJs |
| **UQ Exception** | Cross-cutting quality attributes (UQ-001–004: touch, responsive, decimal, rounding) use QA test suites | Too fragile and broad as individual e2e assertions |

The full safety traceability chain is:

```text
Hazard (H-xxx) → Requirement (REQ-xxx) → User Journey (UJ-xxx) → E2e Test (E2E-xxx)
```

For the journey coverage rules and tag format, see [`docs/journeys/README.md`](../journeys/README.md).

---

## 🎭 3. Strict Mocking Guidelines for Aviation Data

Real-world aviation data is incredibly dynamic. A METAR changes every 30-60 minutes. An aircraft's physical weight distribution changes over time. To keep our tests **deterministic** and reliable, you must mock external dependencies.

1. **Weather (METAR/TAF):** When testing how the application reacts to crosswinds, you must feed the function a hardcoded, mocked METAR string (e.g., `EDDF 201420Z 23015G25KT...`). Never allow a test to execute an active fetch request to aviationweather.gov.
2. **Location/GPS:** Any feature relying on the user's location must be tested against a static coordinate fixture.
3. **Aircraft Profiles:** Use standard "Test Aircraft" profiles (stored in `tests/fixtures/`) that have pre-calculated, verified performance envelopes. Do not construct arbitrary aircraft limits inside a specific unit test.

---

## 🚦 4. Running the Tests Locally

*(This section will be expanded once the technology stack is finalized).*

Before pushing to your branch or opening a PR, ensure you have run the full local test suite:

```bash
# TBD: The command to run the test suite and output a coverage report.
# Example: npm run test:coverage OR pytest --cov
```

If your changes cause the coverage to dip below the required threshold, the CI pipeline **will fail your build**.

---

## 🔗 5. Traceability Engine Tags

To fulfill our Docs-as-Code safety obligations, every unit, integration, and E2E test file must include a traceability tag associating the test directly with a specific Code Implementation or User Journey.

You must place a `shtracer` comment inside your test files.

* Example matching to Implementation: `// @TC-SYS-001@ (FROM: @IMP-SYS-001@)`
* Example matching to a Journey: `// @TC-SYS-002@ (FROM: @UJ-STRESS-001@)`

This acts as the final verification link in our Master Traceability Matrix, permanently proving that the mitigations required by a safety hazard are verified in code.

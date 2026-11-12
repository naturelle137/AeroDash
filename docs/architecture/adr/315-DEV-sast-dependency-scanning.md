# 315-DEV-sast-dependency-scanning: SAST and Dependency Scanning Strategy

* **Status:** Accepted
* **Date:** 2026-04-01

## Context

AeroDash is a safety-advisory tool for General Aviation pilots. Third-party
NPM packages are a primary supply-chain attack surface: a compromised or
vulnerable dependency could silently alter computed pre-flight values or
exfiltrate sensitive flight data. We need automated, continuous scanning
for both:

1. **SAST (Static Application Security Testing):** Detect code-level
   vulnerabilities, dangerous patterns, and code smells in our own
   TypeScript/JavaScript source.
2. **Dependency Scanning:** Track known CVEs in direct and transitive NPM
   dependencies and provide actionable upgrade PRs before vulnerabilities
   reach production.

The issue (#29) explicitly names SonarQube, CodeQL, Snyk, and `npm audit`
as candidates.

## Decision

We adopt a **three-layer, zero-external-account** strategy:

| Layer | Tool | Purpose |
| :--- | :--- | :--- |
| SAST | CodeQL | Source-code vulnerability detection on every PR |
| Dependency audit | `pnpm audit` | Immediate CVE check in the existing CI run |
| Proactive updates | Dependabot | Automated upgrade PRs for npm + Actions |

**Rationale:**

* CodeQL + Dependabot are fully native to GitHub, requiring no secrets,
  external accounts, or third-party data egress. This aligns with our
  offline-first and supply-chain-security posture (see ADR-305-DEV).
* `pnpm audit` provides instant, in-pipeline feedback with no extra
  infrastructure.
* SonarQube/Snyk are deferred: they can be re-evaluated when the project
  grows a backend surface that benefits from more advanced SAST rules or
  container scanning.
* CodeQL runs in the JavaScript language family which covers both
  TypeScript and JavaScript without additional configuration.

## Consequences

### Positive

* **Zero external dependencies:** No secrets to rotate, no third-party
  dashboards to monitor, no additional account management.
* **PR-level blocking:** CodeQL results and `pnpm audit` failures surface
  as required status checks before any code can merge to `develop` or
  `main`.
* **Proactive posture:** Dependabot raises upgrade PRs before vulnerabilities
  are exploited, reducing the window of exposure.
* **Free for the project's lifetime:** All three tools are free for public
  GitHub repositories.

### Negative

* **CodeQL scan duration:** Full CodeQL analysis adds approximately 2–5
  minutes to the CI runtime. Mitigated by running only on PRs and pushes
  to protected branches, not on every feature-branch push.
* **False-positive noise:** CodeQL can flag patterns that are safe in
  context. Engineering judgement is required to triage alerts.
* **Dependabot PR volume:** Weekly scanning may generate a steady stream of
  dependency-bump PRs. Mitigated by grouping minor/patch updates.

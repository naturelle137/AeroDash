# 318: Dependency major-version policy

## Context

New major or prerelease dependencies can change schema, numerical, build and test-runner behavior. A clean vulnerability scan does not prove API compatibility or calculation correctness. Installed versions belong in package manifests and the lockfile; historical ecosystem-version tables are not maintained here.

## Decision

Before adopting a new major, prerelease or recently introduced ecosystem peer, record why it is needed, upstream compatibility constraints, runtime versus tooling exposure and a bounded regression plan in the PR/ADR. Retention of an exceptional line needs a concrete reason and review trigger; do not upgrade merely for novelty or silently downgrade without checking compatibility.

Preserve frozen-lock installs and meaningful P1 unit/coverage, isolation, mutation, integration and build checks. Schema/unit changes need numerical/reference cases; browser-facing dependencies need Chromium flow tests. Run the actual security checks (audit, OSV, CodeQL and SBOM as configured); distinguish advisory results from enforced gates and investigate dependency paths before selecting fixes.

## Consequences

Security fixes and justified upgrades remain possible without maintaining a second version registry. Required checks cannot be weakened to accept an upgrade. Record concrete residual risks and test exclusions; dependency scans alone do not validate aviation behavior.

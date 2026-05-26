# Dependency Management & Licensing Policy

AeroDash **source code** is licensed under **EUPL-1.2** (see root `LICENSE`). **Documentation** in this repository (for example under `docs/` and root Markdown guides) is licensed under **CC BY-SA 4.0** (see `LICENSE-DOCUMENTATION`). All third-party **software** dependencies — libraries, assets bundled as code, fonts, and data consumed by the application — must be license-compatible with the EUPL-1.2 code you combine them with. This document defines the approved licenses, the vetting process, and the current dependency inventory.

---

## Approved Licenses

### Software Dependencies (npm packages, submodules, tools)

| Status | Licenses |
| :--- | :--- |
| ✅ **Approved** | MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, Unlicense, GPL-3.0, AGPL-3.0, LGPL-3.0, EUPL-1.2 |
| ⚠️ **Review Required** | LGPL-2.1, MPL-2.0, GPL-2.0-or-later |
| ❌ **Prohibited** | GPL-2.0-only, JSON License, SSPL, proprietary, no-license / unlicensed |

### Asset Dependencies (icons, images, fonts, map data)

| Status | Licenses |
| :--- | :--- |
| ✅ **Approved** | CC0 (Public Domain), CC BY 3.0, CC BY 4.0, CC BY-SA 4.0, OFL (SIL Open Font License) |
| ⚠️ **Review Required** | CC BY-SA 3.0 (older share-alike terms) |
| ❌ **Prohibited** | CC BY-NC (any version), CC BY-ND (any version), CC BY-NC-ND (any version), proprietary |

### Rationale for Key Decisions

- **GPL-3.0 / AGPL-3.0:** Compatible for inbound dependencies — both are listed as Compatible Licences in the EUPL-1.2 Appendix.
- **EUPL-1.2:** This is the copyleft applied to AeroDash **source code**; its Appendix lists several reciprocal licences (including GPL and AGPL) as compatible when distributing combined works under the appropriate terms.
- **GPL-2.0-only:** Prohibited — cannot be upgraded to GPL-3.0, which blocks predictable compatibility with EUPL-1.2 copyleft distribution in common combined-work scenarios.
- **JSON License:** Prohibited — the clause *"shall be used for Good, not Evil"* is legally undefined. Rejected by Debian, Fedora, and Google. Use alternatives (e.g., `json5` under MIT).
- **CC BY-NC:** Prohibited — "Non-Commercial" conflicts with open-source freedom; prevents commercial forks.
- **CC BY-ND:** Prohibited — "No Derivatives" prevents modifying assets (e.g., recoloring icons).

---

## Vetting Process

Before adding any new dependency to the project, verify:

1. **License:** Must be on the approved list above. If "Review Required", open a discussion in the PR.
2. **Maintenance:** Package must be actively maintained (commits within the last 12 months).
3. **Security:** No known critical CVEs. Run `npm audit` or check via Snyk / GitHub Advisories.
4. **Dependency Footprint:** Avoid packages with excessive transitive dependencies.
5. **P1 Restriction:** Safety Core (P1) modules prefer zero external runtime dependencies.
6. **Inventory:** Add the dependency to the Current Dependencies table below in the same PR.
7. **Major-version policy:** If the dependency is on a *bleeding-edge* major (pre-release line, or a major cut <~6 months ago whose ecosystem peers still pin the previous major), it must be recorded in the per-major decision matrix in [ADR 318-DEV — Dependency Major Version & Pre-release Policy](docs/architecture/adr/318-DEV-dependency-major-policy.md), with a named justification, a pinned regression suite, and a downshift target. PRs introducing such a dependency must edit that ADR in the same commit.

---

## Current Dependencies

### Software

| Package | Version | License | Purpose | Scope |
| :--- | :--- | :--- | :--- | :---: |
| markdownlint-cli2 | ^0.21.0 | MIT | Markdown linting | Dev |
| husky | ^9.x | MIT | Git hooks (pre-commit, commit-msg) | Dev |
| @commitlint/cli | ^19.x | MIT | Commit message linting | Dev |
| @commitlint/config-conventional | ^19.x | MIT | Conventional commit rules | Dev |
| shtracer | submodule | MIT | Traceability engine | Dev |

### Assets

*No third-party assets integrated yet. This table will be populated when icons, fonts, or images are added.*

| Asset | Source | License | Purpose |
| :--- | :--- | :--- | :--- |
| — | — | — | — |

---

## Future Automation

Once AeroDash has runtime dependencies (`src/`), automated license checking will be added:

- **CI (GitHub Action):** `license-checker --failOn "GPL-2.0;SSPL;UNLICENSED"` on PRs targeting `main`.
- **Not a Husky hook:** License scanning walks the full dependency tree — too slow for local pre-push.

See also: [ADR 308-DEV](docs/architecture/adr/308-DEV-traceability-engine.md) for the traceability automation approach.

## Major-Version & Supply-Chain Policy

Dependency *major version* governance and the supply-chain scan rotation are tracked together:

- [ADR 315-DEV — SAST & Dependency Scanning](docs/architecture/adr/315-DEV-sast-dependency-scanning.md) — CodeQL + `pnpm audit` + Dependabot, the baseline scan triple.
- [ADR 318-DEV — Dependency Major Version & Pre-release Policy](docs/architecture/adr/318-DEV-dependency-major-policy.md) — when a bleeding-edge major is admitted, what justification, regression suite, and downshift target must be recorded, plus the current per-package decision matrix.

The matrix in ADR 318-DEV is the single source of truth for "why is package X on a bleeding-edge line?". When a PR bumps a dependency to a pre-release / very-recent major, that ADR must be updated in the same commit.

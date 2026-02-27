# Dependency Management & Licensing Policy

AeroDash is licensed under **AGPL-3.0**. All third-party dependencies — software libraries, assets, fonts, and data — must be license-compatible. This document defines the approved licenses, the vetting process, and the current dependency inventory.

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

- **GPL-3.0 / AGPL-3.0:** Compatible — AGPL §13 explicitly allows combining with GPL-3.0 works.
- **EUPL-1.2:** Compatible — its Appendix lists GPL-3.0 and AGPL-3.0 as compatible licenses. Relevant for EU-funded aviation tools and data.
- **GPL-2.0-only:** Prohibited — cannot be upgraded to GPL-3.0, making it incompatible with AGPL-3.0.
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

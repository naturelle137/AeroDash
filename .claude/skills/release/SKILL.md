---
name: release
description: Prepare and publish an AeroDash release through normal reviewed product PRs and functional gates.
---

# Release

Follow AGENTS.md, CONTRIBUTING and repository protection. Read the actual candidate diff, dated changelog and current checks.

1. Prepare the release branch/version using the repository’s existing release tooling. Move Unreleased entries to the dated release section. Do not invent completed features or aviation data validation.
2. Write [release notes](release-notes.md) describing user-visible results, important fixes and known limits. Preserve bilingual README and legal terms.
3. Run applicable lint, unit, integration, P1, build, browser and security gates. Record actual results, excluded scenarios and unresolved blockers.
4. Use one independent review of the complete release change, one fix round at most and green required CI. Publish only within the authorized release scope; never bypass protection or self-approve.
5. Tag/release from main using the existing tooling, then back-merge to develop through a PR. Report the actual published version and limitations.

---
name: release-audit
description: Assess actual release-blocking technical, security, privacy and UX defects with evidence.
---

# Release readiness

Read AGENTS.md, the candidate diff, requirements, calculation contracts and existing validation. Inspect concrete technical, security, privacy and UX risks using the corresponding audit agents where useful; do not launch overlapping jobs or duplicate review.

Report only evidenced defects and relevant limitations. A source file or checkmark is not proof of a passed workflow. Preserve P1 isolation, validated inputs, source/reference cases and security checks. Keep synthetic test success separate from operational POH validation.

Fix real blockers with bounded scope and meaningful regression tests. P1 behavior changes need documented formulas, units and boundary expectations. Add an Unreleased changelog entry per CONTRIBUTING §6; use signed Conventional Commits with hooks enabled. One independent fresh-session review, one fix round at most and green required CI govern integration. No mandatory trace attestation or repeated final-head review.

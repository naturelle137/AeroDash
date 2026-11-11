# 317-DEV-autonomous-ai-contribution: Autonomous AI Contribution via Claude Code GitHub Action

* **Status:** Superseded by [ADR-319](319-DEV-agent-review-governance.md)
* **Date:** 2026-05-24

## Historical decision

The proposed GitHub Actions implementation/review/correction loop required human
Lead Developer review and delegated no integration authority to agents. Those
operational rules are superseded by ADR-319 and must not guide current work.

The existing workflows remain legacy optional automation. Their safety gates,
bounded effort and fork/secret restrictions remain; current operation and overlap
are documented in the [operator guide](../../development/autonomous-implementation.md).

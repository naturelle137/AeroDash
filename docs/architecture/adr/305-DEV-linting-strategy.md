# 305-DEV-linting-strategy: Unified Linting Strategy (Markdown)

* **Status:** Accepted
* **Date:** 2026-02-22

## Context

AeroDash is a documentation-heavy project (Requirements, Architecture ADRs, Test Manuals, Just Culture guidelines). Inconsistent formatting can cause broken links, malformed tables, and generally reduced readability. We need a way to programmatically enforce quality on our Markdown files.
This ADR sets the precedent for our *Unified Linting Strategy*, which will be expanded to other languages (like Python or JavaScript/TypeScript) as the project architecture solidifies.

## Considered Options

To implement a robust and fast markdown linting strategy, we evaluated several options:

*   **Option 1: markdownlint-cli2**
    An evolution of `markdownlint-cli`, this tool is extremely fast, highly configurable via standard `.markdownlint.json`, natively bridges to VS Code extensions, and supports auto-fixing common issues locally.

*   **Option 2: GitHub Super-Linter**
    A container-based GitHub Action that runs dozens of linters concurrently. While comprehensive, the Docker image is massive (~4GB), making local execution slow and cumbersome. It violates our desire for "fast feedback".

*   **Option 3: markdown-link-check**
    A tool specifically designed to extract and test HTTP links inside Markdown. While useful for preventing "link rot", it doesn't enforce stylistic or document structural rules (like proper heading hierarchies or spacing), which means it does not solve formatting inconsistency.

## Decision

We have decided to adopt **markdownlint-cli2** as our primary Markdown linting engine.

We will enforce a dual-tier execution strategy via GitHub Actions to maintain developer velocity without compromising production safety:
1. **Incremental Scans:** On every commit (`push`) to feature branches, and on merges to `develop`, the CI runs `markdownlint-cli2` *only* on the files modified in that commit. This uses the secure `step-security/changed-files@v1` drop-in to prevent supply chain injection vulnerabilities.
2. **Full Repository Scans:** On Pull Requests targeting `main` (a Release candidate), the linter will scan *all* Markdown files in the repository to guarantee a 100% compliant state for tagged production releases.

## Consequences

### Positive
*   **Speed:** Running linting only on changed files for everyday commits takes seconds instead of minutes.
*   **Consistency:** PR reviewers no longer need to comment on formatting issues; the machine catches them.
*   **Supply Chain Security:** We depend strictly on trusted, pinned/signed GitHub Actions for determining modified file lists.
*   **Extensible:** The JSON configuration format provides a clear path forward for other linting technologies.

### Negative
*   **Initial Setup Friction:** Establishing the baseline will yield thousands of minor trailing whitespace and formatting warnings on legacy documents which must be cleaned up manually before enforcing the tool.
*   **Strictness:** Some contributors may be annoyed by having to conform to strict Markdown specifications for trivial text files.

## Compliance
n/a

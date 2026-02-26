# 308-DEV: Traceability Engine Evaluation

* **Status:** proposed
* **Date:** 2026-02-22

## Context

Pursuant to ADR 307-DEV, AeroDash requires a Master Traceability Matrix (MTM) enforcing a rigorous chain from Hazards to Code. To achieve this via a Docs-as-Code paradigm, we require a parsing engine capable of reading our Markdown requirement files and verifying their matching implementation tags in the project source code.

This engine must automatically flag "Pending Implementations" (requirements with no code tags) and "Orphaned Implementations" (code tags referencing non-existent requirements) during local development and CI gates.

## Considered Options

1. **Custom Scripts (Node.js/Regex)**
   * *Pros:* Fully tailored to the exact repository layout with zero external dependencies.
   * *Cons:* Extremely high maintenance burden. Regex-based parsing is brittle and lacks the robust error-reporting of established engines.
2. **shtracer**
   * *Pros:* Extremely lightweight. Operates perfectly with our existing Markdown requirements using HTML comment tags (e.g., `<!-- @REQ-SYS-001@ (FROM: @H-001@) -->`). Easy to drop into GitHub Actions.
   * *Cons:* Relies on regular expressions rather than Abstract Syntax Tree (AST) parsing, making it less intelligent regarding finding exact function/class scope bounds.
3. **StrictDoc**
   * *Pros:* Industrial-strength traceability validation. It uses a custom SDoc DSL for extensive metadata and offers AST-level parsing to recognize specific programmatic entities (classes/functions) rather than arbitrary line texts. Natively prevents requirement drift with extreme precision.
   * *Cons:* AST capabilities are primarily built around Python, C, C++, and Rust. Since AeroDash is primarily built on a JavaScript/Node.js technical stack, StrictDoc would lose its native AST advantages and effectively behave as an advanced regex parser while introducing a massive Python dependency graph to the project.

## Decision

We will proceed with **shtracer** as our primary Docs-as-Code Traceability Engine for the 0.1.0-pre-alpha release.

While StrictDoc's AST parsing represents the absolute gold standard for safety-critical traceability, AeroDash's JS ecosystem renders its best features inaccessible. `shtracer` aligns perfectly with our need for a rapid, lightweight, Markdown-native engine that can run instantly via local Husky hooks and GitHub Actions.

If AeroDash expands to include safety-critical Python or Rust backend services in the future, we will escalate to StrictDoc for those modules.

## Consequences

### Positive

* Requirements remain in standard, universally readable Markdown files rather than being forced into a proprietary DSL.
* Traceability checks will run extremely fast locally due to the lightweight nature of the tool.
* We establish automated CI gating (Orphaned/Pending checks) immediately.

### Negative

* Code-level traceability will rely on manual developer annotation comments (e.g., `// @IMP-SYS-001@ (FROM: @REQ-SYS-001@)`) within the JS files, rather than AST-aware function bounding.

## Compliance

This selection establishes the automated mechanism required to fulfill the safety compliance traceability chain mandated by ADR 307-DEV.

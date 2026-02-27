# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-pre-alpha] - 2026-02-27

Initial project foundation. This milestone establishes governance,
developer experience tooling, and the complete product documentation suite.
**No runtime code is included in this release.**

### Added

- Bilingual README and Disclaimer with intended use, system boundaries, PIC authority, and POH primacy clause

### Engineering

- Added full requirements suite (115 REQs across 12 modules), hazard analysis (19 hazards), and user journeys (22 UJs across 7 phases) as developer blueprints
- Added notification system design and domain glossary
- Added bilingual Code of Conduct with aviation Just Culture, contributing guidelines, dependency and licensing policy, and security vulnerability reporting
- Added Gitflow strategy with protected branch rules, PR template with safety and quality checklists, and issue templates (feature, bug, sub-task)
- Added Markdown linting (markdownlint-cli2 in CI), conventional commit enforcement (commitlint + husky hooks), and code ownership rules
- Added shtracer engine integration, automated HTML/JSON matrix generation, and GitHub Pages deployment on release

### Architecture Decision Records

- ADR 001: Notification System
- ADR 300–308 DEV: Documentation as Code, Branching Strategy, Contributing Guidelines, Ticket Workflow, Testing Guidelines, Linting Strategy, Local Hooks, Master Traceability Structure, Traceability Engine

[unreleased]: https://github.com/naturelle137/AeroDash/compare/v0.1.0-pre-alpha...HEAD
[0.1.0-pre-alpha]: https://github.com/naturelle137/AeroDash/releases/tag/v0.1.0-pre-alpha

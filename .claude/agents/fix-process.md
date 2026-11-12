---
name: fix-process
description: Correct concrete documentation, requirement and CI-process defects while preserving functional safeguards.
tools: Read, Edit, Write, Grep, Glob, Bash
---

# Process fixes

Read AGENTS.md and the affected files before editing. Fix actionable inconsistencies in requirements, ordinary links, commands, CI or contributor instructions. Keep requirements atomic and preserve future capabilities in the roadmap. Do not create registries, tag chains or attestation ceremonies.

Preserve useful security, privacy, UX, source-data and P1 safeguards. Test changed automation behavior; document actual checks. Use signed Conventional Commits such as `chore(repo): correct test command (refs #42)` or `docs(doc): clarify acceptance`. Keep hooks enabled and add a concise Unreleased changelog entry per CONTRIBUTING §6. Follow the one-review/one-fix-round rule in AGENTS.md.

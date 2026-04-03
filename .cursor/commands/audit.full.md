---
description: Repo full audit bundle
argument-hint: [scope-or-paths]
---

- cmd: `/audit.full`
- role: `Repo audit orchestrator`
- apply: `@.cursor/rules/audit-core.mdc`; `@.cursor/rules/audit-dp.mdc`; `@.cursor/rules/audit-cybersecurity.mdc`; `@.cursor/rules/audit-process.mdc`; `@.cursor/rules/audit-tech.mdc`; `@.cursor/rules/audit-ux.mdc`
- input: `$ARGUMENTS`
- input.empty: full repo
- run.order: `dp` | `cybersecurity` | `process` | `tech` | `ux`
- run.scope: same scope for all
- output: five reports | same order | no extra synthesis

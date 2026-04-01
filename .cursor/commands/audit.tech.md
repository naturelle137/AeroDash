---
description: Repo technical audit
argument-hint: [scope-or-paths]
---

- cmd: `/audit.tech`
- role: `Repo technical auditor`
- apply: `@.cursor/rules/audit-core.mdc`; `@.cursor/rules/audit-tech.mdc`
- input: `$ARGUMENTS`
- input.empty: full repo
- output: one `tech` report

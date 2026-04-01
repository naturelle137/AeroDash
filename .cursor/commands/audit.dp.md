---
description: Repo data privacy audit
argument-hint: [scope-or-paths]
---

- cmd: `/audit.dp`
- role: `Repo privacy auditor`
- apply: `@.cursor/rules/audit-core.mdc`; `@.cursor/rules/audit-dp.mdc`
- input: `$ARGUMENTS`
- input.empty: full repo
- output: one `dp` report

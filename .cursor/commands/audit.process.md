---
description: Repo development process audit
argument-hint: [scope-or-paths]
---

- cmd: `/audit.process`
- role: `Repo process auditor`
- apply: `@.cursor/rules/audit-core.mdc`; `@.cursor/rules/audit-process.mdc`
- input: `$ARGUMENTS`
- input.empty: full repo
- output: one `process` report

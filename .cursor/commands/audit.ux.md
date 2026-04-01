---
description: Repo UX audit
argument-hint: [scope-or-paths]
---

- cmd: `/audit.ux`
- role: `Repo UX auditor`
- apply: `@.cursor/rules/audit-core.mdc`; `@.cursor/rules/audit-ux.mdc`
- input: `$ARGUMENTS`
- input.empty: full repo
- output: one `ux` report

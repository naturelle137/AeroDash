---
description: Repo cybersecurity audit
argument-hint: [scope-or-paths]
---

- cmd: `/audit.cybersecurity`
- role: `Repo cybersecurity auditor`
- apply: `@.cursor/rules/audit-core.mdc`; `@.cursor/rules/audit-cybersecurity.mdc`
- input: `$ARGUMENTS`
- input.empty: full repo
- output: one `cybersecurity` report

---
name: e2e
description: Create, refactor or validate AeroDash Playwright BDD features and steps.
---

# E2E workflow

Read AGENTS.md, docs/testing/TESTING.md and [implementation rules](implementation-rules.md). Choose [business creation](create-business.md), [technical creation](create-technical.md), [refactoring](refactor.md) or [validation](validate.md).

Exercise user-observable behavior through the real application. Preserve functional Playwright tags such as `@smoke` and `@wip`. Synthetic aircraft must be labelled as test data; no live aviation APIs. Generated `.features-gen/` files are not authored source.

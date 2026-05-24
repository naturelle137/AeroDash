# E2E implementation rules (Playwright BDD)

Source-of-truth rules for `frontend/tests/e2e/steps/**/*.ts` step definitions. Imported by E2E creation and refactor operations.

- criticality: safety-critical aviation
- mode: strict correctness
- verbosity: no explanation unless asked

## Paths

- feature-dir: `frontend/tests/e2e/features/{phase}/`
- step-path-phase: `frontend/tests/e2e/steps/{phase}.steps.ts`
- step-path-common: `frontend/tests/e2e/steps/common.steps.ts`
- generated-path: `.features-gen/`
- generated-edit: forbidden
- technical-feature-dir: `frontend/tests/e2e/features/technical/`
- phase-slugs: STC only

## Step file layout

- step-file-count: 1 per domain group
- step-file-count-common: 1 shared file
- step-file-sharing: multi-feature allowed
- step-sharing-threshold: `>=2` phases -> common
- step-sharing-threshold: `1` phase -> phase file
- step-placement-common: shared reusable steps only
- step-placement-phase: phase-scoped steps only
- step-definition-uniqueness: global
- duplicate-step-definitions: forbidden
- feature-step-sources: common + matching phase file
- feature-without-steps: invalid

## Imports

required:
- `import { expect } from '@playwright/test'`
- `import { createBdd } from 'playwright-bdd'`
- `const { Given, When, Then } = createBdd()`

forbidden:
- BDD imports from `@playwright/test`
- any `frontend/src/` import

## Assertions

- then-expect: required
- assertions: locator assertions only
- preferred: `toBeVisible`, `toHaveText`
- absence: `.toHaveCount(0)`
- forbidden: `toBeTruthy`, `toBeDefined`

## Waits

- forbidden: `page.waitForTimeout`

## Locators

order: `getByRole` > `getByLabel` > `getByText` > `data-testid` > CSS

forbidden: visual classes, generated classes, XPath
- css-usage: semantic only; css-comment required

## State and helpers

- state-sharing: forbidden
- helpers: pure only
- step-calls: direct step-to-step forbidden

## Scope rules

- business-e2e: real UI only; mocking forbidden; interception forbidden
- technical-e2e: `page.request` allowed; console checks allowed; full UI flow optional
- concern-mixing: forbidden
- orphan-steps: forbidden
- missing-implementations: forbidden

## Step matching

- step-match: exact
- step-match-case: case-sensitive
- step-params: `{string}` | `{int}` | `{float}` only

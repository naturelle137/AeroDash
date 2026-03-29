---
description: Generate a complete technical or smoke E2E test slice (feature file + step definitions) for a system-level behavior
argument-hint: <system behavior description>
---

# /e2e.create-technical

You are a BDD test author for a safety-critical aviation application.

Your responsibility is generating a complete technical E2E test slice that validates system-level behavior, infrastructure health, or runtime availability.

You write:

- a `.feature` file with a `(TECHNICAL)` trace comment and `@smoke` or `@technical-e2e` tags
- a `.ts` step definition file with Playwright implementations that exactly match the generated Gherkin

You do not:

- require or accept a User Journey as input
- add `@UJ-xxx` or `@e2e` tags (both are reserved for business E2E)
- validate aviation domain outcomes (CG, MTOM, fuel endurance, mass limits)
- generate business E2E tests — if the description is a user-facing behavior, stop and redirect to `/e2e.create-business`
- repeat or restate the rules in `gherkin.mdc`, `traceability.mdc`, or `e2e-implementation.mdc` — those are always enforced

## Input Handling

Parse `$ARGUMENTS` as a natural-language description of the system-level behavior to verify.

Accepted examples:

- `/e2e.create-technical mass balance page loads without errors`
- `/e2e.create-technical service worker registers on application startup`
- `/e2e.create-technical API health endpoint returns 200`

If no argument is provided, stop and return only:
`Usage: /e2e.create-technical <system behavior description>`

## Classification Decision

Before generating output, classify the test. This classification determines tags and implementation style.

**`@smoke`** — the test verifies basic availability:

- A page loads and a critical UI element is visible
- The application starts without fatal errors
- A primary route is reachable

**`@technical-e2e`** — the test verifies deeper system-level state:

- A health or status API endpoint responds correctly
- The service worker registers and activates
- The browser console is free of runtime errors on startup
- A browser API (localStorage, IndexedDB, etc.) is available and operational
- A background sync or data-loading process completes

When ambiguous, prefer `@smoke` for fast-path availability checks and `@technical-e2e` for deeper runtime or infrastructure validation.

**Hard stop — reject and redirect if any of these apply:**

- The description references a business domain outcome (weight, balance, CG, fuel, navigation, aircraft limits)
- The description would be phrased naturally as a User Journey (a pilot wants to...)
- A persona is implied or stated

If any condition is met, stop and return:
`This describes a business E2E scenario. Use /e2e.create-business <UJ-ID> instead.`

## Required Workspace Discovery

Before generating output:

1. Determine the registry file:
   - `@smoke` → `trace/e2e/smoke.yaml` (create if absent)
   - `@technical-e2e` → `trace/e2e/technical.yaml` (create if absent)
2. Read the registry and find the highest existing numeric suffix. Assign the next sequential ID. Do not reuse deleted IDs.
   - Smoke ID format: `E2E-SMOKE-{NUMBER}`
   - Technical ID format: `E2E-TECH-{NUMBER}`
3. Check `frontend/tests/e2e/steps/technical/` for an existing steps file serving a similar technical domain. Prefer adding to an existing file.

## Feature File Generation

Place the file at `frontend/tests/e2e/features/technical/{kebab-name}.feature`.

For `@smoke`:

```gherkin
Feature: {System capability description — not user-facing language}

  # @E2E-SMOKE-{NUMBER}@ (TECHNICAL)
  @smoke @phase-D
  Scenario: {System state being verified}
    Given {system precondition}
    When {system event or trigger}
    Then {verifiable system-level outcome}
```

For `@technical-e2e`:

```gherkin
Feature: {Infrastructure or runtime capability description}

  # @E2E-TECH-{NUMBER}@ (TECHNICAL)
  @technical-e2e @phase-D @module-sys
  Scenario: {Infrastructure or runtime behavior being verified}
    Given {runtime environment precondition}
    When {the system is in the expected state}
    Then {the system exhibits the expected technical behavior}
```

Use system-level language: "the application", "the service worker", "the runtime", "the API endpoint". Do not use persona language ("the pilot") or aviation domain terms unless verifying that domain data loads at a system level.

Do not add `@wip` unless the capability is genuinely not yet implemented.

## Step Definition File Generation

Place the file at `frontend/tests/e2e/steps/technical/{kebab-domain}.steps.ts`, or add to an existing file for the same domain.

Open with:

```typescript
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()
```

Technical step implementations may use:

- `page.goto('/')` and `expect(locator).toBeVisible()` for smoke checks
- `page.request.get('/health')` and `expect(response.ok()).toBe(true)` for API health
- `page.on('console', msg => ...)` for console error capture
- `page.evaluate(() => ...)` for browser API introspection

Every `Then` handler must include at least one `expect()` assertion. Do not hardcode aviation domain data (registrations, weights, station values) in technical step files.

Do not place any `@E2E-xxx@` trace tags in the `.ts` file.

## Registry Update

Append to `trace/e2e/smoke.yaml` or `trace/e2e/technical.yaml`:

```yaml
  E2E-{DOMAIN}-{NUMBER}
    title: {Scenario title}
    files:
      - frontend/tests/e2e/features/technical/{filename}.feature
```

## Output

Return in this order:

1. The classification decision (`@smoke` or `@technical-e2e`) and a one-line justification
2. The complete `.feature` file content with its path
3. The complete `.ts` step definition content (new file or added sections) with its path
4. The registry entry added
5. The assigned E2E ID

No preamble, no meta commentary.

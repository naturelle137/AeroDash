---
description: Generate a complete business E2E test slice (feature file + step definitions) from a User Journey
argument-hint: <UJ-ID or journey description>
---

# /e2e.create-business

You are a BDD test author for a safety-critical aviation application.

Your responsibility is generating a complete, traced business E2E test slice.

You write:

- a `.feature` file with correct trace comments, execution tags, and Gherkin scenarios
- a `.ts` step definition file with Playwright implementations that exactly match the generated Gherkin

You do not:

- invent behavior not described in the User Journey
- generate Gherkin-only output without the corresponding step definitions
- create technical or smoke tests (redirect the user to `/e2e.create-technical` for those)
- repeat or restate the rules in `gherkin.mdc`, `traceability.mdc`, or `e2e-implementation.mdc` — those are always enforced

## Input Handling

Parse `$ARGUMENTS` as:

- `UJ-ID` — a User Journey identifier (e.g., `UJ-B-005`), or
- a natural-language description of the journey to test

Accepted examples:

- `/e2e.create-business UJ-B-005`
- `/e2e.create-business pilot verifies fuel endurance before departure`

If the argument is a natural-language description without a UJ ID, ask the user to confirm the UJ ID before proceeding. Do not guess.

If no argument is provided, stop and return only:
`Usage: /e2e.create-business <UJ-ID or journey description>`

## Required Workspace Discovery

Before generating any output, read and extract the following:

1. Locate the journey document from `docs/journeys/` that contains the provided UJ ID. The filename maps to phase: `01_fleet_management.md` → A, `02_flight_preparation.md` → B, `03_performance_safety.md` → C, `04_system_usability.md` → D, `05_weather_environment.md` → E, `06_fuel_endurance.md` → F, `07_onboarding_sync.md` → G.
2. Read the UJ section and extract:
   - Journey title → Feature name
   - Upstream REQs → from the trace comment `<!-- @UJ-xxx@ (FROM: @REQ-xxx@, ...) -->`
   - Persona, goal, outcome → Feature narrative
   - Journey table rows → Given / When / Then mapping (User Action → `When`; Observable System Reaction → `Then`; Context / initial state → `Given` or Background)
   - Phase letter → `@phase-{LETTER}` tag
   - Domain module → `@module-{MODULE}` tag (infer from the domain context using STC §1.3)
3. Read the E2E registry for the phase (`trace/e2e/{phase-slug}.yaml`) and find the highest existing numeric suffix. Assign the next sequential ID. Do not reuse deleted IDs.
4. Check `frontend/tests/e2e/features/phase-{letter}-{phase-slug}/` for existing feature files in this phase. Determine whether the new scenario belongs in an existing file or requires a new one.
5. Check `frontend/tests/e2e/steps/` for an existing steps file serving this feature domain. Prefer adding to an existing file over creating a new one.

If the UJ cannot be found in `docs/journeys/`, stop and return:
`Blocked: UJ <ID> not found in docs/journeys/. Verify the ID or create the journey first.`

## Feature File Generation

Place the file at `frontend/tests/e2e/features/phase-{letter}-{phase-slug}/{kebab-scenario-name}.feature`.

Structure:

```gherkin
@wip
Feature: {Title from UJ goal — user-facing, present tense}
  As a {persona}
  I want to {goal}
  So that {outcome}

  Background:
    Given {shared precondition all scenarios require}

  # @E2E-{PHASE}-{NUMBER}@ (FROM: @UJ-{ID}@)
  @UJ-{ID} @phase-{LETTER} @e2e @module-{MODULE} @happy-path @wip
  Scenario: {Specific testable outcome}
    Given {precondition}
    When {user action}
    And {follow-on action}
    Then {observable system reaction}
    And {additional verifiable outcome}
```

Each significant branch in the journey table that represents a distinct behavioral outcome becomes a separate Scenario, not a single linear flow.

Do not use UI mechanics ("click", "select dropdown", "fill in"), CSS vocabulary, or technical jargon in any step text. Steps must be readable by a non-developer domain expert.

Do not add `@business` — `@e2e` alone marks business scope.

## Step Definition File Generation

Place the file at `frontend/tests/e2e/steps/{kebab-domain-name}.steps.ts`, or add to an existing file for the same domain.

Every step text in the generated `.feature` must have a matching handler. Every handler must have its step text match the Gherkin exactly, including typed parameters (`{string}`, `{int}`, `{float}`).

Open with:

```typescript
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()
```

Group handlers under section comments that identify the UJ:

```typescript
// ─── Background ────────────────────────────────────────────────────────────────

// ─── When steps — {Scenario name} ({UJ-ID}) ────────────────────────────────────

// ─── Then steps ────────────────────────────────────────────────────────────────
```

Every `Then` handler must include at least one `expect()` assertion. Use `getByRole` and `getByLabel` locators before falling back to CSS selectors.

Do not place any `@E2E-xxx@` or `@UJ-xxx@` trace tags in the `.ts` file.

## Registry Update

Append to `trace/e2e/{phase-slug}.yaml`:

```yaml
  E2E-{PHASE}-{NUMBER}
    title: {Scenario title}
    files:
      - frontend/tests/e2e/features/phase-{letter}-{phase-slug}/{filename}.feature
```

## Output

Return in this order:

1. The complete `.feature` file content with its path
2. The complete `.ts` step definition content (new file or added sections) with its path
3. The registry entry added to `trace/e2e/{phase-slug}.yaml`
4. The assigned E2E ID

No preamble, no meta commentary.

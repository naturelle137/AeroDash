// E2E Before hook — seeds the IndexedDB fleet with the pre-existing aircraft the
// Mass & Balance journeys select. Scoped to `@module-mb` scenarios so only the
// flows that `select aircraft "D-…"` a pre-seeded registration pay the cost
// (refs #294). The four math journeys (happy-path, overweight-discovery,
// burnout-check, burn-sequence-polygon) and the certification-category-switch
// flow all carry the `@module-mb` tag.
//
// The fleet/IndexedDB is isolated per Playwright browser context, so the seed
// is fresh for every scenario and never leaks into the wizard-creation flows
// (which deliberately start from an empty fleet).

import { createBdd } from 'playwright-bdd'
import { seedFleet, MB_E2E_FLEET } from '../fixtures/fleet-seed'

const { Before } = createBdd()

Before({ tags: '@module-mb' }, async ({ page }) => {
  await seedFleet(page, MB_E2E_FLEET)
})

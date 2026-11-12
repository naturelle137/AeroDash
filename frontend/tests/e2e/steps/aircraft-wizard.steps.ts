// Step definitions for aircraft-wizard-creation.feature and decimal-input-precision.feature
// E2E trace tags live in the .feature file only (STC §B.3 / §3.4).

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { TEST_AIRCRAFT } from '../fixtures/test-aircraft'

const { Given, When, Then } = createBdd()

// ─── Navigation helpers ────────────────────────────────────────────────────

Given('the pilot navigates to the Fleet page', async ({ page }) => {
  await page.goto('/')
  // Use client-side navigation consistent with offline-smoke pattern
  const fleetLink = page.getByRole('link', { name: /Fleet|fleet/i }).first()
  await expect(fleetLink).toBeVisible()
  await fleetLink.click()
  await expect(page).toHaveURL(/fleet/)
  await expect(page.getByRole('main')).toBeVisible()
})

When('the pilot clicks {string}', async ({ page }, buttonText: string) => {
  // Use exact: false so "Continue" matches "Continue →" and similar decorated labels
  await page.getByRole('button', { name: buttonText, exact: false }).click()
})

// ─── Wizard opening ────────────────────────────────────────────────────────

Then('the wizard opens at Step 1 — Identity', async ({ page }) => {
  await expect(page).toHaveURL(/fleet\/new/)
  await expect(page.getByRole('heading', { name: /Step 1.*Identity/i })).toBeVisible()
})

// ─── Step 1: Identity ──────────────────────────────────────────────────────

When(
  'the pilot fills in the Identity step with registration {string}, manufacturer {string}, model {string}, ICAO {string}',
  async ({ page }, registration: string, manufacturer: string, model: string, icao: string) => {
    // Select manufacturer from dropdown
    await page.getByLabel('Manufacturer').selectOption(manufacturer)

    // Select model from dropdown (it becomes enabled after manufacturer selection)
    const modelInput = page.locator('#model-input')
    // Model may be a <select> or <input> depending on manufacturer
    const tagName = await modelInput.evaluate((el) => el.tagName.toLowerCase())
    if (tagName === 'select') {
      await modelInput.selectOption({ label: model })
    } else {
      await modelInput.fill(model)
    }

    // Fill registration
    await page.getByLabel('Registration').fill(registration)

    // Fill ICAO designator — clear first in case auto-filled by model selection
    const icaoInput = page.getByLabel('ICAO Type Designator')
    await icaoInput.clear()
    await icaoInput.fill(icao)
  },
)

Then('the {string} button is enabled', async ({ page }, buttonText: string) => {
  // exact: false so "Continue" matches "Continue →", "Save as Draft" matches exactly, etc.
  const btn = page.getByRole('button', { name: buttonText, exact: false })
  await expect(btn).toBeVisible()
  await expect(btn).toBeEnabled()
})

Then('the {string} button is disabled', async ({ page }, buttonText: string) => {
  const btn = page.getByRole('button', { name: buttonText, exact: false })
  await expect(btn).toBeVisible()
  await expect(btn).toBeDisabled()
})

// ─── Step 2: Certification & Envelope ─────────────────────────────────────

Then('the wizard is on Step 2 — Certification and Envelope', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Step 2.*Certification/i })).toBeVisible()
})

When('the pilot sets MTOM to {string}', async ({ page }, value: string) => {
  // MTOM label includes "MTOM (Maximum Take-Off Mass)"
  const mtomInput = page.getByLabel(/MTOM.*Maximum Take-Off Mass/i)
  await mtomInput.clear()
  await mtomInput.fill(value)
  await mtomInput.dispatchEvent('input')
  await mtomInput.blur()
})

When('the pilot confirms there are already 4 envelope points', async ({ page }) => {
  // Default initialisation provides exactly 4 rows in the envelope table.
  // We just verify there are 4 rows without removing or adding.
  const removeButtons = page.getByRole('button', { name: '✕' })
  await expect(removeButtons).toHaveCount(4)
})

When('the pilot adds a fifth envelope point', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add Point' }).click()
  await expect(page.getByRole('button', { name: '✕' })).toHaveCount(5)
})

When('the pilot removes one envelope point', async ({ page }) => {
  await page.getByRole('button', { name: '✕' }).last().click()
})

Then('4 envelope points remain and none of them can be removed', async ({ page }) => {
  const removeButtons = page.getByRole('button', { name: '✕' })
  await expect(removeButtons).toHaveCount(4)
  for (const button of await removeButtons.all()) {
    await expect(button).toBeDisabled()
  }
})

Then('no envelope error message is visible', async ({ page }) => {
  await expect(page.getByRole('alert').filter({ hasText: /At least 4 points required/i })).toHaveCount(0)
})

// ─── Step 3: Weighing Reports ──────────────────────────────────────────────

Then('the wizard is on Step 3 — Weighing Reports', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Step 3.*Weighing/i })).toBeVisible()
})

When(
  'the pilot sets BEM to {string} and Empty CG to {string}',
  async ({ page }, bem: string, cg: string) => {
    const bemInput = page.getByLabel('BEM')
    await bemInput.clear()
    await bemInput.fill(bem)
    await bemInput.dispatchEvent('input')
    await bemInput.blur()

    const cgInput = page.getByLabel('Empty CG')
    await cgInput.clear()
    await cgInput.fill(cg)
    await cgInput.dispatchEvent('input')
    await cgInput.blur()
  },
)

// ─── Step 4: Load Stations ─────────────────────────────────────────────────

Then('the wizard is on Step 4 — Load Stations', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Step 4.*Load Stations/i })).toBeVisible()
})

When(
  'the pilot adds a seat station named {string} with arm {string}',
  async ({ page }, name: string, arm: string) => {
    await page.getByRole('button', { name: '+ Add Load Station' }).click()

    // The newly added station is the last one in the list.
    const stationRows = page.locator('.load-point-row')
    const lastRow = stationRows.last()

    const nameInput = lastRow.getByLabel('Station Name')
    await nameInput.fill(name)

    const armInput = lastRow.getByLabel('Arm')
    await armInput.clear()
    await armInput.fill(arm)
    await armInput.dispatchEvent('input')
    await armInput.blur()
  },
)

When(
  'the pilot adds a fuel tank station named {string}',
  async ({ page }, name: string) => {
    await page.getByRole('button', { name: '+ Add Fuel Tank' }).click()

    const stationRows = page.locator('.load-point-row')
    const lastRow = stationRows.last()

    const nameInput = lastRow.getByLabel('Station Name')
    await nameInput.clear()
    await nameInput.fill(name)
  },
)

// ─── Wind Limits ───────────────────────────────────────────────────

Then('the wizard is on Step {int} — Wind Limits', async ({ page }, step: number) => {
  await expect(page.getByRole('heading', { name: `Step ${step}: Wind Limits` })).toBeVisible()
})

// ─── Review & Save ─────────────────────────────────────────────────

Then('the wizard is on Step {int} — Review and Save', async ({ page }, step: number) => {
  await expect(page.getByRole('heading', { name: `Step ${step}: Review & Save` })).toBeVisible()
})

// ─── Post-save action chooser ──────────────────────────────────────────────

function savedDraftChooser(page: Page) {
  return page.getByRole('dialog', { name: 'Aircraft saved as draft' })
}

Then(
  'the saved-draft chooser offers {string}, {string} and {string}',
  async ({ page }, first: string, second: string, third: string) => {
    const dialog = savedDraftChooser(page)
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(/\/fleet\/new$/)
    for (const name of [first, second, third]) {
      await expect(dialog.getByRole('button', { name, exact: true })).toBeVisible()
    }
  },
)

When('the pilot chooses {string} in the saved-draft chooser', async ({ page }, action: string) => {
  await savedDraftChooser(page).getByRole('button', { name: action, exact: true }).click()
})

// ─── Post-save assertions ──────────────────────────────────────────────────

Then('the pilot is back on the Fleet page', async ({ page }) => {
  await expect(page).toHaveURL(/\/fleet$/)
  await expect(page.getByRole('heading', { name: /Aircraft Fleet Management/i })).toBeVisible()
})

Then(
  'the aircraft {string} is listed with a {string} status badge',
  async ({ page }, registration: string, status: string) => {
    const listItem = page.locator('.profile-item', { hasText: registration })
    await expect(listItem).toBeVisible()

    // ProfileStatusBadge renders with role="status" and aria-label="Profile status: Draft"
    const badge = listItem.getByRole('status', { name: new RegExp(status, 'i') })
    await expect(badge).toBeVisible()
  },
)

// ─── Owner ID absence assertion ────────────────────────────────────────────

Then(
  'no field labelled {string} or {string} is visible on the page',
  async ({ page }, label1: string, label2: string) => {
    // Check no label element contains either text
    await expect(page.getByLabel(label1)).toHaveCount(0)
    await expect(page.getByLabel(label2)).toHaveCount(0)
    // Also check for raw text visibility in case it appears as a static label
    await expect(page.getByText(label1, { exact: false })).toHaveCount(0)
    await expect(page.getByText(label2, { exact: false })).toHaveCount(0)
  },
)

// ─── Decimal input precision steps ────────────────────────────────────────

When(
  'the pilot types {string} into the BEM field and tabs away',
  async ({ page }, value: string) => {
    const bemInput = page.getByLabel('BEM')
    await bemInput.clear()
    await bemInput.type(value)
    await bemInput.press('Tab')
  },
)

Then('the BEM field retains the value {string}', async ({ page }, expected: string) => {
  const bemInput = page.getByLabel('BEM')
  // After blur the DecimalInput normalises comma → period for display
  const actual = await bemInput.inputValue()
  expect(actual).toBe(expected)
})

When(
  'the pilot types {string} into the Empty CG field and tabs away',
  async ({ page }, value: string) => {
    const cgInput = page.getByLabel('Empty CG')
    await cgInput.clear()
    await cgInput.type(value)
    await cgInput.press('Tab')
  },
)

Then('the Empty CG field retains the value {string}', async ({ page }, expected: string) => {
  const cgInput = page.getByLabel('Empty CG')
  const actual = await cgInput.inputValue()
  expect(actual).toBe(expected)
})

Then(
  'the arm field for station {string} retains the value {string}',
  async ({ page }, stationName: string, expected: string) => {
    // Find the load-point row that contains the station name
    const stationRows = page.locator('.load-point-row')
    const targetRow = stationRows.filter({ hasText: stationName })
    const armInput = targetRow.getByLabel('Arm')
    const actual = await armInput.inputValue()
    expect(actual).toBe(expected)
  },
)

// ─── Wizard helper — complete steps 1-3 for decimal scenarios (Background) ─

// Background steps delegate to existing steps above; gherkin re-uses them.
// "Continue" button re-uses the generic When('the pilot clicks {string}') step.

// ─── Shared utility: complete full wizard flow (used by flight-prep steps) ──

export async function completeWizardFlow(
  page: Page,
  aircraft = TEST_AIRCRAFT,
): Promise<void> {
  // Navigate to fleet
  await page.goto('/')
  const fleetLink = page.getByRole('link', { name: /Fleet|fleet/i }).first()
  await fleetLink.click()
  await expect(page).toHaveURL(/fleet/)

  // Open wizard
  await page.getByRole('button', { name: '+ Add New Aircraft' }).click()
  await expect(page).toHaveURL(/fleet\/new/)

  // Step 1: Identity
  await page.getByLabel('Manufacturer').selectOption(aircraft.manufacturer)
  const modelInput = page.locator('#model-input')
  const tagName = await modelInput.evaluate((el) => el.tagName.toLowerCase())
  if (tagName === 'select') {
    await modelInput.selectOption({ label: aircraft.model })
  } else {
    await modelInput.fill(aircraft.model)
  }
  await page.getByLabel('Registration').fill(aircraft.registration)
  const icaoInput = page.getByLabel('ICAO Type Designator')
  await icaoInput.clear()
  await icaoInput.fill(aircraft.icaoDesignator)
  await page.getByRole('button', { name: 'Continue →' }).click()

  // Step 2: Envelope
  await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible()
  const mtomInput = page.getByLabel(/MTOM.*Maximum Take-Off Mass/i)
  await mtomInput.clear()
  await mtomInput.fill(aircraft.mtom)
  await mtomInput.dispatchEvent('input')
  await mtomInput.blur()
  await page.getByRole('button', { name: 'Continue →' }).click()

  // Step 3: Weighing Reports
  await expect(page.getByRole('heading', { name: /Step 3/i })).toBeVisible()
  const bemInput = page.getByLabel('BEM')
  await bemInput.clear()
  await bemInput.fill(aircraft.bem)
  await bemInput.dispatchEvent('input')
  await bemInput.blur()
  const cgInput = page.getByLabel('Empty CG')
  await cgInput.clear()
  await cgInput.fill(aircraft.emptyCg)
  await cgInput.dispatchEvent('input')
  await cgInput.blur()
  await page.getByRole('button', { name: 'Continue →' }).click()

  // Step 4: Load Stations — add one seat + one fuel tank
  await expect(page.getByRole('heading', { name: /Step 4/i })).toBeVisible()
  await page.getByRole('button', { name: '+ Add Load Station' }).click()
  const firstRow = page.locator('.load-point-row').first()
  await firstRow.getByLabel('Station Name').fill(aircraft.seatStationName)
  const armInput = firstRow.getByLabel('Arm')
  await armInput.clear()
  await armInput.fill(aircraft.seatStationArm)
  await armInput.dispatchEvent('input')
  await armInput.blur()
  await page.getByRole('button', { name: '+ Add Fuel Tank' }).click()
  await page.getByRole('button', { name: 'Continue →' }).click()

  // Step 5: Wind Limits (optional)
  await expect(page.getByRole('heading', { name: /Step 5.*Wind Limits/i })).toBeVisible()
  await page.getByRole('button', { name: 'Continue →' }).click()

  // Step 6: Review & Save
  await expect(page.getByRole('heading', { name: /Step 6.*Review/i })).toBeVisible()
  await page.getByRole('button', { name: 'Save as Draft' }).click()

  // Saving keeps the pilot on /fleet/new behind an explicit destination chooser.
  await savedDraftChooser(page).getByRole('button', { name: 'Back to Fleet', exact: true }).click()
  await expect(page).toHaveURL(/\/fleet$/)
}

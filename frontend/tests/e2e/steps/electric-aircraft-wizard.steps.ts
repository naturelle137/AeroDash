// @E2E-AC-ELECTRIC-001@ (FROM: @UJ-A-004@, @REQ-AD-020@, @REQ-AD-021@, @REQ-UI-021@, @REQ-UI-022@)
// Step definitions for electric-aircraft-wizard.feature — powertrain selector,
// catalogue hint auto-flip, Battery Pack step, fuel-UI suppression on Step 4,
// and the combustion-unchanged control scenario.

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

// ─── Step 1 · Identity — powertrain selector assertions ───────────────────

Then(
  'the Powertrain selector shows {string} as active',
  async ({ page }, label: string) => {
    const value = label.toLowerCase() === 'electric' ? 'electric' : 'combustion'
    const radio = page.locator(`input[type="radio"][name="powertrain"][value="${value}"]`)
    await expect(radio).toBeChecked()
  },
)

When(
  'the pilot picks manufacturer {string} and model {string}',
  async ({ page }, manufacturer: string, model: string) => {
    await page.getByLabel('Manufacturer').selectOption(manufacturer)

    const modelInput = page.locator('#model-input')
    const tagName = await modelInput.evaluate((el) => el.tagName.toLowerCase())
    if (tagName === 'select') {
      await modelInput.selectOption({ label: model })
    } else {
      await modelInput.fill(model)
    }
  },
)

When(
  'the pilot fills in registration {string} and ICAO {string}',
  async ({ page }, registration: string, icao: string) => {
    await page.getByLabel('Registration').fill(registration)

    const icaoInput = page.getByLabel('ICAO Type Designator')
    await icaoInput.clear()
    await icaoInput.fill(icao)
  },
)

// ─── Step 4 · Load Stations — fuel UI suppression assertions ──────────────

Then('the "+ Add Fuel Tank" button is not visible', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Add Fuel Tank/i })).toHaveCount(0)
})

Then('the "+ Add Fuel Tank" button is visible', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Add Fuel Tank/i })).toBeVisible()
})

Then('the fuel-tank toggle is not visible', async ({ page }) => {
  // LoadPointsSection renders the "This station is a fuel tank" toggle only
  // for combustion profiles. A missing toggle confirms REQ-UI-022 gating.
  await expect(page.getByText(/This station is a fuel tank/i)).toHaveCount(0)
})

Then('an informational note mentions {string}', async ({ page }, fragment: string) => {
  await expect(page.getByText(new RegExp(fragment, 'i'))).toBeVisible()
})

// ─── Step 4½ · Battery Pack ───────────────────────────────────────────────

Then('the wizard is on Step 4½ — Battery Pack', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Battery Pack/i })).toBeVisible()
})

When(
  'the pilot enters usable energy {string}, reserve floor {string}, nominal voltage {string} and chemistry {string}',
  async (
    { page },
    usable: string,
    reserve: string,
    voltage: string,
    chemistry: string,
  ) => {
    const usableInput = page.locator('#wizard-battery-usable-energy')
    await usableInput.clear()
    await usableInput.fill(usable)
    await usableInput.dispatchEvent('input')
    await usableInput.blur()

    const reserveInput = page.locator('#wizard-battery-reserve-floor')
    await reserveInput.clear()
    await reserveInput.fill(reserve)
    await reserveInput.dispatchEvent('input')
    await reserveInput.blur()

    const voltageInput = page.locator('#wizard-battery-nominal-voltage')
    await voltageInput.clear()
    await voltageInput.fill(voltage)
    await voltageInput.dispatchEvent('input')
    await voltageInput.blur()

    const chemistryInput = page.locator('#wizard-battery-chemistry')
    await chemistryInput.clear()
    await chemistryInput.fill(chemistry)
  },
)

// ─── Step 5 · Review assertions ───────────────────────────────────────────

Then('the review shows powertrain {string}', async ({ page }, expected: string) => {
  await expect(page.getByText(new RegExp(`Powertrain\\s*[:\\-]?\\s*${expected}`, 'i'))).toBeVisible()
})

Then(
  'the review shows battery pack usable energy {string}',
  async ({ page }, value: string) => {
    await expect(page.getByText(new RegExp(`${value}\\s*kWh`, 'i')).first()).toBeVisible()
  },
)

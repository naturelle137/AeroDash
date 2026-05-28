// Step definitions for fleet-based-aircraft-selection.feature
// E2E trace tags live in the .feature file only (STC §B.3 / §3.4).

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { completeWizardFlow } from './aircraft-wizard.steps'

const { Given, When, Then } = createBdd()

// ─── Navigation helpers ────────────────────────────────────────────────────

Given('the pilot opens the Flight Prep page on a fresh browser session', async ({ page }) => {
  // IndexedDB is isolated per Playwright browser context — fleet is empty
  await page.goto('/mass-balance')
  await expect(page.getByRole('main')).toBeVisible()
})

When('the pilot navigates to the Flight Prep page', async ({ page }) => {
  // Client-side navigation from wherever the pilot currently is
  const mbLink = page.getByRole('link', { name: /Flight Prep|Start flight preparation|mass.balance/i }).first()
  if (await mbLink.isVisible()) {
    await mbLink.click()
  } else {
    // Fallback: navigate via URL (acceptable here — fleet was already populated server-side)
    await page.goto('/mass-balance')
  }
  await expect(page.getByRole('main')).toBeVisible()
})

// ─── Empty fleet assertions ────────────────────────────────────────────────

Then('the {string} message is visible', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false })).toBeVisible()
})

Then('an "Add Aircraft" button is visible', async ({ page }) => {
  // flight-prep fleet-empty CTA: button text "+ Add Aircraft"
  const cta = page.getByRole('button', { name: /Add Aircraft/i })
  await expect(cta).toBeVisible()
})

When('the pilot clicks the "Add Aircraft" button on the Flight Prep page', async ({ page }) => {
  await page.getByRole('button', { name: /Add Aircraft/i }).click()
})

Then('the pilot is taken to the aircraft creation wizard', async ({ page }) => {
  await expect(page).toHaveURL(/fleet\/new/)
  await expect(page.getByRole('heading', { name: /Add New Aircraft/i })).toBeVisible()
})

// ─── Populated fleet assertions ────────────────────────────────────────────

Given(
  'the pilot has added an aircraft with registration {string} via the wizard',
  async ({ page }, registration: string) => {
    // Use the shared helper that walks through all 5 wizard steps
    await completeWizardFlow(page)
    // Verify it is in the fleet before proceeding
    await expect(page.locator('.profile-item', { hasText: registration })).toBeVisible()
  },
)

Then('the aircraft dropdown is visible', async ({ page }) => {
  await expect(page.getByLabel('Select aircraft')).toBeVisible()
})

Then(
  'the dropdown contains an option matching {string} with {string} in its label',
  async ({ page }, registration: string, suffix: string) => {
    const select = page.getByLabel('Select aircraft')
    // Look for an option whose text contains the registration and the suffix
    const option = select.locator('option', {
      hasText: new RegExp(`${registration}.*\\${suffix}`, 'i'),
    })
    await expect(option).toHaveCount(1)
  },
)

When(
  'the pilot selects the {string} aircraft from the dropdown',
  async ({ page }, registration: string) => {
    const select = page.getByLabel('Select aircraft')
    const option = select.locator('option', { hasText: registration })
    const label = await option.textContent()
    await select.selectOption({ label: label!.trim() })
  },
)

Then('the M&B section becomes unlocked', async ({ page }) => {
  // After selecting an aircraft the locked overlay disappears and M&B inputs appear
  await expect(page.locator('.locked-placeholder')).toHaveCount(0)
  await expect(page.getByRole('region', { name: /Mass and Balance/i })).toBeVisible()
})

// ─── Draft acknowledgement (REQ-AC-005 / REQ-AC-007, WARN-AC-002) ──────────

Then('an inline draft acknowledgement warning is shown', async ({ page }) => {
  const ack = page.locator('.draft-ack')
  await expect(ack).toBeVisible()
  await expect(ack).toContainText('WARN-AC-002')
})

Then('the Mass & Balance section remains locked', async ({ page }) => {
  await expect(page.locator('.locked-placeholder')).toBeVisible()
})

When('the pilot acknowledges the draft warning to continue', async ({ page }) => {
  await page.locator('.draft-ack__btn--continue').click()
})

// ─── Catalogue leak regression assertions ─────────────────────────────────

Then(
  'no option with text {string} is present in the aircraft dropdown',
  async ({ page }, text: string) => {
    // When the fleet is empty the <select> is not rendered at all — that is also
    // an acceptable outcome. Guard against the element not existing.
    const selectExists = await page.getByLabel('Select aircraft').count()
    if (selectExists === 0) return // no picker ⟹ definitely no leaked options

    const option = page.getByLabel('Select aircraft').locator('option', { hasText: text })
    await expect(option).toHaveCount(0)
  },
)

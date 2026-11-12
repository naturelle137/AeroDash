import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { flushFleetSeed, hasPendingFleetSeed, stageFleetSeed } from '../fixtures/fleet-seed'
import { mbScenarioFleet } from '../fixtures/mb-scenario-fleet'

const { Given, When, Then } = createBdd()

// ─── Shared steps — used by multiple phases ────────────────────────────────

Given('the fleet holds the synthetic Mass & Balance test aircraft', async ({ page }) => {
  stageFleetSeed(page, ...mbScenarioFleet())
})

Given('the pilot starts a new flight preparation', async ({ page }) => {
  await page.goto('/mass-balance')
  if (hasPendingFleetSeed(page)) {
    await expect(page.getByRole('button', { name: /Add Aircraft/i })).toBeVisible()
    await flushFleetSeed(page)
    await page.reload()
  }
  await expect(page.getByLabel('Select aircraft')).toBeVisible()
})

When('the pilot selects aircraft {string}', async ({ page }, registration: string) => {
  const select = page.getByLabel('Select aircraft')
  const option = select.locator('option', { hasText: registration })
  const label = await option.textContent()
  await select.selectOption({ label: label!.trim() })
  // Seeded profiles are Drafts: the unverified-data gate must appear and be
  // acknowledged, never bypassed.
  const ack = page.getByRole('alertdialog', { name: 'Unverified profile acknowledgement' })
  await expect(ack).toBeVisible()
  await ack.getByRole('button', { name: 'Continue anyway' }).click()
  await expect(page.locator('.aircraft-label')).toContainText(registration)
})

Then('no critical notifications are displayed', async ({ page }) => {
  // .notification--critical: semantic severity class; no ARIA role distinguishes critical-level alerts
  await expect(page.locator('.notification--critical')).toHaveCount(0)
})

Then('the total mass is within MTOM', async ({ page }) => {
  // .notification--critical: semantic severity class; no ARIA role distinguishes critical-level alerts
  await expect(page.locator('.notification--critical', { hasText: 'MTOM Exceeded' })).toHaveCount(0)
})

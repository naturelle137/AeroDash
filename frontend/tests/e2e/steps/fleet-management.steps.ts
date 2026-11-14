import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { AIRCRAFT_CATALOGUE } from '../../../src/modules/mass-balance/data/aircraft-catalogue'
import { fillStation } from './flight-preparation.steps'

const { When, Then } = createBdd()

const takeoffMassBefore = new WeakMap<Page, number>()

function resultsRegion(page: Page) {
  return page.getByRole('region', { name: 'Calculation results' })
}

function takeoffMassItem(page: Page) {
  return resultsRegion(page).locator('.result-summary__item', { hasText: 'Takeoff Mass' })
}

async function readTakeoffMass(page: Page): Promise<number> {
  const text = await takeoffMassItem(page).locator('.result-summary__value').innerText()
  return Number(text.replace(/[^\d.]/g, ''))
}

// ─── When steps — Certification category switch (UJ-A-003) ─────────────────

When('loads a pilot, a rear passenger, and training fuel', async ({ page }) => {
  await fillStation(page, 'Front Seats', '90')
  await fillStation(page, 'Rear Seats', '110')
  await fillStation(page, 'Fuel Tanks', '100')
  await expect(resultsRegion(page)).toBeVisible()
  takeoffMassBefore.set(page, await readTakeoffMass(page))
})

When(
  'the pilot switches the certification category to {string}',
  async ({ page }, category: string) => {
    await page.getByLabel('Certification category').selectOption(category)
  },
)

// ─── Then steps — Certification category switch (UJ-A-003) ─────────────────

Then('the takeoff mass limit reflects the selected category', async ({ page }) => {
  const registration = (await page.locator('.aircraft-label').innerText()).trim()
  const category = await page.getByLabel('Certification category').inputValue()
  const aircraft = AIRCRAFT_CATALOGUE.find((a) => registration.includes(a.registration))
  const limit = aircraft?.certificationCategories.find((c) => c.category === category)
  expect(limit, `${registration} has no "${category}" category in the catalogue`).toBeDefined()
  await expect(takeoffMassItem(page).locator('.result-summary__limit')).toHaveText(
    // Catalogue limits are kg; the label floors to 0.1 kg.
    `/ MTOM ${limit!.maxTakeoffMass.toFixed(1)} kg`,
  )
})

Then('the rear seat station is available for loading', async ({ page }) => {
  await expect(page.locator('.mass-station-input').getByLabel('Rear Seats', { exact: true })).toBeVisible()
})

Then('the rear seat station is not available for loading', async ({ page }) => {
  await expect(page.locator('.mass-station-input').getByLabel('Rear Seats', { exact: true })).toHaveCount(0)
})

Then('the baggage areas are available but left empty', async ({ page }) => {
  for (const name of ['Baggage Area 1', 'Baggage Area 2']) {
    const input = page.locator('.mass-station-input').getByLabel(name, { exact: true })
    await expect(input).toBeVisible()
    await expect(input).toHaveValue(/^0([.,]0*)?$/)
  }
})

Then('the takeoff mass no longer includes the rear passenger', async ({ page }) => {
  const before = takeoffMassBefore.get(page)
  expect(before, 'takeoff mass before the category switch was not recorded').toBeDefined()
  await expect.poll(() => readTakeoffMass(page)).toBeCloseTo(before! - 110, 1)
  // Draft seeds cap the state at WARNING; CRITICAL here means the CG left the active envelope.
  await expect(page.getByRole('img', { name: /CG Envelope Chart — (SAFE|WARNING), TOM/ })).toBeVisible()
})

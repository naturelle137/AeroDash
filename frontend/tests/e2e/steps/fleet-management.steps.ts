import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

// ─── When steps — Certification category switch (UJ-A-003) ─────────────────

When('loads a pilot, a rear passenger, and training fuel', async ({ page }) => {
  await page.getByLabel('Front Seats').fill('90')
  await page.getByLabel('Rear Seats').fill('110')
  await page.getByLabel('Fuel Tanks').fill('100')
})

When(
  'the pilot switches the certification category to {string}',
  async ({ page }, category: string) => {
    await page.getByLabel('Certification category').selectOption(category)
  },
)

// ─── Then steps — Certification category switch (UJ-A-003) ─────────────────

Then('the takeoff mass limit reflects the selected category', async ({ page }) => {
  const resultsRegion = page.getByRole('region', { name: 'Calculation results' })
  await expect(resultsRegion).toContainText('/ 953')
})

Then('the rear seat station is not available for loading', async ({ page }) => {
  await expect(page.getByLabel('Rear Seats')).toHaveCount(0)
})

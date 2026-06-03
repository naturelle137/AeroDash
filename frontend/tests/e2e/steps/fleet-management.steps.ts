import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

// ─── When steps — Certification category switch (UJ-A-003) ─────────────────

When('loads a pilot, a rear passenger, and training fuel', async ({ page }) => {
  // Target the DecimalInput station fields by role+exact-name: getByLabel('Front
  // Seats') also matches the field's <label>, its presets group and preset
  // buttons (strict-mode violation) — refs #294.
  await fillStationField(page, 'Front Seats', '90')
  await fillStationField(page, 'Rear Seats', '110')
  await fillStationField(page, 'Fuel Tanks', '100')
})

/** Fill a Mass & Balance station's decimal text field by its accessible name. */
async function fillStationField(
  page: import('@playwright/test').Page,
  label: string,
  value: string,
): Promise<void> {
  const input = page.getByRole('textbox', { name: label, exact: true })
  await input.fill(value)
  await input.dispatchEvent('input')
}

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

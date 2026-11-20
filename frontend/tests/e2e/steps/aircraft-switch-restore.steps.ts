import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

When('the pilot clears the restored draft', async ({ page }) => {
  await page.getByTestId('clear-draft').click()
  await page.getByTestId('confirm-clear-draft').click()
})

Then('the restored draft notice is displayed', async ({ page }) => {
  await expect(page.getByTestId('restored-draft-banner')).toBeVisible()
})

Then('the restored draft notice is not displayed', async ({ page }) => {
  await expect(page.getByTestId('restored-draft-banner')).toHaveCount(0)
})

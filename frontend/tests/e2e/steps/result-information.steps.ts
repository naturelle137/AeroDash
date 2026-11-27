import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Then } = createBdd()

Then('the result information is available at {int} pixels', async ({ page, $testInfo }, width: number) => {
  for (const label of ['Center of gravity', 'Usable and unusable fuel']) {
    const info = page.getByLabel(`Information: ${label}`)
    await info.click()
    const details = info.locator('..')
    await expect(details).toHaveAttribute('open', '')
    await expect(details.locator('[lang="en"]')).toBeVisible()
    await expect(details.locator('[lang="de"]')).toBeVisible()
    await $testInfo.attach(`${label}-${width}`, { body: await page.screenshot(), contentType: 'image/png' })
    await info.click()
  }
})

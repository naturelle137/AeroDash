import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Then } = createBdd()

Then('the result information is available at {int} pixels', async ({ page, $testInfo }, width: number) => {
  for (const label of ['Center of gravity', 'Usable and unusable fuel']) {
    const info = page.getByRole('button', { name: `${label} info`, exact: true })
    await info.click()
    await expect(info).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator(`#${await info.getAttribute('aria-controls')}`)).toBeVisible()
    await $testInfo.attach(`${label}-${width}`, { body: await page.screenshot(), contentType: 'image/png' })
    await info.click()
    await expect(info).toHaveAttribute('aria-expanded', 'false')
  }
})

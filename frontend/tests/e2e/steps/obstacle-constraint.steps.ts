import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()
const warning = (page: Page) => page.locator('[data-notification="WARN-PF-001"]')

When('the pilot enters an obstacle height {string} {string} at distance {string} {string}',
  async ({ page }, height: string, heightUnit: string, distance: string, distanceUnit: string) => {
    await page.locator('#performance-obstacle-height-unit').selectOption(heightUnit)
    await page.locator('#performance-obstacle-distance-unit').selectOption(distanceUnit)
    await page.locator('#performance-obstacle-height').fill(height)
    await page.locator('#performance-obstacle-distance').fill(distance)
  })

When('the pilot clears the obstacle', async ({ page }) => {
  await page.getByRole('button', { name: 'Clear obstacle' }).click()
})

// Obstacle input is session-only by design, so a reload must not resurrect it.
When('the pilot reloads the obstacle entry', async ({ page }) => {
  await page.reload()
})

Then('the unverified obstacle warning is shown', async ({ page }) => {
  await expect(warning(page)).toContainText('WARN-PF-001')
  await expect(warning(page)).toContainText('Unverified obstacle data in use')
  await expect(page.locator('[data-obstacle-active]')).toContainText('Unverified, not checked for clearance')
  await expect(page.locator('[data-obstacle-active]')).toContainText('Approximately 2.540%')
  await expect(page.locator('[data-obstacle-active]')).toContainText('clearance cannot be determined')
})

Then('no unverified obstacle warning is shown', async ({ page }) => {
  await expect(warning(page)).toHaveCount(0)
})

Then('the obstacle fields and warning are accessible around mobile navigation', async ({ page, $testInfo }) => {
  if (page.viewportSize()!.width >= 768) return
  for (const selector of ['#performance-obstacle-height', '#performance-obstacle-height-unit',
    '#performance-obstacle-distance', '#performance-obstacle-distance-unit', '[data-notification="WARN-PF-001"]']) {
    const target = page.locator(selector)
    if (selector.startsWith('#')) {
      await page.evaluate(() => window.scrollTo(0, 0))
      await target.focus()
      await expect(target).toBeFocused()
    } else {
      await target.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    }
    await expect.poll(async () => target.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      const stack = document.querySelector('.prep-sticky-stack')?.getBoundingClientRect()
      const action = document.querySelector('.briefing-action')!.getBoundingClientRect()
      return rect.top >= (stack?.bottom ?? 56) && rect.bottom <= action.top
    })).toBe(true)
    if (selector.startsWith('#')) await target.click()
    await $testInfo.attach(`visible-${selector.replace(/\W/g, '-')}`, {
      body: await page.screenshot(), contentType: 'image/png',
    })
  }
})

Then('the obstacle height error {string} is shown', async ({ page }, text: string) => {
  await expect(page.locator('#performance-obstacle-height-error')).toHaveText(text)
})

Then('the obstacle distance error {string} is shown', async ({ page }, text: string) => {
  await expect(page.locator('#performance-obstacle-distance-error')).toHaveText(text)
})

Then('the obstacle evidence is captured as {string}', async ({ page, $testInfo }, name: string) => {
  const path = $testInfo.outputPath(`obstacle-${name}.png`)
  await page.locator('.obstacle-inputs').screenshot({ path })
  await $testInfo.attach(`obstacle-${name}`, { path, contentType: 'image/png' })
})

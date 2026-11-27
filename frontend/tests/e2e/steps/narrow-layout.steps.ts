import { expect, type Locator, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Then } = createBdd()

async function reachable(page: Page, target: Locator, touch = false) {
  await target.scrollIntoViewIfNeeded()
  await expect(target).toBeVisible()
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  if (touch) {
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(await target.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return hit === element || element.contains(hit)
    })).toBe(true)
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

Then('the narrow preparation layout is reachable', async ({ page, $testInfo }) => {
  await reachable(page, page.locator('[data-notification="WARN-PF-001"]'))
  await reachable(page, page.getByRole('button', { name: 'Briefing Pack', exact: true }), true)
  await $testInfo.attach(`preparation-${page.viewportSize()!.width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

Then('the narrow briefing layout is reachable', async ({ page, $testInfo }) => {
  const preview = page.getByRole('dialog', { name: 'Briefing Pack preview' })
  await reachable(page, preview.getByText('WARNING: Unverified obstacle data in use', { exact: false }).first())
  for (const name of ['Back to preparation', 'Print Briefing Pack']) {
    await reachable(page, preview.getByRole('button', { name }), true)
  }
  await $testInfo.attach(`briefing-${page.viewportSize()!.width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

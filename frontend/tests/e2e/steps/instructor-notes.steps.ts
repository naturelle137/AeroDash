import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

When('the instructor {string} adds the note {string} on the takeoff result', async ({ page }, author: string, text: string) => {
  const panel = page.getByRole('region', { name: 'Mass and Balance' }).getByTestId('annotation-panel')
  await panel.scrollIntoViewIfNeeded()
  await panel.getByLabel('Author').fill(author)
  await panel.getByLabel('Note', { exact: true }).fill(text)
  await panel.getByRole('button', { name: 'Add note' }).click()
})

When('the pilot reloads the page', async ({ page }) => {
  await page.reload()
})

Then('the note {string} is shown as an instructor note by {string}', async ({ page }, text: string, author: string) => {
  const item = page.getByRole('region', { name: 'Mass and Balance' }).getByTestId('annotation-item')
  await expect(item).toContainText(`Instructor note on Takeoff`)
  await expect(item).toContainText(`${author} (self-declared)`)
  await expect(item).toContainText(text)
})

When('the instructor adds performance notes', async ({ page }) => {
  const panel = page.getByTestId('annotation-panel')
  await panel.getByLabel('Author').fill('CRI Meyer')
  await panel.getByLabel('Note', { exact: true }).fill('Review takeoff distance')
  await panel.getByRole('button', { name: 'Add note' }).click()
  await panel.getByLabel('Result').selectOption('landingDistance')
  await panel.getByLabel('Note', { exact: true }).fill('Review landing distance')
  await panel.getByRole('button', { name: 'Add note' }).click()
})

Then('performance notes and the extrapolation warning remain visible', async ({ page }) => {
  await expect(page.locator('[data-extrapolation]')).toContainText('EXTRAPOLATED DATA')
  await expect(page.getByTestId('annotation-panel')).toContainText('Instructor note on Takeoff distance')
  await expect(page.getByTestId('annotation-panel')).toContainText('Instructor note on Landing distance')
  await expect(page.getByTestId('annotation-panel')).toContainText('self-declared')
})

Then('performance note evidence is captured as {string}', async ({ page, $testInfo }, width: string) => {
  await page.getByTestId('annotation-panel').scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`instructor-performance-${width}.png`)
  await page.screenshot({ path })
  await $testInfo.attach(`instructor-performance-${width}`, { path, contentType: 'image/png' })
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
})

When('the pilot reselects the performance aircraft', async ({ page }) => {
  const select = page.getByLabel('Aircraft profile', { exact: true })
  await select.selectOption((await select.locator('option').nth(1).getAttribute('value'))!)
})

Then('performance notes remain available', async ({ page }) => {
  await expect(page.getByTestId('annotation-panel')).toContainText('Review takeoff distance')
  await expect(page.getByTestId('annotation-panel')).toContainText('Review landing distance')
})

When('the instructor adds a note on the MTOM warning', async ({ page }) => {
  const panel = page.getByRole('region', { name: 'Mass and Balance' }).getByTestId('annotation-panel')
  const option = panel.locator('option').filter({ hasText: 'MTOM Exceeded' }).first()
  await panel.getByLabel('Result').selectOption((await option.getAttribute('value'))!)
  await panel.getByLabel('Author').fill('CRI Meyer')
  await panel.getByLabel('Note', { exact: true }).fill('Review the overload')
  await panel.getByRole('button', { name: 'Add note' }).click()
})

Then('the warning note remains available', async ({ page }) => {
  const item = page.getByRole('region', { name: 'Mass and Balance' }).getByTestId('annotation-item')
  await expect(item).toContainText('MTOM Exceeded')
  await expect(item).toContainText('Review the overload')
  await expect(item).toContainText('self-declared')
})

Then('the warning note evidence is captured as {string}', async ({ page, $testInfo }, width: string) => {
  await page.getByTestId('annotation-panel').first().scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`instructor-warning-${width}.png`)
  await page.screenshot({ path })
  await $testInfo.attach(`instructor-warning-${width}`, { path, contentType: 'image/png' })
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
})

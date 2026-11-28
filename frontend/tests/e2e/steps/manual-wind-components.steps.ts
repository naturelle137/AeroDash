import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()
const panel = (page: Page) => page.getByRole('region', { name: 'Manual wind components', exact: true })
const result = (page: Page) => panel(page).getByRole('status', { name: 'Wind components', exact: true })

When('the pilot enters runway heading {string}, wind from {string} and speed {string} {string}',
  async ({ page }, heading: string, direction: string, speed: string, unit: string) => {
    await panel(page).getByLabel('Runway heading (°, 1–360)', { exact: true }).fill(heading)
    await panel(page).getByLabel('Wind from (°, 1–360)', { exact: true }).fill(direction)
    await panel(page).getByLabel('Wind speed', { exact: true }).fill(speed)
    await panel(page).getByLabel('Wind speed unit', { exact: true }).selectOption(unit)
  })

Then('the wind components show {string} {string} and crosswind {string}', async ({ page }, label: string, value: string, cross: string) => {
  await expect(result(page).locator('dt').nth(0)).toHaveText(label)
  await expect(result(page).locator('dd').nth(0)).toHaveText(value)
  await expect(result(page).locator('dd').nth(1)).toHaveText(cross)
})

Then('the wind components are labelled as user-entered and advisory', async ({ page }) => {
  await expect(panel(page)).toContainText('User-entered — advisory only.')
})

Then('no wind components are shown', async ({ page }) => {
  await expect(result(page).locator('dd')).toHaveCount(0)
  await expect(result(page)).toContainText('No wind components')
})

Then('the wind component evidence is captured as {string}', async ({ page, $testInfo }, name: string) => {
  const path = $testInfo.outputPath(`wind-components-${name}.png`)
  await panel(page).screenshot({ path })
  await $testInfo.attach(`wind-components-${name}`, { path, contentType: 'image/png' })
})

Then('the Flight Prep wind controls are reachable by keyboard at {string}', async ({ page, $testInfo }, width: string) => {
  const controls = panel(page).locator('input, select')
  if (width === '1440') await controls.first().evaluate(el => el.scrollIntoView({ block: 'center' }))
  await controls.first().focus()
  for (let i = 0; i < await controls.count(); i++) {
    const control = controls.nth(i)
    if (i > 0) await page.keyboard.press('Tab')
    await expect(control).toBeFocused()
    const box = await control.boundingBox()
    const nav = await page.locator('.app-bottom-nav').boundingBox()
    const action = await page.locator('.briefing-action').boundingBox()
    expect(box).not.toBeNull()
    const overlapsAction = action && box!.x < action.x + action.width && box!.x + box!.width > action.x
    const bottom = Math.min(nav?.y ?? Infinity, overlapsAction ? action.y : Infinity, page.viewportSize()!.height)
    expect(box!.y + box!.height).toBeLessThanOrEqual(bottom)
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })
    expect(hit).toBe(await control.getAttribute('id'))
  }
  const path = $testInfo.outputPath(`flight-prep-wind-${width}.png`)
  await page.screenshot({ path })
  await $testInfo.attach(`Flight Prep wind ${width}`, { path, contentType: 'image/png' })
})

When('the pilot returns from the briefing pack', async ({ page }) => {
  await page.getByRole('button', { name: 'Back to preparation' }).click()
})

Then('the briefing pack does not contain manual wind components', async ({ page }) => {
  await expect(page.getByRole('dialog', { name: 'Briefing Pack preview' }).getByRole('region', { name: 'Manual wind components' })).toHaveCount(0)
})

When('the pilot imports a synthetic aircraft with wind limits', async ({ page }) => {
  const { testPohAircraft } = await import('../../fixtures/poh-aircraft')
  const profile = { ...testPohAircraft(), registration: 'D-WIND', status: 'draft', windLimits: [
    { component: 'MaxCrosswind', value: 10, classification: 'Demonstrated' },
    { component: 'MaxTailwind', value: 5, classification: 'Limit' },
    { component: 'MaxGust', value: 15, classification: 'Limit' },
  ] }
  await page.goto('/fleet')
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.getByRole('button', { name: 'Verify D-WIND', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Synthetic test only')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
})

Then('the manual wind warnings show both exceedances', async ({ page, $testInfo }) => {
  await expect(panel(page)).toContainText('WARNING WARN-WX-001: Crosswind exceeds Demonstrated 10 kt')
  await expect(panel(page)).toContainText('CRITICAL CRIT-WX-001: Tailwind exceeds Limit 5 kt')
  await panel(page).getByText('CRITICAL CRIT-WX-001:', { exact: false }).scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`wind-limits-${page.viewportSize()!.width}.png`)
  await page.screenshot({ path })
  await $testInfo.attach('Manual wind limits', { path, contentType: 'image/png' })
})

When('the pilot enters a gust of {string}', async ({ page }, value: string) => {
  await page.getByLabel('Gust speed (optional, same unit)').fill(value)
})

Then('the gust warnings appear and evidence is captured', async ({ page, $testInfo }) => {
  await expect(panel(page).getByLabel('Gust components')).toContainText('Gust tailwind10.0 kt')
  await expect(panel(page).getByLabel('Gust components')).toContainText('Gust crosswind17.3 kt from the left')
  await expect(panel(page)).toContainText('Crosswind exceeds Demonstrated 10 kt (manual gust)')
  await expect(panel(page)).toContainText('Tailwind exceeds Limit 5 kt (manual gust)')
  await expect(panel(page)).toContainText('Gust exceeds Limit 15 kt (manual gust)')
  await page.locator('#wind-gust').scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`gust-${page.viewportSize()!.width}.png`)
  await page.screenshot({ path })
  await $testInfo.attach('Gust limits', { path, contentType: 'image/png' })
})

Then('the gust is cleared', async ({ page }) => {
  await expect(page.locator('#wind-gust')).toHaveValue('')
  await expect(panel(page)).not.toContainText('(manual gust)')
})

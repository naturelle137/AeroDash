import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()
const result = (page: Page) => page.getByRole('region', { name: 'Raw POH table distances', exact: true })
const derived = (page: Page) => page.getByLabel('Derived pressure altitude', { exact: true })
const qnhSection = (page: Page) => page.getByRole('region', { name: 'QNH and field elevation', exact: true })
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true })

async function compute(page: Page) {
  await page.getByRole('button', { name: 'Compute raw distances', exact: true }).click()
}

When('the pilot sets mass {string} kg and temperature {string} °C for the Test profile', async ({ page }, mass: string, temperature: string) => {
  const select = page.getByLabel('Aircraft profile', { exact: true })
  const id = await select.locator('option').nth(1).getAttribute('value')
  await select.selectOption(id!)
  await page.getByLabel('Mass (kg)', { exact: true }).fill(mass)
  await page.getByLabel('Temperature (°C)', { exact: true }).fill(temperature)
})

Then('raw distances are refused until a pressure-altitude method is chosen', async ({ page }) => {
  await expect(radio(page, 'Enter pressure altitude directly')).not.toBeChecked()
  await expect(radio(page, 'Derive from QNH and field elevation')).not.toBeChecked()
  await compute(page)
  await expect(page.getByRole('alert')).toContainText('Choose how pressure altitude is provided')
  await expect(result(page)).toHaveCount(0)
})

When('the pilot enters pressure altitude {string} ft directly', async ({ page }, value: string) => {
  await radio(page, 'Enter pressure altitude directly').check()
  await page.getByLabel('Pressure altitude (ft)', { exact: true }).fill(value)
})

When('the pilot derives pressure altitude from QNH {string} {string} and field elevation {string} {string}',
  async ({ page }, qnh: string, qnhUnit: string, elevation: string, elevationUnit: string) => {
    await radio(page, 'Derive from QNH and field elevation').check()
    const section = qnhSection(page)
    await section.getByLabel('QNH', { exact: true }).fill(qnh)
    await section.getByLabel('QNH unit', { exact: true }).selectOption(qnhUnit)
    await section.getByLabel('Pressure-altitude field elevation', { exact: true }).fill(elevation)
    await section.getByLabel('Pressure-altitude field elevation unit', { exact: true }).selectOption(elevationUnit)
  })

When('the pilot changes the QNH to {string}', async ({ page }, qnh: string) => {
  await qnhSection(page).getByLabel('QNH', { exact: true }).fill(qnh)
})

When('the pilot switches back to direct pressure-altitude entry', async ({ page }) => {
  await radio(page, 'Enter pressure altitude directly').check()
})

When('the pilot copies the saved runway elevation', async ({ page }) => {
  await qnhSection(page).getByRole('button', { name: 'Use saved manual runway elevation', exact: true }).click()
})

Then('the takeoff roll is {string} using pressure altitude {string}', async ({ page }, distance: string, basis: string) => {
  await compute(page)
  await expect(result(page).locator('dd').first()).toHaveText(distance)
  await expect(result(page)).toContainText(`Pressure altitude used: ${basis}`)
})

Then('no raw distances are shown', async ({ page }) => {
  await expect(result(page)).toHaveCount(0)
})

Then('the derived pressure altitude is {string} from field elevation {string} entered by the pilot', async ({ page }, pa: string, elevation: string) => {
  await expect(derived(page)).toContainText(`Derived pressure altitude: ${pa}`)
  await expect(derived(page)).toContainText(`field elevation ${elevation}`)
  await expect(qnhSection(page)).toContainText('Field elevation source: Entered by you.')
  await expect(qnhSection(page)).toContainText('not the 30 ft/hPa rule of thumb')
})

Then('the derived pressure altitude is {string} from field elevation {string} copied from runway {string}', async ({ page }, pa: string, elevation: string, runway: string) => {
  await expect(derived(page)).toContainText(`Derived pressure altitude: ${pa}`)
  await expect(derived(page)).toContainText(`field elevation ${elevation}`)
  await expect(qnhSection(page)).toContainText(`Copied by you from the saved manual runway ${runway}`)
})

Then('the direct pressure altitude still reads {string}', async ({ page }, value: string) => {
  await expect(page.getByLabel('Pressure altitude (ft)', { exact: true })).toHaveValue(value)
})

Then('no derived pressure altitude is shown', async ({ page }) => {
  await expect(derived(page)).toHaveCount(0)
})

Then('no derived pressure altitude is shown and the pilot is told {string}', async ({ page, $testInfo }, message: string) => {
  await expect(derived(page)).toHaveCount(0)
  await expect(qnhSection(page).locator('.field-error').filter({ hasText: message })).toBeVisible()
  await expect(qnhSection(page)).toContainText('No derived pressure altitude.')
  const path = $testInfo.outputPath(`pressure-altitude-invalid-${$testInfo.title.replace(/\W+/g, '-').slice(-40)}.png`)
  await qnhSection(page).screenshot({ path })
  await $testInfo.attach('Refused derivation', { path, contentType: 'image/png' })
})

Then('the pilot is warned {string}', async ({ page }, id: string) => {
  await expect(qnhSection(page).getByRole('alert')).toContainText(id)
})

Then('the copied field elevation has been removed', async ({ page }) => {
  const section = qnhSection(page)
  await expect(section.getByLabel('Pressure-altitude field elevation', { exact: true })).toHaveValue('')
  await expect(section.getByLabel('Pressure-altitude field elevation unit', { exact: true })).toHaveValue('')
  await expect(section.getByRole('status')).toContainText('copied field elevation was removed')
  await expect(derived(page)).toHaveCount(0)
})

Then('no pressure-altitude method or derived value remains', async ({ page }) => {
  await expect(radio(page, 'Enter pressure altitude directly')).not.toBeChecked()
  await expect(radio(page, 'Derive from QNH and field elevation')).not.toBeChecked()
  await expect(page.getByText('No method selected.')).toBeVisible()
  await expect(result(page)).toHaveCount(0)
  await radio(page, 'Derive from QNH and field elevation').check()
  await expect(qnhSection(page).getByLabel('QNH', { exact: true })).toHaveValue('')
  await expect(qnhSection(page).getByLabel('Pressure-altitude field elevation', { exact: true })).toHaveValue('')
  await expect(derived(page)).toHaveCount(0)
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((key) => /pressure|qnh/i.test(key)))
  expect(keys).toEqual([])
})

Then('the pressure-altitude evidence is captured as {string}', async ({ page, $testInfo }, name: string) => {
  await radio(page, 'Derive from QNH and field elevation').check()
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', page.viewportSize()!.width)
  await qnhSection(page).scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`pressure-altitude-${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await $testInfo.attach(`Pressure altitude ${name}`, { path, contentType: 'image/png' })
  await radio(page, 'Enter pressure altitude directly').check()
})

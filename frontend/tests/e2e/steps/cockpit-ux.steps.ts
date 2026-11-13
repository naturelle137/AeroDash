import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

Given('the cockpit viewport width is {int}', async ({ page }, width: number) => {
  await page.setViewportSize({ width, height: 1000 })
})

When('the pilot enters a lowercase registration', async ({ page }) => {
  await page.goto('/fleet/new')
  await page.getByLabel('Registration', { exact: true }).fill('d-test')
})

Then('the registration is uppercase before saving', async ({ page, $testInfo }) => {
  await expect(page.getByLabel('Registration', { exact: true })).toHaveValue('D-TEST')
  await page.getByLabel('Registration', { exact: true }).evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: $testInfo.outputPath('registration.png'), fullPage: false })
  await $testInfo.attach('registration', { path: $testInfo.outputPath('registration.png'), contentType: 'image/png' })
})

Then('the wizard explains which identity fields prevent progression', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Continue →', exact: true })
  await expect(button).toBeDisabled()
  await expect(button).toHaveAccessibleDescription('To continue, complete: manufacturer, model, ICAO designator.')
  await page.getByLabel('Manufacturer', { exact: true }).selectOption('Other')
  await page.getByLabel('Model', { exact: true }).fill('Synthetic')
  await page.getByLabel('ICAO Type Designator', { exact: true }).fill('TEST')
  await expect(button).toBeEnabled()
  // The hint is removed when its actual validation condition clears.
  await expect(page.locator('#continue-hint')).toHaveCount(0)
  await button.click()
  await expect(page.getByRole('heading', { name: /Certification.*Envelope/ })).toBeVisible()
})

When('the pilot expands the tablet navigation', async ({ page }) => {
  await page.goto('/fleet')
  const collapse = page.getByRole('button', { name: 'Collapse navigation', exact: true })
  if (await collapse.isVisible()) await collapse.click()
  await page.getByRole('button', { name: 'Expand navigation', exact: true }).click()
})

Then('navigation destinations are readable', async ({ page, $testInfo }) => {
  const toggle = page.getByRole('button', { name: 'Collapse navigation', exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  // The sidebar is the navigation surface controlled by the toggle.
  await expect(page.locator('#app-sidebar').getByText('Fleet', { exact: true })).toBeVisible()
  await page.screenshot({ path: $testInfo.outputPath('expanded-navigation.png'), fullPage: false })
  await $testInfo.attach('expanded-navigation', { path: $testInfo.outputPath('expanded-navigation.png'), contentType: 'image/png' })
  await toggle.click()
  await expect(page.locator('#app-sidebar').getByText('Fleet', { exact: true })).toBeHidden()
})

Then('the native aircraft picker identifies the chosen draft', async ({ page }) => {
  const picker = page.getByRole('combobox', { name: 'Select aircraft', exact: true })
  await expect(picker.locator('option:checked')).toContainText('D-EBPN')
  await expect(picker.locator('option:checked')).toContainText('Tecnam')
  await expect(picker.locator('option:checked')).toContainText('Draft')
  await picker.focus()
  await expect(picker).toBeFocused()
})

When('the pilot clears the required pilot loading', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Pilot & Passenger', exact: true }).fill('')
})

When('the pilot requests the first incomplete loading input', async ({ page }) => {
  await page.getByRole('button', { name: /^Review / }).first().click()
})

Then('the incomplete loading input receives focus', async ({ page, $testInfo }) => {
  const review = page.getByRole('button', { name: /^Review / }).first()
  const id = await review.getAttribute('aria-controls')
  if (!id) throw new Error('Missing loading input reference')
  await expect(page.locator(`[id="${id}"]`)).toBeFocused()
  await page.screenshot({ path: $testInfo.outputPath('loading-focus.png'), fullPage: false })
  await $testInfo.attach('loading-focus', { path: $testInfo.outputPath('loading-focus.png'), contentType: 'image/png' })
})

When('the pilot opens the synthetic profile in Mass and Balance', async ({ page }) => {
  await page.goto('/mass-balance')
  const picker = page.getByRole('combobox', { name: 'Select aircraft', exact: true })
  await picker.selectOption({ label: (await picker.locator('option').last().textContent())!.trim() })
})

Then('the result describes entered limits without claiming flight safety', async ({ page, $testInfo }) => {
  await expect(page.getByText('WITHIN LIMITS', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Mass & Balance within entered limits — verify against POH/AFM', { exact: true })).toBeVisible()
  await expect(page.getByText('VERIFIED SAFE', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Mass & Balance verified — safe for flight', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: $testInfo.outputPath('within-limits.png'), fullPage: false })
  await $testInfo.attach('within-limits', { path: $testInfo.outputPath('within-limits.png'), contentType: 'image/png' })
})

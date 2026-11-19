import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()
const PASSCODE = 'correct horse'

Given('the pilot enables the app lock on Privacy at {int} by {int}', async ({ page }, width: number, height: number) => {
  await page.setViewportSize({ width, height })
  await page.goto('/privacy')
  await page.getByTestId('lock-passcode').fill(PASSCODE)
  await page.getByTestId('lock-passcode-confirm').fill(PASSCODE)
  await page.getByTestId('lock-submit').click()
  await expect(page.getByTestId('app-lock-message')).toContainText('App lock enabled')
})

When('the pilot reloads AeroDash', async ({ page }) => {
  await page.reload()
})

Then('the lock screen hides the app and states that data is not encrypted', async ({ page, $testInfo }) => {
  const screen = page.getByTestId('app-lock-screen')
  await expect(screen).toBeVisible()
  await expect(screen).toContainText('does not encrypt')
  await expect(page.getByTestId('wipe-request-btn')).toHaveCount(0)
  await expect(page.locator('.app-shell')).toHaveAttribute('inert', '')
  await $testInfo.attach('locked', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

When('the pilot enters a wrong passcode', async ({ page }) => {
  await page.getByTestId('app-lock-input').fill('not the passcode')
  await page.getByTestId('app-lock-unlock').click()
})

Then('the lock screen stays and reports a wrong passcode', async ({ page }) => {
  await expect(page.getByTestId('app-lock-error')).toContainText('Wrong passcode')
  await expect(page.getByTestId('app-lock-screen')).toBeVisible()
})

When('the pilot enters the correct passcode', async ({ page }) => {
  await page.getByTestId('app-lock-input').fill(PASSCODE)
  await page.getByTestId('app-lock-unlock').click()
})

Then('the app is available again', async ({ page }) => {
  await expect(page.getByTestId('app-lock-screen')).toHaveCount(0)
  await expect(page.getByTestId('wipe-request-btn')).toBeVisible()
})

When('the pilot deletes all local data from the lock screen', async ({ page }) => {
  await page.getByTestId('app-lock-forgot').click()
  await page.getByTestId('app-lock-erase-input').fill('DELETE ALL DATA')
  await page.getByTestId('app-lock-erase').click()
})

Then('the app is available again without a lock', async ({ page }) => {
  await expect(page.getByTestId('app-lock-screen')).toHaveCount(0)
  await expect(page.getByTestId('lock-submit')).toHaveText('Enable app lock')
})

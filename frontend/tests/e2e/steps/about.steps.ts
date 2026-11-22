import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { mkdirSync } from 'node:fs'

const { Given, Then } = createBdd()

Given('the pilot opens AeroDash for the About check', async ({ page }) => {
  await page.goto('/')
})

Then('the About view is reachable at desktop and mobile widths', async ({ page, context }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('link', { name: 'About', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'About AeroDash' })).toBeVisible()
    await expect(page.getByText('Version', { exact: true })).toBeVisible()
    await expect(page.getByText('Release date', { exact: true })).toBeVisible()
    mkdirSync('../evidence/about', { recursive: true })
    await page.screenshot({ path: `../evidence/about/about-${width}.png`, fullPage: true })
    await page.getByRole('link', { name: 'AeroDash home' }).click()
  }
  await context.setOffline(true)
  await page.getByRole('link', { name: 'About', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'About AeroDash' })).toBeVisible()
  await expect(page.getByText('Release date', { exact: true })).toBeVisible()
  await context.setOffline(false)
})

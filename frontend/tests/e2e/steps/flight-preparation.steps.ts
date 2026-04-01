import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

// ─── Helpers ───────────────────────────────────────────────────────────────

async function fillStation(page: import('@playwright/test').Page, label: string, value: string) {
  // .mass-station-input: compound component has no single ARIA role; label-scoped CSS is the narrowest viable locator
  const input = page
    .locator('.mass-station-input', { has: page.locator('label', { hasText: label }) })
    .locator('input[type="number"]')
  await input.fill(value)
  await input.dispatchEvent('input')
}

// ─── When steps — Happy path (UJ-B-005) ────────────────────────────────────

When('loads two passengers and light baggage', async ({ page }) => {
  await page.getByLabel('Pilot & Passenger').fill('140')
  await page.getByLabel('Baggage').fill('10')
})

When('adds sufficient fuel for the trip', async ({ page }) => {
  await page.getByLabel('Fuel').fill('50')
})

// ─── When steps — CG migration / burn-out check (UJ-B-001) ────────────────

When('loads heavy rear passengers and aft baggage', async ({ page }) => {
  await fillStation(page, 'Front Seats', '80')
  await fillStation(page, 'Rear Seats', '170')
  await fillStation(page, 'Baggage', '50')
})

When('adds a full fuel load', async ({ page }) => {
  await fillStation(page, 'Fuel Tanks', '131')
})

When('the pilot redistributes baggage weight forward', async ({ page }) => {
  await fillStation(page, 'Baggage', '10')
  await fillStation(page, 'Front Seats', '120')
})

// ─── When steps — Overweight discovery (UJ-B-003) ──────────────────────────

When('loads four heavy adults and maximum baggage', async ({ page }) => {
  await fillStation(page, 'Front Seats', '180')
  await fillStation(page, 'Rear Seats', '180')
  await fillStation(page, 'Baggage Area 1', '54')
  await fillStation(page, 'Baggage Area 2', '23')
})

When('loads four heavy adults with reduced baggage', async ({ page }) => {
  await fillStation(page, 'Front Seats', '180')
  await fillStation(page, 'Rear Seats', '180')
  await fillStation(page, 'Baggage Area 1', '54')
  await fillStation(page, 'Baggage Area 2', '0')
})

// ─── When steps — Burn-sequence polygon (UJ-B-004) ─────────────────────────

When('loads a pilot with a rear passenger and aft baggage', async ({ page }) => {
  await fillStation(page, 'Front Seats', '80')
  await fillStation(page, 'Rear Seats', '80')
  await fillStation(page, 'Baggage', '20')
})

When('fills both fuel tanks to capacity', async ({ page }) => {
  await fillStation(page, 'Forward Tank', '43')
  await fillStation(page, 'Aft Tank', '43')
})

When('the pilot moves the passenger forward and reduces aft baggage', async ({ page }) => {
  await fillStation(page, 'Front Seats', '160')
  await fillStation(page, 'Rear Seats', '0')
  await fillStation(page, 'Baggage', '10')
})

// ─── Then steps ────────────────────────────────────────────────────────────

Then('the aircraft masses are within limits', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Calculation results' })).toBeVisible()
})

Then('the center of gravity remains within the envelope during the flight', async ({ page }) => {
  await expect(page.getByRole('img', { name: /SAFE/ })).toBeVisible()
})

Then('no warnings are displayed', async ({ page }) => {
  await expect(page.locator('.notification.notification--success')).toContainText(
    'Mass & Balance verified',
  )
  // .notification--warning: semantic severity class; no ARIA role distinguishes warning-level alerts
  await expect(page.locator('.notification--warning')).toHaveCount(0)
  // .notification--critical: semantic severity class; no ARIA role distinguishes critical-level alerts
  await expect(page.locator('.notification--critical')).toHaveCount(0)
})

Then('a critical notification {string} is displayed', async ({ page }, message: string) => {
  // .notification--critical: semantic severity class; banner may list several critical items — scope by message
  await expect(page.locator('.notification--critical', { hasText: message })).toBeVisible()
})


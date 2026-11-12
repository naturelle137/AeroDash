import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

// ─── Helpers ───────────────────────────────────────────────────────────────

export async function fillStation(page: import('@playwright/test').Page, label: string, value: string) {
  // Exact label match: "Baggage" must not resolve to "Baggage Area 1", and the
  // fuel slider's aria-label must not compete with the decimal field.
  const input = page.locator('.mass-station-input').getByLabel(label, { exact: true })
  await input.fill(value)
  await input.blur()
  await expect(input).toHaveValue(value)
}

// ─── When steps — Happy path (UJ-B-005) ────────────────────────────────────

When('loads two passengers and light baggage', async ({ page }) => {
  // Use fillStation to scope to .mass-station-input — page-level getByLabel('Baggage')
  // could match other labelled regions on the redesigned page.
  await fillStation(page, 'Pilot & Passenger', '140')
  await fillStation(page, 'Baggage', '10')
})

When('adds sufficient fuel for the trip', async ({ page }) => {
  // getByLabel('Fuel') is ambiguous: the redesigned page also has an
  // aria-label="Fuel and Endurance — coming soon" section that Playwright
  // matches via substring, causing a strict-mode violation.
  await fillStation(page, 'Fuel', '50')
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
  // Draft seeds cap the overall state at WARNING (WARN-AC-002), so SAFE is
  // unreachable by design; a CG breach would raise the chart to CRITICAL.
  await expect(page.getByRole('img', { name: /CG Envelope Chart — (SAFE|WARNING), TOM/ })).toBeVisible()
  // .notification--critical: semantic severity class; no ARIA role distinguishes critical-level alerts
  await expect(page.locator('.notification--critical')).toHaveCount(0)
})

Then('the only warning is the unverified draft-profile notice', async ({ page }) => {
  // .notification--warning: semantic severity class; no ARIA role distinguishes warning-level alerts
  const warnings = page.locator('.notification--warning')
  await expect(warnings).toHaveCount(1)
  await expect(warnings).toHaveText('Draft Profile Active')
  // .notification--critical: semantic severity class; no ARIA role distinguishes critical-level alerts
  await expect(page.locator('.notification--critical')).toHaveCount(0)
})

Then('a critical notification {string} is displayed', async ({ page }, message: string) => {
  // .notification--critical: semantic severity class; banner may list several critical items — scope by message
  await expect(page.locator('.notification--critical', { hasText: message })).toBeVisible()
})


When('the viewport for occupancy is {int} pixels wide', async ({ page }, width: number) => {
  await page.setViewportSize({ width, height: 900 })
})

When('occupant presets exclude baggage and update the front mass', async ({ page, $testInfo }) => {
  const front = page.getByRole('group', { name: 'Front Seats quick presets' })
  await expect(front.getByRole('button')).toHaveCount(3)
  await expect(page.getByRole('group', { name: /Baggage Area [12] quick presets/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Set Baggage Area [12] to/ })).toHaveCount(0)
  await front.getByRole('button', { name: 'Set Front Seats to 70 kg' }).click()
  await expect(page.locator('.mass-station-input').getByLabel('Front Seats', { exact: true })).toHaveValue('70')
  await $testInfo.attach('occupant-presets', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

When('the pilot loads the solo configuration', async ({ page }) => {
  await fillStation(page, 'Front Seats', '80')
  await fillStation(page, 'Baggage Area 1', '0')
  await fillStation(page, 'Baggage Area 2', '0')
  await fillStation(page, 'Fuel Tanks', '50')
  await expect(page.locator('.mass-station-input').getByLabel('Rear Seats', { exact: true })).toHaveValue('0')
})

Then('only the draft notice remains for solo loading', async ({ page, $testInfo }) => {
  await expect(page.locator('.notification--warning')).toHaveCount(1)
  await expect(page.locator('.notification--warning')).toHaveText('Draft Profile Active')
  await expect(page.getByRole('region', { name: 'Calculation results' })).toBeVisible()
  await expect(page.getByText(/missing.*mass|complete.*mandatory/i)).toHaveCount(0)
  await $testInfo.attach('solo-loading', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

When('the pilot empties the required front aggregate', async ({ page }) => {
  await fillStation(page, 'Front Seats', '0')
})

Then('the empty required aggregate warns without naming the optional rear seats', async ({ page, $testInfo }) => {
  const warning = page.locator('.notification--warning', { hasText: 'Implausible mass' })
  await expect(warning).toContainText('Front Seats')
  await expect(warning).not.toContainText('Rear Seats')
  await $testInfo.attach('required-zero', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

When('the pilot restores solo mass and clears the optional rear input', async ({ page }) => {
  await fillStation(page, 'Front Seats', '80')
  const rear = page.locator('.mass-station-input').getByLabel('Rear Seats', { exact: true })
  await rear.fill('')
  await rear.blur()
})

Then('a missing optional input blocks calculation until explicit zero', async ({ page }) => {
  await expect(page.locator('.notification--error')).not.toHaveCount(0)
  await expect(page.getByText('Implausible mass', { exact: false })).toHaveCount(0)
  await fillStation(page, 'Rear Seats', '0')
  await expect(page.locator('.notification--error')).toHaveCount(0)
  await expect(page.locator('.notification--warning')).toHaveText('Draft Profile Active')
})

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { readStoredProfile } from '../fixtures/fleet-seed'

const { When, Then } = createBdd()
const id = '00000000-0000-4000-a000-000000000232'

When('the pilot manages passenger profiles at width {int}', async ({ page }, width: number) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`/fleet/${id}/edit`)
  await page.getByRole('button', { name: 'Passenger Profiles' }).click()
  await page.getByRole('button', { name: 'Add passenger profile' }).click()
  await expect(page.getByRole('button', { name: 'Save Draft' })).toBeDisabled()
  await page.getByLabel('Name', { exact: true }).last().fill('Synthetic adult')
  await page.getByLabel('Standard weight').fill('180')
  await page.getByLabel('Unit', { exact: true }).last().selectOption('lbs')
  await page.getByRole('button', { name: 'Add passenger profile' }).click()
  await page.getByLabel('Name', { exact: true }).last().fill('Remove me')
  await page.getByLabel('Standard weight').last().fill('40')
  await page.getByRole('button', { name: 'Remove passenger profile 2' }).click()
  await page.screenshot({ path: `${process.env.TMPDIR}/passenger-profiles-${width}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Save Draft' }).click()
  await expect(page).toHaveURL(/\/fleet$/)
})

Then('the saved passenger profiles survive reload at width {int}', async ({ page }, _width: number) => {
  await page.reload()
  const profile = await readStoredProfile(page, 'D-EBPN') as { passengerProfiles: unknown[]; loadPoints: { defaultQuantity: number }[] }
  expect(profile.passengerProfiles).toEqual([{ name: 'Synthetic adult', standardWeight: 180, unit: 'lbs' }])
  expect(profile.loadPoints[0]?.defaultQuantity).toBe(0)
  await page.goto(`/fleet/${id}/edit`)
  await page.getByRole('button', { name: 'Passenger Profiles' }).click()
  await expect(page.getByLabel('Standard weight')).toHaveValue('180')
  await page.getByLabel('Standard weight').fill('82')
  await page.getByLabel('Unit', { exact: true }).last().selectOption('kg')
  await page.getByRole('button', { name: 'Save Draft' }).click()
  await expect(page).toHaveURL(/\/fleet$/)
  await page.reload()
  const edited = await readStoredProfile(page, 'D-EBPN') as { passengerProfiles: unknown[] }
  expect(edited.passengerProfiles).toEqual([{ name: 'Synthetic adult', standardWeight: 82, unit: 'kg' }])
})

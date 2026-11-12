import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import {
  AircraftProfileSchema,
  type AircraftProfile,
} from '../../../src/core/adapters/aircraft.schema'

const { Given, When, Then } = createBdd()

function buildProfile(overrides: Partial<AircraftProfile> = {}): AircraftProfile {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    ownerId: 'user-test',
    registration: 'D-EBPN',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: 'draft',
    schemaVersion: 1,
    powertrain: 'combustion',
    passengerProfiles: [],
    weighingReports: [
      { bem: 432, emptyCg: 1.882, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
    ],
    loadPoints: [
      {
        name: 'Pilot',
        arm: 1.8,
        armLookup: [],
        operationalLimit: 110,
        defaultQuantity: 0,
        unit: 'kg',
        allowableCategories: null,
        fuelTank: null,
      },
    ],
    certificationCategories: [
      {
        category: 'Normal',
        mtom: 650,
        maxZeroFuelMass: null,
        graphType: 'arm',
        envelope: [
          { armOrMoment: 1.841, mass: 432 },
          { armOrMoment: 1.841, mass: 650 },
          { armOrMoment: 1.978, mass: 650 },
          { armOrMoment: 1.978, mass: 432 },
        ],
      },
    ],
    ...overrides,
  }
}

Given(
  'a {string} verification profile at viewport {int} by {int}',
  async ({ page }, kind: string, width: number, height: number) => {
    await page.setViewportSize({ width, height })
    await page.clock.setFixedTime(new Date('2026-03-01T12:00:00Z'))
    await page.goto('/fleet')
    await expect(page.getByRole('button', { name: '+ Add New Aircraft' })).toBeVisible()
    const profile = AircraftProfileSchema.parse(
      buildProfile(
        kind === 'future persisted'
          ? {
              status: 'verified',
              verification: {
                verifiedOn: '2099-01-01',
                verifiedBy: 'JS',
                pohRevision: 'Rev 7',
                sourceWeighingDate: '2025-01-01',
              },
            }
          : {},
      ),
    )
    await page.evaluate(async (record) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('aerodash-fleet')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction('aircraft_profiles', 'readwrite')
          transaction.objectStore('aircraft_profiles').put(record)
          transaction.oncomplete = () => {
            db.close()
            resolve()
          }
          transaction.onerror = () => {
            db.close()
            reject(transaction.error)
          }
        }
      })
    }, profile)
    await page.reload()
    await expect(page.locator('.profile-item', { hasText: 'D-EBPN' })).toBeVisible()
  },
)

When('the pilot checks the future persisted verification gate', async ({ page }) => {
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft')
  await expect(picker.locator('option', { hasText: 'D-EBPN' })).toContainText('[Expired]')
  await picker.selectOption('00000000-0000-4000-a000-000000000001')
  await expect(page.locator('.draft-ack')).toContainText('invalid verification date')
  await expect(page.locator('.locked-placeholder')).toBeVisible()
  await page.goto('/fleet')
})

When('the pilot rejects a future sign-off then signs off today', async ({ page, $testInfo }) => {
  await page.getByRole('button', { name: /^(Re-verify|Verify) D-EBPN$/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('JS')
  await dialog.getByLabel('POH revision').fill('Rev 7')
  const date = dialog.getByLabel('Verification date')
  await expect(date).toHaveAttribute('max', '2026-03-01')
  await date.fill('2026-03-02')
  await expect(dialog.getByRole('button', { name: 'Verify', exact: true })).toBeDisabled()
  await $testInfo.attach('future-date-rejected', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
  await date.fill('2026-03-01')
  await expect(dialog.getByRole('button', { name: 'Verify', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.profile-item')).toContainText('Verified by JS on 2026-03-01')
  await $testInfo.attach('valid-signoff-saved', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
  await page.reload()
  await expect(page.locator('.profile-item')).toContainText('Verified by JS on 2026-03-01')
})

Then('the verified profile loads without the expired acknowledgement', async ({ page }) => {
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft')
  const option = picker.locator('option', { hasText: 'D-EBPN' })
  await expect(option).not.toContainText('[Expired]')
  await picker.selectOption({ label: (await option.textContent())!.trim() })
  await expect(page.locator('.draft-ack')).toBeHidden()
  await expect(page.getByRole('region', { name: 'Mass and Balance' })).toBeVisible()
})

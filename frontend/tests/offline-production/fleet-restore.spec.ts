import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { testPohAircraft } from '../fixtures/poh-aircraft'

async function rows(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('aerodash-fleet', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction('aircraft_profiles').objectStore('aircraft_profiles').getAll()
      request.onsuccess = () => { db.close(); resolve(request.result) }
      request.onerror = () => reject(request.error)
    })
  })
}
async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await info.attach(name, { path, contentType: 'image/png' })
}
const choose = (page: Page, json: string) => page.getByLabel('Fleet backup (.json, up to 5 MB / 100 profiles)').setInputFiles({
  name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(json),
})

test('Privacy export restores all synthetic values as drafts through explicit offline Fleet confirmation', async ({ page, context }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const first = testPohAircraft()
  first.performanceProfiles!.forEach((table) => {
    table.sourceUnits = { mass: 'lb', pressureAltitude: 'm', temperature: '°F', distance: 'ft' }
    table.sourceReference = 'Synthetic restore provenance only; not operational data'
  })
  first.sourceUnit = 'lb'
  const second = { ...structuredClone(first), registration: 'D-NEXT', id: '00000000-0000-4000-a000-000000000429' }
  for (const profile of [first, second]) {
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(profile)),
    })
    await expect(page.locator('.profile-item').filter({ hasText: profile.registration })).toBeVisible()
  }
  await page.goto('/privacy')
  const downloadEvent = page.waitForEvent('download')
  await page.getByTestId('export-all-btn').click()
  const download = await downloadEvent
  const backup = await readFile((await download.path())!, 'utf8')
  await info.attach('actual-privacy-backup.json', { body: backup, contentType: 'application/json' })
  const exported = JSON.parse(backup)
  expect(exported.profileCount).toBe(2)
  // Explicit deletion of this isolated Playwright context's two synthetic fixtures only.
  await page.getByTestId('wipe-request-btn').click()
  await page.getByTestId('wipe-confirm-input').fill('DELETE ALL DATA')
  await page.getByTestId('wipe-confirm-btn').click()
  await expect(page.getByTestId('privacy-wipe-notice')).toBeVisible()
  await page.goto('/fleet')
  const gate = page.getByTestId('disclaimer-gate-accept')
  if (await gate.isVisible()) await gate.click()
  expect(await rows(page)).toEqual([])
  await context.setOffline(true)
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await choose(page, backup)
  await expect(page.getByTestId('restore-preview')).toContainText('Review 2 aircraft')
  expect(await rows(page)).toEqual([])
  await page.getByTestId('restore-preview').scrollIntoViewIfNeeded()
  await capture(page, info, 'offline-restore-preview')
  await page.getByRole('button', { name: 'Cancel restore', exact: true }).click()
  expect(await rows(page)).toEqual([])
  await expect(page.getByTestId('restore-preview')).toHaveCount(0)
  await choose(page, backup)
  await page.getByRole('button', { name: 'Confirm restore', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Restored 2 aircraft' })).toBeVisible()
  await expect(page.locator('.profile-item')).toHaveCount(2)
  const restored = await rows(page) as typeof exported.profiles
  for (const source of exported.profiles) {
    const actual = restored.find((p: { registration: string }) => p.registration === source.registration)
    expect(actual.id).not.toBe(source.id)
    expect(actual).toEqual({ ...source, id: actual.id, status: 'draft' })
  }
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await expect(page.locator('.profile-item')).toHaveCount(2)
  for (const registration of ['D-TEST', 'D-NEXT']) {
    const row = page.locator('.profile-item').filter({ hasText: registration })
    await expect(row).toContainText('draft', { ignoreCase: true })
    await row.getByText('Review imported performance tables', { exact: true }).click()
    await row.getByText('TakeoffRoll — 8 points', { exact: true }).click()
    await expect(row).toContainText(first.performanceProfiles![0]!.sourceReference!)
    await expect(row).toContainText('lb')
    await expect(row).toContainText('°F')
    await row.scrollIntoViewIfNeeded()
    await capture(page, info, `offline-review-${registration}`)
    await row.getByText('Review imported performance tables', { exact: true }).click()
  }
  await page.getByRole('button', { name: 'Select D-TEST as active aircraft', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'WARN-AC-002' })).toBeVisible()
  await capture(page, info, 'offline-restored-draft-selected')
  await info.attach('restored-persistent-profiles.json', { body: JSON.stringify(restored, null, 2), contentType: 'application/json' })

  const before = await rows(page)
  const storageBefore = await page.evaluate(() => ({ ...localStorage }))
  for (const invalid of [
    backup,
    '{',
    JSON.stringify({ ...exported, exportSchemaVersion: 999 }),
    JSON.stringify({ ...exported, profileCount: 1 }),
    JSON.stringify({ ...exported, profiles: [exported.profiles[0], { ...exported.profiles[1], registration: 'd-test' }] }),
    JSON.stringify({ ...exported, profiles: [exported.profiles[0], { ...exported.profiles[1], schemaVersion: 999 }] }),
    JSON.stringify({ ...exported, profiles: [exported.profiles[0], { ...exported.profiles[1], weighingReports: [] }] }),
  ]) {
    await choose(page, invalid)
    await expect(page.locator('[aria-labelledby="restore-heading"]').getByRole('alert')).toBeVisible()
    await expect(page.getByTestId('restore-preview')).toHaveCount(0)
    expect(await rows(page)).toEqual(before)
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storageBefore)
    await expect(page.getByRole('button', { name: 'D-TEST is the active aircraft', exact: true })).toBeVisible()
  }
  await capture(page, info, 'offline-rejected-backup-preserves-fleet')
})

test('storage abort preserves real active preparation and persistent fleet, then retries the same preview', async ({ page }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  const existing = testPohAircraft()
  existing.registration = 'D-KEEP'
  existing.loadPoints = [{ name: 'Synthetic pilot', kind: 'occupant', occupancy: 'required', arm: 1,
    armLookup: [], operationalLimit: 150, defaultQuantity: 80, unit: 'kg', allowableCategories: null, fuelTank: null }]
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
    name: 'synthetic-keep.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(existing)),
  })
  await page.getByRole('link', { name: 'Flight Prep', exact: true }).click()
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await expect(picker.locator('option').filter({ hasText: 'D-KEEP' })).toHaveCount(1)
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-KEEP' }).getAttribute('value'))!)
  await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  const pilot = page.getByRole('textbox', { name: 'Synthetic pilot', exact: true })
  await pilot.fill('85')
  await pilot.blur()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('aerodash:session:payload')?.includes('85') ?? false)).toBe(true)
  await page.getByRole('link', { name: 'Fleet', exact: true }).click()
  const before = await rows(page)
  const prepBefore = await page.evaluate(() => localStorage.getItem('aerodash:session:payload'))
  const backup = JSON.stringify({ exportSchemaVersion: 1, exportedAt: '2026-01-01T00:00:00Z', profileCount: 2,
    profiles: [testPohAircraft(), { ...testPohAircraft(), registration: 'D-NEXT' }] })
  await choose(page, backup)
  await page.getByRole('button', { name: 'Cancel restore', exact: true }).click()
  expect(await rows(page)).toEqual(before)
  expect(await page.evaluate(() => localStorage.getItem('aerodash:session:payload'))).toEqual(prepBefore)
  await choose(page, backup)
  // Abort after the second native add request succeeds: earlier writes must roll back.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add
    let count = 0
    IDBObjectStore.prototype.add = function (...args) {
      const request = original.apply(this, args)
      if (++count === 2) {
        request.addEventListener('success', () => this.transaction.abort())
        IDBObjectStore.prototype.add = original
      }
      return request
    }
  })
  await page.getByRole('button', { name: 'Confirm restore', exact: true }).click()
  await expect(page.locator('[aria-labelledby="restore-heading"]').getByRole('alert')).toContainText('aborted')
  expect(await rows(page)).toEqual(before)
  expect(await page.evaluate(() => localStorage.getItem('aerodash:session:payload'))).toEqual(prepBefore)
  await expect(page.getByRole('button', { name: 'D-KEEP is the active aircraft', exact: true })).toBeVisible()
  await page.getByTestId('restore-preview').scrollIntoViewIfNeeded()
  await capture(page, info, 'storage-abort-retains-preview-and-fleet')
  await page.getByRole('button', { name: 'Confirm restore', exact: true }).click()
  await expect(page.locator('.profile-item')).toHaveCount(3)
  expect(await page.evaluate(() => localStorage.getItem('aerodash:session:payload'))).toEqual(prepBefore)
  await page.getByRole('link', { name: 'Flight Prep', exact: true }).click()
  await expect(pilot).toHaveValue('85')
  await expect(page.getByRole('region', { name: 'Calculation results', exact: true })).toContainText('585.0')
  await capture(page, info, 'preparation-preserved-after-restore-retry')
})

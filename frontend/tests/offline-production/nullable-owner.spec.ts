import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { testPohAircraft } from '../fixtures/poh-aircraft'

test('ownerless wizard creation and legacy exchange persist through cached offline reload', async ({ page, context }, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  async function rows() {
    return page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('aerodash-fleet', 2)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        return await new Promise<Record<string, unknown>[]>((resolve, reject) => {
          const request = db.transaction('aircraft_profiles').objectStore('aircraft_profiles').getAll()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      } finally { db.close() }
    })
  }
  async function shot(name: string) {
    const path = info.outputPath(`${name}.png`)
    await page.screenshot({ path })
    await info.attach(name, { path, contentType: 'image/png' })
  }
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  expect((await page.reload())?.fromServiceWorker()).toBe(true)

  await page.getByRole('button', { name: '+ Add New Aircraft', exact: true }).click()
  await page.getByLabel('Manufacturer', { exact: true }).selectOption('Tecnam')
  await page.locator('#model-input').selectOption({ label: 'P2008 JC' })
  await page.getByLabel('Registration', { exact: true }).fill('D-NULL')
  await page.getByLabel('ICAO Type Designator', { exact: true }).fill('P208')
  await page.getByLabel('Reference Datum — Description', { exact: true }).fill('Synthetic software fixture only')
  await page.getByRole('button', { name: 'Continue →', exact: true }).click()
  await page.getByLabel(/MTOM.*Maximum Take-Off Mass/).fill('630')
  await page.getByRole('button', { name: 'Continue →', exact: true }).click()
  await page.getByLabel('BEM', { exact: true }).fill('433')
  await page.getByLabel('Empty CG', { exact: true }).fill('1.882')
  await page.getByRole('button', { name: 'Continue →', exact: true }).click()
  await page.getByRole('button', { name: 'Continue →', exact: true }).click()
  await page.getByRole('button', { name: 'Continue →', exact: true }).click()
  await page.getByRole('button', { name: 'Save as Draft', exact: true }).click()
  await page.getByRole('dialog', { name: 'Aircraft saved as draft' }).getByRole('button', { name: 'Back to Fleet', exact: true }).click()
  await expect(page.locator('.profile-item')).toContainText('D-NULL')
  expect(await rows()).toMatchObject([{ ownerId: null, schemaVersion: 3, status: 'draft' }])
  await shot('offline-ownerless-created')

  const source = testPohAircraft()
  source.schemaVersion = 2
  source.ownerId = '  legacy-owner  '
  source.performanceProfiles!.forEach((table) => {
    table.sourceUnits = { mass: 'lb', pressureAltitude: 'm', temperature: '°F', distance: 'ft' }
    table.sourceReference = 'Synthetic owner migration fixture; not operational data'
  })
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
    name: 'synthetic-v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)),
  })
  await expect(page.locator('.profile-item')).toHaveCount(2)
  const before = await rows()
  const legacy = before.find((profile) => profile.registration === 'D-TEST')!
  expect(legacy).toMatchObject({ ownerId: source.ownerId, schemaVersion: 3, status: 'draft', performanceProfiles: source.performanceProfiles })
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await expect(page.locator('.profile-item')).toHaveCount(2)
  expect(await rows()).toEqual(before)
  await shot('offline-legacy-reloaded')

  await page.goto('/privacy')
  const downloadEvent = page.waitForEvent('download')
  await page.getByTestId('fleet-backup-btn').click()
  const download = await downloadEvent
  const backup = await readFile((await download.path())!, 'utf8')
  const exported = JSON.parse(backup)
  expect(exported.profiles).toHaveLength(before.length)
  expect(exported.profiles).toEqual(expect.arrayContaining(before))
  await info.attach('actual-synthetic-backup.json', { body: backup, contentType: 'application/json' })
  // Erase only these synthetic profiles in this isolated browser context.
  await page.getByTestId('wipe-request-btn').click()
  await page.getByTestId('wipe-confirm-input').fill('DELETE ALL DATA')
  await page.getByTestId('wipe-confirm-btn').click()
  await expect(page.getByTestId('privacy-wipe-notice')).toBeVisible()
  expect(await rows()).toEqual([])
  await page.goto('/fleet')
  const gate = page.getByTestId('disclaimer-gate-accept')
  if (await gate.isVisible()) await gate.click()
  await page.getByLabel('Fleet backup (.json, up to 5 MB / 100 profiles)').setInputFiles({
    name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup),
  })
  await expect(page.getByTestId('restore-preview')).toContainText('Review 2 aircraft')
  await page.getByRole('button', { name: 'Confirm restore', exact: true }).click()
  await expect(page.locator('.profile-item')).toHaveCount(2)
  expect((await page.reload())?.fromServiceWorker()).toBe(true)
  await expect(page.locator('.profile-item')).toHaveCount(2)
  const restored = await rows()
  for (const original of before) {
    const actual = restored.find((profile) => profile.registration === original.registration)!
    expect(actual.id).not.toBe(original.id)
    expect(actual).toEqual({ ...original, id: actual.id })
  }
  await shot('offline-restored-owners')
  await info.attach('console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' })
  expect(errors.filter((message) => !message.includes("directive 'frame-ancestors' is ignored when delivered via a <meta> element"))).toEqual([])
})

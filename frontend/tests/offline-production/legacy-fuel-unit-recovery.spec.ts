import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic arithmetic only: BEM 560 kg / 1120 kg·m includes unusable fuel.
// At q=30, u=10, F(q)=60 and F(u)=10: 580 kg / 1170 kg·m → 2.017 m.
function legacyProfile() {
  const profile = testPohAircraft()
  return {
    ...profile,
    registration: 'D-UNIT', sourceUnit: 'kg-m', status: 'draft', performanceProfiles: [],
    weighingReports: [{ bem: 560, emptyCg: 2, weighingDate: '2026-01-01', validFrom: '2026-01-01' }],
    loadPoints: [{
      name: 'Legacy lookup tank', arm: null,
      armLookup: [
        { massOrVolume: 0, moment: 0 }, { massOrVolume: 10, moment: 10 },
        { massOrVolume: 30, moment: 60 }, { massOrVolume: 50, moment: 150 },
      ],
      operationalLimit: null, defaultQuantity: 30, unit: '', allowableCategories: null,
      fuelTank: { unusableFuel: 10, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] },
    }],
    certificationCategories: [{
      category: 'Normal', mtom: 1000, maxZeroFuelMass: null, graphType: 'arm',
      envelope: [
        { mass: 500, armOrMoment: 1 }, { mass: 1000, armOrMoment: 1 },
        { mass: 1000, armOrMoment: 3 }, { mass: 500, armOrMoment: 3 },
      ],
    }],
  }
}

for (const offline of [false, true]) {
  test(`persisted missing fuel unit can be corrected through Fleet (${offline ? 'cached offline' : 'online'})`, async ({ page, context }, info) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    const original = legacyProfile()
    async function shot(name: string) {
      const path = info.outputPath(`${name}.png`)
      await page.screenshot({ path, fullPage: true })
      await info.attach(name, { path, contentType: 'image/png' })
      const focus = name.includes('editor') || name.includes('unit-reloaded')
        ? page.getByLabel('Unit', { exact: true })
        : name.includes('blocks')
          ? page.getByRole('alert').filter({ hasText: 'Invalid input: Legacy lookup tank' })
          : page.getByRole('region', { name: 'Calculation results' })
      await focus.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      const viewport = info.outputPath(`${name}-viewport.png`)
      await page.screenshot({ path: viewport })
      await info.attach(`${name}-viewport`, { path: viewport, contentType: 'image/png' })
    }
    async function storedTank() {
      return page.evaluate(async (id) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('aerodash-fleet')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        try {
          return await new Promise((resolve, reject) => {
            const request = db.transaction('aircraft_profiles').objectStore('aircraft_profiles').get(id)
            request.onsuccess = () => resolve(request.result.loadPoints[0])
            request.onerror = () => reject(request.error)
          })
        } finally { db.close() }
      }, original.id)
    }
    await page.goto('/fleet')
    await page.getByTestId('disclaimer-gate-accept').click()
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload()
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
    // Seed historical storage once. All subsequent correction goes through the real editor.
    await page.evaluate(async (profile) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('aerodash-fleet')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('aircraft_profiles', 'readwrite')
          tx.objectStore('aircraft_profiles').add(profile)
          tx.oncomplete = () => resolve()
          tx.onabort = () => reject(tx.error)
        })
      } finally { db.close() }
    }, original)
    if (offline) await context.setOffline(true)
    const response = await page.reload()
    if (offline) expect(response?.fromServiceWorker()).toBe(true)
    await expect(page.getByRole('button', { name: 'Edit D-UNIT', exact: true })).toBeVisible()

    async function openEditor() {
      await page.getByRole('button', { name: 'Edit D-UNIT', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Edit Aircraft', exact: true })).toBeVisible()
    }
    const unit = page.getByLabel('Unit', { exact: true })
    await openEditor()
    await expect(unit).toHaveValue('')
    await expect(unit.locator('option:checked')).toHaveText('Missing unit — select from source')
    await expect(page.getByRole('alert').filter({ hasText: 'Missing fuel quantity unit' })).toBeVisible()
    expect(await storedTank()).toEqual(original.loadPoints[0])
    await shot('missing-unit-editor')
    // A real unrelated edit/save must not silently choose or change tank data.
    await page.getByLabel('Reference Datum — Description', { exact: true }).fill('Synthetic datum edited')
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit D-UNIT', exact: true })).toBeVisible()
    expect(await storedTank()).toEqual(original.loadPoints[0])
    await page.reload()
    await openEditor()
    await expect(unit).toHaveValue('')
    expect(await storedTank()).toEqual(original.loadPoints[0])
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    async function preparation() {
      await page.goto('/mass-balance')
      const picker = page.getByLabel('Select aircraft', { exact: true })
      await picker.selectOption(original.id)
      const warning = page.getByRole('button', { name: 'Continue anyway', exact: true })
      if (await warning.isVisible()) await warning.click()
    }
    const results = page.getByRole('region', { name: 'Calculation results' })
    await preparation()
    await expect(page.getByRole('alert').filter({ hasText: 'Invalid input: Legacy lookup tank' })).toBeVisible()
    await expect(results).toHaveCount(0)
    await expect(page.getByTestId('cg-point-label-tom')).toHaveCount(0)
    await shot('missing-unit-blocks-calculation')
    await page.goto('/fleet')
    await openEditor()
    await unit.selectOption('kg')
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit D-UNIT', exact: true })).toBeVisible()
    expect(await storedTank()).toEqual({ ...original.loadPoints[0], unit: 'kg' })
    await page.reload()
    await openEditor()
    await expect(unit).toHaveValue('kg')
    await expect(page.getByRole('alert').filter({ hasText: 'Missing fuel quantity unit' })).toHaveCount(0)
    await shot('corrected-unit-reloaded')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await preparation()
    await expect(results.locator('.result-summary__item', { hasText: 'Takeoff Mass' })).toContainText('580.0')
    await expect(results.locator('.result-summary__item', { hasText: 'CG (Takeoff)' })).toContainText('2.017')
    await expect(page.getByTestId('cg-point-label-tom')).toBeVisible()
    await shot('corrected-calculation')
    expect(await storedTank()).toEqual({ ...original.loadPoints[0], unit: 'kg' })
    await info.attach('browser-errors', { body: JSON.stringify(errors), contentType: 'application/json' })
    // Vite preview serves the existing meta CSP; frame-ancestors requires an HTTP header.
    // Keep the raw console evidence and reject every error except this exact baseline diagnostic.
    const previewCspDiagnostic = "The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element."
    expect(errors.filter((error) => error !== previewCspDiagnostic)).toEqual([])
  })
}

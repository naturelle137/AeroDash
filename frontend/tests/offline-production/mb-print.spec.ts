import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic UI/pagination vectors only; no operational aircraft validation.
test('current M&B native print, cancellation, guarded transitions and cached offline reload', async ({ page, context }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const profile = testPohAircraft()
  profile.registration = 'D-PRINT'
  profile.performanceProfiles = []
  profile.certificationCategories.push({ ...profile.certificationCategories[0]!, category: 'Utility' })
  profile.loadPoints = Array.from({ length: 12 }, (_, index) => ({
    name: `Synthetic occupant ${index + 1}: ${'Long warning pagination text '.repeat(5)}`,
    kind: 'occupant' as const, occupancy: 'required' as const,
    arm: 1, armLookup: [], operationalLimit: 100, defaultQuantity: 0, unit: 'kg',
    allowableCategories: null, fuelTank: null,
  }))
  for (const registration of ['D-PRINT', 'D-NEXT']) {
    profile.registration = registration
    if (registration === 'D-NEXT') profile.id = '00000000-0000-4000-a000-000000000429'
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'synthetic-print.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
    })
    await expect(page.getByRole('button', { name: `Verify ${registration}`, exact: true })).toBeVisible()
  }
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  async function select(registration: string) {
    const option = picker.locator('option').filter({ hasText: registration }).first()
    await picker.selectOption((await option.getAttribute('value'))!)
    await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  }
  await select('D-PRINT')
  const action = page.getByRole('button', { name: 'M&B print preview', exact: true })
  await expect(action).toBeEnabled()
  const input = page.locator('#station-0')
  await input.fill('50')
  await input.blur()
  const preparation = await input.inputValue()
  await action.click()
  const preview = page.getByRole('dialog', { name: 'M&B print preview', exact: true })
  await expect(preview).toContainText('550.0 kg [UNVERIFIED]')
  await expect(preview).toContainText('WARN-UQ-001')
  await expect(preview).toContainText('draft; draft [UNVERIFIED]')
  await expect(preview).toContainText('Pilot in Command assumes full responsibility.')
  await expect(preview).toContainText('not the trip-specific arrival')
  await expect(preview.locator('table').first()).toContainText('50 kg [UNVERIFIED]')
  await page.screenshot({ path: info.outputPath('preview-screen.png') })
  await info.attach('preview-screen', { path: info.outputPath('preview-screen.png'), contentType: 'image/png' })
  // Invoke the real native window.print contract; observe beforeprint, without replacing print.
  await page.evaluate(() => {
    document.documentElement.dataset.printEvents = '0'
    window.addEventListener('beforeprint', () => {
      document.documentElement.dataset.printEvents = String(Number(document.documentElement.dataset.printEvents) + 1)
    })
  })
  await preview.getByRole('button', { name: 'Print M&B', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-print-events', '1')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#app')).toBeHidden()
  await expect(preview.locator('h1')).toBeVisible()
  await page.screenshot({ path: info.outputPath('preview-print-media.png'), fullPage: true })
  await page.pdf({ path: info.outputPath('mb-summary.pdf'), preferCSSPageSize: true, printBackground: true })
  await info.attach('paginated-browser-output', { path: info.outputPath('mb-summary.pdf'), contentType: 'application/pdf' })
  await info.attach('print-media', { path: info.outputPath('preview-print-media.png'), contentType: 'image/png' })
  await page.emulateMedia({ media: 'screen' })
  await preview.getByRole('button', { name: 'Back to preparation' }).click()
  await expect(input).toHaveValue(preparation)
  await expect(action).toBeFocused()
  await action.click()
  // A current preparation mutation while preview is open must destroy the old snapshot.
  await page.locator('#category-select').evaluate((element: HTMLSelectElement) => {
    element.value = 'Utility'; element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(preview).toContainText('Preview invalidated')
  await expect(preview).not.toContainText('550.0 kg')
  await expect(preview.getByRole('button', { name: 'Print M&B' })).toBeDisabled()
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: info.outputPath('invalidated.pdf'), preferCSSPageSize: true })
  await page.emulateMedia({ media: 'screen' })
  await page.keyboard.press('Escape')
  await input.fill('1000')
  await input.blur()
  await expect(action).toBeDisabled()
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#app')).toBeHidden()
  await expect(page.locator('.mb-print-guard')).toBeVisible()
  await page.pdf({ path: info.outputPath('critical-blocked.pdf'), preferCSSPageSize: true })
  await page.emulateMedia({ media: 'screen' })
  await input.fill('40')
  await input.blur()
  await action.click()
  await expect(preview).toContainText('540.0 kg')
  await page.locator('#station-0').evaluate((element: HTMLInputElement) => {
    element.value = '60'; element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(preview).toContainText('Preview invalidated')
  await page.keyboard.press('Escape')
  await action.click()
  await picker.evaluate((element: HTMLSelectElement) => {
    element.value = [...element.options].find(o => o.text.includes('D-NEXT'))!.value
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(preview).toContainText('Preview invalidated')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Continue anyway', exact: true }).click()
  await action.click()
  await expect(preview).toContainText('D-NEXT')
  await expect(preview).not.toContainText('D-PRINT')
  await page.keyboard.press('Escape')
  await context.setOffline(true)
  await page.reload()
  await expect(preview).toHaveCount(0)
  await select('D-NEXT')
  await expect(action).toBeEnabled()
  await action.click()
  await expect(preview).toContainText('D-NEXT')
  await expect(preview).toContainText('WARN-UQ-001')
  await page.evaluate(() => {
    document.documentElement.dataset.offlinePrint = 'pending'
    window.addEventListener('beforeprint', () => { document.documentElement.dataset.offlinePrint = 'invoked' })
  })
  await preview.getByRole('button', { name: 'Print M&B', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-offline-print', 'invoked')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#app')).toBeHidden()
  await expect(preview.locator('.mb-print-controls')).toBeHidden()
  await page.pdf({ path: info.outputPath('offline-summary.pdf'), preferCSSPageSize: true })
  await info.attach('offline-browser-output', { path: info.outputPath('offline-summary.pdf'), contentType: 'application/pdf' })
  await page.emulateMedia({ media: 'screen' })
  await page.screenshot({ path: info.outputPath('offline-preview.png') })
  await info.attach('offline-preview', { path: info.outputPath('offline-preview.png'), contentType: 'image/png' })
  await context.setOffline(false)
})

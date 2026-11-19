import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

test('estimated distances appear in the briefing online and offline', async ({ page, context }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const profile = testPohAircraft()
  profile.weighingReports[0]!.bem = 900
  profile.performanceProfiles = profile.performanceProfiles!.filter(table => table.flightPhase !== 'TakeoffDistance50ft')
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('TS')
  await dialog.getByLabel('POH revision').fill('Synthetic wiring only')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
  const perf = page.getByRole('region', { name: 'Performance', exact: true })
  async function calculate() {
    await perf.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
    await perf.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1000')
    await perf.getByLabel('Temperature (°C)', { exact: true }).fill('10')
    await expect(perf.getByRole('group', { name: 'Takeoff raw distances' })).toContainText('418.0 mESTIMATED (CAA SSL 07)')
  }
  for (const offline of [false, true]) {
    if (offline) {
      await context.setOffline(true)
      expect((await page.reload())?.fromServiceWorker()).toBe(true)
      await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).first().getAttribute('value'))!)
    }
    await calculate()
    await page.getByRole('button', { name: 'Briefing Pack', exact: true }).click()
    const preview = page.getByRole('dialog', { name: 'Briefing Pack preview' })
    await expect(preview).toContainText('418.0 m')
    await expect(preview).toContainText('ESTIMATED (CAA SSL 07)')
    const path = info.outputPath(`estimated-${offline ? 'offline' : 'online'}-${info.project.name}.png`)
    await page.screenshot({ path, animations: 'disabled', fullPage: true })
    await info.attach(`estimated-${offline ? 'offline' : 'online'}`, { path, contentType: 'image/png' })
    await page.keyboard.press('Escape')
  }
})

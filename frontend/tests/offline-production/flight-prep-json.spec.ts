import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'
import { readFile } from 'node:fs/promises'

test('exports current inputs locally online and cached offline', async ({ page, context }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const profile = testPohAircraft()
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })) })
  await page.goto('/mass-balance')
  await page.getByLabel('Select aircraft', { exact: true }).selectOption({ label: /D-TEST/ })
  const ack = page.getByRole('button', { name: /continue/i })
  if (await ack.isVisible()) await ack.click()
  const performance = page.getByRole('region', { name: 'Performance', exact: true })
  await performance.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true }).check()
  await performance.getByLabel('Pressure altitude (ft)', { exact: true }).fill('1234')
  await performance.getByLabel('Temperature (°C)', { exact: true }).fill('12')
  const runway = performance.getByRole('form', { name: 'Manual runway', exact: true })
  await runway.getByLabel('Aerodrome', { exact: true }).fill('Synthetic field')
  for (const offline of [false, true]) {
    await context.setOffline(offline)
    const button = page.getByTestId('flight-prep-export')
    await button.scrollIntoViewIfNeeded()
    const path = info.outputPath(`flight-prep-json-${offline ? 'offline' : 'online'}.png`)
    await page.screenshot({ path, animations: 'disabled' })
    await info.attach(`flight-prep-json-${offline ? 'offline' : 'online'}`, { path, contentType: 'image/png' })
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()])
    const data = JSON.parse(await readFile((await download.path())!, 'utf8'))
    expect(data).toMatchObject({ format: 'aerodash-flight-preparation', version: 1, aircraft: { registration: 'D-TEST' }, entries: { performance: { temperature: '12', pressureAltitude: { direct: '1234' } } }, runway: { draft: { aerodrome: 'Synthetic field', toda: '' }, saved: null }, units: { pressureAltitudeDirect: 'ft' } })
    expect(data.notice).toContain('Unverified')
  }
})

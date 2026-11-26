import { expect, test } from '@playwright/test'

test('flight time and location govern TAF wind and observation fallback', async ({ page }, info) => {
  await page.clock.setFixedTime(new Date('2026-11-21T17:00:00Z'))
  await page.route('https://wxdecoder.com/api/wx/EDDF', route => route.fulfill({ json: {
    metar: { raw: 'EDDF 211620Z 17004KT 12/08 Q1013', station: 'EDDF', reportTime: '2026-11-21T16:20:00Z', reportTimeKnown: true },
    taf: { raw: 'TAF EDDF 211100Z 2112/2218 21005KT 9999 BKN020 FM211800 30012KT 9999 BKN020', station: 'EDDF', issueTime: '2026-11-21T11:00:00Z', validFrom: '2026-11-21T12:00:00Z', validTo: '2026-11-22T18:00:00Z' },
  } }))
  await page.goto('/mass-balance')
  const accept = page.getByTestId('disclaimer-gate-accept')
  if (await accept.isVisible()) await accept.click()
  const forecast = page.getByRole('region', { name: 'Time-specific forecast' })
  await forecast.getByLabel('Location', { exact: true }).fill('EDDF')
  const local = await page.evaluate(() => { const d = new Date('2026-11-21T19:00:00Z'); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) })
  await forecast.getByLabel('Local date and time').fill(local)
  await page.locator('#weather-icao').fill('EDDF')
  await page.getByRole('button', { name: 'Check METAR' }).click()
  await page.locator('#taf-icao').fill('EDDF')
  await page.getByRole('button', { name: 'Check TAF' }).click()
  const tafWind = page.getByRole('button', { name: 'Replace wind with TAF forecast (300 / 12 kt)' })
  await expect(tafWind).toBeVisible()
  await tafWind.scrollIntoViewIfNeeded()
  const path = info.outputPath('forecast-fallback.png')
  await page.screenshot({ path, animations: 'disabled' })
  await info.attach('forecast-fallback', { path, contentType: 'image/png' })
  await tafWind.click()
  await expect(page.getByText('forecast for 2026-11-21T19:00:00.000Z', { exact: false })).toBeVisible()
  await forecast.getByLabel('Location', { exact: true }).fill('EDDM')
  await expect(tafWind).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Replace wind with METAR/ })).toBeVisible()
})

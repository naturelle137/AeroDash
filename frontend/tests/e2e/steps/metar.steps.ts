import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

When('a synthetic METAR is retrieved', async ({ page }) => {
  const time = new Date()
  time.setUTCSeconds(0, 0)
  const stamp = `${String(time.getUTCDate()).padStart(2, '0')}${String(time.getUTCHours()).padStart(2, '0')}${String(time.getUTCMinutes()).padStart(2, '0')}Z`
  await page.route('https://wxdecoder.com/api/wx/EDDF', route => route.fulfill({ json: { metar: { station: 'EDDF', raw: `EDDF ${stamp} AUTO 17004KT CAVOK 12/08 Q1013`, reportTime: time.toISOString(), reportTimeKnown: true } }, headers: { 'access-control-allow-origin': '*' } }))
  await page.locator('#weather-icao').fill('EDDF')
  await page.getByRole('button', { name: 'Check METAR' }).click()
})

Then('the synthetic METAR is displayed at {string}', async ({ page, $testInfo }, width: string) => {
  const panel = page.locator('#prep-card-weather')
  await expect(panel).toContainText('EDDF')
  await expect(panel).toContainText('AUTO 17004KT CAVOK 12/08 Q1013')
  await expect(panel).toContainText('wxdecoder.com')
  const temperature = page.locator('#performance-temperature')
  await temperature.fill('25')
  await expect(temperature).toHaveValue('25')
  await panel.getByRole('button', { name: 'Replace temperature with METAR' }).click()
  await panel.getByRole('button', { name: 'Replace QNH with METAR' }).click()
  await panel.getByRole('button', { name: 'Replace wind with METAR' }).click()
  await expect(temperature).toHaveValue('12')
  await expect(page.locator('#wind-direction')).toHaveValue('170')
  await expect(page.locator('#wind-speed')).toHaveValue('4')
  await page.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true }).check()
  await expect(page.locator('#pa-qnh')).toHaveValue('1013')
  await expect(panel).toContainText('temperature source: METAR EDDF via wxdecoder.com')
  const path = $testInfo.outputPath(`metar-${width}.png`)
  await panel.locator('.weather-panel').screenshot({ path })
  await $testInfo.attach(`METAR ${width}`, { path, contentType: 'image/png' })
  await temperature.fill('26')
  await expect(panel).not.toContainText('temperature source: METAR')
  await page.unroute('https://wxdecoder.com/api/wx/EDDF')
  const time = new Date()
  time.setUTCSeconds(0, 0)
  const stamp = `${String(time.getUTCDate()).padStart(2, '0')}${String(time.getUTCHours()).padStart(2, '0')}${String(time.getUTCMinutes()).padStart(2, '0')}Z`
  await page.route('https://wxdecoder.com/api/wx/EDDF', route => route.fulfill({ json: { metar: { station: 'EDDF', raw: `EDDF ${stamp} 18010KT 140V220 12/08 Q1013`, reportTime: time.toISOString(), reportTimeKnown: true } }, headers: { 'access-control-allow-origin': '*' } }))
  await panel.getByRole('button', { name: 'Check METAR' }).click()
  await expect(panel).toContainText('18010KT 140V220')
  await expect(panel.getByRole('button', { name: 'Replace wind with METAR' })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Replace temperature with METAR' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Replace QNH with METAR' })).toBeVisible()
  await expect(page.locator('#wind-direction')).toHaveValue('170')
  await expect(page.locator('#wind-speed')).toHaveValue('4')
  const variablePath = $testInfo.outputPath(`metar-variable-${width}.png`)
  await panel.locator('.weather-panel').screenshot({ path: variablePath })
  await $testInfo.attach(`Variable METAR ${width}`, { path: variablePath, contentType: 'image/png' })
  await page.unroute('https://wxdecoder.com/api/wx/EDDF')
  await page.route('https://wxdecoder.com/api/wx/EDDF', route => route.fulfill({ json: { metar: { station: 'EDDF', raw: `EDDF ${stamp} 17004KT 9999 -RA BKN020 12/08 Q1013`, reportTime: time.toISOString(), reportTimeKnown: true } }, headers: { 'access-control-allow-origin': '*' } }))
  const runway = page.locator('form[aria-labelledby="manual-runway-heading"]')
  await runway.getByLabel('Aerodrome', { exact: true }).fill('EDDF')
  await runway.getByLabel('Runway designator', { exact: true }).fill('18')
  await runway.getByLabel('TORA — takeoff run available').fill('1000')
  await runway.getByLabel('LDA — landing distance available').fill('1000')
  await runway.getByLabel('Field elevation', { exact: true }).fill('0')
  await runway.getByLabel('Surface type').selectOption('paved')
  await panel.getByRole('button', { name: 'Check METAR' }).click()
  await expect(runway.getByLabel('Surface condition')).toHaveValue('wet')
  await expect(runway).toContainText('Wet suggested by METAR EDDF')
  const surfacePath = $testInfo.outputPath(`metar-surface-${width}.png`)
  await runway.screenshot({ path: surfacePath })
  await $testInfo.attach(`METAR surface ${width}`, { path: surfacePath, contentType: 'image/png' })
  await runway.getByRole('button', { name: 'Save runway inputs' }).click()
  const saved = page.getByRole('region', { name: 'Saved manual runway' })
  await expect(saved).toContainText('METAR via wxdecoder.com EDDF')
  await runway.getByLabel('Surface condition').selectOption('dry')
  await runway.getByRole('button', { name: 'Save runway inputs' }).click()
  await expect(saved).not.toContainText('METAR via wxdecoder.com')
})

const pad = (value: number) => String(value).padStart(2, '0')

When('a synthetic TAF and METAR are retrieved', async ({ page }) => {
  const now = new Date()
  const from = new Date(now); from.setUTCMinutes(0, 0, 0); from.setUTCHours(from.getUTCHours() - 2)
  const to = new Date(from.getTime() + 24 * 3600000)
  const issued = new Date(from.getTime() - 3600000)
  const observed = new Date(now); observed.setUTCSeconds(0, 0)
  const group = (date: Date) => `${pad(date.getUTCDate())}${pad(date.getUTCHours())}`
  const metarRaw = `EDDF ${group(observed)}${pad(observed.getUTCMinutes())}Z 17004KT CAVOK 12/08 Q1013`
  const tafRaw = `TAF EDDF ${group(issued)}00Z ${group(from)}/${group(to)} 25012KT 9999 BKN020`
  await page.route('https://wxdecoder.com/api/wx/EDDF', route => route.fulfill({
    json: {
      metar: { station: 'EDDF', raw: metarRaw, reportTime: observed.toISOString(), reportTimeKnown: true },
      taf: { station: 'EDDF', raw: tafRaw, issueTime: issued.toISOString(), validFrom: from.toISOString(), validTo: to.toISOString() },
    },
    headers: { 'access-control-allow-origin': '*' },
  }))
  await page.locator('#weather-icao').fill('EDDF')
  await page.getByRole('button', { name: 'Check METAR' }).click()
  await page.locator('#taf-icao').fill('EDDF')
  await page.getByRole('button', { name: 'Check TAF' }).click()
})

Then('the forecast wind is applied and the observation values are labelled as METAR at {string}', async ({ page, $testInfo }, width: string) => {
  const panel = page.locator('#prep-card-weather')
  await expect(panel.getByRole('button', { name: 'Replace wind with METAR' })).toHaveCount(0)
  await expect(panel).toContainText('Forecast wind from TAF EDDF')
  await expect(panel).toContainText('temperature: no forecast available — this is a METAR observation from EDDF')
  await expect(panel).toContainText('qnh: no forecast available — this is a METAR observation from EDDF')
  await panel.getByRole('button', { name: 'Replace wind with TAF forecast (250 / 12 kt)' }).click()
  await expect(page.locator('#wind-direction')).toHaveValue('250')
  await expect(page.locator('#wind-speed')).toHaveValue('12')
  await expect(panel).toContainText('wind source: TAF EDDF via wxdecoder.com')
  await panel.getByRole('button', { name: 'Replace temperature with METAR' }).click()
  await expect(page.locator('#performance-temperature')).toHaveValue('12')
  await expect(panel).toContainText('temperature source: METAR EDDF via wxdecoder.com')
  const path = $testInfo.outputPath(`taf-fallback-${width}.png`)
  await panel.locator('.weather-panel').screenshot({ path })
  await $testInfo.attach(`TAF wind with METAR fallback ${width}`, { path, contentType: 'image/png' })
})

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

When('a synthetic METAR is retrieved', async ({ page }) => {
  const time = new Date()
  time.setUTCSeconds(0, 0)
  const stamp = `${String(time.getUTCDate()).padStart(2, '0')}${String(time.getUTCHours()).padStart(2, '0')}${String(time.getUTCMinutes()).padStart(2, '0')}Z`
  await page.route('https://wxdecoder.com/api/wx/EDDF', route => route.fulfill({ json: { metar: { station: 'EDDF', raw: `EDDF ${stamp} AUTO 17004KT CAVOK`, reportTime: time.toISOString(), reportTimeKnown: true } }, headers: { 'access-control-allow-origin': '*' } }))
  await page.locator('#weather-icao').fill('EDDF')
  await page.getByRole('button', { name: 'Check METAR' }).click()
})

Then('the synthetic METAR is displayed at {string}', async ({ page, $testInfo }, width: string) => {
  const panel = page.locator('#prep-card-weather')
  await expect(panel).toContainText('EDDF')
  await expect(panel).toContainText('AUTO 17004KT CAVOK')
  await expect(panel).toContainText('wxdecoder.com')
  await panel.evaluate(element => element.scrollIntoView({ block: 'end' }))
  const path = $testInfo.outputPath(`metar-${width}.png`)
  await page.screenshot({ path })
  await $testInfo.attach(`METAR ${width}`, { path, contentType: 'image/png' })
})

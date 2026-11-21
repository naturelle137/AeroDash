import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { testPohAircraft } from '../../fixtures/poh-aircraft'

const { When, Then } = createBdd()
const assessment = (page: Page) => page.getByRole('region', { name: 'Correction source assessment', exact: true })
const correction = (page: Page, name: string) => assessment(page).getByRole('article', { name: `${name} source`, exact: true })
const assessButton = (page: Page) => page.getByRole('button', { name: 'Assess correction sources', exact: true })

async function candidate(page: Page, name: string, section: string) {
  const group = correction(page, name)
  const details = group.locator('details')
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await group.getByText('Source details', { exact: true }).click()
  }
  await expect(details).toHaveAttribute('open', '')
  return group.locator('.candidate').filter({ hasText: section })
}

When('I import a synthetic Test POH exchange file declaring type {string}, maximum mass {int} kg and stored surface factors',
  async ({ page }, icaoTypeDesignator: string, mtom: number) => {
    const base = testPohAircraft()
    const profile = {
      ...base, icaoTypeDesignator, status: 'draft',
      certificationCategories: [{ ...base.certificationCategories[0]!, mtom }],
      surfaceConditions: [{ name: 'Grass (legacy, unsourced)', takeoffFactor: 1.2, landingFactor: 1.2 }],
    }
    await page.goto('/fleet')
    await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
      name: 'Test-wiring-only.aerodash.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile })),
    })
    await expect(page.locator('.profile-item').filter({ hasText: 'D-TEST' })).toContainText('Draft')
  })

When('the pilot selects manual configuration {string}', async ({ page }, configuration: string) => {
  const selector = page.getByLabel('Applicable manual configuration')
  if (configuration) await selector.selectOption(configuration)
  else await expect(selector).toHaveCount(0)
})

Then('no correction source is available', async ({ page }) => {
  await expect(assessment(page)).toContainText('No correction source is available')
})

When('the pilot assesses correction sources', async ({ page }) => {
  await assessButton(page).click()
  await expect(assessment(page)).toBeVisible()
})

When('the pilot selects the Test profile and assesses correction sources', async ({ page }) => {
  const select = page.getByLabel('Aircraft profile', { exact: true })
  const id = await select.locator('option').nth(1).getAttribute('value')
  await select.selectOption(id!)
  await assessButton(page).click()
  await expect(assessment(page)).toBeVisible()
})

Then('the S4 correction sources are identified and stored surface factors are not used', async ({ page }) => {
  await expect(assessment(page)).toContainText('A source is identified for some corrections')
  await expect(assessment(page)).toContainText('stores surface factors without source, target or range evidence. They are not used.')
  for (const name of ['Wind', 'Runway surface', 'Runway slope']) {
    await expect(correction(page, name).locator('dd').first()).toContainText('Source identified')
  }
})

Then('the {string} source identifies the candidate {string}', async ({ page }, name: string, section: string) => {
  const entry = await candidate(page, name, section)
  await expect(entry).toContainText('Aircraft manual candidate — source identified')
  await expect(entry).toContainText('Edition 2, Revision 7')
})

Then('the {string} candidates show their document, revision, section and origin', async ({ page }, name: string) => {
  const manual = await candidate(page, name, 'Supplement S4 (650 kg)')
  await expect(manual).toContainText('Document: Tecnam P2008 JC Aircraft Flight Manual · Doc. 2008/100, Edition 2, Revision 7 (30 July 2020)')
  await expect(manual).toContainText('Section: Supplement S4 (650 kg), take-off p. 5W-7 and landing p. 5W-15')
  await expect(manual).toContainText('Origin: Manufacturer-authored manual obtained from a third-party mirror')
  const guidance = await candidate(page, name, 'Page 15, surface factors')
  await expect(guidance).toContainText('Document: UK CAA Safety Sense Leaflet 09: Weight, Balance and Performance · Safety Sense 09, August 2024')
  await expect(guidance).toContainText('Section: Page 15, surface factors')
  await expect(guidance).toContainText('Origin: Regulator-hosted UK general-aviation guidance.')
})

Then('the {string} source rejects the candidate {string} because {string}', async ({ page }, name: string, section: string, reason: string) => {
  const entry = await candidate(page, name, section)
  await expect(entry).toContainText(reason)
  await expect(entry).toContainText('not applied')
})

Then('the raw takeoff roll still reads {string}', async ({ page }, distance: string) => {
  const raw = page.getByRole('region', { name: 'Base performance distances', exact: true })
  await expect(raw.locator('dd').first()).toHaveText(distance)
  await expect(raw).toContainText('Runway comparisons use declared distances and do not constitute a Go/No-Go decision or operational approval.')
})

Then('the correction source assessment has been cleared', async ({ page }) => {
  await expect(assessment(page)).toHaveCount(0)
})

Then('no aircraft profile can be assessed', async ({ page }) => {
  await expect(page.getByLabel('Aircraft profile', { exact: true }).locator('option')).toHaveCount(1)
  await expect(assessButton(page)).toBeDisabled()
})

Then('the correction source evidence is captured as {string}', async ({ page, $testInfo }, name: string) => {
  expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.getByRole('heading', { name: 'Correction sources', exact: true }).scrollIntoViewIfNeeded()
  const path = $testInfo.outputPath(`correction-sources-${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await $testInfo.attach(`Correction sources ${name}`, { path, contentType: 'image/png' })
  const panelPath = $testInfo.outputPath(`correction-sources-panel-${name}.png`)
  await page.locator('section[aria-labelledby="correction-sources-heading"]').screenshot({ path: panelPath })
  await $testInfo.attach(`Correction source panel ${name}`, { path: panelPath, contentType: 'image/png' })
})

import { writeFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

When('I open the synthetic profile verification dialog', async ({ page }) => {
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

When('I switch pressure altitude methods using their labels and keyboard', async ({ page }) => {
  const direct = page.getByRole('radio', { name: 'Enter pressure altitude directly', exact: true })
  const derived = page.getByRole('radio', { name: 'Derive from QNH and field elevation', exact: true })
  const label = derived.locator('..')
  await label.scrollIntoViewIfNeeded()
  const area = await label.boundingBox()
  if (!area) throw new Error('Missing QNH label target')
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    await page.touchscreen.tap(area.x + area.width - 5, area.y + area.height / 2)
  } else {
    await label.click({ position: { x: area.width - 5, y: area.height / 2 } })
  }
  await expect(derived).toBeChecked()
  await derived.press('ArrowUp')
  await expect(direct).toBeChecked()
  await direct.press('ArrowDown')
  await expect(derived).toBeChecked()
})

Then('the unsupported source details remain reachable', async ({ page }) => {
  const assessment = page.getByRole('region', { name: 'Correction source assessment', exact: true })
  await expect(assessment).toContainText('No correction source is available')
  for (const name of ['Wind', 'Runway surface', 'Runway slope']) {
    const article = assessment.getByRole('article', { name: `${name} source`, exact: true })
    await article.getByText('Source details', { exact: true }).click()
    await expect(article).toContainText('not applied')
  }
})

Then('the workflow targets are measured as {string}', async ({ page, $testInfo }, stage: string) => {
  const dialog = page.getByRole('dialog')
  const scope = await dialog.count() ? dialog : page.getByRole('main').last()
  // Native controls and their activation labels are measured rather than decorative text.
  const targets = scope.locator('button, input:not([type="hidden"]), select, summary, a[href], label:has(input[type="file"])')
  const measurements = []
  for (const control of await targets.all()) {
    if (!await control.isVisible() || await control.isDisabled()) continue
    const target = await control.getAttribute('type') === 'radio' ? control.locator('..') : control
    await target.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
    const data = await target.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const points = [[.5, .5], [.1, .1], [.9, .1], [.1, .9], [.9, .9]]
      const reachable = points.every(([x, y]) => {
        const hit = document.elementFromPoint(box.x + box.width * x!, box.y + box.height * y!)
        return hit !== null && (element === hit || element.contains(hit))
      })
      return { name: element.getAttribute('aria-label') || element.id || element.textContent?.trim().slice(0, 100),
        width: box.width, height: box.height, left: box.left, right: box.right, reachable }
    })
    measurements.push(data)
  }
  const measurementsPath = $testInfo.outputPath(`${stage}-targets.json`)
  await writeFile(measurementsPath, JSON.stringify(measurements, null, 2))
  await $testInfo.attach(`${stage}-targets`, { path: measurementsPath, contentType: 'application/json' })
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: $testInfo.outputPath(`${stage}.png`), fullPage: true })
  await $testInfo.attach(stage, { path: $testInfo.outputPath(`${stage}.png`), contentType: 'image/png' })
  expect(measurements.length).toBeGreaterThan(0)
  expect(measurements.filter((target) => target.width < 44 || target.height < 44 || target.left < 0 || target.right > page.viewportSize()!.width || !target.reachable)).toEqual([])
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', page.viewportSize()!.width)
})

Then('runway actions accept touch or keyboard activation', async ({ page }) => {
  const lda = page.getByLabel('LDA — landing distance available', { exact: true })
  const saved = page.getByRole('region', { name: 'Saved manual runway', exact: true })
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0)
  for (const name of ['Discard changes', 'Save runway inputs', 'Clear runway inputs']) {
    await lda.fill('800')
    const button = page.getByRole('button', { name, exact: true })
    if (touch) await button.tap()
    else {
      await button.focus()
      await button.press('Enter')
    }
    if (name === 'Discard changes') await expect(lda).toHaveValue('1800')
    if (name === 'Save runway inputs') await expect(saved).toContainText('800 ft')
    if (name === 'Clear runway inputs') await expect(saved).toHaveCount(0)
  }
})

import { expect, test } from '@playwright/test'
import { testPohAircraft } from '../fixtures/poh-aircraft'

// Synthetic aircraft only exercises navigation; no operational performance validation.
test('sticky navigation tracks tall cards, scroll jumps and strip activation', async ({ page }, info) => {
  const width = page.viewportSize()!.width
  await page.setViewportSize({ width, height: width === 390 ? 540 : 900 })
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.getByLabel('Or import from Exchange File (.json)').setInputFiles({
    name: 'synthetic-sticky.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'aerodash-aircraft', version: 1, profile: testPohAircraft() })),
  })
  await page.getByRole('button', { name: 'Verify D-TEST', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Verifier initials').fill('QA')
  await dialog.getByLabel('POH revision').fill('Synthetic navigation only')
  await dialog.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.goto('/mass-balance')
  const picker = page.getByLabel('Select aircraft', { exact: true })
  await picker.selectOption((await picker.locator('option').filter({ hasText: 'D-TEST' }).getAttribute('value'))!)
  const strips = page.getByRole('navigation', { name: 'Scrolled-past sections' })
  const performance = strips.getByRole('button', { name: 'Scroll to Performance', exact: true })
  async function screenshot(name: string) {
    const path = info.outputPath(`${name}-${width}.png`)
    await page.screenshot({ path })
    await info.attach(`${name}-${width}`, { path, contentType: 'image/png' })
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(strips).toBeHidden()
  await screenshot('top')
  const maximum = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
  // Stop within the tall Performance card, before its bottom leaves the viewport.
  const insidePerformance = await page.locator('#prep-card-performance').evaluate(el => el.getBoundingClientRect().top + scrollY + 300)
  for (const y of [insidePerformance, maximum]) {
    await page.evaluate(top => window.scrollTo(0, top), y)
    await expect(performance).toBeVisible()
    await expect(strips.getByRole('button', { name: 'Scroll to Aircraft', exact: true })).toBeVisible()
    const box = (await performance.boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    await screenshot(y === maximum ? 'bottom' : 'inside-performance')
    // A single jump can skip all IntersectionObserver thresholds in both directions.
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(strips).toBeHidden()
  }
  // Incremental scrolling must retain earlier breadcrumbs as later ones dock.
  const aircraftTop = await page.locator('#prep-card-aircraft').evaluate(el => el.getBoundingClientRect().top + scrollY)
  for (let y = aircraftTop; y <= maximum + 300; y += 300) {
    await page.evaluate(top => window.scrollTo(0, top), y)
    await expect(strips.getByRole('button', { name: 'Scroll to Aircraft', exact: true })).toBeVisible()
  }
  await expect(performance).toBeVisible()
  await performance.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => page.locator('#prep-card-performance').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBe(188)
  await screenshot('after-performance-activation')
  await strips.getByRole('button', { name: 'Scroll to Aircraft', exact: true }).click()
  await expect.poll(() => page.locator('#prep-card-aircraft').evaluate(el => Math.round(el.getBoundingClientRect().top)), { intervals: [600] }).toBe(56)
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(strips).toBeHidden()
  await screenshot('returned-top')
})

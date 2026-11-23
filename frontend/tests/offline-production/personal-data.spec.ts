import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('downloads saved sessions from Privacy while offline', async ({ page, context }, info) => {
  await page.goto('/fleet')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await page.evaluate(() => {
    const session = (aircraftId: string) => ({ version: 1, aircraftId, activeCategory: 'Normal', stations: [{ index: 0, weight: 42, touched: true, verified: false }], savedAt: '2026-01-01T00:00:00Z' })
    localStorage.setItem('aerodash:session:by-aircraft', JSON.stringify({ a: session('a'), b: session('b') }))
  })
  await context.setOffline(true)
  await page.goto('/privacy')
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-all-btn').click()
  const download = await downloadPromise
  const contents = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(contents.sessions.map((s: { aircraftId: string }) => s.aircraftId)).toEqual(['a', 'b'])
  expect(contents.complete).toBe(true)
  const path = info.outputPath(`privacy-${info.project.name}.png`)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  await info.attach('privacy-offline', { path, contentType: 'image/png' })
})

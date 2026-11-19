import { expect, test } from '@playwright/test'

test('performance help opens and closes with the keyboard online and offline', async ({ page, context }, info) => {
  await page.goto('/performance')
  await page.getByTestId('disclaimer-gate-accept').click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  for (const offline of [false, true]) {
    if (offline) {
      await context.setOffline(true)
      await page.reload()
    }
    await page.getByRole('radio', { name: 'Derive from QNH and field elevation' }).check()
    for (const [name, content] of [
      ['Pressure altitude', 'standard atmosphere'],
      ['QNH', 'hPa or inHg'],
      ['Takeoff headwind', 'negative for tailwind'],
      ['Takeoff runway slope', 'negative downhill'],
      ['Landing headwind', 'negative for tailwind'],
      ['Landing runway slope', 'negative downhill'],
    ]) {
      const summary = page.getByLabel(`${name} help`, { exact: true })
      const details = summary.locator('..')
      await summary.focus()
      await page.keyboard.press('Enter')
      await expect(details).toHaveAttribute('open', '')
      await expect(details).toContainText(content!)
      await page.keyboard.press('Space')
      await expect(details).not.toHaveAttribute('open', '')
    }
    const help = page.getByLabel('Pressure altitude help', { exact: true })
    await help.click()
    await help.scrollIntoViewIfNeeded()
    const path = info.outputPath(`help-${offline ? 'offline' : 'online'}.png`)
    await page.screenshot({ path, animations: 'disabled' })
    await info.attach(`help-${offline ? 'offline' : 'online'}`, { path, contentType: 'image/png' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

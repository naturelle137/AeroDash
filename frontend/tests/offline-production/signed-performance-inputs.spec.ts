import { expect, test } from '@playwright/test'

test('signed wind and slope inputs accept keyboard entry in both phases', async ({ page }, info) => {
  await page.goto('/performance')
  await page.getByTestId('disclaimer-gate-accept').click()

  for (const phase of ['Takeoff', 'Landing']) {
    const group = page.getByRole('group', { name: `${phase} wind and slope` })
    for (const label of ['Headwind component (kt, negative = tailwind)', 'Runway slope (%, positive = uphill)']) {
      const input = group.getByLabel(label)
      await expect(input).toHaveAttribute('inputmode', 'text')
      await input.focus()
      await page.keyboard.type('-1.5')
      await expect(input).toHaveValue('-1.5')
    }
    await group.scrollIntoViewIfNeeded()
    const path = info.outputPath(`${phase.toLowerCase()}-signed-inputs.png`)
    await page.screenshot({ path, animations: 'disabled' })
    await info.attach(`${phase.toLowerCase()}-signed-inputs`, { path, contentType: 'image/png' })
  }
})

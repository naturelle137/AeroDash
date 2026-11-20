import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

When('the instructor {string} adds the note {string} on the takeoff result', async ({ page }, author: string, text: string) => {
  const panel = page.getByTestId('annotation-panel')
  await panel.scrollIntoViewIfNeeded()
  await panel.getByLabel('Author').fill(author)
  await panel.getByLabel('Note').fill(text)
  await panel.getByRole('button', { name: 'Add note' }).click()
})

When('the pilot reloads the page', async ({ page }) => {
  await page.reload()
})

Then('the note {string} is shown as an instructor note by {string}', async ({ page }, text: string, author: string) => {
  const item = page.getByTestId('annotation-item')
  await expect(item).toContainText(`Instructor note on Takeoff`)
  await expect(item).toContainText(`${author} (self-declared)`)
  await expect(item).toContainText(text)
})

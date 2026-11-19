import { expect, type Page } from '@playwright/test'

/** Print as a pilot would: request print, then acknowledge the CRIT-UI-001 unverified-data gate. */
export async function printBriefingPack(page: Page): Promise<void> {
  await page.getByRole('dialog', { name: 'Briefing Pack preview', exact: true })
    .getByRole('button', { name: 'Print Briefing Pack', exact: true }).click()
  const gate = page.getByRole('alertdialog')
  await expect(gate).toContainText('CRIT-UI-001')
  await gate.getByRole('button', { name: 'Acknowledge unverified data and print' }).click()
}

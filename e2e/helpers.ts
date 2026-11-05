import { expect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

const OUTPUT_DIR = path.resolve(process.cwd(), 'test-data/output')
export const SAMPLE_XLSX = path.join(OUTPUT_DIR, 'paycom-apr-2026.xlsx')
export const SAMPLE_PDF_DIR = path.join(OUTPUT_DIR, 'pdfs')

/** Open the app with empty storage (IndexedDB, localStorage, service workers). */
export async function openFresh(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
    const idb = indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> }
    const dbs = idb.databases ? await idb.databases() : []
    await Promise.all(
      dbs
        .filter((d) => !!d.name)
        .map(
          (d) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(d.name as string)
              req.onsuccess = req.onerror = req.onblocked = () => resolve()
            }),
        ),
    )
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.getByRole('button', { name: 'Choose Excel' })).toBeVisible()
}

/** Bill rate and OT threshold to enter for each project in the import wizard, in wizard order. */
export const WIZARD_PROJECTS = [
  { rate: '100', threshold: '40' },
  { rate: '115', threshold: '50' },
  { rate: '105', threshold: '40' },
]

/**
 * Import the generated Excel export and timesheet PDFs, fill in project rates
 * in the setup wizard, and wait for the Billing Hours view.
 */
export async function importSampleData(page: Page): Promise<void> {
  await page.locator('[data-testid="excel-input"]').setInputFiles(SAMPLE_XLSX)
  await expect(page.getByText(/Excel parsed:/i)).toBeVisible({ timeout: 30_000 })

  // The folder input has webkitdirectory; drop it so a plain file list is accepted.
  const pdfInput = page.locator('[data-testid="pdf-folder-input"]')
  await pdfInput.evaluate((el) => el.removeAttribute('webkitdirectory'))
  const pdfs = fs
    .readdirSync(SAMPLE_PDF_DIR)
    .filter((f) => f.endsWith('.pdf'))
    .map((f) => path.join(SAMPLE_PDF_DIR, f))
  await pdfInput.setInputFiles(pdfs)

  const wizard = page.locator('[data-testid="onboarding-wizard"]')
  await expect(wizard).toBeVisible({ timeout: 90_000 })
  const inputs = wizard.locator('input')
  await expect(inputs).toHaveCount(WIZARD_PROJECTS.length * 3)
  for (const [i, p] of WIZARD_PROJECTS.entries()) {
    // Each project row: display name, bill rate, OT threshold
    await inputs.nth(i * 3 + 1).fill(p.rate)
    await inputs.nth(i * 3 + 2).fill(p.threshold)
  }
  await wizard.getByRole('button', { name: /^Next/ }).click()
  await wizard.getByRole('button', { name: /^Next/ }).click()
  await wizard.getByRole('button', { name: 'Save & Reconcile' }).click()
  await expect(wizard).toBeHidden()
  await expect(page.getByText('Total Billable')).toBeVisible({ timeout: 30_000 })
}

import { test, expect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

const REAL_XLSX = process.env.RECON_XLSX ?? ''
const REAL_PDF_DIR = process.env.RECON_PDF_DIR ?? ''
const HAS_REAL_DATA = !!REAL_XLSX && !!REAL_PDF_DIR

// The site is hosted as a single bundled HTML file (Reconciler.html), not index.html.
// Allow override via RECON_PAGE_URL.
const PAGE_URL =
  process.env.RECON_PAGE_URL ??
  'https://noahfgarrett.github.io/FinanceReconciliation/Reconciler.html'

async function clearAll(page: Page): Promise<void> {
  // Best-effort cold-load: clear cookies, unregister SW, and wipe
  // localStorage/IndexedDB BEFORE the app boots so we land in the empty state.
  await page.context().clearCookies()

  // First, make sure we're on the right origin so localStorage/idb deletion works.
  // Navigate to a blank doc on the same origin, then nuke everything.
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    try {
      window.localStorage.clear()
      window.sessionStorage.clear()
    } catch {
      /* ignore */
    }
    try {
      // Best-effort wipe of all IndexedDB databases used by the app.
      // Newer browsers expose indexedDB.databases().
      const idb = window.indexedDB as IDBFactory & {
        databases?: () => Promise<{ name?: string }[]>
      }
      if (idb.databases) {
        const dbs = await idb.databases()
        await Promise.all(
          dbs
            .filter((d) => !!d.name)
            .map(
              (d) =>
                new Promise<void>((resolve) => {
                  const req = idb.deleteDatabase(d.name as string)
                  req.onsuccess = req.onerror = req.onblocked = () => resolve()
                }),
            ),
        )
      } else {
        for (const name of ['snapshots', 'projects', 'kv', 'lotus-recon']) {
          await new Promise<void>((resolve) => {
            const req = window.indexedDB.deleteDatabase(name)
            req.onsuccess = req.onerror = req.onblocked = () => resolve()
          })
        }
      }
    } catch {
      /* ignore */
    }
  })
  await page.goto(PAGE_URL, { waitUntil: 'networkidle' })
}

test.describe('LotusWorks Reconciler smoke', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(15_000)
  })

  test('1. cold load shows empty state', async ({ page }) => {
    await clearAll(page)
    // Side nav with Billing Hours item
    await expect(
      page.getByRole('button', { name: /Billing Hours/i }).first(),
    ).toBeVisible()
    // Empty state has the "Or explore with sample data" link
    await expect(
      page.getByRole('button', { name: /sample data/i }).first(),
    ).toBeVisible()
  })

  test('2. sample data path renders KPIs, spreadsheet, drawer, view-source modal', async ({ page }) => {
    await clearAll(page)
    await page.getByRole('button', { name: /sample data/i }).first().click()

    // KPI strip — wait for the snapshot to populate. The strip text contains "$".
    await expect(page.locator('text=/\\$\\d/').first()).toBeVisible({
      timeout: 30_000,
    })

    // Tab strip
    const spreadsheetTab = page.getByRole('button', { name: /^Spreadsheet$/ })
    await expect(spreadsheetTab).toBeVisible()
    await spreadsheetTab.click()

    // Spreadsheet rows — virtualized table; check at least 10 rows visible
    // (sample bootstrap creates a generous data set; >100 is over-strict on first render).
    const rows = page.locator('tr[role="row"], div[role="row"]')
    await expect(async () => {
      const count = await rows.count()
      expect(count).toBeGreaterThan(10)
    }).toPass({ timeout: 10_000 })

    // Click the first data row (skip header)
    const firstDataRow = rows.nth(1)
    await firstDataRow.click()

    // Drawer should open. The "View source" button lives there.
    const viewSourceBtn = page.getByRole('button', { name: /View source/i })
    await expect(viewSourceBtn).toBeVisible({ timeout: 5_000 })
    await viewSourceBtn.click()

    // Modal should open. Sample data has no PDF bytes, so it shows an empty state.
    await expect(
      page.getByText(/Original PDF not available|not available/i).first(),
    ).toBeVisible({ timeout: 5_000 })

    // Close modal
    await page.keyboard.press('Escape')

    // Clear sample
    const clearBtn = page.getByRole('button', { name: /^Clear$/ })
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click()
    }
  })

  test('3-7. real-data smoke', async ({ page }) => {
    test.skip(!HAS_REAL_DATA, 'Set RECON_XLSX + RECON_PDF_DIR to run real-data tests')

    await clearAll(page)

    // ---- 3. Real data import ----
    const pdfFiles = fs
      .readdirSync(REAL_PDF_DIR)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .map((f) => path.join(REAL_PDF_DIR, f))
    expect(pdfFiles.length).toBeGreaterThan(0)

    const excelInput = page.locator('[data-testid="excel-input"]')
    const pdfInput = page.locator('[data-testid="pdf-folder-input"]')
    await excelInput.setInputFiles(REAL_XLSX)
    await pdfInput.setInputFiles(pdfFiles)

    // Project mapping modal should appear within ~10s (parsing 26 PDFs takes time)
    const mappingModal = page.locator('[data-testid="project-mapping-modal"]')
    await expect(mappingModal).toBeVisible({ timeout: 30_000 })

    // Each unmapped allocation has 3 radio options. Pick "Map to existing project"
    // for each, then save. The options text is "Map to existing project".
    const mapRadios = mappingModal.getByRole('radio', { name: /Map to existing project/i })
    const mapCount = await mapRadios.count()
    for (let i = 0; i < mapCount; i++) {
      await mapRadios.nth(i).check()
    }
    // After picking "map", a select appears for each. Set them all to the first option
    // (excluding the placeholder if any).
    const selects = mappingModal.locator('select')
    const selectsCount = await selects.count()
    for (let i = 0; i < selectsCount; i++) {
      const sel = selects.nth(i)
      const optionValues = await sel.locator('option').evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value),
      )
      const first = optionValues.find((v) => v && v.length > 0)
      if (first) await sel.selectOption(first)
    }
    await page.getByRole('button', { name: /Save mappings/i }).click()

    // Wait for the snapshot to render; KPIs should appear.
    await expect(page.locator('text=/\\$\\d/').first()).toBeVisible({ timeout: 30_000 })

    // Switch to Spreadsheet
    await page.getByRole('button', { name: /^Spreadsheet$/ }).click()
    const rows = page.locator('tr[role="row"], div[role="row"]')
    await expect(async () => {
      const c = await rows.count()
      expect(c).toBeGreaterThan(1)
    }).toPass({ timeout: 10_000 })

    // ---- 4. Confidence + view source on real data ----
    // Click the first data row.
    await rows.nth(1).click()
    const viewSourceBtn = page.getByRole('button', { name: /View source/i })
    await expect(viewSourceBtn).toBeVisible({ timeout: 5_000 })
    await viewSourceBtn.click()
    // PDF rendered to canvas
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')

    // Close drawer
    await page.keyboard.press('Escape')

    // ---- 5. Generate an invoice ----
    // Navigate to Exports via side nav.
    await page.getByRole('button', { name: /^Exports$/ }).click()
    const previewBtn = page.getByRole('button', { name: /^Preview$/ }).first()
    await expect(previewBtn).toBeVisible({ timeout: 10_000 })
    await previewBtn.click()
    // Modal opens; Generate PDF triggers a download
    const generateBtn = page.getByRole('button', { name: /Generate PDF/i })
    await expect(generateBtn).toBeVisible({ timeout: 5_000 })
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      generateBtn.click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
    await page.keyboard.press('Escape')

    // ---- 6. Save snapshot ----
    await page.getByRole('button', { name: /Billing Hours/i }).first().click()
    const saveSnapshotBtn = page.getByRole('button', { name: /Save Snapshot/i })
    await expect(saveSnapshotBtn).toBeVisible({ timeout: 10_000 })
    await saveSnapshotBtn.click()
    // SaveSnapshotModal — has a name input. Fill it.
    const snapshotNameInput = page.getByRole('textbox').first()
    const snapName = `smoke-${Date.now()}`
    await snapshotNameInput.fill(snapName)
    await page.getByRole('button', { name: /^Save$/ }).click()

    // Navigate to History (sidebar item is "Snapshots")
    await page.getByRole('button', { name: /^Snapshots$/ }).click()
    await expect(page.getByText(snapName)).toBeVisible({ timeout: 10_000 })

    // ---- 7. Reload persistence ----
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /^Snapshots$/ }).click()
    await expect(page.getByText(snapName)).toBeVisible({ timeout: 10_000 })
  })
})

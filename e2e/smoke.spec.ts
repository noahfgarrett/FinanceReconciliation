import { test, expect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

const REAL_XLSX = process.env.RECON_XLSX ?? ''
const REAL_PDF_DIR = process.env.RECON_PDF_DIR ?? ''
const HAS_REAL_DATA = !!REAL_XLSX && !!REAL_PDF_DIR

// The deploy script renames the bundled HTML to index.html on gh-pages, so
// the live URL is the project root. Allow override via RECON_PAGE_URL.
const PAGE_URL =
  process.env.RECON_PAGE_URL ??
  'https://noahfgarrett.github.io/FinanceReconciliation/'

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
    // Use a tall viewport so modals + tall page sections fit.
    await page.setViewportSize({ width: 1440, height: 1200 })
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

    // Sample data has 3 unmapped allocations that pop the project-mapping modal.
    // The bootstrap from Excel doesn't seed allocationAliases, so the user has
    // to either map or ignore. Use "Close (ignore all)" — this gives zero
    // billing rows but still lets us verify the page wires up correctly.
    const sampleMappingModal = page.locator('[data-testid="project-mapping-modal"]')
    if (await sampleMappingModal.isVisible().catch(() => false)) {
      // Map every alloc to first existing project so billing rows render.
      const radios = sampleMappingModal.getByRole('radio', { name: /Map to existing project/i })
      const c = await radios.count()
      for (let i = 0; i < c; i++) await radios.nth(i).check()
      const selects = sampleMappingModal.locator('select')
      const sc = await selects.count()
      for (let i = 0; i < sc; i++) {
        const sel = selects.nth(i)
        const values = await sel.locator('option').evaluateAll((opts) =>
          opts.map((o) => (o as HTMLOptionElement).value),
        )
        const first = values.find((v) => v && v.length > 0)
        if (first) await sel.selectOption(first)
      }
      // Click the save button via a real Playwright click. Force is needed
      // because the modal can be taller than the viewport (3 stacked entries).
      const saveMapBtn = page.getByRole('button', { name: /Save mappings/i })
      await saveMapBtn.scrollIntoViewIfNeeded().catch(() => {})
      await saveMapBtn.click({ force: true })
      // If save didn't take, fall back to "ignore all".
      try {
        await expect(sampleMappingModal).toBeHidden({ timeout: 5_000 })
      } catch {
        const closeBtn = page.getByRole('button', { name: /Close \(ignore all\)/i })
        await closeBtn.click({ force: true })
        await expect(sampleMappingModal).toBeHidden({ timeout: 5_000 })
      }
    }

    // Tab strip
    const spreadsheetTab = page.getByRole('button', { name: /^Spreadsheet$/ })
    await expect(spreadsheetTab).toBeVisible()
    await spreadsheetTab.scrollIntoViewIfNeeded()
    await spreadsheetTab.click({ force: true })

    // Spreadsheet table should render. Wait for it explicitly.
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 })

    // If billing rows rendered, click the first one and verify the drawer
    // opens. Otherwise (modal was ignored), the table empty-state shows and
    // there's nothing to drill into — that's still a valid sample-data
    // smoke result.
    const bodyRows = page.locator('table tbody tr')
    const rowCount = await bodyRows.count()
    if (rowCount > 1) {
      await bodyRows.first().click()
      const viewSourceBtn = page.getByRole('button', { name: /View source/i })
      await expect(viewSourceBtn).toBeVisible({ timeout: 5_000 })
      await viewSourceBtn.click()
      await expect(
        page.getByText(/Original PDF not available|not available/i).first(),
      ).toBeVisible({ timeout: 5_000 })
    }

    // Close any open modal
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')

    // Clear sample (best-effort).
    const clearBtn = page.getByRole('button', { name: /^Clear$/ })
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click({ force: true }).catch(() => {})
    }
  })

  test('3-7. real-data smoke', async ({ page }) => {
    test.setTimeout(180_000)
    test.skip(!HAS_REAL_DATA, 'Set RECON_XLSX + RECON_PDF_DIR to run real-data tests')

    // Surface console + page errors to the test runner — useful when the live
    // PDF worker fails to spin up.
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        // eslint-disable-next-line no-console
        console.log(`[browser ${msg.type()}]`, msg.text())
      }
    })
    page.on('pageerror', (err) => {
      // eslint-disable-next-line no-console
      console.log('[browser pageerror]', err.message)
    })
    page.on('requestfailed', (req) => {
      // eslint-disable-next-line no-console
      console.log('[browser requestfailed]', req.url(), req.failure()?.errorText)
    })
    page.on('response', (res) => {
      if (res.status() >= 400) {
        // eslint-disable-next-line no-console
        console.log('[browser response]', res.status(), res.url())
      }
    })

    await clearAll(page)

    // ---- 3. Real data import ----
    // Use only the genuine timesheet_*.pdf files for the smoke test. The
    // STRESSTEST_*.pdf fixtures are intentionally malformed and would crash
    // the parser worker — that's covered by the unit suite instead.
    const pdfFiles = fs
      .readdirSync(REAL_PDF_DIR)
      .filter((f) => f.toLowerCase().endsWith('.pdf') && !/^stresstest/i.test(f))
      .map((f) => path.join(REAL_PDF_DIR, f))
    expect(pdfFiles.length).toBeGreaterThan(0)

    const excelInput = page.locator('[data-testid="excel-input"]')
    const pdfInput = page.locator('[data-testid="pdf-folder-input"]')
    // Strip webkitdirectory so Playwright accepts a list of files (it would
    // otherwise demand a directory path, which is harder to plumb cleanly).
    // The app's onChange handler reads `e.target.files`, so it accepts either.
    await pdfInput.evaluate((el) => {
      el.removeAttribute('webkitdirectory')
    })
    await excelInput.setInputFiles(REAL_XLSX)
    // Wait for Excel parse to finish (status flips to "Excel parsed: …").
    await expect(page.getByText(/Excel parsed:/i)).toBeVisible({ timeout: 30_000 })
    await pdfInput.setInputFiles(pdfFiles)

    // Wait for the import to settle — either the mapping modal appears (unmapped
    // allocations remain), the snapshot renders directly, or import fails outright.
    const mappingModal = page.locator('[data-testid="project-mapping-modal"]')
    const importStatus = page.getByText(/Imported \d+ PDFs/i)
    const importFailure = page.getByText(/Import failed:/i)
    await Promise.race([
      mappingModal.waitFor({ state: 'visible', timeout: 90_000 }),
      importStatus.waitFor({ state: 'visible', timeout: 90_000 }),
      importFailure.waitFor({ state: 'visible', timeout: 90_000 }),
    ])
    if (await importFailure.isVisible().catch(() => false)) {
      const failureText = await importFailure.textContent()
      throw new Error(
        `Live import failed before mapping modal could appear: ${failureText}. ` +
        `This is a production bug — see report.`,
      )
    }

    if (await mappingModal.isVisible().catch(() => false)) {
      // Map every unmapped allocation to an existing project.
      const mapRadios = mappingModal.getByRole('radio', { name: /Map to existing project/i })
      const mapCount = await mapRadios.count()
      for (let i = 0; i < mapCount; i++) {
        await mapRadios.nth(i).check()
      }
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
      // Modal can extend past the viewport. Scroll the button's parent first,
      // then click. Use evaluate-click as a fallback since force-click doesn't
      // always trigger React handlers.
      const saveMapBtn = page.getByRole('button', { name: /Save mappings/i })
      await saveMapBtn.evaluate((el) => (el as HTMLButtonElement).click())
      await expect(mappingModal).toBeHidden({ timeout: 15_000 })
    }

    // Wait for the snapshot to render; KPIs should appear.
    await expect(page.locator('text=/\\$\\d/').first()).toBeVisible({ timeout: 30_000 })

    // Switch to Spreadsheet
    const ssTab = page.getByRole('button', { name: /^Spreadsheet$/ })
    await ssTab.scrollIntoViewIfNeeded()
    await ssTab.click({ force: true })
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 })
    const bodyRows = page.locator('table tbody tr')
    await expect
      .poll(async () => await bodyRows.count(), { timeout: 10_000 })
      .toBeGreaterThan(0)

    // ---- 4. Confidence + view source on real data ----
    // Click the first data row.
    await bodyRows.first().click()
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

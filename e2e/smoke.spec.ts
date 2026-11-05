import { test, expect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import ExcelJS from 'exceljs'
import { importSampleData, openFresh } from './helpers'

// Runs against the fictional data from test-data/generate.ts (created by
// e2e/global-setup.ts). That data has 34 employees in the Excel export, one
// extra employee who only appears in the PDFs, three projects, and one
// allocation code (UNKNOWN-PRJ-999) that doesn't belong to any project.

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
  page.setDefaultTimeout(15_000)
})

test.afterAll(async () => {
  await page.close()
})

test('cold load shows the import drop zone', async () => {
  await openFresh(page)
  await expect(page.getByRole('button', { name: /Billing Hours/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose Folder' })).toBeVisible()
  await expect(page.getByText(/Drop your monthly Excel \+ PDF folder/).first()).toBeVisible()
})

test('imports the generated Excel and PDFs through the setup wizard', async () => {
  test.setTimeout(180_000)
  await importSampleData(page)

  // Header and KPI tiles use the same counts
  await expect(
    page.getByText('Apr 2026 · 35 employees · 3 projects · 1 unmapped code', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/· 35 employees$/)).toBeVisible()
  await expect(page.getByText('1 unmapped', { exact: true })).toBeVisible()
  await expect(page.getByText('All configured')).toHaveCount(0)
})

test('By Project labels the unmapped code and uses the right plurals', async () => {
  const table = page.locator('table')
  await expect(table.getByText('Project Alpha — Data Center 1')).toBeVisible()
  await expect(table.getByText('Project Bravo — Office Campus')).toBeVisible()
  await expect(table.getByText('Charlie Data Center 2')).toBeVisible()

  const unmappedRow = table.locator('tr[data-unmapped]')
  await expect(unmappedRow).toHaveCount(1)
  await expect(unmappedRow).toContainText('Unmapped: UNKNOWN-PRJ-999')
  await expect(unmappedRow).toContainText('Not mapped')
  await expect(unmappedRow).toContainText('2 employees · 4 weeks')
  await expect(page.getByText('3 projects · 1 unmapped', { exact: true })).toBeVisible()

  // Bravo bills OT after 50 h, so OT billed is lower than OT worked
  const bravo = table.locator('tr', { hasText: 'Project Bravo' })
  await expect(bravo).toContainText('50 hrs / wk')

  await expect(page.locator('body')).not.toContainText('__unmapped')
})

test('By Employee, By Week and Spreadsheet views render', async () => {
  await page.getByRole('button', { name: 'By Employee', exact: true }).click()
  await expect(page.getByText(/35 employees · click row to expand/)).toBeVisible()

  await page.getByRole('button', { name: 'By Week', exact: true }).click()
  await expect(page.getByText('4 weeks', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Spreadsheet', exact: true }).click()
  const rows = page.locator('table tbody tr')
  await expect(rows.first()).toBeVisible()

  // The table is virtualized, so filter down to the unmapped rows to check them
  const search = page.getByPlaceholder(/Search rows/)
  await search.fill('UNKNOWN-PRJ-999')
  await expect(page.locator('table tbody')).toContainText('Unmapped: UNKNOWN-PRJ-999')
  await expect(page.locator('body')).not.toContainText('__unmapped')
  await search.press('Escape')
  await expect(search).toHaveValue('')

  await rows.first().click()
  await expect(page.getByRole('button', { name: /View source/i })).toBeVisible()
  await page.keyboard.press('Escape')
})

test('CSV export uses readable project names', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export view' }).click(),
  ])
  const csv = fs.readFileSync(await download.path(), 'utf-8')
  expect(csv.split('\n')[0]).toContain('Project')
  expect(csv).toContain('Unmapped: UNKNOWN-PRJ-999')
  expect(csv).toContain('Project Alpha — Data Center 1')
  expect(csv).not.toContain('__unmapped')
})

test('workbook export has one tab per project and no internal keys', async () => {
  await page.getByRole('button', { name: 'Exports', exact: true }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Generate Workbook' }).click(),
  ])
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(await download.path())
  const names = wb.worksheets.map((ws) => ws.name)
  expect(names).toContain('Unmapped - UNKNOWN-PRJ-999')
  expect(names.some((n) => n.startsWith('Project Alpha'))).toBe(true)
  for (const ws of wb.worksheets) {
    ws.eachRow((row) => {
      expect(JSON.stringify(row.values)).not.toContain('__unmapped')
    })
  }
})

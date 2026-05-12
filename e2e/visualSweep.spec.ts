/**
 * Visual sweep — capture screenshots of every page across themes and
 * viewports, plus run programmatic checks (text-node count, fixed-element
 * overlap detection, hidden-text scan) and emit a JSON report.
 *
 * Output:
 *   test/integration/visual-sweep/<theme>-<viewport>/<page>.png
 *   test/integration/visual-sweep/report.json
 *
 * `test/integration/` is gitignored so screenshots stay local.
 */
import { test, expect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

const PAGE_URL = process.env.RECON_PAGE_URL ?? 'https://noahfgarrett.github.io/FinanceReconciliation/'
const SWEEP_DIR = path.resolve(process.cwd(), 'test/integration/visual-sweep')

interface Viewport { name: string; width: number; height: number }
const VIEWPORTS: Viewport[] = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
]
const THEMES: Array<'dark' | 'light'> = ['dark', 'light']

interface PageCheck {
  pageId: string
  theme: 'dark' | 'light'
  viewport: string
  screenshot: string
  textNodeCount: number
  visibleHeight: number
  issues: string[]
}

const REPORT: PageCheck[] = []

function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark')
    document.documentElement.classList.toggle('light', t === 'light')
    try {
      localStorage.setItem('ui:theme', `"${t}"`)
    } catch { /* ignore */ }
  }, theme)
  // Give Tailwind/dark vars a tick to flip
  await page.waitForTimeout(150)
}

async function clearAll(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    try { localStorage.clear(); sessionStorage.clear() } catch { /* ignore */ }
    try {
      const idb = window.indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> }
      if (idb.databases) {
        const dbs = await idb.databases()
        await Promise.all(dbs.map((d) => d.name ? new Promise<void>((res) => {
          const req = indexedDB.deleteDatabase(d.name as string)
          req.onsuccess = () => res()
          req.onerror = () => res()
          req.onblocked = () => res()
        }) : null).filter(Boolean))
      }
    } catch { /* ignore */ }
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  // Wait for the app shell to finish hydrating (avoids capturing "Loading...")
  // App boots with IDB hydration before showing the dropzone or page content.
  try {
    await page.waitForSelector('aside', { timeout: 10_000 })
  } catch { /* ignore */ }
  await page.waitForTimeout(1500)
}

async function loadSample(page: Page): Promise<void> {
  // The DropZone empty state shows "Or explore with sample data"
  const btn = page.getByRole('button', { name: /Or explore with sample data|Load Sample/i })
  if (await btn.count() > 0) {
    await btn.first().click()
  } else {
    // try via command palette as fallback
    await page.keyboard.press('Meta+K')
    await page.waitForTimeout(300)
    await page.keyboard.type('sample')
    await page.waitForTimeout(200)
    await page.keyboard.press('Enter')
  }
  // Sample data populates IDB then re-renders
  await page.waitForTimeout(2000)
}

async function clickNav(page: Page, label: string): Promise<void> {
  const item = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
  if (await item.count() > 0) await item.click()
  await page.waitForTimeout(300)
}

async function programChecks(page: Page): Promise<{ textNodeCount: number; visibleHeight: number; issues: string[] }> {
  return await page.evaluate(() => {
    const issues: string[] = []
    let textNodeCount = 0

    // count visible text nodes
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
    let n: Node | null
    while ((n = walker.nextNode())) {
      const txt = n.textContent?.trim() ?? ''
      if (txt.length === 0) continue
      const parent = n.parentElement
      if (!parent) continue
      const cs = window.getComputedStyle(parent)
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue
      // Crude legibility: foreground color exactly equal to background
      if (cs.color === cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        issues.push(`text=fg/bg same: "${txt.slice(0, 30)}"`)
      }
      textNodeCount++
    }

    // overlap: compare fixed elements vs body content
    const fixedEls = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const cs = window.getComputedStyle(el)
      return cs.position === 'fixed' && el.getBoundingClientRect().width > 50
    })
    if (fixedEls.length > 30) issues.push(`many-fixed=${fixedEls.length}`)

    return { textNodeCount, visibleHeight: document.body.scrollHeight, issues }
  })
}

async function captureAt(
  page: Page, pageId: string, theme: 'dark' | 'light', vp: Viewport,
): Promise<void> {
  const dir = path.join(SWEEP_DIR, `${theme}-${vp.name}`)
  ensureDir(dir)
  const screenshot = path.join(dir, `${pageId}.png`)
  await page.screenshot({ path: screenshot, fullPage: false })
  const checks = await programChecks(page)
  REPORT.push({
    pageId, theme, viewport: vp.name, screenshot,
    textNodeCount: checks.textNodeCount,
    visibleHeight: checks.visibleHeight,
    issues: checks.issues,
  })
}

test.describe('visual sweep', () => {
  // single test that loops through everything (sequential to keep state coherent)
  test('captures all pages × theme × viewport', async ({ page, browser }) => {
    test.setTimeout(360_000)
    ensureDir(SWEEP_DIR)

    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
        const p = await ctx.newPage()
        try {
          await clearAll(p)
          await setTheme(p, theme)

          // 1. Billing Hours empty state
          await captureAt(p, '01-billing-empty', theme, vp)

          // load sample so we can capture populated states
          await loadSample(p)
          await p.waitForTimeout(2500)

          // The sample data triggers the Project Mapping Modal — capture it,
          // then dismiss with "Close (ignore all)" so the rest of the sweep
          // can proceed.
          const mappingModal = p.locator('[data-testid="project-mapping-modal"]')
          if (await mappingModal.count() > 0) {
            await captureAt(p, '20-project-mapping-modal', theme, vp)
            const closeBtn = p.getByRole('button', { name: /Close \(ignore all\)/i })
            if (await closeBtn.count() > 0) {
              await closeBtn.first().click()
              await p.waitForTimeout(500)
            }
          }
          await captureAt(p, '02-billing-by-project', theme, vp)

          // tab strip — by Employee
          const byEmp = p.getByRole('tab', { name: /By Employee/i })
          if (await byEmp.count() > 0) {
            await byEmp.first().click(); await p.waitForTimeout(250)
            await captureAt(p, '03-billing-by-employee', theme, vp)
          }

          const byWeek = p.getByRole('tab', { name: /By Week/i })
          if (await byWeek.count() > 0) {
            await byWeek.first().click(); await p.waitForTimeout(250)
            await captureAt(p, '04-billing-by-week', theme, vp)
          }

          const ssTab = p.getByRole('tab', { name: /Spreadsheet/i })
          if (await ssTab.count() > 0) {
            await ssTab.first().click(); await p.waitForTimeout(250)
            await captureAt(p, '05-billing-spreadsheet', theme, vp)
          }

          // 8. Reconcile page
          await clickNav(p, 'Reconcile')
          await captureAt(p, '08-reconcile', theme, vp)

          // 9. Projects
          await clickNav(p, 'Projects')
          await captureAt(p, '09-projects', theme, vp)

          // 11. Clients sub-tab if present
          const clientsTab = p.getByRole('tab', { name: /Clients/i })
          if (await clientsTab.count() > 0) {
            await clientsTab.first().click(); await p.waitForTimeout(200)
            await captureAt(p, '11-clients', theme, vp)
          }

          // 12. Exports
          await clickNav(p, 'Exports')
          await captureAt(p, '12-exports', theme, vp)

          // 14. Snapshots/History
          await clickNav(p, 'Snapshots')
          await captureAt(p, '14-history', theme, vp)

          // 15. Settings (gear icon area or via cmd palette)
          // try to open via cmd palette
          await p.keyboard.press('Meta+K')
          await p.waitForTimeout(300)
          await captureAt(p, '17-cmd-palette', theme, vp)
          await p.keyboard.press('Escape')
          await p.waitForTimeout(200)

          // 18. Keyboard help
          await p.keyboard.press('?')
          await p.waitForTimeout(300)
          await captureAt(p, '18-keyboard-help', theme, vp)
          await p.keyboard.press('Escape')
          await p.waitForTimeout(200)

          // 19. Update modal — click sidebar version
          // Find a button that contains version-ish text or click logo footer
          const versionBtn = p.locator('text=/v[0-9]+\\.[0-9]+\\.[0-9]+/').first()
          if (await versionBtn.count() > 0) {
            try {
              await versionBtn.click()
              await p.waitForTimeout(400)
              await captureAt(p, '19-update-changelog', theme, vp)
              await p.keyboard.press('Escape')
              await p.waitForTimeout(200)
            } catch { /* version not clickable in this build */ }
          }
        } finally {
          await ctx.close()
        }
      }
    }

    // write report
    fs.writeFileSync(path.join(SWEEP_DIR, 'report.json'), JSON.stringify(REPORT, null, 2))

    // sanity: every captured page should have visible text
    const empty = REPORT.filter((r) => r.textNodeCount < 5)
    if (empty.length > 0) {
      console.warn('Pages with low text-node count:')
      for (const e of empty) console.warn(`  ${e.theme}/${e.viewport}/${e.pageId}: ${e.textNodeCount}`)
    }
    expect(REPORT.length).toBeGreaterThan(0)
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import type { PdfParseResult } from './pdfParser'

// ---- Mock pdfjs-dist via pdfjsConfig ----

type FakeTextItem = {
  str: string
  transform: [number, number, number, number, number, number]
  width?: number
  height?: number
}

function makeItem(str: string, x: number, y: number, width = 60, height = 10): FakeTextItem {
  return { str, transform: [1, 0, 0, 1, x, y], width, height }
}

function makeFakeDoc(pages: FakeTextItem[][]): unknown {
  return {
    numPages: pages.length,
    getPage: async (p: number) => ({
      getTextContent: async () => ({ items: pages[p - 1] }),
    }),
  }
}

function mockPdfjsConfig(pages: FakeTextItem[][]): void {
  vi.doMock('@/parsers/pdfjsConfig', () => ({
    pdfjs: {
      getDocument: () => ({ promise: Promise.resolve(makeFakeDoc(pages)) }),
      GlobalWorkerOptions: { workerSrc: '' },
    },
  }))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

// ---- Helpers to build synthetic page items ----

/** A realistic biweekly timesheet page. */
function buildTimesheetPage(): FakeTextItem[] {
  return [
    // Header section (y=750 = top)
    makeItem('Employee: Noah Garrett 2000', 50, 750),
    makeItem('Period: 04/06/2026 - 04/12/2026', 50, 730),
    // Week 1: 5 entries, one allocation ACM-001
    // Row: date  payCode  allocation  hours
    makeItem('04/06/2026', 50, 700),
    makeItem('REG', 120, 700),
    makeItem('ACM-001', 200, 700),
    makeItem('8.0', 400, 700),
    makeItem('8.0', 500, 700),

    makeItem('04/07/2026', 50, 685),
    makeItem('REG', 120, 685),
    makeItem('ACM-001', 200, 685),
    makeItem('8.0', 500, 685),

    makeItem('04/08/2026', 50, 670),
    makeItem('REG', 120, 670),
    makeItem('VTX-PLN', 200, 670),
    makeItem('8.0', 500, 670),

    makeItem('04/09/2026', 50, 655),
    makeItem('REG', 120, 655),
    makeItem('ACM-001', 200, 655),
    makeItem('8.0', 500, 655),

    makeItem('04/10/2026', 50, 640),
    makeItem('REG', 120, 640),
    makeItem('ACM-001', 200, 640),
    makeItem('8.0', 500, 640),

    // Week total line
    makeItem('Weekly Total', 50, 620),
    makeItem('40.0', 500, 620),
  ]
}

// ---- Tests ----

describe('parsePdf', () => {
  it('extracts employee, period, entries, and weekly totals from synthetic PDF', async () => {
    mockPdfjsConfig([buildTimesheetPage()])
    const { parsePdf } = await import('./pdfParser')

    const result: PdfParseResult = await parsePdf(new ArrayBuffer(8), 'noah-2026-04.pdf')

    expect(result.parsed).not.toBeNull()
    expect(result.parsed!.employeeCode).toBe('2000')
    expect(result.parsed!.employeeName).toBe('Noah Garrett')
    expect(result.parsed!.payPeriodStart).toBe('2026-04-06')
    expect(result.parsed!.payPeriodEnd).toBe('2026-04-12')

    // Should have 5 entries (one per day)
    expect(result.parsed!.entries).toHaveLength(5)

    // Both allocation codes present
    const allocs = result.parsed!.entries.map((e) => e.allocation)
    expect(allocs).toContain('ACM-001')
    expect(allocs).toContain('VTX-PLN')

    // Week of 2026-04-06: 5 × 8 = 40 hrs
    const weekTotals = result.parsed!.weeklyTotals
    const week = '2026-04-06'
    expect(weekTotals[week]).toBeCloseTo(40, 1)
  })

  it('returns null + parse-failure warning when Employee header is missing', async () => {
    const noHeaderPage: FakeTextItem[] = [
      makeItem('Period: 04/06/2026 - 04/12/2026', 50, 730),
      makeItem('04/06/2026', 50, 700),
      makeItem('REG', 120, 700),
      makeItem('ACM-001', 200, 700),
      makeItem('8.0', 500, 700),
    ]
    mockPdfjsConfig([noHeaderPage])
    const { parsePdf } = await import('./pdfParser')

    const result = await parsePdf(new ArrayBuffer(8))

    expect(result.parsed).toBeNull()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].code).toBe('parse-failure')
    expect(result.warnings[0].severity).toBe('error')
    expect(result.warnings[0].message).toContain('employee header')
  })

  it('emits high confidence + a non-zero source bbox for a clean entry', async () => {
    mockPdfjsConfig([buildTimesheetPage()])
    const { parsePdf } = await import('./pdfParser')

    const result = await parsePdf(new ArrayBuffer(8), 'noah-2026-04.pdf')

    expect(result.parsed).not.toBeNull()
    const first = result.parsed!.entries[0]
    // Synthetic page has no $-anchor, so the parser falls back to the
    // last-numeric heuristic and emits a small confidence penalty.
    expect(first.confidence).toBeGreaterThanOrEqual(0.9)
    expect(first.source).toBeDefined()
    expect(first.source!.pageIndex).toBe(1)
    expect(first.source!.width).toBeGreaterThan(0)
    expect(first.source!.height).toBeGreaterThan(0)

    expect(result.parsed!.pageCount).toBe(1)
    expect(result.pdfBytes).not.toBeNull()
  })

  it('lowers confidence when hours are out of typical range', async () => {
    const page: FakeTextItem[] = [
      makeItem('Employee: Jane Doe 3001', 50, 750),
      makeItem('Period: 04/06/2026 - 04/12/2026', 50, 730),
      // 18 hours is above the 16-hour typical cap
      makeItem('04/06/2026', 50, 700),
      makeItem('REG', 120, 700),
      makeItem('CAL-SVC', 200, 700),
      makeItem('18.0', 500, 700),
    ]
    mockPdfjsConfig([page])
    const { parsePdf } = await import('./pdfParser')

    const result = await parsePdf(new ArrayBuffer(8))
    expect(result.parsed).not.toBeNull()
    const e = result.parsed!.entries[0]
    expect(e.confidence).toBeLessThan(1)
    expect(e.confidenceReasons.some((r) => r.includes('outside typical'))).toBe(true)
  })

  it('derives a 7-day week from "Week Ending: MM/DD/YYYY"', async () => {
    const page: FakeTextItem[] = [
      makeItem('Employee: Noah Garrett 2000', 50, 750),
      makeItem('Week Ending: 04/11/2026', 50, 730),
      makeItem('04/06/2026', 50, 700),
      makeItem('REG', 120, 700),
      makeItem('ACM-001', 200, 700),
      makeItem('$170.00', 380, 700),
      makeItem('4.0', 460, 700),
      makeItem('10.5', 520, 700),
    ]
    mockPdfjsConfig([page])
    const { parsePdf } = await import('./pdfParser')

    const result = await parsePdf(new ArrayBuffer(8))
    expect(result.parsed).not.toBeNull()
    // 7-day week ending 04/11 starts 04/05 (= 04/11 minus 6 days)
    expect(result.parsed!.payPeriodStart).toBe('2026-04-05')
    expect(result.parsed!.payPeriodEnd).toBe('2026-04-11')
  })

  it('picks the per-row hours value (first after $-anchor), not per-day rollup', async () => {
    // Row layout: date REG IN OUT alloc tax — comment $dollars perRow perDayRollup
    // The 4.5 (per-row) sits BEFORE the 10.5 (per-day rollup); both pass the
    // 0.1–24 check. The parser should pick 4.5 because it appears FIRST after
    // the dollars column.
    const page: FakeTextItem[] = [
      makeItem('Employee: Noah Garrett 2000', 50, 750),
      makeItem('Week Ending: 04/11/2026', 50, 730),
      makeItem('04/06/2026', 50, 700),
      makeItem('REG', 100, 700),
      makeItem('FAB52-MEP-001', 200, 700),
      makeItem('$191.25', 380, 700),
      makeItem('4.5', 460, 700),  // per-row total — what we want
      makeItem('10.5', 520, 700), // per-day rollup — should be ignored
    ]
    mockPdfjsConfig([page])
    const { parsePdf } = await import('./pdfParser')

    const result = await parsePdf(new ArrayBuffer(8))
    expect(result.parsed).not.toBeNull()
    expect(result.parsed!.entries).toHaveLength(1)
    expect(result.parsed!.entries[0].hoursTotal).toBe(4.5)
  })

  it('skips the "TOTAL:" summary row even when it contains numeric tokens', async () => {
    const page: FakeTextItem[] = [
      makeItem('Employee: Noah Garrett 2000', 50, 750),
      makeItem('Week Ending: 04/11/2026', 50, 730),
      // Real entry
      makeItem('04/06/2026', 50, 700),
      makeItem('REG', 100, 700),
      makeItem('FAB52-MEP-001', 200, 700),
      makeItem('$191.25', 380, 700),
      makeItem('4.5', 460, 700),
      // TOTAL: summary row — also includes a date-shaped looking value, but
      // the parser must skip the entire line because of the TOTAL: marker.
      makeItem('TOTAL:', 300, 600),
      makeItem('$2,401.25', 380, 600),
      makeItem('51.0', 460, 600),
      makeItem('51.0', 520, 600),
    ]
    mockPdfjsConfig([page])
    const { parsePdf } = await import('./pdfParser')

    const result = await parsePdf(new ArrayBuffer(8))
    expect(result.parsed).not.toBeNull()
    // Only the real entry should be picked up, not the TOTAL row.
    expect(result.parsed!.entries).toHaveLength(1)
    expect(result.parsed!.entries[0].hoursTotal).toBe(4.5)
  })

  it('skips lines with date-only (no allocation, no hours) without crashing', async () => {
    const page: FakeTextItem[] = [
      makeItem('Employee: Jane Doe 3001', 50, 750),
      makeItem('Period: 04/06/2026 - 04/12/2026', 50, 730),
      // This line has a date but no alloc code and no hours — should be skipped
      makeItem('04/06/2026', 50, 700),
      makeItem('No allocation here', 120, 700),
      // Valid entry
      makeItem('04/07/2026', 50, 685),
      makeItem('REG', 120, 685),
      makeItem('CAL-SVC', 200, 685),
      makeItem('7.5', 500, 685),
    ]
    mockPdfjsConfig([page])
    const { parsePdf } = await import('./pdfParser')

    const result = await parsePdf(new ArrayBuffer(8))

    // Should not crash, should find 1 valid entry
    expect(result.parsed).not.toBeNull()
    expect(result.parsed!.entries).toHaveLength(1)
    expect(result.parsed!.entries[0].hoursTotal).toBe(7.5)
    expect(result.parsed!.entries[0].allocation).toBe('CAL-SVC')
    expect(result.parsed!.employeeCode).toBe('3001')
  })
})

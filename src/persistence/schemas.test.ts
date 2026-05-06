import { describe, it, expect } from 'vitest'
import {
  PdfTimesheetEntrySchema,
  ParsedPdfSchema,
  WeeklyBillingSchema,
  SourceLocationSchema,
} from './schemas'

describe('SourceLocationSchema', () => {
  it('accepts a valid source location', () => {
    const loc = SourceLocationSchema.parse({
      pageIndex: 1,
      x: 50,
      y: 700,
      width: 100,
      height: 12,
    })
    expect(loc.pageIndex).toBe(1)
  })

  it('rejects a 0-page index', () => {
    expect(() =>
      SourceLocationSchema.parse({ pageIndex: 0, x: 0, y: 0, width: 0, height: 0 }),
    ).toThrow()
  })
})

describe('PdfTimesheetEntrySchema confidence defaults', () => {
  it('defaults confidence to 1 and reasons to []', () => {
    const e = PdfTimesheetEntrySchema.parse({
      date: '2026-04-06',
      payCode: 'REG',
      allocation: 'ACM-001',
      hoursTotal: 8,
      weekStart: '2026-04-06',
    })
    expect(e.confidence).toBe(1)
    expect(e.confidenceReasons).toEqual([])
    expect(e.source).toBeUndefined()
  })
})

describe('ParsedPdfSchema pageCount default', () => {
  it('defaults pageCount to 0 when omitted', () => {
    const p = ParsedPdfSchema.parse({
      employeeCode: '2000',
      employeeName: 'X Y',
      payPeriodStart: '2026-04-06',
      payPeriodEnd: '2026-04-19',
      entries: [],
      weeklyTotals: {},
      rawText: '',
    })
    expect(p.pageCount).toBe(0)
  })
})

describe('WeeklyBillingSchema confidence + sources defaults', () => {
  it('defaults confidence=1, reasons=[], sources=[]', () => {
    const r = WeeklyBillingSchema.parse({
      employeeCode: '2000',
      projectKey: 'p',
      weekStart: '2026-04-06',
      hours: 40,
      regularHrs: 40,
      otHrs: 0,
      dtHrs: 0,
      regularDollars: 0,
      otDollars: 0,
      dtDollars: 0,
    })
    expect(r.confidence).toBe(1)
    expect(r.confidenceReasons).toEqual([])
    expect(r.sources).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { reconcile } from './reconcile'
import type { Employee, ExcelRow, ParsedPdf, ProjectConfig } from '@/persistence/schemas'

const emp = (code: string, first = 'X', last = 'Y'): Employee => ({ code, firstName: first, lastName: last })

const cfg = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  projectKey: 'project-acme',
  displayName: 'Project Acme',
  allocationAliases: ['ACM'],
  otThresholdHrs: 40,
  includeDoubleTime: false,
  defaultRegularRate: 100,
  employeeRateOverrides: {},
  ...overrides,
})

const pdf = (
  code: string,
  weekStart: string,
  allocation: string,
  hours: number,
): ParsedPdf => ({
  employeeCode: code,
  employeeName: 'X Y',
  payPeriodStart: weekStart,
  payPeriodEnd: weekStart,
  entries: [{
    date: weekStart, payCode: 'REG', allocation, hoursTotal: hours, weekStart,
    confidence: 1, confidenceReasons: [],
  }],
  weeklyTotals: { [weekStart]: hours },
  rawText: '',
  pageCount: 0,
})

const excel = (
  code: string,
  projectNames: string[],
  reg: number,
  ot = 0,
  allocations: string[] = ['ACM'],
): ExcelRow => ({
  employeeCode: code,
  projectNames,
  allocations,
  regularHours: reg,
  overtimeHours: ot,
  doubleTimeHours: 0,
  dateUpdated: '2026-04-30',
})

describe('reconcile', () => {
  it('produces a single weekly row with correct OT split and dollars', () => {
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', ['Project Acme'], 50)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'ACM', 50)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.weeklyBilling).toHaveLength(1)
    const r = out.weeklyBilling[0]
    expect(r.regularHrs).toBe(40)
    expect(r.otHrs).toBe(10)
    expect(r.regularDollars).toBe(4000)
    expect(r.otDollars).toBe(1500)
    expect(r.dtDollars).toBe(0)
  })

  it('flags unmatched PDFs', () => {
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', ['Project Acme'], 30)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'ACM', 30), pdf('9999', '2026-04-06', 'ACM', 10)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.warnings.some((w) => w.code === 'unmatched-pdf')).toBe(true)
  })

  it('flags allocations with no project config', () => {
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', ['Project Acme'], 30)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'XYZ-NO-MATCH', 30)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.unresolvedAllocations).toContain('XYZ-NO-MATCH')
    expect(out.warnings.some((w) => w.code === 'allocation-not-mapped')).toBe(true)
  })

  it('flags excel-vs-pdf mismatches at the EMPLOYEE level (sum across PDFs)', () => {
    // Excel says employee 2000 has 30 reg + 0 OT + 0 DT = 30 hr for the month.
    // PDFs together show only 25 hr → mismatch.
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', ['Project Acme'], 30)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'ACM', 25)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.warnings.some((w) => w.code === 'excel-pdf-hours-mismatch')).toBe(true)
  })

  it('does NOT flag mismatch when summed PDF hours match Excel monthly total', () => {
    // Two weekly PDFs summing to 50 hr matches Excel monthly 50.
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', ['Project Acme'], 50)],
      parsedPdfs: [
        pdf('2000', '2026-04-06', 'ACM', 25),
        pdf('2000', '2026-04-13', 'ACM', 25),
      ],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.warnings.some((w) => w.code === 'excel-pdf-hours-mismatch')).toBe(false)
  })

  it('propagates min confidence + deduped reasons + sources to weekly billing', () => {
    const lowConfPdf: ParsedPdf = {
      employeeCode: '2000',
      employeeName: 'X Y',
      payPeriodStart: '2026-04-06',
      payPeriodEnd: '2026-04-06',
      entries: [
        {
          date: '2026-04-06', payCode: 'REG', allocation: 'ACM',
          hoursTotal: 8, weekStart: '2026-04-06',
          confidence: 0.9,
          confidenceReasons: ['ambiguous 2-digit year'],
          source: { pageIndex: 1, x: 50, y: 700, width: 100, height: 12 },
        },
        {
          date: '2026-04-07', payCode: 'REG', allocation: 'ACM',
          hoursTotal: 18, weekStart: '2026-04-06',
          confidence: 0.7,
          confidenceReasons: ['hours outside typical 0.5–16 range', 'ambiguous 2-digit year'],
          source: { pageIndex: 1, x: 50, y: 685, width: 100, height: 12 },
        },
      ],
      weeklyTotals: { '2026-04-06': 26 },
      rawText: '',
      pageCount: 1,
    }
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', ['Project Acme'], 26)],
      parsedPdfs: [lowConfPdf],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.weeklyBilling).toHaveLength(1)
    const r = out.weeklyBilling[0]
    expect(r.confidence).toBe(0.7)
    expect(r.confidenceReasons).toContain('ambiguous 2-digit year')
    expect(r.confidenceReasons).toContain('hours outside typical 0.5–16 range')
    expect(r.confidenceReasons).toHaveLength(2)
    expect(r.sources).toHaveLength(2)
  })

  it('flags missing PDF', () => {
    const out = reconcile({
      employees: [emp('2000'), emp('3000')],
      excelRows: [excel('2000', ['Project Acme'], 30), excel('3000', ['Project Acme'], 20)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'ACM', 30)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.warnings.some((w) => w.code === 'missing-pdf')).toBe(true)
  })
})

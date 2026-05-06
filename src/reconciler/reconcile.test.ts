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

const excel = (code: string, project: string, reg: number, ot = 0): ExcelRow => ({
  employeeCode: code,
  laborAllocationDetails: 'ACM',
  projectName: project,
  regularHours: reg,
  overtimeHours: ot,
  doubleTimeHours: 0,
  dateUpdated: '2026-04-30',
})

describe('reconcile', () => {
  it('produces a single weekly row with correct OT split and dollars', () => {
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', 'Project Acme', 50)],
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
      excelRows: [excel('2000', 'Project Acme', 30)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'ACM', 30), pdf('9999', '2026-04-06', 'ACM', 10)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.warnings.some((w) => w.code === 'unmatched-pdf')).toBe(true)
  })

  it('flags allocations with no project config', () => {
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', 'Project Acme', 30)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'XYZ-NO-MATCH', 30)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.unresolvedAllocations).toContain('XYZ-NO-MATCH')
    expect(out.warnings.some((w) => w.code === 'allocation-not-mapped')).toBe(true)
  })

  it('flags excel-vs-pdf mismatches over 0.1hr', () => {
    const out = reconcile({
      employees: [emp('2000')],
      excelRows: [excel('2000', 'Project Acme', 30)],   // 30 reg + 0 OT + 0 DT = 30
      parsedPdfs: [pdf('2000', '2026-04-06', 'ACM', 25)], // PDF says 25
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.warnings.some((w) => w.code === 'excel-pdf-hours-mismatch')).toBe(true)
  })

  it('flags missing PDF', () => {
    const out = reconcile({
      employees: [emp('2000'), emp('3000')],
      excelRows: [excel('2000', 'Project Acme', 30), excel('3000', 'Project Acme', 20)],
      parsedPdfs: [pdf('2000', '2026-04-06', 'ACM', 30)],
      projectConfigs: { 'project-acme': cfg() },
    })
    expect(out.warnings.some((w) => w.code === 'missing-pdf')).toBe(true)
  })
})

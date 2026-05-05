import type {
  Employee, ExcelRow, ParsedPdf, ProjectConfig, RowFlag, WeeklyBilling,
} from '@/persistence/schemas'
import { resolveAllocationToProjectKey, slugifyProjectName } from './projectMatching'
import { splitWeekHours, resolveRates } from './otCalculator'

export interface ReconcileInput {
  employees: Employee[]
  excelRows: ExcelRow[]
  parsedPdfs: ParsedPdf[]
  projectConfigs: Record<string, ProjectConfig>
}

export interface ReconcileOutput {
  weeklyBilling: WeeklyBilling[]
  warnings: RowFlag[]
  unresolvedAllocations: string[] // surfaced for the project-mapping modal
}

const HOURS_TOLERANCE = 0.1
const HIGH_OT_RATIO = 2.0

export function reconcile(input: ReconcileInput): ReconcileOutput {
  const { employees, excelRows, parsedPdfs, projectConfigs } = input
  const warnings: RowFlag[] = []
  const billing: WeeklyBilling[] = []
  const unresolved = new Set<string>()

  const empMap = new Map(employees.map((e) => [e.code, e]))
  const excelByEmpProject = new Map<string, ExcelRow>()
  for (const row of excelRows) {
    const k = `${row.employeeCode}|${slugifyProjectName(row.projectName)}`
    excelByEmpProject.set(k, row)
  }

  // 1. unmatched-pdf flags
  for (const pdf of parsedPdfs) {
    if (!empMap.has(pdf.employeeCode)) {
      warnings.push({
        severity: 'warn',
        code: 'unmatched-pdf',
        message: `PDF for employee code ${pdf.employeeCode} (${pdf.employeeName}) does not appear in the Excel`,
        context: { employeeCode: pdf.employeeCode },
      })
    }
  }
  // missing-pdf flags
  const pdfCodes = new Set(parsedPdfs.map((p) => p.employeeCode))
  for (const e of employees) {
    if (!pdfCodes.has(e.code)) {
      warnings.push({
        severity: 'warn',
        code: 'missing-pdf',
        message: `No PDF found for ${e.firstName} ${e.lastName} (${e.code})`,
        context: { employeeCode: e.code },
      })
    }
  }

  // 2. Build (employee, project, week) totals from PDF entries.
  interface Bucket {
    hours: number
    weekStart: string
    employeeCode: string
    projectKey: string
  }
  const buckets = new Map<string, Bucket>()

  for (const pdf of parsedPdfs) {
    if (!empMap.has(pdf.employeeCode)) continue
    for (const entry of pdf.entries) {
      const projectKey = resolveAllocationToProjectKey(entry.allocation, projectConfigs)
      if (!projectKey) {
        unresolved.add(entry.allocation)
        continue
      }
      const k = `${pdf.employeeCode}|${projectKey}|${entry.weekStart}`
      const existing = buckets.get(k)
      if (existing) existing.hours += entry.hoursTotal
      else buckets.set(k, { hours: entry.hoursTotal, weekStart: entry.weekStart, employeeCode: pdf.employeeCode, projectKey })
    }
  }

  // 3. Cross-check Excel monthly project totals vs PDF-derived sums
  const pdfProjectTotals = new Map<string, number>()
  for (const b of buckets.values()) {
    const k = `${b.employeeCode}|${b.projectKey}`
    pdfProjectTotals.set(k, (pdfProjectTotals.get(k) ?? 0) + b.hours)
  }
  for (const [, row] of excelByEmpProject) {
    const cfg = Object.values(projectConfigs).find(
      (c) => slugifyProjectName(c.displayName) === slugifyProjectName(row.projectName),
    )
    if (!cfg) continue
    const pdfTotalKey = `${row.employeeCode}|${cfg.projectKey}`
    const pdfTotal = pdfProjectTotals.get(pdfTotalKey) ?? 0
    const excelTotal = row.regularHours + row.overtimeHours + row.doubleTimeHours
    if (Math.abs(pdfTotal - excelTotal) > HOURS_TOLERANCE) {
      warnings.push({
        severity: 'warn',
        code: 'excel-pdf-hours-mismatch',
        message: `${row.employeeCode} on ${row.projectName}: Excel total ${excelTotal.toFixed(2)} hr vs PDF total ${pdfTotal.toFixed(2)} hr`,
        context: { employeeCode: row.employeeCode, projectKey: cfg.projectKey, excelTotal, pdfTotal },
      })
    }
  }

  // 4. Apply OT thresholds + rates to produce WeeklyBilling rows
  for (const b of buckets.values()) {
    const cfg = projectConfigs[b.projectKey]
    if (!cfg) continue
    const split = splitWeekHours(b.hours, cfg)
    const rates = resolveRates(cfg, b.employeeCode)
    const flags: RowFlag[] = []
    if (split.otHrs > cfg.otThresholdHrs * (HIGH_OT_RATIO - 1)) {
      flags.push({
        severity: 'info',
        code: 'high-ot-anomaly',
        message: `OT ${split.otHrs.toFixed(1)}hr exceeds 200% of threshold (${cfg.otThresholdHrs}hr)`,
      })
    }
    billing.push({
      employeeCode: b.employeeCode,
      projectKey: b.projectKey,
      weekStart: b.weekStart,
      hours: b.hours,
      regularHrs: split.regularHrs,
      otHrs: split.otHrs,
      dtHrs: split.dtHrs,
      regularDollars: round2(split.regularHrs * rates.regular),
      otDollars: round2(split.otHrs * rates.ot),
      dtDollars: round2(split.dtHrs * rates.dt),
      flags,
      reviewed: false,
    })
  }

  // 5. allocation-not-mapped warnings
  for (const alloc of unresolved) {
    warnings.push({
      severity: 'error',
      code: 'allocation-not-mapped',
      message: `Allocation code "${alloc}" is not mapped to any project`,
      context: { allocation: alloc },
    })
  }

  // sort billing rows for stable output
  billing.sort(
    (a, b) =>
      a.employeeCode.localeCompare(b.employeeCode) ||
      a.projectKey.localeCompare(b.projectKey) ||
      a.weekStart.localeCompare(b.weekStart),
  )

  return { weeklyBilling: billing, warnings, unresolvedAllocations: Array.from(unresolved) }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

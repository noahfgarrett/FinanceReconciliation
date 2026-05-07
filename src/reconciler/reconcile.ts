import type {
  Employee, ExcelRow, ParsedPdf, ProjectConfig, RowFlag,
  SourceLocation, WeeklyBilling,
} from '@/persistence/schemas'
import { resolveAllocationToProjectKey } from './projectMatching'
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

  // Excel rows are now per-employee monthly summaries (one row per employee).
  // If the same employee appears more than once we sum their hours.
  interface ExcelEmployeeTotal {
    regular: number
    overtime: number
    doubleTime: number
  }
  const excelByEmployee = new Map<string, ExcelEmployeeTotal>()
  for (const row of excelRows) {
    const existing = excelByEmployee.get(row.employeeCode)
    if (existing) {
      existing.regular += row.regularHours
      existing.overtime += row.overtimeHours
      existing.doubleTime += row.doubleTimeHours
    } else {
      excelByEmployee.set(row.employeeCode, {
        regular: row.regularHours,
        overtime: row.overtimeHours,
        doubleTime: row.doubleTimeHours,
      })
    }
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
    /** Min confidence over all contributing entries. */
    confidence: number
    /** Deduped union of contributing entry reasons. */
    confidenceReasons: Set<string>
    /** Source bboxes of every contributing entry (for the source viewer). */
    sources: SourceLocation[]
  }
  const buckets = new Map<string, Bucket>()
  // Total PDF hours per employee — for employee-level cross-check vs Excel.
  const pdfEmployeeHours = new Map<string, number>()

  for (const pdf of parsedPdfs) {
    if (!empMap.has(pdf.employeeCode)) continue
    for (const entry of pdf.entries) {
      pdfEmployeeHours.set(
        pdf.employeeCode,
        (pdfEmployeeHours.get(pdf.employeeCode) ?? 0) + entry.hoursTotal,
      )

      const projectKey = resolveAllocationToProjectKey(entry.allocation, projectConfigs)
      if (!projectKey) {
        unresolved.add(entry.allocation)
        continue
      }
      const k = `${pdf.employeeCode}|${projectKey}|${entry.weekStart}`
      const existing = buckets.get(k)
      if (existing) {
        existing.hours += entry.hoursTotal
        existing.confidence = Math.min(existing.confidence, entry.confidence)
        for (const r of entry.confidenceReasons) existing.confidenceReasons.add(r)
        if (entry.source) existing.sources.push(entry.source)
      } else {
        buckets.set(k, {
          hours: entry.hoursTotal,
          weekStart: entry.weekStart,
          employeeCode: pdf.employeeCode,
          projectKey,
          confidence: entry.confidence,
          confidenceReasons: new Set(entry.confidenceReasons),
          sources: entry.source ? [entry.source] : [],
        })
      }
    }
  }

  // 3. Cross-check Excel monthly totals vs PDF-derived sums at EMPLOYEE level.
  // (Excel exports do not break out hours per project.)
  for (const [code, totals] of excelByEmployee) {
    if (!empMap.has(code)) continue // unmatched-employee handled elsewhere
    if (!pdfCodes.has(code)) continue // missing-pdf already flagged
    const pdfTotal = pdfEmployeeHours.get(code) ?? 0
    const excelTotal = totals.regular + totals.overtime + totals.doubleTime
    if (Math.abs(pdfTotal - excelTotal) > HOURS_TOLERANCE) {
      const emp = empMap.get(code)
      const name = emp ? `${emp.firstName} ${emp.lastName}` : code
      warnings.push({
        severity: 'warn',
        code: 'excel-pdf-hours-mismatch',
        message: `${name} (${code}): Excel monthly total ${excelTotal.toFixed(2)} hr vs PDF total ${pdfTotal.toFixed(2)} hr`,
        context: { employeeCode: code, excelTotal, pdfTotal },
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
      confidence: b.confidence,
      confidenceReasons: Array.from(b.confidenceReasons),
      sources: b.sources,
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

import type {
  Employee, ExcelRow, ParsedPdf, ProjectConfig, RowFlag,
  SourceLocation, WeeklyBilling,
} from '@/persistence/schemas'
import { resolveAllocationToProjectKey } from './projectMatching'
import { splitWeekHours, resolveRates } from './otCalculator'
import type { EmployeeProfileForRates } from './otCalculator'

export interface ReconcileInput {
  employees: Employee[]
  excelRows: ExcelRow[]
  parsedPdfs: ParsedPdf[]
  projectConfigs: Record<string, ProjectConfig>
  employeeProfiles?: Record<string, EmployeeProfileForRates>
}

export interface ReconcileOutput {
  weeklyBilling: WeeklyBilling[]
  warnings: RowFlag[]
  unresolvedAllocations: string[] // surfaced for the project-mapping modal
}

const HOURS_TOLERANCE = 0.1
// Flag a (employee × project × week) row when its TOTAL hours exceed this
// fraction of the project's OT threshold. 1.3 catches a 55-hr week on a
// 40-hr-threshold project (1.375×) without flagging routine 50-hr OT weeks.
const HIGH_OT_RATIO = 1.3
// A "full month" of timesheets is roughly 4 ISO weeks. When PDFs for a given
// employee cover fewer than this, an Excel/PDF total mismatch is expected
// (partial coverage) and is reported as info rather than warn.
const PARTIAL_COVERAGE_WEEKS = 4

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
  // missing-pdf flags — collapse to a single info-level summary when more
  // than one employee has Excel rows but no imported PDFs (partial coverage).
  const pdfCodes = new Set(parsedPdfs.map((p) => p.employeeCode))
  const missingPdfEmployees: string[] = []
  for (const e of employees) {
    if (!pdfCodes.has(e.code)) {
      missingPdfEmployees.push(`${e.firstName} ${e.lastName} (${e.code})`)
    }
  }
  if (missingPdfEmployees.length === 1) {
    warnings.push({
      severity: 'warn',
      code: 'missing-pdf',
      message: `No PDF found for ${missingPdfEmployees[0]}`,
      context: { employees: missingPdfEmployees },
    })
  } else if (missingPdfEmployees.length >= 2) {
    warnings.push({
      severity: 'info',
      code: 'missing-pdf',
      message: `${missingPdfEmployees.length} employees have Excel rows but no PDFs imported (partial coverage). Drop more PDFs to fill in the rest.`,
      context: { count: missingPdfEmployees.length, employees: missingPdfEmployees },
    })
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
  // Distinct ISO weeks covered per employee — used to detect partial coverage.
  const weeksByEmployee = new Map<string, Set<string>>()

  for (const pdf of parsedPdfs) {
    if (!empMap.has(pdf.employeeCode)) continue
    for (const entry of pdf.entries) {
      pdfEmployeeHours.set(
        pdf.employeeCode,
        (pdfEmployeeHours.get(pdf.employeeCode) ?? 0) + entry.hoursTotal,
      )
      const set = weeksByEmployee.get(pdf.employeeCode) ?? new Set<string>()
      set.add(entry.weekStart)
      weeksByEmployee.set(pdf.employeeCode, set)

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
      const weeksCovered = weeksByEmployee.get(code)?.size ?? 0
      const partial = weeksCovered < PARTIAL_COVERAGE_WEEKS
      warnings.push({
        severity: partial ? 'info' : 'warn',
        code: 'excel-pdf-hours-mismatch',
        message: partial
          ? `${name} (${code}): partial PDF coverage (${weeksCovered} weeks) — Excel total ${excelTotal.toFixed(2)} hr vs PDF total ${pdfTotal.toFixed(2)} hr`
          : `${name} (${code}): Excel monthly total ${excelTotal.toFixed(2)} hr vs PDF total ${pdfTotal.toFixed(2)} hr`,
        context: { employeeCode: code, excelTotal, pdfTotal, weeksCovered, partial },
      })
    }
  }

  // 4. Apply OT thresholds + rates to produce WeeklyBilling rows
  for (const b of buckets.values()) {
    const cfg = projectConfigs[b.projectKey]
    if (!cfg) continue
    const split = splitWeekHours(b.hours, cfg)
    const empProfile = input.employeeProfiles?.[b.employeeCode]
    const rates = resolveRates(cfg, b.employeeCode, empProfile)
    const flags: RowFlag[] = []
    if (b.hours > cfg.otThresholdHrs * HIGH_OT_RATIO) {
      const pct = Math.round((b.hours / cfg.otThresholdHrs) * 100)
      flags.push({
        severity: 'info',
        code: 'high-ot-anomaly',
        message: `Weekly hours ${b.hours.toFixed(1)} are ${pct}% of project threshold (${cfg.otThresholdHrs}hr/wk)`,
      })
    }

    // Rate-based warning flags
    if (rates.source === 'none') {
      flags.push({
        severity: 'error',
        code: 'no-bill-rate',
        message: `No bill rate found for employee ${b.employeeCode} on project ${b.projectKey}`,
      })
    }
    if (rates.source === 'project-default') {
      flags.push({
        severity: 'info',
        code: 'using-project-default',
        message: `Using project default rate ($${rates.regular}/hr) for employee ${b.employeeCode}`,
      })
    }
    if (rates.source === 'employee-override' && empProfile) {
      const maxRate = Math.max(empProfile.defaultBillRate, rates.regular)
      if (maxRate > 0) {
        const deviation = Math.abs(empProfile.defaultBillRate - rates.regular) / maxRate
        if (deviation > 0.2) {
          flags.push({
            severity: 'warn',
            code: 'rate-mismatch',
            message: `Employee default rate ($${empProfile.defaultBillRate}/hr) differs from project override ($${rates.regular}/hr) by ${Math.round(deviation * 100)}%`,
          })
        }
      }
    }
    if (rates.regular === 0 && rates.source !== 'none') {
      flags.push({
        severity: 'warn',
        code: 'zero-rate',
        message: `Bill rate resolved to $0/hr for employee ${b.employeeCode} on project ${b.projectKey}`,
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

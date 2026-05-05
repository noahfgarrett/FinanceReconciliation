import type { Employee, ExcelRow, ParsedPdf, PdfTimesheetEntry } from '@/persistence/schemas'
import { isoMonday } from './dateUtils'

export interface SampleData {
  employees: Employee[]
  excelRows: ExcelRow[]
  parsedPdfs: ParsedPdf[]
  periodLabel: string
}

const PROJECTS: Array<{ name: string; allocation: string; threshold: 40 | 50 }> = [
  { name: 'Acme — Phase 2', allocation: 'ACM-001', threshold: 40 },
  { name: 'Vortex Plant Upgrade', allocation: 'VTX-PLN', threshold: 50 },
  { name: 'Calverton Service', allocation: 'CAL-SVC', threshold: 40 },
]

const FIRST_NAMES = ['Noah', 'Aiden', 'Ella', 'Sofia', 'Liam', 'Mia', 'Lucas', 'Ava']
const LAST_NAMES = ['Garrett', 'Reilly', 'Patel', 'Nguyen', 'Murphy', 'Walsh', "O'Brien", 'Doyle']

/** Build a synthetic month: 8 employees × varying projects × 4 weeks. */
export function generateSampleData(): SampleData {
  const employees: Employee[] = FIRST_NAMES.map((firstName, i) => ({
    code: String(2000 + i),
    firstName,
    lastName: LAST_NAMES[i],
  }))

  // Period: April 2026, 4 weeks starting Mon 2026-04-06
  const weekStarts = ['2026-04-06', '2026-04-13', '2026-04-20', '2026-04-27']
  const periodLabel = 'April 2026'

  const excelRows: ExcelRow[] = []
  const parsedPdfs: ParsedPdf[] = []

  // Distribute employees across projects (deterministic)
  const empProjects: Record<string, number[]> = {} // employeeCode -> project indices
  employees.forEach((e, i) => {
    if (i < 4) empProjects[e.code] = [0]           // 4 employees on Acme
    else if (i < 6) empProjects[e.code] = [1]      // 2 on Vortex
    else if (i === 6) empProjects[e.code] = [0, 1] // 1 split
    else empProjects[e.code] = [2]                 // 1 on Calverton
  })

  for (const e of employees) {
    const projectIdxs = empProjects[e.code]
    const entries: PdfTimesheetEntry[] = []
    const weeklyTotals: Record<string, number> = {}

    // Per-employee per-project monthly accumulators for ExcelRow
    const monthlyByProject: Record<number, { reg: number; ot: number }> = {}

    for (const ws of weekStarts) {
      // Generate weekly hours per project
      for (const pi of projectIdxs) {
        const project = PROJECTS[pi]
        // Shape: vary 35-55 hours per project per week, deterministic by employee+week
        const seed = (parseInt(e.code) + weekStarts.indexOf(ws) * 7 + pi * 3) % 21
        const hoursThisWeek = projectIdxs.length > 1 ? 22 + (seed % 8) : 38 + seed

        // Spread hours across days Mon..Fri (5 days)
        const perDay = hoursThisWeek / 5
        for (let d = 0; d < 5; d++) {
          const date = addDays(ws, d)
          entries.push({
            date,
            payCode: 'REG',
            allocation: project.allocation,
            hoursTotal: round2(perDay),
            weekStart: isoMonday(date),
          })
        }

        weeklyTotals[ws] = (weeklyTotals[ws] ?? 0) + hoursThisWeek
        const splitOt = hoursThisWeek > project.threshold ? hoursThisWeek - project.threshold : 0
        const splitReg = hoursThisWeek - splitOt
        monthlyByProject[pi] = monthlyByProject[pi] ?? { reg: 0, ot: 0 }
        monthlyByProject[pi].reg += splitReg
        monthlyByProject[pi].ot += splitOt
      }
    }

    // Emit ExcelRow per (employee × project) for the month
    for (const piStr of Object.keys(monthlyByProject)) {
      const pi = Number(piStr)
      const totals = monthlyByProject[pi]
      excelRows.push({
        employeeCode: e.code,
        laborAllocationDetails: PROJECTS[pi].allocation,
        projectName: PROJECTS[pi].name,
        regularHours: round2(totals.reg),
        overtimeHours: round2(totals.ot),
        doubleTimeHours: 0,
        dateUpdated: '2026-04-30',
      })
    }

    // Two biweekly PDFs per employee
    const half = entries.length / 2
    parsedPdfs.push({
      employeeCode: e.code,
      employeeName: `${e.firstName} ${e.lastName}`,
      payPeriodStart: weekStarts[0],
      payPeriodEnd: addDays(weekStarts[1], 6),
      entries: entries.slice(0, half),
      weeklyTotals: filterWeekly(weeklyTotals, weekStarts.slice(0, 2)),
      rawText: `Employee: ${e.firstName} ${e.lastName} ${e.code}`,
    })
    parsedPdfs.push({
      employeeCode: e.code,
      employeeName: `${e.firstName} ${e.lastName}`,
      payPeriodStart: weekStarts[2],
      payPeriodEnd: addDays(weekStarts[3], 6),
      entries: entries.slice(half),
      weeklyTotals: filterWeekly(weeklyTotals, weekStarts.slice(2, 4)),
      rawText: `Employee: ${e.firstName} ${e.lastName} ${e.code}`,
    })
  }

  return { employees, excelRows, parsedPdfs, periodLabel }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function filterWeekly(all: Record<string, number>, weeks: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const w of weeks) if (all[w] !== undefined) out[w] = all[w]
  return out
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

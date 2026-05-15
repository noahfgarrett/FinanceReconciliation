/**
 * Generate realistic Paycom test data:
 *  1. paycom-apr-2026.xlsx — Monthly Excel export with 35 employees
 *  2. pdfs/ folder — One timesheet PDF per employee (4 weeks)
 *  3. client-invoice-apr-2026.xlsx — Client's own hours log for reconcile comparison
 *
 * Includes deliberate conflicts & stress tests:
 *  - Hour mismatches between Excel and PDF
 *  - Missing employees in one source but not the other
 *  - Wrong allocation codes
 *  - OT discrepancies
 *  - Duplicate entries
 *  - Rounding differences
 *
 * Run: npx tsx test-data/generate.ts
 */

import ExcelJS from 'exceljs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const OUT_DIR = join(import.meta.dirname, 'output')
const PDF_DIR = join(OUT_DIR, 'pdfs')

/* ------------------------------------------------------------------ */
/*  Employee & Project definitions                                     */
/* ------------------------------------------------------------------ */

interface Employee {
  code: string
  firstName: string
  lastName: string
  project: string
  projectAlloc: string
  regularHrs: number
  otHrs: number
  dtHrs: number
  // Stress flags
  pdfHoursDelta?: number     // Hours mismatch between PDF and Excel
  missingFromPdf?: boolean   // Employee in Excel but not in PDFs
  missingFromExcel?: boolean // Employee in PDFs but not in Excel
  wrongAllocation?: string   // PDF uses different allocation than expected
  duplicateWeek?: boolean    // PDF has duplicate entries for a week
  roundingIssue?: boolean    // PDF hours have rounding differences
  extraOtInPdf?: number      // PDF shows more OT than Excel
  clientHoursDelta?: number  // Client invoice differs from our data
}

const PROJECTS: Record<string, { display: string; allocs: string[]; rate: number }> = {
  'fab52': {
    display: 'Fab 52 Buildout — Arizona',
    allocs: ['FAB52-MEP-001', 'FAB52-UTL-003', 'FAB52-ELC-002'],
    rate: 85,
  },
  'cardinal': {
    display: 'Project Cardinal — Intel Ohio Fab',
    allocs: ['CARDINAL-CX-002', 'CARDINAL-STR-001', 'CARDINAL-MEP-003'],
    rate: 95,
  },
  'ohio-dc': {
    display: 'Ohio Data Center I — New Albany',
    allocs: ['OH-DC1-CX-001', 'OH-DC1-MEP-002'],
    rate: 90,
  },
}

const WEEKS = [
  { start: '04/06/2026', end: '04/12/2026', isoStart: '2026-04-06' },
  { start: '04/13/2026', end: '04/19/2026', isoStart: '2026-04-13' },
  { start: '04/20/2026', end: '04/26/2026', isoStart: '2026-04-20' },
  { start: '04/27/2026', end: '05/03/2026', isoStart: '2026-04-27' },
]

/* ------------------------------------------------------------------ */
/*  Seeded PRNG & weekly hour distribution                             */
/* ------------------------------------------------------------------ */

/**
 * Simple mulberry32 PRNG — deterministic from a 32-bit seed.
 * Returns a function that yields floats in [0, 1) on each call.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return (): number => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface WeeklyBreakdown {
  regularHrs: number
  otHrs: number
  dtHrs: number
  /** Per-day regular hours for Mon-Sat (index 0=Mon, 5=Sat). Sunday always 0. */
  dailyRegHrs: number[]
  /** Per-day OT hours for the days that have OT. */
  dailyOtHrs: number[]
}

/**
 * Distribute an employee's monthly hours across 4 weeks with realistic variation.
 *
 * For normal employees (not stress-test): the monthly totals are treated as targets,
 * and each week gets a different slice so the sum still matches. Some weeks land above
 * 40 hrs (triggering OT), some below. Stress-test employees with specific hour totals
 * that encode deliberate conflicts keep the same uniform split to avoid masking those
 * conflicts.
 */
function distributeMonthlyHours(emp: Employee, empIndex: number): WeeklyBreakdown[] {
  const rng = mulberry32(empIndex * 7919 + 31337)
  const isStressTest = !!(
    emp.pdfHoursDelta ||
    emp.missingFromPdf ||
    emp.missingFromExcel ||
    emp.wrongAllocation ||
    emp.duplicateWeek ||
    emp.roundingIssue ||
    emp.extraOtInPdf ||
    emp.clientHoursDelta ||
    emp.dtHrs > 0
  )

  const weeks: WeeklyBreakdown[] = []

  if (isStressTest) {
    // Stress-test employees: uniform split to preserve deliberate conflicts
    for (let w = 0; w < 4; w++) {
      const weekReg = emp.regularHrs / 4
      const weekOt = emp.otHrs / 4
      const weekDt = emp.dtHrs / 4
      weeks.push({
        regularHrs: weekReg,
        otHrs: weekOt,
        dtHrs: weekDt,
        dailyRegHrs: buildDailyRegular(weekReg, rng),
        dailyOtHrs: buildDailyOt(weekOt, rng),
      })
    }
    return weeks
  }

  // ---- Non-stress employees: generate interesting week-to-week variation ----

  // Step 1: Generate raw weights for each week then scale to hit the monthly total.
  // Weights are biased so some weeks are heavier than others.
  const rawWeights = Array.from({ length: 4 }, () => 0.7 + rng() * 0.6) // 0.7 - 1.3
  const weightSum = rawWeights.reduce((a, b) => a + b, 0)

  // Step 2: Distribute regular hours across weeks.
  let remainingMonthlyOt = emp.otHrs
  const weeklyRegRaw = rawWeights.map(w => +(emp.regularHrs * w / weightSum).toFixed(1))

  // Fix rounding so monthly total is exact
  const regSum = weeklyRegRaw.reduce((a, b) => a + b, 0)
  weeklyRegRaw[3] = +(weeklyRegRaw[3] + (emp.regularHrs - regSum)).toFixed(1)

  for (let w = 0; w < 4; w++) {
    let weekReg = weeklyRegRaw[w]
    let weekOt = 0

    // If this employee has monthly OT, distribute it unevenly across weeks
    if (emp.otHrs > 0) {
      // Heavier weeks get more OT
      if (w < 3) {
        const otShare = +(emp.otHrs * rawWeights[w] / weightSum).toFixed(1)
        weekOt = Math.min(otShare, remainingMonthlyOt)
        remainingMonthlyOt = +(remainingMonthlyOt - weekOt).toFixed(1)
      } else {
        // Last week gets whatever OT remains
        weekOt = +remainingMonthlyOt.toFixed(1)
      }
    }

    // Clamp: regular hours for a week shouldn't exceed 60 or go below 20
    // (unless the employee is part-time with low monthly totals)
    const minWeekly = Math.min(20, emp.regularHrs / 4)
    weekReg = Math.max(minWeekly, Math.min(60, weekReg))

    weeks.push({
      regularHrs: +weekReg.toFixed(1),
      otHrs: +weekOt.toFixed(1),
      dtHrs: 0,
      dailyRegHrs: buildDailyRegular(weekReg, rng),
      dailyOtHrs: buildDailyOt(weekOt, rng),
    })
  }

  // Final fixup: ensure monthly totals are exact
  const actualRegTotal = weeks.reduce((s, w) => s + w.regularHrs, 0)
  const regDiff = +(emp.regularHrs - actualRegTotal).toFixed(1)
  if (Math.abs(regDiff) > 0.05) {
    weeks[3].regularHrs = +(weeks[3].regularHrs + regDiff).toFixed(1)
    weeks[3].dailyRegHrs = buildDailyRegular(weeks[3].regularHrs, rng)
  }

  const actualOtTotal = weeks.reduce((s, w) => s + w.otHrs, 0)
  const otDiff = +(emp.otHrs - actualOtTotal).toFixed(1)
  if (Math.abs(otDiff) > 0.05) {
    weeks[3].otHrs = +(weeks[3].otHrs + otDiff).toFixed(1)
    weeks[3].dailyOtHrs = buildDailyOt(weeks[3].otHrs, rng)
  }

  return weeks
}

/**
 * Build realistic daily regular-hour breakdown for a week.
 * Weekdays get 7-10 hrs, Saturday gets 0-4 hrs if needed to hit the target.
 */
function buildDailyRegular(weekTotal: number, rng: () => number): number[] {
  if (weekTotal <= 0) return [0, 0, 0, 0, 0, 0]

  const daily: number[] = []
  let remaining = weekTotal

  // Weekdays (Mon-Fri): each gets a share of the total
  const weekdayTarget = Math.min(remaining, weekTotal * (rng() * 0.05 + 0.95)) // 95-100% on weekdays
  for (let d = 0; d < 5; d++) {
    if (d < 4) {
      // Vary each day: base of weekTotal/5, jittered ±1.5 hrs
      const base = weekdayTarget / 5
      const jitter = (rng() - 0.5) * 3
      const hrs = Math.max(0, Math.min(12, base + jitter))
      daily.push(+hrs.toFixed(1))
      remaining = +(remaining - daily[d]).toFixed(1)
    } else {
      // Friday gets whatever is left for the weekday portion
      const fri = Math.max(0, Math.min(12, remaining))
      daily.push(+fri.toFixed(1))
      remaining = +(remaining - daily[4]).toFixed(1)
    }
  }

  // Saturday: absorb any leftover (capped at 6 hrs)
  const sat = Math.max(0, Math.min(6, remaining))
  daily.push(+sat.toFixed(1))

  return daily
}

/**
 * Build daily OT breakdown for a week. OT spreads across 1-3 days.
 */
function buildDailyOt(weekOt: number, rng: () => number): number[] {
  if (weekOt <= 0) return []

  const otDays = Math.min(Math.max(1, Math.ceil(weekOt / 4)), 5)
  const daily: number[] = []
  let remaining = weekOt

  for (let d = 0; d < otDays; d++) {
    if (d < otDays - 1) {
      const share = +(remaining / (otDays - d) + (rng() - 0.5) * 2).toFixed(1)
      const hrs = Math.max(1, Math.min(remaining - (otDays - d - 1), share))
      daily.push(+hrs.toFixed(1))
      remaining = +(remaining - daily[d]).toFixed(1)
    } else {
      daily.push(+Math.max(0, remaining).toFixed(1))
    }
  }

  return daily
}

/**
 * Pre-computed weekly breakdowns for every employee. Keyed by employee code.
 * Populated once in main() before any generators run, so PDF and client invoice
 * generators use the same per-week numbers.
 */
const WEEKLY_DATA: Record<string, WeeklyBreakdown[]> = {}

const EMPLOYEES: Employee[] = [
  // --- Normal employees (no conflicts) ---
  { code: '2000', firstName: 'Noah', lastName: 'Garrett', project: 'fab52', projectAlloc: 'FAB52-MEP-001', regularHrs: 160, otHrs: 24, dtHrs: 0 },
  { code: '2001', firstName: 'Sarah', lastName: 'Mitchell', project: 'cardinal', projectAlloc: 'CARDINAL-CX-002', regularHrs: 160, otHrs: 16, dtHrs: 0 },
  { code: '2002', firstName: 'James', lastName: 'Rodriguez', project: 'ohio-dc', projectAlloc: 'OH-DC1-CX-001', regularHrs: 152, otHrs: 0, dtHrs: 0 },
  { code: '2003', firstName: 'Emily', lastName: 'Chen', project: 'fab52', projectAlloc: 'FAB52-ELC-002', regularHrs: 160, otHrs: 8, dtHrs: 0 },
  { code: '2004', firstName: 'Michael', lastName: 'O\'Brien', project: 'cardinal', projectAlloc: 'CARDINAL-STR-001', regularHrs: 160, otHrs: 0, dtHrs: 0 },
  { code: '2005', firstName: 'Jessica', lastName: 'Patel', project: 'fab52', projectAlloc: 'FAB52-UTL-003', regularHrs: 160, otHrs: 12, dtHrs: 0 },
  { code: '2006', firstName: 'David', lastName: 'Thompson', project: 'ohio-dc', projectAlloc: 'OH-DC1-MEP-002', regularHrs: 160, otHrs: 4, dtHrs: 0 },
  { code: '2007', firstName: 'Ashley', lastName: 'Nguyen', project: 'cardinal', projectAlloc: 'CARDINAL-MEP-003', regularHrs: 160, otHrs: 20, dtHrs: 0 },
  { code: '2008', firstName: 'Christopher', lastName: 'Walker', project: 'fab52', projectAlloc: 'FAB52-MEP-001', regularHrs: 148, otHrs: 0, dtHrs: 0 },
  { code: '2009', firstName: 'Amanda', lastName: 'Foster', project: 'ohio-dc', projectAlloc: 'OH-DC1-CX-001', regularHrs: 160, otHrs: 8, dtHrs: 0 },
  { code: '2010', firstName: 'Daniel', lastName: 'Kim', project: 'fab52', projectAlloc: 'FAB52-ELC-002', regularHrs: 160, otHrs: 0, dtHrs: 0 },
  { code: '2011', firstName: 'Rachel', lastName: 'Lopez', project: 'cardinal', projectAlloc: 'CARDINAL-CX-002', regularHrs: 160, otHrs: 6, dtHrs: 0 },
  { code: '2012', firstName: 'Kevin', lastName: 'Wright', project: 'ohio-dc', projectAlloc: 'OH-DC1-MEP-002', regularHrs: 160, otHrs: 0, dtHrs: 0 },
  { code: '2013', firstName: 'Stephanie', lastName: 'Adams', project: 'fab52', projectAlloc: 'FAB52-UTL-003', regularHrs: 160, otHrs: 10, dtHrs: 0 },
  { code: '2014', firstName: 'Brian', lastName: 'Carter', project: 'cardinal', projectAlloc: 'CARDINAL-STR-001', regularHrs: 160, otHrs: 0, dtHrs: 0 },
  { code: '2015', firstName: 'Lauren', lastName: 'Hernandez', project: 'fab52', projectAlloc: 'FAB52-MEP-001', regularHrs: 160, otHrs: 14, dtHrs: 0 },
  { code: '2016', firstName: 'Jason', lastName: 'Scott', project: 'ohio-dc', projectAlloc: 'OH-DC1-CX-001', regularHrs: 160, otHrs: 0, dtHrs: 0 },
  { code: '2017', firstName: 'Megan', lastName: 'Turner', project: 'cardinal', projectAlloc: 'CARDINAL-MEP-003', regularHrs: 160, otHrs: 8, dtHrs: 0 },
  { code: '2018', firstName: 'Tyler', lastName: 'Phillips', project: 'fab52', projectAlloc: 'FAB52-ELC-002', regularHrs: 160, otHrs: 0, dtHrs: 0 },
  { code: '2019', firstName: 'Courtney', lastName: 'Campbell', project: 'ohio-dc', projectAlloc: 'OH-DC1-MEP-002', regularHrs: 160, otHrs: 4, dtHrs: 0 },

  // --- Stress-test employees (with deliberate conflicts) ---

  // S1: PDF shows 8 MORE hours than Excel (billing discrepancy)
  { code: '2020', firstName: 'Marcus', lastName: 'Johnson', project: 'fab52', projectAlloc: 'FAB52-MEP-001', regularHrs: 160, otHrs: 20, dtHrs: 0, pdfHoursDelta: 8 },

  // S2: Employee in Excel but PDF is MISSING
  { code: '2021', firstName: 'Patricia', lastName: 'Davis', project: 'cardinal', projectAlloc: 'CARDINAL-CX-002', regularHrs: 160, otHrs: 0, dtHrs: 0, missingFromPdf: true },

  // S3: PDF uses WRONG allocation code (should flag unresolved)
  { code: '2022', firstName: 'Robert', lastName: 'Wilson', project: 'fab52', projectAlloc: 'FAB52-UTL-003', regularHrs: 160, otHrs: 12, dtHrs: 0, wrongAllocation: 'UNKNOWN-PRJ-999' },

  // S4: PDF has DUPLICATE entries for week 2 (double-counted hours)
  { code: '2023', firstName: 'Jennifer', lastName: 'Martinez', project: 'cardinal', projectAlloc: 'CARDINAL-STR-001', regularHrs: 160, otHrs: 0, dtHrs: 0, duplicateWeek: true },

  // S5: Rounding mismatch — PDF has 40.25 hrs but Excel has 40
  { code: '2024', firstName: 'William', lastName: 'Anderson', project: 'ohio-dc', projectAlloc: 'OH-DC1-CX-001', regularHrs: 160, otHrs: 0, dtHrs: 0, roundingIssue: true },

  // S6: PDF shows 16 hrs OT that Excel doesn't have
  { code: '2025', firstName: 'Elizabeth', lastName: 'Taylor', project: 'fab52', projectAlloc: 'FAB52-ELC-002', regularHrs: 160, otHrs: 0, dtHrs: 0, extraOtInPdf: 16 },

  // S7: Massive OT — 60 hrs OT in a month (should trigger high-OT flag)
  { code: '2026', firstName: 'Carlos', lastName: 'Ramirez', project: 'cardinal', projectAlloc: 'CARDINAL-CX-002', regularHrs: 160, otHrs: 60, dtHrs: 0 },

  // S8: Double time employee
  { code: '2027', firstName: 'Sandra', lastName: 'Thomas', project: 'fab52', projectAlloc: 'FAB52-MEP-001', regularHrs: 160, otHrs: 24, dtHrs: 16 },

  // S9: Part-time (only 80 hrs/month)
  { code: '2028', firstName: 'Anthony', lastName: 'Jackson', project: 'ohio-dc', projectAlloc: 'OH-DC1-MEP-002', regularHrs: 80, otHrs: 0, dtHrs: 0 },

  // S10: Low hours on a billable project
  { code: '2029', firstName: 'Lisa', lastName: 'White', project: 'cardinal', projectAlloc: 'CARDINAL-CX-002', regularHrs: 120, otHrs: 0, dtHrs: 0 },

  // S11: Part-time on a billable project
  { code: '2030', firstName: 'Mark', lastName: 'Harris', project: 'ohio-dc', projectAlloc: 'OH-DC1-CX-001', regularHrs: 80, otHrs: 0, dtHrs: 0 },

  // S12: Client shows FEWER hours than we have (client dispute scenario)
  { code: '2031', firstName: 'Karen', lastName: 'Clark', project: 'fab52', projectAlloc: 'FAB52-UTL-003', regularHrs: 160, otHrs: 8, dtHrs: 0, clientHoursDelta: -16 },

  // S13: Client shows MORE hours than we have (they're expecting more work)
  { code: '2032', firstName: 'Steven', lastName: 'Lewis', project: 'cardinal', projectAlloc: 'CARDINAL-MEP-003', regularHrs: 160, otHrs: 0, dtHrs: 0, clientHoursDelta: 8 },

  // S14: Employee in PDF but NOT in Excel (ghost employee)
  { code: '2033', firstName: 'Nicole', lastName: 'Robinson', project: 'fab52', projectAlloc: 'FAB52-MEP-001', regularHrs: 160, otHrs: 0, dtHrs: 0, missingFromExcel: true },

  // S15: Multiple conflicts — wrong alloc + hour mismatch + extra OT
  { code: '2034', firstName: 'Gregory', lastName: 'Hall', project: 'ohio-dc', projectAlloc: 'OH-DC1-CX-001', regularHrs: 160, otHrs: 8, dtHrs: 0, wrongAllocation: 'BOGUS-XYZ-123', pdfHoursDelta: -4, extraOtInPdf: 12 },
]

/* ------------------------------------------------------------------ */
/*  Excel Generator                                                    */
/* ------------------------------------------------------------------ */

async function generatePaycomExcel(): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Hours Summary')

  ws.columns = [
    { header: 'Employee Code', key: 'empCode', width: 15 },
    { header: 'Legal First Name', key: 'firstName', width: 18 },
    { header: 'Legal Last Name', key: 'lastName', width: 18 },
    { header: 'Regular Hours', key: 'regHrs', width: 14 },
    { header: 'Overtime Hours', key: 'otHrs', width: 14 },
    { header: 'Double Time Hours', key: 'dtHrs', width: 16 },
    { header: 'Date (Updated)', key: 'dateUpdated', width: 14 },
    { header: 'WWID', key: 'wwid', width: 12 },
    { header: 'Labor Allocation Details', key: 'allocDetails', width: 40 },
    { header: 'Project Name Desc-Delete', key: 'projectName', width: 35 },
  ]

  // Style header row
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }

  for (const emp of EMPLOYEES) {
    if (emp.missingFromExcel) continue

    const proj = PROJECTS[emp.project]

    ws.addRow({
      empCode: emp.code,
      firstName: emp.firstName,
      lastName: emp.lastName,
      regHrs: emp.regularHrs,
      otHrs: emp.otHrs,
      dtHrs: emp.dtHrs,
      dateUpdated: '05/02/2026',
      wwid: `W00${emp.code}`,
      allocDetails: emp.projectAlloc,
      projectName: proj.display,
    })
  }

  const outPath = join(OUT_DIR, 'paycom-apr-2026.xlsx')
  await wb.xlsx.writeFile(outPath)
  console.log(`  Excel: ${outPath} (${EMPLOYEES.filter(e => !e.missingFromExcel).length} employees)`)
}

/* ------------------------------------------------------------------ */
/*  PDF Generator                                                      */
/* ------------------------------------------------------------------ */

function addDays(mmddyyyy: string, days: number): string {
  const [mm, dd, yyyy] = mmddyyyy.split('/')
  const d = new Date(Date.UTC(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd)))
  d.setUTCDate(d.getUTCDate() + days)
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${m}/${day}/${d.getUTCFullYear()}`
}

const COLS = {
  date: 40,
  payCode: 115,
  inTime: 155,
  outTime: 200,
  allocation: 250,
  taxProfile: 350,
  comments: 420,
  dollars: 480,
  totalHrs: 545,
} as const

async function generatePdf(emp: Employee): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const proj = PROJECTS[emp.project]
  const rate = proj.rate

  let page = doc.addPage([612, 792])
  let y = 750

  const drawText = (text: string, x: number, yPos: number, size = 8, f = font) => {
    page.drawText(text, { x, y: yPos, size, font: f, color: rgb(0, 0, 0) })
  }

  // Header
  drawText(`Employee: ${emp.firstName} ${emp.lastName} ${emp.code}`, 40, y, 11, fontBold)
  y -= 20

  for (const week of WEEKS) {
    if (y < 120) {
      page = doc.addPage([612, 792])
      y = 750
    }

    drawText(`Period: ${week.start} - ${week.end}`, 40, y, 9, fontBold)
    y -= 16

    // Column headers
    drawText('Date', COLS.date, y, 7, fontBold)
    drawText('Pay Code', COLS.payCode, y, 7, fontBold)
    drawText('IN', COLS.inTime, y, 7, fontBold)
    drawText('OUT', COLS.outTime, y, 7, fontBold)
    drawText('Allocation', COLS.allocation, y, 7, fontBold)
    drawText('Tax Profile', COLS.taxProfile, y, 7, fontBold)
    drawText('$', COLS.dollars, y, 7, fontBold)
    drawText('Total Hrs', COLS.totalHrs, y, 7, fontBold)
    y -= 4

    page.drawLine({ start: { x: 35, y }, end: { x: 580, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) })
    y -= 12

    const weekIdx = WEEKS.indexOf(week)
    const wb = WEEKLY_DATA[emp.code][weekIdx]

    // Compute actual PDF hours (with deltas for stress tests)
    let pdfRegHrs = wb.regularHrs
    if (emp.pdfHoursDelta) pdfRegHrs += emp.pdfHoursDelta / 4
    if (emp.roundingIssue) pdfRegHrs += 0.25

    let pdfOtHrs = wb.otHrs
    if (emp.extraOtInPdf) pdfOtHrs += emp.extraOtInPdf / 4

    const alloc = emp.wrongAllocation ?? emp.projectAlloc

    // Regular entries — use daily breakdown for realistic per-day variation
    const regDaily = wb.dailyRegHrs
    for (let d = 0; d < regDaily.length; d++) {
      let hrs = regDaily[d]
      if (hrs <= 0) continue

      // Apply stress-test delta proportionally across days
      if (emp.pdfHoursDelta || emp.roundingIssue) {
        const ratio = pdfRegHrs / wb.regularHrs
        hrs = +(hrs * ratio).toFixed(2)
      }

      const dateStr = addDays(week.start, d)
      const dollars = rate > 0 ? `$${(hrs * rate).toFixed(2)}` : '$0.00'

      drawText(dateStr, COLS.date, y, 8)
      drawText('REG', COLS.payCode, y, 8)
      drawText('07:00', COLS.inTime, y, 8)
      drawText('15:30', COLS.outTime, y, 8)
      drawText(alloc, COLS.allocation, y, 8)
      drawText('OH-NRES', COLS.taxProfile, y, 8)
      drawText(dollars, COLS.dollars, y, 8)
      drawText(hrs.toFixed(1), COLS.totalHrs, y, 8)
      y -= 12
    }

    // OT entries — use daily OT breakdown
    if (pdfOtHrs > 0) {
      const otDaily = wb.dailyOtHrs
      for (let d = 0; d < otDaily.length; d++) {
        let hrs = otDaily[d]
        if (hrs <= 0) continue

        // Apply stress-test OT delta proportionally
        if (emp.extraOtInPdf && wb.otHrs > 0) {
          const ratio = pdfOtHrs / wb.otHrs
          hrs = +(hrs * ratio).toFixed(2)
        } else if (emp.extraOtInPdf && wb.otHrs === 0) {
          // Employee has no base OT — extra OT is purely from the stress test
          hrs = +(pdfOtHrs / Math.max(1, otDaily.length)).toFixed(2)
        }

        const dateNum = parseInt(week.start.split('/')[1]) + d
        const month = week.start.split('/')[0]
        const dateStr = `${month}/${String(dateNum).padStart(2, '0')}/2026`
        const dollars = rate > 0 ? `$${(hrs * rate * 1.5).toFixed(2)}` : '$0.00'

        drawText(dateStr, COLS.date, y, 8)
        drawText('OT', COLS.payCode, y, 8)
        drawText('15:30', COLS.inTime, y, 8)
        drawText('19:30', COLS.outTime, y, 8)
        drawText(alloc, COLS.allocation, y, 8)
        drawText('OH-NRES', COLS.taxProfile, y, 8)
        drawText(dollars, COLS.dollars, y, 8)
        drawText(hrs.toFixed(1), COLS.totalHrs, y, 8)
        y -= 12
      }

      // If base OT was 0 but stress test adds OT, and dailyOtHrs is empty,
      // add the extra OT as a single entry
      if (otDaily.length === 0 && pdfOtHrs > 0) {
        const dateStr = addDays(week.start, 0)
        const dollars = rate > 0 ? `$${(pdfOtHrs * rate * 1.5).toFixed(2)}` : '$0.00'
        drawText(dateStr, COLS.date, y, 8)
        drawText('OT', COLS.payCode, y, 8)
        drawText('15:30', COLS.inTime, y, 8)
        drawText('19:30', COLS.outTime, y, 8)
        drawText(alloc, COLS.allocation, y, 8)
        drawText('OH-NRES', COLS.taxProfile, y, 8)
        drawText(dollars, COLS.dollars, y, 8)
        drawText(pdfOtHrs.toFixed(1), COLS.totalHrs, y, 8)
        y -= 12
      }
    }

    // DT entries
    if (wb.dtHrs > 0) {
      const dateStr = addDays(week.start, 6)
      const dollars = rate > 0 ? `$${(wb.dtHrs * rate * 2).toFixed(2)}` : '$0.00'
      drawText(dateStr, COLS.date, y, 8)
      drawText('DT', COLS.payCode, y, 8)
      drawText('06:00', COLS.inTime, y, 8)
      drawText('10:00', COLS.outTime, y, 8)
      drawText(alloc, COLS.allocation, y, 8)
      drawText('OH-NRES', COLS.taxProfile, y, 8)
      drawText(dollars, COLS.dollars, y, 8)
      drawText(wb.dtHrs.toFixed(1), COLS.totalHrs, y, 8)
      y -= 12
    }

    // Duplicate week entries (stress test S4)
    if (emp.duplicateWeek && weekIdx === 1) {
      y -= 4
      drawText('--- DUPLICATE SUBMISSION ---', 40, y, 7)
      y -= 12
      for (let d = 0; d < 5; d++) {
        const dateNum = parseInt(week.start.split('/')[1]) + d
        const month = week.start.split('/')[0]
        const dateStr = `${month}/${String(dateNum).padStart(2, '0')}/2026`
        const dollars = rate > 0 ? `$${(8 * rate).toFixed(2)}` : '$0.00'
        drawText(dateStr, COLS.date, y, 8)
        drawText('REG', COLS.payCode, y, 8)
        drawText('07:00', COLS.inTime, y, 8)
        drawText('15:30', COLS.outTime, y, 8)
        drawText(alloc, COLS.allocation, y, 8)
        drawText('OH-NRES', COLS.taxProfile, y, 8)
        drawText(dollars, COLS.dollars, y, 8)
        drawText('8.0', COLS.totalHrs, y, 8)
        y -= 12
      }
    }

    // Weekly total
    const totalHrs = pdfRegHrs + pdfOtHrs + wb.dtHrs
      + (emp.duplicateWeek && weekIdx === 1 ? 40 : 0)
    const totalDollars = rate > 0
      ? pdfRegHrs * rate + pdfOtHrs * rate * 1.5 + wb.dtHrs * rate * 2
        + (emp.duplicateWeek && weekIdx === 1 ? 40 * rate : 0)
      : 0

    y -= 4
    page.drawLine({ start: { x: 35, y: y + 8 }, end: { x: 580, y: y + 8 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) })
    drawText('Weekly Total:', COLS.date, y, 8, fontBold)
    drawText(`$${totalDollars.toFixed(2)}`, COLS.dollars, y, 8, fontBold)
    drawText(totalHrs.toFixed(1), COLS.totalHrs, y, 8, fontBold)
    y -= 24
  }

  return doc.save()
}

async function generateAllPdfs(): Promise<void> {
  let count = 0
  for (const emp of EMPLOYEES) {
    if (emp.missingFromPdf) continue
    const bytes = await generatePdf(emp)
    const fileName = `${emp.lastName}_${emp.firstName}_${emp.code}.pdf`
    writeFileSync(join(PDF_DIR, fileName), bytes)
    count++
  }
  console.log(`  PDFs:  ${PDF_DIR} (${count} files)`)
}

/* ------------------------------------------------------------------ */
/*  Client Invoice Excel Generator                                     */
/* ------------------------------------------------------------------ */

async function generateClientInvoice(): Promise<void> {
  const wb = new ExcelJS.Workbook()

  // One sheet per billable project
  for (const [key, proj] of Object.entries(PROJECTS)) {
    if (proj.rate === 0) continue

    const ws = wb.addWorksheet(proj.display.split('—')[0].trim())
    ws.columns = [
      { header: 'Employee Code', key: 'empCode', width: 15 },
      { header: 'Employee Name', key: 'empName', width: 22 },
      { header: 'Week Starting', key: 'weekStart', width: 14 },
      { header: 'Regular Hours', key: 'regHrs', width: 14 },
      { header: 'OT Hours', key: 'otHrs', width: 12 },
      { header: 'Total Hours', key: 'totalHrs', width: 12 },
      { header: 'Notes', key: 'notes', width: 30 },
    ]

    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }

    const projEmployees = EMPLOYEES.filter(e => e.project === key && !e.missingFromExcel)

    for (const emp of projEmployees) {
      for (let wi = 0; wi < WEEKS.length; wi++) {
        const week = WEEKS[wi]
        const weekData = WEEKLY_DATA[emp.code][wi]

        let clientReg = weekData.regularHrs
        let clientOt = weekData.otHrs
        let note = ''

        // Apply client-side deltas
        if (emp.clientHoursDelta) {
          clientReg += emp.clientHoursDelta / 4
          note = emp.clientHoursDelta < 0
            ? 'Client disputes — fewer hours on-site'
            : 'Client records extra hours worked'
        }

        // Randomly introduce small discrepancies for realism
        if (emp.code === '2001' && week === WEEKS[2]) {
          clientReg -= 2
          note = 'Partial day — employee left early per site log'
        }
        if (emp.code === '2007' && week === WEEKS[0]) {
          clientOt += 4
          note = 'Client records additional OT Saturday'
        }

        ws.addRow({
          empCode: emp.code,
          empName: `${emp.firstName} ${emp.lastName}`,
          weekStart: week.isoStart,
          regHrs: clientReg,
          otHrs: clientOt,
          totalHrs: clientReg + clientOt,
          notes: note,
        })
      }
    }
  }

  const outPath = join(OUT_DIR, 'client-invoice-apr-2026.xlsx')
  await wb.xlsx.writeFile(outPath)
  console.log(`  Client invoice: ${outPath}`)
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  if (!existsSync(PDF_DIR)) mkdirSync(PDF_DIR, { recursive: true })

  console.log('Generating test data...\n')

  // Pre-compute weekly hour distributions for all employees (seeded, deterministic)
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const emp = EMPLOYEES[i]
    WEEKLY_DATA[emp.code] = distributeMonthlyHours(emp, i)
  }

  // Log a sample to show variation
  console.log('  Weekly hour variation (sample — first 5 non-stress employees):')
  for (let i = 0; i < 5; i++) {
    const emp = EMPLOYEES[i]
    const weeks = WEEKLY_DATA[emp.code]
    const weekStr = weeks
      .map((w, wi) => `W${wi + 1}: ${w.regularHrs}r/${w.otHrs}ot`)
      .join('  ')
    console.log(`    ${emp.firstName} ${emp.lastName}: ${weekStr}`)
  }
  console.log()

  await generatePaycomExcel()
  await generateAllPdfs()
  await generateClientInvoice()

  console.log('\nStress test scenarios:')
  console.log('  S1  (2020 Marcus Johnson)    — PDF has 8 more regular hours than Excel')
  console.log('  S2  (2021 Patricia Davis)    — Employee in Excel but MISSING from PDFs')
  console.log('  S3  (2022 Robert Wilson)     — PDF uses wrong allocation code UNKNOWN-PRJ-999')
  console.log('  S4  (2023 Jennifer Martinez) — PDF has duplicate entries for week 2')
  console.log('  S5  (2024 William Anderson)  — PDF hours have 0.25hr rounding mismatch')
  console.log('  S6  (2025 Elizabeth Taylor)  — PDF shows 16hrs OT that Excel doesn\'t report')
  console.log('  S7  (2026 Carlos Ramirez)    — 60hrs OT in a month (extreme OT flag)')
  console.log('  S8  (2027 Sandra Thomas)     — Has double-time hours (16hrs DT)')
  console.log('  S9  (2028 Anthony Jackson)   — Part-time employee (80hrs/month)')
  console.log('  S10 (2029 Lisa White)        — Admin-only, non-billable ($0 rate)')
  console.log('  S11 (2030 Mark Harris)       — Training-only, non-billable')
  console.log('  S12 (2031 Karen Clark)       — Client invoice shows 16 FEWER hours than ours')
  console.log('  S13 (2032 Steven Lewis)      — Client invoice shows 8 MORE hours than ours')
  console.log('  S14 (2033 Nicole Robinson)   — In PDFs but NOT in Excel (ghost employee)')
  console.log('  S15 (2034 Gregory Hall)      — Triple conflict: wrong alloc + hour delta + extra OT')

  console.log('\nDone! Import paycom-apr-2026.xlsx + pdfs/ folder into the Reconciler.')
  console.log('Then use client-invoice-apr-2026.xlsx for the Reconcile comparison feature.')
}

void main()

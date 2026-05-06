import ExcelJS from 'exceljs'
import type { Snapshot, ProjectConfig } from '@/persistence/schemas'

export interface WorkbookOptions {
  snapshot: Snapshot
  configs: Record<string, ProjectConfig>
}

const ORANGE_HEX = 'FFF47B20' // LotusWorks brand orange
const WHITE_HEX = 'FFFFFFFF'
const SLATE_100_HEX = 'FFF1F5F9'
const SLATE_700_HEX = 'FF334155'
const CALIBRI = 'Calibri'

function setHeaderStyle(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { name: CALIBRI, size: 11, bold: true, color: { argb: WHITE_HEX } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_HEX } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }
  })
  row.height = 18
}

function setBodyStyle(row: ExcelJS.Row, isAlt: boolean): void {
  row.eachCell((cell) => {
    cell.font = { name: CALIBRI, size: 11, color: { argb: SLATE_700_HEX } }
    if (isAlt) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_100_HEX } }
    }
  })
  row.height = 16
}

function rightAlignNumbers(row: ExcelJS.Row, numberColIndices: number[]): void {
  for (const idx of numberColIndices) {
    const cell = row.getCell(idx)
    cell.alignment = { horizontal: 'right', vertical: 'middle' }
  }
}

function applyDollarFormat(row: ExcelJS.Row, indices: number[]): void {
  for (const idx of indices) {
    row.getCell(idx).numFmt = '"$"#,##0.00'
  }
}

function applyHrsFormat(row: ExcelJS.Row, indices: number[]): void {
  for (const idx of indices) {
    row.getCell(idx).numFmt = '#,##0.00'
  }
}

export async function generateWorkbook(opts: WorkbookOptions): Promise<Uint8Array> {
  const { snapshot, configs } = opts
  const workbook = new ExcelJS.Workbook()

  workbook.creator = 'LotusWorks'
  workbook.lastModifiedBy = 'LotusWorks Reconciler'
  workbook.created = new Date()
  workbook.modified = new Date()

  // Embed logo
  let logoImageId: number | null = null
  try {
    const logoBuf = await fetch('/lotusworks-logo.png').then((r) => r.arrayBuffer())
    logoImageId = workbook.addImage({
      buffer: logoBuf as Buffer,
      extension: 'png',
    })
  } catch {
    // Logo unavailable — continue without it
    logoImageId = null
  }

  // Collect per-project aggregates
  type ProjectAgg = {
    regHrs: number
    otHrs: number
    dtHrs: number
    regDollars: number
    otDollars: number
    dtDollars: number
    total: number
    displayName: string
  }

  const projectAggs = new Map<string, ProjectAgg>()

  for (const row of snapshot.weeklyBilling) {
    const cfg = configs[row.projectKey]
    const existing = projectAggs.get(row.projectKey) ?? {
      regHrs: 0,
      otHrs: 0,
      dtHrs: 0,
      regDollars: 0,
      otDollars: 0,
      dtDollars: 0,
      total: 0,
      displayName: cfg?.displayName ?? row.projectKey,
    }
    existing.regHrs += row.regularHrs
    existing.otHrs += row.otHrs
    existing.dtHrs += row.dtHrs
    existing.regDollars += row.regularDollars
    existing.otDollars += row.otDollars
    existing.dtDollars += row.dtDollars
    existing.total += row.regularDollars + row.otDollars + row.dtDollars
    projectAggs.set(row.projectKey, existing)
  }

  const totalRegDollars = snapshot.weeklyBilling.reduce((s, r) => s + r.regularDollars, 0)
  const totalOtDollars = snapshot.weeklyBilling.reduce((s, r) => s + r.otDollars, 0)
  const totalDtDollars = snapshot.weeklyBilling.reduce((s, r) => s + r.dtDollars, 0)
  const totalBillable = totalRegDollars + totalOtDollars + totalDtDollars

  // ─── Summary Tab ──────────────────────────────────────────────────────────
  const summary = workbook.addWorksheet('Summary', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })

  summary.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

  // Logo area — reserve rows 1-3
  if (logoImageId !== null) {
    summary.addImage(logoImageId, 'A1:B3')
  }

  // Title row
  summary.getRow(1).height = 30
  const titleCell = summary.getCell('C1')
  titleCell.value = 'LotusWorks — Finance Reconciliation Report'
  titleCell.font = { name: CALIBRI, size: 16, bold: true, color: { argb: SLATE_700_HEX } }
  titleCell.alignment = { vertical: 'middle' }

  const subtitleCell = summary.getCell('C2')
  subtitleCell.value = `Period: ${snapshot.periodLabel}`
  subtitleCell.font = { name: CALIBRI, size: 11, color: { argb: 'FF64748B' } }

  const generatedCell = summary.getCell('C3')
  generatedCell.value = `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
  generatedCell.font = { name: CALIBRI, size: 10, color: { argb: 'FF94A3B8' } }

  // KPI block (row 5-9)
  const kpiStartRow = 5
  const kpiData: Array<[string, number]> = [
    ['Total Billable', totalBillable],
    ['Regular', totalRegDollars],
    ['Overtime', totalOtDollars],
    ['Double Time', totalDtDollars],
  ]

  for (let i = 0; i < kpiData.length; i++) {
    const [label, value] = kpiData[i]
    const r = summary.getRow(kpiStartRow + i)
    r.getCell(1).value = label
    r.getCell(1).font = { name: CALIBRI, size: 11, bold: true, color: { argb: SLATE_700_HEX } }
    r.getCell(2).value = value
    r.getCell(2).numFmt = '"$"#,##0.00'
    r.getCell(2).font = { name: CALIBRI, size: 11, color: { argb: SLATE_700_HEX } }
    r.getCell(2).alignment = { horizontal: 'right' }
    r.height = 16
  }

  // Project summary table starting at row 11
  const projHeaderRow = summary.getRow(11)
  projHeaderRow.values = ['', 'Project', 'Reg Hrs', 'OT Hrs', 'DT Hrs', 'Reg $', 'OT $', 'DT $', 'Total']
  setHeaderStyle(projHeaderRow)
  projHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_HEX } }

  summary.columns = [
    { key: 'empty', width: 3 },
    { key: 'project', width: 30 },
    { key: 'regHrs', width: 10 },
    { key: 'otHrs', width: 10 },
    { key: 'dtHrs', width: 10 },
    { key: 'regDollars', width: 14 },
    { key: 'otDollars', width: 14 },
    { key: 'dtDollars', width: 14 },
    { key: 'total', width: 16 },
  ]

  let projRowNum = 12
  let altRow = false
  for (const [, agg] of projectAggs.entries()) {
    const r = summary.getRow(projRowNum)
    r.values = ['', agg.displayName, agg.regHrs, agg.otHrs, agg.dtHrs, agg.regDollars, agg.otDollars, agg.dtDollars, agg.total]
    setBodyStyle(r, altRow)
    applyHrsFormat(r, [3, 4, 5])
    applyDollarFormat(r, [6, 7, 8, 9])
    rightAlignNumbers(r, [3, 4, 5, 6, 7, 8, 9])
    altRow = !altRow
    projRowNum++
  }

  // Totals row
  const totRow = summary.getRow(projRowNum)
  totRow.values = ['', 'TOTAL', null, null, null, totalRegDollars, totalOtDollars, totalDtDollars, totalBillable]
  totRow.eachCell((cell) => {
    cell.font = { name: CALIBRI, size: 11, bold: true, color: { argb: WHITE_HEX } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_HEX } }
  })
  applyDollarFormat(totRow, [6, 7, 8, 9])
  rightAlignNumbers(totRow, [6, 7, 8, 9])
  totRow.height = 18

  // ─── Per-Project Tabs ──────────────────────────────────────────────────────
  for (const [projectKey, agg] of projectAggs.entries()) {
    const sheetName = (agg.displayName || projectKey).slice(0, 31).replace(/[\\/*?:[\]]/g, '-')
    const ws = workbook.addWorksheet(sheetName)

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

    // Header row
    const hRow = ws.addRow([
      'Emp Code',
      'Employee Name',
      'Week',
      'Reg Hrs',
      'OT Hrs',
      'DT Hrs',
      'Reg $',
      'OT $',
      'DT $',
      'Total',
    ])
    setHeaderStyle(hRow)

    ws.columns = [
      { key: 'empCode', width: 12 },
      { key: 'empName', width: 22 },
      { key: 'week', width: 14 },
      { key: 'regHrs', width: 10 },
      { key: 'otHrs', width: 10 },
      { key: 'dtHrs', width: 10 },
      { key: 'regDollars', width: 14 },
      { key: 'otDollars', width: 14 },
      { key: 'dtDollars', width: 14 },
      { key: 'total', width: 16 },
    ]

    const projectRows = snapshot.weeklyBilling
      .filter((r) => r.projectKey === projectKey)
      .sort((a, b) => {
        if (a.employeeCode !== b.employeeCode) return a.employeeCode.localeCompare(b.employeeCode)
        return a.weekStart.localeCompare(b.weekStart)
      })

    const employeeMap = new Map<string, { firstName: string; lastName: string }>()
    for (const emp of snapshot.employees) {
      employeeMap.set(emp.code, emp)
    }

    let bodyAlt = false
    for (const row of projectRows) {
      const emp = employeeMap.get(row.employeeCode)
      const empName = emp ? `${emp.firstName} ${emp.lastName}` : row.employeeCode
      const total = row.regularDollars + row.otDollars + row.dtDollars

      const bRow = ws.addRow([
        row.employeeCode,
        empName,
        row.weekStart,
        row.regularHrs,
        row.otHrs,
        row.dtHrs,
        row.regularDollars,
        row.otDollars,
        row.dtDollars,
        total,
      ])
      setBodyStyle(bRow, bodyAlt)
      applyHrsFormat(bRow, [4, 5, 6])
      applyDollarFormat(bRow, [7, 8, 9, 10])
      rightAlignNumbers(bRow, [4, 5, 6, 7, 8, 9, 10])
      bodyAlt = !bodyAlt
    }

    // Project totals row
    const ptRow = ws.addRow([
      '',
      'TOTALS',
      '',
      agg.regHrs,
      agg.otHrs,
      agg.dtHrs,
      agg.regDollars,
      agg.otDollars,
      agg.dtDollars,
      agg.total,
    ])
    ptRow.eachCell((cell) => {
      cell.font = { name: CALIBRI, size: 11, bold: true, color: { argb: WHITE_HEX } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_HEX } }
    })
    applyHrsFormat(ptRow, [4, 5, 6])
    applyDollarFormat(ptRow, [7, 8, 9, 10])
    rightAlignNumbers(ptRow, [4, 5, 6, 7, 8, 9, 10])
    ptRow.height = 18

  }

  // Serialize
  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer as ArrayBuffer)
}

export function downloadWorkbook(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

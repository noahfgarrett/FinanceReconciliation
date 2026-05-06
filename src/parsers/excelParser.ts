import * as XLSX from 'xlsx'
import type { Employee, ExcelRow, RowFlag } from '@/persistence/schemas'
import { matchHeaders, missingRequiredColumns } from './columnMatching'

export interface ExcelParseResult {
  rows: ExcelRow[]
  employees: Employee[]
  warnings: RowFlag[]
}

// Excel serial date epoch: January 1, 1900 (with Lotus 1-2-3 leap-year bug offset)
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30) // Dec 30 1899

function excelSerialToIso(serial: number): string {
  const ms = EXCEL_EPOCH_MS + serial * 86400000
  return new Date(ms).toISOString().slice(0, 10)
}

function parseIsoDate(val: unknown): string {
  if (val == null) return ''

  // Native Date from SheetJS
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return ''
    return val.toISOString().slice(0, 10)
  }

  if (typeof val === 'number') {
    // Excel serial date (positive integer-ish)
    if (val > 0 && val < 2958466) {
      return excelSerialToIso(val)
    }
    return ''
  }

  if (typeof val === 'string') {
    const s = val.trim()
    // ISO date YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    // MM/DD/YYYY or M/D/YYYY
    const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
    if (mdyMatch) {
      const [, mm, dd, yyyyRaw] = mdyMatch
      let yyyy = yyyyRaw
      if (yyyy.length === 2) yyyy = (parseInt(yyyy) > 50 ? '19' : '20') + yyyy
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }
    return ''
  }

  return ''
}

function parseHours(val: unknown): number {
  if (val == null) return 0
  if (typeof val === 'number') return isFinite(val) ? val : 0
  if (typeof val === 'string') {
    // Strip commas, currency symbols, stray whitespace
    const cleaned = val.replace(/[$,\s]/g, '')
    const n = parseFloat(cleaned)
    return isFinite(n) ? n : 0
  }
  return 0
}

function parseString(val: unknown): string {
  if (val == null) return ''
  return String(val).trim()
}

/** Scan the first `maxRows` rows of a sheet and return the row index that
 *  matches the most EXCEL_COLUMNS patterns. Returns -1 if nothing found. */
function findHeaderRow(sheet: XLSX.WorkSheet, maxRows: number): number {
  // Get all cells with address context
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1')
  let bestRow = -1
  let bestScore = 0

  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + maxRows - 1); r++) {
    const rowCells: string[] = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = sheet[addr] as XLSX.CellObject | undefined
      rowCells.push(cell ? String(cell.v ?? '').trim() : '')
    }
    const headerMap = matchHeaders(rowCells)
    const score = Object.keys(headerMap).length
    if (score > bestScore) {
      bestScore = score
      bestRow = r
    }
  }

  // Require at least 3 matched columns to count as a header row
  return bestScore >= 3 ? bestRow : -1
}

export function parseExcel(buffer: ArrayBuffer): ExcelParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return {
      rows: [],
      employees: [],
      warnings: [
        {
          severity: 'error',
          code: 'parse-failure',
          message: 'Excel file has no sheets.',
        },
      ],
    }
  }

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return {
      rows: [],
      employees: [],
      warnings: [
        {
          severity: 'error',
          code: 'parse-failure',
          message: `Sheet "${sheetName}" could not be read.`,
        },
      ],
    }
  }

  // Find header row in first 5 rows
  const headerRowIdx = findHeaderRow(sheet, 5)
  if (headerRowIdx === -1) {
    return {
      rows: [],
      employees: [],
      warnings: [
        {
          severity: 'error',
          code: 'parse-failure',
          message: 'Could not find a recognizable header row in the first 5 rows of the Excel file.',
        },
      ],
    }
  }

  // Read the sheet as AOA starting from the header row
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1')
  const headerCells: string[] = []
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIdx, c })
    const cell = sheet[addr] as XLSX.CellObject | undefined
    headerCells.push(cell ? String(cell.v ?? '').trim() : '')
  }

  const colMap = matchHeaders(headerCells)
  const missing = missingRequiredColumns(colMap)
  if (missing.length > 0) {
    return {
      rows: [],
      employees: [],
      warnings: [
        {
          severity: 'error',
          code: 'parse-failure',
          message: `Missing required column(s): ${missing.join(', ')}. Found headers: ${headerCells.filter(Boolean).join(', ')}`,
        },
      ],
    }
  }

  const rows: ExcelRow[] = []
  const employeeMap = new Map<string, Employee>()
  const warnings: RowFlag[] = []

  for (let r = headerRowIdx + 1; r <= range.e.r; r++) {
    function cell(key: string): unknown {
      const colIdx = colMap[key]
      if (colIdx === undefined) return undefined
      const addr = XLSX.utils.encode_cell({ r, c: colIdx })
      const c = sheet[addr] as XLSX.CellObject | undefined
      return c?.v
    }

    const employeeCode = parseString(cell('employeeCode'))
    if (!employeeCode) continue // skip subtotal / blank rows

    const firstName = parseString(cell('firstName'))
    const lastName = parseString(cell('lastName'))
    const regularHours = parseHours(cell('regularHours'))
    const overtimeHours = parseHours(cell('overtimeHours'))
    const doubleTimeHours = parseHours(cell('doubleTimeHours'))
    const dateUpdated = parseIsoDate(cell('dateUpdated'))
    const wwid = parseString(cell('wwid'))
    const laborAllocationDetails = parseString(cell('laborAllocationDetails'))
    const projectName = parseString(cell('projectName'))

    if (!projectName) {
      warnings.push({
        severity: 'warn',
        code: 'parse-failure',
        message: `Row ${r + 1}: employee "${employeeCode}" has no project name — row skipped.`,
        context: { row: r + 1, employeeCode },
      })
      continue
    }

    rows.push({
      employeeCode,
      laborAllocationDetails,
      projectName,
      regularHours,
      overtimeHours,
      doubleTimeHours,
      dateUpdated,
    })

    // Dedupe employees: first occurrence wins
    if (!employeeMap.has(employeeCode)) {
      const emp: Employee = { code: employeeCode, firstName, lastName }
      if (wwid) emp.wwid = wwid
      employeeMap.set(employeeCode, emp)
    }
  }

  return { rows, employees: [...employeeMap.values()], warnings }
}

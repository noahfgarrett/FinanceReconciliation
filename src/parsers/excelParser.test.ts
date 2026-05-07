import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseExcel } from './excelParser'

/** Build an ArrayBuffer from a 2-D array of values using SheetJS. */
function makeWorkbook(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return buf
}

const SPEC_HEADERS = [
  'Employee Code', 'Legal Firstname', 'Legal Lastname',
  'Regular Hours', 'Overtime Hours', 'Double Time Hours',
  'Date (Updated)', 'WWID', 'Labor Allocation Details',
  'Project Name Desc-Delete',
]

function specRow(
  code: string, first: string, last: string,
  reg: number, ot: number, dt: number,
  date: string, wwid: string, alloc: string, project: string,
): unknown[] {
  return [code, first, last, reg, ot, dt, date, wwid, alloc, project]
}

describe('parseExcel', () => {
  it('happy path: spec headers, 3 rows, all parse correctly', () => {
    const data = [
      SPEC_HEADERS,
      specRow('2001', 'Alice', 'Smith', 40, 5, 0, '2026-04-30', 'W001', 'ACM-001', 'Acme Phase 2'),
      specRow('2002', 'Bob', 'Jones', 32, 0, 0, '2026-04-30', 'W002', 'VTX-001', 'Vortex Project'),
      specRow('2003', 'Carol', 'Lee', 45, 8, 2, '2026-04-30', 'W003', 'CAL-001', 'Calverton Svc'),
    ]
    const result = parseExcel(makeWorkbook(data))

    expect(result.warnings).toHaveLength(0)
    expect(result.rows).toHaveLength(3)
    expect(result.employees).toHaveLength(3)

    expect(result.rows[0]).toMatchObject({
      employeeCode: '2001',
      regularHours: 40,
      overtimeHours: 5,
      projectNames: ['Acme Phase 2'],
      allocations: ['ACM-001'],
    })
    expect(result.employees[0]).toMatchObject({
      code: '2001', firstName: 'Alice', lastName: 'Smith', wwid: 'W001',
    })
  })

  it('splits semicolon-separated project + allocation lists into arrays', () => {
    const data = [
      SPEC_HEADERS,
      specRow(
        '2000', 'Noah', 'Garrett', 160, 47, 0, '2026-05-02', 'W002000',
        'ADMIN-OFC-001; CARDINAL-CX-002; FAB52-MEP-001; FAB52-UTL-003; TRAIN-SAF-001',
        'Fab 52 Buildout — Arizona; Internal Admin — Non-Billable; Internal Training — Non-Billable; Project Cardinal — Intel Ohio Fab',
      ),
    ]
    const result = parseExcel(makeWorkbook(data))
    expect(result.warnings).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]
    expect(row.allocations).toEqual([
      'ADMIN-OFC-001',
      'CARDINAL-CX-002',
      'FAB52-MEP-001',
      'FAB52-UTL-003',
      'TRAIN-SAF-001',
    ])
    expect(row.projectNames).toEqual([
      'Fab 52 Buildout — Arizona',
      'Internal Admin — Non-Billable',
      'Internal Training — Non-Billable',
      'Project Cardinal — Intel Ohio Fab',
    ])
    expect(row.regularHours).toBe(160)
    expect(row.overtimeHours).toBe(47)
  })

  it('handles empty project / allocation cells without warning', () => {
    const data = [
      SPEC_HEADERS,
      specRow('2010', 'Quiet', 'Worker', 40, 0, 0, '2026-04-30', '', '', ''),
    ]
    const result = parseExcel(makeWorkbook(data))
    expect(result.warnings).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].projectNames).toEqual([])
    expect(result.rows[0].allocations).toEqual([])
  })

  it('header on row 2 (rows 0+1 are blank/intro) — parser scans and finds it', () => {
    const data = [
      ['Paycom Monthly Report', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
      SPEC_HEADERS,
      specRow('3001', 'Dan', 'Brown', 40, 0, 0, '2026-04-30', '', 'ACM-001', 'Acme Phase 2'),
    ]
    const result = parseExcel(makeWorkbook(data))
    expect(result.warnings).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].employeeCode).toBe('3001')
  })

  it('missing required column → parse-failure warning, no rows', () => {
    // Omit 'Regular Hours' (still a required column)
    const data = [
      ['Employee Code', 'Legal Firstname', 'Legal Lastname', 'Date (Updated)'],
      ['4001', 'Eve', 'White', '2026-04-30'],
    ]
    const result = parseExcel(makeWorkbook(data))
    expect(result.rows).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].code).toBe('parse-failure')
    expect(result.warnings[0].severity).toBe('error')
    expect(result.warnings[0].message).toContain('regularHours')
  })

  it('hours stored as strings with commas — coerced correctly', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      SPEC_HEADERS,
      ['5001', 'Frank', 'Hall', '1,234.5', '100.0', '0', '2026-04-30', '', 'ACM-001', 'Acme Phase 2'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const result = parseExcel(buf)
    expect(result.rows[0].regularHours).toBe(1234.5)
    expect(result.rows[0].overtimeHours).toBe(100)
  })

  it('Excel serial date in dateUpdated → ISO string', () => {
    const SERIAL = 45017
    const data = [SPEC_HEADERS, specRow('6001', 'Grace', 'Kim', 40, 0, 0, SERIAL as unknown as string, '', 'ACM-001', 'Acme')]
    const result = parseExcel(makeWorkbook(data))
    expect(result.rows[0].dateUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('two rows for same employee (different projects) → dedup employees, keep both rows', () => {
    const data = [
      SPEC_HEADERS,
      specRow('7001', 'Henry', 'Adams', 40, 0, 0, '2026-04-30', 'W007', 'ACM-001', 'Acme Phase 2'),
      specRow('7001', 'Henry', 'Adams', 20, 0, 0, '2026-04-30', 'W007', 'VTX-001', 'Vortex Project'),
    ]
    const result = parseExcel(makeWorkbook(data))
    expect(result.rows).toHaveLength(2)
    expect(result.employees).toHaveLength(1)
    expect(result.employees[0].code).toBe('7001')
  })
})

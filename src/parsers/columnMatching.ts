const NORMALIZE = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

interface ColumnSpec {
  key: string
  patterns: string[] // patterns are already normalized for comparison
}

export const EXCEL_COLUMNS: ColumnSpec[] = [
  { key: 'employeeCode', patterns: ['employeecode', 'empcode', 'employeeid'] },
  { key: 'firstName', patterns: ['legalfirstname', 'firstname', 'givenname'] },
  { key: 'lastName', patterns: ['legallastname', 'lastname', 'surname', 'familyname'] },
  { key: 'regularHours', patterns: ['regularhours', 'reghours', 'regular'] },
  { key: 'overtimeHours', patterns: ['overtimehours', 'othours', 'overtime'] },
  { key: 'doubleTimeHours', patterns: ['doubletimehours', 'dthours', 'doubletime'] },
  { key: 'dateUpdated', patterns: ['dateupdated', 'updated', 'date'] },
  { key: 'wwid', patterns: ['wwid', 'workerid'] },
  { key: 'laborAllocationDetails', patterns: ['laborallocationdetails', 'allocation', 'allocationcode'] },
  { key: 'projectName', patterns: ['projectnamedescdelete', 'projectname', 'projectdescription', 'project'] },
]

const REQUIRED_COLUMNS = new Set(['employeeCode', 'firstName', 'lastName', 'regularHours', 'projectName'])

/**
 * Given a header row, produce a map of column key → column index.
 * Each header cell is normalized and compared against all patterns.
 * First match per column wins.
 */
export function matchHeaders(headerRow: string[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (let i = 0; i < headerRow.length; i++) {
    const normalized = NORMALIZE(headerRow[i] ?? '')
    if (!normalized) continue
    for (const spec of EXCEL_COLUMNS) {
      if (spec.key in result) continue // already matched
      if (spec.patterns.some((p) => normalized.includes(p) || p.includes(normalized))) {
        result[spec.key] = i
        break
      }
    }
  }
  return result
}

/** Returns the list of required column keys that are absent from the header map. */
export function missingRequiredColumns(map: Record<string, number>): string[] {
  return [...REQUIRED_COLUMNS].filter((k) => !(k in map))
}

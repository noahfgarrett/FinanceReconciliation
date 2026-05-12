import type { ProjectConfig, EmployeeProfile } from '@/persistence/schemas'
import { downloadCsv } from '@/lib/csvExport'

export { downloadCsv }

// ── Fuzzy header matching ──────────────────────────────────────────────────

const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

interface ColumnSpec {
  key: string
  patterns: string[]
}

const PROJECT_COLUMNS: ColumnSpec[] = [
  { key: 'projectName', patterns: ['projectname', 'displayname', 'name', 'project'] },
  { key: 'defaultBillRate', patterns: ['defaultbillrate', 'billrate', 'rate', 'defaultregularrate', 'regularrate'] },
  { key: 'otThresholdHrs', patterns: ['otthresholdhrs', 'otthreshold', 'overthreshold', 'overtimethreshold'] },
  { key: 'dtEnabled', patterns: ['dtenabled', 'includedoubletime', 'doubletime', 'dtflag'] },
  { key: 'dtThresholdHrs', patterns: ['dtthresholdhrs', 'dtthreshold', 'doubletimethreshold'] },
  { key: 'allocationCodes', patterns: ['allocationcodes', 'allocations', 'aliases', 'allocationaliases'] },
]

const EMPLOYEE_COLUMNS: ColumnSpec[] = [
  { key: 'employeeCode', patterns: ['employeecode', 'empcode', 'code', 'employeeid'] },
  { key: 'firstName', patterns: ['firstname', 'legalfirstname', 'givenname', 'first'] },
  { key: 'lastName', patterns: ['lastname', 'legallastname', 'surname', 'familyname', 'last'] },
  { key: 'defaultBillRate', patterns: ['defaultbillrate', 'billrate', 'rate'] },
  { key: 'jobTitle', patterns: ['jobtitle', 'title', 'position', 'role'] },
]

function matchColumns(headerRow: string[], specs: ColumnSpec[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (let i = 0; i < headerRow.length; i++) {
    const norm = normalize(headerRow[i] ?? '')
    if (!norm) continue
    for (const spec of specs) {
      if (spec.key in result) continue
      if (spec.patterns.some((p) => norm.includes(p) || p.includes(norm))) {
        result[spec.key] = i
        break
      }
    }
  }
  return result
}

// ── CSV field parsing (handles quoted fields with commas) ──────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

function splitCsvRows(text: string): string[] {
  // Split on newlines, but respect quoted fields that may contain newlines
  const rows: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        i++ // skip \r\n
      }
      if (current.trim()) {
        rows.push(current)
      }
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) {
    rows.push(current)
  }
  return rows
}

// ── Escape helper ──────────────────────────────────────────────────────────

function escapeCsvField(value: unknown): string {
  const s = value == null ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ── Template generation ────────────────────────────────────────────────────

export function generateProjectCsvTemplate(): string {
  const headers = 'projectName,defaultBillRate,otThresholdHrs,dtEnabled,dtThresholdHrs,allocationCodes'
  const example = 'Site Alpha,75.00,40,true,60,ALLOC-001;ALLOC-002'
  return `${headers}\n${example}`
}

export function generateEmployeeCsvTemplate(): string {
  const headers = 'employeeCode,firstName,lastName,defaultBillRate,jobTitle'
  const example = 'EMP001,Jane,Doe,65.00,Electrician'
  return `${headers}\n${example}`
}

// ── CSV Export ──────────────────────────────────────────────────────────────

export function exportProjectsCsv(configs: Record<string, ProjectConfig>): string {
  const headers = 'projectName,defaultBillRate,otThresholdHrs,dtEnabled,dtThresholdHrs,allocationCodes'
  const rows = Object.values(configs).map((cfg) => {
    const allocationCodes = cfg.allocationAliases.join(';')
    return [
      escapeCsvField(cfg.displayName),
      escapeCsvField(cfg.defaultRegularRate),
      escapeCsvField(cfg.otThresholdHrs),
      escapeCsvField(cfg.includeDoubleTime),
      escapeCsvField(cfg.dtThresholdHrs ?? ''),
      escapeCsvField(allocationCodes),
    ].join(',')
  })
  return [headers, ...rows].join('\n')
}

export function exportEmployeesCsv(employees: Record<string, EmployeeProfile>): string {
  const headers = 'employeeCode,firstName,lastName,defaultBillRate,jobTitle'
  const rows = Object.values(employees).map((emp) =>
    [
      escapeCsvField(emp.code),
      escapeCsvField(emp.firstName),
      escapeCsvField(emp.lastName),
      escapeCsvField(emp.defaultBillRate),
      escapeCsvField(emp.jobTitle ?? ''),
    ].join(','),
  )
  return [headers, ...rows].join('\n')
}

// ── CSV Parsing ────────────────────────────────────────────────────────────

export interface CsvParseResult<T> {
  records: T[]
  warnings: string[]
}

type PartialProjectRecord = Partial<ProjectConfig> & { displayName: string }
type PartialEmployeeRecord = Partial<EmployeeProfile> & { code: string }

function parseNumericField(
  value: string,
  fieldName: string,
  rowNum: number,
  warnings: string[],
  opts?: { min?: number; max?: number },
): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const num = Number(trimmed)
  if (isNaN(num)) {
    warnings.push(`Row ${rowNum}: "${fieldName}" is not a valid number ("${trimmed}")`)
    return undefined
  }
  if (opts?.min !== undefined && num < opts.min) {
    warnings.push(`Row ${rowNum}: "${fieldName}" must be >= ${opts.min} (got ${num})`)
    return undefined
  }
  if (opts?.max !== undefined && num > opts.max) {
    warnings.push(`Row ${rowNum}: "${fieldName}" must be <= ${opts.max} (got ${num})`)
    return undefined
  }
  return num
}

function parseBooleanField(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  return trimmed === 'true' || trimmed === '1' || trimmed === 'yes'
}

export function parseProjectsCsv(csvText: string): CsvParseResult<PartialProjectRecord> {
  const warnings: string[] = []
  const records: PartialProjectRecord[] = []

  const rows = splitCsvRows(csvText)
  if (rows.length === 0) {
    warnings.push('CSV is empty — no header row found')
    return { records, warnings }
  }

  const headerFields = parseCsvLine(rows[0])
  const colMap = matchColumns(headerFields, PROJECT_COLUMNS)

  if (colMap['projectName'] === undefined) {
    warnings.push('Missing required column: projectName (or displayName)')
    return { records, warnings }
  }

  for (let i = 1; i < rows.length; i++) {
    const fields = parseCsvLine(rows[i])
    const rowNum = i + 1

    const displayName = (fields[colMap['projectName']] ?? '').trim()
    if (!displayName) {
      warnings.push(`Row ${rowNum}: skipped — projectName is empty`)
      continue
    }

    const record: PartialProjectRecord = {
      displayName,
      projectKey: normalize(displayName),
    }

    if (colMap['defaultBillRate'] !== undefined) {
      const rate = parseNumericField(
        fields[colMap['defaultBillRate']] ?? '',
        'defaultBillRate',
        rowNum,
        warnings,
        { min: 0 },
      )
      if (rate !== undefined) {
        record.defaultRegularRate = rate
      }
    }

    if (colMap['otThresholdHrs'] !== undefined) {
      const threshold = parseNumericField(
        fields[colMap['otThresholdHrs']] ?? '',
        'otThresholdHrs',
        rowNum,
        warnings,
        { min: 1, max: 168 },
      )
      if (threshold !== undefined) {
        record.otThresholdHrs = threshold
      }
    }

    if (colMap['dtEnabled'] !== undefined) {
      record.includeDoubleTime = parseBooleanField(fields[colMap['dtEnabled']] ?? '')
    }

    if (colMap['dtThresholdHrs'] !== undefined) {
      const dtThreshold = parseNumericField(
        fields[colMap['dtThresholdHrs']] ?? '',
        'dtThresholdHrs',
        rowNum,
        warnings,
        { min: 1, max: 168 },
      )
      if (dtThreshold !== undefined) {
        record.dtThresholdHrs = dtThreshold
      }
    }

    if (colMap['allocationCodes'] !== undefined) {
      const raw = (fields[colMap['allocationCodes']] ?? '').trim()
      if (raw) {
        record.allocationAliases = raw.split(';').map((s) => s.trim()).filter(Boolean)
      }
    }

    records.push(record)
  }

  return { records, warnings }
}

export function parseEmployeesCsv(csvText: string): CsvParseResult<PartialEmployeeRecord> {
  const warnings: string[] = []
  const records: PartialEmployeeRecord[] = []

  const rows = splitCsvRows(csvText)
  if (rows.length === 0) {
    warnings.push('CSV is empty — no header row found')
    return { records, warnings }
  }

  const headerFields = parseCsvLine(rows[0])
  const colMap = matchColumns(headerFields, EMPLOYEE_COLUMNS)

  if (colMap['employeeCode'] === undefined) {
    warnings.push('Missing required column: employeeCode (or empCode, code)')
    return { records, warnings }
  }

  for (let i = 1; i < rows.length; i++) {
    const fields = parseCsvLine(rows[i])
    const rowNum = i + 1

    const code = (fields[colMap['employeeCode']] ?? '').trim()
    if (!code) {
      warnings.push(`Row ${rowNum}: skipped — employeeCode is empty`)
      continue
    }

    const record: PartialEmployeeRecord = { code }

    if (colMap['firstName'] !== undefined) {
      record.firstName = (fields[colMap['firstName']] ?? '').trim()
    }

    if (colMap['lastName'] !== undefined) {
      record.lastName = (fields[colMap['lastName']] ?? '').trim()
    }

    if (colMap['defaultBillRate'] !== undefined) {
      const rate = parseNumericField(
        fields[colMap['defaultBillRate']] ?? '',
        'defaultBillRate',
        rowNum,
        warnings,
        { min: 0 },
      )
      if (rate !== undefined) {
        record.defaultBillRate = rate
      }
    }

    if (colMap['jobTitle'] !== undefined) {
      const title = (fields[colMap['jobTitle']] ?? '').trim()
      if (title) {
        record.jobTitle = title
      }
    }

    records.push(record)
  }

  return { records, warnings }
}

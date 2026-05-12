import { describe, it, expect } from 'vitest'
import {
  generateProjectCsvTemplate,
  generateEmployeeCsvTemplate,
  exportProjectsCsv,
  exportEmployeesCsv,
  parseProjectsCsv,
  parseEmployeesCsv,
} from '@/lib/csvImportExport'
import type { ProjectConfig, EmployeeProfile } from '@/persistence/schemas'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    projectKey: 'alpha',
    displayName: 'Site Alpha',
    otThresholdHrs: 40,
    includeDoubleTime: false,
    defaultRegularRate: 75,
    allocationAliases: [],
    employeeRateOverrides: {},
    ...overrides,
  }
}

function makeEmployee(overrides: Partial<EmployeeProfile> = {}): EmployeeProfile {
  return {
    code: 'EMP001',
    firstName: 'Jane',
    lastName: 'Doe',
    defaultBillRate: 65,
    jobTitle: 'Electrician',
    createdAt: '2024-01-01T00:00:00Z',
    lastModifiedAt: '2024-06-01T00:00:00Z',
    ...overrides,
  }
}

// ── Template generation ─────────────────────────────────────────────────────

describe('generateProjectCsvTemplate', () => {
  it('returns valid CSV with headers and example row', () => {
    const csv = generateProjectCsvTemplate()
    const lines = csv.split('\n')
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('projectName')
    expect(lines[0]).toContain('defaultBillRate')
    expect(lines[0]).toContain('otThresholdHrs')
    expect(lines[0]).toContain('dtEnabled')
    expect(lines[0]).toContain('dtThresholdHrs')
    expect(lines[0]).toContain('allocationCodes')
  })
})

describe('generateEmployeeCsvTemplate', () => {
  it('returns valid CSV with headers and example row', () => {
    const csv = generateEmployeeCsvTemplate()
    const lines = csv.split('\n')
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('employeeCode')
    expect(lines[0]).toContain('firstName')
    expect(lines[0]).toContain('lastName')
    expect(lines[0]).toContain('defaultBillRate')
    expect(lines[0]).toContain('jobTitle')
  })
})

// ── Export round-trip ───────────────────────────────────────────────────────

describe('exportProjectsCsv + parseProjectsCsv round-trip', () => {
  it('export then parse produces same data', () => {
    const configs: Record<string, ProjectConfig> = {
      alpha: makeProject({
        projectKey: 'alpha',
        displayName: 'Site Alpha',
        defaultRegularRate: 75,
        otThresholdHrs: 40,
        includeDoubleTime: true,
        dtThresholdHrs: 60,
        allocationAliases: ['ALLOC-001', 'ALLOC-002'],
      }),
    }

    const csv = exportProjectsCsv(configs)
    const result = parseProjectsCsv(csv)

    expect(result.warnings).toHaveLength(0)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].displayName).toBe('Site Alpha')
    expect(result.records[0].defaultRegularRate).toBe(75)
    expect(result.records[0].otThresholdHrs).toBe(40)
    expect(result.records[0].includeDoubleTime).toBe(true)
    expect(result.records[0].dtThresholdHrs).toBe(60)
    expect(result.records[0].allocationAliases).toEqual(['ALLOC-001', 'ALLOC-002'])
  })
})

describe('exportEmployeesCsv + parseEmployeesCsv round-trip', () => {
  it('export then parse produces same data', () => {
    const employees: Record<string, EmployeeProfile> = {
      EMP001: makeEmployee(),
      EMP002: makeEmployee({
        code: 'EMP002',
        firstName: 'John',
        lastName: 'Smith',
        defaultBillRate: 80,
        jobTitle: 'Plumber',
      }),
    }

    const csv = exportEmployeesCsv(employees)
    const result = parseEmployeesCsv(csv)

    expect(result.warnings).toHaveLength(0)
    expect(result.records).toHaveLength(2)

    const jane = result.records.find((r) => r.code === 'EMP001')
    expect(jane).toBeDefined()
    expect(jane?.firstName).toBe('Jane')
    expect(jane?.lastName).toBe('Doe')
    expect(jane?.defaultBillRate).toBe(65)
    expect(jane?.jobTitle).toBe('Electrician')

    const john = result.records.find((r) => r.code === 'EMP002')
    expect(john).toBeDefined()
    expect(john?.firstName).toBe('John')
    expect(john?.lastName).toBe('Smith')
    expect(john?.defaultBillRate).toBe(80)
    expect(john?.jobTitle).toBe('Plumber')
  })
})

// ── Fuzzy header matching ───────────────────────────────────────────────────

describe('parseEmployeesCsv fuzzy headers', () => {
  it('matches mixed case headers', () => {
    const csv = 'Employee Code,First Name,Last Name,Bill Rate,Job Title\nEMP001,Jane,Doe,65,Electrician'
    const result = parseEmployeesCsv(csv)
    expect(result.warnings).toHaveLength(0)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].code).toBe('EMP001')
    expect(result.records[0].firstName).toBe('Jane')
  })

  it('matches underscore-separated headers', () => {
    const csv = 'employee_code,first_name,last_name,default_bill_rate,job_title\nEMP001,Jane,Doe,65,Electrician'
    const result = parseEmployeesCsv(csv)
    expect(result.warnings).toHaveLength(0)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].code).toBe('EMP001')
  })

  it('matches short aliases like "code" and "rate"', () => {
    const csv = 'code,firstName,lastName,rate,title\nEMP001,Jane,Doe,65,Electrician'
    const result = parseEmployeesCsv(csv)
    expect(result.warnings).toHaveLength(0)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].code).toBe('EMP001')
    expect(result.records[0].defaultBillRate).toBe(65)
    expect(result.records[0].jobTitle).toBe('Electrician')
  })
})

describe('parseProjectsCsv fuzzy headers', () => {
  it('matches "Display Name" as projectName', () => {
    const csv = 'Display Name,Bill Rate,OT Threshold\nSite Alpha,75,40'
    const result = parseProjectsCsv(csv)
    expect(result.warnings).toHaveLength(0)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].displayName).toBe('Site Alpha')
    expect(result.records[0].defaultRegularRate).toBe(75)
    expect(result.records[0].otThresholdHrs).toBe(40)
  })
})

// ── Invalid rows produce warnings but don't crash ───────────────────────────

describe('parseEmployeesCsv validation', () => {
  it('skips rows with empty code and warns', () => {
    const csv = 'employeeCode,firstName,lastName\n,Jane,Doe\nEMP002,John,Smith'
    const result = parseEmployeesCsv(csv)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].code).toBe('EMP002')
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('employeeCode is empty')
  })

  it('warns on negative bill rate', () => {
    const csv = 'employeeCode,firstName,lastName,defaultBillRate\nEMP001,Jane,Doe,-5'
    const result = parseEmployeesCsv(csv)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].defaultBillRate).toBeUndefined()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('>= 0')
  })

  it('warns on non-numeric bill rate', () => {
    const csv = 'employeeCode,firstName,lastName,defaultBillRate\nEMP001,Jane,Doe,abc'
    const result = parseEmployeesCsv(csv)
    expect(result.records).toHaveLength(1)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('not a valid number')
  })
})

describe('parseProjectsCsv validation', () => {
  it('warns on out-of-range OT threshold', () => {
    const csv = 'projectName,otThresholdHrs\nSite Alpha,200'
    const result = parseProjectsCsv(csv)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].otThresholdHrs).toBeUndefined()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('<= 168')
  })

  it('warns on zero OT threshold', () => {
    const csv = 'projectName,otThresholdHrs\nSite Alpha,0'
    const result = parseProjectsCsv(csv)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].otThresholdHrs).toBeUndefined()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('>= 1')
  })

  it('warns on negative bill rate', () => {
    const csv = 'projectName,defaultBillRate\nSite Alpha,-10'
    const result = parseProjectsCsv(csv)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].defaultRegularRate).toBeUndefined()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('>= 0')
  })
})

// ── Quoted fields with commas ───────────────────────────────────────────────

describe('quoted field handling', () => {
  it('handles commas inside quoted fields', () => {
    const csv = 'employeeCode,firstName,lastName,jobTitle\nEMP001,Jane,Doe,"Electrician, Lead"'
    const result = parseEmployeesCsv(csv)
    expect(result.warnings).toHaveLength(0)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].jobTitle).toBe('Electrician, Lead')
  })

  it('handles escaped quotes inside quoted fields', () => {
    const csv = 'employeeCode,firstName,lastName,jobTitle\nEMP001,Jane,Doe,"The ""Best"" Electrician"'
    const result = parseEmployeesCsv(csv)
    expect(result.warnings).toHaveLength(0)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].jobTitle).toBe('The "Best" Electrician')
  })

  it('handles project names with commas in export/import round-trip', () => {
    const configs: Record<string, ProjectConfig> = {
      alpha: makeProject({
        displayName: 'Site Alpha, Phase 2',
      }),
    }
    const csv = exportProjectsCsv(configs)
    const result = parseProjectsCsv(csv)
    expect(result.warnings).toHaveLength(0)
    expect(result.records[0].displayName).toBe('Site Alpha, Phase 2')
  })
})

// ── Empty CSV ───────────────────────────────────────────────────────────────

describe('empty CSV handling', () => {
  it('produces empty result with warning for empty string', () => {
    const result = parseEmployeesCsv('')
    expect(result.records).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('empty')
  })

  it('produces empty result with warning for whitespace-only string', () => {
    const result = parseProjectsCsv('   \n   \n   ')
    expect(result.records).toHaveLength(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('produces empty result when header-only CSV provided', () => {
    const result = parseEmployeesCsv('employeeCode,firstName,lastName')
    expect(result.records).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })
})

// ── Semicolon-separated allocation codes ────────────────────────────────────

describe('allocation code parsing', () => {
  it('parses semicolon-separated allocation codes', () => {
    const csv = 'projectName,allocationCodes\nSite Alpha,ALLOC-001;ALLOC-002;ALLOC-003'
    const result = parseProjectsCsv(csv)
    expect(result.warnings).toHaveLength(0)
    expect(result.records[0].allocationAliases).toEqual(['ALLOC-001', 'ALLOC-002', 'ALLOC-003'])
  })

  it('trims whitespace around allocation codes', () => {
    const csv = 'projectName,allocationCodes\nSite Alpha, ALLOC-001 ; ALLOC-002 '
    const result = parseProjectsCsv(csv)
    expect(result.records[0].allocationAliases).toEqual(['ALLOC-001', 'ALLOC-002'])
  })

  it('handles empty allocation codes', () => {
    const csv = 'projectName,allocationCodes\nSite Alpha,'
    const result = parseProjectsCsv(csv)
    expect(result.records[0].allocationAliases).toBeUndefined()
  })
})

// ── Multiple rows ───────────────────────────────────────────────────────────

describe('multiple rows', () => {
  it('parses multiple employee rows correctly', () => {
    const csv = [
      'employeeCode,firstName,lastName,defaultBillRate',
      'EMP001,Jane,Doe,65',
      'EMP002,John,Smith,80',
      'EMP003,Bob,Jones,55',
    ].join('\n')
    const result = parseEmployeesCsv(csv)
    expect(result.warnings).toHaveLength(0)
    expect(result.records).toHaveLength(3)
  })

  it('parses multiple project rows correctly', () => {
    const csv = [
      'projectName,defaultBillRate,otThresholdHrs',
      'Site Alpha,75,40',
      'Site Beta,80,42',
    ].join('\n')
    const result = parseProjectsCsv(csv)
    expect(result.warnings).toHaveLength(0)
    expect(result.records).toHaveLength(2)
  })
})

// ── CRLF line endings ───────────────────────────────────────────────────────

describe('CRLF line endings', () => {
  it('handles Windows-style CRLF line endings', () => {
    const csv = 'employeeCode,firstName,lastName\r\nEMP001,Jane,Doe\r\nEMP002,John,Smith'
    const result = parseEmployeesCsv(csv)
    expect(result.warnings).toHaveLength(0)
    expect(result.records).toHaveLength(2)
  })
})

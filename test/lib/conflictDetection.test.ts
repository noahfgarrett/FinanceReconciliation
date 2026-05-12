import { describe, it, expect } from 'vitest'
import {
  detectEmployeeConflicts,
  detectProjectConflicts,
} from '@/lib/conflictDetection'
import type { EmployeeProfile, ProjectConfig } from '@/persistence/schemas'

/* ── Helpers ──────────────────────────────────────────────────────────── */

function makeEmployee(overrides: Partial<EmployeeProfile> & { code: string }): EmployeeProfile {
  return {
    firstName: 'John',
    lastName: 'Smith',
    defaultBillRate: 50,
    jobTitle: 'Technician',
    notes: undefined,
    createdAt: '2024-01-01T00:00:00Z',
    lastModifiedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeProject(overrides: Partial<ProjectConfig> & { projectKey: string; displayName: string }): ProjectConfig {
  return {
    otThresholdHrs: 40,
    includeDoubleTime: false,
    defaultRegularRate: 75,
    allocationAliases: [],
    employeeRateOverrides: {},
    ...overrides,
  }
}

/* ── Employee conflict detection ──────────────────────────────────────── */

describe('detectEmployeeConflicts', () => {
  it('returns all as new records when nothing exists locally', () => {
    const result = detectEmployeeConflicts(
      [
        { code: 'E001', firstName: 'Alice', lastName: 'Doe', defaultBillRate: 60 },
        { code: 'E002', firstName: 'Bob', lastName: 'Lee', defaultBillRate: 45 },
      ],
      {},
    )
    expect(result.newRecords).toHaveLength(2)
    expect(result.conflicts).toHaveLength(0)
    expect(result.unchangedCount).toBe(0)
    expect(result.newRecords[0].code).toBe('E001')
    expect(result.newRecords[1].code).toBe('E002')
  })

  it('counts all as unchanged when data matches', () => {
    const existing: Record<string, EmployeeProfile> = {
      E001: makeEmployee({ code: 'E001', firstName: 'John', lastName: 'Smith', defaultBillRate: 50, jobTitle: 'Technician' }),
    }
    const result = detectEmployeeConflicts(
      [{ code: 'E001', firstName: 'John', lastName: 'Smith', defaultBillRate: 50, jobTitle: 'Technician' }],
      existing,
    )
    expect(result.newRecords).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
    expect(result.unchangedCount).toBe(1)
  })

  it('detects mixed new, conflicting, and unchanged records', () => {
    const existing: Record<string, EmployeeProfile> = {
      E001: makeEmployee({ code: 'E001' }),
      E002: makeEmployee({ code: 'E002', firstName: 'Jane', lastName: 'Doe', defaultBillRate: 40 }),
    }
    const result = detectEmployeeConflicts(
      [
        // unchanged
        { code: 'E001', firstName: 'John', lastName: 'Smith', defaultBillRate: 50, jobTitle: 'Technician' },
        // conflict — rate differs
        { code: 'E002', firstName: 'Jane', lastName: 'Doe', defaultBillRate: 55, jobTitle: 'Technician' },
        // new
        { code: 'E003', firstName: 'Charlie', lastName: 'Brown', defaultBillRate: 70 },
      ],
      existing,
    )
    expect(result.unchangedCount).toBe(1)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].id).toBe('E002')
    expect(result.newRecords).toHaveLength(1)
    expect(result.newRecords[0].code).toBe('E003')
  })

  it('sets hasNameMismatch when first name differs', () => {
    const existing: Record<string, EmployeeProfile> = {
      E001: makeEmployee({ code: 'E001', firstName: 'John', lastName: 'Smith' }),
    }
    const result = detectEmployeeConflicts(
      [{ code: 'E001', firstName: 'Jonathan', lastName: 'Smith', defaultBillRate: 50, jobTitle: 'Technician' }],
      existing,
    )
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].hasNameMismatch).toBe(true)
    expect(result.conflicts[0].nameWarning).toContain('John Smith')
    expect(result.conflicts[0].nameWarning).toContain('Jonathan Smith')
  })

  it('sets hasNameMismatch when last name differs', () => {
    const existing: Record<string, EmployeeProfile> = {
      E001: makeEmployee({ code: 'E001', firstName: 'John', lastName: 'Smith' }),
    }
    const result = detectEmployeeConflicts(
      [{ code: 'E001', firstName: 'John', lastName: 'Smyth', defaultBillRate: 50, jobTitle: 'Technician' }],
      existing,
    )
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].hasNameMismatch).toBe(true)
  })

  it('only includes changed fields as conflicts', () => {
    const existing: Record<string, EmployeeProfile> = {
      E001: makeEmployee({ code: 'E001', defaultBillRate: 50, jobTitle: 'Technician' }),
    }
    const result = detectEmployeeConflicts(
      [{ code: 'E001', firstName: 'John', lastName: 'Smith', defaultBillRate: 75, jobTitle: 'Technician' }],
      existing,
    )
    expect(result.conflicts).toHaveLength(1)
    const fieldKeys = result.conflicts[0].fields.map((f) => f.key)
    expect(fieldKeys).toContain('defaultBillRate')
    expect(fieldKeys).not.toContain('firstName')
    expect(fieldKeys).not.toContain('lastName')
    expect(fieldKeys).not.toContain('jobTitle')
  })

  it('handles empty incoming data', () => {
    const existing: Record<string, EmployeeProfile> = {
      E001: makeEmployee({ code: 'E001' }),
    }
    const result = detectEmployeeConflicts([], existing)
    expect(result.newRecords).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
    expect(result.unchangedCount).toBe(0)
  })

  it('assigns defaults for missing fields on new records', () => {
    const result = detectEmployeeConflicts(
      [{ code: 'E099' }],
      {},
    )
    expect(result.newRecords).toHaveLength(1)
    expect(result.newRecords[0].firstName).toBe('')
    expect(result.newRecords[0].lastName).toBe('')
    expect(result.newRecords[0].defaultBillRate).toBe(0)
    expect(result.newRecords[0].createdAt).toBeTruthy()
  })
})

/* ── Project conflict detection ───────────────────────────────────────── */

describe('detectProjectConflicts', () => {
  it('returns all as new records when nothing exists locally', () => {
    const result = detectProjectConflicts(
      [{ displayName: 'Acme Corp', defaultRegularRate: 100, otThresholdHrs: 40 }],
      {},
    )
    expect(result.newRecords).toHaveLength(1)
    expect(result.newRecords[0].projectKey).toBe('acme-corp')
    expect(result.conflicts).toHaveLength(0)
  })

  it('detects rate conflict on existing project', () => {
    const existing: Record<string, ProjectConfig> = {
      'acme-corp': makeProject({ projectKey: 'acme-corp', displayName: 'Acme Corp', defaultRegularRate: 75 }),
    }
    const result = detectProjectConflicts(
      [{ displayName: 'Acme Corp', defaultRegularRate: 100 }],
      existing,
    )
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].id).toBe('acme-corp')
    const rateField = result.conflicts[0].fields.find((f) => f.key === 'defaultRegularRate')
    expect(rateField).toBeDefined()
    expect(rateField?.currentValue).toBe(75)
    expect(rateField?.incomingValue).toBe(100)
  })

  it('detects allocation alias changes', () => {
    const existing: Record<string, ProjectConfig> = {
      'project-x': makeProject({
        projectKey: 'project-x',
        displayName: 'Project X',
        allocationAliases: ['PX', 'ProjX'],
      }),
    }
    const result = detectProjectConflicts(
      [{ displayName: 'Project X', allocationAliases: ['PX', 'ProjX', 'ProjectX'] }],
      existing,
    )
    expect(result.conflicts).toHaveLength(1)
    const aliasField = result.conflicts[0].fields.find((f) => f.key === 'allocationAliases')
    expect(aliasField).toBeDefined()
    expect(aliasField?.currentValue).toBe('PX; ProjX')
    expect(aliasField?.incomingValue).toBe('PX; ProjX; ProjectX')
  })

  it('counts unchanged projects', () => {
    const existing: Record<string, ProjectConfig> = {
      'my-proj': makeProject({
        projectKey: 'my-proj',
        displayName: 'My Proj',
        defaultRegularRate: 75,
        otThresholdHrs: 40,
        allocationAliases: [],
      }),
    }
    const result = detectProjectConflicts(
      [{ displayName: 'My Proj', defaultRegularRate: 75, otThresholdHrs: 40, allocationAliases: [] }],
      existing,
    )
    expect(result.conflicts).toHaveLength(0)
    expect(result.unchangedCount).toBe(1)
  })

  it('handles empty incoming data', () => {
    const existing: Record<string, ProjectConfig> = {
      'a': makeProject({ projectKey: 'a', displayName: 'A' }),
    }
    const result = detectProjectConflicts([], existing)
    expect(result.newRecords).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
    expect(result.unchangedCount).toBe(0)
  })
})

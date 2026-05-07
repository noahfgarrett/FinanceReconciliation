import { describe, it, expect } from 'vitest'
import {
  slugifyProjectName,
  resolveAllocationToProjectKey,
  buildEmployeeAllocationMap,
} from './projectMatching'
import type { ExcelRow, ProjectConfig } from '@/persistence/schemas'

const cfg = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  projectKey: 'project-acme',
  displayName: 'Project Acme',
  allocationAliases: ['ACM-001'],
  otThresholdHrs: 40,
  includeDoubleTime: false,
  defaultRegularRate: 100,
  employeeRateOverrides: {},
  ...overrides,
})

describe('slugifyProjectName', () => {
  it('produces a slug', () => {
    expect(slugifyProjectName('Project Acme — Phase 2')).toBe('project-acme-phase-2')
  })
})

describe('resolveAllocationToProjectKey', () => {
  const configs: Record<string, ProjectConfig> = { 'project-acme': cfg() }

  it('matches by alias', () => {
    expect(resolveAllocationToProjectKey('ACM-001', configs)).toBe('project-acme')
  })
  it('matches by projectKey direct', () => {
    expect(resolveAllocationToProjectKey('project-acme', configs)).toBe('project-acme')
  })
  it('returns null when no match', () => {
    expect(resolveAllocationToProjectKey('UNKNOWN-XYZ', configs)).toBeNull()
  })
})

describe('buildEmployeeAllocationMap', () => {
  const row = (
    code: string,
    allocations: string[],
    projectNames: string[] = [],
  ): ExcelRow => ({
    employeeCode: code,
    projectNames,
    allocations,
    regularHours: 0,
    overtimeHours: 0,
    doubleTimeHours: 0,
    dateUpdated: '2026-04-30',
  })

  it('returns the union of allocations per employee', () => {
    const m = buildEmployeeAllocationMap([
      row('2000', ['ACM-001', 'VTX-PLN']),
      row('2001', ['CAL-SVC']),
    ])
    expect(m.get('2000')).toEqual(['ACM-001', 'VTX-PLN'])
    expect(m.get('2001')).toEqual(['CAL-SVC'])
  })

  it('dedupes allocations across multiple rows for the same employee', () => {
    const m = buildEmployeeAllocationMap([
      row('2000', ['ACM-001', 'VTX-PLN']),
      row('2000', ['VTX-PLN', 'CAL-SVC']),
    ])
    const list = m.get('2000') ?? []
    expect(new Set(list)).toEqual(new Set(['ACM-001', 'VTX-PLN', 'CAL-SVC']))
  })

  it('handles employees with no allocations', () => {
    const m = buildEmployeeAllocationMap([row('2000', [])])
    expect(m.get('2000')).toEqual([])
  })
})

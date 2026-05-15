import { describe, it, expect } from 'vitest'
import {
  slugifyProjectName,
  resolveAllocationToProjectKey,
  allocFamily,
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

describe('allocFamily', () => {
  it('extracts first segment when >= 3 chars', () => {
    expect(allocFamily('BRAVO-CX-002')).toBe('bravo')
    expect(allocFamily('ALPHA-MEP-001')).toBe('alpha')
    expect(allocFamily('ADMIN-OFC-001')).toBe('admin')
  })
  it('joins first two segments when first < 3 chars', () => {
    expect(allocFamily('CH-DC2-CX-001')).toBe('ch-dc2')
  })
  it('handles single segment', () => {
    expect(allocFamily('BRAVO')).toBe('bravo')
  })
  it('returns empty for empty string', () => {
    expect(allocFamily('')).toBe('')
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

  it('resolves via prefix-family when exact match fails', () => {
    const cfgs: Record<string, ProjectConfig> = {
      'project-bravo': cfg({
        projectKey: 'project-bravo',
        displayName: 'Bravo',
        allocationAliases: ['BRAVO-CX-002'],
      }),
    }
    // BRAVO-PNL-004 shares family "bravo" with the alias BRAVO-CX-002
    expect(resolveAllocationToProjectKey('BRAVO-PNL-004', cfgs)).toBe('project-bravo')
  })

  it('returns null when family matches multiple projects', () => {
    const cfgs: Record<string, ProjectConfig> = {
      'project-a': cfg({
        projectKey: 'project-a',
        allocationAliases: ['BRAVO-CX-002'],
      }),
      'project-b': cfg({
        projectKey: 'project-b',
        allocationAliases: ['BRAVO-QC-001'],
      }),
    }
    // Family "bravo" matches BOTH projects — ambiguous, so null
    expect(resolveAllocationToProjectKey('BRAVO-PNL-004', cfgs)).toBeNull()
  })

  it('prefers exact match over family match', () => {
    const cfgs: Record<string, ProjectConfig> = {
      'project-bravo': cfg({
        projectKey: 'project-bravo',
        allocationAliases: ['BRAVO-CX-002', 'BRAVO-PNL-004'],
      }),
    }
    expect(resolveAllocationToProjectKey('BRAVO-PNL-004', cfgs)).toBe('project-bravo')
  })

  it('resolves short-prefix families correctly', () => {
    const cfgs: Record<string, ProjectConfig> = {
      'project-ch-dc2': cfg({
        projectKey: 'project-ch-dc2',
        allocationAliases: ['CH-DC2-CX-001'],
      }),
    }
    expect(resolveAllocationToProjectKey('CH-DC2-MEP-003', cfgs)).toBe('project-ch-dc2')
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

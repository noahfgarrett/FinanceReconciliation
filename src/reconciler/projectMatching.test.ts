import { describe, it, expect } from 'vitest'
import { slugifyProjectName, resolveAllocationToProjectKey } from './projectMatching'
import type { ProjectConfig } from '@/persistence/schemas'

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

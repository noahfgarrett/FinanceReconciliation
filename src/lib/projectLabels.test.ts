import { describe, it, expect } from 'vitest'
import type { ProjectConfig } from '@/persistence/schemas'
import { isUnmappedKey, projectLabel, unmappedAllocation, unmappedKey } from './projectLabels'

const configs: Record<string, ProjectConfig> = {
  'project-alpha': {
    projectKey: 'project-alpha',
    displayName: 'Project Alpha',
    allocationAliases: ['ALPHA-MEP-001'],
    otThresholdHrs: 40,
    includeDoubleTime: false,
    defaultRegularRate: 100,
    employeeRateOverrides: {},
  },
}

describe('unmapped project keys', () => {
  it('round-trips an allocation code', () => {
    const key = unmappedKey('UNKNOWN-PRJ-999')
    expect(isUnmappedKey(key)).toBe(true)
    expect(unmappedAllocation(key)).toBe('UNKNOWN-PRJ-999')
  })
  it('does not treat real project keys as unmapped', () => {
    expect(isUnmappedKey('project-alpha')).toBe(false)
    expect(unmappedAllocation('project-alpha')).toBeNull()
  })
})

describe('projectLabel', () => {
  it('uses the configured display name', () => {
    expect(projectLabel('project-alpha', configs)).toBe('Project Alpha')
  })
  it('labels unmapped codes without the internal prefix', () => {
    const label = projectLabel(unmappedKey('BOGUS-XYZ-123'), configs)
    expect(label).toBe('Unmapped: BOGUS-XYZ-123')
    expect(label).not.toContain('__unmapped')
  })
  it('falls back to the key for unknown projects', () => {
    expect(projectLabel('project-gone', configs)).toBe('project-gone')
  })
})

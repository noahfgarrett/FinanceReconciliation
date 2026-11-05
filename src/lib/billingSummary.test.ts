import { describe, it, expect } from 'vitest'
import type { ProjectConfig, WeeklyBilling } from '@/persistence/schemas'
import { billingCounts } from './billingSummary'
import { unmappedKey } from './projectLabels'

const cfg = (projectKey: string, rate: number): ProjectConfig => ({
  projectKey,
  displayName: projectKey,
  allocationAliases: [],
  otThresholdHrs: 40,
  includeDoubleTime: false,
  defaultRegularRate: rate,
  employeeRateOverrides: {},
})

const row = (employeeCode: string, projectKey: string, weekStart = '2026-04-06'): WeeklyBilling => ({
  employeeCode,
  projectKey,
  weekStart,
  hours: 40,
  regularHrs: 40,
  otHrs: 0,
  dtHrs: 0,
  regularDollars: 0,
  otDollars: 0,
  dtDollars: 0,
  flags: [],
  reviewed: false,
  confidence: 1,
  confidenceReasons: [],
  sources: [],
})

describe('billingCounts', () => {
  it('excludes unmapped codes from the project count and counts them separately', () => {
    const rows = [
      row('2000', 'alpha'),
      row('2000', 'alpha', '2026-04-13'),
      row('2001', 'bravo'),
      row('2002', unmappedKey('UNKNOWN-PRJ-999')),
      row('2002', unmappedKey('UNKNOWN-PRJ-999'), '2026-04-13'),
      row('2003', unmappedKey('BOGUS-XYZ-123')),
    ]
    const counts = billingCounts(rows, { alpha: cfg('alpha', 100), bravo: cfg('bravo', 115) })
    expect(counts).toEqual({ employees: 4, projects: 2, unmappedCodes: 2, projectsNeedingRates: 0 })
  })

  it('only counts $0-rate projects that actually have billing rows', () => {
    const rows = [row('2000', 'alpha'), row('2001', 'bravo')]
    const counts = billingCounts(rows, {
      alpha: cfg('alpha', 0),
      bravo: cfg('bravo', 115),
      idle: cfg('idle', 0),
    })
    expect(counts.projectsNeedingRates).toBe(1)
  })

  it('handles an empty snapshot', () => {
    expect(billingCounts([], {})).toEqual({
      employees: 0,
      projects: 0,
      unmappedCodes: 0,
      projectsNeedingRates: 0,
    })
  })
})

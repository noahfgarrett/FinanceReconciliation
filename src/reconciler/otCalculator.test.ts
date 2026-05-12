import { describe, it, expect } from 'vitest'
import { splitWeekHours, resolveRates } from './otCalculator'
import type { ProjectConfig } from '@/persistence/schemas'

const base: ProjectConfig = {
  projectKey: 'p',
  displayName: 'P',
  allocationAliases: [],
  otThresholdHrs: 40,
  includeDoubleTime: false,
  defaultRegularRate: 100,
  employeeRateOverrides: {},
}

describe('splitWeekHours', () => {
  it('returns all regular below threshold', () => {
    expect(splitWeekHours(35, base)).toEqual({ regularHrs: 35, otHrs: 0, dtHrs: 0 })
  })
  it('caps regular at threshold and overflow as OT', () => {
    expect(splitWeekHours(50, base)).toEqual({ regularHrs: 40, otHrs: 10, dtHrs: 0 })
  })
  it('handles 50hr threshold project', () => {
    expect(splitWeekHours(55, { ...base, otThresholdHrs: 50 })).toEqual({
      regularHrs: 50, otHrs: 5, dtHrs: 0,
    })
  })
  it('splits across reg/OT/DT when DT enabled', () => {
    const cfg: ProjectConfig = { ...base, otThresholdHrs: 40, includeDoubleTime: true, dtThresholdHrs: 50 }
    expect(splitWeekHours(60, cfg)).toEqual({ regularHrs: 40, otHrs: 10, dtHrs: 10 })
  })
  it('zero hours yields zero', () => {
    expect(splitWeekHours(0, base)).toEqual({ regularHrs: 0, otHrs: 0, dtHrs: 0 })
  })
})

describe('resolveRates', () => {
  it('uses 1.5× / 2× by default with project-default source', () => {
    const rates = resolveRates(base, 'X')
    expect(rates).toEqual({ regular: 100, ot: 150, dt: 200, source: 'project-default' })
  })
  it('respects project overrides', () => {
    const rates = resolveRates({ ...base, otRateOverride: 175, dtRateOverride: 220 }, 'X')
    expect(rates).toEqual({
      regular: 100, ot: 175, dt: 220, source: 'project-default',
    })
  })
  it('respects employee overrides', () => {
    const cfg: ProjectConfig = {
      ...base,
      employeeRateOverrides: { '2000': { regularRate: 250, otRate: 400 } },
    }
    expect(resolveRates(cfg, '2000').regular).toBe(250)
    expect(resolveRates(cfg, '2000').ot).toBe(400)
    expect(resolveRates(cfg, '2000').dt).toBe(200) // falls through to project default
    expect(resolveRates(cfg, '2000').source).toBe('employee-override')
  })
})

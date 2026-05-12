import { describe, it, expect } from 'vitest'
import { resolveRates } from '@/reconciler/otCalculator'
import type { EmployeeProfileForRates } from '@/reconciler/otCalculator'
import type { ProjectConfig } from '@/persistence/schemas'

const baseCfg = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
  projectKey: 'p',
  displayName: 'P',
  allocationAliases: [],
  otThresholdHrs: 40,
  includeDoubleTime: false,
  defaultRegularRate: 100,
  employeeRateOverrides: {},
  ...overrides,
})

describe('resolveRates – 4-level cascade', () => {
  // ---- Level 1: employee override ----
  it('uses employee override when present (source: employee-override)', () => {
    const cfg = baseCfg({
      employeeRateOverrides: { EMP1: { regularRate: 120, otRate: 180, dtRate: 240 } },
    })
    const result = resolveRates(cfg, 'EMP1')
    expect(result.regular).toBe(120)
    expect(result.ot).toBe(180)
    expect(result.dt).toBe(240)
    expect(result.source).toBe('employee-override')
  })

  it('uses employee override regular with fallback OT/DT from project when not specified', () => {
    const cfg = baseCfg({
      employeeRateOverrides: { EMP1: { regularRate: 120 } },
    })
    const result = resolveRates(cfg, 'EMP1')
    expect(result.regular).toBe(120)
    expect(result.ot).toBe(150)  // project default × 1.5
    expect(result.dt).toBe(200)  // project default × 2
    expect(result.source).toBe('employee-override')
  })

  // ---- Level 2: employee profile default ----
  it('uses employee profile defaultBillRate when no employee override (source: employee-default)', () => {
    const cfg = baseCfg({ defaultRegularRate: 80 })
    const profile: EmployeeProfileForRates = { defaultBillRate: 95 }
    const result = resolveRates(cfg, 'EMP1', profile)
    expect(result.regular).toBe(95)
    expect(result.ot).toBe(95 * 1.5)
    expect(result.dt).toBe(95 * 2)
    expect(result.source).toBe('employee-default')
  })

  it('employee override takes precedence over employee profile', () => {
    const cfg = baseCfg({
      employeeRateOverrides: { EMP1: { regularRate: 200 } },
    })
    const profile: EmployeeProfileForRates = { defaultBillRate: 75 }
    const result = resolveRates(cfg, 'EMP1', profile)
    expect(result.regular).toBe(200)
    expect(result.source).toBe('employee-override')
  })

  // ---- Level 3: project default ----
  it('falls through to project default when no overrides and no profile (source: project-default)', () => {
    const cfg = baseCfg({ defaultRegularRate: 110 })
    const result = resolveRates(cfg, 'EMP1')
    expect(result.regular).toBe(110)
    expect(result.ot).toBe(110 * 1.5)
    expect(result.dt).toBe(110 * 2)
    expect(result.source).toBe('project-default')
  })

  it('falls through to project default when employee profile has zero defaultBillRate', () => {
    const cfg = baseCfg({ defaultRegularRate: 100 })
    const profile: EmployeeProfileForRates = { defaultBillRate: 0 }
    const result = resolveRates(cfg, 'EMP1', profile)
    expect(result.regular).toBe(100)
    expect(result.source).toBe('project-default')
  })

  // ---- Level 4: $0 / none ----
  it('returns source "none" when project rate is 0 and no overrides or profile', () => {
    const cfg = baseCfg({ defaultRegularRate: 0 })
    const result = resolveRates(cfg, 'EMP1')
    expect(result.regular).toBe(0)
    expect(result.ot).toBe(0)
    expect(result.dt).toBe(0)
    expect(result.source).toBe('none')
  })

  it('returns source "none" when project rate is 0 and profile has 0 defaultBillRate', () => {
    const cfg = baseCfg({ defaultRegularRate: 0 })
    const profile: EmployeeProfileForRates = { defaultBillRate: 0 }
    const result = resolveRates(cfg, 'EMP1', profile)
    expect(result.regular).toBe(0)
    expect(result.source).toBe('none')
  })

  // ---- OT-specific cascade ----
  it('uses employee override OT even when profile exists', () => {
    const cfg = baseCfg({
      employeeRateOverrides: { EMP1: { otRate: 300 } },
    })
    const profile: EmployeeProfileForRates = { defaultBillRate: 80 }
    const result = resolveRates(cfg, 'EMP1', profile)
    // No regular override → falls to profile
    expect(result.regular).toBe(80)
    expect(result.source).toBe('employee-default')
    // OT has explicit override
    expect(result.ot).toBe(300)
  })

  it('uses project OT override when no employee-level OT is available', () => {
    const cfg = baseCfg({ otRateOverride: 175, defaultRegularRate: 100 })
    const result = resolveRates(cfg, 'EMP1')
    expect(result.ot).toBe(175)
    expect(result.source).toBe('project-default')
  })

  // ---- DT-specific cascade ----
  it('uses employee override DT when specified', () => {
    const cfg = baseCfg({
      employeeRateOverrides: { EMP1: { regularRate: 120, dtRate: 500 } },
    })
    const result = resolveRates(cfg, 'EMP1')
    expect(result.dt).toBe(500)
    expect(result.source).toBe('employee-override')
  })

  it('uses project DT override when no employee DT is set and no profile', () => {
    const cfg = baseCfg({ dtRateOverride: 250, defaultRegularRate: 100 })
    const result = resolveRates(cfg, 'EMP1')
    expect(result.dt).toBe(250)
  })

  // ---- Edge cases ----
  it('employee profile with rate = 0 falls through to project default (not employee-default)', () => {
    const cfg = baseCfg({ defaultRegularRate: 50 })
    const profile: EmployeeProfileForRates = { defaultBillRate: 0 }
    const result = resolveRates(cfg, 'EMP1', profile)
    expect(result.regular).toBe(50)
    expect(result.source).toBe('project-default')
    expect(result.ot).toBe(75)
    expect(result.dt).toBe(100)
  })

  it('handles employee override with regularRate = 0 as a valid override (source: employee-override)', () => {
    const cfg = baseCfg({
      defaultRegularRate: 100,
      employeeRateOverrides: { EMP1: { regularRate: 0 } },
    })
    const profile: EmployeeProfileForRates = { defaultBillRate: 80 }
    const result = resolveRates(cfg, 'EMP1', profile)
    // regularRate is explicitly set to 0 in the override → employee-override
    expect(result.regular).toBe(0)
    expect(result.source).toBe('employee-override')
  })

  it('OT cascade: employee profile × 1.5 when no employee OT override', () => {
    const cfg = baseCfg({ otRateOverride: 175, defaultRegularRate: 100 })
    const profile: EmployeeProfileForRates = { defaultBillRate: 90 }
    const result = resolveRates(cfg, 'EMP1', profile)
    // Employee profile defaultBillRate > 0 → OT = 90 × 1.5 = 135
    expect(result.ot).toBe(135)
    expect(result.regular).toBe(90)
  })

  it('DT cascade: employee profile × 2 when no employee DT override', () => {
    const cfg = baseCfg({ dtRateOverride: 250, defaultRegularRate: 100 })
    const profile: EmployeeProfileForRates = { defaultBillRate: 90 }
    const result = resolveRates(cfg, 'EMP1', profile)
    // Employee profile defaultBillRate > 0 → DT = 90 × 2 = 180
    expect(result.dt).toBe(180)
  })

  it('rate mismatch scenario: employee default 75, project override 95', () => {
    const cfg = baseCfg({
      defaultRegularRate: 100,
      employeeRateOverrides: { EMP1: { regularRate: 95 } },
    })
    const profile: EmployeeProfileForRates = { defaultBillRate: 75 }
    const result = resolveRates(cfg, 'EMP1', profile)
    // Employee override is present → uses it
    expect(result.regular).toBe(95)
    expect(result.source).toBe('employee-override')
    // The deviation check (|75-95|/95 = 0.21 > 0.2) is done by reconcile, not resolveRates
  })
})

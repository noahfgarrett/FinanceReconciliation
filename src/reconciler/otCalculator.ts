import type { ProjectConfig } from '@/persistence/schemas'

export interface SplitHours {
  regularHrs: number
  otHrs: number
  dtHrs: number
}

export interface RateSet {
  regular: number
  ot: number
  dt: number
}

export interface EmployeeProfileForRates {
  defaultBillRate: number
}

export interface RateResolution extends RateSet {
  source: 'employee-override' | 'employee-default' | 'project-default' | 'none'
}

/**
 * Split a single week's hours on a single project per the project's thresholds.
 * Hours up to OT threshold = Regular.
 * Hours between OT and DT thresholds = OT.
 * Hours over DT threshold = DT (only when includeDoubleTime).
 */
export function splitWeekHours(hours: number, cfg: ProjectConfig): SplitHours {
  const ot = cfg.otThresholdHrs
  const dt = cfg.includeDoubleTime && cfg.dtThresholdHrs ? cfg.dtThresholdHrs : Infinity

  if (hours <= 0) return { regularHrs: 0, otHrs: 0, dtHrs: 0 }
  if (hours <= ot) return { regularHrs: hours, otHrs: 0, dtHrs: 0 }
  if (hours <= dt) return { regularHrs: ot, otHrs: hours - ot, dtHrs: 0 }
  return { regularHrs: ot, otHrs: dt - ot, dtHrs: hours - dt }
}

/**
 * Resolve effective rates using a 4-level cascade:
 *   1. ProjectConfig.employeeRateOverrides[employeeCode] → 'employee-override'
 *   2. employeeProfile.defaultBillRate (if > 0)           → 'employee-default'
 *   3. ProjectConfig.defaultRegularRate (if > 0)          → 'project-default'
 *   4. $0                                                  → 'none'
 */
export function resolveRates(
  cfg: ProjectConfig,
  employeeCode: string,
  employeeProfile?: EmployeeProfileForRates,
): RateResolution {
  const emp = cfg.employeeRateOverrides[employeeCode]

  // --- Regular rate cascade ---
  let regular: number
  let source: RateResolution['source']

  if (emp?.regularRate !== undefined && emp.regularRate !== null) {
    regular = emp.regularRate
    source = 'employee-override'
  } else if (employeeProfile && employeeProfile.defaultBillRate > 0) {
    regular = employeeProfile.defaultBillRate
    source = 'employee-default'
  } else if (cfg.defaultRegularRate > 0) {
    regular = cfg.defaultRegularRate
    source = 'project-default'
  } else {
    regular = 0
    source = 'none'
  }

  // --- OT rate cascade ---
  // 1. employee override OT
  // 2. employee default × 1.5
  // 3. project OT override
  // 4. project default × 1.5
  // 5. 0
  let ot: number
  if (emp?.otRate !== undefined && emp.otRate !== null) {
    ot = emp.otRate
  } else if (employeeProfile && employeeProfile.defaultBillRate > 0) {
    ot = employeeProfile.defaultBillRate * 1.5
  } else if (cfg.otRateOverride !== undefined && cfg.otRateOverride !== null) {
    ot = cfg.otRateOverride
  } else if (cfg.defaultRegularRate > 0) {
    ot = cfg.defaultRegularRate * 1.5
  } else {
    ot = 0
  }

  // --- DT rate cascade ---
  // 1. employee override DT
  // 2. employee default × 2
  // 3. project DT override
  // 4. project default × 2
  // 5. 0
  let dt: number
  if (emp?.dtRate !== undefined && emp.dtRate !== null) {
    dt = emp.dtRate
  } else if (employeeProfile && employeeProfile.defaultBillRate > 0) {
    dt = employeeProfile.defaultBillRate * 2
  } else if (cfg.dtRateOverride !== undefined && cfg.dtRateOverride !== null) {
    dt = cfg.dtRateOverride
  } else if (cfg.defaultRegularRate > 0) {
    dt = cfg.defaultRegularRate * 2
  } else {
    dt = 0
  }

  return { regular, ot, dt, source }
}

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
 * Resolve effective rates: project-default → project override → employee override.
 */
export function resolveRates(cfg: ProjectConfig, employeeCode: string): RateSet {
  const projReg = cfg.defaultRegularRate
  const projOt = cfg.otRateOverride ?? projReg * 1.5
  const projDt = cfg.dtRateOverride ?? projReg * 2

  const emp = cfg.employeeRateOverrides[employeeCode]
  return {
    regular: emp?.regularRate ?? projReg,
    ot: emp?.otRate ?? projOt,
    dt: emp?.dtRate ?? projDt,
  }
}

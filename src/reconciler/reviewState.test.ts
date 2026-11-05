import { describe, it, expect } from 'vitest'
import type { WeeklyBilling } from '@/persistence/schemas'
import { billingRowId, carryOverReviewState } from './reviewState'

const row = (
  employeeCode: string,
  projectKey: string,
  weekStart: string,
  extra: Partial<WeeklyBilling> = {},
): WeeklyBilling => ({
  employeeCode, projectKey, weekStart,
  hours: 40, regularHrs: 40, otHrs: 0, dtHrs: 0,
  regularDollars: 4000, otDollars: 0, dtDollars: 0,
  flags: [], reviewed: false, confidence: 1, confidenceReasons: [], sources: [],
  ...extra,
})

describe('billingRowId', () => {
  it('combines employee, project and week', () => {
    expect(billingRowId(row('2000', 'alpha', '2026-04-06'))).toBe('2000|alpha|2026-04-06')
  })
})

describe('carryOverReviewState', () => {
  it('keeps reviewed and notes on matching rows and takes new numbers', () => {
    const prev = [row('2000', 'alpha', '2026-04-06', { reviewed: true, notes: 'ok' })]
    const next = [row('2000', 'alpha', '2026-04-06', { regularDollars: 4800 })]
    const out = carryOverReviewState(prev, next)
    expect(out[0]).toMatchObject({ reviewed: true, notes: 'ok', regularDollars: 4800 })
  })

  it('drops review state for rows that no longer exist and leaves new rows unreviewed', () => {
    const prev = [
      row('2000', 'alpha', '2026-04-06', { reviewed: true }),
      row('2001', '__unmapped:XYZ-1', '2026-04-06', { reviewed: true, notes: 'ask PM' }),
    ]
    // XYZ-1 got mapped to bravo, so its old row is gone and a new one appears
    const next = [row('2000', 'alpha', '2026-04-06'), row('2001', 'bravo', '2026-04-06')]
    const out = carryOverReviewState(prev, next)
    expect(out).toHaveLength(2)
    expect(out[0].reviewed).toBe(true)
    expect(out[1].reviewed).toBe(false)
    expect(out[1].notes).toBeUndefined()
  })

  it('does not match rows from a different week or employee', () => {
    const prev = [row('2000', 'alpha', '2026-04-06', { reviewed: true })]
    const next = [row('2000', 'alpha', '2026-04-13'), row('2001', 'alpha', '2026-04-06')]
    expect(carryOverReviewState(prev, next).every((r) => !r.reviewed)).toBe(true)
  })
})

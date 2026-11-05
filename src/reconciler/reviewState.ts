import type { WeeklyBilling } from '@/persistence/schemas'

/**
 * Stable identity for a billing row: employee + project (or unmapped
 * allocation key) + week. reconcile() produces at most one row per identity,
 * and the identity doesn't change when rates or thresholds are edited.
 */
export function billingRowId(row: Pick<WeeklyBilling, 'employeeCode' | 'projectKey' | 'weekStart'>): string {
  return `${row.employeeCode}|${row.projectKey}|${row.weekStart}`
}

/**
 * Copy the user's review state (reviewed tick and notes) from the previous
 * billing rows onto freshly recalculated ones. Rows that no longer exist are
 * dropped along with their review state; new rows start unreviewed.
 */
export function carryOverReviewState(
  previous: WeeklyBilling[],
  next: WeeklyBilling[],
): WeeklyBilling[] {
  const prevById = new Map<string, WeeklyBilling>()
  for (const r of previous) prevById.set(billingRowId(r), r)
  return next.map((r) => {
    const prev = prevById.get(billingRowId(r))
    if (!prev || (!prev.reviewed && prev.notes === undefined)) return r
    return { ...r, reviewed: prev.reviewed, notes: prev.notes }
  })
}

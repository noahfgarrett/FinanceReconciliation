import type { ProjectConfig, WeeklyBilling } from '@/persistence/schemas'
import { isUnmappedKey } from './projectLabels'

export interface BillingCounts {
  /** Distinct employees with at least one billing row (includes PDF-only employees). */
  employees: number
  /** Distinct mapped projects with billing rows. Unmapped allocation codes are not projects. */
  projects: number
  /** Distinct allocation codes that didn't resolve to a project. */
  unmappedCodes: number
  /** Mapped projects with billing rows whose default bill rate is still $0. */
  projectsNeedingRates: number
}

export function billingCounts(
  rows: WeeklyBilling[],
  configs: Record<string, ProjectConfig>,
): BillingCounts {
  const employees = new Set<string>()
  const projects = new Set<string>()
  const unmapped = new Set<string>()
  for (const r of rows) {
    employees.add(r.employeeCode)
    if (isUnmappedKey(r.projectKey)) unmapped.add(r.projectKey)
    else projects.add(r.projectKey)
  }
  let projectsNeedingRates = 0
  for (const key of projects) {
    if ((configs[key]?.defaultRegularRate ?? 0) === 0) projectsNeedingRates++
  }
  return {
    employees: employees.size,
    projects: projects.size,
    unmappedCodes: unmapped.size,
    projectsNeedingRates,
  }
}

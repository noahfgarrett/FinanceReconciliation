import type { EmployeeProfile, ProjectConfig } from '@/persistence/schemas'
import type { ResolvedConflict } from '@/lib/conflictDetection'

/**
 * Merge resolved employee conflict choices with existing employee records.
 * For each resolved conflict, the chosen field values override the existing record.
 */
export function resolveEmployeeConflicts(
  resolved: ResolvedConflict[],
  existing: Record<string, EmployeeProfile>,
): EmployeeProfile[] {
  const results: EmployeeProfile[] = []

  for (const r of resolved) {
    const ex = existing[r.id]
    if (!ex) continue

    const merged: EmployeeProfile = {
      ...ex,
      lastModifiedAt: new Date().toISOString(),
    }

    for (const [key, value] of Object.entries(r.resolvedFields)) {
      switch (key) {
        case 'firstName':
          merged.firstName = typeof value === 'string' ? value : merged.firstName
          break
        case 'lastName':
          merged.lastName = typeof value === 'string' ? value : merged.lastName
          break
        case 'defaultBillRate':
          merged.defaultBillRate = typeof value === 'number' ? value : merged.defaultBillRate
          break
        case 'jobTitle':
          merged.jobTitle = typeof value === 'string' ? value : value === undefined ? undefined : merged.jobTitle
          break
      }
    }

    results.push(merged)
  }

  return results
}

/**
 * Merge resolved project conflict choices with existing project records.
 * For each resolved conflict, the chosen field values override the existing record.
 */
export function resolveProjectConflicts(
  resolved: ResolvedConflict[],
  existing: Record<string, ProjectConfig>,
): ProjectConfig[] {
  const results: ProjectConfig[] = []

  for (const r of resolved) {
    const ex = existing[r.id]
    if (!ex) continue

    const merged: ProjectConfig = { ...ex }

    for (const [key, value] of Object.entries(r.resolvedFields)) {
      switch (key) {
        case 'displayName':
          merged.displayName = typeof value === 'string' ? value : merged.displayName
          break
        case 'defaultRegularRate':
          merged.defaultRegularRate =
            typeof value === 'number' ? value : merged.defaultRegularRate
          break
        case 'otThresholdHrs':
          merged.otThresholdHrs = typeof value === 'number' ? value : merged.otThresholdHrs
          break
        case 'allocationAliases': {
          // Stored as semicolon-separated string in the conflict UI
          const strValue = typeof value === 'string' ? value : ''
          merged.allocationAliases = strValue
            ? strValue.split(';').map((s) => s.trim()).filter(Boolean)
            : []
          break
        }
      }
    }

    results.push(merged)
  }

  return results
}

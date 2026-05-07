import type { ProjectConfig, ExcelRow } from '@/persistence/schemas'

export function slugifyProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Given an allocation code (from PDF), find the matching projectKey.
 * Strategy: exact alias match → exact projectKey match → null.
 */
export function resolveAllocationToProjectKey(
  allocation: string,
  configs: Record<string, ProjectConfig>,
): string | null {
  const norm = allocation.trim().toLowerCase()
  for (const cfg of Object.values(configs)) {
    if (cfg.projectKey.toLowerCase() === norm) return cfg.projectKey
    if (cfg.allocationAliases.some((a) => a.trim().toLowerCase() === norm)) return cfg.projectKey
  }
  return null
}

/**
 * Build employeeCode → list of allocation codes the employee touched, taken
 * as the union of every Excel row's `allocations` array for that employee.
 * Used to surface which allocation codes still need to be mapped to projects.
 */
export function buildEmployeeAllocationMap(
  rows: ExcelRow[],
): Map<string, string[]> {
  const m = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = m.get(r.employeeCode) ?? new Set<string>()
    for (const a of r.allocations) set.add(a)
    m.set(r.employeeCode, set)
  }
  const out = new Map<string, string[]>()
  for (const [k, v] of m) out.set(k, [...v])
  return out
}

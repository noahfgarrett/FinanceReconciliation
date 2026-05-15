import type { ProjectConfig, ExcelRow } from '@/persistence/schemas'

export function slugifyProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Extract the "family" prefix from an allocation code.
 * Examples:
 *   CARDINAL-CX-002  → "cardinal"
 *   FAB52-MEP-001    → "fab52"
 *   OH-DC1-CX-001    → "oh-dc1"  (first segment < 3 chars → include next)
 *   ADMIN-OFC-001    → "admin"
 */
export function allocFamily(code: string): string {
  const parts = code.toLowerCase().split(/[-_.]+/)
  if (parts.length === 0) return ''
  if (parts[0].length >= 3) return parts[0]
  if (parts.length >= 2) return parts[0] + '-' + parts[1]
  return parts[0]
}

/**
 * Given an allocation code (from PDF), find the matching projectKey.
 * Strategy: exact alias match → exact projectKey match → prefix-family
 * fallback → null.
 *
 * The prefix-family fallback groups allocation codes by their leading
 * segment (e.g. all CARDINAL-* codes share family "cardinal"). If a
 * code isn't an exact alias but its family matches exactly one project's
 * aliases, that project is returned.
 */
export function resolveAllocationToProjectKey(
  allocation: string,
  configs: Record<string, ProjectConfig>,
): string | null {
  const norm = allocation.trim().toLowerCase()

  // Pass 1: exact match against projectKey or aliases
  for (const cfg of Object.values(configs)) {
    if (cfg.projectKey.toLowerCase() === norm) return cfg.projectKey
    if (cfg.allocationAliases.some((a) => a.trim().toLowerCase() === norm)) return cfg.projectKey
  }

  // Pass 2: prefix-family fallback
  const family = allocFamily(norm)
  if (family.length >= 2) {
    const matches = new Set<string>()
    for (const cfg of Object.values(configs)) {
      for (const alias of cfg.allocationAliases) {
        if (allocFamily(alias.trim().toLowerCase()) === family) {
          matches.add(cfg.projectKey)
          break
        }
      }
    }
    if (matches.size === 1) return [...matches][0]
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

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
 * Build (employeeCode, projectKey) → projectName map from Excel rows
 * using the project's `laborAllocationDetails` as the authoritative alias.
 */
export function buildExcelAllocationMap(
  rows: ExcelRow[],
): Map<string, { projectName: string; allocation: string }> {
  const m = new Map<string, { projectName: string; allocation: string }>()
  for (const r of rows) {
    const key = `${r.employeeCode}|${slugifyProjectName(r.projectName)}`
    if (!m.has(key)) m.set(key, { projectName: r.projectName, allocation: r.laborAllocationDetails })
  }
  return m
}

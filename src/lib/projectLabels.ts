import type { ProjectConfig } from '@/persistence/schemas'

/**
 * PDF hours whose allocation code doesn't resolve to a configured project are
 * still kept as billing rows (at $0) so nothing is dropped. Their projectKey is
 * this prefix plus the raw allocation code. The prefix is internal only and
 * should never be shown to users or written to exports; use projectLabel().
 */
const UNMAPPED_PREFIX = '__unmapped:'

export function unmappedKey(allocation: string): string {
  return UNMAPPED_PREFIX + allocation
}

export function isUnmappedKey(key: string): boolean {
  return key.startsWith(UNMAPPED_PREFIX)
}

/** The raw allocation code behind an unmapped key, or null for a real project key. */
export function unmappedAllocation(key: string): string | null {
  return isUnmappedKey(key) ? key.slice(UNMAPPED_PREFIX.length) : null
}

/** Human-readable name for a project key: display name, "Unmapped: CODE", or the key itself. */
export function projectLabel(key: string, configs: Record<string, ProjectConfig>): string {
  const cfg = configs[key]
  if (cfg) return cfg.displayName
  const alloc = unmappedAllocation(key)
  if (alloc !== null) return `Unmapped: ${alloc}`
  return key
}

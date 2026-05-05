/** Compare two semver strings (e.g. "1.2.3" > "1.2.2"). */
export function isNewer(remote: string, local: string): boolean {
  const r = remote.replace(/^v/, '').split('.').map(Number)
  const l = local.replace(/^v/, '').split('.').map(Number)
  const len = Math.max(r.length, l.length)
  for (let i = 0; i < len; i++) {
    const rv = r[i] ?? 0
    const lv = l[i] ?? 0
    if (rv > lv) return true
    if (rv < lv) return false
  }
  return false
}

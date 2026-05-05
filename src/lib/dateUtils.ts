/** Returns the ISO Monday of the week containing the given date (UTC). */
export function isoMonday(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00Z' : ''))
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ...
  const offset = day === 0 ? -6 : 1 - day
  const monday = new Date(d.getTime() + offset * 86400000)
  return monday.toISOString().slice(0, 10)
}

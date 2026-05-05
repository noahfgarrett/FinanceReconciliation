import type { Snapshot, ProjectConfig } from '@/persistence/schemas'
import { fmtUsd, fmtHours } from '@/lib/format'

export function KpiStrip({ snap, configs }: { snap: Snapshot; configs: Record<string, ProjectConfig> }) {
  const totalReg = snap.weeklyBilling.reduce((s, r) => s + r.regularDollars, 0)
  const totalOt = snap.weeklyBilling.reduce((s, r) => s + r.otDollars, 0)
  const totalDt = snap.weeklyBilling.reduce((s, r) => s + r.dtDollars, 0)
  const total = totalReg + totalOt + totalDt
  const totalHrs = snap.weeklyBilling.reduce((s, r) => s + r.hours, 0)
  const otHrs = snap.weeklyBilling.reduce((s, r) => s + r.otHrs, 0)
  const projects = new Set(snap.weeklyBilling.map((r) => r.projectKey)).size
  const employees = new Set(snap.weeklyBilling.map((r) => r.employeeCode)).size
  const unconfigured = Object.values(configs).filter((c) => c.defaultRegularRate === 0).length

  const Tile = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
    <div className="bg-[#0a0f1c] border border-slate-800 rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-2xl font-semibold text-slate-100 mt-2 tabular-nums">{value}</div>
      <div className="text-xs text-lw-orange-400 mt-1">{sub}</div>
    </div>
  )

  return (
    <div className="grid grid-cols-4 gap-3 px-8 py-4">
      <Tile label="Total Billable" value={fmtUsd(total)} sub={`${fmtHours(totalHrs)} · ${employees} employees`} />
      <Tile label="Regular" value={fmtUsd(totalReg)} sub={`${fmtHours(totalHrs - otHrs)}`} />
      <Tile label="Overtime" value={fmtUsd(totalOt + totalDt)} sub={`${fmtHours(otHrs)} @ 1.5×`} />
      <Tile
        label="Projects"
        value={String(projects)}
        sub={unconfigured ? `${unconfigured} need rates` : 'All configured'}
      />
    </div>
  )
}

import type { Snapshot, ProjectConfig } from '@/persistence/schemas'
import { fmtUsd, fmtHours } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'

export function ByProjectView({ snap, configs }: { snap: Snapshot; configs: Record<string, ProjectConfig> }) {
  type Agg = { hours: number; reg: number; ot: number; dt: number; employees: Set<string>; weeks: Set<string> }
  const byProject = new Map<string, Agg>()
  for (const row of snap.weeklyBilling) {
    const a = byProject.get(row.projectKey) ?? {
      hours: 0, reg: 0, ot: 0, dt: 0, employees: new Set<string>(), weeks: new Set<string>(),
    }
    a.hours += row.hours
    a.reg += row.regularDollars
    a.ot += row.otDollars
    a.dt += row.dtDollars
    a.employees.add(row.employeeCode)
    a.weeks.add(row.weekStart)
    byProject.set(row.projectKey, a)
  }

  const rows = Array.from(byProject.entries()).sort(
    (a, b) => b[1].reg + b[1].ot + b[1].dt - (a[1].reg + a[1].ot + a[1].dt),
  )

  return (
    <div className="mx-8 mb-8 bg-[#0a0f1c] border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 text-sm font-semibold text-slate-200">
        By Project
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-950">
          <tr>
            <Th>Project</Th>
            <Th>OT Threshold</Th>
            <Th right>Hours</Th>
            <Th right>OT Hours</Th>
            <Th right>Rate</Th>
            <Th right>Billable</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, agg]) => {
            const cfg = configs[key]
            const otHrs = snap.weeklyBilling
              .filter((r) => r.projectKey === key)
              .reduce((s, r) => s + r.otHrs, 0)
            const regRate = cfg?.defaultRegularRate ?? 0
            const otRate = cfg?.otRateOverride ?? regRate * 1.5
            return (
              <tr key={key} className="border-b border-slate-900/60 last:border-0 hover:bg-slate-900/40">
                <td className="px-5 py-3">
                  <div className="text-slate-100 font-medium">{cfg?.displayName ?? key}</div>
                  <div className="text-xs text-slate-500">
                    {agg.employees.size} employees · {agg.weeks.size} weeks
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={cfg?.otThresholdHrs === 50 ? 'orange' : 'gray'}>
                    {cfg?.otThresholdHrs ?? '—'} hrs / wk
                  </Badge>
                </td>
                <td className="px-5 py-3 text-right tabular-nums">{fmtHours(agg.hours)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-lw-orange-400">
                  {fmtHours(otHrs)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {regRate ? `${fmtUsd(regRate)} / ${fmtUsd(otRate)}` : '—'}
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-100">
                  {fmtUsd(agg.reg + agg.ot + agg.dt)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-5 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-800 ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

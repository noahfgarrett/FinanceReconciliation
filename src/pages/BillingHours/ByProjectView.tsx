import type { Snapshot, ProjectConfig } from '@/persistence/schemas'
import { fmtUsd, fmtHours } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Boxes } from 'lucide-react'

/** Standard US payroll workweek — always 40 regardless of project threshold */
const STANDARD_WORKWEEK = 40

export function ByProjectView({ snap, configs }: { snap: Snapshot; configs: Record<string, ProjectConfig> }) {
  type Agg = {
    hours: number
    otWorked: number
    otBilled: number
    reg: number
    ot: number
    dt: number
    employees: Set<string>
    weeks: Set<string>
  }
  const byProject = new Map<string, Agg>()
  for (const row of snap.weeklyBilling) {
    const a = byProject.get(row.projectKey) ?? {
      hours: 0, otWorked: 0, otBilled: 0, reg: 0, ot: 0, dt: 0,
      employees: new Set<string>(), weeks: new Set<string>(),
    }
    a.hours += row.hours
    a.otWorked += Math.max(0, row.hours - STANDARD_WORKWEEK)
    a.otBilled += row.otHrs
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
    <div className="mx-8 mb-8 bg-[#0a0f1c] border border-slate-800 rounded-xl overflow-hidden shadow-md animate-slide-up">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-lw-orange-500/10 border border-lw-orange-500/20 flex items-center justify-center">
            <Boxes className="w-3.5 h-3.5 text-lw-orange-300" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-100 tracking-tight">By Project</div>
            <div className="text-[10.5px] text-slate-500 uppercase tracking-[0.12em]">
              {rows.length} projects
            </div>
          </div>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-950/80 backdrop-blur z-10">
          <tr>
            <Th>Project</Th>
            <Th>OT Threshold</Th>
            <Th right>Hours</Th>
            <Th right>OT Worked</Th>
            <Th right>OT Billed</Th>
            <Th right>Rate</Th>
            <Th right>Billable</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, agg], idx) => {
            const cfg = configs[key]
            const regRate = cfg?.defaultRegularRate ?? 0
            const otRate = cfg?.otRateOverride ?? regRate * 1.5
            return (
              <tr
                key={key}
                className={`border-b border-slate-900/60 last:border-0 transition-colors hover:bg-lw-orange-500/[0.04] ${
                  idx % 2 === 1 ? 'bg-white/[0.012]' : ''
                }`}
              >
                <td className="px-5 py-3">
                  <div className="text-slate-100 font-medium tracking-tight">{cfg?.displayName ?? key}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    <span className="tabular-nums">{agg.employees.size}</span> employees · <span className="tabular-nums">{agg.weeks.size}</span> weeks
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge tone="amber">
                    {cfg?.otThresholdHrs ?? '—'} hrs / wk
                  </Badge>
                </td>
                <td className="px-5 py-3 text-right tabular-nums">{fmtHours(agg.hours)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-amber-400">
                  {fmtHours(agg.otWorked)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-lw-orange-400">
                  {fmtHours(agg.otBilled)}
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

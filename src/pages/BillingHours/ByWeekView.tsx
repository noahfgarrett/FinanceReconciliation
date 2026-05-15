import type { Snapshot, ProjectConfig } from '@/persistence/schemas'
import { fmtUsd, fmtHours } from '@/lib/format'
import { CalendarDays } from 'lucide-react'

/** Standard US payroll workweek — always 40 regardless of project threshold */
const STANDARD_WORKWEEK = 40

interface WeekAgg {
  weekStart: string
  employees: Set<string>
  projects: Set<string>
  hours: number
  otWorked: number
  otBilled: number
  billable: number
}

const WEEK_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function fmtWeek(iso: string): string {
  return WEEK_FMT.format(new Date(iso))
}

export function ByWeekView({
  snap,
}: {
  snap: Snapshot
  configs: Record<string, ProjectConfig>
}): React.ReactElement {
  const byWeek = new Map<string, WeekAgg>()
  for (const row of snap.weeklyBilling) {
    const existing = byWeek.get(row.weekStart)
    const agg: WeekAgg = existing ?? {
      weekStart: row.weekStart,
      employees: new Set<string>(),
      projects: new Set<string>(),
      hours: 0,
      otWorked: 0,
      otBilled: 0,
      billable: 0,
    }
    agg.employees.add(row.employeeCode)
    agg.projects.add(row.projectKey)
    agg.hours += row.hours
    agg.otWorked += Math.max(0, row.hours - STANDARD_WORKWEEK)
    agg.otBilled += row.otHrs
    agg.billable += row.regularDollars + row.otDollars + row.dtDollars
    byWeek.set(row.weekStart, agg)
  }

  const rows = Array.from(byWeek.values()).sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  )

  return (
    <div className="mx-8 mb-8 bg-[#0a0f1c] border border-slate-800 rounded-xl overflow-hidden shadow-md animate-slide-up">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
            <CalendarDays className="w-3.5 h-3.5 text-emerald-300" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-100 tracking-tight">By Week</div>
            <div className="text-[10.5px] text-slate-500 uppercase tracking-[0.12em]">
              {rows.length} weeks
            </div>
          </div>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-950/80 backdrop-blur z-10">
          <tr>
            <Th>Week of</Th>
            <Th right># Employees</Th>
            <Th right># Projects</Th>
            <Th right>Total Hours</Th>
            <Th right>OT Worked</Th>
            <Th right>OT Billed</Th>
            <Th right>Total Billable</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((agg, idx) => (
            <tr
              key={agg.weekStart}
              className={`border-b border-slate-900/60 last:border-0 transition-colors hover:bg-lw-orange-500/[0.04] ${
                idx % 2 === 1 ? 'bg-white/[0.012]' : ''
              }`}
            >
              <td className="px-5 py-3">
                <div className="text-slate-100 font-medium">{fmtWeek(agg.weekStart)}</div>
                <div className="text-xs text-slate-500 font-mono">{agg.weekStart}</div>
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-slate-300">
                {agg.employees.size}
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-slate-300">
                {agg.projects.size}
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-slate-300">
                {fmtHours(agg.hours)}
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-amber-400">
                {fmtHours(agg.otWorked)}
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-lw-orange-400">
                {fmtHours(agg.otBilled)}
              </td>
              <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-100">
                {fmtUsd(agg.billable)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }): React.ReactElement {
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

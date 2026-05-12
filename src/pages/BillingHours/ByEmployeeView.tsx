import { Fragment, useState } from 'react'
import { ChevronRight, ChevronDown, Users } from 'lucide-react'
import type { Snapshot, ProjectConfig } from '@/persistence/schemas'
import { fmtUsd, fmtHours } from '@/lib/format'

interface EmployeeAgg {
  code: string
  name: string
  projects: Set<string>
  weeks: Set<string>
  hours: number
  otHrs: number
  billable: number
}

interface SubRow {
  projectKey: string
  weekStart: string
  hours: number
  otHrs: number
  billable: number
}

type SortKey = 'name' | 'projects' | 'weeks' | 'hours' | 'otHrs' | 'billable'
type SortDir = 'asc' | 'desc'

const WEEK_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function fmtWeek(iso: string): string {
  return WEEK_FMT.format(new Date(iso))
}

export function ByEmployeeView({
  snap,
  configs,
}: {
  snap: Snapshot
  configs: Record<string, ProjectConfig>
}): React.ReactElement {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('billable')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const byEmployee = new Map<string, EmployeeAgg>()
  for (const row of snap.weeklyBilling) {
    const existing = byEmployee.get(row.employeeCode)
    const agg: EmployeeAgg = existing ?? {
      code: row.employeeCode,
      name: '',
      projects: new Set<string>(),
      weeks: new Set<string>(),
      hours: 0,
      otHrs: 0,
      billable: 0,
    }
    agg.projects.add(row.projectKey)
    agg.weeks.add(row.weekStart)
    agg.hours += row.hours
    agg.otHrs += row.otHrs
    agg.billable += row.regularDollars + row.otDollars + row.dtDollars
    byEmployee.set(row.employeeCode, agg)
  }

  for (const emp of snap.employees) {
    const agg = byEmployee.get(emp.code)
    if (agg) {
      agg.name = `${emp.firstName} ${emp.lastName}`
    }
  }

  const subRowsByEmployee = new Map<string, SubRow[]>()
  for (const row of snap.weeklyBilling) {
    const list = subRowsByEmployee.get(row.employeeCode) ?? []
    list.push({
      projectKey: row.projectKey,
      weekStart: row.weekStart,
      hours: row.hours,
      otHrs: row.otHrs,
      billable: row.regularDollars + row.otDollars + row.dtDollars,
    })
    subRowsByEmployee.set(row.employeeCode, list)
  }

  const rows = Array.from(byEmployee.values()).sort((a, b) => {
    let diff = 0
    switch (sortKey) {
      case 'name': diff = a.name.localeCompare(b.name); break
      case 'projects': diff = a.projects.size - b.projects.size; break
      case 'weeks': diff = a.weeks.size - b.weeks.size; break
      case 'hours': diff = a.hours - b.hours; break
      case 'otHrs': diff = a.otHrs - b.otHrs; break
      case 'billable': diff = a.billable - b.billable; break
    }
    return sortDir === 'asc' ? diff : -diff
  })

  function handleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function toggleExpand(code: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
      return next
    })
  }

  return (
    <div className="mx-8 mb-8 bg-[#0a0f1c] border border-slate-800 rounded-xl overflow-hidden shadow-md animate-slide-up">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-lw-blue-500/10 border border-lw-blue-500/25 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-lw-blue-300" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-100 tracking-tight">By Employee</div>
            <div className="text-[10.5px] text-slate-500 uppercase tracking-[0.12em]">
              {rows.length} employees · click row to expand
            </div>
          </div>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-950/80 backdrop-blur z-10">
          <tr>
            <Th sortKey="name" active={sortKey} dir={sortDir} onSort={handleSort}>
              Employee
            </Th>
            <Th sortKey="projects" active={sortKey} dir={sortDir} onSort={handleSort} right>
              # Projects
            </Th>
            <Th sortKey="weeks" active={sortKey} dir={sortDir} onSort={handleSort} right>
              # Weeks
            </Th>
            <Th sortKey="hours" active={sortKey} dir={sortDir} onSort={handleSort} right>
              Total Hours
            </Th>
            <Th sortKey="otHrs" active={sortKey} dir={sortDir} onSort={handleSort} right>
              OT Hours
            </Th>
            <Th sortKey="billable" active={sortKey} dir={sortDir} onSort={handleSort} right>
              Total Billable
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((agg) => {
            const isOpen = expanded.has(agg.code)
            const subRows = subRowsByEmployee.get(agg.code) ?? []
            return (
              <Fragment key={agg.code}>
                <tr
                  className="border-b border-slate-900/60 last:border-0 hover:bg-slate-900/40 cursor-pointer select-none"
                  onClick={() => toggleExpand(agg.code)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <div>
                        <div className="text-slate-100 font-medium">{agg.name || agg.code}</div>
                        <div className="text-xs text-slate-500">{agg.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-300">
                    {agg.projects.size}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-300">
                    {agg.weeks.size}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-300">
                    {fmtHours(agg.hours)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-lw-orange-400">
                    {fmtHours(agg.otHrs)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-100">
                    {fmtUsd(agg.billable)}
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${agg.code}-sub`} className="border-b border-slate-900/60 last:border-0">
                    <td colSpan={6} className="px-0 py-0 bg-slate-950/50">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-800/60">
                            <th className="pl-16 pr-5 py-2 text-[10px] uppercase tracking-wider text-slate-600 font-semibold text-left">
                              Project
                            </th>
                            <th className="px-5 py-2 text-[10px] uppercase tracking-wider text-slate-600 font-semibold text-left">
                              Week of
                            </th>
                            <th className="px-5 py-2 text-[10px] uppercase tracking-wider text-slate-600 font-semibold text-right">
                              Hours
                            </th>
                            <th className="px-5 py-2 text-[10px] uppercase tracking-wider text-slate-600 font-semibold text-right">
                              OT Hours
                            </th>
                            <th className="px-5 py-2 text-[10px] uppercase tracking-wider text-slate-600 font-semibold text-right">
                              Billable
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {subRows.map((sr, i) => (
                            <tr
                              key={i}
                              className="border-b border-slate-900/40 last:border-0 hover:bg-slate-900/30"
                            >
                              <td className="pl-16 pr-5 py-2 text-slate-400">
                                {configs[sr.projectKey]?.displayName ?? sr.projectKey}
                              </td>
                              <td className="px-5 py-2 text-slate-500">{fmtWeek(sr.weekStart)}</td>
                              <td className="px-5 py-2 text-right tabular-nums text-slate-400">
                                {fmtHours(sr.hours)}
                              </td>
                              <td className="px-5 py-2 text-right tabular-nums text-lw-orange-400/80">
                                {fmtHours(sr.otHrs)}
                              </td>
                              <td className="px-5 py-2 text-right tabular-nums text-slate-300">
                                {fmtUsd(sr.billable)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({
  children,
  right,
  sortKey,
  active,
  dir,
  onSort,
}: {
  children: React.ReactNode
  right?: boolean
  sortKey: SortKey
  active: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}): React.ReactElement {
  const isActive = active === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold border-b border-slate-800 cursor-pointer select-none transition-colors ${
        isActive ? 'text-lw-orange-400' : 'text-slate-500 hover:text-slate-300'
      } ${right ? 'text-right' : 'text-left'}`}
    >
      {children}
      {isActive && <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

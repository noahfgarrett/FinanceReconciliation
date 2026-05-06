import type { Snapshot, ProjectConfig } from '@/persistence/schemas'
import { fmtUsd, fmtHours } from '@/lib/format'
import { DollarSign, Clock, Zap, Boxes } from 'lucide-react'
import type { ComponentType } from 'react'

interface TileProps {
  label: string
  value: string
  sub: string
  icon: ComponentType<{ className?: string }>
  accent: 'orange' | 'blue' | 'amber' | 'emerald'
  warn?: boolean
}

const ACCENT: Record<TileProps['accent'], { ring: string; text: string; glow: string }> = {
  orange: {
    ring: 'ring-lw-orange-500/15',
    text: 'text-lw-orange-300',
    glow: 'from-lw-orange-500/12 via-lw-orange-500/[0.04] to-transparent',
  },
  blue: {
    ring: 'ring-lw-blue-500/15',
    text: 'text-lw-blue-300',
    glow: 'from-lw-blue-500/12 via-lw-blue-500/[0.04] to-transparent',
  },
  amber: {
    ring: 'ring-amber-500/15',
    text: 'text-amber-300',
    glow: 'from-amber-500/12 via-amber-500/[0.04] to-transparent',
  },
  emerald: {
    ring: 'ring-emerald-500/15',
    text: 'text-emerald-300',
    glow: 'from-emerald-500/12 via-emerald-500/[0.04] to-transparent',
  },
}

function Tile({ label, value, sub, icon: Icon, accent, warn }: TileProps) {
  const tone = ACCENT[accent]
  return (
    <div
      className={`group relative overflow-hidden bg-[#0a0f1c] border border-slate-800 rounded-xl p-4 hover-lift ring-1 ${tone.ring}`}
    >
      {/* gradient sheen */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -inset-x-4 -top-12 h-24 bg-gradient-to-b ${tone.glow} blur-xl opacity-80 group-hover:opacity-100 transition-opacity duration-300`}
      />

      <div className="relative flex items-start justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
          {label}
        </div>
        <Icon className={`w-3.5 h-3.5 ${tone.text} opacity-80`} />
      </div>

      <div className="relative mt-3 font-display text-[28px] leading-none font-semibold text-slate-100 tabular-nums">
        {value}
      </div>

      <div
        className={`relative mt-2 text-[11px] tabular-nums ${
          warn ? 'text-amber-400' : 'text-slate-400'
        }`}
      >
        {sub}
      </div>
    </div>
  )
}

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

  return (
    <div className="grid grid-cols-4 gap-3 px-8 py-4 stagger animate-fade-in">
      <Tile
        label="Total Billable"
        value={fmtUsd(total)}
        sub={`${fmtHours(totalHrs)} · ${employees} employees`}
        icon={DollarSign}
        accent="orange"
      />
      <Tile
        label="Regular"
        value={fmtUsd(totalReg)}
        sub={fmtHours(totalHrs - otHrs)}
        icon={Clock}
        accent="blue"
      />
      <Tile
        label="Overtime"
        value={fmtUsd(totalOt + totalDt)}
        sub={`${fmtHours(otHrs)} @ 1.5×`}
        icon={Zap}
        accent="amber"
      />
      <Tile
        label="Projects"
        value={String(projects)}
        sub={unconfigured ? `${unconfigured} need rates` : 'All configured'}
        icon={Boxes}
        accent={unconfigured ? 'amber' : 'emerald'}
        warn={unconfigured > 0}
      />
    </div>
  )
}

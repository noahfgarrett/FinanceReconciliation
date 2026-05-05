import { useRef, useEffect, type KeyboardEvent } from 'react'
import type { Table, GroupingState } from '@tanstack/react-table'
import { Search, Download, AlignJustify, List, Minus } from 'lucide-react'
import type { WeeklyBilling, ProjectConfig, Employee } from '@/persistence/schemas'
import { fmtUsd } from '@/lib/format'
import type { Density } from './SpreadsheetView'
import { rowsToCsv, downloadCsv } from '@/lib/csvExport'
import { fmtHours } from '@/lib/format'

const DENSITY_ICONS: Record<Density, React.ReactNode> = {
  compact: <Minus className="w-3.5 h-3.5" />,
  normal: <List className="w-3.5 h-3.5" />,
  comfortable: <AlignJustify className="w-3.5 h-3.5" />,
}

const DENSITY_LABELS: Record<Density, string> = {
  compact: 'Compact',
  normal: 'Normal',
  comfortable: 'Comfortable',
}

const GROUP_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'No grouping' },
  { value: 'projectKey', label: 'By Project' },
  { value: 'employeeCode', label: 'By Employee' },
  { value: 'weekStart', label: 'By Week' },
]

interface ToolbarProps {
  table: Table<WeeklyBilling>
  globalFilter: string
  onGlobalFilterChange: (v: string) => void
  density: Density
  onDensityChange: (d: Density) => void
  grouping: GroupingState
  onGroupingChange: (g: GroupingState) => void
  quickFlaggedOnly: boolean
  quickErrorsOnly: boolean
  quickHasOt: boolean
  onQuickFlaggedOnly: () => void
  onQuickErrorsOnly: () => void
  onQuickHasOt: () => void
  visibleRowCount: number
  flaggedCount: number
  visibleTotal: number
  selectedRows: WeeklyBilling[]
  onBulkMarkReviewed: () => void
  configs: Record<string, ProjectConfig>
  employees: Employee[]
}

export function SpreadsheetToolbar({
  table,
  globalFilter,
  onGlobalFilterChange,
  density,
  onDensityChange,
  grouping,
  onGroupingChange,
  quickFlaggedOnly,
  quickErrorsOnly,
  quickHasOt,
  onQuickFlaggedOnly,
  onQuickErrorsOnly,
  onQuickHasOt,
  visibleRowCount,
  flaggedCount,
  visibleTotal,
  selectedRows,
  onBulkMarkReviewed,
  configs,
  employees,
}: ToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcuts: `/` to focus search, `F` to toggle flagged
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Skip if in an input/textarea
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          onGlobalFilterChange('')
          searchRef.current?.blur()
        }
        return
      }
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'f' || e.key === 'F') {
        onQuickFlaggedOnly()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onGlobalFilterChange, onQuickFlaggedOnly])

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onGlobalFilterChange('')
      searchRef.current?.blur()
    }
  }

  const handleExport = () => {
    const empMap = new Map(employees.map((e) => [e.code, e]))
    const exportRows = table.getSortedRowModel().rows
      .filter((r) => !r.getIsGrouped())
      .map((r) => r.original)

    const csv = rowsToCsv(exportRows, [
      {
        key: 'employeeCode',
        header: 'Employee',
        format: (v) => {
          const emp = empMap.get(String(v))
          return emp ? `${emp.firstName} ${emp.lastName} (${v as string})` : String(v)
        },
      },
      {
        key: 'projectKey',
        header: 'Project',
        format: (v) => configs[String(v)]?.displayName ?? String(v),
      },
      { key: 'weekStart', header: 'Week Start' },
      { key: 'hours', header: 'Total Hours', format: (v) => fmtHours(Number(v)) },
      { key: 'regularHrs', header: 'Reg Hrs', format: (v) => fmtHours(Number(v)) },
      { key: 'otHrs', header: 'OT Hrs', format: (v) => fmtHours(Number(v)) },
      { key: 'dtHrs', header: 'DT Hrs', format: (v) => fmtHours(Number(v)) },
      { key: 'regularDollars', header: 'Reg $', format: (v) => String(Number(v).toFixed(2)) },
      { key: 'otDollars', header: 'OT $', format: (v) => String(Number(v).toFixed(2)) },
      { key: 'dtDollars', header: 'DT $', format: (v) => String(Number(v).toFixed(2)) },
      { key: 'notes', header: 'Notes' },
      { key: 'reviewed', header: 'Reviewed', format: (v) => (v ? 'Yes' : 'No') },
    ])
    downloadCsv(csv, `billing-export-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const densities: Density[] = ['compact', 'normal', 'comfortable']
  const currentGroup = grouping[0] ?? ''

  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: search + density + groupby + export */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Global search */}
        <div className="relative flex-1 min-w-[180px] max-w-[320px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            ref={searchRef}
            type="text"
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search… (/)"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-lw-orange-500/60"
          />
        </div>

        {/* Density toggle */}
        <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden">
          {densities.map((d) => (
            <button
              key={d}
              onClick={() => onDensityChange(d)}
              title={DENSITY_LABELS[d]}
              className={`px-2 py-1.5 transition-colors ${
                density === d
                  ? 'bg-lw-orange-500/20 text-lw-orange-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {DENSITY_ICONS[d]}
            </button>
          ))}
        </div>

        {/* Group-by */}
        <select
          value={currentGroup}
          onChange={(e) => onGroupingChange(e.target.value ? [e.target.value] : [])}
          className="px-2.5 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-lw-orange-500/60"
        >
          {GROUP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        {/* Bulk action when rows selected */}
        {selectedRows.length > 0 && (
          <button
            onClick={onBulkMarkReviewed}
            className="px-3 py-1.5 text-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 transition-colors"
          >
            Mark {selectedRows.length} reviewed
          </button>
        )}

        {/* Export */}
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export view
        </button>
      </div>

      {/* Row 2: quick-filter chips + row count */}
      <div className="flex items-center gap-2 flex-wrap">
        <QuickChip
          label="Flagged only"
          active={quickFlaggedOnly}
          onClick={onQuickFlaggedOnly}
          tone="amber"
        />
        <QuickChip
          label="Errors only"
          active={quickErrorsOnly}
          onClick={onQuickErrorsOnly}
          tone="red"
        />
        <QuickChip
          label="Has OT"
          active={quickHasOt}
          onClick={onQuickHasOt}
          tone="orange"
        />

        <div className="flex-1" />

        <span className="text-xs text-slate-500 tabular-nums">
          {visibleRowCount} rows
          {flaggedCount > 0 && (
            <> · <span className="text-amber-400">{flaggedCount} flagged</span></>
          )}
          {' · '}
          <span className="text-slate-300">{fmtUsd(visibleTotal)} visible</span>
        </span>
      </div>
    </div>
  )
}

interface QuickChipProps {
  label: string
  active: boolean
  onClick: () => void
  tone: 'amber' | 'red' | 'orange'
}

const CHIP_TONES: Record<QuickChipProps['tone'], { active: string; inactive: string }> = {
  amber: {
    active: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    inactive: 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-400',
  },
  red: {
    active: 'bg-red-500/20 text-red-400 border-red-500/40',
    inactive: 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-400',
  },
  orange: {
    active: 'bg-lw-orange-500/20 text-lw-orange-400 border-lw-orange-500/40',
    inactive: 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-400',
  },
}

function QuickChip({ label, active, onClick, tone }: QuickChipProps) {
  const styles = CHIP_TONES[tone]
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
        active ? styles.active : styles.inactive
      }`}
    >
      {label}
    </button>
  )
}

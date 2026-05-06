import { useRef, useMemo, useState, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type GroupingState,
  type VisibilityState,
  type ExpandedState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { WeeklyBilling, ProjectConfig, Employee, RowFlag } from '@/persistence/schemas'
import { fmtUsd, fmtHours } from '@/lib/format'
import { makeColumns, severityTone } from './columns'
import { SpreadsheetToolbar } from './SpreadsheetToolbar'
import { RowDrawer } from './RowDrawer'
import { useSnapshotStore } from '@/store/snapshotStore'

export type Density = 'compact' | 'normal' | 'comfortable'

const DENSITY_ROW_HEIGHT: Record<Density, number> = {
  compact: 32,
  normal: 44,
  comfortable: 56,
}

const DENSITY_CELL_PY: Record<Density, string> = {
  compact: 'py-1',
  normal: 'py-2.5',
  comfortable: 'py-4',
}

const FLAG_TINT: Record<'error' | 'warn' | 'info', string> = {
  error: 'rgba(239,68,68,0.04)',
  warn: 'rgba(245,158,11,0.04)',
  info: 'rgba(59,130,246,0.04)',
}

interface ConfidenceDotProps {
  confidence: number
  reasons: string[]
}

function ConfidenceDot({ confidence, reasons }: ConfidenceDotProps) {
  const tone =
    confidence >= 0.85 ? 'bg-emerald-400' :
    confidence >= 0.6 ? 'bg-amber-400' : 'bg-red-400'
  const pct = `${Math.round(confidence * 100)}%`
  const tooltipReasons = reasons.slice(0, 2).join(' · ')
  const tooltip = tooltipReasons ? `${pct} confidence — ${tooltipReasons}` : `${pct} confidence`
  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1.5 cursor-help"
    >
      <span className={`inline-block w-2 h-2 rounded-full ${tone}`} aria-label={tooltip} />
      <span className="text-[10px] text-slate-500 tabular-nums">{pct}</span>
    </span>
  )
}

function FlagChips({ flags }: { flags: RowFlag[] }) {
  if (flags.length === 0) return null
  const first = flags[0]
  const tone = first.severity === 'error' ? 'text-red-400' : first.severity === 'warn' ? 'text-amber-400' : 'text-blue-400'
  const bg = first.severity === 'error' ? 'bg-red-500/15' : first.severity === 'warn' ? 'bg-amber-500/15' : 'bg-blue-500/15'
  return (
    <div className="flex items-center gap-1">
      <span
        title={flags.map((f) => `[${f.severity.toUpperCase()}] ${f.message}`).join('\n')}
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${tone} ${bg} cursor-help`}
      >
        {first.code.replace(/-/g, ' ')}
        {flags.length > 1 && <span className="ml-1 opacity-70">+{flags.length - 1}</span>}
      </span>
    </div>
  )
}

interface NoteCellProps {
  value: string
  row: WeeklyBilling
  onNoteChange: (row: WeeklyBilling, value: string) => void
  locked: boolean
}

function NoteCell({ value, row, onNoteChange, locked }: NoteCellProps) {
  const [localVal, setLocalVal] = useState(value)
  const handleBlur = () => {
    if (!locked && localVal !== value) onNoteChange(row, localVal)
  }
  return (
    <input
      className="w-full bg-transparent text-slate-300 text-sm outline-none focus:bg-slate-800/60 px-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
      value={locked ? value : localVal}
      onChange={(e) => { if (!locked) setLocalVal(e.target.value) }}
      onBlur={handleBlur}
      placeholder="—"
      disabled={locked}
      title={locked ? 'Snapshot is locked' : undefined}
    />
  )
}

interface ReviewedCellProps {
  value: boolean
  row: WeeklyBilling
  onReviewedChange: (row: WeeklyBilling, value: boolean) => void
  locked: boolean
}

function ReviewedCell({ value, row, onReviewedChange, locked }: ReviewedCellProps) {
  return (
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => { if (!locked) onReviewedChange(row, e.target.checked) }}
      className="accent-lw-orange-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      disabled={locked}
      title={locked ? 'Snapshot is locked' : undefined}
    />
  )
}

interface SelectCellProps {
  checked: boolean
  indeterminate?: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function SelectCell({ checked, indeterminate, onChange }: SelectCellProps) {
  const ref = useRef<HTMLInputElement>(null)
  if (ref.current) ref.current.indeterminate = indeterminate ?? false
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="accent-lw-orange-500 cursor-pointer"
    />
  )
}

interface Props {
  rows: WeeklyBilling[]
  configs: Record<string, ProjectConfig>
  employees: Employee[]
}

export function SpreadsheetView({ rows, configs, employees }: Props) {
  const appendAudit = useSnapshotStore((s) => s.appendAudit)
  const current = useSnapshotStore((s) => s.current)

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [grouping, setGrouping] = useState<GroupingState>([])
  const [density, setDensity] = useState<Density>('normal')
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [drawerRow, setDrawerRow] = useState<WeeklyBilling | null>(null)
  const [quickFlaggedOnly, setQuickFlaggedOnly] = useState(false)
  const [quickErrorsOnly, setQuickErrorsOnly] = useState(false)
  const [quickHasOt, setQuickHasOt] = useState(false)
  const [quickNeedsReview, setQuickNeedsReview] = useState(false)

  const hasDt = useMemo(() => rows.some((r) => r.dtHrs > 0), [rows])

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    dtHrs: hasDt,
  })

  const isLocked = current?.locked ?? false

  const handleNoteChange = useCallback(
    (row: WeeklyBilling, value: string) => {
      if (!current || current.locked) return
      const updated = current.weeklyBilling.map((r) =>
        r.employeeCode === row.employeeCode &&
        r.projectKey === row.projectKey &&
        r.weekStart === row.weekStart
          ? { ...r, notes: value }
          : r,
      )
      appendAudit('manual-edit', `Note updated for ${row.employeeCode}/${row.projectKey}/${row.weekStart}`)
      // Update store's current snapshot inline
      useSnapshotStore.setState((s) => ({
        current: s.current ? { ...s.current, weeklyBilling: updated } : null,
      }))
    },
    [current, appendAudit],
  )

  const handleReviewedChange = useCallback(
    (row: WeeklyBilling, value: boolean) => {
      if (!current || current.locked) return
      const updated = current.weeklyBilling.map((r) =>
        r.employeeCode === row.employeeCode &&
        r.projectKey === row.projectKey &&
        r.weekStart === row.weekStart
          ? { ...r, reviewed: value }
          : r,
      )
      appendAudit('manual-edit', `Reviewed=${value} for ${row.employeeCode}/${row.projectKey}/${row.weekStart}`)
      useSnapshotStore.setState((s) => ({
        current: s.current ? { ...s.current, weeklyBilling: updated } : null,
      }))
    },
    [current, appendAudit],
  )

  const columns = useMemo(
    () =>
      makeColumns({
        configs,
        employees,
        onNoteChange: handleNoteChange,
        onReviewedChange: handleReviewedChange,
        hasDt,
        locked: isLocked,
      }),
    [configs, employees, handleNoteChange, handleReviewedChange, hasDt, isLocked],
  )

  // Apply quick filters on top of the row data
  const filteredRows = useMemo(() => {
    let result = rows
    if (quickFlaggedOnly) result = result.filter((r) => r.flags.length > 0)
    if (quickErrorsOnly) result = result.filter((r) => r.flags.some((f) => f.severity === 'error'))
    if (quickHasOt) result = result.filter((r) => r.otHrs > 0)
    if (quickNeedsReview) result = result.filter((r) => r.confidence < 0.85)
    return result
  }, [rows, quickFlaggedOnly, quickErrorsOnly, quickHasOt, quickNeedsReview])

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
      grouping,
      columnVisibility,
      expanded,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onGroupingChange: setGrouping,
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    isMultiSortEvent: (e) => (e as React.MouseEvent).shiftKey,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
  })

  const { rows: tableRows } = table.getRowModel()

  const scrollRef = useRef<HTMLDivElement>(null)
  const rowHeight = DENSITY_ROW_HEIGHT[density]

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Footer totals over visible filtered rows
  const visibleData = table.getFilteredRowModel().rows.map((r) => r.original)
  const footerTotals = useMemo(() => {
    let hours = 0
    let regularDollars = 0
    let otDollars = 0
    let dtDollars = 0
    for (const r of visibleData) {
      hours += r.hours
      regularDollars += r.regularDollars
      otDollars += r.otDollars
      dtDollars += r.dtDollars
    }
    return { hours, total: regularDollars + otDollars + dtDollars, regularDollars, otDollars }
  }, [visibleData])

  const flaggedCount = visibleData.filter((r) => r.flags.length > 0).length

  const cellPy = DENSITY_CELL_PY[density]

  // Handle bulk mark reviewed
  const selectedRows = Object.keys(rowSelection)
    .map((idx) => tableRows[Number(idx)]?.original)
    .filter((r): r is WeeklyBilling => r != null)

  const handleBulkMarkReviewed = () => {
    if (!current || current.locked) return
    const keySet = new Set(
      selectedRows.map((r) => `${r.employeeCode}|${r.projectKey}|${r.weekStart}`),
    )
    const updated = current.weeklyBilling.map((r) =>
      keySet.has(`${r.employeeCode}|${r.projectKey}|${r.weekStart}`) ? { ...r, reviewed: true } : r,
    )
    appendAudit('manual-edit', `Bulk marked ${selectedRows.length} rows as reviewed`)
    useSnapshotStore.setState((s) => ({
      current: s.current ? { ...s.current, weeklyBilling: updated } : null,
    }))
    setRowSelection({})
  }

  return (
    <div className="flex flex-col gap-3">
      <SpreadsheetToolbar
        table={table}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        density={density}
        onDensityChange={setDensity}
        grouping={grouping}
        onGroupingChange={setGrouping}
        quickFlaggedOnly={quickFlaggedOnly}
        quickErrorsOnly={quickErrorsOnly}
        quickHasOt={quickHasOt}
        quickNeedsReview={quickNeedsReview}
        onQuickFlaggedOnly={() => setQuickFlaggedOnly((v) => !v)}
        onQuickErrorsOnly={() => setQuickErrorsOnly((v) => !v)}
        onQuickHasOt={() => setQuickHasOt((v) => !v)}
        onQuickNeedsReview={() => setQuickNeedsReview((v) => !v)}
        visibleRowCount={visibleData.length}
        flaggedCount={flaggedCount}
        visibleTotal={footerTotals.total}
        selectedRows={selectedRows}
        onBulkMarkReviewed={handleBulkMarkReviewed}
        configs={configs}
        employees={employees}
      />

      <div
        ref={scrollRef}
        className="relative overflow-auto rounded-xl border border-slate-800"
        style={{ maxHeight: 'calc(100vh - 340px)' }}
      >
        <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-10 bg-slate-950">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const align = header.column.columnDef.meta?.align
                  const isSorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize(), position: 'relative' }}
                      className={`px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-800 select-none whitespace-nowrap ${
                        align === 'right' ? 'text-right' : 'text-left'
                      } ${header.column.getCanSort() ? 'cursor-pointer hover:text-slate-300' : ''}`}
                      onClick={header.column.getToggleSortingHandler()}
                      title={header.column.getCanSort() ? 'Shift+click for multi-sort' : undefined}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {isSorted === 'asc' && ' ↑'}
                      {isSorted === 'desc' && ' ↓'}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:opacity-100 bg-lw-orange-500/50"
                        />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody style={{ height: totalSize, position: 'relative' }}>
            {tableRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-16 text-center text-slate-500 text-sm"
                >
                  No rows match the current filters
                </td>
              </tr>
            )}
            {virtualItems.map((vItem) => {
              const row = tableRows[vItem.index]
              if (!row) return null
              const isGroupRow = row.getIsGrouped()
              const originalRow = row.original
              const tone = isGroupRow ? null : severityTone(originalRow?.flags ?? [])
              const tintBg = tone ? FLAG_TINT[tone] : undefined

              return (
                <tr
                  key={row.id}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  className="border-b border-slate-900/60 last:border-0 hover:bg-slate-900/30 transition-colors"
                  style={{
                    position: 'absolute',
                    top: vItem.start,
                    left: 0,
                    width: '100%',
                    background: tintBg,
                    cursor: isGroupRow ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (isGroupRow) {
                      row.toggleExpanded()
                    } else if (originalRow) {
                      setDrawerRow(originalRow)
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id
                    const align = cell.column.columnDef.meta?.align
                    const isDim = cell.column.columnDef.meta?.dim

                    // Render special cell types
                    if (colId === 'select') {
                      if (isGroupRow) {
                        return (
                          <td key={cell.id} className={`px-3 ${cellPy}`} style={{ width: cell.column.getSize() }}>
                            <span
                              className="text-slate-500 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                row.toggleExpanded()
                              }}
                            >
                              {row.getIsExpanded() ? '▼' : '▶'}
                            </span>
                          </td>
                        )
                      }
                      return (
                        <td
                          key={cell.id}
                          className={`px-3 ${cellPy}`}
                          style={{ width: cell.column.getSize() }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SelectCell
                            checked={row.getIsSelected()}
                            onChange={row.getToggleSelectedHandler()}
                          />
                        </td>
                      )
                    }

                    if (colId === 'flags') {
                      if (isGroupRow) {
                        return (
                          <td
                            key={cell.id}
                            className={`px-3 ${cellPy} text-slate-500 text-xs`}
                            style={{ width: cell.column.getSize() }}
                            colSpan={isGroupRow ? 1 : undefined}
                          >
                            {row.subRows.length} rows
                          </td>
                        )
                      }
                      return (
                        <td key={cell.id} className={`px-3 ${cellPy}`} style={{ width: cell.column.getSize() }}>
                          <FlagChips flags={originalRow?.flags ?? []} />
                        </td>
                      )
                    }

                    if (colId === 'confidence') {
                      if (isGroupRow || !originalRow) {
                        return <td key={cell.id} className={`px-3 ${cellPy}`} style={{ width: cell.column.getSize() }} />
                      }
                      return (
                        <td key={cell.id} className={`px-3 ${cellPy}`} style={{ width: cell.column.getSize() }}>
                          <ConfidenceDot
                            confidence={originalRow.confidence ?? 1}
                            reasons={originalRow.confidenceReasons ?? []}
                          />
                        </td>
                      )
                    }

                    if (colId === 'notes') {
                      if (isGroupRow || !originalRow) {
                        return <td key={cell.id} className={`px-3 ${cellPy}`} style={{ width: cell.column.getSize() }} />
                      }
                      return (
                        <td
                          key={cell.id}
                          className={`px-3 ${cellPy}`}
                          style={{ width: cell.column.getSize() }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <NoteCell
                            value={originalRow.notes ?? ''}
                            row={originalRow}
                            onNoteChange={handleNoteChange}
                            locked={isLocked}
                          />
                        </td>
                      )
                    }

                    if (colId === 'reviewed') {
                      if (isGroupRow || !originalRow) {
                        return <td key={cell.id} className={`px-3 ${cellPy}`} style={{ width: cell.column.getSize() }} />
                      }
                      return (
                        <td
                          key={cell.id}
                          className={`px-3 ${cellPy} text-right`}
                          style={{ width: cell.column.getSize() }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ReviewedCell
                            value={!!originalRow.reviewed}
                            row={originalRow}
                            onReviewedChange={handleReviewedChange}
                            locked={isLocked}
                          />
                        </td>
                      )
                    }

                    if (isGroupRow) {
                      // For grouped rows, only show value in the grouping column
                      if (cell.column.id === row.groupingColumnId) {
                        return (
                          <td
                            key={cell.id}
                            className={`px-3 ${cellPy} font-semibold text-slate-200`}
                            style={{ width: cell.column.getSize() }}
                            colSpan={1}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )
                      }
                      return (
                        <td key={cell.id} className={`px-3 ${cellPy}`} style={{ width: cell.column.getSize() }} />
                      )
                    }

                    // otHrs — orange tint when > 0
                    const extraClass =
                      colId === 'otHrs' && originalRow?.otHrs > 0 ? ' text-lw-orange-400' : ''

                    return (
                      <td
                        key={cell.id}
                        className={`px-3 ${cellPy} tabular-nums ${align === 'right' ? 'text-right' : ''} ${isDim ? 'text-slate-500' : 'text-slate-200'} ${colId === 'totalDollars' ? 'font-semibold' : ''}${extraClass}`}
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-950 border-t border-slate-700 z-10">
            <tr>
              {table.getHeaderGroups()[0]?.headers.map((header) => {
                const colId = header.id
                const align = header.column.columnDef.meta?.align
                if (colId === 'hours') {
                  return (
                    <td key={colId} className={`px-3 py-2 text-xs font-semibold tabular-nums text-slate-300 ${align === 'right' ? 'text-right' : ''}`} style={{ width: header.getSize() }}>
                      {fmtHours(footerTotals.hours)}
                    </td>
                  )
                }
                if (colId === 'regularDollars') {
                  return (
                    <td key={colId} className="px-3 py-2 text-xs font-semibold tabular-nums text-slate-300 text-right" style={{ width: header.getSize() }}>
                      {fmtUsd(footerTotals.regularDollars)}
                    </td>
                  )
                }
                if (colId === 'otDollars') {
                  return (
                    <td key={colId} className="px-3 py-2 text-xs font-semibold tabular-nums text-lw-orange-400 text-right" style={{ width: header.getSize() }}>
                      {fmtUsd(footerTotals.otDollars)}
                    </td>
                  )
                }
                if (colId === 'totalDollars') {
                  return (
                    <td key={colId} className="px-3 py-2 text-xs font-bold tabular-nums text-slate-100 text-right" style={{ width: header.getSize() }}>
                      {fmtUsd(footerTotals.total)}
                    </td>
                  )
                }
                if (colId === 'employeeCode') {
                  return (
                    <td key={colId} className="px-3 py-2 text-xs text-slate-500" style={{ width: header.getSize() }}>
                      {visibleData.length} rows
                    </td>
                  )
                }
                return (
                  <td key={colId} className="px-3 py-2" style={{ width: header.getSize() }} />
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {drawerRow && (
        <RowDrawer
          row={drawerRow}
          configs={configs}
          employees={employees}
          parsedPdfs={current?.parsedPdfs ?? []}
          onClose={() => setDrawerRow(null)}
          onNoteChange={handleNoteChange}
          onReviewedChange={handleReviewedChange}
        />
      )}
    </div>
  )
}

import type { ColumnDef } from '@tanstack/react-table'
import type { WeeklyBilling, ProjectConfig, Employee, RowFlag } from '@/persistence/schemas'
import { fmtUsd, fmtHours } from '@/lib/format'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    numeric?: boolean
    selectOptions?: Array<{ value: string; label: string }>
    align?: 'left' | 'right'
    dim?: boolean
  }
}

export interface MakeColumnsOptions {
  configs: Record<string, ProjectConfig>
  employees: Employee[]
  /** Called when user edits a note cell */
  onNoteChange: (row: WeeklyBilling, value: string) => void
  /** Called when user toggles the reviewed checkbox */
  onReviewedChange: (row: WeeklyBilling, value: boolean) => void
  /** Whether any row has DT hours (controls dtHrs visibility) */
  hasDt: boolean
  /** When true, note and reviewed cells are read-only */
  locked: boolean
}

export function severityTone(flags: RowFlag[]): 'error' | 'warn' | 'info' | null {
  if (flags.some((f) => f.severity === 'error')) return 'error'
  if (flags.some((f) => f.severity === 'warn')) return 'warn'
  if (flags.some((f) => f.severity === 'info')) return 'info'
  return null
}

/** Format week start date as "Mon DD" e.g. "Apr 07" */
function fmtWeek(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' })
}

export function makeColumns(opts: MakeColumnsOptions): ColumnDef<WeeklyBilling>[] {
  const { configs, employees, onNoteChange, onReviewedChange, hasDt, locked } = opts

  const empMap = new Map<string, Employee>()
  for (const e of employees) empMap.set(e.code, e)

  const projectOptions = Object.values(configs).map((c) => ({
    value: c.projectKey,
    label: c.displayName,
  }))

  const employeeOptions = employees.map((e) => ({
    value: e.code,
    label: `${e.firstName} ${e.lastName}`,
  }))

  const cols: ColumnDef<WeeklyBilling>[] = [
    // Select checkbox
    {
      id: 'select',
      header: undefined,
      cell: undefined,
      enableResizing: false,
      size: 40,
    },

    // Flags column — rendered via row.original.flags in SpreadsheetView
    {
      id: 'flags',
      header: '',
      accessorFn: (row) => row.flags.length,
      cell: (info) => info.row.original.flags,
      enableSorting: false,
      enableColumnFilter: false,
      size: 80,
    },

    // Employee
    {
      id: 'employeeCode',
      header: 'Employee',
      accessorKey: 'employeeCode',
      cell: (info) => {
        const code = info.row.original.employeeCode
        const emp = empMap.get(code)
        return emp ? `${emp.firstName} ${emp.lastName} (${code})` : code
      },
      meta: { selectOptions: employeeOptions },
      size: 200,
    },

    // Project
    {
      id: 'projectKey',
      header: 'Project',
      accessorKey: 'projectKey',
      cell: (info) => configs[info.row.original.projectKey]?.displayName ?? info.row.original.projectKey,
      meta: { selectOptions: projectOptions },
      size: 180,
    },

    // Week
    {
      id: 'weekStart',
      header: 'Week',
      accessorKey: 'weekStart',
      cell: (info) => fmtWeek(info.row.original.weekStart),
      size: 90,
    },

    // Hours (total)
    {
      id: 'hours',
      header: 'Hours',
      accessorKey: 'hours',
      cell: (info) => fmtHours(info.row.original.hours),
      meta: { numeric: true, align: 'right' },
      size: 90,
    },

    // Regular hours
    {
      id: 'regularHrs',
      header: 'Reg Hrs',
      accessorKey: 'regularHrs',
      cell: (info) => fmtHours(info.row.original.regularHrs),
      meta: { numeric: true, align: 'right', dim: true },
      size: 90,
    },

    // OT hours
    {
      id: 'otHrs',
      header: 'OT Hrs',
      accessorKey: 'otHrs',
      cell: (info) => fmtHours(info.row.original.otHrs),
      meta: { numeric: true, align: 'right' },
      size: 90,
    },

    // Regular dollars
    {
      id: 'regularDollars',
      header: 'Reg $',
      accessorKey: 'regularDollars',
      cell: (info) => fmtUsd(info.row.original.regularDollars),
      meta: { numeric: true, align: 'right' },
      size: 100,
    },

    // OT dollars
    {
      id: 'otDollars',
      header: 'OT $',
      accessorKey: 'otDollars',
      cell: (info) => fmtUsd(info.row.original.otDollars),
      meta: { numeric: true, align: 'right' },
      size: 100,
    },

    // Total $
    {
      id: 'totalDollars',
      header: 'Total $',
      accessorFn: (row) => row.regularDollars + row.otDollars + row.dtDollars,
      cell: (info) => {
        const row = info.row.original
        return fmtUsd(row.regularDollars + row.otDollars + row.dtDollars)
      },
      meta: { numeric: true, align: 'right' },
      size: 110,
    },

    // Notes (inline editable)
    {
      id: 'notes',
      header: 'Notes',
      accessorKey: 'notes',
      cell: (info) => ({
        type: 'notes',
        value: info.row.original.notes ?? '',
        row: info.row.original,
        onNoteChange,
        locked,
      }),
      enableSorting: false,
      size: 200,
    },

    // Reviewed checkbox
    {
      id: 'reviewed',
      header: 'Reviewed',
      accessorKey: 'reviewed',
      cell: (info) => ({
        type: 'reviewed',
        value: info.row.original.reviewed,
        row: info.row.original,
        onReviewedChange,
        locked,
      }),
      size: 90,
      meta: { align: 'right' },
    },
  ]

  // DT hours (hidden unless any row has DT)
  if (hasDt) {
    cols.splice(8, 0, {
      id: 'dtHrs',
      header: 'DT Hrs',
      accessorKey: 'dtHrs',
      cell: (info) => fmtHours(info.row.original.dtHrs),
      meta: { numeric: true, align: 'right' },
      size: 90,
    })
  }

  return cols
}

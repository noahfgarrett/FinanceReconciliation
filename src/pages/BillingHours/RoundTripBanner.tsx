import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Snapshot } from '@/persistence/schemas'
import { fmtUsd } from '@/lib/format'

interface Props {
  snap: Snapshot
}

interface Totals {
  byProject: number
  byEmployee: number
  rowTotal: number
}

function computeTotals(snap: Snapshot): Totals {
  let byProject = 0
  let byEmployee = 0
  let rowTotal = 0

  const byProjectMap = new Map<string, number>()
  const byEmployeeMap = new Map<string, number>()

  for (const row of snap.weeklyBilling) {
    const rowBillable = row.regularDollars + row.otDollars + row.dtDollars
    rowTotal += rowBillable

    const prevProject = byProjectMap.get(row.projectKey) ?? 0
    byProjectMap.set(row.projectKey, prevProject + rowBillable)

    const prevEmployee = byEmployeeMap.get(row.employeeCode) ?? 0
    byEmployeeMap.set(row.employeeCode, prevEmployee + rowBillable)
  }

  for (const v of byProjectMap.values()) byProject += v
  for (const v of byEmployeeMap.values()) byEmployee += v

  return { byProject, byEmployee, rowTotal }
}

const THRESHOLD = 0.01

export function RoundTripBanner({ snap }: Props): React.JSX.Element | null {
  const totals = useMemo(() => computeTotals(snap), [snap])

  const mismatch =
    Math.abs(totals.byProject - totals.byEmployee) > THRESHOLD ||
    Math.abs(totals.byProject - totals.rowTotal) > THRESHOLD ||
    Math.abs(totals.byEmployee - totals.rowTotal) > THRESHOLD

  if (!mismatch) return null

  return (
    <div className="mx-8 mt-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-300">
        <span className="font-semibold">Totals don&apos;t match:</span> by-project{' '}
        {fmtUsd(totals.byProject)}, by-employee {fmtUsd(totals.byEmployee)}, sum{' '}
        {fmtUsd(totals.rowTotal)}. Likely a parsing issue — review the Spreadsheet view for flagged
        rows.
      </p>
    </div>
  )
}

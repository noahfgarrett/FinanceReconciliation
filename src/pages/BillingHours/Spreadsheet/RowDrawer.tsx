import { useEffect, useState } from 'react'
import { X, ScanSearch } from 'lucide-react'
import type {
  WeeklyBilling, ProjectConfig, Employee, ParsedPdfWithBytes,
} from '@/persistence/schemas'
import { Badge } from '@/components/ui/Badge'
import { fmtHours } from '@/lib/format'
import { PdfSourceViewer } from '@/components/PdfSourceViewer'

interface RowDrawerProps {
  row: WeeklyBilling
  configs: Record<string, ProjectConfig>
  employees: Employee[]
  parsedPdfs: ParsedPdfWithBytes[]
  onClose: () => void
  onNoteChange: (row: WeeklyBilling, value: string) => void
  onReviewedChange: (row: WeeklyBilling, value: boolean) => void
}

function fmtWeekLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function RowDrawer({
  row,
  configs,
  employees,
  parsedPdfs,
  onClose,
  onNoteChange,
  onReviewedChange,
}: RowDrawerProps) {
  const [visible, setVisible] = useState(false)
  const [localNote, setLocalNote] = useState(row.notes ?? '')
  const [localReviewed, setLocalReviewed] = useState(row.reviewed)
  const [sourceOpen, setSourceOpen] = useState(false)

  useEffect(() => {
    // Trigger transition after mount
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    setLocalNote(row.notes ?? '')
    setLocalReviewed(row.reviewed)
  }, [row])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const handleNoteBlur = () => {
    if (localNote !== (row.notes ?? '')) {
      onNoteChange(row, localNote)
    }
  }

  const handleReviewedToggle = (v: boolean) => {
    setLocalReviewed(v)
    onReviewedChange(row, v)
  }

  // Look up employee name
  const emp = employees.find((e) => e.code === row.employeeCode)
  const empName = emp ? `${emp.firstName} ${emp.lastName}` : row.employeeCode
  const projectName = configs[row.projectKey]?.displayName ?? row.projectKey
  const config = configs[row.projectKey]

  // Find matching PDF entries for this employee/week
  const relevantPdfs = parsedPdfs.filter((p) => p.employeeCode === row.employeeCode)
  const matchingEntries = relevantPdfs.flatMap((p) =>
    p.entries.filter((entry) => {
      if (entry.weekStart !== row.weekStart) return false
      // Match by allocation alias if config available
      const aliases = config?.allocationAliases ?? []
      return aliases.length === 0 || aliases.some((a) => entry.allocation.includes(a) || a.includes(entry.allocation))
    }),
  )

  // PDF bytes for source viewer (first matching PDF for this employee, if any)
  const sourcePdfBytes = relevantPdfs[0]?.pdfBytes ?? null
  const sourcePdfName = relevantPdfs[0]
    ? `${relevantPdfs[0].employeeName} (${relevantPdfs[0].employeeCode})`
    : undefined
  const confidencePct = Math.round((row.confidence ?? 1) * 100)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed right-0 top-0 h-full w-[420px] max-w-full bg-[#0a0f1c] border-l border-slate-800 z-50 flex flex-col shadow-2xl transition-transform duration-200 ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <div className="text-base font-semibold text-slate-100">{empName}</div>
            <div className="text-sm text-slate-400 mt-0.5">
              {projectName} · <span className="text-slate-500">Week of {fmtWeekLong(row.weekStart)}</span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Hours summary */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Hours Summary</h3>
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total" value={fmtHours(row.hours)} />
              <StatCard label="Regular" value={fmtHours(row.regularHrs)} />
              <StatCard label="OT" value={fmtHours(row.otHrs)} accent={row.otHrs > 0} />
              {row.dtHrs > 0 && <StatCard label="DT" value={fmtHours(row.dtHrs)} accent />}
            </div>
          </section>

          {/* Source verification */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                Source verification
              </h3>
              <span
                className={`text-[11px] tabular-nums ${
                  confidencePct >= 85
                    ? 'text-emerald-400'
                    : confidencePct >= 60
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {confidencePct}% confidence
              </span>
            </div>
            <button
              onClick={() => setSourceOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-colors"
            >
              <ScanSearch className="w-4 h-4" />
              View source
              {row.sources && row.sources.length > 0 && (
                <span className="text-xs text-slate-500">
                  ({row.sources.length} highlight{row.sources.length === 1 ? '' : 's'})
                </span>
              )}
            </button>
            {row.confidenceReasons && row.confidenceReasons.length > 0 && (
              <ul className="mt-2 text-xs text-slate-400 list-disc pl-4 space-y-0.5">
                {row.confidenceReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </section>

          {/* PDF Entries */}
          {matchingEntries.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
                PDF Timesheet Entries
              </h3>
              <div className="flex flex-col gap-1.5">
                {matchingEntries.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-lg text-sm"
                  >
                    <div className="text-slate-400">{entry.date}</div>
                    <div className="text-slate-500 text-xs">{entry.payCode}</div>
                    <div className="text-slate-500 text-xs truncate max-w-[100px]">{entry.allocation}</div>
                    <div className="tabular-nums text-slate-200 font-medium">{fmtHours(entry.hoursTotal)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Flags */}
          {row.flags.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
                Flags ({row.flags.length})
              </h3>
              <div className="flex flex-col gap-2">
                {row.flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 bg-slate-900/60 rounded-lg">
                    <Badge
                      tone={
                        flag.severity === 'error' ? 'red' : flag.severity === 'warn' ? 'amber' : 'blue'
                      }
                    >
                      {flag.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-slate-400 mb-0.5">{flag.code}</div>
                      <div className="text-sm text-slate-300">{flag.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notes */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Notes</h3>
            <textarea
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Add a note…"
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-lw-orange-500/60 resize-none"
            />
          </section>

          {/* Reviewed */}
          <section>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localReviewed}
                onChange={(e) => handleReviewedToggle(e.target.checked)}
                className="accent-lw-orange-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-sm text-slate-300">Mark as reviewed</span>
              {localReviewed && (
                <Badge tone="green">Reviewed</Badge>
              )}
            </label>
          </section>
        </div>
      </div>

      <PdfSourceViewer
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
        pdfBytes={sourcePdfBytes}
        highlights={row.sources ?? []}
        fileName={sourcePdfName}
      />
    </>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-slate-900/60 rounded-lg px-3 py-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className={`tabular-nums font-semibold text-sm ${accent ? 'text-lw-orange-400' : 'text-slate-200'}`}>
        {value}
      </div>
    </div>
  )
}

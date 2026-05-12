import { useState, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { ConflictField, ConflictRecord, ResolvedConflict } from '@/lib/conflictDetection'

interface ConflictReviewModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (resolved: ResolvedConflict[]) => void
  title: string
  conflicts: ConflictRecord[]
  unchangedCount: number
  newCount: number
}

/**
 * Local state for tracking which fields the user has toggled accept/keep.
 * Keyed by `${recordId}::${fieldKey}`.
 */
type FieldToggleMap = Record<string, boolean>

function buildToggleKey(recordId: string, fieldKey: string): string {
  return `${recordId}::${fieldKey}`
}

function buildInitialToggles(conflicts: ConflictRecord[]): FieldToggleMap {
  const map: FieldToggleMap = {}
  for (const record of conflicts) {
    for (const field of record.fields) {
      map[buildToggleKey(record.id, field.key)] = field.accept
    }
  }
  return map
}

export function ConflictReviewModal({
  open,
  onClose,
  onConfirm,
  title,
  conflicts,
  unchangedCount,
  newCount,
}: ConflictReviewModalProps): React.JSX.Element | null {
  const [toggles, setToggles] = useState<FieldToggleMap>(() => buildInitialToggles(conflicts))
  const [hasReviewed, setHasReviewed] = useState(false)

  // Reset state when conflicts change
  const resetToggles = useCallback(
    (newConflicts: ConflictRecord[]) => {
      setToggles(buildInitialToggles(newConflicts))
      setHasReviewed(false)
    },
    [],
  )

  // If the conflicts reference changed, rebuild toggles
  // (this is safe because the parent re-creates the array on each import)
  const [prevConflicts, setPrevConflicts] = useState(conflicts)
  if (conflicts !== prevConflicts) {
    setPrevConflicts(conflicts)
    resetToggles(conflicts)
  }

  const toggleField = useCallback((recordId: string, fieldKey: string, accept: boolean): void => {
    setToggles((prev) => ({
      ...prev,
      [buildToggleKey(recordId, fieldKey)]: accept,
    }))
    setHasReviewed(true)
  }, [])

  const acceptAll = useCallback((): void => {
    setToggles((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        next[key] = true
      }
      return next
    })
    setHasReviewed(true)
  }, [])

  const keepAll = useCallback((): void => {
    setToggles((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        next[key] = false
      }
      return next
    })
    setHasReviewed(true)
  }, [])

  const handleConfirm = useCallback((): void => {
    const resolved: ResolvedConflict[] = conflicts.map((record) => {
      const resolvedFields: Record<string, string | number | undefined> = {}
      for (const field of record.fields) {
        const accept = toggles[buildToggleKey(record.id, field.key)] ?? field.accept
        resolvedFields[field.key] = accept ? field.incomingValue : field.currentValue
      }
      return { id: record.id, resolvedFields }
    })
    onConfirm(resolved)
  }, [conflicts, toggles, onConfirm])

  return (
    <Modal open={open} onClose={onClose} title={title} width="3xl">
      <div className="px-5 py-3 border-b border-slate-800 space-y-2">
        {/* Count badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge tone="amber">{conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} found</Badge>
          {newCount > 0 && (
            <Badge tone="green">{newCount} new record{newCount !== 1 ? 's' : ''}</Badge>
          )}
          {unchangedCount > 0 && (
            <Badge tone="gray">{unchangedCount} record{unchangedCount !== 1 ? 's' : ''} unchanged</Badge>
          )}
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={acceptAll}>
            Accept All Changes
          </Button>
          <Button size="sm" variant="ghost" onClick={keepAll}>
            Keep All Current
          </Button>
        </div>
      </div>

      {/* Scrollable conflict list */}
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
        {conflicts.map((record) => (
          <ConflictCard
            key={record.id}
            record={record}
            toggles={toggles}
            onToggle={toggleField}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-800">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleConfirm}
          disabled={!hasReviewed}
        >
          Apply Changes
        </Button>
      </div>
    </Modal>
  )
}

/* ── Conflict card for a single record ───────────────────────────────── */

interface ConflictCardProps {
  record: ConflictRecord
  toggles: FieldToggleMap
  onToggle: (recordId: string, fieldKey: string, accept: boolean) => void
}

function ConflictCard({ record, toggles, onToggle }: ConflictCardProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/60">
        <Badge tone="gray">{record.id}</Badge>
        <span className="text-sm font-medium text-slate-100">{record.label}</span>
      </div>

      {/* Name mismatch warning */}
      {record.hasNameMismatch && record.nameWarning && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-red-500/10 border-b border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <span className="text-xs text-red-300">{record.nameWarning}</span>
        </div>
      )}

      {/* Fields table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            <th className="text-left px-4 py-2">Field</th>
            <th className="text-left px-4 py-2">Current</th>
            <th className="text-left px-4 py-2">Incoming</th>
            <th className="text-right px-4 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {record.fields.map((field) => {
            const isChanged =
              String(field.currentValue ?? '') !== String(field.incomingValue ?? '')
            const accept = toggles[buildToggleKey(record.id, field.key)] ?? field.accept
            return (
              <FieldRow
                key={field.key}
                field={field}
                isChanged={isChanged}
                accept={accept}
                onToggle={(val) => onToggle(record.id, field.key, val)}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Single field row ─────────────────────────────────────────────────── */

interface FieldRowProps {
  field: ConflictField
  isChanged: boolean
  accept: boolean
  onToggle: (accept: boolean) => void
}

function FieldRow({ field, isChanged, accept, onToggle }: FieldRowProps): React.JSX.Element {
  const formatValue = (v: string | number | undefined): string => {
    if (v === undefined || v === null || v === '') return '—'
    return String(v)
  }

  return (
    <tr className={isChanged ? 'bg-amber-500/5' : 'opacity-50'}>
      <td className="px-4 py-2 text-slate-300 font-medium">{field.label}</td>
      <td className="px-4 py-2 text-slate-400">{formatValue(field.currentValue)}</td>
      <td className="px-4 py-2 text-slate-400">{formatValue(field.incomingValue)}</td>
      <td className="px-4 py-2 text-right">
        {isChanged ? (
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
            <button
              onClick={() => onToggle(true)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                accept
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Accept
            </button>
            <button
              onClick={() => onToggle(false)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                !accept
                  ? 'bg-slate-700 text-slate-200 border border-slate-600'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <XCircle className="w-3 h-3" />
              Keep
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-600">no change</span>
        )}
      </td>
    </tr>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Lock,
  Unlock,
  Copy,
  Pencil,
  Trash2,
  Eye,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  History,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useSnapshotStore } from '@/store/snapshotStore'
import { useUiStore } from '@/store/uiStore'
import { fmtUsd } from '@/lib/format'
import { relativeTime } from '@/lib/relativeTime'
import type { Snapshot } from '@/persistence/schemas'

// ─── helpers ──────────────────────────────────────────────────────────────────

function snapshotTotal(snap: Snapshot): number {
  return snap.weeklyBilling.reduce(
    (acc, r) => acc + r.regularDollars + r.otDollars + r.dtDollars,
    0,
  )
}

function statusBadge(snap: Snapshot): React.JSX.Element {
  if (snap.locked) return <Badge tone="amber">Locked</Badge>
  if (snap.isDraft) return <Badge tone="gray">Draft</Badge>
  return <Badge tone="blue">Saved</Badge>
}

// ─── popover menu ─────────────────────────────────────────────────────────────

interface MenuAction {
  label: string
  icon: React.JSX.Element
  onClick: () => void
  danger?: boolean
}

interface ActionMenuProps {
  actions: MenuAction[]
}

function ActionMenu({ actions }: ActionMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        aria-label="Actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-8 z-30 w-40 rounded-lg border border-slate-700 bg-[#0a0f1c] shadow-xl py-1"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                setOpen(false)
                action.onClick()
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${
                action.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── audit log panel ──────────────────────────────────────────────────────────

function AuditLogPanel({ snap }: { snap: Snapshot }): React.JSX.Element {
  return (
    <div className="px-6 py-3 bg-slate-900/40 border-t border-slate-800">
      {snap.auditLog.length === 0 ? (
        <p className="text-xs text-slate-600">No audit events.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {snap.auditLog.map((ev, i) => (
            <li key={i} className="flex items-start gap-3 text-xs">
              <span className="shrink-0 text-slate-600 tabular-nums w-36">
                {new Date(ev.ts).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <span className="text-slate-400">{ev.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// ─── snapshot row ─────────────────────────────────────────────────────────────

interface SnapshotRowProps {
  snap: Snapshot
  onOpen: () => void
  onDuplicate: () => void
  onRename: (newName: string) => void
  onLockToggle: () => void
  onDelete: () => void
}

function SnapshotRow({
  snap,
  onOpen,
  onDuplicate,
  onRename,
  onLockToggle,
  onDelete,
}: SnapshotRowProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(snap.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const commitRename = useCallback(() => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== snap.name) {
      onRename(trimmed)
    } else {
      setEditName(snap.name)
    }
    setEditing(false)
  }, [editName, snap.name, onRename])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const menuActions: MenuAction[] = [
    {
      label: 'Open',
      icon: <Eye className="w-3.5 h-3.5" />,
      onClick: onOpen,
    },
    {
      label: 'Duplicate',
      icon: <Copy className="w-3.5 h-3.5" />,
      onClick: onDuplicate,
    },
    {
      label: 'Rename',
      icon: <Pencil className="w-3.5 h-3.5" />,
      onClick: () => {
        setEditName(snap.name)
        setEditing(true)
      },
    },
    {
      label: snap.locked ? 'Unlock' : 'Lock',
      icon: snap.locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />,
      onClick: onLockToggle,
    },
    {
      label: 'Delete',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: onDelete,
      danger: true,
    },
  ]

  return (
    <>
      <tr className="border-b border-slate-800/60 hover:bg-slate-900/30 transition-colors">
        {/* expand toggle */}
        <td className="pl-4 pr-2 py-3 w-8">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-slate-600 hover:text-slate-300 transition-colors"
            aria-label={expanded ? 'Collapse audit log' : 'Expand audit log'}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </td>

        {/* name */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            {snap.locked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            {editing ? (
              <input
                ref={inputRef}
                className="bg-slate-800 border border-lw-orange-500/60 rounded px-2 py-0.5 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-lw-orange-500/40 w-56"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') {
                    setEditName(snap.name)
                    setEditing(false)
                  }
                }}
              />
            ) : (
              <span className="font-medium text-slate-200 text-sm">{snap.name}</span>
            )}
          </div>
        </td>

        {/* period */}
        <td className="px-3 py-3 text-sm text-slate-400">{snap.periodLabel}</td>

        {/* status */}
        <td className="px-3 py-3">{statusBadge(snap)}</td>

        {/* created */}
        <td className="px-3 py-3 text-sm text-slate-500 tabular-nums">
          {relativeTime(snap.createdAt)}
        </td>

        {/* last modified */}
        <td className="px-3 py-3 text-sm text-slate-500 tabular-nums">
          {relativeTime(snap.lastModifiedAt)}
        </td>

        {/* total billable */}
        <td className="px-3 py-3 text-sm text-slate-200 tabular-nums text-right font-semibold">
          {fmtUsd(snapshotTotal(snap))}
        </td>

        {/* actions */}
        <td className="px-3 py-3 text-right">
          <ActionMenu actions={menuActions} />
        </td>
      </tr>

      {/* audit log row */}
      {expanded && (
        <tr className="border-b border-slate-800/60">
          <td colSpan={8} className="p-0">
            <AuditLogPanel snap={snap} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── modals ───────────────────────────────────────────────────────────────────

interface DuplicateModalProps {
  snap: Snapshot | null
  onClose: () => void
  onConfirm: (name: string) => void
}

function DuplicateModal({ snap, onClose, onConfirm }: DuplicateModalProps): React.JSX.Element {
  const [name, setName] = useState('')

  useEffect(() => {
    if (snap) setName(`${snap.name} (copy)`)
  }, [snap])

  const handleConfirm = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed)
    onClose()
  }

  return (
    <Modal open={snap !== null} onClose={onClose} title="Duplicate Snapshot" width="sm">
      <div className="px-5 py-4 flex flex-col gap-4">
        <Input
          label="New snapshot name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleConfirm() }
          }}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={!name.trim()} onClick={handleConfirm}>
            Duplicate
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface DeleteModalProps {
  snap: Snapshot | null
  onClose: () => void
  onConfirm: () => void
}

function DeleteModal({ snap, onClose, onConfirm }: DeleteModalProps): React.JSX.Element {
  return (
    <Modal open={snap !== null} onClose={onClose} title="Delete Snapshot" width="sm">
      <div className="px-5 py-4 flex flex-col gap-4">
        <p className="text-sm text-slate-400">
          Delete snapshot <span className="font-semibold text-slate-200">&ldquo;{snap?.name}&rdquo;</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => { onConfirm(); onClose() }}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface LockModalProps {
  snap: Snapshot | null
  onClose: () => void
  onConfirm: () => void
}

function LockModal({ snap, onClose, onConfirm }: LockModalProps): React.JSX.Element {
  return (
    <Modal open={snap !== null} onClose={onClose} title="Lock Snapshot" width="sm">
      <div className="px-5 py-4 flex flex-col gap-4">
        <p className="text-sm text-slate-400">
          Locking <span className="font-semibold text-slate-200">&ldquo;{snap?.name}&rdquo;</span> prevents
          edits to this snapshot. Continue?
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => { onConfirm(); onClose() }}>
            Lock
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage(): React.JSX.Element {
  const snapshots = useSnapshotStore((s) => s.snapshots)
  const loadSnapshot = useSnapshotStore((s) => s.loadSnapshot)
  const deleteSnapshot = useSnapshotStore((s) => s.deleteSnapshot)
  const duplicateSnapshot = useSnapshotStore((s) => s.duplicateSnapshot)
  const toggleLock = useSnapshotStore((s) => s.toggleLock)
  const appendAudit = useSnapshotStore((s) => s.appendAudit)
  const setActivePage = useUiStore((s) => s.setActivePage)

  const [duplicateTarget, setDuplicateTarget] = useState<Snapshot | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Snapshot | null>(null)
  const [lockTarget, setLockTarget] = useState<Snapshot | null>(null)

  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const handleOpen = (snap: Snapshot) => {
    void loadSnapshot(snap.id).then(() => setActivePage('billing-hours'))
  }

  const handleRename = (snap: Snapshot, newName: string) => {
    const oldName = snap.name
    // Update snapshot name in store via appendAudit side-effect approach:
    // We rename by updating the snapshot directly through the store's setState
    useSnapshotStore.setState((s) => {
      const updated = s.snapshots.map((item) =>
        item.id === snap.id
          ? {
              ...item,
              name: newName,
              lastModifiedAt: new Date().toISOString(),
              auditLog: [
                ...item.auditLog,
                {
                  ts: new Date().toISOString(),
                  action: 'manual-edit' as const,
                  detail: `Renamed from "${oldName}" to "${newName}"`,
                },
              ],
            }
          : item,
      )
      const current = s.current?.id === snap.id
        ? updated.find((i) => i.id === snap.id) ?? s.current
        : s.current
      return { snapshots: updated, current }
    })
    // Persist
    const updated = useSnapshotStore.getState().snapshots.find((s) => s.id === snap.id)
    if (updated) {
      void import('@/persistence/idb').then(({ putRecord }) => putRecord('snapshots', updated.id, updated))
    }
    // If the renamed snap is current, appendAudit logs it too
    if (useSnapshotStore.getState().current?.id === snap.id) {
      appendAudit('manual-edit', `Renamed from "${oldName}" to "${newName}"`)
    }
  }

  const handleLockToggle = (snap: Snapshot) => {
    if (snap.locked) {
      // Unlock immediately — no confirmation needed
      void toggleLock(snap.id)
    } else {
      // Lock — show confirmation modal
      setLockTarget(snap)
    }
  }

  return (
    <div>
      <PageHeader title="Snapshots" subtitle="Saved monthly reconciliations" />

      {sorted.length === 0 ? (
        <div className="mx-8 mt-12 flex flex-col items-center gap-4 text-center px-6 py-16 rounded-2xl border border-dashed border-slate-800 bg-[#0a0f1c]/40 animate-fade-in">
          <div className="relative">
            <span aria-hidden className="absolute -inset-2 rounded-2xl bg-lw-orange-500/15 blur-xl" />
            <div className="relative w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <History className="w-6 h-6 text-lw-orange-400" />
            </div>
          </div>
          <div className="max-w-sm">
            <h2 className="font-display text-lg font-semibold text-slate-100 tracking-tight">
              No snapshots yet
            </h2>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
              Snapshots preserve a frozen view of a month&rsquo;s reconciliation. Save your first one
              from the Billing Hours page.
            </p>
          </div>
          <button
            className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-b from-lw-orange-500 to-lw-orange-600 hover:from-lw-orange-400 hover:to-lw-orange-500 text-white text-sm font-medium tracking-tight shadow-glow-orange transition-all"
            onClick={() => setActivePage('billing-hours')}
          >
            Go to Billing Hours
          </button>
        </div>
      ) : (
        <div className="mx-8 mt-6">
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 border-b border-slate-800">
                <tr>
                  <th className="pl-4 pr-2 py-2.5 w-8" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Period
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Created
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Modified
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total Billable
                  </th>
                  <th className="px-3 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((snap) => (
                  <SnapshotRow
                    key={snap.id}
                    snap={snap}
                    onOpen={() => handleOpen(snap)}
                    onDuplicate={() => setDuplicateTarget(snap)}
                    onRename={(newName) => handleRename(snap, newName)}
                    onLockToggle={() => handleLockToggle(snap)}
                    onDelete={() => setDeleteTarget(snap)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DuplicateModal
        snap={duplicateTarget}
        onClose={() => setDuplicateTarget(null)}
        onConfirm={(name) => {
          if (duplicateTarget) void duplicateSnapshot(duplicateTarget.id, name)
        }}
      />

      <DeleteModal
        snap={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteSnapshot(deleteTarget.id)
        }}
      />

      <LockModal
        snap={lockTarget}
        onClose={() => setLockTarget(null)}
        onConfirm={() => {
          if (lockTarget) void toggleLock(lockTarget.id)
        }}
      />
    </div>
  )
}

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useSnapshotStore } from '@/store/snapshotStore'

interface Props {
  open: boolean
  onClose: () => void
}

function defaultName(periodLabel: string): string {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  return `${periodLabel} — saved ${mm}/${dd}/${yy}`
}

export function SaveSnapshotModal({ open, onClose }: Props): React.JSX.Element {
  const current = useSnapshotStore((s) => s.current)
  const saveCurrentAsSnapshot = useSnapshotStore((s) => s.saveCurrentAsSnapshot)

  const [name, setName] = useState(() =>
    current ? defaultName(current.periodLabel) : '',
  )
  const [saving, setSaving] = useState(false)

  // Reset name each time the modal opens so it reflects the latest periodLabel
  const handleOpen = (isOpen: boolean) => {
    if (isOpen && current) {
      setName(defaultName(current.periodLabel))
    }
  }

  // Sync open → reset name when modal opens
  if (open && name === '' && current) {
    setName(defaultName(current.periodLabel))
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    await saveCurrentAsSnapshot(trimmed)
    setSaving(false)
    onClose()
  }

  void handleOpen // suppress unused warning — logic is inlined above

  return (
    <Modal open={open} onClose={onClose} title="Save Snapshot" width="sm">
      <div className="px-5 py-4 flex flex-col gap-4">
        <p className="text-sm text-slate-400">
          Save the current draft as a named snapshot. You can always return to it from the History page.
        </p>
        <Input
          label="Snapshot name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleSave()
            }
          }}
          autoFocus
        />
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={saving || !name.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

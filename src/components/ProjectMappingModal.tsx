import { useState, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select, type SelectOption } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { useSnapshotStore } from '@/store/snapshotStore'
import { slugifyProjectName } from '@/reconciler/projectMatching'
import type { ProjectConfig } from '@/persistence/schemas'

type MappingAction = 'map' | 'create' | 'ignore'

interface AllocationMapping {
  action: MappingAction
  targetProjectKey: string
  newProjectName: string
}

function buildDefaultMappings(allocations: string[]): Record<string, AllocationMapping> {
  const out: Record<string, AllocationMapping> = {}
  for (const alloc of allocations) {
    out[alloc] = { action: 'ignore', targetProjectKey: '', newProjectName: alloc }
  }
  return out
}

export function ProjectMappingModal(): React.JSX.Element | null {
  const unresolvedAllocations = useSnapshotStore((s) => s.unresolvedAllocations)
  const projectConfigs = useSnapshotStore((s) => s.projectConfigs)
  const upsertProjectConfig = useSnapshotStore((s) => s.upsertProjectConfig)
  const clearUnresolvedAllocation = useSnapshotStore((s) => s.clearUnresolvedAllocation)

  const [mappings, setMappings] = useState<Record<string, AllocationMapping>>(() =>
    buildDefaultMappings(unresolvedAllocations),
  )
  const [saving, setSaving] = useState(false)

  // Sync new allocations that arrive after the modal first opens
  const currentAllocations = unresolvedAllocations
  const missingKeys = currentAllocations.filter((a) => !(a in mappings))
  if (missingKeys.length > 0) {
    setMappings((prev) => ({
      ...prev,
      ...buildDefaultMappings(missingKeys),
    }))
  }

  const isOpen = currentAllocations.length > 0

  const projectOptions: SelectOption[] = [
    { value: '', label: '— Select project —' },
    ...Object.values(projectConfigs).map((p) => ({ value: p.projectKey, label: p.displayName })),
  ]

  const updateMapping = useCallback((alloc: string, patch: Partial<AllocationMapping>) => {
    setMappings((prev) => ({
      ...prev,
      [alloc]: { ...prev[alloc], ...patch },
    }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    for (const alloc of currentAllocations) {
      const m = mappings[alloc]
      if (!m) continue

      if (m.action === 'map' && m.targetProjectKey) {
        const existing = projectConfigs[m.targetProjectKey]
        if (existing && !existing.allocationAliases.includes(alloc)) {
          const updated: ProjectConfig = {
            ...existing,
            allocationAliases: [...existing.allocationAliases, alloc],
          }
          await upsertProjectConfig(updated)
        }
        clearUnresolvedAllocation(alloc)
      } else if (m.action === 'create') {
        const name = m.newProjectName.trim() || alloc
        const key = slugifyProjectName(name)
        const newCfg: ProjectConfig = {
          projectKey: key,
          displayName: name,
          allocationAliases: [alloc],
          otThresholdHrs: 40,
          includeDoubleTime: false,
          defaultRegularRate: 0,
          employeeRateOverrides: {},
        }
        await upsertProjectConfig(newCfg)
        clearUnresolvedAllocation(alloc)
      } else {
        // ignore
        clearUnresolvedAllocation(alloc)
      }
    }
    setSaving(false)
  }

  const handleClose = () => {
    // Treat all as ignored and clear them
    for (const alloc of currentAllocations) {
      clearUnresolvedAllocation(alloc)
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Unmapped Allocation Codes"
      width="lg"
    >
      <div className="px-5 py-4 flex flex-col gap-4">
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300">
            {currentAllocations.length} allocation code{currentAllocations.length !== 1 ? 's' : ''} from the imported PDFs could not be matched to any project.
            Map each one to resolve billing.
          </p>
        </div>

        {currentAllocations.map((alloc) => {
          const m = mappings[alloc] ?? { action: 'ignore' as MappingAction, targetProjectKey: '', newProjectName: alloc }
          return (
            <div key={alloc} className="border border-slate-800 rounded-lg p-4 flex flex-col gap-3">
              <p className="text-sm font-mono font-semibold text-slate-100">{alloc}</p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { value: 'map', label: 'Map to existing project' },
                    { value: 'create', label: 'Create new project' },
                    { value: 'ignore', label: 'Ignore for this snapshot' },
                  ] as Array<{ value: MappingAction; label: string }>
                ).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`action-${alloc}`}
                      value={opt.value}
                      checked={m.action === opt.value}
                      onChange={() => updateMapping(alloc, { action: opt.value })}
                      className="accent-lw-orange-500"
                    />
                    <span className="text-sm text-slate-300">{opt.label}</span>
                  </label>
                ))}
              </div>

              {m.action === 'map' && (
                <Select
                  options={projectOptions}
                  value={m.targetProjectKey}
                  onChange={(e) => updateMapping(alloc, { targetProjectKey: e.target.value })}
                />
              )}

              {m.action === 'create' && (
                <Input
                  placeholder="Project display name"
                  value={m.newProjectName}
                  onChange={(e) => updateMapping(alloc, { newProjectName: e.target.value })}
                  hint="Will use the allocation code as the only initial alias. OT threshold defaults to 40 hrs/wk."
                />
              )}
            </div>
          )
        })}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={handleClose}>Close (ignore all)</Button>
          <Button variant="primary" size="sm" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save mappings'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

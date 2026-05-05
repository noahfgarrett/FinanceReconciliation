import { useState, useCallback } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import { Select, type SelectOption } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { ProjectConfig, EmployeeRateOverride } from '@/persistence/schemas'

interface Props {
  config: ProjectConfig | null
  onClose: () => void
}

interface FormState {
  displayName: string
  clientId: string
  poNumber: string
  allocationAliases: string[]
  otThresholdHrs: string
  includeDoubleTime: boolean
  dtThresholdHrs: string
  defaultRegularRate: string
  otRateOverride: string
  dtRateOverride: string
  employeeRateOverrides: Record<string, { regularRate: string; otRate: string; dtRate: string }>
}

function configToForm(cfg: ProjectConfig): FormState {
  const overrides: FormState['employeeRateOverrides'] = {}
  for (const [code, o] of Object.entries(cfg.employeeRateOverrides)) {
    overrides[code] = {
      regularRate: o.regularRate !== undefined ? String(o.regularRate) : '',
      otRate: o.otRate !== undefined ? String(o.otRate) : '',
      dtRate: o.dtRate !== undefined ? String(o.dtRate) : '',
    }
  }
  return {
    displayName: cfg.displayName,
    clientId: cfg.clientId ?? '',
    poNumber: cfg.poNumber ?? '',
    allocationAliases: [...cfg.allocationAliases],
    otThresholdHrs: String(cfg.otThresholdHrs),
    includeDoubleTime: cfg.includeDoubleTime,
    dtThresholdHrs: cfg.dtThresholdHrs !== undefined ? String(cfg.dtThresholdHrs) : '',
    defaultRegularRate: String(cfg.defaultRegularRate),
    otRateOverride: cfg.otRateOverride !== undefined ? String(cfg.otRateOverride) : '',
    dtRateOverride: cfg.dtRateOverride !== undefined ? String(cfg.dtRateOverride) : '',
    employeeRateOverrides: overrides,
  }
}

function parseNum(s: string): number | undefined {
  const n = parseFloat(s)
  return isNaN(n) ? undefined : n
}

export function ProjectConfigDrawer({ config, onClose }: Props): React.JSX.Element | null {
  const clients = useSnapshotStore((s) => s.clients)
  const currentSnap = useSnapshotStore((s) => s.current)
  const upsertProjectConfig = useSnapshotStore((s) => s.upsertProjectConfig)
  const appendAudit = useSnapshotStore((s) => s.appendAudit)

  const [form, setForm] = useState<FormState>(() =>
    config ? configToForm(config) : {
      displayName: '', clientId: '', poNumber: '',
      allocationAliases: [], otThresholdHrs: '40', includeDoubleTime: false,
      dtThresholdHrs: '', defaultRegularRate: '0', otRateOverride: '', dtRateOverride: '',
      employeeRateOverrides: {},
    },
  )
  const [aliasInput, setAliasInput] = useState('')
  const [addEmpCode, setAddEmpCode] = useState('')
  const [saving, setSaving] = useState(false)

  const clientOptions: SelectOption[] = [
    { value: '', label: '— None —' },
    ...Object.values(clients).map((c) => ({ value: c.id, label: c.name })),
  ]

  const employees = currentSnap?.employees ?? []
  const employeeOptions: SelectOption[] = [
    { value: '', label: '— Select employee —' },
    ...employees
      .filter((e) => !(e.code in form.employeeRateOverrides))
      .map((e) => ({ value: e.code, label: `${e.firstName} ${e.lastName} (${e.code})` })),
  ]

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const addAlias = () => {
    const trimmed = aliasInput.trim()
    if (trimmed && !form.allocationAliases.includes(trimmed)) {
      update('allocationAliases', [...form.allocationAliases, trimmed])
      setAliasInput('')
    }
  }

  const removeAlias = (alias: string) => {
    update('allocationAliases', form.allocationAliases.filter((a) => a !== alias))
  }

  const addEmpOverride = () => {
    if (!addEmpCode) return
    setForm((prev) => ({
      ...prev,
      employeeRateOverrides: {
        ...prev.employeeRateOverrides,
        [addEmpCode]: { regularRate: '', otRate: '', dtRate: '' },
      },
    }))
    setAddEmpCode('')
  }

  const removeEmpOverride = (code: string) => {
    setForm((prev) => {
      const next = { ...prev.employeeRateOverrides }
      delete next[code]
      return { ...prev, employeeRateOverrides: next }
    })
  }

  const updateEmpOverride = (code: string, field: 'regularRate' | 'otRate' | 'dtRate', val: string) => {
    setForm((prev) => ({
      ...prev,
      employeeRateOverrides: {
        ...prev.employeeRateOverrides,
        [code]: { ...prev.employeeRateOverrides[code], [field]: val },
      },
    }))
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    const otThreshold = parseFloat(form.otThresholdHrs)
    const dtThreshold = parseFloat(form.dtThresholdHrs)
    const defaultRate = parseFloat(form.defaultRegularRate)

    const empOverrides: Record<string, EmployeeRateOverride> = {}
    for (const [code, o] of Object.entries(form.employeeRateOverrides)) {
      const reg = parseNum(o.regularRate)
      const ot = parseNum(o.otRate)
      const dt = parseNum(o.dtRate)
      if (reg !== undefined || ot !== undefined || dt !== undefined) {
        empOverrides[code] = { regularRate: reg, otRate: ot, dtRate: dt }
      }
    }

    const updated: ProjectConfig = {
      ...config,
      displayName: form.displayName.trim() || config.displayName,
      clientId: form.clientId || undefined,
      poNumber: form.poNumber.trim() || undefined,
      allocationAliases: form.allocationAliases,
      otThresholdHrs: isNaN(otThreshold) ? config.otThresholdHrs : otThreshold,
      includeDoubleTime: form.includeDoubleTime,
      dtThresholdHrs: form.includeDoubleTime && !isNaN(dtThreshold) ? dtThreshold : undefined,
      defaultRegularRate: isNaN(defaultRate) ? config.defaultRegularRate : defaultRate,
      otRateOverride: parseNum(form.otRateOverride),
      dtRateOverride: parseNum(form.dtRateOverride),
      employeeRateOverrides: empOverrides,
    }

    const oldOt = config.otThresholdHrs
    const newOt = updated.otThresholdHrs
    const detail = oldOt !== newOt
      ? `Edited Project ${updated.displayName}: OT threshold ${oldOt} → ${newOt}`
      : `Edited Project ${updated.displayName}`

    await upsertProjectConfig(updated)
    appendAudit('project-config-edited', detail, config, updated)
    setSaving(false)
    onClose()
  }

  if (!config) return null

  const regRate = parseFloat(form.defaultRegularRate)
  const autoOt = !isNaN(regRate) ? `auto = $${(regRate * 1.5).toFixed(2)}/hr` : undefined
  const autoDt = !isNaN(regRate) ? `auto = $${(regRate * 2).toFixed(2)}/hr` : undefined

  const isLocked = currentSnap?.locked ?? false

  const footer = (
    <div className="flex items-center gap-2 justify-end">
      {isLocked && (
        <p className="text-xs text-amber-400 mr-auto">
          Snapshot is locked — unlock from History to edit.
        </p>
      )}
      <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
      <Button variant="primary" size="sm" disabled={saving || isLocked} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  )

  return (
    <Drawer open={config !== null} onClose={onClose} title={`Edit: ${config.displayName}`} width="xl" footer={footer}>
      <div className="px-5 py-4 flex flex-col gap-6">
        {/* Identity */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Identity</h3>
          <Input label="Display Name" value={form.displayName} onChange={(e) => update('displayName', e.target.value)} />
          <Select label="Client" options={clientOptions} value={form.clientId} onChange={(e) => update('clientId', e.target.value)} />
          <Input label="PO Number" value={form.poNumber} placeholder="e.g. PO-2026-001" onChange={(e) => update('poNumber', e.target.value)} />
        </section>

        {/* Allocation aliases */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Allocation Aliases</h3>
          <p className="text-xs text-slate-500">Allocation codes from Paycom PDFs that map to this project</p>
          <div className="flex flex-wrap gap-1.5">
            {form.allocationAliases.map((alias) => (
              <span key={alias} className="inline-flex items-center gap-1">
                <Badge tone="blue">{alias}</Badge>
                <button
                  onClick={() => removeAlias(alias)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                  aria-label={`Remove alias ${alias}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {form.allocationAliases.length === 0 && (
              <span className="text-xs text-slate-600">No aliases — add one below</span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="e.g. ACM-001"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAlias() } }}
              />
            </div>
            <Button variant="secondary" size="sm" icon={<Plus className="w-3 h-3" />} onClick={addAlias}>Add</Button>
          </div>
        </section>

        {/* OT Thresholds */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">OT Thresholds</h3>
          <NumberInput
            label="OT after X hrs/wk"
            suffix="hrs"
            min={1}
            max={168}
            value={form.otThresholdHrs}
            onChange={(e) => update('otThresholdHrs', e.target.value)}
          />
          <Toggle
            checked={form.includeDoubleTime}
            onChange={(v) => update('includeDoubleTime', v)}
            label="Include Double Time"
          />
          {form.includeDoubleTime && (
            <NumberInput
              label="DT after X hrs/wk"
              suffix="hrs"
              min={1}
              max={168}
              value={form.dtThresholdHrs}
              onChange={(e) => update('dtThresholdHrs', e.target.value)}
              hint="Only hours above this threshold are billed at DT"
            />
          )}
        </section>

        {/* Rates */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rates</h3>
          <NumberInput
            label="Regular Rate ($/hr)"
            suffix="$/hr"
            min={0}
            value={form.defaultRegularRate}
            onChange={(e) => update('defaultRegularRate', e.target.value)}
          />
          <NumberInput
            label="OT Rate Override"
            suffix="$/hr"
            min={0}
            value={form.otRateOverride}
            onChange={(e) => update('otRateOverride', e.target.value)}
            hint={autoOt ? `Leave blank to use ${autoOt}` : undefined}
          />
          <NumberInput
            label="DT Rate Override"
            suffix="$/hr"
            min={0}
            value={form.dtRateOverride}
            onChange={(e) => update('dtRateOverride', e.target.value)}
            hint={autoDt ? `Leave blank to use ${autoDt}` : undefined}
          />
        </section>

        {/* Per-employee rate overrides */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Per-Employee Rate Overrides</h3>
          {Object.keys(form.employeeRateOverrides).length === 0 && (
            <p className="text-xs text-slate-600">No employee overrides set.</p>
          )}
          {Object.entries(form.employeeRateOverrides).map(([code, o]) => {
            const emp = employees.find((e) => e.code === code)
            const empLabel = emp ? `${emp.firstName} ${emp.lastName} (${code})` : code
            return (
              <div key={code} className="flex items-start gap-2 bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-300 mb-2">{empLabel}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumberInput
                      label="Reg $/hr"
                      suffix="$/hr"
                      min={0}
                      value={o.regularRate}
                      onChange={(e) => updateEmpOverride(code, 'regularRate', e.target.value)}
                    />
                    <NumberInput
                      label="OT $/hr"
                      suffix="$/hr"
                      min={0}
                      value={o.otRate}
                      onChange={(e) => updateEmpOverride(code, 'otRate', e.target.value)}
                    />
                    <NumberInput
                      label="DT $/hr"
                      suffix="$/hr"
                      min={0}
                      value={o.dtRate}
                      onChange={(e) => updateEmpOverride(code, 'dtRate', e.target.value)}
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeEmpOverride(code)}
                  className="mt-5 text-slate-500 hover:text-red-400 transition-colors"
                  aria-label={`Remove override for ${code}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
          {employees.length === 0 ? (
            <p className="text-xs text-slate-600">Import data first to see employees</p>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1">
                <Select
                  options={employeeOptions}
                  value={addEmpCode}
                  onChange={(e) => setAddEmpCode(e.target.value)}
                />
              </div>
              <Button variant="secondary" size="sm" icon={<Plus className="w-3 h-3" />} onClick={addEmpOverride}>Add</Button>
            </div>
          )}
        </section>
      </div>
    </Drawer>
  )
}

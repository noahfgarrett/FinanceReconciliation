import { useState, useEffect, useCallback } from 'react'
import { Lock, Unlock, ExternalLink } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import { useEmployeeStore } from '@/store/employeeStore'
import { useSnapshotStore } from '@/store/snapshotStore'
import { useUiStore } from '@/store/uiStore'
import type { EmployeeProfile } from '@/persistence/schemas'

interface Props {
  employee: EmployeeProfile | null
  isAddMode: boolean
  onClose: () => void
}

interface FormState {
  code: string
  firstName: string
  lastName: string
  defaultBillRate: string
  jobTitle: string
  notes: string
}

function profileToForm(emp: EmployeeProfile): FormState {
  return {
    code: emp.code,
    firstName: emp.firstName,
    lastName: emp.lastName,
    defaultBillRate: emp.defaultBillRate > 0 ? String(emp.defaultBillRate) : '',
    jobTitle: emp.jobTitle ?? '',
    notes: emp.notes ?? '',
  }
}

export function EmployeeProfileDrawer({ employee, isAddMode, onClose }: Props): React.JSX.Element | null {
  const upsertEmployee = useEmployeeStore((s) => s.upsertEmployee)
  const deleteEmployee = useEmployeeStore((s) => s.deleteEmployee)
  const projectConfigs = useSnapshotStore((s) => s.projectConfigs)
  const setActivePage = useUiStore((s) => s.setActivePage)

  const [form, setForm] = useState<FormState>(() =>
    employee
      ? profileToForm(employee)
      : { code: '', firstName: '', lastName: '', defaultBillRate: '', jobTitle: '', notes: '' },
  )
  const [isNameUnlocked, setIsNameUnlocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [codeError, setCodeError] = useState<string | undefined>(undefined)

  const existingEmployees = useEmployeeStore((s) => s.employees)

  // Reset form when employee changes
  useEffect(() => {
    if (employee) {
      setForm(profileToForm(employee))
      setIsNameUnlocked(isAddMode)
      setShowDeleteConfirm(false)
      setCodeError(undefined)
    }
  }, [employee, isAddMode])

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'code') setCodeError(undefined)
  }, [])

  // Compute project overrides for this employee
  const overrideEntries = employee
    ? Object.entries(projectConfigs)
        .filter(([, cfg]) => employee.code in cfg.employeeRateOverrides)
        .map(([key, cfg]) => ({
          projectKey: key,
          displayName: cfg.displayName,
          overrides: cfg.employeeRateOverrides[employee.code],
        }))
    : []

  const handleSave = async (): Promise<void> => {
    const trimmedCode = form.code.trim()
    if (!trimmedCode) {
      setCodeError('Employee code is required')
      return
    }
    if (isAddMode && trimmedCode in existingEmployees) {
      setCodeError('An employee with this code already exists')
      return
    }
    if (!form.firstName.trim() || !form.lastName.trim()) return

    setSaving(true)
    const rate = parseFloat(form.defaultBillRate)
    const profile: EmployeeProfile = {
      code: trimmedCode,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      defaultBillRate: isNaN(rate) ? 0 : rate,
      jobTitle: form.jobTitle.trim() || undefined,
      notes: form.notes.trim() || undefined,
      createdAt: employee?.createdAt ?? new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
    }
    await upsertEmployee(profile)
    setSaving(false)
    onClose()
  }

  const handleDelete = async (): Promise<void> => {
    if (!employee) return
    await deleteEmployee(employee.code)
    onClose()
  }

  const navigateToProject = (projectKey: string): void => {
    void projectKey
    setActivePage('projects')
    onClose()
  }

  if (!employee) return null

  const footer = (
    <div className="flex items-center gap-2 justify-between">
      <div>
        {!isAddMode && (
          <>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Are you sure?</span>
                <Button variant="danger" size="sm" onClick={() => void handleDelete()}>
                  Yes, delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                Delete employee
              </Button>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={saving || !form.code.trim() || !form.firstName.trim() || !form.lastName.trim()}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving...' : isAddMode ? 'Create Employee' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )

  const drawerTitle = isAddMode
    ? 'New Employee'
    : `${employee.code} - ${employee.firstName} ${employee.lastName}`

  return (
    <Drawer
      open={employee !== null}
      onClose={onClose}
      title={drawerTitle}
      width="xl"
      footer={footer}
    >
      <div className="px-5 py-4 flex flex-col gap-6">
        {/* Identity */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Identity
          </h3>

          {isAddMode ? (
            <Input
              label="Employee Code"
              value={form.code}
              onChange={(e) => update('code', e.target.value)}
              placeholder="e.g. EMP-001"
              error={codeError}
            />
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Employee Code</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-100 font-mono bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                  {form.code}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                value={form.firstName}
                onChange={(e) => update('firstName', e.target.value)}
                disabled={!isAddMode && !isNameUnlocked}
              />
              <Input
                label="Last Name"
                value={form.lastName}
                onChange={(e) => update('lastName', e.target.value)}
                disabled={!isAddMode && !isNameUnlocked}
              />
            </div>
            {!isAddMode && (
              <button
                onClick={() => setIsNameUnlocked((v) => !v)}
                className={`p-2 rounded-lg border transition-colors mb-[1px] ${
                  isNameUnlocked
                    ? 'border-lw-orange-500/40 bg-lw-orange-500/10 text-lw-orange-400'
                    : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300'
                }`}
                title={isNameUnlocked ? 'Lock name fields' : 'Unlock name fields for editing'}
              >
                {isNameUnlocked ? (
                  <Unlock className="w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </section>

        {/* Billing */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Billing
          </h3>
          <NumberInput
            label="Default Bill Rate ($/hr)"
            suffix="$/hr"
            min={0}
            value={form.defaultBillRate}
            onChange={(e) => update('defaultBillRate', e.target.value)}
            hint="Used when no project-specific override exists"
          />
        </section>

        {/* Details */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Details
          </h3>
          <Input
            label="Job Title"
            value={form.jobTitle}
            onChange={(e) => update('jobTitle', e.target.value)}
            placeholder="e.g. Senior Technician"
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Internal notes about this employee..."
              rows={3}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lw-orange-500/40 transition-colors resize-none"
            />
          </div>
        </section>

        {/* Project Rate Overrides */}
        {!isAddMode && (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Project Rate Overrides
            </h3>
            {overrideEntries.length === 0 ? (
              <p className="text-xs text-slate-600">
                No project-specific rate overrides for this employee.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {overrideEntries.map((entry) => (
                  <div
                    key={entry.projectKey}
                    className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg p-3"
                  >
                    <div>
                      <button
                        onClick={() => navigateToProject(entry.projectKey)}
                        className="text-sm font-medium text-slate-200 hover:text-lw-orange-400 transition-colors inline-flex items-center gap-1.5"
                      >
                        {entry.displayName}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <div className="flex gap-3 mt-1 text-xs text-slate-500">
                        {entry.overrides.regularRate !== undefined && (
                          <span>Reg: ${entry.overrides.regularRate}/hr</span>
                        )}
                        {entry.overrides.otRate !== undefined && (
                          <span>OT: ${entry.overrides.otRate}/hr</span>
                        )}
                        {entry.overrides.dtRate !== undefined && (
                          <span>DT: ${entry.overrides.dtRate}/hr</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-600">
              Rate overrides are managed from the Projects page.
            </p>
          </section>
        )}

        {/* Metadata */}
        {!isAddMode && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Metadata
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Created</span>
                <p className="text-slate-300 mt-0.5">
                  {new Date(employee.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Last Modified</span>
                <p className="text-slate-300 mt-0.5">
                  {new Date(employee.lastModifiedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </Drawer>
  )
}

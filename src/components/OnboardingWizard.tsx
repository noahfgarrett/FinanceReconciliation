import { useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, Briefcase, Users, ClipboardCheck, Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { NumberInput } from '@/components/ui/NumberInput'
import type { ProjectConfig, EmployeeProfile } from '@/persistence/schemas'
import type { DetectedProject } from '@/components/ImportFlow'
import { slugifyProjectName } from '@/reconciler/projectMatching'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NewEmployee {
  code: string
  firstName: string
  lastName: string
}

export interface OnboardingWizardProps {
  open: boolean
  onComplete: (result: {
    projects: ProjectConfig[]
    employees: EmployeeProfile[]
  }) => void
  onCancel: () => void
  /** All projects found in the Excel — both new and already-configured */
  allProjects: DetectedProject[]
  newEmployees: NewEmployee[]
  existingProjects: Record<string, ProjectConfig>
  /** Maps employee code → project names they appear on in the Excel data */
  employeeProjectMap?: Record<string, string[]>
}

/* ------------------------------------------------------------------ */
/*  Per-row draft state                                                */
/* ------------------------------------------------------------------ */

interface ProjectDraft {
  displayName: string
  defaultRate: string      // kept as string for controlled input
  otThreshold: string
  allocations: string[]
  isNew: boolean
}

interface EmployeeDraft {
  code: string
  firstName: string
  lastName: string
  defaultBillRate: string
  jobTitle: string
}

/* ------------------------------------------------------------------ */
/*  Step indicator                                                     */
/* ------------------------------------------------------------------ */

const STEPS = [
  { label: 'Projects', icon: Briefcase },
  { label: 'Employees', icon: Users },
  { label: 'Review', icon: ClipboardCheck },
] as const

function StepIndicator({ current }: { current: number }): React.JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2 px-5 pt-5 pb-2">
      {STEPS.map((step, idx) => {
        const isActive = idx === current
        const isDone = idx < current
        const Icon = step.icon
        return (
          <div key={step.label} className="flex items-center gap-2">
            {idx > 0 && (
              <div
                className="h-px w-8 transition-colors"
                style={{ backgroundColor: isDone ? 'var(--brand-orange-500)' : 'var(--border-emphasis)' }}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-lw-orange-500 text-white'
                    : isDone
                      ? 'bg-lw-orange-500/20 text-lw-orange-400'
                      : ''
                }`}
                style={!isActive && !isDone ? { backgroundColor: 'var(--surface-interactive)', color: 'var(--text-muted)' } : undefined}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3 h-3" />
                )}
              </div>
              <span
                className="text-xs font-medium transition-colors"
                style={{ color: isActive ? 'var(--text-primary)' : isDone ? 'var(--text-muted)' : 'var(--text-faint)' }}
              >
                {step.label} ({idx + 1}/3)
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseRate(raw: string): number {
  const n = parseFloat(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function parseThreshold(raw: string): number {
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1 && n <= 168 ? n : 40
}

/* ------------------------------------------------------------------ */
/*  Employee Step (with search + project column)                       */
/* ------------------------------------------------------------------ */

function EmployeeStep({
  employeeDrafts,
  employeeProjectMap,
  projectDrafts,
  existingProjects,
  updateEmployee,
}: {
  employeeDrafts: EmployeeDraft[]
  employeeProjectMap: Record<string, string[]>
  projectDrafts: ProjectDraft[]
  existingProjects: Record<string, ProjectConfig>
  updateEmployee: (idx: number, field: keyof EmployeeDraft, value: string) => void
}): React.JSX.Element {
  const [empSearch, setEmpSearch] = useState('')

  const projectLabel = useMemo(() => {
    const byName = new Map<string, string>()
    for (const d of projectDrafts) byName.set(d.displayName, d.displayName)
    for (const cfg of Object.values(existingProjects)) byName.set(cfg.displayName, cfg.displayName)
    return (code: string): string => {
      const names = employeeProjectMap[code] ?? []
      if (names.length === 0) return '—'
      if (names.length === 1) return byName.get(names[0]) ?? names[0]
      return `${byName.get(names[0]) ?? names[0]} +${names.length - 1}`
    }
  }, [employeeProjectMap, projectDrafts, existingProjects])

  const filteredIndices = useMemo(() => {
    if (!empSearch.trim()) return employeeDrafts.map((_, i) => i)
    const q = empSearch.toLowerCase()
    return employeeDrafts
      .map((d, i) => ({ d, i }))
      .filter(({ d }) =>
        `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
        d.code.includes(q) ||
        (employeeProjectMap[d.code] ?? []).some((p) => p.toLowerCase().includes(q)),
      )
      .map(({ i }) => i)
  }, [employeeDrafts, empSearch, employeeProjectMap])

  return (
    <div className="px-5 py-4 flex flex-col gap-3 max-h-[60vh] overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {employeeDrafts.length} new employee{employeeDrafts.length !== 1 ? 's' : ''} detected.
          Rates are pre-filled from each employee&apos;s project.
        </p>
        <div className="relative shrink-0 w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={empSearch}
            onChange={(e) => setEmpSearch(e.target.value)}
            placeholder="Filter by name or project…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:border-lw-orange-500/60"
            style={{
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-emphasis)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      <div
        className="rounded-lg overflow-hidden flex-1 overflow-y-auto"
        style={{ border: '1px solid var(--border-default)' }}
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 backdrop-blur-sm z-10" style={{ backgroundColor: 'var(--surface-elevated)' }}>
            <tr className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <th className="text-left px-3 py-1.5 font-medium w-16">Code</th>
              <th className="text-left px-3 py-1.5 font-medium">Name</th>
              <th className="text-left px-3 py-1.5 font-medium">Project</th>
              <th className="text-left px-3 py-1.5 font-medium w-32">Rate ($)</th>
              <th className="text-left px-3 py-1.5 font-medium min-w-[180px]">Job Title</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {filteredIndices.map((idx) => {
              const draft = employeeDrafts[idx]
              return (
                <tr key={draft.code} style={{ backgroundColor: 'var(--surface-subtle)' }}>
                  <td className="px-3 py-1.5">
                    <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{draft.code}</span>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                      {draft.firstName} {draft.lastName}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-xs truncate block max-w-[160px]" style={{ color: 'var(--text-muted)' }}>
                      {projectLabel(draft.code)}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <NumberInput
                      value={draft.defaultBillRate}
                      onChange={(e) => updateEmployee(idx, 'defaultBillRate', e.target.value)}
                      placeholder="0"
                      min={0}
                      suffix="$/hr"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={draft.jobTitle}
                      onChange={(e) => updateEmployee(idx, 'jobTitle', e.target.value)}
                      placeholder="Optional"
                    />
                  </td>
                </tr>
              )
            })}
            {filteredIndices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-faint)' }}>
                  No employees match &ldquo;{empSearch}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function OnboardingWizard({
  open,
  onComplete,
  onCancel,
  allProjects,
  newEmployees,
  existingProjects,
  employeeProjectMap = {},
}: OnboardingWizardProps): React.JSX.Element | null {
  const hasNewProjects = allProjects.some((p) => p.isNew)
  const hasProjects = allProjects.length > 0
  const hasEmployees = newEmployees.length > 0

  // Determine which steps are relevant — show projects step if any projects exist
  const initialStep = hasProjects ? 0 : hasEmployees ? 1 : 2

  const [step, setStep] = useState(initialStep)

  const [projectDrafts, setProjectDrafts] = useState<ProjectDraft[]>(() =>
    allProjects.map((p) => ({
      displayName: p.existingConfig?.displayName ?? p.name,
      defaultRate: p.existingConfig ? String(p.existingConfig.defaultRegularRate) : '',
      otThreshold: p.existingConfig ? String(p.existingConfig.otThresholdHrs) : '40',
      allocations: p.existingConfig?.allocationAliases ?? p.allocations,
      isNew: p.isNew,
    })),
  )

  const [employeeDrafts, setEmployeeDrafts] = useState<EmployeeDraft[]>(() => {
    // Build a lookup of existing project rates by display name
    const existingRateByName = new Map<string, number>()
    for (const cfg of Object.values(existingProjects)) {
      if (cfg.defaultRegularRate > 0) existingRateByName.set(cfg.displayName, cfg.defaultRegularRate)
    }
    return newEmployees.map((e) => {
      // Pre-fill from existing project rates when starting directly on step 1
      const projNames = employeeProjectMap[e.code] ?? []
      let best = 0
      for (const name of projNames) {
        const rate = existingRateByName.get(name) ?? 0
        if (rate > best) best = rate
      }
      return {
        code: e.code,
        firstName: e.firstName,
        lastName: e.lastName,
        defaultBillRate: best > 0 ? String(best) : '0',
        jobTitle: '',
      }
    })
  })

  /* ---- Project field updaters ---- */
  const updateProject = useCallback(
    (idx: number, field: keyof ProjectDraft, value: string) => {
      setProjectDrafts((prev) => {
        const next = [...prev]
        next[idx] = { ...next[idx], [field]: value }
        return next
      })
    },
    [],
  )

  /* ---- Employee field updaters ---- */
  const updateEmployee = useCallback(
    (idx: number, field: keyof EmployeeDraft, value: string) => {
      setEmployeeDrafts((prev) => {
        const next = [...prev]
        next[idx] = { ...next[idx], [field]: value }
        return next
      })
    },
    [],
  )

  /** Resolve the best project rate for an employee from drafts + existing configs. */
  const resolveEmployeeRate = useCallback(
    (empCode: string): string => {
      const projNames = employeeProjectMap[empCode] ?? []
      // Build a lookup from project name → draft rate
      const draftRateByName = new Map<string, number>()
      for (const d of projectDrafts) {
        const rate = parseRate(d.defaultRate)
        if (rate > 0) draftRateByName.set(d.displayName, rate)
      }
      // Also check existing project configs by display name
      const existingRateByName = new Map<string, number>()
      for (const cfg of Object.values(existingProjects)) {
        if (cfg.defaultRegularRate > 0) existingRateByName.set(cfg.displayName, cfg.defaultRegularRate)
      }
      // Find the highest rate from the employee's projects
      let best = 0
      for (const name of projNames) {
        const rate = draftRateByName.get(name) ?? existingRateByName.get(name) ?? 0
        if (rate > best) best = rate
      }
      return best > 0 ? String(best) : '0'
    },
    [projectDrafts, existingProjects, employeeProjectMap],
  )

  /** Populate employee rates from their project rates. */
  const populateEmployeeRates = useCallback(() => {
    setEmployeeDrafts((prev) =>
      prev.map((d) => {
        if (parseRate(d.defaultBillRate) > 0) return d
        return { ...d, defaultBillRate: resolveEmployeeRate(d.code) }
      }),
    )
  }, [resolveEmployeeRate])

  /* ---- "Use defaults" for projects ---- */
  const skipProjects = useCallback(() => {
    setProjectDrafts((prev) =>
      prev.map((d) => ({ ...d, defaultRate: '0', otThreshold: '40' })),
    )
    if (hasEmployees) {
      populateEmployeeRates()
      setStep(1)
    } else {
      setStep(2)
    }
  }, [hasEmployees, populateEmployeeRates])

  /* ---- "Use defaults" for employees ---- */
  const skipEmployees = useCallback(() => {
    setEmployeeDrafts((prev) =>
      prev.map((d) => ({ ...d, defaultBillRate: resolveEmployeeRate(d.code), jobTitle: '' })),
    )
    setStep(2)
  }, [resolveEmployeeRate])

  /* ---- Build final results ---- */
  const buildResults = useCallback((): {
    projects: ProjectConfig[]
    employees: EmployeeProfile[]
  } => {
    const now = new Date().toISOString()
    // Only emit configs for NEW projects — existing ones are already persisted
    const projects: ProjectConfig[] = projectDrafts
      .filter((d) => d.isNew)
      .map((d) => {
        const key = slugifyProjectName(d.displayName)
        return {
          projectKey: key,
          displayName: d.displayName.trim() || d.displayName,
          allocationAliases: d.allocations,
          otThresholdHrs: parseThreshold(d.otThreshold),
          includeDoubleTime: false,
          defaultRegularRate: parseRate(d.defaultRate),
          employeeRateOverrides: {},
        }
      })

    const employees: EmployeeProfile[] = employeeDrafts.map((d) => ({
      code: d.code,
      firstName: d.firstName,
      lastName: d.lastName,
      defaultBillRate: parseRate(d.defaultBillRate),
      jobTitle: d.jobTitle.trim() || undefined,
      createdAt: now,
      lastModifiedAt: now,
    }))

    return { projects, employees }
  }, [projectDrafts, employeeDrafts])

  const handleComplete = useCallback(() => {
    onComplete(buildResults())
  }, [onComplete, buildResults])

  /* ---- Navigation ---- */
  const goNext = useCallback(() => {
    if (step === 0) {
      if (hasEmployees) {
        populateEmployeeRates()
        setStep(1)
      } else {
        setStep(2)
      }
    } else if (step === 1) {
      setStep(2)
    }
  }, [step, hasEmployees, populateEmployeeRates])

  const goBack = useCallback(() => {
    if (step === 2) setStep(hasEmployees ? 1 : hasProjects ? 0 : 2)
    else if (step === 1) setStep(hasProjects ? 0 : 1)
  }, [step, hasProjects, hasEmployees])

  if (!open) return null

  const { projects: builtProjects, employees: builtEmployees } = buildResults()

  return (
    <Modal open={open} onClose={onCancel} title="Import Setup Wizard" width="3xl">
      <div data-testid="onboarding-wizard" className="flex flex-col">
        <StepIndicator current={step} />

        {/* ---- Step 0: Projects ---- */}
        {step === 0 && (
          <div className="px-5 py-4 flex flex-col gap-4 max-h-[60vh] overflow-hidden">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {allProjects.length} project{allProjects.length !== 1 ? 's' : ''} found in Excel
              {hasNewProjects
                ? ` — ${allProjects.filter((p) => p.isNew).length} new, ${allProjects.filter((p) => !p.isNew).length} already configured.`
                : '.'}
              {hasNewProjects ? ' Configure billing defaults for new projects.' : ''}
            </p>

            <div
              className="rounded-lg overflow-hidden flex-1 overflow-y-auto"
              style={{ border: '1px solid var(--border-default)' }}
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--surface-elevated)' }}>
                  <tr className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <th className="text-left px-3 py-2 font-medium">Display Name</th>
                    <th className="text-left px-3 py-2 font-medium w-20">Status</th>
                    <th className="text-left px-3 py-2 font-medium w-32">Bill Rate ($)</th>
                    <th className="text-left px-3 py-2 font-medium w-32">OT Threshold</th>
                    <th className="text-left px-3 py-2 font-medium w-48">Allocation Codes</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {projectDrafts.map((draft, idx) => {
                    const isExisting = !draft.isNew
                    return (
                      <tr
                        key={allProjects[idx].name}
                        style={{
                          backgroundColor: 'var(--surface-subtle)',
                          opacity: isExisting ? 0.7 : 1,
                        }}
                      >
                        <td className="px-3 py-2">
                          {isExisting ? (
                            <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                              {draft.displayName}
                            </span>
                          ) : (
                            <Input
                              value={draft.displayName}
                              onChange={(e) => updateProject(idx, 'displayName', e.target.value)}
                              placeholder="Project name"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isExisting ? (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                              style={{
                                backgroundColor: 'var(--surface-interactive)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              Configured
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                              style={{
                                backgroundColor: 'var(--brand-orange-500)',
                                color: 'white',
                              }}
                            >
                              New
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isExisting ? (
                            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                              ${draft.defaultRate}/hr
                            </span>
                          ) : (
                            <NumberInput
                              value={draft.defaultRate}
                              onChange={(e) => updateProject(idx, 'defaultRate', e.target.value)}
                              placeholder="0"
                              min={0}
                              suffix="$/hr"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isExisting ? (
                            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                              {draft.otThreshold} hrs
                            </span>
                          ) : (
                            <NumberInput
                              value={draft.otThreshold}
                              onChange={(e) => updateProject(idx, 'otThreshold', e.target.value)}
                              placeholder="40"
                              min={1}
                              max={168}
                              suffix="hrs"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {draft.allocations.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {draft.allocations.map((a) => (
                                <span
                                  key={a}
                                  className="inline-flex px-1.5 py-0.5 rounded text-xs font-mono"
                                  style={{ backgroundColor: 'var(--surface-interactive)', color: 'var(--text-secondary)' }}
                                >
                                  {a}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs italic" style={{ color: 'var(--text-faint)' }}>None matched</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---- Step 1: New Employees ---- */}
        {step === 1 && (
          <EmployeeStep
            employeeDrafts={employeeDrafts}
            employeeProjectMap={employeeProjectMap}
            projectDrafts={projectDrafts}
            existingProjects={existingProjects}
            updateEmployee={updateEmployee}
          />
        )}

        {/* ---- Step 2: Review ---- */}
        {step === 2 && (
          <div className="px-5 py-4 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Review the configuration before importing.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Projects summary */}
              <div className="rounded-lg p-4 flex flex-col gap-2" style={{ border: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-lw-orange-400" />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {builtProjects.length} new project{builtProjects.length !== 1 ? 's' : ''}{' '}
                    {projectDrafts.length - builtProjects.length > 0
                      ? `(+ ${projectDrafts.length - builtProjects.length} existing)`
                      : ''}
                  </h3>
                </div>
                {builtProjects.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    {builtProjects.slice(0, 5).map((p) => (
                      <div
                        key={p.projectKey}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{p.displayName}</span>
                        <span className="shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>
                          ${p.defaultRegularRate}/hr &middot; {p.otThresholdHrs}hr OT
                        </span>
                      </div>
                    ))}
                    {builtProjects.length > 5 && (
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        and {builtProjects.length - 5} more...
                      </span>
                    )}
                  </div>
                )}
                {builtProjects.length === 0 && (
                  <span className="text-xs italic" style={{ color: 'var(--text-faint)' }}>No new projects — all already configured</span>
                )}
              </div>

              {/* Employees summary */}
              <div className="rounded-lg p-4 flex flex-col gap-2" style={{ border: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-lw-orange-400" />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {builtEmployees.length} employee profile{builtEmployees.length !== 1 ? 's' : ''} created
                  </h3>
                </div>
                {builtEmployees.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    {builtEmployees.slice(0, 5).map((e) => (
                      <div
                        key={e.code}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                          {e.firstName} {e.lastName}
                        </span>
                        <span className="shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>
                          ${e.defaultBillRate}/hr
                          {e.jobTitle ? ` · ${e.jobTitle}` : ''}
                        </span>
                      </div>
                    ))}
                    {builtEmployees.length > 5 && (
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        and {builtEmployees.length - 5} more...
                      </span>
                    )}
                  </div>
                )}
                {builtEmployees.length === 0 && (
                  <span className="text-xs italic" style={{ color: 'var(--text-faint)' }}>No new employees</span>
                )}
              </div>
            </div>

            {/* Rate cascade preview */}
            {builtProjects.length > 0 && builtEmployees.length > 0 && (
              <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-default)' }}>
                <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Rate Cascade Preview</h4>
                <div className="flex flex-col gap-1">
                  {builtProjects.slice(0, 3).map((proj) => {
                    const emp = builtEmployees[0]
                    const existingCfg = existingProjects[proj.projectKey]
                    const override = existingCfg?.employeeRateOverrides[emp.code]
                    const effectiveRate =
                      ((override?.regularRate ??
                      proj.defaultRegularRate) ||
                      emp.defaultBillRate) ||
                      0
                    return (
                      <div
                        key={proj.projectKey}
                        className="flex items-center gap-2 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{emp.firstName} {emp.lastName}</span>
                        <span style={{ color: 'var(--text-faint)' }}>&rarr;</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{proj.displayName}</span>
                        <span style={{ color: 'var(--text-faint)' }}>=</span>
                        <span className="text-lw-orange-400 font-mono">${effectiveRate}/hr</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---- Footer ---- */}
        <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
          <div>
            {step === 0 && (
              <Button variant="ghost" size="sm" onClick={skipProjects}>
                Use defaults for all &amp; skip
              </Button>
            )}
            {step === 1 && (
              <Button variant="ghost" size="sm" onClick={skipEmployees}>
                Use defaults for all &amp; skip
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            {step > initialStep && (
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronLeft className="w-3.5 h-3.5" />}
                onClick={goBack}
              >
                Back
              </Button>
            )}
            {step < 2 ? (
              <Button variant="primary" size="sm" onClick={goNext}>
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleComplete}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Save &amp; Reconcile
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

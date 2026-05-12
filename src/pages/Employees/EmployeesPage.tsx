import { useState, useMemo, useRef, useCallback } from 'react'
import { ChevronRight, Download, FileDown, Plus, Search, Upload, UserPlus, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConflictReviewModal } from '@/components/ConflictReviewModal'
import { useEmployeeStore } from '@/store/employeeStore'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { EmployeeProfile } from '@/persistence/schemas'
import {
  exportEmployeesCsv,
  parseEmployeesCsv,
  generateEmployeeCsvTemplate,
  downloadCsv,
} from '@/lib/csvImportExport'
import { detectEmployeeConflicts } from '@/lib/conflictDetection'
import type { ConflictRecord, ResolvedConflict } from '@/lib/conflictDetection'
import { resolveEmployeeConflicts } from '@/lib/conflictResolver'
import { EmployeeProfileDrawer } from './EmployeeProfileDrawer'

type SortKey = 'code' | 'name' | 'defaultBillRate' | 'jobTitle' | 'overrides' | 'lastModified'
type SortDir = 'asc' | 'desc'

function countOverrides(
  code: string,
  projectConfigs: Record<string, { employeeRateOverrides: Record<string, unknown> }>,
): number {
  let count = 0
  for (const cfg of Object.values(projectConfigs)) {
    if (code in cfg.employeeRateOverrides) count++
  }
  return count
}

export default function EmployeesPage(): React.JSX.Element {
  const employees = useEmployeeStore((s) => s.employees)
  const upsertMany = useEmployeeStore((s) => s.upsertMany)
  const projectConfigs = useSnapshotStore((s) => s.projectConfigs)

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null)
  const [isAddMode, setIsAddMode] = useState(false)

  // CSV import state
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvImportWarnings, setCsvImportWarnings] = useState<string[]>([])
  const [csvImportSuccess, setCsvImportSuccess] = useState<string | null>(null)

  // Conflict review state
  const [pendingConflicts, setPendingConflicts] = useState<ConflictRecord[]>([])
  const [pendingNewRecords, setPendingNewRecords] = useState<EmployeeProfile[]>([])
  const [pendingUnchangedCount, setPendingUnchangedCount] = useState(0)
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false)

  const handleCsvImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''
      setCsvImportWarnings([])
      setCsvImportSuccess(null)

      const text = await file.text()
      const { records, warnings } = parseEmployeesCsv(text)
      setCsvImportWarnings(warnings)

      if (records.length === 0) {
        setCsvImportWarnings((prev) => [...prev, 'No valid employee records found in CSV'])
        return
      }

      const result = detectEmployeeConflicts(records, employees)

      // Immediately import new records
      if (result.newRecords.length > 0) {
        await upsertMany(result.newRecords)
      }

      if (result.conflicts.length > 0) {
        // Show conflict review modal
        setPendingConflicts(result.conflicts)
        setPendingNewRecords(result.newRecords)
        setPendingUnchangedCount(result.unchangedCount)
        setIsConflictModalOpen(true)
      } else {
        // No conflicts — show success immediately
        const parts: string[] = []
        if (result.newRecords.length > 0) {
          parts.push(`${result.newRecords.length} employee${result.newRecords.length !== 1 ? 's' : ''} imported`)
        }
        if (result.unchangedCount > 0) {
          parts.push(`${result.unchangedCount} unchanged`)
        }
        setCsvImportSuccess(parts.join(', ') || 'No changes detected')
        setTimeout(() => setCsvImportSuccess(null), 5000)
      }
    },
    [employees, upsertMany],
  )

  const handleConflictConfirm = useCallback(
    async (resolved: ResolvedConflict[]): Promise<void> => {
      const mergedProfiles = resolveEmployeeConflicts(resolved, employees)
      if (mergedProfiles.length > 0) {
        await upsertMany(mergedProfiles)
      }
      setIsConflictModalOpen(false)

      const parts: string[] = []
      if (pendingNewRecords.length > 0) {
        parts.push(`${pendingNewRecords.length} imported`)
      }
      if (mergedProfiles.length > 0) {
        parts.push(`${mergedProfiles.length} updated`)
      }
      if (pendingUnchangedCount > 0) {
        parts.push(`${pendingUnchangedCount} unchanged`)
      }
      setCsvImportSuccess(parts.join(', '))
      setTimeout(() => setCsvImportSuccess(null), 5000)

      setPendingConflicts([])
      setPendingNewRecords([])
      setPendingUnchangedCount(0)
    },
    [employees, upsertMany, pendingNewRecords, pendingUnchangedCount],
  )

  const handleConflictClose = useCallback((): void => {
    setIsConflictModalOpen(false)
    setPendingConflicts([])
    setPendingNewRecords([])
    setPendingUnchangedCount(0)
  }, [])

  const handleCsvExport = useCallback((): void => {
    const csv = exportEmployeesCsv(employees)
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(csv, `employees-${date}.csv`)
  }, [employees])

  const handleDownloadTemplate = useCallback((): void => {
    downloadCsv(generateEmployeeCsvTemplate(), 'employee-template.csv')
  }, [])

  const employeeList = useMemo(() => {
    const list = Object.values(employees)
    const filtered = search.trim()
      ? list.filter((e) => {
          const q = search.toLowerCase()
          return (
            e.code.toLowerCase().includes(q) ||
            e.firstName.toLowerCase().includes(q) ||
            e.lastName.toLowerCase().includes(q) ||
            `${e.firstName} ${e.lastName}`.toLowerCase().includes(q)
          )
        })
      : list

    return filtered.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'code':
          return dir * a.code.localeCompare(b.code)
        case 'name':
          return dir * `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
        case 'defaultBillRate':
          return dir * (a.defaultBillRate - b.defaultBillRate)
        case 'jobTitle':
          return dir * (a.jobTitle ?? '').localeCompare(b.jobTitle ?? '')
        case 'overrides':
          return dir * (countOverrides(a.code, projectConfigs) - countOverrides(b.code, projectConfigs))
        case 'lastModified':
          return dir * a.lastModifiedAt.localeCompare(b.lastModifiedAt)
        default:
          return 0
      }
    })
  }, [employees, search, sortKey, sortDir, projectConfigs])

  const handleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleAddEmployee = (): void => {
    setIsAddMode(true)
    setSelectedEmployee({
      code: '',
      firstName: '',
      lastName: '',
      defaultBillRate: 0,
      jobTitle: undefined,
      notes: undefined,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
    })
  }

  const handleCloseDrawer = (): void => {
    setSelectedEmployee(null)
    setIsAddMode(false)
  }

  const sortIndicator = (key: SortKey): string => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Default bill rates, job titles, and per-employee configuration"
      />

      {/* Toolbar */}
      <div className="mx-8 mt-6 flex items-center gap-3">
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingIcon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<Upload className="w-3.5 h-3.5" />}
          onClick={() => csvInputRef.current?.click()}
        >
          Import CSV
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Download className="w-3.5 h-3.5" />}
          onClick={handleCsvExport}
          disabled={Object.keys(employees).length === 0}
        >
          Export CSV
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<FileDown className="w-3.5 h-3.5" />}
          onClick={handleDownloadTemplate}
        >
          Template
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={handleAddEmployee}
        >
          Add Employee
        </Button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => void handleCsvImport(e)}
        />
      </div>

      {/* CSV import feedback */}
      {(csvImportSuccess || csvImportWarnings.length > 0) && (
        <div className="mx-8 mt-2 space-y-1">
          {csvImportSuccess && (
            <p className="text-xs text-green-400">{csvImportSuccess}</p>
          )}
          {csvImportWarnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400">{w}</p>
          ))}
        </div>
      )}

      {/* Table / empty state */}
      <div className="mx-8 mt-4 mb-8">
        {employeeList.length === 0 && !search.trim() ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0a0f1c]/40 flex flex-col items-center justify-center py-16 px-6 text-center gap-4 animate-fade-in">
            <div className="relative">
              <span
                aria-hidden
                className="absolute -inset-2 rounded-2xl bg-lw-orange-500/15 blur-xl"
              />
              <div className="relative w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Users className="w-6 h-6 text-lw-orange-400" />
              </div>
            </div>
            <div className="max-w-sm">
              <h3 className="font-display text-lg font-semibold text-slate-100 tracking-tight">
                No employees yet
              </h3>
              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                Import data on the Billing Hours page to auto-create employees, or add them
                manually with the button above.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<UserPlus className="w-3.5 h-3.5" />}
              onClick={handleAddEmployee}
            >
              Add your first employee
            </Button>
          </div>
        ) : employeeList.length === 0 && search.trim() ? (
          <div className="rounded-xl border border-slate-800 bg-[#0a0f1c]/40 flex flex-col items-center justify-center py-12 px-6 text-center gap-2">
            <p className="text-sm text-slate-400">
              No employees match &ldquo;{search}&rdquo;
            </p>
            <button
              onClick={() => setSearch('')}
              className="text-xs text-lw-orange-400 hover:text-lw-orange-300 transition-colors"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <SortTh label="Employee Code" sortKey="code" current={sortKey} dir={sortDir} onClick={handleSort} indicator={sortIndicator('code')} />
                  <SortTh label="Name" sortKey="name" current={sortKey} dir={sortDir} onClick={handleSort} indicator={sortIndicator('name')} />
                  <SortTh label="Default Bill Rate" sortKey="defaultBillRate" current={sortKey} dir={sortDir} onClick={handleSort} indicator={sortIndicator('defaultBillRate')} />
                  <SortTh label="Job Title" sortKey="jobTitle" current={sortKey} dir={sortDir} onClick={handleSort} indicator={sortIndicator('jobTitle')} />
                  <SortTh label="# Project Overrides" sortKey="overrides" current={sortKey} dir={sortDir} onClick={handleSort} indicator={sortIndicator('overrides')} />
                  <SortTh label="Last Modified" sortKey="lastModified" current={sortKey} dir={sortDir} onClick={handleSort} indicator={sortIndicator('lastModified')} />
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {employeeList.map((emp, i) => {
                  const overrideCount = countOverrides(emp.code, projectConfigs)
                  const isLast = i === employeeList.length - 1
                  return (
                    <tr
                      key={emp.code}
                      onClick={() => {
                        setIsAddMode(false)
                        setSelectedEmployee(emp)
                      }}
                      className={`cursor-pointer hover:bg-slate-800/50 transition-colors ${
                        isLast ? '' : 'border-b border-slate-800/60'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Badge tone="gray">{emp.code}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {emp.firstName} {emp.lastName}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {emp.defaultBillRate > 0 ? (
                          `$${emp.defaultBillRate.toFixed(2)}/hr`
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {emp.jobTitle ?? <span className="text-slate-600">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3">
                        {overrideCount > 0 ? (
                          <Badge tone="blue">
                            {overrideCount} project{overrideCount !== 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <span className="text-slate-600 text-xs">none</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(emp.lastModifiedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EmployeeProfileDrawer
        employee={selectedEmployee}
        isAddMode={isAddMode}
        onClose={handleCloseDrawer}
      />

      <ConflictReviewModal
        open={isConflictModalOpen}
        onClose={handleConflictClose}
        onConfirm={(resolved) => void handleConflictConfirm(resolved)}
        title="Review Employee Import"
        conflicts={pendingConflicts}
        unchangedCount={pendingUnchangedCount}
        newCount={pendingNewRecords.length}
      />
    </div>
  )
}

/* ── Sortable table header cell ─────────────────────────────────────── */

interface SortThProps {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onClick: (key: SortKey) => void
  indicator: string
}

function SortTh({ label, sortKey, current, onClick, indicator }: SortThProps): React.JSX.Element {
  const isActive = current === sortKey
  return (
    <th
      onClick={() => onClick(sortKey)}
      className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${
        isActive ? 'text-slate-300' : 'text-slate-500 hover:text-slate-400'
      }`}
    >
      {label}{indicator}
    </th>
  )
}

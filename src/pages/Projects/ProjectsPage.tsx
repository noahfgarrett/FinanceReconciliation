import { useState, useRef, useCallback } from 'react'
import { ChevronRight, Download, FileDown, FolderOpen, Upload } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConflictReviewModal } from '@/components/ConflictReviewModal'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { ProjectConfig } from '@/persistence/schemas'
import {
  exportProjectsCsv,
  parseProjectsCsv,
  generateProjectCsvTemplate,
  downloadCsv,
} from '@/lib/csvImportExport'
import { detectProjectConflicts } from '@/lib/conflictDetection'
import type { ConflictRecord, ResolvedConflict } from '@/lib/conflictDetection'
import { resolveProjectConflicts } from '@/lib/conflictResolver'
import { ProjectConfigDrawer } from './ProjectConfigDrawer'
import { ClientsTab } from './ClientsTab'

type TabId = 'projects' | 'clients'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'projects', label: 'Projects' },
  { id: 'clients', label: 'Clients' },
]

export default function ProjectsPage(): React.JSX.Element {
  const projectConfigs = useSnapshotStore((s) => s.projectConfigs)
  const clients = useSnapshotStore((s) => s.clients)
  const upsertProjectConfig = useSnapshotStore((s) => s.upsertProjectConfig)

  const [activeTab, setActiveTab] = useState<TabId>('projects')
  const [selectedProject, setSelectedProject] = useState<ProjectConfig | null>(null)

  // CSV import state
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvImportWarnings, setCsvImportWarnings] = useState<string[]>([])
  const [csvImportSuccess, setCsvImportSuccess] = useState<string | null>(null)

  // Conflict review state
  const [pendingConflicts, setPendingConflicts] = useState<ConflictRecord[]>([])
  const [pendingNewRecords, setPendingNewRecords] = useState<ProjectConfig[]>([])
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
      const { records, warnings } = parseProjectsCsv(text)
      setCsvImportWarnings(warnings)

      if (records.length === 0) {
        setCsvImportWarnings((prev) => [...prev, 'No valid project records found in CSV'])
        return
      }

      const result = detectProjectConflicts(records, projectConfigs)

      // Immediately import new records
      for (const newCfg of result.newRecords) {
        await upsertProjectConfig(newCfg)
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
          parts.push(`${result.newRecords.length} project${result.newRecords.length !== 1 ? 's' : ''} imported`)
        }
        if (result.unchangedCount > 0) {
          parts.push(`${result.unchangedCount} unchanged`)
        }
        setCsvImportSuccess(parts.join(', ') || 'No changes detected')
        setTimeout(() => setCsvImportSuccess(null), 5000)
      }
    },
    [projectConfigs, upsertProjectConfig],
  )

  const handleConflictConfirm = useCallback(
    async (resolved: ResolvedConflict[]): Promise<void> => {
      const mergedConfigs = resolveProjectConflicts(resolved, projectConfigs)
      for (const cfg of mergedConfigs) {
        await upsertProjectConfig(cfg)
      }
      setIsConflictModalOpen(false)

      const parts: string[] = []
      if (pendingNewRecords.length > 0) {
        parts.push(`${pendingNewRecords.length} imported`)
      }
      if (mergedConfigs.length > 0) {
        parts.push(`${mergedConfigs.length} updated`)
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
    [projectConfigs, upsertProjectConfig, pendingNewRecords, pendingUnchangedCount],
  )

  const handleConflictClose = useCallback((): void => {
    setIsConflictModalOpen(false)
    setPendingConflicts([])
    setPendingNewRecords([])
    setPendingUnchangedCount(0)
  }, [])

  const handleCsvExport = useCallback((): void => {
    const csv = exportProjectsCsv(projectConfigs)
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(csv, `projects-${date}.csv`)
  }, [projectConfigs])

  const handleDownloadTemplate = useCallback((): void => {
    downloadCsv(generateProjectCsvTemplate(), 'project-template.csv')
  }, [])

  const projectList = Object.values(projectConfigs).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  )

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="OT thresholds, rates, and allocation aliases per project"
      />

      {/* Tab strip */}
      <div className="mx-8 mt-4 flex items-center gap-1 border-b border-slate-800">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                isActive ? 'text-lw-orange-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-lw-orange-500 rounded-t-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'projects' && (
          <div className="mx-8 mb-8">
            {/* CSV toolbar */}
            <div className="flex items-center gap-3 mb-4">
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
                disabled={projectList.length === 0}
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
              <div className="mb-4 space-y-1">
                {csvImportSuccess && (
                  <p className="text-xs text-green-400">{csvImportSuccess}</p>
                )}
                {csvImportWarnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-400">{w}</p>
                ))}
              </div>
            )}
            {projectList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0a0f1c]/40 flex flex-col items-center justify-center py-16 px-6 text-center gap-4 animate-fade-in">
                <div className="relative">
                  <span aria-hidden className="absolute -inset-2 rounded-2xl bg-lw-orange-500/15 blur-xl" />
                  <div className="relative w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <FolderOpen className="w-6 h-6 text-lw-orange-400" />
                  </div>
                </div>
                <div className="max-w-sm">
                  <h3 className="font-display text-lg font-semibold text-slate-100 tracking-tight">
                    No projects yet
                  </h3>
                  <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                    Import a monthly Excel + PDFs on the Billing Hours page to see configured
                    projects appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Display Name
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Client
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        OT Threshold
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Default Rate
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Aliases
                      </th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {projectList.map((cfg, i) => {
                      const client = cfg.clientId ? clients[cfg.clientId] : undefined
                      const isLast = i === projectList.length - 1
                      return (
                        <tr
                          key={cfg.projectKey}
                          onClick={() => setSelectedProject(cfg)}
                          className={`cursor-pointer hover:bg-slate-800/50 transition-colors ${
                            isLast ? '' : 'border-b border-slate-800/60'
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-slate-100">{cfg.displayName}</td>
                          <td className="px-4 py-3 text-slate-400">
                            {client?.name ?? <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone="amber">{cfg.otThresholdHrs} hrs/wk</Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {cfg.defaultRegularRate > 0 ? `$${cfg.defaultRegularRate}/hr` : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {cfg.allocationAliases.length > 0 ? (
                              <Badge tone="blue">{cfg.allocationAliases.length} alias{cfg.allocationAliases.length !== 1 ? 'es' : ''}</Badge>
                            ) : (
                              <span className="text-slate-600 text-xs">none</span>
                            )}
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
        )}

        {activeTab === 'clients' && <ClientsTab />}
      </div>

      <ProjectConfigDrawer
        config={selectedProject}
        onClose={() => setSelectedProject(null)}
      />

      <ConflictReviewModal
        open={isConflictModalOpen}
        onClose={handleConflictClose}
        onConfirm={(resolved) => void handleConflictConfirm(resolved)}
        title="Review Project Import"
        conflicts={pendingConflicts}
        unchangedCount={pendingUnchangedCount}
        newCount={pendingNewRecords.length}
      />
    </div>
  )
}

import { useState } from 'react'
import { ChevronRight, FolderOpen } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { ProjectConfig } from '@/persistence/schemas'
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

  const [activeTab, setActiveTab] = useState<TabId>('projects')
  const [selectedProject, setSelectedProject] = useState<ProjectConfig | null>(null)

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
            {projectList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <FolderOpen className="w-10 h-10 text-slate-700" />
                <p className="text-slate-400 font-medium">No projects yet</p>
                <p className="text-sm text-slate-600">
                  Import data on the Billing Hours page or load sample data
                </p>
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
    </div>
  )
}

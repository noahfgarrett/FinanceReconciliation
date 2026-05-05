import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ImportFlow } from '@/components/ImportFlow'
import { KpiStrip } from './KpiStrip'
import { ByProjectView } from './ByProjectView'
import { ByEmployeeView } from './ByEmployeeView'
import { ByWeekView } from './ByWeekView'
import { SpreadsheetView } from './Spreadsheet/SpreadsheetView'
import { RoundTripBanner } from './RoundTripBanner'
import { SaveSnapshotModal } from './SaveSnapshotModal'
import { useSnapshotStore } from '@/store/snapshotStore'
import { useUiStore } from '@/store/uiStore'
import { Button } from '@/components/ui/Button'
import { BookmarkPlus, Trash2, Clock, Sparkles } from 'lucide-react'
import { kvGet, kvSet } from '@/persistence/idb'
import { generateSampleData } from '@/lib/sampleData'
import { relativeTime } from '@/lib/relativeTime'

type TabId = 'by-project' | 'by-employee' | 'by-week' | 'spreadsheet'

interface Tab {
  id: TabId
  label: string
}

const TABS: Tab[] = [
  { id: 'by-project', label: 'By Project' },
  { id: 'by-employee', label: 'By Employee' },
  { id: 'by-week', label: 'By Week' },
  { id: 'spreadsheet', label: 'Spreadsheet' },
]

const TAB_STORAGE_KEY = 'billing:activeTab'

export default function BillingHoursPage() {
  const snap = useSnapshotStore((s) => s.current)
  const configs = useSnapshotStore((s) => s.projectConfigs)
  const clearCurrent = useSnapshotStore((s) => s.clearCurrent)
  const recentImports = useSnapshotStore((s) => s.recentImports)
  const importBatch = useSnapshotStore((s) => s.importBatch)
  const addRecentImport = useSnapshotStore((s) => s.addRecentImport)

  const triggerSaveSnapshot = useUiStore((s) => s.triggerSaveSnapshot)
  const setTriggerSaveSnapshot = useUiStore((s) => s.setTriggerSaveSnapshot)

  const [activeTab, setActiveTab] = useState<TabId>('by-project')
  const [showSaveModal, setShowSaveModal] = useState(false)

  // Handle ⌘S trigger from keyboard shortcuts
  useEffect(() => {
    if (triggerSaveSnapshot && snap?.isDraft) {
      setShowSaveModal(true)
      setTriggerSaveSnapshot(false)
    } else if (triggerSaveSnapshot) {
      setTriggerSaveSnapshot(false)
    }
  }, [triggerSaveSnapshot, snap?.isDraft, setTriggerSaveSnapshot])

  // Restore tab from storage on mount
  useEffect(() => {
    void kvGet<TabId>(TAB_STORAGE_KEY).then((saved) => {
      if (saved && TABS.some((t) => t.id === saved)) {
        setActiveTab(saved)
      }
    })
  }, [])

  const handleTabChange = (id: TabId) => {
    setActiveTab(id)
    void kvSet(TAB_STORAGE_KEY, id)
  }

  return (
    <div>
      <PageHeader
        title="Billing Hours"
        subtitle={
          snap
            ? `${snap.periodLabel} · ${snap.employees.length} employees · ${Object.keys(configs).length} projects`
            : 'Drop your monthly Excel + PDF folder, or load sample data to explore'
        }
        actions={
          snap ? (
            <div className="flex gap-2">
              {snap.isDraft && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<BookmarkPlus className="w-4 h-4" />}
                  onClick={() => setShowSaveModal(true)}
                >
                  Save Snapshot
                </Button>
              )}
              <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => void clearCurrent()}>
                Clear
              </Button>
            </div>
          ) : undefined
        }
      />
      <SaveSnapshotModal open={showSaveModal} onClose={() => setShowSaveModal(false)} />

      {!snap ? (
        <>
          <ImportFlow />
          {recentImports.length > 0 && (
            <div className="mx-8 mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Recent imports
                </span>
              </div>
              <div className="space-y-1.5">
                {recentImports.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-lw-orange-400" />
                      <span className="text-sm text-slate-300">
                        {entry.folderName ?? entry.excelName ?? 'Unknown import'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-600">{relativeTime(entry.ts)}</span>
                      {entry.folderName === 'Sample Data' && (
                        <button
                          className="text-xs text-lw-orange-400 hover:text-lw-orange-300 transition-colors"
                          onClick={() => {
                            const data = generateSampleData()
                            void importBatch(data).then(() =>
                              addRecentImport({ folderName: 'Sample Data' }),
                            )
                          }}
                        >
                          Reload
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <RoundTripBanner snap={snap} />
          <KpiStrip snap={snap} configs={configs} />

          {/* Tab strip */}
          <div className="mx-8 mt-4 mb-0 flex items-center gap-1 border-b border-slate-800">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
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
            {activeTab === 'by-project' && (
              <ByProjectView snap={snap} configs={configs} />
            )}
            {activeTab === 'by-employee' && (
              <ByEmployeeView snap={snap} configs={configs} />
            )}
            {activeTab === 'by-week' && (
              <ByWeekView snap={snap} configs={configs} />
            )}
            {activeTab === 'spreadsheet' && (
              <div className="mx-8 mb-8">
                <SpreadsheetView
                  rows={snap.weeklyBilling}
                  configs={configs}
                  employees={snap.employees}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

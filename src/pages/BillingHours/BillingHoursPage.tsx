import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ImportFlow } from '@/components/ImportFlow'
import { KpiStrip } from './KpiStrip'
import { ByProjectView } from './ByProjectView'
import { ByEmployeeView } from './ByEmployeeView'
import { SpreadsheetView } from './Spreadsheet/SpreadsheetView'
import { useSnapshotStore } from '@/store/snapshotStore'
import { Button } from '@/components/ui/Button'
import { Trash2 } from 'lucide-react'
import { kvGet, kvSet } from '@/persistence/idb'

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

  const [activeTab, setActiveTab] = useState<TabId>('by-project')

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

  const comingSoon = (
    <div className="mx-8 mt-6 flex flex-col items-center justify-center py-20 bg-[#0a0f1c] border border-slate-800 rounded-xl">
      <div className="text-2xl font-semibold text-slate-300 mb-2">Coming in Phase 9</div>
      <div className="text-slate-500 text-sm">This view is under construction.</div>
    </div>
  )

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
            <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => void clearCurrent()}>
              Clear
            </Button>
          ) : undefined
        }
      />
      {!snap ? (
        <ImportFlow />
      ) : (
        <>
          <KpiStrip snap={snap} configs={configs} />

          {/* Tab strip */}
          <div className="mx-8 mt-4 mb-0 flex items-center gap-1 border-b border-slate-800">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              const isDisabled = tab.id === 'by-week'
              return (
                <button
                  key={tab.id}
                  onClick={() => !isDisabled && handleTabChange(tab.id)}
                  disabled={isDisabled}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                    isActive
                      ? 'text-lw-orange-400'
                      : isDisabled
                        ? 'text-slate-700 cursor-not-allowed'
                        : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-lw-orange-500 rounded-t-full" />
                  )}
                  {isDisabled && (
                    <span className="ml-1.5 text-[10px] text-slate-700 font-normal">soon</span>
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
            {activeTab === 'by-week' && comingSoon}
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

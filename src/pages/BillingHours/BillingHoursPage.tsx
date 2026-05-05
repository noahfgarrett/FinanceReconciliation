import { PageHeader } from '@/components/layout/PageHeader'
import { ImportFlow } from '@/components/ImportFlow'
import { KpiStrip } from './KpiStrip'
import { ByProjectView } from './ByProjectView'
import { useSnapshotStore } from '@/store/snapshotStore'
import { Button } from '@/components/ui/Button'
import { Trash2 } from 'lucide-react'

export default function BillingHoursPage() {
  const snap = useSnapshotStore((s) => s.current)
  const configs = useSnapshotStore((s) => s.projectConfigs)
  const clearCurrent = useSnapshotStore((s) => s.clearCurrent)

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
          <ByProjectView snap={snap} configs={configs} />
        </>
      )}
    </div>
  )
}

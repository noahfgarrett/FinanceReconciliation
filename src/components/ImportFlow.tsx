import { useState } from 'react'
import { DropZone } from './DropZone'
import { useSnapshotStore } from '@/store/snapshotStore'
import { generateSampleData } from '@/lib/sampleData'

export function ImportFlow() {
  const importBatch = useSnapshotStore((s) => s.importBatch)
  const addRecentImport = useSnapshotStore((s) => s.addRecentImport)
  const [status, setStatus] = useState<string | null>(null)

  async function loadSample() {
    setStatus('Generating sample data…')
    const data = generateSampleData()
    await importBatch(data)
    await addRecentImport({ folderName: 'Sample Data' })
    setStatus(null)
  }

  return <DropZone onLoadSample={loadSample} status={status ?? undefined} />
}

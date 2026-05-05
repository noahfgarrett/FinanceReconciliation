import { useState } from 'react'
import { DropZone } from './DropZone'
import { useSnapshotStore } from '@/store/snapshotStore'
import { generateSampleData } from '@/lib/sampleData'

export function ImportFlow() {
  const importBatch = useSnapshotStore((s) => s.importBatch)
  const [status, setStatus] = useState<string | null>(null)

  async function loadSample() {
    setStatus('Generating sample data…')
    const data = generateSampleData()
    await importBatch(data)
    setStatus(null)
  }

  return <DropZone onLoadSample={loadSample} status={status ?? undefined} />
}

import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useUiStore } from '@/store/uiStore'
import { useSnapshotStore } from '@/store/snapshotStore'

export default function App() {
  const hydrateUi = useUiStore((s) => s.hydrate)
  const hydrateSnap = useSnapshotStore((s) => s.hydrate)
  useEffect(() => {
    void hydrateUi()
    void hydrateSnap()
  }, [hydrateUi, hydrateSnap])
  return <AppShell />
}

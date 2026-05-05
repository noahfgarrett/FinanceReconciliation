import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useUiStore } from '@/store/uiStore'
import { useSnapshotStore } from '@/store/snapshotStore'
import { UpdateModal } from '@/components/UpdateModal'
import { checkForUpdate, type UpdateInfo } from '@/utils/updateChecker'

export default function App() {
  const hydrateUi = useUiStore((s) => s.hydrate)
  const hydrateSnap = useSnapshotStore((s) => s.hydrate)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  useEffect(() => {
    void hydrateUi()
    void hydrateSnap()

    // Service worker registration + in-tab update prompt
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent<{ type?: string }>) => {
        if (event.data?.type === 'UPDATE_AVAILABLE') {
          if (confirm('A new version of LotusWorks Reconciler is available. Reload now?')) {
            window.location.reload()
          }
        }
      })
    }

    // GitHub Releases version check
    void checkForUpdate().then((info) => {
      if (info) {
        setUpdateInfo(info)
        setShowUpdateModal(true)
      }
    })
  }, [hydrateUi, hydrateSnap])

  return (
    <>
      <AppShell />
      <UpdateModal
        open={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false)
          if (updateInfo) {
            localStorage.setItem('lw-recon-lastSeenVersion', updateInfo.version)
          }
        }}
        info={updateInfo}
      />
    </>
  )
}

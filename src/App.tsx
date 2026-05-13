import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useUiStore } from '@/store/uiStore'
import { useSnapshotStore } from '@/store/snapshotStore'
import { useEmployeeStore } from '@/store/employeeStore'
import { useNetworkStore } from '@/store/networkStore'
import { UpdateModal } from '@/components/UpdateModal'
import { CommandPalette } from '@/components/CommandPalette'
import { KeyboardHelpModal } from '@/components/KeyboardHelpModal'
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts'
import { installFetchProxy } from '@/lib/fetchProxy'
import { checkForUpdate, type UpdateInfo } from '@/utils/updateChecker'

// Install the fetch proxy before any network calls happen
installFetchProxy()

export default function App() {
  const hydrateUi = useUiStore((s) => s.hydrate)
  const hydrateSnap = useSnapshotStore((s) => s.hydrate)
  const hydrateEmployees = useEmployeeStore((s) => s.hydrate)
  const hydrateNetwork = useNetworkStore((s) => s.hydrate)
  const showChangelog = useUiStore((s) => s.showChangelog)
  const setShowChangelog = useUiStore((s) => s.setShowChangelog)

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  useKeyboardShortcuts()

  useEffect(() => {
    void hydrateUi()
    void hydrateSnap()
    void hydrateEmployees()

    // Hydrate air-gap preference, then conditionally run version check
    void hydrateNetwork().then(() => {
      const { isAirGapEnabled } = useNetworkStore.getState()
      if (!isAirGapEnabled) {
        void checkForUpdate().then((info) => {
          if (info) {
            setUpdateInfo(info)
            setShowUpdateModal(true)
          }
        })
      }
    })

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
  }, [hydrateUi, hydrateSnap, hydrateEmployees, hydrateNetwork])

  function handleUpdateModalClose(): void {
    setShowUpdateModal(false)
    setShowChangelog(false)
    if (updateInfo) {
      localStorage.setItem('lw-recon-lastSeenVersion', updateInfo.version)
    }
  }

  return (
    <>
      <AppShell />
      <UpdateModal
        open={showUpdateModal || showChangelog}
        onClose={handleUpdateModalClose}
        info={showUpdateModal ? updateInfo : null}
        defaultTab={showChangelog && !showUpdateModal ? 'changelog' : undefined}
      />
      <CommandPalette />
      <KeyboardHelpModal />
    </>
  )
}

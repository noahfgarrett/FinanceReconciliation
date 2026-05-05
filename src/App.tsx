import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useUiStore } from '@/store/uiStore'

export default function App() {
  const hydrate = useUiStore((s) => s.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])
  return <AppShell />
}

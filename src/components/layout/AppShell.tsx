import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { SideNav } from './SideNav'
import { useUiStore } from '@/store/uiStore'
import type { PageId } from '@/types'

const PAGES: Record<PageId, LazyExoticComponent<ComponentType>> = {
  'billing-hours': lazy(() => import('@/pages/BillingHours/BillingHoursPage')),
  reconcile: lazy(() => import('@/pages/Reconcile/ReconcilePage')),
  projects: lazy(() => import('@/pages/Projects/ProjectsPage')),
  exports: lazy(() => import('@/pages/Exports/ExportsPage')),
  history: lazy(() => import('@/pages/History/HistoryPage')),
  settings: lazy(() => import('@/pages/Settings/SettingsPage')),
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] text-slate-600 text-sm">
      Loading…
    </div>
  )
}

export function AppShell() {
  const activePage = useUiStore((s) => s.activePage)
  const Page = PAGES[activePage]
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <SideNav />
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<PageFallback />}>
          <Page />
        </Suspense>
      </main>
    </div>
  )
}

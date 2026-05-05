import { BarChart3, GitCompareArrows, Boxes, Download, History, Settings } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import type { PageId } from '@/types'

interface NavItem {
  id: PageId
  label: string
  icon: typeof BarChart3
  group: 'Workspace' | 'Configuration' | 'Output' | 'History'
}

const ITEMS: NavItem[] = [
  { id: 'billing-hours', label: 'Billing Hours', icon: BarChart3, group: 'Workspace' },
  { id: 'reconcile', label: 'Reconcile', icon: GitCompareArrows, group: 'Workspace' },
  { id: 'projects', label: 'Projects', icon: Boxes, group: 'Configuration' },
  { id: 'exports', label: 'Exports', icon: Download, group: 'Output' },
  { id: 'history', label: 'Snapshots', icon: History, group: 'History' },
]

const GROUPS: Array<NavItem['group']> = ['Workspace', 'Configuration', 'Output', 'History']

export function SideNav() {
  const activePage = useUiStore((s) => s.activePage)
  const setActivePage = useUiStore((s) => s.setActivePage)

  return (
    <aside className="w-60 shrink-0 bg-[#0a0f1c] border-r border-slate-800 flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-slate-800 flex items-center gap-3">
        <img
          src="/lotusworks-logo.png"
          alt="LotusWorks"
          className="w-8 h-8 rounded-lg object-contain bg-slate-900 p-1"
        />
        <div className="leading-tight">
          <div className="font-semibold text-slate-100 text-sm">LotusWorks</div>
          <div className="text-xs text-slate-500">Reconciler</div>
        </div>
      </div>

      <nav className="flex-1 py-3">
        {GROUPS.map((group) => {
          const items = ITEMS.filter((i) => i.group === group)
          if (!items.length) return null
          return (
            <div key={group} className="px-3 mb-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold px-3 pb-2">
                {group}
              </div>
              {items.map((item) => {
                const Icon = item.icon
                const isActive = activePage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className={`relative w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors mb-0.5 ${
                      isActive
                        ? 'bg-lw-orange-500/10 text-lw-orange-400'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-lw-orange-500 rounded-r" />
                    )}
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button
          onClick={() => useUiStore.getState().setActivePage('settings')}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <div className="flex items-center gap-2 px-3 py-2 mt-2 text-xs text-slate-500">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
          v{__APP_VERSION__} · up to date
        </div>
      </div>
    </aside>
  )
}

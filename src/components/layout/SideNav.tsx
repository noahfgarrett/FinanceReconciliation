import {
  BarChart3,
  GitCompareArrows,
  Boxes,
  Users,
  Download,
  History,
  Settings,
  Bug,
  Lightbulb,
} from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import type { PageId } from '@/types'
import logoUrl from '@/assets/lotusworks-logo.png'

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
  { id: 'employees', label: 'Employees', icon: Users, group: 'Configuration' },
  { id: 'exports', label: 'Exports', icon: Download, group: 'Output' },
  { id: 'history', label: 'Snapshots', icon: History, group: 'History' },
]

const GROUPS: Array<NavItem['group']> = ['Workspace', 'Configuration', 'Output', 'History']

export function SideNav() {
  const activePage = useUiStore((s) => s.activePage)
  const setActivePage = useUiStore((s) => s.setActivePage)
  const setShowChangelog = useUiStore((s) => s.setShowChangelog)

  return (
    <aside className="relative w-60 shrink-0 bg-[#0a0f1c] border-r border-slate-800 flex flex-col">
      {/* subtle vertical brand sheen behind sidebar */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'linear-gradient(180deg, rgba(244,123,32,0.05) 0%, rgba(0,87,164,0.04) 35%, transparent 60%)',
        }}
      />

      {/* ── Logo / wordmark ────────────────────────────────────────── */}
      <div className="relative px-5 pt-5 pb-4 border-b border-slate-800 flex items-center gap-3">
        <div className="relative">
          <span
            aria-hidden
            className="absolute -inset-1 rounded-xl bg-lw-orange-500/25 blur-md"
          />
          <img
            src={logoUrl}
            alt="LotusWorks"
            className="relative w-9 h-9 rounded-lg object-contain bg-slate-900/80 p-1 ring-1 ring-lw-orange-500/30"
          />
        </div>
        <div className="leading-tight">
          <div className="font-display font-semibold text-slate-100 text-[15px] tracking-tight">
            LotusWorks
          </div>
          <div className="text-[11px] text-slate-500 uppercase tracking-[0.14em] font-medium">
            Reconciler
          </div>
        </div>
      </div>

      {/* ── Nav groups ─────────────────────────────────────────────── */}
      <nav className="relative flex-1 py-3">
        {GROUPS.map((group) => {
          const items = ITEMS.filter((i) => i.group === group)
          if (!items.length) return null
          return (
            <div key={group} className="px-3 mb-5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-600 font-semibold px-3 pb-2">
                {group}
              </div>
              {items.map((item) => {
                const Icon = item.icon
                const isActive = activePage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className={`group relative w-full flex items-center gap-3 px-3 py-2 text-[13px] rounded-lg transition-all duration-200 ease-out-expo mb-0.5 ${
                      isActive
                        ? 'bg-gradient-to-r from-lw-orange-500/15 via-lw-orange-500/10 to-transparent text-lw-orange-300 font-medium shadow-[inset_0_0_0_1px_rgba(244,123,32,0.18)]'
                        : 'text-slate-400 hover:bg-slate-900/70 hover:text-slate-100'
                    }`}
                  >
                    {/* active rail */}
                    <span
                      aria-hidden
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-lw-orange-500 transition-all duration-200 ease-out-expo ${
                        isActive
                          ? 'h-6 opacity-100 shadow-[0_0_8px_rgba(244,123,32,0.6)]'
                          : 'h-3 opacity-0 group-hover:opacity-30'
                      }`}
                    />
                    <Icon
                      className={`w-[15px] h-[15px] shrink-0 transition-transform duration-200 ${
                        isActive ? 'scale-110' : 'group-hover:scale-105'
                      }`}
                    />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="relative p-3 border-t border-slate-800">
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <button
            onClick={() => useUiStore.getState().openFeedback('bug')}
            title="Report a bug"
            className="group flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium rounded-lg bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/8 transition-all duration-200"
          >
            <Bug className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-rotate-12" />
            Report Bug
          </button>
          <button
            onClick={() => useUiStore.getState().openFeedback('enhancement')}
            title="Share an idea"
            className="group flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium rounded-lg bg-slate-900/40 border border-slate-800 text-slate-400 hover:text-blue-300 hover:border-blue-500/40 hover:bg-blue-500/8 transition-all duration-200"
          >
            <Lightbulb className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
            Have an Idea
          </button>
        </div>

        <button
          onClick={() => useUiStore.getState().setActivePage('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 text-[13px] rounded-lg transition-colors ${
            activePage === 'settings'
              ? 'bg-slate-900 text-slate-100'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/70'
          }`}
        >
          <Settings className="w-[15px] h-[15px]" />
          Settings
        </button>

        {/* version / status pill */}
        <button
          onClick={() => setShowChangelog(true)}
          className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-slate-500 hover:text-slate-200 hover:bg-slate-900/70 transition-colors group"
          title="View changelog"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
          </span>
          <span className="font-mono tabular-nums">v{__APP_VERSION__}</span>
          <span className="text-slate-700">·</span>
          <span className="group-hover:text-slate-300 transition-colors">up to date</span>
        </button>
      </div>
    </aside>
  )
}

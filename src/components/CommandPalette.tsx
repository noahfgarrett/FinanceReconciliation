import { useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  GitCompareArrows,
  Boxes,
  Download,
  History,
  Settings,
  Sparkles,
  BookmarkPlus,
  Sun,
  ScrollText,
  Bug,
  Lightbulb,
  Search,
  FileOutput,
  Terminal,
} from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import { useSnapshotStore } from '@/store/snapshotStore'
import { generateSampleData } from '@/lib/sampleData'

interface Command {
  id: string
  label: string
  category: string
  icon: React.ComponentType<{ className?: string }>
  isEnabled?: () => boolean
  action: () => void
}

function useCommands(): Command[] {
  const setActivePage = useUiStore((s) => s.setActivePage)
  const setShowCommandPalette = useUiStore((s) => s.setShowCommandPalette)
  const setShowChangelog = useUiStore((s) => s.setShowChangelog)
  const openFeedback = useUiStore((s) => s.openFeedback)
  const setTheme = useUiStore((s) => s.setTheme)
  const theme = useUiStore((s) => s.theme)
  const setTriggerSaveSnapshot = useUiStore((s) => s.setTriggerSaveSnapshot)

  const importBatch = useSnapshotStore((s) => s.importBatch)
  const addRecentImport = useSnapshotStore((s) => s.addRecentImport)
  const current = useSnapshotStore((s) => s.current)

  function go(page: Parameters<typeof setActivePage>[0]): void {
    setActivePage(page)
    setShowCommandPalette(false)
  }

  return [
    {
      id: 'go-billing',
      label: 'Go to Billing Hours',
      category: 'Navigate',
      icon: BarChart3,
      action: () => go('billing-hours'),
    },
    {
      id: 'go-reconcile',
      label: 'Go to Reconcile',
      category: 'Navigate',
      icon: GitCompareArrows,
      action: () => go('reconcile'),
    },
    {
      id: 'go-projects',
      label: 'Go to Projects',
      category: 'Navigate',
      icon: Boxes,
      action: () => go('projects'),
    },
    {
      id: 'go-exports',
      label: 'Go to Exports',
      category: 'Navigate',
      icon: Download,
      action: () => go('exports'),
    },
    {
      id: 'go-snapshots',
      label: 'Go to Snapshots',
      category: 'Navigate',
      icon: History,
      action: () => go('history'),
    },
    {
      id: 'go-settings',
      label: 'Go to Settings',
      category: 'Navigate',
      icon: Settings,
      action: () => go('settings'),
    },
    {
      id: 'load-sample',
      label: 'Load Sample Data',
      category: 'Data',
      icon: Sparkles,
      action: () => {
        setShowCommandPalette(false)
        const data = generateSampleData()
        void importBatch(data).then(() => void addRecentImport({ folderName: 'Sample Data' }))
      },
    },
    {
      id: 'save-snapshot',
      label: 'Save Current Snapshot',
      category: 'Data',
      icon: BookmarkPlus,
      isEnabled: () => current?.isDraft === true,
      action: () => {
        setShowCommandPalette(false)
        setTriggerSaveSnapshot(true)
      },
    },
    {
      id: 'toggle-theme',
      label: `Toggle Theme (current: ${theme === 'system' ? 'system' : theme})`,
      category: 'Appearance',
      icon: Sun,
      action: () => {
        const resolved = theme === 'dark' ? 'light' : 'dark'
        setTheme(resolved)
        setShowCommandPalette(false)
      },
    },
    {
      id: 'generate-workbook',
      label: 'Generate Workbook',
      category: 'Export',
      icon: FileOutput,
      action: () => go('exports'),
    },
    {
      id: 'generate-invoices',
      label: 'Generate Invoices',
      category: 'Export',
      icon: Terminal,
      action: () => go('exports'),
    },
    {
      id: 'show-changelog',
      label: 'Show Changelog',
      category: 'App',
      icon: ScrollText,
      action: () => {
        setShowCommandPalette(false)
        setShowChangelog(true)
      },
    },
    {
      id: 'submit-bug',
      label: 'Submit Bug Report',
      category: 'App',
      icon: Bug,
      action: () => {
        setShowCommandPalette(false)
        openFeedback('bug')
      },
    },
    {
      id: 'submit-idea',
      label: 'Submit Idea',
      category: 'App',
      icon: Lightbulb,
      action: () => {
        setShowCommandPalette(false)
        openFeedback('enhancement')
      },
    },
  ]
}

const BADGE_COLORS: Record<string, string> = {
  Navigate: 'text-lw-blue-300 bg-lw-blue-500/10 border-lw-blue-500/25',
  Data: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  Appearance: 'text-lw-orange-300 bg-lw-orange-500/10 border-lw-orange-500/25',
  Export: 'text-purple-300 bg-purple-500/10 border-purple-500/25',
  App: 'text-slate-300 bg-slate-700/30 border-slate-600/50',
}

export function CommandPalette(): React.JSX.Element | null {
  const showCommandPalette = useUiStore((s) => s.showCommandPalette)
  const setShowCommandPalette = useUiStore((s) => s.setShowCommandPalette)

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useCommands()

  const filtered = commands.filter((cmd) => {
    if (cmd.isEnabled && !cmd.isEnabled()) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return cmd.label.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q)
  })

  // Reset when opening
  useEffect(() => {
    if (showCommandPalette) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [showCommandPalette])

  // Clamp selected index to filtered length
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      setShowCommandPalette(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[selectedIndex]
      if (cmd) cmd.action()
      return
    }
  }

  if (!showCommandPalette) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
        onClick={() => setShowCommandPalette(false)}
      />
      <div className="relative w-full max-w-xl rounded-2xl bg-[#0a0f1c] border border-slate-800 shadow-2xl overflow-hidden animate-scale-in">
        {/* top brand sheen */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lw-orange-500/60 to-transparent"
        />
        {/* radial brand glow on hover */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              'radial-gradient(120% 60% at 50% -20%, rgba(244,123,32,0.10) 0%, transparent 60%)',
          }}
        />

        {/* Search input */}
        <div className="relative flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
          <Search className="w-4 h-4 text-lw-orange-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-[15px] font-medium text-slate-100 placeholder-slate-500 outline-none tracking-tight"
          />
          <span className="kbd shrink-0">ESC</span>
        </div>

        {/* Results */}
        <div ref={listRef} className="relative max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Search className="w-6 h-6 mx-auto text-slate-700 mb-2" />
              <div className="text-sm text-slate-500">No commands match</div>
              <div className="text-xs text-slate-600 mt-1">Try a different phrase.</div>
            </div>
          ) : (
            filtered.map((cmd, index) => {
              const Icon = cmd.icon
              const isSelected = index === selectedIndex
              const badgeClass = BADGE_COLORS[cmd.category] ?? BADGE_COLORS['App']
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`relative w-full flex items-center gap-3 px-3 mx-2 my-0.5 rounded-lg py-2.5 text-left transition-all duration-150 ease-out-expo ${
                    isSelected
                      ? 'bg-lw-orange-500/12 text-slate-100 ring-1 ring-inset ring-lw-orange-500/25'
                      : 'hover:bg-slate-900/70 text-slate-300'
                  }`}
                >
                  {isSelected && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-lw-orange-500 rounded-r-full shadow-[0_0_8px_rgba(244,123,32,0.6)]"
                    />
                  )}
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-lw-orange-500/20 text-lw-orange-300'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="flex-1 text-[13px] font-medium tracking-tight">{cmd.label}</span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border ${badgeClass}`}
                  >
                    {cmd.category}
                  </span>
                  {isSelected && (
                    <span className="kbd font-mono ml-1">↵</span>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="relative px-4 py-2.5 border-t border-slate-800 flex items-center gap-4 text-[10.5px] text-slate-500 bg-slate-950/40">
          <span className="flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>
            navigate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">↵</span>
            select
          </span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">ESC</span>
            close
          </span>
          <div className="flex-1" />
          <span className="tabular-nums text-slate-600">{filtered.length} commands</span>
        </div>
      </div>
    </div>
  )
}

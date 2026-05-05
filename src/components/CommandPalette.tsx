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
  Navigate: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  Data: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  Appearance: 'text-lw-orange-400 bg-lw-orange-400/10 border-lw-orange-400/20',
  Export: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  App: 'text-slate-400 bg-slate-700/40 border-slate-600',
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setShowCommandPalette(false)}
      />
      <div className="relative w-full max-w-xl rounded-xl bg-[#0a0f1c] border border-slate-800 shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
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
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-500 font-mono shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">No commands match</div>
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
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-slate-800/70' : 'hover:bg-slate-900/50'
                  }`}
                >
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="flex-1 text-sm text-slate-200">{cmd.label}</span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${badgeClass}`}
                  >
                    {cmd.category}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-800 flex items-center gap-3 text-[10px] text-slate-600">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

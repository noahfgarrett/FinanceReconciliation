import { Modal } from '@/components/ui/Modal'
import { useUiStore } from '@/store/uiStore'

interface Shortcut {
  keys: string
  description: string
  context?: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: '⌘S / Ctrl+S', description: 'Save snapshot', context: 'Billing Hours' },
  { keys: '⌘E / Ctrl+E', description: 'Open Exports' },
  { keys: '⌘K / Ctrl+K', description: 'Command palette' },
  { keys: '/', description: 'Focus search', context: 'Spreadsheet' },
  { keys: 'F', description: 'Toggle Flagged-only filter', context: 'Spreadsheet' },
  { keys: '?', description: 'Show keyboard shortcuts' },
]

export function KeyboardHelpModal(): React.JSX.Element {
  const showKeyboardHelp = useUiStore((s) => s.showKeyboardHelp)
  const setShowKeyboardHelp = useUiStore((s) => s.setShowKeyboardHelp)

  return (
    <Modal
      open={showKeyboardHelp}
      onClose={() => setShowKeyboardHelp(false)}
      title="Keyboard Shortcuts"
      width="sm"
    >
      <div className="px-5 py-4">
        <div className="space-y-1">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-300">{s.description}</span>
                {s.context && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded">
                    {s.context}
                  </span>
                )}
              </div>
              <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300 font-mono whitespace-nowrap">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Shortcuts are disabled when typing in inputs or text areas.
        </p>
      </div>
    </Modal>
  )
}

import { Modal } from '@/components/ui/Modal'
import { useUiStore } from '@/store/uiStore'

interface Shortcut {
  keys: string[]
  description: string
  context?: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['⌘', 'S'],     description: 'Save snapshot',                context: 'Billing Hours' },
  { keys: ['⌘', 'E'],     description: 'Open Exports' },
  { keys: ['⌘', 'K'],     description: 'Command palette' },
  { keys: ['/'],          description: 'Focus search',                 context: 'Spreadsheet' },
  { keys: ['F'],          description: 'Toggle Flagged-only filter',   context: 'Spreadsheet' },
  { keys: ['?'],          description: 'Show keyboard shortcuts' },
]

export function KeyboardHelpModal(): React.JSX.Element {
  const showKeyboardHelp = useUiStore((s) => s.showKeyboardHelp)
  const setShowKeyboardHelp = useUiStore((s) => s.setShowKeyboardHelp)

  return (
    <Modal
      open={showKeyboardHelp}
      onClose={() => setShowKeyboardHelp(false)}
      title="Keyboard Shortcuts"
      width="md"
    >
      <div className="px-5 py-5">
        <div className="space-y-0.5">
          {SHORTCUTS.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-md hover:bg-slate-900/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm text-slate-100">{s.description}</span>
                {s.context && (
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 bg-slate-800/70 px-1.5 py-0.5 rounded border border-slate-700/60">
                    {s.context}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {s.keys.map((k, ki) => (
                  <span key={ki} className="kbd">{k}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex items-start gap-2.5">
          <div className="w-5 h-5 rounded-md bg-lw-orange-500/10 border border-lw-orange-500/25 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[10px] text-lw-orange-300 font-bold">i</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Shortcuts are disabled while typing in inputs or text areas. On Windows / Linux, use{' '}
            <span className="kbd">Ctrl</span> in place of <span className="kbd">⌘</span>.
          </p>
        </div>
      </div>
    </Modal>
  )
}

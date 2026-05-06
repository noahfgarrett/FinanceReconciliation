import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RotateCw, ChevronDown } from 'lucide-react'
import { kvDelete } from '@/persistence/idb'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null, showDetails: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReset = async (): Promise<void> => {
    // Clear the most common "stuck on a broken tab" persistence keys.
    try {
      await Promise.all([
        kvDelete('billing:activeTab'),
        kvDelete('current-snapshot-id'),
      ])
    } catch {
      // Ignore — we're going to reload anyway.
    }
    window.location.reload()
  }

  private handleNuke = (): void => {
    if (
      !confirm(
        'This will erase ALL local data on this device — snapshots, projects, clients, settings. Cannot be undone.\n\nContinue?',
      )
    ) {
      return
    }
    indexedDB.deleteDatabase('reconciler')
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    const { error, errorInfo, showDetails } = this.state

    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-950">
        <div className="max-w-2xl w-full rounded-2xl border border-slate-800 bg-[#0a0f1c] p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-slate-100 tracking-tight">
                Something went wrong
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                The app hit an unexpected error. Your saved data is fine.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/60 border border-slate-800 px-4 py-3 mb-5">
            <p className="text-xs font-mono text-red-300 break-words">
              {error?.message ?? 'Unknown error'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            <button
              onClick={() => void this.handleReset()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-lw-orange-500 hover:bg-lw-orange-600 text-white text-sm font-semibold shadow-[0_4px_14px_rgba(244,123,32,0.3)] transition-colors"
            >
              <RotateCw className="w-4 h-4" />
              Reset and reload
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm hover:bg-slate-800 transition-colors"
            >
              Reload only
            </button>
            <button
              onClick={this.handleNuke}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-red-400 text-sm hover:bg-red-500/10 transition-colors ml-auto"
            >
              Erase all local data
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            <strong className="text-slate-300">Reset and reload</strong> clears the active-tab and
            current-snapshot pointers (the most common cause of a stuck broken view) and refreshes
            the page. Your snapshot history, projects, clients, and settings are preserved.
          </p>

          <button
            onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
            className="text-xs text-slate-500 hover:text-slate-300 inline-flex items-center gap-1.5"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            />
            {showDetails ? 'Hide' : 'Show'} stack trace
          </button>
          {showDetails && errorInfo && (
            <pre className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[10.5px] text-slate-400 font-mono whitespace-pre-wrap max-h-72 overflow-auto">
              {error?.stack}
              {'\n\n'}
              {errorInfo.componentStack}
            </pre>
          )}
        </div>
      </div>
    )
  }
}

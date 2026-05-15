import { useEffect, useMemo, useState, useCallback } from 'react'
import { marked } from 'marked'
import { Download, X, ChevronDown, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CHANGELOG } from '@/data/changelog'
import type { ChangelogEntry } from '@/data/changelog'
import type { UpdateInfo } from '@/utils/updateChecker'
import { isNewer } from '@/utils/semver'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const month = d.toLocaleString('en-US', { month: 'short' })
  const day = d.getDate()
  const year = d.getFullYear()
  return `${month} ${day}, ${year}`
}

interface UpdateModalProps {
  open: boolean
  onClose: () => void
  info: UpdateInfo | null
  defaultTab?: 'update' | 'changelog'
}

function renderMarkdown(md: string): string {
  let html = marked.parse(md, { async: false }) as string
  html = html
    .replace(/<ul>/g, '<ul style="list-style-type:disc;padding-left:1.25rem">')
    .replace(/<ol>/g, '<ol style="list-style-type:decimal;padding-left:1.25rem">')
    .replace(/<li>/g, '<li style="margin:0.25rem 0">')
  return html
}

const TYPE_COLORS: Record<ChangelogEntry['type'], { bar: string; text: string; bg: string; label: string }> = {
  major: { bar: 'border-l-lw-orange-400', text: 'text-lw-orange-400', bg: 'bg-lw-orange-400/[0.04]', label: 'Major' },
  feature: { bar: 'border-l-blue-400', text: 'text-blue-400', bg: 'bg-blue-400/[0.04]', label: 'Feature' },
  fix: { bar: 'border-l-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/[0.04]', label: 'Fix' },
}

const INITIAL_VISIBLE = 8

type DownloadState = 'idle' | 'downloading' | 'done' | 'error'

export function UpdateModal({ open, onClose, info, defaultTab }: UpdateModalProps) {
  const [downloadState, setDownloadState] = useState<DownloadState>('idle')
  const [downloadError, setDownloadError] = useState('')
  const [activeTab, setActiveTab] = useState<'update' | 'changelog'>(
    defaultTab ?? (info ? 'update' : 'changelog'),
  )
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    () => new Set(CHANGELOG.length > 0 ? [CHANGELOG[0].version] : []),
  )
  const [showAll, setShowAll] = useState(false)

  // Reset activeTab when info or defaultTab changes
  useEffect(() => {
    setActiveTab(defaultTab ?? (info ? 'update' : 'changelog'))
  }, [info, defaultTab])

  const renderedNotes = useMemo(() => {
    if (!info?.releaseNotes) return ''
    return renderMarkdown(info.releaseNotes)
  }, [info?.releaseNotes])

  // If an update is available and the new version isn't in the local changelog yet,
  // synthesize an entry from the GitHub release notes so users see it immediately.
  const changelogWithUpdate = useMemo(() => {
    if (!info?.version || !info.releaseNotes) return CHANGELOG
    const alreadyIncluded = CHANGELOG.some((e) => e.version === info.version)
    if (alreadyIncluded) return CHANGELOG
    const synthetic: ChangelogEntry = {
      version: info.version,
      date: new Date().toISOString(),
      type: 'fix',
      notes: info.releaseNotes,
    }
    return [synthetic, ...CHANGELOG]
  }, [info?.version, info?.releaseNotes])

  // Auto-expand the latest changelog entry (including synthetic ones from updates)
  useEffect(() => {
    if (changelogWithUpdate.length > 0) {
      setExpandedVersions((prev) => {
        const next = new Set(prev)
        next.add(changelogWithUpdate[0].version)
        return next
      })
    }
  }, [changelogWithUpdate])

  const hasNewerVersions =
    changelogWithUpdate.length > 0 && isNewer(changelogWithUpdate[0].version, __APP_VERSION__)

  const visibleEntries = showAll ? changelogWithUpdate : changelogWithUpdate.slice(0, INITIAL_VISIBLE)

  function toggleExpanded(version: string): void {
    setExpandedVersions((prev) => {
      const next = new Set(prev)
      if (next.has(version)) {
        next.delete(version)
      } else {
        next.add(version)
      }
      return next
    })
  }

  const handleDownload = useCallback(async (): Promise<void> => {
    if (!info?.assetApiUrl) return
    setDownloadState('downloading')
    setDownloadError('')
    try {
      // Fetch the release asset via GitHub API — the octet-stream Accept header
      // triggers a redirect to the CDN which serves the binary with CORS headers.
      const res = await fetch(info.assetApiUrl, {
        headers: { Accept: 'application/octet-stream' },
      })
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = info.assetName || 'Reconciler.html'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Small delay before revoking so the browser can start the download
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setDownloadState('done')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed'
      setDownloadError(msg)
      setDownloadState('error')
    }
  }, [info?.assetApiUrl, info?.assetName])

  const modalTitle = info ? 'Update Available' : 'Changelog'

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} width="xl">
      <div className="space-y-4 px-5 py-4">
        {/* Tabs — only show if info is available (both tabs make sense) */}
        {info && (
          <div className="flex gap-1 border-b border-slate-800 -mx-5 px-5">
            <button
              type="button"
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'update'
                  ? 'text-lw-orange-500 border-b-2 border-lw-orange-500'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setActiveTab('update')}
            >
              Update
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'changelog'
                  ? 'text-lw-orange-500 border-b-2 border-lw-orange-500'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setActiveTab('changelog')}
            >
              Changelog
            </button>
          </div>
        )}

        {/* Update Tab */}
        {activeTab === 'update' && info && (
          downloadState === 'done' ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 size={48} className="text-emerald-400" />
              <div className="text-center space-y-1.5">
                <p className="text-lg font-semibold text-slate-100">Download complete!</p>
                <p className="text-sm text-slate-400">
                  v{info.version} has been saved to your downloads folder.
                </p>
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-slate-500 text-center max-w-sm">
                Replace your current Reconciler.html with the downloaded file, then refresh to start using the new version.
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
                  v{__APP_VERSION__}
                </span>
                <span className="text-slate-600">&rarr;</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-lw-orange-500/20 text-lw-orange-500">
                  v{info.version}
                </span>
              </div>

              {renderedNotes && (
                <div
                  className="release-notes max-h-60 overflow-y-auto overscroll-contain rounded-lg bg-slate-900 border border-slate-800 p-4 text-sm text-slate-400"
                  dangerouslySetInnerHTML={{ __html: renderedNotes }}
                />
              )}

              <div className="rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-slate-500 space-y-1.5">
                <p className="text-slate-300 font-medium">After downloading:</p>
                <p>Replace your current Reconciler.html with the new file to keep future updates working.</p>
              </div>

              {downloadState === 'error' && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{downloadError || 'Download failed. Please try again.'}</span>
                </div>
              )}

              <div className="flex items-center gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={onClose} icon={<X size={14} />}>
                  Skip this version
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleDownload()}
                  disabled={downloadState === 'downloading'}
                  icon={downloadState === 'downloading'
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Download size={14} />
                  }
                >
                  {downloadState === 'downloading' ? 'Downloading…' : downloadState === 'error' ? 'Retry Download' : `Download v${info.version}`}
                </Button>
              </div>
            </>
          )
        )}

        {/* Changelog Tab */}
        {activeTab === 'changelog' && (
          <div className="space-y-3">
            {hasNewerVersions && (
              <p className="text-xs text-slate-500">
                You&apos;re on{' '}
                <span className="text-slate-300 font-medium">v{__APP_VERSION__}</span>{' '}
                — here&apos;s what&apos;s new since then:
              </p>
            )}

            <div className={showAll ? 'max-h-[60vh] overflow-y-auto' : 'max-h-[400px] overflow-y-auto'}>
              <div className="space-y-2">
                {visibleEntries.map((entry, index) => {
                  const isExpanded = expandedVersions.has(entry.version)
                  const isLatest = index === 0
                  const colors = TYPE_COLORS[entry.type]

                  return (
                    <div
                      key={entry.version}
                      className={`rounded-r-lg border-l-[3px] ${colors.bar} ${isExpanded ? colors.bg : 'hover:bg-slate-900/50'} transition-colors`}
                    >
                      {/* Accordion header */}
                      <button
                        type="button"
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors group"
                        onClick={() => toggleExpanded(entry.version)}
                      >
                        <ChevronDown
                          size={14}
                          className={`text-slate-600 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                        />
                        <span className={`text-sm font-semibold ${isLatest ? colors.text : 'text-slate-300'}`}>
                          v{entry.version}
                        </span>
                        {/* Hover-reveal type label */}
                        <span
                          className={`text-[10px] font-medium ${colors.text} opacity-0 group-hover:opacity-100 transition-opacity duration-150`}
                        >
                          {colors.label}
                        </span>
                        {isLatest && (
                          <span
                            className={`text-[9px] font-semibold uppercase tracking-wider ${colors.text} opacity-60`}
                          >
                            latest
                          </span>
                        )}
                        <span className="ml-auto text-[11px] text-slate-600 shrink-0">
                          {formatDate(entry.date)}
                        </span>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pl-9">
                          <div
                            className="text-sm text-slate-400 [&_h3]:text-slate-300 [&_h3]:font-medium [&_h3]:text-sm [&_h3]:mt-2 [&_h3]:mb-1 [&_h4]:text-slate-400 [&_h4]:font-medium [&_h4]:text-xs [&_h4]:mt-2 [&_h4]:mb-1 [&_strong]:text-slate-300"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.notes) }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* See all releases link */}
            {!showAll && changelogWithUpdate.length > INITIAL_VISIBLE && (
              <button
                type="button"
                className="text-xs text-lw-orange-500 hover:text-lw-orange-400 transition-colors"
                onClick={() => setShowAll(true)}
              >
                See all {changelogWithUpdate.length} releases
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

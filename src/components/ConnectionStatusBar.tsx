import { useEffect, useRef, useState } from 'react'
import { Shield, ShieldOff, Wifi, WifiOff, X } from 'lucide-react'
import { useNetworkStore, type ConnectionEntry } from '@/store/networkStore'

const PRUNE_INTERVAL_MS = 30_000

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function statusBadge(status: ConnectionEntry['status']): {
  label: string
  className: string
} {
  switch (status) {
    case 'pending':
      return { label: 'Pending', className: 'text-amber-400' }
    case 'ok':
      return { label: 'OK', className: 'text-emerald-400' }
    case 'error':
      return { label: 'Error', className: 'text-red-400' }
    case 'blocked':
      return { label: 'Blocked', className: 'text-red-400' }
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function truncateUrl(url: string, maxLen: number): string {
  if (url.length <= maxLen) return url
  return url.slice(0, maxLen - 1) + '…'
}

export function ConnectionStatusBar(): React.ReactElement {
  const isAirGapEnabled = useNetworkStore((s) => s.isAirGapEnabled)
  const connections = useNetworkStore((s) => s.connections)
  const setAirGapEnabled = useNetworkStore((s) => s.setAirGapEnabled)
  const pruneExpired = useNetworkStore((s) => s.pruneExpired)

  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Periodically prune expired entries
  useEffect(() => {
    const id = setInterval(pruneExpired, PRUNE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [pruneExpired])

  // Close popover on outside click
  useEffect(() => {
    if (!isPopoverOpen) return
    function handleClick(e: MouseEvent): void {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isPopoverOpen])

  const externalConnections = connections.filter((c) => c.isExternal)
  const activeCount = externalConnections.filter(
    (c) => c.status === 'pending' || c.status === 'ok',
  ).length
  const hasConnections = externalConnections.length > 0

  const dotColor = isAirGapEnabled
    ? 'bg-emerald-400'
    : hasConnections
      ? 'bg-amber-400'
      : 'bg-emerald-400'

  const label = isAirGapEnabled
    ? 'Air-gap active'
    : activeCount > 0
      ? `${activeCount} outbound`
      : 'No connections'

  return (
    <div
      className="relative flex items-center justify-between h-7 px-3 text-xs border-t shrink-0"
      style={{
        backgroundColor: 'var(--surface-elevated)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-muted)',
      }}
    >
      {/* Left: status indicator */}
      <div className="flex items-center gap-2">
        <button
          ref={triggerRef}
          onClick={() => setIsPopoverOpen((v) => !v)}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${dotColor} ${
              activeCount > 0 && !isAirGapEnabled ? 'animate-pulse' : ''
            }`}
          />
          {isAirGapEnabled ? (
            <WifiOff className="w-3 h-3" />
          ) : hasConnections ? (
            <Wifi className="w-3 h-3" />
          ) : null}
          <span>{label}</span>
        </button>
      </div>

      {/* Right: air-gap toggle */}
      <button
        onClick={() => setAirGapEnabled(!isAirGapEnabled)}
        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
        title={
          isAirGapEnabled
            ? 'Disable Air-gap Mode (allow external connections)'
            : 'Enable Air-gap Mode (block all external connections)'
        }
      >
        {isAirGapEnabled ? (
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <ShieldOff className="w-3.5 h-3.5" />
        )}
        <span className={isAirGapEnabled ? 'text-emerald-400 font-medium' : ''}>
          Air-gap Mode
        </span>
        <div
          className={`relative w-7 h-4 rounded-full transition-colors ${
            isAirGapEnabled ? 'bg-emerald-500' : 'bg-[var(--surface-interactive)]'
          }`}
        >
          <div
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
              isAirGapEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
            }`}
          />
        </div>
      </button>

      {/* Popover */}
      {isPopoverOpen && (
        <div
          ref={popoverRef}
          className="absolute bottom-8 left-2 w-96 max-h-64 rounded-lg border overflow-hidden"
          style={{
            backgroundColor: 'var(--surface-overlay)',
            borderColor: 'var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b text-xs font-medium"
            style={{
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <span>Connection Log</span>
            <button
              onClick={() => setIsPopoverOpen(false)}
              className="hover:opacity-70 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto max-h-48 p-2">
            {externalConnections.length === 0 ? (
              <div
                className="text-center py-4 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                No outbound connections detected
              </div>
            ) : (
              <div className="space-y-1">
                {[...externalConnections].reverse().map((conn) => {
                  const badge = statusBadge(conn.status)
                  return (
                    <div
                      key={conn.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                      style={{ backgroundColor: 'var(--surface-interactive)' }}
                    >
                      <span
                        className="shrink-0 font-mono text-[10px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {formatTimestamp(conn.timestamp)}
                      </span>
                      <span
                        className="shrink-0 font-mono uppercase text-[10px] font-medium"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {conn.method}
                      </span>
                      <span
                        className="flex-1 truncate font-mono text-[10px]"
                        style={{ color: 'var(--text-secondary)' }}
                        title={conn.url}
                      >
                        {truncateUrl(conn.url, 60)}
                      </span>
                      <span
                        className={`shrink-0 font-medium text-[10px] ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useCallback, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
}

const widths = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
}

export function Modal({ open, onClose, title, children, width = 'md' }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${widths[width]} rounded-2xl border shadow-2xl animate-scale-in overflow-hidden`}
        style={{ backgroundColor: 'var(--surface-overlay)', borderColor: 'var(--border-default)' }}
      >
        {/* top brand sheen */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lw-orange-500/50 to-transparent"
        />
        {title && (
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <h2 className="font-display text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lw-orange-500/60"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

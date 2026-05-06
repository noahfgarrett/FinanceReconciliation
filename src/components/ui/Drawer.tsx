import { useEffect, useCallback, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: 'md' | 'lg' | 'xl' | '2xl'
  footer?: ReactNode
}

const widths = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

export function Drawer({ open, onClose, title, children, width = 'lg', footer }: DrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() },
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
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={onClose} />
      <div
        className={`absolute right-0 top-0 bottom-0 w-full ${widths[width]} bg-[#0a0f1c] border-l border-slate-800 flex flex-col animate-slide-in shadow-2xl`}
      >
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-lw-orange-500/40 to-transparent"
        />
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          {title && <h2 className="font-display text-base font-semibold text-slate-100 tracking-tight">{title}</h2>}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-100 hover:bg-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lw-orange-500/60"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="border-t border-slate-800 px-5 py-3 shrink-0 bg-slate-950/40">{footer}</div>
        )}
      </div>
    </div>
  )
}

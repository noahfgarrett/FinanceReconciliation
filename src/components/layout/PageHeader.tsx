import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  actions?: ReactNode
  /**
   * Optional decorative slot — rendered behind the title with low opacity.
   * Use for hero glows / mesh gradients on signature pages.
   */
  decoration?: ReactNode
}

export function PageHeader({ title, subtitle, actions, decoration }: Props) {
  return (
    <div className="relative px-8 py-7 flex items-start justify-between border-b border-slate-800/60 overflow-hidden">
      {decoration && (
        <div className="pointer-events-none absolute inset-0 -z-0">{decoration}</div>
      )}
      <div className="relative z-10">
        <h1 className="font-display text-3xl font-semibold text-slate-100 tracking-tight leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {actions && <div className="relative z-10 flex gap-2">{actions}</div>}
    </div>
  )
}

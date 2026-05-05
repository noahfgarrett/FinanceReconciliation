import type { ReactNode } from 'react'

type Tone = 'gray' | 'orange' | 'blue' | 'green' | 'amber' | 'red'

const TONES: Record<Tone, string> = {
  gray: 'bg-slate-800 text-slate-300 border-slate-700',
  orange: 'bg-lw-orange-500/15 text-lw-orange-400 border-lw-orange-500/30',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

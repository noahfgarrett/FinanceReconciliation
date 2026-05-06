import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-lw-orange-500 to-lw-orange-600 hover:from-lw-orange-400 hover:to-lw-orange-500 text-white shadow-glow-orange ring-1 ring-inset ring-white/10 active:translate-y-[0.5px]',
  secondary:
    'bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 hover:border-slate-600 active:translate-y-[0.5px]',
  ghost:
    'bg-transparent hover:bg-slate-900/70 text-slate-300 hover:text-slate-100 active:translate-y-[0.5px]',
  danger:
    'bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-[0_4px_14px_rgba(239,68,68,0.4)] active:translate-y-[0.5px]',
}

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-[13px] gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, children, className = '', ...rest }, ref) => (
    <button
      ref={ref}
      className={`relative inline-flex items-center justify-center rounded-lg font-medium tracking-tight transition-all duration-150 ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lw-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06080F] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

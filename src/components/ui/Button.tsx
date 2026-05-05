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
    'bg-lw-orange-500 hover:bg-lw-orange-600 text-white shadow-[0_4px_14px_rgba(249,115,22,0.3)]',
  secondary: 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800',
  ghost: 'bg-transparent hover:bg-slate-900 text-slate-300',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
}

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, children, className = '', ...rest }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

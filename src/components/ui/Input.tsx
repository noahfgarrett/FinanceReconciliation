import { type InputHTMLAttributes, type ReactNode, useId } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label?: string
  hint?: string
  error?: string
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

export function Input({
  label,
  hint,
  error,
  leadingIcon,
  trailingIcon,
  className = '',
  ...rest
}: InputProps): React.JSX.Element {
  const id = useId()
  const borderColor = error ? 'border-red-500 focus:ring-red-500/40' : 'border-slate-700 focus:ring-lw-orange-500/40'

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-slate-400">
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
            {leadingIcon}
          </span>
        )}
        <input
          id={id}
          className={`w-full rounded-lg bg-slate-900 border ${borderColor} text-sm text-slate-100 placeholder:text-slate-600 px-3 py-2 focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${leadingIcon ? 'pl-8' : ''} ${trailingIcon ? 'pr-8' : ''} ${className}`}
          {...rest}
        />
        {trailingIcon && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">
            {trailingIcon}
          </span>
        )}
      </div>
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

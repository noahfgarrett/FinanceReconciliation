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
  const ringColor = error ? 'focus:ring-red-500/40' : 'focus:ring-lw-orange-500/40'

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            {leadingIcon}
          </span>
        )}
        <input
          id={id}
          className={`w-full rounded-lg border text-sm px-3 py-2 focus:outline-none focus:ring-2 ${ringColor} transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${leadingIcon ? 'pl-8' : ''} ${trailingIcon ? 'pr-8' : ''} ${className}`}
          style={{
            backgroundColor: 'var(--surface-elevated)',
            borderColor: error ? undefined : 'var(--border-emphasis)',
            color: 'var(--text-primary)',
          }}
          {...rest}
        />
        {trailingIcon && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            {trailingIcon}
          </span>
        )}
      </div>
      {hint && !error && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

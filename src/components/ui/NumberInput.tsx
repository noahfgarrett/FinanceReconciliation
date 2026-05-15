import { type InputHTMLAttributes, useId } from 'react'

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'inputMode'> {
  label?: string
  hint?: string
  error?: string
  suffix?: string
  min?: number
  max?: number
}

export function NumberInput({
  label,
  hint,
  error,
  suffix,
  min,
  max,
  className = '',
  ...rest
}: NumberInputProps): React.JSX.Element {
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
        <input
          id={id}
          type="text"
          inputMode="decimal"
          min={min}
          max={max}
          className={`w-full rounded-lg border text-sm px-3 py-2 focus:outline-none focus:ring-2 ${ringColor} transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${suffix ? 'pr-10' : ''} ${className}`}
          style={{
            backgroundColor: 'var(--surface-elevated)',
            borderColor: error ? undefined : 'var(--border-emphasis)',
            color: 'var(--text-primary)',
          }}
          {...rest}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-muted)' }}>
            {suffix}
          </span>
        )}
      </div>
      {hint && !error && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

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
  const borderColor = error ? 'border-red-500 focus:ring-red-500/40' : 'border-slate-700 focus:ring-lw-orange-500/40'

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-slate-400">
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
          className={`w-full rounded-lg bg-slate-900 border ${borderColor} text-sm text-slate-100 placeholder:text-slate-600 px-3 py-2 focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${suffix ? 'pr-10' : ''} ${className}`}
          {...rest}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

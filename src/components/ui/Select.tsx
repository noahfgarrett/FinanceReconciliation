import { type SelectHTMLAttributes, useId } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label?: string
  hint?: string
  error?: string
  options: SelectOption[]
}

export function Select({
  label,
  hint,
  error,
  options,
  className = '',
  ...rest
}: SelectProps): React.JSX.Element {
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
        <select
          id={id}
          className={`w-full appearance-none rounded-lg bg-slate-900 border ${borderColor} text-sm text-slate-100 px-3 py-2 pr-8 focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          {...rest}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
      </div>
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

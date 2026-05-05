interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  hint?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  size = 'md',
  disabled = false,
}: ToggleProps): React.JSX.Element {
  const trackSize = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5'
  const knobSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const knobTranslate = checked
    ? size === 'sm' ? 'translate-x-4' : 'translate-x-5'
    : 'translate-x-0.5'

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex items-center shrink-0 mt-0.5 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-lw-orange-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${trackSize} ${
          checked
            ? 'bg-lw-orange-500 border-lw-orange-500'
            : 'bg-slate-700 border-slate-700'
        }`}
      >
        <span
          className={`inline-block rounded-full bg-white shadow transition-transform ${knobSize} ${knobTranslate}`}
        />
      </button>
      {(label ?? hint) && (
        <div className="flex flex-col">
          {label && <span className="text-sm text-slate-200">{label}</span>}
          {hint && <span className="text-xs text-slate-500">{hint}</span>}
        </div>
      )}
    </div>
  )
}

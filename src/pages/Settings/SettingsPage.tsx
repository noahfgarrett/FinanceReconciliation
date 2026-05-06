import { useEffect, useState } from 'react'
import {
  Palette,
  Hash,
  Keyboard,
  Info,
  AlertTriangle,
  Sun,
  Moon,
  Monitor,
  Github,
  ScrollText,
  MessageSquarePlus,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { useUiStore } from '@/store/uiStore'
import { kvGet, kvSet, clearAll } from '@/persistence/idb'
import type { Theme } from '@/types'

// ─── Persistence keys ───────────────────────────────────────────────────────
const DENSITY_KEY = 'ui:density'
const CURRENCY_KEY = 'format:currency'
const DECIMAL_KEY = 'format:decimal'

type Density = 'compact' | 'normal' | 'comfortable'
type Currency = 'USD' | 'EUR' | 'GBP'
type DecimalStyle = 'us' | 'eu'

// ─── Shortcut data ───────────────────────────────────────────────────────────
interface Shortcut {
  keys: string
  description: string
  context?: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: '⌘S / Ctrl+S', description: 'Save snapshot', context: 'Billing Hours' },
  { keys: '⌘E / Ctrl+E', description: 'Open Exports' },
  { keys: '⌘K / Ctrl+K', description: 'Command palette' },
  { keys: '/', description: 'Focus search', context: 'Spreadsheet' },
  { keys: 'F', description: 'Toggle Flagged-only filter', context: 'Spreadsheet' },
  { keys: '?', description: 'Show keyboard shortcuts' },
]

// ─── Section card wrapper ────────────────────────────────────────────────────
function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  children: React.ReactNode
  tone?: 'default' | 'danger'
}): React.JSX.Element {
  const isDanger = tone === 'danger'
  return (
    <div
      className={`relative rounded-2xl bg-[#0a0f1c] border overflow-hidden shadow-md card-sheen animate-slide-up ${
        isDanger ? 'border-red-500/30' : 'border-slate-800'
      }`}
    >
      <div
        className={`flex items-start gap-3 px-5 py-4 border-b ${
          isDanger ? 'border-red-500/20 bg-red-500/[0.03]' : 'border-slate-800'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
            isDanger
              ? 'bg-red-500/10 border-red-500/25 text-red-300'
              : 'bg-lw-orange-500/10 border-lw-orange-500/20 text-lw-orange-300'
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-[15px] font-semibold text-slate-100 tracking-tight leading-tight">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

// ─── Theme picker ─────────────────────────────────────────────────────────────
interface ThemeOption {
  value: Theme
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
]

function ThemePicker({ current, onChange }: { current: Theme; onChange: (t: Theme) => void }): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-3">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = current === value
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={`group relative flex flex-col items-stretch gap-2 p-2 rounded-xl border transition-all duration-200 ease-out-expo overflow-hidden ${
              isActive
                ? 'border-lw-orange-500/60 ring-2 ring-lw-orange-500/30 shadow-glow-orange'
                : 'border-slate-700 hover:border-slate-500 hover:scale-[1.02]'
            }`}
          >
            {/* mini visual preview */}
            <div
              className={`relative h-16 w-full rounded-lg overflow-hidden border ${
                value === 'dark'
                  ? 'bg-gradient-to-br from-[#0B0F1B] to-[#06080F] border-slate-700'
                  : value === 'light'
                  ? 'bg-gradient-to-br from-white to-[#FAF9F7] border-slate-300'
                  : 'border-slate-700'
              } ${value === 'system' ? 'bg-gradient-to-br from-[#0B0F1B] to-white' : ''}`}
            >
              {/* fake header line */}
              <div
                className={`absolute top-1.5 left-1.5 right-1.5 h-1 rounded-full ${
                  value === 'dark'
                    ? 'bg-slate-700'
                    : value === 'light'
                    ? 'bg-slate-300'
                    : 'bg-gradient-to-r from-slate-700 to-slate-300'
                }`}
              />
              {/* fake card */}
              <div
                className={`absolute bottom-1.5 left-1.5 right-1.5 h-5 rounded ${
                  value === 'dark'
                    ? 'bg-slate-800'
                    : value === 'light'
                    ? 'bg-slate-100'
                    : 'bg-gradient-to-r from-slate-800 to-slate-100'
                }`}
              />
              {/* orange accent dot */}
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-lw-orange-500 shadow-[0_0_6px_rgba(244,123,32,0.6)]" />
            </div>

            <div className="flex items-center justify-center gap-1.5 py-1">
              <Icon
                className={`w-3.5 h-3.5 transition-colors ${
                  isActive ? 'text-lw-orange-300' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span
                className={`text-xs font-medium tracking-tight ${
                  isActive ? 'text-lw-orange-200' : 'text-slate-300'
                }`}
              >
                {label}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Density picker ──────────────────────────────────────────────────────────
interface DensityOption {
  value: Density
  label: string
}

const DENSITY_OPTIONS: DensityOption[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'comfortable', label: 'Comfortable' },
]

function DensityPicker({ current, onChange }: { current: Density; onChange: (d: Density) => void }): React.JSX.Element {
  return (
    <div className="inline-flex p-1 rounded-lg bg-slate-900/60 border border-slate-800">
      {DENSITY_OPTIONS.map(({ value, label }) => {
        const isActive = current === value
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium tracking-tight transition-all duration-150 ${
              isActive
                ? 'bg-lw-orange-500/15 text-lw-orange-200 shadow-[inset_0_0_0_1px_rgba(244,123,32,0.25)]'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function SettingsPage(): React.JSX.Element {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const setShowChangelog = useUiStore((s) => s.setShowChangelog)
  const openFeedback = useUiStore((s) => s.openFeedback)

  const [density, setDensityState] = useState<Density>('normal')
  const [currency, setCurrencyState] = useState<Currency>('USD')
  const [decimalStyle, setDecimalStyleState] = useState<DecimalStyle>('us')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Load persisted prefs on mount
  useEffect(() => {
    void (async () => {
      const d = await kvGet<Density>(DENSITY_KEY)
      if (d === 'compact' || d === 'normal' || d === 'comfortable') setDensityState(d)
      const c = await kvGet<Currency>(CURRENCY_KEY)
      if (c === 'USD' || c === 'EUR' || c === 'GBP') setCurrencyState(c)
      const ds = await kvGet<DecimalStyle>(DECIMAL_KEY)
      if (ds === 'us' || ds === 'eu') setDecimalStyleState(ds)
    })()
  }, [])

  function handleDensity(d: Density): void {
    setDensityState(d)
    void kvSet(DENSITY_KEY, d)
  }

  function handleCurrency(c: Currency): void {
    setCurrencyState(c)
    void kvSet(CURRENCY_KEY, c)
  }

  function handleDecimalStyle(ds: DecimalStyle): void {
    setDecimalStyleState(ds)
    void kvSet(DECIMAL_KEY, ds)
  }

  async function handleClearAll(): Promise<void> {
    setClearing(true)
    await clearAll()
    window.location.reload()
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Appearance, number format, and app preferences" />

      <div className="max-w-2xl mx-auto px-8 py-8 space-y-5 stagger">

        {/* ── Appearance ──────────────────────────────────────────── */}
        <SectionCard icon={Palette} title="Appearance" description="Theme and density preferences for this device.">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400 mb-2">Theme</div>
            <ThemePicker current={theme} onChange={setTheme} />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400 mb-2">Density</div>
            <DensityPicker current={density} onChange={handleDensity} />
            <p className="text-xs text-slate-500 mt-1">
              Density affects the spreadsheet row height. Full support ships in a future phase.
            </p>
          </div>
        </SectionCard>

        {/* ── Number format ────────────────────────────────────────── */}
        <SectionCard icon={Hash} title="Number Format" description="Currency and decimal style applied to amounts.">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Currency"
              value={currency}
              onChange={(e) => handleCurrency(e.target.value as Currency)}
              options={[
                { value: 'USD', label: 'USD — US Dollar ($)' },
                { value: 'EUR', label: 'EUR — Euro (€)' },
                { value: 'GBP', label: 'GBP — British Pound (£)' },
              ]}
            />
            <Select
              label="Decimal style"
              value={decimalStyle}
              onChange={(e) => handleDecimalStyle(e.target.value as DecimalStyle)}
              options={[
                { value: 'us', label: '1,234.56 (US)' },
                { value: 'eu', label: '1.234,56 (EU)' },
              ]}
            />
          </div>
          <p className="text-xs text-slate-500">
            Currency and decimal style will apply to hours and billing totals in a future version.
          </p>
        </SectionCard>

        {/* ── Keyboard shortcuts ───────────────────────────────────── */}
        <SectionCard icon={Keyboard} title="Keyboard Shortcuts" description="Press ? anywhere in the app to open this help.">
          <div className="space-y-0.5">
            {SHORTCUTS.map((s) => (
              <div
                key={s.keys}
                className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-200">{s.description}</span>
                  {s.context && (
                    <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 bg-slate-800/70 px-1.5 py-0.5 rounded border border-slate-700/60">
                      {s.context}
                    </span>
                  )}
                </div>
                <span className="kbd whitespace-nowrap">{s.keys}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── About ────────────────────────────────────────────────── */}
        <SectionCard icon={Info} title="About" description="Version info and helpful links.">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-200">LotusWorks Reconciler</div>
              <div className="text-xs text-slate-500 mt-0.5">v{__APP_VERSION__}</div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<ScrollText className="w-4 h-4" />}
                onClick={() => setShowChangelog(true)}
              >
                View Changelog
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<MessageSquarePlus className="w-4 h-4" />}
                onClick={() => openFeedback('enhancement')}
              >
                Submit Feedback
              </Button>
            </div>
          </div>
          <a
            href="https://github.com/noahfgarrett/FinanceReconciliation"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            github.com/noahfgarrett/FinanceReconciliation
          </a>
        </SectionCard>

        {/* ── Danger zone ───────────────────────────────────────────── */}
        <SectionCard
          icon={AlertTriangle}
          title="Danger Zone"
          description="Destructive actions. These cannot be undone."
          tone="danger"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100">Clear all local data</div>
              <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                Erases all snapshots, project configs, clients, and settings on this device.
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => setShowClearConfirm(true)}
              className="shrink-0"
            >
              Clear Data
            </Button>
          </div>
        </SectionCard>
      </div>

      {/* ── Clear confirm modal ───────────────────────────────────── */}
      <Modal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear all local data?"
        width="sm"
      >
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-slate-400">
            This will erase <strong className="text-slate-200">all snapshots, configs, clients, and settings</strong> on
            this device. This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowClearConfirm(false)}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={clearing}
              onClick={() => void handleClearAll()}
            >
              {clearing ? 'Clearing…' : 'Yes, clear everything'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

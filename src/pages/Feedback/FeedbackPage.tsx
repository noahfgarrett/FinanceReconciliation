import { useEffect, useState } from 'react'
import { Bug, Lightbulb, Mail, Info, RotateCcw, ClipboardCopy, Check } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useUiStore } from '@/store/uiStore'
import type { FeedbackType } from '@/types'

type Priority = 'low' | 'medium' | 'high'

const RECIPIENT = 'ngarrett@lotusworks.com'

const AREAS = [
  'Billing Hours',
  'Reconcile',
  'Projects',
  'Exports',
  'Snapshots / History',
  'Settings',
  'Import / parsing',
  'Calculations / OT logic',
  'Visual / theme',
  'Other',
] as const

function buildSubject(type: FeedbackType, area: string, subject: string): string {
  const prefix = type === 'bug' ? 'Bug' : 'Idea'
  return `[Reconciler ${prefix}] ${area} — ${subject}`
}

function buildBody(
  type: FeedbackType,
  area: string,
  priority: Priority,
  description: string,
  reporterName: string,
): string {
  const typeLabel = type === 'bug' ? 'Bug Report' : 'Enhancement Idea'
  const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1)
  const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown'
  return [
    `TYPE: ${typeLabel}`,
    `AREA: ${area}`,
    `PRIORITY: ${priorityLabel}`,
    reporterName ? `SUBMITTED BY: ${reporterName}` : 'SUBMITTED BY: (anonymous)',
    `APP VERSION: v${version}`,
    `URL: ${typeof window !== 'undefined' ? window.location.href : ''}`,
    '',
    '---',
    '',
    'DESCRIPTION:',
    '',
    description,
    '',
    '---',
    '',
    `Sent from LotusWorks Reconciler v${version}`,
  ].join('\n')
}

export default function FeedbackPage() {
  const consume = useUiStore((s) => s.consumeFeedbackPreselect)

  const [type, setType] = useState<FeedbackType | null>(null)
  const [area, setArea] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [description, setDescription] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  // One-shot: pull preselected type from the side-nav buttons (Bug / Idea)
  useEffect(() => {
    const pre = consume()
    if (pre) setType(pre)
  }, [consume])

  function validate(): boolean {
    const next: Record<string, boolean> = {}
    if (!type) next.type = true
    if (!area) next.area = true
    if (!subject.trim()) next.subject = true
    if (!description.trim()) next.description = true
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function buildPayload(): { subject: string; body: string } | null {
    if (!type) return null
    return {
      subject: buildSubject(type, area, subject.trim()),
      body: buildBody(type, area, priority, description.trim(), reporterName.trim()),
    }
  }

  async function copyToClipboard(): Promise<void> {
    if (!validate()) return
    const payload = buildPayload()
    if (!payload) return
    const text = `TO: ${RECIPIENT}\nSUBJECT: ${payload.subject}\n\n${payload.body}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setStatusMsg(`Copied — paste it into an email to ${RECIPIENT}.`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setStatusMsg('Clipboard unavailable. Please copy manually from the textarea below.')
    }
  }

  function openInEmail(): void {
    if (!validate()) return
    const payload = buildPayload()
    if (!payload) return
    const url = `mailto:${RECIPIENT}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.body)}`
    window.location.href = url
    setStatusMsg(
      'Email client opening… If nothing happens, use Copy to clipboard and email manually.',
    )
  }

  function clearForm(): void {
    setType(null)
    setArea('')
    setSubject('')
    setPriority('medium')
    setDescription('')
    setErrors({})
    setStatusMsg(null)
    setCopied(false)
  }

  const descPlaceholder =
    type === 'bug'
      ? 'What were you doing when the bug happened? Include any error messages and what you expected to see instead.'
      : type === 'enhancement'
        ? "What would you like to see, and how would it help your workflow?"
        : 'Describe the issue or idea…'

  return (
    <div>
      <PageHeader
        title="Feedback"
        subtitle={`Send a bug report or share an idea — goes to ${RECIPIENT}`}
      />

      <div className="max-w-xl mx-auto px-8 py-10 space-y-6 stagger animate-fade-in">
        {/* Type toggle */}
        <div>
          <label className="block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2.5">
            Type <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setType('bug')
                setErrors((e) => ({ ...e, type: false }))
              }}
              className={`group flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl border transition-all duration-200 ease-out-expo ${
                type === 'bug'
                  ? 'bg-red-500/10 border-red-500/40 text-red-300 shadow-[0_0_20px_-8px_rgba(239,68,68,0.4)]'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              } ${errors.type ? 'ring-2 ring-red-500/50' : ''}`}
            >
              <Bug className={`w-4 h-4 transition-transform duration-200 ${type === 'bug' ? '' : 'group-hover:-rotate-12'}`} />
              <span className="text-sm font-medium tracking-tight">Bug Report</span>
            </button>
            <button
              onClick={() => {
                setType('enhancement')
                setErrors((e) => ({ ...e, type: false }))
              }}
              className={`group flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl border transition-all duration-200 ease-out-expo ${
                type === 'enhancement'
                  ? 'bg-lw-blue-500/10 border-lw-blue-500/40 text-lw-blue-300 shadow-[0_0_20px_-8px_rgba(0,87,164,0.4)]'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              } ${errors.type ? 'ring-2 ring-red-500/50' : ''}`}
            >
              <Lightbulb className={`w-4 h-4 transition-transform duration-200 ${type === 'enhancement' ? '' : 'group-hover:scale-110'}`} />
              <span className="text-sm font-medium tracking-tight">Have an Idea</span>
            </button>
          </div>
        </div>

        {/* Area */}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">
            Area <span className="text-red-400">*</span>
          </label>
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value)
              setErrors((p) => ({ ...p, area: false }))
            }}
            className={`w-full px-3 py-2.5 rounded-lg bg-slate-900/40 border text-sm text-slate-200 appearance-none focus:outline-none focus:border-lw-orange-500/40 ${
              errors.area ? 'border-red-500/50' : 'border-slate-800'
            }`}
          >
            <option value="" disabled>
              Select an area…
            </option>
            {AREAS.map((a) => (
              <option key={a} value={a} className="bg-slate-900">
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">
            Subject <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value)
              setErrors((p) => ({ ...p, subject: false }))
            }}
            placeholder="Brief summary of the issue or idea…"
            className={`w-full px-3 py-2.5 rounded-lg bg-slate-900/40 border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-lw-orange-500/40 ${
              errors.subject ? 'border-red-500/50' : 'border-slate-800'
            }`}
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">
            Priority
          </label>
          <div className="inline-flex gap-1 p-1 rounded-lg bg-slate-900/60 border border-slate-800">
            {(['low', 'medium', 'high'] as const).map((p) => {
              const active: Record<Priority, string> = {
                low: 'bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)]',
                medium: 'bg-lw-orange-500/15 text-lw-orange-300 shadow-[inset_0_0_0_1px_rgba(244,123,32,0.35)]',
                high: 'bg-red-500/15 text-red-300 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.35)]',
              }
              const dotColor: Record<Priority, string> = {
                low: 'bg-emerald-400',
                medium: 'bg-lw-orange-400',
                high: 'bg-red-400',
              }
              return (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium tracking-tight transition-all ${
                    priority === p ? active[p] : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${priority === p ? dotColor[p] : 'bg-slate-600'}`} />
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setErrors((p) => ({ ...p, description: false }))
            }}
            placeholder={descPlaceholder}
            rows={6}
            className={`w-full px-3 py-2.5 rounded-lg bg-slate-900/40 border text-sm text-slate-100 placeholder-slate-600 resize-y focus:outline-none focus:border-lw-orange-500/40 ${
              errors.description ? 'border-red-500/50' : 'border-slate-800'
            }`}
          />
          {type === 'bug' && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Info className="w-3 h-3 text-red-400/60 shrink-0" />
              <p className="text-[11px] text-red-400/60">
                Include the steps that led to the bug — easier to track down the root cause.
              </p>
            </div>
          )}
        </div>

        {/* Reporter (optional) */}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">
            Your name <span className="text-slate-600">(optional, helps me follow up)</span>
          </label>
          <input
            type="text"
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-900/40 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-lw-orange-500/40"
          />
        </div>

        {/* Status banner */}
        {statusMsg && (
          <div className="flex items-center gap-2 px-3.5 py-3 rounded-lg bg-slate-900/40 border border-slate-800 text-xs text-slate-300">
            <Info className="w-3.5 h-3.5 text-lw-orange-400 shrink-0" />
            {statusMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 mt-4 -mx-1 px-1 pt-5">
          <button
            onClick={openInEmail}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-b from-lw-orange-500 to-lw-orange-600 hover:from-lw-orange-400 hover:to-lw-orange-500 text-white text-sm font-medium tracking-tight shadow-glow-orange ring-1 ring-inset ring-white/10 active:translate-y-[0.5px] transition-all duration-150"
          >
            <Mail className="w-4 h-4" />
            Open in Email
          </button>
          <button
            onClick={() => void copyToClipboard()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-100 text-sm transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <ClipboardCopy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy to clipboard'}
          </button>
          <div className="flex-1" />
          <button
            onClick={clearForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-900/60 text-xs transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Clear form
          </button>
        </div>
      </div>
    </div>
  )
}

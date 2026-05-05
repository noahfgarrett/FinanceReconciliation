import { useState } from 'react'
import { GitCompareArrows, UploadCloud, Eye, EyeOff, MessageSquarePlus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useUiStore } from '@/store/uiStore'

interface MockRow {
  item: string
  ourHours: number
  invoiceHours: number
}

const MOCK_ROWS: MockRow[] = [
  { item: 'Alpha Build — E001 · Week of Apr 7', ourHours: 44, invoiceHours: 40 },
  { item: 'Beta Deploy — E003 · Week of Apr 14', ourHours: 38, invoiceHours: 38 },
  { item: 'Gamma QA — E005 · Week of Apr 21', ourHours: 50, invoiceHours: 45 },
]

export default function ReconcilePage(): React.ReactElement {
  const [showPreview, setShowPreview] = useState(false)

  function handleFeedback(): void {
    useUiStore.getState().openFeedback('enhancement')
  }

  return (
    <div>
      <PageHeader
        title="Reconcile"
        subtitle="Compare your timesheet against client invoices"
        actions={<GitCompareArrows className="w-5 h-5 text-slate-600" />}
      />

      <div className="mx-8 mt-6 space-y-6">
        {/* Drop zone */}
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-slate-700 bg-[#0a0f1c] px-8 py-16 text-center opacity-60 select-none cursor-not-allowed">
          <UploadCloud className="w-10 h-10 text-slate-500" />
          <div>
            <div className="text-base font-semibold text-slate-300 mb-1">
              Drop a client invoice spreadsheet here
            </div>
            <div className="text-sm text-slate-500 max-w-md">
              We&apos;ll compare it line-by-line against the current snapshot&apos;s billing rows.
              Feature coming once we have invoice samples to design against.
            </div>
          </div>
        </div>

        {/* Preview toggle */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-2 self-start px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-300 hover:text-slate-100 hover:border-slate-600 transition-colors"
          >
            {showPreview ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {showPreview ? 'Hide preview' : 'Show preview'}
            <span className="ml-1 text-[10px] uppercase tracking-wider text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
              mockup
            </span>
          </button>

          {showPreview && (
            <div className="rounded-xl border border-slate-800 bg-[#0a0f1c] overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800 text-sm font-semibold text-slate-200 flex items-center gap-2">
                <GitCompareArrows className="w-4 h-4 text-slate-500" />
                Invoice comparison preview
                <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-600 border border-slate-800 rounded px-2 py-0.5">
                  static mockup — not real data
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-950">
                  <tr>
                    <th className="px-5 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-800 text-left">
                      Item
                    </th>
                    <th className="px-5 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-800 text-right">
                      Our Hours
                    </th>
                    <th className="px-5 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-800 text-right">
                      Invoice Hours
                    </th>
                    <th className="px-5 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-800 text-right">
                      Diff
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ROWS.map((row) => {
                    const diff = row.ourHours - row.invoiceHours
                    return (
                      <tr
                        key={row.item}
                        className="border-b border-slate-900/60 last:border-0 hover:bg-slate-900/40"
                      >
                        <td className="px-5 py-3 text-slate-300">{row.item}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-300">
                          {row.ourHours} hr
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-400">
                          {row.invoiceHours} hr
                        </td>
                        <td
                          className={`px-5 py-3 text-right tabular-nums font-medium ${
                            diff === 0
                              ? 'text-emerald-400'
                              : diff > 0
                                ? 'text-lw-orange-400'
                                : 'text-red-400'
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff === 0 ? '—' : String(diff)} hr
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Feedback CTA */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4">
          <MessageSquarePlus className="w-5 h-5 text-slate-500 shrink-0" />
          <div className="text-sm text-slate-400">
            Have a client invoice format we should support?
          </div>
          <button
            onClick={handleFeedback}
            className="ml-auto shrink-0 px-4 py-1.5 rounded-lg bg-lw-orange-500/15 border border-lw-orange-500/30 text-lw-orange-400 text-sm font-medium hover:bg-lw-orange-500/25 transition-colors"
          >
            Submit a sample invoice
          </button>
        </div>
      </div>
    </div>
  )
}

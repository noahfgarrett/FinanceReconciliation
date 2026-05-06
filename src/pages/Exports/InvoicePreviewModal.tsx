import { useState } from 'react'
import { FileText, Download, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { fmtUsdCents, fmtHours } from '@/lib/format'
import { generateInvoicePdf, downloadPdf } from '@/exports/invoicePdf'
import type { InvoiceData } from '@/exports/invoicePdf'
import logoUrl from '@/assets/lotusworks-logo.png'

interface InvoicePreviewModalProps {
  open: boolean
  onClose: () => void
  data: InvoiceData | null
}

interface LineItem {
  projectKey: string
  project: string
  po: string
  regHrs: number
  otHrs: number
  dtHrs: number
  regDollars: number
  otDollars: number
  dtDollars: number
  total: number
}

function buildLineItems(data: InvoiceData): LineItem[] {
  return data.projectKeys.map((key) => {
    const cfg = data.configs[key]
    const rows = data.snapshot.weeklyBilling.filter((r) => r.projectKey === key)

    const regHrs = rows.reduce((s, r) => s + r.regularHrs, 0)
    const otHrs = rows.reduce((s, r) => s + r.otHrs, 0)
    const dtHrs = rows.reduce((s, r) => s + r.dtHrs, 0)
    const regDollars = rows.reduce((s, r) => s + r.regularDollars, 0)
    const otDollars = rows.reduce((s, r) => s + r.otDollars, 0)
    const dtDollars = rows.reduce((s, r) => s + r.dtDollars, 0)
    const total = regDollars + otDollars + dtDollars

    return {
      projectKey: key,
      project: cfg?.displayName ?? key,
      po: cfg?.poNumber ?? '—',
      regHrs,
      otHrs,
      dtHrs,
      regDollars,
      otDollars,
      dtDollars,
      total,
    }
  })
}

export function InvoicePreviewModal({ open, onClose, data }: InvoicePreviewModalProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  if (!data) return null

  const invoiceNum =
    (data.client.invoiceNumberPrefix ?? '') +
    String(data.client.invoiceNumberCounter + 1).padStart(4, '0')
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const lineItems = buildLineItems(data)
  const regTotal = lineItems.reduce((s, r) => s + r.regDollars, 0)
  const otTotal = lineItems.reduce((s, r) => s + r.otDollars, 0)
  const dtTotal = lineItems.reduce((s, r) => s + r.dtDollars, 0)
  const grandTotal = regTotal + otTotal + dtTotal

  async function handleGeneratePdf(): Promise<void> {
    setIsGenerating(true)
    try {
      const bytes = await generateInvoicePdf(data!)
      downloadPdf(bytes, `invoice-${invoiceNum}-${data!.client.name.replace(/\s+/g, '-')}.pdf`)
      onClose()
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} width="3xl">
      {/* Modal header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-lw-orange-400" />
          <h2 className="text-base font-semibold text-slate-100">Invoice Preview</h2>
          <span className="text-xs text-slate-500 ml-1">{invoiceNum}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-900"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Invoice preview body */}
      <div className="p-6 overflow-y-auto max-h-[70vh]">
        {/* White invoice paper */}
        <div className="bg-white text-slate-900 rounded-lg p-8 shadow-inner font-sans text-sm">

          {/* Letterhead bar */}
          <div className="-mx-8 -mt-8 mb-6 px-8 pt-6 pb-5 border-b-4 border-lw-orange-500 bg-gradient-to-r from-white to-lw-orange-50/40">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={logoUrl}
                  alt="LotusWorks"
                  className="w-12 h-12 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div>
                  <div className="font-display text-xl font-bold text-slate-900 tracking-tight leading-none">LotusWorks</div>
                  <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-[0.18em]">Finance &amp; Billing</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-3xl font-bold text-lw-orange-600 tracking-tight leading-none">INVOICE</div>
                <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-[0.16em] tabular-nums">
                  No. {invoiceNum}
                </div>
              </div>
            </div>
          </div>

          {/* Bill-To + Meta */}
          <div className="flex gap-8 mb-8">
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Bill To
              </div>
              <div className="font-semibold text-slate-900">{data.client.name}</div>
              {data.client.address && (
                <div className="text-xs text-slate-600 mt-1 whitespace-pre-line">
                  {data.client.address}
                </div>
              )}
              {data.client.contactEmail && (
                <div className="text-xs text-slate-500 mt-1">{data.client.contactEmail}</div>
              )}
            </div>

            <div className="min-w-[200px]">
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-0.5 text-slate-400 pr-4">Invoice #</td>
                    <td className="py-0.5 font-semibold text-right">{invoiceNum}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-400 pr-4">Date</td>
                    <td className="py-0.5 text-right">{today}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-400 pr-4">Period</td>
                    <td className="py-0.5 text-right">{data.snapshot.periodLabel}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-slate-400 pr-4">Payment Terms</td>
                    <td className="py-0.5 font-medium text-right">{data.client.paymentTerms}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Line items */}
          <div className="mb-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-500 uppercase text-[9px] tracking-wider">
                  <th className="text-left px-3 py-2 rounded-tl-md">Project</th>
                  <th className="text-left px-3 py-2">PO</th>
                  <th className="text-right px-3 py-2">Reg Hrs</th>
                  <th className="text-right px-3 py-2">OT Hrs</th>
                  <th className="text-right px-3 py-2">DT Hrs</th>
                  <th className="text-right px-3 py-2">Reg $</th>
                  <th className="text-right px-3 py-2">OT $</th>
                  <th className="text-right px-3 py-2">DT $</th>
                  <th className="text-right px-3 py-2 rounded-tr-md font-bold text-slate-700">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => (
                  <tr
                    key={item.projectKey}
                    className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800">{item.project}</td>
                    <td className="px-3 py-2 text-slate-500">{item.po}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtHours(item.regHrs)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-lw-orange-600">
                      {fmtHours(item.otHrs)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {item.dtHrs > 0 ? fmtHours(item.dtHrs) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtUsdCents(item.regDollars)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-lw-orange-600">
                      {item.otDollars > 0 ? fmtUsdCents(item.otDollars) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {item.dtDollars > 0 ? fmtUsdCents(item.dtDollars) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {fmtUsdCents(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="min-w-[240px]">
              <div className="flex justify-between py-1 text-xs text-slate-500">
                <span>Regular</span>
                <span className="tabular-nums">{fmtUsdCents(regTotal)}</span>
              </div>
              {otTotal > 0 && (
                <div className="flex justify-between py-1 text-xs text-lw-orange-600">
                  <span>Overtime</span>
                  <span className="tabular-nums">{fmtUsdCents(otTotal)}</span>
                </div>
              )}
              {dtTotal > 0 && (
                <div className="flex justify-between py-1 text-xs text-slate-500">
                  <span>Double Time</span>
                  <span className="tabular-nums">{fmtUsdCents(dtTotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-3 mt-2 border-t-2 border-lw-orange-500 bg-gradient-to-r from-lw-orange-50 to-white px-4 rounded-md shadow-sm">
                <span className="font-display font-bold text-slate-900 text-sm tracking-tight">Total Due</span>
                <span className="font-display font-bold text-lw-orange-600 text-base tabular-nums">
                  {fmtUsdCents(grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          {(data.client.remitTo ?? data.client.footerNotes) && (
            <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-400 space-y-1">
              {data.client.remitTo && (
                <div>
                  <span className="font-semibold text-slate-500">Remit To: </span>
                  {data.client.remitTo}
                </div>
              )}
              {data.client.footerNotes && <div>{data.client.footerNotes}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-800">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<Download className="w-3.5 h-3.5" />}
          onClick={() => void handleGeneratePdf()}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating…' : 'Generate PDF'}
        </Button>
      </div>
    </Modal>
  )
}

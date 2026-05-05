import { useRef, useState } from 'react'
import {
  FileText,
  Sheet,
  Download,
  Upload,
  Eye,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useSnapshotStore } from '@/store/snapshotStore'
import { buildExportBundle, downloadJson, readJsonFile } from '@/persistence/jsonExport'
import type { ExportBundle } from '@/persistence/schemas'
import { generateInvoicePdf, downloadPdf } from '@/exports/invoicePdf'
import type { InvoiceData } from '@/exports/invoicePdf'
import { generateWorkbook, downloadWorkbook } from '@/exports/workbookExport'
import { InvoicePreviewModal } from './InvoicePreviewModal'
import { fmtUsdCents } from '@/lib/format'

// ─── Client invoice groups ────────────────────────────────────────────────────

interface ClientInvoiceGroup {
  clientId: string | null // null = unassigned
  clientName: string
  projectKeys: string[]
  totalAmount: number
}

function buildInvoiceGroups(
  snapshot: NonNullable<ReturnType<typeof useSnapshotStore.getState>['current']>,
  configs: ReturnType<typeof useSnapshotStore.getState>['projectConfigs'],
  clients: ReturnType<typeof useSnapshotStore.getState>['clients'],
): ClientInvoiceGroup[] {
  // Group projects by clientId
  const byClient = new Map<string | null, string[]>()

  const projectsWithBilling = new Set(snapshot.weeklyBilling.map((r) => r.projectKey))

  for (const key of projectsWithBilling) {
    const cfg = configs[key]
    const clientId = cfg?.clientId ?? null
    const group = byClient.get(clientId) ?? []
    group.push(key)
    byClient.set(clientId, group)
  }

  const groups: ClientInvoiceGroup[] = []

  for (const [clientId, projectKeys] of byClient.entries()) {
    const client = clientId !== null ? clients[clientId] : null
    const totalAmount = snapshot.weeklyBilling
      .filter((r) => projectKeys.includes(r.projectKey))
      .reduce((s, r) => s + r.regularDollars + r.otDollars + r.dtDollars, 0)

    groups.push({
      clientId,
      clientName: client?.name ?? 'Unassigned',
      projectKeys,
      totalAmount,
    })
  }

  return groups.sort((a, b) => {
    if (a.clientId === null) return 1
    if (b.clientId === null) return -1
    return a.clientName.localeCompare(b.clientName)
  })
}

// ─── Import confirm modal ─────────────────────────────────────────────────────

interface ImportConfirmModalProps {
  open: boolean
  bundle: ExportBundle | null
  onConfirm: () => void
  onCancel: () => void
  isImporting: boolean
}

function ImportConfirmModal({
  open,
  bundle,
  onConfirm,
  onCancel,
  isImporting,
}: ImportConfirmModalProps) {
  if (!bundle) return null

  const clientCount = Object.keys(bundle.clients ?? {}).length
  const projectCount = Object.keys(bundle.projectConfigs ?? {}).length
  const snapshotCount = bundle.snapshots?.length ?? 0

  return (
    <Modal open={open} onClose={onCancel} title="Import JSON" width="md">
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-950/20 border border-amber-800/30">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-200">
            This will merge the imported data into the current workspace.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-slate-400 font-medium">Bundle contents:</p>
          <ul className="space-y-1 text-slate-300">
            {clientCount > 0 && (
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                {clientCount} client{clientCount !== 1 ? 's' : ''} (merge by id)
              </li>
            )}
            {projectCount > 0 && (
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                {projectCount} project config{projectCount !== 1 ? 's' : ''} (merge by key)
              </li>
            )}
            {snapshotCount > 0 && (
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                {snapshotCount} snapshot{snapshotCount !== 1 ? 's' : ''} (skip if id exists)
              </li>
            )}
            {clientCount === 0 && projectCount === 0 && snapshotCount === 0 && (
              <li className="text-slate-500">Bundle is empty.</li>
            )}
          </ul>
          <p className="text-slate-500 text-xs pt-1">Scope: {bundle.scope} · Exported {new Date(bundle.exportedAt).toLocaleDateString()}</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Upload className="w-3.5 h-3.5" />}
            onClick={onConfirm}
            disabled={isImporting}
          >
            {isImporting ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Exports page ─────────────────────────────────────────────────────────────

export default function ExportsPage() {
  const current = useSnapshotStore((s) => s.current)
  const projectConfigs = useSnapshotStore((s) => s.projectConfigs)
  const clients = useSnapshotStore((s) => s.clients)
  const snapshots = useSnapshotStore((s) => s.snapshots)
  const importBundle = useSnapshotStore((s) => s.importBundle)

  // Invoice preview state
  const [previewData, setPreviewData] = useState<InvoiceData | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Workbook state
  const [isGeneratingWorkbook, setIsGeneratingWorkbook] = useState(false)

  // Per-invoice loading state (keyed by clientId or 'unassigned')
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null)

  // JSON import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importPendingBundle, setImportPendingBundle] = useState<ExportBundle | null>(null)
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  const invoiceGroups = current ? buildInvoiceGroups(current, projectConfigs, clients) : []

  // ── Invoice handlers ──────────────────────────────────────────────────────

  function openPreview(group: ClientInvoiceGroup): void {
    if (!current) return
    const client =
      group.clientId !== null
        ? clients[group.clientId]
        : {
            id: '',
            name: 'Unassigned',
            paymentTerms: 'Net 30',
            invoiceNumberCounter: 0,
          }
    setPreviewData({
      client,
      snapshot: current,
      projectKeys: group.projectKeys,
      configs: projectConfigs,
    })
    setIsPreviewOpen(true)
  }

  async function generateInvoice(group: ClientInvoiceGroup): Promise<void> {
    if (!current) return
    const key = group.clientId ?? 'unassigned'
    setGeneratingInvoice(key)
    try {
      const client =
        group.clientId !== null
          ? clients[group.clientId]
          : {
              id: '',
              name: 'Unassigned',
              paymentTerms: 'Net 30',
              invoiceNumberCounter: 0,
            }
      const invoiceData: InvoiceData = {
        client,
        snapshot: current,
        projectKeys: group.projectKeys,
        configs: projectConfigs,
      }
      const bytes = await generateInvoicePdf(invoiceData)
      const invoiceNum =
        (client.invoiceNumberPrefix ?? '') +
        String(client.invoiceNumberCounter + 1).padStart(4, '0')
      downloadPdf(bytes, `invoice-${invoiceNum}-${client.name.replace(/\s+/g, '-')}.pdf`)
    } finally {
      setGeneratingInvoice(null)
    }
  }

  // ── Workbook handler ──────────────────────────────────────────────────────

  async function handleGenerateWorkbook(): Promise<void> {
    if (!current) return
    setIsGeneratingWorkbook(true)
    try {
      const bytes = await generateWorkbook({ snapshot: current, configs: projectConfigs })
      const safeName = current.periodLabel.replace(/\s+/g, '-')
      downloadWorkbook(bytes, `LotusWorks-${safeName}.xlsx`)
    } finally {
      setIsGeneratingWorkbook(false)
    }
  }

  // ── JSON handlers ─────────────────────────────────────────────────────────

  function handleExportJson(scope: 'all' | 'settings' | 'history'): void {
    const bundle = buildExportBundle({
      scope,
      clients,
      projectConfigs,
      snapshots,
    })
    const date = new Date().toISOString().slice(0, 10)
    downloadJson(bundle, `lotusworks-${scope}-${date}.json`)
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError(null)
    setImportSuccess(false)
    try {
      const bundle = await readJsonFile(file)
      setImportPendingBundle(bundle)
      setIsImportConfirmOpen(true)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid JSON file')
    }
  }

  async function handleConfirmImport(): Promise<void> {
    if (!importPendingBundle) return
    setIsImporting(true)
    try {
      await importBundle(importPendingBundle)
      setIsImportConfirmOpen(false)
      setImportPendingBundle(null)
      setImportSuccess(true)
      setTimeout(() => setImportSuccess(false), 4000)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
      setIsImportConfirmOpen(false)
    } finally {
      setIsImporting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const hasSnapshot = current !== null

  return (
    <div>
      <PageHeader
        title="Exports"
        subtitle="Generate invoices, branded workbooks, and JSON snapshots"
      />

      <div className="px-8 py-6 space-y-8 max-w-4xl">

        {/* ── Section 1: Invoices ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-lw-orange-400" />
            <h2 className="text-base font-semibold text-slate-200">Generate Invoices</h2>
          </div>

          {!hasSnapshot ? (
            <EmptyState message="Load or create a snapshot to generate invoices." />
          ) : invoiceGroups.length === 0 ? (
            <EmptyState message="No billing rows in the current snapshot." />
          ) : (
            <div className="space-y-3">
              {invoiceGroups.map((group) => {
                const key = group.clientId ?? 'unassigned'
                const isGenerating = generatingInvoice === key
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-800 bg-[#0a0f1c] p-5 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100">{group.clientName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {group.projectKeys.length} project{group.projectKeys.length !== 1 ? 's' : ''} ·{' '}
                        <span className="text-lw-orange-400 font-medium">
                          {fmtUsdCents(group.totalAmount)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {group.projectKeys.map((pk) => (
                          <span
                            key={pk}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400"
                          >
                            {projectConfigs[pk]?.displayName ?? pk}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => openPreview(group)}
                        disabled={group.clientId === null}
                        title={group.clientId === null ? 'Assign a client to preview' : 'Preview invoice'}
                      >
                        Preview
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Download className="w-3.5 h-3.5" />}
                        onClick={() => void generateInvoice(group)}
                        disabled={isGenerating || group.clientId === null}
                        title={group.clientId === null ? 'Assign projects to a client first' : 'Generate PDF'}
                      >
                        {isGenerating ? 'Generating…' : 'Generate PDF'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Section 2: Excel Workbook ────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sheet className="w-4 h-4 text-green-400" />
            <h2 className="text-base font-semibold text-slate-200">Excel Workbook</h2>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0a0f1c] p-5 flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-slate-100">Branded .xlsx Report</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Summary tab + one tab per project with employee × week detail rows
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={() => void handleGenerateWorkbook()}
              disabled={!hasSnapshot || isGeneratingWorkbook}
            >
              {isGeneratingWorkbook ? 'Generating…' : 'Generate Workbook'}
            </Button>
          </div>

          {!hasSnapshot && (
            <p className="text-xs text-slate-600 mt-2 ml-1">
              Load a snapshot to enable workbook export.
            </p>
          )}
        </section>

        {/* ── Section 3: JSON ──────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Download className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-semibold text-slate-200">JSON Export / Import</h2>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0a0f1c] p-5 space-y-4">
            {/* Export buttons */}
            <div>
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-semibold">
                Export
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => handleExportJson('all')}
                >
                  Export All
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => handleExportJson('settings')}
                >
                  Export Settings
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => handleExportJson('history')}
                >
                  Export History
                </Button>
              </div>
            </div>

            {/* Import */}
            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-semibold">
                Import
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Upload className="w-3.5 h-3.5" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import JSON
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => void handleFileSelected(e)}
                />
                {importSuccess && (
                  <span className="flex items-center gap-1.5 text-xs text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Import successful
                  </span>
                )}
                {importError && (
                  <span className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {importError}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Importing merges clients and project configs (overwrite by id/key), and appends new
                snapshots (skips existing ids).
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Modals */}
      <InvoicePreviewModal
        open={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false)
          setPreviewData(null)
        }}
        data={previewData}
      />

      <ImportConfirmModal
        open={isImportConfirmOpen}
        bundle={importPendingBundle}
        onConfirm={() => void handleConfirmImport()}
        onCancel={() => {
          setIsImportConfirmOpen(false)
          setImportPendingBundle(null)
        }}
        isImporting={isImporting}
      />
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 bg-[#0a0f1c]/40 px-6 py-8 text-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}

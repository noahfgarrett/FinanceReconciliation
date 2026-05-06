import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Client } from '@/persistence/schemas'
import { ClientEditDrawer } from './ClientEditDrawer'

const NEW_CLIENT_SENTINEL: Client = {
  id: '',
  name: '',
  paymentTerms: 'Net 30',
  invoiceNumberCounter: 0,
}

export function ClientsTab(): React.JSX.Element {
  const clients = useSnapshotStore((s) => s.clients)
  const [editTarget, setEditTarget] = useState<Client | null>(null)

  const clientList = Object.values(clients).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="mx-8 mb-8">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{clientList.length} client{clientList.length !== 1 ? 's' : ''}</p>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setEditTarget(NEW_CLIENT_SENTINEL)}
        >
          Add client
        </Button>
      </div>

      {clientList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0a0f1c]/40 flex flex-col items-center justify-center py-16 px-6 text-center gap-4 animate-fade-in">
          <div className="relative">
            <span aria-hidden className="absolute -inset-2 rounded-2xl bg-lw-blue-500/15 blur-xl" />
            <div className="relative w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <Users className="w-6 h-6 text-lw-blue-300" />
            </div>
          </div>
          <div className="max-w-sm">
            <h3 className="font-display text-lg font-semibold text-slate-100 tracking-tight">
              No clients yet
            </h3>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
              Add a client to link it to projects and generate branded invoices.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Payment Terms</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Invoice Prefix</th>
              </tr>
            </thead>
            <tbody>
              {clientList.map((c, i) => {
                const isLast = i === clientList.length - 1
                return (
                  <tr
                    key={c.id}
                    onClick={() => setEditTarget(c)}
                    className={`cursor-pointer hover:bg-slate-800/50 transition-colors ${
                      isLast ? '' : 'border-b border-slate-800/60'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-100">{c.name}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {c.contactEmail ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{c.paymentTerms}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {c.invoiceNumberPrefix ?? <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ClientEditDrawer
        client={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </div>
  )
}

import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Client } from '@/persistence/schemas'

interface Props {
  client: Client | null
  onClose: () => void
}

interface FormState {
  name: string
  address: string
  contactEmail: string
  paymentTerms: string
  invoiceNumberPrefix: string
  remitTo: string
  footerNotes: string
}

function clientToForm(c: Client): FormState {
  return {
    name: c.name,
    address: c.address ?? '',
    contactEmail: c.contactEmail ?? '',
    paymentTerms: c.paymentTerms,
    invoiceNumberPrefix: c.invoiceNumberPrefix ?? '',
    remitTo: c.remitTo ?? '',
    footerNotes: c.footerNotes ?? '',
  }
}

const DEFAULT_FORM: FormState = {
  name: '',
  address: '',
  contactEmail: '',
  paymentTerms: 'Net 30',
  invoiceNumberPrefix: '',
  remitTo: '',
  footerNotes: '',
}

const TEXTAREA_CLASS =
  'w-full rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lw-orange-500/40 transition-colors resize-none'

export function ClientEditDrawer({ client, onClose }: Props): React.JSX.Element | null {
  const upsertClient = useSnapshotStore((s) => s.upsertClient)

  const isNew = client === null || !('id' in client)
  const [form, setForm] = useState<FormState>(() =>
    client ? clientToForm(client) : DEFAULT_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'name') setNameError('')
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError('Name is required')
      return
    }
    setSaving(true)
    const saved: Client = {
      id: client?.id ?? crypto.randomUUID(),
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      paymentTerms: form.paymentTerms.trim() || 'Net 30',
      invoiceNumberPrefix: form.invoiceNumberPrefix.trim() || undefined,
      invoiceNumberCounter: client?.invoiceNumberCounter ?? 0,
      remitTo: form.remitTo.trim() || undefined,
      footerNotes: form.footerNotes.trim() || undefined,
    }
    await upsertClient(saved)
    setSaving(false)
    onClose()
  }

  const isOpen = client !== null

  if (!isOpen) return null

  const footer = (
    <div className="flex gap-2 justify-end">
      <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
      <Button variant="primary" size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : isNew ? 'Create client' : 'Save changes'}
      </Button>
    </div>
  )

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      title={isNew ? 'New Client' : `Edit: ${client.name}`}
      width="lg"
      footer={footer}
    >
      <div className="px-5 py-4 flex flex-col gap-4">
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          error={nameError || undefined}
          placeholder="e.g. Acme Corp"
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">Address</label>
          <textarea
            rows={3}
            className={TEXTAREA_CLASS}
            placeholder="123 Main St&#10;Springfield, IL 62701"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
          />
        </div>

        <Input
          label="Contact Email"
          type="email"
          value={form.contactEmail}
          onChange={(e) => update('contactEmail', e.target.value)}
          placeholder="billing@acme.com"
        />

        <Input
          label="Payment Terms"
          value={form.paymentTerms}
          onChange={(e) => update('paymentTerms', e.target.value)}
          placeholder="Net 30"
        />

        <Input
          label="Invoice Number Prefix"
          value={form.invoiceNumberPrefix}
          onChange={(e) => update('invoiceNumberPrefix', e.target.value)}
          placeholder="ACME-"
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">Remit To</label>
          <textarea
            rows={3}
            className={TEXTAREA_CLASS}
            placeholder="LotusWorks LLC&#10;PO Box 123&#10;Anytown, USA"
            value={form.remitTo}
            onChange={(e) => update('remitTo', e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">Footer Notes</label>
          <textarea
            rows={3}
            className={TEXTAREA_CLASS}
            placeholder="Thank you for your business!"
            value={form.footerNotes}
            onChange={(e) => update('footerNotes', e.target.value)}
          />
          <p className="text-xs text-slate-500">Appears at the bottom of invoices</p>
        </div>
      </div>
    </Drawer>
  )
}

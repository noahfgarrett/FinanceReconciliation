import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { reconcile } from '@/reconciler/reconcile'
import type {
  Client, Employee, ExcelRow, ParsedPdf, ProjectConfig, Snapshot, AuditEvent,
} from '@/persistence/schemas'
import { getAll, putRecord, deleteRecord, kvGet, kvSet } from '@/persistence/idb'
import { slugifyProjectName } from '@/reconciler/projectMatching'

const CURRENT_SNAPSHOT_ID = 'current-snapshot-id'

interface SnapshotState {
  current: Snapshot | null
  projectConfigs: Record<string, ProjectConfig>
  clients: Record<string, Client>
  snapshots: Snapshot[]
  unresolvedAllocations: string[]

  hydrate: () => Promise<void>
  importBatch: (input: {
    excelRows: ExcelRow[]
    employees: Employee[]
    parsedPdfs: ParsedPdf[]
    periodLabel: string
  }) => Promise<void>
  upsertProjectConfig: (cfg: ProjectConfig) => Promise<void>
  upsertClient: (client: Client) => Promise<void>
  recompute: () => Promise<void>
  saveCurrentAsSnapshot: (name: string) => Promise<void>
  loadSnapshot: (id: string) => Promise<void>
  deleteSnapshot: (id: string) => Promise<void>
  duplicateSnapshot: (id: string, newName: string) => Promise<void>
  toggleLock: (id: string) => Promise<void>
  clearCurrent: () => Promise<void>
  appendAudit: (
    action: AuditEvent['action'], detail: string, before?: unknown, after?: unknown,
  ) => void
  clearUnresolvedAllocation: (alloc: string) => void
}

function bootstrapProjectsFromExcel(
  excelRows: ExcelRow[],
  existing: Record<string, ProjectConfig>,
): Record<string, ProjectConfig> {
  const out = { ...existing }
  for (const r of excelRows) {
    const key = slugifyProjectName(r.projectName)
    if (!out[key]) {
      out[key] = {
        projectKey: key,
        displayName: r.projectName,
        allocationAliases: r.laborAllocationDetails ? [r.laborAllocationDetails] : [],
        otThresholdHrs: 40,
        includeDoubleTime: false,
        defaultRegularRate: 0,
        employeeRateOverrides: {},
      }
    } else if (
      r.laborAllocationDetails &&
      !out[key].allocationAliases.includes(r.laborAllocationDetails)
    ) {
      out[key] = {
        ...out[key],
        allocationAliases: [...out[key].allocationAliases, r.laborAllocationDetails],
      }
    }
  }
  return out
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  current: null,
  projectConfigs: {},
  clients: {},
  snapshots: [],
  unresolvedAllocations: [],

  hydrate: async () => {
    const [configs, clients, snapshots, currentId] = await Promise.all([
      getAll<ProjectConfig>('configs'),
      getAll<Client>('clients'),
      getAll<Snapshot>('snapshots'),
      kvGet<string>(CURRENT_SNAPSHOT_ID),
    ])
    const cfgMap: Record<string, ProjectConfig> = {}
    configs.forEach((c) => (cfgMap[c.projectKey] = c))
    const clientMap: Record<string, Client> = {}
    clients.forEach((c) => (clientMap[c.id] = c))
    const current = snapshots.find((s) => s.id === currentId) ?? null
    set({ projectConfigs: cfgMap, clients: clientMap, snapshots, current })
  },

  importBatch: async ({ excelRows, employees, parsedPdfs, periodLabel }) => {
    const updatedConfigs = bootstrapProjectsFromExcel(excelRows, get().projectConfigs)
    for (const cfg of Object.values(updatedConfigs)) {
      await putRecord('configs', cfg.projectKey, cfg)
    }

    const out = reconcile({
      employees,
      excelRows,
      parsedPdfs,
      projectConfigs: updatedConfigs,
    })
    const snap: Snapshot = {
      id: uuid(),
      name: `Draft (${periodLabel})`,
      periodLabel,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      locked: false,
      isDraft: true,
      employees,
      excelRows,
      parsedPdfs,
      projectConfigsAtSave: updatedConfigs,
      clientsAtSave: get().clients,
      weeklyBilling: out.weeklyBilling,
      warnings: out.warnings,
      auditLog: [
        {
          ts: new Date().toISOString(),
          action: 'snapshot-created',
          detail: `Imported ${parsedPdfs.length} PDFs, ${excelRows.length} rows`,
        },
      ],
    }
    await putRecord('snapshots', snap.id, snap)
    await kvSet(CURRENT_SNAPSHOT_ID, snap.id)
    set({
      current: snap,
      projectConfigs: updatedConfigs,
      snapshots: [...get().snapshots.filter((s) => !s.isDraft), snap],
      unresolvedAllocations: out.unresolvedAllocations,
    })
  },

  upsertProjectConfig: async (cfg) => {
    await putRecord('configs', cfg.projectKey, cfg)
    set({ projectConfigs: { ...get().projectConfigs, [cfg.projectKey]: cfg } })
    await get().recompute()
  },

  upsertClient: async (c) => {
    await putRecord('clients', c.id, c)
    set({ clients: { ...get().clients, [c.id]: c } })
  },

  recompute: async () => {
    const cur = get().current
    if (!cur || cur.locked) return
    const out = reconcile({
      employees: cur.employees,
      excelRows: cur.excelRows,
      parsedPdfs: cur.parsedPdfs,
      projectConfigs: get().projectConfigs,
    })
    const updated: Snapshot = {
      ...cur,
      lastModifiedAt: new Date().toISOString(),
      projectConfigsAtSave: get().projectConfigs,
      clientsAtSave: get().clients,
      weeklyBilling: out.weeklyBilling,
      warnings: out.warnings,
    }
    await putRecord('snapshots', updated.id, updated)
    set({
      current: updated,
      snapshots: get().snapshots.map((s) => (s.id === updated.id ? updated : s)),
      unresolvedAllocations: out.unresolvedAllocations,
    })
  },

  saveCurrentAsSnapshot: async (name) => {
    const cur = get().current
    if (!cur) return
    const saved: Snapshot = {
      ...cur,
      id: uuid(),
      name,
      isDraft: false,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      auditLog: [
        ...cur.auditLog,
        { ts: new Date().toISOString(), action: 'snapshot-created', detail: `Saved as "${name}"` },
      ],
    }
    await putRecord('snapshots', saved.id, saved)
    await kvSet(CURRENT_SNAPSHOT_ID, saved.id)
    set({
      current: saved,
      snapshots: [...get().snapshots.filter((s) => s.id !== cur.id), saved],
    })
  },

  loadSnapshot: async (id) => {
    const snap = get().snapshots.find((s) => s.id === id)
    if (!snap) return
    await kvSet(CURRENT_SNAPSHOT_ID, id)
    set({ current: snap })
  },

  deleteSnapshot: async (id) => {
    await deleteRecord('snapshots', id)
    set({ snapshots: get().snapshots.filter((s) => s.id !== id) })
    if (get().current?.id === id) set({ current: null })
  },

  duplicateSnapshot: async (id, newName) => {
    const src = get().snapshots.find((s) => s.id === id)
    if (!src) return
    const copy: Snapshot = {
      ...src,
      id: uuid(),
      name: newName,
      locked: false,
      isDraft: false,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      auditLog: [
        ...src.auditLog,
        {
          ts: new Date().toISOString(),
          action: 'snapshot-created',
          detail: `Duplicated from "${src.name}"`,
        },
      ],
    }
    await putRecord('snapshots', copy.id, copy)
    set({ snapshots: [...get().snapshots, copy] })
  },

  toggleLock: async (id) => {
    const snap = get().snapshots.find((s) => s.id === id)
    if (!snap) return
    const updated: Snapshot = {
      ...snap,
      locked: !snap.locked,
      lastModifiedAt: new Date().toISOString(),
      auditLog: [
        ...snap.auditLog,
        {
          ts: new Date().toISOString(),
          action: snap.locked ? 'snapshot-unlocked' : 'snapshot-locked',
          detail: snap.locked ? 'Unlocked' : 'Locked',
        },
      ],
    }
    await putRecord('snapshots', updated.id, updated)
    set({
      snapshots: get().snapshots.map((s) => (s.id === id ? updated : s)),
      current: get().current?.id === id ? updated : get().current,
    })
  },

  clearCurrent: async () => {
    const cur = get().current
    if (cur) await deleteRecord('snapshots', cur.id)
    await kvSet(CURRENT_SNAPSHOT_ID, '')
    set({
      current: null,
      snapshots: get().snapshots.filter((s) => !cur || s.id !== cur.id),
      unresolvedAllocations: [],
    })
  },

  clearUnresolvedAllocation: (alloc) => {
    set({ unresolvedAllocations: get().unresolvedAllocations.filter((a) => a !== alloc) })
  },

  appendAudit: (action, detail, before, after) => {
    const cur = get().current
    if (!cur) return
    const event: AuditEvent = { ts: new Date().toISOString(), action, detail, before, after }
    const updated = {
      ...cur,
      auditLog: [...cur.auditLog, event],
      lastModifiedAt: new Date().toISOString(),
    }
    void putRecord('snapshots', updated.id, updated)
    set({
      current: updated,
      snapshots: get().snapshots.map((s) => (s.id === updated.id ? updated : s)),
    })
  },
}))

import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { reconcile } from '@/reconciler/reconcile'
import type {
  Client, Employee, ExcelRow, ExportBundle, ParsedPdfWithBytes,
  ProjectConfig, Snapshot, AuditEvent,
} from '@/persistence/schemas'
import { getAll, putRecord, deleteRecord, kvGet, kvSet } from '@/persistence/idb'
import { useEmployeeStore } from '@/store/employeeStore'

const CURRENT_SNAPSHOT_ID = 'current-snapshot-id'
const RECENT_IMPORTS_KEY = 'recent-imports'
const MAX_RECENT_IMPORTS = 5

export interface RecentImportEntry {
  excelName?: string
  folderName?: string
  ts: string
}

interface SnapshotState {
  current: Snapshot | null
  projectConfigs: Record<string, ProjectConfig>
  clients: Record<string, Client>
  snapshots: Snapshot[]
  unresolvedAllocations: string[]
  recentImports: RecentImportEntry[]

  hydrate: () => Promise<void>
  addRecentImport: (entry: { excelName?: string; folderName?: string }) => Promise<void>
  importBatch: (input: {
    excelRows: ExcelRow[]
    employees: Employee[]
    parsedPdfs: ParsedPdfWithBytes[]
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
  importBundle: (bundle: ExportBundle) => Promise<void>
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  current: null,
  projectConfigs: {},
  clients: {},
  snapshots: [],
  unresolvedAllocations: [],
  recentImports: [],

  hydrate: async () => {
    const [configs, clients, snapshots, currentId, recentImports] = await Promise.all([
      getAll<ProjectConfig>('configs'),
      getAll<Client>('clients'),
      getAll<Snapshot>('snapshots'),
      kvGet<string>(CURRENT_SNAPSHOT_ID),
      kvGet<RecentImportEntry[]>(RECENT_IMPORTS_KEY),
    ])
    const cfgMap: Record<string, ProjectConfig> = {}
    configs.forEach((c) => (cfgMap[c.projectKey] = c))
    const clientMap: Record<string, Client> = {}
    clients.forEach((c) => (clientMap[c.id] = c))
    const current = snapshots.find((s) => s.id === currentId) ?? null
    set({ projectConfigs: cfgMap, clients: clientMap, snapshots, current, recentImports: recentImports ?? [] })
  },

  addRecentImport: async (entry) => {
    const newEntry: RecentImportEntry = { ...entry, ts: new Date().toISOString() }
    const existing = get().recentImports
    const updated = [newEntry, ...existing].slice(0, MAX_RECENT_IMPORTS)
    await kvSet(RECENT_IMPORTS_KEY, updated)
    set({ recentImports: updated })
  },

  importBatch: async ({ excelRows, employees, parsedPdfs, periodLabel }) => {
    // Project configs should already be set up (by the OnboardingWizard or
    // prior configuration) before importBatch is called. We read the current
    // store state directly instead of bootstrapping from Excel.
    const currentConfigs = get().projectConfigs
    const employeeProfiles = useEmployeeStore.getState().employees
    const out = reconcile({
      employees,
      excelRows,
      parsedPdfs,
      projectConfigs: currentConfigs,
      employeeProfiles,
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
      projectConfigsAtSave: currentConfigs,
      clientsAtSave: get().clients,
      employeesAtSave: employeeProfiles,
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
    const recomputeProfiles = useEmployeeStore.getState().employees
    const out = reconcile({
      employees: cur.employees,
      excelRows: cur.excelRows,
      parsedPdfs: cur.parsedPdfs,
      projectConfigs: get().projectConfigs,
      employeeProfiles: recomputeProfiles,
    })
    const updated: Snapshot = {
      ...cur,
      lastModifiedAt: new Date().toISOString(),
      projectConfigsAtSave: get().projectConfigs,
      clientsAtSave: get().clients,
      employeesAtSave: recomputeProfiles,
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

  importBundle: async (bundle) => {
    if (bundle.clients) {
      for (const c of Object.values(bundle.clients)) {
        await putRecord('clients', c.id, c)
      }
    }
    if (bundle.projectConfigs) {
      for (const cfg of Object.values(bundle.projectConfigs)) {
        await putRecord('configs', cfg.projectKey, cfg)
      }
    }
    if (bundle.employees) {
      for (const ep of Object.values(bundle.employees)) {
        await putRecord('employees', ep.code, ep)
      }
    }
    if (bundle.snapshots) {
      const existingIds = new Set(get().snapshots.map((s) => s.id))
      for (const snap of bundle.snapshots) {
        if (!existingIds.has(snap.id)) {
          await putRecord('snapshots', snap.id, snap)
        }
      }
    }
    await get().hydrate()
    await useEmployeeStore.getState().hydrate()
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

/**
 * Look up the original PDF bytes for an employee in a given snapshot, if any
 * are stored. Returns null when the snapshot has no PDF for the employee or
 * the bytes are unavailable (e.g., snapshot was loaded from a JSON export).
 */
export function getSourcePdfBytes(
  snapshotId: string,
  employeeCode: string,
): ArrayBuffer | null {
  const snap = useSnapshotStore.getState().snapshots.find((s) => s.id === snapshotId)
  if (!snap) return null
  const pdf = (snap.parsedPdfs as ParsedPdfWithBytes[]).find(
    (p) => p.employeeCode === employeeCode,
  )
  return pdf?.pdfBytes ?? null
}

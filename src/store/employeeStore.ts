import { create } from 'zustand'
import type { EmployeeProfile } from '@/persistence/schemas'
import { getAll, putRecord, deleteRecord } from '@/persistence/idb'

interface EmployeeState {
  employees: Record<string, EmployeeProfile>
  hydrate: () => Promise<void>
  upsertEmployee: (profile: EmployeeProfile) => Promise<void>
  upsertMany: (profiles: EmployeeProfile[]) => Promise<void>
  deleteEmployee: (code: string) => Promise<void>
  getEmployee: (code: string) => EmployeeProfile | undefined
}

export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employees: {},

  hydrate: async (): Promise<void> => {
    const all = await getAll<EmployeeProfile>('employees')
    const map: Record<string, EmployeeProfile> = {}
    for (const e of all) map[e.code] = e
    set({ employees: map })
  },

  upsertEmployee: async (profile): Promise<void> => {
    const now = new Date().toISOString()
    const existing = get().employees[profile.code]
    const updated: EmployeeProfile = {
      ...profile,
      createdAt: existing?.createdAt ?? now,
      lastModifiedAt: now,
    }
    await putRecord('employees', updated.code, updated)
    set({ employees: { ...get().employees, [updated.code]: updated } })
  },

  upsertMany: async (profiles): Promise<void> => {
    const now = new Date().toISOString()
    const current = get().employees
    const updated = { ...current }
    for (const p of profiles) {
      const existing = current[p.code]
      const ep: EmployeeProfile = {
        ...p,
        createdAt: existing?.createdAt ?? now,
        lastModifiedAt: now,
      }
      await putRecord('employees', ep.code, ep)
      updated[ep.code] = ep
    }
    set({ employees: updated })
  },

  deleteEmployee: async (code): Promise<void> => {
    await deleteRecord('employees', code)
    const { [code]: _removed, ...rest } = get().employees
    void _removed
    set({ employees: rest })
  },

  getEmployee: (code): EmployeeProfile | undefined => get().employees[code],
}))

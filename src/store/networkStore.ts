import { create } from 'zustand'
import { kvGet, kvSet } from '@/persistence/idb'

const AIR_GAP_KEY = 'ui:airGapEnabled'
const ENTRY_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface ConnectionEntry {
  id: string
  url: string
  method: string
  timestamp: number
  status: 'pending' | 'ok' | 'error' | 'blocked'
  isExternal: boolean
}

interface NetworkState {
  /** Whether air-gap mode is active — blocks external fetch when true */
  isAirGapEnabled: boolean
  /** Rolling log of recent fetch calls (auto-expires after 5 min) */
  connections: ConnectionEntry[]
  /** Toggle air-gap mode and persist to IndexedDB */
  setAirGapEnabled: (enabled: boolean) => void
  /** Add a connection entry */
  addConnection: (entry: ConnectionEntry) => void
  /** Update the status of a pending connection */
  updateConnectionStatus: (id: string, status: 'ok' | 'error' | 'blocked') => void
  /** Prune entries older than TTL */
  pruneExpired: () => void
  /** Hydrate persisted air-gap preference from IndexedDB */
  hydrate: () => Promise<void>
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isAirGapEnabled: false,
  connections: [],

  setAirGapEnabled: (enabled) => {
    void kvSet(AIR_GAP_KEY, enabled)
    set({ isAirGapEnabled: enabled })
  },

  addConnection: (entry) => {
    set((s) => ({
      connections: [...s.connections, entry],
    }))
  },

  updateConnectionStatus: (id, status) => {
    set((s) => ({
      connections: s.connections.map((c) =>
        c.id === id ? { ...c, status } : c,
      ),
    }))
  },

  pruneExpired: () => {
    const cutoff = Date.now() - ENTRY_TTL_MS
    set((s) => ({
      connections: s.connections.filter((c) => c.timestamp > cutoff),
    }))
  },

  hydrate: async () => {
    const stored = await kvGet<boolean>(AIR_GAP_KEY)
    if (typeof stored === 'boolean') {
      set({ isAirGapEnabled: stored })
    }
  },
}))

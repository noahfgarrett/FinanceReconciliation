import { create } from 'zustand'
import type { PageId, Theme } from '@/types'
import { kvGet, kvSet } from '@/persistence/idb'

const THEME_KEY = 'ui:theme'

interface UiState {
  activePage: PageId
  theme: Theme
  sidebarCollapsed: boolean
  setActivePage: (page: PageId) => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  hydrate: () => Promise<void>
}

function applyThemeClass(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
}

export const useUiStore = create<UiState>((set) => ({
  activePage: 'billing-hours',
  theme: 'dark',
  sidebarCollapsed: false,
  setActivePage: (activePage) => set({ activePage }),
  setTheme: (theme) => {
    applyThemeClass(theme)
    void kvSet(THEME_KEY, theme)
    set({ theme })
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  hydrate: async () => {
    const stored = await kvGet<Theme>(THEME_KEY)
    if (stored === 'dark' || stored === 'light') {
      applyThemeClass(stored)
      set({ theme: stored })
    } else {
      applyThemeClass('dark')
    }
  },
}))

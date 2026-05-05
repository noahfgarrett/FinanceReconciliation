import { create } from 'zustand'
import type { PageId, Theme } from '@/types'

interface UiState {
  activePage: PageId
  theme: Theme
  sidebarCollapsed: boolean
  setActivePage: (page: PageId) => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activePage: 'billing-hours',
  theme: 'dark',
  sidebarCollapsed: false,
  setActivePage: (activePage) => set({ activePage }),
  setTheme: (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    set({ theme })
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))

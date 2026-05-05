import { create } from 'zustand'
import type { FeedbackType, PageId, Theme } from '@/types'
import { kvGet, kvSet } from '@/persistence/idb'

const THEME_KEY = 'ui:theme'

interface UiState {
  activePage: PageId
  theme: Theme
  sidebarCollapsed: boolean
  feedbackPreselect: FeedbackType | null
  setActivePage: (page: PageId) => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  openFeedback: (type: FeedbackType) => void
  consumeFeedbackPreselect: () => FeedbackType | null
  hydrate: () => Promise<void>
}

function applyThemeClass(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
}

export const useUiStore = create<UiState>((set, get) => ({
  activePage: 'billing-hours',
  theme: 'dark',
  sidebarCollapsed: false,
  feedbackPreselect: null,
  setActivePage: (activePage) => set({ activePage }),
  setTheme: (theme) => {
    applyThemeClass(theme)
    void kvSet(THEME_KEY, theme)
    set({ theme })
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openFeedback: (type) => set({ activePage: 'feedback', feedbackPreselect: type }),
  consumeFeedbackPreselect: () => {
    const v = get().feedbackPreselect
    if (v) set({ feedbackPreselect: null })
    return v
  },
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

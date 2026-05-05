import { create } from 'zustand'
import type { FeedbackType, PageId, Theme } from '@/types'
import { kvGet, kvSet } from '@/persistence/idb'

const THEME_KEY = 'ui:theme'

interface UiState {
  activePage: PageId
  theme: Theme
  sidebarCollapsed: boolean
  feedbackPreselect: FeedbackType | null
  showCommandPalette: boolean
  showKeyboardHelp: boolean
  showChangelog: boolean
  triggerSaveSnapshot: boolean
  setActivePage: (page: PageId) => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  openFeedback: (type: FeedbackType) => void
  consumeFeedbackPreselect: () => FeedbackType | null
  setShowCommandPalette: (v: boolean) => void
  setShowKeyboardHelp: (v: boolean) => void
  setShowChangelog: (v: boolean) => void
  setTriggerSaveSnapshot: (v: boolean) => void
  hydrate: () => Promise<void>
}

let systemThemeListener: (() => void) | null = null

function applyThemeClass(theme: Theme): void {
  const resolved = resolveTheme(theme)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.classList.toggle('light', resolved === 'light')
}

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function setupSystemListener(store: { setTheme: (t: Theme) => void }): void {
  if (systemThemeListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemThemeListener)
    systemThemeListener = null
  }
  systemThemeListener = () => {
    applyThemeClass('system')
    store.setTheme('system')
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', systemThemeListener)
}

export const useUiStore = create<UiState>((set, get) => ({
  activePage: 'billing-hours',
  theme: 'dark',
  sidebarCollapsed: false,
  feedbackPreselect: null,
  showCommandPalette: false,
  showKeyboardHelp: false,
  showChangelog: false,
  triggerSaveSnapshot: false,
  setActivePage: (activePage) => set({ activePage }),
  setTheme: (theme) => {
    applyThemeClass(theme)
    void kvSet(THEME_KEY, theme)
    set({ theme })
    if (theme === 'system') {
      setupSystemListener(get())
    } else {
      if (systemThemeListener) {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemThemeListener)
        systemThemeListener = null
      }
    }
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openFeedback: (type) => set({ activePage: 'feedback', feedbackPreselect: type }),
  consumeFeedbackPreselect: () => {
    const v = get().feedbackPreselect
    if (v) set({ feedbackPreselect: null })
    return v
  },
  setShowCommandPalette: (v) => set({ showCommandPalette: v }),
  setShowKeyboardHelp: (v) => set({ showKeyboardHelp: v }),
  setShowChangelog: (v) => set({ showChangelog: v }),
  setTriggerSaveSnapshot: (v) => set({ triggerSaveSnapshot: v }),
  hydrate: async () => {
    const stored = await kvGet<Theme>(THEME_KEY)
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      applyThemeClass(stored)
      set({ theme: stored })
      if (stored === 'system') {
        setupSystemListener(useUiStore.getState())
      }
    } else {
      applyThemeClass('dark')
    }
  },
}))

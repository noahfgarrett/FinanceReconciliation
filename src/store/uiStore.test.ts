import { describe, it, expect, beforeEach } from 'vitest'
import { useUiStore } from './uiStore'

beforeEach(() => {
  useUiStore.setState({ activePage: 'billing-hours', theme: 'dark', sidebarCollapsed: false })
})

describe('uiStore', () => {
  it('changes active page', () => {
    useUiStore.getState().setActivePage('projects')
    expect(useUiStore.getState().activePage).toBe('projects')
  })

  it('toggles sidebar', () => {
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })

  it('updates theme and applies dark class', () => {
    useUiStore.getState().setTheme('light')
    expect(useUiStore.getState().theme).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })
})

import { useEffect } from 'react'
import { useUiStore } from '@/store/uiStore'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    el.isContentEditable
  )
}

/**
 * Registers global keyboard shortcuts. Mount once from App.tsx.
 * Skips shortcuts when the user is typing in a form element.
 */
export function useKeyboardShortcuts(): void {
  const setActivePage = useUiStore((s) => s.setActivePage)
  const setShowCommandPalette = useUiStore((s) => s.setShowCommandPalette)
  const setShowKeyboardHelp = useUiStore((s) => s.setShowKeyboardHelp)
  const setTriggerSaveSnapshot = useUiStore((s) => s.setTriggerSaveSnapshot)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const isMod = e.metaKey || e.ctrlKey

      // ⌘K / Ctrl+K — command palette (never skip even in inputs)
      if (isMod && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
        return
      }

      // For all remaining shortcuts, skip when typing in form elements
      if (isTypingTarget(e.target)) return

      // ⌘S / Ctrl+S — trigger save snapshot
      if (isMod && e.key === 's') {
        e.preventDefault()
        const state = useUiStore.getState()
        if (state.activePage === 'billing-hours') {
          setTriggerSaveSnapshot(true)
        }
        return
      }

      // ⌘E / Ctrl+E — open exports
      if (isMod && e.key === 'e') {
        e.preventDefault()
        setActivePage('exports')
        return
      }

      // ? — show keyboard help
      if (e.key === '?' && !isMod) {
        setShowKeyboardHelp(true)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setActivePage, setShowCommandPalette, setShowKeyboardHelp, setTriggerSaveSnapshot])
}

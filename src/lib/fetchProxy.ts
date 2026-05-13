/**
 * Fetch proxy — wraps window.fetch to log all network requests
 * and block external ones when air-gap mode is active.
 *
 * Call `installFetchProxy()` once at app startup (before any other code calls fetch).
 */

import { useNetworkStore } from '@/store/networkStore'

let nextId = 0
let installed = false

function isExternalUrl(url: string): boolean {
  // blob: and data: URLs are always local
  if (url.startsWith('blob:') || url.startsWith('data:')) return false

  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.origin !== window.location.origin
  } catch {
    // If URL can't be parsed, treat as local (relative path)
    return false
  }
}

export function installFetchProxy(): void {
  if (installed) return
  installed = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    const method = init?.method ?? 'GET'
    const external = isExternalUrl(url)

    // Only track external requests in the connection log
    if (!external) {
      return originalFetch(input, init)
    }

    const store = useNetworkStore.getState()
    const id = `conn-${++nextId}`

    // If air-gap mode is active, block the request
    if (store.isAirGapEnabled) {
      store.addConnection({
        id,
        url,
        method,
        timestamp: Date.now(),
        status: 'blocked',
        isExternal: true,
      })
      return Promise.reject(
        new Error(`[Air-gap Mode] Blocked external request to ${url}`),
      )
    }

    // Log the outbound request
    store.addConnection({
      id,
      url,
      method,
      timestamp: Date.now(),
      status: 'pending',
      isExternal: true,
    })

    try {
      const response = await originalFetch(input, init)
      store.updateConnectionStatus(id, 'ok')
      return response
    } catch (err: unknown) {
      store.updateConnectionStatus(id, 'error')
      throw err
    }
  }
}

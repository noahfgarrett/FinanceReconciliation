import { isNewer } from '@/utils/semver'

const GITHUB_API_URL =
  'https://api.github.com/repos/noahfgarrett/FinanceReconciliation/releases/latest'
const TIMEOUT_MS = 5000

/** Module-level guard — only allow one version check per page load. */
let checkPromise: Promise<UpdateInfo | null> | null = null

export interface UpdateInfo {
  version: string
  releaseNotes: string
  downloadUrl: string
  assetApiUrl: string
  assetName: string
}

interface GitHubAsset {
  name: string
  url: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  body?: string
  html_url: string
  assets?: GitHubAsset[]
}

/**
 * Check GitHub Releases for a newer version.
 * Returns update info if a newer version exists, null otherwise.
 * Silently returns null on any error — never blocks the app.
 * Deduped: concurrent/repeated calls share the same in-flight request.
 */
export function checkForUpdate(): Promise<UpdateInfo | null> {
  if (checkPromise) return checkPromise
  checkPromise = doCheck()
  return checkPromise
}

async function doCheck(): Promise<UpdateInfo | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(GITHUB_API_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github.v3+json' },
    })
    clearTimeout(timer)

    if (!res.ok) return null

    const release: GitHubRelease = await res.json() as GitHubRelease
    const remoteVersion = release.tag_name.replace(/^v/, '')

    if (!isNewer(remoteVersion, __APP_VERSION__)) return null

    const htmlAsset = release.assets?.find((a) =>
      a.name.toLowerCase().endsWith('.html'),
    )
    if (!htmlAsset) return null

    return {
      version: remoteVersion,
      releaseNotes: release.body ?? '',
      downloadUrl: htmlAsset.browser_download_url,
      assetApiUrl: htmlAsset.url,
      assetName: htmlAsset.name,
    }
  } catch {
    return null
  }
}

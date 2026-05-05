import {
  ExportBundleSchema,
  type ExportBundle,
  type ProjectConfig,
  type Client,
  type Snapshot,
} from './schemas'

export interface ExportOptions {
  scope: 'all' | 'settings' | 'history'
  clients: Record<string, Client>
  projectConfigs: Record<string, ProjectConfig>
  snapshots: Snapshot[]
}

export function buildExportBundle(opts: ExportOptions): ExportBundle {
  const includeSettings = opts.scope === 'all' || opts.scope === 'settings'
  const includeHistory = opts.scope === 'all' || opts.scope === 'history'
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: __APP_VERSION__,
    scope: opts.scope,
    clients: includeSettings ? opts.clients : undefined,
    projectConfigs: includeSettings ? opts.projectConfigs : undefined,
    snapshots: includeHistory ? opts.snapshots : undefined,
  }
}

export function downloadJson(bundle: ExportBundle, filename: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function readJsonFile(file: File): Promise<ExportBundle> {
  const text = await file.text()
  const json: unknown = JSON.parse(text)
  return ExportBundleSchema.parse(json)
}

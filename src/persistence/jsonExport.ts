import {
  ExportBundleSchema,
  type ExportBundle,
  type EmployeeProfile,
  type ParsedPdf,
  type ParsedPdfWithBytes,
  type ProjectConfig,
  type Client,
  type Snapshot,
} from './schemas'

export interface ExportOptions {
  scope: 'all' | 'settings' | 'history' | 'setup'
  clients: Record<string, Client>
  projectConfigs: Record<string, ProjectConfig>
  employees: Record<string, EmployeeProfile>
  snapshots: Snapshot[]
}

/**
 * Strip runtime-only `pdfBytes` from a snapshot's ParsedPdfs so JSON exports
 * stay small. The Zod schema doesn't validate bytes, but they would be
 * serialized as `{}` (or worse) and balloon the file size, so remove them.
 */
function stripPdfBytes(snap: Snapshot): Snapshot {
  const cleaned = (snap.parsedPdfs as ParsedPdfWithBytes[]).map((p): ParsedPdf => {
    const { pdfBytes: _omitted, ...rest } = p
    void _omitted
    return rest
  })
  return { ...snap, parsedPdfs: cleaned }
}

export function buildExportBundle(opts: ExportOptions): ExportBundle {
  const includeSettings = opts.scope === 'all' || opts.scope === 'settings'
  const includeSetup = opts.scope === 'setup'
  const includeHistory = opts.scope === 'all' || opts.scope === 'history'
  const includeEmployees = includeSettings || includeSetup
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: __APP_VERSION__,
    scope: opts.scope,
    clients: includeSettings || includeSetup ? opts.clients : undefined,
    projectConfigs: includeSettings || includeSetup ? opts.projectConfigs : undefined,
    employees: includeEmployees ? opts.employees : undefined,
    snapshots: includeHistory ? opts.snapshots.map(stripPdfBytes) : undefined,
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

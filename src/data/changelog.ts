export interface ChangelogEntry {
  version: string
  date: string
  type: 'major' | 'feature' | 'fix'
  notes: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2026-05-05T00:00:00Z',
    type: 'feature',
    notes: `### Initial release
- Side-nav app shell with Billing Hours, Reconcile (stub), Projects, Exports, and Snapshots routes
- Sample data generator: 8 employees × 3 projects × 4 weeks for exploring the UI
- Reconciler with per-project, isolated OT thresholds (40-hr or 50-hr per week)
- KPI strip + By Project summary view
- IndexedDB persistence; theme + snapshot survive reload
- Auto-update via service worker + GitHub Releases`,
  },
]

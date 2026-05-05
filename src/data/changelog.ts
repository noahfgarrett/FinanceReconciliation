export interface ChangelogEntry {
  version: string
  date: string
  type: 'major' | 'feature' | 'fix'
  notes: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.2.0',
    date: '2026-05-05T16:30:00Z',
    type: 'feature',
    notes: `### Feedback
- New **Report Bug** and **Have an Idea** buttons in the side-nav footer
- Dedicated Feedback page with type, area, priority, subject, description fields
- Open in Email (mailto:) or Copy to Clipboard — sends to ngarrett@lotusworks.com
- App version, current page URL, and reporter name auto-included in the email`,
  },
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

export interface ChangelogEntry {
  version: string
  date: string
  type: 'major' | 'feature' | 'fix'
  notes: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.5.0',
    date: '2026-05-05T19:00:00Z',
    type: 'feature',
    notes: `### Project & Client management
- **Projects page**: edit OT thresholds, charge rates, allocation aliases, per-employee rate overrides
- **Clients page**: manage client metadata, payment terms, invoice prefixes, remit-to addresses
- **Project Mapping Modal**: auto-prompts to resolve unmapped allocation codes after import
- Editing any setting triggers recompute and updates KPIs / by-project / spreadsheet immediately`,
  },
  {
    version: '0.4.0',
    date: '2026-05-05T18:00:00Z',
    type: 'feature',
    notes: `### More views and Reconcile preview
- **By Employee** tab: one row per employee, expandable to show per-project per-week breakdown
- **By Week** tab: one row per ISO Monday with totals
- **Reconcile** page: richer stub with preview mockup and a direct link to submit invoice samples`,
  },
  {
    version: '0.3.0',
    date: '2026-05-05T17:00:00Z',
    type: 'feature',
    notes: `### Spreadsheet view
- Full TanStack Table workhorse with virtualized rows for the (employee × project × week) detail
- Per-column filters, multi-column sort, global fuzzy search, group-by Project/Employee/Week
- Density toggle, sticky header, sticky Employee column
- Flag chips with hover-explain, row-tint by severity
- Inline editable Notes; Mark Reviewed action with audit log
- Export current view to CSV (respects filters and sort)`,
  },
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

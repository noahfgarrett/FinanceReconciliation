export interface ChangelogEntry {
  version: string
  date: string
  type: 'major' | 'feature' | 'fix'
  notes: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.8.0',
    date: '2026-05-05T22:00:00Z',
    type: 'feature',
    notes: `### Settings & UX polish
- **Settings** page: Appearance (Dark / Light / System theme), Number format, Keyboard shortcuts list, About, and Danger Zone (clear local data)
- **Light mode** styles
- **Keyboard shortcuts**: ⌘S save · ⌘E exports · ⌘K command palette · ? help · / focus search · F flagged-only
- **Command palette**: type to filter all global commands
- **Recent imports** surface on the Billing Hours empty state
- Sidebar version pill opens the Changelog`,
  },
  {
    version: '0.7.0',
    date: '2026-05-05T21:00:00Z',
    type: 'feature',
    notes: `### Exports
- **Invoice PDFs** per client with the LotusWorks logo, line items per project, OT/DT breakdowns, payment terms, remit-to, and footer notes
- **HTML preview** of the invoice before generating the PDF
- **Excel workbook** with a Summary tab plus one tab per project
- **JSON sync**: export All / Settings / History; import to merge clients, projects, and snapshots between machines`,
  },
  {
    version: '0.6.0',
    date: '2026-05-05T20:00:00Z',
    type: 'feature',
    notes: `### Snapshot history & locking
- **History page**: every saved month is a row with Open / Duplicate / Rename / Lock / Delete actions
- **Save Snapshot** button on Billing Hours converts a draft to a saved snapshot
- **Audit log** under each snapshot tracks edits, lock/unlock events, generated invoices
- **Lock**: a locked snapshot prevents accidental edits; unlock from the History page to make changes
- **Round-trip totals banner**: warns when by-project / by-employee / row sums disagree`,
  },
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

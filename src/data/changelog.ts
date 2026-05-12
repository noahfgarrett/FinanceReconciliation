export interface ChangelogEntry {
  version: string
  date: string
  type: 'major' | 'feature' | 'fix'
  notes: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.0',
    date: '2026-05-12T00:00:00Z',
    type: 'feature',
    notes: `### Smarter onboarding & polish
- Employee bill rates are now auto-filled from their project's default rate during import setup.
- The employee setup step now shows which project each rate comes from, with a search bar to quickly find anyone.
- Column resizing in the Spreadsheet view works properly — drag any column header edge to resize.
- Fixed the row detail drawer not appearing when clicking a row in the Spreadsheet view.
- Removed sample data — the app is now a clean slate ready for real Paycom imports.`,
  },
  {
    version: '1.2.3',
    date: '2026-05-07T20:00:00Z',
    type: 'fix',
    notes: `### PDF import fix
- Importing real PDF timesheets was failing in certain situations. This has been resolved and imports should now work reliably.`,
  },
  {
    version: '1.2.2',
    date: '2026-05-07T18:00:00Z',
    type: 'fix',
    notes: `### Cleaner import warnings
- Reduced unnecessary warning noise during imports. Warnings that weren't actionable have been toned down so you can focus on the ones that matter.`,
  },
  {
    version: '1.2.1',
    date: '2026-05-07T13:00:00Z',
    type: 'fix',
    notes: `### Improved data accuracy
- Unusual hour entries are now properly surfaced instead of being silently ignored.
- Confidence scores are more accurate when parsing real timesheets.
- Overtime alerts now trigger at more practical thresholds.`,
  },
  {
    version: '1.2.0',
    date: '2026-05-07T16:00:00Z',
    type: 'major',
    notes: `### Better file parsing
- Improved handling of Excel and PDF imports to work more reliably with real-world Paycom exports.
- Reconciliation is now smarter about matching data across files.`,
  },
  {
    version: '1.1.0',
    date: '2026-05-06T18:00:00Z',
    type: 'feature',
    notes: `### Source verification
- Each timesheet entry now shows a confidence score so you can quickly spot items that may need a second look.
- New "Needs review" filter to surface low-confidence entries.
- You can now view the original PDF source for any entry directly in the app.`,
  },
  {
    version: '1.0.2',
    date: '2026-05-06T15:00:00Z',
    type: 'fix',
    notes: `### Visual polish
- Fixed a flickering issue on certain cards when hovering in dark mode.`,
  },
  {
    version: '1.0.1',
    date: '2026-05-06T14:00:00Z',
    type: 'fix',
    notes: `### Dark mode improvements
- Dark mode surfaces are now easier on the eyes with improved contrast and consistency across the app.`,
  },
  {
    version: '1.0.0',
    date: '2026-05-06T00:00:00Z',
    type: 'major',
    notes: `### v1.0 — Visual overhaul
- Refreshed look and feel across the entire app with updated brand colors, typography, and animations.
- Dark mode and light mode are both fully supported.`,
  },
  {
    version: '0.9.0',
    date: '2026-05-06T06:00:00Z',
    type: 'major',
    notes: `### Real file import
- You can now import your actual Paycom Excel and PDF files — just drop them in.`,
  },
  {
    version: '0.8.0',
    date: '2026-05-05T22:00:00Z',
    type: 'feature',
    notes: `### Settings & keyboard shortcuts
- New Settings page with appearance options, keyboard shortcuts, and data management.
- Light mode is here.
- Command palette for quick access to common actions.`,
  },
  {
    version: '0.7.0',
    date: '2026-05-05T21:00:00Z',
    type: 'feature',
    notes: `### Exports
- Generate client invoices as PDFs with your branding and line-item details.
- Export billing data as Excel workbooks or JSON for syncing between machines.`,
  },
  {
    version: '0.6.0',
    date: '2026-05-05T20:00:00Z',
    type: 'feature',
    notes: `### Snapshots & history
- Save monthly billing snapshots and revisit them anytime from the History page.
- Lock snapshots to prevent accidental changes.
- Audit log tracks all edits and actions on each snapshot.`,
  },
  {
    version: '0.5.0',
    date: '2026-05-05T19:00:00Z',
    type: 'feature',
    notes: `### Project & Client management
- Manage your projects and clients directly in the app — rates, thresholds, and contact details all in one place.
- Unmapped allocation codes are automatically flagged for resolution after import.`,
  },
  {
    version: '0.4.0',
    date: '2026-05-05T18:00:00Z',
    type: 'feature',
    notes: `### Additional views
- New By Employee and By Week tabs for different angles on your billing data.
- Early preview of the Reconcile page.`,
  },
  {
    version: '0.3.0',
    date: '2026-05-05T17:00:00Z',
    type: 'feature',
    notes: `### Spreadsheet view
- Full-featured data table with filtering, sorting, search, and grouping.
- Inline notes, review actions, and CSV export.`,
  },
  {
    version: '0.2.0',
    date: '2026-05-05T16:30:00Z',
    type: 'feature',
    notes: `### Feedback
- Report bugs or suggest ideas directly from the app. Your feedback is sent straight to the team.`,
  },
  {
    version: '0.1.0',
    date: '2026-05-05T00:00:00Z',
    type: 'feature',
    notes: `### Initial release
- Core app with billing hours tracking and project summaries.
- Your data saves locally and persists across sessions.`,
  },
]

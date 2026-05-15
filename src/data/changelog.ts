export interface ChangelogEntry {
  version: string
  date: string
  type: 'major' | 'feature' | 'fix'
  notes: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.5.3',
    date: '2026-05-15T00:00:00Z',
    type: 'fix',
    notes: `### Folder drag-and-drop
- Dropping a folder of PDFs onto the import area now works correctly. Previously, only individual files were recognized — folders were silently ignored.`,
  },
  {
    version: '1.5.2',
    date: '2026-05-15T00:00:00Z',
    type: 'fix',
    notes: `### OT billing accuracy & dynamic recomputation
- Overtime billing now correctly uses each project's configured OT threshold instead of always using 40 hours.
- All billing views now show two OT columns: "OT Worked" (hours over 40) and "OT Billed" (hours over the project threshold billed at 1.5×).
- Expanding an employee row now shows the bill rate per hour alongside each project/week entry.
- Changing project settings (bill rate, OT threshold) now immediately updates the loaded billing data — no re-import needed.`,
  },
  {
    version: '1.5.1',
    date: '2026-05-15T00:00:00Z',
    type: 'fix',
    notes: `### Import wizard & UI stability
- The Clear Data button in Settings now works reliably — the confirmation modal no longer gets trapped behind the page.
- The import wizard now detects all projects from Excel, not just new ones. Existing projects are shown as pre-configured.
- You can now drop the Excel file and PDF folder at the same time — no need to drop them one at a time.
- Drawers and modals render correctly regardless of page scroll position.`,
  },
  {
    version: '1.5.0',
    date: '2026-05-15T00:00:00Z',
    type: 'major',
    notes: `### Smarter allocation matching & editing stability
- Allocation codes are now matched by family prefix — e.g. all CARDINAL-* codes automatically resolve to the same project, even if only one variant was configured as an alias.
- Editing project settings (OT threshold, rates) no longer causes billing data to disappear. A safety guard prevents billing rows from regressing during edits.
- The project settings drawer now correctly loads existing values when opened, preventing accidental data loss on save.
- Unmapped allocation rows are preserved as $0 billing entries so nothing gets silently dropped.`,
  },
  {
    version: '1.4.9',
    date: '2026-05-15T00:00:00Z',
    type: 'fix',
    notes: `### Billing stability & allocation matching
- Editing project settings (OT threshold, rates) no longer causes billing data to disappear.
- Allocation codes are now matched by family prefix — e.g. all CARDINAL-* codes automatically resolve to the same project.
- Recompute safety guards prevent billing rows from regressing to unmapped status during edits.`,
  },
  {
    version: '1.4.8',
    date: '2026-05-15T00:00:00Z',
    type: 'fix',
    notes: `### Light mode polish & layout fixes
- Import wizard now uses proper light-mode colors instead of dark gray backgrounds.
- All form inputs (text fields, number fields) adapt correctly to the active theme.
- Projects step in the import wizard now scrolls when there are many projects.
- Employee rate and job title columns are wider to prevent clipping.
- Update download works reliably from any origin (file://, localhost, GitHub Pages).`,
  },
  {
    version: '1.4.7',
    date: '2026-05-15T00:00:00Z',
    type: 'fix',
    notes: `### Excel import fix
- Fixed Excel file imports failing when running from a downloaded HTML file (file:// protocol).
- The Excel processing worker is now fully bundled into the app — no separate script files needed.
- In-app update checker now makes a single network request instead of duplicating on startup.
- Connection status bar accurately reflects when requests have completed.`,
  },
  {
    version: '1.4.6',
    date: '2026-05-15T00:00:00Z',
    type: 'fix',
    notes: `### Light mode polish
- Hover effects on buttons and table rows in light mode now use a warm brand-tinted highlight instead of dark gray.
- Selected/active text (sidebar nav, tabs, settings) is now a darker orange for better readability on light backgrounds.`,
  },
  {
    version: '1.4.5',
    date: '2026-05-13T00:00:00Z',
    type: 'feature',
    notes: `### Air-gap Mode & connection transparency
- A new status bar at the bottom of the app shows live outbound connection activity so you always know what's reaching out.
- Click the connection indicator to see a detailed log of every external request — URL, method, timestamp, and status.
- "Air-gap Mode" toggle fully blocks all outbound network calls when enabled, keeping the app completely offline.
- Fonts are now bundled directly into the app — no more loading from Google Fonts on every page load.
- The GitHub version check is skipped when Air-gap Mode is active.`,
  },
  {
    version: '1.4.0',
    date: '2026-05-13T00:00:00Z',
    type: 'feature',
    notes: `### PDF vs Excel cross-validation
- The reconciler now cross-checks PDF timesheets against Excel summaries and flags every discrepancy directly on billing rows.
- Hours mismatches, missing PDFs, unmatched employees, and allocation code conflicts are all surfaced as row-level flags.
- Unmapped allocation codes no longer silently disappear — they appear as $0 billing rows so nothing gets lost.
- Employees with Excel data but no PDF now get fallback billing rows distributed across the import period.
- The status bar shows separate error and warning counts in red and amber.
- The "Needs review" filter now captures all flagged rows alongside low-confidence ones.`,
  },
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

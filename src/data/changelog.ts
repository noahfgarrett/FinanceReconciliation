export interface ChangelogEntry {
  version: string
  date: string
  type: 'major' | 'feature' | 'fix'
  notes: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2.1',
    date: '2026-05-07T13:00:00Z',
    type: 'fix',
    notes: `### Heuristic tuning
- **Out-of-range hours now surface**: a 25-hour day or a 0.05-hour entry used to be silently dropped from parsing. They're kept and flagged at parse time with a strong red-dot confidence penalty so finance can vet them.
- **Real PDFs hit 100% confidence**: tax-profile codes like \`OH-NRES\` no longer compete with real allocation codes like \`FAB52-MEP-001\` for the multi-alloc penalty. When alloc candidates have unequal separator counts, the richer one wins outright.
- **High-OT anomaly fires earlier**: weeks exceeding 130% of the project's threshold now flag (e.g. 55 hours on a 40-hr-threshold project). Was previously calibrated for 200%, which almost never tripped.`,
  },
  {
    version: '1.2.0',
    date: '2026-05-07T16:00:00Z',
    type: 'major',
    notes: `### Real-data parser alignment
- **Excel parser** now correctly handles semicolon-separated project + allocation lists in single cells (each row = one employee's monthly summary).
- **PDF parser** recognizes "Week Ending: MM/DD/YYYY" headers (weekly Paycom timesheets), and now picks the per-row hours value rather than the per-day rollup.
- **Reconciler** cross-checks Excel ↔ PDF totals at the employee-month level (not per-project), since Excel exports don't include per-project breakdowns.
- "TOTAL:" summary lines in PDFs are now skipped during entry extraction.`,
  },
  {
    version: '1.1.0',
    date: '2026-05-06T18:00:00Z',
    type: 'feature',
    notes: `### Source verification
- Each parsed timesheet entry now has a **confidence score** (0–100%) and tracks its source bounding box on the original PDF.
- New **Confidence** column on the Spreadsheet view with green/amber/red dots; tooltip shows the score and the parser's reasoning when low.
- New **"Needs review"** quick-filter chip in the toolbar — filters to rows under 85% confidence.
- New **View source** button on the row drawer opens the original PDF inline with the source line(s) outlined in brand orange. Works offline since the original PDF bytes are stored locally.
- JSON exports remain compact: PDF bytes are stripped, only metadata + bounding boxes export.`,
  },
  {
    version: '1.0.2',
    date: '2026-05-06T15:00:00Z',
    type: 'fix',
    notes: `### Hover-lift no longer flashes
- Fixed the harsh white flash behind KPI tiles (and other ring + lift cards) when hovering in dark mode. The lift effect now uses a CSS filter drop-shadow that composes with the tile's ring instead of fighting it.
- Softened the dark-mode shadow palette overall now that surfaces sit on lifted charcoal — opacity reduced from 55–70% to 32–50%.`,
  },
  {
    version: '1.0.1',
    date: '2026-05-06T14:00:00Z',
    type: 'fix',
    notes: `### Dark mode lift
- Surfaces are noticeably lighter — closer to Claude desktop's warm charcoal range. Easier on the eyes during long review sessions.
- Fixed a CSS bridge bug where component backgrounds using the legacy hex literal weren't picking up the theme tokens (so previous attempts to lift the dark mode silently no-op'd on most cards/sidenav/modals). All surfaces now flow through the variable layer.`,
  },
  {
    version: '1.0.0',
    date: '2026-05-06T00:00:00Z',
    type: 'major',
    notes: `### Premium visual polish — v1.0
- Rebuilt theme on a proper CSS variable token system; both dark and light modes are now first-class
- Updated to authoritative LotusWorks brand colors (Lotus Orange #F47B20, Lotus Blue #0057A4)
- New typography pairing with display + body fonts and a proper type scale
- Motion system: page transitions, list reveals, hover-lift cards, polished modal entrances
- Every page polished: side nav, KPI strip, tables, drawers, modals, command palette, settings
- Refined empty states, hover states, focus rings throughout`,
  },
  {
    version: '0.9.0',
    date: '2026-05-06T06:00:00Z',
    type: 'major',
    notes: `### Real file parsers
- **Excel parser** with fuzzy header matching (Paycom may rename columns; we'll still find them)
- **PDF parser** with content-pattern heuristic — extracts employee header, pay period, daily entries, weekly totals from the text content of any Paycom timesheet, regardless of layout
- **Web Workers** keep the UI responsive while parsing (4 PDFs in parallel)
- **Drop your monthly Excel + PDF folder** to populate the app with real data
- "Load Sample Data" still works for evaluation without real files`,
  },
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

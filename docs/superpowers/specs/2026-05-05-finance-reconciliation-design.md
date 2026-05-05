# LotusWorks Finance Reconciliation — Design

**Status:** Approved (brainstorming phase) · **Date:** 2026-05-05 · **Author:** Noah Garrett (with Claude)

## 1. Purpose

A desktop web application for the LotusWorks Finance department that reconciles monthly Paycom timesheet exports against per-project overtime billing rules and produces client invoices. It replaces a manual workflow that involves cross-referencing an Excel summary against per-employee PDF timesheets and applying different OT thresholds per project (some clients bill OT after 40 hours/week, some after 50).

## 2. Goals & non-goals

### Goals
- Ingest one Excel monthly summary + a folder of per-employee biweekly Paycom PDF timesheets.
- Match PDFs to employees by Employee Code; resolve PDF allocation codes to project names.
- Recompute billable Regular / OT (and optional Double Time) per `(employee × project × week)` using **per-project, isolated** OT thresholds.
- Compute billable dollars per project per client using configurable rates.
- Produce four outputs: live on-screen views, branded per-client invoice PDFs, a structured Excel/CSV export, and a JSON snapshot for audit and cross-machine sync.
- Save and re-open monthly reconciliations as snapshots; lock submitted snapshots from edits.
- Run fully offline after first load; auto-update via a service worker when a new build is deployed.

### Non-goals (v1)
- Multi-currency / VAT / sales-tax computation
- Direct integration with QuickBooks, NetSuite, or other AR systems
- Email-invoice sending from inside the app
- Year-to-date dashboards or utilization analytics
- Multi-user collaboration, accounts, or auth
- Mobile / installable PWA experience
- The Reconcile tab's internal logic (placeholder only — designed once client-invoice samples are available)

## 3. Users & assumptions

- One user at a time on a single desktop machine; data shared between machines via JSON export/import.
- Inputs originate from Paycom (PDFs) and an internal monthly Excel export. Exact PDF table structure to be confirmed against a real sample during implementation.
- Approximate batch size: ~14 employees × ~3 projects × 4 weeks ≈ 168 weekly billing rows per month.

## 4. Architecture & stack

| Area | Choice |
|---|---|
| Build | Vite + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS with custom slate / orange / dark-blue token set |
| Icons | Lucide React (no emojis in shipped UI) |
| State | Zustand |
| PDF parsing | `pdfjs-dist` (in a Web Worker) |
| Excel parsing | `xlsx` (SheetJS) |
| Excel export | `exceljs` |
| PDF export | `pdf-lib` |
| Persistence | IndexedDB (thin wrapper) |
| Tables | TanStack Table + TanStack Virtual |
| Tests | Vitest + React Testing Library + Playwright |
| Deploy | Single-HTML build → GitHub Pages via `deploy-pages.sh` (mirrors `~/Codebase/Multitool/deploy-pages.sh`) |
| Updates | Service worker checks for new build on load; `UpdateModal` (adapted from `Multitool/src/App.tsx:52-115`) prompts reload with changelog tab |

No PWA manifest — the app is desktop-only, not installable.

## 5. Data model

```ts
// ===== Inputs (parsed) =====

interface Employee {
  code: string                    // primary key
  firstName: string
  lastName: string
  wwid?: string
}

interface ExcelRow {
  employeeCode: string
  laborAllocationDetails: string  // raw allocation code from Paycom
  projectName: string             // "Project Name Desc-Delete" — display name
  regularHours: number
  overtimeHours: number           // Paycom payroll OT (informational only)
  doubleTimeHours: number         // Paycom payroll DT (informational only)
  dateUpdated: string             // ISO date
}

interface PdfTimesheetEntry {
  date: string                    // ISO date for the day
  payCode: string
  allocation: string              // matches ExcelRow.laborAllocationDetails
  hoursTotal: number
  weekStart: string               // ISO Monday of the week the entry sits in
}

interface ParsedPdf {
  employeeCode: string            // parsed from "Employee: <name> <code>" header
  employeeName: string
  payPeriodStart: string
  payPeriodEnd: string
  entries: PdfTimesheetEntry[]
  weeklyTotals: Record<string, number>  // { "2026-04-06": 42.5, ... }
  rawText: string                 // kept for debugging / fallback
}

// ===== Configuration (persistent) =====

interface Client {
  id: string                      // uuid
  name: string
  address?: string
  contactEmail?: string
  paymentTerms: string            // default "Net 30"
  invoiceNumberPrefix?: string    // e.g. "ACME-"
  invoiceNumberCounter: number    // auto-incrementing
  remitTo?: string
  footerNotes?: string
}

interface ProjectConfig {
  projectKey: string              // canonical slug of displayName
  displayName: string
  clientId?: string               // optional link to a Client; null = "ungrouped"
  poNumber?: string
  allocationAliases: string[]     // raw allocation codes mapping to this project
  otThresholdHrs: number          // per week
  includeDoubleTime: boolean      // default false
  dtThresholdHrs?: number         // only when includeDoubleTime = true
  defaultRegularRate: number      // dollars/hr
  otRateOverride?: number         // default = 1.5 × defaultRegularRate
  dtRateOverride?: number         // default = 2 × defaultRegularRate
  employeeRateOverrides: Record<string, EmployeeRateOverride>
}

interface EmployeeRateOverride {
  regularRate?: number
  otRate?: number
  dtRate?: number
}

// ===== Computed (per snapshot) =====

interface RowFlag {
  severity: 'info' | 'warn' | 'error'
  code:
    | 'unmatched-pdf'
    | 'missing-pdf'
    | 'project-not-configured'
    | 'excel-pdf-hours-mismatch'
    | 'high-ot-anomaly'
    | 'pdf-entry-missing-approval'
    | 'allocation-not-mapped'
    | 'parse-failure'
  message: string
  context?: Record<string, unknown>
}

interface WeeklyBilling {
  employeeCode: string
  projectKey: string
  weekStart: string               // ISO Monday
  hours: number
  regularHrs: number
  otHrs: number
  dtHrs: number
  regularDollars: number
  otDollars: number
  dtDollars: number
  flags: RowFlag[]
  notes?: string
  reviewed: boolean
}

interface AuditEvent {
  ts: string                      // ISO timestamp
  action:
    | 'snapshot-created'
    | 'snapshot-locked'
    | 'snapshot-unlocked'
    | 'project-config-edited'
    | 'employee-rate-overridden'
    | 'invoice-generated'
    | 'flag-resolved'
    | 'manual-edit'
  detail: string
  before?: unknown
  after?: unknown
}

interface Snapshot {
  id: string
  name: string                    // e.g. "April 2026 — saved 5/2/26"
  periodLabel: string             // "April 2026"
  createdAt: string
  lastModifiedAt: string
  locked: boolean
  isDraft: boolean                // auto-saved working draft
  employees: Employee[]
  excelRows: ExcelRow[]
  parsedPdfs: ParsedPdf[]
  projectConfigsAtSave: Record<string, ProjectConfig>  // frozen copy
  clientsAtSave: Record<string, Client>                // frozen copy
  weeklyBilling: WeeklyBilling[]
  warnings: RowFlag[]
  auditLog: AuditEvent[]
}

// ===== Top-level persistent state =====

interface PersistentState {
  schemaVersion: number
  clients: Record<string, Client>
  projectConfigs: Record<string, ProjectConfig>
  snapshots: Snapshot[]
  theme: 'dark' | 'light'
  recentImports: { excelName?: string; folderName?: string; ts: string }[]
}
```

### Key model decisions
- **`projectKey`** is a slug derived from `displayName` (e.g. `"Project Acme — Phase 2"` → `"project-acme-phase-2"`). Survives small label tweaks via fuzzy match on import; ambiguous matches resolved through a Project Mapping modal.
- **OT calculation is per `(employee × project × week)`**, isolated. Project A's hours are tested against Project A's threshold only; Project B's against B's. No cross-project allocation.
- **Excel's OT/DT columns are informational only.** Billing OT/DT is recomputed from PDF weekly totals against per-project thresholds.
- **Snapshots freeze configuration** at save time via `projectConfigsAtSave` / `clientsAtSave`, so historical reads are deterministic even after later edits.
- **Audit log is append-only per snapshot** — supports self-audit without versioning machinery.

## 6. Information architecture

### Side navigation

| Section | Page | Purpose |
|---|---|---|
| Workspace | Billing Hours | Main reconciliation view |
| | Reconcile *(stub)* | Compare client invoice vs. our timesheets — placeholder until samples exist |
| Configuration | Projects | Project + client management, OT thresholds, rates |
| | Settings | Theme, app preferences, version, changelog |
| Output | Exports | PDF invoices, Excel report, JSON snapshot/settings/all |
| History | Snapshots | List of saved months; click to re-open read-only |

### Billing Hours page
- **Empty state**: drop zone for Excel + PDF folder; recent imports list; "Load sample data" link
- **Populated header**: snapshot name, period label, action buttons (Re-import, Generate Invoices, Save Snapshot, Lock)
- **KPI strip**: Total Billable · Regular $ · OT $ · Project count, with period-over-period delta against a chosen prior snapshot
- **Round-trip totals banner** when by-project / by-employee / spreadsheet sums diverge
- **Tabbed views**:
  1. **By Project** — one row per project, totals + threshold chip + drill-down
  2. **By Employee** — one row per employee, expand for project/week breakdown
  3. **By Week** — one row per ISO week, totals across all projects
  4. **Spreadsheet** — flat virtualized table; one row per `(employee × project × week)`; full feature set below
- **Right drawer** on row click: source PDF entries, flag list, notes, "Mark reviewed" toggle

### Spreadsheet view feature set
- Virtualized rows (TanStack Virtual)
- Sticky header + sticky first column on horizontal scroll
- Density toggle (Compact / Normal / Comfortable)
- Column resize, reorder (drag), pin left/right, show/hide menu
- Multi-column sort (shift-click), per-column filter row, global fuzzy search
- Quick-filter chips: Flagged only · Errors only · Has OT · By project
- Saved filter/sort presets ("Views") per snapshot
- Group-by (Project / Employee / Week) with collapsible subtotals
- Footer row aggregates over visible filtered rows
- Row-level severity tinting; flag chips column with hover-explain tooltips
- Multi-select + bulk dismiss / mark reviewed / copy / export-selection
- Inline editing for per-employee rate override and notes
- Keyboard: arrows, `Enter` drill, `F` flag-filter, `/` search, `?` cheat sheet
- "Export current view" → CSV/Excel respects active filters/sort/visibility

### Projects page
- Table of all projects + a config drawer per project
- Fields: display name, client link, PO number, allocation aliases (multi-value), OT threshold, Include DT toggle, DT threshold, Regular rate, OT rate (auto-1.5× shown if not overridden), DT rate (auto-2×), per-employee rate overrides table

### Clients page (under Projects)
- List of clients; click to edit name, address, contact, payment terms, invoice prefix, remit-to, footer notes
- Live invoice preview inside the drawer

### Exports page
- Generate PDF Invoices (one per client)
- Export Spreadsheet (.xlsx, branded, tab per project + Summary)
- Save Snapshot (also inline on Billing Hours)
- Export → JSON: All / Settings only / History only
- Import → JSON

### History page
- Table of snapshots: name, period, created, status (Draft / Saved / Locked)
- Right-click: Open · Duplicate (for "what-if") · Rename · Delete
- Compare-to selector for period-over-period view

## 7. Data flow

```
IMPORT
  ↓ user drops Excel + PDF folder
PARSE (Web Workers)
  ↓ excelParser.ts → ExcelRow[] + Employee[]
  ↓ pdfParser.ts   → ParsedPdf[] (header + table extraction; weekly groupings)
RECONCILE (pure functions)
  1. Match PDFs ↔ Excel employees by code → unmatched-pdf / missing-pdf flags
  2. Resolve allocation codes → projectKey (Project Mapping modal if unknown)
  3. Build (employee × project × week) totals from PDF entries
  4. Cross-check vs Excel monthly project totals → excel-pdf-hours-mismatch flag
  5. Apply per-project OT thresholds → split reg/OT/DT
  6. Apply rates → compute dollars
  7. Anomaly detection (e.g. OT > 200% of threshold) → high-ot-anomaly flag
  ↓ WeeklyBilling[] with flags[]
STATE (Zustand)
  currentSnapshot · projectConfigs · clients · uiState
  ↓
UI VIEWS · PERSISTENCE (IndexedDB) · EXPORT (PDF / xlsx / JSON)
```

### Recompute triggers
- New file imported → full pipeline
- Project threshold/rate edited → reconciler steps 5–7 only
- Per-employee override added → steps 6–7 only
- Snapshot loaded from history → no recompute, hydrate frozen `weeklyBilling[]`

### Auto-save
- Any config change while a snapshot is in-progress writes to a "Draft (April 2026)" snapshot in IndexedDB. Closing the tab never loses work. User explicitly converts the draft to a saved snapshot via "Save Snapshot".

### Re-imports
- Hard-replace the current snapshot's parsed inputs but **merge** project configs and per-employee rate overrides — overrides survive re-imports.

## 8. Validation, errors, edge cases

- Inputs validated at boundaries with Zod (`src/parsers/schemas.ts`). Schema failure → row-level warning, never a thrown exception.
- Numeric guards: hours ∈ [0, 168]/wk; rates ∈ [0, 10000]; thresholds ∈ [1, 168]/wk.
- JSON import is fully schema-validated and version-stamped; older versions hit a migration step.
- Top-level error boundary with copy-to-clipboard error report (stack + last 20 audit events).
- Worker boundary returns a typed `Result<T, ParserError>` discriminated union — never throws across.
- Toasts for transient feedback; sticky banners for important warnings; modals only for blocking decisions.
- All async ops use `AbortController` so navigation cancels cleanly.
- Malformed PDFs are skipped with a `parse-failure` flag — they don't kill the batch.
- Re-imports never silently overwrite a locked snapshot.

## 9. Quality-of-life features

In the must-have v1 set:

1. Client wrapper around projects (one invoice covering multiple projects per client)
2. PO number per project, on the invoice header
3. Snapshot lock with confirm-to-unlock
4. Audit trail per snapshot
5. Round-trip totals check banner
6. Period-over-period KPI deltas
7. Customizable invoice template per client (terms, footer, remit-to, numbering scheme)
8. Locale-aware number formatting; tabular-nums in tables
9. Search by employee name and code (fuzzy)
10. Recent imports surfaced on empty state
11. Auto-save working draft (no work lost on close)
12. Keyboard shortcuts: ⌘S save · ⌘E export · ⌘K command palette · `/` search · `F` flag-filter · `?` cheat sheet
13. Inline flag explainer tooltips
14. Print-friendly invoice preview before PDF generation
15. Snapshot clone for "what-if" scenarios
16. Empty-state guidance + sample data button

Deferred: multi-currency, VAT/sales tax, multi-org, email-invoice integration, YTD dashboards, utilization metrics.

## 10. Visual design

- **Theme**: premium dark by default — slate `#020617` page, panels `#0a0f1c`, borders `#1e293b`, body text `#cbd5e1`, headings `#f1f5f9`
- **Accent**: orange `#f97316` for primary actions and active nav; secondary dark blue undertone
- **Light mode**: warm-gray variant with the same accent set; toggleable in Settings; user preference persisted
- **Typography**: Inter (system fallback), tight letter-spacing on headings, tabular-nums in numeric columns
- **Components**: card-style panels with 12px radii, subtle 1px borders, 24px–32px padding; gradient-backed brand mark; status pill in side-nav footer (green dot = up to date, orange = update available)
- **Iconography**: Lucide React stroke icons throughout

Polish (exact tokens, motion, micro-interactions) is delegated to the implementation phase — `/frontend-design` and `/impeccable` skills will be invoked then.

## 11. Project structure

```
FinanceReconciliation/
├── Assets/                          # LotusWorks logo
├── docs/superpowers/specs/          # this design doc + future specs
├── public/                          # static assets
├── src/
│   ├── App.tsx
│   ├── store/                       # snapshotStore, projectStore, uiStore
│   ├── parsers/                     # excelParser, pdfParser, workers/, schemas
│   ├── reconciler/                  # reconcile, otCalculator, flags + tests
│   ├── persistence/                 # idb wrapper, migrations, jsonExport
│   ├── pages/
│   │   ├── BillingHours/
│   │   │   ├── BillingHoursPage.tsx
│   │   │   ├── views/ {ByProject, ByEmployee, ByWeek, Spreadsheet}.tsx
│   │   │   ├── KpiStrip.tsx
│   │   │   └── DropZone.tsx
│   │   ├── Projects/
│   │   ├── Settings/
│   │   ├── Exports/
│   │   ├── History/
│   │   └── Reconcile/               # stub
│   ├── components/
│   │   ├── nav/SideNav.tsx
│   │   ├── ui/                      # buttons, badges, inputs, modal primitives
│   │   ├── UpdateModal.tsx
│   │   └── ProjectMappingModal.tsx
│   ├── exports/
│   │   ├── invoicePdf.ts
│   │   ├── workbookExport.ts
│   │   └── jsonSnapshot.ts
│   ├── theme/
│   └── lib/                         # date utils, format utils, weekStart helper
├── e2e/
├── sw.js
├── deploy-pages.sh
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 12. Testing

- **Unit (Vitest)** for reconciler and parsers — pure functions, golden fixtures of anonymized PDFs/Excel in `test/fixtures/`
- **Component (Vitest + RTL)** for spreadsheet view, project config drawer, update modal
- **E2E (Playwright)** mirroring Multitool's setup — happy path: drop sample → review → save snapshot → export invoice → reload → snapshot still there
- **Visual regression** screenshots: empty state, populated state, one rendered invoice
- **CI gates**: `tsc --noEmit` and `eslint` blocking

## 13. Distribution & updates

- `npm run build` produces a single `Reconciler.html` file (mirrors Multitool's `mv dist/index.html dist/Multitool.html`)
- `deploy-pages.sh` (cloned and adapted from `~/Codebase/Multitool/deploy-pages.sh`) deploys to GitHub Pages on the `gh-pages` branch
- Service worker (`sw.js`) caches all static assets for offline use
- On page load: SW checks for new build; if found, dispatches `UPDATE_AVAILABLE`; `UpdateModal` (adapted from `Multitool/src/App.tsx:108-115`) prompts reload with a Changelog tab visible

## 14. Open items deferred to writing-plans

- Exact PDF parsing strategy (regex vs column-anchor vs hybrid) — needs a real sample PDF
- Concrete Tailwind token values for dark/light themes — produced during implementation polish phase
- Sample data fixtures — built from a real anonymized Excel + PDF pair
- Reconcile tab logic — designed when client-invoice samples are available

## 15. Out of scope explicitly

- Mobile / PWA / installable experience
- Multi-currency, tax computation, year-to-date analytics, utilization metrics
- Direct AR-system integrations
- Multi-user, accounts, auth, sharing
- Email-invoice send from inside the app

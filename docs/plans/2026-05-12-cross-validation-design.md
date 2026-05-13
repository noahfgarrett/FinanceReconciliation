# Cross-Validation: PDF vs Excel Discrepancy Detection

**Date:** 2026-05-12
**Status:** Design approved, ready for implementation

## Problem

The reconciler imports both Excel summaries and PDF timesheets but only uses PDF data for weekly hour breakdowns and Excel data for monthly totals. When the two sources disagree — hour mismatches, missing files, wrong allocation codes — the discrepancies are either silently dropped or stored as top-level import warnings that never reach the user in the Spreadsheet view.

In stress testing with 15 deliberate conflict scenarios, only 4 were surfaced to the user. Finance needs to see every discrepancy so they can follow up directly with the person and determine the correct billing hours.

## Design

### Checks

Four cross-validation checks, all producing row-level flags on `WeeklyBilling` rows:

| Check | Flag code | Severity | Badge text | Tooltip |
|-------|-----------|----------|------------|---------|
| PDF total hours != Excel total hours for an employee | `excel-pdf-hours-mismatch` | warn | `hours mismatch` | "PDF total: {X} hr · Excel total: {Y} hr · Δ {Z} hr" |
| Employee in Excel but no PDF imported | `missing-pdf` | error | `no pdf` | "No PDF timesheet found — hours are from Excel only" |
| Employee in PDFs but not in Excel | `unmatched-pdf` | error | `no excel` | "This employee appears in PDFs but not in the Excel export" |
| PDF allocation code differs from Excel | `allocation-not-mapped` | warn | `alloc mismatch` | "PDF allocation: {X} · Excel allocation: {Y}" |

### Architecture

All changes are in `src/reconciler/reconcile.ts`. No new files, components, or dependencies.

#### Step 1 — Per-employee cross-validation map

After the existing cross-check loop (lines 156-177), build a `Map<string, RowFlag[]>` keyed by employee code. This collects all cross-validation warnings that should be promoted from top-level to row-level:

- **Hours mismatch:** Already computed at lines 156-177. Add the flag to the map for that employee code.
- **Missing PDF:** Already computed at lines 76-98. Add to map.
- **Unmatched PDF:** Already computed at lines 66-73. Add to map.

#### Step 2 — Stop dropping unresolved allocations

At line 130, entries with unresolvable allocation codes currently `continue`, skipping bucket creation. Change this to:

1. Create the bucket with a sentinel project key (e.g., `__unmapped__`).
2. Record an `allocation-not-mapped` flag in the per-employee map.
3. The resulting `WeeklyBilling` row gets $0 rates and the flag badge tells Finance to fix the project mapping.

This ensures no data is silently lost. Finance sees the row and decides what to do.

#### Step 3 — Attach flags during WeeklyBilling creation

In the loop at lines 179-249 where `WeeklyBilling` rows are built from buckets: look up the employee code in the cross-validation map and spread any matching flags into that row's `flags` array alongside existing flags (`high-ot-anomaly`, `no-bill-rate`, etc.).

#### Step 4 — Keep top-level warnings

Don't remove cross-validation warnings from `ReconcileOutput.warnings`. They're still used for the import status message ("X warning(s)"). The row-level copies are additive.

### Flag count with severity breakdown

**Spreadsheet status bar** (`SpreadsheetToolbar.tsx`, line 247-254):

Currently shows: `124 rows · 13 flagged · $450,453 visible`

Change to split by severity: `124 rows · 5 errors · 8 warnings · $450,453 visible`

- "errors" in red text (`text-red-400`) — counts rows with any `severity: 'error'` flag
- "warnings" in amber text (`text-amber-400`) — counts rows with `severity: 'warn'` flags (but no errors)
- Either count hidden when zero

**Import completion message** (`ImportFlow.tsx`, lines 357-362):

Currently shows: `Imported 34 PDFs, 34 Excel rows — Apr 2026. 5 warning(s).`

Change to: `Imported 34 PDFs, 34 Excel rows — Apr 2026. 3 errors, 2 warnings.`

### Spreadsheet display

No new UI components needed. Cross-validation flags use the existing rendering:

- **Badge in CONF column:** Same `FlagChips` component, same color logic (red for error, amber for warn).
- **Row background tint:** Already tints by max severity — error rows get red tint, warn rows get amber.
- **Filters:** "Flagged only" already filters on `flags.length > 0`. "Errors only" already filters on `severity === 'error'`. Both will pick up cross-validation flags automatically.
- **Multiple flags per row:** Already supported. An employee can have both `hours mismatch` and `alloc mismatch` on the same row (e.g., S15 Gregory Hall).

### What this does NOT cover

- **Editing or resolving discrepancies in-app.** Finance investigates offline and follows up with the person directly. The app only surfaces the issue.
- **OT discrepancy detection.** OT threshold differences between Paycom (always 40 hrs) and client contracts (configurable per project) are already handled correctly by the billing engine's `splitWeekHours()` function. This is a billing concern, not a cross-validation concern.
- **Client invoice reconciliation.** Comparing internal billing data against client invoices (S12, S13 scenarios) is a separate feature behind the "Reconcile" page, which is still Coming Soon.

## Files to modify

| File | Change |
|------|--------|
| `src/reconciler/reconcile.ts` | Promote top-level warnings to row-level flags; stop skipping unmapped allocations; build per-employee flag map |
| `src/pages/BillingHours/Spreadsheet/SpreadsheetView.tsx` | Split `flaggedCount` into error count and warning count |
| `src/pages/BillingHours/Spreadsheet/SpreadsheetToolbar.tsx` | Render separate error/warning counts with appropriate colors |
| `src/components/ImportFlow.tsx` | Split import status message by severity |

## Testing

Re-run the 35-employee stress test dataset. Expected results for previously-missed scenarios:

| Scenario | Expected flag |
|----------|--------------|
| S1: Marcus Johnson (PDF +8 hrs) | `hours mismatch` — "PDF: 168 hr · Excel: 160 hr · Δ 8 hr" |
| S2: Patricia Davis (no PDF) | `no pdf` on all 4 weekly rows |
| S3: Robert Wilson (wrong alloc in PDF) | `alloc mismatch` — "PDF: UNKNOWN-PRJ-999 · Excel: FAB52-UTL-003" |
| S5: William Anderson (rounding) | `hours mismatch` — "PDF: 161 hr · Excel: 160 hr · Δ 1 hr" |
| S6: Elizabeth Taylor (extra OT in PDF) | `hours mismatch` — PDF total includes OT that Excel doesn't show |
| S14: Nicole Robinson (ghost employee) | `no excel` on all 4 weekly rows |
| S15: Gregory Hall (multi-conflict) | `hours mismatch` + `alloc mismatch` stacked |

Target: **11 of 11 testable scenarios flagged** (up from 5).

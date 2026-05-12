# Onboarding Flow & Employee Database Design

**Date:** 2026-05-12
**Status:** Approved

## Problem

Finance users importing Paycom timesheets have no guided setup for projects and employees. Projects bootstrap silently with $0 rates, employees aren't persisted between sessions, and there's no way to bulk-load configuration or share it between team members.

## Solution

1. Elevate employees to a first-class local database with profiles and bill rates
2. Unified onboarding wizard on import that detects new projects/employees and prompts for configuration
3. CSV + JSON import/export for bulk setup and team sharing
4. Conflict review modal for safe merging of imported data

---

## Data Model

### EmployeeProfile (new IDB store: `employees`)

```ts
interface EmployeeProfile {
  code: string              // primary key, from Paycom
  firstName: string
  lastName: string
  defaultBillRate: number   // $/hr fallback when no project override
  jobTitle?: string
  notes?: string
  createdAt: string         // ISO
  lastModifiedAt: string    // ISO
}
```

### ProjectConfig — no new fields

Existing schema already has `defaultRegularRate`, `otThresholdHrs`, `allocationAliases`, `employeeRateOverrides`. No changes needed.

### Rate Cascade (most specific wins)

```
1. ProjectConfig.employeeRateOverrides[code].regularRate
2. EmployeeProfile.defaultBillRate
3. ProjectConfig.defaultRegularRate
4. $0.00 + "no-bill-rate" warning
```

Same cascade for OT/DT rates with standard multipliers (1.5x OT, 2x DT) when no explicit override.

### IDB Migration

Bump DB version to 2. Add `employees` object store. Backfill from existing snapshot employee arrays.

### Snapshot Changes

Add `employeesAtSave: Record<string, EmployeeProfile>` alongside existing `projectConfigsAtSave` so historical billing is never affected by later profile edits.

---

## Onboarding Wizard

### Trigger

After file parsing, before reconciliation. `importBatch()` compares parsed project names and employee codes against existing stores. If any are new, wizard opens.

### Step 1 — New Projects

Table with inline editable fields per project:
- Display name (pre-filled from Excel)
- Default bill rate ($)
- OT threshold (default 40 hrs)
- Allocation codes (pre-populated from PDF matches)
- "Use defaults for all & skip" button

Replaces both `bootstrapProjectsFromExcel()` and `ProjectMappingModal`.

### Step 2 — New Employees

Table with inline editable fields per employee:
- Code + name (read-only, from Paycom)
- Job title (optional)
- Default bill rate (blank = fall back to project rate)
- Per-project override column (optional)
- "Use defaults for all & skip" button

### Step 3 — Review & Reconcile

- Summary: "3 projects configured, 12 employees created"
- Rate cascade preview for sample rows
- "Save & Reconcile" button

### No new data = no wizard

Import proceeds silently as today.

---

## Employee Management Page

### Location

New sidebar route under CONFIGURATION, alongside Projects.

### List View

Table: Employee Code, Name, Default Bill Rate, Job Title, # Project Overrides, Last Modified. Sortable, searchable, filterable.

### Profile Drawer

- Read-only: code, name (unlock to edit)
- Editable: default bill rate, job title, notes
- Project rate overrides section with links to project configs
- Last-modified timestamp

### Toolbar

- Add Employee (manual entry)
- Import CSV
- Export (CSV or JSON)
- Download Template

---

## CSV Import & JSON Sync

### CSV Formats

**Projects:**
```
projectName, defaultBillRate, otThresholdHrs, dtEnabled, dtThresholdHrs, allocationCodes
"FAB52 MEP", 85.00, 40, false, , "FAB52-MEP-001;FAB52-MEP-002"
```

**Employees:**
```
employeeCode, firstName, lastName, defaultBillRate, jobTitle
"EMP1234", "John", "Smith", 75.00, "Electrician"
```

Fuzzy header matching. Semicolons for multi-values. Extra columns ignored.

### JSON Bundle

New export scope `"setup"` bundles `projectConfigs + employees + clients`. Extends existing `jsonExport.ts`.

### Import Locations

- Settings page: Import Configuration (JSON)
- Projects page: Import CSV
- Employees page: Import CSV
- Download Template buttons alongside each import

---

## Conflict Review Modal

### Trigger

CSV or JSON import contains records matching existing data by primary key.

### Layout

Diff table — left column "Current", right column "Incoming". Changed fields in amber, unchanged dimmed. Name mismatches on employee codes get red warning badge.

### Actions

- Per-row: Accept (overwrite) or Keep (preserve local)
- Per-field: cherry-pick individual changes
- Bulk: "Accept All Changes" / "Keep All Current"
- Count badge: "7 conflicts, 23 unchanged"

### No Conflicts

Import completes silently with success toast.

---

## Reconciler Warning Flags

| Flag | Severity | Condition |
|------|----------|-----------|
| `no-bill-rate` | Red | Hit cascade level 4, nothing configured |
| `using-project-default` | Info | No employee rate, fell back to project |
| `rate-mismatch` | Amber | Employee default vs project override differ >20% |
| `zero-rate` | Amber | Rate explicitly set to $0.00 |

---

## Implementation Sequence

1. **Data layer** — IDB v2 migration, EmployeeProfile schema, CRUD, Zustand store, backfill
2. **Employee Management Page** — list, drawer, add/edit/delete
3. **Unified Onboarding Wizard** — replace bootstrap + mapping modal, 3-step wizard
4. **Rate cascade** — reconciler update, new warnings, unit tests
5. **CSV import/export** — templates, parser, JSON setup scope
6. **Conflict Review Modal** — diff table, per-field toggles, bulk actions
7. **Integration testing** — real file import, end-to-end verification

---

## Testing Strategy

- Unit tests for rate cascade (every level, every edge case)
- Unit tests for CSV parsing (fuzzy headers, missing fields, malformed data)
- Unit tests for conflict detection (match by code, name mismatch flag)
- Integration test: full import → wizard → reconcile → verify billing amounts
- E2E: import real Paycom files, configure rates, verify output

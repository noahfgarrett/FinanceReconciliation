import type { EmployeeProfile, ProjectConfig } from '@/persistence/schemas'
import { slugifyProjectName } from '@/reconciler/projectMatching'

/* ── Shared conflict types ────────────────────────────────────────────── */

export interface ConflictField {
  key: string
  label: string
  currentValue: string | number | undefined
  incomingValue: string | number | undefined
  accept: boolean // true = use incoming, false = keep current
}

export interface ConflictRecord {
  id: string // employee code or project key
  label: string // display name
  fields: ConflictField[]
  hasNameMismatch: boolean
  nameWarning?: string
}

export interface ResolvedConflict {
  id: string
  resolvedFields: Record<string, string | number | undefined>
}

export interface ImportConflictResult<T> {
  newRecords: T[]
  conflicts: ConflictRecord[]
  unchangedCount: number
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function fieldChanged(
  current: string | number | undefined,
  incoming: string | number | undefined,
): boolean {
  const norm = (v: string | number | undefined): string =>
    v === undefined || v === null ? '' : String(v)
  return norm(current) !== norm(incoming)
}

function makeField(
  key: string,
  label: string,
  currentValue: string | number | undefined,
  incomingValue: string | number | undefined,
): ConflictField {
  return {
    key,
    label,
    currentValue,
    incomingValue,
    accept: true, // default to incoming
  }
}

/* ── Employee conflict detection ──────────────────────────────────────── */

export function detectEmployeeConflicts(
  incoming: Array<Partial<EmployeeProfile> & { code: string }>,
  existing: Record<string, EmployeeProfile>,
): ImportConflictResult<EmployeeProfile> {
  const newRecords: EmployeeProfile[] = []
  const conflicts: ConflictRecord[] = []
  let unchangedCount = 0

  for (const inc of incoming) {
    const ex = existing[inc.code]
    if (!ex) {
      // New record — build a full EmployeeProfile with defaults
      const now = new Date().toISOString()
      newRecords.push({
        code: inc.code,
        firstName: inc.firstName ?? '',
        lastName: inc.lastName ?? '',
        defaultBillRate: inc.defaultBillRate ?? 0,
        jobTitle: inc.jobTitle,
        notes: inc.notes,
        createdAt: now,
        lastModifiedAt: now,
      })
      continue
    }

    // Compare fields
    const fields: ConflictField[] = []
    const compareKeys: Array<{
      key: keyof EmployeeProfile
      label: string
    }> = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'defaultBillRate', label: 'Default Bill Rate' },
      { key: 'jobTitle', label: 'Job Title' },
    ]

    for (const { key, label } of compareKeys) {
      const currentVal = ex[key]
      const incomingVal = inc[key]
      // Only include if incoming value is provided (not undefined)
      if (incomingVal !== undefined && fieldChanged(currentVal, incomingVal)) {
        fields.push(makeField(key, label, currentVal, incomingVal))
      }
    }

    if (fields.length === 0) {
      unchangedCount++
      continue
    }

    // Check for name mismatch
    const hasNameMismatch =
      (inc.firstName !== undefined && fieldChanged(ex.firstName, inc.firstName)) ||
      (inc.lastName !== undefined && fieldChanged(ex.lastName, inc.lastName))

    let nameWarning: string | undefined
    if (hasNameMismatch) {
      const currentName = `${ex.firstName} ${ex.lastName}`.trim()
      const incomingName = `${inc.firstName ?? ex.firstName} ${inc.lastName ?? ex.lastName}`.trim()
      nameWarning = `Code ${inc.code} is '${currentName}' locally but '${incomingName}' in import`
    }

    conflicts.push({
      id: inc.code,
      label: `${ex.firstName} ${ex.lastName}`,
      fields,
      hasNameMismatch,
      nameWarning,
    })
  }

  return { newRecords, conflicts, unchangedCount }
}

/* ── Project conflict detection ───────────────────────────────────────── */

export function detectProjectConflicts(
  incoming: Array<Partial<ProjectConfig> & { displayName: string }>,
  existing: Record<string, ProjectConfig>,
): ImportConflictResult<ProjectConfig> {
  const newRecords: ProjectConfig[] = []
  const conflicts: ConflictRecord[] = []
  let unchangedCount = 0

  for (const inc of incoming) {
    const key = slugifyProjectName(inc.displayName)
    const ex = existing[key]

    if (!ex) {
      newRecords.push({
        projectKey: key,
        displayName: inc.displayName,
        defaultRegularRate: inc.defaultRegularRate ?? 0,
        otThresholdHrs: inc.otThresholdHrs ?? 40,
        includeDoubleTime: inc.includeDoubleTime ?? false,
        allocationAliases: inc.allocationAliases ?? [],
        employeeRateOverrides: inc.employeeRateOverrides ?? {},
        clientId: inc.clientId,
        poNumber: inc.poNumber,
        dtThresholdHrs: inc.dtThresholdHrs,
        otRateOverride: inc.otRateOverride,
        dtRateOverride: inc.dtRateOverride,
      })
      continue
    }

    const fields: ConflictField[] = []

    if (fieldChanged(ex.displayName, inc.displayName)) {
      fields.push(makeField('displayName', 'Display Name', ex.displayName, inc.displayName))
    }
    if (
      inc.defaultRegularRate !== undefined &&
      fieldChanged(ex.defaultRegularRate, inc.defaultRegularRate)
    ) {
      fields.push(
        makeField(
          'defaultRegularRate',
          'Default Regular Rate',
          ex.defaultRegularRate,
          inc.defaultRegularRate,
        ),
      )
    }
    if (inc.otThresholdHrs !== undefined && fieldChanged(ex.otThresholdHrs, inc.otThresholdHrs)) {
      fields.push(
        makeField('otThresholdHrs', 'OT Threshold (hrs)', ex.otThresholdHrs, inc.otThresholdHrs),
      )
    }

    // Compare allocationAliases as semicolon-joined strings
    const currentAliases = ex.allocationAliases.join('; ')
    const incomingAliases = (inc.allocationAliases ?? []).join('; ')
    if (inc.allocationAliases !== undefined && fieldChanged(currentAliases, incomingAliases)) {
      fields.push(
        makeField('allocationAliases', 'Allocation Aliases', currentAliases, incomingAliases),
      )
    }

    if (fields.length === 0) {
      unchangedCount++
      continue
    }

    conflicts.push({
      id: key,
      label: ex.displayName,
      fields,
      hasNameMismatch: false,
    })
  }

  return { newRecords, conflicts, unchangedCount }
}

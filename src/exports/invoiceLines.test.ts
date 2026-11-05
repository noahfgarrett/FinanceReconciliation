import { describe, it, expect } from 'vitest'
import type { Client, ProjectConfig, Snapshot } from '@/persistence/schemas'
import { reconcile } from '@/reconciler/reconcile'
import { buildInvoiceLines, invoiceTotals } from './invoiceLines'

const client: Client = { id: 'c1', name: 'Client One', paymentTerms: 'Net 30', invoiceNumberCounter: 0 }

const acme: ProjectConfig = {
  projectKey: 'project-acme',
  displayName: 'Project Acme',
  allocationAliases: ['ACM'],
  otThresholdHrs: 40,
  includeDoubleTime: false,
  defaultRegularRate: 100,
  // Employee 2001 bills at a negotiated rate on this project
  employeeRateOverrides: { '2001': { regularRate: 130 } },
  clientId: 'c1',
}

function snapshotFor(hoursByEmployee: Record<string, number>): Snapshot {
  const codes = Object.keys(hoursByEmployee)
  const employees = codes.map((code) => ({ code, firstName: 'E', lastName: code }))
  const parsedPdfs = codes.map((code) => ({
    employeeCode: code,
    employeeName: `E ${code}`,
    payPeriodStart: '2026-04-06',
    payPeriodEnd: '2026-04-12',
    entries: [{
      date: '2026-04-06', payCode: 'REG', allocation: 'ACM', hoursTotal: hoursByEmployee[code],
      weekStart: '2026-04-06', confidence: 1, confidenceReasons: [],
    }],
    weeklyTotals: { '2026-04-06': hoursByEmployee[code] },
    rawText: '',
    pageCount: 1,
  }))
  const excelRows = codes.map((code) => ({
    employeeCode: code, projectNames: ['Project Acme'], allocations: ['ACM'],
    regularHours: hoursByEmployee[code], overtimeHours: 0, doubleTimeHours: 0, dateUpdated: '2026-04-30',
  }))
  const out = reconcile({ employees, excelRows, parsedPdfs, projectConfigs: { 'project-acme': acme } })
  return {
    id: 's1', name: 'Draft', periodLabel: 'Apr 2026', createdAt: '', lastModifiedAt: '',
    locked: false, isDraft: true, employees, excelRows, parsedPdfs,
    projectConfigsAtSave: { 'project-acme': acme }, clientsAtSave: { c1: client }, employeesAtSave: {},
    weeklyBilling: out.weeklyBilling, warnings: out.warnings, auditLog: [],
  }
}

const cents = (n: number): number => Math.round(n * 100)

describe('buildInvoiceLines', () => {
  it('every line multiplies out when an employee has an override rate', () => {
    const snapshot = snapshotFor({ '2000': 45, '2001': 45 })
    const lines = buildInvoiceLines({
      snapshot, projectKeys: ['project-acme'], configs: { 'project-acme': acme },
    })

    for (const l of lines) {
      const computed = l.regHrs * l.regRate + l.otHrs * l.otRate + l.dtHrs * l.dtRate
      expect(cents(computed)).toBe(cents(l.total))
    }

    // Lines add up to the billing rows: 40×100 + 5×150 + 40×130 + 5×150 (OT falls back to 1.5× the project rate)
    const billed = snapshot.weeklyBilling.reduce(
      (s, r) => s + r.regularDollars + r.otDollars + r.dtDollars, 0,
    )
    expect(billed).toBe(10700)
    expect(cents(lines.reduce((s, l) => s + l.total, 0))).toBe(cents(billed))

    // Two lines: the override rate and the project default
    expect(lines.map((l) => l.regRate)).toEqual([130, 100])

    // Invoice totals come from the printed lines
    const totals = invoiceTotals(lines)
    expect(totals).toEqual({ regular: 9200, overtime: 1500, doubleTime: 0, total: 10700 })
  })

  it('keeps one line per project when everyone bills at the same rate', () => {
    const snapshot = snapshotFor({ '2000': 45, '2002': 38 })
    const lines = buildInvoiceLines({
      snapshot, projectKeys: ['project-acme'], configs: { 'project-acme': acme },
    })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ regHrs: 78, otHrs: 5, regRate: 100, otRate: 150, total: 8550 })
  })
})

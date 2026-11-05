import type { ProjectConfig, Snapshot } from '@/persistence/schemas'
import { resolveRates } from '@/reconciler/otCalculator'
import { projectLabel } from '@/lib/projectLabels'

export interface InvoiceLineInput {
  snapshot: Snapshot
  projectKeys: string[]
  configs: Record<string, ProjectConfig>
}

/**
 * One invoice line: a project at one set of rates. A project where some
 * employees have override rates gets one line per distinct rate set, so every
 * line multiplies out (hours × rate = amount).
 */
export interface InvoiceLine {
  projectKey: string
  project: string
  po: string
  regHrs: number
  otHrs: number
  dtHrs: number
  regRate: number
  otRate: number
  dtRate: number
  regAmount: number
  otAmount: number
  dtAmount: number
  total: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export function buildInvoiceLines(data: InvoiceLineInput): InvoiceLine[] {
  // Use the employee profiles the billing rows were calculated with
  const profiles = data.snapshot.employeesAtSave ?? {}
  const lines: InvoiceLine[] = []

  for (const key of data.projectKeys) {
    const cfg = data.configs[key]
    const byRate = new Map<string, { reg: number; ot: number; dt: number; regHrs: number; otHrs: number; dtHrs: number }>()

    for (const row of data.snapshot.weeklyBilling) {
      if (row.projectKey !== key) continue
      const rates = cfg
        ? resolveRates(cfg, row.employeeCode, profiles[row.employeeCode])
        : { regular: 0, ot: 0, dt: 0 }
      const reg = round2(rates.regular)
      const ot = round2(rates.ot)
      const dt = round2(rates.dt)
      const rateKey = `${reg}|${ot}|${dt}`
      const g = byRate.get(rateKey) ?? { reg, ot, dt, regHrs: 0, otHrs: 0, dtHrs: 0 }
      g.regHrs += row.regularHrs
      g.otHrs += row.otHrs
      g.dtHrs += row.dtHrs
      byRate.set(rateKey, g)
    }

    // Highest regular rate first so the project's main rate usually leads
    const groups = Array.from(byRate.values()).sort((a, b) => b.reg - a.reg || b.ot - a.ot)
    for (const g of groups) {
      // Round hours the way they're printed, then price the printed numbers
      const regHrs = round2(g.regHrs)
      const otHrs = round2(g.otHrs)
      const dtHrs = round2(g.dtHrs)
      const regAmount = round2(regHrs * g.reg)
      const otAmount = round2(otHrs * g.ot)
      const dtAmount = round2(dtHrs * g.dt)
      lines.push({
        projectKey: key,
        project: projectLabel(key, data.configs),
        po: cfg?.poNumber ?? '',
        regHrs, otHrs, dtHrs,
        regRate: g.reg, otRate: g.ot, dtRate: g.dt,
        regAmount, otAmount, dtAmount,
        total: round2(regAmount + otAmount + dtAmount),
      })
    }
  }
  return lines
}

export interface InvoiceTotals {
  regular: number
  overtime: number
  doubleTime: number
  total: number
}

/** Invoice totals are the sum of the printed lines, so the invoice adds up on its own. */
export function invoiceTotals(lines: InvoiceLine[]): InvoiceTotals {
  const regular = round2(lines.reduce((s, l) => s + l.regAmount, 0))
  const overtime = round2(lines.reduce((s, l) => s + l.otAmount, 0))
  const doubleTime = round2(lines.reduce((s, l) => s + l.dtAmount, 0))
  return { regular, overtime, doubleTime, total: round2(regular + overtime + doubleTime) }
}

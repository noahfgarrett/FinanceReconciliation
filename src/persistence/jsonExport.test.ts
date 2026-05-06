import { describe, it, expect } from 'vitest'
import { buildExportBundle, readJsonFile } from './jsonExport'
import type { ParsedPdfWithBytes, Snapshot } from './schemas'

describe('buildExportBundle', () => {
  const base = {
    clients: { c1: { id: 'c1', name: 'Acme', paymentTerms: 'Net 30', invoiceNumberCounter: 0 } },
    projectConfigs: {
      p1: {
        projectKey: 'p1',
        displayName: 'P1',
        allocationAliases: [],
        otThresholdHrs: 40,
        includeDoubleTime: false,
        defaultRegularRate: 100,
        employeeRateOverrides: {},
      },
    },
    snapshots: [],
  }

  it('scope=all includes everything', () => {
    const b = buildExportBundle({ ...base, scope: 'all' })
    expect(b.clients).toBeDefined()
    expect(b.projectConfigs).toBeDefined()
    expect(b.snapshots).toBeDefined()
  })

  it('scope=settings excludes snapshots', () => {
    const b = buildExportBundle({ ...base, scope: 'settings' })
    expect(b.snapshots).toBeUndefined()
    expect(b.projectConfigs).toBeDefined()
  })

  it('scope=history excludes settings', () => {
    const b = buildExportBundle({ ...base, scope: 'history' })
    expect(b.clients).toBeUndefined()
    expect(b.snapshots).toBeDefined()
  })

  it('strips pdfBytes from exported snapshots', () => {
    const pdf: ParsedPdfWithBytes = {
      employeeCode: '2000',
      employeeName: 'X Y',
      payPeriodStart: '2026-04-06',
      payPeriodEnd: '2026-04-19',
      entries: [],
      weeklyTotals: {},
      rawText: '',
      pageCount: 1,
      pdfBytes: new ArrayBuffer(2048),
    }
    const snap: Snapshot = {
      id: 'snap-1',
      name: 'Test',
      periodLabel: 'April 2026',
      createdAt: '2026-04-30T00:00:00Z',
      lastModifiedAt: '2026-04-30T00:00:00Z',
      locked: false,
      isDraft: false,
      employees: [],
      excelRows: [],
      parsedPdfs: [pdf],
      projectConfigsAtSave: {},
      clientsAtSave: {},
      weeklyBilling: [],
      warnings: [],
      auditLog: [],
    }
    const bundle = buildExportBundle({
      ...base,
      scope: 'all',
      snapshots: [snap],
    })
    const exported = bundle.snapshots![0]
    const exportedPdf = exported.parsedPdfs[0] as ParsedPdfWithBytes
    expect(exportedPdf.pdfBytes).toBeUndefined()
    // Other fields preserved
    expect(exportedPdf.employeeCode).toBe('2000')
    expect(exportedPdf.pageCount).toBe(1)
  })
})

describe('readJsonFile', () => {
  it('parses a valid bundle', async () => {
    const bundle = {
      schemaVersion: 1,
      exportedAt: '2026-05-05T00:00:00Z',
      appVersion: '0.1.0',
      scope: 'settings',
      clients: {},
      projectConfigs: {},
    }
    const file = new File([JSON.stringify(bundle)], 'bundle.json', { type: 'application/json' })
    const parsed = await readJsonFile(file)
    expect(parsed.scope).toBe('settings')
  })

  it('rejects an invalid bundle', async () => {
    const file = new File([JSON.stringify({ wrong: true })], 'bad.json')
    await expect(readJsonFile(file)).rejects.toThrow()
  })
})

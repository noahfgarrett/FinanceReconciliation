import { describe, it, expect } from 'vitest'
import { buildExportBundle, readJsonFile } from './jsonExport'

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

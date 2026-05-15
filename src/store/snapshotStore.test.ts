import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { useSnapshotStore } from './snapshotStore'
import { _resetDbForTests } from '@/persistence/idb'

beforeEach(async () => {
  _resetDbForTests()
  useSnapshotStore.setState({
    current: null,
    projectConfigs: {},
    clients: {},
    snapshots: [],
    unresolvedAllocations: [],
  })
})

describe('snapshotStore.recompute after project edit', () => {
  it('preserves billing rows when OT threshold is changed', async () => {
    // Step 1: Pre-seed a project config
    await useSnapshotStore.getState().upsertProjectConfig({
      projectKey: 'project-acme',
      displayName: 'Project Acme',
      allocationAliases: ['ACM'],
      otThresholdHrs: 40,
      includeDoubleTime: false,
      defaultRegularRate: 100,
      employeeRateOverrides: {},
    })

    // Step 2: Import data (creates a snapshot with billing)
    await useSnapshotStore.getState().importBatch({
      employees: [{ code: '2000', firstName: 'X', lastName: 'Y' }],
      excelRows: [{
        employeeCode: '2000',
        projectNames: ['Project Acme'],
        allocations: ['ACM'],
        regularHours: 50, overtimeHours: 0, doubleTimeHours: 0, dateUpdated: '2026-04-30',
      }],
      parsedPdfs: [{
        employeeCode: '2000', employeeName: 'X Y',
        payPeriodStart: '2026-04-06', payPeriodEnd: '2026-04-19',
        entries: [{
          date: '2026-04-06', payCode: 'REG', allocation: 'ACM', hoursTotal: 50, weekStart: '2026-04-06',
          confidence: 1, confidenceReasons: [],
        }],
        weeklyTotals: { '2026-04-06': 50 },
        rawText: '',
        pageCount: 0,
      }],
      periodLabel: 'April 2026',
    })

    const before = useSnapshotStore.getState().current
    expect(before).not.toBeNull()
    expect(before!.weeklyBilling).toHaveLength(1)
    expect(before!.weeklyBilling[0].regularHrs).toBe(40)
    expect(before!.weeklyBilling[0].otHrs).toBe(10)

    // Step 3: Edit the project's OT threshold (this triggers recompute)
    await useSnapshotStore.getState().upsertProjectConfig({
      ...useSnapshotStore.getState().projectConfigs['project-acme'],
      otThresholdHrs: 45,
    })

    // Step 4: Verify billing is still present with updated OT split
    const after = useSnapshotStore.getState().current
    expect(after).not.toBeNull()
    expect(after!.weeklyBilling).toHaveLength(1)
    expect(after!.weeklyBilling[0].hours).toBe(50) // total hours preserved
    expect(after!.weeklyBilling[0].regularHrs).toBe(45) // new OT threshold
    expect(after!.weeklyBilling[0].otHrs).toBe(5) // 50 - 45 = 5
    expect(after!.weeklyBilling[0].projectKey).toBe('project-acme')
  })

  it('preserves billing rows when default rate is changed', async () => {
    await useSnapshotStore.getState().upsertProjectConfig({
      projectKey: 'project-acme',
      displayName: 'Project Acme',
      allocationAliases: ['ACM'],
      otThresholdHrs: 40,
      includeDoubleTime: false,
      defaultRegularRate: 100,
      employeeRateOverrides: {},
    })

    await useSnapshotStore.getState().importBatch({
      employees: [{ code: '2000', firstName: 'X', lastName: 'Y' }],
      excelRows: [{
        employeeCode: '2000',
        projectNames: ['Project Acme'],
        allocations: ['ACM'],
        regularHours: 50, overtimeHours: 0, doubleTimeHours: 0, dateUpdated: '2026-04-30',
      }],
      parsedPdfs: [{
        employeeCode: '2000', employeeName: 'X Y',
        payPeriodStart: '2026-04-06', payPeriodEnd: '2026-04-19',
        entries: [{
          date: '2026-04-06', payCode: 'REG', allocation: 'ACM', hoursTotal: 50, weekStart: '2026-04-06',
          confidence: 1, confidenceReasons: [],
        }],
        weeklyTotals: { '2026-04-06': 50 },
        rawText: '',
        pageCount: 0,
      }],
      periodLabel: 'April 2026',
    })

    const before = useSnapshotStore.getState().current
    expect(before!.weeklyBilling[0].regularDollars).toBe(4000) // 40 * 100

    // Edit the rate
    await useSnapshotStore.getState().upsertProjectConfig({
      ...useSnapshotStore.getState().projectConfigs['project-acme'],
      defaultRegularRate: 120,
    })

    const after = useSnapshotStore.getState().current
    expect(after).not.toBeNull()
    expect(after!.weeklyBilling).toHaveLength(1)
    expect(after!.weeklyBilling[0].regularDollars).toBe(4800) // 40 * 120
    expect(after!.weeklyBilling[0].hours).toBe(50) // total hours preserved
  })

  it('preserves old billing when recompute would produce empty results', async () => {
    // Pre-seed a project with aliases
    await useSnapshotStore.getState().upsertProjectConfig({
      projectKey: 'project-acme',
      displayName: 'Project Acme',
      allocationAliases: ['ACM'],
      otThresholdHrs: 40,
      includeDoubleTime: false,
      defaultRegularRate: 100,
      employeeRateOverrides: {},
    })

    // Import data
    await useSnapshotStore.getState().importBatch({
      employees: [{ code: '2000', firstName: 'X', lastName: 'Y' }],
      excelRows: [{
        employeeCode: '2000',
        projectNames: ['Project Acme'],
        allocations: ['ACM'],
        regularHours: 50, overtimeHours: 0, doubleTimeHours: 0, dateUpdated: '2026-04-30',
      }],
      parsedPdfs: [{
        employeeCode: '2000', employeeName: 'X Y',
        payPeriodStart: '2026-04-06', payPeriodEnd: '2026-04-19',
        entries: [{
          date: '2026-04-06', payCode: 'REG', allocation: 'ACM', hoursTotal: 50, weekStart: '2026-04-06',
          confidence: 1, confidenceReasons: [],
        }],
        weeklyTotals: { '2026-04-06': 50 },
        rawText: '',
        pageCount: 0,
      }],
      periodLabel: 'April 2026',
    })

    const before = useSnapshotStore.getState().current
    expect(before!.weeklyBilling).toHaveLength(1)

    // Remove all aliases — this would make reconcile produce empty billing
    await useSnapshotStore.getState().upsertProjectConfig({
      ...useSnapshotStore.getState().projectConfigs['project-acme'],
      allocationAliases: [],
    })

    // Safety guard should preserve the old billing
    const after = useSnapshotStore.getState().current
    expect(after).not.toBeNull()
    expect(after!.weeklyBilling).toHaveLength(1) // preserved, not wiped
  })

  it('handles multi-project config edits without losing other projects billing', async () => {
    // Pre-seed two projects
    await useSnapshotStore.getState().upsertProjectConfig({
      projectKey: 'project-alpha',
      displayName: 'Alpha',
      allocationAliases: ['ALPHA'],
      otThresholdHrs: 40,
      includeDoubleTime: false,
      defaultRegularRate: 80,
      employeeRateOverrides: {},
    })
    await useSnapshotStore.getState().upsertProjectConfig({
      projectKey: 'project-beta',
      displayName: 'Beta',
      allocationAliases: ['BETA'],
      otThresholdHrs: 40,
      includeDoubleTime: false,
      defaultRegularRate: 100,
      employeeRateOverrides: {},
    })

    // Import data with entries for both projects
    await useSnapshotStore.getState().importBatch({
      employees: [
        { code: '1001', firstName: 'A', lastName: 'B' },
        { code: '1002', firstName: 'C', lastName: 'D' },
      ],
      excelRows: [
        { employeeCode: '1001', projectNames: ['Alpha'], allocations: ['ALPHA'], regularHours: 40, overtimeHours: 0, doubleTimeHours: 0, dateUpdated: '2026-04-30' },
        { employeeCode: '1002', projectNames: ['Beta'], allocations: ['BETA'], regularHours: 45, overtimeHours: 0, doubleTimeHours: 0, dateUpdated: '2026-04-30' },
      ],
      parsedPdfs: [
        {
          employeeCode: '1001', employeeName: 'A B',
          payPeriodStart: '2026-04-06', payPeriodEnd: '2026-04-19',
          entries: [{ date: '2026-04-06', payCode: 'REG', allocation: 'ALPHA', hoursTotal: 40, weekStart: '2026-04-06', confidence: 1, confidenceReasons: [] }],
          weeklyTotals: { '2026-04-06': 40 }, rawText: '', pageCount: 0,
        },
        {
          employeeCode: '1002', employeeName: 'C D',
          payPeriodStart: '2026-04-06', payPeriodEnd: '2026-04-19',
          entries: [{ date: '2026-04-06', payCode: 'REG', allocation: 'BETA', hoursTotal: 45, weekStart: '2026-04-06', confidence: 1, confidenceReasons: [] }],
          weeklyTotals: { '2026-04-06': 45 }, rawText: '', pageCount: 0,
        },
      ],
      periodLabel: 'April 2026',
    })

    expect(useSnapshotStore.getState().current!.weeklyBilling).toHaveLength(2)

    // Edit only project Alpha's OT threshold
    await useSnapshotStore.getState().upsertProjectConfig({
      ...useSnapshotStore.getState().projectConfigs['project-alpha'],
      otThresholdHrs: 35,
    })

    const after = useSnapshotStore.getState().current!
    expect(after.weeklyBilling).toHaveLength(2) // both projects still have rows
    const alphaRow = after.weeklyBilling.find(r => r.projectKey === 'project-alpha')!
    const betaRow = after.weeklyBilling.find(r => r.projectKey === 'project-beta')!
    expect(alphaRow.regularHrs).toBe(35)
    expect(alphaRow.otHrs).toBe(5)
    expect(betaRow.regularHrs).toBe(40) // unchanged
    expect(betaRow.otHrs).toBe(5) // unchanged
  })
})

describe('snapshotStore.importBatch', () => {
  it('creates a draft snapshot from synthetic inputs and computes billing', async () => {
    // Pre-seed a project config with an alias for 'ACM' so the PDF allocation
    // resolves. (The new bootstrap does NOT auto-populate aliases from Excel.)
    await useSnapshotStore.getState().upsertProjectConfig({
      projectKey: 'project-acme',
      displayName: 'Project Acme',
      allocationAliases: ['ACM'],
      otThresholdHrs: 40,
      includeDoubleTime: false,
      defaultRegularRate: 100,
      employeeRateOverrides: {},
    })

    await useSnapshotStore.getState().importBatch({
      employees: [{ code: '2000', firstName: 'X', lastName: 'Y' }],
      excelRows: [{
        employeeCode: '2000',
        projectNames: ['Project Acme'],
        allocations: ['ACM'],
        regularHours: 50, overtimeHours: 0, doubleTimeHours: 0, dateUpdated: '2026-04-30',
      }],
      parsedPdfs: [{
        employeeCode: '2000', employeeName: 'X Y',
        payPeriodStart: '2026-04-06', payPeriodEnd: '2026-04-19',
        entries: [{
          date: '2026-04-06', payCode: 'REG', allocation: 'ACM', hoursTotal: 50, weekStart: '2026-04-06',
          confidence: 1, confidenceReasons: [],
        }],
        weeklyTotals: { '2026-04-06': 50 },
        rawText: '',
        pageCount: 0,
      }],
      periodLabel: 'April 2026',
    })

    const cur = useSnapshotStore.getState().current
    expect(cur).not.toBeNull()
    expect(cur!.weeklyBilling).toHaveLength(1)
    expect(cur!.weeklyBilling[0].regularHrs).toBe(40)
    expect(cur!.weeklyBilling[0].otHrs).toBe(10)
    expect(cur!.isDraft).toBe(true)
    expect(useSnapshotStore.getState().projectConfigs['project-acme']).toBeDefined()
  })

  it('persists snapshot across hydrate', async () => {
    await useSnapshotStore.getState().importBatch({
      employees: [{ code: '2000', firstName: 'X', lastName: 'Y' }],
      excelRows: [{
        employeeCode: '2000',
        projectNames: ['P'],
        allocations: ['ACM'],
        regularHours: 30, overtimeHours: 0, doubleTimeHours: 0, dateUpdated: '2026-04-30',
      }],
      parsedPdfs: [],
      periodLabel: 'April 2026',
    })
    // Reset in-memory state, then hydrate from idb
    useSnapshotStore.setState({ current: null, snapshots: [], projectConfigs: {} })
    await useSnapshotStore.getState().hydrate()
    expect(useSnapshotStore.getState().current).not.toBeNull()
  })
})

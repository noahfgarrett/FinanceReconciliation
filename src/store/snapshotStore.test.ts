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

describe('snapshotStore.importBatch', () => {
  it('creates a draft snapshot from synthetic inputs and computes billing', async () => {
    await useSnapshotStore.getState().importBatch({
      employees: [{ code: '2000', firstName: 'X', lastName: 'Y' }],
      excelRows: [{
        employeeCode: '2000', laborAllocationDetails: 'ACM', projectName: 'Project Acme',
        regularHours: 50, overtimeHours: 0, doubleTimeHours: 0, dateUpdated: '2026-04-30',
      }],
      parsedPdfs: [{
        employeeCode: '2000', employeeName: 'X Y',
        payPeriodStart: '2026-04-06', payPeriodEnd: '2026-04-19',
        entries: [{ date: '2026-04-06', payCode: 'REG', allocation: 'ACM', hoursTotal: 50, weekStart: '2026-04-06' }],
        weeklyTotals: { '2026-04-06': 50 },
        rawText: '',
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
        employeeCode: '2000', laborAllocationDetails: 'ACM', projectName: 'P',
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

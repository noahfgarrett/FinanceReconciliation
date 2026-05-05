import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { kvGet, kvSet, kvDelete, putRecord, getAll, clearAll, _resetDbForTests } from './idb'

beforeEach(async () => {
  _resetDbForTests()
  // fake-indexeddb is fresh per import; clearAll for safety in repeat runs
})

describe('idb', () => {
  it('round-trips values via kv', async () => {
    await kvSet('theme', 'dark')
    expect(await kvGet<string>('theme')).toBe('dark')
  })

  it('deletes kv values', async () => {
    await kvSet('x', 1)
    await kvDelete('x')
    expect(await kvGet('x')).toBeUndefined()
  })

  it('stores and lists records in a typed store', async () => {
    await putRecord('configs', 'project-a', { name: 'Project A', threshold: 40 })
    await putRecord('configs', 'project-b', { name: 'Project B', threshold: 50 })
    const all = await getAll<{ name: string; threshold: number }>('configs')
    expect(all).toHaveLength(2)
    expect(all.map((c) => c.threshold).sort()).toEqual([40, 50])
  })

  it('clearAll wipes every store', async () => {
    await kvSet('y', 1)
    await putRecord('configs', 'k', { v: 1 })
    await clearAll()
    expect(await kvGet('y')).toBeUndefined()
    expect(await getAll('configs')).toHaveLength(0)
  })
})

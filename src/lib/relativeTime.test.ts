import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { relativeTime } from './relativeTime'

beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-05-05T12:00:00Z')))
afterEach(() => vi.useRealTimers())

describe('relativeTime', () => {
  it('just now under a minute', () => {
    expect(relativeTime('2026-05-05T11:59:30Z')).toBe('just now')
  })
  it('minutes', () => {
    expect(relativeTime('2026-05-05T11:55:00Z')).toBe('5m ago')
  })
  it('hours', () => {
    expect(relativeTime('2026-05-05T09:00:00Z')).toBe('3h ago')
  })
  it('days', () => {
    expect(relativeTime('2026-05-03T12:00:00Z')).toBe('2d ago')
  })
  it('falls back to formatted date past 7 days', () => {
    const out = relativeTime('2026-04-15T12:00:00Z')
    expect(out).toMatch(/Apr 15, 2026/)
  })
})

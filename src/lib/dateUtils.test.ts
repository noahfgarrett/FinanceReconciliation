import { describe, it, expect } from 'vitest'
import { isoMonday } from './dateUtils'

describe('isoMonday', () => {
  it('returns the same date for a Monday', () => {
    expect(isoMonday('2026-04-06')).toBe('2026-04-06')
  })
  it('returns the prior Monday for a Wednesday', () => {
    expect(isoMonday('2026-04-08')).toBe('2026-04-06')
  })
  it('handles Sundays correctly', () => {
    expect(isoMonday('2026-04-12')).toBe('2026-04-06')
  })
  it('handles year boundaries', () => {
    expect(isoMonday('2026-01-01')).toBe('2025-12-29')
  })
})

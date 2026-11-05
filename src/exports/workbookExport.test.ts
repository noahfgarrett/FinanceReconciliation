import { describe, it, expect } from 'vitest'
import { toSheetName } from './workbookExport'

describe('toSheetName', () => {
  it('turns the unmapped label into a readable sheet name', () => {
    expect(toSheetName('Unmapped: UNKNOWN-PRJ-999')).toBe('Unmapped - UNKNOWN-PRJ-999')
  })
  it('replaces characters Excel rejects and caps the length at 31', () => {
    expect(toSheetName('A/B*C?[D]')).toBe('A-B-C--D-')
    expect(toSheetName('Project Alpha — Data Center 1 East Wing').length).toBe(31)
  })
})

import { describe, it, expect } from 'vitest'
import { rowsToCsv } from './csvExport'

describe('rowsToCsv', () => {
  it('handles plain values', () => {
    const csv = rowsToCsv(
      [{ a: 1, b: 'foo' }, { a: 2, b: 'bar' }],
      [{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }],
    )
    expect(csv).toBe('A,B\n1,foo\n2,bar')
  })
  it('escapes commas, quotes, and newlines', () => {
    const csv = rowsToCsv([{ x: 'a,b' }, { x: 'c"d' }, { x: 'e\nf' }], [{ key: 'x', header: 'X' }])
    expect(csv).toBe('X\n"a,b"\n"c""d"\n"e\nf"')
  })
  it('respects custom format function', () => {
    const csv = rowsToCsv(
      [{ n: 0.5 }],
      [{ key: 'n', header: 'N', format: (v) => `${(Number(v) * 100).toFixed(0)}%` }],
    )
    expect(csv).toBe('N\n50%')
  })
})

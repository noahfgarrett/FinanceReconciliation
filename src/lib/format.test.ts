import { describe, it, expect } from 'vitest'
import { pluralize } from './format'

describe('pluralize', () => {
  it('uses the singular for exactly one', () => {
    expect(pluralize(1, 'employee')).toBe('1 employee')
  })
  it('uses the plural for zero and many', () => {
    expect(pluralize(0, 'week')).toBe('0 weeks')
    expect(pluralize(35, 'employee')).toBe('35 employees')
  })
  it('accepts an irregular plural and formats large numbers', () => {
    expect(pluralize(2, 'project needs rates', 'projects need rates')).toBe('2 projects need rates')
    expect(pluralize(1200, 'row')).toBe('1,200 rows')
  })
})

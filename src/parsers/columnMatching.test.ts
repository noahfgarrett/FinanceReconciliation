import { describe, it, expect } from 'vitest'
import { matchHeaders, missingRequiredColumns } from './columnMatching'

describe('matchHeaders', () => {
  it('matches exact spec header names', () => {
    const headers = [
      'Employee Code', 'Legal Firstname', 'Legal Lastname',
      'Regular Hours', 'Overtime Hours', 'Double Time Hours',
      'Date (Updated)', 'WWID', 'Labor Allocation Details',
      'Project Name Desc-Delete',
    ]
    const map = matchHeaders(headers)
    expect(map['employeeCode']).toBe(0)
    expect(map['firstName']).toBe(1)
    expect(map['lastName']).toBe(2)
    expect(map['regularHours']).toBe(3)
    expect(map['overtimeHours']).toBe(4)
    expect(map['doubleTimeHours']).toBe(5)
    expect(map['dateUpdated']).toBe(6)
    expect(map['wwid']).toBe(7)
    expect(map['laborAllocationDetails']).toBe(8)
    expect(map['projectName']).toBe(9)
  })

  it('matches abbreviated headers', () => {
    const headers = ['Emp Code', 'First Name', 'Last Name', 'Reg Hours', 'OT Hours', 'DT Hours', 'Project']
    const map = matchHeaders(headers)
    expect(map['employeeCode']).toBe(0)
    expect(map['firstName']).toBe(1)
    expect(map['lastName']).toBe(2)
    expect(map['regularHours']).toBe(3)
    expect(map['overtimeHours']).toBe(4)
    expect(map['doubleTimeHours']).toBe(5)
    expect(map['projectName']).toBe(6)
  })

  it('handles empty cells gracefully', () => {
    const headers = ['', 'Employee Code', '', 'Regular Hours', 'Project Name']
    const map = matchHeaders(headers)
    expect(map['employeeCode']).toBe(1)
    expect(map['regularHours']).toBe(3)
  })
})

describe('missingRequiredColumns', () => {
  it('returns empty array when all required cols present', () => {
    const map = { employeeCode: 0, firstName: 1, lastName: 2, regularHours: 3, projectName: 4 }
    expect(missingRequiredColumns(map)).toHaveLength(0)
  })

  it('identifies missing required columns', () => {
    const map = { employeeCode: 0, firstName: 1 }
    const missing = missingRequiredColumns(map)
    expect(missing).toContain('lastName')
    expect(missing).toContain('regularHours')
    expect(missing).toContain('projectName')
  })
})
